// Mojo Project
// 1. main.js (初始化、全域狀態、API Key、雲端同步與猛健樂模式動態切換)

window.MojoState = {
  bodyLogs: [],
  scaleLogs: [],
  fitdaysLogs: [],
  shotLogs: [],
  dietLogs: [],
  waterLogs: {},
  workoutLogs: []
};

// 猛健樂模式判斷 (預設啟用，若無設定過則預設為 true)
function isMounjaroEnabled() {
  const saved = localStorage.getItem('user_uses_mounjaro');
  return saved === null ? true : saved === 'true';
}

function toggleMounjaroMode(enabled) {
  localStorage.setItem('user_uses_mounjaro', enabled ? 'true' : 'false');
  applyMounjaroUIMode(enabled);
  if (typeof renderDiet === 'function') renderDiet();
  if (typeof renderShotList === 'function') renderShotList();
  if (typeof renderComparisonAnalysis === 'function') renderComparisonAnalysis();
}

function applyMounjaroUIMode(enabled) {
  const chk = document.getElementById('chkUseMounjaro');
  if (chk) chk.checked = enabled;

  const titleEl = document.getElementById('mainAppTitle');
  const tabInbodyBtn = document.getElementById('btnTabInbody');
  const shotInputCard = document.getElementById('mounjaroShotInputCard');
  const shotHistoryCard = document.getElementById('mounjaroShotHistoryCard');

  if (enabled) {
    if (titleEl) titleEl.innerText = '個人健體與猛健樂管理';
    if (tabInbodyBtn) tabInbodyBtn.innerText = '📊 體態與猛健樂';
    if (shotInputCard) shotInputCard.style.display = 'block';
    if (shotHistoryCard) shotHistoryCard.style.display = 'block';
  } else {
    if (titleEl) titleEl.innerText = '個人健體與健康管理';
    if (tabInbodyBtn) tabInbodyBtn.innerText = '📊 體態與健康管理';
    if (shotInputCard) shotInputCard.style.display = 'none';
    if (shotHistoryCard) shotHistoryCard.style.display = 'none';
  }
}

const GAS_SYNC_URL = "https://script.google.com/macros/s/AKfycbz_G1kXy1h4Yc1_f_example/exec";

function getSecretToken() {
  return localStorage.getItem('my_sync_secret') || 'default_secret';
}

function setupSecretToken() {
  const cur = getSecretToken();
  const val = prompt('請設定 Google Apps Script 通行金鑰 (Secret Token)：', cur);
  if (val !== null) {
    localStorage.setItem('my_sync_secret', val.trim());
    alert('金鑰已儲存！');
  }
}

function getActiveApiKey() {
  try {
    const list = JSON.parse(localStorage.getItem('my_gemini_api_keys') || '[]');
    const active = list.find(k => k.active);
    if (active && active.key) return active.key;
  } catch(e) {}
  return localStorage.getItem('gemini_api_key') || '';
}

function openKeyModal() {
  const modal = document.getElementById('apiKeyModal');
  if (modal) {
    modal.style.display = 'flex';
    renderKeyList();
  }
}

function closeKeyModal() {
  const modal = document.getElementById('apiKeyModal');
  if (modal) modal.style.display = 'none';
}

function renderKeyList() {
  const container = document.getElementById('apiKeyListContainer');
  if (!container) return;
  let list = [];
  try {
    list = JSON.parse(localStorage.getItem('my_gemini_api_keys') || '[]');
  } catch(e) {}

  if (list.length === 0) {
    const single = localStorage.getItem('gemini_api_key');
    if (single) {
      list.push({ name: '主要金鑰', key: single, active: true });
      localStorage.setItem('my_gemini_api_keys', JSON.stringify(list));
    }
  }

  let html = '';
  list.forEach((item, idx) => {
    const masked = item.key.length > 8 ? `${item.key.slice(0, 4)}...${item.key.slice(-4)}` : '****';
    const activeBadge = item.active ? '<span style="color:#059669; font-weight:bold; font-size:0.75rem;">[使用中]</span>' : '';
    html += `<div style="display:flex; justify-content:space-between; align-items:center; padding:6px 0; border-bottom:1px dashed #cbd5e1; font-size:0.8rem;">
      <div>
        <strong>${item.name || '金鑰 ' + (idx + 1)}</strong> ${activeBadge}<br>
        <span style="color:var(--sub); font-family:monospace;">${masked}</span>
      </div>
      <div style="display:flex; gap:4px;">
        ${!item.active ? `<button class="action-btn btn-edit" type="button" onclick="setActiveKey(${idx})">啟用</button>` : ''}
        <button class="action-btn btn-del" type="button" onclick="deleteApiKey(${idx})">刪除</button>
      </div>
    </div>`;
  });

  container.innerHTML = html || '<p style="color:var(--sub); font-size:0.8rem; text-align:center;">尚未新增 API Key</p>';
}

