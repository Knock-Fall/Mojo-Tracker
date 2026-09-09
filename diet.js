// Mojo Project
// 7. diet.js (MK-80977: 恢復運動圖示、防呆自訂運動名稱、新增飲食編輯功能)

let base64FoodImage = '';
let editingDietId = null; // 記錄當前正在編輯的飲食 ID

function getSelectedDietDate() {
  return document.getElementById('dietDate')?.value || getLocalTodayStr();
}

function changeDietDateBy(offset) {
  const cur = getSelectedDietDate();
  const parts = cur.split('-').map(Number);
  const d = new Date(parts[0], parts[1] - 1, parts[2]);
  d.setDate(d.getDate() + offset);
  const nextDate = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
  document.getElementById('dietDate').value = nextDate;
  renderDiet();
}

function resetDietDateToToday() {
  document.getElementById('dietDate').value = getLocalTodayStr();
  renderDiet();
}

function addWaterRecord(type, amount) {
  const dStr = getSelectedDietDate();
  let wLogs = window.MojoState.waterLogs || {};
  if (!wLogs[dStr]) wLogs[dStr] = { pure: 0, tea: 0 };

  if (type === 'pure') wLogs[dStr].pure = (wLogs[dStr].pure || 0) + amount;
  if (type === 'tea') wLogs[dStr].tea = (wLogs[dStr].tea || 0) + amount;

  window.MojoState.waterLogs = wLogs;
  localStorage.setItem('my_water_logs', JSON.stringify(wLogs));
  if (typeof uploadToCloud === 'function') uploadToCloud('WATER', { date: dStr, data: wLogs[dStr] });
  renderDiet();
}

function addCustomWater(type) {
  const inputId = type === 'pure' ? 'customWaterPure' : 'customWaterTea';
  const val = parseInt(document.getElementById(inputId).value);
  if (val && val > 0) {
    addWaterRecord(type, val);
    document.getElementById(inputId).value = '';
  }
}

function resetWaterRecord() {
  const dStr = getSelectedDietDate();
  let wLogs = window.MojoState.waterLogs || {};
  wLogs[dStr] = { pure: 0, tea: 0 };
  window.MojoState.waterLogs = wLogs;
  localStorage.setItem('my_water_logs', JSON.stringify(wLogs));
  if (typeof uploadToCloud === 'function') uploadToCloud('WATER', { date: dStr, data: wLogs[dStr] });
  renderDiet();
}

function previewAndAnalyze(input) {
  const file = input.files[0];
  if (file) {
    const reader = new FileReader();
    reader.onload = function(e) {
      document.getElementById('imagePreview').src = e.target.result;
      document.getElementById('imagePreview').style.display = 'block';
      document.getElementById('aiHintBox').style.display = 'block';
      document.getElementById('aiBtn').style.display = 'block';
      base64FoodImage = e.target.result.split(',')[1];
    };
    reader.readAsDataURL(file);
  }
}

