#!/usr/bin/env node
// E2E smoke: build client produksi, sajikan lewat vite preview di port bebas (4173–4199, lalu
// 8090–8199, lalu port acak dari OS; bukan :5173/:8080),
// lalu mainkan alur pendek di Chrome sistem untuk HP (390×844 dpr3, sentuh) dan desktop (1440×900):
//   beranda → main bareng warga kedai (tempo cepat) → OK joker → ambil deck → pilih kartu → buang →
//   Pengaturan (warna kartu) → Bantuan → Tentang → menu → Simpan & ke beranda → Lanjutkan.
// Ditambah alur "pasang" (keputusan #46): tombol pasang melayang di beranda dengan user agent Chrome
// Android, HP potret 360×780 dan lanskap 780×360 (terlihat, tidak meluber, tidak menabrak toast,
// "Nanti saja" bertahan sesudah muat ulang, tidak ada di meja).
//
// Gagal (exit 1) bila: ada pageerror / console error (kecuali WebSocket & /api saat server mati),
// ketukan pada tombol/jendela HTML tembus ke kanvas, tombol utama tidak bisa ditekan, atau
// langkah alur tidak tercapai. Screenshot disimpan di apps/client/e2e/hasil/ (gitignored).
//
// Pemakaian:
//   npm run e2e                        build + preview + jalankan dua perangkat
//   npm run e2e -- --tanpa-build       pakai build e2e sebelumnya (apps/client/e2e/hasil/dist)
//   npm run e2e -- --url=http://localhost:5173   uji server yang sudah jalan (tanpa build)
//   npm run e2e -- --perangkat=hp      hanya satu alur (hp | desktop | pasang)
//   npm run e2e -- --tampil            buka jendela Chrome (bukan headless)
// Env:
//   CHROME_PATH=/jalan/ke/chrome       Chrome/Chromium yang dipakai (tidak ada unduhan browser)
//   E2E_OPSIONAL=1                     Chrome tidak ditemukan → exit 0 (untuk CI yang opsional)

import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { createServer } from 'node:net';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const DI_SINI = dirname(fileURLToPath(import.meta.url));
const KLIEN = resolve(DI_SINI, '..');
const HASIL = join(DI_SINI, 'hasil');
const DIST = join(HASIL, 'dist');

const argumen = new Map(
  process.argv.slice(2).map((a) => {
    const [k, ...v] = a.replace(/^--/, '').split('=');
    return [k, v.length ? v.join('=') : 'ya'];
  }),
);
const URL_LUAR = argumen.get('url') ?? null;
const TANPA_BUILD = argumen.has('tanpa-build') || process.env.E2E_TANPA_BUILD === '1';
const TAMPIL = argumen.has('tampil');
const OPSIONAL = process.env.E2E_OPSIONAL === '1';

const PERANGKAT = {
  hp: { viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true },
  desktop: { viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 },
};
/** User agent Chrome Android untuk alur tombol pasang (headless Chrome bawaan mengaku desktop Linux). */
const UA_ANDROID = 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Mobile Safari/537.36';
const dipilih = (argumen.get('perangkat') ?? 'hp,desktop,pasang').split(',').filter((p) => p in PERANGKAT || p === 'pasang');

const log = (...a) => console.log('[e2e]', ...a);

// ---------------------------------------------------------------------------------------------
// Chrome sistem

function cariChrome() {
  const calon = [process.env.CHROME_PATH];
  if (process.platform === 'win32') {
    for (const akar of [process.env.PROGRAMFILES, process.env['PROGRAMFILES(X86)'], process.env.LOCALAPPDATA]) {
      if (akar) calon.push(join(akar, 'Google/Chrome/Application/chrome.exe'));
    }
  } else if (process.platform === 'darwin') {
    calon.push('/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', '/Applications/Chromium.app/Contents/MacOS/Chromium');
  } else {
    calon.push('/usr/bin/google-chrome', '/usr/bin/google-chrome-stable', '/opt/google/chrome/chrome', '/usr/bin/chromium', '/usr/bin/chromium-browser', '/snap/bin/chromium');
  }
  return calon.find((p) => p && existsSync(p)) ?? null;
}

// WebGL: Windows pakai GPU sungguhan; di Linux/CI tanpa GPU pakai SwiftShader (lambat tapi jalan).
const ARG_CHROME =
  process.platform === 'win32'
    ? ['--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist']
    : ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'];

// ---------------------------------------------------------------------------------------------
// Server

/**
 * Rentang port yang dicoba berurutan. Di Windows, Hyper-V/WSL/Docker sering memesan rentang port
 * ("excluded port range", lihat `netsh interface ipv4 show excludedportrange protocol=tcp`), misalnya
 * 3952–4933, sehingga listen di 4173 ditolak EACCES walau tidak ada proses yang memakainya.
 * Kalau semua rentang gagal, OS diminta memberi port bebas (listen(0)).
 * :5173 (Vite dev) dan :8080 sengaja tidak masuk rentang supaya tidak bentrok dengan server pemilik.
 */
const RENTANG_PORT = [
  [4173, 4199],
  [8090, 8199],
];

