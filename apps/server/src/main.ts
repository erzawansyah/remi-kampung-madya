// Titik masuk server. Konfigurasi lewat environment variable.

import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { jalankanServer } from './server.js';
import { bukaRiwayat } from './riwayat.js';

const di = dirname(fileURLToPath(import.meta.url));
const port = Number(process.env.PORT ?? 2567);
const folderStatis = process.env.STATIC_DIR ?? resolve(di, '../../client/dist');

const pathDb = process.env.DB_PATH ?? resolve(di, '../data/remi.db');
const riwayat = bukaRiwayat(pathDb);

const server = await jalankanServer({ port, folderStatis, riwayat });
console.log(`Remi Kampung Madya jalan di port ${server.port} (statis: ${folderStatis}, database: ${pathDb})`);

const berhenti = async () => {
  await server.tutup();
  riwayat.tutup();
  process.exit(0);
};
process.on('SIGINT', berhenti);
process.on('SIGTERM', berhenti);
