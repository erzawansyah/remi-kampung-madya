// Perekam rekaman game asli untuk Teaser A (brief A §5, teknik dari §4.3 brief B): menyalakan server rekam
// ber-seed (meja-rekam-a.ts, jeda lanjut 10 dtk), Vite dev client, lalu HP tiruan (Chromium, 390 × 844 @3x)
// untuk tiap kursi manusia. Tiap kursi manusia dimainkan pemain otomatis yang logikanya sama dengan
// otomatis.ts (pilihAksiBot normal + Rng tetap), jadi hasilnya sama dengan pencarian seed (cari-seed-a.ts).
// Yang direkam halaman Bang IT (kursi 0, host). Sesudah putaran 1 selesai (A1), Mas Sampul mengirim ledekan
// dan ledekan besarnya direkam di layar Bang IT. Still tambahan: beranda ?meja=KODE dan isian nama (HP tiruan
// tanpa nama tersimpan, untuk adegan pindai QR), lobi dari halaman Mas Sampul, dan momen kunci halaman Bang IT.
//
// Cara merekam halaman "Kamu": CDP Page.startScreencast dan jepretan BeginFrame hanya memberi gambar
// seukuran CSS halaman (DIP), dan Page.captureScreenshot terlalu lambat untuk 30 fps. Jadi halaman Kamu
// dibuka di Chrome Headless Shell dengan --enable-begin-frame-control dan virtual time: tiap frame, waktu
// halaman dimajukan tepat 1/30 detik (Emulation.setVirtualTimePolicy) lalu satu frame digambar dan dijepret
// (HeadlessExperimental.beginFrame) dan dialirkan ke ffmpeg. Supaya jepretannya 1170 × 2532, aplikasi
// dimuat di <iframe> 390 × 844 yang diperbesar 3× (CSS zoom; transform scale terpotong 844 px di headless)
// di halaman luar 1170 × 2532 @1x. CSS zoom membuat devicePixelRatio di iframe jadi 3, jadi kanvas Phaser
// dan kartu HTML digambar tajam.
// Hasilnya video 30 fps yang mulus dan tidak bergantung pada kecepatan CPU. Halaman pemain lain memakai
// Chromium biasa (waktu nyata). Momen kunci juga dijepret PNG.
//
// Pakai (dari akar repo): node promo/scripts/rekam/rekam-browser-a.mjs <a1|a2> <seed>
// Hasil: promo/public/rekam/<klip>-kamu.mp4, <klip>-*.png, dan rekam-a.json (digabung per klip).
import { execFileSync, spawn } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createServer } from 'vite';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');

const promo = join(dirname(fileURLToPath(import.meta.url)), '../..');
const akar = join(promo, '..');
const client = join(akar, 'apps/client');
const keluar = join(promo, 'public/rekam');
mkdirSync(keluar, { recursive: true });

const klipNama = process.argv[2] ?? 'a1';
const seed = Number(process.argv[3]);
if (!['a1', 'a2'].includes(klipNama) || !Number.isFinite(seed)) {
  console.error('pakai: node promo/scripts/rekam/rekam-browser-a.mjs <a1|a2> <seed>');
  process.exit(1);
}

