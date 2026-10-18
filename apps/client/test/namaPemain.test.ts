// Aturan nama pemain (keputusan #49) sebagai fungsi murni.
import { describe, expect, it } from 'vitest';
import { JEDA_GANTI_NAMA_MS, namaTerkunciSampai, simpanNamaBaru } from '../src/namaPemain';

const T = 1_800_000_000_000;

describe('namaPemain', () => {
  it('isi nama pertama kali tanpa jeda; ganti nama memasang jeda', () => {
    expect(simpanNamaBaru({ nama: '', diganti: null }, 'Budi', T)).toEqual({ nama: 'Budi', diganti: null });
    expect(simpanNamaBaru({ nama: 'Budi', diganti: null }, 'Joko', T)).toEqual({ nama: 'Joko', diganti: T });
    expect(simpanNamaBaru({ nama: 'Budi', diganti: 5 }, 'Budi', T)).toEqual({ nama: 'Budi', diganti: 5 });
  });

  it('terkunci tepat seminggu sesudah diganti', () => {
    const k = { nama: 'Joko', diganti: T };
    expect(namaTerkunciSampai(k, T + 1)).toBe(T + JEDA_GANTI_NAMA_MS);
    expect(namaTerkunciSampai(k, T + JEDA_GANTI_NAMA_MS)).toBeNull();
    expect(namaTerkunciSampai({ nama: 'Joko', diganti: null }, T)).toBeNull();
    expect(namaTerkunciSampai({ nama: '', diganti: T }, T)).toBeNull();
  });

  it('jam HP mundur jauh: tidak terkunci selamanya', () => {
    expect(namaTerkunciSampai({ nama: 'Joko', diganti: T + 30 * JEDA_GANTI_NAMA_MS }, T)).toBeNull();
  });
});
