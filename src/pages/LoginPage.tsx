/**
 * Halaman masuk SIKLINIK — dua panel seperti desain Figma:
 * panel kiri berisi penjelasan, panel kanan formulir.
 */
import { useState } from 'react'
import { Logo, Notice } from '../components/ui'
import { useStore } from '../store/store'

interface Props {
  onBack: () => void
  onRegister: () => void
}

export default function LoginPage({ onBack, onRegister }: Props) {
  const { login } = useStore()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setBusy(true)
    const hasil = await login(email, password)
    setBusy(false)
    if (!hasil.ok) setError(hasil.error ?? 'Gagal masuk.')
  }

  return (
    <div className="min-h-screen flex" style={{ background: 'var(--background)' }}>
      {/* Panel kiri */}
      <div className="hidden lg:flex flex-col justify-between w-[460px] shrink-0 p-12" style={{ background: 'var(--primary)' }}>
        <div>
          <div className="flex items-center gap-2.5 mb-2">
            <div
              className="w-10 h-10 rounded-xl grid place-items-center text-xl font-bold"
              style={{ background: 'rgba(255,255,255,0.18)', color: '#fff' }}
              aria-hidden="true"
            >
              ✚
            </div>
            <span className="font-display text-2xl font-bold text-white">SIKLINIK</span>
          </div>
          <p className="text-sm" style={{ color: 'rgba(255,255,255,0.7)' }}>Antrean Klinik Kampus</p>
        </div>

        <div className="space-y-5">
          <h1 className="font-display text-4xl font-bold leading-tight text-white">
            Antre dari jauh,
            <br />
            datang tepat waktu.
          </h1>
          <p className="text-base leading-relaxed" style={{ color: 'rgba(255,255,255,0.8)' }}>
            Masuk untuk mengambil nomor antrean, memantau giliran, dan melihat riwayat kunjunganmu.
          </p>
        </div>

        <p className="text-xs" style={{ color: 'rgba(255,255,255,0.5)' }}>
          © {new Date().getFullYear()} SIKLINIK
        </p>
      </div>

      {/* Panel kanan */}
      <div className="flex-1 flex items-center justify-center p-6">
        <div className="w-full max-w-md">
          <button
            onClick={onBack}
            className="lg:hidden mb-6 text-sm"
            style={{ color: 'var(--muted-foreground)' }}
          >
            ← Kembali
          </button>

          <div className="lg:hidden mb-8">
            <Logo />
          </div>

          <div className="rounded-2xl p-8" style={{ background: 'var(--card)', border: '1px solid var(--border)' }}>
            <h2 className="font-display text-3xl font-bold mb-1" style={{ color: 'var(--foreground)' }}>
              Selamat datang
            </h2>
            <p className="text-sm mb-6" style={{ color: 'var(--muted-foreground)' }}>
              Masuk ke akun SIKLINIK kamu.
            </p>

            {error && (
              <div className="mb-4">
                <Notice>{error}</Notice>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label htmlFor="email" className="block text-sm font-medium mb-1.5">Email kampus</label>
                <input
                  id="email"
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="nama@kampus.ac.id"
                  autoComplete="username"
                  className="w-full px-4 py-3 rounded-xl text-sm outline-none"
                  style={{ background: 'var(--background)', border: '1.5px solid var(--border)', color: 'var(--foreground)' }}
                />
              </div>
              <div>
                <label htmlFor="password" className="block text-sm font-medium mb-1.5">Kata sandi</label>
                <input
                  id="password"
                  type="password"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="••••••••"
                  autoComplete="current-password"
                  className="w-full px-4 py-3 rounded-xl text-sm outline-none"
                  style={{ background: 'var(--background)', border: '1.5px solid var(--border)', color: 'var(--foreground)' }}
                />
              </div>

              <button
                type="submit"
                disabled={busy}
                className="w-full py-3.5 rounded-xl font-semibold text-sm transition-all hover:opacity-90 active:scale-[0.98] disabled:opacity-60"
                style={{ background: 'var(--primary)', color: 'var(--primary-foreground)' }}
              >
                {busy ? 'Memproses…' : 'Masuk'}
              </button>
            </form>

            <p className="text-sm mt-6 text-center" style={{ color: 'var(--muted-foreground)' }}>
              Belum punya akun?{' '}
              <button onClick={onRegister} className="font-semibold" style={{ color: 'var(--primary)' }}>
                Daftar sekarang
              </button>
            </p>

            <div
              className="mt-6 rounded-xl p-4 text-xs space-y-1.5"
              style={{ background: 'var(--background)', border: '1px solid var(--border)' }}
            >
              <p className="font-semibold mb-1" style={{ color: 'var(--muted-foreground)' }}>Akun demo:</p>
              <p style={{ color: 'var(--muted-foreground)' }}>
                🎓 Mahasiswa: <span className="font-mono" style={{ color: 'var(--primary)' }}>mahasiswa@kampus.ac.id</span> /{' '}
                <span className="font-mono" style={{ color: 'var(--primary)' }}>12345678</span>
              </p>
              <p style={{ color: 'var(--muted-foreground)' }}>
                👩‍⚕️ Petugas: <span className="font-mono" style={{ color: 'var(--primary)' }}>petugas@klinik.ac.id</span> /{' '}
                <span className="font-mono" style={{ color: 'var(--primary)' }}>petugas123</span>
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
