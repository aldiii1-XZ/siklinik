/**
 * Logika tampilan obrolan asisten — murni, tanpa React.
 *
 * Balasan asisten memakai penanda sederhana (**tebal**, _miring_, dan baris
 * daftar). Berkas ini mengubah teks itu menjadi struktur yang siap dirender,
 * sehingga bisa diuji tanpa merender React.
 */

export interface InlineToken {
  teks: string
  tebal?: boolean
  miring?: boolean
}

export interface Baris {
  jenis: 'paragraf' | 'daftar' | 'kosong'
  token: InlineToken[]
  /** Penanda daftar: "•" untuk butir biasa, atau "1." untuk bernomor. */
  penanda?: string
}

/**
 * Memecah satu baris menjadi token tebal/miring.
 *
 * Contoh: "Minum **air** putih" -> [{teks:'Minum '}, {teks:'air', tebal:true}, ...]
 */
export function uraiInline(teks: string): InlineToken[] {
  const token: InlineToken[] = []
  // Cocokkan **tebal** atau _miring_.
  const pola = /\*\*([^*]+)\*\*|_([^_]+)_/g
  let posisi = 0
  let cocok: RegExpExecArray | null

  while ((cocok = pola.exec(teks)) !== null) {
    if (cocok.index > posisi) token.push({ teks: teks.slice(posisi, cocok.index) })
    if (cocok[1] !== undefined) token.push({ teks: cocok[1], tebal: true })
    else if (cocok[2] !== undefined) token.push({ teks: cocok[2], miring: true })
    posisi = pola.lastIndex
  }
  if (posisi < teks.length) token.push({ teks: teks.slice(posisi) })
  return token.length ? token : [{ teks: '' }]
}

/**
 * Mengubah balasan asisten menjadi daftar baris siap render.
 *
 * Mengenali baris daftar ("• ...", "- ...", "1. ...") dan baris kosong
 * sebagai pemisah paragraf.
 */
export function uraiPesan(teks: string): Baris[] {
  const hasil: Baris[] = []
  for (const mentah of String(teks ?? '').split('\n')) {
    const baris = mentah.trim()

    if (!baris) {
      hasil.push({ jenis: 'kosong', token: [] })
      continue
    }

    // Butir dengan penanda bulat.
    const bulat = baris.match(/^[•\-*]\s+(.*)$/)
    if (bulat) {
      hasil.push({ jenis: 'daftar', penanda: '•', token: uraiInline(bulat[1]) })
      continue
    }

    // Butir bernomor.
    const bernomor = baris.match(/^(\d+)\.\s+(.*)$/)
    if (bernomor) {
      hasil.push({ jenis: 'daftar', penanda: `${bernomor[1]}.`, token: uraiInline(bernomor[2]) })
      continue
    }

    hasil.push({ jenis: 'paragraf', token: uraiInline(baris) })
  }

  // Buang baris kosong berlebih di ujung.
  while (hasil.length && hasil[hasil.length - 1].jenis === 'kosong') hasil.pop()
  while (hasil.length && hasil[0].jenis === 'kosong') hasil.shift()
  return hasil
}

/** Pertanyaan contoh yang bisa ditekan pengguna untuk memulai. */
export const SARAN_CEPAT: string[] = [
  'Aku demam sejak kemarin, apa yang harus kulakukan?',
  'Sakit gigi terus, sebaiknya ke mana?',
  'Susah tidur belakangan ini',
  'Bagaimana cara ambil nomor antrean?',
]

/** Jam dalam bentuk HH:MM untuk stempel waktu obrolan. */
export function jamSekarang(d = new Date()): string {
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}
