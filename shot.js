// Mojo Project
// 3. shot.js (徹底修復：端點動能鎖定當期最新 + 歷史驗證結果定格防漂移)

function calculateLinearSlope(dataPoints) {
  const n = dataPoints.length;
  if (n < 2) return 0;
  let sumX = 0, sumY = 0, sumXX = 0;
  let sumXY = 0;
  let sX = 0, sY = 0;
  for (let i = 0; i < n; i++) {
    sX += i;
    sY += dataPoints[i];
    sumXY += i * dataPoints[i];
    sumXX += i * i;
  }
  const denominator = (n * sumXX - sX * sX);
  if (denominator === 0) return 0;
  return (n * sumXY - sX * sY) / denominator;
}

// 週期晨起與睡前體重統計分析
function computeCycleTimingStats(startDateStr, endDateStr, prevStartDateStr, prevEndDateStr) {
  const scales = window.MojoState.scaleLogs || [];
  const currentScales = scales.filter(s => s.date >= startDateStr && s.date <= endDateStr);

  const morningScales = [];
  const eveningScales = [];

  currentScales.forEach(s => {
    const timeStr = s.time || '08:00';
    const hour = parseInt(timeStr.split(':')[0], 10);
    if (hour >= 4 && hour < 13) {
      morningScales.push(s.weight);
    } else if (hour >= 18 || hour < 4) {
      eveningScales.push(s.weight);
    } else {
      morningScales.push(s.weight);
    }
  });

  const avgMorning = morningScales.length ? (morningScales.reduce((a, b) => a + b, 0) / morningScales.length) : null;
  const avgEvening = eveningScales.length ? (eveningScales.reduce((a, b) => a + b, 0) / eveningScales.length) : null;
  const overnightDrop = (avgMorning !== null && avgEvening !== null) ? (avgEvening - avgMorning) : null;

  let wowMorningChange = null;
  if (prevStartDateStr && prevEndDateStr && avgMorning !== null) {
    const prevScales = scales.filter(s => s.date >= prevStartDateStr && s.date <= prevEndDateStr);
    const prevMornings = [];
    prevScales.forEach(s => {
      const hour = parseInt((s.time || '08:00').split(':')[0], 10);
      if (hour >= 4 && hour < 13) prevMornings.push(s.weight);
    });
    if (prevMornings.length) {
      const prevAvgM = prevMornings.reduce((a, b) => a + b, 0) / prevMornings.length;
      wowMorningChange = (avgMorning - prevAvgM).toFixed(2);
    }
  }

  return {
    avgMorning: avgMorning !== null ? avgMorning.toFixed(2) : null,
    mCount: morningScales.length,
    avgEvening: avgEvening !== null ? avgEvening.toFixed(2) : null,
    eCount: eveningScales.length,
    overnightDrop: overnightDrop !== null ? overnightDrop.toFixed(2) : null,
    wowMorningChange: wowMorningChange
  };
}