// Sama dengan konfig-a.ts (ditulis ulang di sini karena berkas ini .mjs tanpa tsx).
const KLIP = {
  a1: { nama: ['Bang IT', 'Cak Owner', 'Mas Sampul'], bot: null, pementung: 1, korban: 0, kamu: 0, peledek: 2 },
  a2: { nama: ['Bang IT', 'Mas Sampul'], bot: { kursi: 2, level: 'normal' }, pementung: 2, korban: 0, kamu: 0, peledek: null },
};
const PENGATURAN = { jumlahPemain: 3, detikGiliran: 0, publik: false, batasPutaran: 2, duaDeckUntukEmpat: false, modeKaldu: false };
/** Ledekan yang dikirim Mas Sampul ke Bang IT sesudah putaran 1 (dari DAFTAR_LEDEKAN, packages/meja/src/protokol.ts). */
const ISI_LEDEK = 'Kepentung, rek!';
const K = KLIP[klipNama];
const PORT_SERVER = 2567;
const PORT_VITE = 5173;
const JEDA_BOT_MS = 1500;
/** Jeda pemain otomatis sesudah view berubah (ms, waktu nyata), supaya animasi selesai dulu. */
const JEDA_PEMAIN_MS = 1400;
const FPS = 30;
const SHELL = process.env.CHROME_HEADLESS_SHELL ?? '/opt/pw-browsers/chromium_headless_shell-1243/chrome-headless-shell-linux64/chrome-headless-shell';

const tunggu = (ms) => new Promise((r) => setTimeout(r, ms));
const log = (...a) => console.log(`[rekam ${klipNama}]`, ...a);

// 1. Server rekam ber-seed (proses sendiri lewat tsx, supaya penggantian randomBytes/Math.random
//    tidak menyentuh proses ini).
const server = spawn(process.execPath, [join(akar, 'node_modules/tsx/dist/cli.mjs'), join(promo, 'scripts/rekam/meja-rekam-a.ts'), String(PORT_SERVER), String(JEDA_BOT_MS)], {
  cwd: akar,
  env: { ...process.env, SEED_REKAM: String(seed) },
  stdio: ['ignore', 'pipe', 'inherit'],
});
await new Promise((siap, gagal) => {
  server.stdout.on('data', (d) => {
    if (String(d).includes('server rekam')) siap();
  });
  server.on('exit', (c) => gagal(new Error(`server rekam berhenti (${c})`)));
});
log('server rekam siap, seed', seed);

// 2. Vite dev client (proxy /ws → :2567 dari vite.config.ts).
const vite = await createServer({ root: client, configFile: join(client, 'vite.config.ts'), logLevel: 'silent', server: { port: PORT_VITE, strictPort: true, host: '127.0.0.1' } });
await vite.listen();
const asal = `http://127.0.0.1:${PORT_VITE}`;
log('vite di', asal);

const browser = await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required'] });
// Halaman Kamu: headless shell dengan kendali BeginFrame (satu frame digambar per perintah).
const browserKamu = await chromium.launch({
  executablePath: SHELL,
  args: ['--enable-begin-frame-control', '--run-all-compositor-stages-before-draw', '--disable-new-content-rendering-timeout', '--disable-threaded-animation', '--disable-threaded-scrolling', '--disable-checker-imaging', '--disable-image-animation-resync', '--autoplay-policy=no-user-gesture-required'],
});

