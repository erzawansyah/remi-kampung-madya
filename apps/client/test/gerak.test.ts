// @vitest-environment happy-dom
// Token gerak: durasi ikut kecepatan & gerak dikurangi, flag efek hemat, dan easing pegas.

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { pasangMatchMediaPalsu, type MediaPalsu } from './bantu';

let media: MediaPalsu;

/** Modul gerak + preferensi dari registry yang sama, segar tiap test. */
async function muat() {
  vi.resetModules();
  const pref = await import('../src/preferensi');
  const gerak = await import('../src/gerak');
  return { ...pref, ...gerak };
}

beforeEach(() => {
  localStorage.clear();
  media = pasangMatchMediaPalsu(false);
});

describe('durasi()', () => {
  it('kecepatan normal + gerak penuh: durasi dasar apa adanya', async () => {
    const { durasi, DURASI, aturPreferensi } = await muat();
    aturPreferensi({ gerak: 'penuh', kecepatan: 'normal' });
    expect(durasi(DURASI.terbang)).toBe(DURASI.terbang);
    expect(durasi(DURASI.mikro)).toBe(DURASI.mikro);
  });

  it('ikut pilihan kecepatan: santai lebih lama, cepat lebih singkat', async () => {
    const { durasi, DURASI, aturPreferensi } = await muat();
    aturPreferensi({ gerak: 'penuh', kecepatan: 'santai' });
    const santai = durasi(DURASI.terbang);
    aturPreferensi({ kecepatan: 'cepat' });
    const cepat = durasi(DURASI.terbang);
    expect(santai).toBe(Math.round(DURASI.terbang * 1.3));
    expect(cepat).toBe(Math.round(DURASI.terbang * 0.6));
    expect(cepat).toBeLessThan(DURASI.terbang);
    expect(santai).toBeGreaterThan(DURASI.terbang);
  });

  it('gerak dikurangi (pilihan atau setelan sistem) memendekkan durasi', async () => {
    const { durasi, DURASI, aturPreferensi } = await muat();
    aturPreferensi({ gerak: 'kurang', kecepatan: 'santai' });
    expect(durasi(DURASI.panggung)).toBeLessThanOrEqual(Math.round(DURASI.panggung * 0.6));

    aturPreferensi({ gerak: 'ikutSistem', kecepatan: 'normal' });
    expect(durasi(DURASI.panggung)).toBe(DURASI.panggung);
    media.ubah(true);
    expect(durasi(DURASI.panggung)).toBe(Math.round(DURASI.panggung * 0.6));
  });

  it('selalu bilangan bulat ≥ 0', async () => {
    const { durasi, aturPreferensi } = await muat();
    aturPreferensi({ gerak: 'penuh', kecepatan: 'santai' });
    expect(durasi(-50)).toBe(0);
    expect(durasi(0)).toBe(0);
    expect(Number.isInteger(durasi(333))).toBe(true);
  });
});

describe('kurangiGerak() dan efekHemat()', () => {
  it('kurangiGerak mengikuti gerakDikurangi', async () => {
    const { kurangiGerak, aturPreferensi } = await muat();
    aturPreferensi({ gerak: 'penuh' });
    expect(kurangiGerak()).toBe(false);
    aturPreferensi({ gerak: 'kurang' });
    expect(kurangiGerak()).toBe(true);
    aturPreferensi({ gerak: 'ikutSistem' });
    media.ubah(true);
    expect(kurangiGerak()).toBe(true);
  });

  it('efekHemat: pilihan hemat, atau gerak dikurangi', async () => {
    const { efekHemat, aturPreferensi } = await muat();
    aturPreferensi({ gerak: 'penuh', efek: 'lengkap' });
    expect(efekHemat()).toBe(false);
    aturPreferensi({ efek: 'hemat' });
    expect(efekHemat()).toBe(true);
    aturPreferensi({ efek: 'lengkap', gerak: 'kurang' });
    expect(efekHemat()).toBe(true);
  });
});

describe('easePegas()', () => {
  const sampel = (f: (t: number) => number, n = 2000) => Array.from({ length: n + 1 }, (_, i) => f(i / n));

  it('batas: 0 di awal, tepat 1 di akhir, dijepit di luar 0..1', async () => {
    const { easePegas } = await muat();
    const f = easePegas();
    expect(f(0)).toBe(0);
    expect(f(1)).toBe(1);
    expect(f(-0.5)).toBe(0);
    expect(f(1.5)).toBe(1);
  });

  it('nyaris kontinu di ujung: tidak ada lompatan terlihat saat tween berakhir', async () => {
    const { easePegas } = await muat();
    const f = easePegas();
    expect(Math.abs(f(0.999) - 1)).toBeLessThan(0.01);
    expect(Math.abs(f(0.001))).toBeLessThan(0.01);
  });

  it('teredam: simpangan dari 1 tidak pernah melewati selubung eksponensial', async () => {
    const { easePegas } = await muat();
    const redaman = 0.55;
    const f = easePegas(redaman);
    for (let i = 1; i < 1000; i++) {
      const t = i / 1000;
      expect(Math.abs(f(t) - 1)).toBeLessThanOrEqual(Math.exp(-redaman * 10 * t) + 1e-12);
    }
  });

  it('monoton mendekati 1: tiap puncak/lembah berikutnya lebih dekat ke 1', async () => {
    const { easePegas } = await muat();
    const v = sampel(easePegas());
    const ekstrem: number[] = [];
    for (let i = 1; i < v.length - 1; i++) {
      if ((v[i] - v[i - 1]) * (v[i + 1] - v[i]) < 0) ekstrem.push(Math.abs(v[i] - 1));
    }
    expect(ekstrem.length).toBeGreaterThan(0);
    for (let i = 1; i < ekstrem.length; i++) expect(ekstrem[i]).toBeLessThan(ekstrem[i - 1]);
    // Naik dari 0 tanpa turun dulu sebelum puncak pertama.
    const puncak = v.findIndex((x, i) => i > 0 && x < v[i - 1]);
    for (let i = 1; i < puncak; i++) expect(v[i]).toBeGreaterThanOrEqual(v[i - 1]);
  });

  it('redaman lebih besar: lewatnya (overshoot) lebih kecil', async () => {
    const { easePegas } = await muat();
    const lewat = (r: number) => Math.max(...sampel(easePegas(r))) - 1;
    expect(lewat(0.9)).toBeLessThan(lewat(0.55));
    expect(lewat(0.55)).toBeLessThan(lewat(0.3));
  });
});
