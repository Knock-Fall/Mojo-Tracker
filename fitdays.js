// Mojo Project
// fitdays.js (Fitdays 專屬 UI 模板、AI 辨識、獨立圖表與週期結算預測)

let base64FitdaysImage = '';
let fitdaysCurrentPage = 1;
const FITDAYS_PAGE_SIZE = 5;
let fitdaysChartInstance = null;

// 1. 動態注入 UI 模板 (加入專屬圖表與週期結算預測卡片)
function initFitdaysUI() {
  const container = document.getElementById('fitdaysScaleContainer');
  if (!container) return;

  container.innerHTML = `
    <div class="card" style="border-left: 5px solid #0d9488;">
      <div class="card-title">
        <span>🟦 Fitdays 人體成分日常記錄</span>
      </div>

      <label for="fitdaysImage" class="btn-upload" style="border-color: #0d9488; color: #0d9488; background: #f0fdfa;">
        📷 點擊此處上傳 Fitdays 報告截圖（AI 自動辨識）
      </label>
      <input type="file" id="fitdaysImage" accept="image/*" style="display: none;" onchange="previewAndAnalyzeFitdays(this)">
      <img id="fitdaysImagePreview" class="preview-box">
      <button id="fitdaysAiBtn" class="btn" type="button" style="display: none; margin-bottom: 12px; background:#0d9488; color:#fff;" onclick="analyzeFitdaysImage()">✨ 開始 AI 辨識 Fitdays 數據</button>

      <div class="grid-2">
        <div class="form-group"><label>測量日期</label><input type="date" id="fdDate"></div>
        <div class="form-group"><label>測量時間</label><input type="time" id="fdTime"></div>
      </div>

      <div class="grid-3">
        <div class="form-group"><label>體重 (kg) *</label><input type="number" step="0.01" id="fdWeight" placeholder="例：81.10"></div>
        <div class="form-group"><label>體脂率 (%)</label><input type="number" step="0.1" id="fdFatPct" placeholder="例：25.9"></div>
        <div class="form-group"><label>體脂肪量 (kg)</label><input type="number" step="0.1" id="fdFatKg" placeholder="例：21.0"></div>
      </div>

      <div class="grid-3">
        <div class="form-group"><label>骨骼肌 (kg) ⭐</label><input type="number" step="0.1" id="fdSMM" placeholder="例：34.1"></div>
        <div class="form-group"><label>總肌肉量 (kg)</label><input type="number" step="0.1" id="fdMuscle" placeholder="例：56.0"></div>
        <div class="form-group"><label>體水分 (L/kg)</label><input type="number" step="0.1" id="fdWater" placeholder="例：44.0"></div>
      </div>

      <div class="grid-3">
        <div class="form-group"><label>蛋白質 (kg)</label><input type="number" step="0.1" id="fdProtein" placeholder="例：12.0"></div>
        <div class="form-group"><label>無機鹽/骨質 (kg)</label><input type="number" step="0.1" id="fdBone" placeholder="例：4.0"></div>
        <div class="form-group"><label>BMI</label><input type="number" step="0.1" id="fdBMI" placeholder="例：25.9"></div>
      </div>

      <div class="grid-3" style="margin-bottom: 8px;">
        <div class="form-group"><label>內臟脂肪等級</label><input type="number" id="fdVFL" placeholder="例：8"></div>
        <div class="form-group"><label>基礎代謝 (kcal)</label><input type="number" id="fdBMR" placeholder="例：1668"></div>
        <div class="form-group"><label>身體評分 (分)</label><input type="number" id="fdScore" placeholder="例：71"></div>
      </div>

      <button class="btn" type="button" style="background:#0d9488; color:#fff;" onclick="saveFitdaysData()">記錄 Fitdays 體脂數據</button>
    </div>

    <!-- Fitdays 專屬趨勢折線圖 -->
    <div class="card">
      <div class="card-title">📈 家用日常趨勢 (Fitdays 雙軸)</div>
      <div class="chart-scroll-wrapper">
        <div class="chart-scroll-inner" style="min-width: 320px; height: 260px;">
          <canvas id="fitdaysChart"></canvas>
        </div>
      </div>
    </div>

    <!-- InBody vs Fitdays 獨立偏差比對與週期結算預測卡片 -->
    <div class="card" style="background:#f0fdfa; border: 1px solid #ccfbf1;">
      <div class="card-title" style="color:#0f766e;">⚖️ InBody vs Fitdays 獨立偏差比對</div>
      <div id="fitdaysDiffReport" style="font-size:0.85rem; line-height: 1.6; color:#134e4a;">計算比對中...</div>
    </div>

    <!-- Fitdays 歷史紀錄卡 -->
    <div class="card">
      <div class="card-title">🟦 Fitdays 歷史體態紀錄</div>
      <div id="fitdaysLogList"></div>
      <div class="pagination-box" id="fitdaysPagination"></div>
    </div>
  `;
}

