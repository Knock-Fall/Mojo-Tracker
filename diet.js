// --- 水分與飲食狀態 ---
let hydrationState = {
  pure: 500,
  tea: 250,
  target: 2884
};

let dietLogs = [
  { id: 1, meal: '午餐', content: '滷肉紫米飯（已食用約2/3碗）', cal: 225, pro: 6.5, carb: 31.0, fat: 8.0, fiber: 1.5 },
  { id: 2, meal: '午餐', content: '自助餐拼盤（醬燒排骨、炒青菜、滷肉燥、炒豆乾絲、蒸南瓜、炸雞塊）1盤', cal: 650, pro: 38.0, carb: 32.0, fat: 40.0, fiber: 6.5 },
  { id: 3, meal: '早餐', content: '鮪魚蛋兩份', cal: 410, pro: 31.5, carb: 7.5, fat: 28.0, fiber: 0.2 },
  { id: 4, meal: '早餐', content: '綠茶蛋白飲', cal: 144, pro: 28.0, carb: 2.6, fat: 2.4, fiber: 0.0 }
];

// --- 圖片預覽 ---
window.previewAndAnalyze = function(input) {
  if (input.files && input.files[0]) {
    const reader = new FileReader();
    reader.onload = function(e) {
      const preview = document.getElementById('foodImagePreview');
      preview.src = e.target.result;
      preview.style.display = 'block';
      document.getElementById('aiBtn').style.display = 'block';
    };
    reader.readAsDataURL(input.files[0]);
  }
};

// --- 水分累計 (純水與茶雙軌) ---
window.addWater = function(type, amount) {
  if (type === 'pure') hydrationState.pure += amount;
  if (type === 'tea') hydrationState.tea += amount;
  updateHydrationUI();
};

window.resetWater = function() {
  hydrationState.pure = 0;
  hydrationState.tea = 0;
  updateHydrationUI();
};

function updateHydrationUI() {
  const total = hydrationState.pure + hydrationState.tea;
  const target = hydrationState.target;
  const remain = Math.max(target - total, 0);

  document.getElementById('waterCurrentTxt').innerText = total;
  document.getElementById('waterTargetTxt').innerText = target;
  document.getElementById('waterRemainTxt').innerText = `剩餘：${remain} ml`;

  const purePct = Math.min((hydrationState.pure / target) * 100, 100);
  const teaPct = Math.min((hydrationState.tea / target) * 100, 100 - purePct);

  document.getElementById('waterPureBar').style.width = purePct + '%';
  document.getElementById('waterTeaBar').style.width = teaPct + '%';
}

// --- AI 辨識分析 (修復脂肪與纖維自動填入 + 容錯機制) ---
window.analyzeFoodImage = function() {
  const btn = document.getElementById('aiBtn');
  const hint = document.getElementById('aiHintText').value;
  btn.disabled = true;
  btn.innerText = '✨ AI 分析中...';

  setTimeout(() => {
    // 模擬 AI 回傳格式，並支援各種欄位別名
    const aiResponse = {
      food_name: hint || "鮪魚蛋（兩份）",
      calories: 480,
      protein: 34.5,
      carbs: 10.5,
      total_fat: 22.0,      // 容錯別名：fat / total_fat
      dietary_fiber: 1.2    // 容錯別名：fiber / dietary_fiber
    };

    // 寬鬆提取
    const fatVal = aiResponse.fat ?? aiResponse.total_fat ?? aiResponse.lipid ?? 0;
    const fiberVal = aiResponse.fiber ?? aiResponse.dietary_fiber ?? 0;

    // 自動填入對應的輸入框
    document.getElementById('dietContent').value = aiResponse.food_name;
    document.getElementById('dietCal').value = aiResponse.calories || 0;
    document.getElementById('dietProtein').value = aiResponse.protein || 0;
    document.getElementById('dietCarbs').value = aiResponse.carbs || 0;
    document.getElementById('dietFat').value = fatVal;
    document.getElementById('dietFiber').value = fiberVal;

    btn.disabled = false;
    btn.innerText = '✨ 開始 AI 分析熱量與五大營養';
  }, 700);
};

