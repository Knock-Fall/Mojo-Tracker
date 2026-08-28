// Mojo Project
// 4. scale.js
let scaleChartInstance = null;
let base64ScaleImage = '';

function compressScaleImage(file, maxWidth = 1000, quality = 0.75) {
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

async function previewAndAnalyzeScale(input) {
  const file = input.files[0];
  if (file) {
    try {
      const res = await compressScaleImage(file, 1000, 0.75);
      const preview = document.getElementById('scaleImagePreview');
      preview.src = res.dataUrl;
      preview.style.display = 'block';
      base64ScaleImage = res.base64;
      document.getElementById('scaleAiBtn').style.display = 'block';
    } catch(e) {
      console.error(e);
    }
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
  aiBtn.innerText = '⚡ AI 辨識分析中...';

  const promptText = `請仔細辨識這張 Zepp Life (小米運動健康) 體脂計截圖中的每一項數據：
1. 頂部測量時間（例如「8月28日 06:55」）：
   - date: 請輸出西元格式 "YYYY-MM-DD"（若無年份請填 "2026-08-28"）
   - time: 請輸出 24 小時制 "HH:mm"（如 "06:55"）
2. 各項數據指標：
   - weight: 體重數字（如 81.35）
   - muscle: 肌肉數字（如 57.22）
   - fat: 體脂數字（如 25.8）
   - bmi: BMI 數字（如 26.3）
   - water: 水分數字（如 50.8）
   - vfl: 內臟脂肪等級（如 12）
   - bmr: 基礎代謝大卡（如 1622）
   - bone: 骨質重量（如 3.07）
   - protein: 蛋白質百分比（如 19.4）
   - score: 頂部大字分數（如 58）
   - body_type: 體型字樣（如 "偏胖型"）

請絕對且嚴格僅回傳如下純 JSON，不要有任何 Markdown 或多餘文字：
{"date":"2026-08-28","time":"06:55","weight":81.35,"muscle":57.22,"fat":25.8,"bmi":26.3,"water":50.8,"vfl":12,"bmr":1622,"bone":3.07,"protein":19.4,"score":58,"body_type":"偏胖型"}`;

  try {
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-3.6-flash:generateContent?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              { text: promptText },
              {
                inlineData: {
                  mimeType: "image/jpeg",
                  data: base64ScaleImage
                }
              }
            ]
          }
        ]
      })
    });
    const resData = await response.json();
    if (resData.error) throw new Error(resData.error.message);

    let rawText = resData.candidates[0].content.parts[0].text.trim().replace(/```json/g, '').replace(/```/g, '').trim();
    const res = JSON.parse(rawText);

    if (res.date) document.getElementById('scaleDate').value = String(res.date).replace(/\//g, '-').slice(0, 10);
    if (res.time) {
      let tStr = String(res.time).trim();
      if (tStr.length === 4 && tStr.indexOf(':') === 1) tStr = '0' + tStr;
      document.getElementById('scaleTime').value = tStr;
    }

    const setVal = (id, val) => {
      const el = document.getElementById(id);
      if (el && val !== undefined && val !== null && val !== '') el.value = val;
    };

    setVal('scaleWeight', res.weight);
    setVal('scaleMuscle', res.muscle);
    setVal('scaleFat', res.fat);
    setVal('scaleBMI', res.bmi);
    setVal('scaleWater', res.water);
    setVal('scaleVFL', res.vfl);
    setVal('scaleBMR', res.bmr);
    setVal('scaleBone', res.bone);
    setVal('scaleProtein', res.protein);
    setVal('scaleScore', res.score);
    setVal('scaleBodyType', res.body_type);

    alert(`✨ 辨識成功！\n測量時間：${res.date || ''} ${res.time || ''}\n體重：${res.weight || 0}kg ｜ 體脂：${res.fat || 0}%\n內臟脂肪：${res.vfl || 0} ｜ 評分：${res.score || 0}分`);
  } catch (err) {
    alert('辨識失敗：' + err.message);
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

  const list = window.MojoState.scaleLogs || [];
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
  renderScaleList();
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
  renderScaleList();
  renderComparisonAnalysis();
  if (typeof renderDiet === 'function') renderDiet();
}

function deleteScaleLog(uniqueId) {
  if (confirm('確定要刪除這筆家用體重計紀錄嗎？')) {
    const list = window.MojoState.scaleLogs || [];
    window.MojoState.scaleLogs = list.filter(s => `${s.date}_${s.time || ''}` !== uniqueId);
    localStorage.setItem('my_scale_logs', JSON.stringify(window.MojoState.scaleLogs));
    renderScaleChart();
    renderScaleList();
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

function renderScaleList() {
  const scaleContainer = document.getElementById('scaleLogList');
  if (!scaleContainer) return;
  let scaleHtml = '';
  const curScales = window.MojoState.scaleLogs || [];
  curScales.slice().reverse().forEach(s => {
    const timeTag = s.time ? ` <span style="color:#0284c7;font-weight:bold;">${s.time}</span>` : '';
    const bmiTag = s.bmi ? ` ｜ BMI ${s.bmi}` : '';
    const waterTag = s.water ? ` ｜ 水分 ${s.water}%` : '';
    const vflTag = s.vfl ? ` ｜ 內臟 ${s.vfl}` : '';
    const bmrTag = s.bmr ? ` ｜ 代謝 ${s.bmr}kcal` : '';
    const scoreTag = s.score ? ` ｜ 評分: ${s.score}分` : '';
    const bodyTypeTag = s.body_type ? ` [${s.body_type}]` : '';
    const uniqueId = `${s.date}_${s.time || ''}`;

    scaleHtml += `<div class="log-item">
      <div class="log-info">
        <strong>體重 ${s.weight} kg</strong> ${s.fat ? `(體脂 ${s.fat}%)` : ''}${bodyTypeTag}${scoreTag}<br>
        <small style="color:var(--sub)">${s.date}${timeTag} ｜ 肌肉 ${s.muscle || '--'}kg${bmiTag}${waterTag}${vflTag}${bmrTag}</small>
      </div>
      <div class="log-actions">
        <button class="action-btn btn-edit" type="button" onclick="editScaleLog('${uniqueId}')">編輯</button>
        <button class="action-btn btn-del" type="button" onclick="deleteScaleLog('${uniqueId}')">刪除</button>
      </div>
    </div>`;
  });
  scaleContainer.innerHTML = scaleHtml || '<p style="color:var(--sub);text-align:center;padding:10px;">尚未有家用體重計紀錄</p>';
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
