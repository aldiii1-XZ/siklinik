/**
 * Tes API SIKLINIK.
 *
 * Menguji lewat permintaan HTTP sungguhan ke server sementara, sehingga yang
 * diuji adalah perilaku yang benar-benar diterima klien — termasuk kode status
 * dan pesan galat.
 *
 * Fokus: aturan antrean dan hak akses.
 * Jalankan: npm test (dari folder server/)
 */
import { test, describe, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { createApp } from '../src/app.js'
import { openDatabase, seedDatabase } from '../src/db.js'
import { hashPassword } from '../src/auth.js'

let server
let baseUrl

async function api(method, path, { token, body } = {}) {
  const res = await fetch(`${baseUrl}${path}`, {
    method,
    headers: {
      'content-type': 'application/json',
      ...(token ? { authorization: `Bearer ${token}` } : {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  })
  const text = await res.text()
  return { status: res.status, body: text ? JSON.parse(text) : null }
}

const masuk = async (email, password) => {
  const r = await api('POST', '/api/auth/login', { body: { email, password } })
  return r.body.token
}

/** Membuat akun mahasiswa baru dan mengembalikan tokennya. */
async function akunBaru(nama, nim, email) {
  const r = await api('POST', '/api/auth/register', {
    body: { name: nama, identity: nim, email, role: 'mahasiswa', password: 'rahasia123' },
  })
  return r.body.token
}

let tokenMahasiswa
let tokenPetugas
let layananUmum
let layananGigi

before(async () => {
  const db = openDatabase(':memory:')
  seedDatabase(db, { hashPassword })
  const app = createApp(db)
  await new Promise(resolve => {
    server = app.listen(0, resolve)
  })
  baseUrl = `http://127.0.0.1:${server.address().port}`

  tokenMahasiswa = await masuk('mahasiswa@kampus.ac.id', '12345678')
  tokenPetugas = await masuk('petugas@klinik.ac.id', 'petugas123')

  const layanan = (await api('GET', '/api/services')).body.services
  layananUmum = layanan.find(s => s.code === 'A')
  layananGigi = layanan.find(s => s.code === 'G')
})

after(() => server?.close())

// ── Kesehatan ───────────────────────────────────────────────────────────────

describe('kesehatan', () => {
  test('GET /api/health membalas ok', async () => {
    const r = await api('GET', '/api/health')
    assert.equal(r.status, 200)
    assert.equal(r.body.ok, true)
  })

  test('endpoint tak dikenal membalas 404', async () => {
    assert.equal((await api('GET', '/api/tidak-ada')).status, 404)
  })
})

// ── Autentikasi ─────────────────────────────────────────────────────────────

describe('autentikasi', () => {
  test('login berhasil mengembalikan token tanpa hash kata sandi', async () => {
    const r = await api('POST', '/api/auth/login', {
      body: { email: 'mahasiswa@kampus.ac.id', password: '12345678' },
    })
    assert.equal(r.status, 200)
    assert.ok(r.body.token)
    assert.equal(r.body.user.role, 'mahasiswa')
    assert.ok(!('password_hash' in r.body.user))
    assert.ok(!('password_salt' in r.body.user))
  })

  test('kata sandi salah ditolak', async () => {
    const r = await api('POST', '/api/auth/login', {
      body: { email: 'mahasiswa@kampus.ac.id', password: 'salah' },
    })
    assert.equal(r.status, 401)
  })

  test('email tidak terdaftar memberi pesan sama dengan kata sandi salah', async () => {
    const a = await api('POST', '/api/auth/login', { body: { email: 'hantu@x.id', password: 'x' } })
    const b = await api('POST', '/api/auth/login', {
      body: { email: 'mahasiswa@kampus.ac.id', password: 'x' },
    })
    assert.equal(a.status, b.status)
    assert.equal(a.body.error, b.body.error, 'pesan berbeda bisa dipakai menebak email terdaftar')
  })

  test('registrasi mahasiswa berhasil', async () => {
    const r = await api('POST', '/api/auth/register', {
      body: {
        name: 'Siti Rahayu', identity: '231040099', email: 'Siti@Kampus.ac.id',
        role: 'mahasiswa', password: 'rahasia123',
      },
    })
    assert.equal(r.status, 201)
    assert.equal(r.body.user.role, 'mahasiswa')
    assert.equal(r.body.user.email, 'siti@kampus.ac.id', 'email seharusnya jadi huruf kecil')
  })

  test('registrasi dengan NIM yang sudah dipakai ditolak', async () => {
    const r = await api('POST', '/api/auth/register', {
      body: {
        name: 'Kembar', identity: '231040012', email: 'kembar@kampus.ac.id',
        role: 'mahasiswa', password: 'rahasia123',
      },
    })
    assert.equal(r.status, 409)
  })

  test('registrasi dengan email yang sudah dipakai ditolak', async () => {
    const r = await api('POST', '/api/auth/register', {
      body: {
        name: 'Kembar', identity: '231040777', email: 'mahasiswa@kampus.ac.id',
        role: 'mahasiswa', password: 'rahasia123',
      },
    })
    assert.equal(r.status, 409)
  })

  test('kata sandi kurang dari 8 karakter ditolak', async () => {
    const r = await api('POST', '/api/auth/register', {
      body: {
        name: 'Pendek', identity: '231040555', email: 'pendek@kampus.ac.id',
        role: 'mahasiswa', password: '1234567',
      },
    })
    assert.equal(r.status, 400)
  })

  test('pendaftaran tidak boleh membuat akun petugas sendiri', async () => {
    const r = await api('POST', '/api/auth/register', {
      body: {
        name: 'Penyusup', identity: '231040666', email: 'penyusup@kampus.ac.id',
        role: 'petugas', password: 'rahasia123',
      },
    })
    assert.equal(r.status, 400, 'peran petugas seharusnya tidak bisa didaftarkan sendiri')
  })

  test('GET /api/auth/me butuh token', async () => {
    assert.equal((await api('GET', '/api/auth/me')).status, 401)
    const r = await api('GET', '/api/auth/me', { token: tokenMahasiswa })
    assert.equal(r.status, 200)
    assert.equal(r.body.user.role, 'mahasiswa')
  })

  test('token palsu ditolak', async () => {
    assert.equal((await api('GET', '/api/auth/me', { token: 'palsu' })).status, 401)
  })

  test('logout membuat token tidak berlaku', async () => {
    const t = await masuk('mahasiswa@kampus.ac.id', '12345678')
    assert.equal((await api('GET', '/api/auth/me', { token: t })).status, 200)
    await api('POST', '/api/auth/logout', { token: t })
    assert.equal((await api('GET', '/api/auth/me', { token: t })).status, 401)
  })

  test('profil bisa diperbarui', async () => {
    const t = await akunBaru('Nama Lama', '231040888', 'namalama@kampus.ac.id')
    const r = await api('PATCH', '/api/auth/profile', { token: t, body: { name: 'Nama Baru', phone: '0812 0000' } })
    assert.equal(r.status, 200)
    assert.equal(r.body.user.name, 'Nama Baru')
    assert.equal(r.body.user.phone, '0812 0000')
  })
})

// ── Layanan ─────────────────────────────────────────────────────────────────

describe('layanan', () => {
  test('daftar layanan bisa dibaca tanpa masuk', async () => {
    const r = await api('GET', '/api/services')
    assert.equal(r.status, 200)
    assert.equal(r.body.services.length, 3)
    const umum = r.body.services.find(s => s.code === 'A')
    assert.equal(umum.name, 'Poli Umum')
    assert.ok('waiting' in umum, 'jumlah menunggu harus disertakan')
  })

  test('layanan punya kode untuk awalan nomor antrean', async () => {
    const r = await api('GET', '/api/services')
    const kode = r.body.services.map(s => s.code)
    assert.deepEqual(kode, ['A', 'G', 'K'])
  })
})

// ── Mengambil antrean ───────────────────────────────────────────────────────

describe('mengambil antrean', () => {
  test('tanpa masuk ditolak', async () => {
    const r = await api('POST', '/api/queues', { body: { serviceId: 1 } })
    assert.equal(r.status, 401)
  })

  test('nomor pertama sebuah layanan adalah 001', async () => {
    const t = await akunBaru('Antre Satu', '231050001', 'antre1@kampus.ac.id')
    const r = await api('POST', '/api/queues', {
      token: t,
      body: { serviceId: layananGigi.id, complaint: 'sakit gigi' },
    })
    assert.equal(r.status, 201)
    assert.equal(r.body.queue.number, 'G-001')
    assert.equal(r.body.queue.status, 'menunggu')
    assert.equal(r.body.queue.complaint, 'sakit gigi')
  })

  test('nomor berikutnya berurutan pada layanan yang sama', async () => {
    const t1 = await akunBaru('Antre Dua', '231050002', 'antre2@kampus.ac.id')
    const t2 = await akunBaru('Antre Tiga', '231050003', 'antre3@kampus.ac.id')

    const a = await api('POST', '/api/queues', { token: t1, body: { serviceId: layananUmum.id } })
    const b = await api('POST', '/api/queues', { token: t2, body: { serviceId: layananUmum.id } })
    assert.equal(a.body.queue.number, 'A-001')
    assert.equal(b.body.queue.number, 'A-002')
  })

  test('nomor tiap layanan dihitung terpisah', async () => {
    const t = await akunBaru('Antre Empat', '231050004', 'antre4@kampus.ac.id')
    // Konseling (K) belum dipakai siapa pun hari ini.
    const konseling = (await api('GET', '/api/services')).body.services.find(s => s.code === 'K')
    const r = await api('POST', '/api/queues', { token: t, body: { serviceId: konseling.id } })
    assert.equal(r.body.queue.number, 'K-001', 'layanan lain harus mulai dari 001 lagi')
  })

  test('satu orang hanya boleh punya satu antrean aktif', async () => {
    const t = await akunBaru('Antre Lima', '231050005', 'antre5@kampus.ac.id')
    const pertama = await api('POST', '/api/queues', { token: t, body: { serviceId: layananUmum.id } })
    assert.equal(pertama.status, 201)

    const kedua = await api('POST', '/api/queues', { token: t, body: { serviceId: layananGigi.id } })
    assert.equal(kedua.status, 409, 'antrean ganda seharusnya ditolak')
    assert.match(kedua.body.error, /antrean aktif/i)
  })

  test('setelah dibatalkan, orang itu bisa mengambil antrean lagi', async () => {
    const t = await akunBaru('Antre Enam', '231050006', 'antre6@kampus.ac.id')
    const q = await api('POST', '/api/queues', { token: t, body: { serviceId: layananUmum.id } })
    await api('POST', `/api/queues/${q.body.queue.id}/cancel`, { token: t })

    const lagi = await api('POST', '/api/queues', { token: t, body: { serviceId: layananUmum.id } })
    assert.equal(lagi.status, 201, 'setelah batal seharusnya boleh ambil lagi')
  })

  test('layanan tidak ada ditolak', async () => {
    const t = await akunBaru('Antre Tujuh', '231050007', 'antre7@kampus.ac.id')
    const r = await api('POST', '/api/queues', { token: t, body: { serviceId: 99999 } })
    assert.equal(r.status, 404)
  })

  test('serviceId tidak valid ditolak', async () => {
    const t = await akunBaru('Antre Delapan', '231050008', 'antre8@kampus.ac.id')
    const r = await api('POST', '/api/queues', { token: t, body: { serviceId: 'bukan-angka' } })
    assert.equal(r.status, 400)
  })
})

// ── Melihat antrean ─────────────────────────────────────────────────────────

describe('melihat antrean', () => {
  test('mahasiswa hanya melihat antreannya sendiri', async () => {
    const t = await akunBaru('Pelanggan Sepi', '231060001', 'sepi@kampus.ac.id')
    const r = await api('GET', '/api/queues', { token: t })
    assert.equal(r.status, 200)
    assert.equal(r.body.queues.length, 0, 'akun baru seharusnya belum punya antrean')
  })

  test('petugas melihat seluruh antrean hari ini', async () => {
    const r = await api('GET', '/api/queues', { token: tokenPetugas })
    assert.equal(r.status, 200)
    assert.ok(r.body.queues.length > 0)
  })

  test('mahasiswa tidak boleh membuka papan petugas', async () => {
    const r = await api('GET', '/api/queues/board', { token: tokenMahasiswa })
    assert.equal(r.status, 403)
  })

  test('petugas bisa membuka papan antrean', async () => {
    const r = await api('GET', '/api/queues/board', { token: tokenPetugas })
    assert.equal(r.status, 200)
    assert.equal(r.body.services.length, 3)
    assert.ok(Array.isArray(r.body.queues))
  })

  test('antrean aktif menyertakan sisa antrean di depan', async () => {
    const t = await akunBaru('Antre Sembilan', '231060002', 'antre9@kampus.ac.id')
    await api('POST', '/api/queues', { token: t, body: { serviceId: layananUmum.id } })

    const r = await api('GET', '/api/queues/active', { token: t })
    assert.equal(r.status, 200)
    assert.ok(r.body.queue)
    assert.equal(typeof r.body.waitingAhead, 'number')
    assert.ok(r.body.estimate, 'estimasi waktu harus ada')
  })

  test('tanpa antrean aktif, hasilnya null', async () => {
    const t = await akunBaru('Antre Sepuluh', '231060003', 'antre10@kampus.ac.id')
    const r = await api('GET', '/api/queues/active', { token: t })
    assert.equal(r.body.queue, null)
    assert.equal(r.body.waitingAhead, 0)
  })
})

// ── Petugas memanggil nomor ─────────────────────────────────────────────────

describe('petugas mengubah status', () => {
  test('mahasiswa tidak boleh memanggil nomor (403)', async () => {
    const t = await akunBaru('Warga Sipil', '231070001', 'sipil@kampus.ac.id')
    const q = await api('POST', '/api/queues', { token: t, body: { serviceId: layananUmum.id } })
    const r = await api('PATCH', `/api/queues/${q.body.queue.id}/status`, {
      token: t,
      body: { status: 'dipanggil' },
    })
    assert.equal(r.status, 403)
  })

  test('petugas memanggil nomor: status jadi dipanggil', async () => {
    const t = await akunBaru('Dipanggil', '231070002', 'dipanggil@kampus.ac.id')
    const q = await api('POST', '/api/queues', { token: t, body: { serviceId: layananUmum.id } })

    const r = await api('PATCH', `/api/queues/${q.body.queue.id}/status`, {
      token: tokenPetugas,
      body: { status: 'dipanggil' },
    })
    assert.equal(r.status, 200)
    assert.equal(r.body.queue.status, 'dipanggil')
    assert.ok(r.body.queue.calledAt, 'waktu panggil harus tercatat')
  })

  test('dari dipanggil menjadi selesai', async () => {
    const t = await akunBaru('Selesai', '231070003', 'selesai@kampus.ac.id')
    const q = await api('POST', '/api/queues', { token: t, body: { serviceId: layananUmum.id } })
    const id = q.body.queue.id

    await api('PATCH', `/api/queues/${id}/status`, { token: tokenPetugas, body: { status: 'dipanggil' } })
    const r = await api('PATCH', `/api/queues/${id}/status`, { token: tokenPetugas, body: { status: 'selesai' } })
    assert.equal(r.body.queue.status, 'selesai')
    assert.ok(r.body.queue.finishedAt, 'waktu selesai harus tercatat')
  })

  test('antrean yang sudah selesai tidak bisa diubah lagi', async () => {
    const t = await akunBaru('Sudah Selesai', '231070004', 'sudah@kampus.ac.id')
    const q = await api('POST', '/api/queues', { token: t, body: { serviceId: layananUmum.id } })
    const id = q.body.queue.id

    await api('PATCH', `/api/queues/${id}/status`, { token: tokenPetugas, body: { status: 'selesai' } })
    const r = await api('PATCH', `/api/queues/${id}/status`, { token: tokenPetugas, body: { status: 'dipanggil' } })
    assert.equal(r.status, 409)
  })

  test('status tidak dikenal ditolak', async () => {
    const t = await akunBaru('Status Aneh', '231070005', 'aneh@kampus.ac.id')
    const q = await api('POST', '/api/queues', { token: t, body: { serviceId: layananUmum.id } })
    const r = await api('PATCH', `/api/queues/${q.body.queue.id}/status`, {
      token: tokenPetugas,
      body: { status: 'entah' },
    })
    assert.equal(r.status, 400)
  })

  test('antrean tidak ada memberi 404', async () => {
    const r = await api('PATCH', '/api/queues/999999/status', {
      token: tokenPetugas,
      body: { status: 'dipanggil' },
    })
    assert.equal(r.status, 404)
  })

  test('setelah selesai, orang itu bisa mengambil antrean baru', async () => {
    const t = await akunBaru('Kunjungan Ulang', '231070006', 'ulang@kampus.ac.id')
    const q = await api('POST', '/api/queues', { token: t, body: { serviceId: layananUmum.id } })
    await api('PATCH', `/api/queues/${q.body.queue.id}/status`, {
      token: tokenPetugas,
      body: { status: 'selesai' },
    })
    const lagi = await api('POST', '/api/queues', { token: t, body: { serviceId: layananUmum.id } })
    assert.equal(lagi.status, 201)
  })
})

// ── Membatalkan antrean ─────────────────────────────────────────────────────

describe('membatalkan antrean', () => {
  test('pemilik bisa membatalkan antreannya', async () => {
    const t = await akunBaru('Pembatal', '231080001', 'batal@kampus.ac.id')
    const q = await api('POST', '/api/queues', { token: t, body: { serviceId: layananUmum.id } })
    const r = await api('POST', `/api/queues/${q.body.queue.id}/cancel`, { token: t })
    assert.equal(r.status, 200)
    assert.equal(r.body.queue.status, 'dibatalkan')
  })

  test('orang lain tidak bisa membatalkan antrean kita', async () => {
    const a = await akunBaru('Punya A', '231080002', 'punyaA@kampus.ac.id')
    const b = await akunBaru('Punya B', '231080003', 'punyaB@kampus.ac.id')
    const q = await api('POST', '/api/queues', { token: a, body: { serviceId: layananUmum.id } })

    const r = await api('POST', `/api/queues/${q.body.queue.id}/cancel`, { token: b })
    assert.equal(r.status, 403)
  })

  test('antrean yang sudah dibatalkan tidak bisa dibatalkan lagi', async () => {
    const t = await akunBaru('Batal Dua Kali', '231080004', 'batal2@kampus.ac.id')
    const q = await api('POST', '/api/queues', { token: t, body: { serviceId: layananUmum.id } })
    await api('POST', `/api/queues/${q.body.queue.id}/cancel`, { token: t })
    const r = await api('POST', `/api/queues/${q.body.queue.id}/cancel`, { token: t })
    assert.equal(r.status, 409)
  })

  test('petugas bisa membatalkan antrean pasien', async () => {
    const t = await akunBaru('Pasien Hilang', '231080005', 'hilang@kampus.ac.id')
    const q = await api('POST', '/api/queues', { token: t, body: { serviceId: layananUmum.id } })
    const r = await api('POST', `/api/queues/${q.body.queue.id}/cancel`, { token: tokenPetugas })
    assert.equal(r.status, 200)
  })
})

// ── Keamanan data ───────────────────────────────────────────────────────────

describe('keamanan', () => {
  test('antrean mahasiswa tidak bocor ke mahasiswa lain', async () => {
    const a = await akunBaru('Rahasia A', '231090001', 'rahasiaA@kampus.ac.id')
    const b = await akunBaru('Rahasia B', '231090002', 'rahasiaB@kampus.ac.id')
    await api('POST', '/api/queues', { token: a, body: { serviceId: layananUmum.id, complaint: 'keluhan pribadi' } })

    const r = await api('GET', '/api/queues', { token: b })
    const teks = JSON.stringify(r.body)
    assert.ok(!teks.includes('keluhan pribadi'), 'keluhan orang lain tidak boleh terlihat')
  })

  test('daftar user tidak pernah terekspos', async () => {
    const r = await api('GET', '/api/queues/board', { token: tokenPetugas })
    const teks = JSON.stringify(r.body)
    assert.ok(!teks.includes('password'), 'data kata sandi tidak boleh ikut terkirim')
  })
})
