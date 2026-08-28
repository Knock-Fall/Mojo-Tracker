// Mojo Project
// 6. diet.js
let base64DietImage = '';

function changeDietDateBy(offsetDays) {
  const input = document.getElementById('dietDate');
  if (!input) return;
  const cur = input.value ? new Date(input.value) : new Date();
  cur.setDate(cur.getDate() + offsetDays);
  const y = cur.getFullYear();
  const m = String(cur.getMonth() + 1).padStart(2, '0');
  const d = String(cur.getDate()).padStart(2, '0');
  input.value = `${y}-${m}-${d}`;
  renderDiet();
}

function resetDietDateToToday() {
  const input = document.getElementById('dietDate');
  if (input) {
    input.value = getLocalTodayStr();
    renderDiet();
  }
}

function previewAndAnalyze(input) {
  const file = input.files[0];
  if (file) {
    const reader = new FileReader();
    reader.onload = function(e) {
      const preview = document.getElementById('imagePreview');
      preview.src = e.target.result;
      preview.style.display = 'block';
      base64DietImage = e.target.result.split(',')[1];
      document.getElementById('aiHintBox').style.display = 'block';
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

  const userHint = document.getElementById('aiHintText').value.trim();
  let hintPrompt = "";
  if (userHint) {
    hintPrompt = `\n使用者特別提示食物名稱與份量為：「${userHint}」，請務必依此作為主要依據並結合照片估算。`;
  }

  const promptText = `你是一位專業營養師。請分析這張食物照片，繁體中文命名食物，並嚴格預估五大營養素：熱量(kcal)、蛋白質(g)、碳水化合物(g)、脂肪(g)、膳食纖維(g)。${hintPrompt}
請注意：所有欄位都必須給予合理預估數值（數字型態），絕不可缺漏 fat 或 fiber。
嚴格僅回傳如下 JSON 格式，切勿加上額外文字：
{"food": "食物名稱與份量", "cal": 450, "pro": 25.5, "carbs": 35.0, "fat": 15.0, "fiber": 3.5}`;

  try {
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contents: [{ parts: [{ text: promptText }, { inlineData: { mimeType: "image/jpeg", data: base64DietImage } }] }] })
    });
    const resData = await response.json();
    if (resData.error) throw new Error(resData.error.message);

    let rawText = resData.candidates[0].content.parts[0].text.trim().replace(/```json/g, '').replace(/```/g, '').trim();
    const result = JSON.parse(rawText);

    document.getElementById('dietContent').value = result.food || userHint || '';
    document.getElementById('dietCal').value = result.cal ?? 0;
    document.getElementById('dietPro').value = result.pro ?? 0;
    document.getElementById('dietCarbs').value = result.carbs ?? 0;
    document.getElementById('dietFat').value = result.fat ?? 0;
    document.getElementById('dietFiber').value = result.fiber ?? 0;

    alert('✨ AI 估算完成！已自動填入熱量、蛋白質、碳水、脂肪與纖維。');
  } catch (err) {
    alert('分析失敗：' + err.message);
  } finally {
    aiBtn.disabled = false;
    aiBtn.innerText = '✨ 開始 AI 分析熱量與五大營養';
  }
}

function saveDiet() {
  const queryDate = document.getElementById('dietDate').value;
  const d = {
    date: queryDate,
    type: document.getElementById('dietType').value,
    content: document.getElementById('dietContent').value,
    cal: parseInt(document.getElementById('dietCal').value) || 0,
    pro: parseFloat(document.getElementById('dietPro').value) || 0,
    carbs: parseFloat(document.getElementById('dietCarbs').value) || 0,
    fat: parseFloat(document.getElementById('dietFat').value) || 0,
    fiber: parseFloat(document.getElementById('dietFiber').value) || 0
  };
  if(!d.content) return alert('請輸入食物內容');
  
  const list = window.MojoState.dietLogs || [];
  list.unshift(d);
  window.MojoState.dietLogs = list;
  localStorage.setItem('my_diet_logs', JSON.stringify(list));
  uploadToCloud('DIET', d);

  document.getElementById('dietContent').value = '';
  document.getElementById('dietCal').value = '';
  document.getElementById('dietPro').value = '';
  document.getElementById('dietCarbs').value = '';
  document.getElementById('dietFat').value = '';
  document.getElementById('dietFiber').value = '';
  document.getElementById('foodImage').value = '';
  document.getElementById('aiHintText').value = '';
  document.getElementById('aiHintBox').style.display = 'none';
  document.getElementById('imagePreview').style.display = 'none';
  document.getElementById('aiBtn').style.display = 'none';

  renderDiet();
  alert(`餐點已成功加入 ${queryDate} 的紀錄！`);
}

