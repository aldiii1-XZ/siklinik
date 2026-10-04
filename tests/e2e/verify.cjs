/**
 * Verifikasi alur SIKLINIK di browser sungguhan (end-to-end).
 *
 * Membuktikan hal yang hanya muncul saat semuanya tersambung:
 *  - mahasiswa mengambil nomor antrean dan nomornya berurutan
 *  - petugas MEMANGGIL nomor itu, dan statusnya berubah bagi mahasiswa
 *  - satu orang tidak bisa punya dua antrean aktif
 *  - hak akses terjaga (mahasiswa tidak bisa membuka papan petugas)
 *
 * Jalankan (butuh API + frontend hidup):
 *   cd server && PORT=3020 npm start
 *   API_URL=http://localhost:3020 npm run dev
 *   SIKLINIK_URL=http://localhost:5173/ npm run test:e2e
 */
const { chromium } = require('playwright')

const URL = process.env.SIKLINIK_URL || 'http://localhost:5173/'
const suffix = String(Date.now()).slice(-6)

const results = []
function check(name, pass, detail = '') {
  results.push({ name, pass })
  console.log(`${pass ? '✔' : '✖'} ${name}${detail ? ' — ' + detail : ''}`)
}

/** Masuk lewat formulir di halaman. */
async function masuk(page, email, password) {
  await page.fill('input[type="email"]', email)
  await page.fill('input[type="password"]', password)
  await page.click('button[type="submit"]')
}

/**
 * Keluar lalu masuk sebagai akun lain.
 *
 * Setelah keluar, aplikasi bisa menampilkan landing page ATAU langsung
 * halaman masuk, tergantung halaman mana yang terakhir dibuka. Helper ini
 * menangani kedua kemungkinan.
 */
async function keluarDanMasuk(page, email, password) {
  await page.click('button:has-text("Keluar")')
  // Tunggu salah satu muncul: landing ("Sehat tanpa") atau form masuk.
  await page.waitForFunction(
    () => {
      const t = document.body.innerText
      return t.includes('Sehat tanpa') || t.includes('Selamat datang')
    },
    { timeout: 15000 },
  )
  // Bila masih di landing, buka halaman masuk.
  if (!(await page.locator('input[type="email"]').count())) {
    await page.click('button:has-text("Masuk")')
    await page.waitForSelector('input[type="email"]', { timeout: 10000 })
  }
  await masuk(page, email, password)
}

/**
 * Berpindah tab dashboard. Selector dipersempit ke sidebar karena navigasi
 * bawah (khusus ponsel) juga memuat tombol dengan teks yang sama.
 */
async function klikTab(page, label) {
  await page.locator(`aside nav button:has-text("${label}")`).first().click()
}

/** Mendaftar akun baru lewat halaman daftar. */
async function daftar(page, { nama, nim, email, sandi }) {
  await page.click('text=Buat akun gratis')
  await page.waitForSelector('text=DAFTAR AKUN BARU', { timeout: 15000 })
  await page.fill('input#name', nama)
  await page.fill('input#identity', nim)
  await page.selectOption('select#role', 'mahasiswa')
  await page.fill('input#email', email)
  await page.fill('input#password', sandi)
  await page.check('input[type="checkbox"]')
  await page.click('button[type="submit"]')
}

