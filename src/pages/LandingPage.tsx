/**
 * Landing page SIKLINIK — mengikuti desain Figma:
 * judul besar dengan aksen teal, dua tombol aksi, ilustrasi petugas medis
 * dengan dua kartu mengambang (jadwal & antrean).
 */
import { Logo } from '../components/ui'

interface Props {
  onLogin: () => void
  onRegister: () => void
}

export default function LandingPage({ onLogin, onRegister }: Props) {
  return (
    <div className="min-h-screen flex flex-col" style={{ background: 'var(--background)' }}>
      {/* Header */}
      <header className="w-full max-w-6xl mx-auto px-6 h-20 flex items-center justify-between">
        <Logo />
        <nav className="flex items-center gap-3">
          <button
            onClick={() => document.getElementById('layanan')?.scrollIntoView({ behavior: 'smooth' })}
            className="hidden sm:block px-4 py-2 rounded-lg text-sm font-medium transition-all hover:opacity-70"
            style={{ color: 'var(--muted-foreground)' }}
          >
            Bantuan
          </button>
          <button
            onClick={onLogin}
            className="px-5 py-2.5 rounded-xl text-sm font-semibold transition-all hover:opacity-90 active:scale-95"
            style={{ background: 'var(--card)', color: 'var(--primary)', border: '1.5px solid var(--primary)' }}
          >
            Masuk
          </button>
        </nav>
      </header>

      {/* Hero */}
      <main className="flex-1 w-full max-w-6xl mx-auto px-6 grid lg:grid-cols-2 gap-12 items-center py-10">
        {/* Kiri: teks */}
        <div>
          <span
            className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium mb-6"
            style={{ background: 'var(--card)', color: 'var(--muted-foreground)', border: '1px solid var(--border)' }}
          >
            <span className="w-2 h-2 rounded-full" style={{ background: 'var(--primary)' }} aria-hidden="true" />
            Klinik kampus, kini lebih dekat
          </span>

          <h1 className="font-display text-5xl sm:text-6xl font-bold leading-[1.1] mb-5">
            Sehat tanpa{' '}
            <span style={{ color: 'var(--primary)' }}>antre lama.</span>
          </h1>

          <p className="text-lg leading-relaxed mb-8 max-w-lg" style={{ color: 'var(--muted-foreground)' }}>
            Ambil nomor antrean, pantau giliran, dan akses layanan Klinik Kampus dengan lebih mudah
            dari mana saja.
          </p>

          <div className="flex flex-wrap gap-3 mb-8">
            <button
              onClick={onRegister}
              className="inline-flex items-center gap-2 px-6 py-3.5 rounded-xl font-semibold text-sm transition-all hover:opacity-90 active:scale-[0.98]"
              style={{ background: 'var(--primary)', color: 'var(--primary-foreground)' }}
            >
              Buat akun gratis
              <span aria-hidden="true">→</span>
            </button>
            <button
              onClick={() => document.getElementById('layanan')?.scrollIntoView({ behavior: 'smooth' })}
              className="px-6 py-3.5 rounded-xl font-semibold text-sm transition-all hover:opacity-80"
              style={{ background: 'var(--card)', color: 'var(--foreground)', border: '1.5px solid var(--border)' }}
            >
              Lihat layanan
            </button>
          </div>

          <div className="flex flex-wrap gap-6">
            {['Gratis untuk sivitas kampus', 'Cepat dan praktis'].map(t => (
              <div key={t} className="flex items-center gap-2 text-sm" style={{ color: 'var(--muted-foreground)' }}>
                <span
                  className="w-5 h-5 rounded-full grid place-items-center text-xs shrink-0"
                  style={{ background: 'rgba(22,163,74,0.12)', color: 'var(--success)' }}
                  aria-hidden="true"
                >
                  ✓
                </span>
                {t}
              </div>
            ))}
          </div>
        </div>

        {/* Kanan: ilustrasi + kartu mengambang */}
        <div className="relative hidden lg:block" aria-hidden="true">
          <div
            className="relative mx-auto rounded-[3rem] grid place-items-center"
            style={{ background: 'var(--primary-soft)', width: '100%', maxWidth: '440px', height: '440px' }}
          >
            {/* Ilustrasi petugas medis (bentuk sederhana, tanpa gambar eksternal) */}
            <div className="text-center">
              <div className="text-[9rem] leading-none">🧑‍⚕️</div>
              <p className="font-display text-lg font-bold mt-2" style={{ color: 'var(--primary-dark)' }}>
                Petugas Klinik
              </p>
            </div>
          </div>

          {/* Kartu mengambang: jadwal */}
          <div
            className="absolute top-6 -left-4 px-4 py-3 rounded-2xl shadow-sm"
            style={{ background: 'var(--card)', border: '1px solid var(--border)' }}
          >
            <div className="flex items-center gap-2 mb-1">
              <span className="text-lg">📅</span>
              <span className="text-xs font-medium" style={{ color: 'var(--muted-foreground)' }}>Jadwal hari ini</span>
            </div>
            <div className="font-display font-bold text-lg" style={{ color: 'var(--primary)' }}>08.00 — 15.00</div>
          </div>

          {/* Kartu mengambang: antrean */}
          <div
            className="absolute bottom-8 -right-4 px-4 py-3 rounded-2xl shadow-sm"
            style={{ background: 'var(--card)', border: '1px solid var(--border)' }}
          >
            <div className="flex items-center gap-2 mb-1">
              <span
                className="w-5 h-5 rounded-full grid place-items-center text-xs"
                style={{ background: 'rgba(22,163,74,0.15)', color: 'var(--success)' }}
              >
                ✓
              </span>
              <span className="text-xs font-medium" style={{ color: 'var(--muted-foreground)' }}>Antrean Anda</span>
            </div>
            <div className="font-display font-bold" style={{ color: 'var(--primary)' }}>A-016 · Menunggu</div>
          </div>
        </div>
      </main>

      {/* Layanan */}
      <section id="layanan" className="w-full max-w-6xl mx-auto px-6 pb-16">
        <h2 className="font-display text-2xl font-bold mb-6">Layanan klinik</h2>
        <div className="grid sm:grid-cols-3 gap-4">
          {[
            { icon: '🩺', nama: 'Poli Umum', ket: 'Keluhan umum & pemeriksaan' },
            { icon: '🦷', nama: 'Poli Gigi', ket: 'Kesehatan gigi & mulut' },
            { icon: '💬', nama: 'Konseling', ket: 'Konsultasi kesehatan mental' },
          ].map(l => (
            <div
              key={l.nama}
              className="rounded-2xl p-5"
              style={{ background: 'var(--card)', border: '1px solid var(--border)' }}
            >
              <div className="text-3xl mb-3" aria-hidden="true">{l.icon}</div>
              <h3 className="font-display font-bold mb-1">{l.nama}</h3>
              <p className="text-sm" style={{ color: 'var(--muted-foreground)' }}>{l.ket}</p>
            </div>
          ))}
        </div>
      </section>

      <footer className="w-full max-w-6xl mx-auto px-6 py-8 text-center">
        <p className="text-xs" style={{ color: 'var(--muted-foreground)' }}>
          © {new Date().getFullYear()} SIKLINIK — Sistem Informasi Klinik Kampus
        </p>
      </footer>
    </div>
  )
}
