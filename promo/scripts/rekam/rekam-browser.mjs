// Perekam rekaman game asli untuk Teaser B (brief §4.3): menyalakan server rekam ber-seed (meja-rekam.ts),
// Vite dev client, lalu HP tiruan (Chromium, 390 × 844 @3x) untuk tiap kursi manusia. Tiap kursi manusia
// dimainkan pemain otomatis yang logikanya sama dengan otomatis.ts (pilihAksiBot normal + Rng tetap),
// jadi hasilnya sama dengan pencarian seed (cari-seed.ts).
//
// Cara merekam halaman "Kamu": Chrome biasa, waktu nyata. Aplikasi dimuat di <iframe> 390 × 844 dengan
// CSS `zoom: 3` di halaman luar 1170 × 2532 @1x, jadi screencast CDP (Page.startScreencast, yang selalu
// seukuran CSS halaman) memberi frame 1170 × 2532, dan devicePixelRatio di iframe jadi 3 sehingga kanvas
// Phaser digambar tajam. Frame disimpan dengan cap waktunya lalu disusun jadi video 30 fps (ffmpeg concat).
// Kanvas digambar renderer Canvas Phaser (WebGL software membuat kartu bolong, lihat bukaHp). Tanpa GPU,
// kanvas 3× hanya tergambar ±6–9 fps, jadi halaman Kamu diperlambat DILASI kali (jam halaman,
// timer, requestAnimationFrame lewat shim di iframe; animasi CSS lewat Animation.setPlaybackRate). Jeda warga
// kedai di server dan jeda pemain lain ikut dikali DILASI, jadi tempo meja di video tetap seperti aslinya.
// Cap waktu frame dibagi DILASI saat disusun.
// Catatan: jangan kembali ke --enable-begin-frame-control + virtual time. Cara itu kadang menjepret kanvas
// sebelum selesai digambar, sehingga kartu yang sedang bergerak tampil bolong/terpotong/berkedip.
//
// Pakai (dari akar repo): node promo/scripts/rekam/rekam-browser.mjs <r1|r2|r3> <seed>
// Hasil: promo/public/rekam/<klip>-kamu.mp4, <klip>-*.png, dan rekam.json (digabung per klip).
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

const klipNama = process.argv[2] ?? 'r1';
const seed = Number(process.argv[3]);
if (!['r1', 'r2', 'r3'].includes(klipNama) || !Number.isFinite(seed)) {
  console.error('pakai: node promo/scripts/rekam/rekam-browser.mjs <r1|r2|r3> <seed>');
  process.exit(1);
}

// Sama dengan konfig.ts (ditulis ulang di sini karena berkas ini .mjs tanpa tsx).
const KLIP = {
  r1: { nama: ['Dimas', 'Ayu', 'Rendi', 'Kamu'], bot: null, pementung: 1, korban: 3, kamu: 3 },
  r2: { nama: ['Dimas', 'Ayu', 'Kamu'], bot: { kursi: 3, level: 'normal' }, pementung: 3, korban: 2, kamu: 2 },
  r3: { nama: ['Dimas', 'Ayu', 'Kamu'], bot: { kursi: 3, level: 'normal' }, pementung: 2, korban: 3, kamu: 2 },
};
const PENGATURAN = { jumlahPemain: 4, detikGiliran: 0, publik: false, batasPutaran: 1, duaDeckUntukEmpat: false, modeKaldu: false };
const K = KLIP[klipNama];
const PORT_SERVER = 2567;
const PORT_VITE = 5173;
const JEDA_BOT_MS = 1500;
/** Halaman Kamu berjalan sekian kali lebih lambat dari waktu nyata (lihat catatan di atas). */
const DILASI = Number(process.env.DILASI_REKAM ?? 8);
/** Jeda pemain otomatis sesudah view berubah (ms, waktu nyata), supaya animasi selesai dulu. */
const JEDA_PEMAIN_MS = 1400;
const FPS = 30;

const tunggu = (ms) => new Promise((r) => setTimeout(r, ms));
const log = (...a) => console.log(`[rekam ${klipNama}]`, ...a);

