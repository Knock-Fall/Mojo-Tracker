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

function setupApiKey() {
  const curKey = localStorage.getItem('gemini_api_key') || '';
  const newKey = prompt('請輸入您的 Google Gemini API Key：', curKey);
  if (newKey !== null) {
    localStorage.setItem('gemini_api_key', newKey.trim());
    alert('API Key 已儲存！');
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

  // 載入本地儲存
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

  // 初始渲染各模組
  if (typeof renderShotList === 'function') renderShotList();
  if (typeof renderScaleChart === 'function') renderScaleChart();
  if (typeof renderScaleList === 'function') renderScaleList();
  if (typeof renderComparisonAnalysis === 'function') renderComparisonAnalysis();
  if (typeof renderBodyChart === 'function') renderBodyChart();
  if (typeof renderBodyList === 'function') renderBodyList();
  if (typeof renderDiet === 'function') renderDiet();
});
