/**
 * Store SIKLINIK.
 *
 * Sumber kebenaran data ada di server: akun, layanan, dan antrean semuanya
 * diambil lewat API. Yang disimpan di sisi klien hanya token sesi.
 */
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import {
  ApiError,
  api,
  getToken,
  setToken,
  type ActiveQueueInfo,
  type ApiQueue,
  type ApiService,
  type ApiUser,
  type QueueStatus,
} from './api'

export type { ApiQueue as Queue, ApiService as Service, ApiUser as User, QueueStatus } from './api'
export * from './display'

export interface ActionResult {
  ok: boolean
  error?: string
  queue?: ApiQueue
}

interface StoreValue {
  user: ApiUser | null
  services: ApiService[]
  myQueues: ApiQueue[]
  active: ActiveQueueInfo
  // Papan petugas
  boardServices: ApiService[]
  boardQueues: ApiQueue[]
  loading: boolean
  error: string | null
  // Aksi
  login: (email: string, password: string) => Promise<ActionResult>
  register: (data: {
    name: string
    identity: string
    email: string
    role: 'mahasiswa' | 'staf'
    password: string
    phone?: string
  }) => Promise<ActionResult>
  logout: () => Promise<void>
  updateProfile: (data: { name?: string; phone?: string }) => Promise<ActionResult>
  takeQueue: (serviceId: number, complaint?: string) => Promise<ActionResult>
  cancelQueue: (id: number) => Promise<ActionResult>
  setStatus: (id: number, status: QueueStatus) => Promise<ActionResult>
  refresh: () => Promise<void>
  refreshBoard: () => Promise<void>
}

const StoreContext = createContext<StoreValue | null>(null)

const EMPTY_ACTIVE: ActiveQueueInfo = { queue: null, waitingAhead: 0, serving: null, estimate: null }

