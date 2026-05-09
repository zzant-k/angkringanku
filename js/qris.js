/**
 * qris.js — QR Code generator untuk simulasi pembayaran QRIS
 */
export function generateQR(total) {
    const container = document.getElementById('qr-code');
    if (!container) return;
    container.innerHTML = '';
    
    const qrisImage = localStorage.getItem('angkringan_qris_image');
    if (qrisImage) {
        container.innerHTML = `<img src="${qrisImage}" alt="QRIS" style="width: 100%; height: 100%; object-fit: contain; border-radius: 8px;">`;
    } else {
        container.innerHTML = '<p style="color:var(--color-text-muted);font-size:12px;text-align:center;">Gambar QRIS tidak tersedia.</p>';
    }
}