/** Skrip pemain otomatis + pencatat momen, dijalankan di tiap halaman manusia. */
const SKRIP_PEMAIN = `
(async (opsi) => {
  const engine = await import('/@fs' + opsi.engine);
  const now = Date.now.bind(Date);
  const app = () => window.__remiApp;
  const catatan = (window.__rekamCatatan = window.__rekamCatatan ?? []);
  const catat = (jenis, data) => catatan.push({ t: now() / 1000, jenis, ...(data ?? {}) });
  const aksiOtomatis = (v) => {
    const saya = v.saya;
    const p = v.putaran;
    if (saya === null || !p) return null;
    const giliranku = v.status === 'putaranBerjalan' && p.giliran === saya;
    const susunku = v.status === 'susunAkhir' && !p.selesaiSusun[saya];
    if (!giliranku && !susunku) return null;
    const { pemain: _, ...aksi } = engine.pilihAksiBot(v, 'normal', new engine.Rng(20261106));
    return aksi;
  };
  let tandaLama = '';
  let berubahPada = 0;
  let dikirimUntuk = '';
  let dikirimPada = 0;
  let lihatModal = { kunci: '', sejak: 0 };
  let jumlahLog = 0;
  let jumlahLogTampil = 0;
  let adaRetak = false;
  let n = 0;
  const teksLog = (l) => (typeof l === 'string' ? l : l && (l.pesan ?? l.teks)) || '';
  setInterval(() => {
    const a = app();
    const v = a && a.view;
    const kini = now();
    // Jendela: popup joker (OK) dan panel mentung (Lanjut) ditekan sesudah terlihat sebentar.
    const modal = document.querySelector('#modal');
    const joker = modal && modal.querySelector('[data-joker]') ? modal.querySelector('[data-ok]') : null;
    const lanjut = modal && modal.querySelector('[data-mentung]') ? modal.querySelector('[data-lanjut]') : null;
    const kunciModal = joker ? 'joker' : lanjut ? 'mentung' : '';
    if (kunciModal !== lihatModal.kunci) {
      lihatModal = { kunci: kunciModal, sejak: kini };
      if (kunciModal) catat(kunciModal === 'joker' ? 'popupJoker' : 'panelMentung');
    }
    if (joker && kini - lihatModal.sejak > opsi.jedaJoker) joker.click();
    if (lanjut && kini - lihatModal.sejak > opsi.jedaLanjut) lanjut.click();
    const retak = document.querySelector('#retak');
    const retakKini = !!(retak && retak.childElementCount);
    if (retakKini !== adaRetak) {
      adaRetak = retakKini;
      if (retakKini) catat('retak');
    }
    if (modal && modal.querySelector('[data-hasil], [data-selesai]') && !window.__rekamHasilTampil) {
      window.__rekamHasilTampil = true;
      catat('hasilTampil');
    }
    // View yang sedang TAMPIL (sesudah antrian animasi): penanda waktu untuk video.
    const vt = a && a.kontrol && a.kontrol.view;
    if (vt && vt.log.length !== jumlahLogTampil) {
      for (let i = jumlahLogTampil; i < vt.log.length; i++) catat('tampil', { log: teksLog(vt.log[i]) });
      jumlahLogTampil = vt.log.length;
    }
    if (!v) return;
    if (v.log.length !== jumlahLog) {
      for (let i = jumlahLog; i < v.log.length; i++) catat('log', { log: teksLog(v.log[i]) });
      jumlahLog = v.log.length;
      const per = v.peristiwa ?? [];
      const e = per[per.length - 1];
      if (e) catat('peristiwa', { isi: JSON.stringify(e).slice(0, 500) });
    }
    const tanda = JSON.stringify([v.status, v.riwayat.length, v.log.length, v.putaran && v.putaran.giliran, v.putaran && v.putaran.selesaiSusun]);
    if (tanda !== tandaLama) {
      tandaLama = tanda;
      berubahPada = kini;
      return;
    }
    if (kini - berubahPada < opsi.jedaAksi) return;
    if (kunciModal) return;
    // Jangan bertindak selama masih ada yang belum menekan OK popup joker (aksi akan ditolak meja).
    const info = a.info;
    if (info && Array.isArray(info.menungguJoker) && info.menungguJoker.length) return;
    // Aksi yang sama boleh dikirim ulang kalau view tidak berubah lama (misalnya ditolak saat masih menunggu).
    if (dikirimUntuk === tanda && kini - dikirimPada < 4000) return;
    const aksi = aksiOtomatis(v);
    if (!aksi) return;
    dikirimUntuk = tanda;
    dikirimPada = kini;
    n++;
    catat('aksi', { aksi: aksi.jenis });
    a.kirim({ t: 'aksi', aksi, id: 'rekam-' + n });
  }, 120);
})
`;

const enginePath = join(akar, 'packages/engine/src/index.ts');

