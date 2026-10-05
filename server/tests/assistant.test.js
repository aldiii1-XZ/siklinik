/**
 * Tes asisten kesehatan SIKLINIK.
 *
 * Menguji dua hal terpisah:
 *  1. Modul asisten (src/assistant.js) — pengaman darurat, jawaban mode lokal,
 *     dan mode LLM memakai fetch tiruan (tanpa memanggil API sungguhan).
 *  2. Rute API — hak akses, penyimpanan riwayat, dan pembatasan laju.
 *
 * Jalankan: npm test (dari folder server/)
 */
import { test, describe, before, after, beforeEach, afterEach } from 'node:test'
import assert from 'node:assert/strict'
import { createApp } from '../src/app.js'
import { openDatabase, seedDatabase } from '../src/db.js'
import { hashPassword } from '../src/auth.js'
import { buatAsisten, deteksiDarurat, jawabLokal, rangkaiJawaban, tanpaCatatan, CATATAN_PENUTUP } from '../src/assistant.js'

// ── Bagian 1: modul asisten ─────────────────────────────────────────────────

describe('pengaman tanda bahaya', () => {
  test('mengenali keluhan gawat darurat', () => {
    for (const teks of [
      'aku nyeri dada sejak tadi',
      'sulit bernapas',
      'teman saya pingsan',
      'ada perdarahan banyak',
      'kepala saya terbentur keras',
      'aku ingin mati saja',
    ]) {
      assert.equal(deteksiDarurat(teks), true, `gagal mengenali: ${teks}`)
    }
  })

  test('tidak menandai keluhan ringan sebagai darurat', () => {
    for (const teks of ['aku demam', 'sakit gigi', 'batuk pilek', 'susah tidur', 'sakit perut']) {
      assert.equal(deteksiDarurat(teks), false, `salah tandai darurat: ${teks}`)
    }
  })

  test('mode lokal mengarahkan ke 119 untuk keluhan darurat', async () => {
    const a = buatAsisten()
    const r = await a.tanya('dada saya nyeri sekali')
    assert.equal(r.darurat, true)
    assert.match(r.reply, /119/)
    assert.match(r.reply, /IGD/)
  })

  test('tanda bahaya diutamakan walau mode LLM aktif', async () => {
    // Bahkan bila LLM dikonfigurasi, keluhan darurat tidak dikirim ke LLM.
    const a = buatAsisten({ apiKey: 'x', baseUrl: 'http://127.0.0.1:1', model: 'uji' })
    const r = await a.tanya('saya sesak napas')
    assert.equal(r.darurat, true)
    assert.match(r.reply, /119/)
  })
})

describe('mode lokal', () => {
  test('menjawab pertanyaan demam dengan saran praktis', async () => {
    const a = buatAsisten()
    const r = await a.tanya('aku demam sejak kemarin, apa yang harus kulakukan?')
    assert.equal(r.mode, 'lokal')
    assert.equal(r.topik, 'demam')
    assert.match(r.reply, /istirahat/i)
    assert.match(r.reply, /bukan pengganti dokter/i)
  })

  test('mengarahkan sakit gigi ke Poli Gigi', async () => {
    const r = await buatAsisten().tanya('gigi saya sakit dan gusi bengkak')
    assert.equal(r.topik, 'gigi')
    assert.match(r.reply, /Poli Gigi/i)
  })

  test('mengarahkan masalah tidur ke Konseling', async () => {
    const r = await buatAsisten().tanya('akhir-akhir ini aku susah tidur dan cemas')
    assert.equal(r.topik, 'mental')
    assert.match(r.reply, /Konseling/i)
  })

  test('menjawab pertanyaan soal cara ambil nomor antrean', async () => {
    const r = await buatAsisten().tanya('bagaimana cara ambil nomor antrean?')
    assert.equal(r.topik, 'cara-antrean')
    assert.match(r.reply, /Layanan/)
  })

  test('pertanyaan tak dikenal dijawab jujur, bukan dikarang', async () => {
    const r = await buatAsisten().tanya('berapa harga tiket konser besok?')
    assert.equal(r.topik, null)
    assert.match(r.reply, /belum punya jawaban khusus/i)
  })

  test('pesan kosong dibalas sapaan', async () => {
    const r = await buatAsisten().tanya('')
    assert.match(r.reply, /asisten kesehatan SIKLINIK/i)
  })

  test('sapaan menyebut nama depan pengguna', async () => {
    const r = await buatAsisten().tanya('', { nama: 'Aldi Yonatan' })
    assert.match(r.reply, /Halo Aldi/)
  })

  test('pemilihan topik memakai kata kunci paling spesifik', () => {
    // "sakit kepala" harus menang atas kata umum lain.
    assert.equal(jawabLokal('kepala saya sakit kepala berdenyut').id, 'kepala')
  })

  test('rangkaiJawaban menyusun saran bernomor', () => {
    const teks = rangkaiJawaban({ jawaban: 'Pembuka.', saran: ['Satu.', 'Dua.'] })
    assert.match(teks, /1\. Satu\./)
    assert.match(teks, /2\. Dua\./)
  })
})