// 2. 品牌切換邏輯
function switchScaleBrand(brand) {
  const zeppBlock = document.getElementById('zeppScaleBlock');
  const fitdaysBlock = document.getElementById('fitdaysScaleContainer');
  const btnZepp = document.getElementById('btnBrandZepp');
  const btnFitdays = document.getElementById('btnBrandFitdays');

  if (brand === 'zepp') {
    if (zeppBlock) zeppBlock.style.display = 'block';
    if (fitdaysBlock) fitdaysBlock.style.display = 'none';
    if (btnZepp) { btnZepp.style.background = '#0284c7'; btnZepp.style.color = '#fff'; }
    if (btnFitdays) { btnFitdays.style.background = '#f1f5f9'; btnFitdays.style.color = '#475569'; }
    if (typeof renderScaleChart === 'function') renderScaleChart();
    if (typeof renderComparisonAnalysis === 'function') renderComparisonAnalysis();
  } else {
    if (zeppBlock) zeppBlock.style.display = 'none';
    if (fitdaysBlock) fitdaysBlock.style.display = 'block';
    if (btnZepp) { btnZepp.style.background = '#f1f5f9'; btnZepp.style.color = '#475569'; }
    if (btnFitdays) { btnFitdays.style.background = '#0d9488'; btnFitdays.style.color = '#fff'; }
    renderFitdaysList();
    renderFitdaysComparisonAnalysis();
    renderFitdaysChart();
  }
}

