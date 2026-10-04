/**
 * Asisten kesehatan SIKLINIK.
 *
 * Modul ini punya DUA mode yang dipilih otomatis:
 *
 *  1. Mode lokal (bawaan) — menjawab dari basis pengetahuan yang ditulis di
 *     berkas ini. Tidak butuh API key, jadi aplikasi tetap berguna bagi siapa
 *     pun yang menjalankan proyek ini hanya dengan `npm start`.
 *
 *  2. Mode LLM — dipakai bila AI_API_KEY diisi (mis. dari 9Router). Pertanyaan
 *     dikirim ke endpoint yang kompatibel dengan OpenAI beserta system prompt
 *     pengaman di bawah.
 *
 * PENGAMAN (berlaku di kedua mode):
 *  - Tanda bahaya (nyeri dada, sesak napas, perdarahan, pingsan, kejang) tidak
 *    pernah "dijawab santai" — pengguna langsung diarahkan ke 119 / IGD.
 *  - Asisten tidak mendiagnosis dan tidak meresepkan obat atau dosis.
 *  - Selalu mendorong pengguna memeriksakan diri ke klinik untuk keluhan nyata.
 *
 * Catatan: ini alat bantu edukasi, bukan pengganti tenaga medis.
 */

/** Kata kunci yang menandakan keadaan darurat dan wajib ditangani segera. */
const DARURAT = [
  'nyeri dada',
  'sakit dada',
  'dada nyeri',
  'dada sakit',
  'dada berat',
  'sesak napas',
  'sesak nafas',
  'sulit bernapas',
  'sulit bernafas',
  'tidak bisa bernapas',
  'napas berat',
  'pingsan',
  'tidak sadarkan diri',
  'kejang',
  'perdarahan',
  'berdarah banyak',
  'muntah darah',
  'bab berdarah',
  'batuk berdarah',
  'lumpuh',
  'bicara pelo',
  'mulut mencong',
  'lemas sebelah',
  'bunuh diri',
  'mengakhiri hidup',
  'ingin mati',
  'overdosis',
  'keracunan',
  'luka bakar',
  'terbentur',
  'benturan kepala',
]

/**
 * Kata pengisi yang dibuang sebelum pencocokan.
 *
 * Tujuannya agar "dada saya nyeri" tetap dikenali sebagai "dada nyeri",
 * karena orang menulis keluhan dengan susunan kata yang berbeda-beda.
 */
const KATA_PENGISI =
  /\b(saya|aku|ku|kamu|anda|terasa|rasanya|banget|sekali|sangat|yang|dan|di|ke|pada|ini|itu|ada|sudah|sejak|tadi|terus|bgt|juga|masih|lagi|nih|sih|deh|dong)\b/g

