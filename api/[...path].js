/**
 * Titik masuk serverless Vercel.
 *
 * Vercel tidak menjalankan satu proses server terus-menerus, jadi aplikasi
 * Express dibungkus sebagai fungsi. Berkas `api/[...path].js` menangkap semua
 * alamat di bawah /api dan meneruskannya ke aplikasi Express yang sama dengan
 * yang dipakai saat pengembangan.
 *
 * Catatan penting: Vercel tidak punya penyimpanan permanen, jadi basis data
 * SQLite ditaruh di /tmp. Akun contoh selalu dibuat ulang saat fungsi dimulai,
 * sehingga login demo selalu bisa dipakai. Data yang dibuat pengunjung bisa
 * hilang bila fungsi dimulai dari dingin.
 */
import { createApp } from '../server/src/app.js'
import { openDatabase, seedDatabase } from '../server/src/db.js'
import { hashPassword } from '../server/src/auth.js'
import { buatAsisten } from '../server/src/assistant.js'

// /tmp satu-satunya folder yang bisa ditulis di lingkungan serverless Vercel.
const DB_PATH = process.env.DB_PATH || '/tmp/siklinik.db'

let app = null

/** Membuat aplikasi sekali, lalu dipakai ulang selama fungsi masih hangat. */
function ambilApp() {
  if (app) return app

  const db = openDatabase(DB_PATH)
  seedDatabase(db, { hashPassword })

  const assistant = buatAsisten({
    apiKey: process.env.AI_API_KEY,
    baseUrl: process.env.AI_BASE_URL,
    model: process.env.AI_MODEL,
    timeoutMs: Number(process.env.AI_TIMEOUT_MS ?? 45000),
  })

  app = createApp(db, { assistant })
  return app
}

export default function handler(req, res) {
  // Rute `[...path]` menerima sisa alamat sebagai array; susun kembali
  // menjadi /api/... supaya Express melihat alamat yang benar.
  const bagian = req.query?.path
  const sisa = Array.isArray(bagian) ? bagian.join('/') : bagian || ''
  req.url = '/api' + (sisa ? '/' + sisa : '')

  return ambilApp()(req, res)
}
