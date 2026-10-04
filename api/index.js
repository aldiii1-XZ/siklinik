/**
 * Titik masuk serverless Vercel.
 *
 * MASALAH YANG DISELESAIKAN DI SINI
 * 1. Vercel menjalankan beberapa instance fungsi terpisah, dan tiap instance
 *    punya /tmp sendiri — antrean yang dibuat di satu instance tidak terlihat
 *    oleh instance lain.
 * 2. Bila dua permintaan yang mengubah data berjalan hampir bersamaan, yang
 *    satu bisa menimpa yang lain (perubahan "hilang").
 *
 * SOLUSINYA
 * Basis data SQLite disimpan di Vercel Blob (penyimpanan bersama). Setiap
 * permintaan mengubah data dilakukan SATU PER SATU memakai kunci bersama:
 * ambil kunci -> baca salinan terbaru -> jalankan -> simpan -> lepas kunci.
 * Respons ditahan sampai data benar-benar tersimpan, sehingga permintaan
 * berikutnya (mis. petugas membuka papan) pasti membaca data terbaru.
 *
 * Keterbatasan yang jujur: cara ini cocok untuk skala demo/portofolio. Aplikasi
 * produksi dengan banyak pengguna serentak sebaiknya memakai basis data
 * sungguhan (mis. Postgres) dengan transaksi.
 */
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { randomUUID } from 'node:crypto'
import { del, get, put } from '@vercel/blob'

import { createApp } from '../server/src/app.js'
import { openDatabase, seedDatabase } from '../server/src/db.js'
import { hashPassword } from '../server/src/auth.js'
import { buatAsisten } from '../server/src/assistant.js'

/** Berkas basis data di dalam penyimpanan bersama. */
const BLOB_PATH = 'db/siklinik.db'
/** Berkas kunci. Keberadaannya menandakan ada permintaan yang sedang menulis. */
const BLOB_LOCK = 'db/lock'

/** Batas waktu menyimpan/menahan respons (ms). */
const BATAS_SIMPAN = 9000
/** Kunci yang lebih tua dari ini dianggap basi (fungsi sebelumnya berhenti). */
const KUNCI_BASI = 15000

/** Penyimpanan bersama hanya dipakai saat benar-benar berjalan di Vercel. */
function blobAktif() {
  return Boolean(process.env.BLOB_STORE_ID) && Boolean(process.env.VERCEL)
}

const tidur = ms => new Promise(r => setTimeout(r, ms))

/** Mengunduh salinan basis data terbaru dari penyimpanan bersama. */
async function unduhSnapshot() {
  try {
    // useCache: false -> baca langsung dari asal, bukan dari cache CDN.
    const hasil = await get(BLOB_PATH, { access: 'private', useCache: false })
    if (!hasil || hasil.statusCode !== 200 || !hasil.stream) return null
    return Buffer.from(await new Response(hasil.stream).arrayBuffer())
  } catch (err) {
    console.error('[blob] gagal mengunduh basis data:', err?.message)
    return null
  }
}

/** Menyimpan salinan basis data ke penyimpanan bersama. */
async function unggahSnapshot(berkas) {
  await put(BLOB_PATH, fs.readFileSync(berkas), {
    access: 'private',
    allowOverwrite: true,
    addRandomSuffix: false,
    contentType: 'application/octet-stream',
  })
}

/**
 * Kunci bersama sederhana di atas penyimpanan Blob.
 *
 * Memakai berkas penanda: pembuatan berkas gagal bila sudah ada, sehingga hanya
 * satu permintaan yang boleh menulis pada satu waktu — termasuk antar instance.
 */
const kunci = {
  /** Mencoba mengambil kunci; mengembalikan true bila berhasil. */
  async ambil() {
    try {
      await put(BLOB_LOCK, String(Date.now()), {
        access: 'private',
        allowOverwrite: false,
        addRandomSuffix: false,
        contentType: 'text/plain',
      })
      return true
    } catch {
      // Sudah ada kunci. Periksa apakah kuncinya basi (pemiliknya berhenti).
      try {
        const isi = await get(BLOB_LOCK, { access: 'private', useCache: false })
        if (isi?.statusCode === 200 && isi.stream) {
          const teks = await new Response(isi.stream).text()
          const umur = Date.now() - Number(teks || 0)
          if (umur > KUNCI_BASI) {
            // Paksa ambil alih kunci yang basi.
            await put(BLOB_LOCK, String(Date.now()), {
              access: 'private',
              allowOverwrite: true,
              addRandomSuffix: false,
              contentType: 'text/plain',
            })
            return true
          }
        }
      } catch {
        // biarkan gagal; akan dicoba lagi
      }
      return false
    }
  },

  /** Melepas kunci. */
  async lepas() {
    try {
      await del(BLOB_LOCK)
    } catch {
      // kunci mungkin sudah hilang/basi
    }
  },
}

