// @vitest-environment happy-dom
// Nonton (keputusan pemilik #60) di Aplikasi (main.ts), dijalankan utuh seperti aplikasiKompetisi.test.ts:
// WebSocket tiruan, Phaser dan KontrolMeja tiruan. Yang dijaga:
// - daftar meja publik meminta meja yang bisa ditonton, dan Tonton mengirim pesan tonton (dengan token);
// - tontonan tampil sebagai layar penonton; minta lihat terkirim;
// - diizinkan: meja tampil lewat KontrolMeja mode penonton dengan info dan view pemain itu, tanpa
//   mencatat riwayat, dan aksi meja yang dikirim KontrolMeja dibuang;
// - Berhenti lihat kembali ke layar penonton; tontonan selesai dari server kembali ke daftar meja;
// - sambung ulang mengirim tonton lagi (bukan sesi kursi tersimpan).

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { buatPermainan, terapkanAksi, viewUntuk, type GameState } from '@remi/engine';
import { PENGATURAN_BAWAAN, type InfoMeja, type InfoTontonan } from '@remi/meja';
import type { AppUntukMeja } from '../src/kontrolMeja';
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

const kontrol = vi.hoisted(() => ({ panggilan: [] as { nama: string; arg: unknown[] }[], app: null as unknown }));
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
    koneksiBerubah = catat('koneksiBerubah');
    terimaEmote = catat('terimaEmote');
    terimaLedek = catat('terimaLedek');
    terimaHasilKompetisi = catat('terimaHasilKompetisi');
    hancurkan = catat('hancurkan');
    keadaanTampil = () => ({ status: null, sibuk: false, klasemen: false });
  }
  return { ...m, KontrolMeja: KontrolPalsu };
});

Object.assign(globalThis, { __VERSI_APP__: '0.0.0', __BUILD_SHA__: 'dev', __BUILD_WAKTU__: '2026-10-24T00:00:00.000Z' });

const pendengar: [EventTarget, string, EventListenerOrEventListenerObject, unknown][] = [];

async function nyalakan(): Promise<void> {
  vi.resetModules();
  await import('../src/main');
  await vi.advanceTimersByTimeAsync(0);
}

const dipanggil = (n: string) => kontrol.panggilan.filter((p) => p.nama === n).map((p) => p.arg);
const toastTeks = () => [...document.querySelectorAll<HTMLElement>('#toast .toast')].map((el) => el.dataset.pesan ?? '');
beforeEach(() => {
  vi.useFakeTimers();
  localStorage.clear();
  sessionStorage.clear();
  kontrol.panggilan.length = 0;
  kontrol.app = null;
  WsPalsu.semua = [];
  vi.stubGlobal('WebSocket', WsPalsu);
  vi.stubGlobal('fetch', vi.fn(() => new Promise(() => {})));
  Object.defineProperty(navigator, 'onLine', { configurable: true, get: () => true });
  Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'visible' });
  document.documentElement.removeAttribute('data-laken');
  document.body.innerHTML = '<div id="game"></div><div id="ui"></div><div id="modal"></div><div id="lapisan-dialog"></div><div id="toast"></div>';
  localStorage.setItem('remi.nama', JSON.stringify('Aku'));
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
  document.documentElement.removeAttribute('data-laken');
});

function permainan(): GameState {
  const g0 = buatPermainan({ pemain: ['Ani', 'Budi', 'Warga'], seed: 7 });
  const h = terapkanAksi(g0, { jenis: 'mulaiPutaran', pengocok: 0 });
  if (!h.ok) throw new Error(h.error.pesan);
  return h.state;
}

function infoMeja(g: GameState, kursiSaya: number): InfoMeja {
  return {
    kode: 'TONTN',
    status: 'main',
    pengaturan: { ...PENGATURAN_BAWAAN, jumlahPemain: 3 },
    kursi: g.pemain.map((p, i) => ({ jenis: i < 2 ? 'manusia' : 'bot', nama: p.nama, terhubung: true, level: 'normal' })),
    host: 0,
    kursiSaya,
    setujuAkhiri: [],
    batasWaktu: null,
    diambilAlihBot: false,
    menungguJoker: [],
    botMikir: null,
    penonton: { jumlah: 1 },
  };
}

