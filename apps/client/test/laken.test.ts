// @vitest-environment happy-dom
// Laken meja kompetisi (#51 versi 2, game/warnaMeja.ts): atribut di <html> dipasang/dilepas, pendengar
// (MejaScene) dikabari hanya saat berganti, dan palet kanvas membaca token yang sedang berlaku.

import { afterEach, describe, expect, it, vi } from 'vitest';
import { ATRIBUT_LAKEN, aturLaken, bacaPalet, lakenSekarang, saatLakenBerubah } from '../src/game/warnaMeja';

afterEach(() => {
  aturLaken('biasa');
  document.documentElement.removeAttribute('style');
});

describe('aturLaken', () => {
  it('memasang dan melepas atribut di <html>; pendengar dikabari sekali per pergantian', () => {
    const f = vi.fn();
    const lepas = saatLakenBerubah(f);
    expect(lakenSekarang()).toBe('biasa');
    aturLaken('kompetisi');
    expect(document.documentElement.getAttribute(ATRIBUT_LAKEN)).toBe('kompetisi');
    expect(lakenSekarang()).toBe('kompetisi');
    // Sama dengan yang sedang berlaku: tidak ada kabar.
    aturLaken('kompetisi');
    expect(f).toHaveBeenCalledTimes(1);
    aturLaken('biasa');
    expect(document.documentElement.hasAttribute(ATRIBUT_LAKEN)).toBe(false);
    expect(f).toHaveBeenCalledTimes(2);
    lepas();
    aturLaken('kompetisi');
    expect(f).toHaveBeenCalledTimes(2);
  });

  it('palet kanvas membaca token yang berlaku saat dibaca (mis. --laken-pekat milik laken kompetisi)', () => {
    const awal = bacaPalet().panel;
    document.documentElement.style.setProperty('--laken-pekat', '#081a33');
    expect(bacaPalet().panel).toBe(0x081a33);
    expect(awal).not.toBe(0x081a33);
  });
});
