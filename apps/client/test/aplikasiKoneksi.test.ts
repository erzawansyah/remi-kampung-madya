// @vitest-environment happy-dom
// Rangkaian koneksi di Aplikasi (main.ts), dijalankan utuh: aplikasi dinyalakan seperti halaman yang baru
// dibuka, WebSocket diganti tiruan (WsPalsu), Phaser dan KontrolMeja diganti tiruan yang mencatat panggilan.
// Yang dijaga (perbaikan koneksi putus-putus, langkah 3–6):
// - pesan server sampai ke meja: aksiDiterima, error (kunci aksi lepas; "sinyal putus" buatan koneksi
//   sendiri dibedakan), status sambungan berubah;
// - kursi yang dibuka di tab/perangkat lain (kode 4000) tidak disambung ulang sendiri lewat online/visibility;
// - sesi tersimpan dilanjutkan juga kalau aplikasi dibuka tanpa sinyal, dan saat sinyal kembali atau tab
//   terlihat lagi di beranda;
// - kabar "warga kedai menjalankan N langkahmu" muncul sekali, tanpa nama kartu.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { buatPermainan, terapkanAksi, viewUntuk, type GameState } from '@remi/engine';
import { PENGATURAN_BAWAAN, type InfoMeja } from '@remi/meja';
import type { AppUntukMeja } from '../src/kontrolMeja';
import type { PesanDariMeja } from '../src/koneksi';
import { WsPalsu } from './bantu';

vi.mock('virtual:pwa-register', () => ({ registerSW: vi.fn(() => vi.fn(async () => {})) }));
vi.mock('../src/efek/suara', async (asli) => ({
  ...(await asli<typeof import('../src/efek/suara')>()),
  siapkanAudio: vi.fn(),
  suasanaMusik: vi.fn(),
  bunyi: vi.fn(),
  getar: vi.fn(),
}));
vi.mock('../src/ui/jendelaMalas', () => ({ bukaBantuan: vi.fn(), bukaTentang: vi.fn(), siapkanJendelaMalas: vi.fn() }));
vi.mock('../src/ui/dom', async (asli) => ({ ...(await asli<typeof import('../src/ui/dom')>()), umumkan: vi.fn() }));
vi.mock('../src/game/game', () => ({
  buatGame: vi.fn(() => ({ game: { asli: null, tidur: false, siap: false }, scene: Promise.resolve({}) })),
  bangunkanGame: vi.fn(),
  tidurkanGame: vi.fn(),
  pramuatGame: vi.fn(),
}));

/** Panggilan ke KontrolMeja tiruan (nama metode + argumen) dan aplikasi yang diberikan kepadanya. */
const kontrol = vi.hoisted(() => ({ panggilan: [] as { nama: string; arg: unknown[] }[], app: null as unknown, tahanKeluar: false, obrolanTerbuka: false }));
vi.mock('../src/kontrolMeja', async (asli) => {
  const m = await asli<typeof import('../src/kontrolMeja')>();
  const catat =
    (nama: string) =>
    (...arg: unknown[]) => {
      kontrol.panggilan.push({ nama, arg });
    };
  class KontrolPalsu {
    constructor(app: unknown) {
      kontrol.app = app;
    }
    perbarui = catat('perbarui');
    aksiDiterima = catat('aksiDiterima');
    saatError = catat('saatError');
    teksPenolakan = (pesan: string) => pesan;
    koneksiBerubah = catat('koneksiBerubah');
    // Seperti KontrolMeja tanpa animasi: baris obrolan langsung masuk simpanan obrolan aplikasi.
    terimaEmote = (kursi: number, isi: string, baris?: unknown) => {
      kontrol.panggilan.push({ nama: 'terimaEmote', arg: [kursi, isi] });
      if (!baris) return;
      kontrol.panggilan.push({ nama: 'barisEmote', arg: [baris] });
      (kontrol.app as { obrolan: { tambah(b: unknown): void } }).obrolan.tambah(baris);
    };
    hancurkan = catat('hancurkan');
    keadaanTampil = () => ({ status: null, sibuk: false, klasemen: false });
    menahanKeluar = () => kontrol.tahanKeluar;
    tutupObrolanTerbuka = () => {
      const ada = kontrol.obrolanTerbuka;
      kontrol.obrolanTerbuka = false;
      if (ada) kontrol.panggilan.push({ nama: 'tutupObrolan', arg: [] });
      return ada;
    };
  }
  return { ...m, KontrolMeja: KontrolPalsu };
});

