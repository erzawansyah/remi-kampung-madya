// Teks obrolan suara di meja online (0.9.0). Satu sumber untuk tombol bar atas, lembar Suara, ikon mic
// di kursi, Bantuan, dan pembaca layar. Tidak pernah menyebut kartu, joker, atau isi tangan siapa pun.

export const TEKS_SUARA = {
  judul: 'Suara',
  /** Tombol mic di bar atas (aria-label menurut keadaan). */
  micNyala: 'Mic nyala, ketuk untuk matikan',
  micMati: 'Mic mati, ketuk untuk nyalakan',
  micMinta: 'Lagi minta izin mic…',
  /** Tombol speaker "Dengar suara". */
  dengar: 'Dengar suara',
  dengarNyala: 'Dengar suara nyala, ketuk untuk bisukan semua',
  dengarMati: 'Suara teman dibisukan, ketuk untuk dengar lagi',
  /** Tombol kecil di samping mic yang membuka lembar Suara. */
  bukaLembar: 'Atur suara',
  /** Lembar Suara. */
  mic: 'Mic',
  ketMic: 'Mati tiap kali masuk meja. Nyalakan kalau mau ngobrol.',
  ketDengar: 'Matikan kalau cuma mau main tanpa suara. Cuma di HP ini.',
  orang: 'Yang di meja',
  kosong: 'Belum ada teman yang ikut suara.',
  bisukan: 'Bisukan',
  bunyikan: 'Bunyikan',
  /** Keadaan orang di lembar Suara. */
  keadaan: {
    bicara: 'lagi ngomong',
    nyala: 'mic nyala',
    mati: 'mic mati',
    lemah: 'sinyal lemah',
  },
  menyambung: 'nyambung…',
  gagal: 'suaranya belum nyambung',
  dibisukan: 'kamu bisukan',
  /** Sinyal lemah: suara di HP ini dijeda sendiri. */
  lemah: 'Sinyal lemah, suara dijeda dulu. Nanti nyala lagi sendiri.',
  pulih: 'Sinyal membaik, suara nyala lagi.',
  /** Izin mic ditolak browser (atau HP tanpa mic). */
  izinDitolak: 'Mic-nya nggak diizinkan, Bos. Buka izin mic di pengaturan browser kalau mau ngobrol.',
  tanpaMic: 'Mic nggak ketemu di HP ini.',
  /** Browser menahan putar suara sampai layar disentuh (iPhone). */
  ketuk: 'Ketuk layar sekali biar suara teman kedengaran.',
  /** Label pembaca layar untuk ikon mic di kursi orang. */
  label: {
    bicara: 'lagi ngomong',
    nyala: 'mic nyala',
    mati: 'mic mati',
    lemah: 'suara dijeda, sinyal lemah',
  },
} as const;

export type KeadaanMicTeks = keyof typeof TEKS_SUARA.label;
