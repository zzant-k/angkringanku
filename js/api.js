/**
 * api.js — Data layer menggunakan localStorage (tanpa backend)
 */

/* ============================
   HELPER FUNCTIONS
   ============================ */

function getData(key) {
    try {
        const raw = localStorage.getItem(key);
        return raw ? JSON.parse(raw) : [];
    } catch { return []; }
}

function setData(key, data) {
    localStorage.setItem(key, JSON.stringify(data));
}

function nextId(key) {
    const items = getData(key);
    if (items.length === 0) return 1;
    return Math.max(...items.map(i => i.id)) + 1;
}

function todayStr() {
    return new Date().toISOString().split('T')[0];
}

/* ============================
   SEED DATA DEFAULT
   ============================ */
function seedDefaults() {
    if (!localStorage.getItem('angkringan_users')) {
        setData('angkringan_users', [
            { id: 1, username: 'admin', password: 'admin123' }
        ]);
    }
    if (!localStorage.getItem('angkringan_menus'))     setData('angkringan_menus', []);
    if (!localStorage.getItem('angkringan_antrians'))   setData('angkringan_antrians', []);
    if (!localStorage.getItem('angkringan_transaksis')) setData('angkringan_transaksis', []);
}
seedDefaults();

/* ============================
   STORAGE KEYS
   ============================ */
const KEYS = {
    users:      'angkringan_users',
    menus:      'angkringan_menus',
    antrians:   'angkringan_antrians',
    transaksis: 'angkringan_transaksis',
};

/* ============================
   API OBJECT
   ============================ */
