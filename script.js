// --- นำ URL จาก Google Apps Script มาใส่ที่นี่ ---
const APPS_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbyfqDXDV5OtmF0MKy839Py00vRUFiLufwGUfNiqI2nbT6v27A1SHaZNUAlkMGs8k2q9Uw/exec';

let repairData = [];
let currentFilter = 'all';

// โหลดข้อมูลครั้งแรก
document.addEventListener('DOMContentLoaded', loadData);

async function loadData() {
  try {
    const response = await fetch(APPS_SCRIPT_URL);
    const data = await response.json();
    repairData = data;
    updateStats();
    renderList();
  } catch (error) {
    showToast('เชื่อมต่อฐานข้อมูลล้มเหลว', 'error');
    console.error(error);
  }
}

// จัดการ Submit ฟอร์ม
document.getElementById('repair-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const submitBtn = document.getElementById('submit-btn');
  const btnText = document.getElementById('submit-btn-text');
  const originalText = btnText.innerText;
  
  submitBtn.disabled = true;
  btnText.innerText = 'กำลังบันทึก...';

  const newRepair = {
    item_name: document.getElementById('item-name').value,
    description: document.getElementById('description').value,
    category: document.getElementById('category').value,
    priority: document.querySelector('input[name="priority"]:checked').value,
    status: 'pending',
    created_at: new Date().toISOString(),
    contact_name: document.getElementById('contact-name').value || '-',
    contact_phone: document.getElementById('contact-phone').value || '-'
  };

  try {
    const response = await fetch(`${APPS_SCRIPT_URL}?action=create`, {
      method: 'POST',
      body: JSON.stringify(newRepair),
      headers: { 'Content-Type': 'text/plain;charset=utf-8' } // ใช้ text/plain เลี่ยง CORS Preflight
    });
    
    const result = await response.json();
    
    if (result.success) {
      newRepair.id = result.id;
      repairData.unshift(newRepair); // เพิ่มเข้าใน array ทันทีไม่ต้องรอโหลดใหม่
      showToast('ส่งคำร้องซ่อมสำเร็จ!');
      document.getElementById('repair-form').reset();
      updateStats();
      renderList();
    } else {
      showToast('เกิดข้อผิดพลาดในการบันทึก', 'error');
    }
  } catch (error) {
    showToast('ไม่สามารถเชื่อมต่อเซิร์ฟเวอร์ได้', 'error');
  }

  submitBtn.disabled = false;
  btnText.innerText = originalText;
});

// อัปเดตสถิติ
function updateStats() {
  document.getElementById('stat-total').textContent = repairData.length;
  document.getElementById('stat-pending').textContent = repairData.filter(r => r.status === 'pending').length;
  document.getElementById('stat-progress').textContent = repairData.filter(r => r.status === 'in-progress').length;
  document.getElementById('stat-completed').textContent = repairData.filter(r => r.status === 'completed').length;
}

// เรนเดอร์รายการ
function renderList() {
  const container = document.getElementById('repair-list');
  let filteredData = repairData;
  
  if (currentFilter !== 'all') {
    filteredData = repairData.filter(r => r.status === currentFilter);
  }

  // เรียงลำดับจากใหม่ไปเก่า
  filteredData.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

  if (filteredData.length === 0) {
    container.innerHTML = `
      <div class="text-center py-12 text-white/40">
        <p>${currentFilter === 'all' ? 'ยังไม่มีรายการแจ้งซ่อม' : 'ไม่มีรายการในหมวดนี้'}</p>
        <p class="text-sm mt-1">เริ่มแจ้งซ่อมได้เลย!</p>
      </div>`;
    return;
  }

  container.innerHTML = '';
  filteredData.forEach((repair, index) => {
    container.appendChild(createRepairCard(repair, index));
  });
}

function createRepairCard(repair, index) {
  const card = document.createElement('div');
  card.dataset.id = repair.id;
  card.className = `bg-white/5 rounded-2xl p-4 border border-white/10 card-hover transition-all duration-300 animate-slide-in priority-${repair.priority}`;
  card.style.animationDelay = `${index * 0.05}s`;
  updateRepairCardContent(card, repair);
  return card;
}

