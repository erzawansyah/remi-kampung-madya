// Membuat ikon PWA (PNG) dan favicon.svg tanpa dependensi: maskot Kedai Madya hitam di bidang kuning
// papan nama MADYA (#f1a615). Path maskot dibaca langsung dari src/aset/logoMadya.ts (satu sumber),
// lalu dirasterisasi sendiri: kurva bezier diratakan jadi poligon, diisi per baris (scanline) dengan
// aturan even-odd, supersampling 4×4 untuk tepi halus.
// Dijalankan otomatis sebelum build: node scripts/buat-ikon.mjs

import { deflateSync } from 'node:zlib';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const akar = dirname(fileURLToPath(import.meta.url));
const keluar = resolve(akar, '../public');
mkdirSync(keluar, { recursive: true });

// ---------- Ambil path dari logoMadya.ts (tanpa menjalankan TypeScript) ----------
const sumberLogo = readFileSync(resolve(akar, '../src/aset/logoMadya.ts'), 'utf8');
function konstanta(nama) {
  const m = sumberLogo.match(new RegExp(`const ${nama} =\\s*'([^']+)'`));
  if (!m) throw new Error(`Path ${nama} tidak ketemu di logoMadya.ts`);
  return m[1];
}
function viewBox(varian) {
  const m = sumberLogo.match(new RegExp(`${varian}: \\{ viewBox: '([^']+)'`));
  if (!m) throw new Error(`viewBox ${varian} tidak ketemu di logoMadya.ts`);
  return m[1].split(/\s+/).map(Number);
}
const MASKOT = konstanta('MASKOT');
const SILUET = konstanta('SILUET');
const KOTAK_MASKOT = viewBox('maskot');
const KOTAK_SILUET = viewBox('siluet');

// ---------- Path SVG → daftar poligon ----------
/** Mendukung M/L/H/V/C/Z (huruf besar & kecil, dengan pengulangan implisit). */
function kePoligon(d, langkahKurva = 12) {
  const token = d.match(/[MLHVCZmlhvcz]|-?(?:\d+\.?\d*|\.\d+)(?:e-?\d+)?/g) ?? [];
  const poligon = [];
  let saat = null;
  let x = 0;
  let y = 0;
  let x0 = 0;
  let y0 = 0;
  let perintah = '';
  let i = 0;
  const angka = () => Number(token[i++]);
  while (i < token.length) {
    if (/[A-Za-z]/.test(token[i])) perintah = token[i++];
    const rel = perintah === perintah.toLowerCase();
    switch (perintah.toUpperCase()) {
      case 'M': {
        const nx = angka();
        const ny = angka();
        x = rel ? x + nx : nx;
        y = rel ? y + ny : ny;
        x0 = x;
        y0 = y;
        saat = [[x, y]];
        poligon.push(saat);
        perintah = rel ? 'l' : 'L';
        break;
      }
      case 'L': {
        const nx = angka();
        const ny = angka();
        x = rel ? x + nx : nx;
        y = rel ? y + ny : ny;
        saat.push([x, y]);
        break;
      }
      case 'H': {
        const nx = angka();
        x = rel ? x + nx : nx;
        saat.push([x, y]);
        break;
      }
      case 'V': {
        const ny = angka();
        y = rel ? y + ny : ny;
        saat.push([x, y]);
        break;
      }
      case 'C': {
        const k = [angka(), angka(), angka(), angka(), angka(), angka()];
        const [x1, y1, x2, y2, x3, y3] = rel ? k.map((v, j) => v + (j % 2 ? y : x)) : k;
        for (let s = 1; s <= langkahKurva; s++) {
          const t = s / langkahKurva;
          const u = 1 - t;
          saat.push([
            u * u * u * x + 3 * u * u * t * x1 + 3 * u * t * t * x2 + t * t * t * x3,
            u * u * u * y + 3 * u * u * t * y1 + 3 * u * t * t * y2 + t * t * t * y3,
          ]);
        }
        x = x3;
        y = y3;
        break;
      }
      case 'Z':
        x = x0;
        y = y0;
        break;
      default:
        throw new Error(`Perintah path tidak dikenal: ${perintah}`);
    }
  }
  return poligon;
}

// ---------- Rasterisasi even-odd ----------
/**
 * Topeng cakupan (0..1) ukuran × ukuran untuk poligon yang sudah dipetakan ke piksel ikon.
 * Isi per sub-baris: titik potong tepi diurutkan, lalu diisi berpasangan (even-odd).
 */
