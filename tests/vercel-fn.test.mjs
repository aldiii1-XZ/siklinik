/**
 * Menguji fungsi serverless Vercel secara lokal.
 *
 * Meniru cara Vercel memanggil handler lewat rewrite: fungsi menerima alamat
 * apa adanya (mis. "/api/assistant/info"). Tujuannya menangkap kesalahan
 * sebelum deploy.
 */
import http from 'node:http'
import handler from '../api/index.js'

const server = http.createServer((req, res) => {
  handler(req, res)
})

await new Promise(r => server.listen(0, r))
const base = `http://127.0.0.1:${server.address().port}`

let lulus = 0
let gagal = 0
function cek(nama, ok, detail = '') {
  if (ok) { lulus++; console.log(`✔ ${nama}`) }
  else { gagal++; console.log(`✖ ${nama} ${detail}`) }
}

const minta = async (path, opsi = {}) => {
  const res = await fetch(`${base}${path}`, {
    method: opsi.method || 'GET',
    headers: { 'content-type': 'application/json', ...(opsi.token ? { authorization: `Bearer ${opsi.token}` } : {}) },
    body: opsi.body ? JSON.stringify(opsi.body) : undefined,
  })
  const t = await res.text()
  let d = null
  try { d = t ? JSON.parse(t) : null } catch { d = t }
  return { status: res.status, body: d }
}

// 1. Kesehatan
const sehat = await minta('/api/health')
cek('GET /api/health -> ok', sehat.status === 200 && sehat.body?.ok === true, JSON.stringify(sehat.body))

// 2. Layanan (seeded dari /tmp)
const layanan = await minta('/api/services')
cek('GET /api/services -> 3 layanan', layanan.status === 200 && layanan.body?.services?.length === 3, `dapat ${layanan.body?.services?.length}`)

// 3. Info asisten (DUA segmen — inilah yang sempat gagal di Vercel)
const info = await minta('/api/assistant/info')
cek('GET /api/assistant/info (2 segmen)', info.status === 200 && ['lokal', 'llm'].includes(info.body?.mode), JSON.stringify(info.body))

// 4. Login akun demo (inti: pengunjung harus bisa masuk)
const masuk = await minta('/api/auth/login', { method: 'POST', body: { email: 'mahasiswa@kampus.ac.id', password: '12345678' } })
cek('Login akun demo berhasil', masuk.status === 200 && !!masuk.body?.token, JSON.stringify(masuk.body).slice(0, 120))

// 5. Login petugas
const masukPetugas = await minta('/api/auth/login', { method: 'POST', body: { email: 'petugas@klinik.ac.id', password: 'petugas123' } })
cek('Login akun petugas berhasil', masukPetugas.status === 200 && !!masukPetugas.body?.token)

// 6. Daftar akun baru + ambil antrean (menulis ke DB).
//    Memakai akun baru tiap kali agar tidak bentrok dengan aturan
//    "satu orang satu antrean aktif per hari" dari percobaan sebelumnya.
const unik = String(Date.now()).slice(-7)
let tokenBaru = null
const daftar = await minta('/api/auth/register', {
  method: 'POST',
  body: {
    name: 'Uji Serverless',
    identity: `99${unik}`,
    email: `uji${unik}@kampus.ac.id`,
    role: 'mahasiswa',
    password: 'rahasia123',
  },
})
cek('Registrasi akun baru', daftar.status === 201 && !!daftar.body?.token, JSON.stringify(daftar.body).slice(0, 120))
tokenBaru = daftar.body?.token

let ambil = { status: 0, body: null }
if (tokenBaru) {
  ambil = await minta('/api/queues', { method: 'POST', token: tokenBaru, body: { serviceId: 1, complaint: 'Uji serverless' } })
  cek('Ambil nomor antrean', ambil.status === 201 && !!ambil.body?.queue?.number, JSON.stringify(ambil.body).slice(0, 120))
}

// 7. Chat asisten (mode lokal: tanpa AI_API_KEY di tes ini)
let chat = { status: 0, body: null }
if (tokenBaru) {
  chat = await minta('/api/assistant/chat', { method: 'POST', token: tokenBaru, body: { message: 'aku demam' } })
  cek('Chat asisten membalas', chat.status === 200 && (chat.body?.reply || '').length > 20, JSON.stringify(chat.body).slice(0, 120))
}

// 8. Darurat tetap ditangani
if (tokenBaru) {
  const darurat = await minta('/api/assistant/chat', { method: 'POST', token: tokenBaru, body: { message: 'dada saya nyeri dan sesak napas' } })
  cek('Keluhan darurat -> 119', darurat.status === 200 && darurat.body?.darurat === true && /119/.test(darurat.body?.reply || ''))
}

// 9. Papan petugas (2 segmen) bisa diakses petugas
if (masukPetugas.body?.token) {
  const papan = await minta('/api/queues/board', { token: masukPetugas.body.token })
  cek('Papan petugas (2 segmen) bisa diakses', papan.status === 200 && Array.isArray(papan.body?.queues), JSON.stringify(papan.body).slice(0, 100))
}

// 10. Alamat tak dikenal tetap JSON
const tidakAda = await minta('/api/tidak-ada')
cek('Alamat tak dikenal -> JSON error', tidakAda.status === 404 && !!tidakAda.body?.error)

server.close()
console.log(`\nHASIL: ${lulus} lulus, ${gagal} gagal`)
process.exit(gagal === 0 ? 0 : 1)
