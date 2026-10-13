// @vitest-environment happy-dom
// Koneksi online (WebSocket + sambung ulang) dan offline (meja lokal + simpanan localStorage).
// Diuji lewat perilaku yang terlihat dari luar: pesan yang sampai ke server palsu, status yang
// dilaporkan ke UI, dan isi localStorage. Waktu memakai fake timers, WebSocket diganti tiruan.

import { pilihAksiBot, Rng, type ViewPemain } from '@remi/engine';
import type { PesanKlien, PesanServer } from '@remi/meja';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { KoneksiOffline, KoneksiOnline, type StatusKoneksi } from '../src/koneksi';

const KUNCI_OFFLINE = 'remi.mejaOffline';
const KUNCI_SESI = 'remi.sesiOnline';

/** Ubah document.visibilityState lalu kabari pendengar, seperti saat pindah aplikasi di HP. */
function aturTerlihat(keadaan: DocumentVisibilityState): void {
  Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => keadaan });
  document.dispatchEvent(new Event('visibilitychange'));
}

/**
 * Catat pendengar yang dipasang di window/document sejak dipanggil. `sisa()` = yang belum dilepas,
 * supaya kebocoran pendengar (koneksi lama masih bereaksi ke pagehide/online) ketahuan.
 */
function lacakPendengar() {
  const aktif = new Set<string>();
  const fn = new Map<EventListenerOrEventListenerObject, string>();
  let nomor = 0;
  for (const target of [window, document] as EventTarget[]) {
    const tambah = target.addEventListener.bind(target);
    const lepas = target.removeEventListener.bind(target);
    vi.spyOn(target, 'addEventListener').mockImplementation((jenis, f, o) => {
      if (f && !fn.has(f)) fn.set(f, `${jenis}#${nomor++}`);
      if (f) aktif.add(fn.get(f)!);
      tambah(jenis, f, o);
    });
    vi.spyOn(target, 'removeEventListener').mockImplementation((jenis, f, o) => {
      if (f && fn.has(f)) aktif.delete(fn.get(f)!);
      lepas(jenis, f, o);
    });
  }
  return { sisa: () => [...aktif] };
}

/** Habiskan microtask (pesan meja ke UI dikirim lewat queueMicrotask). */
const microtask = () => vi.advanceTimersByTimeAsync(0);

beforeEach(() => {
  vi.useFakeTimers();
  localStorage.clear();
  Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'visible' });
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

// ---------------------------------------------------------------------------------------------
// Offline