/** Menyeragamkan teks: huruf kecil, tanpa tanda baca, tanpa kata pengisi. */
function seragamkan(teks) {
  return String(teks ?? '')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(KATA_PENGISI, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

/** Pesan baku saat tanda bahaya terdeteksi. */
const JAWABAN_DARURAT = `Ini perlu penanganan SEGERA, jangan menunggu.

Segera hubungi **119** (ambulans) atau langsung ke **IGD rumah sakit terdekat**. Kalau kamu di kampus, minta orang terdekat mengantarmu ke klinik sekarang.

Kalau ini menyangkut pikiran untuk mengakhiri hidup, tolong hubungi **119** atau layanan **SEJIWA 119 ext. 8** — kamu tidak harus melewatinya sendiri.

Aku hanya program bantu, bukan tenaga medis. Untuk keadaan seperti ini, pertolongan manusia langsung yang paling penting.`

/**
 * Basis pengetahuan mode lokal.
 *
 * Setiap topik punya kata kunci, jawaban singkat, saran praktis, dan
 * (bila ada) layanan klinik yang paling cocok untuk keluhan itu.
 */
const TOPIK = [
  {
    id: 'demam',
    judul: 'Demam',
    kata: ['demam', 'panas', 'menggigil', 'suhu badan', 'meriang', 'badan panas'],
    jawaban:
      'Demam biasanya tanda tubuh sedang melawan infeksi. Yang paling penting: cukup istirahat, banyak minum air, dan pantau suhunya.',
    saran: [
      'Minum air putih lebih banyak dari biasanya supaya tidak dehidrasi.',
      'Kompres hangat di dahi, leher, dan lipatan ketiak — bukan air es.',
      'Pakai pakaian tipis dan ruangan berventilasi baik.',
      'Istirahat cukup; jangan memaksakan ikut kegiatan berat.',
      'Segera periksa bila demam di atas 39°C, lebih dari 3 hari, atau disertai kejang dan ruam.',
    ],
    layanan: 'A',
  },
  {
    id: 'flu',
    judul: 'Batuk, pilek, dan flu',
    kata: ['batuk', 'pilek', 'flu', 'hidung tersumbat', 'bersin', 'tenggorokan', 'radang tenggorokan', 'serak'],
    jawaban:
      'Batuk dan pilek paling sering karena infeksi virus saluran napas atas, yang umumnya membaik sendiri dalam 5–7 hari.',
    saran: [
      'Istirahat cukup dan perbanyak minum air hangat.',
      'Hirup uap air hangat untuk melegakan hidung tersumbat.',
      'Berkumur air garam hangat untuk meredakan radang tenggorokan.',
      'Tutup mulut saat batuk/bersin dan cuci tangan agar tidak menular ke teman sekelas.',
      'Periksa bila sesak napas, batuk lebih dari 2 minggu, atau batuk berdarah.',
    ],
    layanan: 'A',
  },
  {
    id: 'kepala',
    judul: 'Sakit kepala dan pusing',
    kata: ['sakit kepala', 'pusing', 'migrain', 'kepala berdenyut', 'kliyengan', 'vertigo'],
    jawaban:
      'Sakit kepala sering dipicu kurang tidur, kurang minum, telat makan, stres, atau terlalu lama menatap layar.',
    saran: [
      'Cari tempat tenang, redupkan lampu, dan istirahatkan mata dari layar.',
      'Minum air putih — dehidrasi sering jadi penyebab.',
      'Makan teratur; jangan lewatkan sarapan sebelum kuliah.',
      'Kompres dingin di dahi atau hangat di leher bagian belakang.',
      'Segera periksa bila nyeri paling hebat yang pernah dirasakan, disertai muntah menyemprot, pandangan ganda, atau setelah benturan kepala.',
    ],
    layanan: 'A',
  },
  {
    id: 'perut',
    judul: 'Sakit perut, maag, dan diare',
    kata: ['sakit perut', 'perut', 'maag', 'lambung', 'mual', 'muntah', 'diare', 'mencret', 'kembung', 'sembelit'],
    jawaban:
      'Keluhan perut sering berkaitan dengan pola makan: telat makan, makanan pedas/berminyak, atau makanan yang kurang bersih.',
    saran: [
      'Makan dalam porsi kecil tapi sering, jangan telat makan.',
      'Hindari makanan pedas, berminyak, dan berkafein untuk sementara.',
      'Saat diare: minum larutan oralit agar tidak dehidrasi.',
      'Hindari obat pereda nyeri jenis NSAID saat perut kosong.',
      'Segera periksa bila nyeri hebat dan menetap, muntah darah, BAB berdarah/hitam, atau diare lebih dari 2 hari.',
    ],
    layanan: 'A',
  },
  {
    id: 'gigi',
    judul: 'Sakit gigi dan gusi',
    kata: ['gigi', 'gusi', 'geraham', 'gigi berlubang', 'sakit gigi', 'gusi bengkak'],
    jawaban:
      'Sakit gigi paling sering karena lubang gigi, gigi retak, atau infeksi gusi — dan tidak sembuh sendiri tanpa penanganan.',
    saran: [
      'Kumur air garam hangat untuk meredakan nyeri sementara.',
      'Sikat gigi lembut dan bersihkan sisa makanan di sela gigi.',
      'Kompres pipi dengan air dingin bila bengkak.',
      'Hindari makanan/minuman sangat manis, panas, atau dingin.',
      'Temui dokter gigi — Poli Gigi klinik kampus melayani ini.',
    ],
    layanan: 'G',
  },
  {
    id: 'haid',
    judul: 'Nyeri haid',
    kata: ['haid', 'menstruasi', 'datang bulan', 'nyeri haid', 'kram perut', 'pms'],
    jawaban:
      'Nyeri haid (dismenore) umum dialami dan biasanya mereda dengan kompres hangat serta istirahat cukup.',
    saran: [
      'Kompres hangat di perut bagian bawah.',
      'Istirahat dan hindari aktivitas fisik berat saat nyeri memuncak.',
      'Olahraga ringan seperti jalan santai justru bisa membantu.',
      'Periksa bila nyeri sampai mengganggu aktivitas, makin berat tiap bulan, atau disertai perdarahan berlebihan.',
    ],
    layanan: 'A',
  },
  {
    id: 'alergi',
    judul: 'Alergi',
    kata: ['alergi', 'gatal', 'biduran', 'bentol', 'ruam', 'bersin terus', 'alergi debu'],
    jawaban:
      'Reaksi alergi muncul saat tubuh bereaksi berlebihan terhadap pemicu seperti debu, makanan, atau cuaca.',
    saran: [
      'Catat dan hindari pemicunya — debu, makanan, atau cuaca tertentu.',
      'Jangan menggaruk kulit agar tidak lecet dan terinfeksi.',
      'Kompres dingin untuk meredakan gatal.',
      'SEGERA ke IGD bila bengkak di wajah/lidah, sesak napas, atau pusing berat — ini anafilaksis.',
    ],
    layanan: 'A',
  },
  {
    id: 'luka',
    judul: 'Luka ringan',
    kata: ['luka', 'tergores', 'teriris', 'jatuh', 'lecet', 'terkilir', 'keseleo'],
    jawaban:
      'Luka ringan bisa ditangani sendiri, yang penting bersih dan tidak terinfeksi.',
    saran: [
      'Cuci tangan dulu, lalu bilas luka dengan air bersih mengalir.',
      'Bersihkan dengan antiseptik, tutup dengan kasa bersih.',
      'Untuk keseleo: istirahatkan, kompres dingin, dan tinggikan bagian yang cedera.',
      'Ganti balutan tiap hari dan jaga tetap kering.',
      'Periksa bila luka dalam, kotor, berdarah tidak berhenti, atau muncul nanah dan demam.',
    ],
    layanan: 'A',
  },
  {
    id: 'mental',
    judul: 'Stres, cemas, dan susah tidur',
    kata: ['stress', 'stres', 'cemas', 'cemas berlebihan', 'overthinking', 'susah tidur', 'insomnia', 'panik', 'gelisah', 'depresi', 'sedih'],
    jawaban:
      'Tekanan kuliah memang bisa berat. Perasaan cemas dan sulit tidur itu nyata dan bisa ditangani — kamu tidak sendirian.',
    saran: [
      'Coba atur napas: tarik 4 detik, tahan 4 detik, buang 6 detik. Ulangi beberapa kali.',
      'Batasi kafein dan layar menjelang tidur; usahakan tidur di jam yang sama.',
      'Ceritakan ke orang yang kamu percaya — teman, keluarga, atau konselor.',
      'Bagi tugas besar jadi langkah kecil supaya tidak terasa menumpuk.',
      'Klinik kampus punya layanan **Konseling** gratis — bicara dengan konselor bisa sangat membantu.',
    ],
    layanan: 'K',
  },
  {
    id: 'mata',
    judul: 'Mata lelah dan sakit mata',
    kata: ['mata', 'mata lelah', 'mata perih', 'mata merah', 'belekan', 'berair', 'pandangan kabur', 'mata kering'],
    jawaban:
      'Mata lelah biasanya karena terlalu lama menatap layar atau kurang tidur.',
    saran: [
      'Aturan 20-20-20: tiap 20 menit, lihat objek jauh 20 kaki (±6 meter) selama 20 detik.',
      'Jangan mengucek mata dengan tangan kotor.',
      'Cukupi tidur dan atur kecerahan layar senyaman mungkin.',
      'Pakai kacamata bila sudah dianjurkan.',
      'Periksa bila nyeri hebat, penglihatan menurun mendadak, atau mata sangat sensitif terhadap cahaya.',
    ],
    layanan: 'A',
  },
  {
    id: 'kulit',
    judul: 'Kulit gatal dan jerawat',
    kata: ['jerawat', 'kulit', 'panu', 'kurap', 'biang keringat', 'kudis', 'eksim', 'kulit kering'],
    jawaban:
      'Masalah kulit sering dipengaruhi kebersihan, keringat, dan hormon — termasuk jerawat yang umum di usia kuliah.',
    saran: [
      'Cuci wajah 2 kali sehari dengan pembersih lembut; jangan berlebihan.',
      'Jangan memencet jerawat — bisa meninggalkan bekas dan infeksi.',
      'Jaga kulit tetap kering, ganti pakaian setelah berkeringat.',
      'Jangan berbagi handuk atau pakaian agar tidak menular.',
      'Periksa bila kulit melepuh, bernanah luas, atau disertai demam.',
    ],
    layanan: 'A',
  },
  {
    id: 'lelah',
    judul: 'Kelelahan dan kurang tidur',
    kata: ['lelah', 'capek', 'lemas', 'ngantuk', 'kurang tidur', 'tidak bertenaga', 'mudah lelah', 'lesu'],
    jawaban:
      'Kelelahan berkepanjangan sering akibat kurang tidur, jadwal padat, kurang makan, atau anemia.',
    saran: [
      'Usahakan tidur 7–8 jam dan bangun di jam yang konsisten.',
      'Jangan lewatkan makan; pastikan ada protein dan sayur.',
      'Batasi kafein setelah sore hari.',
      'Jalan kaki ringan 15–20 menit bisa menambah energi.',
      'Periksa bila lemas berat, pucat, atau pusing berkepanjangan — bisa perlu cek darah.',
    ],
    layanan: 'A',
  },
  {
    id: 'mabuk',
    judul: 'Mabuk perjalanan',
    kata: ['mabuk perjalanan', 'mual di jalan', 'pusing di mobil', 'mabuk darat'],
    jawaban:
      'Mabuk perjalanan terjadi saat otak menerima sinyal gerak yang berbeda dari mata dan telinga bagian dalam.',
    saran: [
      'Duduk menghadap depan dan lihat ke cakrawala, bukan ke layar.',
      'Hindari makan berat dan bau menyengat sebelum perjalanan.',
      'Buka jendela agar ada udara segar.',
      'Istirahat dan hirup udara segar setelah turun.',
    ],
  },
  {
    id: 'otot',
    judul: 'Nyeri otot dan pegal',
    kata: ['pegal', 'nyeri otot', 'kaku', 'salah tidur', 'sakit punggung', 'sakit leher', 'encok'],
    jawaban:
      'Pegal dan nyeri otot umumnya akibat posisi duduk yang lama atau aktivitas fisik yang belum biasa.',
    saran: [
      'Rentangkan otot tiap 30–45 menit saat duduk lama.',
      'Atur posisi duduk: layar sejajar mata, kaki menapak lantai.',
      'Kompres hangat pada otot yang tegang.',
      'Tidur dengan alas yang menopang leher dengan baik.',
      'Periksa bila nyeri menjalar ke kaki/lengan, disertai kesemutan menetap, atau setelah cedera.',
    ],
    layanan: 'A',
  },
]

/** Informasi layanan klinik kampus — dipakai untuk pertanyaan soal jadwal/antrean. */
const INFO_KLINIK = [
  {
    id: 'layanan-klinik',
    judul: 'Layanan klinik kampus',
    kata: ['layanan apa', 'layanan klinik', 'poli', 'jadwal', 'buka jam', 'jam berapa', 'praktik', 'dokter', 'konseling', 'poli gigi', 'poli umum'],
    jawaban:
      'Klinik kampus SIKLINIK menyediakan tiga layanan:\n\n• **Poli Umum (kode A)** — keluhan umum dan pemeriksaan dasar.\n• **Poli Gigi (kode G)** — kesehatan gigi dan mulut.\n• **Konseling (kode K)** — konsultasi kesehatan mental bersama konselor.\n\nSemua layanan bisa diambil nomor antreannya lewat menu **Layanan** di aplikasi ini.',
    saran: [
      'Buka menu **Layanan**, pilih poli yang sesuai, lalu ambil nomor antrean.',
      'Isi keluhan singkat agar petugas bisa menyiapkan penanganan lebih cepat.',
      'Pantau giliranmu di menu **Beranda**.',
    ],
  },
  {
    id: 'cara-antrean',
    judul: 'Cara mengambil nomor antrean',
    kata: ['cara ambil', 'ambil nomor', 'antrean', 'antri', 'nomor antrean', 'daftar online', 'booking'],
    jawaban:
      'Mengambil nomor antrean sangat mudah dan bisa dari jauh, jadi kamu tidak perlu menunggu lama di klinik.',
    saran: [
      'Buka menu **Layanan** di sidebar.',
      'Pilih layanan yang kamu butuhkan, lalu tekan **Ambil nomor antrean**.',
      'Tulis keluhan singkat (opsional), lalu konfirmasi.',
      'Nomormu muncul di menu **Beranda** lengkap dengan sisa antrean dan estimasi.',
      'Satu orang hanya bisa punya satu antrean aktif per hari.',
    ],
  },
]

/** Semua topik yang bisa dijawab mode lokal. */
const SEMUA = [...TOPIK, ...INFO_KLINIK]

/** Mendeteksi tanda bahaya pada teks pengguna. */
export function deteksiDarurat(teks) {
  const t = seragamkan(teks)
  return DARURAT.some(k => t.includes(k))
}

/** Menghitung skor kecocokan sederhana antara teks pengguna dan kata kunci topik. */
function skorTopik(teks, topik) {
  const t = seragamkan(teks)
  let skor = 0
  for (const k of topik.kata) {
    if (t.includes(k)) skor += k.split(' ').length + 1 // frasa lebih spesifik bernilai lebih tinggi
  }
  return skor
}

/**
 * Menjawab dari basis pengetahuan lokal.
 * Mengembalikan topik terbaik, atau null bila tidak ada yang cocok.
 */
export function jawabLokal(teks) {
  let terbaik = null
  let skorTerbaik = 0
  for (const topik of SEMUA) {
    const s = skorTopik(teks, topik)
    if (s > skorTerbaik) {
      skorTerbaik = s
      terbaik = topik
    }
  }
  return terbaik
}

/** Membentuk balasan lengkap (paragraf + saran) dari sebuah topik. */
export function rangkaiJawaban(topik) {
  const bagian = [topik.jawaban]
  if (topik.saran?.length) {
    bagian.push('\nSaran yang bisa kamu lakukan:\n' + topik.saran.map((s, i) => `${i + 1}. ${s}`).join('\n'))
  }
  return bagian.join('\n')
}

/** Sapaan ramah untuk pertanyaan pembuka atau yang tidak dikenali. */
export function sapaan(nama) {
  const panggilan = nama ? nama.split(' ')[0] : 'kamu'
  return `Halo ${panggilan}! Aku asisten kesehatan SIKLINIK. 🌿

Aku bisa membantu menjelaskan keluhan ringan, memberi saran pertolongan pertama, dan mengarahkanmu ke layanan klinik yang tepat.

Coba tanyakan hal seperti:
• "Aku demam sejak kemarin, apa yang harus kulakukan?"
• "Sakit gigi terus, sebaiknya ke mana?"
• "Susah tidur belakangan ini"
• "Bagaimana cara ambil nomor antrean?"

Catatan penting: aku bukan dokter dan tidak bisa memberi diagnosis atau resep obat. Untuk keluhan yang mengganggu, tetap periksa ke klinik ya.`
}

/** Kalimat penutup yang mengingatkan batas kemampuan asisten. */
export const CATATAN_PENUTUP =
  '\n\n_Aku asisten digital, bukan pengganti dokter. Kalau keluhanmu berlanjut atau memberat, ambil nomor antrean di menu Layanan ya._'

/**
 * System prompt untuk mode LLM.
 *
 * Ditulis eksplisit supaya model tidak "ngasal" dalam konteks kesehatan.
 */
export const SYSTEM_PROMPT = `Kamu adalah "Asisten SIKLINIK", asisten kesehatan untuk mahasiswa di klinik kampus Indonesia.

ATURAN WAJIB:
1. Jawab SELALU dalam bahasa Indonesia yang ramah, hangat, dan mudah dipahami mahasiswa. Jangan pakai bahasa Inggris.
2. JANGAN pernah memberi diagnosis pasti. Katakan "kemungkinan" atau "biasanya", bukan "kamu pasti sakit X".
3. JANGAN meresepkan obat, apalagi menyebut dosis. Sarankan konsultasi untuk hal seperti itu.
4. Jawab SINGKAT dan praktis: maksimal sekitar 150 kata. Pakai poin-poin bila membantu.
5. Bila keluhan mengarah ke DARURAT (nyeri dada, sesak napas, perdarahan, pingsan, kejang, pikiran mengakhiri hidup), hentikan penjelasan lain dan arahkan SEGERA ke 119 atau IGD terdekat.
6. Selalu ingatkan bahwa kamu bukan pengganti dokter dan sarankan memeriksa ke klinik kampus untuk keluhan nyata.
7. Jangan membahas hal di luar topik kesehatan dan layanan klinik. Bila ditanya hal lain, arahkan kembali dengan sopan.

Layanan klinik kampus yang tersedia: Poli Umum (kode A), Poli Gigi (kode G), dan Konseling (kode K). Pengguna bisa mengambil nomor antrean dari menu Layanan.`

/**
 * Membuat asisten dengan konfigurasi tertentu.
 *
 * @param {object} opsi
 * @param {string} [opsi.apiKey]   Kunci API (mis. dari 9Router). Kosong = mode lokal.
 * @param {string} [opsi.baseUrl]  Basis URL yang kompatibel dengan OpenAI.
 * @param {string} [opsi.model]    Nama model yang dipakai.
 * @param {number} [opsi.timeoutMs]
 */
export function buatAsisten({ apiKey, baseUrl, model, timeoutMs = 30000 } = {}) {
  const aktif = Boolean(apiKey && baseUrl && model)

  return {
    /** Mode yang sedang dipakai: 'llm' atau 'lokal'. */
    mode: aktif ? 'llm' : 'lokal',

    /**
     * Menjawab satu pertanyaan.
     *
     * @param {string} teks            Pertanyaan pengguna.
     * @param {object} konteks
     * @param {string} [konteks.nama]  Nama pengguna untuk sapaan.
     * @param {Array}  [konteks.riwayat] Riwayat singkat [{role, content}] untuk mode LLM.
     * @returns {Promise<{reply: string, topik: string|null, darurat: boolean, mode: string}>}
     */
    async tanya(teks, konteks = {}) {
      const pertanyaan = String(teks ?? '').trim()

      // Kosong -> sapaan.
      if (!pertanyaan) {
        return { reply: sapaan(konteks.nama), topik: null, darurat: false, mode: 'lokal' }
      }

      // Pengaman berlaku di semua mode: tanda bahaya selalu diutamakan.
      if (deteksiDarurat(pertanyaan)) {
        return { reply: JAWABAN_DARURAT, topik: 'darurat', darurat: true, mode: aktif ? 'llm' : 'lokal' }
      }

      if (!aktif) {
        // ── Mode lokal ──────────────────────────────────────────────────────
        const topik = jawabLokal(pertanyaan)
        if (!topik) {
          return {
            reply:
              'Aku belum punya jawaban khusus untuk itu. 🤔\n\n' +
              'Coba tanyakan keluhan yang lebih spesifik — misalnya demam, batuk, sakit kepala, sakit gigi, sakit perut, atau susah tidur. ' +
              'Kalau keluhannya sudah mengganggu, lebih baik langsung ambil nomor antrean di menu **Layanan** supaya diperiksa petugas klinik.',
            topik: null,
            darurat: false,
            mode: 'lokal',
          }
        }
        return {
          reply: rangkaiJawaban(topik) + CATATAN_PENUTUP,
          topik: topik.id,
          darurat: false,
          mode: 'lokal',
        }
      }

      // ── Mode LLM ──────────────────────────────────────────────────────────
      try {
        const pesan = [
          { role: 'system', content: SYSTEM_PROMPT },
          ...(Array.isArray(konteks.riwayat) ? konteks.riwayat.slice(-8) : []),
          { role: 'user', content: pertanyaan },
        ]

        const kontrol = new AbortController()
        const timer = setTimeout(() => kontrol.abort(), timeoutMs)
        let res
        try {
          res = await fetch(`${baseUrl.replace(/\/+$/, '')}/chat/completions`, {
            method: 'POST',
            headers: {
              'content-type': 'application/json',
              authorization: `Bearer ${apiKey}`,
            },
            body: JSON.stringify({ model, messages: pesan, temperature: 0.6, max_tokens: 600 }),
            signal: kontrol.signal,
          })
        } finally {
          clearTimeout(timer)
        }

        if (!res.ok) throw new Error(`LLM membalas ${res.status}`)

        const data = await res.json()
        const isi = data?.choices?.[0]?.message?.content?.trim()
        if (!isi) throw new Error('LLM tidak mengembalikan jawaban.')

        return { reply: isi + CATATAN_PENUTUP, topik: null, darurat: false, mode: 'llm' }
      } catch (err) {
        // LLM gagal (kunci salah, jaringan putus, kuota habis) -> jangan
        // biarkan pengguna tanpa jawaban. Turun ke mode lokal.
        console.warn('[asisten] LLM gagal, memakai mode lokal:', err.message)
        const topik = jawabLokal(pertanyaan)
        const dasar = topik
          ? rangkaiJawaban(topik)
          : 'Aku sedang tidak bisa menghubungi layanan AI, dan belum punya jawaban khusus untuk pertanyaan ini.'
        return { reply: dasar + CATATAN_PENUTUP, topik: topik?.id ?? null, darurat: false, mode: 'lokal' }
      }
    },
  }
}
