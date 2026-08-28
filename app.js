const GAS_URL = "https://script.google.com/macros/s/AKfycby_BMulRlvZ2MBdqsLNbYnn1lYm2o7fegy8J8ONiiu4sxIupy2sq_YYo21-KAJlVaW3cw/exec";

function getLocalTodayStr() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function resetDatesToToday() {
  const today = getLocalTodayStr();
  document.getElementById('shotDate').value = today;
  document.getElementById('bodyDate').value = today;
  document.getElementById('dietDate').value = today;
}

let bodyLogs = JSON.parse(localStorage.getItem('my_body_logs') || '[]');
let dietLogs = JSON.parse(localStorage.getItem('my_diet_logs') || '[]');
let shotLogs = JSON.parse(localStorage.getItem('my_shot_logs') || '[]');
let currentChartMode = 'core';

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
    setTimeout(() => { try { renderBodyChart(); } catch(e){} }, 50);
  } else {
    btnDiet.classList.add('active');
    btnInbody.classList.remove('active');
    tabDiet.classList.add('active');
    tabInbody.classList.remove('active');
    setTimeout(() => { try { renderDiet(); } catch(e){} }, 50);
  }
}

document.getElementById('btnTabInbody').addEventListener('click', () => switchTab('inbody'));
document.getElementById('btnTabDiet').addEventListener('click', () => switchTab('diet'));

function getSecretToken() {
  return localStorage.getItem('gas_secret_token') || 'my_custom_secret_key_888';
}

function setupSecretToken() {
  const current = getSecretToken();
  const token = prompt('請輸入您的試算表密鑰 (Secret Token)：', current);
  if (token !== null) {
    localStorage.setItem('gas_secret_token', token.trim());
    alert('密鑰已儲存！');
  }
}

function uploadToCloud(type, payload) {
  const token = getSecretToken();
  fetch(GAS_URL, {
    method: 'POST',
    mode: 'no-cors',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token: token, type: type, payload: payload })
  }).catch(err => console.log('Cloud sync pending:', err));
}

