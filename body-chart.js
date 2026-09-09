// Mojo Project
// 6. body-chart.js (MK-80978: 修正初次載入白畫面、自適應寬高與多模式趨勢圖)

let bodyChartInstance = null;
let currentChartMode = 'core';

function switchChartMode(mode, btnEl) {
  currentChartMode = mode;
  const tabs = document.querySelectorAll('#bodyChartTabs .chart-tab-btn');
  tabs.forEach(t => t.classList.remove('active'));
  if (btnEl) btnEl.classList.add('active');
  renderChart();
}

function renderChart() {
  const canvas = document.getElementById('bodyChart');
  if (!canvas) return;

  const container = document.getElementById('bodyChartContainer');
  if (container && container.clientWidth === 0) {
    // 若容器寬度尚未被瀏覽器計算出來，於下一影格重試，避免 Chart.js 白畫面
    requestAnimationFrame(() => renderChart());
    return;
  }

  const logs = (window.MojoState.bodyLogs || []).slice().sort((a,b) => new Date(a.date) - new Date(b.date));
  if (logs.length === 0) {
    if (bodyChartInstance) {
      bodyChartInstance.destroy();
      bodyChartInstance = null;
    }
    return;
  }

  const labels = logs.map(b => b.date.slice(5));
  let datasets = [];
  let scalesConfig = {
    x: { grid: { display: false } },
    y: { type: 'linear', position: 'left', grid: { color: '#f1f5f9' }, title: { display: true, text: '重量 (kg)' } }
  };

  if (currentChartMode === 'core') {
    scalesConfig.y1 = { type: 'linear', position: 'right', grid: { drawOnChartArea: false }, title: { display: true, text: '體脂率 (%)' } };
    datasets = [
      { label: '體重 (kg)', data: logs.map(b => b.weight), borderColor: '#2563eb', backgroundColor: 'rgba(37, 99, 235, 0.1)', borderWidth: 2.5, tension: 0.2, yAxisID: 'y' },
      { label: '骨骼肌 (kg)', data: logs.map(b => b.smm), borderColor: '#059669', borderWidth: 2, tension: 0.2, yAxisID: 'y' },
      { label: '體脂率 (%)', data: logs.map(b => b.pbf), borderColor: '#d97706', borderWidth: 2, tension: 0.2, borderDash: [4, 4], yAxisID: 'y1' }
    ];
  } else if (currentChartMode === 'comp') {
    datasets = [
      { label: '體水分 (L)', data: logs.map(b => b.tbw), borderColor: '#0284c7', borderWidth: 2, tension: 0.2, yAxisID: 'y' },
      { label: '蛋白質 (kg)', data: logs.map(b => b.protein), borderColor: '#10b981', borderWidth: 2, tension: 0.2, yAxisID: 'y' },
      { label: '礦物質 (kg)', data: logs.map(b => b.minerals), borderColor: '#8b5cf6', borderWidth: 2, tension: 0.2, yAxisID: 'y' },
      { label: '體脂肪重 (kg)', data: logs.map(b => b.bfm), borderColor: '#f59e0b', borderWidth: 2, tension: 0.2, yAxisID: 'y' }
    ];
  } else if (currentChartMode === 'muscle_seg') {
    datasets = [
      { label: '右上肢 (kg)', data: logs.map(b => b.segments?.m_ra_kg || 0), borderColor: '#3b82f6', tension: 0.2, yAxisID: 'y' },
      { label: '軀幹 (kg)', data: logs.map(b => b.segments?.m_tr_kg || 0), borderColor: '#10b981', tension: 0.2, yAxisID: 'y' },
      { label: '左上肢 (kg)', data: logs.map(b => b.segments?.m_la_kg || 0), borderColor: '#6366f1', tension: 0.2, yAxisID: 'y' },
      { label: '右下肢 (kg)', data: logs.map(b => b.segments?.m_rl_kg || 0), borderColor: '#f59e0b', tension: 0.2, yAxisID: 'y' },
      { label: '左下肢 (kg)', data: logs.map(b => b.segments?.m_ll_kg || 0), borderColor: '#ec4899', tension: 0.2, yAxisID: 'y' }
    ];
  } else if (currentChartMode === 'fat_seg') {
    datasets = [
      { label: '右上肢 (kg)', data: logs.map(b => b.segments?.f_ra_kg || 0), borderColor: '#3b82f6', tension: 0.2, yAxisID: 'y' },
      { label: '軀幹 (kg)', data: logs.map(b => b.segments?.f_tr_kg || 0), borderColor: '#10b981', tension: 0.2, yAxisID: 'y' },
      { label: '左上肢 (kg)', data: logs.map(b => b.segments?.f_la_kg || 0), borderColor: '#6366f1', tension: 0.2, yAxisID: 'y' },
      { label: '右下肢 (kg)', data: logs.map(b => b.segments?.f_rl_kg || 0), borderColor: '#f59e0b', tension: 0.2, yAxisID: 'y' },
      { label: '左下肢 (kg)', data: logs.map(b => b.segments?.f_ll_kg || 0), borderColor: '#ec4899', tension: 0.2, yAxisID: 'y' }
    ];
  } else if (currentChartMode === 'obesity') {
    scalesConfig.y1 = { type: 'linear', position: 'right', grid: { drawOnChartArea: false }, title: { display: true, text: '腰臀圍比 (WHR)' } };
    datasets = [
      { label: 'BMI', data: logs.map(b => b.bmi), borderColor: '#ef4444', tension: 0.2, yAxisID: 'y' },
      { label: '內臟脂肪', data: logs.map(b => b.vfl), borderColor: '#b45309', tension: 0.2, yAxisID: 'y' },
      { label: '腰臀比', data: logs.map(b => b.whr), borderColor: '#6b7280', tension: 0.2, yAxisID: 'y1' }
    ];
  }

  if (bodyChartInstance) {
    bodyChartInstance.destroy();
    bodyChartInstance = null;
  }

  bodyChartInstance = new Chart(canvas, {
    type: 'line',
    data: { labels, datasets },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      animation: { duration: 300 },
      interaction: { mode: 'index', intersect: false },
      plugins: { legend: { position: 'top', labels: { boxWidth: 12, font: { size: 11 } } } },
      scales: scalesConfig
    }
  });
}

// 雙保險：頁面完成載入後短延遲自動重繪，徹底消滅初次白畫面
window.addEventListener('load', () => {
  setTimeout(() => {
    if (typeof renderChart === 'function') renderChart();
  }, 150);
});