import { umumkan } from '../src/ui/dom';
import { PESAN_TERTAHAN } from '../src/koneksi';
import { teksDijalankanWarga } from '../src/konten/koneksi';

// Konstanta build yang biasanya disuntik Vite (versi.ts).
Object.assign(globalThis, { __VERSI_APP__: '0.0.0', __BUILD_SHA__: 'dev', __BUILD_WAKTU__: '2026-10-24T00:00:00.000Z' });

const KUNCI_SESI = 'remi.sesiOnline';
const ALASAN_TAB_LAIN = 'Meja ini sedang dibuka di tab atau perangkat lain.';

/** Pendengar window/document yang dipasang aplikasi dalam satu test; dilepas sesudahnya (Aplikasi tidak punya hancurkan). */
const pendengar: [EventTarget, string, EventListenerOrEventListenerObject, unknown][] = [];

function aturTerlihat(keadaan: DocumentVisibilityState): void {
  Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => keadaan });
  document.dispatchEvent(new Event('visibilitychange'));
}

function aturOnline(ada: boolean): void {
  Object.defineProperty(navigator, 'onLine', { configurable: true, get: () => ada });
}

/** Nyalakan aplikasi (main.ts) seperti halaman yang baru dibuka. */
async function nyalakan(): Promise<void> {
  vi.resetModules();
  await import('../src/main');
  await vi.advanceTimersByTimeAsync(0);
}

const dipanggil = (n: string) => kontrol.panggilan.filter((p) => p.nama === n).map((p) => p.arg);
const toastTeks = () => [...document.querySelectorAll<HTMLElement>('#toast .toast')].map((el) => el.dataset.pesan ?? '');
const terkirim = (ws: WsPalsu) => ws.terkirim.filter((p) => p.t !== 'ping');
const sesiTersimpan = () => JSON.parse(localStorage.getItem(KUNCI_SESI) ?? 'null') as { kode: string; token: string } | null;

function permainan(): GameState {
  const g0 = buatPermainan({ pemain: ['Aku', 'Budi', 'Bot 2'], seed: 7 });
  const h = terapkanAksi(g0, { jenis: 'mulaiPutaran', pengocok: 0 });
  if (!h.ok) throw new Error(h.error.pesan);
  return h.state;
}

function infoMeja(g: GameState): InfoMeja {
  return {
    kode: 'MADYA',
    status: 'main',
    pengaturan: { ...PENGATURAN_BAWAAN, jumlahPemain: 3 },
    kursi: g.pemain.map((p, i) => ({ jenis: i < 2 ? 'manusia' : 'bot', nama: p.nama, terhubung: true, level: 'normal' })),
    host: 0,
    kursiSaya: 0,
    setujuAkhiri: [],
    batasWaktu: null,
    diambilAlihBot: false,
    menungguJoker: [],
    botMikir: null,
  };
}

/** Server menjawab 'gabung' lewat `ws`: masuk + info meja + view, seperti meja yang sedang jalan. */
async function masukMeja(ws: WsPalsu, g: GameState, masuk: Partial<Extract<PesanDariMeja, { t: 'masuk' }>> = {}): Promise<void> {
  ws.kirimDariServer({ t: 'masuk', kode: 'MADYA', token: 'tok', kursi: 0, ...masuk });
  ws.kirimDariServer({ t: 'meja', info: infoMeja(g) });
  // Phaser (tiruan) siap di microtask berikutnya, baru KontrolMeja dibuat.
  await vi.advanceTimersByTimeAsync(0);
  ws.kirimDariServer({ t: 'view', view: viewUntuk(g, 0) });
  await vi.advanceTimersByTimeAsync(0);
}

