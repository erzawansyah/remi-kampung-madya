// Punggung kartu Kedai Madya (kartuGrafisGambar.ts): digambar lewat Canvas 2D palsu yang mencatat panggilan.
// - Path2D ada  → medali berisi maskot (normal) / siluet (mini) dari aset/logoMadya.ts, diisi evenodd.
// - Path2D tidak ada (happy-dom/Node) → cadangan medali lama, tanpa error.
// - Semua punggung identik; muka kartu tidak memakai logo.

import { afterEach, describe, expect, it, vi } from 'vitest';
import { gambarKartu } from '../src/game/kartuGrafisGambar';
import { pathLogo } from '../src/aset/logoMadya';

interface Catatan {
  panggil: { nama: string; arg: unknown[] }[];
  set: { nama: string; nilai: unknown }[];
}

/** CanvasRenderingContext2D palsu: semua metode dicatat, measureText & gradien diberi nilai wajar. */
function ctxPalsu(): { ctx: CanvasRenderingContext2D; catat: Catatan } {
  const catat: Catatan = { panggil: [], set: [] };
  const gradien = { addColorStop: () => undefined };
  const target: Record<string, unknown> = {};
  const ctx = new Proxy(target, {
    get(_t, nama: string) {
      if (nama in target) return target[nama];
      return (...arg: unknown[]) => {
        catat.panggil.push({ nama, arg });
        if (nama === 'measureText') return { width: 20 };
        if (nama === 'createLinearGradient' || nama === 'createRadialGradient') return gradien;
        return undefined;
      };
    },
    set(_t, nama: string, nilai) {
      target[nama] = nilai;
      catat.set.push({ nama, nilai });
      return true;
    },
  }) as unknown as CanvasRenderingContext2D;
  return { ctx, catat };
}

class Path2DPalsu {
  constructor(readonly d: string) {}
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.resetModules();
});

describe('punggung kartu', () => {
  it('dengan Path2D: medali berisi maskot (normal) dan siluet (mini), diisi evenodd warna tinta logo', async () => {
    vi.stubGlobal('Path2D', Path2DPalsu);
    vi.resetModules();
    const { gambarKartu: gambar } = await import('../src/game/kartuGrafisGambar');
    for (const [gaya, varian] of [['normal', 'maskot'], ['mini', 'siluet']] as const) {
      const { ctx, catat } = ctxPalsu();
      gambar(ctx, null, 200, gaya, 'dua');
      const isiPath = catat.panggil.filter((p) => p.nama === 'fill' && p.arg[0] instanceof Path2DPalsu);
      expect(isiPath).toHaveLength(1);
      expect((isiPath[0].arg[0] as Path2DPalsu).d).toBe(pathLogo(varian).isi.join(''));
      expect(isiPath[0].arg[1]).toBe('evenodd');
      // Tidak ada monogram cadangan.
      expect(catat.panggil.some((p) => p.nama === 'fillText')).toBe(false);
      // Dasar arang & kuning MADYA dipakai.
      const warna = catat.set.filter((s) => s.nama === 'fillStyle' || s.nama === 'strokeStyle').map((s) => String(s.nilai).toLowerCase());
      expect(warna).toContain('#f1a615');
      expect(warna).toContain('#111111');
    }
  });

  it('tanpa Path2D: cadangan medali lama, tidak melempar', () => {
    vi.stubGlobal('Path2D', undefined);
    const normal = ctxPalsu();
    expect(() => gambarKartu(normal.ctx, null, 200, 'normal', 'dua')).not.toThrow();
    expect(normal.catat.panggil.some((p) => p.nama === 'fillText' && p.arg[0] === 'KM')).toBe(true);
    const mini = ctxPalsu();
    expect(() => gambarKartu(mini.ctx, null, 64, 'mini', 'dua')).not.toThrow();
  });

  it('semua punggung identik: mode warna kartu tidak mengubah gambar punggung', async () => {
    vi.stubGlobal('Path2D', Path2DPalsu);
    vi.resetModules();
    const { gambarKartu: gambar } = await import('../src/game/kartuGrafisGambar');
    const jejak = (mode: 'dua' | 'empat') => {
      const { ctx, catat } = ctxPalsu();
      gambar(ctx, null, 200, 'normal', mode);
      return JSON.stringify([catat.panggil.map((p) => [p.nama, p.arg.map((a) => (a instanceof Path2DPalsu ? a.d.length : a))]), catat.set]);
    };
    expect(jejak('dua')).toBe(jejak('empat'));
  });

  it('muka kartu tidak memakai logo', async () => {
    vi.stubGlobal('Path2D', Path2DPalsu);
    vi.resetModules();
    const { gambarKartu: gambar } = await import('../src/game/kartuGrafisGambar');
    const { ctx, catat } = ctxPalsu();
    gambar(ctx, { bunga: 'love', rank: 13 }, 200, 'normal', 'dua');
    expect(catat.panggil.some((p) => p.arg[0] instanceof Path2DPalsu)).toBe(false);
  });
});