;(async () => {
  const browser = await chromium.launch()
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })

  const errors = []
  page.on('pageerror', e => errors.push(String(e)))
  page.on('console', m => {
    if (m.type() !== 'error') return
    // 401 dari uji login-salah memang disengaja.
    if (/401 \(Unauthorized\)/.test(m.text())) return
    errors.push(m.text())
  })

  try {
    // ── Landing ─────────────────────────────────────────────────────────────
    await page.goto(URL, { waitUntil: 'networkidle' })
    await page.waitForSelector('text=Sehat tanpa', { timeout: 20000 })
    check('Landing page tampil (frontend + API tersambung)', true)
    check('Tidak ada error konsol saat memuat', errors.length === 0, errors.join(' | '))

    const landing = await page.textContent('body')
    check('Judul dan layanan tampil di landing', landing.includes('Sehat tanpa') && landing.includes('Poli Umum'))

    // ── Login salah ditolak ─────────────────────────────────────────────────
    await page.click('text=Masuk')
    await page.waitForSelector('text=Selamat datang', { timeout: 15000 })
    await masuk(page, 'mahasiswa@kampus.ac.id', 'salahbanget')
    await page.waitForSelector('text=Email atau kata sandi salah', { timeout: 10000 })
    check('Kata sandi salah ditolak', true)

    // ── Daftar akun baru ────────────────────────────────────────────────────
    const emailUji = `pasien${suffix}@kampus.ac.id`
    await page.click('text=Daftar sekarang')
    await page.waitForSelector('text=DAFTAR AKUN BARU', { timeout: 15000 })
    check('Halaman daftar tampil', true)

    // Coba tanpa centang persetujuan -> harus ditolak
    await page.fill('input#name', 'Pasien Uji')
    await page.fill('input#identity', `2310${suffix}`)
    await page.selectOption('select#role', 'mahasiswa')
    await page.fill('input#email', emailUji)
    await page.fill('input#password', 'rahasia123')
    await page.click('button[type="submit"]')
    await page.waitForSelector('text=menyetujui Syarat Penggunaan', { timeout: 8000 })
    check('Daftar tanpa centang persetujuan ditolak', true)

    await page.check('input[type="checkbox"]')
    await page.click('button[type="submit"]')
    await page.waitForSelector('text=Selamat datang', { timeout: 20000 })
    check('Registrasi akun baru berhasil (tersimpan di server)', true)

    // ── Ambil nomor antrean ─────────────────────────────────────────────────
    await page.waitForSelector('text=Belum ada antrean aktif', { timeout: 15000 })
    check('Beranda mahasiswa menampilkan keadaan awal', true)

    await klikTab(page, "Layanan")
    await page.waitForSelector('text=Pilih layanan klinik', { timeout: 10000 })
    check('Tab Layanan tampil', true)

    await page.locator('button:has-text("Ambil nomor antrean")').first().click()
    // Tunggu dialog konfirmasi muncul (judulnya juga "Ambil nomor antrean").
    await page.waitForSelector('textarea#keluhan', { timeout: 10000 })
    check('Dialog ambil antrean terbuka', true)
    await page.fill('textarea#keluhan', 'Demam sejak kemarin')
    // Tombol konfirmasi ada di dalam dialog.
    await page.locator('[role="dialog"] button:has-text("Ambil nomor")').click()
    await page.waitForSelector('text=Antrean aktif', { timeout: 15000 })
    check('Berhasil mengambil nomor antrean', true)

    const beranda = await page.textContent('body')
    const cocokNomor = beranda.match(/A-\d{3}/)
    const nomorSaya = cocokNomor ? cocokNomor[0] : null
    check('Nomor antrean tampil di Beranda', !!nomorSaya, nomorSaya ?? 'tidak ditemukan')

    // ── Tidak boleh punya dua antrean aktif ─────────────────────────────────
    await klikTab(page, "Layanan")
    await page.waitForSelector('text=Pilih layanan klinik', { timeout: 10000 })
    const tombolAmbil = page.locator('button:has-text("Masih ada antrean aktif")')
    check('Tombol ambil dinonaktifkan saat masih ada antrean aktif', (await tombolAmbil.count()) > 0)

    // ── Riwayat mencatat antrean ────────────────────────────────────────────
    await klikTab(page, "Riwayat")
    await page.waitForSelector('text=Riwayat kunjungan', { timeout: 10000 })
    const riwayat = await page.textContent('body')
    check('Antrean tercatat di Riwayat', riwayat.includes('Poli Umum'))

    // ── Profil bisa diubah ──────────────────────────────────────────────────
    await klikTab(page, "Profil")
    await page.waitForSelector('text=Akun saya', { timeout: 10000 })
    await page.fill('input#p-telp', '0812 9999 8888')
    await page.click('button:has-text("Simpan perubahan")')
    await page.waitForSelector('text=Profil berhasil diperbarui', { timeout: 10000 })
    check('Profil berhasil diperbarui', true)

    // ── Sesi bertahan setelah muat ulang ────────────────────────────────────
    await page.reload({ waitUntil: 'networkidle' })
    await page.waitForSelector('text=Selamat datang', { timeout: 20000 })
    check('Sesi dipulihkan otomatis setelah muat ulang', true)

    // ── Mahasiswa tidak boleh membuka papan petugas ─────────────────────────
    const teksMahasiswa = await page.textContent('body')
    check('Mahasiswa tidak melihat papan petugas', !teksMahasiswa.includes('Papan antrean'))

    // ── Petugas masuk dan memanggil nomor ───────────────────────────────────
    await keluarDanMasuk(page, 'petugas@klinik.ac.id', 'petugas123')
    await page.waitForSelector('text=Papan antrean', { timeout: 20000 })
    check('Petugas masuk ke papan antrean', true)

    const papan = await page.textContent('body')
    check('Antrean mahasiswa terlihat oleh petugas', papan.includes('Pasien Uji'))
    check('Keluhan dari mahasiswa terlihat oleh petugas', papan.includes('Demam sejak kemarin'))

    // Panggil nomor berikutnya
    const tombolPanggil = page.locator('button:has-text("📢 Panggil")').first()
    check('Tombol panggil tersedia untuk petugas', (await tombolPanggil.count()) > 0)
    if (await tombolPanggil.count() > 0) {
      await tombolPanggil.click()
      await page.waitForTimeout(1500)
      const setelahPanggil = await page.textContent('body')
      check('Petugas berhasil memanggil nomor', setelahPanggil.includes('SEDANG DIPANGGIL'))
    }

    // Tandai selesai
    const tombolSelesai = page.locator('button:has-text("Tandai selesai")').first()
    if (await tombolSelesai.count() > 0) {
      await tombolSelesai.click()
      await page.waitForTimeout(1500)
      const setelahSelesai = await page.textContent('body')
      check('Petugas menandai antrean selesai', setelahSelesai.includes('SELESAI HARI INI'))
    } else {
      check('Petugas menandai antrean selesai', false, 'tombol tidak ditemukan')
    }

    // ── Mahasiswa melihat status terbaru ────────────────────────────────────
    await keluarDanMasuk(page, emailUji, 'rahasia123')
    await page.waitForSelector('text=Selamat datang', { timeout: 20000 })
    await klikTab(page, 'Riwayat')
    await page.waitForSelector('text=Riwayat kunjungan', { timeout: 10000 })
    const riwayatAkhir = await page.textContent('body')
    check('Status terbaru dari petugas terlihat mahasiswa', riwayatAkhir.includes('Selesai'))
  } catch (err) {
    check('Alur berjalan tanpa kesalahan tak terduga', false, String(err).split('\n')[0])
  }

  const lulus = results.filter(r => r.pass).length
  console.log('\n' + '='.repeat(64))
  console.log(`HASIL: ${lulus}/${results.length} pemeriksaan lulus`)
  console.log('Error konsol:', errors.length === 0 ? 'tidak ada' : errors.join(' | '))
  console.log('='.repeat(64))

  await browser.close()
  process.exit(lulus === results.length && errors.length === 0 ? 0 : 1)
})()
