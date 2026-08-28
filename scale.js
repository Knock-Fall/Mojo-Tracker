// Mojo Project
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

async function analyzeScaleImage() {
  let apiKey = localStorage.getItem('gemini_api_key');
  if (!apiKey) {
    apiKey = prompt('首次使用辨識功能，請輸入您的 Gemini API Key：');
    if (!apiKey) return alert('未輸入 API Key，無法進行分析');
    localStorage.setItem('gemini_api_key', apiKey.trim());
  }

  const aiBtn = document.getElementById('scaleAiBtn');
  aiBtn.disabled = true;
  aiBtn.innerText = '⏳ AI 辨識 Zepp Life 截圖中...';

  const promptText = `請分析這張 Zepp Life (或小米運動健康) 的體重測量截圖，精準擷取「測量日期(YYYY-MM-DD)」、「體重(kg)」、「骨骼肌或肌肉量(kg)」、「體脂率(%)」。
若截圖中日期只有月/日（例如 8/28），年份請預設為今年 (2026)。
請務必且嚴格僅回傳如下純 JSON 格式，若某項目找不到請填 0 或 null：
{"date": "2026-08-28", "weight": 81.3, "muscle": 58.2, "fat": 21.0}`;

  try {
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-3.6-flash:generateContent?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contents: [{ parts: [{ text: promptText }, { inlineData: { mimeType: "image/jpeg", data: base64ScaleImage } }] }] })
    });
    const resData = await response.json();
    if (resData.error) throw new Error(resData.error.message);

    let rawText = resData.candidates[0].content.parts[0].text.trim().replace(/```json/g, '').replace(/```/g, '').trim();
    const res = JSON.parse(rawText);

    if (res.date) {
      document.getElementById('scaleDate').value = res.date.replace(/\//g, '-').slice(0, 10);
    }
    if (res.weight) document.getElementById('scaleWeight').value = res.weight;
    if (res.muscle) document.getElementById('scaleMuscle').value = res.muscle;
    if (res.fat) document.getElementById('scaleFat').value = res.fat;

    alert('✨ Zepp Life 截圖辨識完成！請確認數值後按「記錄家用體重數據」。');
  } catch (err) {
    alert('辨識失敗：' + err.message);
  } finally {
    aiBtn.disabled = false;
    aiBtn.innerText = '✨ 開始 AI 辨識 Zepp Life 數據';
  }
}

function saveScaleData() {
  const dateVal = document.getElementById('scaleDate').value;
  const weightVal = parseFloat(document.getElementById('scaleWeight').value);
  if (!weightVal) return alert('請輸入家用體重計的「體重」數值！');

  const muscleVal = parseFloat(document.getElementById('scaleMuscle').value) || 0;
  const fatVal = parseFloat(document.getElementById('scaleFat').value) || 0;

  const item = {
    date: dateVal,
    weight: weightVal,
    muscle: muscleVal,
    fat: fatVal
  };

  const list = window.MojoState.scaleLogs || [];
  window.MojoState.scaleLogs = list.filter(s => s.date !== dateVal);
  window.MojoState.scaleLogs.push(item);
  window.MojoState.scaleLogs.sort((a,b) => new Date(a.date) - new Date(b.date));

  localStorage.setItem('my_scale_logs', JSON.stringify(window.MojoState.scaleLogs));
  uploadToCloud('SCALE', item);

  document.getElementById('scaleImage').value = '';
  document.getElementById('scaleImagePreview').style.display = 'none';
  document.getElementById('scaleAiBtn').style.display = 'none';

  alert('家用體重計數據已儲存！');
  
  renderScaleChart();
  renderBodyList();
  renderComparisonAnalysis();
  if (typeof renderDiet === 'function') renderDiet();
}

function editScaleLog(date) {
  const list = window.MojoState.scaleLogs || [];
  const idx = list.findIndex(s => s.date === date);
  if (idx === -1) return;
  const s = list[idx];

  const newW = prompt(`修改 ${date} 家用體重 (kg)：`, s.weight || '');
  if (newW === null) return;
  const newM = prompt(`修改 ${date} 肌肉量 (kg)：`, s.muscle || 0);
  if (newM === null) return;
  const newF = prompt(`修改 ${date} 體脂率 (%)：`, s.fat || 0);
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

function deleteScaleLog(date) {
  if (confirm(`確定要刪除 ${date} 的家用體重計紀錄嗎？`)) {
    const list = window.MojoState.scaleLogs || [];
    window.MojoState.scaleLogs = list.filter(s => s.date !== date);
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

  const labels = list.map(l => String(l.date || '').slice(5));
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
          pointRadius: 6,
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
          pointRadius: 5,
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
          pointRadius: 5,
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
    html += `💡 <em>建議觀念：家用體脂計受雙腳阻抗與晨間水分影響較大，日常看「下降趨勢」，精準數值每隔 2~4 週以 InBody 進行校正。</em>`;
  } else {
    const latestScale = scales[scales.length - 1];
    const latestBody = bodies[bodies.length - 1];
    const wDiff = (latestScale.weight - latestBody.weight).toFixed(1);
    const fDiff = (latestScale.fat && latestBody.pbf) ? (latestScale.fat - latestBody.pbf).toFixed(1) : null;

    html += `<strong>🔍 最新數據橫向比較：</strong><br>`;
    html += `• 家用最新 (${latestScale.date})：${latestScale.weight} kg ｜ 體脂 ${latestScale.fat || '--'}%<br>`;
    html += `• InBody最新 (${latestBody.date})：${latestBody.weight} kg ｜ 體脂 ${latestBody.pbf}%<br>`;
    html += `• 體重落差：<strong>${wDiff >= 0 ? '+' + wDiff : wDiff} kg</strong>` + (fDiff ? ` ｜ 體脂落差：<strong>${fDiff >= 0 ? '+' + fDiff : fDiff} %</strong>` : '') + `<br>`;
    html += `<small style="color:var(--sub);">若同一天兩邊都有測量，將自動進行長期平均誤差校準分析。</small>`;
  }

  el.innerHTML = html;
}