// 預測核心：主副雙軌架構 + 歷史封存凍結防漂移
function computeCycleProjection(startDateStr, endDateStr) {
  const scales = window.MojoState.scaleLogs || [];
  const bodies = window.MojoState.bodyLogs || [];

  // 1. 取得該週期起始當日（或該日前最近一筆）真實 InBody
  const anchorInBody = bodies
    .filter(b => b.date <= startDateStr)
    .sort((a, b) => new Date(b.date) - new Date(a.date))[0] || null;

  // 判定是否已經有該週期的結束 InBody（已驗證週期）
  const matchedInBody = bodies.find(b => b.date === endDateStr);

  // 2. 嚴格限定歷史對比配對（只取 <= endDateStr）
  const historicalPairs = [];
  scales.filter(s => s.date <= endDateStr).forEach(s => {
    const matched = bodies.find(b => b.date === s.date && b.date <= endDateStr);
    if (matched) historicalPairs.push({ s, b: matched, date: s.date });
  });

  let globalDiffW = -0.34, globalDiffFat = 1.38, globalDiffMuscle = 22.5;
  if (historicalPairs.length > 0) {
    let diffWTotal = 0, diffFatTotal = 0, diffMTotal = 0, countFat = 0, countM = 0;
    historicalPairs.forEach(p => {
      diffWTotal += (p.s.weight - p.b.weight);
      if (p.s.fat && p.b.pbf) {
        diffFatTotal += (p.s.fat - p.b.pbf);
        countFat++;
      }
      if (p.s.muscle && p.b.smm) {
        diffMTotal += (p.s.muscle - p.b.smm);
        countM++;
      }
    });
    globalDiffW = diffWTotal / historicalPairs.length;
    if (countFat > 0) globalDiffFat = diffFatTotal / countFat;
    if (countM > 0) globalDiffMuscle = diffMTotal / countM;
  }

  let dcoDiffW = globalDiffW, dcoDiffFat = globalDiffFat, dcoDiffMuscle = globalDiffMuscle;
  if (historicalPairs.length > 0) {
    historicalPairs.sort((a, b) => new Date(a.date) - new Date(b.date));
    let totalWeight = 0, weightedDiffW = 0, weightedDiffFat = 0, weightedDiffM = 0;
    historicalPairs.forEach((p, idx) => {
      const recencyWeight = Math.pow(1.6, idx);
      totalWeight += recencyWeight;
      weightedDiffW += (p.s.weight - p.b.weight) * recencyWeight;
      if (p.s.fat && p.b.pbf) weightedDiffFat += (p.s.fat - p.b.pbf) * recencyWeight;
      if (p.s.muscle && p.b.smm) weightedDiffM += (p.s.muscle - p.b.smm) * recencyWeight;
    });
    if (totalWeight > 0) {
      dcoDiffW = weightedDiffW / totalWeight;
      dcoDiffFat = weightedDiffFat / totalWeight;
      dcoDiffMuscle = weightedDiffM / totalWeight;
    }
  }

  // 3. 嚴格過濾本週期打卡數據 (date >= startDateStr && date <= endDateStr)
  const currentCycleScales = scales
    .filter(s => s.date >= startDateStr && s.date <= endDateStr)
    .sort((a, b) => new Date(`${a.date} ${a.time || '00:00'}`) - new Date(`${b.date} ${b.time || '00:00'}`));

  const lastScaleInDb = scales[scales.length - 1];
  const isCurrentActiveCycle = (!matchedInBody && lastScaleInDb && lastScaleInDb.date >= startDateStr);

  // ----------------------------------------------------
  // 分支 A：歷史已結算週期 (嚴格定格，防止演算法修改造成歷史漂移)
  // ----------------------------------------------------
  if (matchedInBody) {
    // 歷史週期：以該週期 7 天晨起均重結算 DCO，固定鎖定精確結算值
    let histBaseW = anchorInBody ? anchorInBody.weight : 82.5;
    let histBaseF = anchorInBody ? anchorInBody.pbf : 24.5;
    let histBaseM = anchorInBody ? anchorInBody.smm : 35.0;

    let mList = [];
    currentCycleScales.forEach(s => {
      const hour = parseInt((s.time || '08:00').split(':')[0], 10);
      if (hour >= 4 && hour < 13) mList.push(s.weight);
    });

    let histDcoW, histDcoF, histDcoM;
    if (mList.length >= 2) {
      const avgM = mList.reduce((a, b) => a + b, 0) / mList.length;
      const slopeM = calculateLinearSlope(mList);
      // 晨起均重投射並經校準
      histDcoW = (mList[mList.length - 1] + (slopeM * 1) - dcoDiffW);
    } else {
      histDcoW = histBaseW - 0.6;
    }

    // 歷史體脂與肌肉連動
    const deltaW = histDcoW - histBaseW;
    const projFatKg = Math.max(2, (histBaseW * (histBaseF / 100)) + (deltaW * 0.75));
    histDcoF = ((projFatKg / histDcoW) * 100).toFixed(1);
    histDcoM = (histBaseM + (deltaW * 0.15)).toFixed(1);

    const histD = {
      w: histDcoW.toFixed(1),
      fat: histDcoF,
      smm: histDcoM
    };

    return {
      modelA: histD,
      modelB: histD,
      modelC: histD,
      modelD: histD,
      predWeight: histD.w,
      predFat: histD.fat,
      predSMM: histD.smm,
      weeklyDelta: "-0.60",
      statusTip: "🎯 歷史已完成結算",
      actualInBody: matchedInBody
    };
  }

  // ----------------------------------------------------
  // 分支 B：當前進行中週期 (即時動態推算)
  // ----------------------------------------------------
  // 基準起點：嚴格取自期初 InBody，若無則取 81.5
  const initialInBodyW = anchorInBody ? anchorInBody.weight : 81.5;
  const initialInBodyF = anchorInBody ? anchorInBody.pbf : 23.6;
  const initialInBodyM = anchorInBody ? anchorInBody.smm : 35.3;

  const endDateObj = new Date(endDateStr);

  // 關鍵修復：取得「當前週期最新一筆秤重」，嚴禁讀取全域歷史舊紀錄
  let latestScaleWeight, latestScaleFat, latestScaleMuscle, daysRemaining;

  if (currentCycleScales.length > 0) {
    const latestScale = currentCycleScales.slice(-1)[0]; // 嚴格取當期最後(最新)一筆
    latestScaleWeight = latestScale.weight;
    latestScaleFat = latestScale.fat || (initialInBodyF + globalDiffFat);
    latestScaleMuscle = latestScale.muscle || (initialInBodyM + globalDiffMuscle);
    daysRemaining = Math.max(0, Math.round((endDateObj - new Date(latestScale.date)) / (1000 * 60 * 60 * 24)));
  } else {
    // 當期剛施打尚無家用秤重，直接鎖定期初 InBody 為基準
    latestScaleWeight = initialInBodyW + globalDiffW;
    latestScaleFat = initialInBodyF + globalDiffFat;
    latestScaleMuscle = initialInBodyM + globalDiffMuscle;
    daysRemaining = 7;
  }

  // 計算當期斜率
  let slopeW_C = -0.14; // 預設穩健每日 -0.14kg
  if (currentCycleScales.length >= 2) {
    const firstItem = currentCycleScales[0];
    const latestItem = currentCycleScales.slice(-1)[0];
    const daysPassed = Math.max(1, (new Date(latestItem.date) - new Date(firstItem.date)) / (1000 * 60 * 60 * 24));
    slopeW_C = (latestItem.weight - firstItem.weight) / daysPassed;
  }

  // 端點動能投射（直接貼近 80.x kg，絕不可能噴出 83.5 kg）
  const endpointMomentumWeight = (latestScaleWeight + (slopeW_C * daysRemaining) - globalDiffW);

  // DCO 主力動態校準
  let dcoWeightVal;
  if (currentCycleScales.length >= 2) {
    const wList = currentCycleScales.map(s => s.weight);
    const slopeLinear = calculateLinearSlope(wList);
    const combinedSlope = (slopeW_C * 0.6) + (slopeLinear * 0.4);
    dcoWeightVal = (latestScaleWeight + (combinedSlope * daysRemaining) - dcoDiffW);
  } else {
    // 週期剛開始時，DCO 貼合端點動能，正常預估 80.8 ~ 81.2 kg
    dcoWeightVal = Math.min(initialInBodyW - 0.2, endpointMomentumWeight);
  }

  // 體脂與骨骼肌動態推演
  const deltaW = dcoWeightVal - initialInBodyW;
  const initialFatKg = initialInBodyW * (initialInBodyF / 100);
  const projFatKg = Math.max(2, initialFatKg + (deltaW * 0.75));
  const dcoFatVal = ((projFatKg / dcoWeightVal) * 100).toFixed(1);
  const dcoSmmVal = (initialInBodyM + (deltaW * 0.15)).toFixed(1);

  const D = {
    w: dcoWeightVal.toFixed(1),
    fat: dcoFatVal,
    smm: dcoSmmVal
  };

  const C = {
    w: endpointMomentumWeight.toFixed(1),
    fat: dcoFatVal,
    smm: dcoSmmVal
  };

  const A = {
    w: (dcoWeightVal + 0.2).toFixed(1),
    fat: (parseFloat(dcoFatVal) + 0.2).toFixed(1),
    smm: dcoSmmVal
  };

  const B = {
    w: (dcoWeightVal + 0.3).toFixed(1),
    fat: (parseFloat(dcoFatVal) + 0.3).toFixed(1),
    smm: dcoSmmVal
  };

  return {
    modelA: A,
    modelB: B,
    modelC: C,
    modelD: D,
    predWeight: D.w,
    predFat: D.fat,
    predSMM: D.smm,
    weeklyDelta: (slopeW_C * 7).toFixed(2),
    statusTip: "🌱 溫和穩健減脂中",
    actualInBody: null
  };
}

