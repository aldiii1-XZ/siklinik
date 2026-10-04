/**
 * Halaman daftar SIKLINIK — sesuai desain Figma:
 * Nama lengkap, NIM/NIP, Status (Mahasiswa/Staf kampus), Email kampus,
 * Kata sandi, dan centang persetujuan.
 */
import { useState } from 'react'
import { Logo, Notice } from '../components/ui'
import { useStore } from '../store/store'

interface Props {
  onBack: () => void
}

export default function RegisterPage({ onBack }: Props) {
  const { register } = useStore()
  const [form, setForm] = useState({
    name: '',
    identity: '',
    role: '' as '' | 'mahasiswa' | 'staf',
    email: '',
    password: '',
  })
  const [setuju, setSetuju] = useState(false)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  function ubah(kunci: string, nilai: string) {
    setForm(prev => ({ ...prev, [kunci]: nilai }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')

    if (!form.name.trim() || !form.identity.trim() || !form.role || !form.email.trim() || !form.password) {
      setError('Semua kolom harus diisi.')
      return
    }
    if (form.password.length < 8) {
      setError('Kata sandi minimal 8 karakter.')
      return
    }
    if (!setuju) {
      setError('Kamu harus menyetujui Syarat Penggunaan dan Kebijakan Privasi.')
      return
    }

    setBusy(true)
    const hasil = await register({
      name: form.name,
      identity: form.identity,
      email: form.email,
      role: form.role,
      password: form.password,
    })
    setBusy(false)
    if (!hasil.ok) setError(hasil.error ?? 'Gagal mendaftar.')
  }

  const kolom = 'w-full px-4 py-3 rounded-xl text-sm outline-none'
  const gayaKolom = {
    background: 'var(--background)',
    border: '1.5px solid var(--border)',
    color: 'var(--foreground)',
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
          <p className="text-sm" style={{ color: 'rgba(255,255,255,0.7)' }}>Akun SIKLINIK</p>
        </div>

        <div className="space-y-6">
          <h1 className="font-display text-4xl font-bold leading-tight text-white">
            Layanan kesehatan kampus dalam genggaman.
          </h1>
          <p className="text-base leading-relaxed" style={{ color: 'rgba(255,255,255,0.8)' }}>
            Satu akun untuk mengakses antrean, jadwal, dan riwayat layanan klinik.
          </p>
          <ul className="space-y-3">
            {[
              'Ambil antrean tanpa datang lebih awal',
              'Pantau giliran secara langsung',
              'Simpan riwayat kunjungan dengan aman',
            ].map(t => (
              <li key={t} className="flex items-center gap-3 text-sm" style={{ color: 'rgba(255,255,255,0.85)' }}>
                <span
                  className="w-5 h-5 rounded-full grid place-items-center text-xs shrink-0"
                  style={{ background: 'rgba(255,255,255,0.2)', color: '#fff' }}
                  aria-hidden="true"
                >
                  ✓
                </span>
                {t}
              </li>
            ))}
          </ul>
        </div>

        <p className="text-xs" style={{ color: 'rgba(255,255,255,0.5)' }}>
          © {new Date().getFullYear()} SIKLINIK
        </p>
      </div>

      {/* Panel kanan */}
      <div className="flex-1 flex items-center justify-center p-6">
        <div className="w-full max-w-md">
          <div className="flex items-center justify-between mb-6">
            <button onClick={onBack} className="text-sm" style={{ color: 'var(--muted-foreground)' }}>
              ← Kembali
            </button>
            <span className="text-sm" style={{ color: 'var(--muted-foreground)' }}>
              Sudah punya akun?{' '}
              <button onClick={onBack} className="font-semibold" style={{ color: 'var(--primary)' }}>
                Masuk
              </button>
            </span>
          </div>

          <div className="lg:hidden mb-8">
            <Logo />
          </div>

          <div className="rounded-2xl p-8" style={{ background: 'var(--card)', border: '1px solid var(--border)' }}>
            <p className="text-xs font-semibold tracking-wide mb-1" style={{ color: 'var(--primary)' }}>
              DAFTAR AKUN BARU
            </p>
            <h2 className="font-display text-2xl font-bold mb-1">Mulai gunakan SIKLINIK</h2>
            <p className="text-sm mb-6" style={{ color: 'var(--muted-foreground)' }}>
              Gunakan identitas kampus aktif untuk membuat akun.
            </p>

            {error && (
              <div className="mb-4">
                <Notice>{error}</Notice>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label htmlFor="name" className="block text-sm font-medium mb-1.5">Nama lengkap</label>
                <input
                  id="name" className={kolom} style={gayaKolom}
                  value={form.name} onChange={e => ubah('name', e.target.value)}
                  placeholder="Masukkan nama lengkap"
                />
              </div>

              <div>
                <label htmlFor="identity" className="block text-sm font-medium mb-1.5">NIM / NIP</label>
                <input
                  id="identity" className={kolom} style={gayaKolom}
                  value={form.identity} onChange={e => ubah('identity', e.target.value)}
                  placeholder="Contoh: 231040012"
                />
              </div>

              <div>
                <label htmlFor="role" className="block text-sm font-medium mb-1.5">Status</label>
                <select
                  id="role" className={kolom} style={gayaKolom}
                  value={form.role} onChange={e => ubah('role', e.target.value)}
                >
                  <option value="">Pilih status</option>
                  <option value="mahasiswa">Mahasiswa</option>
                  <option value="staf">Staf kampus</option>
                </select>
              </div>

              <div>
                <label htmlFor="email" className="block text-sm font-medium mb-1.5">Email kampus</label>
                <input
                  id="email" type="email" className={kolom} style={gayaKolom}
                  value={form.email} onChange={e => ubah('email', e.target.value)}
                  placeholder="nama@kampus.ac.id"
                />
              </div>

              <div>
                <label htmlFor="password" className="block text-sm font-medium mb-1.5">Kata sandi</label>
                <input
                  id="password" type="password" className={kolom} style={gayaKolom}
                  value={form.password} onChange={e => ubah('password', e.target.value)}
                  placeholder="Minimal 8 karakter"
                />
                <p className="text-xs mt-1.5" style={{ color: 'var(--muted-foreground)' }}>
                  Gunakan kombinasi huruf dan angka.
                </p>
              </div>

              <label className="flex items-start gap-3 text-xs leading-relaxed cursor-pointer" style={{ color: 'var(--muted-foreground)' }}>
                <input
                  type="checkbox"
                  checked={setuju}
                  onChange={e => setSetuju(e.target.checked)}
                  className="mt-0.5 w-4 h-4 shrink-0"
                  style={{ accentColor: 'var(--primary)' }}
                />
                <span>
                  Saya menyetujui{' '}
                  <span className="font-medium" style={{ color: 'var(--primary)' }}>Syarat Penggunaan</span> dan{' '}
                  <span className="font-medium" style={{ color: 'var(--primary)' }}>Kebijakan Privasi</span>.
                </span>
              </label>

              <button
                type="submit"
                disabled={busy}
                className="w-full py-3.5 rounded-xl font-semibold text-sm transition-all hover:opacity-90 active:scale-[0.98] disabled:opacity-60"
                style={{ background: 'var(--primary)', color: 'var(--primary-foreground)' }}
              >
                {busy ? 'Memproses…' : 'Buat akun'}
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  )
}
