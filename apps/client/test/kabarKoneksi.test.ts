// @vitest-environment happy-dom
// KabarKoneksi: kapan pemain dikabari soal koneksi (toast di main.ts, pembaca layar di kontrolMeja.ts).
// - urutan status murni: "putus" sekali per putus, "gagal" sekali, "pulih" hanya sesudah ada kabar;
// - dengan KoneksiOnline asli dan WebSocket palsu: setiap percobaan sambung ulang yang gagal mengulang
//   'menyambung' → 'terputus', dan status tepat sebelum 'tersambung' selalu 'menyambung'. Tanpa
//   KabarKoneksi, toast "Koneksi putus…" diulang tiap percobaan dan "Tersambung lagi." tidak pernah muncul.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { KabarKoneksi, KoneksiOnline, type Kabar, type StatusKoneksi } from '../src/koneksi';
import { WsPalsu } from './bantu';

/** Masukkan deret status, kembalikan kabar yang keluar (null dibuang). */
function kabarDari(deret: StatusKoneksi[], k = new KabarKoneksi()): Kabar[] {
  return deret.map((s) => k.status(s)).filter((x): x is Kabar => x !== null);
}

describe('KabarKoneksi (murni)', () => {
  it('sambungan pertama tanpa masalah: diam', () => {
    expect(kabarDari(['menyambung', 'tersambung'])).toEqual([]);
  });

  it('putus lalu beberapa percobaan gagal lalu pulih: "putus" sekali, lalu "pulih" sekali', () => {
    const deret: StatusKoneksi[] = ['menyambung', 'tersambung', 'terputus'];
    for (let i = 0; i < 5; i++) deret.push('menyambung', 'terputus');
    deret.push('menyambung', 'tersambung');
    expect(kabarDari(deret)).toEqual(['putus', 'pulih']);
  });

  it('tiap status satu per satu', () => {
    const k = new KabarKoneksi();
    expect(k.status('menyambung')).toBeNull();
    expect(k.status('tersambung')).toBeNull();
    expect(k.status('terputus')).toBe('putus');
    expect(k.status('terputus')).toBeNull();
    expect(k.status('menyambung')).toBeNull();
    expect(k.status('tersambung')).toBe('pulih');
    // Sesudah pulih, ingatannya kosong lagi: putus berikutnya dikabarkan lagi.
    expect(k.status('tersambung')).toBeNull();
    expect(k.status('terputus')).toBe('putus');
    expect(k.status('tersambung')).toBe('pulih');
  });

  it('server tak terjangkau sejak awal: "putus", lalu "gagal" sekali walau gagal terus', () => {
    const deret: StatusKoneksi[] = ['menyambung', 'terputus', 'menyambung', 'terputus'];
    for (let i = 0; i < 4; i++) deret.push('menyambung', 'gagal');
    expect(kabarDari(deret)).toEqual(['putus', 'gagal']);
    // Akhirnya tersambung juga: dikabari pulih.
    const k = new KabarKoneksi();
    kabarDari(deret, k);
    expect(k.status('menyambung')).toBeNull();
    expect(k.status('tersambung')).toBe('pulih');
  });

  it('"gagal" langsung tanpa "terputus" dulu tetap dikabarkan; "terputus" sesudah gagal diam', () => {
    expect(kabarDari(['menyambung', 'gagal', 'menyambung', 'terputus', 'menyambung', 'tersambung'])).toEqual(['gagal', 'pulih']);
  });
});

describe('KabarKoneksi dengan KoneksiOnline asli', () => {
  const dibuka: KoneksiOnline[] = [];

  beforeEach(() => {
    vi.useFakeTimers();
    localStorage.clear();
    WsPalsu.semua = [];
    vi.stubGlobal('WebSocket', WsPalsu);
    Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'visible' });
  });

  afterEach(() => {
    dibuka.splice(0).forEach((k) => k.tutup());
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  /** Pasang koneksi seperti main.ts pasangKoneksi: satu KabarKoneksi per koneksi, dihitung di setiap status. */
  function pasang() {
    const k = new KoneksiOnline('ws://uji/ws', () => 'Penguji');
    dibuka.push(k);
    const kabar = new KabarKoneksi();
    const status: StatusKoneksi[] = [];
    const keluar: Kabar[] = [];
    k.saatStatus((s) => {
      status.push(s);
      const x = kabar.status(s);
      if (x) keluar.push(x);
    });
    return { status, keluar };
  }

  it('putus di tengah main, tiga percobaan gagal, lalu tersambung: "putus" sekali dan "pulih" sekali', async () => {
    const r = pasang();
    WsPalsu.terakhir().buka();
    WsPalsu.terakhir().putus();
    for (let i = 0; i < 3; i++) {
      await vi.advanceTimersByTimeAsync(10_000);
      WsPalsu.terakhir().putus();
    }
    await vi.advanceTimersByTimeAsync(10_000);
    WsPalsu.terakhir().buka();
    // Bukti sebabnya: 'terputus' muncul berkali-kali dan sebelum 'tersambung' selalu 'menyambung'.
    expect(r.status.filter((s) => s === 'terputus')).toHaveLength(4);
    expect(r.status.at(-2)).toBe('menyambung');
    expect(r.keluar).toEqual(['putus', 'pulih']);
  });

  it('server mati sejak awal: "putus", lalu "gagal" sekali walau terus dicoba di belakang layar', async () => {
    const r = pasang();
    for (let i = 0; i < 6; i++) {
      WsPalsu.terakhir().putus();
      await vi.advanceTimersByTimeAsync(10_000);
    }
    expect(r.status.filter((s) => s === 'gagal').length).toBeGreaterThan(1);
    expect(r.keluar).toEqual(['putus', 'gagal']);
    WsPalsu.terakhir().buka();
    expect(r.keluar).toEqual(['putus', 'gagal', 'pulih']);
  });
});
