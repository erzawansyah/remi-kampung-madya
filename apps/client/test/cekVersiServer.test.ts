// @vitest-environment happy-dom
// Cek versi server (/healthz) di sekitar meja bubar. Kasus nyata: server di-deploy ulang → sambungan
// putus → client menyambung lagi ke server baru → meja lama sudah tidak ada ("nggak ketemu").
// Yang dijaga: cek sesudah itu TIDAK tertahan JEDA_CEK_MIN_MS, jadi versi baru tidak menunggu cek
// berkala 30 menit.
//
// main.ts tidak bisa diimpor di test (langsung menyalakan aplikasi), jadi rangkaiannya ditiru di
// `rakit()` baris per baris: gerbang awal cekServer, pendengar status di pasangKoneksi, dan cabang
// 'error' "nggak ketemu" di terimaPesan. KoneksiOnline, PemicuCekServer, dan bolehCek yang asli.

import type { PesanKlien, PesanServer } from '@remi/meja';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { KoneksiOnline, type StatusKoneksi } from '../src/koneksi';
import { bolehCek, JEDA_CEK_MIN_MS, PemicuCekServer } from '../src/pembaruan';
import { simpan } from '../src/penyimpanan';

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
    this.terkirim.push(JSON.parse(s) as PesanKlien);
  }
  kirimDariServer(p: PesanServer) {
    this.onmessage?.({ data: JSON.stringify(p) });
  }
  close() {
    this.readyState = WsPalsu.CLOSED;
  }
  /** Diputus dari sisi server (1001 = server dimatikan) atau jaringan. */
  putus(code = 1006) {
    this.readyState = WsPalsu.CLOSED;
    this.onclose?.({ code });
  }
}

interface CatatanCek {
  paksa: boolean;
  /** Lolos gerbang jeda minimum (fetch /healthz benar-benar jalan). */
  jalan: boolean;
  t: number;
}

const AWAL = new Date('2026-10-14T10:00:00.000Z').getTime();

/** Rangkaian cek versi server seperti di main.ts. */
function rakit() {
  const cek: CatatanCek[] = [];
  let terakhirCekServer: number | null = null;
  // main.ts cekServer: `if (!navigator.onLine || !bolehCek(this.terakhirCekServer, Date.now(), paksa)) return;
  // this.terakhirCekServer = Date.now();` lalu fetch('/healthz').
  const cekServer = (paksa = false) => {
    const jalan = bolehCek(terakhirCekServer, Date.now(), paksa);
    if (jalan) terakhirCekServer = Date.now();
    cek.push({ paksa, jalan, t: Date.now() - AWAL });
  };
  /** Pasangan [status sebelumnya, status baru] yang dilihat main.ts. */
  const peralihan: [StatusKoneksi, StatusKoneksi][] = [];
  const pasangKoneksi = () => {
    const k = new KoneksiOnline('ws://uji/ws', () => 'Penguji');
    let statusKini: StatusKoneksi = 'menyambung';
    const pemicuCek = new PemicuCekServer();
    k.saatStatus((s) => {
      const sebelum = statusKini;
      statusKini = s;
      peralihan.push([sebelum, s]);
      const paksa = pemicuCek.status(s);
      if (paksa !== null && sebelum !== 'tersambung') cekServer(paksa);
    });
    k.saatPesan((p) => {
      // main.ts terimaPesan: meja hilang (biasanya server baru dinyalakan ulang) → cek tanpa jeda minimum.
      if (p.t === 'error' && p.pesan.includes('nggak ketemu') && simpan.sesi()) {
        simpan.setSesi(null);
        cekServer(true);
      }
    });
    return k;
  };
  return { cek, cekServer, peralihan, pasangKoneksi };
}

const koneksiDibuka: KoneksiOnline[] = [];

beforeEach(() => {
  vi.useFakeTimers({ now: AWAL });
  localStorage.clear();
  WsPalsu.semua = [];
  vi.stubGlobal('WebSocket', WsPalsu);
  Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'visible' });
});

