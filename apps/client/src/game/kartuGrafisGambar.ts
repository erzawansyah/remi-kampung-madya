// Gambar kartu dengan Canvas 2D murni (tanpa Phaser, tanpa file gambar), jadi aman offline.
// Dipakai tekstur Phaser (kartuGrafis.ts) dan kartu HTML (beranda, pusat bantuan) supaya tampilannya sama persis.
//
// Semua gambar disusun dalam "satuan desain" 200 × 280 lalu diskalakan ke ukuran piksel tujuan.
// Kartu digambar seragam per bunga + angka. Tidak ada penanda apa pun untuk joker (joker cuma
// angka yang ditentukan tiap putaran, dan itu skill pemain untuk diingat).
// Punggung kartu: dasar arang + kawung kuning MADYA + medali krem berisi maskot cangkir Kedai Madya
// (path vektor dari aset/logoMadya.ts lewat Path2D, bukan file gambar). Semua punggung identik.

import { namaKartu, namaRank, type Bunga, type Rank } from '@remi/engine';
import { pathLogo, type VarianLogo } from '../aset/logoMadya';
import { preferensi, type WarnaKartu } from '../preferensi';

/** Tinggi ÷ lebar kartu. */
export const RASIO_KARTU = 1.4;
/** Jari-jari sudut kartu ÷ lebar kartu. */
export const RASIO_SUDUT = 0.07;
/** Kartu yang tampil lebih sempit dari ini (px CSS) memakai desain mini: indeks raksasa, tanpa pip. */
export const BATAS_MINI_CSS = 36;
/** Tepi tambahan tekstur bayangan & sorot di tiap sisi, ÷ lebar kartu. */
export const PAD_PENDUKUNG = 0.14;

/** Desain kartu: 'normal' (pip lengkap) atau 'mini' (khusus kartu kecil, indeks raksasa). */
export type GayaKartu = 'normal' | 'mini';
/** Isi medali punggung kartu: maskot lengkap (wajah, garpu, sendok) atau siluet cangkir saja. */
export type LogoPunggung = 'maskot' | 'siluet';
/**
 * Lebar maskot terkecil (px CSS) di punggung kartu. Di bawahnya wajah '> <' dan garpu-sendok luluh jadi
 * gumpalan, jadi medalinya berisi siluet cangkir (lihat logoPunggungUntuk).
 */
export const LEBAR_MASKOT_MIN_CSS = 28;
export interface KartuGambar {
  bunga: Bunga;
  rank: Rank;
}

const LU = 200;
const TU = LU * RASIO_KARTU;
const SUDUT = LU * RASIO_SUDUT;
const FONT_INDEKS = '"Segoe UI", Roboto, "Helvetica Neue", Arial, system-ui, sans-serif';
const FONT_HIAS = 'Georgia, "Times New Roman", "Noto Serif", serif';

const KREM_TERANG = '#fffdf7';
const KREM = '#fbf6ea';
const KREM_GELAP = '#f0e6cf';
const TEPI = '#a3967b';
const EMAS = '#c99a2e';
const EMAS_TERANG = '#ecc65c';
// Punggung kartu "papan nama MADYA di malam hari" (padanan token --madya-* di gaya/token.css).
const ARANG = '#1d1a16';
const ARANG_TERANG = '#29241d';
const ARANG_PEKAT = '#13110e';
const KUNING = '#f1a615';
const TINTA_LOGO = '#111111';
/** Kawung kuning (= KUNING) di punggung: alpha 0,34 untuk normal, 0,45 untuk mini (pola kasar). */
const KAWUNG_PUNGGUNG = { normal: 'rgba(241,166,21,0.34)', mini: 'rgba(241,166,21,0.45)' };
/** Warna cadangan medali lama (tanpa Path2D, mis. happy-dom/Node). */
const MARUN = '#6f1820';

/**
 * Palet bunga. Dua warna: klasik merah/hitam.
 * Empat warna: love merah, wajik biru, kriting hijau toska, waru hitam. Hijaunya sengaja kebiruan
 * dan merahnya tetap merah supaya tetap beda bagi buta warna merah-hijau (simulasi deuteranopia
 * ΔE ≥ 35, protanopia ≥ 25), dan semuanya kontras ≥ 4,5:1 di atas kertas krem.
 */
const PALET: Record<WarnaKartu, Record<Bunga, string>> = {
  dua: { love: '#c62828', wajik: '#c62828', kriting: '#1b1b1b', waru: '#1b1b1b' },
  empat: { love: '#c62828', wajik: '#1d47b8', kriting: '#0e7c6a', waru: '#1b1b1b' },
};

