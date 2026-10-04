/**
 * Menghapus basis data uji dari penyimpanan bersama Vercel Blob.
 *
 * Dipakai setelah pengujian agar aplikasi memulai dengan data bersih (akun
 * contoh + 3 layanan, tanpa antrean sisa uji).
 *
 * Jalankan: node --env-file=.env.local scripts/reset-blob-db.mjs
 */
import { del } from '@vercel/blob'

try {
  await del('db/siklinik.db')
  console.log('Basis data di penyimpanan bersama dihapus — akan dibuat ulang bersih.')
} catch (err) {
  console.log('Tidak ada yang dihapus:', err?.message)
}