/** Coba listen di `port` (0 = pilihan OS). Hasil: nomor port yang benar-benar didapat, atau galat. */
function cobaPort(port) {
  return new Promise((ok) => {
    const s = createServer();
    s.once('error', (e) => ok({ galat: e.code ?? e.message }));
    s.once('listening', () => {
      const didapat = s.address().port;
      s.close(() => ok({ port: didapat }));
    });
    s.listen(port, '127.0.0.1');
  });
}

async function portBebas() {
  const ditolak = new Map(); // kode galat → jumlah, untuk laporan
  for (const [awal, akhir] of RENTANG_PORT) {
    for (let p = awal; p <= akhir; p++) {
      const h = await cobaPort(p);
      if (h.port) {
        if (ditolak.size) log(`port ${awal}–${akhir}: ${p} dipakai (sebelumnya ditolak: ${ringkasTolak(ditolak)})`);
        return h.port;
      }
      ditolak.set(h.galat, (ditolak.get(h.galat) ?? 0) + 1);
    }
  }
  const h = await cobaPort(0);
  if (h.port) {
    log(`semua rentang ${RENTANG_PORT.map(([a, b]) => `${a}–${b}`).join(', ')} ditolak (${ringkasTolak(ditolak)}); pakai port acak dari OS: ${h.port}`);
    return h.port;
  }
  throw new Error(`tidak ada port bebas (${ringkasTolak(ditolak)}; listen(0): ${h.galat})`);
}

const ringkasTolak = (m) => [...m].map(([k, n]) => `${k}×${n}`).join(', ');

async function siapkanServer() {
  if (URL_LUAR) return { url: URL_LUAR.replace(/\/$/, ''), tutup: async () => {} };
  const vite = await import('vite');
  const configFile = join(KLIEN, 'vite.config.ts');
  if (!TANPA_BUILD || !existsSync(join(DIST, 'index.html'))) {
    log('build client produksi →', DIST);
    execFileSync(process.execPath, [join(KLIEN, 'scripts/buat-ikon.mjs')], { stdio: 'inherit' });
    rmSync(DIST, { recursive: true, force: true });
    await vite.build({ root: KLIEN, configFile, logLevel: 'warn', build: { outDir: DIST, emptyOutDir: true } });
  }
  const port = await portBebas();
  const server = await vite.preview({
    root: KLIEN,
    configFile,
    logLevel: 'silent',
    build: { outDir: DIST },
    preview: { port, strictPort: true, host: '127.0.0.1', open: false },
  });
  const url = `http://127.0.0.1:${port}`;
  log('vite preview di', url);
  return { url, tutup: () => new Promise((ok) => server.httpServer.close(() => ok())) };
}

// ---------------------------------------------------------------------------------------------
// Alur per perangkat

/** Galat yang boleh diabaikan: server WebSocket/API memang tidak dijalankan untuk smoke ini. */
const BOLEH = /\/ws\b|websocket|\/api\/|ERR_CONNECTION_REFUSED/i;
/** console.error buatan sendiri untuk memastikan detektor galat konsol benar-benar menangkap. */
const PENANDA_KONSOL = '__e2e_cek_detektor_konsol__';

