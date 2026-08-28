// --- 分頁切換 ---
window.switchMainTab = function(tabName, el) {
  const bodyContent = document.getElementById('tabContentBody');
  const dietContent = document.getElementById('tabContentDiet');
  const btns = document.querySelectorAll('.nav-tabs .tab-btn');

  btns.forEach(b => b.classList.remove('active'));
  el.classList.add('active');

  if (tabName === 'body') {
    bodyContent.style.display = 'block';
    dietContent.style.display = 'none';
  } else {
    bodyContent.style.display = 'none';
    dietContent.style.display = 'block';
  }
};

// --- 金鑰與雲端同調管理 ---
window.openApiKeyModal = function() {
  const key = prompt('請輸入 Gemini / OpenAI API Key：', localStorage.getItem('ai_api_key') || '');
  if (key !== null) {
    localStorage.setItem('ai_api_key', key.trim());
    alert('API Key 儲存成功！');
  }
};

window.setupSecretToken = function() {
  const token = prompt('請輸入 Google Apps Script Secret Token：', localStorage.getItem('gas_secret_token') || '');
  if (token !== null) {
    localStorage.setItem('gas_secret_token', token.trim());
    alert('金鑰已設定完成！');
  }
};

window.syncFromCloud = function() {
  alert('正在與 Google 試算表同步資料...');
};