const tontonan = (ubah: Partial<InfoTontonan> = {}): InfoTontonan => ({
  kode: 'TONTN',
  namaHost: 'Ani',
  status: 'main',
  pemain: [
    { nama: 'Ani', minta: 'bisa' },
    { nama: 'Budi', minta: 'bisa' },
    { nama: 'Warga', minta: 'tidak' },
  ],
  buangan: [],
  melihat: null,
  jumlahPenonton: 1,
  ...ubah,
});

/** Beranda → Meja publik → Tonton meja TONTN → tontonan pertama dari server. */
/** Pesan terakhir yang dikirim aplikasi, selain ping. */
const terakhir = (ws: WsPalsu) => ws.terkirim.filter((p) => p.t !== 'ping').at(-1);

async function nonton() {
  await nyalakan();
  document.querySelector<HTMLButtonElement>('#publik')!.click();
  await vi.advanceTimersByTimeAsync(0);
  const ws = WsPalsu.terakhir();
  ws.buka();
  await vi.advanceTimersByTimeAsync(0);
  expect(ws.terkirim.find((p) => p.t === 'daftar')).toEqual({ t: 'daftar', tonton: true });
  ws.kirimDariServer({ t: 'daftar', meja: [{ kode: 'TONTN', namaHost: 'Ani', jumlahPemain: 3, terisi: 3, status: 'main', tonton: true }] });
  await vi.advanceTimersByTimeAsync(0);
  document.querySelector<HTMLElement>('[data-tonton="TONTN"]')!.click();
  await vi.advanceTimersByTimeAsync(0);
  const tonton = ws.terkirim.find((p) => p.t === 'tonton');
  expect(tonton).toMatchObject({ t: 'tonton', kode: 'TONTN', nama: 'Aku' });
  expect((tonton as { token?: string }).token).toMatch(/^[0-9a-f]{32}$/);
  ws.kirimDariServer({ t: 'tontonan', info: tontonan() });
  await vi.advanceTimersByTimeAsync(0);
  return ws;
}