async function jalankanPerangkat(chromium, executablePath, url, nama) {
  const dir = join(HASIL, nama);
  rmSync(dir, { recursive: true, force: true });
  mkdirSync(dir, { recursive: true });
  const opsi = PERANGKAT[nama];
  const sentuh = !!opsi.hasTouch;
  const masalah = [];
  const catatan = {};
  const langkah = [];

  const browser = await chromium.launch({ executablePath, headless: !TAMPIL, args: ARG_CHROME });
  const ctx = await browser.newContext({ ...opsi, locale: 'id-ID' });
  const page = await ctx.newPage();
  page.setDefaultTimeout(10_000);

  page.on('pageerror', (e) => masalah.push(`pageerror: ${e.message}`));
  page.on('console', (m) => {
    if (m.type() !== 'error') return;
    const teks = m.text();
    if (teks === PENANDA_KONSOL) return void (catatan.detektorKonsol = true);
    const asal = m.location()?.url ?? '';
    if (BOLEH.test(teks) || BOLEH.test(asal)) return;
    masalah.push(`console.error: ${teks.slice(0, 300)}${asal ? ` (${asal})` : ''}`);
  });

  // Rekam (1) pengumuman pembaca layar dan (2) setiap pointer/touch yang sampai ke kanvas Phaser.
  await page.addInitScript(() => {
    window.__umum = [];
    window.__kanvas = 0;
    for (const jenis of ['pointerdown', 'mousedown', 'touchstart']) {
      document.addEventListener(jenis, (e) => {
        if (e.target instanceof HTMLCanvasElement) window.__kanvas++;
      }, true);
    }
    const amati = () =>
      new MutationObserver(() => {
        const t = document.getElementById('pengumuman-sr')?.textContent;
        if (t && window.__umum[window.__umum.length - 1] !== t) window.__umum.push(t);
      }).observe(document.body, { childList: true, subtree: true, characterData: true });
    if (document.body) amati();
    else document.addEventListener('DOMContentLoaded', amati);
  });

  let nomorFoto = 0;
  const foto = async (n) => {
    await page.screenshot({ path: join(dir, `${String(nomorFoto++).padStart(2, '0')}-${n}.png`) }).catch(() => {});
  };
  const tunggu = (ms) => page.waitForTimeout(ms);
  const jumlahUmum = () => page.evaluate(() => window.__umum.length);
  const umumSejak = (n) => page.evaluate((n) => window.__umum.slice(n), n);
  const kanvasDitekan = () => page.evaluate(() => window.__kanvas);

  const langkahKe = async (judul, fn) => {
    const t0 = Date.now();
    log(`${nama}: ${judul}`);
    try {
      await fn();
      langkah.push({ judul, ms: Date.now() - t0, ok: true });
    } catch (e) {
      langkah.push({ judul, ms: Date.now() - t0, ok: false });
      await foto(`GAGAL-${judul.replace(/[^a-z0-9]+/gi, '-')}`);
      throw new Error(`${judul}: ${e.message.split('\n')[0]}`);
    }
  };

  /**
   * Tekan tombol HTML seperti pemain (ketuk di HP, klik di desktop). Playwright memastikan tombolnya
   * terlihat, stabil, dan benar-benar menerima ketukan (tidak tertutup elemen lain). Ketukan itu
   * tidak boleh tembus ke kanvas Phaser di bawahnya.
   */
  const tekan = async (selektor, label = selektor) => {
    const el = page.locator(selektor).first();
    try {
      await el.waitFor({ state: 'visible' });
      await el.scrollIntoViewIfNeeded();
    } catch {
      throw new Error(`tombol "${label}" tidak muncul / tidak terlihat`);
    }
    const sebelum = await kanvasDitekan();
    try {
      if (sentuh) await el.tap({ timeout: 8000 });
      else await el.click({ timeout: 8000 });
    } catch (e) {
      throw new Error(`tombol "${label}" tidak bisa ditekan (tertutup/terkunci?): ${e.message.split('\n')[0]}`);
    }
    if ((await kanvasDitekan()) !== sebelum) masalah.push(`klik tembus: menekan "${label}" juga mengenai kanvas`);
  };
  const ketukTitik = async (x, y) => {
    if (sentuh) await page.touchscreen.tap(x, y);
    else await page.mouse.click(x, y);
  };
  const tidakMeluber = async (tempat) => {
    const u = await page.evaluate(() => ({ sw: document.scrollingElement.scrollWidth, w: innerWidth }));
    if (u.sw > u.w + 1) masalah.push(`${tempat}: halaman meluber horizontal (${u.sw} > ${u.w})`);
  };
  const tombolAksi = (a, aktif = true) => `.tombol-aksi [data-a="${a}"]${aktif ? '[aria-disabled="false"]' : ''}`;
  const ada = async (sel) => (await page.locator(sel).count()) > 0;

  /** Tunggu giliranku (tombol Ambil deck aktif), sambil menekan Lanjut di panel mentung bila muncul. */
  const tungguGiliranku = async (batasMs = 120_000) => {
    const akhir = Date.now() + batasMs;
    while (Date.now() < akhir) {
      if (await ada(tombolAksi('ambil'))) return;
      if (await ada('#modal [data-lanjut]')) await tekan('#modal [data-lanjut]', 'Lanjut (panel mentung)');
      else if (await ada('#modal [data-joker] [data-ok], #modal [data-ok]')) await tekan('#modal [data-ok]', 'OK joker');
      if (await ada('#modal [data-hasil], #modal [data-selesai]')) throw new Error('putaran keburu selesai sebelum giliranku');
      await tunggu(300);
    }
    throw new Error('giliranku tidak kunjung tiba / tombol Ambil deck tidak pernah aktif');
  };

  /** Buka menu ☰ di bar atas lalu pilih item. */
  const menu = async (item, label) => {
    await tekan('.bar-atas [data-a="menu"]', 'Menu ☰');
    await page.locator(`#modal [data-m="${item}"]`).waitFor({ state: 'visible' });
    await tekan(`#modal [data-m="${item}"]`, label);
  };
  const tutupDialogAtas = async (label) => {
    const kaki = '#lapisan-dialog .dialog .kaki-dialog [data-tutup]';
    await tekan((await ada(kaki)) ? kaki : '#lapisan-dialog .dialog [data-tutup]', label);
    await page.waitForFunction(() => !document.querySelector('#lapisan-dialog .dialog'), null, { timeout: 5000 });
    // Menu bisa tetap terbuka di bawahnya: tutup juga supaya meja bisa disentuh lagi.
    if (await ada('#modal [data-m]')) await page.keyboard.press('Escape');
    await page.waitForFunction(() => !document.querySelector('#modal .dialog'), null, { timeout: 5000 });
  };

  try {
    await langkahKe('beranda', async () => {
      await page.goto(url, { waitUntil: 'load' });
      await page.evaluate(() => {
        localStorage.clear();
        // Tutorial dianggap sudah dilihat supaya beranda langsung ke menu main.
        localStorage.setItem('remi.preferensi', JSON.stringify({ tutorialSelesai: true }));
        // Tombol pasang melayang (keputusan #46) tidak ikut alur ini: punya alur sendiri ("pasang").
        // tundaSampai ikut diisi untuk berjaga-jaga kalau Chrome menawarkan prompt (yang menghapus sudahPasang).
        localStorage.setItem('remi.tawaranPasang', JSON.stringify({ sudahPasang: Date.now(), tundaSampai: Date.now() + 2 * 24 * 3600e3 }));
      });
      await page.reload({ waitUntil: 'load' });
      await page.locator('#mulai-bot').waitFor({ state: 'visible', timeout: 20_000 });
      // Tunggu event 'console' penanda secara deterministik (bukan jeda tetap): event Playwright
      // datang asinkron, jadi jeda pendek bisa memberi gagal palsu di mesin yang lambat.
      const penandaTiba = page
        .waitForEvent('console', { predicate: (m) => m.type() === 'error' && m.text() === PENANDA_KONSOL, timeout: 5_000 })
        .then(
          () => true,
          () => false,
        );
      await page.evaluate((p) => console.error(p), PENANDA_KONSOL);
      if (!(await penandaTiba) || !catatan.detektorKonsol) masalah.push('detektor console.error tidak bekerja (uji ini tidak bisa dipercaya)');
      await tidakMeluber('beranda');
      await foto('beranda');
    });

    await langkahKe('atur meja & main bareng warga kedai', async () => {
      await page.fill('#nama', 'Penguji');
      if (!(await page.locator('details.atur-meja').evaluate((d) => d.open))) await tekan('details.atur-meja > summary', 'Atur meja');
      await page.selectOption('#o-jumlah', '3');
      await page.selectOption('#o-tempo', 'cepat');
      await page.selectOption('#o-putaran', '3');
      await foto('atur-meja');
      await tekan('#mulai-bot', 'Main bareng warga kedai');
    });

    await langkahKe('popup joker → OK', async () => {
      await page.locator('#modal [data-joker]').waitFor({ state: 'attached', timeout: 30_000 });
      await page.locator('#modal [data-ok]').waitFor({ state: 'visible' });
      await tunggu(400);
      await foto('popup-joker');
      const n = await jumlahUmum();
      await tekan('#modal [data-ok]', 'OK joker');
      await page.waitForFunction(() => !document.querySelector('#modal [data-joker]'), null, { timeout: 5000 });
      await tunggu(500);
      if ((await umumSejak(n)).some((t) => /dipilih/i.test(t))) masalah.push('klik tembus: OK joker ikut memilih kartu');
      await tidakMeluber('meja');
    });

    await langkahKe('tunggu giliranku', async () => {
      await tungguGiliranku();
      await tunggu(300);
      await foto('giliranku');
    });

    await langkahKe('klik tembus: ketuk latar menu di atas tangan', async () => {
      await tekan('.bar-atas [data-a="menu"]', 'Menu ☰');
      await page.locator('#modal [data-m]').first().waitFor({ state: 'visible' });
      await tunggu(250);
      // Titik di area tangan (tepat di atas bar aksi) yang tertutup latar menu, bukan tombol.
      const titik = await page.evaluate(() => {
        const atasBar = document.querySelector('.bar-aksi')?.getBoundingClientRect().top ?? innerHeight * 0.8;
        for (const y of [atasBar - 40, atasBar - 80, atasBar - 120]) {
          for (const fx of [0.5, 0.3, 0.7, 0.1, 0.9]) {
            const x = innerWidth * fx;
            const el = document.elementFromPoint(x, y);
            if (el && el.closest('#modal') && !el.closest('button, a, input, select, summary')) return { x, y, latar: el.classList.contains('latar') };
          }
        }
        return null;
      });
      if (!titik) throw new Error('tidak menemukan titik latar menu di atas tangan');
      const n = await jumlahUmum();
      const sebelum = await kanvasDitekan();
      await ketukTitik(titik.x, titik.y);
      await tunggu(500);
      if ((await kanvasDitekan()) !== sebelum) masalah.push('klik tembus: ketukan di latar menu sampai ke kanvas');
      if ((await umumSejak(n)).some((t) => /dipilih/i.test(t))) masalah.push('klik tembus: ketukan di latar menu memilih kartu');
      if (await ada('#modal [data-m]')) await page.keyboard.press('Escape');
      await page.waitForFunction(() => !document.querySelector('#modal .dialog'), null, { timeout: 5000 });
      if (!(await ada(tombolAksi('ambil')))) masalah.push('klik tembus: tahap ambil berubah setelah ketuk latar menu');
      catatan.titikLatarMenu = titik;
    });

    await langkahKe('ambil deck', async () => {
      await tekan(tombolAksi('ambil'), 'Ambil deck');
      await page.locator(tombolAksi('buang', false)).waitFor({ state: 'visible', timeout: 15_000 });
      await tunggu(400);
      await foto('sesudah-ambil');
    });

    await langkahKe('pilih kartu di tangan', async () => {
      // Tunggu animasi kartu dari deck selesai (tombol tidak lagi dikunci).
      await page
        .waitForFunction(() => ![...document.querySelectorAll('.tombol-aksi [data-alasan]')].some((b) => /bergerak|animasi|tunggu/i.test(b.dataset.alasan ?? '')), null, { timeout: 8000 })
        .catch(() => {});
      // Ketuk kanvas di area tangan (di atas bar aksi) sampai satu kartu terpilih.
      const calon = await page.evaluate(() => {
        const atasBar = document.querySelector('.bar-aksi')?.getBoundingClientRect().top ?? innerHeight * 0.8;
        const kanvas = document.querySelector('canvas')?.getBoundingClientRect();
        const tengah = kanvas ? kanvas.left + kanvas.width / 2 : innerWidth / 2;
        const out = [];
        for (let dy = 20; dy <= 280; dy += 20) {
          const y = atasBar - dy;
          if (document.elementFromPoint(tengah, y) instanceof HTMLCanvasElement) out.push({ x: tengah, y });
        }
        return out;
      });
      /** Ketuk satu titik; true kalau pembaca layar mengumumkan "Dipilih: …". */
      const ketukPilih = async (t) => {
        const n = await jumlahUmum();
        const k = await kanvasDitekan();
        await ketukTitik(t.x, t.y);
        await tunggu(350);
        // Cek-diri: ketukan langsung di kanvas harus terhitung, kalau tidak deteksi klik tembus hampa.
        if ((await kanvasDitekan()) === k) masalah.push('detektor klik tembus tidak menangkap ketukan di kanvas');
        return (await umumSejak(n)).some((s) => /^Dipilih/.test(s));
      };
      const buangAktif = async () => (await page.locator(tombolAksi('buang')).count()) > 0;
      let berhasil = null;
      for (const t of calon) {
        if (await ketukPilih(t)) {
          berhasil = t;
          break;
        }
      }
      // Kartu acak hasil kocokan bisa saja belum boleh dibuang (mis. As sebelum punya kartu jadi).
      // Itu aturan, bukan bug: lepas pilihan (Escape) lalu coba kartu lain di baris yang sama.
      if (berhasil && !(await buangAktif())) {
        const lebar = await page.evaluate(() => document.querySelector('canvas')?.getBoundingClientRect().width ?? innerWidth);
        const geser = [-0.12, 0.12, -0.24, 0.24, -0.06, 0.06, -0.18, 0.18];
        catatan.kartuTakBolehDibuang = 1;
        let dapat = null;
        for (const f of geser) {
          await page.keyboard.press('Escape'); // "Semua pilihan dilepas."
          await tunggu(250);
          const t = { x: berhasil.x + f * lebar, y: berhasil.y };
          if (!(await ketukPilih(t))) continue;
          if (await buangAktif()) {
            dapat = t;
            break;
          }
          catatan.kartuTakBolehDibuang++;
        }
        if (dapat) berhasil = dapat;
        else masalah.push('tidak menemukan kartu yang boleh dibuang di area tangan');
      }
      if (!berhasil) {
        // Cadangan keyboard (sorot kartu tangan lalu Enter) supaya alur tetap jalan; tetap dicatat gagal.
        masalah.push('kartu di tangan tidak bisa dipilih dengan ketukan di area tangan');
        await page.keyboard.press('ArrowDown');
        await page.keyboard.press('Enter');
      }
      catatan.titikKartu = berhasil;
      await page.locator(tombolAksi('buang')).waitFor({ state: 'visible', timeout: 5000 });
      await foto('kartu-dipilih');
    });

    await langkahKe('buang', async () => {
      await tekan(tombolAksi('buang'), 'Buang');
      await page.waitForFunction(() => !document.querySelector('.tombol-aksi [data-a="buang"]'), null, { timeout: 10_000 });
      await tunggu(600);
      await foto('sesudah-buang');
    });

    await langkahKe('Pengaturan: warna kartu empat', async () => {
      await menu('pengaturan', 'Pengaturan');
      const pilihan = '#lapisan-dialog [data-pilihan="warnaKartu"] [data-nilai="empat"]';
      await page.locator(pilihan).waitFor({ state: 'visible' });
      await tekan(pilihan, 'Warna kartu: empat');
      await tunggu(300);
      const pref = await page.evaluate(() => ({
        html: document.documentElement.dataset.warnaKartu,
        simpan: JSON.parse(localStorage.getItem('remi.preferensi') ?? '{}').warnaKartu,
      }));
      if (pref.html !== 'empat' || pref.simpan !== 'empat') masalah.push(`warna kartu tidak berubah: ${JSON.stringify(pref)}`);
      await foto('pengaturan');
      await tutupDialogAtas('Selesai (Pengaturan)');
      await tunggu(400);
      await foto('meja-empat-warna');
    });

    await langkahKe('Bantuan', async () => {
      await menu('bantuan', 'Bantuan & aturan');
      await page.locator('#lapisan-dialog .dialog').waitFor({ state: 'visible' });
      await tunggu(300);
      await foto('bantuan');
      await tutupDialogAtas('Tutup (Bantuan)');
    });

    await langkahKe('Tentang', async () => {
      await menu('tentang', 'Tentang');
      await page.locator('#lapisan-dialog .dialog').waitFor({ state: 'visible' });
      await tunggu(300);
      await foto('tentang');
      await tutupDialogAtas('Tutup (Tentang)');
    });

    await langkahKe('menu → Simpan & ke beranda', async () => {
      await menu('keluar', 'Simpan & ke beranda');
      await page.locator('#lanjut').waitFor({ state: 'visible', timeout: 10_000 });
      const ringkas = await page.evaluate(() => {
        const d = JSON.parse(localStorage.getItem('remi.mejaOffline') ?? 'null');
        return d && { status: d.game?.status, putaran: d.game?.putaran?.nomor };
      });
      if (!ringkas || ringkas.status !== 'putaranBerjalan') masalah.push(`simpanan offline tidak sesuai: ${JSON.stringify(ringkas)}`);
      catatan.simpanan = ringkas;
      await tidakMeluber('beranda (ada simpanan)');
      await foto('beranda-ada-simpanan');
    });

    await langkahKe('Lanjutkan', async () => {
      await tekan('#lanjut', 'Lanjutkan');
      await page.locator('.bar-aksi').waitFor({ state: 'visible', timeout: 15_000 });
      await tunggu(1500);
      catatan.popupJokerSesudahLanjut = await ada('#modal [data-joker]');
      await foto('sesudah-lanjut');
      // Permainan benar-benar jalan lagi: warga kedai melanjutkan sampai giliranku tiba kembali.
      await tungguGiliranku();
      await foto('giliranku-lagi');
    });
  } catch (e) {
    masalah.push(String(e.message ?? e));
  }

  const hasil = { perangkat: nama, ok: masalah.length === 0, masalah, langkah, catatan };
  writeFileSync(join(dir, 'hasil.json'), JSON.stringify(hasil, null, 2));
  await browser.close();
  return hasil;
}