export function StoreProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<ApiUser | null>(null)
  const [services, setServices] = useState<ApiService[]>([])
  const [myQueues, setMyQueues] = useState<ApiQueue[]>([])
  const [active, setActive] = useState<ActiveQueueInfo>(EMPTY_ACTIVE)
  const [boardServices, setBoardServices] = useState<ApiService[]>([])
  const [boardQueues, setBoardQueues] = useState<ApiQueue[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const toMessage = (err: unknown): string =>
    err instanceof ApiError ? err.message : 'Terjadi kesalahan tak terduga.'

  /** Mengambil layanan (selalu) dan antrean milik sendiri (bila sudah masuk). */
  const refresh = useCallback(async () => {
    const { services: s } = await api.listServices()
    setServices(s)

    if (!getToken()) {
      setMyQueues([])
      setActive(EMPTY_ACTIVE)
      return
    }
    const [{ queues }, activeInfo] = await Promise.all([api.myQueues(), api.activeQueue()])
    setMyQueues(queues)
    setActive(activeInfo)
  }, [])

  /** Mengambil papan antrean (khusus petugas). */
  const refreshBoard = useCallback(async () => {
    if (!getToken()) return
    const { services: s, queues } = await api.board()
    setBoardServices(s)
    setBoardQueues(queues)
  }, [])

  // Muat data saat aplikasi dibuka; pulihkan sesi bila token masih ada.
  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const { services: s } = await api.listServices()
        if (cancelled) return
        setServices(s)

        if (getToken()) {
          try {
            const { user: u } = await api.me()
            if (cancelled) return
            setUser(u)
            const [{ queues }, activeInfo] = await Promise.all([api.myQueues(), api.activeQueue()])
            if (cancelled) return
            setMyQueues(queues)
            setActive(activeInfo)
          } catch {
            setToken(null)
          }
        }
      } catch (err) {
        if (!cancelled) setError(toMessage(err))
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  const login = useCallback(async (email: string, password: string): Promise<ActionResult> => {
    try {
      const { token, user: u } = await api.login(email, password)
      setToken(token)
      setUser(u)
      const [{ queues }, activeInfo] = await Promise.all([api.myQueues(), api.activeQueue()])
      setMyQueues(queues)
      setActive(activeInfo)
      return { ok: true }
    } catch (err) {
      return { ok: false, error: toMessage(err) }
    }
  }, [])

  const register = useCallback(
    async (data: {
      name: string
      identity: string
      email: string
      role: 'mahasiswa' | 'staf'
      password: string
      phone?: string
    }): Promise<ActionResult> => {
      try {
        const { token, user: u } = await api.register(data)
        setToken(token)
        setUser(u)
        setMyQueues([])
        setActive(EMPTY_ACTIVE)
        return { ok: true }
      } catch (err) {
        return { ok: false, error: toMessage(err) }
      }
    },
    [],
  )

  const logout = useCallback(async () => {
    try {
      await api.logout()
    } catch {
      // Abaikan: sesi lokal tetap dibersihkan.
    }
    setToken(null)
    setUser(null)
    setMyQueues([])
    setActive(EMPTY_ACTIVE)
    setBoardQueues([])
    setBoardServices([])
  }, [])

  const updateProfile = useCallback(
    async (data: { name?: string; phone?: string }): Promise<ActionResult> => {
      try {
        const { user: u } = await api.updateProfile(data)
        setUser(u)
        return { ok: true }
      } catch (err) {
        return { ok: false, error: toMessage(err) }
      }
    },
    [],
  )

  const takeQueue = useCallback(
    async (serviceId: number, complaint = ''): Promise<ActionResult> => {
      try {
        const { queue } = await api.takeQueue(serviceId, complaint)
        await refresh()
        return { ok: true, queue }
      } catch (err) {
        return { ok: false, error: toMessage(err) }
      }
    },
    [refresh],
  )

  const cancelQueue = useCallback(
    async (id: number): Promise<ActionResult> => {
      try {
        await api.cancelQueue(id)
        await refresh()
        return { ok: true }
      } catch (err) {
        return { ok: false, error: toMessage(err) }
      }
    },
    [refresh],
  )

  const setStatus = useCallback(
    async (id: number, status: QueueStatus): Promise<ActionResult> => {
      try {
        await api.setStatus(id, status)
        await refreshBoard()
        return { ok: true }
      } catch (err) {
        return { ok: false, error: toMessage(err) }
      }
    },
    [refreshBoard],
  )

  const value = useMemo<StoreValue>(
    () => ({
      user, services, myQueues, active,
      boardServices, boardQueues,
      loading, error,
      login, register, logout, updateProfile,
      takeQueue, cancelQueue, setStatus,
      refresh, refreshBoard,
    }),
    [
      user, services, myQueues, active,
      boardServices, boardQueues,
      loading, error,
      login, register, logout, updateProfile,
      takeQueue, cancelQueue, setStatus,
      refresh, refreshBoard,
    ],
  )

  if (loading) {
    return (
      <div className="min-h-screen grid place-items-center" style={{ background: 'var(--background)' }}>
        <div className="text-center">
          <div className="w-12 h-12 rounded-xl mx-auto mb-4 grid place-items-center text-2xl animate-pulse-soft"
            style={{ background: 'var(--primary)', color: '#fff' }}>✚</div>
          <p className="text-sm" style={{ color: 'var(--muted-foreground)' }}>Memuat SIKLINIK…</p>
        </div>
      </div>
    )
  }

  // Server tidak bisa dihubungi: beri tahu dengan jelas.
  if (error && services.length === 0) {
    return (
      <div className="min-h-screen grid place-items-center p-6" style={{ background: 'var(--background)' }}>
        <div className="max-w-md text-center">
          <div className="text-5xl mb-4">🔌</div>
          <h1 className="font-display text-xl font-bold mb-2" style={{ color: 'var(--primary)' }}>
            Server tidak terjangkau
          </h1>
          <p className="text-sm leading-relaxed" style={{ color: 'var(--muted-foreground)' }}>{error}</p>
          <p className="text-xs mt-4" style={{ color: 'var(--muted-foreground)' }}>
            Jalankan{' '}
            <code className="px-1.5 py-0.5 rounded" style={{ background: 'var(--card)' }}>npm run dev</code>{' '}
            di folder{' '}
            <code className="px-1.5 py-0.5 rounded" style={{ background: 'var(--card)' }}>server/</code>, lalu muat ulang.
          </p>
        </div>
      </div>
    )
  }

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>
}

/** Mengakses store. Melempar bila dipakai di luar StoreProvider. */
export function useStore(): StoreValue {
  const ctx = useContext(StoreContext)
  if (!ctx) throw new Error('useStore harus dipakai di dalam <StoreProvider>')
  return ctx
}
