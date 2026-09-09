// Mojo Project
// 1. main.js (MK-80982: 完美對齊真實 GAS 後台規格 - token/payload 結構與 rows 解析)

window.MojoState = {
  bodyLogs: [],
  scaleLogs: [],
  fitdaysLogs: [],
  shotLogs: [],
  dietLogs: [],
  waterLogs: {},
  workoutLogs: []
};

// 從 LocalStorage 讀取專屬 GAS 部署網址
function getGasUrl() {
  return localStorage.getItem('my_gas_sync_url') || '';
}

// 設定個人專屬 GAS 網址
function setupGasUrl() {
  const cur = getGasUrl();
  const val = prompt('請貼上您的 Google Apps Script 專屬部署網址 (結尾為 /exec)：', cur);
  if (val !== null) {
    const trimmed = val.trim();
    if (trimmed && !trimmed.endsWith('/exec')) {
      alert('⚠️ 網址結尾必須是 /exec，請確認是否複製正確！');
      return false;
    }
    localStorage.setItem('my_gas_sync_url', trimmed);
    alert('✅ 雲端專屬網址已儲存！');
    return true;
  }
  return false;
}

// 取得與後台 token 變數匹配的通行金鑰
function getSecretToken() {
  return localStorage.getItem('my_sync_secret') || 'default_secret';
}

function setupSecretToken() {
  const cur = getSecretToken();
  const val = prompt('請設定 Google Apps Script 通行金鑰 (對應後台 SECRET_TOKEN)：', cur);
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

// ⭐️ 單筆同步：嚴格符合 doPost 格式：{ token, type, payload }
async function uploadToCloud(type, payloadData) {
  const gasUrl = getGasUrl();
  if (!gasUrl || gasUrl.includes('example')) return;
  const token = getSecretToken();
  try {
    await fetch(gasUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({ token: token, type: type, payload: payloadData })
    });
  } catch(e) {
    console.error('雲端同步失敗:', e);
  }
}

// ⭐️ 核心備份：依據後端結構，補推 9/8 15:00 之後的本地紀錄
async function uploadAllLocalToCloud() {
  let gasUrl = getGasUrl();
  if (!gasUrl || gasUrl.includes('example')) {
    const ok = setupGasUrl();
    if (!ok) return;
    gasUrl = getGasUrl();
  }

  const backupBtn = document.querySelector('button[onclick="uploadAllLocalToCloud()"]');
  const originalText = backupBtn ? backupBtn.innerText : '📤 備份本地到雲端';

  try {
    if (backupBtn) {
      backupBtn.disabled = true;
      backupBtn.innerText = '⏳ 正在檢查資料...';
    }

    const token = getSecretToken();

    // 收集所有本地資料，包成 { type, payload } 陣列
    const tasks = [];
    (window.MojoState.dietLogs || []).forEach(d => tasks.push({ type: 'DIET', payload: d }));
    (window.MojoState.workoutLogs || []).forEach(w => tasks.push({ type: 'WORKOUT', payload: w }));
    (window.MojoState.fitdaysLogs || []).forEach(f => tasks.push({ type: 'FITDAYS', payload: f }));
    (window.MojoState.scaleLogs || []).forEach(s => tasks.push({ type: 'SCALE', payload: s }));
    const waters = window.MojoState.waterLogs || {};
    for (let dateKey in waters) {
      tasks.push({ type: 'WATER', payload: { date: dateKey, data: waters[dateKey] } });
    }
    (window.MojoState.bodyLogs || []).forEach(b => tasks.push({ type: 'BODY', payload: b }));
    (window.MojoState.shotLogs || []).forEach(sh => tasks.push({ type: 'SHOT', payload: sh }));

    if (tasks.length === 0) {
      alert('本地目前沒有任何紀錄需要備份。');
      return;
    }

    let successCount = 0;
    for (let i = 0; i < tasks.length; i++) {
      const item = tasks[i];
      if (backupBtn) backupBtn.innerText = `⏳ 傳送中 (${i + 1}/${tasks.length})`;

      const res = await fetch(gasUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify({ token: token, type: item.type, payload: item.payload })
      });
      const resJson = await res.json();
      if (resJson.error) {
        throw new Error('後端錯誤: ' + resJson.error + ' (請確認「雲端金鑰」是否相符)');
      }
      successCount++;
    }

    alert(`🎉 備份完成！共成功寫入 ${successCount} 筆資料至 Google 試算表 Data 分頁！`);
  } catch (err) {
    alert('備份中斷：' + err.message);
  } finally {
    if (backupBtn) {
      backupBtn.disabled = false;
      backupBtn.innerText = originalText;
    }
  }
}