async function analyzeFoodImage() {
  let apiKey = (typeof getActiveApiKey === 'function') ? getActiveApiKey() : localStorage.getItem('gemini_api_key');
  if (!apiKey) {
    if (typeof openKeyModal === 'function') openKeyModal();
    return alert('請先設定 Gemini API Key！');
  }

  const aiBtn = document.getElementById('aiBtn');
  aiBtn.disabled = true;
  aiBtn.innerText = '⚡ AI 估算飲食中...';

  const hint = document.getElementById('aiHintText').value.trim();
  const promptText = `請分析食物照片，提供熱量與營養素估算純 JSON：
{"foodName":"食物名稱","cal":數字,"protein":數字,"carbs":數字,"fat":數字,"fiber":數字}${hint ? ' (使用者備註: ' + hint + ')' : ''}`;

  try {
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-3.6-flash:generateContent?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{
          parts: [
            { text: promptText },
            { inlineData: { mimeType: "image/jpeg", data: base64FoodImage } }
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

    if (res.foodName) document.getElementById('dietContent').value = res.foodName;
    if (res.cal) document.getElementById('dietCal').value = res.cal;
    if (res.protein) document.getElementById('dietPro').value = res.protein;
    if (res.carbs) document.getElementById('dietCarbs').value = res.carbs;
    if (res.fat) document.getElementById('dietFat').value = res.fat;
    if (res.fiber) document.getElementById('dietFiber').value = res.fiber;

    alert(`✨ 飲食分析完成！\n品名：${res.foodName}\n熱量：${res.cal} kcal ｜ 蛋白質：${res.protein}g`);
  } catch(e) {
    alert('AI 辨識失敗：' + e.message);
  } finally {
    aiBtn.disabled = false;
    aiBtn.innerText = '✨ 開始 AI 分析熱量與五大營養';
  }
}

// ⭐️ 飲食儲存（支援新增與編輯更新）
function saveDiet() {
  const dStr = getSelectedDietDate();
  const type = document.getElementById('dietType').value;
  const content = document.getElementById('dietContent').value.trim();
  const cal = parseFloat(document.getElementById('dietCal').value) || 0;
  const pro = parseFloat(document.getElementById('dietPro').value) || 0;
  const carbs = parseFloat(document.getElementById('dietCarbs').value) || 0;
  const fat = parseFloat(document.getElementById('dietFat').value) || 0;
  const fiber = parseFloat(document.getElementById('dietFiber').value) || 0;

  if (!content) return alert('請輸入食物內容');

  let list = window.MojoState.dietLogs || [];

  if (editingDietId) {
    const idx = list.findIndex(d => d.id === editingDietId);
    if (idx !== -1) {
      list[idx].type = type;
      list[idx].content = content;
      list[idx].cal = cal;
      list[idx].protein = pro;
      list[idx].carbs = carbs;
      list[idx].fat = fat;
      list[idx].fiber = fiber;
      if (typeof uploadToCloud === 'function') uploadToCloud('DIET', list[idx]);
    }
    editingDietId = null;
    const submitBtn = document.getElementById('btnSaveDietSubmit');
    if (submitBtn) {
      submitBtn.innerText = '加入所選日期飲食紀錄';
      submitBtn.className = 'btn btn-accent';
    }
  } else {
    const item = {
      id: Date.now().toString(),
      date: dStr,
      type,
      content,
      cal,
      protein: pro,
      carbs,
      fat,
      fiber
    };
    list.push(item);
    if (typeof uploadToCloud === 'function') uploadToCloud('DIET', item);
  }

  window.MojoState.dietLogs = list;
  localStorage.setItem('my_diet_logs', JSON.stringify(list));

  document.getElementById('dietContent').value = '';
  document.getElementById('dietCal').value = '';
  document.getElementById('dietPro').value = '';
  document.getElementById('dietCarbs').value = '';
  document.getElementById('dietFat').value = '';
  document.getElementById('dietFiber').value = '';
  document.getElementById('imagePreview').style.display = 'none';
  document.getElementById('aiBtn').style.display = 'none';

  renderDiet();
}

// ⭐️ 編輯飲食回填
function editDietLog(id) {
  const list = window.MojoState.dietLogs || [];
  const item = list.find(d => d.id === id);
  if (!item) return;

  editingDietId = id;
  document.getElementById('dietType').value = item.type;
  document.getElementById('dietContent').value = item.content;
  document.getElementById('dietCal').value = item.cal || 0;
  document.getElementById('dietPro').value = (item.protein !== undefined ? item.protein : (item.pro || 0));
  document.getElementById('dietCarbs').value = item.carbs || 0;
  document.getElementById('dietFat').value = item.fat || 0;
  document.getElementById('dietFiber').value = item.fiber || 0;

  const submitBtn = document.getElementById('btnSaveDietSubmit');
  if (submitBtn) {
    submitBtn.innerText = '💾 更新此筆飲食紀錄';
    submitBtn.className = 'btn btn-primary';
  }

  document.getElementById('dietContent').focus();
  document.getElementById('dietContent').scrollIntoView({ behavior: 'smooth', block: 'center' });
}

function deleteDietLog(id) {
  if (confirm('確定要刪除這筆飲食紀錄？')) {
    let list = window.MojoState.dietLogs || [];
    list = list.filter(d => d.id !== id);
    if (editingDietId === id) {
      editingDietId = null;
      const submitBtn = document.getElementById('btnSaveDietSubmit');
      if (submitBtn) {
        submitBtn.innerText = '加入所選日期飲食紀錄';
        submitBtn.className = 'btn btn-accent';
      }
    }
    window.MojoState.dietLogs = list;
    localStorage.setItem('my_diet_logs', JSON.stringify(list));
    renderDiet();
  }
}

// ⭐️ 自訂運動顯示切換
function handleWorkoutSelectChange(selectEl) {
  const box = document.getElementById('newWorkoutItemBox');
  if (selectEl.value === 'custom_new') {
    box.style.display = 'block';
    document.getElementById('newWorkoutNameInput').focus();
  } else {
    box.style.display = 'none';
  }
}

// ⭐️ 新增自訂運動項目
function addNewWorkoutCategory() {
  const input = document.getElementById('newWorkoutNameInput');
  const name = input.value.trim();
  if (!name) return alert('請輸入運動名稱');

  const displayName = name.startsWith('🏃') || name.startsWith('🏋️') || name.startsWith('🚴') ? name : `🏃 ${name}`;

  let list = JSON.parse(localStorage.getItem('custom_workout_types') || '[]');
  if (!list.includes(displayName)) {
    list.push(displayName);
    localStorage.setItem('custom_workout_types', JSON.stringify(list));
  }
  input.value = '';
  document.getElementById('newWorkoutItemBox').style.display = 'none';
  initWorkoutOptions(displayName);
}

// ⭐️ 初始化運動選單（恢復圖示）
function initWorkoutOptions(selected) {
  const sel = document.getElementById('workoutTypeSelect');
  if (!sel) return;
  const currentVal = selected || sel.value;

  const defaults = [
    '🏋️ 重量訓練',
    '🏃 有氧跑步',
    '🚶 快走 / 健走',
    '🚴 單車 / 飛輪',
    '🏊 游泳',
    '⚡ 高強度間歇 HIIT'
  ];
  let custom = JSON.parse(localStorage.getItem('custom_workout_types') || '[]');
  const all = [...defaults, ...custom];

  let html = '';
  all.forEach(item => {
    html += `<option value="${item}" ${item === currentVal ? 'selected' : ''}>${item}</option>`;
  });
  html += `<option value="custom_new" ${currentVal === 'custom_new' ? 'selected' : ''}>➕ 自訂新項目...</option>`;
  sel.innerHTML = html;
}

// ⭐️ 運動紀錄儲存（徹底解決 custom_new 問題）
function saveWorkout() {
  const dStr = getSelectedDietDate();
  const selectEl = document.getElementById('workoutTypeSelect');
  let type = selectEl.value;

  // 防呆：如果停在 custom_new，自動採用輸入框中的自訂文字
  if (type === 'custom_new') {
    const customNameInput = document.getElementById('newWorkoutNameInput').value.trim();
    if (!customNameInput) {
      return alert('請先在下方輸入自訂運動名稱，或點擊「儲存項目」！');
    }
    type = customNameInput.startsWith('🏃') || customNameInput.startsWith('🏋️') || customNameInput.startsWith('🚴') ? customNameInput : `🏃 ${customNameInput}`;
    
    // 同步加入自訂列表
    let customList = JSON.parse(localStorage.getItem('custom_workout_types') || '[]');
    if (!customList.includes(type)) {
      customList.push(type);
      localStorage.setItem('custom_workout_types', JSON.stringify(customList));
    }
    document.getElementById('newWorkoutNameInput').value = '';
    document.getElementById('newWorkoutItemBox').style.display = 'none';
    initWorkoutOptions(type);
  }

  const duration = parseInt(document.getElementById('workoutDuration').value) || 0;
  const cal = parseFloat(document.getElementById('workoutCal').value) || 0;
  const note = document.getElementById('workoutNote').value.trim();

  if (!cal || cal <= 0) return alert('請輸入預估消耗熱量 (kcal)');

  const item = {
    id: Date.now().toString(),
    date: dStr,
    type,
    duration,
    cal,
    note
  };

  let list = window.MojoState.workoutLogs || [];
  list.push(item);
  window.MojoState.workoutLogs = list;
  localStorage.setItem('my_workout_logs', JSON.stringify(list));
  if (typeof uploadToCloud === 'function') uploadToCloud('WORKOUT', item);

  document.getElementById('workoutDuration').value = '';
  document.getElementById('workoutCal').value = '';
  document.getElementById('workoutNote').value = '';

  renderDiet();
}

function deleteWorkoutLog(id) {
  if (confirm('確定要刪除這筆運動紀錄？')) {
    let list = window.MojoState.workoutLogs || [];
    list = list.filter(w => w.id !== id);
    window.MojoState.workoutLogs = list;
    localStorage.setItem('my_workout_logs', JSON.stringify(list));
    renderDiet();
  }
}

// 猛健樂施打週期飲食與赤字週均計算
function renderCycleNutritionAverages(currentDateStr) {
  const badgeEl = document.getElementById('cycleAvgBadge');
  const subEl = document.getElementById('cycleAvgSub');
  const deficitEl = document.getElementById('cycleAvgDeficit');
  const proEl = document.getElementById('cycleAvgProtein');
  const waterEl = document.getElementById('cycleAvgWater');
  const inEl = document.getElementById('cycleAvgCalIn');
  const burnEl = document.getElementById('cycleAvgBurn');

  if (!badgeEl) return;

  const shots = (window.MojoState.shotLogs || []).slice().sort((a, b) => new Date(b.date) - new Date(a.date));
  
  let matchedShot = null;
  let startDateStr = '';
  let endDateStr = '';

  if (shots.length > 0) {
    for (let i = 0; i < shots.length; i++) {
      const sDate = shots[i].date;
      const parts = sDate.split('-').map(Number);
      const sObj = new Date(parts[0], parts[1] - 1, parts[2]);
      const eObj = new Date(sObj);
      eObj.setDate(eObj.getDate() + 7);
      const eDate = `${eObj.getFullYear()}-${String(eObj.getMonth() + 1).padStart(2, '0')}-${String(eObj.getDate()).padStart(2, '0')}`;

      if (currentDateStr >= sDate && currentDateStr <= eDate) {
        matchedShot = shots[i];
        startDateStr = sDate;
        endDateStr = eDate;
        break;
      }
    }
    if (!matchedShot) {
      matchedShot = shots[0];
      startDateStr = matchedShot.date;
      const parts = startDateStr.split('-').map(Number);
      const sObj = new Date(parts[0], parts[1] - 1, parts[2]);
      const eObj = new Date(sObj);
      eObj.setDate(eObj.getDate() + 7);
      endDateStr = `${eObj.getFullYear()}-${String(eObj.getMonth() + 1).padStart(2, '0')}-${String(eObj.getDate()).padStart(2, '0')}`;
    }
  } else {
    const parts = currentDateStr.split('-').map(Number);
    const curObj = new Date(parts[0], parts[1] - 1, parts[2]);
    const sObj = new Date(curObj);
    sObj.setDate(sObj.getDate() - 6);
    startDateStr = `${sObj.getFullYear()}-${String(sObj.getMonth() + 1).padStart(2, '0')}-${String(sObj.getDate()).padStart(2, '0')}`;
    endDateStr = currentDateStr;
  }

  const doseLabel = matchedShot ? `${matchedShot.dose} (${startDateStr.slice(5)}~${endDateStr.slice(5)})` : `近7日 (${startDateStr.slice(5)}~${endDateStr.slice(5)})`;
  badgeEl.innerText = doseLabel;

  const bodies = window.MojoState.bodyLogs || [];
  const latestBody = bodies.length ? bodies[bodies.length - 1] : null;
  const refWeight = latestBody ? latestBody.weight : 81.5;
  const tdee = Math.round(refWeight * 28);

  const allDiets = window.MojoState.dietLogs || [];
  const allWorkouts = window.MojoState.workoutLogs || [];
  const allWater = window.MojoState.waterLogs || {};

  const sParts = startDateStr.split('-').map(Number);
  const eParts = endDateStr.split('-').map(Number);
  let s = new Date(sParts[0], sParts[1] - 1, sParts[2]);
  const e = new Date(eParts[0], eParts[1] - 1, eParts[2]);

  let recordedDays = 0;
  let totalIn = 0;
  let totalBurn = 0;
  let totalPro = 0;
  let totalWater = 0;

  while (s <= e) {
    const dStr = `${s.getFullYear()}-${String(s.getMonth() + 1).padStart(2, '0')}-${String(s.getDate()).padStart(2, '0')}`;
    const dayDiets = allDiets.filter(d => d.date === dStr);
    const dayWorkouts = allWorkouts.filter(w => w.date === dStr);
    const dayWaterObj = allWater[dStr] || { pure: 0, tea: 0 };
    const dayWater = (dayWaterObj.pure || 0) + (dayWaterObj.tea || 0);

    if (dayDiets.length > 0 || dayWorkouts.length > 0 || dayWater > 0) {
      recordedDays++;
      let dCal = 0, dPro = 0;
      dayDiets.forEach(d => {
        dCal += (d.cal || 0);
        dPro += (d.protein !== undefined ? d.protein : (d.pro || 0));
      });
      let dBurn = 0;
      dayWorkouts.forEach(w => { dBurn += (w.cal || 0); });

      totalIn += dCal;
      totalBurn += dBurn;
      totalPro += dPro;
      totalWater += dayWater;
    }
    s.setDate(s.getDate() + 1);
  }

  if (recordedDays === 0) {
    subEl.innerHTML = `統計基準：本週期尚無飲食數據 ｜ <span style="color:#64748b;">待紀錄</span>`;
    deficitEl.innerText = '--';
    proEl.innerText = '--';
    waterEl.innerText = '--';
    inEl.innerText = '--';
    burnEl.innerText = '--';
    return;
  }

  const avgIn = Math.round(totalIn / recordedDays);
  const avgBurn = Math.round(totalBurn / recordedDays);
  const avgNet = avgIn - avgBurn;
  const avgDeficit = avgNet - tdee;
  const avgProtein = (totalPro / recordedDays).toFixed(1);
  const avgWaterVal = Math.round(totalWater / recordedDays);

  let statusBadge = '';
  if (avgDeficit <= -500) {
    statusBadge = '<span style="color:#16a34a; font-weight:bold;">🔥 赤字優異 (≤ -500)</span>';
    deficitEl.style.color = '#16a34a';
  } else if (avgDeficit < 0) {
    statusBadge = '<span style="color:#d97706; font-weight:bold;">🌱 溫和赤字</span>';
    deficitEl.style.color = '#d97706';
  } else {
    statusBadge = '<span style="color:#dc2626; font-weight:bold;">⚠️ 週期熱量盈餘</span>';
    deficitEl.style.color = '#dc2626';
  }

  subEl.innerHTML = `統計基準：已記錄 <strong>${recordedDays}</strong> / 7 天 ｜ ${statusBadge}`;
  deficitEl.innerText = (avgDeficit > 0 ? '+' + avgDeficit : avgDeficit);
  proEl.innerText = avgProtein;
  waterEl.innerText = avgWaterVal;
  inEl.innerText = avgIn;
  burnEl.innerText = avgBurn;
}

function renderDiet() {
  const dStr = getSelectedDietDate();
  initWorkoutOptions();

  renderCycleNutritionAverages(dStr);

  const bodies = window.MojoState.bodyLogs || [];
  const latestBody = bodies.length ? bodies[bodies.length - 1] : null;
  const refWeight = latestBody ? latestBody.weight : 81.5;

  const tdee = Math.round(refWeight * 28);
  const targetCal = tdee - 500;
  const targetPro = Math.round(refWeight * 1.6);
  const targetCarbs = Math.round(refWeight * 2.0);
  const targetFat = Math.round(refWeight * 0.6);
  const targetFiber = 28;
  const targetWater = Math.round(refWeight * 35);

  document.getElementById('inbodyWeightRef').innerText = `依最新體重 ${refWeight}kg 連動`;
  document.getElementById('tdeeRef').innerText = `TDEE 消耗: ${tdee} kcal`;
  document.getElementById('calTarget').innerText = targetCal;
  document.getElementById('proTarget').innerText = targetPro;
  document.getElementById('carbsTarget').innerText = targetCarbs;
  document.getElementById('fatTarget').innerText = targetFat;
  document.getElementById('fiberTarget').innerText = targetFiber;
  document.getElementById('waterTarget').innerText = targetWater;

  const diets = (window.MojoState.dietLogs || []).filter(d => d.date === dStr);
  let curCal = 0, curPro = 0, curCarbs = 0, curFat = 0, curFiber = 0;
  diets.forEach(d => {
    curCal += (d.cal || 0);
    curPro += (d.protein !== undefined ? d.protein : (d.pro || 0));
    curCarbs += (d.carbs || 0);
    curFat += (d.fat || 0);
    curFiber += (d.fiber || 0);
  });

  document.getElementById('calCurrent').innerText = curCal;
  document.getElementById('proCurrent').innerText = curPro.toFixed(1);
  document.getElementById('carbsCurrent').innerText = curCarbs.toFixed(1);
  document.getElementById('fatCurrent').innerText = curFat.toFixed(1);
  document.getElementById('fiberCurrent').innerText = curFiber.toFixed(1);

  document.getElementById('calRemainTxt').innerText = `剩餘：${Math.max(0, targetCal - curCal)} kcal`;
  document.getElementById('proRemainTxt').innerText = `剩餘：${Math.max(0, targetPro - curPro).toFixed(1)} g`;
  document.getElementById('carbsRemainTxt').innerText = `剩餘：${Math.max(0, targetCarbs - curCarbs).toFixed(1)} g`;
  document.getElementById('fatRemainTxt').innerText = `剩餘：${Math.max(0, targetFat - curFat).toFixed(1)} g`;
  document.getElementById('fiberRemainTxt').innerText = `剩餘：${Math.max(0, targetFiber - curFiber).toFixed(1)} g`;

  document.getElementById('calProgress').style.width = `${Math.min(100, (curCal / targetCal) * 100)}%`;
  document.getElementById('proProgress').style.width = `${Math.min(100, (curPro / targetPro) * 100)}%`;
  document.getElementById('carbsProgress').style.width = `${Math.min(100, (curCarbs / targetCarbs) * 100)}%`;
  document.getElementById('fatProgress').style.width = `${Math.min(100, (curFat / targetFat) * 100)}%`;
  document.getElementById('fiberProgress').style.width = `${Math.min(100, (curFiber / targetFiber) * 100)}%`;

  const workouts = (window.MojoState.workoutLogs || []).filter(w => w.date === dStr);
  let curBurn = 0;
  workouts.forEach(w => curBurn += (w.cal || 0));

  const netCal = curCal - curBurn;
  const actualDeficit = netCal - tdee;

  document.getElementById('summaryCalIn').innerText = curCal;
  document.getElementById('summaryCalBurn').innerText = curBurn;
  document.getElementById('summaryNetCal').innerText = netCal;
  document.getElementById('deficitCurrent').innerText = actualDeficit;

  const defEl = document.getElementById('deficitStatus');
  if (actualDeficit <= -500) {
    defEl.innerHTML = '<span style="color:#16a34a;font-weight:bold;">🔥 完美達到熱量赤字 (≥ 500 kcal)</span>';
  } else if (actualDeficit < 0) {
    defEl.innerHTML = '<span style="color:#d97706;font-weight:bold;">🌱 溫和赤字中 (不足 500 kcal)</span>';
  } else {
    defEl.innerHTML = '<span style="color:#dc2626;font-weight:bold;">⚠️ 今日熱量盈餘，注意控制</span>';
  }

  const wObj = (window.MojoState.waterLogs || {})[dStr] || { pure: 0, tea: 0 };
  const totalWater = (wObj.pure || 0) + (wObj.tea || 0);
  document.getElementById('waterTotalVal').innerText = totalWater;

  const purePct = totalWater > 0 ? ((wObj.pure / totalWater) * 100).toFixed(0) : 0;
  document.getElementById('waterBreakdownTxt').innerText = `純水: ${wObj.pure} ml (${purePct}%) ｜ 茶/咖啡: ${wObj.tea} ml`;

  const pureRatio = totalWater > 0 ? (wObj.pure / totalWater) : 0;
  const ratioEl = document.getElementById('waterRatioStatus');
  if (pureRatio >= 0.5) {
    ratioEl.innerHTML = '<span style="color:#059669;font-weight:bold;">純水比例健康 (≥50%)</span>';
  } else {
    ratioEl.innerHTML = '<span style="color:#d97706;font-weight:bold;">茶飲偏多，建議補充白開水</span>';
  }

  const pureBar = totalWater > 0 ? (wObj.pure / targetWater) * 100 : 0;
  const teaBar = totalWater > 0 ? (wObj.tea / targetWater) * 100 : 0;
  document.getElementById('pureWaterProgress').style.width = `${Math.min(100, pureBar)}%`;
  document.getElementById('teaWaterProgress').style.width = `${Math.min(100 - Math.min(100, pureBar), teaBar)}%`;

  // ⭐️ 飲食清單（加入「編輯」按鈕）
  const dietListEl = document.getElementById('dietLogList');
  if (dietListEl) {
    let dHtml = '';
    diets.forEach(d => {
      const pVal = (d.protein !== undefined ? d.protein : (d.pro || 0));
      dHtml += `<div class="log-item">
        <div class="log-info">
          <strong>[${d.type}] ${d.content}</strong> ｜ ${d.cal} kcal<br>
          <small style="color:var(--sub)">蛋白: ${pVal}g ｜ 碳水: ${d.carbs || 0}g ｜ 脂肪: ${d.fat || 0}g ｜ 纖維: ${d.fiber || 0}g</small>
        </div>
        <div class="log-actions">
          <button class="action-btn btn-edit" type="button" onclick="editDietLog('${d.id}')">編輯</button>
          <button class="action-btn btn-del" type="button" onclick="deleteDietLog('${d.id}')">刪除</button>
        </div>
      </div>`;
    });
    dietListEl.innerHTML = dHtml || '<p style="color:var(--sub);text-align:center;padding:10px;">該日尚無飲食紀錄</p>';
  }

  // ⭐️ 運動清單
  const workoutListEl = document.getElementById('workoutLogList');
  if (workoutListEl) {
    let wHtml = '';
    workouts.forEach(w => {
      const displayType = w.type === 'custom_new' ? '🏃 自訂訓練' : w.type;
      wHtml += `<div class="log-item">
        <div class="log-info">
          <strong>${displayType}</strong> (${w.duration ? w.duration + '分鐘' : '無時長'}) ｜ <span style="color:#ef4444;font-weight:bold;">-${w.cal} kcal</span><br>
          <small style="color:var(--sub)">${w.note ? w.note : '無備註'}</small>
        </div>
        <div class="log-actions">
          <button class="action-btn btn-del" type="button" onclick="deleteWorkoutLog('${w.id}')">刪除</button>
        </div>
      </div>`;
    });
    workoutListEl.innerHTML = wHtml || '<p style="color:var(--sub);text-align:center;padding:10px;">該日尚無運動紀錄</p>';
  }
}
