// @vitest-environment happy-dom
// Kompetisi versi 2 (keputusan pemilik #51, 24 Okt 2026) di Aplikasi (main.ts), dijalankan utuh seperti
// aplikasiKoneksi.test.ts: WebSocket tiruan, Phaser dan KontrolMeja tiruan. Yang dijaga:
// - laken biru (html[data-laken="kompetisi"]) selama di lobi/meja kompetisi, dilepas saat meninggalkannya;
// - pesan kompetisiHasil sampai ke KontrolMeja, juga kalau datang sebelum meja selesai dimuat;
// - Kembali ke kompetisi: keluar dari meja lalu detail kompetisinya terbuka;
// - lobi kompetisi yang dibubarkan server langsung membuka detail kompetisinya;
// - Duduk dan Buka meja baru dari detail: gabung (dengan tiket) dan buat meja kompetisi.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { buatPermainan, terapkanAksi, viewUntuk, type GameState } from '@remi/engine';
import { PENGATURAN_BAWAAN, PENGATURAN_KOMPETISI_BAWAAN, TEKS_LOBI_KOMPETISI_BUBAR, type InfoMeja } from '@remi/meja';
import type { AppUntukMeja, PesanHasilKompetisi } from '../src/kontrolMeja';
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

const KUNCI_SESI = 'remi.sesiOnline';
const KOMPETISI = { kode: 'KOMPA', nama: 'Remi Jumat' };
const pendengar: [EventTarget, string, EventListenerOrEventListenerObject, unknown][] = [];

async function nyalakan(): Promise<void> {
  vi.resetModules();
  await import('../src/main');
  await vi.advanceTimersByTimeAsync(0);
}

const dipanggil = (n: string) => kontrol.panggilan.filter((p) => p.nama === n).map((p) => p.arg);
const toastTeks = () => [...document.querySelectorAll<HTMLElement>('#toast .toast')].map((el) => el.dataset.pesan ?? '');
const laken = () => document.documentElement.getAttribute('data-laken');

function permainan(): GameState {
  const g0 = buatPermainan({ pemain: ['Aku', 'Budi', 'Cici'], seed: 7 });
  const h = terapkanAksi(g0, { jenis: 'mulaiPutaran', pengocok: 0 });
  if (!h.ok) throw new Error(h.error.pesan);
  return h.state;
}

function infoMeja(g: GameState, ubah: Partial<InfoMeja> = {}): InfoMeja {
  return {
    kode: 'MJKOM',
    status: 'main',
    pengaturan: { ...PENGATURAN_BAWAAN, jumlahPemain: 3 },
    kursi: g.pemain.map((p) => ({ jenis: 'manusia', nama: p.nama, terhubung: true, level: 'normal' })),
    host: 0,
    kursiSaya: 0,
    setujuAkhiri: [],
    batasWaktu: null,
    diambilAlihBot: false,
    menungguJoker: [],
    botMikir: null,
    kompetisi: KOMPETISI,
    ...ubah,
  };
}

const hasil = (): PesanHasilKompetisi => ({
  t: 'kompetisiHasil',
  kompetisi: KOMPETISI,
  minMain: 3,
  jumlahPeringkat: 0,
  pemain: [{ kursi: 0, nama: 'Aku', nilai: 10, keluar: false, rataNilai: 10, main: 1, peringkatSebelum: null, peringkatSesudah: null }],
});

/** Detail kompetisi KOMPA dari server (dengan satu meja yang menunggu). */
const detailKompetisi = () => ({
  v: 1,
  kode: 'KOMPA',
  nama: 'Remi Jumat',
  masa: 'minggu',
  status: 'berjalan',
  jumlahPeserta: 4,
  diajukanPada: Date.UTC(2026, 9, 20),
  mulaiPada: Date.UTC(2026, 9, 20, 1),
  berakhirPada: Date.UTC(2026, 9, 27, 1),
  disudahi: false,
  mejaMain: 0,
  pengaturan: { ...PENGATURAN_KOMPETISI_BAWAAN },
  minPeserta: 4,
  minMain: 3,
  peserta: ['Aku', 'Budi', 'Cici', 'Dodi'],
  jumlahPermainan: 0,
  setujuTutup: 0,
  peringkat: [],
  belumCukup: [],
  meja: [{ kode: 'MJANI', nama: 'Budi', terisi: 1, jumlahPemain: 4, pemain: ['Budi'] }],
  saya: { id: 1, nama: 'Aku', setujuTutup: false },
});