/** Aplikasi dibuka dengan sesi tersimpan dan langsung kembali ke meja yang sedang jalan. */
async function diMeja(masuk: Partial<Extract<PesanDariMeja, { t: 'masuk' }>> = {}) {
  localStorage.setItem(KUNCI_SESI, JSON.stringify({ kode: 'MADYA', token: 'tok' }));
  await nyalakan();
  const ws = WsPalsu.terakhir();
  ws.buka();
  const g = permainan();
  await masukMeja(ws, g, masuk);
  expect(kontrol.app).not.toBeNull();
  return { ws, g, app: kontrol.app as AppUntukMeja };
}

beforeEach(() => {
  vi.useFakeTimers();
  localStorage.clear();
  sessionStorage.clear();
  kontrol.panggilan.length = 0;
  kontrol.app = null;
  kontrol.tahanKeluar = false;
  kontrol.obrolanTerbuka = false;
  vi.mocked(umumkan).mockClear();
  WsPalsu.semua = [];
  vi.stubGlobal('WebSocket', WsPalsu);
  vi.stubGlobal('fetch', vi.fn(() => new Promise(() => {})));
  aturOnline(true);
  Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'visible' });
  document.body.innerHTML = '<div id="game"></div><div id="ui"></div><div id="modal"></div><div id="lapisan-dialog"></div><div id="toast"></div>';
  for (const target of [window, document] as EventTarget[]) {
    const tambah = target.addEventListener.bind(target);
    vi.spyOn(target, 'addEventListener').mockImplementation((jenis, f, o) => {
      if (f) pendengar.push([target, jenis, f, o]);
      tambah(jenis, f, o);
    });
  }
});

afterEach(() => {
  vi.restoreAllMocks();
  for (const [target, jenis, f, o] of pendengar.splice(0)) target.removeEventListener(jenis, f, o as EventListenerOptions);
  vi.clearAllTimers();
  vi.useRealTimers();
  vi.unstubAllGlobals();
  document.body.innerHTML = '';
});

describe('Aplikasi: pesan server sampai ke meja', () => {
  it('aksiDiterima dari server diteruskan ke KontrolMeja dengan id-nya', async () => {
    const { ws } = await diMeja();
    ws.kirimDariServer({ t: 'aksiDiterima', id: 'abc123' });
    expect(dipanggil('aksiDiterima')).toEqual([['abc123']]);
  });

  it("'error' dari server melepas kunci aksi (saatError(true)); \"sinyal putus\" buatan koneksi sendiri saatError(false)", async () => {
    const { ws, app } = await diMeja();
    ws.kirimDariServer({ t: 'error', pesan: 'Bukan giliranmu, Bos.' });
    expect(dipanggil('saatError')).toEqual([[true]]);
    // Socket putus: aksi yang dikirim tidak berangkat, koneksi sendiri yang mengabarkan.
    ws.putus();
    app.kirim({ t: 'aksi', aksi: { jenis: 'ambilDeck' }, id: 'x1' });
    await vi.advanceTimersByTimeAsync(0);
    expect(dipanggil('saatError')).toEqual([[true], [false]]);
    expect(toastTeks()).toContain(PESAN_TERTAHAN);
  });

  it('status sambungan berubah selagi di meja: KontrolMeja diberi tahu (kunci aksi lewat sambungan lama lepas)', async () => {
    const { ws } = await diMeja();
    const awal = dipanggil('koneksiBerubah').length;
    ws.putus();
    expect(dipanggil('koneksiBerubah').length).toBeGreaterThan(awal);
    const sesudahPutus = dipanggil('koneksiBerubah').length;
    await vi.advanceTimersByTimeAsync(1_000);
    WsPalsu.terakhir().buka();
    expect(dipanggil('koneksiBerubah').length).toBeGreaterThan(sesudahPutus);
    expect((kontrol.app as AppUntukMeja).nomorSambungan?.()).toBe(2);
  });

  it('kabar warga kedai menjalankan langkahku: sekali (toast + pembaca layar), tanpa nama kartu', async () => {
    const { ws, g } = await diMeja({ dijalankanWarga: 2 });
    const teks = teksDijalankanWarga(2, true);
    expect(toastTeks()).toContain(teks);
    expect(vi.mocked(umumkan).mock.calls.filter(([t]) => t === teks)).toHaveLength(1);
    expect(teks).not.toMatch(/joker|[♥♦♠♣]|\b(love|wajik|kriting|waru)\b/i);
    // View berikutnya tidak mengulang kabarnya.
    ws.kirimDariServer({ t: 'view', view: viewUntuk(g, 0) });
    await vi.advanceTimersByTimeAsync(0);
    expect(vi.mocked(umumkan).mock.calls.filter(([t]) => t === teks)).toHaveLength(1);
  });

  it('masuk tanpa dijalankanWarga: tidak ada kabar warga', async () => {
    await diMeja();
    expect(toastTeks().some((t) => t.startsWith('Sinyalmu sempat putus'))).toBe(false);
  });
});

