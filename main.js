// 6. main.js
window.addEventListener('DOMContentLoaded', () => {
  const btnInbody = document.getElementById('btnTabInbody');
  const btnDiet = document.getElementById('btnTabDiet');

  if (btnInbody) btnInbody.addEventListener('click', () => switchTab('inbody'));
  if (btnDiet) btnDiet.addEventListener('click', () => switchTab('diet'));

  resetDatesToToday();
  if (typeof renderBodyChart === 'function') renderBodyChart();
  if (typeof renderBodyList === 'function') renderBodyList();
  if (typeof renderDiet === 'function') renderDiet();
});