/**
 * Alur tombol pasang aplikasi (keputusan #46) dengan user agent Chrome Android, HP potret dan lanskap:
 * tombol melayang terlihat utuh di layar, halaman tidak meluber, tidak menabrak tumpukan toast,
 * "Nanti saja" menyembunyikannya dan tetap tersembunyi sesudah muat ulang (ubin menu tetap ada),
 * dan begitu permainan dimulai tidak ada tombol pasang di meja. Ditambah HP 320 px dengan teks
 * besar (tombol tetap satu baris) dan kunjungan pertama (tanpa tombol melayang selama kartu latihan).
 */
async function jalankanTawaranPasang(chromium, executablePath, url) {
  const nama = 'pasang';
  const dir = join(HASIL, nama);
  rmSync(dir, { recursive: true, force: true });
  mkdirSync(dir, { recursive: true });
  const masalah = [];
  const catatan = {};
  const langkah = [];
  const browser = await chromium.launch({ executablePath, headless: !TAMPIL, args: ARG_CHROME });
  let nomorFoto = 0;

  const langkahKe = async (judul, page, fn) => {
    const t0 = Date.now();
    log(`${nama}: ${judul}`);
    try {
      await fn();
      langkah.push({ judul, ms: Date.now() - t0, ok: true });
    } catch (e) {
      langkah.push({ judul, ms: Date.now() - t0, ok: false });
      await page.screenshot({ path: join(dir, `${String(nomorFoto++).padStart(2, '0')}-GAGAL-${judul.replace(/[^a-z0-9]+/gi, '-')}.png`) }).catch(() => {});
      throw new Error(`${judul}: ${e.message.split('\n')[0]}`);
    }
  };

  /** Konteks HP Android baru dengan simpanan bersih (bawaan: tutorial dianggap sudah dilihat). */
  const bukaBeranda = async (viewport, label, preferensi = { tutorialSelesai: true }) => {
    const ctx = await browser.newContext({ viewport, deviceScaleFactor: 3, isMobile: true, hasTouch: true, userAgent: UA_ANDROID, locale: 'id-ID' });
    const page = await ctx.newPage();
    page.setDefaultTimeout(10_000);
    page.on('pageerror', (e) => masalah.push(`${label}: pageerror: ${e.message}`));
    page.on('console', (m) => {
      if (m.type() !== 'error') return;
      const teks = m.text();
      const asal = m.location()?.url ?? '';
      if (BOLEH.test(teks) || BOLEH.test(asal)) return;
      masalah.push(`${label}: console.error: ${teks.slice(0, 300)}`);
    });
    await page.goto(url, { waitUntil: 'load' });
    await page.evaluate((preferensi) => {
      localStorage.clear();
      localStorage.setItem('remi.preferensi', JSON.stringify(preferensi));
    }, preferensi);
    await page.reload({ waitUntil: 'load' });
    await page.locator('#mulai-bot').waitFor({ state: 'visible', timeout: 20_000 });
    return { ctx, page };
  };
  const foto = (page, n) => page.screenshot({ path: join(dir, `${String(nomorFoto++).padStart(2, '0')}-${n}.png`) }).catch(() => {});
  /** Tunggu tombol melayang selesai muncul (animasi masuk ±1,2 detik sesudah beranda tampil). */
  const tungguTombol = async (page) => {
    await page.locator('.pasang-melayang').waitFor({ state: 'visible', timeout: 15_000 });
    await page.waitForFunction(() => {
      const el = document.querySelector('.pasang-melayang');
      return !!el && el.getAnimations().every((a) => a.playState !== 'running' && a.playState !== 'pending');
    }, null, { timeout: 8000 });
  };
  /** Ukur tombol melayang terhadap layar dan tumpukan toast (toast contoh tiga baris, CSS asli). */
  const ukur = (page, tempat) =>
    page.evaluate((tempat) => {
      const m = document.querySelector('.pasang-melayang');
      if (!m) return { tempat, galat: 'tombol melayang tidak ada' };
      const wadah = document.getElementById('toast');
      const t = document.createElement('div');
      t.className = 'toast';
      t.innerHTML = '<span>Toast contoh yang cukup panjang supaya terlipat beberapa baris di layar HP yang sempit.</span>';
      wadah.appendChild(t);
      const rt = wadah.getBoundingClientRect();
      t.remove();
      const r = m.getBoundingClientRect();
      const layar = document.querySelector('.layar.beranda');
      return {
        tempat,
        tombol: { kiri: r.left, atas: r.top, kanan: r.right, bawah: r.bottom },
        toast: { kiri: rt.left, atas: rt.top, kanan: rt.right, bawah: rt.bottom },
        lebar: innerWidth,
        tinggi: innerHeight,
        luber: document.scrollingElement.scrollWidth > innerWidth + 1 || (layar && layar.scrollWidth > layar.clientWidth + 1),
        ubin: !!document.querySelector('.beranda-nav [data-nav=pasang]'),
        terakhir: layar?.lastElementChild === m,
        // Puncak tombol di bawah tumpukan toast hanya kalau tombolnya satu baris.
        baris: new Set([...m.querySelectorAll('button')].map((b) => Math.round(b.getBoundingClientRect().top))).size,
      };
    }, tempat);
  const periksa = (u) => {
    if (u.galat) return masalah.push(`${u.tempat}: ${u.galat}`);
    const { tombol: b, toast: t } = u;
    if (b.kiri < 0 || b.atas < 0 || b.kanan > u.lebar || b.bawah > u.tinggi) masalah.push(`${u.tempat}: tombol pasang keluar layar ${JSON.stringify(b)}`);
    if (!(b.bawah <= t.atas || b.atas >= t.bawah || b.kanan <= t.kiri || b.kiri >= t.kanan)) masalah.push(`${u.tempat}: tombol pasang menabrak toast`);
    if (u.luber) masalah.push(`${u.tempat}: halaman meluber horizontal`);
    if (!u.ubin) masalah.push(`${u.tempat}: ubin "Pasang ke layar utama" tidak ada`);
    if (!u.terakhir) masalah.push(`${u.tempat}: tombol melayang bukan anak terakhir .layar.beranda`);
    if (u.baris !== 1) masalah.push(`${u.tempat}: tombol melayang terlipat ${u.baris} baris`);
    catatan[u.tempat] = u;
  };

  try {
    for (const [arah, viewport] of [
      ['potret', { width: 360, height: 780 }],
      ['lanskap', { width: 780, height: 360 }],
    ]) {
      const { ctx, page } = await bukaBeranda(viewport, arah);
      try {
        await langkahKe(`${arah}: tombol melayang terlihat`, page, async () => {
          await tungguTombol(page);
          periksa(await ukur(page, arah));
          await foto(page, `${arah}-beranda`);
        });
        await langkahKe(`${arah}: Nanti saja bertahan sesudah muat ulang`, page, async () => {
          await page.locator('.pasang-melayang [data-pasang-nanti]').tap();
          await page.locator('.pasang-melayang').waitFor({ state: 'detached', timeout: 5000 });
          const s = await page.evaluate(() => ({
            simpan: JSON.parse(localStorage.getItem('remi.tawaranPasang') ?? '{}'),
            fokus: document.activeElement?.getAttribute('data-nav'),
          }));
          if (!(s.simpan.tundaSampai > Date.now())) masalah.push(`${arah}: tunda "Nanti saja" tidak tersimpan: ${JSON.stringify(s.simpan)}`);
          if (s.fokus !== 'pasang') masalah.push(`${arah}: fokus sesudah "Nanti saja" tidak di ubin menu (${s.fokus})`);
          await foto(page, `${arah}-sesudah-nanti`);
          await page.reload({ waitUntil: 'load' });
          await page.locator('#mulai-bot').waitFor({ state: 'visible', timeout: 20_000 });
          await page.waitForTimeout(2500);
          const lagi = await page.evaluate(() => ({
            melayang: !!document.querySelector('.pasang-melayang'),
            ubin: !!document.querySelector('.beranda-nav [data-nav=pasang]'),
          }));
          if (lagi.melayang) masalah.push(`${arah}: tombol melayang muncul lagi sesudah muat ulang`);
          if (!lagi.ubin) masalah.push(`${arah}: ubin "Pasang ke layar utama" hilang sesudah "Nanti saja"`);
        });
        await langkahKe(`${arah}: tidak ada tombol pasang di meja`, page, async () => {
          // Tunda dihapus supaya tombolnya ada di beranda sebelum main.
          await page.evaluate(() => localStorage.removeItem('remi.tawaranPasang'));
          await page.reload({ waitUntil: 'load' });
          await tungguTombol(page);
          await page.locator('#mulai-bot').scrollIntoViewIfNeeded();
          await page.locator('#mulai-bot').tap();
          await page.locator('#modal [data-joker]').waitFor({ state: 'attached', timeout: 30_000 });
          const diMeja = async () => page.evaluate(() => document.querySelectorAll('.pasang-melayang, [data-nav=pasang], [data-pasang-nanti]').length);
          if (await diMeja()) masalah.push(`${arah}: tombol pasang ada di meja (popup joker)`);
          await page.locator('#modal [data-ok]').tap();
          await page.waitForFunction(() => !document.querySelector('#modal [data-joker]'), null, { timeout: 5000 });
          await page.waitForTimeout(800);
          if (await diMeja()) masalah.push(`${arah}: tombol pasang ada di meja`);
          await foto(page, `${arah}-meja`);
        });
      } finally {
        await ctx.close();
      }
    }
    // HP sempit dengan teks besar: tombol tetap satu baris, tidak menabrak toast.
    {
      const { ctx, page } = await bukaBeranda({ width: 320, height: 640 }, 'sempit', { tutorialSelesai: true, ukuranTeks: 'besar' });
      try {
        await langkahKe('320 teks besar: tombol melayang satu baris', page, async () => {
          await tungguTombol(page);
          periksa(await ukur(page, 'sempit-teks-besar'));
          await foto(page, 'sempit-teks-besar');
        });
      } finally {
        await ctx.close();
      }
    }
    // Kunjungan pertama (kartu "Warga baru, ya?"): ubin saja, tombol melayang belum muncul.
    {
      const { ctx, page } = await bukaBeranda({ width: 360, height: 780 }, 'pemain-baru', {});
      try {
        await langkahKe('pemain baru: tanpa tombol melayang selama kartu latihan tampil', page, async () => {
          await page.locator('.tawaran-latihan').waitFor({ state: 'visible' });
          await page.waitForTimeout(2500);
          const s = await page.evaluate(() => ({
            melayang: !!document.querySelector('.pasang-melayang'),
            ubin: !!document.querySelector('.beranda-nav [data-nav=pasang]'),
          }));
          if (s.melayang) masalah.push('pemain baru: tombol melayang muncul bersama kartu latihan');
          if (!s.ubin) masalah.push('pemain baru: ubin "Pasang ke layar utama" tidak ada');
          await foto(page, 'pemain-baru');
        });
      } finally {
        await ctx.close();
      }
    }
  } catch (e) {
    masalah.push(String(e.message ?? e));
  }
  const hasil = { perangkat: nama, ok: masalah.length === 0, masalah, langkah, catatan };
  writeFileSync(join(dir, 'hasil.json'), JSON.stringify(hasil, null, 2));
  await browser.close();
  return hasil;
}