/** Buka satu HP tiruan dengan nama tersimpan, preferensi video, dan tanpa kartu "Warga baru". */
const SKALA_KAMU = 3;
async function bukaHp(nama, dpr, kamu = false) {
  const context = await (kamu ? browserKamu : browser).newContext({
    viewport: kamu ? { width: 390 * SKALA_KAMU, height: 844 * SKALA_KAMU } : { width: 390, height: 844 },
    deviceScaleFactor: kamu ? 1 : dpr,
    isMobile: true,
    hasTouch: true,
    locale: 'id-ID',
  });
  // Di iframe aplikasi, CSS zoom 3 pada <iframe> membuat devicePixelRatio di dalamnya 3 dengan sendirinya,
  // jadi kanvas Phaser dan kartu HTML digambar tajam tanpa shim.
  await context.addInitScript((nama) => {
    if (localStorage.getItem('remi.nama')) return;
    localStorage.setItem('remi.nama', JSON.stringify(nama));
    localStorage.setItem('remi.preferensi', JSON.stringify({ tutorialSelesai: true, suara: false, musik: false, getar: false, kecepatan: 'normal', efek: 'lengkap' }));
    localStorage.setItem('remi.tawaranPasang', JSON.stringify({ sudahPasang: Date.now(), tundaSampai: Date.now() + 2 * 24 * 3600e3 }));
  }, nama);
  const page = await context.newPage();
  page.on('pageerror', (e) => console.error(`[${nama}] galat halaman:`, e.message));
  const cdp = await context.newCDPSession(page);
  if (kamu) {
    await cdp.send('HeadlessExperimental.enable');
    await cdp.send('Emulation.setVirtualTimePolicy', { policy: 'pause' });
  }
  return { page, cdp };
}

/** Ukuran JPEG dari header SOF (untuk memastikan frame resolusi penuh). */
function ukuranJpeg(b) {
  let i = 2;
  while (i < b.length && b[i] === 0xff) {
    const m = b[i + 1];
    const len = b.readUInt16BE(i + 2);
    if (m === 0xc0 || m === 0xc2) return `${b.readUInt16BE(i + 7)}x${b.readUInt16BE(i + 5)}`;
    i += 2 + len;
  }
  return '?';
}

async function pasangPemain(page, opsi) {
  await page.evaluate(`(${SKRIP_PEMAIN})(${JSON.stringify({ engine: enginePath, ...opsi })})`);
}

const halaman = [];
const catatanLuar = [];
const catatLuar = (jenis, data) => catatanLuar.push({ t: Date.now() / 1000, jenis, ...(data ?? {}) });

