// Mojo Project
const GAS_URL = "https://script.google.com/macros/s/AKfycby_BMulRlvZ2MBdqsLNbYnn1lYm2o7fegy8J8ONiiu4sxIupy2sq_YYo21-KAJlVaW3cw/exec";

function getLocalTodayStr() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function resetDatesToToday() {
  const today = getLocalTodayStr();
  const shotDateEl = document.getElementById('shotDate');
  const bodyDateEl = document.getElementById('bodyDate');
  const dietDateEl = document.getElementById('dietDate');
  if (shotDateEl) shotDateEl.value = today;
  if (bodyDateEl) bodyDateEl.value = today;
  if (dietDateEl) dietDateEl.value = today;
}

let bodyLogs = JSON.parse(localStorage.getItem('my_body_logs') || '[]');
let dietLogs = JSON.parse(localStorage.getItem('my_diet_logs') || '[]');
let shotLogs = JSON.parse(localStorage.getItem('my_shot_logs') || '[]');
let waterLogs = JSON.parse(localStorage.getItem('my_water_logs') || '{}');

function switchTab(tab) {
  const btnInbody = document.getElementById('btnTabInbody');
  const btnDiet = document.getElementById('btnTabDiet');
  const tabInbody = document.getElementById('tab-inbody');
  const tabDiet = document.getElementById('tab-diet');

  if (tab === 'inbody') {
    btnInbody.classList.add('active');
    btnDiet.classList.remove('active');
    tabInbody.classList.add('active');
    tabDiet.classList.remove('active');
    setTimeout(() => { if (typeof renderBodyChart === 'function') renderBodyChart(); }, 50);
  } else {
    btnDiet.classList.add('active');
    btnInbody.classList.remove('active');
    tabDiet.classList.add('active');
    tabInbody.classList.remove('active');
    setTimeout(() => { if (typeof renderDiet === 'function') renderDiet(); }, 50);
  }
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

function uploadToCloud(type, payload) {
  const token = getSecretToken();
  fetch(GAS_URL, {
    method: 'POST',
    mode: 'no-cors',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token: token, type: type, payload: payload })
  }).catch(err => console.log('Cloud sync pending:', err));
}

async function syncFromCloud() {
  const token = getSecretToken();
  try {
    const res = await fetch(`${GAS_URL}?token=${encodeURIComponent(token)}`);
    const data = await res.json();
    if (!data.success) throw new Error(data.error || '驗證失敗');

    let newBody = [], newDiet = [], newShot = [], newWater = {};
    data.rows.forEach(r => {
      const type = String(r[1] || '').trim().toUpperCase();
      try {
        let payload = typeof r[2] === 'string' ? JSON.parse(r[2]) : r[2];
        if (payload && payload.date) {
          payload.date = String(payload.date).replace(/\//g, '-').slice(0, 10);
        }
        if (type === 'BODY') newBody.push(payload);
        else if (type === 'DIET') newDiet.push(payload);
        else if (type === 'SHOT') newShot.push(payload);
        else if (type === 'WATER' && payload.date) {
          newWater[payload.date] = payload.data || { pure: Number(payload.amount) || 0, tea: 0 };
        }
      } catch(e){}
    });

    if (newBody.length || newDiet.length || newShot.length || Object.keys(newWater).length) {
      bodyLogs = newBody;
      dietLogs = newDiet;
      shotLogs = newShot;
      waterLogs = newWater;
      localStorage.setItem('my_body_logs', JSON.stringify(bodyLogs));
      localStorage.setItem('my_diet_logs', JSON.stringify(dietLogs));
      localStorage.setItem('my_shot_logs', JSON.stringify(shotLogs));
      localStorage.setItem('my_water_logs', JSON.stringify(waterLogs));
      if (typeof renderBodyChart === 'function') renderBodyChart();
      if (typeof renderBodyList === 'function') renderBodyList();
      if (typeof renderDiet === 'function') renderDiet();
      alert('✅ 已成功從 Google 試算表載入最新資料！');
    } else {
      alert('雲端試算表目前尚無資料。');
    }
  } catch(err) {
    alert('同步失敗：' + err.message + '\n請確認 Secret Token 是否與 Apps Script 一致。');
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