const api = {

    // -------- AUTH --------
    login(body) {
        return new Promise((resolve, reject) => {
            const users = getData(KEYS.users);
            const user = users.find(u =>
                u.username === body.username && u.password === body.password
            );
            if (!user) { reject(new Error('Username atau password salah.')); return; }
            const token = 'local_' + Date.now();
            resolve({ token, user: { id: user.id, username: user.username }, message: 'Login berhasil.' });
        });
    },

    logout() { return Promise.resolve({ message: 'Logout berhasil.' }); },
    me()     { return Promise.resolve({ id: 1, username: 'admin' }); },

    // -------- MENU (CRUD) --------
    getMenu() {
        const menus = getData(KEYS.menus);
        menus.sort((a, b) => (a.kategori + a.nama).localeCompare(b.kategori + b.nama));
        return Promise.resolve(menus);
    },

    createMenu(body) {
        const menus = getData(KEYS.menus);
        const newMenu = {
            id: nextId(KEYS.menus),
            nama: body.nama,
            harga: parseFloat(body.harga),
            kategori: body.kategori,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
        };
        menus.push(newMenu);
        setData(KEYS.menus, menus);
        return Promise.resolve(newMenu);
    },

    updateMenu(id, body) {
        const menus = getData(KEYS.menus);
        const idx = menus.findIndex(m => m.id === parseInt(id));
        if (idx === -1) return Promise.reject(new Error('Menu tidak ditemukan.'));
        menus[idx] = { ...menus[idx], ...body, harga: parseFloat(body.harga), updated_at: new Date().toISOString() };
        setData(KEYS.menus, menus);
        return Promise.resolve(menus[idx]);
    },

    deleteMenu(id) {
        let menus = getData(KEYS.menus);
        menus = menus.filter(m => m.id !== parseInt(id));
        setData(KEYS.menus, menus);
        return Promise.resolve({ message: 'Menu dihapus.' });
    },

    // -------- ANTRIAN --------
    getAntrian() {
        const antrians = getData(KEYS.antrians).filter(a => a.status === 'aktif');
        antrians.sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
        return Promise.resolve(antrians);
    },

    createAntrian(body) {
        const antrians = getData(KEYS.antrians);
        const menus = getData(KEYS.menus);
        const today = todayStr();
        const todayCount = antrians.filter(a => (a.created_at || '').startsWith(today)).length;

        const antrianMenus = body.menus.map(item => {
            const m = menus.find(x => x.id === item.menu_id);
            return { id: item.menu_id, nama: m?.nama || 'Unknown', harga: m?.harga || 0, kategori: m?.kategori || '', jumlah: item.jumlah };
        });
        const total = antrianMenus.reduce((s, m) => s + m.harga * m.jumlah, 0);

        const newAntrian = {
            id: nextId(KEYS.antrians),
            nama_pelanggan: body.nama_pelanggan,
            nomor_antrian: todayCount + 1,
            status: 'aktif',
            menus: antrianMenus,
            total,
            created_at: new Date().toISOString(),
        };

        antrians.push(newAntrian);
        setData(KEYS.antrians, antrians);
        return Promise.resolve(newAntrian);
    },

    deleteAntrian(id) {
        const antrians = getData(KEYS.antrians);
        const antrian = antrians.find(a => a.id === parseInt(id));
        if (!antrian) return Promise.reject(new Error('Antrian tidak ditemukan.'));

        // Buat transaksi otomatis
        const transaksis = getData(KEYS.transaksis);
        if (!transaksis.some(t => t.antrian_id === antrian.id)) {
            transaksis.push({
                id: nextId(KEYS.transaksis),
                antrian_id: antrian.id, total: antrian.total, bayar_via: 'Manual',
                created_at: new Date().toISOString(),
                antrian: {
                    nama_pelanggan: antrian.nama_pelanggan,
                    nomor_antrian: antrian.nomor_antrian,
                    menus: antrian.menus.map(m => ({ id: m.id, nama: m.nama, harga: m.harga, pivot: { jumlah: m.jumlah } })),
                },
            });
            setData(KEYS.transaksis, transaksis);
        }
        antrian.status = 'selesai';
        setData(KEYS.antrians, antrians);
        return Promise.resolve({ message: 'Antrian diselesaikan.' });
    },

    // -------- TRANSAKSI --------
    getTransaksi() {
        const today = todayStr();
        const transaksis = getData(KEYS.transaksis)
            .filter(t => (t.created_at || '').startsWith(today))
            .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
            .slice(0, 50);
        return Promise.resolve(transaksis);
    },

    createTransaksi(body) {
        const transaksis = getData(KEYS.transaksis);
        const antrians = getData(KEYS.antrians);
        const antrian = antrians.find(a => a.id === parseInt(body.antrian_id));

        if (transaksis.some(t => t.antrian_id === parseInt(body.antrian_id))) {
            return Promise.reject(new Error('Transaksi sudah ada untuk antrian ini.'));
        }

        transaksis.push({
            id: nextId(KEYS.transaksis),
            antrian_id: parseInt(body.antrian_id),
            total: parseFloat(body.total),
            bayar_via: body.bayar_via || 'QRIS',
            created_at: new Date().toISOString(),
            antrian: antrian ? {
                nama_pelanggan: antrian.nama_pelanggan,
                nomor_antrian: antrian.nomor_antrian,
                menus: antrian.menus.map(m => ({ id: m.id, nama: m.nama, harga: m.harga, pivot: { jumlah: m.jumlah } })),
            } : null,
        });
        setData(KEYS.transaksis, transaksis);

        if (antrian) { antrian.status = 'selesai'; setData(KEYS.antrians, antrians); }
        return Promise.resolve({ message: 'Transaksi disimpan.' });
    },

    getSummary() {
        const today = todayStr();
        const transaksis = getData(KEYS.transaksis).filter(t => (t.created_at || '').startsWith(today));
        const antrians = getData(KEYS.antrians).filter(a => a.status === 'aktif');
        const menus = getData(KEYS.menus);
        return Promise.resolve({
            total_transaksi_hari_ini: transaksis.reduce((s, t) => s + parseFloat(t.total), 0),
            jumlah_transaksi: transaksis.length,
            antrian_aktif: antrians.length,
            total_menu: menus.length,
        });
    },

    exportPdf() {
        const today = todayStr();
        const transaksis = getData(KEYS.transaksis).filter(t => (t.created_at || '').startsWith(today));
        const totalPendapatan = transaksis.reduce((s, t) => s + parseFloat(t.total), 0);

        const rows = transaksis.map((t, i) => {
            const a = t.antrian || {};
            const menuList = (a.menus || []).map(m =>
                `<li>${m.nama} (x${m.pivot?.jumlah || 1}) - Rp ${(m.harga * (m.pivot?.jumlah || 1)).toLocaleString('id-ID')}</li>`
            ).join('');
            return `<tr>
                <td>${i + 1}</td>
                <td>${new Date(t.created_at).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}</td>
                <td>${a.nama_pelanggan || '-'}</td>
                <td><ul style="margin:0;padding-left:15px;font-size:11px">${menuList || '-'}</ul></td>
                <td style="text-align:right">Rp ${parseFloat(t.total).toLocaleString('id-ID')}</td>
            </tr>`;
        }).join('');

        const html = `<!DOCTYPE html><html><head><title>Laporan Harian</title>
        <style>body{font-family:Arial,sans-serif;font-size:12px;padding:20px}
        h1{font-size:18px;text-align:center}p.sub{text-align:center;color:#666}
        table{width:100%;border-collapse:collapse;margin-top:16px}
        th,td{border:1px solid #ddd;padding:6px;text-align:left;vertical-align:top}
        th{background:#f3f4f6;font-weight:bold}
        .footer{margin-top:24px;text-align:center;font-size:10px;color:#999}</style></head>
        <body><h1>Laporan Harian Angkringan</h1>
        <p class="sub">Tanggal: ${new Date().toLocaleDateString('id-ID', { day:'numeric', month:'long', year:'numeric' })}</p>
        <p><strong>Total Pendapatan:</strong> Rp ${totalPendapatan.toLocaleString('id-ID')} | <strong>Jumlah Transaksi:</strong> ${transaksis.length}</p>
        <table><thead><tr><th>No</th><th>Waktu</th><th>Pelanggan</th><th>Pesanan</th><th>Total</th></tr></thead>
        <tbody>${rows || '<tr><td colspan="5" style="text-align:center">Tidak ada transaksi</td></tr>'}</tbody></table>
        <div class="footer">Dicetak: ${new Date().toLocaleString('id-ID')}</div>
        <script>window.print()<\/script></body></html>`;

        const blob = new Blob([html], { type: 'text/html' });
        window.open(URL.createObjectURL(blob), '_blank');
        return Promise.resolve();
    },
};

export default api;