/** fetch: detail kompetisi dijawab, permintaan lain (healthz, sw) dibiarkan menggantung. */
function pasangFetch(): string[] {
  const url: string[] = [];
  vi.stubGlobal(
    'fetch',
    vi.fn((u: string) => {
      url.push(u);
      if (u.startsWith('/api/kompetisi/')) return Promise.resolve({ ok: true, status: 200, json: async () => detailKompetisi() } as Response);
      return new Promise(() => {});
    }),
  );
  return url;
}

/** Aplikasi dibuka dengan sesi tersimpan, kembali ke meja kompetisi KOMPA. Pesan `meja` saja (tanpa view). */
async function diMejaKompetisi(ubah: Partial<InfoMeja> = {}, sebelumSiap?: (ws: WsPalsu) => void) {
  localStorage.setItem(KUNCI_SESI, JSON.stringify({ kode: 'MJKOM', token: 'tok' }));
  await nyalakan();
  const ws = WsPalsu.terakhir();
  ws.buka();
  const g = permainan();
  ws.kirimDariServer({ t: 'masuk', kode: 'MJKOM', token: 'tok', kursi: 0 });
  ws.kirimDariServer({ t: 'meja', info: infoMeja(g, ubah) });
  sebelumSiap?.(ws);
  await vi.advanceTimersByTimeAsync(0);
  if ((ubah.status ?? 'main') !== 'lobi') {
    ws.kirimDariServer({ t: 'view', view: viewUntuk(g, 0) });
    await vi.advanceTimersByTimeAsync(0);
  }
  return { ws, g };
}

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
  localStorage.setItem('remi.tiketKompetisi', JSON.stringify([{ kode: 'KOMPA', token: 'tiket-aku', nama: 'Aku' }]));
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

describe('Aplikasi: meja kompetisi', () => {
  it('laken biru selama di meja kompetisi; kompetisiHasil diteruskan ke meja', async () => {
    const { ws } = await diMejaKompetisi();
    expect(laken()).toBe('kompetisi');
    const p = hasil();
    ws.kirimDariServer(p);
    expect(dipanggil('terimaHasilKompetisi')).toEqual([[p]]);
  });

  it('kompetisiHasil yang datang sebelum meja selesai dimuat diberikan begitu KontrolMeja dibuat', async () => {
    const p = hasil();
    await diMejaKompetisi({}, (ws) => {
      expect(kontrol.app).toBeNull();
      ws.kirimDariServer(p);
    });
    expect(dipanggil('terimaHasilKompetisi')).toEqual([[p]]);
  });

  it('Kembali ke kompetisi: kirim keluar, sesi dilupakan, laken biasa, detail kompetisinya terbuka', async () => {
    const { ws } = await diMejaKompetisi();
    const url = pasangFetch();
    (kontrol.app as AppUntukMeja).kembaliKeKompetisi!('KOMPA');
    expect(ws.jenisTerkirim()).toContain('keluar');
    expect(localStorage.getItem(KUNCI_SESI)).toBeNull();
    expect(laken()).toBeNull();
    await vi.advanceTimersByTimeAsync(0);
    expect(url).toContain('/api/kompetisi/KOMPA');
    expect(document.querySelector('#ui .layar-kompetisi #isi-detail h2')!.textContent).toBe('Remi Jumat');
    expect(document.querySelector('#ui .layar.beranda')).toBeNull();
  });

  it('meja biasa: laken tetap biasa', async () => {
    await diMejaKompetisi({ kompetisi: undefined });
    expect(laken()).toBeNull();
  });
});

