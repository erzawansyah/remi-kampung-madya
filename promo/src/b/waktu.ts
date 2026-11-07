// Semua konstanta waktu Teaser B (frame = detik × 30), mengikuti storyboard promo/BRIEF-teaser-b.md §3.
export const FPS = 30;
// Brief: 44 dtk. Ditambah 3 dtk kartu khusus QR (permintaan pengguna, 7 Nov 2026) supaya QR bisa dipindai.
export const DURASI = 1410;
export const W = 1080;
export const H = 1920;

/** Detik → frame. */
export const d = (detik: number): number => Math.round(detik * FPS);

/** Batas adegan [mulai, selesai) dalam frame. */
export const T = {
  buka: [0, 60],
  whip: [52, 60],
  chat1: [60, 150],
  kodeTerbang: [150, 210],
  lobi1: [210, 270],
  buang1: [270, 360],
  tegang1: [360, 480],
  chat2: [480, 540],
  lobi2: [540, 600],
  tegang2: [600, 690],
  kena2: [690, 780],
  chat3: [780, 870],
  kedai: [870, 960],
  menang: [960, 1050],
  lawanBot: [1050, 1110],
  tutup: [1110, 1200],
  stempel: [1200, 1260],
  /** Kartu khusus QR, 3 dtk (tambahan di luar brief, permintaan pengguna). */
  qr: [1260, 1350],
  loop: [1350, 1410],
  /** Pil "gratis · tanpa login · tanpa top up" (detik 2–37). */
  pil: [60, 1110],
} as const satisfies Record<string, readonly [number, number]>;

/** Momen di dalam adegan (frame absolut). */
export const M = {
  // Ronde 1: pentungan dibuka = retak di frame ini (sesudah hening 0,4 dtk).
  retak1: 435,
  heningMulai1: 423,
  caption1: 444,
  noob: 459,
  // Ronde 2
  retak2: 714,
  heningMulai2: 702,
  // Ronde 3: flash putih pindah ke kedai, mentung Kamu, lalu hening sebelum "Mentung bot…".
  flashKedai: 870,
  mentung3: 990,
  heningMulai3: 1068,
  chatBot: 1080,
  // Penutup
  stempelKena: 1205,
  // Brief meminta potong 0,2 dtk sesudah bubble; dilonggarkan jadi 1 dtk supaya bubble sempat terbaca.
  notifAkhir: 1380,
} as const;

/** Pesan chat: frame muncul, pengirim, teks. Ejaan Jawa Malangan apa adanya (brief §3). */
export interface PesanChat {
  frame: number;
  dari: 'Kamu' | 'Dimas' | 'Ayu' | 'Rendi';
  teks: string;
  /** Bubble kode meja (kartu pratinjau tautan). */
  kode?: string;
}

export const CHAT1 = (kode: string): PesanChat[] => [
  { frame: 62, dari: 'Kamu', teks: 'Info room?' },
  { frame: 80, dari: 'Dimas', teks: `Gabung meja Remi Kampung Madya, kode ${kode}`, kode },
  { frame: 100, dari: 'Ayu', teks: 'Gass' },
  { frame: 114, dari: 'Rendi', teks: 'Melu' },
];

export const CHAT2: PesanChat[] = [
  { frame: 482, dari: 'Kamu', teks: 'Mau iku pemanasan.' },
  { frame: 503, dari: 'Dimas', teks: 'Kurang siji' },
];

export const CHAT3: PesanChat[] = [
  { frame: 816, dari: 'Kamu', teks: 'Online gak diitung. Sesuk nang Madya.' },
  { frame: 840, dari: 'Dimas', teks: 'Gass.' },
];

/** Bubble yang ditumpangkan di atas rekaman game (satu per adegan). */
export const BUBBLE_GAME = {
  lobi1: { frame: 216, dari: 'Kamu', teks: 'Aman, aku seng menang.' },
  buang1: { frame: 276, dari: 'Kamu', teks: 'Buang iki ae.' },
  noob: { frame: 459, dari: 'Rendi', teks: 'Noob' },
  lobi2: { frame: 546, dari: 'Kamu', teks: 'Isi bot ae. Bot iku gampang.' },
  kena2: [
    { frame: 722, dari: 'Dimas', teks: 'Dipentung bot.' },
    { frame: 740, dari: 'Ayu', teks: 'Isin.' },
    { frame: 756, dari: 'Rendi', teks: 'Belajar maneh.' },
  ],
  menang: { frame: 1002, dari: 'Kamu', teks: 'MENANG!!' },
  lawanBot: [
    { frame: 1080, dari: 'Dimas', teks: 'Mentung bot iku gak mbanggakno, Sam.' },
    { frame: 1093, dari: 'Ayu', teks: 'Tetep noob.' },
  ],
} as const;

export const CAPTION1 = 'Kartu buanganku… dipakai dia buat nutup.';
export const TEKS_TUTUP_BESAR = 'Coba gratis. Link di bio.';
export const TEKS_TUTUP_KECIL = 'Main dari mana ae. Mau melu grup? DM @kedaimadya';
export const TEKS_STEMPEL = 'BUKAN JUDI ONLINE';
export const TEKS_PIL = 'gratis · tanpa login · tanpa top up';
export const URL_GAME = 'https://remi-madya.likrea.biz.id';
export const TEKS_QR_JUDUL = 'Remi Kampung Madya';
export const TEKS_QR_AJAK = 'Pindai buat main';
export const TEKS_QR_URL = 'remi-madya.likrea.biz.id';

/** Jam dan baterai status bar per adegan chat. */
export const STATUS = {
  chat1: { jam: '23.41', baterai: 61 },
  chat2: { jam: '00.47', baterai: 23 },
  chat3: { jam: '02.04', baterai: 5 },
  loop: { jam: '02.04', baterai: 5 },
} as const;

/**
 * Titik-titik di rekaman game (detik di berkas video rekaman), diisi dari promo/public/rekam/rekam.json
 * sesudah merekam. `kode` = kode meja yang benar-benar terekam (dipakai di chat ronde 1).
 */
export interface TitikRekam {
  kode: string;
  /** Detik di video rekaman saat pentungan dibuka (retak muncul). */
  retak: number;
  /** Detik saat kartu Kamu (yang nanti dipungut) dibuang. */
  buang?: number;
  /** Detik saat lawan memungutnya. */
  pungut?: number;
  /** Detik saat pentungan tertutup diletakkan (sebelum dibuka). */
  tertutup?: number;
  /** Detik saat sorakan mentung tampil (Kamu yang mentung, R3). */
  mentung?: number;
  /** Detik di lobi, sesaat sebelum kursi kosong diisi warga kedai (R2). */
  lobi?: number;
}