afterEach(() => {
  koneksiDibuka.splice(0).forEach((k) => k.tutup());
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('PemicuCekServer', () => {
  it('tersambung pertama = cek biasa; tersambung lagi sesudah putus/gagal = paksa; status lain = tidak cek', () => {
    const p = new PemicuCekServer();
    expect(p.status('menyambung')).toBeNull();
    expect(p.status('tersambung')).toBe(false);
    expect(p.status('terputus')).toBeNull();
    expect(p.status('menyambung')).toBeNull();
    expect(p.status('tersambung')).toBe(true);
    // Sudah dipakai: sambungan berikutnya tanpa putus kembali cek biasa.
    expect(p.status('tersambung')).toBe(false);
    for (const s of ['menyambung', 'gagal', 'menyambung', 'terputus', 'menyambung'] as const) expect(p.status(s)).toBeNull();
    expect(p.status('tersambung')).toBe(true);
  });
});

describe('cek versi server sesudah meja bubar', () => {
  it('server di-deploy ulang 45 detik sesudah cek terakhir: sambung ulang dan "nggak ketemu" tetap dicek', async () => {
    const r = rakit();
    // Aplikasi dibuka: cek saat start.
    r.cekServer();
    // 20 detik kemudian pemain masuk meja: tersambung pertama kali = cek biasa, tertahan jeda minimum.
    await vi.advanceTimersByTimeAsync(20_000);
    const k = r.pasangKoneksi();
    koneksiDibuka.push(k);
    WsPalsu.terakhir().buka();
    WsPalsu.terakhir().kirimDariServer({ t: 'masuk', kode: 'ABCDE', token: 'tok', kursi: 0 });
    expect(simpan.sesi()).toEqual({ kode: 'ABCDE', token: 'tok' });

    // Server dimatikan untuk deploy (1001), percobaan pertama gagal, lalu server baru menerima.
    await vi.advanceTimersByTimeAsync(25_000);
    WsPalsu.terakhir().putus(1001);
    await vi.advanceTimersByTimeAsync(500);
    WsPalsu.terakhir().putus();
    await vi.advanceTimersByTimeAsync(1_000);
    const wsBaru = WsPalsu.terakhir();
    wsBaru.buka();
    // Client langsung minta kursinya lagi; server baru tidak kenal mejanya.
    expect(wsBaru.terkirim.find((p) => p.t === 'gabung')).toMatchObject({ kode: 'ABCDE', token: 'tok' });
    wsBaru.kirimDariServer({ t: 'error', pesan: 'Meja ABCDE nggak ketemu.' });

    expect(r.cek).toEqual([
      { paksa: false, jalan: true, t: 0 },
      { paksa: false, jalan: false, t: 20_000 },
      { paksa: true, jalan: true, t: 46_500 },
      { paksa: true, jalan: true, t: 46_500 },
    ]);
    // Keduanya masih di dalam jeda minimum sejak cek terakhir yang jalan (t=0): tanpa paksa pasti tertelan.
    expect(bolehCek(0, 46_500)).toBe(false);
    expect(simpan.sesi()).toBeNull();
  });

  it('KoneksiOnline selalu lewat "menyambung" sebelum "tersambung": status persis sebelumnya tidak bisa menandai putus', async () => {
    const r = rakit();
    koneksiDibuka.push(r.pasangKoneksi());
    WsPalsu.terakhir().buka();
    for (let i = 0; i < 3; i++) {
      WsPalsu.terakhir().putus();
      await vi.advanceTimersByTimeAsync(10_000);
      WsPalsu.terakhir().buka();
    }
    const keTersambung = r.peralihan.filter(([, s]) => s === 'tersambung').map(([sebelum]) => sebelum);
    expect(keTersambung).toEqual(['menyambung', 'menyambung', 'menyambung', 'menyambung']);
    // Yang dipakai pemicu: sempat putus sejak tersambung terakhir.
    expect(r.cek.map((c) => c.paksa)).toEqual([false, true, true, true]);
  });

  it('tanpa meja (mis. daftar meja publik, tidak ada "nggak ketemu"): sambung ulang ke server baru tetap dicek paksa', async () => {
    const r = rakit();
    koneksiDibuka.push(r.pasangKoneksi());
    WsPalsu.terakhir().buka();
    WsPalsu.terakhir().putus(1001);
    await vi.advanceTimersByTimeAsync(500);
    WsPalsu.terakhir().buka();
    expect(WsPalsu.terakhir().terkirim.some((p) => p.t === 'gabung')).toBe(false);
    expect(r.cek).toEqual([
      { paksa: false, jalan: true, t: 0 },
      // Baru setengah detik sejak cek sebelumnya: cek biasa pasti tertelan jeda minimum.
      { paksa: true, jalan: true, t: 500 },
    ]);
  });

  it('pemicu biasa di luar itu tetap dibatasi jeda minimum', async () => {
    const r = rakit();
    r.cekServer();
    await vi.advanceTimersByTimeAsync(JEDA_CEK_MIN_MS - 1);
    r.cekServer();
    await vi.advanceTimersByTimeAsync(1);
    r.cekServer();
    expect(r.cek.map((c) => c.jalan)).toEqual([true, false, true]);
  });
});
