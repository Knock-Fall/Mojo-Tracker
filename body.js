// Mojo Project
// 5. body.js (MK-80975: InBody 全方位數據輸入、AI 辨識與歷史體態紀錄)

let base64InBodyImage = '';

function compressInBodyImage(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = function(e) {
      const img = new Image();
      img.onload = function() {
        let w = img.width, h = img.height;
        if (w > 1200) {
          h = Math.round((h * 1200) / w);
          w = 1200;
        }
        const canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, w, h);
        const dataUrl = canvas.toDataURL('image/jpeg', 0.72);
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
      const res = await compressInBodyImage(file);
      const preview = document.getElementById('inbodyImagePreview');
      preview.src = res.dataUrl;
      preview.style.display = 'block';
      base64InBodyImage = res.base64;
      document.getElementById('inbodyAiBtn').style.display = 'block';
    } catch(e) {
      console.error(e);
    }
  }
}

async function analyzeInBodyImage() {
  let apiKey = (typeof getActiveApiKey === 'function') ? getActiveApiKey() : localStorage.getItem('gemini_api_key');
  if (!apiKey) {
    if (typeof openKeyModal === 'function') openKeyModal();
    return alert('請先設定 Gemini API Key！');
  }

  const aiBtn = document.getElementById('inbodyAiBtn');
  aiBtn.disabled = true;
  aiBtn.innerText = '⚡ AI 辨識 InBody 中...';

  const promptText = `請嚴格辨識 InBody 報告紙並回傳純 JSON：
{"date":"YYYY-MM-DD","weight":數字,"tbw":數字,"protein":數字,"minerals":數字,"smm":數字,"bfm":數字,"bmi":數字,"pbf":數字,"whr":數字,"vfl":數字,"segments":{"m_ra_kg":數字,"m_ra_pct":數字,"m_la_kg":數字,"m_la_pct":數字,"m_tr_kg":數字,"m_tr_pct":數字,"m_rl_kg":數字,"m_rl_pct":數字,"m_ll_kg":數字,"m_ll_pct":數字,"f_ra_kg":數字,"f_ra_pct":數字,"f_la_kg":數字,"f_la_pct":數字,"f_tr_kg":數字,"f_tr_pct":數字,"f_rl_kg":數字,"f_rl_pct":數字,"f_ll_kg":數字,"f_ll_pct":數字}}`;

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
        generationConfig: { responseMimeType: "application/json" }
      })
    });
    const resData = await response.json();
    if (resData.error) throw new Error(resData.error.message);

    let rawText = resData.candidates[0].content.parts[0].text.trim();
    const jsonMatch = rawText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error('模型未回傳有效的 JSON 格式');
    const res = JSON.parse(jsonMatch[0]);

    if (res.date) document.getElementById('bodyDate').value = String(res.date).replace(/\//g, '-').slice(0, 10);

    const setVal = (id, val) => {
      const el = document.getElementById(id);
      if (el && val !== undefined && val !== null && val !== '') el.value = val;
    };

    setVal('bodyWeight', res.weight);
    setVal('bodyTBW', res.tbw);
    setVal('bodyProtein', res.protein);
    setVal('bodyMinerals', res.minerals);
    setVal('bodySMM', res.smm);
    setVal('bodyBFM', res.bfm);
    setVal('bodyBMI', res.bmi);
    setVal('bodyPBF', res.pbf);
    setVal('bodyWHR', res.whr);
    setVal('bodyVFL', res.vfl);

    if (res.segments) {
      setVal('m_ra_kg', res.segments.m_ra_kg);
      setVal('m_ra_pct', res.segments.m_ra_pct);
      setVal('m_la_kg', res.segments.m_la_kg);
      setVal('m_la_pct', res.segments.m_la_pct);
      setVal('m_tr_kg', res.segments.m_tr_kg);
      setVal('m_tr_pct', res.segments.m_tr_pct);
      setVal('m_rl_kg', res.segments.m_rl_kg);
      setVal('m_rl_pct', res.segments.m_rl_pct);
      setVal('m_ll_kg', res.segments.m_ll_kg);
      setVal('m_ll_pct', res.segments.m_ll_pct);

      setVal('f_ra_kg', res.segments.f_ra_kg);
      setVal('f_ra_pct', res.segments.f_ra_pct);
      setVal('f_la_kg', res.segments.f_la_kg);
      setVal('f_la_pct', res.segments.f_la_pct);
      setVal('f_tr_kg', res.segments.f_tr_kg);
      setVal('f_tr_pct', res.segments.f_tr_pct);
      setVal('f_rl_kg', res.segments.f_rl_kg);
      setVal('f_rl_pct', res.segments.f_rl_pct);
      setVal('f_ll_kg', res.segments.f_ll_kg);
      setVal('f_ll_pct', res.segments.f_ll_pct);
    }

    alert(`✨ InBody 辨識成功！\n日期：${res.date || ''}\n體重：${res.weight || 0}kg ｜ 體脂：${res.pbf || 0}%\n骨骼肌：${res.smm || 0}kg`);
  } catch (err) {
    alert('辨識失敗：' + err.message);
  } finally {
    aiBtn.disabled = false;
    aiBtn.innerText = '✨ 開始 AI 辨識 InBody 數據';
  }
}