describe('Aplikasi: nonton', () => {
  it('layar penonton, minta lihat, diizinkan, lalu berhenti lihat', async () => {
    const ws = await nonton();
    expect(document.querySelector('.layar-tontonan h1')!.textContent).toBe('Nonton meja Ani');
    document.querySelector<HTMLButtonElement>('[data-minta="1"]')!.click();
    expect(terakhir(ws)).toEqual({ t: 'mintaLihat', kursi: 1 });

    // Budi mengizinkan: tontonan, info meja, lalu view milik Budi.
    const g = permainan();
    ws.kirimDariServer({ t: 'tontonan', info: tontonan({ melihat: 1, pemain: [{ nama: 'Ani', minta: 'tidak' }, { nama: 'Budi', minta: 'dilihat' }, { nama: 'Warga', minta: 'tidak' }] }) });
    ws.kirimDariServer({ t: 'tontonMeja', info: infoMeja(g, 1) });
    await vi.advanceTimersByTimeAsync(0);
    ws.kirimDariServer({ t: 'tontonView', view: viewUntuk(g, 1) });
    await vi.advanceTimersByTimeAsync(0);
    const app = kontrol.app as AppUntukMeja;
    expect(app.penonton).toBe(true);
    const perbarui = dipanggil('perbarui');
    expect(perbarui.some(([info]) => (info as InfoMeja | null)?.kursiSaya === 1)).toBe(true);
    expect(perbarui.some(([, view]) => (view as { saya: number } | null)?.saya === 1)).toBe(true);
    expect(toastTeks()).toContain('Budi mengizinkan kamu lihat kartunya.');

    // Aksi meja dari KontrolMeja (mis. OK joker) tidak pernah dikirim selama menonton.
    const sebelum = ws.jenisTerkirim().length;
    app.kirim({ t: 'siapJoker' });
    app.kirim({ t: 'aksi', aksi: { jenis: 'ambilDeck' } });
    app.kirim({ t: 'emote', isi: 'GG' });
    expect(ws.jenisTerkirim().length).toBe(sebelum);
    // Riwayat HP tidak diisi permainan orang lain.
    expect(localStorage.getItem('remi.riwayat')).toBeNull();

    app.berhentiLihat!();
    await vi.advanceTimersByTimeAsync(0);
    expect(terakhir(ws)).toEqual({ t: 'berhentiLihat' });
    expect(dipanggil('hancurkan').length).toBeGreaterThan(0);
    expect(document.querySelector('.layar-tontonan')).not.toBeNull();
  });

  it('pemain menghentikan: kabar singkat, kembali ke layar penonton', async () => {
    const ws = await nonton();
    const g = permainan();
    ws.kirimDariServer({ t: 'tontonan', info: tontonan({ melihat: 0 }) });
    ws.kirimDariServer({ t: 'tontonMeja', info: infoMeja(g, 0) });
    await vi.advanceTimersByTimeAsync(0);
    ws.kirimDariServer({ t: 'tontonan', info: tontonan({ pemain: [{ nama: 'Ani', minta: 'jeda', jedaMs: 180_000 }, { nama: 'Budi', minta: 'bisa' }, { nama: 'Warga', minta: 'tidak' }] }) });
    await vi.advanceTimersByTimeAsync(0);
    expect(toastTeks()).toContain('Ani berhenti membagi kartunya.');
    expect(document.querySelector('.layar-tontonan')).not.toBeNull();
  });

  it('ditolak: kabar singkat; tontonan selesai dari server kembali ke daftar meja', async () => {
    const ws = await nonton();
    ws.kirimDariServer({ t: 'tontonan', info: tontonan({ pemain: [{ nama: 'Ani', minta: 'menunggu' }, { nama: 'Budi', minta: 'bisa' }, { nama: 'Warga', minta: 'tidak' }] }) });
    ws.kirimDariServer({ t: 'tontonan', info: tontonan({ pemain: [{ nama: 'Ani', minta: 'jeda', jedaMs: 180_000 }, { nama: 'Budi', minta: 'bisa' }, { nama: 'Warga', minta: 'tidak' }] }) });
    await vi.advanceTimersByTimeAsync(0);
    expect(toastTeks()).toContain('Ani belum mau kartunya dilihat.');
    const nDaftar = ws.terkirim.filter((p) => p.t === 'daftar').length;
    ws.kirimDariServer({ t: 'tontonSelesai', alasan: 'Permainannya sudah selesai. Makasih sudah nonton.' });
    await vi.advanceTimersByTimeAsync(0);
    expect(toastTeks()).toContain('Permainannya sudah selesai. Makasih sudah nonton.');
    expect(ws.terkirim.filter((p) => p.t === 'daftar').length).toBe(nDaftar + 1);
  });

  it('sambungan penonton sendiri yang putus: izin lepas tanpa menyalahkan pemainnya', async () => {
    const ws = await nonton();
    const g = permainan();
    ws.kirimDariServer({ t: 'tontonan', info: tontonan({ melihat: 0 }) });
    ws.kirimDariServer({ t: 'tontonMeja', info: infoMeja(g, 0) });
    await vi.advanceTimersByTimeAsync(0);
    ws.putus();
    await vi.advanceTimersByTimeAsync(5000);
    const baru = WsPalsu.terakhir();
    baru.buka();
    await vi.advanceTimersByTimeAsync(0);
    expect(baru.jenisTerkirim()).toContain('tonton');
    // Server membuat penonton baru (izin lama hilang bersama sambungan lama).
    baru.kirimDariServer({ t: 'tontonan', info: tontonan() });
    await vi.advanceTimersByTimeAsync(0);
    expect(toastTeks()).not.toContain('Ani berhenti membagi kartunya.');
    expect(toastTeks()).toContain('Sambunganmu sempat putus, jadi izin lihat kartunya lepas. Minta lagi ya.');
    expect(document.querySelector('.layar-tontonan')).not.toBeNull();
  });

  it('Tonton yang ditolak server tidak diingat: sambung ulang berikutnya tidak menonton diam-diam', async () => {
    await nyalakan();
    document.querySelector<HTMLButtonElement>('#publik')!.click();
    await vi.advanceTimersByTimeAsync(0);
    const ws = WsPalsu.terakhir();
    ws.buka();
    await vi.advanceTimersByTimeAsync(0);
    ws.kirimDariServer({ t: 'daftar', meja: [{ kode: 'TONTN', namaHost: 'Ani', jumlahPemain: 3, terisi: 3, status: 'main', tonton: true }] });
    await vi.advanceTimersByTimeAsync(0);
    document.querySelector<HTMLElement>('[data-tonton="TONTN"]')!.click();
    await vi.advanceTimersByTimeAsync(0);
    ws.kirimDariServer({ t: 'error', pesan: 'Penontonnya sudah penuh, Bos.' });
    await vi.advanceTimersByTimeAsync(0);
    expect(toastTeks()).toContain('Penontonnya sudah penuh, Bos.');
    ws.putus();
    await vi.advanceTimersByTimeAsync(5000);
    const baru = WsPalsu.terakhir();
    expect(baru).not.toBe(ws);
    baru.buka();
    await vi.advanceTimersByTimeAsync(0);
    expect(baru.jenisTerkirim()).not.toContain('tonton');
  });

  it('meja yang ditonton hilang atau tontonan selesai: sambung ulang berikutnya tidak menonton lagi', async () => {
    const ws = await nonton();
    ws.kirimDariServer({ t: 'error', pesan: 'Meja TONTN nggak ketemu.' });
    await vi.advanceTimersByTimeAsync(0);
    expect(terakhir(ws)).toEqual({ t: 'daftar', tonton: true });
    ws.putus();
    await vi.advanceTimersByTimeAsync(5000);
    const baru = WsPalsu.terakhir();
    baru.buka();
    await vi.advanceTimersByTimeAsync(0);
    expect(baru.jenisTerkirim()).not.toContain('tonton');
  });

  it('Berhenti nonton selagi putus: tidak menonton lagi sesudah sambung dan tanpa kabar "kursi belum dilepas"', async () => {
    const ws = await nonton();
    ws.putus();
    await vi.advanceTimersByTimeAsync(0);
    document.querySelector<HTMLButtonElement>('#berhenti-nonton')!.click();
    await vi.advanceTimersByTimeAsync(5000);
    const baru = WsPalsu.terakhir();
    baru.buka();
    await vi.advanceTimersByTimeAsync(0);
    expect(baru.jenisTerkirim()).not.toContain('tonton');
    expect(baru.jenisTerkirim()).toContain('daftar');
  });

  it('sambung ulang mengirim tonton lagi, bukan sesi kursi tersimpan', async () => {
    localStorage.setItem('remi.sesiOnline', JSON.stringify({ kode: 'LAMA1', token: 'tok' }));
    const ws = await nonton();
    ws.putus();
    await vi.advanceTimersByTimeAsync(5000);
    const baru = WsPalsu.terakhir();
    expect(baru).not.toBe(ws);
    baru.buka();
    await vi.advanceTimersByTimeAsync(0);
    expect(baru.jenisTerkirim()).toContain('tonton');
    // Kode tonton yang sama dari daftar (tetap selama meja hidup), bukan kode meja.
    expect(baru.terkirim.find((p) => p.t === 'tonton')).toMatchObject({ kode: 'TONTN' });
    expect(baru.jenisTerkirim()).not.toContain('gabung');
  });
});
