// Mojo Project
// 7. diet.js
let base64DietImage = '';

// 預設運動項目庫
const DEFAULT_WORKOUTS = [
  '🏋️ 重訓 (胸背/上半身)',
  '🏋️ 重訓 (腿臀/下半身)',
  '🏃 慢跑 / 跑步機',
  '🚶 快走 / 戶外散步',
  '🚴 室內腳踏車 / 飛輪',
  '🏊 游泳',
  '⚡ 高強度間歇 (HIIT)',
  '🧘 瑜珈 / 伸展放鬆'
];

function getWorkoutCategories() {
  try {
    const custom = localStorage.getItem('my_custom_workout_categories');
    if (custom) return JSON.parse(custom);
  } catch(e) {}
  return DEFAULT_WORKOUTS;
}

function initWorkoutDropdown() {
  const select = document.getElementById('workoutTypeSelect');
  if (!select) return;
  const categories = getWorkoutCategories();
  
  let html = '';
  categories.forEach(item => {
    html += `<option value="${item}">${item}</option>`;
  });
  html += `<option value="__NEW__">➕ 自訂新增運動項目...</option>`;
  select.innerHTML = html;
}

function handleWorkoutSelectChange(select) {
  const box = document.getElementById('newWorkoutItemBox');
  if (!box) return;
  if (select.value === '__NEW__') {
    box.style.display = 'block';
    document.getElementById('newWorkoutNameInput').focus();
  } else {
    box.style.display = 'none';
  }
}

function addNewWorkoutCategory() {
  const input = document.getElementById('newWorkoutNameInput');
  if (!input) return;
  const val = input.value.trim();
  if (!val) return alert('請輸入運動項目名稱');

  let list = getWorkoutCategories();
  if (!list.includes(val)) {
    list.push(val);
    localStorage.setItem('my_custom_workout_categories', JSON.stringify(list));
  }
  initWorkoutDropdown();
  document.getElementById('workoutTypeSelect').value = val;
  document.getElementById('newWorkoutItemBox').style.display = 'none';
  input.value = '';
}

function saveWorkout() {
  const queryDate = document.getElementById('dietDate').value;
  let type = document.getElementById('workoutTypeSelect').value;
  if (type === '__NEW__') {
    type = document.getElementById('newWorkoutNameInput').value.trim() || '自訂運動';
  }
  const duration = parseInt(document.getElementById('workoutDuration').value) || 0;
  const cal = parseInt(document.getElementById('workoutCal').value) || 0;
  const note = document.getElementById('workoutNote').value.trim();

  if (!cal && !duration) return alert('請輸入運動時長或消耗熱量');

  const item = {
    date: queryDate,
    type: type,
    duration: duration,
    cal: cal,
    note: note
  };

  const list = window.MojoState.workoutLogs || [];
  list.unshift(item);
  window.MojoState.workoutLogs = list;
  localStorage.setItem('my_workout_logs', JSON.stringify(list));
  uploadToCloud('WORKOUT', item);

  document.getElementById('workoutDuration').value = '';
  document.getElementById('workoutCal').value = '';
  document.getElementById('workoutNote').value = '';
  document.getElementById('newWorkoutItemBox').style.display = 'none';

  renderDiet();
  alert(`運動消耗 (${type} - ${cal} kcal) 已記錄！`);
}

function deleteWorkout(index) {
  if (confirm('確定要刪除這筆運動紀錄嗎？')) {
    const list = window.MojoState.workoutLogs || [];
    list.splice(index, 1);
    window.MojoState.workoutLogs = list;
    localStorage.setItem('my_workout_logs', JSON.stringify(list));
    renderDiet();
  }
}