function addNewApiKey() {
  const nameVal = document.getElementById('newKeyName').value.trim();
  const keyVal = document.getElementById('newKeyValue').value.trim();
  if (!keyVal) return alert('請貼上 API Key');

  let list = [];
  try { list = JSON.parse(localStorage.getItem('my_gemini_api_keys') || '[]'); } catch(e) {}
  
  const isFirst = list.length === 0;
  list.push({ name: nameVal || `金鑰 ${list.length + 1}`, key: keyVal, active: isFirst });
  localStorage.setItem('my_gemini_api_keys', JSON.stringify(list));
  if (isFirst) localStorage.setItem('gemini_api_key', keyVal);

  document.getElementById('newKeyName').value = '';
  document.getElementById('newKeyValue').value = '';
  renderKeyList();
  alert('API Key 新增成功！');
}

function setActiveKey(idx) {
  let list = [];
  try { list = JSON.parse(localStorage.getItem('my_gemini_api_keys') || '[]'); } catch(e) {}
  list.forEach((k, i) => k.active = (i === idx));
  localStorage.setItem('my_gemini_api_keys', JSON.stringify(list));
  localStorage.setItem('gemini_api_key', list[idx].key);
  renderKeyList();
}

function deleteApiKey(idx) {
  if (confirm('確定刪除此 API Key？')) {
    let list = [];
    try { list = JSON.parse(localStorage.getItem('my_gemini_api_keys') || '[]'); } catch(e) {}
    list.splice(idx, 1);
    if (list.length > 0 && !list.some(k => k.active)) list[0].active = true;
    localStorage.setItem('my_gemini_api_keys', JSON.stringify(list));
    renderKeyList();
  }
}

async function uploadToCloud(type, data) {
  if (!GAS_SYNC_URL || GAS_SYNC_URL.includes('example')) return;
  const secret = getSecretToken();
  try {
    await fetch(GAS_SYNC_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({ secret, type, data })
    });
  } catch(e) {
    console.error('雲端同步失敗:', e);
  }
}

async function syncFromCloud() {
  if (!GAS_SYNC_URL || GAS_SYNC_URL.includes('example')) {
    return alert('請先在 main.js 中設定您的 Google Apps Script 部署網址！');
  }
  const secret = getSecretToken();
  try {
    const res = await fetch(`${GAS_SYNC_URL}?secret=${encodeURIComponent(secret)}`);
    const json = await res.json();
    if (json.status === 'success' && json.data) {
      if (json.data.BODY) {
        window.MojoState.bodyLogs = json.data.BODY;
        localStorage.setItem('my_body_logs', JSON.stringify(json.data.BODY));
      }
      if (json.data.SCALE) {
        window.MojoState.scaleLogs = json.data.SCALE;
        localStorage.setItem('my_scale_logs', JSON.stringify(json.data.SCALE));
      }
      if (json.data.FITDAYS) {
        window.MojoState.fitdaysLogs = json.data.FITDAYS;
        localStorage.setItem('my_fitdays_logs', JSON.stringify(json.data.FITDAYS));
      }
      if (json.data.SHOT) {
        window.MojoState.shotLogs = json.data.SHOT;
        localStorage.setItem('my_shot_logs', JSON.stringify(json.data.SHOT));
      }
      if (json.data.DIET) {
        window.MojoState.dietLogs = json.data.DIET;
        localStorage.setItem('my_diet_logs', JSON.stringify(json.data.DIET));
      }
      if (json.data.WATER) {
        let wObj = {};
        json.data.WATER.forEach(w => { if (w.date && w.data) wObj[w.date] = w.data; });
        window.MojoState.waterLogs = wObj;
        localStorage.setItem('my_water_logs', JSON.stringify(wObj));
      }
      if (json.data.WORKOUT) {
        window.MojoState.workoutLogs = json.data.WORKOUT;
        localStorage.setItem('my_workout_logs', JSON.stringify(json.data.WORKOUT));
      }

      alert('雲端資料同步完成！');
      location.reload();
    } else {
      alert('同步失敗：' + (json.message || '金鑰不符合'));
    }
  } catch(e) {
    alert('無法連線到雲端後台：' + e.message);
  }
}