function editDiet(index) {
  const list = window.MojoState.dietLogs || [];
  const item = list[index];
  if (!item) return;

  const newType = prompt('修改餐別（早餐、午餐、晚餐、點心/補充）：', item.type || '午餐');
  if (newType === null) return;
  const newContent = prompt('修改食物名稱：', item.content || '');
  if (newContent === null) return;
  const newCal = prompt('修改熱量 (kcal)：', item.cal || 0);
  if (newCal === null) return;
  const newPro = prompt('修改蛋白質 (g)：', item.pro || 0);
  if (newPro === null) return;
  const newCarbs = prompt('修改碳水化合物 (g)：', item.carbs || 0);
  if (newCarbs === null) return;
  const newFat = prompt('修改脂肪 (g)：', item.fat || 0);
  if (newFat === null) return;
  const newFiber = prompt('修改膳食纖維 (g)：', item.fiber || 0);
  if (newFiber === null) return;

  list[index].type = newType.trim();
  list[index].content = newContent.trim();
  list[index].cal = parseInt(newCal) || 0;
  list[index].pro = parseFloat(newPro) || 0;
  list[index].carbs = parseFloat(newCarbs) || 0;
  list[index].fat = parseFloat(newFat) || 0;
  list[index].fiber = parseFloat(newFiber) || 0;

  localStorage.setItem('my_diet_logs', JSON.stringify(list));
  uploadToCloud('DIET', list[index]);
  renderDiet();
}

function deleteDiet(index) {
  if (confirm('確定要刪除這筆飲食紀錄嗎？')) {
    const list = window.MojoState.dietLogs || [];
    list.splice(index, 1);
    localStorage.setItem('my_diet_logs', JSON.stringify(list));
    renderDiet();
  }
}

function addWaterRecord(type, amount) {
  const queryDate = document.getElementById('dietDate').value;
  if (!window.MojoState.waterLogs) window.MojoState.waterLogs = {};
  if (!window.MojoState.waterLogs[queryDate] || typeof window.MojoState.waterLogs[queryDate] !== 'object') {
    const oldVal = typeof window.MojoState.waterLogs[queryDate] === 'number' ? window.MojoState.waterLogs[queryDate] : 0;
    window.MojoState.waterLogs[queryDate] = { pure: oldVal, tea: 0 };
  }

  if (type === 'pure') {
    window.MojoState.waterLogs[queryDate].pure = (Number(window.MojoState.waterLogs[queryDate].pure) || 0) + amount;
  } else {
    window.MojoState.waterLogs[queryDate].tea = (Number(window.MojoState.waterLogs[queryDate].tea) || 0) + amount;
  }

  localStorage.setItem('my_water_logs', JSON.stringify(window.MojoState.waterLogs));
  uploadToCloud('WATER', { date: queryDate, data: window.MojoState.waterLogs[queryDate] });
  renderDiet();
}

function resetWaterRecord() {
  const queryDate = document.getElementById('dietDate').value;
  if (confirm(`確定要將 ${queryDate} 的純水與茶飲水分紀錄歸零嗎？`)) {
    if (!window.MojoState.waterLogs) window.MojoState.waterLogs = {};
    window.MojoState.waterLogs[queryDate] = { pure: 0, tea: 0 };
    localStorage.setItem('my_water_logs', JSON.stringify(window.MojoState.waterLogs));
    uploadToCloud('WATER', { date: queryDate, data: { pure: 0, tea: 0 } });
    renderDiet();
  }
}

