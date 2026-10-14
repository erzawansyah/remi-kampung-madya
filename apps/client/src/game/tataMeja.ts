// Tata letak meja: fungsi MURNI (tanpa Phaser) yang mengubah ModelMeja + ukuran layar menjadi daftar
// kartu, teks, dan hiasan beserta posisinya. MejaScene tinggal menyamakan objek Phaser dengan daftar ini
// (rekonsiliasi per kunci), jadi posisi kartu sudah diketahui SEGERA setelah model dipasang walaupun
// penggambarannya baru terjadi di frame berikut.
//
// Semua ukuran dalam piksel perangkat (piksel CSS × devicePixelRatio). Titik kartu = titik TENGAH kartu.
// Info rahasia: hanya memakai data yang memang ada di view (tangan sendiri, n − 1 buangan teratas,
// kartu jadi). Joker di tangan tidak diberi tanda apa pun, dan angka joker tidak pernah dibaca di sini.

import { maksimalMulung, namaRank, type Kartu, type KartuJadi, type ViewPemain } from '@remi/engine';
import type { InfoMeja } from '@remi/meja';
import { BATAS_MINI_CSS, RASIO_KARTU } from './kartuGrafisGambar';

export interface Kotak {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** Titik acuan di layar (piksel perangkat, titik tengah kartu) untuk animasi kartu terbang. */
export interface Titik {
  x: number;
  y: number;
  /** Lebar kartu di titik itu. */
  w: number;
  /** Kemiringan kartu (derajat), mis. kartu di kipas tangan. */
  sudut?: number;
}

/** Bagian ModelMeja yang dibutuhkan tata letak (lihat ModelMeja di MejaScene.ts). */
export interface ModelTata {
  view: ViewPemain;
  info: InfoMeja;
  tangan: Kartu[];
  dipilih: ReadonlySet<string>;
  pilihJumlahMulung: boolean;
  mulung: null | {
    jumlah: number;
    sisaPungutan: Kartu[];
    idPaling: string;
    kombinasi: { kartu: { kartu: Kartu; label?: string }[] }[];
  };
  aksiTerakhir: Record<number, string>;
  disembunyikan: ReadonlySet<string>;
  bisaPungut: boolean;
  kartukuDiAtas: boolean;
  berikutnya: string | null;
  fokus?: string | null;
}

export interface UkuranLayar {
  /** Lebar & tinggi kanvas (piksel perangkat). */
  W: number;
  H: number;
  /** devicePixelRatio. */
  d: number;
  /** Tinggi bar HTML atas/bawah (piksel CSS). */
  atasCss: number;
  bawahCss: number;
  /** Pengali ukuran teks kanvas (layar besar & preferensi teks besar). */
  skalaTeks: number;
}

export type PeranKartu = 'tangan' | 'buangan' | 'jadi' | 'pungutan' | 'kombinasi' | 'deck' | 'lebih';
export type JenisSorot = 'pilih' | 'wajib' | 'bisa' | 'fokus';
export type AksiKetuk =
  | { jenis: 'kartu'; id: string }
  | { jenis: 'deck' }
  | { jenis: 'buangan'; jumlah: number }
  | { jenis: 'kombinasi'; indeks: number };

export interface KartuTata {
  /** Kunci unik objek (peran + id): kartu yang pindah tempat dapat kunci baru. */
  kunci: string;
  peran: PeranKartu;
  /** null = punggung kartu. */
  kartu: Kartu | null;
  /** Id kartu yang bisa dipilih/diseret (tangan, pungutan). */
  id?: string;
  x: number;
  y: number;
  w: number;
  sudut: number;
  /** Urutan gambar (depth). */
  lapis: number;
  alpha: number;
  /** Ketinggian 0..1: menentukan bayangan (0 = rebah di meja). */
  tinggi: number;
  sorot?: JenisSorot;
  ketuk?: AksiKetuk;
  /** Boleh diseret (kartu tangan). */
  seret?: boolean;
  /** Label kecil di kartu: joker pengganti (→rank, dari view) atau tanda 'kamu'. */
  label?: { isi: string; gaya: 'emas' | 'info'; posisi: 'tengah' | 'bawah' };
}

export type WarnaTeks = 'teks' | 'redup' | 'samar' | 'emas' | 'bahaya' | 'info' | 'gelap';

export interface TeksTata {
  kunci: string;
  x: number;
  y: number;
  isi: string;
  /** Ukuran dalam piksel CSS sebelum dikali skala teks. */
  ukuran: number;
  warna: WarnaTeks;
  tebal?: boolean;
  ox?: number;
  oy?: number;
  /** Lebar maksimum (piksel perangkat): kelebihan dipotong dengan '…'. */
  maks?: number;
  /** Kalau dipotong, minimal sekian huruf harus tersisa; kurang dari itu teksnya disembunyikan. */
  minHuruf?: number;
  /** Teks pendek pengganti kalau `isi` tidak muat `maks` (diukur scene), sebelum dipotong '…'. */
  cadangan?: string;
  /** Latar pil (mis. lencana 'pengocok'). */
  latar?: 'emas' | 'panel';
  /** Berdenyut (alpha) mengikuti waktu global. */
  denyut?: boolean;
  /** Lapis gambar (depth). Kosong = LAPIS.teks (di bawah kartu). */
  lapis?: number;
  /** Ikon punggung kartu kecil di depan teks (digambar scene, lihat IKON_KARTU). `maks` sudah termasuk ikon. */
  ikon?: 'kartu';
}

export type HiasTata =
  | { jenis: 'panel'; kotak: Kotak; aktif: boolean; bahaya: boolean }
  | { jenis: 'bingkai'; kotak: Kotak; warna: 'hijau' | 'emas'; tebal: number }
  | { jenis: 'denyutMerah'; kotak: Kotak }
  | { jenis: 'slot'; kotak: Kotak }
  /** Bingkai fokus keyboard untuk area tanpa kartu (buangan kosong, deck habis). */
  | { jenis: 'fokus'; kotak: Kotak };

export interface TataMeja {
  d: number;
  /** Lebar kartu tangan. */
  cw: number;
  /** Susunan panel lawan di atas yang dipakai (null = tidak ada panel atas). */
  susunanPanel: SusunanPanel | null;
  kartu: KartuTata[];
  teks: TeksTata[];
  hias: HiasTata[];
  titik: {
    deck?: Titik;
    buangan?: Titik;
    tangan?: Titik;
    panel: Map<number, Titik>;
    /** Posisi tiap kartu yang terlihat (termasuk yang disembunyikan karena sedang dianimasikan). */
    kartu: Map<string, Titik>;
  };
  area: {
    deck?: Kotak;
    buangan?: Kotak;
    /** Kotak lepas untuk kartu yang diseret ke buangan (lebih longgar dari kotak buangan). */
    lepasBuangan?: Kotak;
    tangan?: Kotak;
    kartuJadiSaya?: Kotak;
    panel: Map<number, Kotak>;
  };
  /** Kotak yang disorot sebagai "giliran sekarang": panel lawan, atau area tanganku. */
  sorotGiliran: { kotak: Kotak; saya: boolean } | null;
  /** Slot kartu tangan (urutan model.tangan) untuk menghitung tujuan geser. */
  slotTangan: { id: string; x: number; y: number }[];
}

const KOSONG = (d: number): TataMeja => ({
  d,
  cw: 0,
  susunanPanel: null,
  kartu: [],
  teks: [],
  hias: [],
  titik: { panel: new Map(), kartu: new Map() },
  area: { panel: new Map() },
  sorotGiliran: null,
  slotTangan: [],
});

/** Angka semu 0..1 yang stabil per id kartu (untuk kemiringan alami, tanpa Math.random). */
export function acakId(id: string, garam = 0): number {
  let h = (2166136261 ^ garam) >>> 0;
  for (let i = 0; i < id.length; i++) {
    h ^= id.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return ((h >>> 0) % 10007) / 10007;
}

const jepit = (x: number, min: number, maks: number) => Math.min(maks, Math.max(min, x));

/** Lapisan (depth) dasar per jenis. Animasi memakai ≥ 100. */
export const LAPIS = {
  panel: 1,
  teks: 3,
  jadi: 5,
  deck: 8,
  buangan: 10,
  mulung: 14,
  tangan: 20,
  seret: 90,
  animasi: 100,
} as const;

/**
 * Lebar kartu tangan (px CSS) terkecil yang masih dijaga stabil saat kartu jadi pertama turun. Di bawahnya
 * (layar sangat sempit) ukuran kartu didahulukan: kartu baru mengecil setelah kartu jadi benar-benar ada.
 * Sengaja di atas BATAS_MINI_CSS (36) supaya cadangan itu sendiri tidak memaksa desain kartu mini.
 */
export const LANTAI_STABIL_CSS = 44;

/**
 * Penanda kursi yang dimainkan otomatis (warga kedai) di info panel lawan: ikon kecil saja supaya nama
 * & jumlah kartu kebagian tempat. Teks aksesibelnya `label` (kanvas tidak terbaca pembaca layar, jadi
 * HTML yang menyebut pemain memakai label ini). Sama untuk semua level, tidak bergantung kartu/peristiwa.
 */
export const PENANDA_WARGA_KEDAI = { ikon: '☕', label: 'warga kedai' } as const;

/**
 * Angka skor di kanvas: minus tipografis U+2212 ("−125"), sama dengan angkaSkor() di ui/rincianSkor.ts
 * (disalin, bukan diimpor, supaya tata letak murni ini tidak menarik modul DOM).
 */
export const angkaSkorKanvas = (x: number): string => (x < 0 ? `−${-x}` : String(x));

/**
 * Ikon punggung kartu di depan jumlah kartu lawan (info panel ringkas: "▮10 · −125" menggantikan
 * "10 kartu · −125"). Ukuran dalam em teksnya: tinggi & lebar kartu, dan celah ke angka. Digambar scene
 * (bukan karakter 🂠), jadi tidak bergantung huruf yang terpasang di HP.
 */
export const IKON_KARTU = { tinggi: 0.82, lebar: 0.58, celah: 0.24 } as const;
/** Lebar ikon kartu + celahnya untuk teks setinggi `px` (piksel perangkat). */
export const lebarIkonKartu = (px: number): number => (IKON_KARTU.lebar + IKON_KARTU.celah) * px;

/**
 * Info panel lawan ringkas (sebaris dengan nama, atau baris kedua kepala ringkas): ikon kartu + jumlah kartu,
 * lalu skor. Tinggal 1 kartu: "1!" (merah tebal; panelnya juga berdenyut merah). Panel yang lebih lega tetap
 * menulis "10 kartu · −125" / "TINGGAL 1! · −125".
 */
export const infoRingkas = (jumlah: number, skor: number, bahaya: boolean): string => `${bahaya ? '1!' : jumlah} · ${angkaSkorKanvas(skor)}`;

/**
 * Info panel ringkas terlebar yang dijaga tetap muat BERSAMA nama lawan yang utuh: jumlah kartu dua digit
 * dan skor empat karakter (plus ikon kartu). Bentuk kepala panel (sebaris/dua baris) dan lebar panel samping
 * dipilih dari patokan ini dan nama yang duduk di meja (tetap selama permainan), bukan dari skor saat itu,
 * jadi panel tidak berganti bentuk di tengah permainan.
 */
export const INFO_PATOKAN = { biasa: infoRingkas(10, -125, false), bahaya: infoRingkas(1, -125, true) } as const;
/** Ukuran teks info di kepala panel ringkas (px CSS; kepala lain 12). */
const UKURAN_INFO_RINGKAS = 11;
/**
 * Kepala ringkas dua baris, dibuat rapat supaya panel tidak jauh lebih tinggi dari kepala sebaris (px CSS):
 * jarak atas, tinggi baris nama & info (dikali skala teks; baris kepala lain 16), jarak ke kartu jadi, dan
 * jarak kartu jadi ke tepi bawah panel. Kepala lain: atas 5, jarak 3, bawah 6. Baris info (angka & skor, tanpa
 * huruf berekor) boleh lebih pendek dari tinggi hurufnya.
 */
const RINGKAS2 = { atas: 2, barisNama: 15, barisInfo: 12, jarak: 1, bawah: 5 } as const;
/** Jarak kartu jadi ke tepi bawah panel (px CSS). */
const bawahPanel = (barisKepala: 1 | 2 | 3 | 'ringkas' | 'ringkas2') => (barisKepala === 'ringkas2' ? RINGKAS2.bawah : 6);
/** Tinggi isi panel di atas kartu jadi (dari tepi atas panel), piksel perangkat. Bawahnya kartu jadi + bawahPanel. */
function tinggiAtasKartuPanel(barisKepala: 1 | 2 | 3 | 'ringkas' | 'ringkas2', s: number, d: number): number {
  if (barisKepala === 'ringkas2') return (RINGKAS2.barisNama + RINGKAS2.barisInfo) * s * d + (RINGKAS2.atas + RINGKAS2.jarak) * d;
  return (barisKepala === 'ringkas' ? 1 : barisKepala) * 16 * s * d + 8 * d;
}
/** Jarak minimum label '+N' (di bawah tumpukan buangan) ke nama pembuang di kanannya (px CSS). */
const JARAK_PLUS = 4;
/** Celah nama ↔ info di kepala panel (px CSS). */
const CELAH_KEPALA = 8;

/** Kemiringan maksimum kartu di kipas tangan (derajat). */
export const SUDUT_KIPAS_MAKS = 4;
/** Ketinggian (bayangan) kartu tangan: biasa, difokus keyboard, dan terpilih. */
export const TINGGI_TANGAN = { biasa: 0.14, fokus: 0.3, dipilih: 0.5 } as const;

/**
 * Geser & skala bayangan kartu (lebar w, tinggi h) pada ketinggian t: makin tinggi, makin jauh dan lebar.
 * Satu sumber untuk scene (sinkron) dan perhitungan ruang kartu tangan.
 */
export function geserBayangan(w: number, h: number, t: number): { dx: number; dy: number; skala: number } {
  return { dx: w * (0.012 + 0.05 * t), dy: h * (0.018 + 0.075 * t), skala: 1 + 0.07 * t };
}

/**
 * Susunan panel lawan di atas: jumlah kolom, baris kepala (1 = nama · info sebaris, 2 = dua baris), dan
 * ringkas (aksi terakhir pindah ke baris kartu jadi). Ringkas dua baris: nama utuh di baris pertama, info
 * di baris kedua (panel sempit yang tidak muat nama + info sebaris).
 */
export interface SusunanPanel {
  kolom: number;
  barisKepala: 1 | 2;
  ringkas: boolean;
}

/** Lebar kartu tangan (px CSS) yang dianggap masih nyaman: di bawahnya panel lawan diringkas dulu. */
export const CW_NYAMAN_CSS = 46;
/** Lebar panel lawan (px CSS) terkecil untuk susunan dua kolom yang ringkas (empat kelompok kartu jadi terkecil muat). */
export const LEBAR_PANEL_RINGKAS_CSS = 140;
/** Lebar minimum kotak kartu jadiku di samping deck/buangan (lanskap pendek), px CSS. */
export const LEBAR_JADI_SAMPING_CSS = 110;
/** Lebar kartu jadi mini di panel lawan (px CSS) paling kecil saat layar benar-benar sesak. */
export const MINI_PANEL_MIN_CSS = 12;
/**
 * Kartu jadi lawan adalah info permainan (menimbang mulung, membaca meja), jadi di panel ringkas (HP potret
 * 4–6 pemain) tidak dibuat lebih kecil dari MINI_RINGKAS_CSS (px CSS; desain mini berindeks raksasa), kecuali
 * layar benar-benar sesak (kartu tangan sudah minimum). Kalau kartu tangan masih lega (≥ CW_LEGA_CSS),
 * kartu jadi lawan dibuat RASIO_MINI_RINGKAS × kartu tangan; di bawahnya kartu tangan didahulukan.
 */
export const MINI_RINGKAS_CSS = 16;
const RASIO_MINI_RINGKAS = 0.4;
const CW_LEGA_CSS = 50;
/**
 * Lebar kartu pungutan (px CSS) yang diusahakan saat menyusun mulung: kartu pungutan diketuk satu per satu,
 * jadi tidak dibuat lebih kecil dari ini (atau dari kartu tangan, kalau kartu tangannya sendiri lebih kecil).
 */
export const LEBAR_PUNGUTAN_CSS = 36;
/**
 * Deck & buangan paling kecil (px CSS) selama menyusun mulung di baris sendiri (HP potret), supaya kartu tangan
 * dan kartu jadi lawan tidak ikut mengecil. Kartu yang dipungut tampil besar di baris mulung.
 */
export const LANTAI_DECK_MULUNG_CSS = 26;
/** Jarak antar-kartu buangan paling rapat (× lebar kartu): pojok indeks tiap kartu masih terlihat. */
const LANGKAH_BUANGAN_MIN = 0.28;
/** Kartu kombinasi mulung dibanding kartu pungutan (kombinasi diketuk sebagai satu kelompok). */
const RASIO_KOMBINASI = 0.75;

/**
 * Cara mengukur kartu jadi mini di panel lawan ringkas (lihat miniDasar di hitungTataMeja): 'lega', angka = lebar
 * tetap (px CSS), atau 'sesak'.
 */
type ModeMini = 'lega' | number | 'sesak';

interface Sisi {
  pemain: number;
  sisi: 'baris' | 'atas' | 'kiri' | 'kanan';
  kotak: Kotak;
}

/** Hitung tata letak lengkap. */
export function hitungTataMeja(m: ModelTata | null, u: UkuranLayar): TataMeja {
  return hitungTata(m, u, 'otomatis');
}

/**
 * Cara menaruh baris mulung di HP potret: 'otomatis' memilih sendiri (lihat mulungStabil di hitungTata),
 * 'tengah' = mulung mengambil alih baris tengah (dipakai untuk membandingkan).
 */
type PilihanMulung = 'otomatis' | 'tengah';

function hitungTata(m: ModelTata | null, u: UkuranLayar, pilihanMulung: PilihanMulung): TataMeja {
  const { W, H, d } = u;
  if (!m || !m.view.putaran) return KOSONG(d);
  const s = u.skalaTeks;
  const v = m.view;
  const p = v.putaran!;
  const saya = v.saya ?? 0;
  const n = v.pemain.length;
  const pad = 8 * d;
  const atas = (u.atasCss + 4) * d;
  const bawah = H - (u.bawahCss + 2) * d;
  const tinggiTersedia = Math.max(60 * d, bawah - atas);
  const lebarCss = W / d;
  const lanskap = W > H * 1.15 && lebarCss >= 640;
  const lawan = Array.from({ length: n - 1 }, (_, i) => (saya + 1 + i) % n);
  const baris = (px: number) => px * s * d; // tinggi baris teks
  const hTeks = baris(16);

  // ---- tempat duduk lawan ----
  // Lanskap: seperti duduk mengelilingi meja dilihat dari kursiku (bawah): pemain sesudahku di kiri,
  // lalu di seberang (atas), lalu kanan. Lanskap pendek (HP dimiringkan): semua lawan di samping supaya
  // tinggi layar untuk deck, buangan, dan tangan (juga kalau lawannya cuma satu). Potret: panel bertumpuk di atas.
  const pendek = H / d < 560;
  const sisiLanskap = (k: number): Sisi['sisi'][] =>
    k <= 1
      ? [pendek ? 'kiri' : 'atas']
      : k === 2
        ? ['kiri', 'kanan']
        : pendek
          ? Array.from({ length: k }, (_, i) => (i < Math.ceil(k / 2) ? 'kiri' : 'kanan'))
          : ['kiri', ...Array<Sisi['sisi']>(k - 2).fill('atas'), 'kanan'];
  const susunanSisi = lanskap ? sisiLanskap(lawan.length) : lawan.map(() => 'baris' as const);
  const adaSamping = susunanSisi.includes('kiri');
  const jumlahAtas = susunanSisi.filter((x) => x === 'atas' || x === 'baris').length;

  // ---- kelompok tengah (deck · info · buangan berkapasitas penuh) tanpa perapatan buangan ----
  const kapasitas = Math.max(1, n - 1);
  const kolomDeckMin = kiraLebarTeks('ketuk = ambil', 11 * s * d, true) + 2 * d - 14 * d;
  const lebarInfoDasar = lebarInfoTengah(u);
  const lebarTengahDengan = (cwT: number, lebarInfo: number) => Math.max(cwT, kolomDeckMin) + cwT * (1.5 + 0.62 * (kapasitas - 1)) + 28 * d + lebarInfo;
  /** Kartu deck/buangan terkecil yang dipakai sebagai patokan lebar kelompok tengah. */
  const cwTPatokan = 34 * d * 0.8;
  // Kartu jadiku di samping deck/buangan (lanskap pendek: tinggi layar tidak cukup untuk barisnya), kalau
  // di samping kelompok tengah (kartu terkecil, buangan dirapatkan kalau kartunya lebih besar) masih ada tempat.
  const bisaJadiSamping = (lebarKolom: number, lebarInfo: number) =>
    lanskap && pendek && lebarKolom - lebarTengahDengan(cwTPatokan, lebarInfo) - 14 * d >= LEBAR_JADI_SAMPING_CSS * d - 0.01;
  const lebarSampingDasar = adaSamping ? jepit(W * 0.17, 150 * d * Math.min(s, 1.15), 270 * d * s) : 0;
  const jadiSampingAwal = bisaJadiSamping(W - 4 * pad - 2 * lebarSampingDasar, lebarInfoDasar);

  // ---- panel diriku (lanskap yang sangat pendek) ----
  // Kartu jadiku tidak muat di samping deck, dan barisnya sendiri di atas tangan juga tidak muat walau kartu sudah
  // minimum (HP lanskap 740×360 atau 844×390 teks besar, 5–6 pemain; tangan 34 px, deck 20 px): label diriku &
  // kartu jadiku pindah ke panel di bawah tumpukan panel kanan, seperti panel lawan (searah jarum jam: tepat
  // sesudah pemain sebelum aku). Hanya dari ukuran layar, jumlah pemain & teks, jadi tidak berganti di tengah permainan.
  const panelSaya =
    lanskap &&
    pendek &&
    !jadiSampingAwal &&
    tinggiTengahUntuk(20 * d, hTeks, d) + hTeks + (34 * d * 0.6 * RASIO_KARTU + 8 * d) + tinggiTanganSatuBaris(34 * d, d) + 8 * d > tinggiTersedia + 0.5 * d;
  /** Jumlah panel di sisi kiri & kanan (panel diriku paling bawah di kanan). */
  const jumlahSisi = (sisi: 'kiri' | 'kanan') => susunanSisi.filter((x) => x === sisi).length + (panelSaya && sisi === 'kanan' ? 1 : 0);
  /** Nama yang harus muat di kepala panel samping: lawan, ditambah namaku kalau ada panel diriku. */
  const namaSamping = panelSaya ? [saya] : [];
  /** Tinggi baris label diriku (nama · skor) di atas kartu jadiku/tangan; dengan panel diriku tidak ada baris ini. */
  const hLabel = panelSaya ? 0 : hTeks;

  // ---- panel samping ----
  // Panel samping yang pendek (HP lanskap) memakai kepala sebaris ringkas (nama · info). Supaya nama lawan
  // yang duduk di meja muat utuh di samping info patokan (jumlah kartu dua digit, skor empat karakter):
  // 1. panel dilebarkan secukupnya dari kolom tengah. Kalau kartu jadiku di samping deck, hanya dari sisa lebar
  //    untuk kartu jadiku itu (kartu jadiku tetap di sana); selain itu asal deck · info · buangan (kartu
  //    terkecil, tanpa perapatan buangan) tetap muat di kolom tengah;
  // 2. kalau masih tidak muat, info turun ke baris kedua (gambarPanel 'ringkas2') asal tinggi panel masih
  //    cukup untuk satu baris kartu jadi terkecil. Selain itu nama terpotong '…' (info tetap didahulukan).
  // Info panel ringkas memakai bentuk pendek berikon kartu (infoRingkas).
  const kepalaSamping = (h: number): 3 | 'ringkas' => (h >= 14 * d + 3 * hTeks + 2 * (16 * d * RASIO_KARTU + 4 * d) ? 3 : 'ringkas');
  const hPanelSamping = (k: number) => (bawah - atas - 6 * d * (k - 1)) / Math.max(1, k);
  const bisaRingkas2 = (h: number) => h >= tinggiAtasKartuPanel('ringkas2', s, d) + (RINGKAS2.bawah + MINI_PANEL_MIN_CSS * RASIO_KARTU) * d;
  const perluDilebarkan = (['kiri', 'kanan'] as const)
    .map((sisi) => jumlahSisi(sisi))
    .filter((k) => k > 0)
    .some((k) => kepalaSamping(hPanelSamping(k)) === 'ringkas' && (jadiSampingAwal || !bisaRingkas2(hPanelSamping(k))));
  let lebarSamping = lebarSampingDasar;
  // Tanpa kartu jadiku di samping deck, kolom tengah baru dipakai kalau info tidak bisa turun ke baris kedua.
  if (adaSamping && perluDilebarkan) {
    const perlu = lebarKepalaSebaris(m, lawan, u, namaSamping) + 16 * d;
    const kolomMin = lebarTengahDengan(cwTPatokan, lebarInfoDasar) + (jadiSampingAwal ? 14 * d + LEBAR_JADI_SAMPING_CSS * d : 0);
    const maks = Math.min(270 * d * s, (W - 4 * pad - kolomMin) / 2);
    lebarSamping = Math.max(lebarSampingDasar, Math.min(perlu, maks));
  }
  // Kolom tengah: daerah di antara panel samping (deck, buangan, kartu jadiku, tangan).
  const kx0 = adaSamping ? pad + lebarSamping + pad : pad;
  const kx1 = adaSamping ? W - pad - lebarSamping - pad : W - pad;
  const lebarKolom = kx1 - kx0;
  const lebarPanelUntuk = (kolom: number) => (lebarKolom - 6 * d * (kolom - 1)) / kolom;

  // ---- susunan panel atas: dari yang paling lega ke yang paling ringkas ----
  // Kalau tumpukan panel lawan tidak muat, panel diringkas dulu (nama + info satu baris, aksi terakhir
  // pindah ke baris kartu jadi), lalu dijadikan dua kolom, SEBELUM deck/buangan/tangan dikorbankan.
  // Panel ringkas yang terlalu sempit untuk nama utuh + info sebaris memakai dua baris (nama, lalu info).
  const kolomDasar = lanskap
    ? Math.max(1, jumlahAtas)
    : lebarCss >= 700
      ? Math.min(3, lawan.length)
      : lebarCss >= 520 && lawan.length > 1
        ? 2
        : 1;
  const kepalaDasar: 1 | 2 = lebarPanelUntuk(kolomDasar) < 300 * d * s ? 2 : 1;
  const kepalaRingkas = (kolom: number): 1 | 2 =>
    lebarPanelUntuk(kolom) - 16 * d >= lebarKepalaSebaris(m, lawan, u) ? 1 : 2;
  const calon: SusunanPanel[] = [{ kolom: kolomDasar, barisKepala: kepalaDasar, ringkas: false }];
  if (jumlahAtas && kepalaDasar === 2 && kepalaRingkas(kolomDasar) === 1) calon.push({ kolom: kolomDasar, barisKepala: 1, ringkas: true });
  // Dua kolom ringkas: panel cukup lebar untuk kartu jadi lawan, dan untuk nama utuh di baris sendiri.
  const kepala2 = ukurKepalaRingkas(m, lawan, u);
  if (jumlahAtas && !lanskap && kolomDasar < jumlahAtas && lebarPanelUntuk(kolomDasar + 1) >= Math.max(LEBAR_PANEL_RINGKAS_CSS * d, Math.max(kepala2.nama, kepala2.info) + 16 * d))
    calon.push({ kolom: kolomDasar + 1, barisKepala: kepalaRingkas(kolomDasar + 1), ringkas: true });

  // ---- kolom info tengah: dilebarkan supaya 'Giliran <nama>' utuh kalau ada ruang ----
  // Ruangnya diambil dari sisa kolom tengah (maks 22 %), dan tidak sampai menggeser kartu jadiku dari samping deck.
  const jadiSampingDasar = bisaJadiSamping(lebarKolom, lebarInfoDasar);
  const lebarInfo = Math.max(
    lebarInfoDasar,
    Math.min(
      lebarInfoGiliran(m, u),
      lebarKolom * 0.22,
      jadiSampingDasar ? lebarKolom - 14 * d - LEBAR_JADI_SAMPING_CSS * d - lebarTengahDengan(cwTPatokan, 0) : Infinity,
    ),
  );
  const lebarTengahUntuk = (cwT: number) => lebarTengahDengan(cwT, lebarInfo);
  const jadiSamping = bisaJadiSamping(lebarKolom, lebarInfo);
  const lebarTengahMaks = jadiSamping ? lebarKolom - 14 * d - LEBAR_JADI_SAMPING_CSS * d : lebarKolom;
  // Lanskap pendek (HP dimiringkan): tinggi layar tidak cukup untuk baris mulung sendiri. Selama menyusun
  // mulung (sesaat), baris tengah diambil alih: deck & buangan diringkas ke kiri (tanpa kolom info), kartu
  // jadiku ringkas di bawahnya, dan pungutan + kombinasi memakai sisa lebar baris itu (satu atau dua baris).
  // HP potret juga begitu kalau baris mulung sendiri hanya muat dengan mengecilkan kartu tangan & kartu jadi
  // lawan (lihat mulungStabil di bawah), supaya meja tidak melompat dan tidak ada yang saling menimpa.
  let mulungTengah = !!m.mulung && ((lanskap && pendek) || pilihanMulung === 'tengah');
  /** Lebar kartu pungutan yang diusahakan untuk kartu tangan selebar cw. */
  const targetPungutan = (cw: number) => Math.max(cw * 0.8, Math.min(cw, LEBAR_PUNGUTAN_CSS * d));

  // ---- ukuran kartu: dikecilkan sampai semuanya muat ----
  const tangan = m.tangan;
  const milikSaya = p.kartuJadi[saya] ?? [];
  const jumlahJadiSaya = milikSaya.reduce((a, kj) => a + kj.kartu.length, 0);
  const cwMaks = Math.min(lanskap ? (H / d) / 5.4 : lebarCss / 5.5, 140) * d;
  const cwMin = 34 * d;
  /**
   * Kartu jadi mini di panel lawan untuk kartu tangan selebar cw. Panel ringkas: 'lega' = RASIO_MINI_RINGKAS × cw
   * (paling kecil MINI_RINGKAS_CSS), angka = selebar itu (px CSS), 'sesak' (kartu tangan sudah minimum) = 0,3 × cw
   * (paling kecil MINI_PANEL_MIN_CSS).
   */
  const miniDasar = (sp: SusunanPanel, cw: number, mode: ModeMini) =>
    !sp.ringkas
      ? Math.min(cw * 0.5, 42 * d)
      : mode === 'sesak'
        ? Math.max(MINI_PANEL_MIN_CSS * d, cw * 0.3)
        : mode === 'lega'
          ? Math.max(MINI_RINGKAS_CSS * d, cw * RASIO_MINI_RINGKAS)
          : mode * d;
  const ukur = (sp: SusunanPanel, cw: number, cwT = cw * 0.8, mini = miniDasar(sp, cw, 'lega'), denganMulung = true) => {
    const ch = cw * RASIO_KARTU;
    const barisPanel = jumlahAtas ? Math.ceil(jumlahAtas / sp.kolom) : 0;
    const kepala = sp.ringkas ? (sp.barisKepala === 2 ? 'ringkas2' : 'ringkas') : sp.barisKepala;
    const tinggiPanel = tinggiAtasKartuPanel(kepala, s, d) + mini * RASIO_KARTU + bawahPanel(kepala) * d;
    const blokPanel = barisPanel * (tinggiPanel + 6 * d);
    const tinggiTengah = tinggiTengahUntuk(cwT, hTeks, d);
    // Lanskap pendek: mulung mengambil alih baris tengah (tanpa baris sendiri).
    const tinggiMulung =
      m.mulung && denganMulung && !mulungTengah ? rencanaMulung(m.mulung, lebarKolom, targetPungutan(cw), null, u).tinggi + 6 * d : 0;
    const miniSaya = cw * 0.6;
    const lebarJadi = jumlahJadiSaya ? (jumlahJadiSaya * 0.62 + milikSaya.length * 0.38) * miniSaya + milikSaya.length * 6 * d : 0;
    const barisJadi = jumlahJadiSaya && !jadiSamping && !panelSaya ? (lebarJadi > lebarKolom ? 2 : 1) : 0;
    const tinggiJadi = barisJadi ? barisJadi * (miniSaya * RASIO_KARTU + 4 * d) + 4 * d : 0;
    const st = sampingTangan(cw, d);
    const tt = tataTangan(tangan.length, lebarKolom - st.kiri - st.kanan, cw);
    const angkat = ch * 0.18;
    // Kartu tangan tidak boleh keluar dari garis bawah area tangan: sisakan ruang untuk lengkung & miring
    // kipas (±4°) serta bayangan kartu. Di atas: ruang cincin sorot kartu terpilih (lihat ruangSorotTangan).
    const tinggiTangan = ruangSorotTangan(cw, d) + angkat + ch + (tt.baris - 1) * ch * 0.6 + bawahTangan(cw, d);
    const total = blokPanel + tinggiTengah + tinggiMulung + hLabel + tinggiJadi + tinggiTangan + 8 * d;
    return { ch, mini, barisPanel, tinggiPanel, blokPanel, cwT, tinggiTengah, tinggiMulung, miniSaya, tinggiJadi, tinggiTangan, total, tt, angkat };
  };
  type Ukuran = ReturnType<typeof ukur>;
  // Tinggi yang dibutuhkan dengan satu baris kartu jadiku SELALU dicadangkan (walau belum ada), supaya ukuran
  // kartu (tangan, deck, buangan) tidak meloncat mengecil saat kartu jadi pertama turun di layar sempit.
  // Layar yang sangat sempit (6 pemain di HP kecil): cadangan itu tidak boleh membuat kartu lebih kecil dari
  // LANTAI_STABIL_CSS sejak awal; di sana kartu baru mengecil kalau kartu jadi memang sudah turun.
  // Kartu jadiku di samping deck (lanskap pendek) tidak butuh baris sendiri.
  const cadanganJadi = (k: Ukuran) => (jadiSamping || panelSaya ? 0 : Math.max(k.tinggiJadi, k.miniSaya * RASIO_KARTU + 8 * d));
  const butuh = (k: Ukuran) => k.total - k.tinggiJadi + cadanganJadi(k);
  const susut = (sp: SusunanPanel, tinggi: (k: Ukuran) => number, denganMulung: boolean, mode: ModeMini) => {
    let c = Math.max(cwMin, cwMaks);
    while (c > cwMin && tinggi(ukur(sp, c, undefined, miniDasar(sp, c, mode), denganMulung)) > tinggiTersedia) c = Math.max(cwMin, c * 0.95);
    return c;
  };
  const lantai = LANTAI_STABIL_CSS * d;
  const pilihCwDengan = (sp: SusunanPanel, denganMulung: boolean, mode: ModeMini) => {
    const cwStabil = susut(sp, butuh, denganMulung, mode);
    return cwStabil >= lantai ? cwStabil : Math.max(cwStabil, Math.min(susut(sp, (k) => k.total, denganMulung, mode), lantai));
  };
  // Kartu jadi lawan di panel ringkas: RASIO_MINI_RINGKAS × kartu tangan selama kartu tangannya masih lega (atau
  // sama besar dengan kalau kartu jadi lawan cukup MINI_RINGKAS_CSS); selain itu kartu tangan didahulukan dan kartu
  // jadi lawan MINI_RINGKAS_CSS. Kalau itu membuat kartu tangan minimum (HP 320 px) atau memaksanya ke desain mini
  // (< BATAS_MINI_CSS), kartu jadi lawan mengalah sedikit demi sedikit (14 px, lalu 'sesak').
  const pilihCw = (sp: SusunanPanel, denganMulung = true): { cw: number; mode: ModeMini } => {
    const cwLega = pilihCwDengan(sp, denganMulung, 'lega');
    if (!sp.ringkas || cwLega >= CW_LEGA_CSS * d) return { cw: cwLega, mode: 'lega' };
    const layak = (c: number) => c > cwMin + 0.01 && c >= BATAS_MINI_CSS * d;
    for (const lebar of [MINI_RINGKAS_CSS, MINI_RINGKAS_CSS - 2]) {
      const c = pilihCwDengan(sp, denganMulung, lebar);
      if (layak(c)) return cwLega >= c - 0.01 && lebar === MINI_RINGKAS_CSS ? { cw: cwLega, mode: 'lega' } : { cw: c, mode: lebar };
    }
    return { cw: pilihCwDengan(sp, denganMulung, 'sesak'), mode: 'sesak' };
  };
  // Susunan panel dipilih TANPA baris mulung (hanya sesaat) supaya panel tidak berganti bentuk saat menyusun
  // mulung: yang pertama yang kartunya masih nyaman; kalau tidak ada, yang kartunya paling besar
  // (sama besar = yang paling sedikit kekurangan tempat).
  const nilai = calon.map((sp) => ({ sp, cw: pilihCw(sp, false).cw, kurang: butuh(ukur(sp, cwMin, undefined, miniDasar(sp, cwMin, 'sesak'), false)) - tinggiTersedia }));
  const terbaik =
    nilai.find((x) => x.cw >= CW_NYAMAN_CSS * d) ??
    nilai.reduce((a, b) => (b.cw > a.cw + 0.01 || (Math.abs(b.cw - a.cw) <= 0.01 && b.kurang < a.kurang - 0.01) ? b : a));
  const susunan = terbaik.sp;
  const ukurSusunan = (denganMulung: boolean) => {
    const { cw, mode } = pilihCw(susunan, denganMulung);
    let uk = ukur(susunan, cw, undefined, miniDasar(susunan, cw, mode), denganMulung);
    // Kartu di lantai stabil (layar sangat sempit, lihat pilihCw): baris kartu jadiku memang belum dicadangkan,
    // jadi yang diukur kebutuhan sebenarnya. Kalau dibandingkan dengan cadangannya, deck & buangan ikut
    // diperkecil untuk baris kartu jadi yang belum ada.
    const diLantai = cw > susut(susunan, butuh, denganMulung, mode) + 0.01;
    const kebutuhan = (k: Ukuran) => (diLantai ? k.total : butuh(k));
    // Masih tidak muat walau kartu sudah minimum (layar sangat kecil + teks besar): kartu jadi mini di panel
    // lawan dikecilkan dulu, supaya area tidak saling menimpa.
    if (kebutuhan(uk) > tinggiTersedia && uk.barisPanel) {
      const lebih = kebutuhan(uk) - tinggiTersedia;
      uk = ukur(susunan, cw, uk.cwT, Math.max(MINI_PANEL_MIN_CSS * d, uk.mini - lebih / (uk.barisPanel * RASIO_KARTU)), denganMulung);
    }
    // Masih tidak muat (HP lanskap pendek + teks besar: tidak ada panel atas untuk dikecilkan): deck & buangan
    // dikecilkan, kartu tangan tetap.
    if (kebutuhan(uk) > tinggiTersedia) {
      const lebih = kebutuhan(uk) - tinggiTersedia;
      uk = ukur(susunan, cw, Math.max(Math.min(uk.cwT, 20 * d), uk.cwT - lebih / (RASIO_KARTU * 1.15)), uk.mini, denganMulung);
    }
    return { cw, uk, sesak: kebutuhan(uk) > tinggiTersedia + 0.5 * d };
  };
  /** Ukuran akhir (kartu tangan, kartu jadi lawan, deck & buangan), dengan atau tanpa baris mulung sendiri. */
  const ukuranAkhir = (denganMulung: boolean) => {
    const ukuran = ukurSusunan(denganMulung);
    const cw = ukuran.cw;
    let uk = ukuran.uk;
    // ---- ruang sisa dibagikan (layar tinggi: HP potret, tablet) ----
    // Supaya tidak ada ruang kosong besar: deck/buangan membesar dulu (maks 1,1× kartu tangan, dan tidak
    // sampai tumpukan buangan perlu dirapatkan), lalu kartu jadi di panel lawan; sisanya jadi jarak.
    // Ruang sisa dihitung seolah kartu jadiku (1 baris) SELALU ada, supaya ukuran deck/buangan tidak
    // berubah saat kartu jadi pertama turun.
    const napas = 28 * d;
    let sisa = tinggiTersedia - butuh(uk) - napas;
    if (sisa > 0) {
      // Lebar tengah tanpa perapatan buangan: cwT·(2,5 + 0,62·(kapasitas − 1)) + 2·celah + info (+ sisa tepi 12 px).
      const cwTLebar = Math.min(
        (lebarTengahMaks - 40 * d - lebarInfo) / (2.5 + 0.62 * (kapasitas - 1)),
        (lebarTengahMaks - 40 * d - lebarInfo - kolomDeckMin) / (1.5 + 0.62 * (kapasitas - 1)),
      );
      const cwTMaks = Math.max(uk.cwT, Math.min(cw * 1.1, cwTLebar));
      const tambahT = Math.min(cwTMaks - uk.cwT, sisa / (RASIO_KARTU * 1.06));
      const cwT = uk.cwT + Math.max(0, tambahT);
      sisa -= Math.max(0, tambahT) * RASIO_KARTU * 1.06;
      let mini = uk.mini;
      if (uk.barisPanel && sisa > 0) {
        const miniMaks = Math.max(mini, Math.min(cw * 0.75, 60 * d));
        mini += Math.max(0, Math.min(miniMaks - mini, sisa / (uk.barisPanel * RASIO_KARTU)));
      }
      uk = ukur(susunan, cw, cwT, mini, denganMulung);
    }
    // Deck & buangan tidak boleh lebih lebar dari kolomnya walau tumpukan buangan sudah dirapatkan sampai batas
    // (langkah 0,28 × kartu, lihat gambarTengah) dan ada kartu 'lebih' di bawahnya (HP sempit, 6 pemain, teks besar):
    // kartunya dikecilkan supaya kartu buangan teratas tidak keluar layar. Sisa 6 % kartu + 2 px untuk miring ±3°.
    if (!mulungTengah) {
      const tetap = lebarTengahMaks - 28 * d - lebarInfo - 2 * d;
      const per = 1.5 + 0.06 + LANGKAH_BUANGAN_MIN * (kapasitas - 1);
      const cwTLebarMaks = Math.min(tetap / (1 + per), (tetap - kolomDeckMin) / per);
      if (uk.cwT > cwTLebarMaks) uk = ukur(susunan, cw, Math.max(12 * d, cwTLebarMaks), uk.mini, denganMulung);
    }
    return { cw, uk, sesak: ukuran.sesak };
  };
  // ---- menyusun mulung di HP potret: baris mulung sendiri (sesaat, hanya di giliranku) ----
  // Kartu tangan & kartu jadi lawan TIDAK ikut mengecil (meja tidak melompat saat masuk/keluar mode mulung):
  // ukurannya diambil dari meja tanpa baris mulung. Tempat baris mulung diambil dari jarak sisa, dari baris
  // kartu jadiku yang dicadangkan tapi masih kosong, lalu dari deck & buangan (boleh mengecil sampai
  // LANTAI_DECK_MULUNG_CSS; deck tidak bisa diketuk selama menyusun mulung). Tidak cukup: mulung mengambil alih
  // baris tengah (meja juga tetap) kalau kartu pungutannya di sana masih hampir selebar target; selain itu
  // cara lama (semua dikecilkan bersama, dan baris tengah kalau masih tidak muat).
  const mulungStabil = (): { cw: number; uk: Ukuran } | null => {
    const dasar = ukuranAkhir(false);
    let uk = ukur(susunan, dasar.cw, dasar.uk.cwT, dasar.uk.mini, true);
    const lantaiDeck = Math.min(uk.cwT, LANTAI_DECK_MULUNG_CSS * d);
    for (let i = 0; i < 3 && uk.total > tinggiTersedia && uk.cwT > lantaiDeck + 0.01; i++) {
      // Tinggi kelompok tengah ≈ 1,57 × lebar deck (kartu, jarak label, jarak petunjuk).
      uk = ukur(susunan, dasar.cw, Math.max(lantaiDeck, uk.cwT - (uk.total - tinggiTersedia) / 1.55), dasar.uk.mini, true);
    }
    return uk.total <= tinggiTersedia + 0.5 * d ? { cw: dasar.cw, uk } : null;
  };
  let hasil: { cw: number; uk: Ukuran } | null = m.mulung && !mulungTengah ? mulungStabil() : null;
  if (!hasil && m.mulung && !mulungTengah && pilihanMulung === 'otomatis') {
    const tengah = hitungTata(m, u, 'tengah');
    const target = targetPungutan(tengah.cw);
    const lebarMin = (peran: PeranKartu) => Math.min(Infinity, ...tengah.kartu.filter((k) => k.peran === peran).map((k) => k.w));
    // Kartu jadiku (ringkas di bawah deck & buangan) juga harus muat di kotaknya.
    const kj = tengah.area.kartuJadiSaya;
    const idJadiku = new Set(milikSaya.flatMap((x) => x.kartu.map((dk) => `j:${dk.kartu.id}`)));
    const jadikuMuat = tengah.kartu
      .filter((k) => idJadiku.has(k.kunci))
      .every((k) => !!kj && k.x - k.w / 2 >= kj.x - 1 && k.x + k.w / 2 <= kj.x + kj.w + 1 && k.y - (k.w * RASIO_KARTU) / 2 >= kj.y - 1 && k.y + (k.w * RASIO_KARTU) / 2 <= kj.y + kj.h + 1);
    if (jadikuMuat && lebarMin('pungutan') >= target * 0.9 - 0.01 && lebarMin('kombinasi') >= target * RASIO_KOMBINASI * 0.9 - 0.01) return tengah;
  }
  if (!hasil) {
    let ukuran = ukuranAkhir(true);
    // HP potret: baris mulung sendiri tetap tidak muat walau semua sudah minimum, jadi mulung mengambil alih baris
    // tengah seperti di HP lanskap (kartu tangan juga tidak perlu mengecil).
    if (m.mulung && !mulungTengah && ukuran.sesak) {
      mulungTengah = true;
      ukuran = ukuranAkhir(true);
    }
    hasil = ukuran;
  }
  const cw = hasil.cw;
  const uk = hasil.uk;
  const ch = uk.ch;
  const t = KOSONG(d);
  t.cw = cw;
  t.susunanPanel = jumlahAtas ? susunan : null;
  const kolomPanel = susunan.kolom;
  const lebarPanel = lebarPanelUntuk(kolomPanel);

  // ---- panel lawan ----
  const kursiAtas: Sisi[] = [];
  const kiri = lawan.filter((_, i) => susunanSisi[i] === 'kiri');
  const kanan = lawan.filter((_, i) => susunanSisi[i] === 'kanan');
  // Searah jarum jam dari kursiku: sisi kiri dari bawah ke atas, sisi kanan dari atas ke bawah.
  const tumpuk = (daftar: number[], x: number, dariBawah: boolean) => {
    const celah = 6 * d;
    const h = hPanelSamping(daftar.length);
    // Panel samping yang pendek (HP lanskap): kepala diringkas jadi satu baris supaya kartu jadinya tetap
    // muat di dalam panel. Patokannya tetap (dua baris kartu jadi terkecil), jadi bentuk panel tidak
    // berganti di tengah permainan.
    // Kepala sebaris yang tidak muat nama utuh (panel tidak bisa dilebarkan lagi): info turun ke baris kedua
    // kalau tinggi panel masih cukup untuk satu baris kartu jadi terkecil (HP lanskap 740×360, 6 pemain: tiga
    // panel di satu sisi).
    let kepala: 3 | 'ringkas' | 'ringkas2' = kepalaSamping(h);
    if (kepala === 'ringkas' && lebarSamping - 16 * d < lebarKepalaSebaris(m, lawan, u, namaSamping) && bisaRingkas2(h))
      kepala = 'ringkas2';
    daftar.forEach((pi, i) => {
      const urut = dariBawah ? daftar.length - 1 - i : i;
      gambarPanel(t, m, pi, { x, y: atas + urut * (h + celah), w: lebarSamping, h }, kepala, uk.mini, u, true, pi === saya);
    });
  };
  tumpuk(kiri, pad, true);
  tumpuk(panelSaya ? [...kanan, saya] : kanan, W - pad - lebarSamping, false);
  lawan.forEach((pi, i) => {
    const sisi = susunanSisi[i];
    if (sisi === 'atas' || sisi === 'baris') kursiAtas.push({ pemain: pi, sisi, kotak: { x: 0, y: 0, w: 0, h: 0 } });
  });
  kursiAtas.forEach((k, i) => {
    const kol = i % kolomPanel;
    const br = Math.floor(i / kolomPanel);
    // Baris terakhir yang tidak penuh: panelnya dipusatkan.
    const diBaris = Math.min(kolomPanel, kursiAtas.length - br * kolomPanel);
    const geser = ((kolomPanel - diBaris) * (lebarPanel + 6 * d)) / 2;
    const kotak = { x: kx0 + geser + kol * (lebarPanel + 6 * d), y: atas + br * (uk.tinggiPanel + 6 * d), w: lebarPanel, h: uk.tinggiPanel };
    gambarPanel(t, m, k.pemain, kotak, susunan.ringkas ? (susunan.barisKepala === 2 ? 'ringkas2' : 'ringkas') : susunan.barisKepala, uk.mini, u);
  });

  // ---- kelompok bawah: tangan menempel ke bawah, di atasnya kartu jadiku, label, dan mulung ----
  const yTanganAtas = bawah - uk.tinggiTangan;
  const yJadi = yTanganAtas - uk.tinggiJadi;
  // Mulung di baris tengah (lanskap pendek): kartu jadiku pindah ke baris tengah, label turun ke atas tangan.
  // Tangan sendiri tidak bergeser sedikit pun (kartunya sedang dipilih untuk kombinasi). Panel diriku: tanpa
  // baris label (namaku di kepala panel), kartu jadiku tetap di panel.
  const jadiDiTengah = mulungTengah && !panelSaya && jumlahJadiSaya > 0;
  const yLabel = (mulungTengah ? yTanganAtas : yJadi) - hLabel;
  const yMulung = yLabel - uk.tinggiMulung;
  // Tengah (deck, buangan) di tengah ruang kosong antara panel atas dan kelompok bawah.
  const yAtasTengah = atas + uk.blokPanel;
  const ruang = yMulung - yAtasTengah - uk.tinggiTengah;
  const yTengah = yAtasTengah + Math.max(0, ruang) * 0.5;
  const yKartuTengah = yTengah + hTeks + jarakPetunjuk(uk.cwT, d);
  let kananTengah = kx0;
  if (mulungTengah) {
    // Kiri: deck & buangan ringkas, kartu jadiku ringkas di bawahnya. Kanan: pungutan + kombinasi.
    const yA = yAtasTengah + 2 * d;
    const hPita = yLabel - 4 * d - yA;
    const hLabelDeck = 7 * d + 11 * s * d * 1.25;
    // Kartu jadiku ringkas: satu baris kartu ±16 px CSS dicadangkan dulu, sisanya untuk deck & buangan.
    const hJadiMin = jadiDiTengah ? 16 * d * RASIO_KARTU + 6 * d : 0;
    // Deck & buangan ringkas juga tidak boleh mengambil lebar yang dibutuhkan kartu pungutan (selebar targetnya,
    // kombinasi di baris kedua kalau perlu): HP potret lebih sempit daripada tinggi.
    const mu = m.mulung!;
    const wTarget = targetPungutan(cw);
    const satuanK = mu.kombinasi.reduce((a, kb) => a + 0.6 * (kb.kartu.length - 1) + 1, 0);
    const perluMulung = Math.max(
      mu.sisaPungutan.length * wTarget + Math.max(0, mu.sisaPungutan.length - 1) * CELAH_PUNGUTAN * d,
      mu.kombinasi.length ? satuanK * RASIO_KOMBINASI * wTarget + (mu.kombinasi.length - 1) * CELAH_KOMBINASI * d + 4 * d : 0,
    );
    const labelDeck = kiraLebarTeks(`deck ${p.jumlahDeck}`, 11 * s * d, true) + 2 * d - 8 * d;
    const lebarRingkas = (c: number) => Math.max(c, labelDeck) + 8 * d + c * (1.42 + 0.34 * (kapasitas - 1));
    let cwR = jepit((hPita - hJadiMin - hLabelDeck) / (RASIO_KARTU * 1.05), Math.min(uk.cwT, 18 * d), uk.cwT);
    // Kartu pungutan & kombinasi (dibatasi tinggi pita juga) didahulukan daripada deck & buangan ringkas.
    const efektifMulung = (c: number) => {
      const r = rencanaMulung(mu, kx1 - kx0 - lebarRingkas(c) - 14 * d, wTarget, hPita, u);
      return Math.min(r.wP, r.wK / RASIO_KOMBINASI);
    };
    while (
      cwR > Math.min(uk.cwT, 18 * d) &&
      (kx0 + lebarRingkas(cwR) + 14 * d + perluMulung > kx1 || (mu.sisaPungutan.length + mu.kombinasi.length > 0 && efektifMulung(cwR) < wTarget - 0.5 * d))
    )
      cwR = Math.max(Math.min(uk.cwT, 18 * d), cwR * 0.95);
    // Diukur dulu (tanpa digambar), supaya isi baris ini bisa diletakkan di tengah pita kalau pitanya lega (HP potret).
    const kananTumpukan = gambarTengah(KOSONG(d), m, kx0, kx1, yA, cwR, u, { rataKiri: true, ringkas: true });
    // Lebar kolom kiri: selebar deck & buangan, atau selebar kartu jadiku (kartu 12 px CSS) kalau lebih lebar,
    // tapi tidak lebih dari 32 % kolom (sisanya untuk pungutan & kombinasi).
    const lebarJadiRingkas = !jadiDiTengah ? 0 : milikSaya.reduce((a, kj) => a + ((kj.kartu.length - 1) * 0.62 + 1) * 12 * d + 6 * d, -6 * d);
    kananTengah = Math.max(kananTumpukan, kx0 + Math.min(lebarJadiRingkas, lebarKolom * 0.32));
    const tinggiTumpukan = cwR * RASIO_KARTU + jarakLabelTengah(cwR, d) + 11 * s * d * 1.25;
    const x = kananTengah + 14 * d;
    const rencana = rencanaMulung(m.mulung!, kx1 - x, targetPungutan(cw), hPita, u);
    const kotakJadiDi = (y: number) => ({ x: kx0, y: y + tinggiTumpukan + 2 * d, w: kananTengah - kx0, h: Math.max(8 * d, yLabel - 4 * d - y - tinggiTumpukan - 2 * d) });
    const tinggiJadiTengah = jadiDiTengah ? 2 * d + susunKartuJadi(KOSONG(d), m, milikSaya, kotakJadiDi(yA), uk.miniSaya, 10 * d, 'kiri', u).tinggi : 0;
    const yIsi = yA + Math.max(0, (hPita - Math.max(rencana.tinggi, tinggiTumpukan + tinggiJadiTengah)) / 2);
    gambarTengah(t, m, kx0, kx1, yIsi, cwR, u, { rataKiri: true, ringkas: true });
    if (jadiDiTengah) {
      const kotakJadi = kotakJadiDi(yIsi);
      t.area.kartuJadiSaya = kotakJadi;
      susunKartuJadi(t, m, milikSaya, kotakJadi, uk.miniSaya, 10 * d, 'kiri', u);
    }
    gambarMulung(t, m, x, kx1, yIsi, rencana, u);
  } else {
    // Lanskap pendek: deck · info · buangan rata kiri, kartu jadiku di kanannya (sebaris).
    kananTengah = gambarTengah(t, m, kx0, jadiSamping ? kx0 + lebarTengahMaks : kx1, yKartuTengah, uk.cwT, u, { rataKiri: jadiSamping, lebarInfo });
    if (m.mulung) gambarMulung(t, m, kx0, kx1, yMulung, rencanaMulung(m.mulung, lebarKolom, targetPungutan(cw), null, u), u);
  }

  // Label diriku + giliran.
  const giliranSaya = v.status === 'susunAkhir' ? !p.selesaiSusun[saya] : p.giliran === saya && v.status === 'putaranBerjalan';
  if (!panelSaya)
    t.teks.push({
      kunci: 'saya-nama',
      x: kx0 + 2 * d,
      y: yLabel + 2 * d,
      isi: `${v.pemain[saya]?.nama ?? ''} · ${angkaSkorKanvas(v.skor[saya] ?? 0)}${giliranSaya ? '  ·  giliranmu' : ''}`,
      ukuran: 13,
      warna: giliranSaya ? 'emas' : 'redup',
      tebal: giliranSaya,
      maks: lebarKolom,
    });
  if (mulungTengah || panelSaya) {
    // Kartu jadiku sudah digambar ringkas di baris tengah, atau di panel diriku.
  } else if (jumlahJadiSaya && jadiSamping) {
    const x = kananTengah + 14 * d;
    const kotakJadi = { x, y: yKartuTengah, w: kx1 - x, h: uk.cwT * RASIO_KARTU + jarakLabelTengah(uk.cwT, d) + hTeks };
    t.area.kartuJadiSaya = kotakJadi;
    susunKartuJadi(t, m, milikSaya, kotakJadi, uk.miniSaya, 14 * d, 'bungkus', u);
  } else if (jumlahJadiSaya && !jadiSamping) {
    const kotakJadi = { x: kx0, y: yJadi + 2 * d, w: lebarKolom, h: uk.tinggiJadi - 4 * d };
    t.area.kartuJadiSaya = kotakJadi;
    susunKartuJadi(t, m, milikSaya, kotakJadi, uk.miniSaya, 18 * d, 'kiri', u);
  }

  // ---- tangan ----
  // Kipas disempitkan sebesar proyeksi miring + geser bayangan, supaya tepinya tetap di dalam area tangan.
  const st = sampingTangan(cw, d);
  gambarTangan(t, m, kx0 + st.kiri, lebarKolom - st.kiri - st.kanan, yTanganAtas + ruangSorotTangan(cw, d), cw, ch, uk.angkat, uk.tt);
  const kotakTangan = { x: kx0, y: yTanganAtas, w: lebarKolom, h: bawah - yTanganAtas };
  t.area.tangan = kotakTangan;

  // Sorotan giliran: panel lawan yang sedang jalan, atau area tanganku.
  if (v.status === 'putaranBerjalan') {
    if (p.giliran === saya) t.sorotGiliran = { kotak: { x: kx0 - 4 * d, y: yLabel - 2 * d, w: lebarKolom + 8 * d, h: bawah - yLabel + 2 * d }, saya: true };
    else {
      const k = t.area.panel.get(p.giliran);
      if (k) t.sorotGiliran = { kotak: k, saya: false };
    }
  } else if (v.status === 'susunAkhir' && !p.selesaiSusun[saya]) {
    t.sorotGiliran = { kotak: { x: kx0 - 4 * d, y: yLabel - 2 * d, w: lebarKolom + 8 * d, h: bawah - yLabel + 2 * d }, saya: true };
  }
  return t;
}

// ------------------------------------------------------------------------------------------------

/**
 * Perkiraan lebar teks (piksel perangkat) untuk MEMBAGI ruang antar-teks di satu baris. Pemotongan
 * sebenarnya tetap diukur scene (pasTeks), jadi perkiraan ini sengaja sedikit lebih lebar.
 */
export function kiraLebarTeks(isi: string, ukuranPx: number, tebal = false): number {
  let em = 0;
  for (const c of isi) em += /[\s.,:;!|·'’()\-]/.test(c) ? 0.32 : /[A-Z]/.test(c) ? 0.68 : /\p{Extended_Pictographic}/u.test(c) ? 1.15 : c === '→' ? 0.9 : 0.55;
  return em * ukuranPx * (tebal ? 1.08 : 1);
}

/** Lebar dasar kolom info di tengah (arah, giliran, putaran), piksel perangkat. */
function lebarInfoTengah(u: UkuranLayar): number {
  return 104 * u.d * Math.min(u.skalaTeks, 1.25);
}

/** Lebar kolom info yang membuat 'Giliran <nama>' utuh untuk semua lawan di meja (giliranku: 'Giliranmu'). */
function lebarInfoGiliran(m: ModelTata, u: UkuranLayar): number {
  const px = 12 * u.skalaTeks * u.d;
  const saya = m.view.saya ?? 0;
  const isi = m.view.pemain.map((p, i) => (i === saya ? 'Giliranmu' : `Giliran ${p.nama}`));
  return Math.max(0, ...isi.map((x) => kiraLebarTeks(x, px, true))) + 2 * u.d;
}

/**
 * Lebar nama lawan terpanjang di meja dan info patokan panel ringkas (INFO_PATOKAN, dengan ikon kartu), piksel
 * perangkat, masing-masing termasuk 2 px sisa. Meja campuran (ada manusia & warga kedai): penanda ☕ ikut
 * dihitung, karena di sana penanda itu membedakan kursi dan tidak mengalah. `namaTambahan`: kursi lain yang namanya ikut
 * diukur (panel diriku), tanpa ikut menentukan meja campuran.
 */
function ukurKepalaRingkas(m: ModelTata, lawan: readonly number[], u: UkuranLayar, namaTambahan: readonly number[] = []): { nama: number; info: number } {
  const { d } = u;
  const s = u.skalaTeks;
  const nama = Math.max(0, ...[...lawan, ...namaTambahan].map((pi) => kiraLebarTeks(m.view.pemain[pi]?.nama ?? '', 13 * s * d, true)));
  const kursi = lawan.map((pi) => m.info.kursi[pi]);
  const campur = kursi.some((k) => k?.jenis === 'bot') && kursi.some((k) => k && k.jenis !== 'bot');
  const px = UKURAN_INFO_RINGKAS * s * d;
  const tanda = campur ? kiraLebarTeks(` · ${PENANDA_WARGA_KEDAI.ikon}`, px) : 0;
  const info = Math.max(kiraLebarTeks(INFO_PATOKAN.biasa, px), kiraLebarTeks(INFO_PATOKAN.bahaya, px, true)) + lebarIkonKartu(px) + tanda;
  return { nama: nama + 2 * d, info: info + 2 * d };
}

/** Lebar isi kepala ringkas sebaris (nama utuh · info patokan), piksel perangkat. */
function lebarKepalaSebaris(m: ModelTata, lawan: readonly number[], u: UkuranLayar, namaTambahan: readonly number[] = []): number {
  const k = ukurKepalaRingkas(m, lawan, u, namaTambahan);
  return k.nama + CELAH_KEPALA * u.d + k.info;
}

/**
 * Inisial nama: "Kipas Dua" → "KD", "Koki-Kun" → "KK", "Bot 1" → "B1", "Budi Santoso" → "BS". Maks 3 huruf.
 * Nama satu kata: dua huruf pertamanya ("Jurik" → "JU"), asal keduanya huruf/angka (bukan emoji); selain itu null.
 */
export function inisialNama(nama: string): string | null {
  const kata = nama.trim().split(/[\s-]+/).filter(Boolean);
  if (kata.length === 1) {
    const awal = [...kata[0]].slice(0, 2).join('');
    return /^[\p{L}\p{N}]{2}$/u.test(awal) ? awal.toUpperCase() : null;
  }
  if (kata.length < 2) return null;
  return kata
    .slice(0, 3)
    .map((k) => [...k][0])
    .join('')
    .toUpperCase();
}

/**
 * Jumlah huruf minimal kalau `nama` dipotong ('Jura…'): huruf pertama yang membedakannya dari tiap nama lain
 * di meja (tanpa beda huruf besar/kecil) harus ikut tampil, supaya potongannya tidak bisa dibaca sebagai
 * nama lain. Minimal 3. Lebih dari panjang nama = memotong tidak bisa membedakan ("Juri" vs "Jurik").
 */
function hurufPembeda(nama: string, namaLain: readonly string[]): number {
  let n = 3;
  for (const lain of namaLain) {
    let i = 0;
    while (i < nama.length && i < lain.length && nama[i].toLowerCase() === lain[i].toLowerCase()) i++;
    // Spasi di ujung potongan dibuang scene ('Pak …' → 'Pak…'), jadi huruf sesudahnya ikut dihitung.
    n = Math.max(n, i + (/\s/.test(nama[i] ?? '') ? 2 : 1));
  }
  return n;
}

/**
 * Label nama di tempat sempit (mis. di bawah kartu buangan): nama lengkap kalau muat, lalu inisial,
 * lalu nama terpotong; selain itu null (label disembunyikan, bukan "B…"). `namaLain` = nama pemain lain
 * di meja, supaya label tidak tertukar: inisial hanya dipakai kalau tidak kembar dengan inisial atau nama
 * orang lain ("Pak Seng" & "Pak Sule" sama-sama "PS", "Jurik" & "Juragan" sama-sama "JU"), dan potongan
 * minimal 3 huruf, lebih panjang kalau awal namanya sama ("Juri…" & "Jura…", bukan "Jur…"). `minHuruf`
 * juga berlaku kalau nama lengkap ternyata tidak muat saat diukur scene.
 */
export function labelSempit(
  nama: string,
  lebar: number,
  ukuranPx: number,
  namaLain: readonly string[] = [],
): { isi: string; minHuruf: number } | null {
  if (!nama || lebar <= 0) return null;
  const minHuruf = hurufPembeda(nama, namaLain);
  if (kiraLebarTeks(nama, ukuranPx) <= lebar) return { isi: nama, minHuruf };
  const ini = inisialNama(nama);
  const kembar = (x: string | null) => !!x && x.toLowerCase() === ini?.toLowerCase();
  if (ini && kiraLebarTeks(ini, ukuranPx) <= lebar && !namaLain.some((n) => kembar(n) || kembar(inisialNama(n)))) {
    return { isi: ini, minHuruf: ini.length };
  }
  if (minHuruf <= nama.length && kiraLebarTeks(`${nama.slice(0, minHuruf).trimEnd()}…`, ukuranPx) <= lebar) return { isi: nama, minHuruf };
  return null;
}

/**
 * Panel satu lawan. `barisKepala`: 1 = nama · aksi · info dalam satu baris (panel lebar),
 * 2 = nama + aksi lalu info (panel sempit), 3 = nama, info, aksi bertumpuk (panel samping),
 * 'ringkas' = nama · info sebaris, aksi terakhir di sisa baris kartu jadi (panel yang sesak),
 * 'ringkas2' = seperti 'ringkas', tapi info di baris kedua (panel terlalu sempit untuk nama utuh + info).
 * Info (jumlah kartu · skor) selalu kebagian tempat; sisanya untuk nama (utuh kalau muat), baru status
 * (☕/terputus/selesai) dan aksi terakhir.
 */
function gambarPanel(
  t: TataMeja,
  m: ModelTata,
  pi: number,
  kotak: Kotak,
  barisKepala: 1 | 2 | 3 | 'ringkas' | 'ringkas2',
  mini: number,
  u: UkuranLayar,
  samping = false,
  diriku = false,
) {
  const { d } = u;
  const s = u.skalaTeks;
  const v = m.view;
  const p = v.putaran!;
  const k = m.info.kursi[pi];
  const susun = v.status === 'susunAkhir';
  const aktif = susun ? !p.selesaiSusun[pi] : p.giliran === pi && v.status === 'putaranBerjalan';
  const jumlah = p.jumlahKartuTangan[pi] ?? 0;
  const bahaya = jumlah === 1 && v.status === 'putaranBerjalan';
  t.hias.push({ jenis: 'panel', kotak, aktif, bahaya });
  if (bahaya) t.hias.push({ jenis: 'denyutMerah', kotak });
  // Panel diriku (lanskap sangat pendek): bukan panel lawan (area.panel/titik.panel hanya untuk lawan; kartu
  // yang terbang ke/dari aku tetap memakai tangan), kotaknya jadi area kartu jadiku.
  if (diriku) {
    if (p.kartuJadi[pi]?.length) t.area.kartuJadiSaya = kotak;
  } else t.area.panel.set(pi, kotak);
  const x = kotak.x + 8 * d;
  const y = kotak.y + (barisKepala === 'ringkas2' ? RINGKAS2.atas : 5) * d;
  const hBaris = 16 * s * d;
  const lebarIsi = kotak.w - 16 * d;
  const celah = CELAH_KEPALA * d;
  const namaPemain = v.pemain[pi]?.nama ?? '';
  const px = (ukuran: number) => ukuran * s * d;
  const ringkas = barisKepala === 'ringkas' || barisKepala === 'ringkas2';
  const sebaris = barisKepala === 1 || barisKepala === 'ringkas';
  // Kepala ringkas: teks info sedikit lebih kecil (sebaris: nama kebagian tempat; dua baris: kepala lebih pendek).
  const ukuranInfo = ringkas ? UKURAN_INFO_RINGKAS : 12;
  // Panel ringkas: jumlah kartu memakai ikon kartu, bukan kata "kartu" (lihat infoRingkas).
  const lebarTeksInfo = (isi: string) => kiraLebarTeks(isi, px(ukuranInfo), bahaya) + (ringkas ? lebarIkonKartu(px(ukuranInfo)) : 0) + 2 * d;
  const lebarNama = kiraLebarTeks(namaPemain, px(13), true) + 2 * d;
  // Jumlah kartu & skor di depan: kalau terpotong, yang hilang status di ekornya.
  const skor = v.skor[pi] ?? 0;
  const penting = ringkas ? infoRingkas(jumlah, skor, bahaya) : `${bahaya ? 'TINGGAL 1!' : `${jumlah} kartu`} · ${angkaSkorKanvas(skor)}`;
  const selesai = susun && p.selesaiSusun[pi] ? ' · selesai' : '';
  // Penanda warga kedai (☕). Kalau semua lawan warga kedai (mis. main offline), penanda itu tidak
  // membedakan apa-apa: di kepala sebaris yang sempit ia mengalah supaya nama tidak terpotong.
  let penanda = k?.jenis === 'bot' ? ` · ${PENANDA_WARGA_KEDAI.ikon}` : '';
  if (penanda && sebaris) {
    const semuaWarga = m.info.kursi.every((kk, i) => i === v.saya || kk.jenis === 'bot');
    if (semuaWarga && lebarNama + celah + lebarTeksInfo(`${penting}${penanda}${selesai}`) > lebarIsi) penanda = '';
  }
  const status = (penanda || (k && k.jenis !== 'bot' && !k.terhubung ? ' · terputus' : '')) + selesai;
  const kanan = `${penting}${status}`;
  const aksi = m.aksiTerakhir[pi] ?? (m.info.botMikir === pi ? 'lagi mikir…' : undefined);
  // Aksi terakhir (sebentar, mis. "ambil deck") atau penanda pengocok.
  const tag = aksi ?? (pi === p.pengocok ? 'pengocok' : '');
  const teksInfo = (x: number, y: number, ox: number, maks: number): TeksTata => ({
    kunci: `p${pi}-info`, x, y, isi: kanan, ukuran: ukuranInfo, warna: bahaya ? 'bahaya' : 'redup', tebal: bahaya, ox, maks,
    ikon: ringkas ? 'kartu' : undefined,
  });
  const teksTag = (x: number, y: number, ox: number, maks: number, oy = 0): TeksTata => ({
    // Aksi terakhir ditampilkan apa adanya dan dipotong di ujung oleh scene (netral: tidak ada bagian yang
    // didahulukan; teks "buang X" masih menunggu keputusan pemilik #29). Jumlah kartu & skor ada di teks
    // info tersendiri yang selalu kebagian tempat, jadi tidak ikut terpotong.
    kunci: `p${pi}-aksi`, x, y, isi: tag, ukuran: 12, warna: aksi ? 'emas' : 'samar', tebal: !!aksi, ox, oy, maks, minHuruf: 3,
  });
  const nama = (maks: number): TeksTata => ({ kunci: `p${pi}-nama`, x, y, isi: namaPemain, ukuran: 13, warna: aktif ? 'emas' : 'teks', tebal: true, maks });
  /**
   * Lebar info sebaris dengan nama: selebar teksnya (paling banyak 82 % baris), sisanya untuk nama. Status
   * (☕ di meja campuran, terputus, selesai) ikut utuh supaya tidak terbaca '6 kartu · 0 · …'; ☕ yang tidak
   * membedakan apa-apa sudah mengalah di atas.
   */
  const lebarInfoSebaris = () => Math.min(lebarTeksInfo(kanan), lebarIsi * 0.82);
  const minTag = kiraLebarTeks('abc…', px(12), true);
  if (barisKepala === 1) {
    // Info rata kanan; sisanya untuk nama (utuh kalau muat), lalu aksi terakhir.
    const wInfo = lebarInfoSebaris();
    const sisa = lebarIsi - wInfo - celah;
    t.teks.push(teksInfo(kotak.x + kotak.w - 8 * d, y, 1, wInfo));
    if (tag) {
      const wNama = Math.min(lebarNama, sisa);
      const wTag = sisa - wNama - celah;
      t.teks.push(nama(wNama));
      if (wTag >= minTag) t.teks.push(teksTag(x + wNama + celah, y, 0, wTag));
    } else t.teks.push(nama(sisa));
  } else if (barisKepala === 'ringkas') {
    const wInfo = lebarInfoSebaris();
    t.teks.push(nama(lebarIsi - wInfo - celah), teksInfo(kotak.x + kotak.w - 8 * d, y, 1, wInfo));
  } else if (barisKepala === 'ringkas2') {
    t.teks.push(nama(lebarIsi), teksInfo(x, y + px(RINGKAS2.barisNama), 0, lebarIsi));
  } else if (barisKepala === 2) {
    // Nama utuh didahulukan; aksi terakhir di sisa baris (disembunyikan kalau kurang dari 3 huruf).
    const wNama = tag ? Math.max(lebarIsi * 0.5, Math.min(lebarNama, lebarIsi - celah - minTag)) : lebarIsi;
    t.teks.push(nama(wNama), teksInfo(x, y + hBaris, 0, lebarIsi));
    const wTag = lebarIsi - wNama - celah;
    if (tag && wTag >= minTag) t.teks.push(teksTag(kotak.x + kotak.w - 8 * d, y, 1, wTag));
  } else {
    t.teks.push(nama(lebarIsi), teksInfo(x, y + hBaris, 0, lebarIsi));
    if (tag) t.teks.push(teksTag(x, y + hBaris * 2, 0, lebarIsi));
  }
  const yIsi = kotak.y + tinggiAtasKartuPanel(barisKepala, s, d);
  // Tujuan kartu yang terbang ke/dari pemain ini.
  if (!diriku) t.titik.panel.set(pi, { x: kotak.x + Math.min(kotak.w / 2, 46 * d), y: Math.min(kotak.y + kotak.h / 2, yIsi + (mini * RASIO_KARTU) / 2), w: mini });
  // Kartu jadi (dan tangan yang dibuka setelah putaran selesai).
  const daftar = p.kartuJadi[pi] ?? [];
  // Tanganku sendiri sudah tampil di area tangan (tidak digandakan di panel diriku).
  const tanganTerbuka = diriku ? undefined : p.tangan[pi];
  const tampil: KartuJadi[] =
    tanganTerbuka && tanganTerbuka.length && v.status !== 'putaranBerjalan' && !susun
      ? [...daftar, { id: 'tangan', pemilik: pi, jenis: 'seri', kartu: tanganTerbuka.map((kt) => ({ kartu: kt, sebagai: kt, pengganti: false })) }]
      : daftar;
  const isi = { x, y: yIsi, w: kotak.w - 16 * d, h: kotak.y + kotak.h - yIsi - bawahPanel(barisKepala) * d };
  // Panel samping (tinggi, sempit): kelompok kartu jadi dibungkus ke baris berikut.
  const terpakai = tampil.length ? susunKartuJadi(t, m, tampil, isi, mini, (ringkas ? 12 : 16) * d, samping ? 'bungkus' : 'kiri', u) : null;
  if (ringkas && tag) {
    // Aksi terakhir di sisa baris kartu jadi (kanan); tidak muat ≥ 3 huruf = tidak ditampilkan.
    const xTag = terpakai ? x + terpakai.lebar + celah : x;
    const wTag = isi.x + isi.w - xTag;
    const yTengahBaris = yIsi + Math.min(isi.h, terpakai?.tinggi ?? mini * RASIO_KARTU) / 2;
    if (wTag >= minTag) t.teks.push(teksTag(terpakai ? isi.x + isi.w : xTag, yTengahBaris, terpakai ? 1 : 0, wTag, 0.5));
  } else if (!terpakai) t.teks.push({ kunci: `p${pi}-kosong`, x, y: yIsi + 2 * d, isi: 'belum ada kartu jadi', ukuran: 11, warna: 'samar', maks: isi.w });
}

/** Label kecil di kartu jadi: joker pengganti ('→rank', dari view) atau jejak "kartumu di meja lawan" (KartuDiMeja.dari). */
function labelKartuJadi(dk: KartuJadi['kartu'][number], kj: KartuJadi, saya: number): KartuTata['label'] {
  if (dk.pengganti) return { isi: `→${namaRank(dk.sebagai.rank)}`, gaya: 'emas', posisi: 'tengah' };
  if (dk.dari !== undefined && dk.dari === saya && kj.pemilik !== saya) return { isi: 'kamu', gaya: 'info', posisi: 'bawah' };
  return undefined;
}

/** Ukuran huruf label kecil di kartu selebar w (piksel perangkat). Satu sumber untuk MejaScene.aturLabel. */
export const ukuranLabelKartu = (w: number, d: number): number => Math.max(9 * d, Math.min(13 * d, w / 3.6));
/** Jarak isi label ke tepi latarnya, kiri & kanan (px CSS). */
export const PAD_LABEL_KARTU = 2;
/**
 * Letak label di kartu (× lebar & tinggi kartu dari titik tengahnya) dan titik acuannya (ox): 'tengah' = mulai
 * dari dekat tepi kiri kartu (bagian yang terlihat walau kartu di kanannya menumpuk), 'bawah' = di tepi bawah.
 */
export const LETAK_LABEL_KARTU = { tengah: { dx: -0.44, dy: 0.12, ox: 0 }, bawah: { dx: -0.19, dy: 0.5, ox: 0.5 } } as const;

/** Perkiraan kotak label di kartu selebar w bertitik tengah (x, y), piksel perangkat (sengaja sedikit lebih lebar). */
export function kotakLabelKartu(x: number, y: number, w: number, label: NonNullable<KartuTata['label']>, d: number): Kotak {
  const px = ukuranLabelKartu(w, d);
  const lebar = kiraLebarTeks(label.isi, px, true) + 2 * Math.round(PAD_LABEL_KARTU * d);
  const tinggi = px * 1.25;
  const l = LETAK_LABEL_KARTU[label.posisi];
  return { x: x + l.dx * w - l.ox * lebar, y: y + l.dy * w * RASIO_KARTU - tinggi / 2, w: lebar, h: tinggi };
}

/**
 * Susun kartu jadi (kelompok-kelompok kartu bertumpuk 62%) di dalam kotak. Mengembalikan lebar & tinggi terpakai.
 * 'kiri': satu baris, dikecilkan sampai muat (boleh dua baris kalau terlalu kecil).
 * 'bungkus': kelompok dibungkus ke baris berikutnya (panel samping yang tinggi).
 */
function susunKartuJadi(
  t: TataMeja,
  m: ModelTata,
  daftar: KartuJadi[],
  kotak: Kotak,
  wMaks: number,
  wMin: number,
  mode: 'kiri' | 'bungkus',
  u: UkuranLayar,
): { lebar: number; tinggi: number } {
  const { d } = u;
  const celah = 6 * d;
  const saya = m.view.saya ?? 0;
  // Label kartu terakhir sebuah kelompok yang menjorok keluar kanan kartunya (mis. '→10' di kartu 12 px) ikut
  // dihitung lebar kelompok: kelompok berikutnya (dan aksi terakhir di panel ringkas) tidak tertimpa label itu.
  const lebarKelompok = (kj: KartuJadi, w: number) => {
    const akhir = kj.kartu[kj.kartu.length - 1];
    const label = akhir ? labelKartuJadi(akhir, kj, saya) : undefined;
    const kl = label ? kotakLabelKartu(0, 0, w, label, d) : undefined;
    const lebih = kl ? Math.max(0, kl.x + kl.w - w / 2) : 0;
    return (kj.kartu.length - 1) * w * 0.62 + w + lebih;
  };
  const tata = (w: number) => {
    const pos: { kj: KartuJadi; x: number; y: number }[] = [];
    let x = kotak.x;
    let y = kotak.y;
    let barisKe = 0;
    for (const kj of daftar) {
      const lw = lebarKelompok(kj, w);
      if (x > kotak.x && x + lw > kotak.x + kotak.w) {
        x = kotak.x;
        y += w * RASIO_KARTU + 4 * d;
        barisKe++;
      }
      pos.push({ kj, x, y });
      x += lw + celah;
    }
    const tinggi = (barisKe + 1) * (w * RASIO_KARTU + 4 * d);
    const lebarMaks = Math.max(...pos.map((q) => q.x + lebarKelompok(q.kj, w))) - kotak.x;
    return { pos, tinggi, barisKe, lebarMaks };
  };
  let w = wMaks;
  let h = tata(w);
  const batasBaris = mode === 'bungkus' ? 99 : Math.max(1, Math.floor((kotak.h + 4 * d) / (wMin * RASIO_KARTU + 4 * d)));
  // Tinggi terpakai tanpa jarak di bawah baris terakhir (kotak setinggi satu baris kartu wMaks muat tanpa dikecilkan).
  while (w > wMin && (h.tinggi - 4 * d > kotak.h + 0.5 || h.barisKe + 1 > batasBaris || h.lebarMaks > kotak.w)) {
    w = Math.max(wMin, w * 0.93);
    h = tata(w);
  }
  const hk = w * RASIO_KARTU;
  for (const { kj, x, y } of h.pos) {
    kj.kartu.forEach((dk, i) => {
      const id = dk.kartu.id;
      const cx = x + i * w * 0.62 + w / 2;
      const cy = y + hk / 2;
      t.titik.kartu.set(id, { x: cx, y: cy, w });
      if (m.disembunyikan.has(id)) return;
      const label = labelKartuJadi(dk, kj, saya);
      t.kartu.push({ kunci: `j:${id}`, peran: 'jadi', kartu: dk.kartu, x: cx, y: cy, w, sudut: 0, lapis: LAPIS.jadi + i * 0.01, alpha: 1, tinggi: 0, label });
    });
  }
  return { lebar: h.lebarMaks, tinggi: h.tinggi - 4 * d };
}

/**
 * Deck, info, dan buangan. `rataKiri`: kelompok menempel ke kiri kolom (kartu jadiku di kanannya);
 * `batasTeks`: tepi kanan petunjuk di atas buangan. `lebarInfo`: lebar kolom info (bawaan lebarInfoTengah;
 * hitungTataMeja melebarkannya kalau ada ruang). `ringkas`: selama menyusun mulung di HP lanskap,
 * hanya deck & buangan (rapat, tanpa kolom info, nama pembuang, dan petunjuk) supaya baris tengah lega
 * untuk pungutan & kombinasi. Mengembalikan tepi kanan kelompok (piksel perangkat).
 */
function gambarTengah(
  t: TataMeja,
  m: ModelTata,
  kx0: number,
  kx1: number,
  y: number,
  cwT: number,
  u: UkuranLayar,
  opsi: { rataKiri?: boolean; batasTeks?: number; ringkas?: boolean; lebarInfo?: number } = {},
): number {
  const { d } = u;
  const s = u.skalaTeks;
  const v = m.view;
  const p = v.putaran!;
  const n = v.pemain.length;
  const chT = cwT * RASIO_KARTU;
  const kapasitas = Math.max(1, n - 1);
  const ringkas = !!opsi.ringkas;
  const lebarInfo = ringkas ? 0 : (opsi.lebarInfo ?? lebarInfoTengah(u));
  const celah = (ringkas ? 8 : 14) * d;
  const lebarKolom = kx1 - kx0;
  // Lebar kelompok buangan dipesan untuk kapasitas penuh supaya letaknya tidak bergeser.
  // Ringkas (menyusun mulung di HP lanskap): tetap bertumpuk rapat, tapi pojok indeks tiap kartu masih terbaca.
  let langkah = cwT * (ringkas ? 0.34 : 0.62);
  const geserLebih = cwT * (ringkas ? 0.42 : 0.5);
  const lebarBuangan = (k: number) => cwT + langkah * (k - 1) + geserLebih;
  // Kolom deck selebar kartu, atau selebar label terpanjangnya ('ketuk = ambil') kalau kartunya kecil,
  // supaya label tidak terpotong tepi layar dan tidak menimpa kolom info.
  // Label boleh menjorok separuh celah ke kiri (margin kolom) dan ke kanan (celah ke kolom info).
  const kolomDeck = Math.max(cwT, kiraLebarTeks(ringkas ? `deck ${p.jumlahDeck}` : 'ketuk = ambil', 11 * s * d, true) + 2 * d - celah);
  const sisa = lebarKolom - (kolomDeck + celah + lebarInfo + celah);
  if (!ringkas && lebarBuangan(kapasitas) > sisa) langkah = Math.max(cwT * LANGKAH_BUANGAN_MIN, (sisa - cwT * 1.5) / Math.max(1, kapasitas - 1));
  const lebarKelompok = kolomDeck + celah + (ringkas ? 0 : lebarInfo + celah) + lebarBuangan(kapasitas);
  const x0 = opsi.rataKiri ? kx0 : kx0 + Math.max(0, (lebarKolom - lebarKelompok) / 2);
  const batasTeks = opsi.batasTeks ?? kx1;
  const hTeks = 16 * s * d;

  // ---- deck: tebal tumpukan mengikuti sisa kartu ----
  const dx = x0 + kolomDeck / 2;
  const xDeck = dx - cwT / 2;
  const dy = y + chT / 2;
  const bisaAmbil = v.status === 'putaranBerjalan' && p.giliran === v.saya && p.tahap === 'ambil' && !m.mulung;
  t.titik.deck = { x: dx, y: dy, w: cwT };
  t.area.deck = { x: xDeck, y, w: cwT, h: chT };
  if (p.jumlahDeck > 0) {
    const lapis = jepit(Math.ceil(p.jumlahDeck / 7), 1, 6);
    for (let i = 0; i < lapis; i++) {
      const atasSendiri = i === lapis - 1;
      const geser = (lapis - 1 - i) * 1.3 * d;
      t.kartu.push({
        kunci: `deck:${i}`,
        peran: 'deck',
        kartu: null,
        x: dx + geser * 0.5,
        y: dy + geser,
        w: cwT,
        sudut: 0,
        lapis: LAPIS.deck + i * 0.01,
        alpha: 1,
        tinggi: atasSendiri ? 0.12 : 0,
        sorot: atasSendiri && bisaAmbil ? (m.fokus === 'deck' ? 'fokus' : 'bisa') : atasSendiri && m.fokus === 'deck' ? 'fokus' : undefined,
        ketuk: atasSendiri && bisaAmbil ? { jenis: 'deck' } : undefined,
      });
    }
  } else {
    t.hias.push({ jenis: 'slot', kotak: { x: xDeck, y, w: cwT, h: chT } });
    if (m.fokus === 'deck') t.hias.push({ jenis: 'fokus', kotak: { x: xDeck, y, w: cwT, h: chT } });
  }
  // Label di bawah tumpukan: diturunkan setebal tumpukan + bayangan supaya tidak tertimpa.
  const yLabelBawah = y + chT + jarakLabelTengah(cwT, d);
  t.teks.push({
    kunci: 'deck-label',
    x: dx,
    y: yLabelBawah,
    isi: bisaAmbil ? 'ketuk = ambil' : `deck ${p.jumlahDeck}`,
    ukuran: 11,
    warna: bisaAmbil ? 'emas' : 'redup',
    tebal: bisaAmbil,
    ox: 0.5,
  });

  // ---- info: arah, giliran, putaran (tanpa angka joker: hanya diumumkan sekali lewat popup) ----
  const tx = x0 + kolomDeck + celah;
  const nama = v.pemain[p.giliran]?.nama ?? '';
  // Ringkas (menyusun mulung di HP lanskap): kolom info disembunyikan sementara; giliran sudah pasti
  // giliranku, dan label diriku tetap menulis 'giliranmu'.
  if (!ringkas) t.teks.push({ kunci: 'arah', x: tx, y: y + 2 * d, isi: p.arah === 1 ? '↻ searah' : '↺ berbalik', ukuran: 12, warna: 'redup', maks: lebarInfo });
  if (ringkas) {
    // (tanpa kolom info)
  } else if (v.status === 'susunAkhir') {
    t.teks.push({ kunci: 'giliran', x: tx, y: y + 2 * d + hTeks, isi: p.mentung ? 'Mentung!' : 'Deck habis', ukuran: 12, warna: 'emas', tebal: true, maks: lebarInfo });
    t.teks.push({ kunci: 'putaran', x: tx, y: y + 2 * d + hTeks * 2, isi: 'Susun akhir', ukuran: 11, warna: 'emas', maks: lebarInfo });
  } else {
    if (v.status === 'putaranBerjalan') {
      // Kolom sempit: nama saja (panel pemain yang jalan sudah disorot), supaya namanya tidak terpotong.
      // Lebar sebenarnya diukur scene: 'Giliran <nama>' dipakai selama muat.
      const saya = p.giliran === v.saya;
      t.teks.push({ kunci: 'giliran', x: tx, y: y + 2 * d + hTeks, isi: saya ? 'Giliranmu' : `Giliran ${nama}`, cadangan: saya ? undefined : nama, ukuran: 12, warna: saya ? 'emas' : 'teks', tebal: true, maks: lebarInfo });
    }
    t.teks.push({ kunci: 'putaran', x: tx, y: y + 2 * d + hTeks * 2, isi: `Putaran ${p.nomor}`, ukuran: 11, warna: 'samar', maks: lebarInfo });
  }

  // ---- buangan: (n − 1) kartu teratas, bertumpuk alami tapi tetap terbaca ----
  const bx = ringkas ? tx : tx + lebarInfo + celah;
  const tampil = p.buangan.slice(-kapasitas);
  const lebih = p.jumlahBuangan - tampil.length;
  const maks = maksimalMulung(n, p.buangan.length);
  let cx = bx + cwT / 2;
  /** Tepi kiri paling kiri nama pembuang kartu pertama ('+N' di bawah tumpukan ada di kirinya). */
  let batasNamaPertama = -Infinity;
  if (lebih > 0) {
    const wLebih = cwT * 0.86;
    t.kartu.push({ kunci: 'lebih', peran: 'lebih', kartu: null, x: cx, y: y + chT / 2 + 2 * d, w: wLebih, sudut: -3, lapis: LAPIS.buangan - 0.5, alpha: 0.55, tinggi: 0 });
    // '+N' di bagian kartu 'lebih' yang tidak tertutup kartu buangan pertama (di atas kartu itu, di bawah
    // buangan). Tidak muat (tumpukan ringkas): di bawah tumpukan, sebaris dengan label deck.
    const isi = `+${lebih}`;
    const kiriLebih = cx - wLebih / 2;
    // Bagian yang terlihat dikurangi kemiringan (±3°) & geser acak (±1 px) kartu buangan pertama.
    const terlihat = cx + geserLebih - cwT / 2 - kiriLebih - cwT * 0.045 - d;
    if (kiraLebarTeks(isi, 12 * s * d, true) + 2 * d <= terlihat) {
      t.teks.push({ kunci: 'lebih-label', x: kiriLebih + terlihat / 2, y: y + chT / 2, isi, ukuran: 12, warna: 'teks', tebal: true, ox: 0.5, oy: 0.5, lapis: LAPIS.buangan - 0.25 });
    } else {
      // Di bawah tumpukan, sebaris dengan nama pembuang: jangan menempel ke nama pembuang kartu pertama
      // ('+9OG'). Geser ke kiri sampai separuh celah ke kolom info; kalau masih kurang, nama itu yang mundur.
      const wPlus = kiraLebarTeks(isi, 11 * s * d, true);
      const kiriNama = cx + geserLebih - cwT / 2; // tepi kiri nama pembuang pertama (sebelum geser acak ±1 px)
      const xPlus = Math.min(kiriLebih, Math.max(bx - (ringkas ? 0 : celah / 2), kiriNama - JARAK_PLUS * d - wPlus));
      batasNamaPertama = xPlus + wPlus + JARAK_PLUS * d;
      t.teks.push({ kunci: 'lebih-label', x: xPlus, y: y + chT + jarakLabelTengah(cwT, d), isi, ukuran: 11, warna: 'redup', tebal: true });
    }
    cx += geserLebih;
  }
  const fokusBuangan = m.fokus === 'buangan';
  if (!p.buangan.length) {
    t.hias.push({ jenis: 'slot', kotak: { x: bx, y, w: cwT, h: chT } });
    if (fokusBuangan) t.hias.push({ jenis: 'fokus', kotak: { x: bx, y, w: cwT, h: chT } });
    t.teks.push({ kunci: 'buangan-kosong', x: bx + cwT / 2, y: y + chT / 2, isi: cwT / d >= 64 ? 'buangan\nkosong' : 'kosong', ukuran: 11, warna: 'samar', ox: 0.5, oy: 0.5 });
  }
  const bisaMungut = m.pilihJumlahMulung || m.bisaPungut;
  tampil.forEach((e, i) => {
    const dariAtas = tampil.length - i; // 1 = teratas
    const r1 = acakId(e.kartu.id, 1);
    const r2 = acakId(e.kartu.id, 2);
    const kx = cx + i * langkah + (r1 - 0.5) * 2 * d;
    const ky = y + chT / 2 + (r2 - 0.5) * 3 * d;
    const sudut = (r1 - 0.5) * 6; // ±3°: alami, indeks tetap terbaca
    t.titik.kartu.set(e.kartu.id, { x: kx, y: ky, w: cwT, sudut });
    const bisa = bisaMungut && dariAtas <= maks;
    const dipungut = !!m.mulung && dariAtas <= m.mulung.jumlah;
    if (!m.disembunyikan.has(e.kartu.id)) {
      t.kartu.push({
        kunci: `b:${e.kartu.id}`,
        peran: 'buangan',
        kartu: e.kartu,
        x: kx,
        y: ky,
        w: cwT,
        sudut,
        lapis: LAPIS.buangan + i * 0.01,
        alpha: dipungut ? 0.35 : 1,
        tinggi: 0.08,
        // Fokus keyboard 'buangan' ditandai di kartu teratas (menang atas tanda 'bisa').
        sorot: fokusBuangan && dariAtas === 1 ? 'fokus' : bisa ? 'bisa' : undefined,
        ketuk: bisa ? { jenis: 'buangan', jumlah: dariAtas } : undefined,
      });
    }
    // Nama pembuang di bawah kartu, selebar bagian kartu yang terlihat. Tidak muat: inisial ("Pak Seng" → "PS"),
    // atau dipotong asal masih ≥ 3 huruf, dan tidak boleh kembar dengan label pemain lain di meja ("Jurik" &
    // "Juragan" jadi "Juri…" & "Jura…"); kalau itu pun tidak muat, labelnya disembunyikan (bukan "B…").
    // Nama pertama mundur ke kanan kalau '+N' di bawah tumpukan butuh tempat (lebarnya berkurang sebanyak itu).
    const xLabel = Math.max(kx - cwT / 2 + 1 * d, i === 0 ? batasNamaPertama : -Infinity);
    const lebarLabel = (i === tampil.length - 1 ? cwT : langkah) - 2 * d - (xLabel - (kx - cwT / 2 + 1 * d));
    const namaLain = v.pemain.filter((_, j) => j !== e.pemilik).map((p) => p.nama);
    const label = ringkas ? null : labelSempit(v.pemain[e.pemilik]?.nama ?? '', lebarLabel, 10 * s * d, namaLain);
    if (label) t.teks.push({ kunci: `b-nama:${i}`, x: xLabel, y: yLabelBawah, isi: label.isi, ukuran: 10, warna: 'redup', maks: lebarLabel, minHuruf: label.minHuruf });
  });
  // Tujuan kartu yang baru dibuang: slot berikutnya di atas tumpukan.
  const iAtas = Math.min(tampil.length, kapasitas - 1);
  t.titik.buangan = { x: cx + Math.max(0, iAtas) * langkah, y: y + chT / 2, w: cwT };
  const kotakBuangan = { x: bx, y, w: Math.max(cwT, cx - bx + Math.max(0, kapasitas - 1) * langkah + cwT / 2), h: chT };
  t.area.buangan = kotakBuangan;
  t.area.lepasBuangan = { x: kotakBuangan.x - 14 * d, y: y - 24 * d, w: kotakBuangan.w + 28 * d, h: chT + 48 * d };

  // Petunjuk di atas buangan. Kolom sempit (HP): mulai dari kolom info supaya kalimatnya tidak terpotong.
  const xPetunjuk = batasTeks - bx < 230 * d * s ? tx : bx;
  if (ringkas) {
    // Tanpa petunjuk: judul baris mulung di sebelahnya sudah menjelaskan.
  } else if (bisaMungut) {
    t.teks.push({ kunci: 'buangan-petunjuk', x: xPetunjuk, y: y - jarakPetunjuk(cwT, d), isi: `ketuk kartu = mungut s/d kartu itu (maks ${maks})`, ukuran: 10, warna: 'emas', oy: 1, maks: batasTeks - xPetunjuk });
  } else if (m.kartukuDiAtas && tampil.length) {
    const atasT = t.titik.kartu.get(tampil[tampil.length - 1].kartu.id)!;
    t.hias.push({ jenis: 'denyutMerah', kotak: { x: atasT.x - cwT / 2 - 3 * d, y: atasT.y - chT / 2 - 3 * d, w: cwT + 6 * d, h: chT + 6 * d } });
    t.teks.push({ kunci: 'buangan-petunjuk', x: xPetunjuk, y: y - jarakPetunjuk(cwT, d), isi: 'KARTUMU DI ATAS!', ukuran: 11, warna: 'bahaya', tebal: true, oy: 1, denyut: true, maks: batasTeks - xPetunjuk });
  } else if (m.berikutnya) {
    t.teks.push({ kunci: 'buangan-petunjuk', x: xPetunjuk, y: y - jarakPetunjuk(cwT, d), isi: `berikutnya: ${m.berikutnya}`, ukuran: 10, warna: 'info', tebal: true, oy: 1, maks: batasTeks - xPetunjuk });
  }
  return x0 + lebarKelompok;
}

/** Rencana baris mulung: judul (dipendekkan kalau sempit), lebar kartu pungutan & kombinasi, satu atau dua baris. */
export interface RencanaMulung {
  judul: string;
  /** Tinggi judul sampai baris kartu pertama. */
  hJudul: number;
  /** Lebar kartu pungutan dan kartu kombinasi. */
  wP: number;
  wK: number;
  /** true = pungutan di baris pertama, kombinasi di baris kedua. */
  dua: boolean;
  /** Tinggi total (judul + baris kartu). */
  tinggi: number;
}

/** Judul baris mulung, dari yang paling lengkap ke yang paling ringkas; dipilih yang muat. */
export function judulMulung(jumlah: number, lebar: number, u: UkuranLayar): string {
  const calon = [
    `Pungutan (${jumlah}) · kartu bertanda emas wajib dijadikan`,
    `Pungutan (${jumlah}) · yang emas wajib dijadikan`,
    `Pungutan (${jumlah}) · emas wajib dijadikan`,
    `Pungutan (${jumlah}) · emas wajib`,
  ];
  const px = 12 * u.skalaTeks * u.d;
  return calon.find((x) => kiraLebarTeks(x, px, true) <= lebar) ?? `Pungutan (${jumlah})`;
}

// Jarak (dikali d): antar-kartu pungutan, pungutan → kombinasi, antar-kombinasi, dan antar-baris.
const CELAH_PUNGUTAN = 4;
const CELAH_KOMBINASI = 10;
const CELAH_BARIS_MULUNG = 8;

/**
 * Rencanakan baris mulung selebar `lebar`. Kartu pungutan diusahakan selebar `target` (lihat LEBAR_PUNGUTAN_CSS);
 * kalau satu baris membuatnya jauh lebih kecil, kombinasi turun ke baris kedua. `hMaks` (lanskap pendek):
 * tinggi yang tersedia, kartu dikecilkan supaya muat; null = tinggi menyesuaikan (baris sendiri di potret).
 */
export function rencanaMulung(mu: NonNullable<ModelTata['mulung']>, lebar: number, target: number, hMaks: number | null, u: UkuranLayar): RencanaMulung {
  const { d } = u;
  const judul = judulMulung(mu.jumlah, lebar, u);
  // Judul 12 px (tinggi baris ±1,3×) + jarak ke kartu; kartu terpilih naik ke jarak itu tanpa menimpa judul.
  const hJudul = 12 * 1.3 * u.skalaTeks * d + 6 * d;
  const nP = mu.sisaPungutan.length;
  const nK = mu.kombinasi.length;
  // Lebar satu kombinasi = (jumlah kartu − 1) × 0,6w + w; bingkainya 2 px di tiap sisi.
  const satuanK = mu.kombinasi.reduce((a, kb) => a + 0.6 * (kb.kartu.length - 1) + 1, 0);
  const tetapP = Math.max(0, nP - 1) * CELAH_PUNGUTAN * d;
  const tetapK = nK ? (nK - 1) * CELAH_KOMBINASI * d + 4 * d : 0;
  const tinggiKartu = (w: number) => w * RASIO_KARTU + 4 * d;
  // Satu baris: pungutan lalu kombinasi.
  const a1 = nP + RASIO_KOMBINASI * satuanK;
  const b1 = tetapP + tetapK + (nP && nK ? CELAH_KOMBINASI * d : 0);
  let w1 = a1 > 0 ? Math.min(target, (lebar - b1) / a1) : target;
  if (hMaks !== null) w1 = Math.min(w1, (hMaks - hJudul - 4 * d) / RASIO_KARTU);
  w1 = Math.max(4 * d, w1);
  const satu: RencanaMulung = { judul, hJudul, wP: w1, wK: w1 * RASIO_KOMBINASI, dua: false, tinggi: hJudul + tinggiKartu(w1) };
  if (!nP || !nK) return satu;
  // Dua baris: pungutan di atas, kombinasi di bawah.
  let wP = Math.min(target, (lebar - tetapP) / nP);
  let wK = Math.min(wP * RASIO_KOMBINASI, (lebar - tetapK) / satuanK);
  if (hMaks !== null) {
    const ruang = hMaks - hJudul - CELAH_BARIS_MULUNG * d - 8 * d;
    const f = Math.min(1, ruang / ((wP + wK) * RASIO_KARTU));
    wP *= f;
    wK *= f;
  }
  const dua: RencanaMulung = { judul, hJudul, wP, wK, dua: true, tinggi: hJudul + tinggiKartu(wP) + CELAH_BARIS_MULUNG * d + tinggiKartu(wK) };
  // Ukuran efektif = yang paling kecil dari pungutan dan kombinasi (dibanding proporsi bawaannya).
  const efektif = (r: RencanaMulung) => Math.min(r.wP, r.wK / RASIO_KOMBINASI);
  // Potret: baris kedua menambah tinggi (kartu lain ikut mengecil sebentar), jadi dipakai hanya kalau satu
  // baris membuat pungutan jelas lebih kecil dari targetnya.
  const cukup = hMaks === null ? efektif(satu) >= target * 0.9 : efektif(dua) <= efektif(satu) * 1.08;
  return cukup ? satu : dua;
}

/** Baris mulung (judul, pungutan, kombinasi) mulai dari (x0, y), selebar x1 − x0, menurut rencana `r`. */
function gambarMulung(t: TataMeja, m: ModelTata, x0: number, x1: number, y: number, r: RencanaMulung, u: UkuranLayar) {
  const { d } = u;
  const mu = m.mulung!;
  t.teks.push({ kunci: 'mulung-judul', x: x0, y, isi: r.judul, ukuran: 12, warna: 'emas', tebal: true, maks: x1 - x0 });
  const ky = y + r.hJudul;
  const wP = r.wP;
  const hP = wP * RASIO_KARTU;
  let cx = x0;
  mu.sisaPungutan.forEach((kt, i) => {
    const naik = m.dipilih.has(kt.id);
    const x = cx + wP / 2;
    // Kartu terpilih naik sedikit (tidak sampai menimpa judul).
    const yy = ky + hP / 2 - (naik ? Math.min(8 * d, r.hJudul - 12 * 1.25 * u.skalaTeks * d) : 0);
    t.titik.kartu.set(kt.id, { x, y: yy, w: wP });
    t.kartu.push({
      kunci: `p:${kt.id}`,
      peran: 'pungutan',
      kartu: kt,
      id: kt.id,
      x,
      y: yy,
      w: wP,
      sudut: 0,
      lapis: LAPIS.mulung + i * 0.01,
      alpha: 1,
      tinggi: naik ? 0.45 : 0.1,
      sorot: m.fokus === kt.id ? 'fokus' : kt.id === mu.idPaling ? 'wajib' : naik ? 'pilih' : undefined,
      ketuk: { jenis: 'kartu', id: kt.id },
    });
    cx += wP + CELAH_PUNGUTAN * d;
  });
  let kyK = ky;
  if (r.dua) {
    kyK = ky + hP + 4 * d + CELAH_BARIS_MULUNG * d;
    cx = x0;
  } else if (mu.sisaPungutan.length) cx += (CELAH_KOMBINASI - CELAH_PUNGUTAN) * d;
  const w = r.wK;
  const hK = w * RASIO_KARTU;
  cx += 2 * d; // bingkai kombinasi
  mu.kombinasi.forEach((kb, i) => {
    const awal = cx;
    kb.kartu.forEach(({ kartu, label }, j) => {
      t.kartu.push({
        kunci: `k:${i}:${kartu.id}`,
        peran: 'kombinasi',
        kartu,
        x: cx + j * w * 0.6 + w / 2,
        y: kyK + hK / 2,
        w,
        sudut: 0,
        lapis: LAPIS.mulung + 1 + j * 0.01,
        alpha: 1,
        tinggi: 0,
        ketuk: { jenis: 'kombinasi', indeks: i },
        label: label ? { isi: label, gaya: 'emas', posisi: 'tengah' } : undefined,
      });
    });
    const lebar = (kb.kartu.length - 1) * w * 0.6 + w;
    t.hias.push({ jenis: 'bingkai', kotak: { x: awal - 2 * d, y: kyK - 2 * d, w: lebar + 4 * d, h: hK + 4 * d }, warna: 'hijau', tebal: 2 });
    cx += lebar + CELAH_KOMBINASI * d;
  });
}

/** Jarak dari tepi bawah kartu deck/buangan ke labelnya: tebal tumpukan deck (maks 6 lapis) + bayangan. */
/** Tinggi kelompok tengah (petunjuk di atas, deck & buangan, label di bawah) untuk deck selebar cwT. */
function tinggiTengahUntuk(cwT: number, hTeks: number, d: number) {
  return cwT * RASIO_KARTU + hTeks * 2 + 6 * d + jarakLabelTengah(cwT, d) + jarakPetunjuk(cwT, d);
}

/** Tinggi area tangan satu baris untuk kartu selebar cw (ruang sorot, kartu terangkat, kartu, lengkung & bayangan). */
function tinggiTanganSatuBaris(cw: number, d: number) {
  const ch = cw * RASIO_KARTU;
  return ruangSorotTangan(cw, d) + ch * 0.18 + ch + bawahTangan(cw, d);
}

function jarakLabelTengah(cwT: number, d: number) {
  return 7 * d + cwT * RASIO_KARTU * 0.05;
}

/** Jarak petunjuk di atas buangan dari tepi atas kartu: di luar cincin sorot/fokus kartu teratas. */
function jarakPetunjuk(cwT: number, d: number) {
  return 2 * d + cwT * 0.1;
}

/**
 * Ruang di atas kartu tangan yang terangkat (terpilih): cincin sorot (±0,06 cw di luar tepi kartu) dan
 * pembesaran hover 3 % di desktop, supaya label "Nama · skor · giliranmu" (dan kartu jadiku) di atas tangan
 * tidak tertutup kartu terpilih paling kiri. Kartu yang sudah terangkat tidak naik lagi saat di-hover
 * (MejaScene.sinkron), jadi ruang ini cukup.
 */
export function ruangSorotTangan(cw: number, d: number) {
  return cw * 0.09 + 2 * d;
}

/** Ruang di bawah kartu tangan: lengkung + miring kipas (±4°) dan bayangan, supaya tetap di dalam area tangan. */
function bawahTangan(cw: number, d: number) {
  return cw * RASIO_KARTU * 0.075 + cw * 0.035 + 2 * d;
}

/**
 * Ruang di kiri & kanan kipas tangan. Kartu selebar cw yang miring SUDUT_KIPAS_MAKS melebar ke samping
 * sebesar (cw/2)(cos θ − 1) + (ch/2) sin θ (±0,048 cw). Bayangan jatuh ke kanan (geserBayangan, kartu
 * terpilih sebagai kasus terjauh), jadi sisi kanan sedikit lebih lebar.
 */
function sampingTangan(cw: number, d: number): { kiri: number; kanan: number } {
  const r = (SUDUT_KIPAS_MAKS * Math.PI) / 180;
  const ch = cw * RASIO_KARTU;
  const miring = Math.max(0, (cw / 2) * (Math.cos(r) - 1) + (ch / 2) * Math.sin(r));
  const b = geserBayangan(cw, ch, TINGGI_TANGAN.dipilih);
  // Bayangan: geser ke kanan + pelebaran setengah sisi; proyeksinya ikut miring (pakai lebar kartu miring).
  const bayangan = b.dx + (miring + cw / 2) * (b.skala - 1);
  return { kiri: miring + 1 * d, kanan: miring + bayangan + 1 * d };
}

/** Kartu tangan yang difokus keyboard naik sebesar ini × tinggi kartu (kartu terpilih naik lebih tinggi). */
const NAIK_FOKUS = 0.07;

/** Susunan tangan: berapa baris, kartu per baris, dan jarak antar kartu. */
export function tataTangan(jumlah: number, lebar: number, cw: number) {
  const langkahMaks = cw * 0.9;
  const langkahMin = cw * 0.5;
  const perBarisMaks = Math.max(1, Math.floor((lebar - cw) / langkahMin) + 1);
  const baris = Math.max(1, Math.ceil(jumlah / perBarisMaks));
  const perBaris = Math.ceil(jumlah / Math.max(1, baris));
  const langkah = perBaris > 1 ? Math.min(langkahMaks, (lebar - cw) / (perBaris - 1)) : 0;
  return { baris, perBaris, langkah };
}

function gambarTangan(t: TataMeja, m: ModelTata, x: number, w: number, yAtas: number, cw: number, ch: number, angkat: number, tt: ReturnType<typeof tataTangan>) {
  const tangan = m.tangan;
  const { perBaris, langkah, baris } = tt;
  const yDasar = yAtas + angkat;
  t.titik.tangan = { x: x + w / 2, y: yDasar + ch / 2, w: cw };
  tangan.forEach((kt, i) => {
    const b = Math.floor(i / perBaris);
    const kol = i % perBaris;
    const diBaris = Math.min(perBaris, tangan.length - b * perBaris);
    const lebarBaris = (diBaris - 1) * langkah + cw;
    // Kipas halus untuk tangan satu baris: kemiringan kecil (maks ±4°) dan lengkung tipis;
    // tangan bertingkat tetap datar supaya indeks mudah dibaca.
    const rel = diBaris > 1 ? (kol - (diBaris - 1) / 2) / ((diBaris - 1) / 2) : 0;
    const kipas = baris === 1 && diBaris > 2;
    const sudut = kipas ? rel * Math.min(SUDUT_KIPAS_MAKS, 0.9 * (diBaris - 1)) : 0;
    const lengkung = kipas ? rel * rel * ch * 0.035 : 0;
    const dipilih = m.dipilih.has(kt.id);
    // Fokus keyboard: kartu naik sedikit (tepi atas & cincinnya menonjol di atas kipas) tapi lapisnya TETAP.
    // Cincin digambar tepat di atas kartunya sendiri (MejaScene.aturSorot), jadi tetangga kanan yang
    // menumpuk tetap menutupi cincin itu: indeks pojok kartu lain tidak pernah tertimpa.
    const fokus = m.fokus === kt.id;
    const cx = x + (w - lebarBaris) / 2 + kol * langkah + cw / 2;
    const cyDasar = yDasar + b * ch * 0.6 + ch / 2 + lengkung;
    const cy = cyDasar - (dipilih ? angkat : fokus ? ch * NAIK_FOKUS : 0);
    t.slotTangan.push({ id: kt.id, x: cx, y: cyDasar });
    t.titik.kartu.set(kt.id, { x: cx, y: cy, w: cw, sudut });
    if (m.disembunyikan.has(kt.id)) return;
    t.kartu.push({
      kunci: `t:${kt.id}`,
      peran: 'tangan',
      kartu: kt,
      id: kt.id,
      x: cx,
      y: cy,
      w: cw,
      sudut,
      lapis: LAPIS.tangan + i * 0.01,
      alpha: 1,
      tinggi: dipilih ? TINGGI_TANGAN.dipilih : fokus ? TINGGI_TANGAN.fokus : TINGGI_TANGAN.biasa,
      // Fokus keyboard menang atas tanda pilih (kartu terpilih tetap terangkat).
      sorot: fokus ? 'fokus' : dipilih ? 'pilih' : undefined,
      ketuk: { jenis: 'kartu', id: kt.id },
      seret: true,
    });
  });
  if (!tangan.length && m.view.status !== 'putaranBerjalan') {
    t.teks.push({ kunci: 'tangan-kosong', x: x + w / 2, y: yDasar + ch / 2, isi: 'tangan kosong', ukuran: 13, warna: 'redup', ox: 0.5, oy: 0.5 });
  }
}
