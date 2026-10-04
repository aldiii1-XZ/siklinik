import { StoreProvider, useStore } from './store/store'
import LandingPage from './pages/LandingPage'
import LoginPage from './pages/LoginPage'
import RegisterPage from './pages/RegisterPage'
import StudentApp from './pages/StudentApp'
import StaffApp from './pages/StaffApp'
import { useState } from 'react'

type PublicView = 'landing' | 'login' | 'register'

/**
 * Titik masuk aplikasi.
 *
 * Belum masuk  -> halaman publik (landing / masuk / daftar)
 * Petugas      -> papan antrean (memanggil nomor, mengubah status)
 * Mahasiswa    -> dashboard pasien
 */
function Shell() {
  const { user } = useStore()
  const [view, setView] = useState<PublicView>('landing')

  if (user) {
    if (user.role === 'petugas') return <StaffApp />
    return <StudentApp />
  }

  if (view === 'login') return <LoginPage onBack={() => setView('landing')} onRegister={() => setView('register')} />
  if (view === 'register') return <RegisterPage onBack={() => setView('login')} />
  return <LandingPage onLogin={() => setView('login')} onRegister={() => setView('register')} />
}

export default function App() {
  return (
    <StoreProvider>
      <Shell />
    </StoreProvider>
  )
}