// 3. Halaman Bang IT (host, kursi 0) dibuka di headless shell: virtual time hanya maju lewat putaran frame di
//    bawah, jadi putaran itu dinyalakan dulu (frame dibuang sampai `rekamAktif`), dan interaksinya memakai
//    evaluate (bukan click/waitFor Playwright). Aplikasi dimuat di iframe 390 × 844 yang diperbesar 3×.
const video = join(keluar, `${klipNama}-kamu.mp4`);
const ffmpeg = spawn('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'image2pipe', '-framerate', String(FPS), '-i', '-', '-vf', 'scale=trunc(iw/2)*2:trunc(ih/2)*2', '-c:v', 'libx264', '-preset', 'medium', '-crf', '14', '-pix_fmt', 'yuv420p', video], { stdio: ['pipe', 'inherit', 'inherit'] });
let jumlahFrame = 0;
let rekamAktif = false;
let putaranJalan = true;
let ukuranFrame = '';
let cdpKamu = null;
let pageKamu = null;
let frameKamu = null;
let tickKamu = 0;
/** Permintaan jepretan halaman Kamu: dipenuhi putaran frame pada frame berikutnya (JPEG q100 → PNG). */
let mintaJepret = null;
const tulisFrame = (buf) =>
  new Promise((r) => {
    if (ffmpeg.stdin.write(buf)) r();
    else ffmpeg.stdin.once('drain', r);
  });
/** Satu langkah: majukan virtual time 1/FPS detik, gambar satu frame, (opsional) jepret. */
async function langkahFrame(jepret) {
  const interval = 1000 / FPS;
  const habis = new Promise((r) => cdpKamu.once('Emulation.virtualTimeBudgetExpired', r));
  await cdpKamu.send('Emulation.setVirtualTimePolicy', { policy: 'advance', budget: interval, maxVirtualTimeTaskStarvationCount: 10000 });
  await habis;
  tickKamu += interval;
  const p = { frameTimeTicks: tickKamu, interval, noDisplayUpdates: false };
  if (jepret) p.screenshot = jepret;
  return cdpKamu.send('HeadlessExperimental.beginFrame', p);
}
let putaranFrame = null;
function nyalakanPutaranFrame() {
  putaranFrame = (async () => {
    let lapor = 0;
    while (putaranJalan) {
      const t0 = Date.now();
      try {
        const minta = mintaJepret;
        const r = await langkahFrame(rekamAktif || minta ? { format: 'jpeg', quality: minta ? 100 : 92 } : undefined);
        if (r.screenshotData) {
          const buf = Buffer.from(r.screenshotData, 'base64');
          if (!ukuranFrame) {
            ukuranFrame = ukuranJpeg(buf);
            log('ukuran frame', ukuranFrame);
          }
          if (minta) {
            mintaJepret = null;
            writeFileSync(minta.berkas, buf);
            minta.selesai(jumlahFrame / FPS);
          }
          if (rekamAktif) {
            await tulisFrame(buf);
            jumlahFrame++;
          }
        }
      } catch (e) {
        if (putaranJalan) console.error('langkah frame gagal:', e.message);
      }
      // Kalau jepretan cepat, tempo virtual disamakan dengan waktu nyata (1 frame = 1/FPS detik nyata).
      const sisa = 1000 / FPS - (Date.now() - t0);
      if (sisa > 0) await tunggu(sisa);
      if (rekamAktif && Date.now() - lapor > 15_000) {
        lapor = Date.now();
        log(`${jumlahFrame} frame (${(jumlahFrame / FPS).toFixed(0)} dtk video, langkah terakhir ${Date.now() - t0} ms)`);
      }
    }
  })();
}

/** Tunggu sampai video halaman Kamu maju `detik` detik (virtual time), bukan waktu nyata. */
async function tungguVirtual(detik) {
  const target = jumlahFrame + Math.round(detik * FPS);
  while (jumlahFrame < target) await tunggu(50);
}

/** Buka halaman luar 1170 × 2532 berisi iframe aplikasi (url) yang diperbesar 3×; kembalikan frame-nya. */
async function bukaIframe(page, url) {
  await page.goto(`${asal}/@vite/client`, { waitUntil: 'commit' });
  await page.waitForFunction(() => document.readyState !== 'loading', null, { timeout: 60_000, polling: 100 });
  await page.evaluate(({ url, k }) => {
    document.open();
    document.write(`<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><style>html,body{margin:0;background:#000;overflow:hidden}iframe{display:block;width:390px;height:844px;border:0;zoom:${k}}</style></head><body><iframe id="hp" src="${url}" allow="autoplay"></iframe></body></html>`);
    document.close();
  }, { url, k: SKALA_KAMU });
  for (let n = 0; n < 600; n++) {
    const f = page.frames().find((x) => x !== page.mainFrame() && x.url().startsWith(asal) && !x.url().includes('@vite'));
    if (f) return f;
    await tunggu(100);
  }
  throw new Error('iframe aplikasi tidak muncul');
}

const { page: pageHost, cdp: cdpHost } = await bukaHp(K.nama[0], 3, true);
cdpKamu = cdpHost;
pageKamu = pageHost;
tickKamu = await pageHost.evaluate(() => performance.timeOrigin + performance.now());
nyalakanPutaranFrame();
frameKamu = await bukaIframe(pageHost, `${asal}/`);
const host = frameKamu;
halaman.push(host);
await host.waitForFunction(() => !!document.querySelector('#buat'), null, { timeout: 60_000, polling: 100 });
await host.evaluate(() => document.querySelector('#buat').click());
await host.waitForFunction(() => window.__remiApp && window.__remiApp.info && window.__remiApp.info.kode, null, { timeout: 60_000, polling: 100 });
const kode = await host.evaluate(() => window.__remiApp.info.kode);
log('kode meja', kode);
await host.evaluate((p) => window.__remiApp.kirim({ t: 'pengaturan', pengaturan: p }), PENGATURAN);
await tunggu(300);

// 3b. Still untuk adegan pindai QR (HP Mas Sampul tanpa nama tersimpan): beranda ?meja=KODE, lalu isian nama.
{
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true, locale: 'id-ID' });
  await ctx.addInitScript(() => {
    localStorage.setItem('remi.preferensi', JSON.stringify({ tutorialSelesai: true, suara: false, musik: false, getar: false, kecepatan: 'normal', efek: 'lengkap' }));
    localStorage.setItem('remi.tawaranPasang', JSON.stringify({ sudahPasang: Date.now(), tundaSampai: Date.now() + 2 * 24 * 3600e3 }));
  });
  const p = await ctx.newPage();
  await p.goto(`${asal}/?meja=${kode}`);
  await p.locator('#gabung').waitFor({ state: 'visible', timeout: 30_000 });
  await tunggu(900);
  await p.screenshot({ path: join(keluar, `${klipNama}-beranda.png`), type: 'png' });
  // Isian nama ada di beranda (#nama): diisi "Mas Sampul" lalu dijepret.
  await p.locator('#nama').fill('Mas Sampul');
  await p.locator('#nama').dispatchEvent('change');
  await tunggu(500);
  await p.screenshot({ path: join(keluar, `${klipNama}-nama.png`), type: 'png' });
  await ctx.close();
  log('still beranda dan isian nama');
}

