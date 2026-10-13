// @vitest-environment happy-dom
// Preferensi pemain: normalisasi nilai liar, migrasi dari remi.efek, penyimpanan, pendengar,
// atribut data-* di <html>, gerak dikurangi (matchMedia), dan skala waktu.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { pasangLocalStorageRusak, pasangMatchMediaPalsu, type MediaPalsu } from './bantu';

type ModulPreferensi = typeof import('../src/preferensi');

let media: MediaPalsu;

/** Muat ulang modul supaya cache, pendengar, dan MediaQueryList di dalamnya bersih tiap test. */
async function muat(): Promise<ModulPreferensi> {
  vi.resetModules();
  return import('../src/preferensi');
}

beforeEach(() => {
  localStorage.clear();
  const html = document.documentElement;
  for (const k of Object.keys(html.dataset)) delete html.dataset[k];
  media = pasangMatchMediaPalsu(false);
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('normalkan', () => {
  it('data kosong/rusak jadi preferensi bawaan', async () => {
    const { normalkan, PREFERENSI_BAWAAN } = await muat();
    for (const mentah of [null, undefined, 0, 'rusak', [], true]) {
      expect(normalkan(mentah)).toEqual(PREFERENSI_BAWAAN);
    }
  });

  it('nilai liar per field diganti bawaan, nilai sah dipertahankan', async () => {
    const { normalkan, PREFERENSI_BAWAAN: b } = await muat();
    const p = normalkan({
      suara: 'ya',
      volumeEfek: 5,
      musik: true,
      volumeMusik: -2,
      getar: 1,
      gerak: 'aneh',
      kecepatan: 'cepat',
      efek: 'HEMAT',
      warnaKartu: 'empat',
      ukuranTeks: null,
      tutorialSelesai: true,
      fieldAsing: 'dibuang',
    });
    // suara/getar/gerak/efek/ukuranTeks liar → bawaan; volume di luar 0..1 dijepit.
    expect(p).toEqual({
      ...b,
      volumeEfek: 1,
      musik: true,
      volumeMusik: 0,
      kecepatan: 'cepat',
      warnaKartu: 'empat',
      tutorialSelesai: true,
    });
    expect(p).not.toHaveProperty('fieldAsing');
  });

  it('volume NaN/Infinity/string jatuh ke bawaan, 0 dan 1 tetap', async () => {
    const { normalkan, PREFERENSI_BAWAAN: b } = await muat();
    expect(normalkan({ volumeEfek: Number.NaN }).volumeEfek).toBe(b.volumeEfek);
    expect(normalkan({ volumeEfek: Number.POSITIVE_INFINITY }).volumeEfek).toBe(b.volumeEfek);
    expect(normalkan({ volumeMusik: '0.5' }).volumeMusik).toBe(b.volumeMusik);
    expect(normalkan({ volumeEfek: 0, volumeMusik: 1 })).toMatchObject({ volumeEfek: 0, volumeMusik: 1 });
  });
});

describe('preferensi() membaca penyimpanan', () => {
  it('tanpa simpanan: bawaan', async () => {
    const { preferensi, PREFERENSI_BAWAAN } = await muat();
    expect(preferensi()).toEqual(PREFERENSI_BAWAAN);
  });

  it('migrasi dari kunci lama remi.efek ({suara, getar})', async () => {
    localStorage.setItem('remi.efek', JSON.stringify({ suara: false, getar: false }));
    const { preferensi, PREFERENSI_BAWAAN } = await muat();
    expect(preferensi()).toEqual({ ...PREFERENSI_BAWAAN, suara: false, getar: false });
  });

  it('kunci baru remi.preferensi menang atas kunci lama', async () => {
    localStorage.setItem('remi.efek', JSON.stringify({ suara: false, getar: false }));
    localStorage.setItem('remi.preferensi', JSON.stringify({ suara: true, getar: true, kecepatan: 'santai' }));
    const p = (await muat()).preferensi();
    expect(p).toMatchObject({ suara: true, getar: true, kecepatan: 'santai' });
  });

  it('JSON rusak tidak bikin macet: kembali ke bawaan', async () => {
    localStorage.setItem('remi.preferensi', '{bukan json');
    const { preferensi, PREFERENSI_BAWAAN } = await muat();
    expect(preferensi()).toEqual(PREFERENSI_BAWAAN);
  });

  it('localStorage melempar error (mode privat): tetap jalan dengan bawaan', async () => {
    pasangLocalStorageRusak();
    const { preferensi, aturPreferensi, PREFERENSI_BAWAAN } = await muat();
    expect(preferensi()).toEqual(PREFERENSI_BAWAAN);
    // Perubahan tetap berlaku di memori walau tidak tersimpan.
    expect(aturPreferensi({ suara: false }).suara).toBe(false);
    expect(preferensi().suara).toBe(false);
  });

  it('hasil di-cache: perubahan localStorage dari luar baru terbaca setelah _setelUlangCache', async () => {
    const { preferensi, _setelUlangCache } = await muat();
    expect(preferensi().musik).toBe(false);
    localStorage.setItem('remi.preferensi', JSON.stringify({ musik: true }));
    expect(preferensi().musik).toBe(false);
    _setelUlangCache();
    expect(preferensi().musik).toBe(true);
  });
});

describe('aturPreferensi', () => {
  it('menggabung sebagian, menormalkan, lalu menyimpan ke remi.preferensi', async () => {
    const { aturPreferensi, PREFERENSI_BAWAAN } = await muat();
    const hasil = aturPreferensi({ kecepatan: 'cepat', volumeEfek: 3 });
    expect(hasil).toEqual({ ...PREFERENSI_BAWAAN, kecepatan: 'cepat', volumeEfek: 1 });
    expect(JSON.parse(localStorage.getItem('remi.preferensi')!)).toEqual(hasil);
  });

  it('simpanan tahan muat ulang halaman (modul baru membaca nilai yang sama)', async () => {
    (await muat()).aturPreferensi({ warnaKartu: 'empat', tutorialSelesai: true });
    const baru = await muat();
    expect(baru.preferensi()).toMatchObject({ warnaKartu: 'empat', tutorialSelesai: true });
  });

  it('memanggil pendengar dengan preferensi baru; berhenti setelah dilepas', async () => {
    const { aturPreferensi, saatPreferensiBerubah } = await muat();
    const cb = vi.fn();
    const lepas = saatPreferensiBerubah(cb);
    aturPreferensi({ musik: true });
    expect(cb).toHaveBeenCalledTimes(1);
    expect(cb.mock.calls[0][0]).toMatchObject({ musik: true });
    lepas();
    aturPreferensi({ musik: false });
    expect(cb).toHaveBeenCalledTimes(1);
  });

  it('pendengar yang melempar error tidak menghentikan pendengar lain', async () => {
    const { aturPreferensi, saatPreferensiBerubah } = await muat();
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const kedua = vi.fn();
    saatPreferensiBerubah(() => {
      throw new Error('pendengar rusak');
    });
    saatPreferensiBerubah(kedua);
    expect(() => aturPreferensi({ getar: false })).not.toThrow();
    expect(kedua).toHaveBeenCalledTimes(1);
  });

  it('menulis atribut data-* di <html>', async () => {
    const { aturPreferensi } = await muat();
    aturPreferensi({ gerak: 'kurang', efek: 'hemat', warnaKartu: 'empat', ukuranTeks: 'besar' });
    const ds = document.documentElement.dataset;
    expect(ds.gerak).toBe('kurang');
    expect(ds.efek).toBe('hemat');
    expect(ds.warnaKartu).toBe('empat');
    expect(ds.teks).toBe('besar');
    expect(document.documentElement.getAttribute('data-warna-kartu')).toBe('empat');

    aturPreferensi({ gerak: 'penuh', efek: 'lengkap', warnaKartu: 'dua', ukuranTeks: 'normal' });
    expect(ds).toMatchObject({ gerak: 'penuh', efek: 'lengkap', warnaKartu: 'dua', teks: 'normal' });
  });
});

describe('gerakDikurangi (prefers-reduced-motion di-mock)', () => {
  it('pilihan pemain menang atas setelan sistem', async () => {
    const { gerakDikurangi, PREFERENSI_BAWAAN: b } = await muat();
    media.ubah(true);
    expect(gerakDikurangi({ ...b, gerak: 'penuh' })).toBe(false);
    media.ubah(false);
    expect(gerakDikurangi({ ...b, gerak: 'kurang' })).toBe(true);
  });

  it('ikutSistem mengikuti matchMedia', async () => {
    const { gerakDikurangi, PREFERENSI_BAWAAN: b } = await muat();
    const p = { ...b, gerak: 'ikutSistem' as const };
    expect(gerakDikurangi(p)).toBe(false);
    media.ubah(true);
    expect(gerakDikurangi(p)).toBe(true);
  });

  it('matchMedia tidak tersedia/melempar: dianggap tidak minta kurang gerak', async () => {
    window.matchMedia = (() => {
      throw new Error('tidak didukung');
    }) as unknown as typeof window.matchMedia;
    const { gerakDikurangi, PREFERENSI_BAWAAN: b } = await muat();
    expect(gerakDikurangi({ ...b, gerak: 'ikutSistem' })).toBe(false);
  });

  it('pasangPreferensi: perubahan setelan sistem memperbarui data-gerak dan mengabari pendengar', async () => {
    const { pasangPreferensi, saatPreferensiBerubah } = await muat();
    const cb = vi.fn();
    saatPreferensiBerubah(cb);
    pasangPreferensi();
    expect(document.documentElement.dataset.gerak).toBe('penuh');
    expect(media.jumlahPendengar()).toBe(1);
    media.ubah(true);
    expect(document.documentElement.dataset.gerak).toBe('kurang');
    expect(cb).toHaveBeenCalledTimes(1);
  });
});

describe('skalaWaktu', () => {
  it('pengali per kecepatan', async () => {
    const { skalaWaktu, PREFERENSI_BAWAAN: b } = await muat();
    const penuh = { ...b, gerak: 'penuh' as const };
    expect(skalaWaktu({ ...penuh, kecepatan: 'santai' })).toBe(1.3);
    expect(skalaWaktu({ ...penuh, kecepatan: 'normal' })).toBe(1);
    expect(skalaWaktu({ ...penuh, kecepatan: 'cepat' })).toBe(0.6);
  });

  it('gerak dikurangi memendekkan (tidak pernah memperlambat)', async () => {
    const { skalaWaktu, PREFERENSI_BAWAAN: b } = await muat();
    const kurang = { ...b, gerak: 'kurang' as const };
    for (const kecepatan of ['santai', 'normal', 'cepat'] as const) {
      const s = skalaWaktu({ ...kurang, kecepatan });
      expect(s).toBeLessThanOrEqual(0.6);
      expect(s).toBeLessThanOrEqual(skalaWaktu({ ...kurang, kecepatan, gerak: 'penuh' }));
    }
  });

  it('tanpa argumen memakai preferensi tersimpan', async () => {
    const { skalaWaktu, aturPreferensi } = await muat();
    aturPreferensi({ gerak: 'penuh', kecepatan: 'santai' });
    expect(skalaWaktu()).toBe(1.3);
  });
});
