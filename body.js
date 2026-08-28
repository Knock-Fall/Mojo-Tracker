// Mojo Project
// 6. body.js
let currentChartMode = 'core';
let chartInstance = null;
let base64InBodyImage = '';

function switchChartMode(mode, btnEl) {
  currentChartMode = mode;
  document.querySelectorAll('.chart-tab-btn').forEach(btn => btn.classList.remove('active'));
  if (btnEl) btnEl.classList.add('active');
  renderBodyChart();
}

function compressInBodyImage(file, maxWidth = 1400, quality = 0.75) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = function(e) {
      const img = new Image();
      img.onload = function() {
        let w = img.width, h = img.height;
        if (w > maxWidth) {
          h = Math.round((h * maxWidth) / w);
          w = maxWidth;
        }
        const canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, w, h);
        const dataUrl = canvas.toDataURL('image/jpeg', quality);
        resolve({ dataUrl: dataUrl, base64: dataUrl.split(',')[1] });
      };
      img.onerror = reject;
      img.src = e.target.result;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

async function previewAndAnalyzeInBody(input) {
  const file = input.files[0];
  if (file) {
    try {
      const compressed = await compressInBodyImage(file, 1400, 0.75);
      const preview = document.getElementById('inbodyImagePreview');
      preview.src = compressed.dataUrl;
      preview.style.display = 'block';
      base64InBodyImage = compressed.base64;
      document.getElementById('inbodyAiBtn').style.display = 'block';
    } catch(err) {
      console.error(err);
    }
  }
}

async function analyzeInBodyImage() {
  let apiKey = localStorage.getItem('gemini_api_key');
  if (!apiKey) {
    apiKey = prompt('首次使用 InBody 辨識，請輸入您的 Gemini API Key：');
    if (!apiKey) return alert('未輸入 API Key，無法進行分析');
    localStorage.setItem('gemini_api_key', apiKey.trim());
  }

  const aiBtn = document.getElementById('inbodyAiBtn');
  aiBtn.disabled = true;
  aiBtn.innerText = '⚡ AI 極速辨識中 (約1~3秒)...';

  const promptText = `請精確分析這張 InBody 報告圖片，擷取下列 JSON 數值：
{"weight":數字,"tbw":數字,"protein":數字,"minerals":數字,"smm":數字,"bfm":數字,"bmi":數字,"pbf":數字,"whr":數字,"vfl":數字,"m_ra_kg":數字,"m_ra_pct":數字,"m_la_kg":數字,"m_la_pct":數字,"m_tr_kg":數字,"m_tr_pct":數字,"m_rl_kg":數字,"m_rl_pct":數字,"m_ll_kg":數字,"m_ll_pct":數字,"f_ra_kg":數字,"f_ra_pct":數字,"f_la_kg":數字,"f_la_pct":數字,"f_tr_kg":數字,"f_tr_pct":數字,"f_rl_kg":數字,"f_rl_pct":數字,"f_ll_kg":數字,"f_ll_pct":數字}`;

  try {
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-3.6-flash:generateContent?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{
          parts: [
            { text: promptText },
            { inlineData: { mimeType: "image/jpeg", data: base64InBodyImage } }
          ]
        }],
        generationConfig: {
          temperature: 0.1,
          responseMimeType: "application/json",
          thinkingConfig: { thinkingBudget: 0 } // 關鍵加速：強制關閉思考
        }
      })
    });
    const resData = await response.json();
    if (resData.error) throw new Error(resData.error.message);

    let rawText = resData.candidates[0].content.parts[0].text.trim();
    const res = JSON.parse(rawText);

    const map = {
      'bodyWeight':'weight', 'bodyTBW':'tbw', 'bodyProtein':'protein', 'bodyMinerals':'minerals',
      'bodySMM':'smm', 'bodyBFM':'bfm', 'bodyBMI':'bmi', 'bodyPBF':'pbf', 'bodyWHR':'whr', 'bodyVFL':'vfl',
      'm_ra_kg':'m_ra_kg', 'm_ra_pct':'m_ra_pct', 'm_la_kg':'m_la_kg', 'm_la_pct':'m_la_pct', 'm_tr_kg':'m_tr_kg', 'm_tr_pct':'m_tr_pct', 'm_rl_kg':'m_rl_kg', 'm_rl_pct':'m_rl_pct', 'm_ll_kg':'m_ll_kg', 'm_ll_pct':'m_ll_pct',
      'f_ra_kg':'f_ra_kg', 'f_ra_pct':'f_ra_pct', 'f_la_kg':'f_la_kg', 'f_la_pct':'f_la_pct', 'f_tr_kg':'f_tr_kg', 'f_tr_pct':'f_tr_pct', 'f_rl_kg':'f_rl_kg', 'f_rl_pct':'f_rl_pct', 'f_ll_kg':'f_ll_kg', 'f_ll_pct':'f_ll_pct'
    };
    for (let id in map) {
      if (res[map[id]] !== undefined && res[map[id]] !== null) {
        document.getElementById(id).value = res[map[id]];
      }
    }
    alert('⚡ InBody 報告極速辨識完成！');
  } catch (err) {
    alert('辨識失敗：' + err.message);
  } finally {
    aiBtn.disabled = false;
    aiBtn.innerText = '✨ 開始 AI 辨識 InBody 數據';
  }
}