async function syncFromCloud() {
  const token = getSecretToken();
  try {
    const res = await fetch(`${GAS_URL}?token=${encodeURIComponent(token)}`);
    const data = await res.json();
    if (!data.success) throw new Error(data.error || '驗證失敗');

    let newBody = [], newDiet = [], newShot = [];
    data.rows.forEach(r => {
      const type = String(r[1] || '').trim().toUpperCase();
      try {
        let payload = typeof r[2] === 'string' ? JSON.parse(r[2]) : r[2];
        if (payload && payload.date) {
          payload.date = String(payload.date).replace(/\//g, '-').slice(0, 10);
        }
        if (type === 'BODY') newBody.push(payload);
        else if (type === 'DIET') newDiet.push(payload);
        else if (type === 'SHOT') newShot.push(payload);
      } catch(e){}
    });

    if (newBody.length || newDiet.length || newShot.length) {
      bodyLogs = newBody;
      dietLogs = newDiet;
      shotLogs = newShot;
      localStorage.setItem('my_body_logs', JSON.stringify(bodyLogs));
      localStorage.setItem('my_diet_logs', JSON.stringify(dietLogs));
      localStorage.setItem('my_shot_logs', JSON.stringify(shotLogs));
      renderBodyChart();
      renderBodyList();
      renderDiet();
      alert('✅ 已成功從 Google 試算表載入最新資料！');
    } else {
      alert('雲端試算表目前尚無資料。');
    }
  } catch(err) {
    alert('同步失敗：' + err.message + '\n請確認 Secret Token 是否與 Apps Script 一致。');
  }
}

function setupApiKey() {
  const currentKey = localStorage.getItem('gemini_api_key') || '';
  const key = prompt('請輸入您的 Google Gemini API Key（金鑰僅存在您的手機本地）：', currentKey);
  if (key !== null) {
    localStorage.setItem('gemini_api_key', key.trim());
    alert(key ? 'API Key 設定成功！' : '已清除 API Key');
  }
}

let base64InBodyImage = '';
function previewAndAnalyzeInBody(input) {
  const file = input.files[0];
  if (file) {
    const reader = new FileReader();
    reader.onload = function(e) {
      const preview = document.getElementById('inbodyImagePreview');
      preview.src = e.target.result;
      preview.style.display = 'block';
      base64InBodyImage = e.target.result.split(',')[1];
      document.getElementById('inbodyAiBtn').style.display = 'block';
    };
    reader.readAsDataURL(file);
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
  aiBtn.innerText = '⏳ AI 辨識 InBody 報告中...';

  const promptText = `請分析這張 InBody 報告圖片，精準擷取各項數值。請務必且嚴格僅回傳如下純 JSON 格式，若某項目找不到請填 0 或 null，切勿加入任何額外 markdown 或說明文字：
{
  "weight": 體重(數字),
  "tbw": 身體總水分(數字),
  "protein": 蛋白質(數字),
  "minerals": 礦物質(數字),
  "smm": 骨骼肌重(數字),
  "bfm": 體脂肪重(數字),
  "bmi": BMI(數字),
  "pbf": 體脂肪率(數字),
  "whr": 腰臀圍比(數字),
  "vfl": 內臟脂肪等級(數字),
  "m_ra_kg": 右上肢肌肉重, "m_ra_pct": 右上肢肌肉百分比,
  "m_la_kg": 左上肢肌肉重, "m_la_pct": 左上肢肌肉百分比,
  "m_tr_kg": 軀幹肌肉重,   "m_tr_pct": 軀幹肌肉百分比,
  "m_rl_kg": 右下肢肌肉重, "m_rl_pct": 右下肢肌肉百分比,
  "m_ll_kg": 左下肢肌肉重, "m_ll_pct": 左下肢肌肉百分比,
  "f_ra_kg": 右上肢脂肪重, "f_ra_pct": 右上肢脂肪百分比,
  "f_la_kg": 左上肢脂肪重, "f_la_pct": 左上肢脂肪百分比,
  "f_tr_kg": 軀幹脂肪重,   "f_tr_pct": 軀幹脂肪百分比,
  "f_rl_kg": 右下肢脂肪重, "f_rl_pct": 右下肢脂肪百分比,
  "f_ll_kg": 左下肢脂肪重, "f_ll_pct": 左下肢脂肪百分比
}`;

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
        }]
      })
    });

    const resData = await response.json();
    if (resData.error) throw new Error(resData.error.message);

    let rawText = resData.candidates[0].content.parts[0].text.trim();
    rawText = rawText.replace(/```json/g, '').replace(/```/g, '').trim();
    const res = JSON.parse(rawText);

    if (res.weight) document.getElementById('bodyWeight').value = res.weight;
    if (res.tbw) document.getElementById('bodyTBW').value = res.tbw;
    if (res.protein) document.getElementById('bodyProtein').value = res.protein;
    if (res.minerals) document.getElementById('bodyMinerals').value = res.minerals;
    if (res.smm) document.getElementById('bodySMM').value = res.smm;
    if (res.bfm) document.getElementById('bodyBFM').value = res.bfm;
    if (res.bmi) document.getElementById('bodyBMI').value = res.bmi;
    if (res.pbf) document.getElementById('bodyPBF').value = res.pbf;
    if (res.whr) document.getElementById('bodyWHR').value = res.whr;
    if (res.vfl) document.getElementById('bodyVFL').value = res.vfl;

    if (res.m_ra_kg) document.getElementById('m_ra_kg').value = res.m_ra_kg;
    if (res.m_ra_pct) document.getElementById('m_ra_pct').value = res.m_ra_pct;
    if (res.m_la_kg) document.getElementById('m_la_kg').value = res.m_la_kg;
    if (res.m_la_pct) document.getElementById('m_la_pct').value = res.m_la_pct;
    if (res.m_tr_kg) document.getElementById('m_tr_kg').value = res.m_tr_kg;
    if (res.m_tr_pct) document.getElementById('m_tr_pct').value = res.m_tr_pct;
    if (res.m_rl_kg) document.getElementById('m_rl_kg').value = res.m_rl_kg;
    if (res.m_rl_pct) document.getElementById('m_rl_pct').value = res.m_rl_pct;
    if (res.m_ll_kg) document.getElementById('m_ll_kg').value = res.m_ll_kg;
    if (res.m_ll_pct) document.getElementById('m_ll_pct').value = res.m_ll_pct;

    if (res.f_ra_kg) document.getElementById('f_ra_kg').value = res.f_ra_kg;
    if (res.f_ra_pct) document.getElementById('f_ra_pct').value = res.f_ra_pct;
    if (res.f_la_kg) document.getElementById('f_la_kg').value = res.f_la_kg;
    if (res.f_la_pct) document.getElementById('f_la_pct').value = res.f_la_pct;
    if (res.f_tr_kg) document.getElementById('f_tr_kg').value = res.f_tr_kg;
    if (res.f_tr_pct) document.getElementById('f_tr_pct').value = res.f_tr_pct;
    if (res.f_rl_kg) document.getElementById('f_rl_kg').value = res.f_rl_kg;
    if (res.f_rl_pct) document.getElementById('f_rl_pct').value = res.f_rl_pct;
    if (res.f_ll_kg) document.getElementById('f_ll_kg').value = res.f_ll_pct;
    if (res.f_ll_pct) document.getElementById('f_ll_pct').value = res.f_ll_pct;

    alert('✨ InBody 報告辨識完成！已自動帶入下方欄位，請檢視數值後點擊「儲存完整 InBody 數據」。');
  } catch (err) {
    alert('辨識失敗：' + err.message + '\n請確認照片清晰度或 API Key 狀態。');
  } finally {
    aiBtn.disabled = false;
    aiBtn.innerText = '✨ 開始 AI 辨識 InBody 數據';
  }
}