// 4. Pemain lain masuk berurutan lewat ?meja=KODE (urutan = nomor kursi, sama dengan cari-seed-a.ts).
for (let i = 1; i < K.nama.length; i++) {
  const nama = K.nama[i];
  const { page } = await bukaHp(nama, 3);
  halaman.push(page);
  await page.goto(`${asal}/?meja=${kode}`);
  await page.locator('#gabung').waitFor({ state: 'visible', timeout: 30_000 });
  await page.locator('#gabung').click();
  await page.waitForFunction((k) => window.__remiApp && window.__remiApp.info && window.__remiApp.info.kode === k, kode, { timeout: 60_000, polling: 100 });
  log(nama, 'masuk kursi', await page.evaluate(() => window.__remiApp.info.kursiSaya));
}
const kamu = halaman[K.kamu]; // Frame iframe aplikasi (halaman Kamu)
await tunggu(800);

// 5. Mulai menulis frame halaman Kamu ke ffmpeg (sejak lobi).
const d0Kamu = await kamu.evaluate(() => Date.now());
rekamAktif = true;
const mulaiRekam = Date.now() / 1000;
catatLuar('mulaiRekam');

const jepretanKamu = [];
const jepret = async (page, nama) => {
  const berkas = join(keluar, `${klipNama}-${nama}.png`);
  if (page === frameKamu) {
    // Halaman Kamu: diambil putaran frame (JPEG kualitas 100), dikonversi ke PNG di akhir.
    const sementara = berkas.replace(/\.png$/, '.jpg');
    const detikVideo = await new Promise((selesai) => {
      mintaJepret = { berkas: sementara, selesai };
    });
    jepretanKamu.push({ sementara, berkas });
    catatLuar('jepret', { nama, detikVideo: Number(detikVideo.toFixed(3)) });
  } else {
    await page.screenshot({ path: berkas, type: 'png' });
    catatLuar('jepret', { nama });
  }
  log('jepret', nama);
};

