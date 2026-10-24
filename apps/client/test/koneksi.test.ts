// @vitest-environment happy-dom
// Koneksi online (WebSocket + sambung ulang) dan offline (meja lokal + simpanan localStorage).
// Diuji lewat perilaku yang terlihat dari luar: pesan yang sampai ke server palsu, status yang
// dilaporkan ke UI, dan isi localStorage. Waktu memakai fake timers, WebSocket diganti tiruan.

import { pilihAksiBot, Rng, type ViewPemain } from '@remi/engine';
import type { PesanKlien } from '@remi/meja';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { idInstansTab, KoneksiOffline, KoneksiOnline, type OpsiKoneksiOnline, type PesanDariMeja, type StatusKoneksi } from '../src/koneksi';
import { pasangLocalStorageRusak, WsPalsu } from './bantu';

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
  // Penanda tab (idInstansTab) di sessionStorage: tiap test mulai sebagai tab yang baru dibuka.
  sessionStorage.clear();
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
    const pesan: PesanDariMeja[] = [];
    k.saatPesan((p) => pesan.push(p));
    k.kirim({ t: 'siapJoker' });
    await microtask();
    const view = pesan.filter((p): p is Extract<PesanDariMeja, { t: 'view' }> => p.t === 'view').at(-1)?.view;
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
    const pesan: PesanDariMeja[] = [];
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
    k.saatPesan((p: PesanDariMeja) => {
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
    const pesan: PesanDariMeja[] = [];
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

describe('KoneksiOnline: sambung ulang, watchdog, antrian', () => {
  let k: KoneksiOnline;
  let status: StatusKoneksi[];
  let pesan: PesanDariMeja[];

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

  it('watchdog: ping lama tak berjawab melepas socket basi (20 dtk) lalu menyambung ulang', async () => {
    const ws = WsPalsu.terakhir();
    ws.jawabPing = false;
    ws.buka();
    // Ping pertama langsung saat tersambung, lalu tiap 10 dtk. 19 dtk tanpa jawaban belum divonis mati.
    expect(ws.terkirim.filter((p) => p.t === 'ping')).toHaveLength(1);
    await vi.advanceTimersByTimeAsync(19_000);
    expect(ws.onmessage).not.toBeNull();
    expect(status.at(-1)).toBe('tersambung');
    expect(ws.terkirim.filter((p) => p.t === 'ping').length).toBeGreaterThan(1);
    await vi.advanceTimersByTimeAsync(11_000);
    // Dilepas (handler dicabut) dan status terputus; socket baru dibuka sesudah jeda singkat.
    expect(ws.onmessage).toBeNull();
    expect(ws.onclose).toBeNull();
    expect(status).toContain('terputus');
    expect(WsPalsu.terakhir()).not.toBe(ws);
    // Socket lama baru ditutup belakangan (lihat test pensiun di bawah), paling lambat 15 dtk.
    await vi.advanceTimersByTimeAsync(15_000);
    expect(ws.ditutupKlien).toBe(true);
  });

  it('watchdog tidak memutus sambungan sehat yang menjawab ping', async () => {
    const ws = WsPalsu.terakhir();
    ws.buka();
    await vi.advanceTimersByTimeAsync(300_000);
    expect(ws.ditutupKlien).toBe(false);
    expect(WsPalsu.semua.length).toBe(1);
  });

  it('tab terlihat lagi: socket yang diam 5 detik dilepas dan disambung ulang', async () => {
    const ws = WsPalsu.terakhir();
    ws.buka();
    await microtask(); // pong ping pertama
    ws.jawabPing = false;
    aturTerlihat('visible');
    await vi.advanceTimersByTimeAsync(4_000);
    expect(ws.onmessage).not.toBeNull();
    expect(WsPalsu.semua).toHaveLength(1);
    await vi.advanceTimersByTimeAsync(2_000);
    expect(ws.onmessage).toBeNull();
    expect(status.at(-1)).not.toBe('tersambung');
    await vi.advanceTimersByTimeAsync(1_000);
    expect(WsPalsu.terakhir()).not.toBe(ws);
  });

  it('tab terlihat lagi: sambungan sehat yang menjawab ping TIDAK diputus', async () => {
    const ws = WsPalsu.terakhir();
    ws.buka();
    await microtask();
    const pingAwal = ws.terkirim.filter((p) => p.t === 'ping').length;
    aturTerlihat('visible');
    // Cek cepat mengirim ping sekarang juga, dan server menjawabnya.
    expect(ws.terkirim.filter((p) => p.t === 'ping')).toHaveLength(pingAwal + 1);
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
    await vi.advanceTimersByTimeAsync(10_000 * 7 + 100);
    // Interval ping dari sambungan-sambungan lama tidak boleh ikut mengirim lewat socket baru:
    // satu ping saat tersambung + satu tiap 10 dtk.
    expect(ws.terkirim.filter((p) => p.t === 'ping')).toHaveLength(8);
    // Socket lama hanya sempat mengirim ping pembukanya.
    for (const lama of WsPalsu.semua.slice(0, -1)) expect(lama.terkirim.filter((p) => p.t === 'ping')).toHaveLength(1);
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
    expect(JSON.parse(localStorage.getItem(KUNCI_SESI)!)).toEqual({ kode: 'MADYA', token: 'rahasia', pemegang: k.idInstans });
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
      expect(ws.terkirim.filter((p) => p.t !== 'ping')).toEqual([{ t: 'daftar' }, { t: 'gabung', kode: 'ABCDE', nama: 'Penguji' }]);
    });

    it('niat masuk meja baru mengalahkan sesi lama yang tersimpan', () => {
      localStorage.setItem(KUNCI_SESI, JSON.stringify({ kode: 'LAMAA', token: 't' }));
      k.kirim({ t: 'buat', nama: 'Penguji' });
      const ws = WsPalsu.terakhir();
      ws.buka();
      expect(ws.terkirim.filter((p) => p.t !== 'ping')).toEqual([{ t: 'buat', nama: 'Penguji' }]);
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
      expect(WsPalsu.terakhir().terkirim).toEqual([{ t: 'ping' }]); // hanya ping pembuka sambungan baru
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
      expect(ws.jenisTerkirim().length).toBeLessThanOrEqual(3);
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

// ---------------------------------------------------------------------------------------------
// Perbaikan koneksi putus-putus (langkah 1, 4, 8)

describe('KoneksiOnline: socket setengah mati ketahuan cepat (langkah 1)', () => {
  let k: KoneksiOnline;
  let status: StatusKoneksi[];
  let pesan: PesanDariMeja[];

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

  /** Buka socket sekarang dan tandai masuk meja MADYA (server menjawab ping). */
  async function masukMeja(): Promise<WsPalsu> {
    const ws = WsPalsu.terakhir();
    ws.buka();
    ws.kirimDariServer({ t: 'masuk', kode: 'MADYA', token: 'rahasia', kursi: 0 });
    await microtask();
    return ws;
  }

  it('aksi ke socket yang diam: dilepas ≤ 5 dtk, socket baru dibuka dan langsung minta kursinya lagi', async () => {
    const ws = await masukMeja();
    ws.jawabPing = false;
    k.kirim({ t: 'aksi', aksi: { jenis: 'ambilDeck' } } as PesanKlien);
    // Cek cepat: ping ikut dikirim sesudah aksi.
    expect(ws.terkirim.at(-1)).toEqual({ t: 'ping' });
    await vi.advanceTimersByTimeAsync(4_900);
    expect(ws.onmessage).not.toBeNull();
    await vi.advanceTimersByTimeAsync(200);
    expect(ws.onmessage).toBeNull();
    expect(status.at(-1)).toBe('terputus');
    await vi.advanceTimersByTimeAsync(500);
    const baru = WsPalsu.terakhir();
    expect(baru).not.toBe(ws);
    baru.buka();
    expect(baru.terkirim[0]).toMatchObject({ t: 'gabung', kode: 'MADYA', token: 'rahasia' });
  });

  it('socket sehat yang menjawab: aksi beruntun tidak pernah memutus sambungan', async () => {
    const ws = await masukMeja();
    for (let i = 0; i < 6; i++) {
      k.kirim({ t: 'emote', isi: 'GG' });
      await vi.advanceTimersByTimeAsync(3_000);
    }
    await vi.advanceTimersByTimeAsync(10_000);
    expect(ws.onmessage).not.toBeNull();
    expect(WsPalsu.semua).toHaveLength(1);
  });

  it('jawaban apa pun (bukan cuma pong) membuktikan sambungan hidup', async () => {
    const ws = await masukMeja();
    ws.jawabPing = false;
    k.kirim({ t: 'akhiri', setuju: true });
    await vi.advanceTimersByTimeAsync(2_000);
    ws.kirimDariServer({ t: 'error', pesan: 'Belum bisa, Bos.' });
    await vi.advanceTimersByTimeAsync(4_000);
    expect(ws.onmessage).not.toBeNull();
    expect(WsPalsu.semua).toHaveLength(1);
  });

  it('periksa(): socket terbuka dicek dengan ping; sudah putus = langsung sambung tanpa menunggu backoff', async () => {
    const ws = await masukMeja();
    ws.jawabPing = false;
    k.periksa();
    expect(ws.terkirim.at(-1)).toEqual({ t: 'ping' });
    await vi.advanceTimersByTimeAsync(5_100);
    expect(ws.onmessage).toBeNull();
    // Gagal terus sampai backoff membesar; periksa() langsung mencoba lagi.
    for (let i = 0; i < 4; i++) {
      await vi.advanceTimersByTimeAsync(9_000);
      WsPalsu.terakhir().putus();
    }
    const n = WsPalsu.semua.length;
    k.periksa();
    expect(WsPalsu.semua.length).toBe(n + 1);
  });

  it("sinyal hilang (event 'offline') atau jaringan berganti (navigator.connection 'change'): dicek; dilepas di tutup()", async () => {
    const jaringan = new EventTarget();
    Object.defineProperty(navigator, 'connection', { configurable: true, get: () => jaringan });
    try {
      k.tutup();
      const pendengar = lacakPendengar();
      const tambah = vi.spyOn(jaringan, 'addEventListener');
      const lepas = vi.spyOn(jaringan, 'removeEventListener');
      k = new KoneksiOnline('ws://uji/ws', () => 'Penguji');
      expect(tambah).toHaveBeenCalledWith('change', expect.any(Function));
      const ws = WsPalsu.terakhir();
      ws.buka();
      await microtask();
      const ping = () => ws.terkirim.filter((p) => p.t === 'ping').length;
      const awal = ping();
      window.dispatchEvent(new Event('offline'));
      expect(ping()).toBe(awal + 1);
      await microtask(); // dijawab
      jaringan.dispatchEvent(new Event('change'));
      expect(ping()).toBe(awal + 2);
      await microtask();
      // 'offline' tidak membuka socket baru kalau sedang tidak tersambung (cuma memeriksa yang terbuka).
      ws.putus();
      const n = WsPalsu.semua.length;
      window.dispatchEvent(new Event('offline'));
      expect(WsPalsu.semua.length).toBe(n);
      k.tutup();
      expect(lepas).toHaveBeenCalledWith('change', tambah.mock.calls[0][1]);
      expect(pendengar.sisa()).toEqual([]);
    } finally {
      delete (navigator as unknown as { connection?: unknown }).connection;
    }
  });

  describe('socket lama dipensiunkan, bukan langsung ditutup', () => {
    it('ditutup sesudah socket baru menerima "masuk"; kode 4000 darinya diabaikan', async () => {
      const lama = await masukMeja();
      lama.jawabPing = false;
      k.kirim({ t: 'siapJoker' });
      await vi.advanceTimersByTimeAsync(5_100);
      expect(lama.ditutupKlien).toBe(false);
      await vi.advanceTimersByTimeAsync(500);
      const baru = WsPalsu.terakhir();
      baru.buka();
      expect(baru.terkirim[0]).toMatchObject({ t: 'gabung', kode: 'MADYA' });
      // Server menautkan kursi ke socket baru lalu menutup yang lama dengan 4000: tidak dibaca.
      lama.putus(4000);
      expect(pesan.some((p) => p.t === 'keluar')).toBe(false);
      expect(lama.ditutupKlien).toBe(false);
      baru.kirimDariServer({ t: 'masuk', kode: 'MADYA', token: 'rahasia', kursi: 0 });
      expect(lama.ditutupKlien).toBe(true);
      await vi.advanceTimersByTimeAsync(60_000);
      expect(pesan.some((p) => p.t === 'keluar')).toBe(false);
      expect(WsPalsu.semua).toHaveLength(2);
    });

    it('socket baru tidak pernah "masuk": cadangan 15 dtk menutup yang lama', async () => {
      const lama = await masukMeja();
      lama.jawabPing = false;
      k.periksa();
      await vi.advanceTimersByTimeAsync(5_100);
      await vi.advanceTimersByTimeAsync(14_000);
      expect(lama.ditutupKlien).toBe(false);
      await vi.advanceTimersByTimeAsync(1_000);
      expect(lama.ditutupKlien).toBe(true);
    });

    it('tutup() ikut menutup socket pensiunan tanpa sisa timer', async () => {
      const lama = await masukMeja();
      lama.jawabPing = false;
      k.periksa();
      await vi.advanceTimersByTimeAsync(5_100);
      expect(lama.ditutupKlien).toBe(false);
      k.tutup();
      expect(lama.ditutupKlien).toBe(true);
      expect(vi.getTimerCount()).toBe(0);
    });

    it('socket yang masih CONNECTING tetap langsung ditutup', async () => {
      const ws = WsPalsu.terakhir();
      await vi.advanceTimersByTimeAsync(10_100);
      expect(ws.ditutupKlien).toBe(true);
    });
  });
});

describe('KoneksiOnline: pemulihan sesi (langkah 4)', () => {
  const dibuka: KoneksiOnline[] = [];
  const baru = (opsi?: OpsiKoneksiOnline) => {
    const k = new KoneksiOnline('ws://uji/ws', () => 'Penguji', opsi);
    dibuka.push(k);
    return k;
  };
  beforeEach(() => {
    WsPalsu.semua = [];
    vi.stubGlobal('WebSocket', WsPalsu);
  });
  afterEach(() => {
    dibuka.splice(0).forEach((k) => k.tutup());
    aturTerlihat('visible');
  });

  it("lanjutSesi: gagal berkali-kali tidak pernah 'gagal', terus mencoba; dimatikan = kembali ke aturan biasa", async () => {
    localStorage.setItem(KUNCI_SESI, JSON.stringify({ kode: 'MADYA', token: 't' }));
    const k = baru({ lanjutSesi: true });
    const status: StatusKoneksi[] = [];
    k.saatStatus((s) => status.push(s));
    for (let i = 0; i < 6; i++) {
      WsPalsu.terakhir().putus();
      await vi.advanceTimersByTimeAsync(8_000);
    }
    expect(status).not.toContain('gagal');
    expect(WsPalsu.semua.length).toBe(7);
    WsPalsu.terakhir().buka();
    expect(WsPalsu.terakhir().terkirim[0]).toMatchObject({ t: 'gabung', kode: 'MADYA', token: 't' });
    expect(k.melanjutkanSesi).toBe(true);
    k.aturLanjutSesi(false);
    expect(k.melanjutkanSesi).toBe(false);
  });

  it('localStorage rusak: sambung ulang tetap minta kursi dengan token dari pesan "masuk"', async () => {
    pasangLocalStorageRusak();
    const k = baru();
    const ws = WsPalsu.terakhir();
    ws.buka();
    ws.kirimDariServer({ t: 'masuk', kode: 'MADYA', token: 'rahasia', kursi: 1 });
    expect(k.sesiAktif()).toMatchObject({ kode: 'MADYA', token: 'rahasia' });
    ws.putus();
    await vi.advanceTimersByTimeAsync(1_000);
    WsPalsu.terakhir().buka();
    expect(WsPalsu.terakhir().terkirim[0]).toMatchObject({ t: 'gabung', kode: 'MADYA', token: 'rahasia' });
  });

  it('setItem gagal padahal sesi meja lama masih tersimpan: tetap kembali ke meja dari "masuk"', async () => {
    localStorage.setItem(KUNCI_SESI, JSON.stringify({ kode: 'LAMAA', token: 'tok-lama' }));
    const asli = localStorage;
    vi.stubGlobal('localStorage', {
      getItem: (x: string) => asli.getItem(x),
      setItem: () => {
        throw new DOMException('penuh', 'QuotaExceededError');
      },
      removeItem: (x: string) => asli.removeItem(x),
      clear: () => asli.clear(),
      key: (i: number) => asli.key(i),
      length: 0,
    });
    baru();
    const ws = WsPalsu.terakhir();
    ws.buka();
    ws.kirimDariServer({ t: 'masuk', kode: 'BARUU', token: 'tok-baru', kursi: 0 });
    ws.putus();
    await vi.advanceTimersByTimeAsync(1_000);
    WsPalsu.terakhir().buka();
    expect(WsPalsu.terakhir().terkirim[0]).toMatchObject({ t: 'gabung', kode: 'BARUU', token: 'tok-baru' });
  });

  it('sesi tersimpan ditimpa tab lain (meja lain): koneksi ini tetap kembali ke mejanya sendiri', async () => {
    baru();
    const ws = WsPalsu.terakhir();
    ws.buka();
    ws.kirimDariServer({ t: 'masuk', kode: 'MADYA', token: 'punyaku', kursi: 0 });
    localStorage.setItem(KUNCI_SESI, JSON.stringify({ kode: 'TABBB', token: 'punya-tab-lain', pemegang: 'lain' }));
    ws.putus();
    await vi.advanceTimersByTimeAsync(1_000);
    WsPalsu.terakhir().buka();
    expect(WsPalsu.terakhir().terkirim[0]).toMatchObject({ t: 'gabung', kode: 'MADYA', token: 'punyaku' });
  });

  it("pesan 'keluar' dan lupakanSesi() mengosongkan sesi memori; sambung ulang tidak minta kursi lagi", async () => {
    pasangLocalStorageRusak();
    const k = baru();
    const ws = WsPalsu.terakhir();
    ws.buka();
    ws.kirimDariServer({ t: 'masuk', kode: 'MADYA', token: 'rahasia', kursi: 1 });
    k.lupakanSesi();
    expect(k.sesiAktif()).toBeNull();
    ws.putus();
    await vi.advanceTimersByTimeAsync(1_000);
    WsPalsu.terakhir().buka();
    expect(WsPalsu.terakhir().jenisTerkirim()).toEqual([]);
    WsPalsu.terakhir().kirimDariServer({ t: 'masuk', kode: 'MADYA', token: 'rahasia', kursi: 1 });
    WsPalsu.terakhir().kirimDariServer({ t: 'keluar', alasan: 'Kamu dikeluarkan.' });
    expect(k.sesiAktif()).toBeNull();
  });

  it('pakaiSesiTersimpan: false (sesudah ditendang 4000) tidak minta kursi dari sesi tersimpan', () => {
    localStorage.setItem(KUNCI_SESI, JSON.stringify({ kode: 'MADYA', token: 't' }));
    const k = baru({ pakaiSesiTersimpan: false });
    k.kirim({ t: 'daftar' });
    WsPalsu.terakhir().buka();
    expect(WsPalsu.terakhir().jenisTerkirim()).toEqual(['daftar']);
  });

  describe('dua instans aplikasi (tab/PWA) dengan sesi yang sama', () => {
    async function duaInstans() {
      // A masuk duluan, lalu B (tab lain: sessionStorage-nya sendiri, kosong) masuk ke meja yang sama dan
      // jadi pemegang sesi.
      const a = baru();
      const wsA = WsPalsu.terakhir();
      wsA.buka();
      wsA.kirimDariServer({ t: 'masuk', kode: 'MADYA', token: 'tok', kursi: 0 });
      sessionStorage.clear();
      const b = baru();
      expect(b.idInstans).not.toBe(a.idInstans);
      const wsB = WsPalsu.terakhir();
      wsB.buka();
      wsB.kirimDariServer({ t: 'masuk', kode: 'MADYA', token: 'tok', kursi: 0 });
      expect(JSON.parse(localStorage.getItem(KUNCI_SESI)!).pemegang).toBe(b.idInstans);
      return { a, b, wsA, wsB };
    }

    it('instans tersembunyi yang bukan pemegang tidak menyambung ulang sendiri; terlihat lagi = menyambung', async () => {
      const { a, wsA } = await duaInstans();
      const statusA: StatusKoneksi[] = [];
      a.saatStatus((s) => statusA.push(s));
      aturTerlihat('hidden');
      // Jalur lama A mati tanpa kode 4000 (ganti jaringan): watchdog/online tidak membuat socket baru.
      wsA.putus();
      const n = WsPalsu.semua.length;
      await vi.advanceTimersByTimeAsync(60_000);
      window.dispatchEvent(new Event('online'));
      expect(WsPalsu.semua.length).toBe(n);
      expect(statusA.at(-1)).toBe('terputus');
      // Pemain membuka A lagi: A yang sedang dilihat mengambil kursinya.
      aturTerlihat('visible');
      expect(WsPalsu.semua.length).toBe(n + 1);
      WsPalsu.terakhir().buka();
      expect(WsPalsu.terakhir().terkirim[0]).toMatchObject({ t: 'gabung', kode: 'MADYA', token: 'tok' });
    });

    it('pemegang yang tersembunyi (pindah aplikasi sebentar) tetap menyambung ulang', async () => {
      const { wsB } = await duaInstans();
      aturTerlihat('hidden');
      wsB.putus();
      const n = WsPalsu.semua.length;
      await vi.advanceTimersByTimeAsync(1_000);
      expect(WsPalsu.semua.length).toBe(n + 1);
    });

    it('tab yang sama dimuat ulang selagi tersembunyi (pembaruan PWA): halaman baru langsung kembali ke meja', async () => {
      const lama = baru();
      const ws = WsPalsu.terakhir();
      ws.buka();
      ws.kirimDariServer({ t: 'masuk', kode: 'MADYA', token: 'tok', kursi: 0 });
      expect(JSON.parse(localStorage.getItem(KUNCI_SESI)!).pemegang).toBe(lama.idInstans);
      aturTerlihat('hidden');
      // Halaman lama ditutup (muat ulang), lalu halaman baru di tab yang sama melanjutkan sesi (main.ts).
      lama.tutup();
      const n = WsPalsu.semua.length;
      const k = baru({ lanjutSesi: true });
      expect(k.idInstans).toBe(lama.idInstans);
      expect(WsPalsu.semua.length).toBe(n + 1);
      WsPalsu.terakhir().buka();
      expect(WsPalsu.terakhir().terkirim[0]).toMatchObject({ t: 'gabung', kode: 'MADYA', token: 'tok' });
    });

    it('tab lain yang dimuat ulang selagi tersembunyi tetap mengalah ke pemegang sampai terlihat', async () => {
      const { a, b } = await duaInstans();
      expect(JSON.parse(localStorage.getItem(KUNCI_SESI)!).pemegang).toBe(b.idInstans);
      aturTerlihat('hidden');
      // Tab A (sessionStorage-nya sendiri) dimuat ulang selagi tersembunyi.
      a.tutup();
      sessionStorage.setItem('remi.idInstans', a.idInstans);
      const n = WsPalsu.semua.length;
      const a2 = baru({ lanjutSesi: true });
      expect(a2.idInstans).toBe(a.idInstans);
      await vi.advanceTimersByTimeAsync(30_000);
      expect(WsPalsu.semua.length).toBe(n);
      aturTerlihat('visible');
      expect(WsPalsu.semua.length).toBe(n + 1);
    });

    it('sesi lama tanpa penanda pemegang tetap disambung walau tersembunyi', async () => {
      localStorage.setItem(KUNCI_SESI, JSON.stringify({ kode: 'MADYA', token: 'tok' }));
      aturTerlihat('hidden');
      baru();
      expect(WsPalsu.semua).toHaveLength(1);
      WsPalsu.terakhir().buka();
      expect(WsPalsu.terakhir().terkirim[0]).toMatchObject({ t: 'gabung', kode: 'MADYA' });
    });
  });
});

describe('idInstansTab: penanda tab untuk pemegang sesi', () => {
  it('sama selama tab yang sama (juga sesudah muat ulang), beda untuk tab lain', () => {
    const satu = idInstansTab();
    expect(satu).toMatch(/^[0-9a-f]{32}$/);
    expect(idInstansTab()).toBe(satu);
    expect(sessionStorage.getItem('remi.idInstans')).toBe(satu);
    // Tab lain: sessionStorage-nya sendiri (kosong).
    sessionStorage.clear();
    expect(idInstansTab()).not.toBe(satu);
  });

  it('isi sessionStorage yang rusak diganti id baru', () => {
    sessionStorage.setItem('remi.idInstans', '<script>');
    const id = idInstansTab();
    expect(id).toMatch(/^[0-9a-f]{32}$/);
    expect(sessionStorage.getItem('remi.idInstans')).toBe(id);
  });

  it('sessionStorage tidak bisa dipakai: id tetap sama selama halaman ini hidup', () => {
    vi.stubGlobal('sessionStorage', {
      getItem: () => {
        throw new DOMException('diblokir', 'SecurityError');
      },
      setItem: () => {
        throw new DOMException('diblokir', 'SecurityError');
      },
    });
    const satu = idInstansTab();
    expect(satu).toMatch(/^[0-9a-f]{32}$/);
    expect(idInstansTab()).toBe(satu);
  });
});

describe('KoneksiOnline: selisih jam HP vs server (langkah 8)', () => {
  let k: KoneksiOnline;
  beforeEach(() => {
    WsPalsu.semua = [];
    vi.stubGlobal('WebSocket', WsPalsu);
    vi.setSystemTime(1_000_000);
    k = new KoneksiOnline('ws://uji/ws', () => 'Penguji');
  });
  afterEach(() => k.tutup());

  /** Buka socket; pong dijawab manual dari test (jam server = jam HP + `beda`). */
  function buka() {
    const ws = WsPalsu.terakhir();
    ws.jawabPing = false;
    ws.buka();
    return ws;
  }

  it('pong tanpa w (server lama, meja offline) = selisih 0', async () => {
    const ws = buka();
    await vi.advanceTimersByTimeAsync(100);
    ws.kirimDariServer({ t: 'pong' });
    expect(k.selisihJam()).toBe(0);
  });

  it('jam HP terlambat 8 dtk: selisih dari sampel ber-RTT terkecil dipakai', async () => {
    const ws = buka();
    // Ping pertama (t=0) dijawab lambat: RTT 3 dtk, server mencap waktu di tengah jalan.
    await vi.advanceTimersByTimeAsync(3_000);
    ws.kirimDariServer({ t: 'pong', w: Date.now() - 1_500 + 8_000 });
    const kasar = k.selisihJam();
    expect(Math.abs(kasar - 8_000)).toBeLessThanOrEqual(1);
    // Ping berikut (t=10 dtk) dijawab cepat (RTT 100 ms): lebih teliti, menggantikan.
    await vi.advanceTimersByTimeAsync(7_000);
    await vi.advanceTimersByTimeAsync(100);
    ws.kirimDariServer({ t: 'pong', w: Date.now() - 50 + 8_200 });
    expect(Math.abs(k.selisihJam() - 8_200)).toBeLessThanOrEqual(1);
  });

  it('selisih kecil (dalam ketelitian + 1,5 dtk) diabaikan: jam HP yang benar tetap dipakai', async () => {
    const ws = buka();
    await vi.advanceTimersByTimeAsync(200);
    ws.kirimDariServer({ t: 'pong', w: Date.now() - 100 + 1_200 });
    expect(k.selisihJam()).toBe(0);
  });

  it('sampel terlambat (RTT besar) tidak menaikkan sisa waktu', async () => {
    const ws = buka();
    // Sampel cepat dan akurat: jam sama.
    await vi.advanceTimersByTimeAsync(80);
    ws.kirimDariServer({ t: 'pong', w: Date.now() - 40 });
    expect(k.selisihJam()).toBe(0);
    // Ping berikut tertahan 9 dtk di jalan pulang (retransmisi): taksirannya −4,5 dtk, tidak dipakai.
    await vi.advanceTimersByTimeAsync(9_920);
    await vi.advanceTimersByTimeAsync(9_000);
    ws.kirimDariServer({ t: 'pong', w: Date.now() - 9_000 });
    expect(k.selisihJam()).toBe(0);
  });

  it('sampel pertama tertahan lama: ambangnya ikut besar, tidak dipakai', async () => {
    const ws = buka();
    await vi.advanceTimersByTimeAsync(8_000);
    ws.kirimDariServer({ t: 'pong', w: Date.now() - 8_000 });
    expect(k.selisihJam()).toBe(0);
  });
});