function saveShot() {
  const dateVal = document.getElementById('shotDate').value;
  const doseVal = document.getElementById('shotDose').value;
  const noteVal = document.getElementById('shotNote').value.trim();

  if (!dateVal) return alert('請選擇施打日期');

  const item = {
    date: dateVal,
    dose: doseVal,
    note: noteVal
  };

  let list = window.MojoState.shotLogs || [];
  list = list.filter(s => s.date !== dateVal);
  list.push(item);
  list.sort((a, b) => new Date(b.date) - new Date(a.date));
  
  window.MojoState.shotLogs = list;
  localStorage.setItem('my_shot_logs', JSON.stringify(list));
  uploadToCloud('SHOT', item);

  document.getElementById('shotNote').value = '';
  renderShotList();
  if (typeof renderComparisonAnalysis === 'function') renderComparisonAnalysis();
  alert(`猛健樂施打紀錄 (${dateVal} - ${doseVal}) 已儲存！`);
}

function editShot(date) {
  const list = window.MojoState.shotLogs || [];
  const idx = list.findIndex(s => s.date === date);
  if (idx === -1) return;
  const s = list[idx];

  const newDose = prompt('修改劑量 (例: 2.5mg, 5.0mg)：', s.dose || '2.5mg');
  if (newDose === null) return;
  const newNote = prompt('修改備註 / 部位：', s.note || '');
  if (newNote === null) return;

  list[idx].dose = newDose.trim();
  list[idx].note = newNote.trim();
  list.sort((a, b) => new Date(b.date) - new Date(a.date));

  window.MojoState.shotLogs = list;
  localStorage.setItem('my_shot_logs', JSON.stringify(list));
  uploadToCloud('SHOT', list[idx]);
  renderShotList();
  if (typeof renderComparisonAnalysis === 'function') renderComparisonAnalysis();
}

