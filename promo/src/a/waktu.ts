// Semua konstanta waktu Teaser A (frame = detik × 30), mengikuti storyboard promo/BRIEF-teaser-a.md §4.
export const FPS = 30;
export const DURASI = 1200;
export const W = 1080;
export const H = 1920;

/** Detik → frame. */
export const d = (detik: number): number => Math.round(detik * FPS);

/** Batas adegan [mulai, selesai) dalam frame (§4). */
export const T = {
  coldOpen: [0, 60],
  rewind: [52, 60],
  datang: [60, 150],
  qr: [150, 270],
  buang: [270, 390],
  pungut: [390, 510],
  tegang: [510, 690],
  kena: [690, 780],
  ledek: [780, 900],
  montase: [900, 1020],
  tutup: [1020, 1140],
  stempel: [1140, 1200],
  /** Pil "gratis · tanpa login · tanpa top up" (detik 2–34). */
  pil: [60, 1020],
} as const satisfies Record<string, readonly [number, number]>;

/** Momen di dalam adegan (frame absolut). */
export const M = {
  // Cold open: retak di frame 0, burst ke wajah Bang IT.
  burstWajah: 14,
  // Adegan 2: Bang IT masuk dari kanan, duduk, bersandar.
  bangDatang: 60,
  bangDuduk: 92,
  balonAman: 104,
  // Adegan 3: pindai QR → beranda → nama → lobi.
  qrPindai: 160,
  qrBeranda: 192,
  qrNama: 214,
  qrLobi: 236,
  // Adegan 4: antisipasi → ketuk → menoleh ke kamera.
  balonBuang: 282,
  angkatJari: 288,
  ketukHp: 318,
  tolehKamera: 332,
  // Adegan 5: seruput, ketuk tanpa melihat, panah pungut.
  seruput: 396,
  ketukOwner: 424,
  captionPungut: 450,
  // Adegan 6: hening 0,4 dtk (12 frame) lalu ketukan Cak Owner.
  letakCangkir: 630,
  heningMulai: 666,
  ketukNutup: 678,
  // Adegan 7: retak di layar, terpental, gebrak.
  retak: 690,
  terpental: 702,
  mendarat: 711,
  gebrak: 726,
  // Adegan 8: ledekan besar di HP, "Noob.", reaksi telat 8 frame.
  sodorHp: 786,
  balonNoob: 800,
  tolehDatar: 840,
  // Adegan 9: montase tiga potongan ±1,2 dtk.
  montaseA: 900,
  montaseB: 940,
  montaseC: 978,
  krakGelas: 1004,
  // Adegan 10: tarik mundur keemasan, teks ajakan.
  teksAjak: 1050,
  // Adegan 11: stempel.
  stempelKena: 1146,
  lirikStempel: 1156,
  lirikKamera: 1174,
} as const;

/** Balon kata (teks persis dari §4). */
export const BALON = {
  aman: 'Aman, aku seng menang.',
  buang: 'Buang iki ae.',
  noob: 'Noob.',
  sijiManeh: 'Siji maneh.',
} as const;

export const CAPTION_SEBELUM = '15 menit sebelumnya';
export const CAPTION_PUNGUT = 'Kartu buanganmu dipakai dia buat nutup…';
export const TEKS_TUTUP_BESAR = 'Coba gratis. Link di bio.';
export const TEKS_TUTUP_KECIL = 'Mau melu grup? DM @kedaimadya';
export const TEKS_STEMPEL = 'BUKAN JUDI ONLINE';
export const TEKS_PIL = 'gratis · tanpa login · tanpa top up';
export const URL_GAME = 'https://remi-madya.likrea.biz.id';
export const TEKS_SORAK_KEPENTUNG = 'KEPENTUNG!';
