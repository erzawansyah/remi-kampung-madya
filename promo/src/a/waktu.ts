// Konstanta Teaser A (brief A): ukuran, teks, dan panjang tiap adegan dalam frame. Video disusun sebagai
// TransitionSeries (satu komponen per adegan, frame lokal mulai 0), jadi momen di dalam adegan ditulis di
// komponennya masing-masing. Transisi memendekkan total, maka adegan sebelum transisi ditambah panjangnya.
export const FPS = 30;
export const W = 1080;
export const H = 1920;

/** Panjang adegan (frame) dan transisi sesudahnya. Total = Σ adegan − Σ transisi = 1200. */
export const ADEGAN = {
  coldOpen: 68, // 60 + rewind 8
  datang: 90,
  pindaiQr: 120,
  buang: 120,
  pungut: 120,
  tegang: 180,
  kepentung: 90,
  ledek: 120,
  montase: 126, // 120 + fade 6
  penutup: 120,
  stempel: 66, // 60 + fade 6
  qrAkhir: 90, // 3 dtk khusus QR (permintaan pemilik), di luar ±40 dtk brief
} as const;
export const TRANSISI = { rewind: 8, fadePenutup: 6, fadeQr: 6 } as const;
export const DURASI = Object.values(ADEGAN).reduce((a, b) => a + b, 0) - TRANSISI.rewind - TRANSISI.fadePenutup - TRANSISI.fadeQr;

/** Awal tiap adegan di garis waktu global (untuk pil, logo, musik). */
export const MULAI = (() => {
  const m = {} as Record<keyof typeof ADEGAN, number>;
  let t = 0;
  const urut = Object.keys(ADEGAN) as (keyof typeof ADEGAN)[];
  urut.forEach((k, i) => {
    m[k] = t;
    t += ADEGAN[k];
    if (k === 'coldOpen') t -= TRANSISI.rewind;
    if (k === 'montase') t -= TRANSISI.fadePenutup;
    if (k === 'stempel') t -= TRANSISI.fadeQr;
    void i;
  });
  return m;
})();

/** Balon kata (teks persis dari brief §4). */
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