describe('Aplikasi: tombol Back di meja', () => {
  const dialogKeluar = () => [...document.querySelectorAll('#lapisan-dialog .dialog')].filter((d) => /keluar/i.test(d.textContent ?? ''));

  it('jendela pilih susunan joker (#63) terbuka: Back tidak menutupnya dan tidak menawarkan keluar meja', async () => {
    await diMeja();
    // Jendela wajib (tanpa Batal) seperti pilih susunan joker: ketuk latar tidak menutupnya.
    const { bukaDialog } = await import('../src/ui/dom');
    const { dialog } = bukaDialog('<h2>Joker-nya jadi apa?</h2><button type="button" data-opsi="0">A</button>', undefined, { bisaDitutup: false });
    kontrol.tahanKeluar = true;
    window.dispatchEvent(new PopStateEvent('popstate'));
    await vi.advanceTimersByTimeAsync(0);
    expect(dialog.isConnected).toBe(true);
    expect(dialogKeluar()).toHaveLength(0);

    // Pembanding: tanpa jendela itu, Back menawarkan keluar seperti biasa.
    kontrol.tahanKeluar = false;
    window.dispatchEvent(new PopStateEvent('popstate'));
    await vi.advanceTimersByTimeAsync(0);
    expect(dialogKeluar().length).toBeGreaterThan(0);
  });
});

describe('Aplikasi: Back dengan lembar obrolan terbuka (0.8.0)', () => {
  it('Back menutup lembar obrolan dulu, tidak menawarkan keluar meja; Back berikutnya baru menawarkan keluar', async () => {
    await diMeja();
    const dialogKeluar = () => [...document.querySelectorAll('#lapisan-dialog .dialog')].filter((d) => /keluar/i.test(d.textContent ?? ''));
    kontrol.obrolanTerbuka = true;
    window.dispatchEvent(new PopStateEvent('popstate'));
    await vi.advanceTimersByTimeAsync(0);
    expect(kontrol.panggilan.filter((p) => p.nama === 'tutupObrolan')).toHaveLength(1);
    expect(dialogKeluar()).toHaveLength(0);
    window.dispatchEvent(new PopStateEvent('popstate'));
    await vi.advanceTimersByTimeAsync(0);
    expect(dialogKeluar().length).toBeGreaterThan(0);
  });
});

describe('Aplikasi: obrolan (0.7.0)', () => {
  it('emote dan riwayat obrolan masuk ke simpanan obrolan dengan nama; meja lain mulai kosong; keluar = dibuang', async () => {
    const { ws, app } = await diMeja();
    const o = app.obrolan!;
    ws.kirimDariServer({ t: 'obrolan', pesan: [{ nama: 'Budi', isi: 'tadi', w: 1 }, { nama: 7, isi: 'rusak' } as never] });
    expect(o.daftar.map((b) => [b.nama, b.isi])).toEqual([['Budi', 'tadi']]);
    ws.kirimDariServer({ t: 'emote', kursi: 1, isi: 'GG' });
    ws.kirimDariServer({ t: 'emote', kursi: 0, isi: '😂' });
    expect(o.daftar.map((b) => [b.nama, b.isi, b.milikku])).toEqual([
      ['Budi', 'tadi', undefined],
      ['Budi', 'GG', false],
      ['Aku', '😂', true],
    ]);
    // Di meja barisnya diserahkan ke KontrolMeja (ditunda bersama gelembung selama animasi), tidak
    // ditambahkan aplikasi sendiri.
    expect(dipanggil('barisEmote')).toHaveLength(2);
    // Gelembung di kursi tetap jalan.
    expect(dipanggil('terimaEmote')).toEqual([
      [1, 'GG'],
      [0, '😂'],
    ]);
    // Tersambung lagi ke meja yang sama: obrolannya tetap (riwayat baru menggantikan kalau dikirim).
    ws.kirimDariServer({ t: 'masuk', kode: 'MADYA', token: 'tok', kursi: 0 });
    expect(o.daftar).toHaveLength(3);
    // Meja lain: mulai kosong.
    ws.kirimDariServer({ t: 'masuk', kode: 'LAINN', token: 'tok', kursi: 0 });
    expect(o.daftar).toHaveLength(0);
    ws.kirimDariServer({ t: 'emote', kursi: 1, isi: 'halo' });
    expect(o.daftar).toHaveLength(1);
    app.keluarMeja();
    expect(o.daftar).toHaveLength(0);
  });
});

