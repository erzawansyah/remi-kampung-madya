// Bunyi tambahan Teaser A (brief A §6) yang tidak ada sebagai JenisBunyi di game, disintesis dari fungsi yang
// sama dengan bunyi game (apps/client/src/efek/sintesis.ts + bangunRantai di mesinAudio.ts) supaya karakternya
// satu keluarga: kursi terjengkang (dentum + ketuk), gebrakan meja (dentum pendek), seruput kopi (desir),
// dan krak gelas (gesek pendek + kecrek kecil). Hasilnya di public/aset/bunyi-a-*.wav (diabaikan git).
// Jalankan sesudah `npm run aset` (aset dasar). Pakai: `npm run aset:a` di folder promo.
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createServer } from 'vite';
import { chromium } from 'playwright-core';

const promo = join(dirname(fileURLToPath(import.meta.url)), '..');
const akar = join(promo, '..');
const client = join(akar, 'apps/client');
const keluar = join(promo, 'public/aset');
mkdirSync(keluar, { recursive: true });

const server = await createServer({
  root: client,
  configFile: join(client, 'vite.config.ts'),
  logLevel: 'warn',
  server: { port: 0, strictPort: false, host: '127.0.0.1', proxy: {} },
});
await server.listen();
const alamat = server.resolvedUrls?.local?.[0];
if (!alamat) throw new Error('Vite tidak memberi alamat.');
const jalurChrome = process.env.CHROME_PATH || (existsSync('/opt/pw-browsers/chromium') ? '/opt/pw-browsers/chromium' : undefined);
const browser = await chromium.launch({ executablePath: jalurChrome, args: ['--autoplay-policy=no-user-gesture-required'] });

