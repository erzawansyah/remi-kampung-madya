// Jembatan transisi pembaruan PWA (public/sw-transisi.js, dimuat sw.js lewat workbox importScripts).
//
// Yang dijaga (pemain lama 0.1.x memakai registerType 'autoUpdate' dan tidak pernah mengirim SKIP_WAITING):
// - SW aktif masih 0.1 (penanda belum ada): SW baru langsung aktif, tidak menunggu semua tab ditutup.
// - Ada jendela yang tidak menjawab sapaan (halaman lama): langsung aktif, lalu jendela itu dimuat ulang.
// - Semua jendela menjawab (halaman 0.2+): SW baru MENUNGGU; momen aman tetap diputuskan pembaruan.ts.
// - Halaman 0.2+ yang masih memuat skripnya mendapat sapaan kedua sebelum dianggap lama.
//
// Berkasnya JS polos untuk service worker, jadi dijalankan di sini dengan `self` tiruan.

import { readFileSync } from 'node:fs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const SUMBER = readFileSync(new URL('../public/sw-transisi.js', import.meta.url), 'utf8');

interface KlienPalsu {
  id: string;
  url: string;
  /** Mulai menjawab pada sapaan ke-berapa (1 = langsung); null = halaman lama, tidak pernah menjawab. */
  jawabMulai: number | null;
  /** Menjawab lewat event.source (self 'message') alih-alih port. */
  lewatSumber?: boolean;
  disapa: number;
  postMessage(data: unknown, ports?: MessagePort[]): void;
  navigate: ReturnType<typeof vi.fn>;
}

interface Acara {
  waitUntil(p: Promise<unknown>): void;
  janji?: Promise<unknown>;
}

function pasangSW(opsi: { aktif: boolean; penanda: boolean }) {
  const pendengar: Record<string, ((e: unknown) => void)[]> = {};
  const penanda = new Map<string, unknown>(opsi.penanda ? [['__remi-transisi', true]] : []);
  let klien: KlienPalsu[] = [];
  const self = {
    addEventListener: (jenis: string, f: (e: unknown) => void) => (pendengar[jenis] ??= []).push(f),
    registration: { active: opsi.aktif ? {} : null },
    skipWaiting: vi.fn(async () => undefined),
    clients: { matchAll: vi.fn(async () => [...klien]) },
    caches: {
      open: async (nama: string) => {
        expect(nama).toBe('remi-transisi');
        return {
          match: async (url: string) => (penanda.has(url) ? {} : undefined),
          put: async (url: string, isi: unknown) => void penanda.set(url, isi),
        };
      },
    },
  };
  new Function('self', SUMBER)(self);
  const picu = async (jenis: 'install' | 'activate') => {
    const e: Acara = {
      waitUntil(p) {
        this.janji = p;
      },
    };
    for (const f of pendengar[jenis] ?? []) f(e);
    const selesai = e.janji;
    // Batas jawaban memakai timer palsu; pesan port tetap lewat event loop sungguhan.
    for (let i = 0; i < 20; i++) await vi.advanceTimersByTimeAsync(500);
    await selesai;
  };
  const buatKlien = (id: string, jawabMulai: number | null, lewatSumber = false): KlienPalsu => {
    const k: KlienPalsu = {
      id,
      url: `https://remi.uji/?${id}`,
      jawabMulai,
      lewatSumber,
      disapa: 0,
      navigate: vi.fn(async () => null),
      postMessage(data, ports) {
        expect(data).toEqual({ t: 'REMI_SAPA' });
        k.disapa++;
        if (k.jawabMulai === null || k.disapa < k.jawabMulai) return;
        const jawab = { t: 'REMI_JAWAB', versi: '0.2.0+uji' };
        if (k.lewatSumber) for (const f of pendengar.message ?? []) f({ data: jawab, source: { id: k.id } });
        else ports![0].postMessage(jawab);
      },
    };
    return k;
  };
  return {
    self,
    penanda,
    picu,
    aturKlien: (...k: KlienPalsu[]) => {
      klien = k;
    },
    buatKlien,
  };
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
});
afterEach(() => {
  vi.useRealTimers();
});