// Pemain otomatis dipasang di semua halaman manusia (Kamu menahan popup/panel lebih lama supaya terekam).
for (let i = 0; i < halaman.length; i++) {
  const sayaKamu = i === K.kamu;
  await pasangPemain(halaman[i], { jedaAksi: JEDA_PEMAIN_MS, jedaJoker: sayaKamu ? 2600 : 1200, jedaLanjut: sayaKamu ? 6500 : 2500 });
}

await tungguVirtual(1.6);
await jepret(kamu, 'lobi');
if (K.peledek !== null) await jepret(halaman[K.peledek], 'sampul-lobi');
// 6. Kursi bot diisi host (R2, R3), lalu mulai dengan pengocok 0: urutan sama persis dengan cari-seed.ts.
//    Jeda dihitung dalam waktu video (virtual) supaya lobi dan kursi bot terlihat cukup lama di rekaman.
if (K.bot) {
  await tungguVirtual(0.8);
  await host.evaluate((b) => window.__remiApp.kirim({ t: 'aturKursi', kursi: b.kursi, jenis: 'bot', level: b.level }), K.bot);
  catatLuar('isiBot', { detikVideo: Number((jumlahFrame / FPS).toFixed(3)) });
  await tungguVirtual(2.6);
  await jepret(kamu, 'lobi-bot');
  await tungguVirtual(0.6);
} else await tungguVirtual(1.2);
await host.evaluate(() => window.__remiApp.kirim({ t: 'mulai', pengocok: 0 }));
catatLuar('mulai', { detikVideo: Number((jumlahFrame / FPS).toFixed(3)) });
log('mulai');

// 7. Tunggu sampai putaran selesai dan layar hasil tampil di halaman Kamu, sambil menjepret momen kunci.
let sudahRetak = false;
let sudahPanel = false;
const batas = Date.now() + Number(process.env.BATAS_REKAM_MENIT ?? 25) * 60_000;
let hasilAkhir = null;
let lapor = 0;
while (Date.now() < batas) {
  await tunggu(200);
  const c = await kamu.evaluate(() => ({ catatan: window.__rekamCatatan ?? [], hasil: !!window.__rekamHasilTampil, status: window.__remiApp?.view?.status, riwayat: window.__remiApp?.view?.riwayat ?? [] }));
  if (Date.now() - lapor > 15_000) {
    lapor = Date.now();
    const akhir = c.catatan.slice(-3).map((x) => x.jenis + (x.aksi ? ':' + x.aksi : '')).join(' ');
    log('progres', JSON.stringify({ status: c.status, catatan: c.catatan.length, akhir }));
  }
  if (!sudahRetak && c.catatan.some((x) => x.jenis === 'retak')) {
    sudahRetak = true;
    await tunggu(350);
    await jepret(kamu, 'retak');
  }
  if (!sudahPanel && c.catatan.some((x) => x.jenis === 'panelMentung')) {
    sudahPanel = true;
    await tunggu(900);
    await jepret(kamu, 'panel');
  }
  if (c.hasil) {
    await tunggu(2500);
    await jepret(kamu, 'hasil');
    hasilAkhir = c.riwayat[0] ?? null;
    if (K.peledek !== null) {
      // Ledekan dari Mas Sampul ke Bang IT (hanya sah di hasil putaran), lalu ledekan besar direkam di layar Bang IT.
      await tunggu(600);
      await halaman[K.peledek].evaluate(({ ke, isi }) => window.__remiApp.kirim({ t: 'ledek', ke, isi }), { ke: K.kamu, isi: ISI_LEDEK });
      catatLuar('ledek', { detikVideo: Number((jumlahFrame / FPS).toFixed(3)) });
      const mulaiTunggu = Date.now();
      let tampil = false;
      while (Date.now() - mulaiTunggu < 15_000) {
        await tunggu(100);
        if (await kamu.evaluate(() => !!document.querySelector('#lapisan-ledek .ledek-besar'))) {
          tampil = true;
          break;
        }
      }
      if (tampil) {
        catatLuar('ledekTampil', { detikVideo: Number((jumlahFrame / FPS).toFixed(3)) });
        await tunggu(700);
        await jepret(kamu, 'ledek');
        await tungguVirtual(2.4);
      } else console.error('ledekan besar tidak tampil di halaman Bang IT');
    }
    await tungguVirtual(0.6);
    break;
  }
}
await tunggu(300);
const catatanKamu = await kamu.evaluate(() => window.__rekamCatatan ?? []);
rekamAktif = false;
putaranJalan = false;
await putaranFrame;
ffmpeg.stdin.end();
await new Promise((r) => ffmpeg.on('exit', r));
for (const j of jepretanKamu) {
  execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-i', j.sementara, j.berkas]);
  rmSync(j.sementara, { force: true });
}
await browserKamu.close();
await browser.close();
await vite.close();
server.kill();

