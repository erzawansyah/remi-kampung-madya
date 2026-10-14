// Label versi (versi.ts). Konstanta build biasanya disuntik Vite lewat `define`;
// di test diganti global supaya modulnya bisa dimuat.

import { afterEach, describe, expect, it, vi } from 'vitest';

async function muatDengan(versi: string, sha: string) {
  vi.stubGlobal('__VERSI_APP__', versi);
  vi.stubGlobal('__BUILD_SHA__', sha);
  vi.stubGlobal('__BUILD_WAKTU__', '2026-10-12T00:00:00.000Z');
  vi.resetModules();
  return import('../src/versi');
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('labelVersi', () => {
  it('menyertakan commit pendek kalau ada', async () => {
    const { labelVersi, VERSI, BUILD_SHA } = await muatDengan('0.2.0', 'a1b2c3d');
    expect(VERSI).toBe('0.2.0');
    expect(BUILD_SHA).toBe('a1b2c3d');
    expect(labelVersi()).toBe('v0.2.0 (a1b2c3d)');
  });

  it('build tanpa commit (hash isi sumber "h-…"): ditampilkan apa adanya', async () => {
    expect((await muatDengan('0.2.0', 'h-1a2b3c4')).labelVersi()).toBe('v0.2.0 (h-1a2b3c4)');
  });

  it('dev server (sha "dev") atau kosong: versi saja', async () => {
    expect((await muatDengan('0.2.0', 'dev')).labelVersi()).toBe('v0.2.0');
    expect((await muatDengan('0.2.0', '')).labelVersi()).toBe('v0.2.0');
  });
});