/** Warna bunga sesuai preferensi warna kartu (atau mode yang diberikan). */
export const warnaBunga = (b: Bunga, mode: WarnaKartu = preferensi().warnaKartu): string => PALET[mode][b];

/** Gambar simbol bunga berpusat di (x, y) dengan ukuran kira-kira `s` (tinggi simbol). */
export function gambarBunga(
  ctx: CanvasRenderingContext2D,
  bunga: Bunga,
  x: number,
  y: number,
  s: number,
  warna: string = warnaBunga(bunga),
): void {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(s / 100, s / 100);
  ctx.fillStyle = warna;
  ctx.beginPath();
  switch (bunga) {
    case 'love':
      ctx.moveTo(0, 46);
      ctx.bezierCurveTo(-18, 28, -50, 8, -50, -18);
      ctx.bezierCurveTo(-50, -38, -36, -50, -22, -50);
      ctx.bezierCurveTo(-10, -50, -2, -42, 0, -32);
      ctx.bezierCurveTo(2, -42, 10, -50, 22, -50);
      ctx.bezierCurveTo(36, -50, 50, -38, 50, -18);
      ctx.bezierCurveTo(50, 8, 18, 28, 0, 46);
      ctx.closePath();
      ctx.fill();
      break;
    case 'wajik':
      ctx.moveTo(0, -50);
      ctx.quadraticCurveTo(16, -22, 40, 0);
      ctx.quadraticCurveTo(16, 22, 0, 50);
      ctx.quadraticCurveTo(-16, 22, -40, 0);
      ctx.quadraticCurveTo(-16, -22, 0, -50);
      ctx.closePath();
      ctx.fill();
      break;
    case 'waru':
      ctx.moveTo(0, -50);
      ctx.bezierCurveTo(-14, -30, -50, -12, -50, 12);
      ctx.bezierCurveTo(-50, 30, -36, 38, -24, 38);
      ctx.bezierCurveTo(-14, 38, -7, 33, -4, 27);
      ctx.quadraticCurveTo(-6, 40, -18, 50);
      ctx.lineTo(18, 50);
      ctx.quadraticCurveTo(6, 40, 4, 27);
      ctx.bezierCurveTo(7, 33, 14, 38, 24, 38);
      ctx.bezierCurveTo(36, 38, 50, 30, 50, 12);
      ctx.bezierCurveTo(50, -12, 14, -30, 0, -50);
      ctx.closePath();
      ctx.fill();
      break;
    case 'kriting':
      ctx.arc(0, -25, 23, 0, Math.PI * 2);
      ctx.moveTo(-4, 14);
      ctx.arc(-25, 12, 23, 0, Math.PI * 2);
      ctx.moveTo(48, 12);
      ctx.arc(25, 12, 23, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(-9, -6);
      ctx.lineTo(9, -6);
      ctx.lineTo(9, 14);
      ctx.lineTo(-9, 14);
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(-4, 10);
      ctx.quadraticCurveTo(-5, 38, -18, 50);
      ctx.lineTo(18, 50);
      ctx.quadraticCurveTo(5, 38, 4, 10);
      ctx.closePath();
      ctx.fill();
      break;
  }
  ctx.restore();
}

/** Jalur persegi bersudut bulat (arcTo; ctx.roundRect belum ada di Safari/iOS lama). */
export function persegiBulat(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

/** Kertas krem: gradien halus, sedikit gelap di tepi, garis tepi tipis. */
function gambarKertas(ctx: CanvasRenderingContext2D) {
  persegiBulat(ctx, 1, 1, LU - 2, TU - 2, SUDUT);
  const g = ctx.createLinearGradient(0, 0, LU * 0.6, TU);
  g.addColorStop(0, KREM_TERANG);
  g.addColorStop(0.55, KREM);
  g.addColorStop(1, KREM_GELAP);
  ctx.fillStyle = g;
  ctx.fill();
  // Bayangan tepi tipis di dalam kertas: kartu yang bertumpuk tetap kelihatan batasnya.
  ctx.save();
  ctx.clip();
  const v = ctx.createRadialGradient(LU / 2, TU * 0.45, TU * 0.3, LU / 2, TU / 2, TU * 0.75);
  v.addColorStop(0, 'rgba(120,96,50,0)');
  v.addColorStop(1, 'rgba(120,96,50,0.14)');
  ctx.fillStyle = v;
  ctx.fillRect(0, 0, LU, TU);
  ctx.restore();
  persegiBulat(ctx, 1.4, 1.4, LU - 2.8, TU - 2.8, SUDUT - 0.4);
  ctx.lineWidth = 2.8;
  ctx.strokeStyle = TEPI;
  ctx.stroke();
}

/** Tulis teks berpusat-horizontal di x dengan baseline y; dipadatkan kalau lebih lebar dari `maks`. */
function tulisPadat(ctx: CanvasRenderingContext2D, teks: string, x: number, y: number, maks: number) {
  const lebar = ctx.measureText(teks).width;
  ctx.save();
  ctx.translate(x, y);
  if (lebar > maks) ctx.scale(maks / lebar, 1);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';
  ctx.fillText(teks, 0, 0);
  ctx.restore();
}

const teksRank = (rank: Rank) => (rank === 1 ? 'A' : namaRank(rank));
/** 6 dan 9 diberi garis bawah supaya tidak tertukar saat kartu terbalik (seperti kartu fisik). */
const perluGarisBawah = (rank: Rank) => rank === 6 || rank === 9;

interface UkuranIndeks {
  /** Pusat kolom indeks. */
  x: number;
  /** Baseline angka. */
  y: number;
  font: number;
  lebarMaks: number;
  /** Pusat & ukuran simbol bunga di bawah angka. */
  yBunga: number;
  sBunga: number;
}

const INDEKS_NORMAL: UkuranIndeks = { x: 25, y: 56, font: 58, lebarMaks: 40, yBunga: 86, sBunga: 31 };
const INDEKS_MINI: UkuranIndeks = { x: 52, y: 108, font: 116, lebarMaks: 88, yBunga: 170, sBunga: 82 };

function gambarIndeks(ctx: CanvasRenderingContext2D, kartu: KartuGambar, warna: string, u: UkuranIndeks) {
  const teks = teksRank(kartu.rank);
  ctx.fillStyle = warna;
  ctx.font = `900 ${u.font}px ${FONT_INDEKS}`;
  tulisPadat(ctx, teks, u.x, u.y, u.lebarMaks);
  if (perluGarisBawah(kartu.rank)) {
    const lebar = Math.min(ctx.measureText(teks).width, u.lebarMaks) * 0.9;
    const tebal = u.font * 0.075;
    ctx.fillRect(u.x - lebar / 2, u.y + u.font * 0.09, lebar, tebal);
  }
  gambarBunga(ctx, kartu.bunga, u.x, u.yBunga, u.sBunga, warna);
}

/** Indeks di kiri-atas dan (diputar 180°) di kanan-bawah. */
function gambarDuaIndeks(ctx: CanvasRenderingContext2D, kartu: KartuGambar, warna: string, u: UkuranIndeks) {
  gambarIndeks(ctx, kartu, warna, u);
  ctx.save();
  ctx.translate(LU, TU);
  ctx.rotate(Math.PI);
  gambarIndeks(ctx, kartu, warna, u);
  ctx.restore();
}

// Tata letak pip klasik. Kolom: kiri/tengah/kanan; baris 0 (atas) … 1 (bawah). Pip di bawah tengah terbalik.
const KIRI = 68;
const TENGAH = LU / 2;
const KANAN = LU - KIRI;
const ATAS = 50;
const BAWAH = TU - 50;
const sisi = (baris: number[]) => baris.flatMap((b) => [[KIRI, b], [KANAN, b]] as [number, number][]);
const tengah = (baris: number[]) => baris.map((b) => [TENGAH, b] as [number, number]);
const TATA_PIP: Record<number, [number, number][]> = {
  2: tengah([0, 1]),
  3: tengah([0, 0.5, 1]),
  4: sisi([0, 1]),
  5: [...sisi([0, 1]), ...tengah([0.5])],
  6: sisi([0, 0.5, 1]),
  7: [...sisi([0, 0.5, 1]), ...tengah([0.25])],
  8: [...sisi([0, 0.5, 1]), ...tengah([0.25, 0.75])],
  9: [...sisi([0, 1 / 3, 2 / 3, 1]), ...tengah([0.5])],
  10: [...sisi([0, 1 / 3, 2 / 3, 1]), ...tengah([1 / 6, 5 / 6])],
};

function gambarPip(ctx: CanvasRenderingContext2D, kartu: KartuGambar, warna: string) {
  const s = kartu.rank <= 3 ? 38 : kartu.rank <= 6 ? 35 : 32;
  for (const [x, b] of TATA_PIP[kartu.rank]) {
    const y = ATAS + (BAWAH - ATAS) * b;
    if (b > 0.5) {
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(Math.PI);
      gambarBunga(ctx, kartu.bunga, 0, 0, s, warna);
      ctx.restore();
    } else {
      gambarBunga(ctx, kartu.bunga, x, y, s, warna);
    }
  }
}

/** As: satu pip besar dengan cincin hias. */
function gambarAs(ctx: CanvasRenderingContext2D, kartu: KartuGambar, warna: string) {
  const cx = LU / 2;
  const cy = TU / 2;
  ctx.save();
  ctx.strokeStyle = EMAS;
  ctx.lineWidth = 2.4;
  ctx.beginPath();
  ctx.arc(cx, cy, 64, 0, Math.PI * 2);
  ctx.stroke();
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.arc(cx, cy, 57, 0, Math.PI * 2);
  ctx.stroke();
  // Manik-manik di luar cincin + belah ketupat di empat arah mata angin.
  ctx.fillStyle = warna;
  for (let i = 0; i < 24; i++) {
    const a = (i / 24) * Math.PI * 2;
    if (i % 6 === 0) continue;
    ctx.beginPath();
    ctx.arc(cx + Math.cos(a) * 71, cy + Math.sin(a) * 71, 2, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.fillStyle = EMAS;
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2;
    ctx.save();
    ctx.translate(cx + Math.cos(a) * 72, cy + Math.sin(a) * 72);
    ctx.rotate(a);
    ctx.beginPath();
    ctx.moveTo(-7, 0);
    ctx.lineTo(0, -4.5);
    ctx.lineTo(7, 0);
    ctx.lineTo(0, 4.5);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }
  ctx.restore();
  gambarBunga(ctx, kartu.bunga, cx, cy + 2, 92, warna);
}

/** Pola kawung tipis (motif batik) untuk latar bingkai J/Q/K dan punggung kartu. */
function polaKawung(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, jarak: number, warna: string, tebal: number) {
  ctx.save();
  ctx.beginPath();
  ctx.rect(x, y, w, h);
  ctx.clip();
  ctx.strokeStyle = warna;
  ctx.lineWidth = tebal;
  const rx = jarak * 0.3;
  const ry = jarak * 0.16;
  const cx0 = x + w / 2;
  const cy0 = y + h / 2;
  const nx = Math.ceil(w / jarak / 2) + 1;
  const ny = Math.ceil(h / jarak / 2) + 1;
  for (let i = -nx; i <= nx; i++) {
    for (let j = -ny; j <= ny; j++) {
      const px = cx0 + i * jarak;
      const py = cy0 + j * jarak;
      // Empat kelopak lonjong menghadap titik tengah, ditambah titik di tengahnya.
      for (let k = 0; k < 4; k++) {
        const a = Math.PI / 4 + (k * Math.PI) / 2;
        ctx.beginPath();
        ctx.ellipse(px + Math.cos(a) * jarak * 0.35, py + Math.sin(a) * jarak * 0.35, rx, ry, a, 0, Math.PI * 2);
        ctx.stroke();
      }
      ctx.beginPath();
      ctx.arc(px, py, tebal * 1.1, 0, Math.PI * 2);
      ctx.fillStyle = warna;
      ctx.fill();
    }
  }
  ctx.restore();
}

/** Hiasan kepala J/Q/K, berpusat di (0, 0), lebar kira-kira 60. */
function gambarHiasan(ctx: CanvasRenderingContext2D, rank: Rank, warna: string) {
  ctx.lineJoin = 'round';
  ctx.lineWidth = 2;
  ctx.strokeStyle = '#3d2a08';
  if (rank === 13) {
    // Mahkota raja: tiga runcing bermanik.
    ctx.beginPath();
    ctx.moveTo(-30, 16);
    ctx.lineTo(-32, -10);
    ctx.lineTo(-16, 2);
    ctx.lineTo(0, -18);
    ctx.lineTo(16, 2);
    ctx.lineTo(32, -10);
    ctx.lineTo(30, 16);
    ctx.closePath();
    ctx.fillStyle = EMAS_TERANG;
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = EMAS_TERANG;
    for (const [x, y] of [[-32, -12], [0, -21], [32, -12]]) {
      ctx.beginPath();
      ctx.arc(x, y, 4.2, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    }
    ctx.fillStyle = warna;
    ctx.fillRect(-30, 9, 60, 7);
    ctx.strokeRect(-30, 9, 60, 7);
  } else if (rank === 12) {
    // Tiara ratu: lengkung bersusun dengan permata belah ketupat.
    ctx.beginPath();
    ctx.moveTo(-30, 14);
    ctx.quadraticCurveTo(-34, -4, -20, -6);
    ctx.quadraticCurveTo(-10, -22, 0, -20);
    ctx.quadraticCurveTo(10, -22, 20, -6);
    ctx.quadraticCurveTo(34, -4, 30, 14);
    ctx.closePath();
    ctx.fillStyle = EMAS_TERANG;
    ctx.fill();
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(0, -14);
    ctx.lineTo(7, -3);
    ctx.lineTo(0, 8);
    ctx.lineTo(-7, -3);
    ctx.closePath();
    ctx.fillStyle = warna;
    ctx.fill();
    for (const x of [-18, 18]) {
      ctx.beginPath();
      ctx.arc(x, 4, 3.6, 0, Math.PI * 2);
      ctx.fill();
    }
  } else {
    // Peci jack: kopiah dengan pita emas.
    ctx.beginPath();
    ctx.moveTo(-26, 14);
    ctx.lineTo(-24, -10);
    ctx.quadraticCurveTo(0, -20, 24, -10);
    ctx.lineTo(26, 14);
    ctx.closePath();
    ctx.fillStyle = '#26221c';
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = EMAS_TERANG;
    ctx.fillRect(-25, 4, 50, 5);
    ctx.fillStyle = warna;
    ctx.beginPath();
    ctx.moveTo(0, -12);
    ctx.lineTo(5, -6);
    ctx.lineTo(0, 0);
    ctx.lineTo(-5, -6);
    ctx.closePath();
    ctx.fill();
  }
}

/** J/Q/K: bingkai bergaya dengan huruf besar dan hiasan kepala, simetris atas-bawah seperti kartu fisik. */
function gambarKepala(ctx: CanvasRenderingContext2D, kartu: KartuGambar, warna: string) {
  const x = 52;
  const y = 22;
  const w = LU - 2 * x;
  const h = TU - 2 * y;
  persegiBulat(ctx, x, y, w, h, 6);
  ctx.fillStyle = 'rgba(236,198,92,0.16)';
  ctx.fill();
  polaKawung(ctx, x, y, w, h, 26, 'rgba(201,154,46,0.28)', 1.1);
  persegiBulat(ctx, x, y, w, h, 6);
  ctx.lineWidth = 2.4;
  ctx.strokeStyle = warna;
  ctx.stroke();
  persegiBulat(ctx, x + 4, y + 4, w - 8, h - 8, 4);
  ctx.lineWidth = 1.2;
  ctx.strokeStyle = EMAS;
  ctx.stroke();

  const huruf = teksRank(kartu.rank);
  const separuh = () => {
    ctx.save();
    ctx.translate(LU / 2, 56);
    gambarHiasan(ctx, kartu.rank, warna);
    ctx.restore();
    ctx.fillStyle = warna;
    ctx.font = `700 60px ${FONT_HIAS}`;
    tulisPadat(ctx, huruf, LU / 2, 122, 50);
    gambarBunga(ctx, kartu.bunga, x + 15, 106, 17, warna);
    gambarBunga(ctx, kartu.bunga, LU - x - 15, 106, 17, warna);
  };
  separuh();
  ctx.save();
  ctx.translate(LU, TU);
  ctx.rotate(Math.PI);
  separuh();
  ctx.restore();
  // Garis pemisah miring di tengah dengan permata kecil, seperti kartu remi fisik.
  ctx.strokeStyle = EMAS;
  ctx.lineWidth = 1.6;
  ctx.beginPath();
  ctx.moveTo(x + 6, TU / 2 + 7);
  ctx.lineTo(LU - x - 6, TU / 2 - 7);
  ctx.stroke();
  ctx.save();
  ctx.translate(LU / 2, TU / 2);
  ctx.rotate(-0.13);
  ctx.fillStyle = warna;
  ctx.fillRect(-4, -4, 8, 8);
  ctx.restore();
}

function gambarMukaSatuan(ctx: CanvasRenderingContext2D, kartu: KartuGambar, gaya: GayaKartu, mode: WarnaKartu) {
  const warna = PALET[mode][kartu.bunga];
  gambarKertas(ctx);
  if (gaya === 'mini') {
    // Kartu mini hanya terlihat sebagian (bertumpuk), jadi indeks raksasa di kiri-atas yang penting.
    gambarIndeks(ctx, kartu, warna, INDEKS_MINI);
    ctx.save();
    ctx.translate(LU, TU);
    ctx.rotate(Math.PI);
    gambarBunga(ctx, kartu.bunga, 42, 48, 48, warna);
    ctx.restore();
    return;
  }
  gambarDuaIndeks(ctx, kartu, warna, INDEKS_NORMAL);
  if (kartu.rank === 1) gambarAs(ctx, kartu, warna);
  else if (kartu.rank >= 11) gambarKepala(ctx, kartu, warna);
  else gambarPip(ctx, kartu, warna);
}

/** Path2D logo per varian (dibuat sekali). null = Path2D tidak tersedia (happy-dom, Node, browser lama). */
const cachePath = new Map<VarianLogo, { path: Path2D; x: number; y: number; w: number; h: number } | null>();

function logoPath2D(varian: VarianLogo) {
  if (cachePath.has(varian)) return cachePath.get(varian)!;
  let hasil: { path: Path2D; x: number; y: number; w: number; h: number } | null = null;
  try {
    if (typeof Path2D === 'function') {
      const p = pathLogo(varian);
      const [x, y, w, h] = p.viewBox.split(/\s+/).map(Number);
      // Semua sub-path diawali M, jadi bisa digabung jadi satu Path2D (evenodd tetap benar: tidak bertumpuk).
      hasil = { path: new Path2D(p.isi.join('')), x, y, w, h };
    }
  } catch {
    hasil = null;
  }
  cachePath.set(varian, hasil);
  return hasil;
}

/**
 * Logo (path vektor dari aset/logoMadya.ts) berpusat di (cx, cy), muat di lingkaran berjari-jari `r`.
 * Mengembalikan false kalau Path2D tidak tersedia (pemanggil menggambar cadangan).
 */
function gambarLogo(ctx: CanvasRenderingContext2D, varian: VarianLogo, cx: number, cy: number, r: number, warna: string): boolean {
  const logo = logoPath2D(varian);
  if (!logo) return false;
  // Muat diagonal kotak logo ke dalam lingkaran: ujung garpu & sendok tidak terpotong.
  const s = r / Math.hypot(logo.w / 2, logo.h / 2);
  ctx.save();
  ctx.translate(cx, cy);
  ctx.scale(s, s);
  ctx.translate(-(logo.x + logo.w / 2), -(logo.y + logo.h / 2));
  ctx.fillStyle = warna;
  ctx.fill(logo.path, 'evenodd');
  ctx.restore();
  return true;
}

/** Ukuran medali punggung (× 1/100 satuan desain) dan jari-jari logo di dalamnya, per desain. */
const MEDALI = { normal: 118, mini: 125 } as const;
const R_MEDALI = 46;
const R_LOGO: Record<LogoPunggung, number> = { maskot: R_MEDALI - 8, siluet: R_MEDALI - 13 };

/**
 * Lebar maskot di punggung kartu desain normal ÷ lebar kartu: logo dimuatkan ke lingkaran (diagonal kotak
 * viewBox-nya), jadi lebarnya 2r · w / √(w² + h²).
 */
export const RASIO_MASKOT_PUNGGUNG = (() => {
  const [, , w, h] = pathLogo('maskot').viewBox.trim().split(/ +/).map(Number);
  return (2 * R_LOGO.maskot * (MEDALI.normal / 100) * w) / Math.hypot(w, h) / LU;
})();

/** Isi medali punggung untuk kartu yang tampil selebar `lebarCss` px CSS: maskot hanya kalau cukup besar. */
export function logoPunggungUntuk(lebarCss: number): LogoPunggung {
  return lebarCss * RASIO_MASKOT_PUNGGUNG >= LEBAR_MASKOT_MIN_CSS ? 'maskot' : 'siluet';
}

/**
 * Medali krem Kedai Madya di tengah punggung kartu: cincin kuning, belah ketupat atas-bawah, dan maskot
 * cangkir hitam. Kartu yang tampil kecil (gaya mini, atau normal yang maskotnya < LEBAR_MASKOT_MIN_CSS)
 * memakai siluet cangkir saja, karena wajah & garpu-sendok luluh jadi gumpalan.
 * Kalau Path2D tidak ada, isinya cadangan medali lama (monogram "KM" / wajik).
 */
function gambarEmblem(ctx: CanvasRenderingContext2D, cx: number, cy: number, s: number, mini: boolean, logo: LogoPunggung) {
  ctx.save();
  ctx.translate(cx, cy);
  ctx.scale(s / 100, s / 100);
  const R = R_MEDALI;
  // Belah ketupat di atas & bawah medali.
  ctx.fillStyle = KUNING;
  for (const arah of [-1, 1]) {
    ctx.beginPath();
    ctx.moveTo(0, arah * (R + 1));
    ctx.lineTo(7, arah * (R + 11));
    ctx.lineTo(0, arah * (R + 21));
    ctx.lineTo(-7, arah * (R + 11));
    ctx.closePath();
    ctx.fill();
  }
  ctx.beginPath();
  ctx.arc(0, 0, R, 0, Math.PI * 2);
  ctx.fillStyle = ARANG_PEKAT;
  ctx.fill();
  ctx.lineWidth = 4;
  ctx.strokeStyle = KUNING;
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(0, 0, R - 6, 0, Math.PI * 2);
  ctx.fillStyle = KREM;
  ctx.fill();
  if (!mini) {
    ctx.lineWidth = 1.4;
    ctx.strokeStyle = TINTA_LOGO;
    ctx.stroke();
  }
  const ada = logo === 'siluet' ? gambarLogo(ctx, 'siluet', 0, 1.5, R_LOGO.siluet, TINTA_LOGO) : gambarLogo(ctx, 'maskot', 0, 1, R_LOGO.maskot, TINTA_LOGO);
  if (!ada) {
    if (mini) {
      gambarBunga(ctx, 'wajik', 0, 0, 40, MARUN);
    } else {
      ctx.fillStyle = MARUN;
      ctx.font = `700 30px ${FONT_HIAS}`;
      tulisPadat(ctx, 'KM', 0, 11, 50);
    }
  }
  ctx.restore();
}

function gambarPunggungSatuan(ctx: CanvasRenderingContext2D, gaya: GayaKartu, logo: LogoPunggung) {
  gambarKertas(ctx);
  const m = gaya === 'mini' ? 14 : 10;
  const x = m;
  const y = m;
  const w = LU - 2 * m;
  const h = TU - 2 * m;
  persegiBulat(ctx, x, y, w, h, SUDUT - m * 0.5);
  const g = ctx.createLinearGradient(0, y, 0, y + h);
  g.addColorStop(0, ARANG_TERANG);
  g.addColorStop(0.5, ARANG);
  g.addColorStop(1, ARANG_PEKAT);
  ctx.fillStyle = g;
  ctx.fill();
  if (gaya === 'mini') {
    // Kartu kecil: pola lebih kasar supaya tidak berkilau (moiré) saat diperkecil.
    polaKawung(ctx, x, y, w, h, 60, KAWUNG_PUNGGUNG.mini, 4);
    gambarEmblem(ctx, LU / 2, TU / 2, MEDALI.mini, true, 'siluet');
  } else {
    polaKawung(ctx, x, y, w, h, 30, KAWUNG_PUNGGUNG.normal, 1.5);
    persegiBulat(ctx, x + 6, y + 6, w - 12, h - 12, 6);
    ctx.lineWidth = 2;
    ctx.strokeStyle = KUNING;
    ctx.stroke();
    gambarEmblem(ctx, LU / 2, TU / 2, MEDALI.normal, false, logo);
  }
}

/**
 * Gambar satu kartu ke `ctx` di (0, 0) dengan lebar `lebarPx`. `kartu` null = punggung.
 * `mode` bawaan mengikuti preferensi warna kartu. `logo`: isi medali punggung desain normal (bawaan maskot;
 * pilih dengan logoPunggungUntuk dari lebar TAMPIL kartu). Desain mini selalu siluet.
 */
export function gambarKartu(
  ctx: CanvasRenderingContext2D,
  kartu: KartuGambar | null,
  lebarPx: number,
  gaya: GayaKartu = 'normal',
  mode: WarnaKartu = preferensi().warnaKartu,
  logo: LogoPunggung = 'maskot',
): void {
  ctx.save();
  ctx.scale(lebarPx / LU, lebarPx / LU);
  if (kartu) gambarMukaSatuan(ctx, kartu, gaya, mode);
  else gambarPunggungSatuan(ctx, gaya, logo);
  ctx.restore();
}

/** Ukuran kanvas tekstur pendukung (bayangan/sorot) untuk kartu selebar `lebarKartu`. */
export function ukuranPendukung(lebarKartu: number): { w: number; h: number } {
  const pad = lebarKartu * PAD_PENDUKUNG;
  return { w: lebarKartu + 2 * pad, h: lebarKartu * RASIO_KARTU + 2 * pad };
}

/** Bayangan lembut seukuran kartu (hitam; alpha diatur scene). Kartu menempati area tengah. */
export function gambarBayangan(ctx: CanvasRenderingContext2D, lebarKartu: number): void {
  const pad = lebarKartu * PAD_PENDUKUNG;
  const h = lebarKartu * RASIO_KARTU;
  const geser = 10000;
  ctx.save();
  // Trik bayangan: bentuknya digambar jauh di luar kanvas, hanya bayangannya yang jatuh ke dalam.
  ctx.shadowColor = 'rgba(0,0,0,1)';
  ctx.shadowBlur = lebarKartu * 0.08;
  ctx.shadowOffsetX = geser;
  persegiBulat(ctx, pad - geser, pad, lebarKartu, h, lebarKartu * RASIO_SUDUT);
  ctx.fillStyle = '#000';
  ctx.fill();
  ctx.fill();
  ctx.restore();
}

/**
 * Sorot: cincin emas bercahaya di luar tepi kartu (untuk kartu terpilih/fokus keyboard).
 * Ada garis gelap tipis menempel di tepi kartu supaya kontras ≥ 3:1 baik di atas kertas krem
 * maupun meja hijau. Bagian kartu dibiarkan transparan, jadi boleh dipasang di atas atau di bawah kartu.
 */
export function gambarSorot(ctx: CanvasRenderingContext2D, lebarKartu: number): void {
  const pad = lebarKartu * PAD_PENDUKUNG;
  const h = lebarKartu * RASIO_KARTU;
  const r = lebarKartu * RASIO_SUDUT;
  const lingkar = (lebih: number) => persegiBulat(ctx, pad - lebih, pad - lebih, lebarKartu + 2 * lebih, h + 2 * lebih, r + lebih);
  ctx.save();
  // Pendar lembut.
  ctx.shadowColor = 'rgba(255,196,64,0.95)';
  ctx.shadowBlur = lebarKartu * 0.07;
  ctx.strokeStyle = 'rgba(255,196,64,0.7)';
  ctx.lineWidth = lebarKartu * 0.035;
  lingkar(lebarKartu * 0.04);
  ctx.stroke();
  ctx.stroke();
  ctx.restore();
  // Cincin kuning MADYA tegas (= --emas).
  ctx.strokeStyle = KUNING;
  ctx.lineWidth = lebarKartu * 0.034;
  lingkar(lebarKartu * 0.03);
  ctx.stroke();
  // Garis gelap di tepi kartu.
  ctx.strokeStyle = 'rgba(40,26,0,0.9)';
  ctx.lineWidth = lebarKartu * 0.012;
  lingkar(lebarKartu * 0.008);
  ctx.stroke();
  // Pastikan area kartu tetap bersih.
  ctx.save();
  ctx.globalCompositeOperation = 'destination-out';
  lingkar(0);
  ctx.fill();
  ctx.restore();
}

/**
 * Cincin fokus keyboard (seukuran tekstur pendukung): garis luar gelap + cincin putih tebal + garis dalam
 * gelap, tanpa pendar. Sengaja beda bentuk & warna dari cincin emas berdenyut ('bisa'/'wajib') supaya posisi
 * fokus tetap terbaca walau kartunya juga bisa diketuk (dan terbaca juga oleh yang buta warna).
 */
export function gambarFokus(ctx: CanvasRenderingContext2D, lebarKartu: number): void {
  const pad = lebarKartu * PAD_PENDUKUNG;
  const h = lebarKartu * RASIO_KARTU;
  const r = lebarKartu * RASIO_SUDUT;
  const lingkar = (lebih: number) => persegiBulat(ctx, pad - lebih, pad - lebih, lebarKartu + 2 * lebih, h + 2 * lebih, r + lebih);
  // Garis luar gelap (kontras di atas meja hijau maupun kartu putih).
  ctx.strokeStyle = 'rgba(8,14,10,0.95)';
  ctx.lineWidth = lebarKartu * 0.075;
  lingkar(lebarKartu * 0.062);
  ctx.stroke();
  // Cincin putih tebal.
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = lebarKartu * 0.045;
  lingkar(lebarKartu * 0.062);
  ctx.stroke();
  // Garis dalam gelap tipis, memisahkan cincin dari tepi kartu.
  ctx.strokeStyle = 'rgba(8,14,10,0.9)';
  ctx.lineWidth = lebarKartu * 0.014;
  lingkar(lebarKartu * 0.02);
  ctx.stroke();
  ctx.save();
  ctx.globalCompositeOperation = 'destination-out';
  lingkar(0);
  ctx.fill();
  ctx.restore();
}

/**
 * Kanvas HTML berisi satu kartu (null = punggung) untuk beranda, pusat bantuan, dll.
 * Digambar dengan fungsi yang sama dengan tekstur di meja. Ukuran tampil `lebarCss` × (lebarCss × 1,4) px CSS;
 * kartu lebih kecil dari BATAS_MINI_CSS memakai desain mini, punggung yang maskotnya terlalu kecil berisi siluet
 * (logoPunggungUntuk). Warna mengikuti preferensi saat dipanggil;
 * kalau preferensi warna kartu berubah, pemanggil cukup membuat kanvas baru.
 */
export function gambarKartuKeKanvas(
  kartu: KartuGambar | null,
  lebarCss: number,
  dpr: number = window.devicePixelRatio || 1,
): HTMLCanvasElement {
  const kanvas = document.createElement('canvas');
  const w = Math.max(1, Math.round(lebarCss * dpr));
  kanvas.width = w;
  kanvas.height = Math.round(w * RASIO_KARTU);
  kanvas.style.width = `${lebarCss}px`;
  kanvas.style.height = `${lebarCss * RASIO_KARTU}px`;
  const ctx = kanvas.getContext('2d');
  if (ctx) gambarKartu(ctx, kartu, w, lebarCss < BATAS_MINI_CSS ? 'mini' : 'normal', preferensi().warnaKartu, logoPunggungUntuk(lebarCss));
  kanvas.setAttribute('role', 'img');
  kanvas.setAttribute('aria-label', kartu ? namaKartu(kartu) : 'Kartu tertutup');
  return kanvas;
}
