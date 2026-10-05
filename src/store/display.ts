/**
 * Logika tampilan SIKLINIK — murni, tanpa React.
 *
 * Aturan antrean yang sebenarnya ditegakkan di server (lihat
 * `server/src/app.js`). Berkas ini hanya berisi perhitungan tampilan yang
 * memang hidup di sisi klien: label status, warna, dan pengelompokan antrean.
 * Karena murni, semuanya dapat diuji tanpa merender React.
 */
import type { ApiQueue, QueueStatus } from './api'

/** Label bahasa Indonesia untuk setiap status. */
export const STATUS_LABEL: Record<QueueStatus, string> = {
  menunggu: 'Menunggu',
  dipanggil: 'Sedang Dipanggil',
  selesai: 'Selesai',
  dibatalkan: 'Dibatalkan',
}

/** Warna untuk setiap status, dipakai di lencana dan kartu. */
export const STATUS_COLOR: Record<QueueStatus, string> = {
  menunggu: 'var(--warning)',
  dipanggil: 'var(--primary)',
  selesai: 'var(--success)',
  dibatalkan: 'var(--muted-foreground)',
}

/** Status yang masih dianggap aktif hari ini. */
export function isActive(status: QueueStatus): boolean {
  return status === 'menunggu' || status === 'dipanggil'
}

/**
 * Mengelompokkan antrean per layanan, dengan kode layanan sebagai kunci.
 * Dipakai papan petugas agar setiap poli tampil terpisah.
 */
export function groupByService(queues: ApiQueue[]): Record<string, ApiQueue[]> {
  const hasil: Record<string, ApiQueue[]> = {}
  for (const q of queues) {
    if (!hasil[q.serviceCode]) hasil[q.serviceCode] = []
    hasil[q.serviceCode].push(q)
  }
  // Urutkan berdasarkan nomor di dalam tiap kelompok.
  for (const kode of Object.keys(hasil)) {
    hasil[kode].sort((a, b) => a.rawNumber - b.rawNumber)
  }
  return hasil
}

/** Antrean yang sedang dipanggil pada satu layanan (nomor terkecil). */
export function currentCalled(queues: ApiQueue[]): ApiQueue | null {
  const dipanggil = queues.filter(q => q.status === 'dipanggil').sort((a, b) => a.rawNumber - b.rawNumber)
  return dipanggil[0] ?? null
}

/** Antrean berikutnya yang menunggu (nomor terkecil). */
export function nextWaiting(queues: ApiQueue[]): ApiQueue | null {
  const menunggu = queues.filter(q => q.status === 'menunggu').sort((a, b) => a.rawNumber - b.rawNumber)
  return menunggu[0] ?? null
}

/** Menghitung ringkasan papan: total per status. */
export function summarize(queues: ApiQueue[]) {
  return {
    menunggu: queues.filter(q => q.status === 'menunggu').length,
    dipanggil: queues.filter(q => q.status === 'dipanggil').length,
    selesai: queues.filter(q => q.status === 'selesai').length,
    dibatalkan: queues.filter(q => q.status === 'dibatalkan').length,
    total: queues.length,
  }
}

/** Riwayat diurutkan dari yang terbaru. */
export function sortByNewest(queues: ApiQueue[]): ApiQueue[] {
  return [...queues].sort((a, b) => b.id - a.id)
}

/** Format tanggal Indonesia: "12 Mei 2025". */
export function formatDate(iso: string): string {
  const [tahun, bulan, hari] = iso.split('-').map(Number)
  const nama = [
    'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
    'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember',
  ]
  return `${hari} ${nama[bulan - 1]} ${tahun}`
}

/** Format tanggal lengkap dengan nama hari: "Senin, 26 Mei 2025". */
export function formatDateFull(d = new Date()): string {
  const hari = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'][d.getDay()]
  const bulan = [
    'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
    'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember',
  ][d.getMonth()]
  return `${hari}, ${d.getDate()} ${bulan} ${d.getFullYear()}`
}

/** Sapaan singkat untuk kartu Beranda. */
export function greeting(name: string): string {
  return name.trim().split(/\s+/)[0] ?? name
}

/** Inisial untuk avatar: "Aldi Yonatan" -> "AY". */
export function initials(name: string): string {
  const bagian = name.trim().split(/\s+/).filter(Boolean)
  if (bagian.length === 0) return '?'
  if (bagian.length === 1) return bagian[0].slice(0, 2).toUpperCase()
  return (bagian[0][0] + bagian[bagian.length - 1][0]).toUpperCase()
}
