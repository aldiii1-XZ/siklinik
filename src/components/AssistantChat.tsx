/**
 * Asisten kesehatan SIKLINIK — panel obrolan.
 *
 * Memakai store untuk mengirim pesan dan menampilkan balasan. Balasan dirender
 * dari struktur yang dihasilkan `uraiPesan` sehingga penanda **tebal** dan
 * daftar tampil rapi tanpa perlu pustaka tambahan.
 */
import { useEffect, useRef, useState } from 'react'
import { Avatar } from './ui'
import { useStore, SARAN_CEPAT, uraiPesan, type Baris, type ChatMessage } from '../store/store'

/** Merender satu baris balasan asisten (paragraf atau butir daftar). */
function BarisPesan({ baris }: { baris: Baris }) {
  if (baris.jenis === 'kosong') return <div className="h-2" />

  const isi = baris.token.map((t, i) => {
    if (t.tebal) return <strong key={i}>{t.teks}</strong>
    if (t.miring) return <em key={i}>{t.teks}</em>
    return <span key={i}>{t.teks}</span>
  })

  if (baris.jenis === 'daftar') {
    return (
      <div className="flex gap-2 py-0.5">
        <span className="shrink-0 tabular-nums" style={{ color: 'var(--primary)' }}>
          {baris.penanda}
        </span>
        <span className="flex-1">{isi}</span>
      </div>
    )
  }
  return <p>{isi}</p>
}

/** Balon percakapan untuk satu pesan. */
function Balon({ pesan, namaUser }: { pesan: ChatMessage; namaUser: string }) {
  const dariSaya = pesan.role === 'user'

  if (dariSaya) {
    return (
      <div className="flex justify-end gap-3">
        <div
          className="max-w-[80%] px-4 py-3 rounded-2xl rounded-br-md text-sm leading-relaxed"
          style={{ background: 'var(--primary)', color: 'var(--primary-foreground)' }}
        >
          {pesan.content}
        </div>
        <Avatar name={namaUser} size={32} />
      </div>
    )
  }

  const baris = uraiPesan(pesan.content)
  return (
    <div className="flex gap-3">
      <div
        className="shrink-0 w-8 h-8 rounded-xl grid place-items-center text-base"
        style={{ background: 'var(--primary-soft)', color: 'var(--primary-dark)' }}
        aria-hidden="true"
      >
        🌿
      </div>
      <div
        className="max-w-[85%] px-4 py-3 rounded-2xl rounded-bl-md text-sm leading-relaxed space-y-0.5"
        style={{ background: 'var(--card)', border: '1px solid var(--border)', color: 'var(--foreground)' }}
      >
        {baris.map((b, i) => (
          <BarisPesan key={i} baris={b} />
        ))}
        <p className="text-[11px] pt-1" style={{ color: 'var(--muted-foreground)' }}>
          {pesan.time}
        </p>
      </div>
    </div>
  )
}

/** Indikator "sedang menulis". */
function SedangMenulis() {
  return (
    <div className="flex gap-3">
      <div
        className="shrink-0 w-8 h-8 rounded-xl grid place-items-center text-base"
        style={{ background: 'var(--primary-soft)', color: 'var(--primary-dark)' }}
        aria-hidden="true"
      >
        🌿
      </div>
      <div
        className="px-4 py-3 rounded-2xl rounded-bl-md flex items-center gap-1.5"
        style={{ background: 'var(--card)', border: '1px solid var(--border)' }}
      >
        {[0, 1, 2].map(i => (
          <span
            key={i}
            className="w-1.5 h-1.5 rounded-full animate-pulse-soft"
            style={{ background: 'var(--muted-foreground)', animationDelay: `${i * 0.15}s` }}
          />
        ))}
        <span className="text-xs ml-1" style={{ color: 'var(--muted-foreground)' }}>
          Asisten sedang menulis…
        </span>
      </div>
    </div>
  )
}

