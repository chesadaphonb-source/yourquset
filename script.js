// --- 1. ตั้งค่า URL (ใช้ตัวล่าสุดของคุณ) ---
const APPS_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbyjYr2MqNQlK3fE4uOGqhiy5-oG7i7OzKrMftG5RAfTCgj2yxuB09zYyTagji6PHHXePw/exec';

let repairData = [];
let currentFilter = 'all';

// --- 2. เริ่มต้นระบบเมื่อโหลดหน้าเว็บ ---
document.addEventListener('DOMContentLoaded', () => {
    // ดึงข้อมูลจากฐานข้อมูลทันที
    loadData();

    // จัดรูปแบบเบอร์โทร 000-000-0000 อัตโนมัติ
    const phoneInput = document.getElementById('contact-phone');
    if (phoneInput) {
        phoneInput.addEventListener('input', function (e) {
            let value = e.target.value.replace(/\D/g, ''); 
            if (value.length > 10) value = value.slice(0, 10);
            
            let formattedValue = '';
            if (value.length > 0) {
                formattedValue = value.substring(0, 3);
                if (value.length > 3) formattedValue += '-' + value.substring(3, 6);
                if (value.length > 6) formattedValue += '-' + value.substring(6, 10);
            }
            e.target.value = formattedValue;
        });
    }
});

// --- 3. ฟังก์ชันดึงข้อมูลจาก Google Sheets ---
async function loadData() {
    const container = document.getElementById('repair-list');
    try {
        const response = await fetch(APPS_SCRIPT_URL);
        const data = await response.json();
        repairData = data;
        updateStats();
        renderList();
    } catch (error) {
        showToast('เชื่อมต่อฐานข้อมูลล้มเหลว', 'error');
        container.innerHTML = `<div class="text-center py-12 text-red-400">ไม่สามารถโหลดข้อมูลได้ กรุณารีเฟรชหน้าเว็บ</div>`;
        console.error(error);
    }
}

// --- 4. จัดการส่งฟอร์มแจ้งซ่อม ---
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
            headers: { 'Content-Type': 'text/plain;charset=utf-8' }
        });
        
        const result = await response.json();
        
        if (result.success) {
            newRepair.id = result.id;
            repairData.unshift(newRepair); 
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

// --- 5. การแสดงผลและ UI ---
function updateStats() {
    document.getElementById('stat-total').textContent = repairData.length;
    document.getElementById('stat-pending').textContent = repairData.filter(r => r.status === 'pending').length;
    document.getElementById('stat-progress').textContent = repairData.filter(r => r.status === 'in-progress').length;
    document.getElementById('stat-completed').textContent = repairData.filter(r => r.status === 'completed').length;
}

function renderList() {
    const container = document.getElementById('repair-list');
    let filteredData = [...repairData]; // ใช้ Spread operator เพื่อไม่ให้กระทบข้อมูลหลักตอน Sort
    
    if (currentFilter !== 'all') {
        filteredData = filteredData.filter(r => r.status === currentFilter);
    }

    // เรียงจากใหม่ไปเก่า (เช็คกรณีวันที่เป็น String ภาษาไทย)
    //filteredData.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

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
        const card = document.createElement('div');
        card.dataset.id = repair.id;
        card.className = `bg-white/5 rounded-2xl p-4 border border-white/10 card-hover transition-all duration-300 animate-slide-in priority-${repair.priority}`;
        card.style.animationDelay = `${index * 0.05}s`;
        updateRepairCardContent(card, repair);
        container.appendChild(card);
    });
}

function updateRepairCardContent(card, repair) {
    if (!repair || !repair.status) return;

    const statusLabels = {
        'pending': { label: 'รอดำเนินการ', class: 'status-pending' },
        'in-progress': { label: 'กำลังซ่อม', class: 'status-in-progress' },
        'completed': { label: 'เสร็จสิ้น', class: 'status-completed' }
    };

    const statusInfo = statusLabels[repair.status] || { label: 'ไม่ทราบสถานะ', class: 'bg-slate-500' };
    const priorityLabels = { high: '🔴 เร่งด่วน', medium: '🟡 ปานกลาง', low: '🟢 ไม่เร่งด่วน' };
    
    let displayDate = repair.created_at || 'ไม่ระบุวันที่';
    const isConfirming = card.dataset.confirming === 'true';

    card.innerHTML = `
        <div class="flex flex-col sm:flex-row sm:items-start justify-between gap-3 text-left">
          <div class="flex-1 min-w-0">
            <div class="flex items-center gap-2 flex-wrap mb-2">
              <span class="px-3 py-1 rounded-full text-xs font-medium ${statusInfo.class}">${statusInfo.label}</span>
              <span class="text-xs text-white/40">${repair.category || 'ทั่วไป'}</span>
              <span class="text-xs text-white/40">${priorityLabels[repair.priority] || '🟡 ปานกลาง'}</span>
            </div>
            <h3 class="text-lg font-semibold text-white truncate">${escapeHtml(repair.item_name)}</h3>
            <p class="text-white/60 text-sm mt-1 line-clamp-2">${escapeHtml(repair.description)}</p>
            <div class="flex items-center gap-4 mt-3 text-xs text-white/40">
              <span>📅 ${displayDate}</span>
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
                <button onclick="confirmDelete('${repair.id}')" class="px-3 py-2 bg-red-500 hover:bg-red-600 text-white rounded-lg text-xs transition">ยืนยัน</button>
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

// --- 6. ฟังก์ชันจัดการสถานะและการลบ ---
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
    }
}

// --- 7. ฟังก์ชันเสริม (Filter, Toast, Escape) ---
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

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}
