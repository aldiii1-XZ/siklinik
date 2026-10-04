/**
 * Tes logika obrolan asisten (sisi klien).
 *
 * Menguji penguraian balasan menjadi baris/paragraf dan penanda tebal/miring,
 * supaya tampilan obrolan tidak salah render.
 *
 * Jalankan: npm test (dari folder akar)
 */
import { test, describe } from 'node:test'
import assert from 'node:assert/strict'

import { uraiInline, uraiPesan, jamSekarang, SARAN_CEPAT } from '../src/store/chat.ts'

describe('uraiInline — penanda tebal dan miring', () => {
  test('teks tanpa penanda menjadi satu token', () => {
    assert.deepEqual(uraiInline('halo dunia'), [{ teks: 'halo dunia' }])
  })

  test('**tebal** dikenali', () => {
    assert.deepEqual(uraiInline('minum **air** putih'), [
      { teks: 'minum ' },
      { teks: 'air', tebal: true },
      { teks: ' putih' },
    ])
  })

  test('_miring_ dikenali', () => {
    assert.deepEqual(uraiInline('ini _penting_ ya'), [
      { teks: 'ini ' },
      { teks: 'penting', miring: true },
      { teks: ' ya' },
    ])
  })

  test('beberapa penanda dalam satu baris', () => {
    const token = uraiInline('**A** lalu _B_ selesai')
    // Hasil: [tebal A][teks ' lalu '][miring B][teks ' selesai'] = 4 token.
    assert.equal(token.length, 4)
    assert.equal(token[0].tebal, true)
    assert.equal(token[2].miring, true)
  })

  test('teks kosong menghasilkan satu token kosong', () => {
    assert.deepEqual(uraiInline(''), [{ teks: '' }])
  })

  test('penanda belum ditutup dibiarkan apa adanya', () => {
    assert.deepEqual(uraiInline('**belum ditutup'), [{ teks: '**belum ditutup' }])
  })
})

describe('uraiPesan — paragraf dan daftar', () => {
  test('satu baris menjadi satu paragraf', () => {
    const hasil = uraiPesan('Halo')
    assert.equal(hasil.length, 1)
    assert.equal(hasil[0].jenis, 'paragraf')
  })

  test('baris kosong menjadi pemisah', () => {
    const hasil = uraiPesan('Satu\n\nDua')
    assert.deepEqual(hasil.map(b => b.jenis), ['paragraf', 'kosong', 'paragraf'])
  })

  test('butir bernomor dikenali dengan penanda benar', () => {
    const hasil = uraiPesan('Saran:\n1. Minum air\n2. Istirahat')
    assert.equal(hasil[1].jenis, 'daftar')
    assert.equal(hasil[1].penanda, '1.')
    assert.equal(hasil[2].penanda, '2.')
  })

  test('butir dengan tanda bullet dikenali', () => {
    const hasil = uraiPesan('• Poli Umum\n• Poli Gigi')
    assert.equal(hasil[0].jenis, 'daftar')
    assert.equal(hasil[0].penanda, '•')
  })

  test('tanda hubung dan bintang juga dianggap bullet', () => {
    assert.equal(uraiPesan('- satu')[0].jenis, 'daftar')
    assert.equal(uraiPesan('* dua')[0].jenis, 'daftar')
  })

  test('tebal di dalam butir daftar tetap dikenali', () => {
    const hasil = uraiPesan('1. Minum **air** putih')
    assert.equal(hasil[0].jenis, 'daftar')
    assert.equal(hasil[0].token[1].tebal, true)
  })

  test('baris kosong berlebih di ujung dibuang', () => {
    const hasil = uraiPesan('\n\nHalo\n\n\n')
    assert.equal(hasil.length, 1)
    assert.equal(hasil[0].jenis, 'paragraf')
  })

  test('teks kosong menghasilkan daftar kosong', () => {
    assert.deepEqual(uraiPesan(''), [])
  })
})

describe('jamSekarang', () => {
  test('memberi format HH:MM dua digit', () => {
    assert.equal(jamSekarang(new Date(2025, 4, 26, 9, 5)), '09:05')
    assert.equal(jamSekarang(new Date(2025, 4, 26, 14, 30)), '14:30')
    assert.equal(jamSekarang(new Date(2025, 4, 26, 0, 0)), '00:00')
  })
})

describe('saran cepat', () => {
  test('tersedia dan berupa kalimat yang bisa dikirim', () => {
    assert.ok(SARAN_CEPAT.length >= 3)
    for (const s of SARAN_CEPAT) {
      assert.equal(typeof s, 'string')
      assert.ok(s.trim().length > 0)
    }
  })
})
