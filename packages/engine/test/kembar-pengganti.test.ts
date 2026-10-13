// Keputusan pemilik (13 Okt 2026, butir #32 di README): di permainan 2 deck, kartu kembar fisik
// (misalnya 5 Love dari deck pertama dan kedua) BOLEH ada di seri yang sama, asal salah satunya
// dipakai sebagai joker pengganti untuk angka lain. Yang tetap dilarang: dua kartu yang mewakili
// angka yang sama di satu seri.

import { describe, expect, it } from 'vitest';
import { AturanError, nilaiKartuJadi, terapkan, terapkanAksi, validasiKartuJadi, type KonteksJoker } from '../src/index.js';
import { ctx, id, item, skenario, spek, type ItemTeks } from './bantu.js';

function sah(c: KonteksJoker, ...items: ItemTeks[]) {
  return validasiKartuJadi(items.map(item), c);
}

function ditolak(c: KonteksJoker, ...items: ItemTeks[]): string {
  try {
    validasiKartuJadi(items.map(item), c);
  } catch (e) {
    if (e instanceof AturanError) return e.kode;
    throw e;
  }
  throw new Error('harusnya ditolak');
}

const joker5 = ctx(5);

describe('2 deck: kartu kembar sebagai joker pengganti di seri yang sama (#32)', () => {
  it('sah: 4♥ 5♥ 6♥ + 5♥ deck kedua sebagai 7♥ (joker 5)', () => {
    const h = sah(joker5, '4 love', '5 love', '6 love', ['5 love#1', '7 love']);
    expect(h.jenis).toBe('seri');
    expect(h.kartu.map((d) => d.sebagai.rank)).toEqual([4, 5, 6, 7]);
    const ketujuh = h.kartu[3];
    expect(ketujuh.kartu.id).toBe(id('5 love#1'));
    expect(ketujuh.pengganti).toBe(true);
    // Kembarannya tetap kartu biasa (dipakai sebagai kartu aslinya).
    expect(h.kartu[1].kartu.id).toBe(id('5 love'));
    expect(h.kartu[1].pengganti).toBe(false);
    // Joker pengganti bernilai kartu yang diwakili: 4 kartu angka × 5.
    expect(nilaiKartuJadi(h)).toBe(20);
  });

  it('sah juga kalau kembarannya menggantikan angka di bawah: 5♥ deck kedua sebagai 3♥', () => {
    const h = sah(joker5, ['5 love#1', '3 love'], '4 love', '5 love', '6 love');
    expect(h.kartu.map((d) => d.sebagai.rank)).toEqual([3, 4, 5, 6]);
    expect(h.kartu[0].kartu.id).toBe(id('5 love#1'));
    expect(h.kartu[0].pengganti).toBe(true);
  });

  it('sah: kartu deck pertama yang jadi pengganti, kembaran deck kedua sebagai aslinya', () => {
    const h = sah(joker5, '3 love', ['5 love', '4 love'], '5 love#1');
    expect(h.kartu.map((d) => d.sebagai.rank)).toEqual([3, 4, 5]);
    expect(h.kartu[1].pengganti).toBe(true);
    expect(h.kartu[2].pengganti).toBe(false);
  });

  it('tidak sah: dua kartu kembar sama-sama mewakili 5♥', () => {
    expect(ditolak(joker5, '4 love', '5 love', '5 love#1', '6 love')).toBe('KARTU_JADI_TIDAK_SAH');
    expect(ditolak(joker5, '4 love', '5 love', ['5 love#1', '5 love'], '6 love')).toBe('KARTU_JADI_TIDAK_SAH');
  });

  it('tidak sah: kembaran jadi pengganti untuk angka yang sudah ada di seri', () => {
    expect(ditolak(joker5, '4 love', '5 love', ['5 love#1', '4 love'])).toBe('KARTU_JADI_TIDAK_SAH');
    expect(ditolak(joker5, '4 love', '5 love', '6 love', ['5 love#1', '6 love'])).toBe('KARTU_JADI_TIDAK_SAH');
  });

  it('tanpa angka joker 5, kembar 5♥ tetap tidak bisa di seri yang sama', () => {
    const joker9 = ctx(9);
    expect(ditolak(joker9, '4 love', '5 love', '5 love#1', '6 love')).toBe('KARTU_JADI_TIDAK_SAH');
  });

  it('lewat mesin: 5 pemain (2 deck) menurunkan seri dengan kembaran sebagai joker pengganti', () => {
    const s0 = skenario({
      rankJoker: 5,
      giliran: 0,
      tangan: [
        ['4 love', '5 love', '6 love', '5 love#1', 'K waru', 'Q kriting'],
        ['2 waru', '3 waru'],
        ['2 kriting', '3 kriting'],
        ['2 wajik', '3 wajik'],
        ['8 waru', '9 waru'],
      ],
      deck: ['J waru', '10 kriting', '9 kriting'],
    });
    expect(s0.putaran!.deck.length).toBe(3);
    const s1 = terapkan(s0, { jenis: 'ambilDeck', pemain: 0 });
    const h = terapkanAksi(s1, {
      jenis: 'turunkan',
      pemain: 0,
      kartuJadi: [spek('4 love', '5 love', '6 love', ['5 love#1', '7 love'])],
    });
    expect(h.ok).toBe(true);
    if (!h.ok) return;
    const kj = h.state.putaran!.kartuJadi[0];
    expect(kj).toHaveLength(1);
    expect(kj[0].kartu.map((d) => d.sebagai.rank)).toEqual([4, 5, 6, 7]);
    expect(kj[0].kartu.find((d) => d.kartu.id === id('5 love#1'))?.pengganti).toBe(true);
    // Input tidak berubah.
    expect(s1.putaran!.kartuJadi[0]).toHaveLength(0);
  });

  it('lewat mesin: dua kembar sebagai 5♥ ditolak dan state tidak berubah', () => {
    const s0 = skenario({
      rankJoker: 5,
      giliran: 0,
      tangan: [
        ['4 love', '5 love', '6 love', '5 love#1', 'K waru', 'Q kriting'],
        ['2 waru', '3 waru'],
        ['2 kriting', '3 kriting'],
        ['2 wajik', '3 wajik'],
        ['8 waru', '9 waru'],
      ],
      deck: ['J waru', '10 kriting', '9 kriting'],
    });
    const s1 = terapkan(s0, { jenis: 'ambilDeck', pemain: 0 });
    const sebelum = JSON.stringify(s1);
    const h = terapkanAksi(s1, {
      jenis: 'turunkan',
      pemain: 0,
      kartuJadi: [spek('4 love', '5 love', '5 love#1', '6 love')],
    });
    expect(h.ok).toBe(false);
    expect(!h.ok && h.error.kode).toBe('KARTU_JADI_TIDAK_SAH');
    expect(JSON.stringify(s1)).toBe(sebelum);
  });
});