function saveBodyData() {
  const weightVal = parseFloat(document.getElementById('bodyWeight').value);
  if (!weightVal) return alert('請至少輸入總體重！');

  const b = {
    date: document.getElementById('bodyDate').value,
    weight: weightVal,
    tbw: parseFloat(document.getElementById('bodyTBW').value) || 0,
    protein: parseFloat(document.getElementById('bodyProtein').value) || 0,
    minerals: parseFloat(document.getElementById('bodyMinerals').value) || 0,
    smm: parseFloat(document.getElementById('bodySMM').value) || 0,
    bfm: parseFloat(document.getElementById('bodyBFM').value) || 0,
    bmi: parseFloat(document.getElementById('bodyBMI').value) || 0,
    pbf: parseFloat(document.getElementById('bodyPBF').value) || 0,
    whr: parseFloat(document.getElementById('bodyWHR').value) || 0,
    vfl: parseInt(document.getElementById('bodyVFL').value) || 0,
    m_ra_kg: parseFloat(document.getElementById('m_ra_kg').value) || 0,
    m_ra_pct: parseFloat(document.getElementById('m_ra_pct').value) || 0,
    m_la_kg: parseFloat(document.getElementById('m_la_kg').value) || 0,
    m_la_pct: parseFloat(document.getElementById('m_la_pct').value) || 0,
    m_tr_kg: parseFloat(document.getElementById('m_tr_kg').value) || 0,
    m_tr_pct: parseFloat(document.getElementById('m_tr_pct').value) || 0,
    m_rl_kg: parseFloat(document.getElementById('m_rl_kg').value) || 0,
    m_rl_pct: parseFloat(document.getElementById('m_rl_pct').value) || 0,
    m_ll_kg: parseFloat(document.getElementById('m_ll_kg').value) || 0,
    m_ll_pct: parseFloat(document.getElementById('m_ll_pct').value) || 0,
    f_ra_kg: parseFloat(document.getElementById('f_ra_kg').value) || 0,
    f_ra_pct: parseFloat(document.getElementById('f_ra_pct').value) || 0,
    f_la_kg: parseFloat(document.getElementById('f_la_kg').value) || 0,
    f_la_pct: parseFloat(document.getElementById('f_la_pct').value) || 0,
    f_tr_kg: parseFloat(document.getElementById('f_tr_kg').value) || 0,
    f_tr_pct: parseFloat(document.getElementById('f_tr_pct').value) || 0,
    f_rl_kg: parseFloat(document.getElementById('f_rl_kg').value) || 0,
    f_rl_pct: parseFloat(document.getElementById('f_rl_pct').value) || 0,
    f_ll_kg: parseFloat(document.getElementById('f_ll_kg').value) || 0,
    f_ll_pct: parseFloat(document.getElementById('f_ll_pct').value) || 0
  };

  const list = window.MojoState.bodyLogs || [];
  window.MojoState.bodyLogs = list.filter(item => item.date !== b.date);
  window.MojoState.bodyLogs.push(b);
  window.MojoState.bodyLogs.sort((a,b) => new Date(a.date) - new Date(b.date));

  localStorage.setItem('my_body_logs', JSON.stringify(window.MojoState.bodyLogs));
  uploadToCloud('BODY', b);
  alert('全方位 InBody 數據已儲存！');
  renderBodyChart();
  renderBodyList();
  if (typeof renderComparisonAnalysis === 'function') renderComparisonAnalysis();
  if (typeof renderDiet === 'function') renderDiet();
}

