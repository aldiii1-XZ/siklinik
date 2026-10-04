/**
 * Basis data SIKLINIK — SQLite lewat `node:sqlite` (bawaan Node 22.5+).
 *
 * Dipilih SQLite agar proyek dapat dijalankan di mana saja tanpa memasang
 * server basis data. Untuk produksi, ganti ke PostgreSQL.
 *
 * Alur antrean:
 *   menunggu -> dipanggil -> selesai
 *                       \-> dibatalkan
 */
import { DatabaseSync } from 'node:sqlite'

export function openDatabase(path = ':memory:') {
  const db = new DatabaseSync(path)
  db.exec('PRAGMA foreign_keys = ON')

  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
      name          TEXT    NOT NULL,
      identity      TEXT    NOT NULL UNIQUE,   -- NIM / NIP
      email         TEXT    NOT NULL UNIQUE,
      role          TEXT    NOT NULL CHECK (role IN ('mahasiswa', 'staf', 'petugas')),
      phone         TEXT    NOT NULL DEFAULT '',
      password_hash TEXT    NOT NULL,
      password_salt TEXT    NOT NULL,
      created_at    TEXT    NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS services (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      code        TEXT    NOT NULL UNIQUE,     -- huruf awal nomor antrean: A, G, K
      name        TEXT    NOT NULL,
      description TEXT    NOT NULL DEFAULT '',
      capacity    INTEGER NOT NULL DEFAULT 0 CHECK (capacity >= 0),
      active      INTEGER NOT NULL DEFAULT 1 CHECK (active IN (0, 1))
    );

    CREATE TABLE IF NOT EXISTS queues (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      service_id  INTEGER NOT NULL REFERENCES services(id),
      user_id     INTEGER NOT NULL REFERENCES users(id),
      number      INTEGER NOT NULL,            -- urutan harian per layanan
      status      TEXT    NOT NULL DEFAULT 'menunggu'
                    CHECK (status IN ('menunggu', 'dipanggil', 'selesai', 'dibatalkan')),
      complaint   TEXT    NOT NULL DEFAULT '', -- keluhan singkat
      queue_date  TEXT    NOT NULL DEFAULT (date('now')),
      created_at  TEXT    NOT NULL DEFAULT (datetime('now')),
      called_at   TEXT,
      finished_at TEXT
    );

    CREATE TABLE IF NOT EXISTS sessions (
      token      TEXT PRIMARY KEY,
      user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_queues_date ON queues(queue_date);
    CREATE INDEX IF NOT EXISTS idx_queues_user ON queues(user_id);
    CREATE INDEX IF NOT EXISTS idx_queues_service ON queues(service_id, queue_date);
  `)

  return db
}

/** Mengisi data contoh bila basis data masih kosong. */
export function seedDatabase(db, { hashPassword }) {
  const count = db.prepare('SELECT COUNT(*) AS n FROM users').get().n
  if (count > 0) return false

  const insertUser = db.prepare(
    'INSERT INTO users (name, identity, email, role, phone, password_hash, password_salt) VALUES (?, ?, ?, ?, ?, ?, ?)',
  )
  for (const u of [
    { name: 'Aldi Ramadhan', identity: '231040012', email: 'mahasiswa@kampus.ac.id', role: 'mahasiswa', phone: '0812 3456 7890', password: '12345678' },
    { name: 'Rina Kartika', identity: '198701012010', email: 'petugas@klinik.ac.id', role: 'petugas', phone: '0813 2222 3333', password: 'petugas123' },
  ]) {
    const { hash, salt } = hashPassword(u.password)
    insertUser.run(u.name, u.identity, u.email, u.role, u.phone, hash, salt)
  }

  const insertService = db.prepare(
    'INSERT INTO services (code, name, description, capacity) VALUES (?, ?, ?, ?)',
  )
  for (const s of [
    ['A', 'Poli Umum', 'Keluhan umum & pemeriksaan', 8],
    ['G', 'Poli Gigi', 'Kesehatan gigi & mulut', 6],
    ['K', 'Konseling', 'Konsultasi kesehatan mental', 4],
  ]) {
    insertService.run(...s)
  }

  return true
}
