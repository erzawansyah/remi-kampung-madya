// @vitest-environment happy-dom
// Sprint (keputusan pemilik 25 Nov 2026) di Aplikasi (main.ts), dijalankan utuh seperti
// aplikasiKompetisi.test.ts: WebSocket tiruan, Phaser dan KontrolMeja tiruan. Yang dijaga:
// - ubin Sprint di beranda (nama dipastikan dulu, butuh internet) membuka layar Sprint dan papannya;
// - Main sprint mengirim {t:'sprint', nama} lewat jalur online yang sama dengan Buat meja, dan meja
//   sprint dari server langsung tampil (tanpa lobi);
// - sprintHasil (satu putaran tercatat) sampai ke KontrolMeja, juga kalau datang sebelum meja selesai dimuat;
// - keluar dari meja sprint (menu, Back): kursi dilepas (keluar), lalu papan sprint, tanpa meja baru;
//   Ke beranda (klasemen akhir meja sprint lama): keluar saja;
// - Back/Escape dari layar Sprint kembali ke beranda;
// - sprint bisa dilanjut (27 Nov 2026): token dari sprintSaya disimpan, Keluar kembali ke layar Sprint dengan
//   Lanjut sprint, Lanjut mengirim {t:'sprint', lanjut}, token yang ditolak dilupakan.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { buatPermainan, terapkanAksi, viewUntuk, type GameState } from '@remi/engine';
import { awalMingguWib, PENGATURAN_SPRINT, TEKS_SPRINT_TAK_BISA_LANJUT, TEKS_SPRINT_TANPA_MULAI_NOL, type InfoMeja } from '@remi/meja';
import type { AppUntukMeja, PesanHasilSprint } from '../src/kontrolMeja';
import { TEKS_SPRINT } from '../src/konten/sprint';
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
    teksPenolakan = (pesan: string) => pesan;
    koneksiBerubah = catat('koneksiBerubah');
    terimaEmote = catat('terimaEmote');
    terimaLedek = catat('terimaLedek');
    terimaHasilKompetisi = catat('terimaHasilKompetisi');
    terimaHasilSprint = catat('terimaHasilSprint');
    hancurkan = catat('hancurkan');
    tutupObrolanTerbuka = () => false;
    menahanKeluar = () => false;
    keadaanTampil = () => ({ status: null, sibuk: false, klasemen: false });
  }
  return { ...m, KontrolMeja: KontrolPalsu };
});

Object.assign(globalThis, { __VERSI_APP__: '0.0.0', __BUILD_SHA__: 'dev', __BUILD_WAKTU__: '2026-11-25T00:00:00.000Z' });

const pendengar: [EventTarget, string, EventListenerOrEventListenerObject, unknown][] = [];

async function nyalakan(): Promise<void> {
  vi.resetModules();
  await import('../src/main');
  await vi.advanceTimersByTimeAsync(0);
}

const dipanggil = (n: string) => kontrol.panggilan.filter((p) => p.nama === n).map((p) => p.arg);
const toastTeks = () => [...document.querySelectorAll<HTMLElement>('#toast .toast')].map((el) => el.dataset.pesan ?? '');
const ui = (s: string) => document.querySelector<HTMLElement>(`#ui ${s}`);

function permainan(): GameState {
  const g0 = buatPermainan({ pemain: ['Kipas Dua', 'Aku', 'Cak Kopag', 'Mbak Teras'], seed: 11 });
  const h = terapkanAksi(g0, { jenis: 'mulaiPutaran', pengocok: 0 });
  if (!h.ok) throw new Error(h.error.pesan);
  return h.state;
}

/** Info meja sprint dari server: aku di kursi 1 sesudah urutan duduk diacak. */
function infoSprint(g: GameState): InfoMeja {
  return {
    kode: 'SPRNT',
    status: 'main',
    pengaturan: { ...PENGATURAN_SPRINT },
    kursi: g.pemain.map((p, i) => ({ jenis: i === 1 ? 'manusia' : 'bot', nama: p.nama, terhubung: i === 1, level: 'suhu' })),
    host: 1,
    kursiSaya: 1,
    setujuAkhiri: [],
    batasWaktu: null,
    diambilAlihBot: false,
    menungguJoker: [],
    botMikir: null,
    sprint: true,
  };
}

