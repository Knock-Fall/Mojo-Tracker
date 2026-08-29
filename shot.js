// Mojo Project
// 3. shot.js (支援歷史週期預測留存與驗證回顧)

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

// 輔助運算：計算特定週期的預測與實際驗證結果
function getCyclePredictionReview(shotDateStr, nextShotDateStr) {
  const scales = window.MojoState.scaleLogs || [];
  const bodies = window.MojoState.bodyLogs || [];

  // 抓取該週期內的家用數據
  const scalesInCycle = scales.filter(s => s.date >= shotDateStr && s.date <= nextShotDateStr);
  if (scalesInCycle.length < 2) return null;

  // 計算該週期內的體重與體脂線性斜率
  const wList = scalesInCycle.map(s => s.weight);
  const fList = scalesInCycle.map(s => s.fat).filter(f => f > 0);
  
  const slopeW = (typeof calculateLinearSlope === 'function') ? calculateLinearSlope(wList) : 0;
  const slopeF = (fList.length >= 2 && typeof calculateLinearSlope === 'function') ? calculateLinearSlope(fList) : 0;

  // 偏差值估算（預設 -0.34kg 與 +1.38%）
  const avgDiffW = -0.34;
  const avgDiffFat = 1.38;

  const firstScale = scalesInCycle[0];
  const predWeight = (firstScale.weight + (slopeW * 7) - avgDiffW).toFixed(1);
  const predFat = ((firstScale.fat || 26) + (slopeF * 7) - avgDiffFat).toFixed(1);

  // 檢查在 nextShotDateStr 當天是否有真實 InBody 紀錄進行比對
  const actualInBody = bodies.find(b => b.date === nextShotDateStr || b.date === shotDateStr);
  const matchedInBodyOnNext = bodies.find(b => b.date === nextShotDateStr);

  return {
    predWeight: predWeight,
    predFat: predFat,
    weeklyDelta: (slopeW * 7).toFixed(2),
    actualInBody: matchedInBodyOnNext || null
  };
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

    // 取得該週期的回顧與預測資訊
    const review = getCyclePredictionReview(s.date, nextShotDateStr);
    let reviewHtml = '';

    if (review) {
      let actualCompHtml = '';
      if (review.actualInBody) {
        const diffW = (review.actualInBody.weight - parseFloat(review.predWeight)).toFixed(1);
        const diffF = (review.actualInBody.pbf - parseFloat(review.predFat)).toFixed(1);
        actualCompHtml = `<div style="margin-top:4px; padding-top:4px; border-top:1px dashed #cbd5e1; color:#0f766e; font-weight:600;">
          🎯 實際 InBody 驗證 (${nextShotDateStr})：體重 ${review.actualInBody.weight}kg (誤差 ${diffW >= 0 ? '+' + diffW : diffW}kg) ｜ 體脂 ${review.actualInBody.pbf}%
        </div>`;
      } else {
        actualCompHtml = `<div style="margin-top:2px; color:#64748b; font-size:0.75rem;">
          ⏳ 週期進行中或等待 ${nextShotDateStr} InBody 校準驗證
        </div>`;
      }

      reviewHtml = `<div style="margin-top:6px; padding:8px 10px; background:#f0fdf4; border-radius:8px; border:1px solid #bbf7d0; font-size:0.78rem; color:#166534; line-height:1.5;">
        <strong>🔮 該劑 7 天趨勢回顧 (${s.date} ~ ${nextShotDateStr})：</strong><br>
        • 週變化速率：${parseFloat(review.weeklyDelta) <= 0 ? review.weeklyDelta : '+' + review.weeklyDelta} kg/週<br>
        • 週期預測 InBody：體重 ~<strong>${review.predWeight} kg</strong> ｜ 體脂 ~<strong>${review.predFat} %</strong>
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