// ---------------------------------------------------------------------------------------------

async function utama() {
  const executablePath = cariChrome();
  if (!executablePath) {
    const pesan = 'Chrome/Chromium tidak ditemukan. Pasang Google Chrome atau set CHROME_PATH=/jalan/ke/chrome.';
    if (OPSIONAL) {
      log(`${pesan} E2E dilewati (E2E_OPSIONAL=1).`);
      return 0;
    }
    console.error(`[e2e] ${pesan}`);
    return 1;
  }
  let chromium;
  try {
    ({ chromium } = await import('playwright-core'));
  } catch {
    console.error('[e2e] playwright-core belum terpasang. Jalankan npm install dulu.');
    return 1;
  }
  if (!dipilih.length) {
    console.error('[e2e] --perangkat harus hp, desktop, dan/atau pasang.');
    return 1;
  }
  mkdirSync(HASIL, { recursive: true });
  log('Chrome:', executablePath);
  const server = await siapkanServer();
  const semua = [];
  try {
    for (const nama of dipilih) {
      semua.push(nama === 'pasang' ? await jalankanTawaranPasang(chromium, executablePath, server.url) : await jalankanPerangkat(chromium, executablePath, server.url, nama));
    }
  } finally {
    await server.tutup();
  }
  for (const h of semua) {
    log(`${h.ok ? 'LULUS' : 'GAGAL'}  ${h.perangkat}  (${h.langkah.filter((l) => l.ok).length}/${h.langkah.length} langkah)`);
    for (const m of h.masalah) log(`   - ${m}`);
  }
  log('screenshot & hasil.json:', HASIL);
  return semua.every((h) => h.ok) ? 0 : 1;
}

utama().then(
  (kode) => process.exit(kode),
  (e) => {
    console.error('[e2e] galat tak terduga:', e);
    process.exit(1);
  },
);