describe('mode LLM', () => {
  const fetchAsli = globalThis.fetch
  let dipanggil
  let balasan

  beforeEach(() => {
    dipanggil = null
    balasan = null
  })

  afterEach(() => {
    globalThis.fetch = fetchAsli
  })

  test('mengirim pertanyaan ke endpoint dan mengembalikan jawaban', async () => {
    globalThis.fetch = async (url, opsi) => {
      dipanggil = { url, opsi }
      return {
        ok: true,
        json: async () => ({ choices: [{ message: { content: 'Minum air yang cukup ya.' } }] }),
      }
    }
    const a = buatAsisten({ apiKey: 'kunci-uji', baseUrl: 'https://contoh.test/v1', model: 'model-uji' })
    assert.equal(a.mode, 'llm')

    const r = await a.tanya('aku haus terus')
    assert.equal(r.mode, 'llm')
    assert.match(r.reply, /Minum air/)
    assert.match(r.reply, /bukan pengganti dokter/i)

    // Alamat, kunci, dan model harus benar-benar dipakai.
    assert.equal(dipanggil.url, 'https://contoh.test/v1/chat/completions')
    assert.equal(dipanggil.opsi.headers.authorization, 'Bearer kunci-uji')
    const body = JSON.parse(dipanggil.opsi.body)
    assert.equal(body.model, 'model-uji')
    assert.equal(body.messages[0].role, 'system')
    assert.match(body.messages[0].content, /JANGAN pernah memberi diagnosis/)
  })

  test('baseUrl berakhiran garis miring tetap benar', async () => {
    globalThis.fetch = async url => {
      dipanggil = { url }
      return { ok: true, json: async () => ({ choices: [{ message: { content: 'ok' } }] }) }
    }
    await buatAsisten({ apiKey: 'k', baseUrl: 'https://contoh.test/v1/', model: 'm' }).tanya('halo')
    assert.equal(dipanggil.url, 'https://contoh.test/v1/chat/completions')
  })

  test('riwayat percakapan diteruskan sebagai konteks', async () => {
    globalThis.fetch = async (url, opsi) => {
      dipanggil = { opsi }
      return { ok: true, json: async () => ({ choices: [{ message: { content: 'ok' } }] }) }
    }
    await buatAsisten({ apiKey: 'k', baseUrl: 'https://c.test/v1', model: 'm' }).tanya('lanjut', {
      riwayat: [
        { role: 'user', content: 'aku demam' },
        { role: 'assistant', content: 'istirahat ya' },
      ],
    })
    const body = JSON.parse(dipanggil.opsi.body)
    assert.equal(body.messages.length, 4) // system + 2 riwayat + pertanyaan baru
    assert.equal(body.messages[1].content, 'aku demam')
  })

  test('LLM gagal (kuota habis) -> turun ke mode lokal, pengguna tetap dapat jawaban', async () => {
    globalThis.fetch = async () => ({ ok: false, status: 429, json: async () => ({}) })
    const a = buatAsisten({ apiKey: 'k', baseUrl: 'https://c.test/v1', model: 'm' })
    const r = await a.tanya('aku demam')
    assert.equal(r.mode, 'lokal', 'harus turun ke mode lokal saat LLM gagal')
    assert.equal(r.topik, 'demam')
    assert.match(r.reply, /istirahat/i)
  })

  test('LLM menjawab kosong -> turun ke mode lokal', async () => {
    globalThis.fetch = async () => ({ ok: true, json: async () => ({ choices: [] }) })
    const r = await buatAsisten({ apiKey: 'k', baseUrl: 'https://c.test/v1', model: 'm' }).tanya('sakit gigi')
    assert.equal(r.mode, 'lokal')
    assert.equal(r.topik, 'gigi')
  })

  test('mode lokal dipakai bila kunci tidak lengkap', () => {
    assert.equal(buatAsisten({}).mode, 'lokal')
    assert.equal(buatAsisten({ apiKey: 'k' }).mode, 'lokal') // baseUrl & model kosong
    assert.equal(buatAsisten({ apiKey: 'k', baseUrl: 'https://x.test/v1' }).mode, 'lokal') // model kosong
  })

  test('catatan penutup tidak muncul dua kali bila model sudah menuliskannya', async () => {
    // Model meniru catatan penutup dari riwayat -> kode tidak boleh menambah lagi.
    globalThis.fetch = async () => ({
      ok: true,
      json: async () => ({
        choices: [{ message: { content: 'Istirahat ya.' + CATATAN_PENUTUP } }],
      }),
    })
    const r = await buatAsisten({ apiKey: 'k', baseUrl: 'https://c.test/v1', model: 'm' }).tanya('aku demam')
    const jumlah = (r.reply.match(/bukan pengganti dokter/gi) || []).length
    assert.equal(jumlah, 1, `catatan muncul ${jumlah} kali, seharusnya sekali`)
  })

  test('catatan penutup tetap ditambahkan bila model tidak menuliskannya', async () => {
    globalThis.fetch = async () => ({
      ok: true,
      json: async () => ({ choices: [{ message: { content: 'Istirahat yang cukup.' } }] }),
    })
    const r = await buatAsisten({ apiKey: 'k', baseUrl: 'https://c.test/v1', model: 'm' }).tanya('aku demam')
    assert.match(r.reply, /bukan pengganti dokter/i)
  })

  test('catatan penutup dibuang dari riwayat yang dikirim ke LLM', async () => {
    // Bila catatan ikut terkirim, model akan menirunya dan catatan jadi ganda.
    globalThis.fetch = async (url, opsi) => {
      dipanggil = { opsi }
      return { ok: true, json: async () => ({ choices: [{ message: { content: 'ok' } }] }) }
    }
    await buatAsisten({ apiKey: 'k', baseUrl: 'https://c.test/v1', model: 'm' }).tanya('lanjut', {
      riwayat: [
        { role: 'user', content: 'aku demam' },
        { role: 'assistant', content: 'Istirahat ya.' + CATATAN_PENUTUP },
      ],
    })
    const body = JSON.parse(dipanggil.opsi.body)
    const dariAsisten = body.messages.find(m => m.role === 'assistant')
    assert.ok(!/bukan pengganti dokter/i.test(dariAsisten.content), 'catatan harus dibuang dari riwayat')
  })

  test('reasoning_content model tidak bocor ke jawaban', async () => {
    // NaraRouter/GLM mengembalikan proses berpikir di reasoning_content.
    globalThis.fetch = async () => ({
      ok: true,
      json: async () => ({
        choices: [
          {
            message: {
              content: 'Minum air cukup ya.',
              reasoning_content: 'RAHASIA-PROSES-BERPIKIR yang tidak boleh tampil',
            },
          },
        ],
      }),
    })
    const r = await buatAsisten({ apiKey: 'k', baseUrl: 'https://c.test/v1', model: 'm' }).tanya('aku haus')
    assert.ok(!r.reply.includes('RAHASIA-PROSES-BERPIKIR'), 'reasoning_content bocor ke pengguna')
    assert.match(r.reply, /Minum air/)
  })
})

