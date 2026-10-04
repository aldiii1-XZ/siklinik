/**
 * Komponen bersama SIKLINIK.
 */
import type { ReactNode } from 'react'
import { STATUS_COLOR, STATUS_LABEL, initials, type QueueStatus } from '../store/store'

/** Logo SIKLINIK dengan palang medis. */
export function Logo({ size = 'md' }: { size?: 'sm' | 'md' | 'lg' }) {
  const kotak = size === 'lg' ? 'w-12 h-12 text-2xl' : size === 'sm' ? 'w-8 h-8 text-base' : 'w-10 h-10 text-xl'
  const teks = size === 'lg' ? 'text-2xl' : size === 'sm' ? 'text-lg' : 'text-xl'
  return (
    <div className="flex items-center gap-2.5">
      <div
        className={`${kotak} rounded-xl grid place-items-center font-bold shrink-0`}
        style={{ background: 'var(--primary)', color: 'var(--primary-foreground)' }}
        aria-hidden="true"
      >
        ✚
      </div>
      <span className={`font-display ${teks} font-bold`} style={{ color: 'var(--primary)' }}>
        SIKLINIK
      </span>
    </div>
  )
}

/** Lencana status antrean. */
export function StatusBadge({ status, small }: { status: QueueStatus; small?: boolean }) {
  const warna = STATUS_COLOR[status]
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full font-semibold ${small ? 'px-2.5 py-0.5 text-xs' : 'px-3 py-1 text-sm'}`}
      style={{ background: `${warna}1a`, color: warna }}
    >
      <span className="w-1.5 h-1.5 rounded-full" style={{ background: warna }} aria-hidden="true" />
      {STATUS_LABEL[status]}
    </span>
  )
}

/** Avatar inisial. */
export function Avatar({ name, size = 40 }: { name: string; size?: number }) {
  return (
    <div
      className="rounded-full grid place-items-center font-bold shrink-0"
      style={{
        width: size, height: size,
        background: 'var(--primary-soft)',
        color: 'var(--primary)',
        fontSize: size * 0.36,
      }}
      aria-hidden="true"
    >
      {initials(name)}
    </div>
  )
}

/** Kotak pesan galat atau sukses. */
export function Notice({ children, kind = 'error' }: { children: ReactNode; kind?: 'error' | 'success' | 'info' }) {
  const gaya =
    kind === 'error'
      ? { background: 'rgba(212,80,96,0.12)', color: 'var(--accent)' }
      : kind === 'success'
        ? { background: 'rgba(22,163,74,0.12)', color: 'var(--success)' }
        : { background: 'var(--primary-soft)', color: 'var(--primary-dark)' }
  return (
    <div className="rounded-xl px-4 py-3 text-sm leading-relaxed" style={gaya} role={kind === 'error' ? 'alert' : undefined}>
      {children}
    </div>
  )
}

/** Kartu putih standar aplikasi. */
export function Card({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <div
      className={`rounded-2xl ${className}`}
      style={{ background: 'var(--card)', border: '1px solid var(--border)' }}
    >
      {children}
    </div>
  )
}

/** Keadaan kosong yang ramah. */
export function EmptyState({ icon, title, desc }: { icon: string; title: string; desc: string }) {
  return (
    <div className="text-center py-16">
      <div className="text-5xl mb-4" aria-hidden="true">{icon}</div>
      <h3 className="font-display text-lg font-bold mb-1" style={{ color: 'var(--foreground)' }}>{title}</h3>
      <p className="text-sm" style={{ color: 'var(--muted-foreground)' }}>{desc}</p>
    </div>
  )
}