let base64Image = '';
function previewAndAnalyze(input) {
  const file = input.files[0];
  if (file) {
    const reader = new FileReader();
    reader.onload = function(e) {
      const preview = document.getElementById('imagePreview');
      preview.src = e.target.result;
      preview.style.display = 'block';
      base64Image = e.target.result.split(',')[1];
      document.getElementById('aiBtn').style.display = 'block';
    };
    reader.readAsDataURL(file);
  }
}

async function analyzeFoodImage() {
  let apiKey = localStorage.getItem('gemini_api_key');
  if (!apiKey) {
    apiKey = prompt('首次使用拍照估算，請輸入您的 Gemini API Key：');
    if (!apiKey) return alert('未輸入 API Key，無法進行分析');
    localStorage.setItem('gemini_api_key', apiKey.trim());
  }

  const aiBtn = document.getElementById('aiBtn');
  aiBtn.disabled = true;
  aiBtn.innerText = '⏳ AI 分析估算中，請稍候...';

  const promptText = "請辨識此照片中的食物，以繁體中文簡要列出食物名稱，並預估其總熱量(kcal)與總蛋白質(g)。請務必且嚴格僅回傳如下純 JSON 格式，不要加入額外 markdown 標籤或文字：{\"food\": \"食物名稱摘要\", \"cal\": 450, \"pro\": 25.5}";

  try {
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-3.6-flash:generateContent?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{
          parts: [
            { text: promptText },
            { inlineData: { mimeType: "image/jpeg", data: base64Image } }
          ]
        }]
      })
    });

    const resData = await response.json();
    if (resData.error) throw new Error(resData.error.message);

    let rawText = resData.candidates[0].content.parts[0].text.trim();
    rawText = rawText.replace(/```json/g, '').replace(/```/g, '').trim();
    const result = JSON.parse(rawText);

    document.getElementById('dietContent').value = result.food || '';
    document.getElementById('dietCal').value = result.cal || '';
    document.getElementById('dietPro').value = result.pro || '';
    alert('✨ AI 估算完成！已自動填入食物名稱、熱量與蛋白質，請確認後按「加入飲食紀錄」。');
  } catch (err) {
    alert('分析失敗：' + err.message + '\n請確認 API Key 是否正確或網路狀態。');
  } finally {
    aiBtn.disabled = false;
    aiBtn.innerText = '✨ 開始 AI 分析熱量與蛋白質';
  }
}