describe('isi medali punggung mengikuti lebar tampil', () => {
  it('maskot hanya kalau tampil ≥ 28 px CSS; kartu normal 36–77 px berisi siluet cangkir', async () => {
    const { logoPunggungUntuk, RASIO_MASKOT_PUNGGUNG, LEBAR_MASKOT_MIN_CSS, BATAS_MINI_CSS } = await import('../src/game/kartuGrafisGambar');
    expect(LEBAR_MASKOT_MIN_CSS).toBe(28);
    // Maskot (viewBox 330×246) dimuatkan ke lingkaran medali: ±0,36 lebar kartu.
    expect(RASIO_MASKOT_PUNGGUNG).toBeGreaterThan(0.3);
    expect(RASIO_MASKOT_PUNGGUNG).toBeLessThan(0.4);
    for (const w of [BATAS_MINI_CSS, 46, 64, 77]) expect(logoPunggungUntuk(w), `${w} px`).toBe('siluet');
    for (const w of [78, 96, 140, 190]) expect(logoPunggungUntuk(w), `${w} px`).toBe('maskot');
    // Batasnya tepat di lebar maskot 28 px.
    const batas = LEBAR_MASKOT_MIN_CSS / RASIO_MASKOT_PUNGGUNG;
    expect(logoPunggungUntuk(batas - 0.01)).toBe('siluet');
    expect(logoPunggungUntuk(batas + 0.01)).toBe('maskot');
  });

  it("desain normal dengan logo 'siluet': medali normal (bergaris) berisi siluet; muka kartu tidak terpengaruh", async () => {
    vi.stubGlobal('Path2D', Path2DPalsu);
    vi.resetModules();
    const { gambarKartu: gambar } = await import('../src/game/kartuGrafisGambar');
    const { ctx, catat } = ctxPalsu();
    gambar(ctx, null, 200, 'normal', 'dua', 'siluet');
    const isiPath = catat.panggil.filter((p) => p.nama === 'fill' && p.arg[0] instanceof Path2DPalsu);
    expect(isiPath).toHaveLength(1);
    expect((isiPath[0].arg[0] as Path2DPalsu).d).toBe(pathLogo('siluet').isi.join(''));
    // Tetap desain normal (bingkai kuning dalam), bukan desain mini.
    const normalMaskot = ctxPalsu();
    gambar(normalMaskot.ctx, null, 200, 'normal', 'dua', 'maskot');
    const jumlahStroke = (c: Catatan) => c.panggil.filter((p) => p.nama === 'stroke').length;
    expect(jumlahStroke(catat)).toBe(jumlahStroke(normalMaskot.catat));
    const muka = (logo: 'maskot' | 'siluet') => {
      const x = ctxPalsu();
      gambar(x.ctx, { bunga: 'waru', rank: 7 }, 200, 'normal', 'dua', logo);
      return JSON.stringify(x.catat);
    };
    expect(muka('siluet')).toBe(muka('maskot'));
  });

  it('gambarKartuKeKanvas: punggung 46 px berisi siluet, 96 px berisi maskot', async () => {
    vi.stubGlobal('Path2D', Path2DPalsu);
    const konteks: Catatan[] = [];
    vi.stubGlobal('document', {
      createElement: () => {
        const { ctx, catat } = ctxPalsu();
        konteks.push(catat);
        return { width: 0, height: 0, style: {}, getContext: () => ctx, setAttribute: () => undefined };
      },
    });
    vi.resetModules();
    const { gambarKartuKeKanvas } = await import('../src/game/kartuGrafisGambar');
    const varian = (lebar: number) => {
      gambarKartuKeKanvas(null, lebar, 2);
      const fill = konteks[konteks.length - 1].panggil.find((p) => p.nama === 'fill' && p.arg[0] instanceof Path2DPalsu);
      return (fill!.arg[0] as Path2DPalsu).d;
    };
    expect(varian(46)).toBe(pathLogo('siluet').isi.join(''));
    expect(varian(96)).toBe(pathLogo('maskot').isi.join(''));
  });
});
