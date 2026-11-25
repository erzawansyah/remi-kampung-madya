// @vitest-environment happy-dom
// Jendela "Yang baru" dirangkai di Aplikasi (main.ts), dinyalakan utuh seperti halaman yang baru dibuka
// (WebSocket, Phaser, dan KontrolMeja diganti tiruan, pola aplikasiKoneksi.test.ts):
// - pembukaan pertama pemain baru: versi disimpan diam-diam, tanpa jendela, tawaran latihan tetap;
// - pembaruan: jendela tampil sekali di beranda, lalu tidak lagi;
// - aplikasi dibuka langsung ke meja (sesi tersimpan): jendela menunggu sampai beranda tampil;
// - simpanan rusak: aman (diperlakukan seperti versi sebelumnya tidak diketahui).

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { buatPermainan, terapkanAksi, viewUntuk, type GameState } from '@remi/engine';
import { PENGATURAN_BAWAAN, type InfoMeja } from '@remi/meja';
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
vi.mock('../src/game/game', () => ({
  buatGame: vi.fn(() => ({ game: { asli: null, tidur: false, siap: false }, scene: Promise.resolve({}) })),
  bangunkanGame: vi.fn(),
  tidurkanGame: vi.fn(),
  pramuatGame: vi.fn(),
}));
const kontrol = vi.hoisted(() => ({ app: null as unknown }));
vi.mock('../src/kontrolMeja', async (asli) => {
  const m = await asli<typeof import('../src/kontrolMeja')>();
  class KontrolPalsu {
    constructor(app: unknown) {
      kontrol.app = app;
    }
    perbarui = vi.fn();
    aksiDiterima = vi.fn();
    saatError = vi.fn();
    teksPenolakan = (pesan: string) => pesan;
    koneksiBerubah = vi.fn();
    terimaEmote = vi.fn();
    hancurkan = vi.fn();
    keadaanTampil = () => ({ status: null, sibuk: false, klasemen: false });
    menahanKeluar = () => false;
  }
  return { ...m, KontrolMeja: KontrolPalsu };
});

import { bukaTentang } from '../src/ui/jendelaMalas';

const KUNCI = 'remi.versiDilihat';
const pendengar: [EventTarget, string, EventListenerOrEventListenerObject, unknown][] = [];

/** Nyalakan aplikasi dengan versi build `versi`, lalu tunggu modul jendela "Yang baru" (kalau dimuat) selesai. */
async function nyalakan(versi: string): Promise<void> {
  Object.assign(globalThis, { __VERSI_APP__: versi, __BUILD_SHA__: 'dev', __BUILD_WAKTU__: '2026-11-25T00:00:00.000Z' });
  vi.resetModules();
  await import('../src/main');
  await tungguModul();
}

/** Registry modul sama dengan main.ts sesudah resetModules: import ini selesai = import di main.ts juga. */
async function tungguModul(): Promise<void> {
  await import('../src/ui/yangBaru');
  await vi.advanceTimersByTimeAsync(0);
}

const jendela = () => document.querySelector<HTMLElement>('.dialog.yang-baru');
const pemainLama = () => localStorage.setItem('remi.preferensi', JSON.stringify({ tutorialSelesai: true }));

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