function switchChartMode(mode, btnEl) {
  currentChartMode = mode;
  document.querySelectorAll('.chart-tab-btn').forEach(btn => btn.classList.remove('active'));
  if (btnEl) btnEl.classList.add('active');
  renderBodyChart();
}

function saveShot() {
  const shot = {
    date: document.getElementById('shotDate').value,
    dose: document.getElementById('shotDose').value,
    note: document.getElementById('shotNote').value
  };
  shotLogs.unshift(shot);
  localStorage.setItem('my_shot_logs', JSON.stringify(shotLogs));
  uploadToCloud('SHOT', shot);
  alert('猛健樂紀錄已儲存並同步至試算表！');
  renderBodyList();
}

function saveBodyData() {
  const weightVal = parseFloat(document.getElementById('bodyWeight').value);
  if (!weightVal) return alert('請至少輸入「總體重」數值！');

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

  bodyLogs.push(b);
  bodyLogs.sort((a,b) => new Date(a.date) - new Date(b.date));
  localStorage.setItem('my_body_logs', JSON.stringify(bodyLogs));
  uploadToCloud('BODY', b);
  alert('全方位 InBody 數據已儲存並同步至試算表！');
  renderBodyChart();
  renderBodyList();
  renderDiet();
}

function saveDiet() {
  const d = {
    date: document.getElementById('dietDate').value,
    type: document.getElementById('dietType').value,
    content: document.getElementById('dietContent').value,
    cal: parseInt(document.getElementById('dietCal').value) || 0,
    pro: parseFloat(document.getElementById('dietPro').value) || 0
  };
  if(!d.content) return alert('請輸入食物內容');
  dietLogs.unshift(d);
  localStorage.setItem('my_diet_logs', JSON.stringify(dietLogs));
  uploadToCloud('DIET', d);
  document.getElementById('dietContent').value = '';
  document.getElementById('dietCal').value = '';
  document.getElementById('dietPro').value = '';
  document.getElementById('foodImage').value = '';
  document.getElementById('imagePreview').style.display = 'none';
  document.getElementById('aiBtn').style.display = 'none';
  renderDiet();
  alert('餐點已記錄並同步至試算表！');
}

