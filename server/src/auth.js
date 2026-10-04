/**
 * Autentikasi SIKLINIK.
 *
 * Password di-hash dengan scrypt (bukan SHA-256 polos) karena scrypt sengaja
 * lambat dan memakan memori, sehingga mahal untuk dipecahkan secara brutal.
 * Setiap akun punya salt sendiri.
 */
import { randomBytes, scryptSync, timingSafeEqual, randomUUID } from 'node:crypto'

const KEY_LENGTH = 64

export function hashPassword(password, salt = randomBytes(16).toString('hex')) {
  return { hash: scryptSync(password, salt, KEY_LENGTH).toString('hex'), salt }
}

export function verifyPassword(password, storedHash, salt) {
  const candidate = scryptSync(password, salt, KEY_LENGTH)
  const stored = Buffer.from(storedHash, 'hex')
  if (candidate.length !== stored.length) return false
  return timingSafeEqual(candidate, stored)
}

export function createToken() {
  return randomUUID().replace(/-/g, '') + randomBytes(16).toString('hex')
}

/** Menempelkan `req.user` bila token valid. */
export function authenticate(db) {
  return (req, res, next) => {
    const header = req.get('authorization') || ''
    const token = header.startsWith('Bearer ') ? header.slice(7).trim() : null
    if (!token) {
      req.user = null
      return next()
    }
    const row = db
      .prepare(
        `SELECT u.id, u.name, u.identity, u.email, u.role, u.phone
         FROM sessions s JOIN users u ON u.id = s.user_id
         WHERE s.token = ?`,
      )
      .get(token)
    req.user = row ?? null
    req.token = token
    next()
  }
}

export function requireAuth(req, res, next) {
  if (!req.user) return res.status(401).json({ error: 'Silakan masuk terlebih dahulu.' })
  next()
}

/** Hanya petugas klinik (yang memanggil nomor & mengubah status). */
export function requireStaff(req, res, next) {
  if (!req.user) return res.status(401).json({ error: 'Silakan masuk terlebih dahulu.' })
  if (req.user.role !== 'petugas') {
    return res.status(403).json({ error: 'Hanya petugas klinik yang boleh mengakses.' })
  }
  next()
}

/** Bentuk user yang aman dikirim ke klien. */
export function publicUser(row) {
  return {
    id: row.id,
    name: row.name,
    identity: row.identity,
    email: row.email,
    role: row.role,
    phone: row.phone,
  }
}
