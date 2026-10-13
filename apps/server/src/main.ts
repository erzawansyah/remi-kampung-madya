// Titik masuk server. Konfigurasi lewat environment variable.

import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { jalankanServer, SHA, VERSI } from './server.js';
import { bukaRiwayat } from './riwayat.js';
import { pasangPenjagaProses } from './penjaga.js';
import { daftarEnv } from './keamanan.js';

const di = dirname(fileURLToPath(import.meta.url));
const port = Number(process.env.PORT ?? 2567);
const folderStatis = process.env.STATIC_DIR ?? resolve(di, '../../client/dist');
const log = (...x: unknown[]) => console.log(new Date().toISOString(), ...x);

// TRUST_PROXY: "lokal" (bawaan: X-Forwarded-For dipercaya hanya dari proxy di alamat loopback/privat),
// "1"/"true" = selalu, "0"/"false" = tidak pernah.
const envProxy = (process.env.TRUST_PROXY ?? 'lokal').toLowerCase();
const percayaProxy = envProxy === '1' || envProxy === 'true' ? true : envProxy === '0' || envProxy === 'false' ? false : 'lokal';
const angkaEnv = (nama: string) => {
  const n = Number(process.env[nama]);
  return Number.isFinite(n) && n > 0 ? n : undefined;
};

const pathDb = process.env.DB_PATH ?? resolve(di, '../data/remi.db');
const riwayat = bukaRiwayat(pathDb);

const server = await jalankanServer({
  port,
  folderStatis,
  riwayat,
  log,
  percayaProxy,
  maksMeja: angkaEnv('MAKS_MEJA'),
  maksMejaPerIp: angkaEnv('MAKS_MEJA_PER_IP'),
  maksSambunganPerIp: angkaEnv('MAKS_SAMBUNGAN_PER_IP'),
  // ORIGIN_DIIZINKAN: asal tambahan untuk WebSocket, dipisah koma ("https://a.id,b.id"; "*" = semua).
  originDiizinkan: daftarEnv(process.env.ORIGIN_DIIZINKAN),
  healthzDetail: process.env.HEALTHZ_DETAIL === '1' || process.env.HEALTHZ_DETAIL?.toLowerCase() === 'true',
});
log(`Remi Kampung Madya v${VERSI} (${SHA}) jalan di port ${server.port} (statis: ${folderStatis}, database: ${pathDb})`);

// Dipasang SETELAH server jalan: galat saat start (mis. port terpakai) tetap mematikan proses.
pasangPenjagaProses(process, { log });

let sedangBerhenti = false;
const berhenti = async (sinyal: string) => {
  if (sedangBerhenti) return;
  sedangBerhenti = true;
  log(`${sinyal} diterima, server berhenti…`);
  // Cadangan: kalau penutupan macet, jangan biarkan Docker menunggu sampai SIGKILL.
  setTimeout(() => {
    log('penutupan kelamaan, keluar paksa');
    process.exit(1);
  }, 8000).unref();
  try {
    await server.tutup();
  } catch (e) {
    log('galat saat menutup server', e);
  }
  try {
    riwayat.tutup();
  } catch (e) {
    log('galat saat menutup database', e);
  }
  process.exit(0);
};
process.on('SIGINT', () => void berhenti('SIGINT'));
process.on('SIGTERM', () => void berhenti('SIGTERM'));