let chartInstance = null;
function renderBodyChart() {
  const canvas = document.getElementById('bodyChart');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  if (bodyLogs.length === 0) return;

  const labels = bodyLogs.map(l => String(l.date || '').slice(5));
  if (chartInstance) chartInstance.destroy();

  let datasets = [];
  let scales = { x: { grid: { display: false } } };

  if (currentChartMode === 'core') {
    const weights = bodyLogs.map(l => Number(l.weight) || 0);
    const pbfs = bodyLogs.map(l => Number(l.pbf) || 0);
    const smms = bodyLogs.map(l => Number(l.smm) || 0);
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
        borderDash: [4, 4],
        tension: 0.3,
        yAxisID: 'yOther'
      },
      {
        label: '體脂率 (%)',
        data: pbfs,
        borderColor: '#ef4444',
        borderWidth: 2.5,
        pointRadius: 4,
        tension: 0.3,
        yAxisID: 'yOther'
      }
    ];

    scales.yWeight = {
      type: 'linear',
      position: 'left',
      title: { display: true, text: '體重 (kg)', color: '#2563eb' },
      min: Math.floor(minW - 1),
      max: Math.ceil(maxW + 1),
      grid: { color: '#f1f5f9' }
    };
    scales.yOther = {
      type: 'linear',
      position: 'right',
      title: { display: true, text: '肌肉 / 體脂', color: '#64748b' },
      min: Math.floor(minOther - 2),
      max: Math.ceil(maxOther + 2),
      grid: { drawOnChartArea: false }
    };

  } else if (currentChartMode === 'comp') {
    datasets = [
      { label: '水分 (L)', data: bodyLogs.map(l => Number(l.tbw) || 0), borderColor: '#06b6d4', tension: 0.3 },
      { label: '蛋白質 (kg)', data: bodyLogs.map(l => Number(l.protein) || 0), borderColor: '#10b981', tension: 0.3 },
      { label: '礦物質 (kg)', data: bodyLogs.map(l => Number(l.minerals) || 0), borderColor: '#f59e0b', tension: 0.3 },
      { label: '體脂肪 (kg)', data: bodyLogs.map(l => Number(l.bfm) || 0), borderColor: '#ef4444', tension: 0.3 }
    ];
    scales.y = { type: 'linear', beginAtZero: false, title: { display: true, text: '數值 (kg / L)' } };

  } else if (currentChartMode === 'muscle_seg') {
    datasets = [
      { label: '右上肢', data: bodyLogs.map(l => Number(l.m_ra_kg) || 0), borderColor: '#3b82f6', tension: 0.3 },
      { label: '左上肢', data: bodyLogs.map(l => Number(l.m_la_kg) || 0), borderColor: '#60a5fa', tension: 0.3 },
      { label: '軀幹', data: bodyLogs.map(l => Number(l.m_tr_kg) || 0), borderColor: '#10b981', tension: 0.3, borderWidth: 3 },
      { label: '右下肢', data: bodyLogs.map(l => Number(l.m_rl_kg) || 0), borderColor: '#f59e0b', tension: 0.3 },
      { label: '左下肢', data: bodyLogs.map(l => Number(l.m_ll_kg) || 0), borderColor: '#fbbf24', tension: 0.3 }
    ];
    scales.y = { type: 'linear', beginAtZero: false, title: { display: true, text: '部位肌肉重 (kg)' } };

  } else if (currentChartMode === 'fat_seg') {
    datasets = [
      { label: '右上肢', data: bodyLogs.map(l => Number(l.f_ra_kg) || 0), borderColor: '#f87171', tension: 0.3 },
      { label: '左上肢', data: bodyLogs.map(l => Number(l.f_la_kg) || 0), borderColor: '#fca5a5', tension: 0.3 },
      { label: '軀幹', data: bodyLogs.map(l => Number(l.f_tr_kg) || 0), borderColor: '#ef4444', tension: 0.3, borderWidth: 3 },
      { label: '右下肢', data: bodyLogs.map(l => Number(l.f_rl_kg) || 0), borderColor: '#c084fc', tension: 0.3 },
      { label: '左下肢', data: bodyLogs.map(l => Number(l.f_ll_kg) || 0), borderColor: '#e879f9', tension: 0.3 }
    ];
    scales.y = { type: 'linear', beginAtZero: false, title: { display: true, text: '部位脂肪重 (kg)' } };

  } else if (currentChartMode === 'obesity') {
    datasets = [
      { label: 'BMI', data: bodyLogs.map(l => Number(l.bmi) || 0), borderColor: '#8b5cf6', tension: 0.3 },
      { label: '內臟脂肪級別', data: bodyLogs.map(l => Number(l.vfl) || 0), borderColor: '#ea580c', tension: 0.3 },
      { label: '腰臀比 (WHR*10)', data: bodyLogs.map(l => (Number(l.whr) ? Number(l.whr) * 10 : 0)), borderColor: '#ec4899', tension: 0.3 }
    ];
    scales.y = { type: 'linear', beginAtZero: false, title: { display: true, text: '等級 / 指標' } };
  }

  chartInstance = new Chart(ctx, {
    type: 'line',
    data: { labels: labels, datasets: datasets },
    options: {
      responsive: true,
      interaction: { mode: 'index', intersect: false },
      plugins: {
        legend: { position: 'bottom' },
        tooltip: { padding: 10 }
      },
      scales: scales
    }
  });
}

