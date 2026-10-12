// Membuat ikon PWA (PNG) tanpa dependensi: meja hijau, kartu putih, simbol Love merah.
// Dijalankan otomatis sebelum build: node scripts/buat-ikon.mjs

import { deflateSync } from 'node:zlib';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const keluar = resolve(dirname(fileURLToPath(import.meta.url)), '../public');
mkdirSync(keluar, { recursive: true });

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
    potongan('IDAT', deflateSync(baris)),
    potongan('IEND', Buffer.alloc(0)),
  ]);
}

const HIJAU = [21, 101, 52];
const PUTIH = [250, 248, 242];
const MERAH = [198, 40, 40];
const TEPI = [200, 196, 186];

/** Warna di koordinat ternormalisasi (0..1). `isi` = proporsi kartu terhadap ikon. */
function warna(u, v, isi) {
  const lebar = 0.62 * isi;
  const tinggi = 0.84 * isi;
  const cx = 0.5;
  const cy = 0.5;
  const dx = Math.abs(u - cx) - lebar / 2;
  const dy = Math.abs(v - cy) - tinggi / 2;
  const r = 0.07 * isi;
  const luar = Math.hypot(Math.max(dx + r, 0), Math.max(dy + r, 0)) - r + Math.min(Math.max(dx + r, dy + r), 0);
  if (luar > 0) return HIJAU;
  if (luar > -0.012 * isi) return TEPI;
  // Simbol Love: (x²+y²−1)³ − x²y³ ≤ 0
  const s = 0.2 * isi;
  const x = (u - cx) / s;
  const y = -(v - cy - 0.02 * isi) / s;
  const h = (x * x + y * y - 1) ** 3 - x * x * y ** 3;
  return h <= 0 ? MERAH : PUTIH;
}

function ikon(ukuran, isi) {
  const ss = 3;
  return png(ukuran, (x, y) => {
    let r = 0;
    let g = 0;
    let b = 0;
    for (let i = 0; i < ss; i++) {
      for (let j = 0; j < ss; j++) {
        const c = warna((x + (i + 0.5) / ss) / ukuran, (y + (j + 0.5) / ss) / ukuran, isi);
        r += c[0];
        g += c[1];
        b += c[2];
      }
    }
    const n = ss * ss;
    return [Math.round(r / n), Math.round(g / n), Math.round(b / n), 255];
  });
}

writeFileSync(resolve(keluar, 'ikon-192.png'), ikon(192, 1));
writeFileSync(resolve(keluar, 'ikon-512.png'), ikon(512, 1));
writeFileSync(resolve(keluar, 'ikon-maskable-512.png'), ikon(512, 0.72));
writeFileSync(resolve(keluar, 'apple-touch-icon.png'), ikon(180, 1));
console.log('Ikon PWA dibuat di', keluar);
