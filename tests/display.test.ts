/**
 * Tes logika tampilan SIKLINIK.
 *
 * Aturan antrean yang sebenarnya (nomor berurutan, satu antrean aktif per
 * orang, hak akses) diuji di `server/tests/api.test.js`. Berkas ini menguji
 * perhitungan tampilan yang hidup di sisi klien.
 *
 * Jalankan: npm test
 */
import { test, describe } from 'node:test'
import assert from 'node:assert/strict'

import {
  STATUS_COLOR,
  STATUS_LABEL,
  currentCalled,
  formatDate,
  formatDateFull,
  greeting,
  groupByService,
  initials,
  isActive,
  nextWaiting,
  sortByNewest,
  summarize,
} from '../src/store/display.ts'
import type { ApiQueue } from '../src/store/api.ts'

/** Membuat antrean uji ringkas. */
function q(over: Partial<ApiQueue>): ApiQueue {
  return {
    id: 1,
    number: 'A-001',
    rawNumber: 1,
    serviceId: 1,
    serviceCode: 'A',
    serviceName: 'Poli Umum',
    userId: 1,
    patientName: 'Budi',
    patientIdentity: '231040012',
    status: 'menunggu',
    complaint: '',
    date: '2025-05-26',
    time: '09:00',
    calledAt: null,
    finishedAt: null,
    ...over,
  }
}

describe('label dan warna status', () => {
  test('semua status punya label bahasa Indonesia', () => {
    assert.equal(STATUS_LABEL.menunggu, 'Menunggu')
    assert.equal(STATUS_LABEL.dipanggil, 'Sedang Dipanggil')
    assert.equal(STATUS_LABEL.selesai, 'Selesai')
    assert.equal(STATUS_LABEL.dibatalkan, 'Dibatalkan')
  })

  test('semua status punya warna', () => {
    for (const s of ['menunggu', 'dipanggil', 'selesai', 'dibatalkan'] as const) {
      assert.ok(STATUS_COLOR[s], `status ${s} belum punya warna`)
    }
  })

  test('isActive benar hanya untuk menunggu dan dipanggil', () => {
    assert.equal(isActive('menunggu'), true)
    assert.equal(isActive('dipanggil'), true)
    assert.equal(isActive('selesai'), false)
    assert.equal(isActive('dibatalkan'), false)
  })
})

describe('pengelompokan per layanan', () => {
  test('antrean dikelompokkan berdasarkan kode layanan', () => {
    const hasil = groupByService([
      q({ id: 1, serviceCode: 'A', number: 'A-001', rawNumber: 1 }),
      q({ id: 2, serviceCode: 'G', number: 'G-001', rawNumber: 1 }),
      q({ id: 3, serviceCode: 'A', number: 'A-002', rawNumber: 2 }),
    ])
    assert.equal(Object.keys(hasil).length, 2)
    assert.equal(hasil.A.length, 2)
    assert.equal(hasil.G.length, 1)
  })

  test('di dalam kelompok, urut berdasarkan nomor', () => {
    const hasil = groupByService([
      q({ id: 3, serviceCode: 'A', number: 'A-003', rawNumber: 3 }),
      q({ id: 1, serviceCode: 'A', number: 'A-001', rawNumber: 1 }),
      q({ id: 2, serviceCode: 'A', number: 'A-002', rawNumber: 2 }),
    ])
    assert.deepEqual(hasil.A.map(x => x.rawNumber), [1, 2, 3])
  })

  test('daftar kosong menghasilkan objek kosong', () => {
    assert.deepEqual(groupByService([]), {})
  })
})