/** Mengambil kunci dengan percobaan berulang. */
async function ambilKunciDenganSabar(batasMs = 20000) {
  const mulai = Date.now()
  while (Date.now() - mulai < batasMs) {
    if (await kunci.ambil()) return true
    await tidur(250)
  }
  return false
}

/** Membuat objek asisten dari pengaturan di lingkungan. */
function asistenDariEnv() {
  return buatAsisten({
    apiKey: process.env.AI_API_KEY,
    baseUrl: process.env.AI_BASE_URL,
    model: process.env.AI_MODEL,
    timeoutMs: Number(process.env.AI_TIMEOUT_MS ?? 45000),
  })
}

// ── Mode lokal (pengembangan / tes tanpa Vercel) ────────────────────────────
let appLokal = null
function appTanpaBlob() {
  if (appLokal) return appLokal
  const db = openDatabase(process.env.DB_PATH || '/tmp/siklinik.db')
  seedDatabase(db, { hashPassword })
  appLokal = createApp(db, { assistant: asistenDariEnv() })
  return appLokal
}

// ── Mode penyimpanan bersama ────────────────────────────────────────────────

/** Menutup basis data dan menghapus berkas sementara. */
function bersihkan(db, berkas) {
  try {
    db.close()
  } catch {
    // sudah tertutup
  }
  try {
    fs.unlinkSync(berkas)
  } catch {
    // sudah terhapus
  }
}

/** Permintaan baca: cukup unduh salinan, jalankan, lalu bersihkan. */
async function tanganiBaca(req, res) {
  const snapshot = await unduhSnapshot()
  const berkas = path.join(os.tmpdir(), `siklinik-${randomUUID()}.db`)
  if (snapshot) fs.writeFileSync(berkas, snapshot)

  const db = openDatabase(berkas)
  seedDatabase(db, { hashPassword })
  const app = createApp(db, { assistant: asistenDariEnv() })

  res.on('finish', () => bersihkan(db, berkas))
  return app(req, res)
}

/** Permintaan ubah: jalankan satu per satu memakai kunci bersama. */
async function tanganiUbah(req, res) {
  const dapatKunci = await ambilKunciDenganSabar()
  if (!dapatKunci) {
    return res.status(503).json({ error: 'Server sedang sibuk. Coba lagi sebentar.' })
  }

  const snapshot = await unduhSnapshot()
  const berkas = path.join(os.tmpdir(), `siklinik-${randomUUID()}.db`)
  if (snapshot) fs.writeFileSync(berkas, snapshot)

  const db = openDatabase(berkas)
  seedDatabase(db, { hashPassword })
  const app = createApp(db, { assistant: asistenDariEnv() })

  // Tahan respons sampai data tersimpan, lalu lepas kunci.
  const akhirAsli = res.end.bind(res)
  let sudahDitahan = false

  res.end = (...args) => {
    if (sudahDitahan) return akhirAsli(...args)
    sudahDitahan = true

    ;(async () => {
      try {
        await Promise.race([
          unggahSnapshot(berkas),
          new Promise((_, tolak) => setTimeout(() => tolak(new Error('menyimpan kelamaan')), BATAS_SIMPAN)),
        ])
      } catch (err) {
        console.error('[blob] gagal menyimpan basis data:', err?.message)
      } finally {
        bersihkan(db, berkas)
        await kunci.lepas()
      }
      akhirAsli(...args)
    })()

    return res
  }

  return app(req, res)
}

export default function handler(req, res) {
  // Alamat dari Vercel umumnya sudah berbentuk "/api/...". Bila tidak, awali
  // sendiri supaya Express selalu menemukan rutenya.
  const asli = req.url || '/'
  if (!asli.startsWith('/api')) req.url = '/api' + (asli.startsWith('/') ? asli : '/' + asli)

  if (!blobAktif()) return appTanpaBlob()(req, res)

  const mengubah = req.method !== 'GET' && req.method !== 'HEAD'
  return mengubah ? tanganiUbah(req, res) : tanganiBaca(req, res)
}
