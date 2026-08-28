// Mojo Project
// 6-2. body-chart.js
let currentChartMode = 'core';
let chartInstance = null;

function switchChartMode(mode, btnEl) {
  currentChartMode = mode;
  const tabContainer = document.getElementById('bodyChartTabs');
  if (tabContainer) {
    tabContainer.querySelectorAll('.chart-tab-btn').forEach(btn => btn.classList.remove('active'));
  }
  if (btnEl) btnEl.classList.add('active');
  renderBodyChart();
}

function renderBodyChart() {
  const canvas = document.getElementById('bodyChart');
  const container = document.getElementById('bodyChartContainer');
  if (!canvas || !container) return;
  const ctx = canvas.getContext('2d');
  const list = window.MojoState.bodyLogs || [];

  if (list.length === 0) {
    if (chartInstance) chartInstance.destroy();
    return;
  }

  // 橫向滑動自適應寬度
  const minWidthPerPoint = 65;
  const parentWidth = container.parentElement.clientWidth || 340;
  const totalWidth = Math.max(parentWidth, list.length * minWidthPerPoint);
  container.style.width = `${totalWidth}px`;

  const labels = list.map(l => String(l.date || '').slice(5));
  if (chartInstance) chartInstance.destroy();

  let datasets = [];
  let scales = {
    x: {
      grid: { display: true, color: 'rgba(226, 232, 240, 0.6)', drawBorder: false },
      ticks: { font: { size: 11, weight: '500' }, color: '#64748b' }
    }
  };

  if (currentChartMode === 'core') {
    const weights = list.map(l => Number(l.weight) || 0);
    const pbfs = list.map(l => Number(l.pbf) || 0);
    const smms = list.map(l => Number(l.smm) || 0);
    const minW = Math.min(...weights);
    const maxW = Math.max(...weights);
    const validOthers = pbfs.concat(smms).filter(v => v > 0);
    const minOther = validOthers.length ? Math.min(...validOthers) : 0;
    const maxOther = validOthers.length ? Math.max(...validOthers) : 50;

    datasets = [
      {
        label: '體重 (kg)',
        data: weights,
        borderColor: '#2563eb',
        backgroundColor: 'rgba(37, 99, 235, 0.08)',
        borderWidth: 3,
        pointRadius: 5,
        tension: 0.3,
        yAxisID: 'yWeight',
        fill: true
      },
      {
        label: '骨骼肌 (kg)',
        data: smms,
        borderColor: '#10b981',
        borderWidth: 2.5,
        pointRadius: 4,
        tension: 0.3,
        yAxisID: 'yOther'
      },
      {
        label: '體脂率 (%)',
        data: pbfs,
        borderColor: '#ef4444',
        borderWidth: 2.5,
        borderDash: [3, 3],
        pointRadius: 4,
        tension: 0.3,
        yAxisID: 'yOther'
      }
    ];

    scales.yWeight = {
      type: 'linear',
      position: 'left',
      title: { display: true, text: '體重 (kg)', color: '#2563eb', font: { weight: 'bold' } },
      min: Math.floor(minW - 1),
      max: Math.ceil(maxW + 1),
      grid: { color: '#f1f5f9' },
      ticks: { color: '#2563eb' }
    };
    scales.yOther = {
      type: 'linear',
      position: 'right',
      title: { display: true, text: '肌肉 / 體脂', color: '#64748b', font: { weight: 'bold' } },
      min: Math.floor(minOther - 2),
      max: Math.ceil(maxOther + 2),
      grid: { drawOnChartArea: false },
      ticks: { color: '#64748b' }
    };
  } else if (currentChartMode === 'comp') {
    datasets = [
      { label: '水分 (L)', data: list.map(l => Number(l.tbw) || 0), borderColor: '#06b6d4', borderWidth: 2.5, tension: 0.3 },
      { label: '蛋白質 (kg)', data: list.map(l => Number(l.protein) || 0), borderColor: '#10b981', borderWidth: 2.5, tension: 0.3 },
      { label: '礦物質 (kg)', data: list.map(l => Number(l.minerals) || 0), borderColor: '#f59e0b', borderWidth: 2.5, tension: 0.3 },
      { label: '體脂肪 (kg)', data: list.map(l => Number(l.bfm) || 0), borderColor: '#ef4444', borderWidth: 2.5, tension: 0.3 }
    ];
    scales.y = { type: 'linear', beginAtZero: false, title: { display: true, text: '數值 (kg / L)', font: { weight: 'bold' } }, grid: { color: '#f1f5f9' } };
  } else if (currentChartMode === 'muscle_seg') {
    datasets = [
      { label: '右上肢', data: list.map(l => Number(l.m_ra_kg) || 0), borderColor: '#3b82f6', tension: 0.3 },
      { label: '左上肢', data: list.map(l => Number(l.m_la_kg) || 0), borderColor: '#60a5fa', tension: 0.3 },
      { label: '軀幹', data: list.map(l => Number(l.m_tr_kg) || 0), borderColor: '#10b981', tension: 0.3, borderWidth: 3 },
      { label: '右下肢', data: list.map(l => Number(l.m_rl_kg) || 0), borderColor: '#f59e0b', tension: 0.3 },
      { label: '左下肢', data: list.map(l => Number(l.m_ll_kg) || 0), borderColor: '#fbbf24', tension: 0.3 }
    ];
    scales.y = { type: 'linear', beginAtZero: false, title: { display: true, text: '肌肉重 (kg)', font: { weight: 'bold' } }, grid: { color: '#f1f5f9' } };
  } else if (currentChartMode === 'fat_seg') {
    datasets = [
      { label: '右上肢', data: list.map(l => Number(l.f_ra_kg) || 0), borderColor: '#f87171', tension: 0.3 },
      { label: '左上肢', data: list.map(l => Number(l.f_la_kg) || 0), borderColor: '#fca5a5', tension: 0.3 },
      { label: '軀幹', data: list.map(l => Number(l.f_tr_kg) || 0), borderColor: '#ef4444', tension: 0.3, borderWidth: 3 },
      { label: '右下肢', data: list.map(l => Number(l.f_rl_kg) || 0), borderColor: '#c084fc', tension: 0.3 },
      { label: '左下肢', data: list.map(l => Number(l.f_ll_kg) || 0), borderColor: '#e879f9', tension: 0.3 }
    ];
    scales.y = { type: 'linear', beginAtZero: false, title: { display: true, text: '脂肪重 (kg)', font: { weight: 'bold' } }, grid: { color: '#f1f5f9' } };
  } else if (currentChartMode === 'obesity') {
    datasets = [
      { label: 'BMI', data: list.map(l => Number(l.bmi) || 0), borderColor: '#8b5cf6', tension: 0.3 },
      { label: '內臟脂肪級別', data: list.map(l => Number(l.vfl) || 0), borderColor: '#ea580c', tension: 0.3 },
      { label: '腰臀比 (WHR*10)', data: list.map(l => (Number(l.whr) ? Number(l.whr) * 10 : 0)), borderColor: '#ec4899', tension: 0.3 }
    ];
    scales.y = { type: 'linear', beginAtZero: false, title: { display: true, text: '等級 / 指標', font: { weight: 'bold' } }, grid: { color: '#f1f5f9' } };
  }

  chartInstance = new Chart(ctx, {
    type: 'line',
    data: { labels: labels, datasets: datasets },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: { mode: 'index', intersect: false },
      plugins: {
        legend: { position: 'bottom', labels: { boxWidth: 12, font: { weight: 'bold' } } },
        tooltip: {
          padding: 10,
          backgroundColor: 'rgba(15, 23, 42, 0.9)',
          titleFont: { weight: 'bold' },
          cornerRadius: 8
        }
      },
      scales: scales
    }
  });

  setTimeout(() => {
    container.parentElement.scrollLeft = container.parentElement.scrollWidth;
  }, 50);
}