export default function AssistantChat() {
  const { user, chatMessages, chatMode, chatBusy, loadChat, sendChat, clearChat } = useStore()
  const [teks, setTeks] = useState('')
  const [galat, setGalat] = useState('')
  const bawahRef = useRef<HTMLDivElement>(null)
  const muatRef = useRef(false)

  // Muat riwayat sekali saat tab dibuka.
  useEffect(() => {
    if (muatRef.current) return
    muatRef.current = true
    loadChat()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Gulir ke pesan terbaru setiap kali daftar bertambah.
  useEffect(() => {
    bawahRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' })
  }, [chatMessages.length, chatBusy])

  if (!user) return null

  async function kirim(pesan: string) {
    const isi = pesan.trim()
    if (!isi || chatBusy) return
    setGalat('')
    setTeks('')
    const hasil = await sendChat(isi)
    if (!hasil.ok) setGalat(hasil.error ?? 'Gagal mengirim pesan.')
  }

  async function hapus() {
    setGalat('')
    const hasil = await clearChat()
    if (!hasil.ok) setGalat(hasil.error ?? 'Gagal menghapus riwayat.')
  }

  const kosong = chatMessages.length === 0

  return (
    <div>
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold tracking-wide mb-1" style={{ color: 'var(--primary)' }}>
            ASISTEN KESEHATAN
          </p>
          <h1 className="font-display text-3xl font-bold mb-1">Tanya asisten</h1>
          <p className="text-sm" style={{ color: 'var(--muted-foreground)' }}>
            Ceritakan keluhanmu — asisten akan memberi saran awal dan mengarahkan ke layanan yang tepat.
          </p>
        </div>
        {!kosong && (
          <button
            onClick={hapus}
            className="shrink-0 px-3 py-2 rounded-lg text-xs font-medium transition-all hover:opacity-70"
            style={{ color: 'var(--muted-foreground)', border: '1px solid var(--border)' }}
          >
            Hapus riwayat
          </button>
        )}
      </div>

      {/* Keterangan mode asisten */}
      <div
        className="mb-4 px-4 py-3 rounded-xl text-xs flex items-center gap-2"
        style={{ background: 'rgba(0,137,123,0.08)', color: 'var(--primary-dark)' }}
      >
        <span aria-hidden="true">{chatMode === 'llm' ? '🤖' : '📚'}</span>
        {chatMode === 'llm'
          ? 'Asisten AI aktif — jawaban dihasilkan model bahasa.'
          : 'Mode bawaan — jawaban dari panduan kesehatan klinik. (Isi AI_API_KEY di server untuk mengaktifkan AI.)'}
      </div>

      <div
        className="rounded-2xl overflow-hidden flex flex-col"
        style={{ background: 'var(--background)', border: '1px solid var(--border)', height: '60vh', minHeight: 420 }}
      >
        {/* Area pesan */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {kosong ? (
            <div className="h-full flex flex-col items-center justify-center text-center px-4">
              <div
                className="w-14 h-14 rounded-2xl grid place-items-center text-2xl mb-4"
                style={{ background: 'var(--primary-soft)', color: 'var(--primary-dark)' }}
                aria-hidden="true"
              >
                🌿
              </div>
              <h2 className="font-display text-lg font-bold mb-1">Halo, ada yang bisa dibantu?</h2>
              <p className="text-sm mb-5 max-w-sm" style={{ color: 'var(--muted-foreground)' }}>
                Aku bisa menjelaskan keluhan ringan dan mengarahkanmu ke Poli Umum, Poli Gigi, atau Konseling.
              </p>
              <div className="flex flex-wrap gap-2 justify-center">
                {SARAN_CEPAT.map(s => (
                  <button
                    key={s}
                    onClick={() => kirim(s)}
                    className="px-3 py-2 rounded-full text-xs font-medium transition-all hover:shadow-sm"
                    style={{ background: 'var(--card)', border: '1px solid var(--border)', color: 'var(--foreground)' }}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <>
              {chatMessages.map(m => (
                <Balon key={m.id} pesan={m} namaUser={user.name} />
              ))}
              {chatBusy && <SedangMenulis />}
            </>
          )}
          <div ref={bawahRef} />
        </div>

        {/* Kotak tulis */}
        <div className="p-4" style={{ background: 'var(--card)', borderTop: '1px solid var(--border)' }}>
          {galat && (
            <p className="text-xs mb-2" style={{ color: 'var(--danger, #dc2626)' }}>
              {galat}
            </p>
          )}
          <form
            onSubmit={e => {
              e.preventDefault()
              kirim(teks)
            }}
            className="flex gap-2 items-end"
          >
            <textarea
              value={teks}
              onChange={e => setTeks(e.target.value)}
              onKeyDown={e => {
                // Enter mengirim, Shift+Enter membuat baris baru.
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault()
                  kirim(teks)
                }
              }}
              rows={1}
              maxLength={1000}
              placeholder="Tulis keluhanmu… (mis. aku demam sejak kemarin)"
              className="flex-1 px-4 py-3 rounded-xl text-sm outline-none resize-none"
              style={{
                background: 'var(--background)',
                border: '1.5px solid var(--border)',
                color: 'var(--foreground)',
                maxHeight: 120,
              }}
            />
            <button
              type="submit"
              disabled={chatBusy || !teks.trim()}
              className="shrink-0 px-5 py-3 rounded-xl text-sm font-semibold transition-all hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed"
              style={{ background: 'var(--primary)', color: 'var(--primary-foreground)' }}
            >
              {chatBusy ? '…' : 'Kirim'}
            </button>
          </form>
          <p className="text-[11px] mt-2" style={{ color: 'var(--muted-foreground)' }}>
            Asisten ini bukan pengganti dokter dan tidak memberi diagnosis atau resep. Untuk keluhan yang
            mengganggu, ambil nomor antrean di menu Layanan.
          </p>
        </div>
      </div>
    </div>
  )
}