try {
  const page = await browser.newPage();
  page.on('pageerror', (e) => console.error('[halaman]', e.message));
  await page.goto(new URL('/@vite/client', alamat).href);
  const hasil = await page.evaluate(async () => {
    let s = 20261107;
    Math.random = () => {
      s = (s + 0x6d2b79f5) | 0;
      let t = Math.imul(s ^ (s >>> 15), 1 | s);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
    const sin = await import('/src/efek/sintesis.ts');
    const mesin = await import('/src/efek/mesinAudio.ts');

    /** Rekam `isi(k)` (penjadwalan bunyi di detik 0..) selama `detik` detik → AudioBuffer. */
    const rekam = async (detik, isi) => {
      const laju = 48000;
      const a = new OfflineAudioContext(2, Math.ceil(laju * detik), laju);
      const r = mesin.bangunRantai(a);
      r.busMusik.gain.value = 0;
      const k = { a, ke: r.busEfek, gema: r.gemaEfek, derau: r.derau };
      isi(k);
      return a.startRendering();
    };
    const wav = (buf) => {
      const n = buf.length;
      const kanal = buf.numberOfChannels;
      const data = new DataView(new ArrayBuffer(44 + n * kanal * 2));
      const tulis = (o, t) => [...t].forEach((c, i) => data.setUint8(o + i, c.charCodeAt(0)));
      tulis(0, 'RIFF');
      data.setUint32(4, 36 + n * kanal * 2, true);
      tulis(8, 'WAVE');
      tulis(12, 'fmt ');
      data.setUint32(16, 16, true);
      data.setUint16(20, 1, true);
      data.setUint16(22, kanal, true);
      data.setUint32(24, buf.sampleRate, true);
      data.setUint32(28, buf.sampleRate * kanal * 2, true);
      data.setUint16(32, kanal * 2, true);
      data.setUint16(34, 16, true);
      tulis(36, 'data');
      data.setUint32(40, n * kanal * 2, true);
      const ch = [...Array(kanal)].map((_, i) => buf.getChannelData(i));
      let o = 44;
      for (let i = 0; i < n; i++)
        for (let c = 0; c < kanal; c++) {
          const v = Math.max(-1, Math.min(1, ch[c][i]));
          data.setInt16(o, v < 0 ? v * 0x8000 : v * 0x7fff, true);
          o += 2;
        }
      const u8 = new Uint8Array(data.buffer);
      let biner = '';
      for (let i = 0; i < u8.length; i += 0x8000) biner += String.fromCharCode(...u8.subarray(i, i + 0x8000));
      return btoa(biner);
    };

    const audio = {};
    // Kursi terjengkang: dentum berat lalu dua ketukan kayu (kursi dan tubuh mendarat), sedikit gesek kursi.
    audio['bunyi-a-kursi.wav'] = wav(
      await rekam(2.2, (k) => {
        sin.gesek(k, 0.0, 0.12, { frek: 900, frekAkhir: 300, q: 0.8, puncak: 0.25, serang: 0.004 });
        sin.dentum(k, 0.14, 0.75, { frek: 95, panjang: 0.9 });
        sin.ketuk(k, 0.2, { puncak: 0.5, badan: 140, terang: 1500 });
        sin.ketuk(k, 0.31, { puncak: 0.35, badan: 120, terang: 1100 });
        sin.ketuk(k, 0.4, { puncak: 0.2, badan: 110, terang: 900 });
      }),
    );
    // Gebrakan meja: dentum pendek + ketukan tangan.
    audio['bunyi-a-gebrak.wav'] = wav(
      await rekam(1.4, (k) => {
        sin.dentum(k, 0.0, 0.6, { frek: 130, panjang: 0.35 });
        sin.ketuk(k, 0.0, { puncak: 0.55, badan: 180, terang: 2200 });
      }),
    );
    // Gebrakan kecil (kartu fisik melompat sedikit sesudahnya).
    audio['bunyi-a-gebrak-kecil.wav'] = wav(
      await rekam(1.0, (k) => {
        sin.dentum(k, 0.0, 0.35, { frek: 150, panjang: 0.25 });
        sin.ketuk(k, 0.05, { puncak: 0.2, badan: 200, terang: 2600 });
        sin.ketuk(k, 0.09, { puncak: 0.12, badan: 220, terang: 3000 });
      }),
    );
    // Seruput kopi: desir pendek (derau tersaring membengkak), dua kali (seruput, lalu telan kecil).
    audio['bunyi-a-seruput.wav'] = wav(
      await rekam(1.4, (k) => {
        sin.desir(k, 0.0, 0.42, { frek: 1200, frekAkhir: 2600, puncak: 0.22, q: 1.4, lepas: 0.08 });
        sin.gesek(k, 0.5, 0.08, { frek: 500, frekAkhir: 250, q: 0.8, puncak: 0.1, serang: 0.003 });
      }),
    );
    // Krak gelas: retakan kaca kecil (gesek terang sangat pendek + kecrek kecil), tanpa dentum.
    audio['bunyi-a-krak.wav'] = wav(
      await rekam(1.2, (k) => {
        sin.gesek(k, 0.0, 0.05, { frek: 5200, frekAkhir: 3200, q: 1.2, puncak: 0.45, serang: 0.001 });
        sin.kecrek(k, 0.01, 0.18, 0.1);
        sin.gesek(k, 0.07, 0.09, { frek: 3600, frekAkhir: 1800, q: 0.9, puncak: 0.2, serang: 0.001 });
        sin.ketuk(k, 0.0, { puncak: 0.15, badan: 420, terang: 5000 });
      }),
    );
    // Dok stempel: dentum rendah pendek + ketukan karet.
    audio['bunyi-a-dok.wav'] = wav(
      await rekam(1.4, (k) => {
        sin.dentum(k, 0.0, 0.8, { frek: 80, panjang: 0.5 });
        sin.ketuk(k, 0.0, { puncak: 0.5, badan: 120, terang: 900 });
      }),
    );
    // Whoosh kamera (burst/rewind): desir pendek turun.
    audio['bunyi-a-whoosh.wav'] = wav(
      await rekam(1.0, (k) => {
        sin.desir(k, 0.0, 0.22, { frek: 600, frekAkhir: 2400, puncak: 0.3, q: 0.7, lepas: 0.12 });
      }),
    );
    // Ketukan jari ke layar HP (satu ketuk kecil).
    audio['bunyi-a-ketukhp.wav'] = wav(
      await rekam(0.8, (k) => {
        sin.ketuk(k, 0.0, { puncak: 0.3, badan: 300, terang: 3800 });
      }),
    );
    // Gesek kursi ditarik (Bang IT duduk).
    audio['bunyi-a-kursi-geser.wav'] = wav(
      await rekam(1.0, (k) => {
        sin.gesek(k, 0.0, 0.3, { frek: 700, frekAkhir: 400, q: 0.6, puncak: 0.2, serang: 0.02 });
        sin.ketuk(k, 0.34, { puncak: 0.25, badan: 150, terang: 1400 });
      }),
    );
    return audio;
  });
  let jumlah = 0;
  for (const [nama, b64] of Object.entries(hasil)) {
    writeFileSync(join(keluar, nama), Buffer.from(b64, 'base64'));
    jumlah++;
  }
  console.log(`${jumlah} bunyi Teaser A ditulis ke ${keluar}`);
} finally {
  await browser.close();
  await server.close();
}
