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

// 多組 API Key 管理核心
function getActiveApiKey() {
  const activeKey = localStorage.getItem('gemini_active_key');
  if (activeKey) return activeKey.trim();

  const keys = getStoredApiKeys();
  if (keys.length > 0) return keys[0];
  return '';
}

function getStoredApiKeys() {
  try {
    const saved = localStorage.getItem('gemini_api_keys_pool');
    if (saved) return JSON.parse(saved);
  } catch(e) {}
  const oldKey = localStorage.getItem('gemini_api_key');
  return oldKey ? [oldKey.trim()] : [];
}

function setupApiKey() {
  let keys = getStoredApiKeys();
  let currentActive = localStorage.getItem('gemini_active_key') || (keys.length ? keys[0] : '');

  let msg = `⚙️ Gemini API Key 管理中心\n目前已儲存 ${keys.length} 組金鑰：\n\n`;
  keys.forEach((k, idx) => {
    const isCurrent = (k === currentActive) ? ' [🎯 使用中]' : '';
    msg += `[${idx + 1}] ${k.slice(0, 8)}...${k.slice(-4)}${isCurrent}\n`;
  });
  msg += `\n請輸入操作指令：\n• 新增金鑰：輸入「add 你的新金鑰」\n• 切換金鑰：輸入「use 編號」(例如 use 1)\n• 直接貼上新金鑰直接儲存啟用`;

  const input = prompt(msg);
  if (!input) return;

  const trimmed = input.trim();
  if (trimmed.startsWith('add ')) {
    const newK = trimmed.replace('add ', '').trim();
    if (newK.length > 10) {
      keys.push(newK);
      localStorage.setItem('gemini_api_keys_pool', JSON.stringify(keys));
      localStorage.setItem('gemini_active_key', newK);
      localStorage.setItem('gemini_api_key', newK);
      alert(`✨ 成功新增並切換至第 ${keys.length} 組金鑰！`);
    } else {
      alert('金鑰格式或長度不正確。');
    }
  } else if (trimmed.startsWith('use ')) {
    const idx = parseInt(trimmed.replace('use ', '')) - 1;
    if (idx >= 0 && idx < keys.length) {
      localStorage.setItem('gemini_active_key', keys[idx]);
      localStorage.setItem('gemini_api_key', keys[idx]);
      alert(`🎯 已切換至第 ${idx + 1} 組金鑰！`);
    } else {
      alert('找不到該編號的金鑰。');
    }
  } else if (trimmed.length > 10) {
    if (!keys.includes(trimmed)) {
      keys.push(trimmed);
      localStorage.setItem('gemini_api_keys_pool', JSON.stringify(keys));
    }
    localStorage.setItem('gemini_active_key', trimmed);
    localStorage.setItem('gemini_api_key', trimmed);
    alert('✨ API Key 已成功儲存並啟用！');
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