// 1. Server rekam ber-seed (proses sendiri lewat tsx, supaya penggantian randomBytes/Math.random
//    tidak menyentuh proses ini).
const server = spawn(process.execPath, [join(akar, 'node_modules/tsx/dist/cli.mjs'), join(promo, 'scripts/rekam/meja-rekam.ts'), String(PORT_SERVER), String(JEDA_BOT_MS * DILASI)], {
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
  const context = await browser.newContext({
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
  // Phaser memakai renderer Canvas, bukan WebGL. Tanpa GPU, WebGL jatuh ke rasterizer software yang kadang
  // hanya menggambar separuh segitiga tiap kartu (kartu bolong/terpotong/berkedip). Canvas adalah jalur
  // cadangan Phaser.AUTO yang sama dengan di HP tanpa WebGL, dan menggambar kartunya utuh.
  await context.addInitScript(() => {
    const asli = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function (jenis, ...a) {
      return /webgl/i.test(String(jenis)) ? null : asli.call(this, jenis, ...a);
    };
  });
  if (kamu) {
    // Jam halaman diperlambat (hanya di iframe aplikasi; halaman luar dan perekam tetap waktu nyata).
    await context.addInitScript((k) => {
      if (window.top === window || window.__dilasi) return;
      window.__dilasi = k;
      const pn = performance.now.bind(performance);
      const dn = Date.now.bind(Date);
      const p0 = pn();
      const d0 = dn();
      performance.now = () => p0 + (pn() - p0) / k;
      Date.now = () => d0 + (dn() - d0) / k;
      const st = window.setTimeout.bind(window);
      const si = window.setInterval.bind(window);
      window.setTimeout = (fn, ms = 0, ...a) => st(fn, Number(ms) * k, ...a);
      window.setInterval = (fn, ms = 0, ...a) => si(fn, Number(ms) * k, ...a);
      const raf = window.requestAnimationFrame.bind(window);
      window.requestAnimationFrame = (cb) => raf((t) => cb(p0 + (t - p0) / k));
    }, DILASI);
  }
  const page = await context.newPage();
  page.on('pageerror', (e) => console.error(`[${nama}] galat halaman:`, e.message));
  const cdp = await context.newCDPSession(page);
  if (kamu) {
    await cdp.send('Animation.enable');
    await cdp.send('Animation.setPlaybackRate', { playbackRate: 1 / DILASI });
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

// 3. Host membuat meja lewat UI beranda, lalu pengaturan dikirim langsung.
const { page: host } = await bukaHp(K.nama[0], 2);
halaman.push(host);
await host.goto(`${asal}/`);
await host.locator('#buat').waitFor({ state: 'visible', timeout: 30_000 });
await host.locator('#buat').click();
await host.waitForFunction(() => window.__remiApp && window.__remiApp.info && window.__remiApp.info.kode, null, { timeout: 20_000 });
const kode = await host.evaluate(() => window.__remiApp.info.kode);
log('kode meja', kode);
await host.evaluate((p) => window.__remiApp.kirim({ t: 'pengaturan', pengaturan: p }), PENGATURAN);
await tunggu(300);

// 4. Pemain lain masuk berurutan lewat ?meja=KODE (urutan = nomor kursi, sama dengan cari-seed.ts).
//    Halaman Kamu: halaman luar 1170 × 2532 berisi iframe aplikasi yang diperbesar 3×; screencast-nya
//    dinyalakan sebelum aplikasi dimuat, frame baru disimpan sejak `rekamAktif`.
const video = join(keluar, `${klipNama}-kamu.mp4`);
const folderFrame = join(keluar, `${klipNama}-frame`);
rmSync(folderFrame, { recursive: true, force: true });
mkdirSync(folderFrame, { recursive: true });
/** Frame tersimpan: cap waktu (detik sejak epoch, dari Chrome) dan nama berkas. */
const frames = [];
let rekamAktif = false;
let ukuranFrame = '';
let cdpKamu = null;
let pageKamu = null;
let frameKamu = null;
function pasangScreencast() {
  cdpKamu.on('Page.screencastFrame', async (f) => {
    try {
      await cdpKamu.send('Page.screencastFrameAck', { sessionId: f.sessionId });
    } catch {
      /* screencast sudah berhenti */
    }
    if (!rekamAktif) return;
    const buf = Buffer.from(f.data, 'base64');
    if (!ukuranFrame) {
      ukuranFrame = ukuranJpeg(buf);
      log('ukuran frame', ukuranFrame);
    }
    const berkas = `f${String(frames.length).padStart(6, '0')}.jpg`;
    frames.push({ t: f.metadata.timestamp, berkas });
    writeFileSync(join(folderFrame, berkas), buf);
  });
  return cdpKamu.send('Page.startScreencast', { format: 'jpeg', quality: 92, everyNthFrame: 1 });
}
/** Detik video sekarang (sejak frame pertama). */
const detikVideo = () => (frames.length ? (Date.now() / 1000 - frames[0].t) / DILASI : 0);
let laporFrame = 0;
setInterval(() => {
  if (!rekamAktif || Date.now() - laporFrame < 15_000) return;
  laporFrame = Date.now();
  const d = detikVideo();
  log(`${frames.length} frame, ${d.toFixed(1)} dtk video (${(frames.length / Math.max(1, d)).toFixed(1)} fps)`);
}, 1000).unref();

for (let i = 1; i < K.nama.length; i++) {
  const nama = K.nama[i];
  const sayaKamu = i === K.kamu;
  const { page, cdp } = await bukaHp(nama, sayaKamu ? 3 : 2, sayaKamu);
  halaman.push(page);
  if (sayaKamu) {
    cdpKamu = cdp;
    pageKamu = page;
    await pasangScreencast();
    // Halaman luar di origin Vite (supaya iframe-nya satu origin), lalu diisi iframe aplikasi yang diperbesar.
    await page.goto(`${asal}/@vite/client`, { waitUntil: 'commit' });
    await page.waitForFunction(() => document.readyState !== 'loading', null, { timeout: 300_000, polling: 100 });
    await page.evaluate(({ url, k }) => {
      document.open();
      document.write(`<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><style>html,body{margin:0;background:#000;overflow:hidden}iframe{display:block;width:390px;height:844px;border:0;zoom:${k}}</style></head><body><iframe id="hp" src="${url}" allow="autoplay"></iframe></body></html>`);
      document.close();
    }, { url: `${asal}/?meja=${kode}`, k: SKALA_KAMU });
    const frame = await (async () => {
      for (let n = 0; n < 600; n++) {
        const f = page.frames().find((x) => x !== page.mainFrame() && x.url().includes('meja='));
        if (f) return f;
        await tunggu(100);
      }
      throw new Error('iframe aplikasi tidak muncul');
    })();
    frameKamu = frame;
    await frame.waitForFunction(() => !!document.querySelector('#gabung'), null, { timeout: 300_000, polling: 100 });
    await frame.evaluate(() => document.querySelector('#gabung').click());
    await frame.waitForFunction((k) => window.__remiApp && window.__remiApp.info && window.__remiApp.info.kode === k, kode, { timeout: 300_000, polling: 100 });
    log(nama, 'masuk kursi', await frame.evaluate(() => window.__remiApp.info.kursiSaya));
    halaman[i] = frame;
    continue;
  } else {
    await page.goto(`${asal}/?meja=${kode}`);
    await page.locator('#gabung').waitFor({ state: 'visible', timeout: 30_000 });
    await page.locator('#gabung').click();
  }
  await page.waitForFunction((k) => window.__remiApp && window.__remiApp.info && window.__remiApp.info.kode === k, kode, { timeout: 300_000, polling: 100 });
  log(nama, 'masuk kursi', await page.evaluate(() => window.__remiApp.info.kursiSaya));
}
const kamu = halaman[K.kamu]; // Frame iframe aplikasi (halaman Kamu)
await tunggu(800);

// 5. Mulai menulis frame halaman Kamu ke ffmpeg (sejak lobi).
rekamAktif = true;
// Jam halaman Kamu (diperlambat) dan jam nyata pada saat yang sama, untuk memetakan catatan ke detik video.
const jamHalamanAwal = (await kamu.evaluate(() => Date.now())) / 1000;
const jamNyataAwal = Date.now() / 1000;
const mulaiRekam = Date.now() / 1000;
catatLuar('mulaiRekam');

const jepret = async (page, nama) => {
  const berkas = join(keluar, `${klipNama}-${nama}.png`);
  if (page === frameKamu) {
    // Halaman Kamu: jepret halaman luar (1170 × 2532, iframe diperbesar 3×).
    await pageKamu.screenshot({ path: berkas, type: 'png' });
    catatLuar('jepret', { nama, detikVideo: Number(detikVideo().toFixed(3)) });
  } else {
    await page.screenshot({ path: berkas, type: 'png' });
    catatLuar('jepret', { nama });
  }
  log('jepret', nama);
};

// Pemain otomatis dipasang di semua halaman manusia (Kamu menahan popup/panel lebih lama supaya terekam).
for (let i = 0; i < halaman.length; i++) {
  const sayaKamu = i === K.kamu;
  // Kamu: jeda dalam jam halaman (sudah diperlambat). Pemain lain: waktu nyata, dikali DILASI.
  const k = sayaKamu ? 1 : DILASI;
  await pasangPemain(halaman[i], { jedaAksi: JEDA_PEMAIN_MS * k, jedaJoker: (sayaKamu ? 2600 : 1200) * k, jedaLanjut: (sayaKamu ? 6500 : 2500) * k });
}

await tunggu(1000 * 1.6 * DILASI);
await jepret(kamu, 'lobi');
// 6. Kursi bot diisi host (R2, R3), lalu mulai dengan pengocok 0: urutan sama persis dengan cari-seed.ts.
//    Jeda dihitung dalam waktu video (virtual) supaya lobi dan kursi bot terlihat cukup lama di rekaman.
if (K.bot) {
  await tunggu(1000 * 0.8 * DILASI);
  await host.evaluate((b) => window.__remiApp.kirim({ t: 'aturKursi', kursi: b.kursi, jenis: 'bot', level: b.level }), K.bot);
  catatLuar('isiBot', { detikVideo: Number(detikVideo().toFixed(3)) });
  await tunggu(1000 * 2.6 * DILASI);
  await jepret(kamu, 'lobi-bot');
  await tunggu(1000 * 0.6 * DILASI);
} else await tunggu(1000 * 1.2 * DILASI);
await host.evaluate(() => window.__remiApp.kirim({ t: 'mulai', pengocok: 0 }));
catatLuar('mulai', { detikVideo: Number(detikVideo().toFixed(3)) });
log('mulai');

// 7. Tunggu sampai putaran selesai dan layar hasil tampil di halaman Kamu, sambil menjepret momen kunci.
let sudahRetak = false;
let sudahPanel = false;
let sudahHostPanel = false;
let sudahHostSusun = false;
const batas = Date.now() + Number(process.env.BATAS_REKAM_MENIT ?? 50) * 60_000;
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
  // R3: layar Dimas sesaat sesudah pentungan Kamu terbuka (panel warga kedai retak, sebelum panel mentung).
  if (klipNama === 'r3' && !sudahHostSusun) {
    const h = await host.evaluate(() => (window.__rekamCatatan ?? []).some((x) => x.jenis === 'log' && /mentung pakai/.test(x.log ?? '')));
    if (h) {
      sudahHostSusun = true;
      await tunggu(1700);
      await jepret(host, 'lawan-retak');
    }
  }
  if (klipNama === 'r3' && sudahHostSusun && !sudahHostPanel) {
    const h = await host.evaluate(() => (window.__rekamCatatan ?? []).some((x) => x.jenis === 'panelMentung'));
    if (h) {
      sudahHostPanel = true;
      await tunggu(400);
      await jepret(host, 'lawan-panel');
    }
  }
  if (!sudahRetak && c.catatan.some((x) => x.jenis === 'retak')) {
    sudahRetak = true;
    await tunggu(350 * DILASI);
    await jepret(kamu, 'retak');
  }
  if (!sudahPanel && c.catatan.some((x) => x.jenis === 'panelMentung')) {
    sudahPanel = true;
    await tunggu(900 * DILASI);
    await jepret(kamu, 'panel');
  }
  if (c.hasil) {
    await tunggu(2500 * DILASI);
    await jepret(kamu, 'hasil');
    hasilAkhir = c.riwayat[0] ?? null;
    break;
  }
}
await tunggu(300 * DILASI);
const catatanKamu = await kamu.evaluate(() => window.__rekamCatatan ?? []);
const catatanHost = await host.evaluate(() => window.__rekamCatatan ?? []);
rekamAktif = false;
await cdpKamu.send('Page.stopScreencast').catch(() => {});
await browser.close();
await vite.close();
server.kill();

if (!hasilAkhir) {
  console.error('catatan Kamu:', JSON.stringify(catatanKamu.slice(-12)));
  console.error('catatan host:', JSON.stringify(catatanHost.slice(-6)));
  throw new Error('putaran tidak selesai dalam batas waktu');
}
const cocok = hasilAkhir.cara === 'mentung' && hasilAkhir.pementung === K.pementung && hasilAkhir.kepentung.includes(K.korban);
log(`hasil: ${hasilAkhir.cara}, pementung ${hasilAkhir.pementung}, kepentung ${hasilAkhir.kepentung.join(',')}, joker ${hasilAkhir.pentunganJoker} → ${cocok ? 'COCOK' : 'TIDAK COCOK dengan cari-seed'}`);

// 8. Frame → video 30 fps: concat demuxer dengan durasi tiap frame dari selisih cap waktu, lalu fps=30.
const daftar = [];
for (let i = 0; i < frames.length; i++) {
  const lama = i + 1 < frames.length ? Math.max(0.0005, (frames[i + 1].t - frames[i].t) / DILASI) : 1 / FPS;
  daftar.push(`file '${join(folderFrame, frames[i].berkas)}'`, `duration ${lama.toFixed(5)}`);
}
daftar.push(`file '${join(folderFrame, frames[frames.length - 1].berkas)}'`);
writeFileSync(join(folderFrame, 'daftar.txt'), daftar.join('\n'));
execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'concat', '-safe', '0', '-i', join(folderFrame, 'daftar.txt'), '-vf', `fps=${FPS},scale=trunc(iw/2)*2:trunc(ih/2)*2`, '-c:v', 'libx264', '-preset', 'medium', '-crf', '14', '-pix_fmt', 'yuv420p', video]);
const lamaRekam = (frames.at(-1).t - frames[0].t) / DILASI;
const selang = frames.slice(1).map((f, i) => (f.t - frames[i].t) / DILASI).sort((a, b) => a - b);
log(`${frames.length} frame dalam ${lamaRekam.toFixed(1)} dtk (${(frames.length / lamaRekam).toFixed(1)} fps rata-rata waktu video, selang p90 ${(selang[Math.floor(selang.length * 0.9)] * 1000).toFixed(0)} ms, terpanjang ${(selang.at(-1) * 1000).toFixed(0)} ms), ${ukuranFrame} → ${video}`);
rmSync(folderFrame, { recursive: true, force: true });

// 9. rekam.json: kode, seed, hasil, dan momen kunci dalam detik video (waktu nyata sejak frame pertama).
// Detik video 0 = frame pertama. Catatan halaman Kamu memakai jam halaman (diperlambat).
const jamHalamanNol = jamHalamanAwal + (frames[0].t - jamNyataAwal) / DILASI;
const relatif = (xs) => xs.map(({ t, ...sisa }) => ({ detik: Number((t - jamHalamanNol).toFixed(3)), ...sisa }));
const relatifNyata = (xs) => xs.map(({ t, ...sisa }) => ({ detikNyata: Number((t - mulaiRekam).toFixed(3)), ...sisa }));
const jalurJson = join(keluar, 'rekam.json');
const semua = existsSync(jalurJson) ? JSON.parse(readFileSync(jalurJson, 'utf8')) : {};
semua[klipNama] = {
  seed,
  kode,
  cocok,
  hasil: { cara: hasilAkhir.cara, pementung: hasilAkhir.pementung, kepentung: hasilAkhir.kepentung, pentunganJoker: hasilAkhir.pentunganJoker, pentungan: hasilAkhir.pentungan, rankJoker: hasilAkhir.rankJoker },
  nama: K.nama,
  kamu: K.kamu,
  video: `${klipNama}-kamu.mp4`,
  lamaDetik: Number(lamaRekam.toFixed(3)),
  fpsRekam: Number((frames.length / lamaRekam).toFixed(1)),
  dilasi: DILASI,
  // Momen di halaman Kamu (detik video): 'tampil' = log yang sudah tampil di layar (sesudah animasi),
  // 'retak', 'panelMentung', 'popupJoker', 'hasilTampil' dari DOM; 'aksi'/'log'/'peristiwa' = saat view diterima.
  momen: relatif(catatanKamu),
  // Momen dari luar halaman (waktu nyata sejak rekam mulai; 'jepret' halaman Kamu juga membawa detikVideo).
  momenLuar: relatifNyata(catatanLuar),
  momenHost: catatanHost.filter((x) => x.jenis !== 'aksi' && x.jenis !== 'log' && x.jenis !== 'peristiwa' && x.jenis !== 'tampil').map(({ t, ...sisa }) => ({ detikNyata: Number((t - mulaiRekam).toFixed(3)), ...sisa })),
};
writeFileSync(jalurJson, JSON.stringify(semua, null, 2));
log('rekam.json diperbarui');
process.exit(cocok ? 0 : 2);