describe('sw-transisi: keputusan saat SW baru dipasang', () => {
  it('kunjungan pertama (belum ada SW aktif): tidak menyapa, tidak skipWaiting', async () => {
    const sw = pasangSW({ aktif: false, penanda: false });
    const k = sw.buatKlien('a', 1);
    sw.aturKlien(k);
    await sw.picu('install');
    expect(k.disapa).toBe(0);
    expect(sw.self.skipWaiting).not.toHaveBeenCalled();
  });

  it('SW aktif masih 0.1 (penanda belum ada): langsung aktif walau semua jendela menjawab', async () => {
    const sw = pasangSW({ aktif: true, penanda: false });
    const baru = sw.buatKlien('baru', 1);
    sw.aturKlien(baru);
    await sw.picu('install');
    expect(sw.self.skipWaiting).toHaveBeenCalledTimes(1);
    // Saat aktif: penanda ditulis; halaman 0.2 yang menjawab tidak dimuat ulang paksa.
    await sw.picu('activate');
    expect(sw.penanda.has('__remi-transisi')).toBe(true);
    expect(baru.navigate).not.toHaveBeenCalled();
  });

  it('SW aktif sudah 0.2+ dan semua jendela menjawab: SW baru menunggu (aturan momen aman tetap)', async () => {
    const sw = pasangSW({ aktif: true, penanda: true });
    const a = sw.buatKlien('a', 1);
    const b = sw.buatKlien('b', 1, true);
    sw.aturKlien(a, b);
    await sw.picu('install');
    expect(a.disapa).toBe(1);
    expect(b.disapa).toBe(1);
    expect(sw.self.skipWaiting).not.toHaveBeenCalled();
  });

  it('ada jendela lama yang tidak menjawab: langsung aktif, lalu hanya jendela lama itu dimuat ulang', async () => {
    const sw = pasangSW({ aktif: true, penanda: true });
    const baru = sw.buatKlien('baru', 1);
    const lama = sw.buatKlien('lama', null);
    sw.aturKlien(baru, lama);
    await sw.picu('install');
    expect(sw.self.skipWaiting).toHaveBeenCalledTimes(1);
    // Disapa dua putaran sebelum dianggap lama.
    expect(lama.disapa).toBe(2);
    expect(baru.disapa).toBe(1);
    await sw.picu('activate');
    expect(lama.navigate).toHaveBeenCalledWith(lama.url);
    expect(baru.navigate).not.toHaveBeenCalled();
  });

  it('activate tidak menunggu navigasi jendela lama selesai (navigasi itu sendiri menunggu SW aktif)', async () => {
    const sw = pasangSW({ aktif: true, penanda: true });
    const lama = sw.buatKlien('lama', null);
    // Seperti di Chrome: navigate() baru selesai sesudah SW ini aktif, jadi kalau ditunggu = macet.
    lama.navigate.mockImplementation(() => new Promise(() => {}));
    sw.aturKlien(lama);
    await sw.picu('install');
    await expect(sw.picu('activate')).resolves.toBeUndefined();
    expect(lama.navigate).toHaveBeenCalledTimes(1);
    expect(sw.penanda.has('__remi-transisi')).toBe(true);
  });

  it('halaman 0.2 yang masih memuat skrip (baru menjawab sapaan kedua) tidak dianggap lama', async () => {
    const sw = pasangSW({ aktif: true, penanda: true });
    const lambat = sw.buatKlien('lambat', 2);
    sw.aturKlien(lambat);
    await sw.picu('install');
    expect(lambat.disapa).toBe(2);
    expect(sw.self.skipWaiting).not.toHaveBeenCalled();
  });

  it('jendela yang ditutup di antara dua sapaan tidak memaksa SW aktif', async () => {
    const sw = pasangSW({ aktif: true, penanda: true });
    const a = sw.buatKlien('a', 1);
    const tutup = sw.buatKlien('tutup', null);
    sw.aturKlien(a, tutup);
    sw.self.clients.matchAll.mockImplementationOnce(async () => [a, tutup]).mockImplementation(async () => [a]);
    await sw.picu('install');
    expect(sw.self.skipWaiting).not.toHaveBeenCalled();
  });

  it('tanpa jendela sama sekali: menunggu biasa (tidak ada halaman yang perlu diselamatkan)', async () => {
    const sw = pasangSW({ aktif: true, penanda: true });
    sw.aturKlien();
    await sw.picu('install');
    expect(sw.self.skipWaiting).not.toHaveBeenCalled();
  });

  it('galat saat menilai (mis. clients.matchAll gagal): pemasangan tidak gagal, SW menunggu', async () => {
    const sw = pasangSW({ aktif: true, penanda: true });
    sw.self.clients.matchAll.mockRejectedValue(new Error('gagal'));
    await expect(sw.picu('install')).resolves.toBeUndefined();
    expect(sw.self.skipWaiting).not.toHaveBeenCalled();
  });
});