if (!hasilAkhir) {
  console.error('catatan Kamu:', JSON.stringify(catatanKamu.slice(-12)));
  throw new Error('putaran tidak selesai dalam batas waktu');
}
const cocok = hasilAkhir.cara === 'mentung' && hasilAkhir.pementung === K.pementung && hasilAkhir.kepentung.includes(K.korban);
log(`hasil: ${hasilAkhir.cara}, pementung ${hasilAkhir.pementung}, kepentung ${hasilAkhir.kepentung.join(',')}, joker ${hasilAkhir.pentunganJoker} → ${cocok ? 'COCOK' : 'TIDAK COCOK dengan cari-seed'}`);
log(`${jumlahFrame} frame = ${(jumlahFrame / FPS).toFixed(1)} dtk video, ${ukuranFrame} → ${video}`);

// 8. rekam.json: kode, seed, hasil, dan momen kunci dalam detik video. Halaman Kamu memakai virtual time
//    (Date.now di halaman maju tepat 1/FPS per frame), jadi detik video = Date.now halaman − awal rekam.
const relatif = (xs) => xs.map(({ t, ...sisa }) => ({ detik: Number((t - d0Kamu / 1000).toFixed(3)), ...sisa }));
const relatifNyata = (xs) => xs.map(({ t, ...sisa }) => ({ detikNyata: Number((t - mulaiRekam).toFixed(3)), ...sisa }));
const jalurJson = join(keluar, 'rekam-a.json');
const semua = existsSync(jalurJson) ? JSON.parse(readFileSync(jalurJson, 'utf8')) : {};
semua[klipNama] = {
  seed,
  kode,
  cocok,
  hasil: { cara: hasilAkhir.cara, pementung: hasilAkhir.pementung, kepentung: hasilAkhir.kepentung, pentunganJoker: hasilAkhir.pentunganJoker, pentungan: hasilAkhir.pentungan, rankJoker: hasilAkhir.rankJoker },
  nama: K.nama,
  kamu: K.kamu,
  video: `${klipNama}-kamu.mp4`,
  lamaDetik: Number((jumlahFrame / FPS).toFixed(3)),
  // Momen di halaman Kamu (detik video): 'tampil' = log yang sudah tampil di layar (sesudah animasi),
  // 'retak', 'panelMentung', 'popupJoker', 'hasilTampil' dari DOM; 'aksi'/'log'/'peristiwa' = saat view diterima.
  momen: relatif(catatanKamu),
  // Momen dari luar halaman (waktu nyata sejak rekam mulai; 'jepret' halaman Kamu juga membawa detikVideo).
  momenLuar: relatifNyata(catatanLuar),
};
writeFileSync(jalurJson, JSON.stringify(semua, null, 2));
log('rekam-a.json diperbarui');
process.exit(cocok ? 0 : 2);