function editBodyLog(date) {
  const list = window.MojoState.bodyLogs || [];
  const index = list.findIndex(b => b.date === date);
  if (index === -1) return;
  const b = list[index];

  const newWeight = prompt(`修改 ${date} 體重 (kg)：`, b.weight || '');
  if (newWeight === null) return;
  const newSMM = prompt(`修改 ${date} 骨骼肌重 (kg)：`, b.smm || '');
  if (newSMM === null) return;
  const newPBF = prompt(`修改 ${date} 體脂率 (%)：`, b.pbf || '');
  if (newPBF === null) return;
  const newVFL = prompt(`修改 ${date} 內臟脂肪等級：`, b.vfl || '');
  if (newVFL === null) return;

  list[index].weight = parseFloat(newWeight) || b.weight;
  list[index].smm = parseFloat(newSMM) || b.smm;
  list[index].pbf = parseFloat(newPBF) || b.pbf;
  list[index].vfl = parseInt(newVFL) || b.vfl;

  localStorage.setItem('my_body_logs', JSON.stringify(list));
  uploadToCloud('BODY', list[index]);
  renderBodyChart();
  renderBodyList();
  if (typeof renderComparisonAnalysis === 'function') renderComparisonAnalysis();
  if (typeof renderDiet === 'function') renderDiet();
}

function deleteBodyLog(date) {
  if (confirm(`確定要刪除 ${date} 的體態紀錄嗎？`)) {
    const list = window.MojoState.bodyLogs || [];
    window.MojoState.bodyLogs = list.filter(b => b.date !== date);
    localStorage.setItem('my_body_logs', JSON.stringify(window.MojoState.bodyLogs));
    renderBodyChart();
    renderBodyList();
    if (typeof renderComparisonAnalysis === 'function') renderComparisonAnalysis();
    if (typeof renderDiet === 'function') renderDiet();
  }
}