function rasterisasi(poligon, ukuran, ss = 4) {
  const tepi = [];
  for (const p of poligon) {
    for (let j = 0; j < p.length; j++) {
      const a = p[j];
      const b = p[(j + 1) % p.length];
      if (a[1] !== b[1]) tepi.push(a[1] < b[1] ? [a[0], a[1], b[0], b[1]] : [b[0], b[1], a[0], a[1]]);
    }
  }
  const besar = ukuran * ss;
  const cakup = new Float32Array(ukuran * ukuran);
  const potong = [];
  for (let sy = 0; sy < besar; sy++) {
    const yy = (sy + 0.5) / ss;
    potong.length = 0;
    for (const [xa, ya, xb, yb] of tepi) {
      if (yy >= ya && yy < yb) potong.push(xa + ((yy - ya) / (yb - ya)) * (xb - xa));
    }
    potong.sort((p, q) => p - q);
    const baris = Math.floor(sy / ss) * ukuran;
    for (let k = 0; k + 1 < potong.length; k += 2) {
      // Sampel kolom di (sx + 0.5) / ss: isi yang jatuh di [potong[k], potong[k+1]).
      const awal = Math.max(0, Math.ceil(potong[k] * ss - 0.5));
      const akhir = Math.min(besar - 1, Math.ceil(potong[k + 1] * ss - 0.5) - 1);
      for (let sx = awal; sx <= akhir; sx++) cakup[baris + Math.floor(sx / ss)] += 1 / (ss * ss);
    }
  }
  return cakup;
}

/** Petakan path logo (kotak viewBox) ke tengah ikon dengan lebar `lebar` piksel. */
function petakan(d, kotak, ukuran, lebar, geserY = 0) {
  const [vx, vy, vw, vh] = kotak;
  const s = lebar / vw;
  const ox = (ukuran - vw * s) / 2;
  const oy = (ukuran - vh * s) / 2 + geserY * ukuran;
  return kePoligon(d).map((p) => p.map(([x, y]) => [ox + (x - vx) * s, oy + (y - vy) * s]));
}

// ---------- PNG ----------
const CRC = new Uint32Array(256).map((_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
const crc32 = (buf) => {
  let c = 0xffffffff;
  for (const b of buf) c = CRC[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
};
const potongan = (jenis, data) => {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(jenis), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
};

function png(ukuran, piksel) {
  const baris = Buffer.alloc((ukuran * 4 + 1) * ukuran);
  for (let y = 0; y < ukuran; y++) {
    baris[y * (ukuran * 4 + 1)] = 0;
    for (let x = 0; x < ukuran; x++) {
      const [r, g, b, a] = piksel(x, y);
      const o = y * (ukuran * 4 + 1) + 1 + x * 4;
      baris[o] = r;
      baris[o + 1] = g;
      baris[o + 2] = b;
      baris[o + 3] = a;
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(ukuran, 0);
  ihdr.writeUInt32BE(ukuran, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    potongan('IHDR', ihdr),
    potongan('IDAT', deflateSync(baris, { level: 9 })),
    potongan('IEND', Buffer.alloc(0)),
  ]);
}

const KUNING = [241, 166, 21]; // --madya-kuning
const TINTA = [17, 17, 17]; // --madya-tinta

/**
 * Ikon persegi: bidang kuning penuh, maskot hitam di tengah.
 * `isi` = lebar maskot ÷ sisi ikon. Maskable memakai 0,72 × lebar biasa, jadi diagonal kotak maskot
 * (≈ 0,38 sisi dari pusat) masih di dalam lingkaran zona aman 0,40.
 */
function ikon(ukuran, isi) {
  // Maskot sedikit diturunkan: badan cangkir (bagian terberat) jatuh di tengah optik.
  const cakup = rasterisasi(petakan(MASKOT, KOTAK_MASKOT, ukuran, ukuran * isi, 0.01), ukuran);
  return png(ukuran, (x, y) => {
    const a = Math.min(1, cakup[y * ukuran + x]);
    return [...KUNING.map((k, i) => Math.round(k * (1 - a) + TINTA[i] * a)), 255];
  });
}

const ISI = 0.84;
writeFileSync(resolve(keluar, 'ikon-192.png'), ikon(192, ISI));
writeFileSync(resolve(keluar, 'ikon-512.png'), ikon(512, ISI));
writeFileSync(resolve(keluar, 'ikon-maskable-512.png'), ikon(512, ISI * 0.72));
// iOS membulatkan sudut sendiri (±22 %): maskot sedikit lebih kecil supaya ujung garpu tidak terpotong.
writeFileSync(resolve(keluar, 'apple-touch-icon.png'), ikon(180, ISI * 0.92));

// Favicon: 16–32 px, jadi pakai siluet cangkir (wajah & garpu-sendok luluh di ukuran ini).
const [sx, sy, sw, sh] = KOTAK_SILUET;
const sisi = Math.max(sw, sh) * 1.22;
const fx = sx + sw / 2 - sisi / 2;
const fy = sy + sh / 2 - sisi / 2;
const r1 = (v) => Math.round(v * 10) / 10;
writeFileSync(
  resolve(keluar, 'favicon.svg'),
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${r1(fx)} ${r1(fy)} ${r1(sisi)} ${r1(sisi)}">` +
    `<rect x="${r1(fx)}" y="${r1(fy)}" width="${r1(sisi)}" height="${r1(sisi)}" rx="${r1(sisi * 0.2)}" fill="#f1a615"/>` +
    `<path fill="#111" fill-rule="evenodd" d="${SILUET}"/></svg>\n`,
);
console.log('Ikon PWA & favicon dibuat di', keluar);