function updateRepairCardContent(card, repair) {
  const statusLabels = {
    'pending': { label: 'รอดำเนินการ', class: 'status-pending' },
    'in-progress': { label: 'กำลังซ่อม', class: 'status-in-progress' },
    'completed': { label: 'เสร็จสิ้น', class: 'status-completed' }
  };
  const priorityLabels = { high: '🔴 เร่งด่วน', medium: '🟡 ปานกลาง', low: '🟢 ไม่เร่งด่วน' };
  const statusInfo = statusLabels[repair.status];
  const date = new Date(repair.created_at).toLocaleDateString('th-TH', { 
    day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' 
  });
  
  const isConfirming = card.dataset.confirming === 'true';

  card.innerHTML = `
    <div class="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
      <div class="flex-1 min-w-0">
        <div class="flex items-center gap-2 flex-wrap mb-2">
          <span class="px-3 py-1 rounded-full text-xs font-medium ${statusInfo.class}">${statusInfo.label}</span>
          <span class="text-xs text-white/40">${repair.category}</span>
          <span class="text-xs text-white/40">${priorityLabels[repair.priority]}</span>
        </div>
        <h3 class="text-lg font-semibold text-white truncate">${escapeHtml(repair.item_name)}</h3>
        <p class="text-white/60 text-sm mt-1 line-clamp-2">${escapeHtml(repair.description)}</p>
        <div class="flex items-center gap-4 mt-3 text-xs text-white/40">
          <span>📅 ${date}</span>
          ${repair.contact_name !== '-' ? `<span>👤 ${escapeHtml(repair.contact_name)}</span>` : ''}
          ${repair.contact_phone !== '-' ? `<span>📞 ${escapeHtml(repair.contact_phone)}</span>` : ''}
        </div>
      </div>
      <div class="flex sm:flex-col gap-2">
        ${repair.status !== 'completed' ? `
          <button onclick="updateStatus('${repair.id}', '${repair.status === 'pending' ? 'in-progress' : 'completed'}')"
            class="px-3 py-2 bg-blue-500/20 hover:bg-blue-500/40 text-blue-400 rounded-lg text-xs transition flex items-center gap-1">
            ${repair.status === 'pending' ? '🔧 เริ่มซ่อม' : '✅ เสร็จสิ้น'}
          </button>
        ` : ''}
        ${isConfirming ? `
          <div class="flex gap-1">
            <button onclick="confirmDelete('${repair.id}')" class="px-3 py-2 bg-red-500 hover:bg-red-600 text-white rounded-lg text-xs transition">ยืนยันลบ</button>
            <button onclick="cancelDelete('${repair.id}')" class="px-3 py-2 bg-white/10 hover:bg-white/20 text-white rounded-lg text-xs transition">ยกเลิก</button>
          </div>
        ` : `
          <button onclick="requestDelete('${repair.id}')" class="px-3 py-2 bg-red-500/20 hover:bg-red-500/40 text-red-400 rounded-lg text-xs transition flex items-center gap-1">
            🗑️ ลบ
          </button>
        `}
      </div>
    </div>
  `;
}

// อัปเดตสถานะ
async function updateStatus(id, newStatus) {
  const card = document.querySelector(`[data-id="${id}"]`);
  if (card) card.classList.add('loading-pulse');

  try {
    await fetch(`${APPS_SCRIPT_URL}?action=update`, {
      method: 'POST',
      body: JSON.stringify({ id, status: newStatus }),
      headers: { 'Content-Type': 'text/plain;charset=utf-8' }
    });
    
    const repair = repairData.find(r => r.id === id);
    if (repair) repair.status = newStatus;
    
    updateStats();
    renderList();
    showToast(newStatus === 'completed' ? 'ซ่อมเสร็จสิ้นแล้ว!' : 'เริ่มดำเนินการซ่อมแล้ว!');
  } catch (error) {
    showToast('เกิดข้อผิดพลาดในการอัปเดต', 'error');
  }
  if (card) card.classList.remove('loading-pulse');
}

// การจัดการการลบ
function requestDelete(id) {
  const card = document.querySelector(`[data-id="${id}"]`);
  if (card) {
    card.dataset.confirming = 'true';
    updateRepairCardContent(card, repairData.find(r => r.id === id));
  }
}

function cancelDelete(id) {
  const card = document.querySelector(`[data-id="${id}"]`);
  if (card) {
    card.dataset.confirming = 'false';
    updateRepairCardContent(card, repairData.find(r => r.id === id));
  }
}

async function confirmDelete(id) {
  const card = document.querySelector(`[data-id="${id}"]`);
  if (card) card.classList.add('loading-pulse');

  try {
    await fetch(`${APPS_SCRIPT_URL}?action=delete`, {
      method: 'POST',
      body: JSON.stringify({ id }),
      headers: { 'Content-Type': 'text/plain;charset=utf-8' }
    });
    
    repairData = repairData.filter(r => r.id !== id);
    updateStats();
    renderList();
    showToast('ลบรายการสำเร็จ!');
  } catch (error) {
    showToast('ลบไม่สำเร็จ กรุณาลองใหม่', 'error');
    if (card) card.classList.remove('loading-pulse');
  }
}

// ระบบ Filter
function filterByStatus(status) {
  currentFilter = status;
  document.querySelectorAll('.filter-btn').forEach(btn => {
    if (btn.dataset.status === status) {
      btn.className = 'filter-btn px-3 py-1.5 rounded-lg text-sm bg-white/20 text-white transition';
    } else {
      btn.className = 'filter-btn px-3 py-1.5 rounded-lg text-sm bg-white/10 text-white/60 hover:bg-white/20 transition';
    }
  });
  renderList();
}

// แสดง Toast Notification
function showToast(message, type = 'success') {
  const toast = document.getElementById('toast');
  const toastBg = toast.querySelector('div');
  document.getElementById('toast-message').textContent = message;
  
  toastBg.className = `${type === 'success' ? 'bg-green-500' : 'bg-red-500'} text-white px-6 py-3 rounded-xl shadow-lg flex items-center gap-2`;
  toast.classList.remove('translate-y-20', 'opacity-0');
  toast.classList.add('translate-y-0', 'opacity-100');
  
  setTimeout(() => {
    toast.classList.remove('translate-y-0', 'opacity-100');
    toast.classList.add('translate-y-20', 'opacity-0');
  }, 3000);
}

// ป้องกัน XSS Injection
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}
