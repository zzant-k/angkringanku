/**
 * menu.js — CRUD menu logic
 */
import api from './api.js';
import { showToast, escHtml, formatRupiah, openModal, closeModal } from './utils.js';

let allMenus  = [];
let editingId = null;

/* === Load & Render === */
export async function loadMenus() {
    allMenus = await api.getMenu();
    renderMenus(allMenus);
    return allMenus;
}

function renderMenus(menus) {
    const container = document.getElementById('menu-list');
    if (!container) return;

    if (menus.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                    <path d="M12 6v6m0 0v6m0-6h6m-6 0H6"/>
                </svg>
                <p>Belum ada menu. Tambahkan menu pertama!</p>
            </div>`;
        return;
    }

    const makanan = menus.filter(m => m.kategori === 'makanan');
    const minuman = menus.filter(m => m.kategori === 'minuman');

    container.innerHTML = '';
    if (makanan.length > 0) container.appendChild(buildCategorySection('makanan', makanan));
    if (minuman.length > 0) container.appendChild(buildCategorySection('minuman', minuman));
}

function buildCategorySection(kategori, items) {
    const iconMakanan = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 3a9 9 0 110 18A9 9 0 0112 3z"/><path d="M8 12h8M12 8v8"/></svg>`;
    const iconMinuman = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M8 3v4l-2 4a6 6 0 1012 0l-2-4V3"/><path d="M8 3h8"/></svg>`;

    const section = document.createElement('div');
    section.className = 'category-section';
    section.dataset.kategori = kategori;

    section.innerHTML = `
        <div class="category-header">
            <div class="category-header-icon ${kategori}">
                ${kategori === 'makanan' ? iconMakanan : iconMinuman}
            </div>
            <span class="category-label">${kategori === 'makanan' ? 'Makanan' : 'Minuman'}</span>
            <span class="category-count">${items.length} item</span>
        </div>
        <div class="menu-list">
            ${items.map(menuItemHTML).join('')}
        </div>`;

    section.querySelectorAll('.btn-edit-menu').forEach(btn => {
        btn.addEventListener('click', () => openEditModal(parseInt(btn.dataset.id)));
    });
    section.querySelectorAll('.btn-delete-menu').forEach(btn => {
        btn.addEventListener('click', () => deleteMenu(parseInt(btn.dataset.id)));
    });

    return section;
}

function menuItemHTML(menu) {
    return `
        <div class="menu-item" id="menu-item-${menu.id}">
            <div class="menu-item-body">
                <div class="menu-item-name">${escHtml(menu.nama)}</div>
                <div class="menu-item-price rupiah">${formatRupiah(menu.harga)}</div>
            </div>
            <div class="menu-item-actions">
                <button class="btn btn-ghost btn-sm btn-icon btn-edit-menu" data-id="${menu.id}" title="Edit">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/>
                        <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/>
                    </svg>
                </button>
                <button class="btn btn-danger btn-sm btn-icon btn-delete-menu" data-id="${menu.id}" title="Hapus">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <polyline points="3 6 5 6 21 6"/>
                        <path d="M19 6l-1 14H6L5 6"/>
                        <path d="M10 11v6M14 11v6"/>
                        <path d="M9 6V4h6v2"/>
                    </svg>
                </button>
            </div>
        </div>`;
}

/* === Filter === */
export function filterMenus(kategori) {
    if (kategori === 'semua') {
        renderMenus(allMenus);
    } else {
        renderMenus(allMenus.filter(m => m.kategori === kategori));
    }
}

/* === Tambah / Edit === */
export function openAddModal() {
    editingId = null;
    resetForm();
    document.getElementById('modal-title').textContent = 'Tambah Menu';
    openModal('menu-modal');
}

export function openEditModal(id) {
    const menu = allMenus.find(m => m.id === id);
    if (!menu) return;
    editingId = id;

    document.getElementById('input-nama').value     = menu.nama;
    document.getElementById('input-harga').value    = menu.harga;
    document.getElementById('input-kategori').value = menu.kategori;
    document.getElementById('modal-title').textContent = 'Edit Menu';
    openModal('menu-modal');
}

export async function saveMenu() {
    const nama     = document.getElementById('input-nama').value.trim();
    const harga    = parseFloat(document.getElementById('input-harga').value);
    const kategori = document.getElementById('input-kategori').value;

    if (!nama || isNaN(harga) || harga <= 0 || !kategori) {
        showToast('Semua field wajib diisi dengan benar.', 'error');
        return;
    }

    const body = { nama, harga, kategori };

    try {
        if (editingId) {
            await api.updateMenu(editingId, body);
            showToast('Menu berhasil diperbarui.', 'success');
        } else {
            await api.createMenu(body);
            showToast('Menu berhasil ditambahkan.', 'success');
        }
        closeModal('menu-modal');
        await loadMenus();
    } catch (err) {
        showToast(err.message, 'error');
    }
}

async function deleteMenu(id) {
    if (!confirm('Yakin hapus menu ini?')) return;
    try {
        await api.deleteMenu(id);
        showToast('Menu dihapus.', 'success');
        await loadMenus();
    } catch (err) {
        showToast(err.message, 'error');
    }
}

/* === Helpers === */
function resetForm() {
    ['input-nama', 'input-harga'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.value = '';
    });
    const kat = document.getElementById('input-kategori');
    if (kat) kat.value = 'makanan';
}

window.menu = { loadMenus, filterMenus, openAddModal, saveMenu, allMenus };
export { allMenus };
