// Mojo Project
// workout.js (MK-80978: 獨立運動管理模組 - 選單、自訂項目、消耗記錄、編輯平滑切換)

let editingWorkoutId = null; // 記錄當前正在編輯的運動 ID

// 自訂運動項目介面切換
function handleWorkoutSelectChange(selectEl) {
  const box = document.getElementById('newWorkoutItemBox');
  if (selectEl.value === 'custom_new') {
    box.style.display = 'block';
    const nameInput = document.getElementById('newWorkoutNameInput');
    if (nameInput) nameInput.focus();
  } else {
    box.style.display = 'none';
  }
}

// 新增自訂運動項目
function addNewWorkoutCategory() {
  const input = document.getElementById('newWorkoutNameInput');
  const name = input.value.trim();
  if (!name) return alert('請輸入運動名稱');

  const displayName = name.startsWith('🏃') || name.startsWith('🏋️') || name.startsWith('🚴') || name.startsWith('🚶') || name.startsWith('🏊') || name.startsWith('⚡') ? name : `🏃 ${name}`;

  let list = JSON.parse(localStorage.getItem('custom_workout_types') || '[]');
  if (!list.includes(displayName)) {
    list.push(displayName);
    localStorage.setItem('custom_workout_types', JSON.stringify(list));
  }
  input.value = '';
  document.getElementById('newWorkoutItemBox').style.display = 'none';
  initWorkoutOptions(displayName);
}

// 初始化運動選單（完整 Emoji 圖示）
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

// 運動紀錄儲存（支援新增與平滑編輯更新）
function saveWorkout() {
  const dStr = (typeof getSelectedDietDate === 'function') ? getSelectedDietDate() : getLocalTodayStr();
  const selectEl = document.getElementById('workoutTypeSelect');
  let type = selectEl.value;

  // 防呆：如果停在 custom_new，自動採用輸入框中的自訂文字
  if (type === 'custom_new') {
    const customNameInput = document.getElementById('newWorkoutNameInput').value.trim();
    if (!customNameInput) {
      return alert('請先在下方輸入自訂運動名稱，或點擊「儲存項目」！');
    }
    type = customNameInput.startsWith('🏃') || customNameInput.startsWith('🏋️') || customNameInput.startsWith('🚴') || customNameInput.startsWith('🚶') || customNameInput.startsWith('🏊') || customNameInput.startsWith('⚡') ? customNameInput : `🏃 ${customNameInput}`;
    
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

  let list = window.MojoState.workoutLogs || [];

  if (editingWorkoutId) {
    const idx = list.findIndex(w => w.id === editingWorkoutId);
    if (idx !== -1) {
      list[idx].type = type;
      list[idx].duration = duration;
      list[idx].cal = cal;
      list[idx].note = note;
      if (typeof uploadToCloud === 'function') uploadToCloud('WORKOUT', list[idx]);
    }
    editingWorkoutId = null;
    const submitBtn = document.getElementById('btnSaveWorkoutSubmit');
    if (submitBtn) {
      submitBtn.innerText = '記錄本次運動消耗';
      submitBtn.style.background = '#6366f1';
    }
  } else {
    const item = {
      id: Date.now().toString(),
      date: dStr,
      type,
      duration,
      cal,
      note
    };
    list.push(item);
    if (typeof uploadToCloud === 'function') uploadToCloud('WORKOUT', item);
  }

  window.MojoState.workoutLogs = list;
  localStorage.setItem('my_workout_logs', JSON.stringify(list));

  document.getElementById('workoutDuration').value = '';
  document.getElementById('workoutCal').value = '';
  document.getElementById('workoutNote').value = '';

  if (typeof renderDiet === 'function') renderDiet();
}

// 運動編輯回填函式（平滑切換更新按鈕狀態）
function editWorkoutLog(id) {
  const list = window.MojoState.workoutLogs || [];
  const item = list.find(w => w.id === id);
  if (!item) return;

  editingWorkoutId = id;
  initWorkoutOptions(item.type);
  document.getElementById('workoutDuration').value = item.duration || '';
  document.getElementById('workoutCal').value = item.cal || '';
  document.getElementById('workoutNote').value = item.note || '';

  const submitBtn = document.getElementById('btnSaveWorkoutSubmit');
  if (submitBtn) {
    submitBtn.innerText = '💾 更新此筆運動消耗';
    submitBtn.style.background = '#4338ca';
  }

  document.getElementById('workoutCal').focus();
  document.getElementById('workoutCal').scrollIntoView({ behavior: 'smooth', block: 'center' });
}

// 運動刪除
function deleteWorkoutLog(id) {
  if (confirm('確定要刪除這筆運動紀錄？')) {
    let list = window.MojoState.workoutLogs || [];
    list = list.filter(w => w.id !== id);
    if (editingWorkoutId === id) {
      editingWorkoutId = null;
      const submitBtn = document.getElementById('btnSaveWorkoutSubmit');
      if (submitBtn) {
        submitBtn.innerText = '記錄本次運動消耗';
        submitBtn.style.background = '#6366f1';
      }
    }
    window.MojoState.workoutLogs = list;
    localStorage.setItem('my_workout_logs', JSON.stringify(list));
    if (typeof renderDiet === 'function') renderDiet();
  }
}

// 運動明細清單渲染（支援編輯與刪除按鈕）
function renderWorkoutList(dStr) {
  const workoutListEl = document.getElementById('workoutLogList');
  if (!workoutListEl) return;

  const workouts = (window.MojoState.workoutLogs || []).filter(w => w.date === dStr);
  let wHtml = '';
  workouts.forEach(w => {
    const displayType = w.type === 'custom_new' ? '🏃 自訂訓練' : w.type;
    wHtml += `<div class="log-item">
      <div class="log-info">
        <strong>${displayType}</strong> (${w.duration ? w.duration + '分鐘' : '無時長'}) ｜ <span style="color:#ef4444;font-weight:bold;">-${w.cal} kcal</span><br>
        <small style="color:var(--sub)">${w.note ? w.note : '無備註'}</small>
      </div>
      <div class="log-actions">
        <button class="action-btn btn-edit" type="button" onclick="editWorkoutLog('${w.id}')">編輯</button>
        <button class="action-btn btn-del" type="button" onclick="deleteWorkoutLog('${w.id}')">刪除</button>
      </div>
    </div>`;
  });
  workoutListEl.innerHTML = wHtml || '<p style="color:var(--sub);text-align:center;padding:10px;">該日尚無運動紀錄</p>';
}