function compressDietImage(file) {
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

async function previewAndAnalyze(input) {
  const file = input.files[0];
  if (file) {
    try {
      const res = await compressDietImage(file);
      const preview = document.getElementById('imagePreview');
      preview.src = res.dataUrl;
      preview.style.display = 'block';
      base64DietImage = res.base64;
      document.getElementById('aiHintBox').style.display = 'block';
      document.getElementById('aiBtn').style.display = 'block';
    } catch(e) {
      console.error(e);
    }
  }
}

async function analyzeFoodImage() {
  let apiKey = (typeof getActiveApiKey === 'function') ? getActiveApiKey() : localStorage.getItem('gemini_api_key');
  if (!apiKey) {
    setupApiKey();
    apiKey = (typeof getActiveApiKey === 'function') ? getActiveApiKey() : localStorage.getItem('gemini_api_key');
    if (!apiKey) return alert('未輸入 API Key，無法進行分析');
  }

  const aiBtn = document.getElementById('aiBtn');
  aiBtn.disabled = true;
  aiBtn.innerText = '⚡ AI 估算中...';

  const userHint = document.getElementById('aiHintText').value.trim();
  let hintPrompt = "";
  if (userHint) {
    hintPrompt = `\n提示：「${userHint}」`;
  }

  const promptText = `你是專業營養師。分析照片並繁中命名食物，嚴格預估五大營養素：${hintPrompt}
{"food": "食物名稱與份量", "cal": 數字, "pro": 數字, "carbs": 數字, "fat": 數字, "fiber": 數字}`;

  try {
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-3.6-flash:generateContent?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: promptText }, { inlineData: { mimeType: "image/jpeg", data: base64DietImage } }] }]
      })
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

    alert('⚡ AI 估算完成！已自動填入熱量與五大營養素。');
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

