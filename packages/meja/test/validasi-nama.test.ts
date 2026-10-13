// Nama pemain dari jaringan: karakter kontrol/format (termasuk pembalik arah teks & zero-width)
// dibuang, dinormalisasi NFKC, dipotong 16 huruf tanpa membelah emoji. ZWJ/ZWNJ dan karakter tag
// yang memang bagian dari emoji/aksara dipertahankan; nama tanpa karakter terlihat jadi "Pemain".

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

  describe('ZWJ/ZWNJ dan karakter tag yang memang bagian dari nama', () => {
    it('emoji ZWJ tetap utuh', () => {
      for (const n of [
        '\u{1F468}‍\u{1F469}‍\u{1F467} Keluarga', // 👨‍👩‍👧
        '\u{1F3F3}️‍\u{1F308}', // 🏳️‍🌈
        '❤️‍\u{1F525}', // ❤️‍🔥
        '\u{1F9D1}\u{1F3FD}‍\u{1F4BB} Dev', // 🧑🏽‍💻
        '\u{1F469}‍\u{1F9B0}', // 👩‍🦰
        '❤️ Budi', // ❤️ (variation selector)
      ]) {
        expect(rapikanNama(n)).toBe(n);
      }
    });

    it('bendera bertag (Skotlandia) tetap utuh; tag lepas tetap dibuang', () => {
      const skotlandia = '\u{1F3F4}\u{E0067}\u{E0062}\u{E0073}\u{E0063}\u{E0074}\u{E007F}';
      expect(rapikanNama(skotlandia)).toBe(skotlandia);
      expect(rapikanNama(`Abang ${skotlandia}`)).toBe(`Abang ${skotlandia}`);
      // Tag tanpa bendera hitam, atau tanpa pembatal U+E007F: dibuang.
      expect(rapikanNama('Bu\u{E0067}\u{E0062}di')).toBe('Budi');
      expect(rapikanNama('\u{1F3F4}\u{E0067}\u{E0062}')).toBe('\u{1F3F4}');
      expect(rapikanNama('Budi\u{E007F}')).toBe('Budi');
    });

    it('ZWNJ/ZWJ di aksara yang membutuhkannya tetap ada', () => {
      for (const n of [
        'می‌خواهم', // Persia: می‌خواهم
        'क्‍ष', // Devanagari: क्‍ष
        'क्‌ष', // Devanagari dengan ZWNJ
        'ශ්‍රී', // Sinhala: ශ්‍රී
      ]) {
        expect(rapikanNama(n)).toBe(n);
      }
    });

    it('penggabung di Latin, di ujung, atau di antara emoji dan huruf tetap dibuang', () => {
      expect(rapikanNama('Bu‍di')).toBe('Budi');
      expect(rapikanNama('Bu‌di')).toBe('Budi');
      expect(rapikanNama('‍Budi‍')).toBe('Budi');
      expect(rapikanNama('\u{1F600}‍Budi')).toBe('\u{1F600}Budi');
      // ZWNJ tidak dipakai di emoji.
      expect(rapikanNama('\u{1F468}‌\u{1F469}')).toBe('\u{1F468}\u{1F469}');
      // Zero-width space di antara emoji dan ZWJ: ZWSP dibuang, ZWJ yang mengapit emoji tetap.
      expect(rapikanNama('\u{1F468}​‍\u{1F469}')).toBe('\u{1F468}‍\u{1F469}');
    });

    it('pembalik arah, zero-width space, dan BOM tetap dibuang di nama berisi emoji/aksara', () => {
      expect(rapikanNama('‮\u{1F468}‍\u{1F469}​﻿')).toBe('\u{1F468}‍\u{1F469}');
      expect(rapikanNama('⁧می‌خ⁩')).toBe('می‌خ');
    });
  });

  it('jamo kompatibilitas Korea tidak diubah NFKC (ㅋㅋㅋ tetap ㅋㅋㅋ)', () => {
    expect(rapikanNama('ㅋㅋㅋ')).toBe('ㅋㅋㅋ');
    expect(rapikanNama('Budi ㅋㅋ')).toBe('Budi ㅋㅋ');
    // Hangul suku kata dan lebar penuh tetap seperti sebelumnya.
    expect(rapikanNama('한글')).toBe('한글');
    expect(rapikanNama('Ｂㅋ')).toBe('Bㅋ');
  });

  it('nama yang isinya hanya karakter tak terlihat non-Cf jatuh ke "Pemain"', () => {
    for (const n of [
      '͏͏͏', // combining grapheme joiner
      '️️', // variation selector
      '឴឵', // vokal inheren Khmer
      '᠋᠌᠍᠏', // pemilih varian Mongolia
      'ㅤᅟᅠﾠ', // Hangul filler
      '⠀⠀', // braille kosong
      '\u{E0100}', // variation selector tambahan
      '‍‌', // penggabung saja
      '\u{E0067}\u{E0062}\u{E007F}', // tag saja
      ' ͏ ️ ',
    ]) {
      expect(rapikanNama(n), JSON.stringify(n)).toBe('Pemain');
    }
  });

  it('pemotongan 16 huruf tidak membelah emoji ZWJ, bendera bertag, atau aksara', () => {
    const keluarga = '\u{1F468}‍\u{1F469}‍\u{1F467}';
    expect(rapikanNama(keluarga.repeat(20))).toBe(keluarga.repeat(9)); // 9 × 5 code point ≤ 48
    const skotlandia = '\u{1F3F4}\u{E0067}\u{E0062}\u{E0073}\u{E0063}\u{E0074}\u{E007F}';
    expect(rapikanNama(skotlandia.repeat(10))).toBe(skotlandia.repeat(6));
    expect(rapikanNama('A'.repeat(15) + keluarga)).toBe('A'.repeat(15) + keluarga);
    // Huruf + tanda gabung bertumpuk ("zalgo"): tanda per huruf dibatasi.
    const zalgo = rapikanNama('a' + '́'.repeat(100));
    expect(Array.from(zalgo).length).toBeLessThanOrEqual(9);
    expect(zalgo.startsWith('á')).toBe(true); // a + aksen pertama digabung NFKC jadi á
  });
});