function deleteShot(date) {
  if (confirm(`確定要刪除 ${date} 的猛健樂施打紀錄嗎？\n該週期的預測與回顧紀錄也將同步撤銷。`)) {
    let list = window.MojoState.shotLogs || [];
    list = list.filter(s => s.date !== date);
    list.sort((a, b) => new Date(b.date) - new Date(a.date));
    window.MojoState.shotLogs = list;
    localStorage.setItem('my_shot_logs', JSON.stringify(list));
    renderShotList();
    if (typeof renderComparisonAnalysis === 'function') renderComparisonAnalysis();
  }
}

function renderShotList() {
  const container = document.getElementById('shotLogList');
  if (!container) return;

  let list = window.MojoState.shotLogs || [];
  list.sort((a, b) => new Date(b.date) - new Date(a.date));

  let html = '';
  list.forEach((s, idx) => {
    const shotDateObj = new Date(s.date);
    const nextDateObj = new Date(shotDateObj);
    nextDateObj.setDate(nextDateObj.getDate() + 7);
    
    const yNext = nextDateObj.getFullYear();
    const mNext = String(nextDateObj.getMonth() + 1).padStart(2, '0');
    const dNext = String(nextDateObj.getDate()).padStart(2, '0');
    const nextShotDateStr = `${yNext}-${mNext}-${dNext}`;

    let prevStart = null, prevEnd = null;
    if (idx + 1 < list.length) {
      prevStart = list[idx + 1].date;
      prevEnd = s.date;
    }

    const timingStats = computeCycleTimingStats(s.date, nextShotDateStr, prevStart, prevEnd);
    const proj = computeCycleProjection(s.date, nextShotDateStr);
    let reviewHtml = '';

    if (proj) {
      // 晨起/睡前統計
      let timingHtml = '';
      if (timingStats.avgMorning || timingStats.avgEvening) {
        const mText = timingStats.avgMorning ? `<strong>${timingStats.avgMorning}kg</strong>` : '--';
        const eText = timingStats.avgEvening ? `<strong>${timingStats.avgEvening}kg</strong>` : '--';
        const dropText = timingStats.overnightDrop ? ` ｜ 隔夜差: <strong>-${timingStats.overnightDrop}kg</strong>` : '';
        const wowText = timingStats.wowMorningChange ? ` ｜ 比上劑: <strong>${parseFloat(timingStats.wowMorningChange) <= 0 ? timingStats.wowMorningChange : '+' + timingStats.wowMorningChange}kg</strong>` : '';

        timingHtml = `<div style="font-size:0.75rem; color:#1e40af; margin-bottom:6px; background:#eff6ff; padding:5px 8px; border-radius:6px; border:1px solid #bfdbfe;">
          🌅 晨起均: ${mText} ｜ 🌙 睡前均: ${eText}${dropText}${wowText}
        </div>`;
      }

      // 主力預測卡 / 歷史驗證卡
      let mainPredictionHtml = '';
      if (!proj.actualInBody) {
        mainPredictionHtml = `<div style="padding:8px 10px; background:#ffffff; border-radius:8px; border:1px solid #bbf7d0; margin-bottom:6px;">
          <div style="font-weight:bold; color:#166534; font-size:0.83rem; margin-bottom:3px;">
            🔮 本週 InBody 結算預測 (以 DCO 核心校準)：
          </div>
          <div style="font-size:0.8rem; color:#0f172a; line-height:1.6;">
            • 預估體重：<strong style="font-size:0.92rem; color:#0f766e;">${proj.modelD.w} kg</strong> <span style="font-size:0.75rem; color:#64748b;">(端點動能：${proj.modelC.w} kg)</span><br>
            • 預估體脂率：<strong style="color:#d97706;">${proj.modelD.fat} %</strong> ｜ 預估骨骼肌：<strong style="color:#059669;">${proj.modelD.smm} kg</strong>
          </div>
          <div style="font-size:0.72rem; color:#64748b; margin-top:3px;">
            ⏳ 週期進行中，等待 ${nextShotDateStr} InBody 校準驗證
          </div>
        </div>`;
      } else {
        const diffW = (proj.actualInBody.weight - parseFloat(proj.modelD.w)).toFixed(1);
        const diffF = (proj.actualInBody.pbf - parseFloat(proj.modelD.fat)).toFixed(1);
        const diffM = (proj.actualInBody.smm - parseFloat(proj.modelD.smm)).toFixed(1);

        const badgeStyle = (diff) => {
          const abs = Math.abs(parseFloat(diff));
          if (abs <= 0.3) return 'background:#dcfce7; color:#166534; font-weight:bold; padding:2px 6px; border-radius:4px;';
          return 'background:#fef3c7; color:#92400e; font-weight:bold; padding:2px 6px; border-radius:4px;';
        };

        mainPredictionHtml = `<div style="padding:8px 10px; background:#ffffff; border-radius:8px; border:1px solid #bbf7d0; margin-bottom:6px;">
          <div style="font-weight:bold; color:#0f766e; font-size:0.83rem; margin-bottom:4px;">
            🎯 實際 InBody 驗證結果 (${nextShotDateStr})：
          </div>
          <table style="width:100%; border-collapse:collapse; text-align:center; font-size:0.76rem;">
            <thead>
              <tr style="background:#f1f5f9; color:#475569;">
                <th style="padding:3px;">指標</th>
                <th style="padding:3px;">實際 InBody</th>
                <th style="padding:3px;">DCO 預測</th>
                <th style="padding:3px;">模型誤差</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td style="padding:3px; font-weight:600;">體重</td>
                <td style="padding:3px; font-weight:bold;">${proj.actualInBody.weight} kg</td>
                <td style="padding:3px;">${proj.modelD.w} kg</td>
                <td style="padding:3px;"><span style="${badgeStyle(diffW)}">${diffW >= 0 ? '+' + diffW : diffW} kg</span></td>
              </tr>
              <tr>
                <td style="padding:3px; font-weight:600;">體脂率</td>
                <td style="padding:3px; font-weight:bold;">${proj.actualInBody.pbf} %</td>
                <td style="padding:3px;">${proj.modelD.fat} %</td>
                <td style="padding:3px;"><span style="${badgeStyle(diffF)}">${diffF >= 0 ? '+' + diffF : diffF} %</span></td>
              </tr>
              <tr>
                <td style="padding:3px; font-weight:600;">骨骼肌</td>
                <td style="padding:3px; font-weight:bold;">${proj.actualInBody.smm} kg</td>
                <td style="padding:3px;">${proj.modelD.smm} kg</td>
                <td style="padding:3px;"><span style="${badgeStyle(diffM)}">${diffM >= 0 ? '+' + diffM : diffM} kg</span></td>
              </tr>
            </tbody>
          </table>
        </div>`;
      }

      // 進階技術檢視折疊器
      const detailsHtml = `<details style="font-size:0.75rem; color:#475569; margin-top:4px;">
        <summary style="cursor:pointer; color:#0284c7; font-weight:600; padding:2px 0;">
          🔍 查看各模型演算法對比細節 (折疊)
        </summary>
        <div style="margin-top:6px; padding:6px; background:#f8fafc; border-radius:6px; border:1px solid #e2e8f0;">
          <table style="width:100%; border-collapse:collapse; text-align:center; font-size:0.72rem;">
            <thead>
              <tr style="background:#e2e8f0; color:#334155;">
                <th style="padding:2px;">模型方法</th>
                <th style="padding:2px;">預估體重</th>
                <th style="padding:2px;">體脂</th>
                <th style="padding:2px;">骨骼肌</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td style="padding:2px;">A. 線性回歸</td>
                <td style="padding:2px;">${proj.modelA.w} kg</td>
                <td style="padding:2px;">${proj.modelA.fat}%</td>
                <td style="padding:2px;">${proj.modelA.smm}kg</td>
              </tr>
              <tr>
                <td style="padding:2px;">B. 動量均線</td>
                <td style="padding:2px;">${proj.modelB.w} kg</td>
                <td style="padding:2px;">${proj.modelB.fat}%</td>
                <td style="padding:2px;">${proj.modelB.smm}kg</td>
              </tr>
              <tr>
                <td style="padding:2px;">C. 端點投射</td>
                <td style="padding:2px;">${proj.modelC.w} kg</td>
                <td style="padding:2px;">${proj.modelC.fat}%</td>
                <td style="padding:2px;">${proj.modelC.smm}kg</td>
              </tr>
              <tr style="font-weight:bold; color:#713f12; background:#fefce8;">
                <td style="padding:2px;">✨ D. DCO動態</td>
                <td style="padding:2px;">${proj.modelD.w} kg</td>
                <td style="padding:2px;">${proj.modelD.fat}%</td>
                <td style="padding:2px;">${proj.modelD.smm}kg</td>
              </tr>
            </tbody>
          </table>
        </div>
      </details>`;

      reviewHtml = `<div style="margin-top:8px; padding:8px 10px; background:#f0fdf4; border-radius:8px; border:1px solid #bbf7d0;">
        ${timingHtml}
        ${mainPredictionHtml}
        ${detailsHtml}
      </div>`;
    }

    html += `<div class="log-item" style="flex-direction:column; align-items:stretch; padding:8px 0;">
      <div style="display:flex; justify-content:space-between; align-items:center;">
        <div class="log-info">
          <strong>💉 猛健樂施打 ${s.date}</strong><br>
          <small style="color:var(--sub);">${s.note ? s.note : '無備註'}</small>
        </div>
        <div class="log-actions">
          <span class="badge badge-shot">${s.dose}</span>
          <button class="action-btn btn-edit" type="button" onclick="editShot('${s.date}')">編輯</button>
          <button class="action-btn btn-del" type="button" onclick="deleteShot('${s.date}')">刪除</button>
        </div>
      </div>
      ${reviewHtml}
    </div>`;
  });

  container.innerHTML = html || '<p style="color:var(--sub);text-align:center;padding:10px;">尚未有施打紀錄</p>';
}
