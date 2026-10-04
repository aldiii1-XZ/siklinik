/**
 * API SIKLINIK — Express 5 + SQLite.
 *
 * Aturan antrean ditegakkan di server, bukan di klien, karena klien tidak bisa
 * dipercaya: siapa pun bisa memanggil API langsung.
 *
 * Aturan penting:
 *  - Satu orang hanya boleh punya SATU antrean aktif per hari.
 *  - Nomor antrean berurutan per layanan per hari, dengan awalan kode layanan
 *    (A-001, A-002, G-001, ...).
 *  - Hanya petugas yang boleh memanggil nomor dan mengubah status.
 *  - Mahasiswa hanya melihat antreannya sendiri.
 */
import express from 'express'
import cors from 'cors'
import { z } from 'zod'
import {
  authenticate,
  createToken,
  hashPassword,
  publicUser,
  requireAuth,
  requireStaff,
  verifyPassword,
} from './auth.js'
import { buatAsisten } from './assistant.js'

/** Menjalankan sekumpulan perintah dalam satu transaksi. */
function transaction(db, fn) {
  db.exec('BEGIN')
  try {
    const result = fn()
    db.exec('COMMIT')
    return result
  } catch (err) {
    db.exec('ROLLBACK')
    throw err
  }
}

/** Kode galat dengan status HTTP. */
function httpError(message, status) {
  return Object.assign(new Error(message), { status })
}

const registerSchema = z.object({
  name: z.string().trim().min(1, 'Nama wajib diisi.'),
  identity: z.string().trim().min(4, 'NIM / NIP tidak valid.'),
  email: z.string().trim().toLowerCase().email('Email tidak valid.'),
  role: z.enum(['mahasiswa', 'staf'], { message: 'Status harus Mahasiswa atau Staf kampus.' }),
  password: z.string().min(8, 'Kata sandi minimal 8 karakter.'),
  phone: z.string().trim().default(''),
})

const loginSchema = z.object({
  email: z.string().trim().toLowerCase(),
  password: z.string().min(1),
})

const takeSchema = z.object({
  serviceId: z.number().int().positive(),
  complaint: z.string().trim().max(200).default(''),
})

const statusSchema = z.object({
  status: z.enum(['menunggu', 'dipanggil', 'selesai', 'dibatalkan']),
})

/**
 * Membuat aplikasi Express.
 * `db` disuntikkan supaya tes dapat memakai basis data di memori.
 * `opsi.assistant` juga bisa disuntikkan untuk menguji tanpa memanggil LLM.
 */
