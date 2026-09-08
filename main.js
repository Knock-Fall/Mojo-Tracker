// Mojo Project
// 1. main.js (初始化與全域狀態管理)

window.MojoState = {
  bodyLogs: [],
  scaleLogs: [],
  fitdaysLogs: [],
  shotLogs: [],
  dietLogs: [],
  waterLogs: {},
  workoutLogs: []
};

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
    if (el && !el.value) {
      el.value = todayStr;
    }
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
  // 1. 動態注入模組化 UI
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