function getLocalTodayStr() {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function initDefaultDates() {
  const todayStr = getLocalTodayStr();
  const dateIds = ['bodyDate', 'scaleDate', 'fdDate', 'shotDate', 'dietDate'];
  dateIds.forEach(id => {
    const el = document.getElementById(id);
    if (el && !el.value) el.value = todayStr;
  });

  const now = new Date();
  const hh = String(now.getHours()).padStart(2, '0');
  const mm = String(now.getMinutes()).padStart(2, '0');
  const scaleTimeEl = document.getElementById('scaleTime');
  if (scaleTimeEl && !scaleTimeEl.value) scaleTimeEl.value = `${hh}:${mm}`;
  const fdTimeEl = document.getElementById('fdTime');
  if (fdTimeEl && !fdTimeEl.value) fdTimeEl.value = `${hh}:${mm}`;
}

function loadLocalState() {
  try {
    const b = localStorage.getItem('my_body_logs');
    if (b) window.MojoState.bodyLogs = JSON.parse(b);

    const s = localStorage.getItem('my_scale_logs');
    if (s) window.MojoState.scaleLogs = JSON.parse(s);

    const fd = localStorage.getItem('my_fitdays_logs');
    if (fd) window.MojoState.fitdaysLogs = JSON.parse(fd);

    const sh = localStorage.getItem('my_shot_logs');
    if (sh) window.MojoState.shotLogs = JSON.parse(sh);

    const d = localStorage.getItem('my_diet_logs');
    if (d) window.MojoState.dietLogs = JSON.parse(d);

    const w = localStorage.getItem('my_water_logs');
    if (w) window.MojoState.waterLogs = JSON.parse(w);

    const wo = localStorage.getItem('my_workout_logs');
    if (wo) window.MojoState.workoutLogs = JSON.parse(wo);
  } catch(e) {
    console.error('載入本機狀態失敗:', e);
  }
}

document.addEventListener('DOMContentLoaded', () => {
  if (typeof initFitdaysUI === 'function') initFitdaysUI();

  initDefaultDates();
  loadLocalState();

  // 套用使用者偏好的猛健樂模式
  applyMounjaroUIMode(isMounjaroEnabled());

  const tabInbody = document.getElementById('btnTabInbody');
  const tabDiet = document.getElementById('btnTabDiet');
  const contentInbody = document.getElementById('tab-inbody');
  const contentDiet = document.getElementById('tab-diet');

  if (tabInbody && tabDiet) {
    tabInbody.addEventListener('click', () => {
      tabInbody.classList.add('active');
      tabDiet.classList.remove('active');
      contentInbody.classList.add('active');
      contentDiet.classList.remove('active');
      if (typeof renderScaleChart === 'function') renderScaleChart();
      if (typeof renderChart === 'function') renderChart();
    });

    tabDiet.addEventListener('click', () => {
      tabDiet.classList.add('active');
      tabInbody.classList.remove('active');
      contentDiet.classList.add('active');
      contentInbody.classList.remove('active');
      if (typeof renderDiet === 'function') renderDiet();
    });
  }

  if (typeof renderShotList === 'function') renderShotList();
  if (typeof renderScaleList === 'function') renderScaleList();
  if (typeof renderScaleChart === 'function') renderScaleChart();
  if (typeof renderFitdaysList === 'function') renderFitdaysList();
  if (typeof renderFitdaysComparisonAnalysis === 'function') renderFitdaysComparisonAnalysis();
  if (typeof renderComparisonAnalysis === 'function') renderComparisonAnalysis();
  if (typeof renderBodyList === 'function') renderBodyList();
  if (typeof renderChart === 'function') renderChart();
  if (typeof renderDiet === 'function') renderDiet();
});
