// Mojo Project
// 3. shot.js (修復端點動能抓取舊數據問題，嚴格錨定週期最新端點與期初基準)

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

// 預測核心：主副雙軌架構與端點動能鎖定
function computeCycleProjection(startDateStr, endDateStr) {
  const scales = window.MojoState.scaleLogs || [];
  const bodies = window.MojoState.bodyLogs || [];

  // 1. 取得該週期起始當日（或最靠近前一次）的真實 InBody 作為基底
  const anchorInBody = bodies
    .filter(b => b.date <= startDateStr)
    .sort((a, b) => new Date(b.date) - new Date(a.date))[0] || null;

  // 2. 嚴格隔離截至該週期結束前的歷史對比配對
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

  // 3. 嚴格過濾本週期家用數據（只取 date >= startDateStr && date <= endDateStr，依時間升冪排序）
  const scalesInCycle = scales
    .filter(s => s.date >= startDateStr && s.date <= endDateStr)
    .sort((a, b) => new Date(`${a.date} ${a.time || '00:00'}`) - new Date(`${b.date} ${b.time || '00:00'}`));

  // 判定是否為最新進行中週期
  const lastScaleInDb = scales[scales.length - 1];
  const isCurrentCycle = (lastScaleInDb && lastScaleInDb.date >= startDateStr && lastScaleInDb.date < endDateStr);

  // 基準起點解析
  let anchorWeight = anchorInBody ? anchorInBody.weight : 81.5;
  let anchorFat = anchorInBody ? anchorInBody.pbf : 23.6;
  let anchorMuscle = anchorInBody ? anchorInBody.smm : 35.3;

  let baseScaleW = anchorWeight + globalDiffW;
  let baseScaleF = anchorFat + globalDiffFat;
  let baseScaleM = anchorMuscle + globalDiffMuscle;

  if (scalesInCycle.length > 0) {
    baseScaleW = scalesInCycle[0].weight;
    baseScaleF = scalesInCycle[0].fat || baseScaleF;
    baseScaleM = scalesInCycle[0].muscle || baseScaleM;
  }

  const wList = scalesInCycle.map(s => s.weight);
  const fList = scalesInCycle.map(s => s.fat).filter(f => f > 0);
  const mList = scalesInCycle.map(s => s.muscle).filter(m => m > 0);

  // 模型 A 斜率 (線性回歸)
  const slopeW_A = scalesInCycle.length >= 2 ? calculateLinearSlope(wList) : -0.12;
  const slopeF_A = fList.length >= 2 ? calculateLinearSlope(fList) : (slopeW_A * 0.18);
  const slopeM_A = mList.length >= 2 ? calculateLinearSlope(mList) : (slopeW_A * 0.05);

  // 模型 B 斜率 (動量均線)
  let slopeW_B = slopeW_A, slopeF_B = slopeF_A, slopeM_B = slopeM_A;
  if (scalesInCycle.length >= 3) {
    const half = Math.floor(scalesInCycle.length / 2);
    const avgW1 = scalesInCycle.slice(0, half).reduce((a, b) => a + b.weight, 0) / half;
    const avgW2 = scalesInCycle.slice(half).reduce((a, b) => a + b.weight, 0) / (scalesInCycle.length - half);
    slopeW_B = (avgW2 - avgW1) / (scalesInCycle.length - half);
  }

  // 模型 C 斜率 (端點投射)：核心修復，嚴格以本週期最新一筆相對於起點計算
  let slopeW_C = -0.14; // 預設穩健端點動能
  let slopeF_C = -0.10;
  let slopeM_C = -0.01;

  if (scalesInCycle.length >= 2) {
    const firstItem = scalesInCycle[0];
    const latestItem = scalesInCycle[scalesInCycle.length - 1]; // 確保取到最末端最新一筆
    const daysPassed = Math.max(1, (new Date(latestItem.date) - new Date(firstItem.date)) / (1000 * 60 * 60 * 24));
    slopeW_C = (latestItem.weight - firstItem.weight) / daysPassed;
    if (latestItem.fat && firstItem.fat) slopeF_C = (latestItem.fat - firstItem.fat) / daysPassed;
    if (latestItem.muscle && firstItem.muscle) slopeM_C = (latestItem.muscle - firstItem.muscle) / daysPassed;
  } else if (scalesInCycle.length === 1 && anchorInBody) {
    // 剛記錄1筆家用秤時，以該實測與期初 InBody 比對
    const firstItem = scalesInCycle[0];
    const daysPassed = Math.max(1, (new Date(firstItem.date) - new Date(anchorInBody.date)) / (1000 * 60 * 60 * 24));
    slopeW_C = ((firstItem.weight - globalDiffW) - anchorInBody.weight) / daysPassed;
    if (slopeW_C > 0) slopeW_C = -0.10; // 抑制剛進食單日水分波動
  }

  let A = {}, B = {}, C = {}, D = {};

  if (isCurrentCycle) {
    const endDateObj = new Date(endDateStr);
    
    // 取本週期最末端的一筆家用數據
    let currentLatestW = baseScaleW;
    let currentLatestF = baseScaleF;
    let currentLatestM = baseScaleM;
    let daysRemaining = 7;

    if (scalesInCycle.length > 0) {
      const latestScale = scalesInCycle[scalesInCycle.length - 1]; // 嚴格取最新
      currentLatestW = latestScale.weight;
      currentLatestF = latestScale.fat || currentLatestF;
      currentLatestM = latestScale.muscle || currentLatestM;
      daysRemaining = Math.max(0, Math.round((endDateObj - new Date(latestScale.date)) / (1000 * 60 * 60 * 24)));
    } else {
      daysRemaining = Math.max(0, Math.round((endDateObj - new Date(startDateStr)) / (1000 * 60 * 60 * 24)));
    }

    // A. 線性回歸
    A = {
      w: (currentLatestW + (slopeW_A * daysRemaining) - globalDiffW).toFixed(1),
      fat: (currentLatestF + (slopeF_A * daysRemaining) - globalDiffFat).toFixed(1),
      smm: (currentLatestM + (slopeM_A * daysRemaining) - globalDiffMuscle).toFixed(1)
    };

    // B. 動量均線
    B = {
      w: (currentLatestW + (slopeW_B * daysRemaining) - globalDiffW).toFixed(1),
      fat: A.fat,
      smm: A.smm
    };

    // C. 端點投射動能 (以最新端點向週期第 7 天推估，貼近 80.x kg)
    const endpointWeightVal = (currentLatestW + (slopeW_C * daysRemaining) - globalDiffW);
    C = {
      w: endpointWeightVal.toFixed(1),
      fat: (currentLatestF + (slopeF_C * daysRemaining) - globalDiffFat).toFixed(1),
      smm: (currentLatestM + (slopeM_C * daysRemaining) - globalDiffMuscle).toFixed(1)
    };

    // D. DCO 主力動態校準
    let predWeightVal;
    if (anchorInBody) {
      // 以期初 InBody (81.5kg) 為基底，加權動能推估
      const totalExpectedLoss = (slopeW_C * 4) + (slopeW_A * 3);
      predWeightVal = Math.min(anchorInBody.weight - 0.2, (currentLatestW + (totalExpectedLoss / 7 * daysRemaining) - dcoDiffW));
    } else {
      predWeightVal = endpointWeightVal;
    }

    // 體脂與骨骼肌以真實 InBody 生理原點動態推進
    let dcoFatVal, dcoSmmVal;
    if (anchorInBody) {
      const deltaWeight = predWeightVal - anchorInBody.weight;
      const fatLossKg = deltaWeight * 0.75;
      const initialFatKg = anchorInBody.weight * (anchorInBody.pbf / 100);
      const projFatKg = Math.max(2, initialFatKg + fatLossKg);
      dcoFatVal = ((projFatKg / predWeightVal) * 100).toFixed(1);
      const smmLossKg = deltaWeight * 0.15;
      dcoSmmVal = (anchorInBody.smm + smmLossKg).toFixed(1);
    } else {
      dcoFatVal = C.fat;
      dcoSmmVal = C.smm;
    }

    D = {
      w: predWeightVal.toFixed(1),
      fat: dcoFatVal,
      smm: dcoSmmVal
    };

  } else {
    // 歷史週期運算
    A = {
      w: (baseScaleW + (slopeW_A * 7) - globalDiffW).toFixed(1),
      fat: (baseScaleF + (slopeF_A * 7) - globalDiffFat).toFixed(1),
      smm: (baseScaleM + (slopeM_A * 7) - globalDiffMuscle).toFixed(1)
    };
    B = {
      w: (baseScaleW + (slopeW_B * 7) - globalDiffW).toFixed(1),
      fat: A.fat,
      smm: A.smm
    };
    C = {
      w: (baseScaleW + (slopeW_C * 7) - globalDiffW).toFixed(1),
      fat: (baseScaleF + (slopeF_C * 7) - globalDiffFat).toFixed(1),
      smm: (baseScaleM + (slopeM_C * 7) - globalDiffMuscle).toFixed(1)
    };

    let predWeightVal;
    if (anchorInBody) {
      predWeightVal = anchorInBody.weight + (slopeW_C * 7);
    } else {
      predWeightVal = parseFloat(C.w);
    }

    let dcoFatVal, dcoSmmVal;
    if (anchorInBody) {
      const deltaWeight = predWeightVal - anchorInBody.weight;
      const fatLossKg = deltaWeight * 0.75;
      const initialFatKg = anchorInBody.weight * (anchorInBody.pbf / 100);
      const projFatKg = Math.max(2, initialFatKg + fatLossKg);
      dcoFatVal = ((projFatKg / predWeightVal) * 100).toFixed(1);
      const smmLossKg = deltaWeight * 0.15;
      dcoSmmVal = (anchorInBody.smm + smmLossKg).toFixed(1);
    } else {
      dcoFatVal = C.fat;
      dcoSmmVal = C.smm;
    }

    D = {
      w: predWeightVal.toFixed(1),
      fat: dcoFatVal,
      smm: dcoSmmVal
    };
  }

  const weeklyDelta = (slopeW_A * 7).toFixed(2);
  let statusTip = '🌱 溫和穩健減脂中';
  if (slopeW_A < -0.15 && slopeM_A >= -0.02) {
    statusTip = '🔥 高效燃脂且肌肉維持極佳';
  } else if (slopeM_A < -0.05) {
    statusTip = '⚠️ 肌肉有些微下滑趨勢，請加強蛋白質與阻抗訓練';
  } else if (slopeW_A > 0.05) {
    statusTip = '📈 體重有些微回升，注意水分滯留或熱量平衡';
  }

  const matchedInBody = bodies.find(b => b.date === endDateStr);

  return {
    modelA: A,
    modelB: B,
    modelC: C,
    modelD: D,
    predWeight: D.w,
    predFat: D.fat,
    predSMM: D.smm,
    weeklyDelta,
    statusTip,
    actualInBody: matchedInBody || null
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