function saveBodyData() {
  const dateVal = document.getElementById('bodyDate').value;
  const weightVal = parseFloat(document.getElementById('bodyWeight').value);
  if (!dateVal || !weightVal) return alert('請至少填寫日期與體重');

  const item = {
    date: dateVal,
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
    segments: {
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
    }
  };

  let list = window.MojoState.bodyLogs || [];
  list = list.filter(b => b.date !== dateVal);
  list.push(item);
  list.sort((a, b) => new Date(a.date) - new Date(b.date));

  window.MojoState.bodyLogs = list;
  localStorage.setItem('my_body_logs', JSON.stringify(list));
  if (typeof uploadToCloud === 'function') uploadToCloud('BODY', item);

  document.getElementById('inbodyImage').value = '';
  document.getElementById('inbodyImagePreview').style.display = 'none';
  document.getElementById('inbodyAiBtn').style.display = 'none';

  alert(`InBody 數據 (${dateVal}) 已成功儲存！`);
  renderBodyList();
  if (typeof renderChart === 'function') renderChart();
  if (typeof renderComparisonAnalysis === 'function') renderComparisonAnalysis();
  if (typeof renderFitdaysComparisonAnalysis === 'function') renderFitdaysComparisonAnalysis();
  if (typeof renderShotList === 'function') renderShotList();
}

function deleteBodyLog(date) {
  if (confirm(`確定要刪除 ${date} 的 InBody 紀錄嗎？`)) {
    let list = window.MojoState.bodyLogs || [];
    list = list.filter(b => b.date !== date);
    window.MojoState.bodyLogs = list;
    localStorage.setItem('my_body_logs', JSON.stringify(list));
    renderBodyList();
    if (typeof renderChart === 'function') renderChart();
    if (typeof renderComparisonAnalysis === 'function') renderComparisonAnalysis();
    if (typeof renderFitdaysComparisonAnalysis === 'function') renderFitdaysComparisonAnalysis();
    if (typeof renderShotList === 'function') renderShotList();
  }
}

function renderBodyList() {
  const container = document.getElementById('bodyLogList');
  if (!container) return;

  const logs = (window.MojoState.bodyLogs || []).slice().reverse();
  let html = '';

  logs.forEach(b => {
    html += `<div class="log-item">
      <div class="log-info">
        <strong>${b.date} ｜ 體重: ${b.weight} kg</strong> (骨骼肌: ${b.smm}kg, 體脂: ${b.pbf}%)<br>
        <small style="color:var(--sub)">水分: ${b.tbw}L ｜ 蛋白質: ${b.protein}kg ｜ 脂肪重: ${b.bfm}kg ｜ 內臟: ${b.vfl}</small>
      </div>
      <div class="log-actions">
        <button class="action-btn btn-del" type="button" onclick="deleteBodyLog('${b.date}')">刪除</button>
      </div>
    </div>`;
  });

  container.innerHTML = html || '<p style="color:var(--sub);text-align:center;padding:10px;">尚未有 InBody 數據</p>';
}