const PAPAN = {
  periode: 'minggu',
  mulai: Date.UTC(2026, 10, 22, 17),
  baris: [
    { nama: 'Budi', menang: 2, mentung: 3, kepentung: 1, skor: 420, piala: 1 },
    { nama: 'aku', menang: 1, mentung: 1, kepentung: 0, skor: 150, piala: 0 },
  ],
};

/** fetch: papan sprint dijawab, permintaan lain (healthz, sw) dibiarkan menggantung. */
function pasangFetch(): string[] {
  const url: string[] = [];
  vi.stubGlobal(
    'fetch',
    vi.fn((u: string) => {
      url.push(u);
      if (u === '/api/sprint/saya') return Promise.resolve({ ok: true, status: 200, json: async () => ({ ada: true, putaran: 2, skor: 30 }) } as Response);
      if (u.startsWith('/api/sprint')) return Promise.resolve({ ok: true, status: 200, json: async () => PAPAN } as Response);
      return new Promise(() => {});
    }),
  );
  return url;
}

/** Beranda → ubin Sprint → layar Sprint. */
async function bukaSprint() {
  const url = pasangFetch();
  await nyalakan();
  ui('#sprint')!.click();
  await vi.advanceTimersByTimeAsync(0);
  return url;
}

/** Layar Sprint → Main sprint → server membuat meja sprint dan langsung mengirim permainannya. */
async function diMejaSprint(sebelumSiap?: (ws: WsPalsu) => void) {
  await bukaSprint();
  ui('#main-sprint')!.click();
  await vi.advanceTimersByTimeAsync(0);
  const ws = WsPalsu.terakhir();
  ws.buka();
  await vi.advanceTimersByTimeAsync(0);
  const g = permainan();
  ws.kirimDariServer({ t: 'masuk', kode: 'SPRNT', token: 'tok', kursi: 1 });
  ws.kirimDariServer({ t: 'meja', info: infoSprint(g) });
  sebelumSiap?.(ws);
  await vi.advanceTimersByTimeAsync(0);
  ws.kirimDariServer({ t: 'view', view: viewUntuk(g, 1) });
  await vi.advanceTimersByTimeAsync(0);
  return { ws, g };
}

const hasil: PesanHasilSprint = { t: 'sprintHasil', putaran: 1, menang: true, skor: 120, mentung: 1, kepentung: 0, peringkatMinggu: 1 };

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
});