function renderBodyList() {
  const container = document.getElementById('bodyLogList');
  if (!container) return;
  let html = '';
  shotLogs.forEach(s => {
    html += `<div class="log-item">
      <div><strong>💉 猛健樂施打</strong> <small style="color:var(--sub)">${s.date}</small><br><small>${s.note || ''}</small></div>
      <span class="badge badge-shot">${s.dose}</span>
    </div>`;
  });
  bodyLogs.slice().reverse().forEach(b => {
    const trunkInfo = (b.m_tr_kg || b.f_tr_kg) ? ` ｜ 軀幹肌/脂: ${b.m_tr_kg || 0}/${b.f_tr_kg || 0}kg` : '';
    html += `<div class="log-item">
      <div>
        <strong>體重 ${b.weight} kg</strong> (體脂 ${b.pbf}%)<br>
        <small style="color:var(--sub)">${b.date} ｜ 肌肉 ${b.smm}kg ｜ 內臟 ${b.vfl}級${trunkInfo}</small>
      </div>
    </div>`;
  });
  container.innerHTML = html || '<p style="color:var(--sub);text-align:center;padding:10px;">尚未有體態或施打紀錄</p>';
}

function renderDiet() {
  const dietDateInput = document.getElementById('dietDate');
  if (!dietDateInput) return;
  const queryDate = dietDateInput.value;
  const list = document.getElementById('dietLogList');
  const dayItems = dietLogs.filter(d => String(d.date || '').replace(/\//g, '-') === queryDate);
  
  let totalC = 0, totalP = 0, html = '';
  dayItems.forEach(item => {
    const c = Number(item.cal) || 0;
    const p = Number(item.pro) || 0;
    totalC += c;
    totalP += p;
    html += `<div class="log-item">
      <div><strong>[${item.type || '餐點'}] ${item.content || ''}</strong></div>
      <div style="text-align:right;"><strong>${c} kcal</strong><br><small style="color:var(--accent);">${p.toFixed(1)}g 蛋白</small></div>
    </div>`;
  });

  let latestWeight = 80;
  if (bodyLogs && bodyLogs.length > 0) {
    latestWeight = Number(bodyLogs[bodyLogs.length - 1].weight) || 80;
  }

  const targetCalories = Math.round(latestWeight * 22);
  const targetProtein = Math.round(latestWeight * 1.6);

  document.getElementById('calCurrent').innerText = totalC;
  document.getElementById('calTarget').innerText = targetCalories;
  document.getElementById('proCurrent').innerText = totalP.toFixed(1);
  document.getElementById('proTarget').innerText = targetProtein;
  document.getElementById('inbodyWeightRef').innerText = `依最新體重 ${latestWeight}kg 連動`;

  const calPct = Math.min(100, Math.round((totalC / targetCalories) * 100));
  const proPct = Math.min(100, Math.round((totalP / targetProtein) * 100));

  document.getElementById('calProgress').style.width = calPct + '%';
  document.getElementById('proProgress').style.width = proPct + '%';

  const calDiff = targetCalories - totalC;
  const proDiff = (targetProtein - totalP).toFixed(1);

  document.getElementById('calRemainTxt').innerText = calDiff >= 0 ? `剩餘：${calDiff} kcal` : `超標：${Math.abs(calDiff)} kcal`;
  document.getElementById('calRemainTxt').style.color = calDiff >= 0 ? 'var(--sub)' : '#ef4444';

  document.getElementById('proRemainTxt').innerText = proDiff >= 0 ? `剩餘：${proDiff} g` : `已達標 (+${Math.abs(proDiff)}g)`;
  document.getElementById('proRemainTxt').style.color = proDiff <= 0 ? 'var(--accent)' : 'var(--sub)';

  list.innerHTML = html || '<p style="color:var(--sub);text-align:center;padding:10px;">該日尚無餐點紀錄</p>';
}

resetDatesToToday();
renderBodyChart();
renderBodyList();
renderDiet();