function renderDiet() {
  const dietDateInput = document.getElementById('dietDate');
  if (!dietDateInput) return;
  const queryDate = dietDateInput.value;
  const list = document.getElementById('dietLogList');
  
  let totalC = 0, totalP = 0, totalCarbs = 0, totalFat = 0, totalFiber = 0, html = '';
  const curDiets = window.MojoState.dietLogs || [];

  curDiets.forEach((item, originalIndex) => {
    const itemDate = String(item.date || '').replace(/\//g, '-');
    if (itemDate === queryDate) {
      const c = Number(item.cal) || 0;
      const p = Number(item.pro) || 0;
      const carbs = Number(item.carbs) || 0;
      const fat = Number(item.fat) || 0;
      const fiber = Number(item.fiber) || 0;
      totalC += c;
      totalP += p;
      totalCarbs += carbs;
      totalFat += fat;
      totalFiber += fiber;
      html += `<div class="log-item">
        <div class="log-info">
          <strong>[${item.type || '餐點'}] ${item.content || ''}</strong><br>
          <small style="color:var(--sub);">${c} kcal ｜ 蛋 ${p.toFixed(1)}g ｜ 碳 ${carbs.toFixed(1)}g ｜ 脂 ${fat.toFixed(1)}g ｜ 纖 ${fiber.toFixed(1)}g</small>
        </div>
        <div class="log-actions">
          <button class="action-btn btn-edit" type="button" onclick="editDiet(${originalIndex})">編輯</button>
          <button class="action-btn btn-del" type="button" onclick="deleteDiet(${originalIndex})">刪除</button>
        </div>
      </div>`;
    }
  });

  // 最新體重連動
  let latestWeight = 80;
  const scales = window.MojoState.scaleLogs || [];
  const bodies = window.MojoState.bodyLogs || [];
  if (scales.length > 0) {
    latestWeight = Number(scales[scales.length - 1].weight) || 80;
  } else if (bodies.length > 0) {
    latestWeight = Number(bodies[bodies.length - 1].weight) || 80;
  }

  const tdee = Math.round(latestWeight * 28);
  const targetCalories = tdee - 500;
  const targetProtein = Math.round(latestWeight * 1.6);
  const targetCarbs = Math.round(latestWeight * 2.0);
  const targetFat = Math.round(latestWeight * 0.6);
  const targetFiber = 28;
  const targetWater = Math.round(latestWeight * 35);
  const currentDeficit = tdee - totalC;

  // 1. 赤字看板
  const deficitCurEl = document.getElementById('deficitCurrent');
  const tdeeRefEl = document.getElementById('tdeeRef');
  const deficitStatusEl = document.getElementById('deficitStatus');

  if (deficitCurEl) deficitCurEl.innerText = (currentDeficit > 0 ? `-${currentDeficit}` : `+${Math.abs(currentDeficit)}`);
  if (tdeeRefEl) tdeeRefEl.innerText = `TDEE 消耗: ${tdee} kcal`;

  if (deficitStatusEl) {
    if (currentDeficit >= 400 && currentDeficit <= 600) {
      deficitStatusEl.innerText = '🎯 完美保肌燃脂赤字 (300~500kcal)';
      deficitStatusEl.style.color = '#059669';
    } else if (currentDeficit > 600) {
      deficitStatusEl.innerText = '⚠️ 赤字過大，注意補充足夠蛋白質';
      deficitStatusEl.style.color = '#d97706';
    } else if (currentDeficit > 0) {
      deficitStatusEl.innerText = '🌱 溫和赤字中 (進度良好)';
      deficitStatusEl.style.color = '#2563eb';
    } else {
      deficitStatusEl.innerText = '⛔ 熱量盈餘 (已超過今日消耗)';
      deficitStatusEl.style.color = '#dc2626';
    }
  }

  // 2. 雙軌水分進度
  const wLogs = window.MojoState.waterLogs || {};
  let dayWater = wLogs[queryDate] || { pure: 0, tea: 0 };
  if (typeof dayWater === 'number') dayWater = { pure: dayWater, tea: 0 };

  const pureW = Number(dayWater.pure) || 0;
  const teaW = Number(dayWater.tea) || 0;
  const totalW = pureW + teaW;

  const waterTotalEl = document.getElementById('waterTotalVal');
  const waterTargetEl = document.getElementById('waterTarget');
  if (waterTotalEl) waterTotalEl.innerText = totalW;
  if (waterTargetEl) waterTargetEl.innerText = targetWater;

  const purePct = Math.min(100, Math.round((pureW / targetWater) * 100));
  const teaPct = Math.min(100 - purePct, Math.round((teaW / targetWater) * 100));

  const pureProgEl = document.getElementById('pureWaterProgress');
  const teaProgEl = document.getElementById('teaWaterProgress');
  if (pureProgEl) pureProgEl.style.width = purePct + '%';
  if (teaProgEl) teaProgEl.style.width = teaPct + '%';

  const pureRatio = totalW > 0 ? Math.round((pureW / totalW) * 100) : 0;
  const waterBreakdownEl = document.getElementById('waterBreakdownTxt');
  if (waterBreakdownEl) {
    waterBreakdownEl.innerText = `純水: ${pureW} ml (${pureRatio}%) ｜ 茶/咖啡: ${teaW} ml`;
  }

  const ratioStatusEl = document.getElementById('waterRatioStatus');
  if (ratioStatusEl) {
    if (totalW === 0) {
      ratioStatusEl.innerText = '建議純水 ≥ 50%';
      ratioStatusEl.style.color = '#0369a1';
    } else if (pureRatio >= 50) {
      ratioStatusEl.innerText = '✅ 純水比例良好';
      ratioStatusEl.style.color = '#059669';
    } else {
      ratioStatusEl.innerText = '⚠️ 茶飲偏多，多補純水';
      ratioStatusEl.style.color = '#d97706';
    }
  }

  // 3. 熱量進度
  const calCurEl = document.getElementById('calCurrent');
  const calTarEl = document.getElementById('calTarget');
  const inbodyRefEl = document.getElementById('inbodyWeightRef');
  if (calCurEl) calCurEl.innerText = totalC;
  if (calTarEl) calTarEl.innerText = targetCalories;
  if (inbodyRefEl) inbodyRefEl.innerText = `依最新體重 ${latestWeight}kg 連動`;

  const calPct = Math.min(100, Math.round((totalC / targetCalories) * 100));
  const calProgEl = document.getElementById('calProgress');
  if (calProgEl) calProgEl.style.width = calPct + '%';

  const calDiff = targetCalories - totalC;
  const calRemEl = document.getElementById('calRemainTxt');
  if (calRemEl) {
    calRemEl.innerText = calDiff >= 0 ? `剩餘：${calDiff} kcal` : `超標：${Math.abs(calDiff)} kcal`;
    calRemEl.style.color = calDiff >= 0 ? 'var(--sub)' : '#ef4444';
  }

  // 4. 蛋白質進度
  const proCurEl = document.getElementById('proCurrent');
  const proTarEl = document.getElementById('proTarget');
  if (proCurEl) proCurEl.innerText = totalP.toFixed(1);
  if (proTarEl) proTarEl.innerText = targetProtein;

  const proPct = Math.min(100, Math.round((totalP / targetProtein) * 100));
  const proProgEl = document.getElementById('proProgress');
  if (proProgEl) proProgEl.style.width = proPct + '%';

  const proDiff = (targetProtein - totalP).toFixed(1);
  const proRemEl = document.getElementById('proRemainTxt');
  if (proRemEl) {
    proRemEl.innerText = proDiff >= 0 ? `剩餘：${proDiff} g` : `已達標 (+${Math.abs(proDiff)}g)`;
    proRemEl.style.color = proDiff <= 0 ? 'var(--accent)' : 'var(--sub)';
  }

  // 5. 碳水進度
  const carbsCurEl = document.getElementById('carbsCurrent');
  const carbsTarEl = document.getElementById('carbsTarget');
  if (carbsCurEl) carbsCurEl.innerText = totalCarbs.toFixed(1);
  if (carbsTarEl) carbsTarEl.innerText = targetCarbs;

  const carbsPct = Math.min(100, Math.round((totalCarbs / targetCarbs) * 100));
  const carbsProgEl = document.getElementById('carbsProgress');
  if (carbsProgEl) carbsProgEl.style.width = carbsPct + '%';

  const carbsDiff = (targetCarbs - totalCarbs).toFixed(1);
  const carbsRemEl = document.getElementById('carbsRemainTxt');
  if (carbsRemEl) {
    carbsRemEl.innerText = carbsDiff >= 0 ? `剩餘：${carbsDiff} g` : `超標：${Math.abs(carbsDiff)} g`;
    carbsRemEl.style.color = carbsDiff >= 0 ? 'var(--sub)' : '#ef4444';
  }

  // 6. 脂肪進度
  const fatCurEl = document.getElementById('fatCurrent');
  const fatTarEl = document.getElementById('fatTarget');
  if (fatCurEl) fatCurEl.innerText = totalFat.toFixed(1);
  if (fatTarEl) fatTarEl.innerText = targetFat;

  const fatPct = Math.min(100, Math.round((totalFat / targetFat) * 100));
  const fatProgEl = document.getElementById('fatProgress');
  if (fatProgEl) fatProgEl.style.width = fatPct + '%';

  const fatDiff = (targetFat - totalFat).toFixed(1);
  const fatRemEl = document.getElementById('fatRemainTxt');
  if (fatRemEl) {
    fatRemEl.innerText = fatDiff >= 0 ? `剩餘：${fatDiff} g` : `超標：${Math.abs(fatDiff)} g`;
    fatRemEl.style.color = fatDiff >= 0 ? 'var(--sub)' : '#ef4444';
  }

  // 7. 膳食纖維進度
  const fiberCurEl = document.getElementById('fiberCurrent');
  const fiberTarEl = document.getElementById('fiberTarget');
  if (fiberCurEl) fiberCurEl.innerText = totalFiber.toFixed(1);
  if (fiberTarEl) fiberTarEl.innerText = targetFiber;

  const fiberPct = Math.min(100, Math.round((totalFiber / targetFiber) * 100));
  const fiberProgEl = document.getElementById('fiberProgress');
  if (fiberProgEl) fiberProgEl.style.width = fiberPct + '%';

  const fiberDiff = (targetFiber - totalFiber).toFixed(1);
  const fiberRemEl = document.getElementById('fiberRemainTxt');
  if (fiberRemEl) {
    fiberRemEl.innerText = fiberDiff >= 0 ? `剩餘：${fiberDiff} g` : `已達標 (+${Math.abs(fiberDiff)}g)`;
    fiberRemEl.style.color = fiberDiff <= 0 ? '#14b8a6' : 'var(--sub)';
  }

  if (list) list.innerHTML = html || '<p style="color:var(--sub);text-align:center;padding:10px;">該日尚無餐點紀錄</p>';
}
