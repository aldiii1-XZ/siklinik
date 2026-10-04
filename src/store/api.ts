/**
 * Klien API SIKLINIK.
 *
 * Semua data berasal dari server: akun, layanan, dan antrean. Token sesi
 * disimpan di localStorage agar pengguna tidak perlu masuk ulang setiap kali
 * halaman dimuat. Di produksi, pertimbangkan cookie httpOnly.
 */

const BASE = import.meta.env.VITE_API_URL ?? '/api'
const TOKEN_KEY = 'siklinik:token'

export function getToken(): string | null {
  try {
    return localStorage.getItem(TOKEN_KEY)
  } catch {
    return null
  }
}

export function setToken(token: string | null) {
  try {
    if (token) localStorage.setItem(TOKEN_KEY, token)
    else localStorage.removeItem(TOKEN_KEY)
  } catch {
    // mode privat: sesi hanya bertahan selama halaman terbuka
  }
}

/** Galat API yang membawa kode status agar pemanggil bisa membedakan kasus. */
export class ApiError extends Error {
  status: number
  constructor(message: string, status: number) {
    super(message)
    this.name = 'ApiError'
    this.status = status
  }
}

async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  const token = getToken()
  let res: Response
  try {
    res = await fetch(`${BASE}${path}`, {
      method,
      headers: {
        'content-type': 'application/json',
        ...(token ? { authorization: `Bearer ${token}` } : {}),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    })
  } catch {
    throw new ApiError('Tidak bisa terhubung ke server. Pastikan server API berjalan.', 0)
  }

  const text = await res.text()
  const data = text ? JSON.parse(text) : null

  if (!res.ok) {
    // Token kedaluwarsa/dicabut: bersihkan agar tidak dipakai lagi.
    if (res.status === 401) setToken(null)
    throw new ApiError(data?.error ?? 'Terjadi kesalahan.', res.status)
  }
  return data as T
}

// ── Tipe ────────────────────────────────────────────────────────────────────

export type Role = 'mahasiswa' | 'staf' | 'petugas'
export type QueueStatus = 'menunggu' | 'dipanggil' | 'selesai' | 'dibatalkan'

export interface ApiUser {
  id: number
  name: string
  identity: string
  email: string
  role: Role
  phone: string
}

export interface ApiService {
  id: number
  code: string
  name: string
  description: string
  capacity: number
  waiting: number
}

export interface ApiQueue {
  id: number
  number: string
  rawNumber: number
  serviceId: number
  serviceCode: string
  serviceName: string
  userId: number
  patientName: string
  patientIdentity: string
  status: QueueStatus
  complaint: string
  date: string
  time: string
  calledAt: string | null
  finishedAt: string | null
}

export interface ActiveQueueInfo {
  queue: ApiQueue | null
  waitingAhead: number
  serving: string | null
  estimate: string | null
}

// ── Endpoint ────────────────────────────────────────────────────────────────

export const api = {
  register: (data: {
    name: string
    identity: string
    email: string
    role: 'mahasiswa' | 'staf'
    password: string
    phone?: string
  }) => request<{ token: string; user: ApiUser }>('POST', '/auth/register', data),

  login: (email: string, password: string) =>
    request<{ token: string; user: ApiUser }>('POST', '/auth/login', { email, password }),

  logout: () => request<{ ok: boolean }>('POST', '/auth/logout'),

  me: () => request<{ user: ApiUser }>('GET', '/auth/me'),

  updateProfile: (data: { name?: string; phone?: string }) =>
    request<{ user: ApiUser }>('PATCH', '/auth/profile', data),

  listServices: () => request<{ services: ApiService[] }>('GET', '/services'),

  takeQueue: (serviceId: number, complaint = '') =>
    request<{ queue: ApiQueue }>('POST', '/queues', { serviceId, complaint }),

  myQueues: () => request<{ queues: ApiQueue[] }>('GET', '/queues'),

  activeQueue: () => request<ActiveQueueInfo>('GET', '/queues/active'),

  board: () => request<{ services: ApiService[]; queues: ApiQueue[] }>('GET', '/queues/board'),

  setStatus: (id: number, status: QueueStatus) =>
    request<{ queue: ApiQueue }>('PATCH', `/queues/${id}/status`, { status }),

  cancelQueue: (id: number) =>
    request<{ queue: ApiQueue }>('POST', `/queues/${id}/cancel`),
}
