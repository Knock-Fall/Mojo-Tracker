// Mojo Project
// 6. body-chart.js (MK-80982: 修正部位肌肉/脂肪欄位解析相容性，防止貼地 0 軸異常)

let bodyChartInstance = null;
let currentChartMode = 'core';

function switchChartMode(mode, btnEl) {
  currentChartMode = mode;
  const tabs = document.querySelectorAll('#bodyChartTabs .chart-tab-btn');
  tabs.forEach(t => t.classList.remove('active'));
  if (btnEl) btnEl.classList.add('active');
  renderChart();
}

// 安全提取數值，相容多種歷史結構；無數值時回傳 null 避免圖表在 0 軸失真
function getSegValue(b, segType, segKey) {
  // 優先檢查 segments 巢狀結構 (m_ra_kg / m_ra 等)
  if (b.segments) {
    if (b.segments[`${segType}_${segKey}_kg`] !== undefined && b.segments[`${segType}_${segKey}_kg`] !== '') {
      return parseFloat(b.segments[`${segType}_${segKey}_kg`]);
    }
    if (b.segments[`${segType}_${segKey}`] !== undefined && b.segments[`${segType}_${segKey}`] !== '') {
      return parseFloat(b.segments[`${segType}_${segKey}`]);
    }
  }
  // 檢查扁平結構 (如 b.m_ra_kg 或 b.m_ra)
  if (b[`${segType}_${segKey}_kg`] !== undefined && b[`${segType}_${segKey}_kg`] !== '') {
    return parseFloat(b[`${segType}_${segKey}_kg`]);
  }
  if (b[`${segType}_${segKey}`] !== undefined && b[`${segType}_${segKey}`] !== '') {
    return parseFloat(b[`${segType}_${segKey}`]);
  }
  return null;
}

function renderChart() {
  const canvas = document.getElementById('bodyChart');
  if (!canvas) return;

  const container = document.getElementById('bodyChartContainer');
  if (container && container.clientWidth === 0) {
    requestAnimationFrame(() => renderChart());
    return;
  }

  const logs = (window.MojoState.bodyLogs || []).slice().sort((a, b) => new Date(a.date) - new Date(b.date));
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
      { label: '體重 (kg)', data: logs.map(b => b.weight || null), borderColor: '#2563eb', backgroundColor: 'rgba(37, 99, 235, 0.1)', borderWidth: 2.5, tension: 0.2, yAxisID: 'y' },
      { label: '骨骼肌 (kg)', data: logs.map(b => b.smm || null), borderColor: '#059669', borderWidth: 2, tension: 0.2, yAxisID: 'y' },
      { label: '體脂率 (%)', data: logs.map(b => b.pbf || null), borderColor: '#d97706', borderWidth: 2, tension: 0.2, borderDash: [4, 4], yAxisID: 'y1' }
    ];
  } else if (currentChartMode === 'comp') {
    datasets = [
      { label: '體水分 (L)', data: logs.map(b => b.tbw || null), borderColor: '#0284c7', borderWidth: 2, tension: 0.2, yAxisID: 'y' },
      { label: '蛋白質 (kg)', data: logs.map(b => b.protein || null), borderColor: '#10b981', borderWidth: 2, tension: 0.2, yAxisID: 'y' },
      { label: '礦物質 (kg)', data: logs.map(b => b.minerals || null), borderColor: '#8b5cf6', borderWidth: 2, tension: 0.2, yAxisID: 'y' },
      { label: '體脂肪重 (kg)', data: logs.map(b => b.bfm || null), borderColor: '#f59e0b', borderWidth: 2, tension: 0.2, yAxisID: 'y' }
    ];
  } else if (currentChartMode === 'muscle_seg') {
    datasets = [
      { label: '右上肢 (kg)', data: logs.map(b => getSegValue(b, 'm', 'ra')), borderColor: '#3b82f6', tension: 0.2, yAxisID: 'y', spanGaps: true },
      { label: '軀幹 (kg)', data: logs.map(b => getSegValue(b, 'm', 'tr')), borderColor: '#10b981', tension: 0.2, yAxisID: 'y', spanGaps: true },
      { label: '左上肢 (kg)', data: logs.map(b => getSegValue(b, 'm', 'la')), borderColor: '#6366f1', tension: 0.2, yAxisID: 'y', spanGaps: true },
      { label: '右下肢 (kg)', data: logs.map(b => getSegValue(b, 'm', 'rl')), borderColor: '#f59e0b', tension: 0.2, yAxisID: 'y', spanGaps: true },
      { label: '左下肢 (kg)', data: logs.map(b => getSegValue(b, 'm', 'll')), borderColor: '#ec4899', tension: 0.2, yAxisID: 'y', spanGaps: true }
    ];
  } else if (currentChartMode === 'fat_seg') {
    datasets = [
      { label: '右上肢 (kg)', data: logs.map(b => getSegValue(b, 'f', 'ra')), borderColor: '#3b82f6', tension: 0.2, yAxisID: 'y', spanGaps: true },
      { label: '軀幹 (kg)', data: logs.map(b => getSegValue(b, 'f', 'tr')), borderColor: '#10b981', tension: 0.2, yAxisID: 'y', spanGaps: true },
      { label: '左上肢 (kg)', data: logs.map(b => getSegValue(b, 'f', 'la')), borderColor: '#6366f1', tension: 0.2, yAxisID: 'y', spanGaps: true },
      { label: '右下肢 (kg)', data: logs.map(b => getSegValue(b, 'f', 'rl')), borderColor: '#f59e0b', tension: 0.2, yAxisID: 'y', spanGaps: true },
      { label: '左下肢 (kg)', data: logs.map(b => getSegValue(b, 'f', 'll')), borderColor: '#ec4899', tension: 0.2, yAxisID: 'y', spanGaps: true }
    ];
  } else if (currentChartMode === 'obesity') {
    scalesConfig.y1 = { type: 'linear', position: 'right', grid: { drawOnChartArea: false }, title: { display: true, text: '腰臀圍比 (WHR)' } };
    datasets = [
      { label: 'BMI', data: logs.map(b => b.bmi || null), borderColor: '#ef4444', tension: 0.2, yAxisID: 'y' },
      { label: '內臟脂肪', data: logs.map(b => b.vfl || null), borderColor: '#b45309', tension: 0.2, yAxisID: 'y' },
      { label: '腰臀比', data: logs.map(b => b.whr || null), borderColor: '#6b7280', tension: 0.2, yAxisID: 'y1' }
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

window.addEventListener('load', () => {
  setTimeout(() => {
    if (typeof renderChart === 'function') renderChart();
  }, 150);
});