function compressFitdaysImage(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = function(e) {
      const img = new Image();
      img.onload = function() {
        let w = img.width, h = img.height;
        if (w > 1000) {
          h = Math.round((h * 1000) / w);
          w = 1000;
        }
        const canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, w, h);
        const dataUrl = canvas.toDataURL('image/jpeg', 0.70);
        resolve({ dataUrl: dataUrl, base64: dataUrl.split(',')[1] });
      };
      img.onerror = reject;
      img.src = e.target.result;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

async function previewAndAnalyzeFitdays(input) {
  const file = input.files[0];
  if (file) {
    try {
      const res = await compressFitdaysImage(file);
      const preview = document.getElementById('fitdaysImagePreview');
      preview.src = res.dataUrl;
      preview.style.display = 'block';
      base64FitdaysImage = res.base64;
      document.getElementById('fitdaysAiBtn').style.display = 'block';
    } catch(e) {
      console.error(e);
    }
  }
}

async function analyzeFitdaysImage() {
  let apiKey = (typeof getActiveApiKey === 'function') ? getActiveApiKey() : localStorage.getItem('gemini_api_key');
  if (!apiKey) {
    if (typeof openKeyModal === 'function') openKeyModal();
    return alert('請先設定 Gemini API Key！');
  }

  const aiBtn = document.getElementById('fitdaysAiBtn');
  aiBtn.disabled = true;
  aiBtn.innerText = '⚡ AI 辨識 Fitdays 報告中...';

  const promptText = `請嚴格分析 Fitdays 人體成分分析報告截圖並回傳純 JSON：
{"date":"YYYY-MM-DD(預設2026)","time":"HH:mm","weight":數字,"fat_pct":數字,"fat_kg":數字,"muscle_kg":數字,"smm_kg":數字,"water_kg":數字,"protein_kg":數字,"bone_kg":數字,"bmi":數字,"vfl":數字,"bmr":數字,"score":數字}`;

  try {
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-3.6-flash:generateContent?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{
          parts: [
            { text: promptText },
            { inlineData: { mimeType: "image/jpeg", data: base64FitdaysImage } }
          ]
        }],
        generationConfig: { responseMimeType: "application/json" }
      })
    });
    const resData = await response.json();
    if (resData.error) throw new Error(resData.error.message);

    let rawText = resData.candidates[0].content.parts[0].text.trim();
    const jsonMatch = rawText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error('模型未回傳有效的 JSON 格式');
    const res = JSON.parse(jsonMatch[0]);

    if (res.date) document.getElementById('fdDate').value = String(res.date).replace(/\//g, '-').slice(0, 10);
    if (res.time) {
      let tStr = String(res.time).trim();
      if (tStr.length === 4 && tStr.indexOf(':') === 1) tStr = '0' + tStr;
      document.getElementById('fdTime').value = tStr;
    }

    const setVal = (id, val) => {
      const el = document.getElementById(id);
      if (el && val !== undefined && val !== null && val !== '') el.value = val;
    };

    setVal('fdWeight', res.weight);
    setVal('fdFatPct', res.fat_pct);
    setVal('fdFatKg', res.fat_kg);
    setVal('fdMuscle', res.muscle_kg);
    setVal('fdSMM', res.smm_kg);
    setVal('fdWater', res.water_kg);
    setVal('fdProtein', res.protein_kg);
    setVal('fdBone', res.bone_kg);
    setVal('fdBMI', res.bmi);
    setVal('fdVFL', res.vfl);
    setVal('fdBMR', res.bmr);
    setVal('fdScore', res.score);

    alert(`✨ Fitdays 辨識成功！\n日期：${res.date || ''} ${res.time || ''}\n體重：${res.weight || 0}kg ｜ 體脂：${res.fat_pct || 0}%\n骨骼肌：${res.smm_kg || 0}kg ｜ 評分：${res.score || 0}分`);
  } catch (err) {
    alert('辨識失敗：' + err.message);
  } finally {
    aiBtn.disabled = false;
    aiBtn.innerText = '✨ 開始 AI 辨識 Fitdays 數據';
  }
}

function saveFitdaysData() {
  const dateVal = document.getElementById('fdDate').value;
  const timeVal = document.getElementById('fdTime').value || '08:00';
  const weightVal = parseFloat(document.getElementById('fdWeight').value);
  if (!weightVal) return alert('請輸入 Fitdays 的「體重」數值！');

  const item = {
    date: dateVal,
    time: timeVal,
    weight: weightVal,
    fat_pct: parseFloat(document.getElementById('fdFatPct').value) || 0,
    fat_kg: parseFloat(document.getElementById('fdFatKg').value) || 0,
    muscle_kg: parseFloat(document.getElementById('fdMuscle').value) || 0,
    smm_kg: parseFloat(document.getElementById('fdSMM').value) || 0,
    water_kg: parseFloat(document.getElementById('fdWater').value) || 0,
    protein_kg: parseFloat(document.getElementById('fdProtein').value) || 0,
    bone_kg: parseFloat(document.getElementById('fdBone').value) || 0,
    bmi: parseFloat(document.getElementById('fdBMI').value) || 0,
    vfl: parseInt(document.getElementById('fdVFL').value) || 0,
    bmr: parseInt(document.getElementById('fdBMR').value) || 0,
    score: parseInt(document.getElementById('fdScore').value) || 0
  };

  let list = window.MojoState.fitdaysLogs || [];
  list = list.filter(s => !(s.date === dateVal && (s.time || '') === timeVal));
  list.push(item);
  list.sort((a,b) => new Date(`${a.date} ${a.time || '00:00'}`) - new Date(`${b.date} ${b.time || '00:00'}`));

  window.MojoState.fitdaysLogs = list;
  localStorage.setItem('my_fitdays_logs', JSON.stringify(list));
  if (typeof uploadToCloud === 'function') uploadToCloud('FITDAYS', item);

  document.getElementById('fitdaysImage').value = '';
  document.getElementById('fitdaysImagePreview').style.display = 'none';
  document.getElementById('fitdaysAiBtn').style.display = 'none';

  alert(`Fitdays 數據 (${dateVal} ${timeVal}) 已儲存！`);
  renderFitdaysList();
  renderFitdaysComparisonAnalysis();
  renderFitdaysChart();
}

