// Nama pemain dari jaringan: karakter kontrol/format (termasuk pembalik arah teks & zero-width)
// dibuang, dinormalisasi NFKC, dipotong 16 karakter tanpa membelah emoji.

import { describe, expect, it } from 'vitest';
import { rapikanNama } from '../src/validasi.js';

describe('rapikanNama', () => {
  it('nama biasa tidak berubah', () => {
    for (const n of ['Budi', 'Pak Seng', 'Mbak Yu 2', 'Siti Aminah']) expect(rapikanNama(n)).toBe(n);
  });

  it('spasi dirapikan dan dipangkas, < > dibuang (perilaku lama)', () => {
    expect(rapikanNama('  Pak   Seng ')).toBe('Pak Seng');
    expect(rapikanNama('<b>x</b>')).toBe('bx/b');
    expect(rapikanNama('a\tb\nc')).toBe('abc');
  });

  it('pembalik arah teks (bidi override/isolate) dibuang', () => {
    expect(rapikanNama('Budi‮gnirts')).toBe('Budignirts');
    for (const k of ['‪', '‫', '‬', '‭', '‮', '⁦', '⁧', '⁨', '⁩', '‎', '‏']) {
      expect(rapikanNama(`A${k}B`)).toBe('AB');
    }
  });

  it('zero-width dan BOM dibuang', () => {
    expect(rapikanNama('Bu​di‌‍﻿⁠')).toBe('Budi');
  });

  it('karakter kontrol C0/C1 dan DEL dibuang', () => {
    expect(rapikanNama('B\u0000u\u0007d\u007Fi\u0085\u009B')).toBe('Budi');
  });

  it('normalisasi NFKC: huruf lebar penuh & ligatur jadi bentuk biasa', () => {
    expect(rapikanNama('Ｂｕｄｉ')).toBe('Budi');
    expect(rapikanNama('ﬁtri')).toBe('fitri');
    // e + aksen gabung → é satu karakter.
    expect(rapikanNama('René')).toBe('René');
  });

  it('nama yang isinya hanya karakter tak terlihat jatuh ke "Pemain"', () => {
    for (const n of ['', '   ', '​​', '‮', 'ㅤㅤ', '⠀', 'ᅟ', '<>', '\u0000']) {
      expect(rapikanNama(n)).toBe('Pemain');
    }
  });

  it('maksimal 16 karakter; emoji tidak terbelah', () => {
    expect(rapikanNama('A'.repeat(40))).toBe('A'.repeat(16));
    expect(rapikanNama('\u{1F600}'.repeat(20))).toBe('\u{1F600}'.repeat(16));
    // Potongan yang berakhir spasi ikut dipangkas.
    expect(rapikanNama('123456789012345 X')).toBe('123456789012345');
  });

  it('surrogate yatim dibuang', () => {
    const hasil = rapikanNama('Bu\uD800di\uDC00');
    expect(hasil).toBe('Budi');
  });
});
