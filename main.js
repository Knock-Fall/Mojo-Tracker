// Mojo Project
function getLocalTodayStr() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function getLocalCurrentTimeStr() {
  const now = new Date();
  const hours = String(now.getHours()).padStart(2, '0');
  const minutes = String(now.getMinutes()).padStart(2, '0');
  return `${hours}:${minutes}`;
}

function resetDatesToToday() {
  const today = getLocalTodayStr();
  const curTime = getLocalCurrentTimeStr();

  const shotDateEl = document.getElementById('shotDate');
  const scaleDateEl = document.getElementById('scaleDate');
  const scaleTimeEl = document.getElementById('scaleTime');
  const bodyDateEl = document.getElementById('bodyDate');
  const dietDateEl = document.getElementById('dietDate');

  if (shotDateEl) shotDateEl.value = today;
  if (scaleDateEl) scaleDateEl.value = today;
  if (scaleTimeEl) scaleTimeEl.value = curTime;
  if (bodyDateEl) bodyDateEl.value = today;
  if (dietDateEl) dietDateEl.value = today;
}

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
    setTimeout(() => {
      if (typeof renderBodyChart === 'function') renderBodyChart();
      if (typeof renderScaleChart === 'function') renderScaleChart();
      if (typeof renderComparisonAnalysis === 'function') renderComparisonAnalysis();
      if (typeof renderBodyList === 'function') renderBodyList();
    }, 50);
  } else {
    btnDiet.classList.add('active');
    btnInbody.classList.remove('active');
    tabDiet.classList.add('active');
    tabInbody.classList.remove('active');
    setTimeout(() => { if (typeof renderDiet === 'function') renderDiet(); }, 50);
  }
}

window.addEventListener('DOMContentLoaded', () => {
  const btnInbody = document.getElementById('btnTabInbody');
  const btnDiet = document.getElementById('btnTabDiet');

  if (btnInbody) btnInbody.addEventListener('click', () => switchTab('inbody'));
  if (btnDiet) btnDiet.addEventListener('click', () => switchTab('diet'));

  resetDatesToToday();
  if (typeof renderBodyChart === 'function') renderBodyChart();
  if (typeof renderScaleChart === 'function') renderScaleChart();
  if (typeof renderComparisonAnalysis === 'function') renderComparisonAnalysis();
  if (typeof renderBodyList === 'function') renderBodyList();
  if (typeof renderDiet === 'function') renderDiet();
});