describe('KoneksiOffline: simpanan di HP', () => {
  const dibuka: KoneksiOffline[] = [];
  /** `pengocok` 0: giliran pertama jatuh di kursi manusia (kursi 0). Pengocok lain bisa membuat bot jalan duluan. */
  const baru = (pengaturan: Parameters<typeof KoneksiOffline.baru>[1] = { jumlahPemain: 3 }, pengocok = 0) => {
    const k = KoneksiOffline.baru('Penguji', { tempoBot: 'cepat', ...pengaturan }, pengocok);
    dibuka.push(k);
    return k;
  };
  afterEach(() => {
    dibuka.splice(0).forEach((k) => k.tutup());
  });

  it('perubahan ditulis setelah jeda singkat (debounce), bukan seketika', async () => {
    baru();
    expect(localStorage.getItem(KUNCI_OFFLINE)).toBeNull();
    await vi.advanceTimersByTimeAsync(400);
    const data = JSON.parse(localStorage.getItem(KUNCI_OFFLINE)!);
    expect(data.versi).toBe(1);
    expect(data.game.status).toBe('putaranBerjalan');
  });

  it('pagehide langsung menulis perubahan yang masih tertunda', () => {
    baru();
    expect(localStorage.getItem(KUNCI_OFFLINE)).toBeNull();
    window.dispatchEvent(new Event('pagehide'));
    expect(localStorage.getItem(KUNCI_OFFLINE)).not.toBeNull();
  });

  it('pagehide tanpa perubahan baru tidak menulis ulang', async () => {
    baru();
    await vi.advanceTimersByTimeAsync(400);
    localStorage.removeItem(KUNCI_OFFLINE);
    window.dispatchEvent(new Event('pagehide'));
    expect(localStorage.getItem(KUNCI_OFFLINE)).toBeNull();
  });

  it('pindah aplikasi (visibilitychange → hidden) menulis perubahan tertunda; visible tidak', async () => {
    const k = baru();
    await vi.advanceTimersByTimeAsync(400);
    localStorage.removeItem(KUNCI_OFFLINE);
    k.kirim({ t: 'siapJoker' });
    aturTerlihat('visible');
    expect(localStorage.getItem(KUNCI_OFFLINE)).toBeNull();
    aturTerlihat('hidden');
    expect(localStorage.getItem(KUNCI_OFFLINE)).not.toBeNull();
  });

  it('tutup() menulis sekali, membatalkan debounce, dan melepas pendengar halaman', async () => {
    const pendengar = lacakPendengar();
    const k = baru();
    k.kirim({ t: 'siapJoker' });
    expect(vi.getTimerCount()).toBeGreaterThan(0);
    k.tutup();
    expect(localStorage.getItem(KUNCI_OFFLINE)).not.toBeNull();
    // Tidak ada timer tersisa (debounce simpan maupun jeda bot) dan tidak ada pendengar bocor.
    expect(vi.getTimerCount()).toBe(0);
    expect(pendengar.sisa()).toEqual([]);
    localStorage.removeItem(KUNCI_OFFLINE);
    // Timer debounce yang tadinya terjadwal tidak boleh menulis lagi.
    await vi.advanceTimersByTimeAsync(5000);
    expect(localStorage.getItem(KUNCI_OFFLINE)).toBeNull();
    // Pendengar pagehide/visibilitychange sudah dilepas.
    window.dispatchEvent(new Event('pagehide'));
    aturTerlihat('hidden');
    expect(localStorage.getItem(KUNCI_OFFLINE)).toBeNull();
    // Kirim setelah tutup: diam saja, tidak menghidupkan meja lagi.
    expect(() => k.kirim({ t: 'siapJoker' })).not.toThrow();
    await vi.advanceTimersByTimeAsync(5000);
    expect(localStorage.getItem(KUNCI_OFFLINE)).toBeNull();
  });

  it('tutup() saat giliran bot: jeda bot ikut berhenti, tidak ada view sesudahnya, simpanan tidak berubah', async () => {
    // Giliran pertama di kursi bot, jadi saat tutup() ada timer "bot mikir" yang menunggu.
    const k = baru({ jumlahPemain: 3 }, 1);
    const pesan: PesanServer[] = [];
    k.saatPesan((p) => pesan.push(p));
    k.kirim({ t: 'siapJoker' });
    await microtask();
    const view = pesan.filter((p): p is Extract<PesanServer, { t: 'view' }> => p.t === 'view').at(-1)?.view;
    expect(view?.status).toBe('putaranBerjalan');
    expect(view?.putaran?.giliran).not.toBe(view?.saya);
    // Debounce simpan + jeda bot.
    expect(vi.getTimerCount()).toBeGreaterThan(1);

    k.tutup();
    expect(vi.getTimerCount()).toBe(0);
    const tersimpan = localStorage.getItem(KUNCI_OFFLINE);
    expect(tersimpan).not.toBeNull();
    const jumlahSaatTutup = pesan.length;
    // Bot tidak boleh terus main di latar sesudah pemain keluar meja.
    await vi.advanceTimersByTimeAsync(60_000);
    expect(pesan.slice(jumlahSaatTutup).filter((p) => p.t === 'view')).toEqual([]);
    expect(localStorage.getItem(KUNCI_OFFLINE)).toBe(tersimpan);
  });

  it("'keluar' dari meja offline menghapus simpanan (beranda tidak menawarkan lanjutkan)", async () => {
    const k = baru();
    const pesan: PesanServer[] = [];
    k.saatPesan((p) => pesan.push(p));
    await vi.advanceTimersByTimeAsync(400);
    expect(localStorage.getItem(KUNCI_OFFLINE)).not.toBeNull();
    k.kirim({ t: 'keluar' });
    await microtask();
    expect(pesan.some((p) => p.t === 'keluar')).toBe(true);
    expect(localStorage.getItem(KUNCI_OFFLINE)).toBeNull();
    // Pemicu simpan apa pun sesudahnya tidak menghidupkan simpanan lagi.
    await vi.advanceTimersByTimeAsync(5_000);
    window.dispatchEvent(new Event('pagehide'));
    aturTerlihat('hidden');
    k.tutup();
    expect(localStorage.getItem(KUNCI_OFFLINE)).toBeNull();
  });

  it('pindah aplikasi tanpa perubahan tertunda tidak menulis ulang simpanan', async () => {
    baru();
    await vi.advanceTimersByTimeAsync(400);
    localStorage.removeItem(KUNCI_OFFLINE);
    aturTerlihat('hidden');
    expect(localStorage.getItem(KUNCI_OFFLINE)).toBeNull();
  });

  it('permainan yang sudah selesai tidak pernah ditulis lagi (pagehide, timer, tutup)', async () => {
    // Satu putaran, dua pemain: "saya" dimainkan bot normal dari view yang diterima UI.
    const k = baru({ jumlahPemain: 2, batasPutaran: 1 });
    const rng = new Rng(7);
    let view: ViewPemain | null = null;
    let sudahDiproses: ViewPemain | null = null;
    k.saatPesan((p: PesanServer) => {
      if (p.t === 'view') view = p.view;
    });
    k.kirim({ t: 'siapJoker' });
    let pernahTersimpan = false;
    for (let i = 0; i < 4000; i++) {
      await vi.advanceTimersByTimeAsync(250);
      const v = view as ViewPemain | null;
      if (!v || v.status === 'selesai') break;
      pernahTersimpan ||= localStorage.getItem(KUNCI_OFFLINE) !== null;
      if (v === sudahDiproses) continue;
      const p = v.putaran;
      const giliranku =
        (v.status === 'putaranBerjalan' && p?.giliran === v.saya) || (v.status === 'susunAkhir' && !p?.selesaiSusun[v.saya!]);
      if (!giliranku) continue;
      sudahDiproses = v;
      const { pemain: _, ...aksi } = pilihAksiBot(v, 'normal', rng) as { pemain?: number };
      k.kirim({ t: 'aksi', aksi } as PesanKlien);
    }
    expect((view as ViewPemain | null)?.status).toBe('selesai');
    expect(pernahTersimpan).toBe(true);
    await vi.advanceTimersByTimeAsync(400);
    // Simpanan permainan selesai dihapus, supaya beranda tidak menawarkan "lanjutkan".
    expect(localStorage.getItem(KUNCI_OFFLINE)).toBeNull();

    // Pemicu simpan apa pun sesudahnya tidak boleh menulis ulang permainan yang sudah tamat.
    window.dispatchEvent(new Event('pagehide'));
    aturTerlihat('hidden');
    await vi.advanceTimersByTimeAsync(2000);
    expect(localStorage.getItem(KUNCI_OFFLINE)).toBeNull();
    k.tutup();
    expect(localStorage.getItem(KUNCI_OFFLINE)).toBeNull();
  }, 30_000);

  it('lanjutkan(): simpanan normal jalan lagi, simpanan selesai/rusak dibuang', async () => {
    const k = baru();
    k.tutup();
    const data = JSON.parse(localStorage.getItem(KUNCI_OFFLINE)!);

    const lanjut = KoneksiOffline.lanjutkan();
    expect(lanjut).not.toBeNull();
    lanjut!.tutup();

    localStorage.setItem(KUNCI_OFFLINE, JSON.stringify({ ...data, game: { ...data.game, status: 'selesai' } }));
    expect(KoneksiOffline.lanjutkan()).toBeNull();
    expect(localStorage.getItem(KUNCI_OFFLINE)).toBeNull();

    localStorage.setItem(KUNCI_OFFLINE, JSON.stringify({ versi: 99 }));
    expect(KoneksiOffline.lanjutkan()).toBeNull();
  });

  it('ping offline dijawab pong; status selalu tersambung', async () => {
    const k = baru();
    const pesan: PesanServer[] = [];
    const status: StatusKoneksi[] = [];
    k.saatPesan((p) => pesan.push(p));
    k.saatStatus((s) => status.push(s));
    k.kirim({ t: 'ping' });
    await microtask();
    expect(pesan.some((p) => p.t === 'pong')).toBe(true);
    expect(status).toEqual(['tersambung']);
  });
});

