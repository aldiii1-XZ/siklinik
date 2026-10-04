/**
 * Menguji mekanisme kunci bersama di atas Vercel Blob.
 *
 * Yang dibuktikan: dua percobaan mengambil kunci secara bersamaan hanya boleh
 * berhasil satu; percobaan kedua harus gagal selama kunci masih dipegang.
 * Tanpa ini, dua permintaan bisa saling menimpa perubahan.
 */
import 'node:fs'
import { del, get, put } from '@vercel/blob'

const LOCK = 'db/uji-lock'

let lulus = 0
let gagal = 0
function cek(nama, ok, detail = '') {
  if (ok) { lulus++; console.log(`✔ ${nama}`) }
  else { gagal++; console.log(`✖ ${nama} ${detail}`) }
}

// Bersihkan sisa uji sebelumnya.
try { await del(LOCK) } catch { /* tidak ada */ }

/** Sama seperti kunci.ambil() di api/index.js. */
async function ambil() {
  try {
    await put(LOCK, String(Date.now()), {
      access: 'private',
      allowOverwrite: false,
      addRandomSuffix: false,
      contentType: 'text/plain',
    })
    return true
  } catch {
    return false
  }
}

const a = await ambil()
cek('percobaan pertama mengambil kunci', a === true)

const b = await ambil()
cek('percobaan kedua DITOLAK selama kunci dipegang', b === false, `hasil: ${b}`)

// Pastikan berkas kunci benar-benar ada.
const ada = await get(LOCK, { access: 'private', useCache: false })
cek('berkas kunci benar-benar ada di penyimpanan', ada?.statusCode === 200)

// Lepas kunci -> percobaan berikutnya harus berhasil lagi.
await del(LOCK)
const c = await ambil()
cek('setelah kunci dilepas, bisa mengambil lagi', c === true)

await del(LOCK)

// Uji berkas basis data: bisa ditulis ulang (allowOverwrite) dan dibaca lagi.
const DATA = 'db/uji-data'
const isi1 = Buffer.from('versi-1')
await put(DATA, isi1, { access: 'private', allowOverwrite: true, addRandomSuffix: false, contentType: 'application/octet-stream' })
const baca1 = await get(DATA, { access: 'private', useCache: false })
const teks1 = baca1?.stream ? await new Response(baca1.stream).text() : null
cek('data tersimpan & terbaca', teks1 === 'versi-1', `dapat: ${teks1}`)

const isi2 = Buffer.from('versi-2-yang-lebih-baru')
await put(DATA, isi2, { access: 'private', allowOverwrite: true, addRandomSuffix: false, contentType: 'application/octet-stream' })
const baca2 = await get(DATA, { access: 'private', useCache: false })
const teks2 = baca2?.stream ? await new Response(baca2.stream).text() : null
cek('penulisan ulang menimpa data lama', teks2 === 'versi-2-yang-lebih-baru', `dapat: ${teks2}`)

await del(DATA)

console.log(`\nHASIL: ${lulus} lulus, ${gagal} gagal`)
process.exit(gagal === 0 ? 0 : 1)
