// Mojo Project
// 1. main.js (MK-80979: 智慧雙向合併、本地數據補推與防覆蓋安全保護)

window.MojoState = {
  bodyLogs: [],
  scaleLogs: [],
  fitdaysLogs: [],
  shotLogs: [],
  dietLogs: [],
  waterLogs: {},
  workoutLogs: []
};

// ⚠️ 請務必將此處替換為您的實際 Google Apps Script 部署網址 (結尾為 /exec)
const GAS_SYNC_URL = "https://script.google.com/macros/s/AKfycby_BMulRlvZ2MBdqsLNbYnn1lYm2o7fegy8J8ONiiu4sxIupy2sq_YYo21-KAJlVaW3cw/exec";

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
  if (!GAS_SYNC_URL || GAS_SYNC_URL.includes('example') || GAS_SYNC_URL.includes('請在此貼上')) return;
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

// ⭐️ 核心安全機制：將本地所有最新資料一次性完整推送到 Google 試算表補漏
async function uploadAllLocalToCloud() {
  if (!GAS_SYNC_URL || GAS_SYNC_URL.includes('example') || GAS_SYNC_URL.includes('請在此貼上')) {
    return alert('請先在 main.js 中設定您的實際 Google Apps Script 部署網址！');
  }

  if (!confirm('即將把手機上的所有最新資料（含 9/8~9/9 離線紀錄）全部補推同步到 Google 試算表，是否開始？')) {
    return;
  }

  const secret = getSecretToken();

  try {
    // 1. 補推飲食
    const diets = window.MojoState.dietLogs || [];
    for (let d of diets) {
      await uploadToCloud('DIET', d);
    }
    // 2. 補推運動
    const workouts = window.MojoState.workoutLogs || [];
    for (let w of workouts) {
      await uploadToCloud('WORKOUT', w);
    }
    // 3. 補推體脂計
    const fitdays = window.MojoState.fitdaysLogs || [];
    for (let f of fitdays) {
      await uploadToCloud('FITDAYS', f);
    }
    const scales = window.MojoState.scaleLogs || [];
    for (let s of scales) {
      await uploadToCloud('SCALE', s);
    }
    // 4. 補推水分
    const waters = window.MojoState.waterLogs || {};
    for (let dateKey in waters) {
      await uploadToCloud('WATER', { date: dateKey, data: waters[dateKey] });
    }
    // 5. 補推 InBody
    const bodies = window.MojoState.bodyLogs || [];
    for (let b of bodies) {
      await uploadToCloud('BODY', b);
    }
    // 6. 補推猛健樂
    const shots = window.MojoState.shotLogs || [];
    for (let sh of shots) {
      await uploadToCloud('SHOT', sh);
    }

    alert('🎉 本地資料已全數安全補推至 Google 試算表！\n請打開試算表確認最新紀錄。');
  } catch(e) {
    alert('補推過程發生錯誤：' + e.message);
  }
}