// ---------------------------------------------------------------------------------------------
// Online

class WsPalsu {
  static readonly CONNECTING = 0;
  static readonly OPEN = 1;
  static readonly CLOSING = 2;
  static readonly CLOSED = 3;
  static semua: WsPalsu[] = [];
  static terakhir(): WsPalsu {
    return WsPalsu.semua[WsPalsu.semua.length - 1]!;
  }

  readyState = WsPalsu.CONNECTING;
  terkirim: PesanKlien[] = [];
  /** false = server diam (sambungan setengah mati): ping tidak dijawab. */
  jawabPing = true;
  ditutupKlien = false;
  onopen: (() => void) | null = null;
  onmessage: ((e: { data: string }) => void) | null = null;
  onclose: ((e: { code: number }) => void) | null = null;

  constructor(readonly url: string) {
    WsPalsu.semua.push(this);
  }
  buka() {
    this.readyState = WsPalsu.OPEN;
    this.onopen?.();
  }
  send(s: string) {
    const p = JSON.parse(s) as PesanKlien;
    this.terkirim.push(p);
    if (p.t === 'ping' && this.jawabPing) queueMicrotask(() => this.onmessage?.({ data: '{"t":"pong"}' }));
  }
  kirimDariServer(p: PesanServer) {
    this.onmessage?.({ data: JSON.stringify(p) });
  }
  close() {
    this.ditutupKlien = true;
    this.readyState = WsPalsu.CLOSED;
  }
  /** Sambungan diputus dari sisi server/jaringan. */
  putus(code = 1006) {
    this.readyState = WsPalsu.CLOSED;
    this.onclose?.({ code });
  }
  jenisTerkirim(): string[] {
    return this.terkirim.filter((p) => p.t !== 'ping').map((p) => p.t);
  }
}