describe('nomor yang sedang dipanggil dan berikutnya', () => {
  test('currentCalled mengambil yang berstatus dipanggil', () => {
    const hasil = currentCalled([
      q({ id: 1, status: 'menunggu', rawNumber: 1 }),
      q({ id: 2, status: 'dipanggil', rawNumber: 2 }),
    ])
    assert.equal(hasil?.id, 2)
  })

  test('bila ada dua dipanggil, yang nomornya terkecil dipakai', () => {
    const hasil = currentCalled([
      q({ id: 5, status: 'dipanggil', rawNumber: 5 }),
      q({ id: 2, status: 'dipanggil', rawNumber: 2 }),
    ])
    assert.equal(hasil?.rawNumber, 2)
  })

  test('currentCalled null bila tidak ada yang dipanggil', () => {
    assert.equal(currentCalled([q({ status: 'menunggu' })]), null)
    assert.equal(currentCalled([]), null)
  })

  test('nextWaiting mengambil nomor menunggu terkecil', () => {
    const hasil = nextWaiting([
      q({ id: 3, status: 'menunggu', rawNumber: 3 }),
      q({ id: 1, status: 'menunggu', rawNumber: 1 }),
      q({ id: 2, status: 'selesai', rawNumber: 2 }),
    ])
    assert.equal(hasil?.rawNumber, 1, 'nomor terkecil yang menunggu harus dipanggil lebih dulu')
  })

  test('nextWaiting mengabaikan yang sudah selesai atau dibatalkan', () => {
    const hasil = nextWaiting([
      q({ id: 1, status: 'selesai', rawNumber: 1 }),
      q({ id: 2, status: 'dibatalkan', rawNumber: 2 }),
      q({ id: 3, status: 'menunggu', rawNumber: 3 }),
    ])
    assert.equal(hasil?.rawNumber, 3)
  })

  test('nextWaiting null bila tidak ada yang menunggu', () => {
    assert.equal(nextWaiting([q({ status: 'selesai' })]), null)
  })
})

describe('ringkasan papan', () => {
  test('menghitung jumlah tiap status', () => {
    const r = summarize([
      q({ id: 1, status: 'menunggu' }),
      q({ id: 2, status: 'menunggu' }),
      q({ id: 3, status: 'dipanggil' }),
      q({ id: 4, status: 'selesai' }),
      q({ id: 5, status: 'dibatalkan' }),
    ])
    assert.equal(r.menunggu, 2)
    assert.equal(r.dipanggil, 1)
    assert.equal(r.selesai, 1)
    assert.equal(r.dibatalkan, 1)
    assert.equal(r.total, 5)
  })

  test('daftar kosong menghasilkan nol', () => {
    const r = summarize([])
    assert.equal(r.total, 0)
    assert.equal(r.menunggu, 0)
  })
})

describe('pengurutan riwayat', () => {
  test('yang terbaru (id terbesar) di depan', () => {
    const hasil = sortByNewest([q({ id: 1 }), q({ id: 9 }), q({ id: 5 })])
    assert.deepEqual(hasil.map(x => x.id), [9, 5, 1])
  })

  test('tidak mengubah array aslinya', () => {
    const awal = [q({ id: 1 }), q({ id: 9 })]
    const salinan = JSON.parse(JSON.stringify(awal))
    sortByNewest(awal)
    assert.deepEqual(awal, salinan, 'fungsi mengubah array aslinya')
  })
})

describe('format tanggal', () => {
  test('formatDate memakai nama bulan Indonesia', () => {
    assert.equal(formatDate('2025-05-12'), '12 Mei 2025')
    assert.equal(formatDate('2025-01-01'), '1 Januari 2025')
    assert.equal(formatDate('2024-12-31'), '31 Desember 2024')
  })

  test('formatDateFull memakai nama hari', () => {
    // 26 Mei 2025 adalah hari Senin.
    const teks = formatDateFull(new Date(2025, 4, 26))
    assert.equal(teks, 'Senin, 26 Mei 2025')
  })
})

describe('teks untuk pengguna', () => {
  test('greeting mengambil nama depan saja', () => {
    assert.equal(greeting('Aldi Yonatan'), 'Aldi')
    assert.equal(greeting('Siti'), 'Siti')
    assert.equal(greeting('  Budi   Santoso  '), 'Budi')
  })

  test('initials mengambil huruf depan dan belakang', () => {
    assert.equal(initials('Aldi Yonatan'), 'AY')
    assert.equal(initials('Siti Rahayu Putri'), 'SP')
    assert.equal(initials('Budi'), 'BU')
    assert.equal(initials(''), '?')
  })
})
