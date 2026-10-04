/**
 * Titik masuk server SIKLINIK.
 *
 * Jalankan: npm start (dari folder server/)
 * Port diatur lewat env PORT, default 3000.
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { createApp } from './app.js'
import { openDatabase, seedDatabase } from './db.js'
import { hashPassword } from './auth.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

const PORT = Number(process.env.PORT ?? 3000)
const DB_PATH = process.env.DB_PATH ?? path.join(__dirname, '..', 'data', 'siklinik.db')

// SQLite tidak membuat folder induk sendiri, jadi pastikan ada lebih dulu.
fs.mkdirSync(path.dirname(DB_PATH), { recursive: true })

const db = openDatabase(DB_PATH)
const seeded = seedDatabase(db, { hashPassword })

const app = createApp(db)

const server = app.listen(PORT, () => {
  console.log(`SIKLINIK API berjalan di http://localhost:${PORT}`)
  console.log(`Basis data: ${DB_PATH}`)
  if (seeded) console.log('Data contoh dibuat (2 akun + 3 layanan).')
})

server.on('error', err => {
  if (err.code === 'EADDRINUSE') {
    console.error(`Port ${PORT} sudah dipakai. Jalankan dengan port lain, misalnya:`)
    console.error(`  PORT=3001 npm start`)
    process.exit(1)
  }
  throw err
})
