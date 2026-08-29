// Mojo Project
// 6. body.js
let base64InBodyImage = '';

function compressInBodyImage(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = function(e) {
      const img = new Image();
      img.onload = function() {
        let w = img.width, h = img.height;
        if (w > 800) {
          h = Math.round((h * 800) / w);
          w = 800;
        }
        const canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, w, h);
        const dataUrl = canvas.toDataURL('image/jpeg', 0.65);
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
      const compressed = await compressInBodyImage(file);
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
  let apiKey = (typeof getActiveApiKey === 'function') ? getActiveApiKey() : localStorage.getItem('gemini_api_key');
  if (!apiKey) {
    setupApiKey();
    apiKey = (typeof getActiveApiKey === 'function') ? getActiveApiKey() : localStorage.getItem('gemini_api_key');
    if (!apiKey) return alert('未輸入 API Key，無法進行分析');
  }

  const aiBtn = document.getElementById('inbodyAiBtn');
  aiBtn.disabled = true;
  aiBtn.innerText = '⚡ AI 辨識分析中...';

  const promptText = `請分析 InBody 報告圖片，僅回傳純 JSON：
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
        }]
      })
    });
    const resData = await response.json();
    if (resData.error) throw new Error(resData.error.message);

    let rawText = resData.candidates[0].content.parts[0].text.trim().replace(/```json/g, '').replace(/```/g, '').trim();
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
    alert('⚡ InBody 報告辨識完成！');
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
  
  if (typeof renderBodyChart === 'function') renderBodyChart();
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
  
  if (typeof renderBodyChart === 'function') renderBodyChart();
  renderBodyList();
  if (typeof renderComparisonAnalysis === 'function') renderComparisonAnalysis();
  if (typeof renderDiet === 'function') renderDiet();
}

function deleteBodyLog(date) {
  if (confirm(`確定要刪除 ${date} 的體態紀錄嗎？`)) {
    const list = window.MojoState.bodyLogs || [];
    window.MojoState.bodyLogs = list.filter(b => b.date !== date);
    localStorage.setItem('my_body_logs', JSON.stringify(window.MojoState.bodyLogs));
    
    if (typeof renderBodyChart === 'function') renderBodyChart();
    renderBodyList();
    if (typeof renderComparisonAnalysis === 'function') renderComparisonAnalysis();
    if (typeof renderDiet === 'function') renderDiet();
  }
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
