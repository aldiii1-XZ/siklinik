/**
 * Papan petugas klinik SIKLINIK.
 *
 * Ini sisi yang tidak ada di desain Figma tapi dibutuhkan agar sistem antrean
 * benar-benar berjalan: petugas memanggil nomor berikutnya dan mengubah status.
 *
 * Setiap poli punya kolom sendiri: nomor yang sedang dipanggil, daftar
 * menunggu, dan tombol aksi.
 */
import { useEffect, useState } from 'react'
import { Avatar, Card, EmptyState, Notice, StatusBadge } from '../components/ui'
import { Logo } from '../components/ui'
import { useStore, currentCalled, formatDateFull, groupByService, nextWaiting, summarize } from '../store/store'
import type { Queue } from '../store/store'

export default function StaffApp() {
  const { user, boardServices, boardQueues, logout, setStatus, refreshBoard } = useStore()
  const [pesan, setPesan] = useState('')
  const [galat, setGalat] = useState('')
  const [sedangProses, setSedangProses] = useState<number | null>(null)

  useEffect(() => {
    refreshBoard()
    // Muat ulang papan setiap 15 detik supaya nomor baru muncul tanpa refresh.
    const timer = setInterval(refreshBoard, 15000)
    return () => clearInterval(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  if (!user) return null

  const perLayanan = groupByService(boardQueues)
  const ringkas = summarize(boardQueues)

  async function ubah(q: Queue, status: Queue['status'], label: string) {
    setPesan('')
    setGalat('')
    setSedangProses(q.id)
    const hasil = await setStatus(q.id, status)
    setSedangProses(null)
    if (!hasil.ok) setGalat(hasil.error ?? 'Gagal mengubah status.')
    else setPesan(`${q.number} — ${label}`)
  }

  return (
    <div className="min-h-screen flex" style={{ background: 'var(--background)' }}>
      {/* Sidebar */}
      <aside
        className="hidden md:flex flex-col w-64 shrink-0 p-6"
        style={{ background: 'var(--card)', borderRight: '1px solid var(--border)' }}
      >
        <div className="mb-2">
          <Logo />
        </div>
        <p className="text-xs mb-8" style={{ color: 'var(--muted-foreground)' }}>Papan Petugas</p>

        <div className="space-y-3 mb-6">
          {[
            { label: 'Menunggu', nilai: ringkas.menunggu, warna: 'var(--warning)' },
            { label: 'Dipanggil', nilai: ringkas.dipanggil, warna: 'var(--primary)' },
            { label: 'Selesai', nilai: ringkas.selesai, warna: 'var(--success)' },
          ].map(s => (
            <div key={s.label} className="flex items-center justify-between px-3 py-2 rounded-xl" style={{ background: 'var(--muted)' }}>
              <span className="text-xs font-medium" style={{ color: 'var(--muted-foreground)' }}>{s.label}</span>
              <span className="font-display font-bold" style={{ color: s.warna }}>{s.nilai}</span>
            </div>
          ))}
        </div>

        <div className="flex-1" />

        <div className="flex items-center gap-3 pt-4" style={{ borderTop: '1px solid var(--border)' }}>
          <Avatar name={user.name} />
          <div className="min-w-0 flex-1">
            <div className="text-sm font-semibold truncate">{user.name}</div>
            <div className="text-xs" style={{ color: 'var(--muted-foreground)' }}>Petugas klinik</div>
          </div>
        </div>
      </aside>

      {/* Konten */}
      <div className="flex-1 min-w-0">
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
              onClick={refreshBoard}
              className="px-3 py-2 rounded-lg text-sm font-medium transition-all hover:opacity-70"
              style={{ color: 'var(--primary)' }}
            >
              ↻ Segarkan
            </button>
            <button
              onClick={logout}
              className="px-4 py-2 rounded-lg text-sm font-medium transition-all hover:opacity-70"
              style={{ color: 'var(--muted-foreground)' }}
            >
              Keluar
            </button>
          </div>
        </header>

        <main className="p-6 max-w-7xl">
          <div className="mb-6">
            <h1 className="font-display text-3xl font-bold mb-1">Papan antrean</h1>
            <p className="text-sm" style={{ color: 'var(--muted-foreground)' }}>
              Panggil nomor berikutnya dan perbarui status pasien.
            </p>
          </div>

          {pesan && <div className="mb-5"><Notice kind="success">{pesan}</Notice></div>}
          {galat && <div className="mb-5"><Notice>{galat}</Notice></div>}

          {boardQueues.length === 0 ? (
            <Card>
              <EmptyState icon="🎫" title="Belum ada antrean hari ini" desc="Antrean pasien akan muncul di sini." />
            </Card>
          ) : (
            <div className="grid lg:grid-cols-3 gap-5">
              {boardServices.map(s => {
                const daftar = perLayanan[s.code] ?? []
                const dipanggil = currentCalled(daftar)
                const berikutnya = nextWaiting(daftar)
                const menunggu = daftar.filter(q => q.status === 'menunggu')
                const selesai = daftar.filter(q => q.status === 'selesai')

                return (
                  <Card key={s.id} className="p-5 flex flex-col">
                    {/* Judul poli */}
                    <div className="flex items-center justify-between mb-4">
                      <div>
                        <h2 className="font-display text-lg font-bold">{s.name}</h2>
                        <p className="text-xs" style={{ color: 'var(--muted-foreground)' }}>
                          {menunggu.length} menunggu · {selesai.length} selesai
                        </p>
                      </div>
                      <span
                        className="w-9 h-9 rounded-xl grid place-items-center font-display font-bold"
                        style={{ background: 'var(--primary-soft)', color: 'var(--primary-dark)' }}
                      >
                        {s.code}
                      </span>
                    </div>

                    {/* Sedang dipanggil */}
                    <div
                      className="rounded-2xl p-4 mb-4 text-center"
                      style={{ background: dipanggil ? 'var(--primary)' : 'var(--muted)' }}
                    >
                      <p
                        className="text-xs font-medium mb-1"
                        style={{ color: dipanggil ? 'rgba(255,255,255,0.7)' : 'var(--muted-foreground)' }}
                      >
                        SEDANG DIPANGGIL
                      </p>
                      <p
                        className="font-display text-3xl font-bold"
                        style={{ color: dipanggil ? '#fff' : 'var(--muted-foreground)' }}
                      >
                        {dipanggil ? dipanggil.number : '—'}
                      </p>
                      {dipanggil && (
                        <p className="text-xs mt-1 truncate" style={{ color: 'rgba(255,255,255,0.8)' }}>
                          {dipanggil.patientName}
                        </p>
                      )}
                    </div>

                    {/* Tombol aksi utama */}
                    <div className="space-y-2 mb-5">
                      {dipanggil ? (
                        <button
                          onClick={() => ubah(dipanggil, 'selesai', 'selesai')}
                          disabled={sedangProses === dipanggil.id}
                          className="w-full py-3 rounded-xl text-sm font-semibold transition-all hover:opacity-90 disabled:opacity-60"
                          style={{ background: 'var(--success)', color: '#fff' }}
                        >
                          {sedangProses === dipanggil.id ? 'Memproses…' : '✓ Tandai selesai'}
                        </button>
                      ) : berikutnya ? (
                        <button
                          onClick={() => ubah(berikutnya, 'dipanggil', 'dipanggil')}
                          disabled={sedangProses === berikutnya.id}
                          className="w-full py-3 rounded-xl text-sm font-semibold transition-all hover:opacity-90 disabled:opacity-60"
                          style={{ background: 'var(--primary)', color: 'var(--primary-foreground)' }}
                        >
                          {sedangProses === berikutnya.id ? 'Memproses…' : `📢 Panggil ${berikutnya.number}`}
                        </button>
                      ) : (
                        <button
                          disabled
                          className="w-full py-3 rounded-xl text-sm font-semibold cursor-not-allowed"
                          style={{ background: 'var(--muted)', color: 'var(--muted-foreground)' }}
                        >
                          Tidak ada antrean
                        </button>
                      )}
                    </div>

                    {/* Daftar menunggu */}
                    <div className="flex-1">
                      <p className="text-xs font-semibold mb-2" style={{ color: 'var(--muted-foreground)' }}>
                        DAFTAR MENUNGGU ({menunggu.length})
                      </p>
                      {menunggu.length === 0 ? (
                        <p className="text-xs py-3 text-center" style={{ color: 'var(--muted-foreground)' }}>
                          Tidak ada yang menunggu
                        </p>
                      ) : (
                        <div className="space-y-2 max-h-64 overflow-y-auto">
                          {menunggu.map(q => (
                            <div
                              key={q.id}
                              className="flex items-center gap-3 p-3 rounded-xl"
                              style={{ background: 'var(--muted)' }}
                            >
                              <span className="font-display font-bold text-sm shrink-0" style={{ color: 'var(--primary)' }}>
                                {q.number}
                              </span>
                              <div className="min-w-0 flex-1">
                                <p className="text-xs font-medium truncate">{q.patientName}</p>
                                {q.complaint && (
                                  <p className="text-xs truncate" style={{ color: 'var(--muted-foreground)' }}>
                                    {q.complaint}
                                  </p>
                                )}
                              </div>
                              <button
                                onClick={() => ubah(q, 'dipanggil', 'dipanggil')}
                                disabled={sedangProses === q.id || !!dipanggil}
                                className="px-2.5 py-1.5 rounded-lg text-xs font-semibold shrink-0 transition-all hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed"
                                style={{ background: 'var(--card)', color: 'var(--primary)' }}
                                title={dipanggil ? 'Selesaikan nomor yang sedang dipanggil dulu' : `Panggil ${q.number}`}
                              >
                                Panggil
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Riwayat singkat hari ini */}
                    {selesai.length > 0 && (
                      <div className="mt-4 pt-4" style={{ borderTop: '1px solid var(--border)' }}>
                        <p className="text-xs font-semibold mb-2" style={{ color: 'var(--muted-foreground)' }}>
                          SELESAI HARI INI
                        </p>
                        <div className="flex flex-wrap gap-1.5">
                          {selesai.map(q => (
                            <span
                              key={q.id}
                              className="px-2 py-1 rounded-lg text-xs font-medium"
                              style={{ background: 'rgba(22,163,74,0.1)', color: 'var(--success)' }}
                            >
                              {q.number}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </Card>
                )
              })}
            </div>
          )}

          {/* Ringkasan seluruh antrean hari ini */}
          {boardQueues.length > 0 && (
            <Card className="mt-6 p-5">
              <h2 className="font-display text-lg font-bold mb-4">Semua antrean hari ini</h2>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr style={{ borderBottom: '1px solid var(--border)' }}>
                      {['Nomor', 'Layanan', 'Pasien', 'NIM/NIP', 'Keluhan', 'Status'].map(h => (
                        <th key={h} className="text-left py-2 pr-4 text-xs font-semibold" style={{ color: 'var(--muted-foreground)' }}>
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {boardQueues.map(q => (
                      <tr key={q.id} style={{ borderBottom: '1px solid var(--border)' }}>
                        <td className="py-3 pr-4 font-display font-bold" style={{ color: 'var(--primary)' }}>{q.number}</td>
                        <td className="py-3 pr-4">{q.serviceName}</td>
                        <td className="py-3 pr-4">{q.patientName}</td>
                        <td className="py-3 pr-4" style={{ color: 'var(--muted-foreground)' }}>{q.patientIdentity}</td>
                        <td className="py-3 pr-4 max-w-xs truncate" style={{ color: 'var(--muted-foreground)' }}>
                          {q.complaint || '—'}
                        </td>
                        <td className="py-3"><StatusBadge status={q.status} small /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          )}
        </main>
      </div>
    </div>
  )
}