beforeEach(() => {
  vi.useFakeTimers();
  localStorage.clear();
  sessionStorage.clear();
  kontrol.app = null;
  vi.mocked(bukaTentang).mockClear();
  WsPalsu.semua = [];
  vi.stubGlobal('WebSocket', WsPalsu);
  vi.stubGlobal('fetch', vi.fn(() => new Promise(() => {})));
  Object.defineProperty(navigator, 'onLine', { configurable: true, get: () => true });
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

afterEach(async () => {
  (await import('../src/ui/dom')).tutupSemuaJendela();
  vi.restoreAllMocks();
  for (const [target, jenis, f, o] of pendengar.splice(0)) target.removeEventListener(jenis, f, o as EventListenerOptions);
  vi.clearAllTimers();
  vi.useRealTimers();
  vi.unstubAllGlobals();
  document.body.innerHTML = '';
});

describe('Aplikasi: jendela "Yang baru"', () => {
  it('pembukaan pertama pemain baru: versi disimpan diam-diam, tawaran latihan tetap, tanpa jendela', async () => {
    await nyalakan('0.7.1');
    expect(document.querySelector('#ui .tawaran-latihan')).not.toBeNull();
    expect(jendela()).toBeNull();
    expect(JSON.parse(localStorage.getItem(KUNCI)!)).toBe('0.7.1');
  });

  it('pembaruan 0.7.0 → 0.7.1: tampil sekali di beranda, lalu tidak lagi', async () => {
    pemainLama();
    localStorage.setItem(KUNCI, JSON.stringify('0.7.0'));
    await nyalakan('0.7.1');
    expect(document.querySelector('#ui .layar.beranda')).not.toBeNull();
    const d = jendela()!;
    expect(d).not.toBeNull();
    expect(d.querySelector('h2')!.textContent).toBe('Yang baru di versi 0.7.1');
    expect(d.querySelectorAll('.changelog-ringkas li').length).toBeGreaterThan(0);
    expect(JSON.parse(localStorage.getItem(KUNCI)!)).toBe('0.7.1');
    // "Catatan lengkap" membuka Catatan perubahan di Tentang (Usul fitur tetap ditawarkan, seperti dari beranda).
    d.querySelector<HTMLButtonElement>('[data-catatan]')!.click();
    expect(jendela()).toBeNull();
    expect(vi.mocked(bukaTentang)).toHaveBeenCalledWith(expect.objectContaining({ bukaCatatan: true, usulFitur: expect.any(Function) }));
    // Dibuka lagi: tidak muncul lagi.
    await nyalakan('0.7.1');
    expect(jendela()).toBeNull();
  });

  it('pemain lama dari sebelum fitur ini (belum ada simpanan): versi sekarang saja', async () => {
    pemainLama();
    await nyalakan('0.7.1');
    expect(jendela()!.querySelectorAll('h3')).toHaveLength(0);
    expect(jendela()!.querySelector('h2')!.textContent).toBe('Yang baru di versi 0.7.1');
  });

  it('beberapa versi sekaligus: terbaru di depan', async () => {
    pemainLama();
    localStorage.setItem(KUNCI, JSON.stringify('0.5.0'));
    await nyalakan('0.7.1');
    expect([...jendela()!.querySelectorAll('h3')].map((h) => h.textContent)).toEqual(['Versi 0.7.1', 'Versi 0.7.0', 'Versi 0.6.0']);
    expect(jendela()!.querySelector('.yang-baru-lain')).toBeNull();
  });

  it('simpanan rusak: tidak macet, diperlakukan seperti versi sebelumnya tidak diketahui', async () => {
    pemainLama();
    localStorage.setItem(KUNCI, '{rusak');
    await nyalakan('0.7.1');
    expect(jendela()!.querySelector('h2')!.textContent).toBe('Yang baru di versi 0.7.1');
    expect(JSON.parse(localStorage.getItem(KUNCI)!)).toBe('0.7.1');
  });

  it('dibuka langsung ke meja (sesi tersimpan): tidak tampil di meja, baru sesudah kembali ke beranda', async () => {
    pemainLama();
    localStorage.setItem(KUNCI, JSON.stringify('0.7.0'));
    localStorage.setItem('remi.sesiOnline', JSON.stringify({ kode: 'MADYA', token: 'tok' }));
    await nyalakan('0.7.1');
    // Selagi menyambung ke meja (beranda masih tampil sebentar): belum.
    expect(jendela()).toBeNull();
    const ws = WsPalsu.terakhir();
    ws.buka();
    const g = permainan();
    ws.kirimDariServer({ t: 'masuk', kode: 'MADYA', token: 'tok', kursi: 0 });
    ws.kirimDariServer({ t: 'meja', info: infoMeja(g) });
    await vi.advanceTimersByTimeAsync(0);
    ws.kirimDariServer({ t: 'view', view: viewUntuk(g, 0) });
    await vi.advanceTimersByTimeAsync(0);
    expect(kontrol.app).not.toBeNull();
    expect(jendela()).toBeNull();
    expect(JSON.parse(localStorage.getItem(KUNCI)!)).toBe('0.7.0');
    // Keluar meja → beranda: sekarang tampil.
    (kontrol.app as AppUntukMeja & { keluarMeja(): void }).keluarMeja();
    await tungguModul();
    expect(document.querySelector('#ui .layar.beranda')).not.toBeNull();
    expect(jendela()).not.toBeNull();
    expect(JSON.parse(localStorage.getItem(KUNCI)!)).toBe('0.7.1');
  });
});
