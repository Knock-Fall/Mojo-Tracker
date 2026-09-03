// Mojo Project
// 3. shot.js (支援四模型包含 DCO 動態校準模型矩陣)

function calculateLinearSlope(dataPoints) {
  const n = dataPoints.length;
  if (n < 2) return 0;
  let sumX = 0, sumY = 0, sumXX = 0, sumXY = 0;
  for (let i = 0; i < n; i++) {
    sumX += i;
    sumY += dataPoints[i];
    sumXY += i * dataPoints[i];
    sumXX += i * i;
  }
  const denominator = (n * sumXX - sumX * sumX);
  if (denominator === 0) return 0;
  return (n * sumXY - sumX * sumY) / denominator;
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

// 四大統計預測模型核心（含 DCO 動態校準）
function computeCycleProjection(startDateStr, endDateStr) {
  const scales = window.MojoState.scaleLogs || [];
  const bodies = window.MojoState.bodyLogs || [];

  // 1. 全域靜態偏差
  let avgDiffW = -0.34, avgDiffFat = 1.38, avgDiffMuscle = 22.5;
  let pairs = [];
  scales.forEach(s => {
    const matched = bodies.find(b => b.date === s.date);
    if (matched) pairs.push({ s, b: matched, date: s.date });
  });

  if (pairs.length > 0) {
    let diffWTotal = 0, diffFatTotal = 0, diffMTotal = 0, countFat = 0, countM = 0;
    pairs.forEach(p => {
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
    avgDiffW = diffWTotal / pairs.length;
    if (countFat > 0) avgDiffFat = diffFatTotal / countFat;
    if (countM > 0) avgDiffMuscle = diffMTotal / countM;
  }

  // 2. DCO 動態時間距離指數加權偏差計算 (Exponential Recency Weights)
  let dcoDiffW = avgDiffW, dcoDiffFat = avgDiffFat, dcoDiffMuscle = avgDiffMuscle;
  if (pairs.length > 0) {
    pairs.sort((a, b) => new Date(a.date) - new Date(b.date));
    let totalWeight = 0, weightedDiffW = 0, weightedDiffFat = 0, weightedDiffM = 0;
    pairs.forEach((p, idx) => {
      const recencyWeight = Math.pow(1.5, idx); // 越近的權重指數放大
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

  // 3. 篩選該 7 天週期家用數據
  const scalesInCycle = scales.filter(s => s.date >= startDateStr && s.date <= endDateStr);
  let baseScale = scalesInCycle.length > 0 ? scalesInCycle[0] : null;
  if (!baseScale) {
    const beforeScales = scales.filter(s => s.date <= startDateStr);
    if (beforeScales.length > 0) baseScale = beforeScales[beforeScales.length - 1];
  }
  if (!baseScale) return null;

  const lastScaleInDb = scales[scales.length - 1];
  const isCurrentCycle = (lastScaleInDb && lastScaleInDb.date >= startDateStr && lastScaleInDb.date < endDateStr);

  const wList = scalesInCycle.map(s => s.weight);
  const fList = scalesInCycle.map(s => s.fat).filter(f => f > 0);
  const mList = scalesInCycle.map(s => s.muscle).filter(m => m > 0);

  // --- 模型 A：線性回歸 (Linear Regression) ---
  const slopeW_A = scalesInCycle.length >= 2 ? calculateLinearSlope(wList) : -0.1;
  const slopeF_A = fList.length >= 2 ? calculateLinearSlope(fList) : 0;
  const slopeM_A = mList.length >= 2 ? calculateLinearSlope(mList) : 0;

  // --- 模型 B：動量均線 (Moving Average Momentum) ---
  let slopeW_B = slopeW_A, slopeF_B = slopeF_A, slopeM_B = slopeM_A;
  if (scalesInCycle.length >= 3) {
    const half = Math.floor(scalesInCycle.length / 2);
    const avgW1 = scalesInCycle.slice(0, half).reduce((a, b) => a + b.weight, 0) / half;
    const avgW2 = scalesInCycle.slice(half).reduce((a, b) => a + b.weight, 0) / (scalesInCycle.length - half);
    slopeW_B = (avgW2 - avgW1) / (scalesInCycle.length - half);

    if (fList.length >= 3) {
      const avgF1 = fList.slice(0, half).reduce((a, b) => a + b, 0) / half;
      const avgF2 = fList.slice(half).reduce((a, b) => a + b, 0) / (fList.length - half);
      slopeF_B = (avgF2 - avgF1) / (fList.length - half);
    }
    if (mList.length >= 3) {
      const avgM1 = mList.slice(0, half).reduce((a, b) => a + b, 0) / half;
      const avgM2 = mList.slice(half).reduce((a, b) => a + b, 0) / (mList.length - half);
      slopeM_B = (avgM2 - avgM1) / (mList.length - half);
    }
  }

  // --- 模型 C：端點投射 (End-to-End Decay) ---
  let slopeW_C = slopeW_A, slopeF_C = slopeF_A, slopeM_C = slopeM_A;
  if (scalesInCycle.length >= 2) {
    const firstItem = scalesInCycle[0];
    const lastItem = scalesInCycle[scalesInCycle.length - 1];
    const daysPassed = Math.max(1, (new Date(lastItem.date) - new Date(firstItem.date)) / (1000 * 60 * 60 * 24));
    slopeW_C = (lastItem.weight - firstItem.weight) / daysPassed;
    if (lastItem.fat && firstItem.fat) slopeF_C = (lastItem.fat - firstItem.fat) / daysPassed;
    if (lastItem.muscle && firstItem.muscle) slopeM_C = (lastItem.muscle - firstItem.muscle) / daysPassed;
  }

  // --- 模型 D：DCO 動態校準模型 (Dynamic Calibration Offset) ---
  // 核心特性：以線性回歸與動量均線的加權混合為基底，結合動態衰減時間距離偏差值校準
  const slopeW_D = (slopeW_A * 0.6) + (slopeW_B * 0.4);
  const slopeF_D = (slopeF_A * 0.6) + (slopeF_B * 0.4);
  const slopeM_D = (slopeM_A * 0.6) + (slopeM_B * 0.4);

  let A = {}, B = {}, C = {}, D = {};

  if (isCurrentCycle && scalesInCycle.length >= 2) {
    const latestScaleInCycle = scalesInCycle[scalesInCycle.length - 1];
    const latestDateObj = new Date(latestScaleInCycle.date);
    const endDateObj = new Date(endDateStr);
    const remDays = Math.max(0, Math.round((endDateObj - latestDateObj) / (1000 * 60 * 60 * 24)));

    const baseW = latestScaleInCycle.weight;
    const baseF = latestScaleInCycle.fat || baseScale.fat || 25;
    const baseM = latestScaleInCycle.muscle || baseScale.muscle || 57;

    A = {
      w: (baseW + (slopeW_A * remDays) - avgDiffW).toFixed(1),
      fat: (baseF + (slopeF_A * remDays) - avgDiffFat).toFixed(1),
      smm: (baseM + (slopeM_A * remDays) - avgDiffMuscle).toFixed(1)
    };
    B = {
      w: (baseW + (slopeW_B * remDays) - avgDiffW).toFixed(1),
      fat: (baseF + (slopeF_B * remDays) - avgDiffFat).toFixed(1),
      smm: (baseM + (slopeM_B * remDays) - avgDiffMuscle).toFixed(1)
    };
    C = {
      w: (baseW + (slopeW_C * remDays) - avgDiffW).toFixed(1),
      fat: (baseF + (slopeF_C * remDays) - avgDiffFat).toFixed(1),
      smm: (baseM + (slopeM_C * remDays) - avgDiffMuscle).toFixed(1)
    };
    D = {
      w: (baseW + (slopeW_D * remDays) - dcoDiffW).toFixed(1),
      fat: (baseF + (slopeF_D * remDays) - dcoDiffFat).toFixed(1),
      smm: (baseM + (slopeM_D * remDays) - dcoDiffMuscle).toFixed(1)
    };
  } else {
    const baseW = baseScale.weight;
    const baseF = baseScale.fat || 25;
    const baseM = baseScale.muscle || 57;

    A = {
      w: (baseW + (slopeW_A * 7) - avgDiffW).toFixed(1),
      fat: (baseF + (slopeF_A * 7) - avgDiffFat).toFixed(1),
      smm: (baseM + (slopeM_A * 7) - avgDiffMuscle).toFixed(1)
    };
    B = {
      w: (baseW + (slopeW_B * 7) - avgDiffW).toFixed(1),
      fat: (baseF + (slopeF_B * 7) - avgDiffFat).toFixed(1),
      smm: (baseM + (slopeM_B * 7) - avgDiffMuscle).toFixed(1)
    };
    C = {
      w: (baseW + (slopeW_C * 7) - avgDiffW).toFixed(1),
      fat: (baseF + (slopeF_C * 7) - avgDiffFat).toFixed(1),
      smm: (baseM + (slopeM_C * 7) - avgDiffMuscle).toFixed(1)
    };
    D = {
      w: (baseW + (slopeW_D * 7) - dcoDiffW).toFixed(1),
      fat: (baseF + (slopeF_D * 7) - dcoDiffFat).toFixed(1),
      smm: (baseM + (slopeM_D * 7) - dcoDiffMuscle).toFixed(1)
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
    let reviewHtml = '';
    const proj = computeCycleProjection(s.date, nextShotDateStr);

    if (proj) {
      let actualCompHtml = '';
      if (proj.actualInBody) {
        // 以 DCO 動態校準模型作為主要基準進行誤差比較
        const diffW = (proj.actualInBody.weight - parseFloat(proj.modelD.w)).toFixed(1);
        const diffF = (proj.actualInBody.pbf - parseFloat(proj.modelD.fat)).toFixed(1);
        const diffM = (proj.actualInBody.smm - parseFloat(proj.modelD.smm)).toFixed(1);

        actualCompHtml = `<div style="margin-top:8px; padding-top:6px; border-top:1px dashed #cbd5e1; color:#0f766e; font-weight:600; line-height:1.6;">
          🎯 <strong>實際 InBody 驗證 (${nextShotDateStr})</strong>：<br>
          • 體重：<strong>${proj.actualInBody.weight} kg</strong> (比DCO ${diffW >= 0 ? '+' + diffW : diffW}kg)<br>
          • 體脂率：<strong>${proj.actualInBody.pbf} %</strong> (比DCO ${diffF >= 0 ? '+' + diffF : diffF}%)<br>
          • 骨骼肌：<strong>${proj.actualInBody.smm} kg</strong> (比DCO ${diffM >= 0 ? '+' + diffM : diffM}kg)
        </div>`;
      } else {
        actualCompHtml = `<div style="margin-top:6px; color:#64748b; font-size:0.75rem;">
          ⏳ 週期進行中或等待 ${nextShotDateStr} InBody 校準驗證
        </div>`;
      }

      let timingHtml = '';
      if (timingStats.avgMorning || timingStats.avgEvening) {
        const mText = timingStats.avgMorning ? `<strong>${timingStats.avgMorning} kg</strong> (${timingStats.mCount}次)` : '--';
        const eText = timingStats.avgEvening ? `<strong>${timingStats.avgEvening} kg</strong> (${timingStats.eCount}次)` : '--';
        const dropText = timingStats.overnightDrop ? ` ｜ 隔夜差: <strong>-${timingStats.overnightDrop} kg</strong>` : '';
        const wowText = timingStats.wowMorningChange ? ` ｜ 比上劑晨起: <strong>${parseFloat(timingStats.wowMorningChange) <= 0 ? timingStats.wowMorningChange : '+' + timingStats.wowMorningChange} kg</strong>` : '';

        timingHtml = `<div style="margin-bottom:8px; padding:6px 8px; background:#eff6ff; border-radius:6px; border:1px solid #bfdbfe; font-size:0.76rem; color:#1e40af; line-height:1.5;">
          📊 <strong>該劑家用時段平均</strong>：<br>
          🌅 晨起平均: ${mText} ｜ 🌙 睡前平均: ${eText}${dropText}${wowText}
        </div>`;
      }

      reviewHtml = `<div style="margin-top:8px; padding:10px 12px; background:#f0fdf4; border-radius:10px; border:1px solid #bbf7d0; font-size:0.78rem; color:#166534; line-height:1.5;">
        <div style="font-weight:bold; margin-bottom:6px;">🔮 該劑 7 天趨勢回顧 (${s.date} ~ ${nextShotDateStr})：</div>
        
        ${timingHtml}

        <table style="width:100%; border-collapse:collapse; text-align:center; font-size:0.78rem; background:#ffffff; border-radius:6px; overflow:hidden; border:1px solid #dcfce7; margin-bottom:6px;">
          <thead>
            <tr style="background:#dcfce7; color:#166534;">
              <th style="padding:4px 6px; border:1px solid #bbf7d0;">預測模型</th>
              <th style="padding:4px 6px; border:1px solid #bbf7d0;">體重 (kg)</th>
              <th style="padding:4px 6px; border:1px solid #bbf7d0;">體脂 (%)</th>
              <th style="padding:4px 6px; border:1px solid #bbf7d0;">骨骼肌 (kg)</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td style="padding:4px 6px; border:1px solid #bbf7d0; font-weight:bold; color:#1e3a8a;">A. 線性回歸</td>
              <td style="padding:4px 6px; border:1px solid #bbf7d0;">${proj.modelA.w}</td>
              <td style="padding:4px 6px; border:1px solid #bbf7d0;">${proj.modelA.fat}</td>
              <td style="padding:4px 6px; border:1px solid #bbf7d0;">${proj.modelA.smm}</td>
            </tr>
            <tr>
              <td style="padding:4px 6px; border:1px solid #bbf7d0; font-weight:bold; color:#0d9488;">B. 動量均線</td>
              <td style="padding:4px 6px; border:1px solid #bbf7d0;">${proj.modelB.w}</td>
              <td style="padding:4px 6px; border:1px solid #bbf7d0;">${proj.modelB.fat}</td>
              <td style="padding:4px 6px; border:1px solid #bbf7d0;">${proj.modelB.smm}</td>
            </tr>
            <tr>
              <td style="padding:4px 6px; border:1px solid #bbf7d0; font-weight:bold; color:#b45309;">C. 端點投射</td>
              <td style="padding:4px 6px; border:1px solid #bbf7d0;">${proj.modelC.w}</td>
              <td style="padding:4px 6px; border:1px solid #bbf7d0;">${proj.modelC.fat}</td>
              <td style="padding:4px 6px; border:1px solid #bbf7d0;">${proj.modelC.smm}</td>
            </tr>
            <tr style="background:#fefce8;">
              <td style="padding:4px 6px; border:1px solid #bbf7d0; font-weight:bold; color:#713f12;">✨ D. DCO動態校準</td>
              <td style="padding:4px 6px; border:1px solid #bbf7d0; font-weight:bold; color:#713f12;">${proj.modelD.w}</td>
              <td style="padding:4px 6px; border:1px solid #bbf7d0; font-weight:bold; color:#713f12;">${proj.modelD.fat}</td>
              <td style="padding:4px 6px; border:1px solid #bbf7d0; font-weight:bold; color:#713f12;">${proj.modelD.smm}</td>
            </tr>
          </tbody>
        </table>

        ${actualCompHtml}
      </div>`;
    }

    html += `<div class="log-item" style="flex-direction:column; align-items:stretch; padding:10px 0;">
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
