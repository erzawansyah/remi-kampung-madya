// Teks obrolan di lobi dan meja (0.7.0). Satu sumber untuk panel lobi, lembar obrolan di meja, dan
// tombol 💬 di bar atas. Tidak pernah menyebut kartu siapa pun.

export const TEKS_OBROLAN = {
  judul: 'Obrolan',
  /** Daftar obrolan masih kosong. */
  kosong: 'Belum ada obrolan. Sapa dulu yang lain.',
  isian: 'Tulis pesan…',
  /** aria-label isian pesan. */
  labelIsian: 'Tulis pesan',
  kirim: 'Kirim',
  tutup: 'Tutup',
  /** aria-label daftar pesan. */
  labelDaftar: 'Isi obrolan',
  /** aria-label deret pesan cepat (emoji dan celetukan). */
  labelCepat: 'Pesan cepat',
  /** aria-label tombol 💬 di bar atas meja. */
  tombol: 'Obrolan',
  /** Kirim lagi sebelum 1,2 detik (meja membuang pesan yang terlalu cepat). */
  pelan: 'Pelan-pelan, Bos. Satu-satu.',
  /** Penanda pesan sendiri di daftar (hanya untuk pembaca layar; gelembungnya di kanan). */
  kamu: 'Kamu',
  /** Label di samping nama pesan warga kedai. */
  warga: 'warga kedai',
  /** Tombol kembali di kepala lembar obrolan meja. */
  kembali: 'Meja',
  /** aria-label tombol kembali. */
  labelKembali: 'Kembali ke meja',
  /** Spanduk kuning selama giliranku dan lembar obrolan terbuka. */
  giliran: 'Giliranmu! Ketuk untuk kembali ke meja',
  /** Tombol 😊 pembuka baki celetukan dan emoji. */
  labelBaki: 'Celetukan dan emoji',
  /** Judul bagian di baki. */
  celetukan: 'Celetukan',
  emoji: 'Emoji',
} as const;

/** Sisa waktu giliran di spanduk lembar obrolan: "32 dtk". */
export const teksSisaGiliran = (detik: number): string => `${Math.max(0, Math.ceil(detik))} dtk`;

/** Subjudul lembar obrolan: siapa saja di meja ("Kamu, Kipas Dua, Cak Kopag"). */
export const teksPeserta = (nama: readonly string[]): string => nama.join(', ');

/** aria-label tombol 💬 saat ada pesan yang belum dibaca: "Obrolan, 3 pesan baru". */
export const teksBelumDibaca = (n: number): string => (n > 0 ? `${TEKS_OBROLAN.tombol}, ${n} pesan baru` : TEKS_OBROLAN.tombol);