describe('Aplikasi: lobi kompetisi', () => {
  it('lobi memakai laken biru; dibubarkan server = toast lalu detail kompetisinya terbuka', async () => {
    const { ws } = await diMejaKompetisi({ status: 'lobi' });
    expect(document.querySelector('#ui .lobi-kompetisi')).not.toBeNull();
    expect(laken()).toBe('kompetisi');
    const url = pasangFetch();
    ws.kirimDariServer({ t: 'keluar', alasan: TEKS_LOBI_KOMPETISI_BUBAR });
    await vi.advanceTimersByTimeAsync(0);
    expect(toastTeks()).toContain(TEKS_LOBI_KOMPETISI_BUBAR);
    expect(laken()).toBeNull();
    expect(url).toContain('/api/kompetisi/KOMPA');
    expect(document.querySelector('#ui .layar-kompetisi')).not.toBeNull();
  });

  it('Keluar meja dari lobi kompetisi: kursi dilepas (keluar), lalu kembali ke detail kompetisinya', async () => {
    const { ws } = await diMejaKompetisi({ status: 'lobi' });
    const url = pasangFetch();
    document.querySelector<HTMLButtonElement>('#ui #keluar')!.click();
    await vi.advanceTimersByTimeAsync(0);
    document.querySelector<HTMLButtonElement>('#lapisan-dialog [data-ya]')!.click();
    await vi.advanceTimersByTimeAsync(0);
    expect(ws.jenisTerkirim()).toContain('keluar');
    expect(url).toContain('/api/kompetisi/KOMPA');
    expect(document.querySelector('#ui .layar-kompetisi')).not.toBeNull();
    expect(laken()).toBeNull();
  });

  it('dikeluarkan dengan alasan lain tetap ke beranda', async () => {
    const { ws } = await diMejaKompetisi({ status: 'lobi' });
    ws.kirimDariServer({ t: 'keluar', alasan: 'Kursimu dikosongkan host.' });
    await vi.advanceTimersByTimeAsync(0);
    expect(document.querySelector('#ui .layar.beranda')).not.toBeNull();
    expect(laken()).toBeNull();
  });
});

describe('Aplikasi: duduk dari detail kompetisi', () => {
  /** Detail kompetisi KOMPA lewat Kembali ke kompetisi (jalan tercepat ke layar itu di test ini). */
  async function diDetail() {
    await diMejaKompetisi();
    pasangFetch();
    (kontrol.app as AppUntukMeja).kembaliKeKompetisi!('KOMPA');
    await vi.advanceTimersByTimeAsync(0);
    expect(document.querySelector('[data-duduk="MJANI"]')).not.toBeNull();
  }

  it('Duduk: gabung ke meja itu dengan tiket kompetisi', async () => {
    await diDetail();
    const n = WsPalsu.semua.length;
    document.querySelector<HTMLButtonElement>('[data-duduk="MJANI"]')!.click();
    expect(WsPalsu.semua.length).toBe(n + 1);
    WsPalsu.terakhir().buka();
    const gabung = WsPalsu.terakhir().terkirim.find((p) => p.t === 'gabung');
    expect(gabung).toMatchObject({ t: 'gabung', kode: 'MJANI', nama: 'Aku', tiket: [{ kode: 'KOMPA', token: 'tiket-aku' }] });
  });

  it('Buka meja baru: buat meja kompetisi dengan tiket (aturannya dari kompetisi)', async () => {
    await diDetail();
    document.querySelector<HTMLButtonElement>('#buka-meja')!.click();
    WsPalsu.terakhir().buka();
    const buat = WsPalsu.terakhir().terkirim.find((p) => p.t === 'buat');
    expect(buat).toEqual({ t: 'buat', nama: 'Aku', pengaturan: {}, kompetisi: { kode: 'KOMPA', token: 'tiket-aku' } });
  });
});