describe('Aplikasi: Sprint', () => {
  it('ubin Sprint membuka layar Sprint dan papan minggu ini; baris milikku disorot', async () => {
    const url = await bukaSprint();
    expect(ui('.layar-sprint')).not.toBeNull();
    expect(ui('.layar.beranda')).toBeNull();
    expect(url.some((u) => u.startsWith('/api/sprint?periode=minggu&v=2&nama='))).toBe(true);
    expect(ui('#papan-sprint tbody tr.saya')!.textContent).toContain('aku');
    // Belum ada sambungan meja: layar Sprint cuma membaca papan.
    expect(WsPalsu.semua).toHaveLength(0);
  });

  it('ubin Sprint tanpa internet: toast, layar Sprint tidak dibuka', async () => {
    await nyalakan();
    Object.defineProperty(navigator, 'onLine', { configurable: true, get: () => false });
    ui('#sprint')!.click();
    await vi.advanceTimersByTimeAsync(0);
    expect(toastTeks()).toContain(TEKS_SPRINT.butuhInternet);
    expect(ui('.layar-sprint')).toBeNull();
  });

  it('Main sprint: kirim {t:"sprint", nama}, meja sprint langsung tampil (tanpa lobi)', async () => {
    const { ws } = await diMejaSprint();
    expect(ws.terkirim.find((p) => p.t === 'sprint')).toEqual({ t: 'sprint', nama: 'Aku' });
    expect(ui('.layar-lobi')).toBeNull();
    expect(dipanggil('perbarui').length).toBeGreaterThan(0);
  });

  it('sprintHasil diteruskan ke meja, juga kalau datang sebelum meja selesai dimuat', async () => {
    await diMejaSprint((ws) => {
      expect(kontrol.app).toBeNull();
      ws.kirimDariServer(hasil);
    });
    expect(dipanggil('terimaHasilSprint')).toEqual([[hasil]]);
  });

  it('keluar dari meja sprint: kursi dilepas, sesi dilupakan, papan sprint tampil, tanpa meja baru', async () => {
    const { ws } = await diMejaSprint();
    const url = pasangFetch();
    (kontrol.app as AppUntukMeja).tinggalkanSprint!(true);
    await vi.advanceTimersByTimeAsync(0);
    expect(ws.jenisTerkirim()).toContain('keluar');
    expect(localStorage.getItem('remi.sesiOnline')).toBeNull();
    expect(ui('.layar-sprint')).not.toBeNull();
    expect(url.some((u) => u.startsWith('/api/sprint?periode=minggu&v=2&nama='))).toBe(true);
    // Tidak langsung main lagi: tombol Main sprint siap ditekan, tidak ada sambungan baru.
    expect(ui('#main-sprint')!.hasAttribute('aria-busy')).toBe(false);
    expect(WsPalsu.semua.at(-1)).toBe(ws);
  });

  it('Back di meja sprint: konfirmasi keluar sprint, lalu papan sprint', async () => {
    const { ws } = await diMejaSprint();
    // HP ini memegang token sprint minggu ini: keluar = disimpan.
    localStorage.setItem('remi.sprintSaya', JSON.stringify({ token: 'k'.repeat(32), minggu: awalMingguWib(Date.now()) }));
    pasangFetch();
    window.dispatchEvent(new PopStateEvent('popstate'));
    await vi.advanceTimersByTimeAsync(0);
    const d = document.querySelector<HTMLElement>('#lapisan-dialog .dialog')!;
    expect(d.textContent).toContain(TEKS_SPRINT.keluarMain);
    d.querySelector<HTMLElement>('[data-ya]')!.click();
    await vi.advanceTimersByTimeAsync(0);
    expect(ws.jenisTerkirim()).toContain('keluar');
    expect(ui('.layar-sprint')).not.toBeNull();
  });

  it('Ke beranda dari klasemen akhir meja sprint lama: keluar, lalu beranda', async () => {
    const { ws } = await diMejaSprint();
    (kontrol.app as AppUntukMeja).tinggalkanSprint!(false);
    await vi.advanceTimersByTimeAsync(0);
    expect(ws.jenisTerkirim()).toContain('keluar');
    expect(ui('.layar.beranda')).not.toBeNull();
    expect(WsPalsu.semua.at(-1)).toBe(ws);
  });

  it('server menolak sprint: tombol Main sprint bisa ditekan lagi, pesannya jadi toast', async () => {
    await bukaSprint();
    ui('#main-sprint')!.click();
    await vi.advanceTimersByTimeAsync(0);
    const ws = WsPalsu.terakhir();
    ws.buka();
    await vi.advanceTimersByTimeAsync(0);
    expect(ui('#main-sprint')!.getAttribute('aria-busy')).toBe('true');
    ws.kirimDariServer({ t: 'error', pesan: 'Sprint belum bisa dimainkan di server ini.' });
    expect(ui('#main-sprint')!.hasAttribute('aria-busy')).toBe(false);
    expect(toastTeks()).toContain('Sprint belum bisa dimainkan di server ini.');
  });

  it('Escape di layar Sprint: kembali ke beranda, fokus di tombol Sprint', async () => {
    await bukaSprint();
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    expect(ui('.layar.beranda')).not.toBeNull();
    expect(document.activeElement?.id).toBe('sprint');
  });

  it('sprint bisa dilanjut: token disimpan, Keluar = layar Sprint dengan Lanjut sprint, Lanjut mengirim tokennya', async () => {
    const TOKEN = 'k'.repeat(32);
    const minggu = awalMingguWib(Date.now());
    const { ws } = await diMejaSprint((w) => w.kirimDariServer({ t: 'sprintSaya', token: TOKEN, minggu }));
    expect(JSON.parse(localStorage.getItem('remi.sprintSaya')!)).toEqual({ token: TOKEN, minggu });
    pasangFetch();
    (kontrol.app as AppUntukMeja).tinggalkanSprint!(true);
    await vi.advanceTimersByTimeAsync(0);
    expect(ws.jenisTerkirim()).toContain('keluar');
    expect(ui('#main-sprint')).toBeNull();
    // Tanpa Mulai dari 0 (0.10.3): Lanjut sprint satu-satunya tombol.
    expect(ui('#nol-sprint')).toBeNull();
    expect(document.querySelectorAll('.layar-sprint .aksi-sprint button')).toHaveLength(1);
    expect(ui('#lanjut-sprint [data-ket-lanjut]')!.textContent).toBe('Putaran 2 · skor 30');
    ui('#lanjut-sprint')!.click();
    await vi.advanceTimersByTimeAsync(0);
    const ws2 = WsPalsu.terakhir();
    ws2.buka();
    await vi.advanceTimersByTimeAsync(0);
    expect(ws2.terkirim.find((p) => p.t === 'sprint')).toEqual({ t: 'sprint', nama: 'Aku', lanjut: TOKEN });
    const g = permainan();
    ws2.kirimDariServer({ t: 'masuk', kode: 'SPRNT', token: 'tok', kursi: 1 });
    ws2.kirimDariServer({ t: 'meja', info: infoSprint(g) });
    ws2.kirimDariServer({ t: 'view', view: viewUntuk(g, 1) });
    await vi.advanceTimersByTimeAsync(0);
    expect(ui('.layar-sprint')).toBeNull();
    expect(JSON.parse(localStorage.getItem('remi.sesiOnline')!)).toMatchObject({ kode: 'SPRNT', token: 'tok' });
  });

  it('Lanjut ditolak server (minggunya lewat): token dilupakan, tombolnya jadi Main sprint, pesannya toast', async () => {
    localStorage.setItem('remi.sprintSaya', JSON.stringify({ token: 'k'.repeat(32), minggu: awalMingguWib(Date.now()) }));
    await bukaSprint();
    ui('#lanjut-sprint')!.click();
    await vi.advanceTimersByTimeAsync(0);
    const ws = WsPalsu.terakhir();
    ws.buka();
    await vi.advanceTimersByTimeAsync(0);
    ws.kirimDariServer({ t: 'sprintSaya', token: null });
    ws.kirimDariServer({ t: 'error', pesan: TEKS_SPRINT_TAK_BISA_LANJUT });
    await vi.advanceTimersByTimeAsync(0);
    expect(localStorage.getItem('remi.sprintSaya')).toBeNull();
    expect(ui('#lanjut-sprint')).toBeNull();
    expect(ui('#main-sprint')!.hasAttribute('aria-busy')).toBe(false);
    expect(toastTeks()).toContain(TEKS_SPRINT_TAK_BISA_LANJUT);
  });

  it('server 0.10.3 menolak Mulai dari 0 dari aplikasi lama: aplikasi ini tidak pernah mengirim `ganti`, tolakan jadi toast', async () => {
    localStorage.setItem('remi.sprintSaya', JSON.stringify({ token: 'k'.repeat(32), minggu: awalMingguWib(Date.now()) }));
    await bukaSprint();
    ui('#lanjut-sprint')!.click();
    await vi.advanceTimersByTimeAsync(0);
    const ws = WsPalsu.terakhir();
    ws.buka();
    await vi.advanceTimersByTimeAsync(0);
    expect(ws.terkirim.filter((p) => p.t === 'sprint').every((p) => !('ganti' in p))).toBe(true);
    ws.kirimDariServer({ t: 'error', pesan: TEKS_SPRINT_TANPA_MULAI_NOL });
    await vi.advanceTimersByTimeAsync(0);
    expect(toastTeks()).toContain(TEKS_SPRINT_TANPA_MULAI_NOL);
    // Token tetap (sprint-nya masih bisa dilanjut), tombol bisa ditekan lagi.
    expect(localStorage.getItem('remi.sprintSaya')).not.toBeNull();
    expect(ui('#lanjut-sprint')!.hasAttribute('aria-busy')).toBe(false);
  });

  it('meja sprint ditutup server (pesan keluar): keluar dari meja ke layar Sprint', async () => {
    const { ws } = await diMejaSprint();
    pasangFetch();
    ws.kirimDariServer({ t: 'keluar', alasan: TEKS_SPRINT_TAK_BISA_LANJUT });
    await vi.advanceTimersByTimeAsync(0);
    expect(ui('.layar-sprint')).not.toBeNull();
    expect(toastTeks()).toContain(TEKS_SPRINT_TAK_BISA_LANJUT);
    expect(localStorage.getItem('remi.sesiOnline')).toBeNull();
  });
});
