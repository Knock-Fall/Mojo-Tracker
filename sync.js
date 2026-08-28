// Mojo Project
// 3. sync.js
const GAS_URL = "https://script.google.com/macros/s/AKfycby_BMulRlvZ2MBdqsLNbYnn1lYm2o7fegy8J8ONiiu4sxIupy2sq_YYo21-KAJlVaW3cw/exec";

// 全域掛載
window.bodyLogs = JSON.parse(localStorage.getItem('my_body_logs') || '[]');
window.scaleLogs = JSON.parse(localStorage.getItem('my_scale_logs') || '[]');
window.dietLogs = JSON.parse(localStorage.getItem('my_diet_logs') || '[]');
window.shotLogs = JSON.parse(localStorage.getItem('my_shot_logs') || '[]');
window.waterLogs = JSON.parse(localStorage.getItem('my_water_logs') || '{}');

function getSecretToken() {
  return localStorage.getItem('gas_secret_token') || 'my_custom_secret_key_888';
}

function setupSecretToken() {
  const current = getSecretToken();
  const token = prompt('請輸入您的試算表密鑰 (Secret Token)：', current);
  if (token !== null) {
    localStorage.setItem('gas_secret_token', token.trim());
    alert('密鑰已儲存！');
  }
}

function uploadToCloud(type, payload) {
  const token = getSecretToken();
  fetch(GAS_URL, {
    method: 'POST',
    mode: 'no-cors',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token: token, type: type, payload: payload })
  }).catch(err => console.log('Cloud sync pending:', err));
}

// 唯一鍵去重函式
function deduplicateLogs(list, keyFn) {
  const seen = new Set();
  const result = [];
  for (let i = list.length - 1; i >= 0; i--) {
    const key = keyFn(list[i]);
    if (!seen.has(key)) {
      seen.add(key);
      result.unshift(list[i]);
    }
  }
  return result;
}

async function syncFromCloud() {
  const token = getSecretToken();
  try {
    const res = await fetch(`${GAS_URL}?token=${encodeURIComponent(token)}`);
    const data = await res.json();
    if (!data.success) throw new Error(data.error || '驗證失敗');

    let newBody = [], newScale = [], newDiet = [], newShot = [], newWater = {};
    data.rows.forEach(r => {
      const type = String(r[1] || '').trim().toUpperCase();
      try {
        let payload = typeof r[2] === 'string' ? JSON.parse(r[2]) : r[2];
        if (payload && payload.date) {
          payload.date = String(payload.date).replace(/\//g, '-').slice(0, 10);
        }
        if (type === 'BODY') newBody.push(payload);
        else if (type === 'SCALE') newScale.push(payload);
        else if (type === 'DIET') newDiet.push(payload);
        else if (type === 'SHOT') newShot.push(payload);
        else if (type === 'WATER' && payload.date) {
          newWater[payload.date] = payload.data || { pure: Number(payload.amount) || 0, tea: 0 };
        }
      } catch(e){}
    });

    // 執行嚴格去重：避免試算表中歷史重複資料污染
    window.bodyLogs = deduplicateLogs(newBody, item => item.date);
    window.scaleLogs = deduplicateLogs(newScale, item => item.date);
    window.shotLogs = deduplicateLogs(newShot, item => `${item.date}_${item.dose}_${item.note}`);
    window.dietLogs = deduplicateLogs(newDiet, item => `${item.date}_${item.type}_${item.content}_${item.cal}`);
    window.waterLogs = newWater;

    // 排序
    window.bodyLogs.sort((a,b) => new Date(a.date) - new Date(b.date));
    window.scaleLogs.sort((a,b) => new Date(a.date) - new Date(b.date));

    // 儲存至本地
    localStorage.setItem('my_body_logs', JSON.stringify(window.bodyLogs));
    localStorage.setItem('my_scale_logs', JSON.stringify(window.scaleLogs));
    localStorage.setItem('my_diet_logs', JSON.stringify(window.dietLogs));
    localStorage.setItem('my_shot_logs', JSON.stringify(window.shotLogs));
    localStorage.setItem('my_water_logs', JSON.stringify(window.waterLogs));
    
    // 觸發全模組渲染
    if (typeof renderBodyChart === 'function') renderBodyChart();
    if (typeof renderScaleChart === 'function') renderScaleChart();
    if (typeof renderComparisonAnalysis === 'function') renderComparisonAnalysis();
    if (typeof renderBodyList === 'function') renderBodyList();
    if (typeof renderDiet === 'function') renderDiet();
    alert('✅ 同步完成，已自動過濾重複數據！');
  } catch(err) {
    alert('同步失敗：' + err.message + '\n請確認 Secret Token 是否正確。');
  }
}

function setupApiKey() {
  const currentKey = localStorage.getItem('gemini_api_key') || '';
  const key = prompt('請輸入您的 Google Gemini API Key（金鑰僅存在您的手機本地）：', currentKey);
  if (key !== null) {
    localStorage.setItem('gemini_api_key', key.trim());
    alert(key ? 'API Key 設定成功！' : '已清除 API Key');
  }
}