function deleteFitdaysLog(uniqueId) {
  if (confirm('確定要刪除這筆 Fitdays 體脂計紀錄嗎？')) {
    let list = window.MojoState.fitdaysLogs || [];
    list = list.filter(s => `${s.date}_${s.time || ''}` !== uniqueId);
    window.MojoState.fitdaysLogs = list;
    localStorage.setItem('my_fitdays_logs', JSON.stringify(list));
    renderFitdaysList();
    renderFitdaysComparisonAnalysis();
    renderFitdaysChart();
  }
}

function changeFitdaysPage(delta) {
  fitdaysCurrentPage += delta;
  renderFitdaysList();
}

function renderFitdaysList() {
  const container = document.getElementById('fitdaysLogList');
  const paginationContainer = document.getElementById('fitdaysPagination');
  if (!container) return;

  const curLogs = (window.MojoState.fitdaysLogs || []).slice().reverse();
  const totalCount = curLogs.length;
  const totalPages = Math.max(1, Math.ceil(totalCount / FITDAYS_PAGE_SIZE));

  if (fitdaysCurrentPage > totalPages) fitdaysCurrentPage = totalPages;
  if (fitdaysCurrentPage < 1) fitdaysCurrentPage = 1;

  const start = (fitdaysCurrentPage - 1) * FITDAYS_PAGE_SIZE;
  const pageItems = curLogs.slice(start, start + FITDAYS_PAGE_SIZE);

  let html = '';
  pageItems.forEach(s => {
    const timeTag = s.time ? ` <span style="color:#0d9488;font-weight:bold;">${s.time}</span>` : '';
    const uniqueId = `${s.date}_${s.time || ''}`;

    html += `<div class="log-item">
      <div class="log-info">
        <strong style="color:#0f766e;">體重 ${s.weight} kg</strong> (體脂 ${s.fat_pct}%) ｜ <strong>骨骼肌 ${s.smm_kg || '--'} kg</strong> ｜ 評分: ${s.score || '--'}分<br>
        <small style="color:var(--sub)">${s.date}${timeTag} ｜ 肌肉量 ${s.muscle_kg}kg ｜ 水分 ${s.water_kg}L ｜ 內臟 ${s.vfl} ｜ 代謝 ${s.bmr}kcal</small>
      </div>
      <div class="log-actions">
        <button class="action-btn btn-del" type="button" onclick="deleteFitdaysLog('${uniqueId}')">刪除</button>
      </div>
    </div>`;
  });

  container.innerHTML = html || '<p style="color:var(--sub);text-align:center;padding:10px;">尚未有 Fitdays 體脂紀錄</p>';

  if (paginationContainer) {
    if (totalCount > FITDAYS_PAGE_SIZE) {
      paginationContainer.style.display = 'flex';
      paginationContainer.innerHTML = `
        <button class="pagination-btn" type="button" ${fitdaysCurrentPage === 1 ? 'disabled' : ''} onclick="changeFitdaysPage(-1)">◀ 上一頁</button>
        <span style="font-size:0.8rem;color:var(--sub);">第 ${fitdaysCurrentPage} / ${totalPages} 頁 (共 ${totalCount} 筆)</span>
        <button class="pagination-btn" type="button" ${fitdaysCurrentPage === totalPages ? 'disabled' : ''} onclick="changeFitdaysPage(1)">下一頁 ▶</button>
      `;
    } else {
      paginationContainer.style.display = 'none';
    }
  }
}