// ⭐️ 核心載入：解析 doGet 回傳的 { success: true, rows: [[Timestamp, Type, JSON_String], ...] }
async function syncFromCloud() {
  let gasUrl = getGasUrl();
  if (!gasUrl || gasUrl.includes('example')) {
    const ok = setupGasUrl();
    if (!ok) return;
    gasUrl = getGasUrl();
  }

  const token = getSecretToken();
  try {
    const res = await fetch(`${gasUrl}?token=${encodeURIComponent(token)}`);
    const json = await res.json();

    if (json.error) {
      alert('載入失敗：' + json.error + '\n請檢查「雲端金鑰」是否與後端 SECRET_TOKEN 相符！');
      return;
    }

    if (json.success && Array.isArray(json.rows)) {
      // 分類雲端 rows 資料
      const cloudDiet = [];
      const cloudWorkout = [];
      const cloudFitdays = [];
      const cloudScale = [];
      const cloudWater = {};
      const cloudBody = [];
      const cloudShot = [];

      json.rows.forEach(r => {
        const rType = r[1];
        let rPayload = null;
        try {
          rPayload = typeof r[2] === 'string' ? JSON.parse(r[2]) : r[2];
        } catch(e) {}

        if (!rPayload) return;

        if (rType === 'DIET') cloudDiet.push(rPayload);
        else if (rType === 'WORKOUT') cloudWorkout.push(rPayload);
        else if (rType === 'FITDAYS') cloudFitdays.push(rPayload);
        else if (rType === 'SCALE') cloudScale.push(rPayload);
        else if (rType === 'WATER') {
          if (rPayload.date && rPayload.data) cloudWater[rPayload.date] = rPayload.data;
        }
        else if (rType === 'BODY') cloudBody.push(rPayload);
        else if (rType === 'SHOT') cloudShot.push(rPayload);
      });

      // 雙向合併（以雲端為底，本機獨有的補進去，絕對不覆蓋遺失）
      // 1. DIET
      let localDiets = window.MojoState.dietLogs || [];
      let mergedDiets = [...cloudDiet];
      localDiets.forEach(ld => {
        if (!mergedDiets.some(cd => (cd.id && cd.id === ld.id) || (cd.date === ld.date && cd.content === ld.content && cd.type === ld.type))) {
          mergedDiets.push(ld);
        }
      });
      window.MojoState.dietLogs = mergedDiets;
      localStorage.setItem('my_diet_logs', JSON.stringify(mergedDiets));

      // 2. WORKOUT
      let localW = window.MojoState.workoutLogs || [];
      let mergedW = [...cloudWorkout];
      localW.forEach(lw => {
        if (!mergedW.some(cw => (cw.id && cw.id === lw.id) || (cw.date === lw.date && cw.type === lw.type && cw.cal === lw.cal))) {
          mergedW.push(lw);
        }
      });
      window.MojoState.workoutLogs = mergedW;
      localStorage.setItem('my_workout_logs', JSON.stringify(mergedW));

      // 3. FITDAYS
      let localFd = window.MojoState.fitdaysLogs || [];
      let mergedFd = [...cloudFitdays];
      localFd.forEach(lf => {
        if (!mergedFd.some(cf => cf.date === lf.date && (cf.time || '') === (lf.time || ''))) {
          mergedFd.push(lf);
        }
      });
      mergedFd.sort((a,b) => new Date(`${a.date} ${a.time||'00:00'}`) - new Date(`${b.date} ${b.time||'00:00'}`));
      window.MojoState.fitdaysLogs = mergedFd;
      localStorage.setItem('my_fitdays_logs', JSON.stringify(mergedFd));

      // 4. SCALE
      let localS = window.MojoState.scaleLogs || [];
      let mergedS = [...cloudScale];
      localS.forEach(ls => {
        if (!mergedS.some(cs => cs.date === ls.date && (cs.time || '') === (ls.time || ''))) {
          mergedS.push(ls);
        }
      });
      mergedS.sort((a,b) => new Date(`${a.date} ${a.time||'00:00'}`) - new Date(`${b.date} ${b.time||'00:00'}`));
      window.MojoState.scaleLogs = mergedS;
      localStorage.setItem('my_scale_logs', JSON.stringify(mergedS));

      // 5. WATER
      let wObj = { ...cloudWater };
      let localWater = window.MojoState.waterLogs || {};
      for (let dk in localWater) {
        if (!wObj[dk]) {
          wObj[dk] = localWater[dk];
        } else {
          wObj[dk].pure = Math.max(wObj[dk].pure || 0, localWater[dk].pure || 0);
          wObj[dk].tea = Math.max(wObj[dk].tea || 0, localWater[dk].tea || 0);
        }
      }
      window.MojoState.waterLogs = wObj;
      localStorage.setItem('my_water_logs', JSON.stringify(wObj));

      // 6. BODY
      let localB = window.MojoState.bodyLogs || [];
      let mergedB = [...cloudBody];
      localB.forEach(lb => {
        if (!mergedB.some(cb => cb.date === lb.date)) {
          mergedB.push(lb);
        }
      });
      mergedB.sort((a, b) => new Date(a.date) - new Date(b.date));
      window.MojoState.bodyLogs = mergedB;
      localStorage.setItem('my_body_logs', JSON.stringify(mergedB));

      // 7. SHOT
      let localSh = window.MojoState.shotLogs || [];
      let mergedSh = [...cloudShot];
      localSh.forEach(lsh => {
        if (!mergedSh.some(csh => csh.date === lsh.date)) {
          mergedSh.push(lsh);
        }
      });
      mergedSh.sort((a, b) => new Date(b.date) - new Date(a.date));
      window.MojoState.shotLogs = mergedSh;
      localStorage.setItem('my_shot_logs', JSON.stringify(mergedSh));

      alert('🛡️ 雲端與本地資料安全合併完成！未遺失任何數據。');
      location.reload();
    } else {
      alert('同步失敗：回傳格式不正確');
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