function renderBodyChart() {
  const canvas = document.getElementById('bodyChart');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const list = window.MojoState.bodyLogs || [];

  if (list.length === 0) {
    if (chartInstance) chartInstance.destroy();
    return;
  }

  const labels = list.map(l => String(l.date || '').slice(5));
  if (chartInstance) chartInstance.destroy();

  let datasets = [];
  let scales = { x: { grid: { display: false } } };

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
      { label: '體重 (kg)', data: weights, borderColor: '#2563eb', backgroundColor: 'rgba(37, 99, 235, 0.08)', borderWidth: 3, pointRadius: 5, tension: 0.3, yAxisID: 'yWeight', fill: true },
      { label: '骨骼肌 (kg)', data: smms, borderColor: '#10b981', borderWidth: 2.5, pointRadius: 4, borderDash: [4, 4], tension: 0.3, yAxisID: 'yOther' },
      { label: '體脂率 (%)', data: pbfs, borderColor: '#ef4444', borderWidth: 2.5, pointRadius: 4, tension: 0.3, yAxisID: 'yOther' }
    ];

    scales.yWeight = { type: 'linear', position: 'left', title: { display: true, text: '體重 (kg)', color: '#2563eb' }, min: Math.floor(minW - 1), max: Math.ceil(maxW + 1), grid: { color: '#f1f5f9' } };
    scales.yOther = { type: 'linear', position: 'right', title: { display: true, text: '肌肉 / 體脂', color: '#64748b' }, min: Math.floor(minOther - 2), max: Math.ceil(maxOther + 2), grid: { drawOnChartArea: false } };
  } else if (currentChartMode === 'comp') {
    datasets = [
      { label: '水分 (L)', data: list.map(l => Number(l.tbw) || 0), borderColor: '#06b6d4', tension: 0.3 },
      { label: '蛋白質 (kg)', data: list.map(l => Number(l.protein) || 0), borderColor: '#10b981', tension: 0.3 },
      { label: '礦物質 (kg)', data: list.map(l => Number(l.minerals) || 0), borderColor: '#f59e0b', tension: 0.3 },
      { label: '體脂肪 (kg)', data: list.map(l => Number(l.bfm) || 0), borderColor: '#ef4444', tension: 0.3 }
    ];
    scales.y = { type: 'linear', beginAtZero: false, title: { display: true, text: '數值 (kg / L)' } };
  } else if (currentChartMode === 'muscle_seg') {
    datasets = [
      { label: '右上肢', data: list.map(l => Number(l.m_ra_kg) || 0), borderColor: '#3b82f6', tension: 0.3 },
      { label: '左上肢', data: list.map(l => Number(l.m_la_kg) || 0), borderColor: '#60a5fa', tension: 0.3 },
      { label: '軀幹', data: list.map(l => Number(l.m_tr_kg) || 0), borderColor: '#10b981', tension: 0.3, borderWidth: 3 },
      { label: '右下肢', data: list.map(l => Number(l.m_rl_kg) || 0), borderColor: '#f59e0b', tension: 0.3 },
      { label: '左下肢', data: list.map(l => Number(l.m_ll_kg) || 0), borderColor: '#fbbf24', tension: 0.3 }
    ];
    scales.y = { type: 'linear', beginAtZero: false, title: { display: true, text: '部位肌肉重 (kg)' } };
  } else if (currentChartMode === 'fat_seg') {
    datasets = [
      { label: '右上肢', data: list.map(l => Number(l.f_ra_kg) || 0), borderColor: '#f87171', tension: 0.3 },
      { label: '左上肢', data: list.map(l => Number(l.f_la_kg) || 0), borderColor: '#fca5a5', tension: 0.3 },
      { label: '軀幹', data: list.map(l => Number(l.f_tr_kg) || 0), borderColor: '#ef4444', tension: 0.3, borderWidth: 3 },
      { label: '右下肢', data: list.map(l => Number(l.f_rl_kg) || 0), borderColor: '#c084fc', tension: 0.3 },
      { label: '左下肢', data: list.map(l => Number(l.f_ll_kg) || 0), borderColor: '#e879f9', tension: 0.3 }
    ];
    scales.y = { type: 'linear', beginAtZero: false, title: { display: true, text: '部位脂肪重 (kg)' } };
  } else if (currentChartMode === 'obesity') {
    datasets = [
      { label: 'BMI', data: list.map(l => Number(l.bmi) || 0), borderColor: '#8b5cf6', tension: 0.3 },
      { label: '內臟脂肪級別', data: list.map(l => Number(l.vfl) || 0), borderColor: '#ea580c', tension: 0.3 },
      { label: '腰臀比 (WHR*10)', data: list.map(l => (Number(l.whr) ? Number(l.whr) * 10 : 0)), borderColor: '#ec4899', tension: 0.3 }
    ];
    scales.y = { type: 'linear', beginAtZero: false, title: { display: true, text: '等級 / 指標' } };
  }

  chartInstance = new Chart(ctx, {
    type: 'line',
    data: { labels: labels, datasets: datasets },
    options: { responsive: true, interaction: { mode: 'index', intersect: false }, plugins: { legend: { position: 'bottom' }, tooltip: { padding: 10 } }, scales: scales }
  });
}

function renderBodyList() {
  const bodyContainer = document.getElementById('bodyLogList');
  if (!bodyContainer) return;
  let bodyHtml = '';
  const curBodies = window.MojoState.bodyLogs || [];
  curBodies.slice().reverse().forEach(b => {
    const trunkInfo = (b.m_tr_kg || b.f_tr_kg) ? ` ｜ 軀幹肌/脂: ${b.m_tr_kg || 0}/${b.f_tr_kg || 0}kg` : '';
    bodyHtml += `<div class="log-item">
      <div class="log-info">
        <strong>體重 ${b.weight} kg</strong> (體脂 ${b.pbf}%)<br>
        <small style="color:var(--sub)">${b.date} ｜ 肌肉 ${b.smm}kg ｜ 內臟 ${b.vfl}級${trunkInfo}</small>
      </div>
      <div class="log-actions">
        <button class="action-btn btn-edit" type="button" onclick="editBodyLog('${b.date}')">編輯</button>
        <button class="action-btn btn-del" type="button" onclick="deleteBodyLog('${b.date}')">刪除</button>
      </div>
    </div>`;
  });
  bodyContainer.innerHTML = bodyHtml || '<p style="color:var(--sub);text-align:center;padding:10px;">尚未有 InBody 紀錄</p>';
}