// 3. 專屬趨勢折線圖渲染
function renderFitdaysChart() {
  const canvas = document.getElementById('fitdaysChart');
  if (!canvas) return;

  const logs = (window.MojoState.fitdaysLogs || []).slice().sort((a,b) => new Date(`${a.date} ${a.time||'00:00'}`) - new Date(`${b.date} ${b.time||'00:00'}`));
  if (logs.length === 0) {
    if (fitdaysChartInstance) fitdaysChartInstance.destroy();
    return;
  }

  const labels = logs.map(s => {
    const md = s.date.slice(5);
    const t = s.time ? ` ${s.time}` : '';
    return `${md}${t}`;
  });

  const weightData = logs.map(s => s.weight);
  const smmData = logs.map(s => s.smm_kg || null);
  const fatData = logs.map(s => s.fat_pct || null);

  if (fitdaysChartInstance) fitdaysChartInstance.destroy();

  fitdaysChartInstance = new Chart(canvas, {
    type: 'line',
    data: {
      labels: labels,
      datasets: [
        {
          label: '體重 (kg)',
          data: weightData,
          borderColor: '#0284c7',
          backgroundColor: 'rgba(2,132,199,0.1)',
          borderWidth: 2.5,
          tension: 0.2,
          yAxisID: 'yLeft'
        },
        {
          label: '骨骼肌 (kg)',
          data: smmData,
          borderColor: '#059669',
          backgroundColor: 'transparent',
          borderWidth: 2,
          borderDash: [3, 3],
          tension: 0.2,
          yAxisID: 'yLeft'
        },
        {
          label: '體脂率 (%)',
          data: fatData,
          borderColor: '#d97706',
          backgroundColor: 'transparent',
          borderWidth: 2,
          tension: 0.2,
          yAxisID: 'yRight'
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: { mode: 'index', intersect: false },
      plugins: {
        legend: { position: 'top', labels: { boxWidth: 12, font: { size: 11 } } }
      },
      scales: {
        yLeft: {
          type: 'linear',
          position: 'left',
          title: { display: true, text: '體重 / 骨骼肌 (kg)' },
          grid: { color: '#f1f5f9' }
        },
        yRight: {
          type: 'linear',
          position: 'right',
          title: { display: true, text: '體脂率 (%)' },
          grid: { drawOnChartArea: false }
        }
      }
    }
  });
}

// 4. 獨立偏差比對 + 猛健樂週期 InBody 結算預測卡片
function renderFitdaysComparisonAnalysis() {
  const el = document.getElementById('fitdaysDiffReport');
  if (!el) return;

  const fitdays = window.MojoState.fitdaysLogs || [];
  const bodies = window.MojoState.bodyLogs || [];
  const shots = window.MojoState.shotLogs || [];

  if (!fitdays.length || !bodies.length) {
    el.innerHTML = '💡 累積至少 1 筆 InBody 與 1 筆 Fitdays 數據後，將在此自動產出獨立偏差校正與對比分析。';
    return;
  }

  // 同日比對組
  let pairs = [];
  fitdays.forEach(f => {
    const matchedBody = bodies.find(b => b.date === f.date);
    if (matchedBody) pairs.push({ date: f.date, fd: f, inbody: matchedBody });
  });

  let html = '';
  let globalDiffW = -0.40, globalDiffFat = 1.8, globalDiffSMM = -1.2;

  if (pairs.length > 0) {
    let diffWTotal = 0, diffFatTotal = 0, diffSMMTotal = 0, countSMM = 0;
    pairs.forEach(p => {
      diffWTotal += (p.fd.weight - p.inbody.weight);
      diffFatTotal += (p.fd.fat_pct - p.inbody.pbf);
      if (p.fd.smm_kg && p.inbody.smm) {
        diffSMMTotal += (p.fd.smm_kg - p.inbody.smm);
        countSMM++;
      }
    });

    const avgW = (diffWTotal / pairs.length).toFixed(2);
    const avgF = (diffFatTotal / pairs.length).toFixed(2);
    const avgM = countSMM > 0 ? (diffSMMTotal / countSMM).toFixed(2) : '-1.20';
    globalDiffW = parseFloat(avgW);
    globalDiffFat = parseFloat(avgF);
    globalDiffSMM = parseFloat(avgM);

    html += `<strong>🎯 找到 ${pairs.length} 組同日測量對比數據：</strong><br>`;
    html += `• 體重偏差：Fitdays 平均比 InBody <strong>${avgW >= 0 ? '+' + avgW : avgW} kg</strong><br>`;
    html += `• 體脂率偏差：Fitdays 平均比 InBody <strong>${avgF >= 0 ? '+' + avgF : avgF} %</strong><br>`;
    html += `• 骨骼肌偏差：Fitdays 平均比 InBody <strong>${avgM >= 0 ? '+' + avgM : avgM} kg</strong><br>`;
  } else {
    const latestFd = fitdays[fitdays.length - 1];
    const latestBody = bodies[bodies.length - 1];
    const wDiff = (latestFd.weight - latestBody.weight).toFixed(1);
    html += `<strong>🔍 最新數據橫向比較：</strong><br>`;
    html += `• Fitdays最新 (${latestFd.date})：${latestFd.weight} kg ｜ InBody最新：${latestBody.weight} kg<br>`;
    html += `• 當前落差：<strong>${wDiff >= 0 ? '+' + wDiff : wDiff} kg</strong><br>`;
  }

  // 猛健樂本週週期 InBody 結算預測卡片
  if (shots.length > 0) {
    const latestShot = shots[0]; // shots 已按日期新到舊排序
    const shotDateObj = new Date(latestShot.date);
    const nextDateObj = new Date(shotDateObj);
    nextDateObj.setDate(nextDateObj.getDate() + 7);

    const yNext = nextDateObj.getFullYear();
    const mNext = String(nextDateObj.getMonth() + 1).padStart(2, '0');
    const dNext = String(nextDateObj.getDate()).padStart(2, '0');
    const nextShotDateStr = `${yNext}-${mNext}-${dNext}`;

    // 篩選本週期 Fitdays 數據
    const cycleFds = fitdays.filter(f => f.date >= latestShot.date && f.date <= nextShotDateStr);
    
    let predW = '80.5', predFat = '22.8', predSMM = '35.3', weeklyChange = '-0.40', endpointW = '80.7';

    if (cycleFds.length > 0) {
      const curLatest = cycleFds[cycleFds.length - 1];
      const daysRemaining = Math.max(0, Math.round((nextDateObj - new Date(curLatest.date)) / (1000 * 60 * 60 * 24)));
      
      let slope = -0.12;
      if (cycleFds.length >= 2) {
        const first = cycleFds[0];
        const daysPassed = Math.max(1, (new Date(curLatest.date) - new Date(first.date)) / (1000 * 60 * 60 * 24));
        slope = (curLatest.weight - first.weight) / daysPassed;
      }
      weeklyChange = (slope * 7).toFixed(2);

      // 端點動能與預測體重
      const projFdW = curLatest.weight + (slope * daysRemaining);
      endpointW = (projFdW - globalDiffW).toFixed(1);
      predW = (projFdW - globalDiffW).toFixed(1);

      // 體脂率與骨骼肌預測
      const projFdFat = curLatest.fat_pct + ((slope * 0.18) * daysRemaining);
      predFat = (projFdFat - globalDiffFat).toFixed(1);

      if (curLatest.smm_kg) {
        predSMM = (curLatest.smm_kg - globalDiffSMM).toFixed(1);
      }
    }

    html += `
      <div style="margin-top: 10px; padding: 10px; background: #ffffff; border-radius: 8px; border: 1px solid #99f6e4;">
        <div style="font-weight: bold; color: #0f766e; font-size: 0.84rem; margin-bottom: 4px;">
          🔮 本週猛健樂週期結算預測 (${latestShot.date} ～ ${nextShotDateStr})
        </div>
        <div style="font-size: 0.8rem; color: #334155; line-height: 1.6;">
          • 預測 InBody 體重：<strong style="color:#0f766e; font-size:0.92rem;">${predW} kg</strong> <span style="font-size:0.75rem; color:#64748b;">(端點動能：${endpointW} kg)</span><br>
          • 預測 InBody 體脂：<strong style="color:#d97706;">${predFat} %</strong> ｜ 骨骼肌：<strong style="color:#059669;">${predSMM} kg</strong><br>
          • 週期變化率：每週預估 <strong>${weeklyChange} kg</strong>
        </div>
      </div>
    `;
  }

  el.innerHTML = html;
}
