/**
 * antrian.js — Antrian management + real-time kalkulasi
 */
import api from './api.js';
import { showToast, formatRupiah, escHtml, formatTime, openModal, closeModal } from './utils.js';

let antrianList  = [];
let menuList     = [];
let selectedMenus = {}; // { menu_id: jumlah }
let currentAntrianForPayment = null;

/* === Load Antrian === */
export async function loadAntrian() {
    antrianList = await api.getAntrian();
    renderAntrian();
    return antrianList;
}

function renderAntrian() {
    const container = document.getElementById('antrian-list');
    if (!container) return;

    if (antrianList.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                    <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/>
                    <circle cx="9" cy="7" r="4"/>
                    <path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75"/>
                </svg>
                <p>Belum ada antrian aktif saat ini.</p>
            </div>`;
        return;
    }

    container.innerHTML = antrianList.map(a => antrianCardHTML(a)).join('');

    // Bind events
    container.querySelectorAll('.btn-bayar').forEach(btn => {
        btn.addEventListener('click', () => openPaymentModal(parseInt(btn.dataset.id)));
    });
    container.querySelectorAll('.btn-selesai').forEach(btn => {
        btn.addEventListener('click', () => selesaikanAntrian(parseInt(btn.dataset.id)));
    });
}

function antrianCardHTML(antrian) {
    const menuItems = antrian.menus.map(m => `
        <div class="order-item">
            <span class="order-item-name">
                <span class="order-qty">x${m.jumlah}</span>
                ${escHtml(m.nama)}
            </span>
            <span class="order-item-price">${formatRupiah(m.harga * m.jumlah)}</span>
        </div>`).join('');

    return `
        <div class="antrian-card" id="antrian-${antrian.id}">
            <div class="antrian-card-header">
                <div class="queue-number">${antrian.nomor_antrian}</div>
                <div class="customer-info">
                    <div class="customer-name">${escHtml(antrian.nama_pelanggan)}</div>
                    <div class="customer-time">${antrian.menus.length} item &mdash; ${antrian.created_at ? formatTime(antrian.created_at) : ''}</div>
                </div>
            </div>
            <div class="antrian-card-body">
                <div class="order-items">${menuItems}</div>
                <div class="antrian-total-row">
                    <span class="antrian-total-label">Total</span>
                    <span class="antrian-total-value rupiah">${formatRupiah(antrian.total)}</span>
                </div>
            </div>
            <div class="antrian-card-footer">
                <button class="btn btn-success btn-sm flex-1 btn-bayar" data-id="${antrian.id}">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <rect x="1" y="4" width="22" height="16" rx="2" ry="2"/>
                        <line x1="1" y1="10" x2="23" y2="10"/>
                    </svg>
                    Bayar QRIS
                </button>
                <button class="btn btn-ghost btn-sm btn-selesai" data-id="${antrian.id}" title="Selesaikan tanpa bayar">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <polyline points="20 6 9 17 4 12"/>
                    </svg>
                    Selesai
                </button>
            </div>
        </div>`;
}

/* === Load Menu untuk form Tambah Antrian === */
export async function loadMenuForForm() {
    menuList = await api.getMenu();
    renderMenuSelectList();
}

function renderMenuSelectList() {
    const makanan = menuList.filter(m => m.kategori === 'makanan');
    const minuman = menuList.filter(m => m.kategori === 'minuman');

    const container = document.getElementById('menu-select-group');
    if (!container) return;

    const renderGroup = (title, items) => {
        if (items.length === 0) return '';
        return `
            <div style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.08em;color:var(--color-text-dim);margin:8px 0 4px;">${title}</div>
            ${items.map(m => menuSelectItemHTML(m)).join('')}`;
    };

    container.innerHTML = renderGroup('Makanan', makanan) + renderGroup('Minuman', minuman);

    if (container.innerHTML.trim() === '') {
        container.innerHTML = '<p class="text-muted text-sm" style="padding:8px 0;">Belum ada menu. Tambahkan menu terlebih dahulu.</p>';
        return;
    }

    // Bind click
    container.querySelectorAll('.menu-select-item').forEach(item => {
        item.addEventListener('click', () => toggleMenuSelect(item));
        item.querySelector('.qty-minus').addEventListener('click', e => { e.stopPropagation(); changeQty(item, -1); });
        item.querySelector('.qty-plus').addEventListener('click',  e => { e.stopPropagation(); changeQty(item, +1); });
    });
}

function menuSelectItemHTML(menu) {
    return `
        <div class="menu-select-item" data-id="${menu.id}" data-harga="${menu.harga}" data-nama="${escHtml(menu.nama)}">
            <div class="menu-check">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><path d="M20 6L9 17l-5-5"/></svg>
            </div>
            <div class="menu-select-info">
                <div class="menu-select-name">${escHtml(menu.nama)}</div>
                <div class="menu-select-price">${formatRupiah(menu.harga)}</div>
            </div>
            <div class="menu-select-qty">
                <button class="qty-btn qty-minus">−</button>
                <span class="qty-display">1</span>
                <button class="qty-btn qty-plus">+</button>
            </div>
        </div>`;
}

function toggleMenuSelect(item) {
    const id    = parseInt(item.dataset.id);
    const harga = parseFloat(item.dataset.harga);

    if (item.classList.contains('selected')) {
        item.classList.remove('selected');
        delete selectedMenus[id];
    } else {
        item.classList.add('selected');
        const qty = parseInt(item.querySelector('.qty-display').textContent);
        selectedMenus[id] = { jumlah: qty, harga };
    }
    updateOrderSummary();
}

function changeQty(item, delta) {
    const qtyEl = item.querySelector('.qty-display');
    let qty = Math.max(1, parseInt(qtyEl.textContent) + delta);
    qtyEl.textContent = qty;

    const id = parseInt(item.dataset.id);
    if (selectedMenus[id]) {
        selectedMenus[id].jumlah = qty;
    }
    updateOrderSummary();
}

function updateOrderSummary() {
    const ids = Object.keys(selectedMenus);
    const totalEl   = document.getElementById('order-total');
    const summaryEl = document.getElementById('order-summary');

    if (!totalEl) return;

    if (ids.length === 0) {
        if (summaryEl) summaryEl.classList.add('hidden');
        return;
    }

    const total = ids.reduce((sum, id) => {
        const m = selectedMenus[id];
        return sum + m.harga * m.jumlah;
    }, 0);

    totalEl.textContent = formatRupiah(total);
    if (summaryEl) summaryEl.classList.remove('hidden');

    const itemsEl = document.getElementById('order-items-preview');
    if (itemsEl) {
        itemsEl.innerHTML = ids.map(id => {
            const m = selectedMenus[id];
            const menu = menuList.find(mn => mn.id === parseInt(id));
            return `<div class="order-summary-row">
                <span>${escHtml(menu?.nama || '')} ×${m.jumlah}</span>
                <span>${formatRupiah(m.harga * m.jumlah)}</span>
            </div>`;
        }).join('');
    }
}

/* === Tambah Antrian === */
export function openAddAntrianModal() {
    selectedMenus = {};
    document.getElementById('input-nama-pelanggan').value = '';
    document.querySelectorAll('.menu-select-item').forEach(el => {
        el.classList.remove('selected');
        el.querySelector('.qty-display').textContent = '1';
    });
    const summaryEl = document.getElementById('order-summary');
    if (summaryEl) summaryEl.classList.add('hidden');
    openModal('antrian');
}

export async function submitAntrian() {
    const nama = document.getElementById('input-nama-pelanggan').value.trim();
    if (!nama) { showToast('Nama pelanggan wajib diisi.', 'error'); return; }

    const ids = Object.keys(selectedMenus);
    if (ids.length === 0) { showToast('Pilih minimal 1 menu.', 'error'); return; }

    const menus = ids.map(id => ({
        menu_id: parseInt(id),
        jumlah:  selectedMenus[id].jumlah,
    }));

    const btnSubmit = document.getElementById('btn-submit-antrian');
    if (btnSubmit) { btnSubmit.disabled = true; btnSubmit.textContent = 'Menyimpan...'; }

    try {
        await api.createAntrian({ nama_pelanggan: nama, menus });
        showToast('Antrian berhasil ditambahkan.', 'success');
        closeModal('antrian');
        await loadAntrian();
    } catch (err) {
        showToast(err.message, 'error');
    } finally {
        if (btnSubmit) { btnSubmit.disabled = false; btnSubmit.textContent = 'Tambah Antrian'; }
    }
}

/* === Payment (QRIS) === */
function openPaymentModal(antrianId) {
    currentAntrianForPayment = antrianList.find(a => a.id === antrianId);
    if (!currentAntrianForPayment) return;

    document.getElementById('qris-amount').textContent   = formatRupiah(currentAntrianForPayment.total);
    document.getElementById('qris-customer').textContent = currentAntrianForPayment.nama_pelanggan;

    import('./qris.js').then(({ generateQR }) => {
        generateQR(currentAntrianForPayment.total);
    });

    openModal('qris');
}

export async function konfirmasiPembayaran() {
    if (!currentAntrianForPayment) return;

    const btn = document.getElementById('btn-konfirmasi-bayar');
    if (btn) { btn.disabled = true; btn.textContent = 'Memproses...'; }

    try {
        await api.createTransaksi({
            antrian_id: currentAntrianForPayment.id,
            total:      currentAntrianForPayment.total,
            bayar_via:  'QRIS',
        });
        showToast('Pembayaran berhasil dikonfirmasi!', 'success');
        closeModal('qris');
        currentAntrianForPayment = null;
        await loadAntrian();
    } catch (err) {
        showToast(err.message, 'error');
    } finally {
        if (btn) {
            btn.disabled = false;
            btn.innerHTML = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 6L9 17l-5-5"/></svg> Konfirmasi Bayar`;
        }
    }
}

async function selesaikanAntrian(id) {
    if (!confirm('Selesaikan antrian ini tanpa pembayaran QRIS?')) return;
    try {
        await api.deleteAntrian(id);
        showToast('Antrian diselesaikan.', 'success');
        await loadAntrian();
    } catch (err) {
        showToast(err.message, 'error');
    }
}

window.antrian = { loadAntrian, loadMenuForForm, openAddAntrianModal, submitAntrian, konfirmasiPembayaran };
export { antrianList };
