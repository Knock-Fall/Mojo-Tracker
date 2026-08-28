// Mojo Project
// 4. scale.js
let scaleChartInstance = null;
let base64ScaleImage = '';

function previewAndAnalyzeScale(input) {
  const file = input.files[0];
  if (file) {
    const reader = new FileReader();
    reader.onload = function(e) {
      const preview = document.getElementById('scaleImagePreview');
      preview.src = e.target.result;
      preview.style.display = 'block';
      base64ScaleImage = e.target.result.split(',')[1];
      document.getElementById('scaleAiBtn').style.display = 'block';
    };
    reader.readAsDataURL(file);
  }
}

// 具備自動切換備援模型的呼叫函式
async function callGeminiVision(promptText, base64Image, apiKey) {
  const models = [
    'gemini-2.5-flash',
    'gemini-2.5-flash-lite',
    'gemini-1.5-flash'
  ];

  let lastError = null;
  for (const model of models) {
    try {
      const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`, {
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
      const data = await response.json();
      if (data.error) {
        // 若遇到 High demand 或 503，換下一個備援模型重試
        lastError = new Error(data.error.message);
        continue;
      }
      return data;
    } catch (err) {
      lastError = err;
    }
  }
  throw lastError || new Error('所有備援模型皆忙碌中，請稍後再試');
}

async function analyzeScaleImage() {
  let apiKey = localStorage.getItem('gemini_api_key');
  if (!apiKey) {
    apiKey = prompt('首次使用辨識功能，請輸入您的 Gemini API Key：');
    if (!apiKey) return alert('未輸入 API Key，無法進行分析');
    localStorage.setItem('gemini_api_key', apiKey.trim());
  }

  const aiBtn = document.getElementById('scaleAiBtn');
  aiBtn.disabled = true;
  aiBtn.innerText = '⏳ AI 正在深度辨識 Zepp Life 所有數據...';

  const promptText = `請精確分析這張 Zepp Life / 小米運動健康 截圖：
1. 頂部測量時間（例如 "8月28日 06:55"）：
   - date: 請輸出西元格式 "YYYY-MM-DD"（年份預設 2026，如 "2026-08-28"）
   - time: 請輸出24小時制 "HH:mm"（必須補零，如 "06:55"）
2. 畫面中的指標數據：
   - weight: 體重數值 (如 81.35)
   - muscle: 肌肉數值 (如 57.22)
   - fat: 體脂百分比 (如 25.8)
   - bmi: BMI 數值 (如 26.3)
   - water: 水分百分比 (如 50.8)
   - vfl: 內臟脂肪數值 (如 12)
   - bmr: 基礎代謝大卡數值 (如 1622)
   - bone: 骨質數值 (如 3.07)
   - protein: 蛋白質百分比 (如 19.4)
   - score: 最上方大字身體評分 (如 58)
   - body_type: 體型判定文字 (如 "偏胖型")

請嚴格僅回傳如下純 JSON，找不到填 null 或 0：
{"date":"2026-08-28","time":"06:55","weight":81.35,"muscle":57.22,"fat":25.8,"bmi":26.3,"water":50.8,"vfl":12,"bmr":1622,"bone":3.07,"protein":19.4,"score":58,"body_type":"偏胖型"}`;

  try {
    const resData = await callGeminiVision(promptText, base64ScaleImage, apiKey);
    let rawText = resData.candidates[0].content.parts[0].text.trim().replace(/```json/g, '').replace(/```/g, '').trim();
    const res = JSON.parse(rawText);

    if (res.date) document.getElementById('scaleDate').value = String(res.date).replace(/\//g, '-').slice(0, 10);
    if (res.time) {
      let t = String(res.time).trim();
      if (t.length === 4 && t.indexOf(':') === 1) t = '0' + t;
      document.getElementById('scaleTime').value = t;
    }
    if (res.weight !== undefined && res.weight !== null) document.getElementById('scaleWeight').value = res.weight;
    if (res.muscle !== undefined && res.muscle !== null) document.getElementById('scaleMuscle').value = res.muscle;
    if (res.fat !== undefined && res.fat !== null) document.getElementById('scaleFat').value = res.fat;
    if (res.bmi !== undefined && res.bmi !== null) document.getElementById('scaleBMI').value = res.bmi;
    if (res.water !== undefined && res.water !== null) document.getElementById('scaleWater').value = res.water;
    if (res.vfl !== undefined && res.vfl !== null) document.getElementById('scaleVFL').value = res.vfl;
    if (res.bmr !== undefined && res.bmr !== null) document.getElementById('scaleBMR').value = res.bmr;
    if (res.bone !== undefined && res.bone !== null) document.getElementById('scaleBone').value = res.bone;
    if (res.protein !== undefined && res.protein !== null) document.getElementById('scaleProtein').value = res.protein;
    if (res.score !== undefined && res.score !== null) document.getElementById('scaleScore').value = res.score;
    if (res.body_type) document.getElementById('scaleBodyType').value = res.body_type;

    alert(`✨ 辨識成功！\n日期：${res.date || '已帶入'}\n時間：${res.time || '已帶入'}\n10 大指標已全部自動填妥！`);
  } catch (err) {
    alert('辨識失敗：' + err.message + '\n請稍候 10 秒後再試一次！');
  } finally {
    aiBtn.disabled = false;
    aiBtn.innerText = '✨ 開始 AI 辨識 Zepp Life 數據';
  }
}

function saveScaleData() {
  const dateVal = document.getElementById('scaleDate').value;
  const timeVal = document.getElementById('scaleTime').value || '08:00';
  const weightVal = parseFloat(document.getElementById('scaleWeight').value);
  if (!weightVal) return alert('請輸入家用體重計的「體重」數值！');

  const item = {
    date: dateVal,
    time: timeVal,
    weight: weightVal,
    muscle: parseFloat(document.getElementById('scaleMuscle').value) || 0,
    fat: parseFloat(document.getElementById('scaleFat').value) || 0,
    bmi: parseFloat(document.getElementById('scaleBMI').value) || 0,
    water: parseFloat(document.getElementById('scaleWater').value) || 0,
    vfl: parseInt(document.getElementById('scaleVFL').value) || 0,
    bmr: parseInt(document.getElementById('scaleBMR').value) || 0,
    bone: parseFloat(document.getElementById('scaleBone').value) || 0,
    protein: parseFloat(document.getElementById('scaleProtein').value) || 0,
    score: parseInt(document.getElementById('scaleScore').value) || 0,
    body_type: document.getElementById('scaleBodyType').value || ''
  };

  if (!window.MojoState) window.MojoState = {};
  if (!window.MojoState.scaleLogs) window.MojoState.scaleLogs = [];
  
  const list = window.MojoState.scaleLogs;
  window.MojoState.scaleLogs = list.filter(s => !(s.date === dateVal && (s.time || '') === timeVal));
  window.MojoState.scaleLogs.push(item);
  window.MojoState.scaleLogs.sort((a,b) => new Date(`${a.date} ${a.time || '00:00'}`) - new Date(`${b.date} ${b.time || '00:00'}`));

  localStorage.setItem('my_scale_logs', JSON.stringify(window.MojoState.scaleLogs));
  uploadToCloud('SCALE', item);

  document.getElementById('scaleImage').value = '';
  document.getElementById('scaleImagePreview').style.display = 'none';
  document.getElementById('scaleAiBtn').style.display = 'none';

  alert(`家用數據 (${dateVal} ${timeVal}) 已儲存！`);
  
  renderScaleChart();
  renderBodyList();
  renderComparisonAnalysis();
  if (typeof renderDiet === 'function') renderDiet();
}

function editScaleLog(uniqueId) {
  const list = window.MojoState.scaleLogs || [];
  const idx = list.findIndex(s => `${s.date}_${s.time || ''}` === uniqueId);
  if (idx === -1) return;
  const s = list[idx];

  const newW = prompt(`修改 ${s.date} ${s.time || ''} 體重 (kg)：`, s.weight || '');
  if (newW === null) return;
  const newM = prompt(`修改 肌肉量 (kg)：`, s.muscle || 0);
  if (newM === null) return;
  const newF = prompt(`修改 體脂率 (%)：`, s.fat || 0);
  if (newF === null) return;

  list[idx].weight = parseFloat(newW) || s.weight;
  list[idx].muscle = parseFloat(newM) || 0;
  list[idx].fat = parseFloat(newF) || 0;

  localStorage.setItem('my_scale_logs', JSON.stringify(list));
  uploadToCloud('SCALE', list[idx]);
  renderScaleChart();
  renderBodyList();
  renderComparisonAnalysis();
  if (typeof renderDiet === 'function') renderDiet();
}

function deleteScaleLog(uniqueId) {
  if (confirm('確定要刪除這筆家用體重計紀錄嗎？')) {
    const list = window.MojoState.scaleLogs || [];
    window.MojoState.scaleLogs = list.filter(s => `${s.date}_${s.time || ''}` !== uniqueId);
    localStorage.setItem('my_scale_logs', JSON.stringify(window.MojoState.scaleLogs));
    renderScaleChart();
    renderBodyList();
    renderComparisonAnalysis();
    if (typeof renderDiet === 'function') renderDiet();
  }
}

function renderScaleChart() {
  const canvas = document.getElementById('scaleChart');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const list = window.MojoState.scaleLogs || [];
  
  if (list.length === 0) {
    if (scaleChartInstance) scaleChartInstance.destroy();
    return;
  }

  const labels = list.map(l => {
    const dStr = String(l.date || '').slice(5);
    return l.time ? `${dStr} ${l.time}` : dStr;
  });
  const weights = list.map(l => Number(l.weight) || null);
  const muscles = list.map(l => Number(l.muscle) || null);
  const fats = list.map(l => Number(l.fat) || null);

  if (scaleChartInstance) scaleChartInstance.destroy();

  scaleChartInstance = new Chart(ctx, {
    type: 'line',
    data: {
      labels: labels,
      datasets: [
        {
          label: '體重 (kg)',
          data: weights,
          borderColor: '#1e5188',
          backgroundColor: '#1e5188',
          borderWidth: 3,
          pointRadius: 5,
          tension: 0.2,
          yAxisID: 'yWeight'
        },
        {
          label: '骨骼肌 (kg)',
          data: muscles,
          borderColor: '#884444',
          backgroundColor: '#884444',
          borderWidth: 2,
          borderDash: [5, 5],
          pointRadius: 4,
          tension: 0.2,
          yAxisID: 'yOther'
        },
        {
          label: '體脂 (%)',
          data: fats,
          borderColor: '#b58933',
          backgroundColor: '#b58933',
          borderWidth: 2,
          borderDash: [2, 3],
          pointRadius: 4,
          tension: 0.2,
          yAxisID: 'yOther'
        }
      ]
    },
    options: {
      responsive: true,
      interaction: { mode: 'index', intersect: false },
      plugins: {
        legend: { position: 'bottom', labels: { boxWidth: 12 } }
      },
      scales: {
        x: { grid: { color: '#f1f5f9' } },
        yWeight: {
          type: 'linear',
          position: 'left',
          title: { display: true, text: '體重 (kg)', color: '#1e5188' },
          grid: { color: '#f1f5f9' }
        },
        yOther: {
          type: 'linear',
          position: 'right',
          title: { display: true, text: '肌肉 (kg) / 體脂 (%)', color: '#64748b' },
          grid: { drawOnChartArea: false }
        }
      }
    }
  });
}

function renderComparisonAnalysis() {
  const el = document.getElementById('scaleDiffReport');
  if (!el) return;

  const scales = window.MojoState.scaleLogs || [];
  const bodies = window.MojoState.bodyLogs || [];

  if (!scales.length || !bodies.length) {
    el.innerHTML = '💡 累積至少 1 筆 InBody 與 1 筆家用體重計數據後，將在此自動產出偏差校正與對比分析。';
    return;
  }

  let pairs = [];
  scales.forEach(s => {
    const matchedBody = bodies.find(b => b.date === s.date);
    if (matchedBody) {
      pairs.push({ date: s.date, scale: s, inbody: matchedBody });
    }
  });

  let html = '';
  if (pairs.length > 0) {
    let diffWTotal = 0, diffFatTotal = 0, countFat = 0;
    pairs.forEach(p => {
      diffWTotal += (p.scale.weight - p.inbody.weight);
      if (p.scale.fat && p.inbody.pbf) {
        diffFatTotal += (p.scale.fat - p.inbody.pbf);
        countFat++;
      }
    });
    const avgDiffW = (diffWTotal / pairs.length).toFixed(2);
    const avgDiffFat = countFat > 0 ? (diffFatTotal / countFat).toFixed(2) : null;

    html += `<strong>🎯 找到 ${pairs.length} 組同日測量對比數據：</strong><br>`;
    html += `• <strong>體重偏差</strong>：家用體重計平均比 InBody <strong>${avgDiffW >= 0 ? '+' + avgDiffW : avgDiffW} kg</strong><br>`;
    if (avgDiffFat !== null) {
      html += `• <strong>體脂率偏差</strong>：家用體重計平均比 InBody <strong>${avgDiffFat >= 0 ? '+' + avgDiffFat : avgDiffFat} %</strong><br>`;
    }
    html += `💡 <em>建議觀念：家用體脂計受雙腳阻抗與水分影響較大，日常看「下降趨勢」，精準數值每隔 2~4 週以 InBody 進行校正。</em>`;
  } else {
    const latestScale = scales[scales.length - 1];
    const latestBody = bodies[bodies.length - 1];
    const wDiff = (latestScale.weight - latestBody.weight).toFixed(1);
    const fDiff = (latestScale.fat && latestBody.pbf) ? (latestScale.fat - latestBody.pbf).toFixed(1) : null;

    html += `<strong>🔍 最新數據橫向比較：</strong><br>`;
    html += `• 家用最新 (${latestScale.date} ${latestScale.time || ''})：${latestScale.weight} kg ｜ 體脂 ${latestScale.fat || '--'}%<br>`;
    html += `• InBody最新 (${latestBody.date})：${latestBody.weight} kg ｜ 體脂 ${latestBody.pbf}%<br>`;
    html += `• 體重落差：<strong>${wDiff >= 0 ? '+' + wDiff : wDiff} kg</strong>` + (fDiff ? ` ｜ 體脂落差：<strong>${fDiff >= 0 ? '+' + fDiff : fDiff} %</strong>` : '') + `<br>`;
    html += `<small style="color:var(--sub);">若同一天兩邊都有測量，將自動進行長期平均誤差校準分析。</small>`;
  }

  el.innerHTML = html;
}
