// Mojo Project
// 8. main.js

window.MojoState = {
  shotLogs: [],
  scaleLogs: [],
  bodyLogs: [],
  dietLogs: [],
  waterLogs: {}
};

function getLocalTodayStr() {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function getLocalTimeStr() {
  const now = new Date();
  const h = String(now.getHours()).padStart(2, '0');
  const m = String(now.getMinutes()).padStart(2, '0');
  return `${h}:${m}`;
}

// 視覺化 API Key 記憶庫核心
function getStoredKeyObjects() {
  try {
    const raw = localStorage.getItem('gemini_key_pool_v2');
    if (raw) return JSON.parse(raw);
  } catch(e) {}
  
  // 相容舊版陣列與單一字串
  const oldPool = localStorage.getItem('gemini_api_keys_pool');
  if (oldPool) {
    try {
      const arr = JSON.parse(oldPool);
      return arr.map((k, idx) => ({ id: 'k_' + idx, name: `金鑰 ${idx + 1}`, key: k }));
    } catch(e) {}
  }
  const singleKey = localStorage.getItem('gemini_api_key');
  if (singleKey) {
    return [{ id: 'k_default', name: '預設金鑰', key: singleKey.trim() }];
  }
  return [];
}

function saveKeyObjects(list) {
  localStorage.setItem('gemini_key_pool_v2', JSON.stringify(list));
}

function getActiveApiKey() {
  const activeId = localStorage.getItem('gemini_active_key_id');
  const list = getStoredKeyObjects();
  if (list.length === 0) return '';
  const found = list.find(item => item.id === activeId);
  return (found ? found.key : list[0].key).trim();
}

function openKeyModal() {
  renderKeyListInModal();
  const modal = document.getElementById('apiKeyModal');
  if (modal) modal.classList.add('active');
}

function closeKeyModal() {
  const modal = document.getElementById('apiKeyModal');
  if (modal) modal.classList.remove('active');
}

function renderKeyListInModal() {
  const container = document.getElementById('apiKeyListContainer');
  if (!container) return;
  const list = getStoredKeyObjects();
  const activeId = localStorage.getItem('gemini_active_key_id') || (list.length ? list[0].id : '');

  if (list.length === 0) {
    container.innerHTML = '<p style="text-align:center; color:var(--sub); padding:10px;">尚未建立任何 API Key</p>';
    return;
  }

  let html = '';
  list.forEach((item, idx) => {
    const isSelected = item.id === activeId || (idx === 0 && !activeId);
    const maskedKey = item.key.slice(0, 6) + '...' + item.key.slice(-4);

    html += `<div class="key-item-card ${isSelected ? 'selected' : ''}">
      <div style="flex:1; min-width:0;">
        <div style="font-weight:bold; font-size:0.9rem; color:#0f172a; display:flex; align-items:center; gap:6px;">
          ${item.name} ${isSelected ? '<span style="font-size:0.75rem; background:#dbeafe; color:#1d4ed8; padding:2px 6px; border-radius:4px;">使用中</span>' : ''}
        </div>
        <small style="color:var(--sub); font-family:monospace;">${maskedKey}</small>
      </div>
      <div style="display:flex; gap:6px;">
        ${!isSelected ? `<button class="action-btn btn-sync" type="button" style="background:#2563eb;" onclick="selectActiveKey('${item.id}')">啟用</button>` : ''}
        <button class="action-btn btn-edit" type="button" onclick="editKeyItem('${item.id}')">編輯</button>
        <button class="action-btn btn-del" type="button" onclick="deleteKeyItem('${item.id}')">刪除</button>
      </div>
    </div>`;
  });

  container.innerHTML = html;
}

function addNewApiKey() {
  const nameInput = document.getElementById('newKeyName');
  const valInput = document.getElementById('newKeyValue');
  const name = nameInput.value.trim() || `金鑰 ${Date.now().toString().slice(-4)}`;
  const key = valInput.value.trim();

  if (!key || key.length < 10) return alert('請貼上有效的 API Key');

  const list = getStoredKeyObjects();
  const newObj = {
    id: 'k_' + Date.now(),
    name: name,
    key: key
  };
  list.push(newObj);
  saveKeyObjects(list);
  localStorage.setItem('gemini_active_key_id', newObj.id);
  localStorage.setItem('gemini_api_key', key);

  nameInput.value = '';
  valInput.value = '';
  renderKeyListInModal();
  alert(`✨ 已成功新增「${name}」並設為啟用！`);
}

function selectActiveKey(id) {
  const list = getStoredKeyObjects();
  const target = list.find(item => item.id === id);
  if (target) {
    localStorage.setItem('gemini_active_key_id', target.id);
    localStorage.setItem('gemini_api_key', target.key);
    renderKeyListInModal();
    alert(`🎯 已切換至「${target.name}」！`);
  }
}

function editKeyItem(id) {
  const list = getStoredKeyObjects();
  const idx = list.findIndex(item => item.id === id);
  if (idx === -1) return;
  const current = list[idx];

  const newName = prompt('修改此金鑰名稱：', current.name);
  if (newName === null) return;
  const newKey = prompt('修改完整 API Key：', current.key);
  if (newKey === null) return;

  list[idx].name = newName.trim() || current.name;
  list[idx].key = newKey.trim() || current.key;

  saveKeyObjects(list);
  if (localStorage.getItem('gemini_active_key_id') === id) {
    localStorage.setItem('gemini_api_key', list[idx].key);
  }
  renderKeyListInModal();
  alert('✨ 金鑰資訊已成功更新！');
}

function deleteKeyItem(id) {
  let list = getStoredKeyObjects();
  const target = list.find(item => item.id === id);
  if (!target) return;

  if (confirm(`確定要刪除「${target.name}」這組金鑰嗎？`)) {
    list = list.filter(item => item.id !== id);
    saveKeyObjects(list);
    if (localStorage.getItem('gemini_active_key_id') === id && list.length > 0) {
      localStorage.setItem('gemini_active_key_id', list[0].id);
      localStorage.setItem('gemini_api_key', list[0].key);
    }
    renderKeyListInModal();
  }
}

function setupSecretToken() {
  const curToken = localStorage.getItem('cloud_sync_secret') || '';
  const newToken = prompt('請輸入 Google Apps Script 同步金鑰 (SYNC_SECRET)：', curToken);
  if (newToken !== null) {
    localStorage.setItem('cloud_sync_secret', newToken.trim());
    alert('同步金鑰已更新！');
  }
}

document.addEventListener('DOMContentLoaded', () => {
  const todayStr = getLocalTodayStr();
  const timeStr = getLocalTimeStr();

  const setIfExist = (id, val) => {
    const el = document.getElementById(id);
    if (el) el.value = val;
  };

  setIfExist('shotDate', todayStr);
  setIfExist('scaleDate', todayStr);
  setIfExist('scaleTime', timeStr);
  setIfExist('bodyDate', todayStr);
  setIfExist('dietDate', todayStr);

  const tabInbody = document.getElementById('tab-inbody');
  const tabDiet = document.getElementById('tab-diet');
  const btnTabInbody = document.getElementById('btnTabInbody');
  const btnTabDiet = document.getElementById('btnTabDiet');

  if (btnTabInbody && btnTabDiet) {
    btnTabInbody.addEventListener('click', () => {
      btnTabInbody.classList.add('active');
      btnTabDiet.classList.remove('active');
      if (tabInbody) tabInbody.classList.add('active');
      if (tabDiet) tabDiet.classList.remove('active');
      
      setTimeout(() => {
        if (typeof renderScaleChart === 'function') renderScaleChart();
        if (typeof renderBodyChart === 'function') renderBodyChart();
      }, 50);
    });

    btnTabDiet.addEventListener('click', () => {
      btnTabDiet.classList.add('active');
      btnTabInbody.classList.remove('active');
      if (tabDiet) tabDiet.classList.add('active');
      if (tabInbody) tabInbody.classList.remove('active');
      if (typeof renderDiet === 'function') renderDiet();
    });
  }

  try {
    const s1 = localStorage.getItem('my_shot_logs');
    if (s1) window.MojoState.shotLogs = JSON.parse(s1);
    
    const s2 = localStorage.getItem('my_scale_logs');
    if (s2) window.MojoState.scaleLogs = JSON.parse(s2);

    const s3 = localStorage.getItem('my_body_logs');
    if (s3) window.MojoState.bodyLogs = JSON.parse(s3);

    const s4 = localStorage.getItem('my_diet_logs');
    if (s4) window.MojoState.dietLogs = JSON.parse(s4);

    const s5 = localStorage.getItem('my_water_logs');
    if (s5) window.MojoState.waterLogs = JSON.parse(s5);
  } catch (e) {
    console.error('LocalStorage 載入失敗', e);
  }

  if (typeof renderShotList === 'function') renderShotList();
  if (typeof renderScaleChart === 'function') renderScaleChart();
  if (typeof renderScaleList === 'function') renderScaleList();
  if (typeof renderComparisonAnalysis === 'function') renderComparisonAnalysis();
  if (typeof renderBodyChart === 'function') renderBodyChart();
  if (typeof renderBodyList === 'function') renderBodyList();
  if (typeof renderDiet === 'function') renderDiet();
});