describe('KoneksiOnline: sambung ulang, watchdog, antrian', () => {
  let k: KoneksiOnline;
  let status: StatusKoneksi[];
  let pesan: PesanServer[];

  beforeEach(() => {
    WsPalsu.semua = [];
    vi.stubGlobal('WebSocket', WsPalsu);
    status = [];
    pesan = [];
    k = new KoneksiOnline('ws://uji/ws', () => 'Penguji');
    k.saatStatus((s) => status.push(s));
    k.saatPesan((p) => pesan.push(p));
  });
  afterEach(() => k.tutup());

  /** Server mati: setiap percobaan sambung langsung gagal, lalu tunggu backoff. */
  async function gagalSambung(kali: number) {
    for (let i = 0; i < kali; i++) {
      WsPalsu.terakhir().putus();
      await vi.advanceTimersByTimeAsync(10_000);
    }
  }

  it('saatStatus langsung memberi status kini, lalu tersambung saat socket terbuka', () => {
    expect(status).toEqual(['menyambung']);
    WsPalsu.terakhir().buka();
    expect(status.at(-1)).toBe('tersambung');
  });

  it("gagal berulang sebelum pernah tersambung → status 'gagal', tapi tetap mencoba di belakang layar", async () => {
    await gagalSambung(2);
    expect(status).not.toContain('gagal');
    expect(status).toContain('terputus');
    await gagalSambung(1);
    expect(status).toContain('gagal');
    // Masih dicoba lagi: percobaan berikutnya gagal pun tetap dijadwalkan ulang.
    const n = WsPalsu.semua.length;
    WsPalsu.terakhir().putus();
    expect(status.at(-1)).toBe('gagal');
    await vi.advanceTimersByTimeAsync(10_000);
    expect(WsPalsu.semua.length).toBe(n + 1);
    WsPalsu.terakhir().buka();
    expect(status.at(-1)).toBe('tersambung');
  });

  it("tutup() dari dalam pendengar status 'gagal' tidak meninggalkan timer sambung ulang", async () => {
    // Seperti main.ts di beranda: begitu 'gagal', koneksi langsung ditutup dari callback status.
    const k2 = new KoneksiOnline('ws://uji/ws', () => 'Penguji');
    let ditutupSaatGagal = false;
    k2.saatStatus((s) => {
      if (s !== 'gagal') return;
      ditutupSaatGagal = true;
      k2.tutup();
    });
    k.tutup(); // koneksi bawaan beforeEach tidak ikut dihitung
    for (let i = 0; i < 3 && !ditutupSaatGagal; i++) {
      WsPalsu.terakhir().putus();
      if (!ditutupSaatGagal) await vi.advanceTimersByTimeAsync(10_000);
    }
    expect(ditutupSaatGagal).toBe(true);
    expect(vi.getTimerCount()).toBe(0);
    const n = WsPalsu.semua.length;
    await vi.advanceTimersByTimeAsync(30_000);
    expect(WsPalsu.semua.length).toBe(n);
  });

  it("pernah tersambung lalu putus → 'terputus' (bukan 'gagal') walau gagal berkali-kali", async () => {
    WsPalsu.terakhir().buka();
    await gagalSambung(5);
    expect(status).not.toContain('gagal');
    expect(status.at(-1)).toBe('menyambung');
    expect(status).toContain('terputus');
  });

  it('watchdog: ping lama tak berjawab menutup socket basi lalu menyambung ulang', async () => {
    const ws = WsPalsu.terakhir();
    ws.buka();
    ws.jawabPing = false;
    // 2 interval ping (50 dtk) belum cukup untuk divonis mati.
    await vi.advanceTimersByTimeAsync(51_000);
    expect(ws.ditutupKlien).toBe(false);
    expect(ws.terkirim.filter((p) => p.t === 'ping').length).toBeGreaterThan(0);
    await vi.advanceTimersByTimeAsync(25_000);
    expect(ws.ditutupKlien).toBe(true);
    expect(status).toContain('terputus');
    await vi.advanceTimersByTimeAsync(1_000);
    expect(WsPalsu.terakhir()).not.toBe(ws);
  });

  it('watchdog tidak memutus sambungan sehat yang menjawab ping', async () => {
    const ws = WsPalsu.terakhir();
    ws.buka();
    await vi.advanceTimersByTimeAsync(300_000);
    expect(ws.ditutupKlien).toBe(false);
    expect(WsPalsu.semua.length).toBe(1);
  });

  it('tab terlihat lagi: socket yang diam 5 detik diputus dan disambung ulang', async () => {
    const ws = WsPalsu.terakhir();
    ws.buka();
    ws.jawabPing = false;
    aturTerlihat('visible');
    await vi.advanceTimersByTimeAsync(4_000);
    expect(ws.ditutupKlien).toBe(false);
    await vi.advanceTimersByTimeAsync(2_000);
    expect(ws.ditutupKlien).toBe(true);
    await vi.advanceTimersByTimeAsync(1_000);
    expect(WsPalsu.terakhir()).not.toBe(ws);
  });

  it('tab terlihat lagi: sambungan sehat yang menjawab ping TIDAK diputus', async () => {
    const ws = WsPalsu.terakhir();
    ws.buka();
    aturTerlihat('visible');
    // Cek cepat mengirim ping sekarang juga, dan server menjawabnya.
    expect(ws.terkirim.filter((p) => p.t === 'ping')).toHaveLength(1);
    await vi.advanceTimersByTimeAsync(6_000);
    expect(ws.ditutupKlien).toBe(false);
    expect(WsPalsu.semua.length).toBe(1);
    expect(status.at(-1)).toBe('tersambung');
    // Pindah aplikasi bolak-balik pun tidak memutus sambungan yang sehat.
    for (let i = 0; i < 3; i++) {
      aturTerlihat('hidden');
      aturTerlihat('visible');
      await vi.advanceTimersByTimeAsync(6_000);
    }
    expect(ws.ditutupKlien).toBe(false);
    expect(WsPalsu.semua.length).toBe(1);
  });

  it('putus-sambung berulang: ping lama berhenti, tiap interval hanya satu ping; tutup() tanpa sisa timer', async () => {
    for (let i = 0; i < 4; i++) {
      WsPalsu.terakhir().buka();
      await vi.advanceTimersByTimeAsync(1_000);
      WsPalsu.terakhir().putus();
      await vi.advanceTimersByTimeAsync(1_000);
    }
    const ws = WsPalsu.terakhir();
    ws.buka();
    expect(WsPalsu.semua).toHaveLength(5);
    await vi.advanceTimersByTimeAsync(25_000 * 3 + 100);
    // Interval ping dari sambungan-sambungan lama tidak boleh ikut mengirim lewat socket baru.
    expect(ws.terkirim.filter((p) => p.t === 'ping')).toHaveLength(3);
    for (const lama of WsPalsu.semua.slice(0, -1)) expect(lama.terkirim.filter((p) => p.t === 'ping')).toEqual([]);
    k.tutup();
    expect(vi.getTimerCount()).toBe(0);
  });

  it('sinyal kembali lalu gagal lagi: jeda sambung ulang mulai dari awal (bukan backoff besar)', async () => {
    WsPalsu.terakhir().buka();
    await gagalSambung(6); // backoff sudah mentok di batas atas
    WsPalsu.terakhir().putus();
    window.dispatchEvent(new Event('online'));
    const n = WsPalsu.semua.length;
    WsPalsu.terakhir().putus();
    await vi.advanceTimersByTimeAsync(600);
    expect(WsPalsu.semua.length).toBe(n + 1);
  });

  it('backoff sambung ulang tidak lebih dari 8 detik walau gagal terus', async () => {
    for (let i = 0; i < 10; i++) {
      const n = WsPalsu.semua.length;
      WsPalsu.terakhir().putus();
      await vi.advanceTimersByTimeAsync(8_000);
      expect(WsPalsu.semua.length, `percobaan ke-${i + 1}`).toBe(n + 1);
    }
  });

  it('sinyal kembali (event online) langsung menyambung tanpa menunggu backoff', async () => {
    WsPalsu.terakhir().buka();
    await gagalSambung(3); // backoff sudah membesar
    WsPalsu.terakhir().putus();
    const n = WsPalsu.semua.length;
    window.dispatchEvent(new Event('online'));
    expect(WsPalsu.semua.length).toBe(n + 1);
  });

  describe('jabat tangan yang menggantung (CONNECTING tanpa kabar)', () => {
    /** Socket yang belum ditutup klien dan belum putus: harus selalu paling banyak satu. */
    const hidup = () => WsPalsu.semua.filter((w) => !w.ditutupKlien && w.readyState !== WsPalsu.CLOSED);

    it('lewat 10 detik: socket ditutup, status terputus, lalu sambung ulang dengan backoff', async () => {
      const ws = WsPalsu.terakhir();
      await vi.advanceTimersByTimeAsync(9_900);
      expect(ws.ditutupKlien).toBe(false);
      expect(status).toEqual(['menyambung']);
      await vi.advanceTimersByTimeAsync(200);
      expect(ws.ditutupKlien).toBe(true);
      expect(status.at(-1)).toBe('terputus');
      expect(WsPalsu.semua).toHaveLength(1);
      await vi.advanceTimersByTimeAsync(500);
      expect(WsPalsu.semua).toHaveLength(2);
      expect(status.at(-1)).toBe('menyambung');
      // Percobaan baru bisa tersambung normal, dan pesan antrian tetap terkirim.
      k.kirim({ t: 'daftar' });
      WsPalsu.terakhir().buka();
      expect(status.at(-1)).toBe('tersambung');
      expect(WsPalsu.terakhir().jenisTerkirim()).toEqual(['daftar']);
    });

    it("menggantung terus: backoff membesar, status 'gagal', tidak pernah ada dua socket hidup", async () => {
      for (let detik = 0; detik < 120; detik++) {
        await vi.advanceTimersByTimeAsync(1_000);
        expect(hidup().length, `detik ${detik}`).toBeLessThanOrEqual(1);
      }
      expect(status).toContain('gagal');
      // 120 dtk dengan batas 10 dtk + backoff 0,5→8 dtk: jauh lebih sedikit dari satu percobaan per detik.
      expect(WsPalsu.semua.length).toBeGreaterThan(4);
      expect(WsPalsu.semua.length).toBeLessThan(12);
      WsPalsu.terakhir().buka();
      expect(status.at(-1)).toBe('tersambung');
    });

    it('tersambung sebelum batas: batasnya dibatalkan, sambungan sehat tidak diputus', async () => {
      const ws = WsPalsu.terakhir();
      await vi.advanceTimersByTimeAsync(9_000);
      ws.buka();
      await vi.advanceTimersByTimeAsync(60_000);
      expect(ws.ditutupKlien).toBe(false);
      expect(WsPalsu.semua).toHaveLength(1);
    });

    it('tab terlihat / sinyal kembali saat percobaan baru dimulai: tidak membuat sambungan ganda', async () => {
      await vi.advanceTimersByTimeAsync(1_000);
      aturTerlihat('visible');
      window.dispatchEvent(new Event('online'));
      expect(WsPalsu.semua).toHaveLength(1);
      expect(WsPalsu.terakhir().ditutupKlien).toBe(false);
    });

    it('tab terlihat saat percobaan sudah lama menggantung: yang lama dibuang, langsung coba baru', async () => {
      const lama = WsPalsu.terakhir();
      await vi.advanceTimersByTimeAsync(6_000);
      aturTerlihat('visible');
      expect(lama.ditutupKlien).toBe(true);
      expect(WsPalsu.semua).toHaveLength(2);
      expect(hidup()).toEqual([WsPalsu.terakhir()]);
      // Batas waktu socket lama tidak ikut memutus socket baru.
      await vi.advanceTimersByTimeAsync(5_000);
      expect(WsPalsu.terakhir().ditutupKlien).toBe(false);
      expect(WsPalsu.semua).toHaveLength(2);
    });

    it('socket lama yang terlambat terbuka/putus setelah dibuang tidak mengganggu yang baru', async () => {
      const lama = WsPalsu.terakhir();
      await vi.advanceTimersByTimeAsync(10_100);
      expect(lama.ditutupKlien).toBe(true);
      // Pendengarnya sudah dilepas: kabar terlambat dari socket lama diabaikan.
      expect(lama.onopen).toBeNull();
      expect(lama.onclose).toBeNull();
      await vi.advanceTimersByTimeAsync(500);
      const baru = WsPalsu.terakhir();
      baru.buka();
      expect(status.at(-1)).toBe('tersambung');
    });

    it('tutup() saat masih CONNECTING: tidak ada sisa timer', async () => {
      await vi.advanceTimersByTimeAsync(3_000);
      k.tutup();
      expect(vi.getTimerCount()).toBe(0);
      await vi.advanceTimersByTimeAsync(30_000);
      expect(WsPalsu.semua).toHaveLength(1);
    });
  });

  it('kode 4000 (kursi dibuka di tab lain): berhenti menyambung dan memberi tahu UI', async () => {
    const ws = WsPalsu.terakhir();
    ws.buka();
    ws.putus(4000);
    await vi.advanceTimersByTimeAsync(60_000);
    expect(WsPalsu.semua.length).toBe(1);
    expect(pesan.some((p) => p.t === 'keluar')).toBe(true);
  });

  it('pesan "masuk" menyimpan sesi; sambung ulang melanjutkan sesi itu', async () => {
    const ws = WsPalsu.terakhir();
    ws.buka();
    ws.kirimDariServer({ t: 'masuk', kode: 'MADYA', token: 'rahasia', kursi: 0 });
    expect(JSON.parse(localStorage.getItem(KUNCI_SESI)!)).toEqual({ kode: 'MADYA', token: 'rahasia' });
    ws.putus();
    await vi.advanceTimersByTimeAsync(1_000);
    const ws2 = WsPalsu.terakhir();
    expect(ws2).not.toBe(ws);
    ws2.buka();
    expect(ws2.terkirim[0]).toMatchObject({ t: 'gabung', kode: 'MADYA', token: 'rahasia', nama: 'Penguji' });
  });

  describe('antrian saat belum/putus sambungan', () => {
    it('daftar ganda digabung; buat lalu gabung → hanya niat terbaru (gabung) yang dikirim', () => {
      k.kirim({ t: 'daftar' });
      k.kirim({ t: 'daftar' });
      k.kirim({ t: 'buat', nama: 'Penguji' });
      k.kirim({ t: 'gabung', kode: 'ABCDE', nama: 'Penguji' });
      const ws = WsPalsu.terakhir();
      ws.buka();
      expect(ws.terkirim).toEqual([{ t: 'daftar' }, { t: 'gabung', kode: 'ABCDE', nama: 'Penguji' }]);
    });

    it('niat masuk meja baru mengalahkan sesi lama yang tersimpan', () => {
      localStorage.setItem(KUNCI_SESI, JSON.stringify({ kode: 'LAMAA', token: 't' }));
      k.kirim({ t: 'buat', nama: 'Penguji' });
      const ws = WsPalsu.terakhir();
      ws.buka();
      expect(ws.terkirim).toEqual([{ t: 'buat', nama: 'Penguji' }]);
    });

    it('tanpa niat masuk, sesi lama dilanjutkan dulu baru antrian lain', () => {
      localStorage.setItem(KUNCI_SESI, JSON.stringify({ kode: 'LAMAA', token: 't' }));
      k.kirim({ t: 'daftar' });
      const ws = WsPalsu.terakhir();
      ws.buka();
      expect(ws.jenisTerkirim()).toEqual(['gabung', 'daftar']);
      expect(ws.terkirim[0]).toMatchObject({ kode: 'LAMAA', token: 't' });
    });

    it('aksi/vote/emote saat putus tidak dikirim ulang; pemain diberi tahu sekali saja', async () => {
      const ws = WsPalsu.terakhir();
      ws.buka();
      ws.putus();
      k.kirim({ t: 'aksi', aksi: { jenis: 'ambilDeck' } } as PesanKlien);
      k.kirim({ t: 'akhiri', setuju: true });
      k.kirim({ t: 'emote', isi: 'GG' });
      k.kirim({ t: 'mulai' });
      await microtask();
      const galat = pesan.filter((p) => p.t === 'error');
      expect(galat).toHaveLength(1);
      expect((galat[0] as { pesan: string }).pesan).toMatch(/Bos/);
      await vi.advanceTimersByTimeAsync(1_000);
      const ws2 = WsPalsu.terakhir();
      ws2.buka();
      expect(ws2.jenisTerkirim()).toEqual([]);
      // Putus lagi: pemberitahuan boleh muncul lagi (sekali per putus).
      ws2.putus();
      k.kirim({ t: 'aksi', aksi: { jenis: 'ambilDeck' } } as PesanKlien);
      await microtask();
      expect(pesan.filter((p) => p.t === 'error')).toHaveLength(2);
    });

    it('ping saat putus tidak diantrikan dan tidak memicu pesan error', async () => {
      k.kirim({ t: 'ping' });
      await microtask();
      WsPalsu.terakhir().buka();
      expect(WsPalsu.terakhir().terkirim).toEqual([]);
      expect(pesan.filter((p) => p.t === 'error')).toHaveLength(0);
    });

    it('pesan antrian yang lebih tua dari 30 detik dibuang (niat sudah basi)', async () => {
      k.kirim({ t: 'daftar' });
      await gagalSambung(1);
      await vi.advanceTimersByTimeAsync(31_000);
      k.kirim({ t: 'gabung', kode: 'ABCDE', nama: 'Penguji' });
      const ws = WsPalsu.terakhir();
      ws.buka();
      expect(ws.jenisTerkirim()).toEqual(['gabung']);
    });

    it("'keluar' saat putus tidak diantrikan (koneksinya langsung ditutup); siapKirim() memberi tahu", async () => {
      expect(k.siapKirim()).toBe(false);
      const ws = WsPalsu.terakhir();
      ws.buka();
      expect(k.siapKirim()).toBe(true);
      ws.putus();
      expect(k.siapKirim()).toBe(false);
      k.kirim({ t: 'keluar' });
      await vi.advanceTimersByTimeAsync(1_000);
      const ws2 = WsPalsu.terakhir();
      ws2.buka();
      expect(ws2.jenisTerkirim()).not.toContain('keluar');
      k.tutup();
      expect(k.siapKirim()).toBe(false);
    });

    it('antrian tidak tumbuh tanpa batas: satu pesan terbaru per jenis', () => {
      for (let i = 0; i < 50; i++) {
        k.kirim({ t: 'daftar' });
        k.kirim({ t: 'buat', nama: 'Penguji' });
        k.kirim({ t: 'gabung', kode: `K${i}`, nama: 'Penguji' });
      }
      const ws = WsPalsu.terakhir();
      ws.buka();
      expect(ws.terkirim.length).toBeLessThanOrEqual(3);
      expect(ws.terkirim).toContainEqual({ t: 'gabung', kode: 'K49', nama: 'Penguji' });
    });
  });

  it('tutup(): socket ditutup, tidak ada sambung ulang, pendengar dan timer dilepas', async () => {
    k.tutup();
    const pendengar = lacakPendengar();
    k = new KoneksiOnline('ws://uji/ws', () => 'Penguji');
    k.saatPesan((p) => pesan.push(p));
    WsPalsu.semua = [WsPalsu.terakhir()];
    const ws = WsPalsu.terakhir();
    ws.buka();
    k.kirim({ t: 'daftar' });
    k.tutup();
    expect(ws.ditutupKlien).toBe(true);
    expect(pendengar.sisa()).toEqual([]);
    window.dispatchEvent(new Event('online'));
    aturTerlihat('visible');
    await vi.advanceTimersByTimeAsync(120_000);
    expect(WsPalsu.semua.length).toBe(1);
    expect(vi.getTimerCount()).toBe(0);
    // Kirim setelah tutup: diam.
    k.kirim({ t: 'aksi', aksi: { jenis: 'ambilDeck' } } as PesanKlien);
    await microtask();
    expect(pesan.filter((p) => p.t === 'error')).toHaveLength(0);
  });
});
