// Mojo Project
// 3. shot.js (支援三合一預測模型與完整誤差標註)

// 最小二乘法線性回歸
function calculateLinearSlope(dataPoints) {
  const n = dataPoints.length;
  if (n < 2) return 0;
  let sumX = 0, sumY = 0, sumXY = 0, sumXX = 0;
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

// 三重統計預測核心
function computeCycleProjection(startDateStr, endDateStr) {
  const scales = window.MojoState.scaleLogs || [];
  const bodies = window.MojoState.bodyLogs || [];

  // 1. 全域偏差補償 (家用 - InBody)
  let avgDiffW = -0.34, avgDiffFat = 1.38, avgDiffMuscle = 22.5;
  let pairs = [];
  scales.forEach(s => {
    const matched = bodies.find(b => b.date === s.date);
    if (matched) pairs.push({ s, b: matched });
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

  // 2. 篩選該 7 天週期家用數據
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

  // --- 模型 1：線性回歸 (Linear Regression) ---
  const slopeW1 = scalesInCycle.length >= 2 ? calculateLinearSlope(wList) : -0.1;
  const slopeF1 = fList.length >= 2 ? calculateLinearSlope(fList) : 0;
  const slopeM1 = mList.length >= 2 ? calculateLinearSlope(mList) : 0;

  // --- 模型 2：移動平均動量 (Moving Average Momentum) ---
  let slopeW2 = slopeW1;
  if (scalesInCycle.length >= 3) {
    const half = Math.floor(scalesInCycle.length / 2);
    const avgFirst = scalesInCycle.slice(0, half).reduce((a, b) => a + b.weight, 0) / half;
    const avgSecond = scalesInCycle.slice(half).reduce((a, b) => a + b.weight, 0) / (scalesInCycle.length - half);
    slopeW2 = (avgSecond - avgFirst) / (scalesInCycle.length - half);
  }

  // --- 模型 3：端點衰減投射 (End-to-End Decay) ---
  let slopeW3 = slopeW1;
  if (scalesInCycle.length >= 2) {
    const firstW = scalesInCycle[0].weight;
    const lastW = scalesInCycle[scalesInCycle.length - 1].weight;
    const daysPassed = Math.max(1, (new Date(scalesInCycle[scalesInCycle.length - 1].date) - new Date(scalesInCycle[0].date)) / (1000 * 60 * 60 * 24));
    slopeW3 = (lastW - firstW) / daysPassed;
  }

  let m1_w, m2_w, m3_w, m_fat, m_smm;

  if (isCurrentCycle && scalesInCycle.length >= 2) {
    const latestScaleInCycle = scalesInCycle[scalesInCycle.length - 1];
    const latestDateObj = new Date(latestScaleInCycle.date);
    const endDateObj = new Date(endDateStr);
    const remainingDays = Math.max(0, Math.round((endDateObj - latestDateObj) / (1000 * 60 * 60 * 24)));

    m1_w = (latestScaleInCycle.weight + (slopeW1 * remainingDays) - avgDiffW).toFixed(1);
    m2_w = (latestScaleInCycle.weight + (slopeW2 * remainingDays) - avgDiffW).toFixed(1);
    m3_w = (latestScaleInCycle.weight + (slopeW3 * remainingDays) - avgDiffW).toFixed(1);
    
    m_fat = ((latestScaleInCycle.fat || baseScale.fat || 25) + (slopeF1 * remainingDays) - avgDiffFat).toFixed(1);
    m_smm = ((latestScaleInCycle.muscle || baseScale.muscle || 57) + (slopeM1 * remainingDays) - avgDiffMuscle).toFixed(1);
  } else {
    m1_w = (baseScale.weight + (slopeW1 * 7) - avgDiffW).toFixed(1);
    m2_w = (baseScale.weight + (slopeW2 * 7) - avgDiffW).toFixed(1);
    m3_w = (baseScale.weight + (slopeW3 * 7) - avgDiffW).toFixed(1);

    m_fat = ((baseScale.fat || 25) + (slopeF1 * 7) - avgDiffFat).toFixed(1);
    m_smm = ((baseScale.muscle || 57) + (slopeM1 * 7) - avgDiffMuscle).toFixed(1);
  }

  const weeklyDelta = (slopeW1 * 7).toFixed(2);
  let statusTip = '🌱 溫和穩健減脂中';
  if (slopeW1 < -0.15 && slopeM1 >= -0.02) {
    statusTip = '🔥 高效燃脂且肌肉維持極佳';
  } else if (slopeM1 < -0.05) {
    statusTip = '⚠️ 肌肉有些微下滑趨勢，請加強蛋白質與阻抗訓練';
  } else if (slopeW1 > 0.05) {
    statusTip = '📈 體重有些微回升，注意水分滯留或熱量平衡';
  }

  const matchedInBody = bodies.find(b => b.date === endDateStr);

  return {
    m1_w,
    m2_w,
    m3_w,
    predWeight: m1_w,
    predFat: m_fat,
    predSMM: m_smm,
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
  list.forEach((s) => {
    const shotDateObj = new Date(s.date);
    const nextDateObj = new Date(shotDateObj);
    nextDateObj.setDate(nextDateObj.getDate() + 7);
    
    const yNext = nextDateObj.getFullYear();
    const mNext = String(nextDateObj.getMonth() + 1).padStart(2, '0');
    const dNext = String(nextDateObj.getDate()).padStart(2, '0');
    const nextShotDateStr = `${yNext}-${mNext}-${dNext}`;

    let reviewHtml = '';
    const proj = computeCycleProjection(s.date, nextShotDateStr);
    if (proj) {
      let actualCompHtml = '';
      if (proj.actualInBody) {
        const diffW = (proj.actualInBody.weight - parseFloat(proj.predWeight)).toFixed(1);
        const diffF = (proj.actualInBody.pbf - parseFloat(proj.predFat)).toFixed(1);
        const diffM = (proj.actualInBody.smm - parseFloat(proj.predSMM)).toFixed(1);

        actualCompHtml = `<div style="margin-top:6px; padding-top:6px; border-top:1px dashed #cbd5e1; color:#0f766e; font-weight:600; line-height:1.6;">
          🎯 實際 InBody 驗證 (${nextShotDateStr})：<br>
          • 體重：<strong>${proj.actualInBody.weight} kg</strong> (${diffW >= 0 ? '+' + diffW : diffW} kg)<br>
          • 骨骼肌：<strong>${proj.actualInBody.smm} kg</strong> (${diffM >= 0 ? '+' + diffM : diffM} kg)<br>
          • 體脂率：<strong>${proj.actualInBody.pbf} %</strong> (${diffF >= 0 ? '+' + diffF : diffF} %)
        </div>`;
      } else {
        actualCompHtml = `<div style="margin-top:4px; color:#64748b; font-size:0.75rem;">
          ⏳ 週期進行中或等待 ${nextShotDateStr} InBody 校準驗證
        </div>`;
      }

      reviewHtml = `<div style="margin-top:6px; padding:10px 12px; background:#f0fdf4; border-radius:8px; border:1px solid #bbf7d0; font-size:0.78rem; color:#166534; line-height:1.6;">
        <strong>🔮 該劑 7 天趨勢回顧 (${s.date} ~ ${nextShotDateStr})：</strong><br>
        • 週變化速率：${parseFloat(proj.weeklyDelta) <= 0 ? proj.weeklyDelta : '+' + proj.weeklyDelta} kg/週<br>
        • <strong>三模型體重預測</strong>：<br>
        &nbsp;&nbsp;[A.線性回歸] <strong>${proj.m1_w} kg</strong> ｜ [B.動量均線] <strong>${proj.m2_w} kg</strong> ｜ [C.端點投射] <strong>${proj.m3_w} kg</strong><br>
        • 週期預測體態：骨骼肌 ~<strong>${proj.predSMM} kg</strong> ｜ 體脂 ~<strong>${proj.predFat} %</strong>
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