describe('tanpaCatatan', () => {
  test('membuang catatan penutup', () => {
    const teks = 'Istirahat ya.' + CATATAN_PENUTUP
    assert.equal(tanpaCatatan(teks), 'Istirahat ya.')
  })

  test('teks tanpa catatan dibiarkan utuh', () => {
    assert.equal(tanpaCatatan('Halo, ada yang bisa dibantu?'), 'Halo, ada yang bisa dibantu?')
  })

  test('teks kosong aman', () => {
    assert.equal(tanpaCatatan(''), '')
    assert.equal(tanpaCatatan(null), '')
  })
})

// ── Bagian 2: rute API ──────────────────────────────────────────────────────

let server
let baseUrl
let tokenMahasiswa

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

before(async () => {
  const db = openDatabase(':memory:')
  seedDatabase(db, { hashPassword })
  // Asisten lokal (tanpa API key) supaya tes tidak butuh jaringan.
  const app = createApp(db, { assistant: buatAsisten() })
  await new Promise(resolve => {
    server = app.listen(0, resolve)
  })
  baseUrl = `http://127.0.0.1:${server.address().port}`
  const r = await api('POST', '/api/auth/login', {
    body: { email: 'mahasiswa@kampus.ac.id', password: '12345678' },
  })
  tokenMahasiswa = r.body.token
})

