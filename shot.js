// Mojo Project
function saveShot() {
  const shot = {
    date: document.getElementById('shotDate').value,
    dose: document.getElementById('shotDose').value,
    note: document.getElementById('shotNote').value
  };
  const list = window.MojoState.shotLogs || [];
  list.unshift(shot);
  window.MojoState.shotLogs = list;
  localStorage.setItem('my_shot_logs', JSON.stringify(list));
  uploadToCloud('SHOT', shot);
  alert('猛健樂紀錄已儲存！');
  renderShotList();
}

function editShotLog(index) {
  const list = window.MojoState.shotLogs || [];
  const s = list[index];
  if (!s) return;
  const newDate = prompt('修改施打日期 (YYYY-MM-DD)：', s.date || '');
  if (newDate === null) return;
  const newDose = prompt('修改施打劑量（如：2.5mg, 5.0mg）：', s.dose || '2.5mg');
  if (newDose === null) return;
  const newNote = prompt('修改施打部位/備註：', s.note || '');
  if (newNote === null) return;

  list[index].date = newDate.trim();
  list[index].dose = newDose.trim();
  list[index].note = newNote.trim();

  localStorage.setItem('my_shot_logs', JSON.stringify(list));
  uploadToCloud('SHOT', list[index]);
  renderShotList();
}

function deleteShotLog(index) {
  if (confirm('確定要刪除這筆施打紀錄嗎？')) {
    const list = window.MojoState.shotLogs || [];
    list.splice(index, 1);
    localStorage.setItem('my_shot_logs', JSON.stringify(list));
    renderShotList();
  }
}

function renderShotList() {
  const shotContainer = document.getElementById('shotLogList');
  if (!shotContainer) return;
  let shotHtml = '';
  const curShots = window.MojoState.shotLogs || [];
  curShots.forEach((s, idx) => {
    shotHtml += `<div class="log-item">
      <div class="log-info">
        <strong>💉 猛健樂施打</strong> <small style="color:var(--sub)">${s.date}</small><br>
        <small>${s.note || '無備註'}</small>
      </div>
      <div class="log-actions">
        <span class="badge badge-shot">${s.dose}</span>
        <button class="action-btn btn-edit" type="button" onclick="editShotLog(${idx})">編輯</button>
        <button class="action-btn btn-del" type="button" onclick="deleteShotLog(${idx})">刪除</button>
      </div>
    </div>`;
  });
  shotContainer.innerHTML = shotHtml || '<p style="color:var(--sub);text-align:center;padding:10px;">尚未有施打紀錄</p>';
}