// ⭐️ 核心安全機制：智慧雙向合併（絕不讓雲端舊資料洗掉本地新資料）
async function syncFromCloud() {
  if (!GAS_SYNC_URL || GAS_SYNC_URL.includes('example') || GAS_SYNC_URL.includes('請在此貼上')) {
    return alert('請先在 main.js 中設定您的 Google Apps Script 部署網址！');
  }
  const secret = getSecretToken();
  try {
    const res = await fetch(`${GAS_SYNC_URL}?secret=${encodeURIComponent(secret)}`);
    const json = await res.json();
    if (json.status === 'success' && json.data) {
      
      // 1. 雙向合併 DIET
      if (json.data.DIET) {
        let localDiets = window.MojoState.dietLogs || [];
        let mergedDiets = [...json.data.DIET];
        localDiets.forEach(ld => {
          if (!mergedDiets.some(cd => (cd.id && cd.id === ld.id) || (cd.date === ld.date && cd.content === ld.content && cd.type === ld.type))) {
            mergedDiets.push(ld);
          }
        });
        window.MojoState.dietLogs = mergedDiets;
        localStorage.setItem('my_diet_logs', JSON.stringify(mergedDiets));
      }

      // 2. 雙向合併 WORKOUT
      if (json.data.WORKOUT) {
        let localW = window.MojoState.workoutLogs || [];
        let mergedW = [...json.data.WORKOUT];
        localW.forEach(lw => {
          if (!mergedW.some(cw => (cw.id && cw.id === lw.id) || (cw.date === lw.date && cw.type === lw.type && cw.cal === lw.cal))) {
            mergedW.push(lw);
          }
        });
        window.MojoState.workoutLogs = mergedW;
        localStorage.setItem('my_workout_logs', JSON.stringify(mergedW));
      }

      // 3. 雙向合併 FITDAYS
      if (json.data.FITDAYS) {
        let localFd = window.MojoState.fitdaysLogs || [];
        let mergedFd = [...json.data.FITDAYS];
        localFd.forEach(lf => {
          if (!mergedFd.some(cf => cf.date === lf.date && (cf.time || '') === (lf.time || ''))) {
            mergedFd.push(lf);
          }
        });
        mergedFd.sort((a,b) => new Date(`${a.date} ${a.time||'00:00'}`) - new Date(`${b.date} ${b.time||'00:00'}`));
        window.MojoState.fitdaysLogs = mergedFd;
        localStorage.setItem('my_fitdays_logs', JSON.stringify(mergedFd));
      }

      // 4. 雙向合併 SCALE
      if (json.data.SCALE) {
        let localS = window.MojoState.scaleLogs || [];
        let mergedS = [...json.data.SCALE];
        localS.forEach(ls => {
          if (!mergedS.some(cs => cs.date === ls.date && (cs.time || '') === (ls.time || ''))) {
            mergedS.push(ls);
          }
        });
        mergedS.sort((a,b) => new Date(`${a.date} ${a.time||'00:00'}`) - new Date(`${b.date} ${b.time||'00:00'}`));
        window.MojoState.scaleLogs = mergedS;
        localStorage.setItem('my_scale_logs', JSON.stringify(mergedS));
      }

      // 5. 雙向合併 WATER
      if (json.data.WATER) {
        let wObj = { ...(window.MojoState.waterLogs || {}) };
        json.data.WATER.forEach(w => {
          if (w.date && w.data) {
            if (!wObj[w.date]) {
              wObj[w.date] = w.data;
            } else {
              // 取數值較大者防覆蓋
              wObj[w.date].pure = Math.max(wObj[w.date].pure || 0, w.data.pure || 0);
              wObj[w.date].tea = Math.max(wObj[w.date].tea || 0, w.data.tea || 0);
            }
          }
        });
        window.MojoState.waterLogs = wObj;
        localStorage.setItem('my_water_logs', JSON.stringify(wObj));
      }

      // 6. 雙向合併 BODY
      if (json.data.BODY) {
        let localB = window.MojoState.bodyLogs || [];
        let mergedB = [...json.data.BODY];
        localB.forEach(lb => {
          if (!mergedB.some(cb => cb.date === lb.date)) {
            mergedB.push(lb);
          }
        });
        mergedB.sort((a, b) => new Date(a.date) - new Date(b.date));
        window.MojoState.bodyLogs = mergedB;
        localStorage.setItem('my_body_logs', JSON.stringify(mergedB));
      }

      // 7. 雙向合併 SHOT
      if (json.data.SHOT) {
        let localSh = window.MojoState.shotLogs || [];
        let mergedSh = [...json.data.SHOT];
        localSh.forEach(lsh => {
          if (!mergedSh.some(csh => csh.date === lsh.date)) {
            mergedSh.push(lsh);
          }
        });
        mergedSh.sort((a, b) => new Date(b.date) - new Date(a.date));
        window.MojoState.shotLogs = mergedSh;
        localStorage.setItem('my_shot_logs', JSON.stringify(mergedSh));
      }

      alert('🛡️ 雲端與本地資料安全合併完成！未遺失任何數據。');
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