// --- 飲食紀錄增刪改 ---
window.saveDiet = function() {
  const meal = document.getElementById('dietMeal').value;
  const content = document.getElementById('dietContent').value;
  const cal = parseFloat(document.getElementById('dietCal').value) || 0;
  const pro = parseFloat(document.getElementById('dietProtein').value) || 0;
  const carb = parseFloat(document.getElementById('dietCarbs').value) || 0;
  const fat = parseFloat(document.getElementById('dietFat').value) || 0;
  const fiber = parseFloat(document.getElementById('dietFiber').value) || 0;

  if (!content.trim()) {
    alert('請輸入食物內容！');
    return;
  }

  dietLogs.unshift({
    id: Date.now(),
    meal,
    content,
    cal,
    pro,
    carb,
    fat,
    fiber
  });

  renderDietLogs();
  updateNutritionTotals();

  // 清空輸入框
  document.getElementById('dietContent').value = '';
  document.getElementById('dietCal').value = '';
  document.getElementById('dietProtein').value = '';
  document.getElementById('dietCarbs').value = '';
  document.getElementById('dietFat').value = '';
  document.getElementById('dietFiber').value = '';
};

window.deleteDiet = function(id) {
  dietLogs = dietLogs.filter(d => d.id !== id);
  renderDietLogs();
  updateNutritionTotals();
};

window.editDiet = function(id) {
  const item = dietLogs.find(d => d.id === id);
  if (!item) return;
  document.getElementById('dietMeal').value = item.meal;
  document.getElementById('dietContent').value = item.content;
  document.getElementById('dietCal').value = item.cal;
  document.getElementById('dietProtein').value = item.pro;
  document.getElementById('dietCarbs').value = item.carb;
  document.getElementById('dietFat').value = item.fat;
  document.getElementById('dietFiber').value = item.fiber;
};

function renderDietLogs() {
  const container = document.getElementById('dietLogList');
  if (!container) return;
  container.innerHTML = '';

  dietLogs.forEach(d => {
    const div = document.createElement('div');
    div.className = 'log-item';
    div.innerHTML = `
      <div>
        <div style="font-weight: 700; font-size: 0.9rem; color: #1e293b;">
          [${d.meal}] ${d.content}
        </div>
        <div style="font-size: 0.75rem; color: var(--sub); margin-top: 3px;">
          ${d.cal} kcal | 蛋 ${d.pro}g | 碳 ${d.carb}g | 脂 ${d.fat}g | 纖 ${d.fiber}g
        </div>
      </div>
      <div style="display: flex; gap: 4px;">
        <button class="action-btn btn-edit" type="button" onclick="editDiet(${d.id})">編輯</button>
        <button class="action-btn btn-del" type="button" onclick="deleteDiet(${d.id})">刪除</button>
      </div>
    `;
    container.appendChild(div);
  });
}

function updateNutritionTotals() {
  const totals = dietLogs.reduce((acc, cur) => {
    acc.cal += cur.cal;
    acc.pro += cur.pro;
    acc.carb += cur.carb;
    acc.fat += cur.fat;
    acc.fiber += cur.fiber;
    return acc;
  }, { cal: 0, pro: 0, carb: 0, fat: 0, fiber: 0 });

  // 渲染五大營養素進度
  document.getElementById('calText').innerText = `${totals.cal.toFixed(0)} / 1807 kcal`;
  document.getElementById('proText').innerText = `${totals.pro.toFixed(1)} / 132 g`;
  document.getElementById('carbText').innerText = `${totals.carb.toFixed(1)} / 165 g`;
  document.getElementById('fatText').innerText = `${totals.fat.toFixed(1)} / 49 g`;
  document.getElementById('fiberText').innerText = `${totals.fiber.toFixed(1)} / 28 g`;

  // 赤字計算
  const tdee = 2307;
  const deficit = Math.round(totals.cal - tdee);
  document.getElementById('displayDeficit').innerText = `${deficit} / -500 kcal`;
}