after(() => server?.close())

describe('rute asisten — hak akses', () => {
  test('tanpa masuk ditolak', async () => {
    const r = await api('POST', '/api/assistant/chat', { body: { message: 'halo' } })
    assert.equal(r.status, 401)
  })

  test('mode asisten bisa dibaca tanpa masuk', async () => {
    const r = await api('GET', '/api/assistant/info')
    assert.equal(r.status, 200)
    assert.equal(r.body.mode, 'lokal')
  })
})

describe('rute asisten — percakapan', () => {
  test('mengirim pesan dan mendapat balasan', async () => {
    const r = await api('POST', '/api/assistant/chat', {
      token: tokenMahasiswa,
      body: { message: 'aku demam sejak kemarin' },
    })
    assert.equal(r.status, 200)
    assert.match(r.body.reply, /istirahat/i)
    assert.equal(r.body.darurat, false)
    assert.equal(r.body.mode, 'lokal')
  })

  test('keluhan darurat ditandai di respons', async () => {
    const r = await api('POST', '/api/assistant/chat', {
      token: tokenMahasiswa,
      body: { message: 'aku sesak napas' },
    })
    assert.equal(r.status, 200)
    assert.equal(r.body.darurat, true)
    assert.match(r.body.reply, /119/)
  })

  test('pesan kosong ditolak', async () => {
    const r = await api('POST', '/api/assistant/chat', {
      token: tokenMahasiswa,
      body: { message: '   ' },
    })
    assert.equal(r.status, 400)
  })

  test('pesan terlalu panjang ditolak', async () => {
    const r = await api('POST', '/api/assistant/chat', {
      token: tokenMahasiswa,
      body: { message: 'a'.repeat(1001) },
    })
    assert.equal(r.status, 400)
  })

  test('percakapan tersimpan dan bisa dibaca kembali', async () => {
    const r = await api('GET', '/api/assistant/messages', { token: tokenMahasiswa })
    assert.equal(r.status, 200)
    assert.ok(r.body.messages.length >= 4, 'pesan sebelumnya harus tersimpan')
    const peran = r.body.messages.map(m => m.role)
    assert.ok(peran.includes('user'))
    assert.ok(peran.includes('assistant'))
  })

  test('riwayat bisa dihapus', async () => {
    const hapus = await api('DELETE', '/api/assistant/messages', { token: tokenMahasiswa })
    assert.equal(hapus.status, 200)

    const r = await api('GET', '/api/assistant/messages', { token: tokenMahasiswa })
    assert.equal(r.body.messages.length, 0)
  })
})

describe('rute asisten — pembatasan laju', () => {
  test('maksimum 20 pesan per menit per pengguna', async () => {
    // Akun baru supaya tidak bercampur dengan uji lain.
    const daftar = await api('POST', '/api/auth/register', {
      body: {
        name: 'Uji Laju',
        identity: '999000111',
        email: 'laju@kampus.ac.id',
        role: 'mahasiswa',
        password: 'rahasia123',
      },
    })
    const token = daftar.body.token

    let terakhir = null
    for (let i = 0; i < 21; i++) {
      terakhir = await api('POST', '/api/assistant/chat', {
        token,
        body: { message: `pesan ke-${i}` },
      })
    }
    assert.equal(terakhir.status, 429, 'pesan ke-21 harus ditolak')
    assert.match(terakhir.body.error, /Terlalu banyak pesan/)
  })
})
