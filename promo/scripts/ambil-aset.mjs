// Ambil aset video langsung dari kode game, supaya video promosi memakai gambar dan bunyi yang sama
// persis dengan yang dilihat pemain:
// - kartu (muka dan punggung) dari apps/client/src/game/kartuGrafisGambar.ts
// - logo Kedai Madya dari apps/client/src/aset/logoMadya.ts
// - retakan kaca kepentung dari apps/client/src/efek/retak.ts
// - musik latar dan bunyi dari apps/client/src/efek/musik.ts dan suara.ts (direkam offline)
// - font Baloo 2 dari apps/client/public/font
//
// Caranya: nyalakan Vite dev server client (tanpa membuka port tetap), buka di Chromium headless,
// impor modul-modul itu di halaman, lalu simpan hasilnya ke promo/public/aset (diabaikan git).
//
// Pakai: npm install di akar repo dulu, lalu `npm run aset` di folder promo.
// Chromium: env CHROME_PATH, kalau kosong /opt/pw-browsers/chromium, kalau tidak ada bawaan playwright.

import { existsSync, mkdirSync, copyFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createServer } from 'vite';
import { chromium } from 'playwright-core';

const promo = join(dirname(fileURLToPath(import.meta.url)), '..');
const akar = join(promo, '..');
const client = join(akar, 'apps/client');
const keluar = join(promo, 'public/aset');
mkdirSync(keluar, { recursive: true });

/** Kartu yang dipakai di video: kartu dari putaran sungguhan (meja DRRS8, joker 6). */
const KARTU = [
  ['wajik', 2], ['wajik', 3], ['wajik', 6], ['wajik', 8], ['wajik', 10],
  ['love', 4], ['love', 6], ['love', 8], ['love', 11], ['love', 12],
  ['waru', 6], ['waru', 7], ['kriting', 6], ['kriting', 12],
  // Kembar As dan seri Londo untuk adegan aturan.
  ['love', 1], ['wajik', 1], ['kriting', 1], ['waru', 1], ['waru', 11], ['waru', 12], ['waru', 13],
];

/** Bunyi yang direkam (nama file → jenis atau rangkaian). */
const BUNYI = {
  kocok: 'kocok',
  bagi: 'bagi',
  balik: 'balik',
  buang: 'buang',
  mulung: 'mulung',
  letak: 'letak',
  giliran: 'giliran',
  // Pentungan ditaruh tertutup, kendang tegang, lalu dibuka: ternyata joker.
  pentungJoker: [
    { jenis: 'tegang', detik: 0 },
    { jenis: 'mentungJoker', detik: 1.2 },
  ],
  jotos: 'jotos',
  sorak: 'sorak',
  klik: 'klik',
};

const DETIK_MUSIK = 48;

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
const browser = await chromium.launch({
  executablePath: jalurChrome,
  args: ['--autoplay-policy=no-user-gesture-required'],
});

try {
  const page = await browser.newPage();
  page.on('pageerror', (e) => console.error('[halaman]', e.message));
  // Halaman kosong di origin Vite (bukan index.html, supaya aplikasi tidak ikut jalan).
  await page.goto(new URL('/@vite/client', alamat).href);

  const hasil = await page.evaluate(
    async ({ KARTU, BUNYI, DETIK_MUSIK }) => {
      // Musik dan bunyi memakai Math.random: dibuat tetap supaya hasil render bisa diulang.
      let s = 20261106;
      Math.random = () => {
        s = (s + 0x6d2b79f5) | 0;
        let t = Math.imul(s ^ (s >>> 15), 1 | s);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
      };

      const grafis = await import('/src/game/kartuGrafisGambar.ts');
      const logo = await import('/src/aset/logoMadya.ts');
      const retak = await import('/src/efek/retak.ts');
      const suara = await import('/src/efek/suara.ts');
      const musik = await import('/src/efek/musik.ts');

      const png = (kanvas) => kanvas.toDataURL('image/png').split(',')[1];
      const kanvas = (w, h) => {
        const k = document.createElement('canvas');
        k.width = w;
        k.height = h;
        return [k, k.getContext('2d')];
      };

      const gambar = {};
      const LEBAR = 520;
      const TINGGI = Math.round(LEBAR * grafis.RASIO_KARTU);
      for (const [bunga, rank] of KARTU) {
        const [k, ctx] = kanvas(LEBAR, TINGGI);
        grafis.gambarKartu(ctx, { bunga, rank }, LEBAR, 'normal', 'dua');
        gambar[`kartu-${bunga}-${rank}.png`] = png(k);
      }
      {
        const [k, ctx] = kanvas(LEBAR, TINGGI);
        grafis.gambarKartu(ctx, null, LEBAR, 'normal', 'dua', 'maskot');
        gambar['kartu-punggung.png'] = png(k);
      }
      {
        // Bayangan kartu persis seperti di meja.
        const { w, h } = grafis.ukuranPendukung(LEBAR);
        const [k, ctx] = kanvas(Math.ceil(w), Math.ceil(h));
        grafis.gambarBayangan(ctx, LEBAR);
        gambar['kartu-bayangan.png'] = png(k);
      }
      // Retakan kaca layar penuh (versi kuat: kepentung pentungan joker), 1080 × 1920.
      {
        const W = 1080;
        const H = 1920;
        const [k, ctx] = kanvas(W, H);
        const pola = retak.polaRetak({ x: W * 0.5, y: H * 0.46, jari: Math.hypot(W, H) * 0.85 * 0.5, benih: 7, sinar: 15, cincin: 3, tebal: 3.2 * 2 });
        retak.gambarRetak(ctx, pola, { skala: 2, rinci: true });
        gambar['retak.png'] = png(k);
      }

      const svg = {
        'logo-lengkap.svg': logo.svgLogo('lengkap'),
        'logo-maskot.svg': logo.svgLogo('maskot'),
      };

      // AudioBuffer → WAV 16-bit (base64).
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
      for (const [nama, jenis] of Object.entries(BUNYI)) audio[`bunyi-${nama}.wav`] = wav(await suara.rekamBunyi(jenis));
      audio['musik.wav'] = wav(await musik.rekamMusik('beranda', DETIK_MUSIK));

      return { gambar, svg, audio };
    },
    { KARTU, BUNYI, DETIK_MUSIK },
  );

  let jumlah = 0;
  for (const [nama, b64] of Object.entries({ ...hasil.gambar, ...hasil.audio })) {
    writeFileSync(join(keluar, nama), Buffer.from(b64, 'base64'));
    jumlah++;
  }
  for (const [nama, isi] of Object.entries(hasil.svg)) {
    writeFileSync(join(keluar, nama), isi);
    jumlah++;
  }
  copyFileSync(join(client, 'public/font/baloo2-latin.woff2'), join(keluar, 'baloo2-latin.woff2'));
  console.log(`${jumlah + 1} aset ditulis ke ${keluar}`);
} finally {
  await browser.close();
  await server.close();
}