function addCustomWater(type) {
  const inputId = (type === 'pure') ? 'customWaterPure' : 'customWaterTea';
  const input = document.getElementById(inputId);
  if (!input) return;
  const val = parseInt(input.value);
  if (!val || val <= 0) return alert('請輸入有效的水量數值 (ml)');
  addWaterRecord(type, val);
  input.value = '';
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

function generateNutritionSuggestions(diffPro, diffFiber, diffCal, pureRatio, diffWater) {
  let suggestions = [];

  if (diffPro > 5) {
    const eggQty = Math.max(1, Math.round(diffPro / 7));
    const chickenQty = Math.max(1, Math.round(diffPro / 23));
    const soyQty = Math.max(1, Math.round(diffPro / 14));
    suggestions.push({ emoji: '🍗', title: '即食雞胸肉', desc: `約需 ${chickenQty} 份 (~${chickenQty * 23}g 蛋白)` });
    suggestions.push({ emoji: '🥚', title: '茶葉蛋 / 水煮蛋', desc: `約需 ${eggQty} 顆 (~${eggQty * 7}g 蛋白)` });
    suggestions.push({ emoji: '🥛', title: '無糖高纖豆漿', desc: `約需 ${soyQty} 瓶 (400ml/瓶)` });
  }

  if (diffFiber > 3) {
    const vegQty = Math.max(1, Math.round(diffFiber / 3));
    const appleQty = Math.max(1, Math.round(diffFiber / 4));
    suggestions.push({ emoji: '🥦', title: '燙青菜 / 綠花椰', desc: `約需 ${vegQty} 份 (~${vegQty * 3}g 纖維)` });
    suggestions.push({ emoji: '🍎', title: '帶皮蘋果 / 奇異果', desc: `約需 ${appleQty} 顆 (~${appleQty * 4}g 纖維)` });
  }

  if (diffWater > 200 || (pureRatio < 50 && diffWater >= 0)) {
    suggestions.push({ emoji: '💧', title: '溫純白開水', desc: `尚缺 ${Math.max(300, Math.round(diffWater))} ml` });
  }

  if (diffCal > 600) {
    suggestions.push({ emoji: '🥑', title: '綜合堅果 / 酪梨', desc: `補 1 小把堅果 (~160kcal)` });
  }

  return suggestions;
}

function renderDiet() {
  const dietDateInput = document.getElementById('dietDate');
  if (!dietDateInput) return;
  const queryDate = dietDateInput.value;
  
  initWorkoutDropdown();

  // 1. 計算飲食攝取
  let totalC = 0, totalP = 0, totalCarbs = 0, totalFat = 0, totalFiber = 0, dietHtml = '';
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
      dietHtml += `<div class="log-item">
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

  const dietListEl = document.getElementById('dietLogList');
  if (dietListEl) dietListEl.innerHTML = dietHtml || '<p style="color:var(--sub);text-align:center;padding:10px;">該日尚無餐點紀錄</p>';

  // 2. 計算體能訓練消耗
  let totalBurn = 0, workoutHtml = '';
  const curWorkouts = window.MojoState.workoutLogs || [];
  curWorkouts.forEach((w, idx) => {
    const wDate = String(w.date || '').replace(/\//g, '-');
    if (wDate === queryDate) {
      const bCal = Number(w.cal) || 0;
      totalBurn += bCal;
      const durText = w.duration ? `${w.duration} 分鐘 ｜ ` : '';
      const noteText = w.note ? `<br><small style="color:var(--sub);">${w.note}</small>` : '';
      workoutHtml += `<div class="log-item">
        <div class="log-info">
          <strong>${w.type}</strong><br>
          <small style="color:#4338ca; font-weight:600;">${durText}消耗 -${bCal} kcal</small>${noteText}
        </div>
        <div class="log-actions">
          <button class="action-btn btn-del" type="button" onclick="deleteWorkout(${idx})">刪除</button>
        </div>
      </div>`;
    }
  });

  const workoutListEl = document.getElementById('workoutLogList');
  if (workoutListEl) workoutListEl.innerHTML = workoutHtml ? `<div style="font-size:0.85rem; font-weight:bold; color:#4338ca; margin-bottom:6px;">📋 今日訓練明細：</div>` + workoutHtml : '';

  // 3. 雙軌搜尋該日前最新體重
  let latestWeight = 80;
  let weightSourceLabel = '預設基準';
  const bodies = (window.MojoState.bodyLogs || []).filter(b => b.date <= queryDate);
  const scales = (window.MojoState.scaleLogs || []).filter(s => s.date <= queryDate);

  let candidateRecords = [];
  bodies.forEach(b => candidateRecords.push({ date: b.date, time: '00:00', weight: Number(b.weight), type: 'InBody' }));
  scales.forEach(s => candidateRecords.push({ date: s.date, time: s.time || '00:00', weight: Number(s.weight), type: '家用' }));

  if (candidateRecords.length > 0) {
    candidateRecords.sort((a, b) => new Date(`${b.date} ${b.time}`) - new Date(`${a.date} ${a.time}`));
    latestWeight = candidateRecords[0].weight;
    weightSourceLabel = `${candidateRecords[0].type} ${latestWeight}kg`;
  } else if ((window.MojoState.bodyLogs || []).length > 0) {
    latestWeight = Number(window.MojoState.bodyLogs[0].weight) || 80;
    weightSourceLabel = `首筆 InBody ${latestWeight}kg`;
  }

  const tdee = Math.round(latestWeight * 28);
  const targetCalories = tdee - 500;
  const targetProtein = Math.round(latestWeight * 1.6);
  const targetCarbs = Math.round(latestWeight * 2.0);
  const targetFat = Math.round(latestWeight * 0.6);
  const targetFiber = 28;
  const targetWater = Math.round(latestWeight * 35);

  // 綜合淨熱量與實際赤字運算
  const netCalories = totalC - totalBurn;
  const actualDeficit = tdee - netCalories;

  const sumInEl = document.getElementById('summaryCalIn');
  const sumBurnEl = document.getElementById('summaryCalBurn');
  const sumNetEl = document.getElementById('summaryNetCal');
  if (sumInEl) sumInEl.innerText = totalC;
  if (sumBurnEl) sumBurnEl.innerText = totalBurn;
  if (sumNetEl) sumNetEl.innerText = netCalories;

  const deficitCurEl = document.getElementById('deficitCurrent');
  const tdeeRefEl = document.getElementById('tdeeRef');
  const deficitStatusEl = document.getElementById('deficitStatus');

  if (deficitCurEl) deficitCurEl.innerText = (actualDeficit > 0 ? `-${actualDeficit}` : `+${Math.abs(actualDeficit)}`);
  if (tdeeRefEl) tdeeRefEl.innerText = `TDEE 消耗: ${tdee} kcal`;

  if (deficitStatusEl) {
    if (actualDeficit >= 400 && actualDeficit <= 700) {
      deficitStatusEl.innerText = '🎯 完美燃脂赤字 (含運動扣除)';
      deficitStatusEl.style.color = '#059669';
    } else if (actualDeficit > 700) {
      deficitStatusEl.innerText = '⚠️ 赤字偏大，運動後請適度補充蛋白質/碳水';
      deficitStatusEl.style.color = '#d97706';
    } else if (actualDeficit > 0) {
      deficitStatusEl.innerText = '🌱 溫和赤字中 (進度良好)';
      deficitStatusEl.style.color = '#2563eb';
    } else {
      deficitStatusEl.innerText = '⛔ 熱量盈餘 (已超過今日消耗)';
      deficitStatusEl.style.color = '#dc2626';
    }
  }

  // 4. 水分更新
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

  // 5. 五大營養素進度條
  const calCurEl = document.getElementById('calCurrent');
  const calTarEl = document.getElementById('calTarget');
  const inbodyRefEl = document.getElementById('inbodyWeightRef');
  if (calCurEl) calCurEl.innerText = totalC;
  if (calTarEl) calTarEl.innerText = targetCalories;
  if (inbodyRefEl) inbodyRefEl.innerText = `依最新基準 ${weightSourceLabel} 連動`;

  const calPct = Math.min(100, Math.round((totalC / targetCalories) * 100));
  const calProgEl = document.getElementById('calProgress');
  if (calProgEl) {
    calProgEl.style.width = calPct + '%';
    calProgEl.style.backgroundColor = totalC > targetCalories ? '#ef4444' : '#3b82f6';
  }

  const calDiff = targetCalories - totalC;
  const calRemEl = document.getElementById('calRemainTxt');
  if (calRemEl) {
    calRemEl.innerText = calDiff >= 0 ? `剩餘：${calDiff} kcal` : `超標：${Math.abs(calDiff)} kcal`;
    calRemEl.style.color = calDiff >= 0 ? 'var(--sub)' : '#ef4444';
  }

  const proCurEl = document.getElementById('proCurrent');
  const proTarEl = document.getElementById('proTarget');
  if (proCurEl) proCurEl.innerText = totalP.toFixed(1);
  if (proTarEl) proTarEl.innerText = targetProtein;

  const proPct = Math.min(100, Math.round((totalP / targetProtein) * 100));
  const proProgEl = document.getElementById('proProgress');
  if (proProgEl) {
    proProgEl.style.width = proPct + '%';
    proProgEl.style.backgroundColor = '#10b981';
  }

  const proDiff = (targetProtein - totalP).toFixed(1);
  const proRemEl = document.getElementById('proRemainTxt');
  if (proRemEl) {
    proRemEl.innerText = proDiff >= 0 ? `剩餘：${proDiff} g` : `已達標 (+${Math.abs(proDiff)}g)`;
    proRemEl.style.color = proDiff <= 0 ? '#10b981' : 'var(--sub)';
  }

  const carbsCurEl = document.getElementById('carbsCurrent');
  const carbsTarEl = document.getElementById('carbsTarget');
  if (carbsCurEl) carbsCurEl.innerText = totalCarbs.toFixed(1);
  if (carbsTarEl) carbsTarEl.innerText = targetCarbs;

  const carbsPct = Math.min(100, Math.round((totalCarbs / targetCarbs) * 100));
  const carbsProgEl = document.getElementById('carbsProgress');
  if (carbsProgEl) {
    carbsProgEl.style.width = carbsPct + '%';
    carbsProgEl.style.backgroundColor = '#ea580c';
  }

  const carbsDiff = (targetCarbs - totalCarbs).toFixed(1);
  const carbsRemEl = document.getElementById('carbsRemainTxt');
  if (carbsRemEl) {
    carbsRemEl.innerText = carbsDiff >= 0 ? `剩餘：${carbsDiff} g` : `超標：${Math.abs(carbsDiff)} g`;
    carbsRemEl.style.color = carbsDiff >= 0 ? 'var(--sub)' : '#ef4444';
  }

  const fatCurEl = document.getElementById('fatCurrent');
  const fatTarEl = document.getElementById('fatTarget');
  if (fatCurEl) fatCurEl.innerText = totalFat.toFixed(1);
  if (fatTarEl) fatTarEl.innerText = targetFat;

  const fatPct = Math.min(100, Math.round((totalFat / targetFat) * 100));
  const fatProgEl = document.getElementById('fatProgress');
  if (fatProgEl) {
    fatProgEl.style.width = fatPct + '%';
    fatProgEl.style.backgroundColor = '#eab308';
  }

  const fatDiff = (targetFat - totalFat).toFixed(1);
  const fatRemEl = document.getElementById('fatRemainTxt');
  if (fatRemEl) {
    fatRemEl.innerText = fatDiff >= 0 ? `剩餘：${fatDiff} g` : `超標：${Math.abs(fatDiff)} g`;
    fatRemEl.style.color = fatDiff >= 0 ? 'var(--sub)' : '#ef4444';
  }

  const fiberCurEl = document.getElementById('fiberCurrent');
  const fiberTarEl = document.getElementById('fiberTarget');
  if (fiberCurEl) fiberCurEl.innerText = totalFiber.toFixed(1);
  if (fiberTarEl) fiberTarEl.innerText = targetFiber;

  const fiberPct = Math.min(100, Math.round((totalFiber / targetFiber) * 100));
  const fiberProgEl = document.getElementById('fiberProgress');
  if (fiberProgEl) {
    fiberProgEl.style.width = fiberPct + '%';
    fiberProgEl.style.backgroundColor = '#14b8a6';
  }

  const fiberDiff = (targetFiber - totalFiber).toFixed(1);
  const fiberRemEl = document.getElementById('fiberRemainTxt');
  if (fiberRemEl) {
    fiberRemEl.innerText = fiberDiff >= 0 ? `剩餘：${fiberDiff} g` : `已達標 (+${Math.abs(fiberDiff)}g)`;
    fiberRemEl.style.color = fiberDiff <= 0 ? '#14b8a6' : 'var(--sub)';
  }

  // 6. 智慧建議卡片
  const suggestCard = document.getElementById('nutritionSuggestCard');
  const suggestBox = document.getElementById('suggestContent');
  if (suggestCard && suggestBox) {
    const listSuggestions = generateNutritionSuggestions(
      parseFloat(proDiff),
      parseFloat(fiberDiff),
      calDiff,
      pureRatio,
      targetWater - totalW
    );

    if (listSuggestions.length > 0) {
      let sHtml = '<div class="suggest-box">';
      listSuggestions.forEach(s => {
        sHtml += `<div class="suggest-item">
          <div class="suggest-emoji">${s.emoji}</div>
          <div class="suggest-title">${s.title}</div>
          <div class="suggest-desc">${s.desc}</div>
        </div>`;
      });
      sHtml += '</div>';
      suggestBox.innerHTML = sHtml;
      suggestCard.style.display = 'block';
    } else {
      suggestCard.style.display = 'none';
    }
  }
}
