// Mojo Project
// 3. sync.js
const GAS_URL = "https://script.google.com/macros/s/AKfycby_BMulRlvZ2MBdqsLNbYnn1lYm2o7fegy8J8ONiiu4sxIupy2sq_YYo21-KAJlVaW3cw/exec";

// 全域狀態中央管理庫
window.MojoState = {
  bodyLogs: JSON.parse(localStorage.getItem('my_body_logs') || '[]'),
  scaleLogs: JSON.parse(localStorage.getItem('my_scale_logs') || '[]'),
  dietLogs: JSON.parse(localStorage.getItem('my_diet_logs') || '[]'),
  shotLogs: JSON.parse(localStorage.getItem('my_shot_logs') || '[]'),
  waterLogs: JSON.parse(localStorage.getItem('my_water_logs') || '{}')
};

// 取得手機本地台灣時間戳記字串 (YYYY-MM-DD HH:mm:ss)
function getLocalTimestampStr() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  const hours = String(now.getHours()).padStart(2, '0');
  const minutes = String(now.getMinutes()).padStart(2, '0');
  const seconds = String(now.getSeconds()).padStart(2, '0');
  return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
}

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

// 帶入本地手機產生之精確時間戳記
function uploadToCloud(type, payload) {
  const token = getSecretToken();
  const localTime = getLocalTimestampStr();
  fetch(GAS_URL, {
    method: 'POST',
    mode: 'no-cors',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      token: token,
      timestamp: localTime,
      type: type,
      payload: payload
    })
  }).catch(err => console.log('Cloud sync pending:', err));
}

// 強效標準化去重演算法
function robustDeduplicate(list, keyFn) {
  const seen = new Set();
  const res = [];
  for (let i = list.length - 1; i >= 0; i--) {
    const k = keyFn(list[i]);
    if (!seen.has(k)) {
      seen.add(k);
      res.unshift(list[i]);
    }
  }
  return res;
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

    // 標準化去重
    window.MojoState.bodyLogs = robustDeduplicate(newBody, b => String(b.date));
    window.MojoState.scaleLogs = robustDeduplicate(newScale, s => String(s.date));
    window.MojoState.shotLogs = robustDeduplicate(newShot, s => `${s.date}_${s.dose}`);
    window.MojoState.dietLogs = robustDeduplicate(newDiet, d => `${d.date}_${d.type}_${d.content}_${d.cal}`);
    window.MojoState.waterLogs = newWater;

    window.MojoState.bodyLogs.sort((a,b) => new Date(a.date) - new Date(b.date));
    window.MojoState.scaleLogs.sort((a,b) => new Date(a.date) - new Date(b.date));

    // 儲存至本地快取
    localStorage.setItem('my_body_logs', JSON.stringify(window.MojoState.bodyLogs));
    localStorage.setItem('my_scale_logs', JSON.stringify(window.MojoState.scaleLogs));
    localStorage.setItem('my_diet_logs', JSON.stringify(window.MojoState.dietLogs));
    localStorage.setItem('my_shot_logs', JSON.stringify(window.MojoState.shotLogs));
    localStorage.setItem('my_water_logs', JSON.stringify(window.MojoState.waterLogs));
    
    if (typeof renderBodyChart === 'function') renderBodyChart();
    if (typeof renderScaleChart === 'function') renderScaleChart();
    if (typeof renderComparisonAnalysis === 'function') renderComparisonAnalysis();
    if (typeof renderBodyList === 'function') renderBodyList();
    if (typeof renderDiet === 'function') renderDiet();
    alert('✅ 雲端同步完成！已清理重複與無效紀錄。');
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