export function createApp(db, opsi = {}) {
  const app = express()
  const assistant = opsi.assistant ?? buatAsisten()
  app.use(cors())
  app.use(express.json({ limit: '100kb' }))
  app.use(authenticate(db))

  const wrap = fn => (req, res, next) => {
    try {
      const hasil = fn(req, res, next)
      // Rute async (mis. asisten yang memanggil LLM) bisa menolak promise;
      // tangkap agar tidak menjadi "unhandled rejection".
      if (hasil && typeof hasil.catch === 'function') hasil.catch(next)
    } catch (err) {
      next(err)
    }
  }

  /** Format nomor tampilan: kode layanan + urutan 3 digit, mis. A-016. */
  const formatNumber = (code, number) => `${code}-${String(number).padStart(3, '0')}`

  /** Mengubah baris antrean menjadi bentuk JSON yang dipakai klien. */
  function shapeQueue(row) {
    return {
      id: row.id,
      number: formatNumber(row.code, row.number),
      rawNumber: row.number,
      serviceId: row.service_id,
      serviceCode: row.code,
      serviceName: row.service_name,
      userId: row.user_id,
      patientName: row.patient_name,
      patientIdentity: row.identity,
      status: row.status,
      complaint: row.complaint,
      date: row.queue_date,
      time: row.created_at.slice(11, 16),
      calledAt: row.called_at ? row.called_at.slice(11, 16) : null,
      finishedAt: row.finished_at ? row.finished_at.slice(11, 16) : null,
    }
  }

  /** Query dasar antrean beserta nama layanan dan pasien. */
  const QUEUE_SELECT = `
    SELECT q.*, s.code, s.name AS service_name, u.name AS patient_name, u.identity
    FROM queues q
    JOIN services s ON s.id = q.service_id
    JOIN users u ON u.id = q.user_id
  `

  const getQueueById = id => {
    const row = db.prepare(`${QUEUE_SELECT} WHERE q.id = ?`).get(id)
    return row ? shapeQueue(row) : null
  }

  /** Status antrean yang dianggap masih aktif hari ini. */
  const ACTIVE = ['menunggu', 'dipanggil']

  // ── Kesehatan ─────────────────────────────────────────────────────────────

  app.get('/api/health', (req, res) => res.json({ ok: true }))

  // ── Autentikasi ───────────────────────────────────────────────────────────

  app.post(
    '/api/auth/register',
    wrap((req, res) => {
      const parsed = registerSchema.safeParse(req.body)
      if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0].message })
      const { name, identity, email, role, password, phone } = parsed.data

      if (db.prepare('SELECT id FROM users WHERE email = ?').get(email)) {
        return res.status(409).json({ error: 'Email sudah terdaftar.' })
      }
      if (db.prepare('SELECT id FROM users WHERE identity = ?').get(identity)) {
        return res.status(409).json({ error: 'NIM / NIP sudah terdaftar.' })
      }

      const { hash, salt } = hashPassword(password)
      const info = db
        .prepare(
          'INSERT INTO users (name, identity, email, role, phone, password_hash, password_salt) VALUES (?, ?, ?, ?, ?, ?, ?)',
        )
        .run(name, identity, email, role, phone, hash, salt)

      const user = db.prepare('SELECT * FROM users WHERE id = ?').get(info.lastInsertRowid)
      const token = createToken()
      db.prepare('INSERT INTO sessions (token, user_id) VALUES (?, ?)').run(token, user.id)
      res.status(201).json({ token, user: publicUser(user) })
    }),
  )

  app.post(
    '/api/auth/login',
    wrap((req, res) => {
      const parsed = loginSchema.safeParse(req.body)
      if (!parsed.success) return res.status(400).json({ error: 'Email dan kata sandi wajib diisi.' })
      const { email, password } = parsed.data

      const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email)
      // Pesan sengaja sama untuk email tidak ada maupun password salah,
      // agar tidak bisa dipakai menebak email mana yang terdaftar.
      if (!user || !verifyPassword(password, user.password_hash, user.password_salt)) {
        return res.status(401).json({ error: 'Email atau kata sandi salah.' })
      }

      const token = createToken()
      db.prepare('INSERT INTO sessions (token, user_id) VALUES (?, ?)').run(token, user.id)
      res.json({ token, user: publicUser(user) })
    }),
  )

  app.post(
    '/api/auth/logout',
    wrap((req, res) => {
      if (req.token) db.prepare('DELETE FROM sessions WHERE token = ?').run(req.token)
      res.json({ ok: true })
    }),
  )

  app.get('/api/auth/me', requireAuth, (req, res) => res.json({ user: publicUser(req.user) }))

  app.patch(
    '/api/auth/profile',
    requireAuth,
    wrap((req, res) => {
      const schema = z.object({
        name: z.string().trim().min(1).optional(),
        phone: z.string().trim().max(25).optional(),
      })
      const parsed = schema.safeParse(req.body)
      if (!parsed.success) return res.status(400).json({ error: 'Data profil tidak valid.' })

      if (parsed.data.name !== undefined) {
        db.prepare('UPDATE users SET name = ? WHERE id = ?').run(parsed.data.name, req.user.id)
      }
      if (parsed.data.phone !== undefined) {
        db.prepare('UPDATE users SET phone = ? WHERE id = ?').run(parsed.data.phone, req.user.id)
      }
      const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id)
      res.json({ user: publicUser(user) })
    }),
  )

  // ── Layanan ───────────────────────────────────────────────────────────────

  app.get(
    '/api/services',
    wrap((req, res) => {
      const rows = db
        .prepare('SELECT id, code, name, description, capacity FROM services WHERE active = 1 ORDER BY id')
        .all()

      // Sertakan jumlah antrean yang masih menunggu hari ini per layanan.
      const services = rows.map(s => {
        const waiting = db
          .prepare(
            "SELECT COUNT(*) AS n FROM queues WHERE service_id = ? AND queue_date = date('now') AND status = 'menunggu'",
          )
          .get(s.id).n
        return { ...s, waiting }
      })
      res.json({ services })
    }),
  )

  // ── Antrean ───────────────────────────────────────────────────────────────

  /** Mengambil nomor antrean baru. */
  app.post(
    '/api/queues',
    requireAuth,
    wrap((req, res) => {
      const parsed = takeSchema.safeParse(req.body)
      if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0].message })
      const { serviceId, complaint } = parsed.data

      const result = transaction(db, () => {
        const service = db.prepare('SELECT * FROM services WHERE id = ? AND active = 1').get(serviceId)
        if (!service) throw httpError('Layanan tidak ditemukan.', 404)

        // Satu orang hanya boleh punya satu antrean aktif per hari.
        const aktif = db
          .prepare(
            `SELECT q.id, s.code, q.number FROM queues q JOIN services s ON s.id = q.service_id
             WHERE q.user_id = ? AND q.queue_date = date('now') AND q.status IN ('menunggu', 'dipanggil')`,
          )
          .get(req.user.id)
        if (aktif) {
          throw httpError(
            `Anda masih punya antrean aktif (${formatNumber(aktif.code, aktif.number)}). Selesaikan atau batalkan dulu.`,
            409,
          )
        }

        // Nomor berikutnya untuk layanan ini hari ini.
        const last = db
          .prepare(
            "SELECT MAX(number) AS n FROM queues WHERE service_id = ? AND queue_date = date('now')",
          )
          .get(serviceId).n
        const number = (last ?? 0) + 1

        const info = db
          .prepare(
            "INSERT INTO queues (service_id, user_id, number, status, complaint) VALUES (?, ?, ?, 'menunggu', ?)",
          )
          .run(serviceId, req.user.id, number, complaint)

        return getQueueById(info.lastInsertRowid)
      })

      res.status(201).json({ queue: result })
    }),
  )

  /** Antrean milik sendiri; petugas bisa melihat semua. */
  app.get(
    '/api/queues',
    requireAuth,
    wrap((req, res) => {
      const tanggal = typeof req.query.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(req.query.date)
        ? req.query.date
        : null

      let rows
      if (req.user.role === 'petugas') {
        // Petugas melihat seluruh antrean (opsional difilter per tanggal).
        rows = tanggal
          ? db.prepare(`${QUEUE_SELECT} WHERE q.queue_date = ? ORDER BY s.id, q.number`).all(tanggal)
          : db.prepare(`${QUEUE_SELECT} WHERE q.queue_date = date('now') ORDER BY s.id, q.number`).all()
      } else {
        rows = db
          .prepare(`${QUEUE_SELECT} WHERE q.user_id = ? ORDER BY q.id DESC`)
          .all(req.user.id)
      }
      res.json({ queues: rows.map(shapeQueue) })
    }),
  )

  /** Antrean aktif milik sendiri (untuk kartu di Beranda). */
  app.get(
    '/api/queues/active',
    requireAuth,
    wrap((req, res) => {
      const row = db
        .prepare(
          `${QUEUE_SELECT} WHERE q.user_id = ? AND q.queue_date = date('now') AND q.status IN ('menunggu', 'dipanggil') ORDER BY q.id DESC LIMIT 1`,
        )
        .get(req.user.id)

      if (!row) return res.json({ queue: null, waitingAhead: 0, serving: null, estimate: null })

      // Berapa orang di depan: nomor lebih kecil yang masih menunggu/dipanggil.
      const waitingAhead = db
        .prepare(
          `SELECT COUNT(*) AS n FROM queues
           WHERE service_id = ? AND queue_date = date('now')
             AND status IN ('menunggu', 'dipanggil') AND number < ?`,
        )
        .get(row.service_id, row.number).n

      const servingRow = db
        .prepare(
          `SELECT q.number, s.code FROM queues q JOIN services s ON s.id = q.service_id
           WHERE q.service_id = ? AND q.queue_date = date('now') AND q.status = 'dipanggil'
           ORDER BY q.number LIMIT 1`,
        )
        .get(row.service_id)

      // Estimasi sederhana: 10 menit per orang di depan.
      const estimate = new Date(Date.now() + waitingAhead * 10 * 60 * 1000)
      const estimateText = `${String(estimate.getHours()).padStart(2, '0')}.${String(estimate.getMinutes()).padStart(2, '0')} WIB`

      res.json({
        queue: shapeQueue(row),
        waitingAhead,
        serving: servingRow ? formatNumber(servingRow.code, servingRow.number) : null,
        estimate: estimateText,
      })
    }),
  )

  /** Papan antrean untuk petugas: semua antrean hari ini per layanan. */
  app.get(
    '/api/queues/board',
    requireStaff,
    wrap((req, res) => {
      const rows = db
        .prepare(`${QUEUE_SELECT} WHERE q.queue_date = date('now') ORDER BY s.id, q.number`)
        .all()
      const services = db
        .prepare('SELECT id, code, name, description, capacity FROM services WHERE active = 1 ORDER BY id')
        .all()
      res.json({ services, queues: rows.map(shapeQueue) })
    }),
  )

  /** Mengubah status antrean (hanya petugas). */
  app.patch(
    '/api/queues/:id/status',
    requireStaff,
    wrap((req, res) => {
      const parsed = statusSchema.safeParse(req.body)
      if (!parsed.success) return res.status(400).json({ error: 'Status tidak valid.' })
      const id = Number(req.params.id)

      const result = transaction(db, () => {
        const row = db.prepare('SELECT * FROM queues WHERE id = ?').get(id)
        if (!row) throw httpError('Antrean tidak ditemukan.', 404)

        const baru = parsed.data.status
        // Aturan perpindahan status: tidak boleh mundur ke 'menunggu'.
        if (baru === 'menunggu' && row.status !== 'menunggu') {
          throw httpError('Antrean tidak bisa dikembalikan ke menunggu.', 409)
        }
        if (row.status === 'selesai' || row.status === 'dibatalkan') {
          throw httpError('Antrean yang sudah selesai atau dibatalkan tidak bisa diubah.', 409)
        }

        const calledAt = baru === 'dipanggil' ? "datetime('now')" : 'called_at'
        const finishedAt = baru === 'selesai' || baru === 'dibatalkan' ? "datetime('now')" : 'finished_at'

        db.prepare(
          `UPDATE queues SET status = ?, called_at = ${calledAt}, finished_at = ${finishedAt} WHERE id = ?`,
        ).run(baru, id)

        return getQueueById(id)
      })

      res.json({ queue: result })
    }),
  )

  /** Membatalkan antrean sendiri. */
  app.post(
    '/api/queues/:id/cancel',
    requireAuth,
    wrap((req, res) => {
      const id = Number(req.params.id)
      const row = db.prepare('SELECT * FROM queues WHERE id = ?').get(id)
      if (!row) return res.status(404).json({ error: 'Antrean tidak ditemukan.' })

      // Hanya pemiliknya (atau petugas) yang boleh membatalkan.
      if (row.user_id !== req.user.id && req.user.role !== 'petugas') {
        return res.status(403).json({ error: 'Ini bukan antrean Anda.' })
      }
      if (row.status === 'selesai' || row.status === 'dibatalkan') {
        return res.status(409).json({ error: 'Antrean ini sudah tidak aktif.' })
      }

      db.prepare("UPDATE queues SET status = 'dibatalkan', finished_at = datetime('now') WHERE id = ?").run(id)
      res.json({ queue: getQueueById(id) })
    }),
  )

  // ── Asisten kesehatan ─────────────────────────────────────────────────────

  /** Batas panjang pesan dan jumlah percakapan yang dikirim ke LLM. */
  const chatSchema = z.object({
    message: z.string().trim().min(1, 'Pesan tidak boleh kosong.').max(1000, 'Pesan terlalu panjang (maks 1000 karakter).'),
  })

  /** Riwayat yang dikirim sebagai konteks ke LLM (maks 8 pesan terakhir). */
  function riwayatUntukLLM(userId) {
    return db
      .prepare('SELECT role, content FROM chat_messages WHERE user_id = ? ORDER BY id DESC LIMIT 8')
      .all(userId)
      .reverse()
      .map(r => ({ role: r.role, content: r.content }))
  }

  /**
   * Pembatasan laju sederhana: maksimum 20 pesan per menit per pengguna.
   * Mencegah satu akun membanjiri server atau menghabiskan kuota LLM.
   */
  const jendelaLaju = new Map()
  function batasiLaju(userId) {
    const sekarang = Date.now()
    const catatan = (jendelaLaju.get(userId) ?? []).filter(t => sekarang - t < 60_000)
    if (catatan.length >= 20) return false
    catatan.push(sekarang)
    jendelaLaju.set(userId, catatan)
    return true
  }

  /** Informasi mode asisten (lokal atau LLM) untuk ditampilkan di klien. */
  app.get('/api/assistant/info', (req, res) => {
    res.json({ mode: assistant.mode })
  })

  /** Mengambil riwayat percakapan pengguna. */
  app.get(
    '/api/assistant/messages',
    requireAuth,
    wrap((req, res) => {
      const rows = db
        .prepare('SELECT id, role, content, created_at FROM chat_messages WHERE user_id = ? ORDER BY id ASC')
        .all(req.user.id)
      res.json({
        mode: assistant.mode,
        messages: rows.map(r => ({
          id: r.id,
          role: r.role,
          content: r.content,
          time: r.created_at.slice(11, 16),
        })),
      })
    }),
  )

  /** Mengirim pesan ke asisten dan menyimpan percakapannya. */
  app.post(
    '/api/assistant/chat',
    requireAuth,
    wrap(async (req, res) => {
      const parsed = chatSchema.safeParse(req.body)
      if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0].message })

      if (!batasiLaju(req.user.id)) {
        return res.status(429).json({ error: 'Terlalu banyak pesan. Tunggu sebentar lalu coba lagi.' })
      }

      const pertanyaan = parsed.data.message
      const riwayat = riwayatUntukLLM(req.user.id)

      // Simpan pesan pengguna lebih dulu agar tidak hilang bila LLM gagal.
      db.prepare("INSERT INTO chat_messages (user_id, role, content) VALUES (?, 'user', ?)").run(
        req.user.id,
        pertanyaan,
      )

      const hasil = await assistant.tanya(pertanyaan, { nama: req.user.name, riwayat })

      const info = db
        .prepare("INSERT INTO chat_messages (user_id, role, content) VALUES (?, 'assistant', ?)")
        .run(req.user.id, hasil.reply)

      res.json({
        reply: hasil.reply,
        topik: hasil.topik,
        darurat: hasil.darurat,
        mode: hasil.mode,
        id: Number(info.lastInsertRowid),
      })
    }),
  )

  /** Menghapus seluruh riwayat percakapan pengguna. */
  app.delete(
    '/api/assistant/messages',
    requireAuth,
    wrap((req, res) => {
      db.prepare('DELETE FROM chat_messages WHERE user_id = ?').run(req.user.id)
      res.json({ ok: true })
    }),
  )

  // ── Penanganan galat ──────────────────────────────────────────────────────

  app.use((req, res) => res.status(404).json({ error: 'Endpoint tidak ditemukan.' }))

  // eslint-disable-next-line no-unused-vars
  app.use((err, req, res, next) => {
    const status = err.status ?? 500
    if (status >= 500) console.error(err)
    res.status(status).json({ error: err.message || 'Terjadi kesalahan pada server.' })
  })

  return app
}
