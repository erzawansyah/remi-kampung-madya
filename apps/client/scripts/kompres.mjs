// Pasca-build: tulis versi .br dan .gz untuk aset teks di dist, supaya server (sirv dengan
// opsi gzip/brotli) bisa langsung mengirim file terkompresi tanpa mengompres tiap request.
// Dijalankan otomatis setelah vite build: node scripts/kompres.mjs

import { brotliCompressSync, constants, gzipSync } from 'node:zlib';
import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { dirname, extname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const dist = resolve(dirname(fileURLToPath(import.meta.url)), '../dist');
const EKSTENSI = new Set(['.js', '.mjs', '.css', '.html', '.svg', '.json', '.webmanifest', '.txt', '.xml']);
/** File sekecil ini tidak sepadan dikompres (header HTTP-nya saja hampir segitu). */
const UKURAN_MIN = 1024;

function* semuaFile(folder) {
  for (const isi of readdirSync(folder, { withFileTypes: true })) {
    const p = join(folder, isi.name);
    if (isi.isDirectory()) yield* semuaFile(p);
    else if (isi.isFile()) yield p;
  }
}

let jumlah = 0;
let asli = 0;
let br = 0;
for (const p of semuaFile(dist)) {
  if (!EKSTENSI.has(extname(p))) continue;
  const data = readFileSync(p);
  if (data.length < UKURAN_MIN) continue;
  const hasilBr = brotliCompressSync(data, {
    params: {
      [constants.BROTLI_PARAM_QUALITY]: constants.BROTLI_MAX_QUALITY,
      [constants.BROTLI_PARAM_SIZE_HINT]: data.length,
    },
  });
  const hasilGz = gzipSync(data, { level: constants.Z_BEST_COMPRESSION });
  // Hanya tulis kalau memang lebih kecil; kalau tidak, sirv mengirim file aslinya.
  if (hasilBr.length < data.length) writeFileSync(`${p}.br`, hasilBr);
  if (hasilGz.length < data.length) writeFileSync(`${p}.gz`, hasilGz);
  jumlah++;
  asli += data.length;
  br += Math.min(hasilBr.length, data.length);
  if (process.env.KOMPRES_RINCI) console.log(`  ${relative(dist, p)}: ${data.length} -> br ${hasilBr.length}, gz ${hasilGz.length}`);
}

const kb = (n) => `${(n / 1024).toFixed(0)} KB`;
console.log(`Kompres: ${jumlah} file, ${kb(asli)} -> ${kb(br)} (brotli).`);
