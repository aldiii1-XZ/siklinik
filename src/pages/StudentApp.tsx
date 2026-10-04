/**
 * Dashboard mahasiswa SIKLINIK — mengikuti desain Figma:
 * sidebar kiri (Beranda/Layanan/Riwayat/Profil), kartu antrean teal besar,
 * dan kartu layanan.
 */
import { useEffect, useState } from 'react'
import { Avatar, Card, EmptyState, Notice, StatusBadge } from '../components/ui'
import { Logo } from '../components/ui'
import { useStore, formatDate, formatDateFull, greeting, sortByNewest } from '../store/store'
import type { Service } from '../store/store'

type Tab = 'beranda' | 'layanan' | 'riwayat' | 'profil'

const MENU: { id: Tab; label: string; icon: string }[] = [
  { id: 'beranda', label: 'Beranda', icon: '🏠' },
  { id: 'layanan', label: 'Layanan', icon: '🩺' },
  { id: 'riwayat', label: 'Riwayat', icon: '📋' },
  { id: 'profil', label: 'Profil', icon: '👤' },
]

export default function StudentApp() {
  const { user, services, myQueues, active, logout, takeQueue, cancelQueue, refresh } = useStore()
  const [tab, setTab] = useState<Tab>('beranda')
  const [pesan, setPesan] = useState('')
  const [galat, setGalat] = useState('')
  const [pilihLayanan, setPilihLayanan] = useState<Service | null>(null)
  const [keluhan, setKeluhan] = useState('')
  const [sedangProses, setSedangProses] = useState(false)

  useEffect(() => {
    refresh()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  if (!user) return null

  const riwayat = sortByNewest(myQueues)

  /** Membuka dialog pengambilan antrean untuk satu layanan. */
  function bukaDialog(s: Service) {
    setPilihLayanan(s)
    setKeluhan('')
    setGalat('')
    setPesan('')
  }

  async function konfirmasiAmbil() {
    if (!pilihLayanan) return
    setSedangProses(true)
    const hasil = await takeQueue(pilihLayanan.id, keluhan)
    setSedangProses(false)
    if (!hasil.ok) {
      setGalat(hasil.error ?? 'Gagal mengambil antrean.')
      return
    }
    setPesan(`Nomor antrean kamu: ${hasil.queue?.number}. Pantau giliran di Beranda.`)
    setPilihLayanan(null)
    setTab('beranda')
  }

  async function batalkan(id: number) {
    setSedangProses(true)
    const hasil = await cancelQueue(id)
    setSedangProses(false)
    if (!hasil.ok) setGalat(hasil.error ?? 'Gagal membatalkan.')
    else setPesan('Antrean dibatalkan.')
  }

  return (
    <div className="min-h-screen flex" style={{ background: 'var(--background)' }}>
      {/* Sidebar */}
      <aside
        className="hidden md:flex flex-col w-64 shrink-0 p-6"
        style={{ background: 'var(--card)', borderRight: '1px solid var(--border)' }}
      >
        <div className="mb-8">
          <Logo />
        </div>

        <nav className="flex-1 space-y-1">
          {MENU.map(m => (
            <button
              key={m.id}
              onClick={() => { setTab(m.id); setPesan(''); setGalat('') }}
              className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium text-left transition-all"
              style={
                tab === m.id
                  ? { background: 'var(--primary-soft)', color: 'var(--primary-dark)' }
                  : { color: 'var(--muted-foreground)' }
              }
            >
              <span aria-hidden="true">{m.icon}</span>
              {m.label}
            </button>
          ))}
        </nav>

        <div className="rounded-2xl p-4 mb-4" style={{ background: 'var(--navy)' }}>
          <p className="text-sm font-semibold text-white mb-1">Butuh bantuan?</p>
          <p className="text-xs mb-2" style={{ color: 'rgba(255,255,255,0.6)' }}>
            Hubungi petugas klinik kampus.
          </p>
          <span className="text-xs font-medium" style={{ color: '#7dd3c8' }}>Lihat kontak →</span>
        </div>

        <div className="flex items-center gap-3 pt-4" style={{ borderTop: '1px solid var(--border)' }}>
          <Avatar name={user.name} />
          <div className="min-w-0 flex-1">
            <div className="text-sm font-semibold truncate">{user.name}</div>
            <div className="text-xs capitalize" style={{ color: 'var(--muted-foreground)' }}>{user.role}</div>
          </div>
        </div>
      </aside>

      {/* Konten */}
      <div className="flex-1 min-w-0">
        {/* Header */}
        <header
          className="sticky top-0 z-30 px-6 h-16 flex items-center justify-between"
          style={{ background: 'var(--background)', borderBottom: '1px solid var(--border)' }}
        >
          <div className="md:hidden">
            <Logo size="sm" />
          </div>
          <p className="hidden md:block text-sm" style={{ color: 'var(--muted-foreground)' }}>
            {formatDateFull()}
          </p>
          <div className="flex items-center gap-3">
            <button
              onClick={logout}
              className="px-4 py-2 rounded-lg text-sm font-medium transition-all hover:opacity-70"
              style={{ color: 'var(--muted-foreground)' }}
            >
              Keluar
            </button>
          </div>
        </header>

        <main className="p-6 max-w-5xl">
          {pesan && <div className="mb-5"><Notice kind="success">{pesan}</Notice></div>}
          {galat && <div className="mb-5"><Notice>{galat}</Notice></div>}

          {/* ── Beranda ─────────────────────────────────────────────────── */}
          {tab === 'beranda' && (
            <div className="space-y-6">
              <div>
                <h1 className="font-display text-3xl font-bold mb-1">
                  Selamat datang, {greeting(user.name)}
                </h1>
                <p className="text-sm md:hidden mb-1" style={{ color: 'var(--muted-foreground)' }}>
                  {formatDateFull()}
                </p>
              </div>

              {active.queue ? (
                <div className="rounded-3xl p-7 text-white" style={{ background: 'var(--primary)' }}>
                  <div className="flex items-start justify-between mb-6">
                    <div className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-white animate-pulse-soft" aria-hidden="true" />
                      <span className="text-sm font-medium">Antrean aktif</span>
                    </div>
                    <span
                      className="px-3 py-1 rounded-full text-xs font-semibold"
                      style={{ background: 'rgba(255,255,255,0.2)', color: '#fff' }}
                    >
                      {active.queue.status === 'dipanggil' ? 'Sedang dipanggil' : 'Menunggu'}
                    </span>
                  </div>

                  <p className="text-xs font-medium mb-1" style={{ color: 'rgba(255,255,255,0.7)' }}>
                    {active.queue.serviceName} · Hari ini
                  </p>
                  <p className="text-xs tracking-wide mb-2" style={{ color: 'rgba(255,255,255,0.7)' }}>
                    NOMOR ANDA
                  </p>
                  <div className="font-display text-6xl font-bold mb-6">{active.queue.number}</div>

                  <div className="grid grid-cols-2 gap-4 mb-5">
                    <div>
                      <p className="text-xs mb-1" style={{ color: 'rgba(255,255,255,0.7)' }}>Sedang dilayani</p>
                      <p className="font-display text-xl font-bold">{active.serving ?? '—'}</p>
                    </div>
                    <div>
                      <p className="text-xs mb-1" style={{ color: 'rgba(255,255,255,0.7)' }}>Sisa antrean</p>
                      <p className="font-display text-xl font-bold">
                        {active.waitingAhead === 0 ? 'Giliran Anda' : `${active.waitingAhead} orang`}
                      </p>
                    </div>
                  </div>

                  {active.estimate && (
                    <p className="text-sm" style={{ color: 'rgba(255,255,255,0.85)' }}>
                      Estimasi dipanggil {active.estimate}
                    </p>
                  )}

                  <button
                    onClick={() => batalkan(active.queue!.id)}
                    disabled={sedangProses}
                    className="mt-5 px-4 py-2 rounded-xl text-xs font-semibold transition-all hover:opacity-90 disabled:opacity-60"
                    style={{ background: 'rgba(255,255,255,0.15)', color: '#fff' }}
                  >
                    Batalkan antrean
                  </button>
                </div>
              ) : (
                <Card className="p-7">
                  <div className="flex items-center gap-3 mb-3">
                    <span className="text-3xl" aria-hidden="true">🎫</span>
                    <div>
                      <h2 className="font-display text-lg font-bold">Belum ada antrean aktif</h2>
                      <p className="text-sm" style={{ color: 'var(--muted-foreground)' }}>
                        Ambil nomor antrean agar tidak perlu menunggu lama.
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => setTab('layanan')}
                    className="mt-2 px-5 py-3 rounded-xl text-sm font-semibold transition-all hover:opacity-90"
                    style={{ background: 'var(--primary)', color: 'var(--primary-foreground)' }}
                  >
                    Ambil nomor antrean
                  </button>
                </Card>
              )}

              {/* Layanan ringkas */}
              <div>
                <div className="flex items-center justify-between mb-4">
                  <h2 className="font-display text-xl font-bold">Layanan klinik</h2>
                  <button
                    onClick={() => setTab('layanan')}
                    className="text-sm font-medium"
                    style={{ color: 'var(--primary)' }}
                  >
                    Lihat semua
                  </button>
                </div>
                <div className="grid sm:grid-cols-3 gap-4">
                  {services.map(s => (
                    <button
                      key={s.id}
                      onClick={() => bukaDialog(s)}
                      className="rounded-2xl p-5 text-left transition-all hover:shadow-md"
                      style={{ background: 'var(--card)', border: '1px solid var(--border)' }}
                    >
                      <div className="text-2xl mb-3" aria-hidden="true">
                        {s.code === 'A' ? '🩺' : s.code === 'G' ? '🦷' : '💬'}
                      </div>
                      <h3 className="font-display font-bold mb-1">{s.name}</h3>
                      <p className="text-xs mb-2" style={{ color: 'var(--muted-foreground)' }}>{s.description}</p>
                      <p className="text-xs font-medium" style={{ color: 'var(--primary)' }}>
                        {s.waiting === 0 ? 'Tidak ada antrean' : `${s.waiting} orang menunggu`}
                      </p>
                    </button>
                  ))}
                </div>
              </div>

              <div className="rounded-2xl p-5" style={{ background: 'rgba(22,163,74,0.08)' }}>
                <p className="text-xs font-semibold mb-1" style={{ color: 'var(--success)' }}>Tips sehat hari ini</p>
                <p className="text-sm" style={{ color: 'var(--foreground)' }}>
                  Cukupi kebutuhan air minum dan istirahat di sela aktivitas kuliahmu.
                </p>
              </div>
            </div>
          )}

          {/* ── Layanan ─────────────────────────────────────────────────── */}
          {tab === 'layanan' && (
            <div>
              <div className="mb-6">
                <p className="text-xs font-semibold tracking-wide mb-1" style={{ color: 'var(--primary)' }}>LAYANAN</p>
                <h1 className="font-display text-3xl font-bold mb-1">Pilih layanan klinik</h1>
                <p className="text-sm" style={{ color: 'var(--muted-foreground)' }}>
                  Temukan layanan kesehatan yang Anda butuhkan.
                </p>
              </div>

              <div className="grid sm:grid-cols-2 gap-4">
                {services.map(s => (
                  <div
                    key={s.id}
                    className="rounded-2xl p-6"
                    style={{ background: 'var(--card)', border: '1px solid var(--border)' }}
                  >
                    <div className="flex items-start justify-between mb-4">
                      <div className="text-3xl" aria-hidden="true">
                        {s.code === 'A' ? '🩺' : s.code === 'G' ? '🦷' : '💬'}
                      </div>
                      <span
                        className="px-2.5 py-1 rounded-full text-xs font-semibold"
                        style={{ background: 'var(--primary-soft)', color: 'var(--primary-dark)' }}
                      >
                        {s.code}
                      </span>
                    </div>
                    <h3 className="font-display text-lg font-bold mb-1">{s.name}</h3>
                    <p className="text-sm mb-4" style={{ color: 'var(--muted-foreground)' }}>{s.description}</p>
                    <p className="text-xs mb-4" style={{ color: 'var(--muted-foreground)' }}>
                      Kapasitas {s.capacity} · {s.waiting === 0 ? 'tidak ada antrean' : `${s.waiting} menunggu`}
                    </p>
                    <button
                      onClick={() => bukaDialog(s)}
                      disabled={!!active.queue}
                      className="w-full py-3 rounded-xl text-sm font-semibold transition-all hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed"
                      style={{ background: 'var(--primary)', color: 'var(--primary-foreground)' }}
                    >
                      {active.queue ? 'Masih ada antrean aktif' : 'Ambil nomor antrean'}
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ── Riwayat ─────────────────────────────────────────────────── */}
          {tab === 'riwayat' && (
            <div>
              <div className="mb-6">
                <p className="text-xs font-semibold tracking-wide mb-1" style={{ color: 'var(--primary)' }}>RIWAYAT</p>
                <h1 className="font-display text-3xl font-bold mb-1">Riwayat kunjungan</h1>
                <p className="text-sm" style={{ color: 'var(--muted-foreground)' }}>
                  Lihat kembali kunjungan klinik Anda.
                </p>
              </div>

              {riwayat.length === 0 ? (
                <Card>
                  <EmptyState icon="📋" title="Belum ada riwayat" desc="Kunjunganmu akan tercatat di sini." />
                </Card>
              ) : (
                <div className="space-y-3">
                  {riwayat.map(q => (
                    <Card key={q.id} className="p-5">
                      <div className="flex items-start justify-between gap-4">
                        <div className="min-w-0">
                          <h3 className="font-display font-bold mb-1">{q.serviceName}</h3>
                          <p className="text-sm" style={{ color: 'var(--muted-foreground)' }}>
                            {formatDate(q.date)} · {q.number}
                          </p>
                          {q.complaint && (
                            <p className="text-xs mt-1" style={{ color: 'var(--muted-foreground)' }}>
                              Keluhan: {q.complaint}
                            </p>
                          )}
                        </div>
                        <StatusBadge status={q.status} />
                      </div>
                    </Card>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ── Profil ──────────────────────────────────────────────────── */}
          {tab === 'profil' && <ProfilTab />}
        </main>
      </div>

      {/* Navigasi bawah (ponsel) */}
      <nav
        className="md:hidden fixed bottom-0 left-0 right-0 flex z-40"
        style={{ background: 'var(--card)', borderTop: '1px solid var(--border)' }}
      >
        {MENU.map(m => (
          <button
            key={m.id}
            onClick={() => { setTab(m.id); setPesan(''); setGalat('') }}
            className="flex-1 py-3 flex flex-col items-center gap-1 text-xs font-medium"
            style={tab === m.id ? { color: 'var(--primary)' } : { color: 'var(--muted-foreground)' }}
          >
            <span aria-hidden="true">{m.icon}</span>
            {m.label}
          </button>
        ))}
      </nav>

      {/* Dialog ambil antrean */}
      {pilihLayanan && (
        <div
          className="fixed inset-0 z-50 grid place-items-center p-4"
          style={{ background: 'rgba(15,23,42,0.5)' }}
          onClick={() => setPilihLayanan(null)}
          role="dialog"
          aria-modal="true"
        >
          <div
            className="w-full max-w-md rounded-2xl p-6"
            style={{ background: 'var(--card)' }}
            onClick={e => e.stopPropagation()}
          >
            <h2 className="font-display text-xl font-bold mb-1">Ambil nomor antrean</h2>
            <p className="text-sm mb-5" style={{ color: 'var(--muted-foreground)' }}>
              {pilihLayanan.name} — {pilihLayanan.description}
            </p>

            <label htmlFor="keluhan" className="block text-sm font-medium mb-1.5">
              Keluhan singkat (opsional)
            </label>
            <textarea
              id="keluhan"
              value={keluhan}
              onChange={e => setKeluhan(e.target.value)}
              rows={3}
              maxLength={200}
              placeholder="Contoh: demam sejak kemarin"
              className="w-full px-4 py-3 rounded-xl text-sm outline-none resize-none mb-2"
              style={{ background: 'var(--background)', border: '1.5px solid var(--border)', color: 'var(--foreground)' }}
            />
            <p className="text-xs mb-4" style={{ color: 'var(--muted-foreground)' }}>{keluhan.length}/200</p>

            <div className="flex gap-3">
              <button
                onClick={konfirmasiAmbil}
                disabled={sedangProses}
                className="flex-1 py-3 rounded-xl text-sm font-semibold transition-all hover:opacity-90 disabled:opacity-60"
                style={{ background: 'var(--primary)', color: 'var(--primary-foreground)' }}
              >
                {sedangProses ? 'Memproses…' : 'Ambil nomor'}
              </button>
              <button
                onClick={() => setPilihLayanan(null)}
                className="px-5 py-3 rounded-xl text-sm font-semibold"
                style={{ background: 'var(--muted)', color: 'var(--muted-foreground)' }}
              >
                Batal
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

/** Tab Profil — bisa mengubah nama dan nomor telepon. */
function ProfilTab() {
  const { user, updateProfile } = useStore()
  const [name, setName] = useState(user?.name ?? '')
  const [phone, setPhone] = useState(user?.phone ?? '')
  const [pesan, setPesan] = useState('')
  const [galat, setGalat] = useState('')
  const [busy, setBusy] = useState(false)

  if (!user) return null

  async function simpan(e: React.FormEvent) {
    e.preventDefault()
    setPesan('')
    setGalat('')
    setBusy(true)
    const hasil = await updateProfile({ name, phone })
    setBusy(false)
    if (!hasil.ok) setGalat(hasil.error ?? 'Gagal menyimpan.')
    else setPesan('Profil berhasil diperbarui.')
  }

  const kolom = 'w-full px-4 py-3 rounded-xl text-sm outline-none'
  const gayaKolom = {
    background: 'var(--background)',
    border: '1.5px solid var(--border)',
    color: 'var(--foreground)',
  }

  return (
    <div>
      <div className="mb-6">
        <p className="text-xs font-semibold tracking-wide mb-1" style={{ color: 'var(--primary)' }}>PROFIL</p>
        <h1 className="font-display text-3xl font-bold mb-1">Akun saya</h1>
        <p className="text-sm" style={{ color: 'var(--muted-foreground)' }}>
          Kelola informasi dan preferensi akun Anda.
        </p>
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        <Card className="p-6 text-center">
          <div className="flex justify-center mb-4">
            <Avatar name={user.name} size={72} />
          </div>
          <h2 className="font-display font-bold mb-1">{user.name}</h2>
          <p className="text-sm mb-1" style={{ color: 'var(--muted-foreground)' }}>NIM {user.identity}</p>
          <span
            className="inline-block px-3 py-1 rounded-full text-xs font-semibold capitalize"
            style={{ background: 'var(--primary-soft)', color: 'var(--primary-dark)' }}
          >
            {user.role}
          </span>
        </Card>

        <Card className="p-6 lg:col-span-2">
          {pesan && <div className="mb-4"><Notice kind="success">{pesan}</Notice></div>}
          {galat && <div className="mb-4"><Notice>{galat}</Notice></div>}

          <form onSubmit={simpan} className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1.5">Email kampus</label>
              <input value={user.email} readOnly className={kolom} style={{ ...gayaKolom, opacity: 0.7 }} />
              <p className="text-xs mt-1.5" style={{ color: 'var(--muted-foreground)' }}>
                Email tidak bisa diubah.
              </p>
            </div>
            <div>
              <label htmlFor="p-nama" className="block text-sm font-medium mb-1.5">Nama lengkap</label>
              <input id="p-nama" value={name} onChange={e => setName(e.target.value)} className={kolom} style={gayaKolom} />
            </div>
            <div>
              <label htmlFor="p-telp" className="block text-sm font-medium mb-1.5">Nomor telepon</label>
              <input
                id="p-telp" value={phone} onChange={e => setPhone(e.target.value)}
                placeholder="0812 3456 7890" className={kolom} style={gayaKolom}
              />
            </div>
            <button
              type="submit"
              disabled={busy}
              className="px-6 py-3 rounded-xl text-sm font-semibold transition-all hover:opacity-90 disabled:opacity-60"
              style={{ background: 'var(--primary)', color: 'var(--primary-foreground)' }}
            >
              {busy ? 'Menyimpan…' : 'Simpan perubahan'}
            </button>
          </form>
        </Card>
      </div>
    </div>
  )
}