describe('Aplikasi: kursi dibuka di tab/perangkat lain (kode 4000)', () => {
  it('kembali ke beranda, sesi disimpan, dan online/visibility TIDAK menyambung ulang sendiri', async () => {
    const { ws } = await diMeja();
    ws.putus(4000);
    expect(toastTeks()).toContain(ALASAN_TAB_LAIN);
    expect(document.querySelector('#ui .layar.beranda')).not.toBeNull();
    expect(sesiTersimpan()).toMatchObject({ kode: 'MADYA', token: 'tok' });
    const n = WsPalsu.semua.length;
    window.dispatchEvent(new Event('online'));
    aturTerlihat('hidden');
    aturTerlihat('visible');
    await vi.advanceTimersByTimeAsync(30_000);
    expect(WsPalsu.semua.length).toBe(n);
  });
});

describe('Aplikasi: sesi tersimpan dilanjutkan dari beranda', () => {
  it('dibuka tanpa sinyal: tetap mencoba (tidak menunggu navigator.onLine), sinyal kembali = gabung bertoken', async () => {
    aturOnline(false);
    localStorage.setItem(KUNCI_SESI, JSON.stringify({ kode: 'MADYA', token: 'tok' }));
    await nyalakan();
    expect(WsPalsu.semua).toHaveLength(1);
    // Belum ada sinyal: percobaannya gagal, terus dicoba (mode lanjut sesi tidak pernah 'gagal').
    WsPalsu.terakhir().putus();
    await vi.advanceTimersByTimeAsync(100);
    const n = WsPalsu.semua.length;
    aturOnline(true);
    window.dispatchEvent(new Event('online'));
    expect(WsPalsu.semua.length).toBe(n + 1);
    WsPalsu.terakhir().buka();
    expect(terkirim(WsPalsu.terakhir())[0]).toMatchObject({ t: 'gabung', kode: 'MADYA', token: 'tok' });
  });

  it("sinyal kembali di beranda tanpa koneksi, padahal ada sesi tersimpan: disambung lagi", async () => {
    await nyalakan();
    expect(WsPalsu.semua).toHaveLength(0);
    // Sesi tersimpan muncul belakangan (mis. percobaan sebelumnya ditutup karena gagal).
    localStorage.setItem(KUNCI_SESI, JSON.stringify({ kode: 'MADYA', token: 'tok' }));
    window.dispatchEvent(new Event('online'));
    expect(WsPalsu.semua).toHaveLength(1);
    WsPalsu.terakhir().buka();
    expect(terkirim(WsPalsu.terakhir())[0]).toMatchObject({ t: 'gabung', kode: 'MADYA', token: 'tok' });
  });

  it('tab terlihat lagi di beranda dengan sesi tersimpan: disambung lagi', async () => {
    await nyalakan();
    localStorage.setItem(KUNCI_SESI, JSON.stringify({ kode: 'MADYA', token: 'tok' }));
    aturTerlihat('hidden');
    expect(WsPalsu.semua).toHaveLength(0);
    aturTerlihat('visible');
    expect(WsPalsu.semua).toHaveLength(1);
    WsPalsu.terakhir().buka();
    expect(terkirim(WsPalsu.terakhir())[0]).toMatchObject({ t: 'gabung', kode: 'MADYA', token: 'tok' });
  });
});
