import { describe, expect, it } from 'vitest';
import {
  AturanError,
  cariKandidatKartuJadi,
  nilaiKartuJadi,
  nilaiKartuTangan,
  opsiPeranJoker,
  validasiKartuJadi,
  type KonteksJoker,
} from '../src/index.js';
import { ctx, item, kartu, kartuSemua, type ItemTeks } from './bantu.js';

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

// Angka joker yang tidak muncul di kombinasi uji, supaya tidak mengganggu.
const tanpaJoker = ctx(9);

describe('seri (7.1)', () => {
  it('menerima contoh sah', () => {
    expect(sah(tanpaJoker, '4 love', '5 love', '6 love').jenis).toBe('seri');
    expect(sah(tanpaJoker, 'J kriting', 'Q kriting', 'K kriting').jenis).toBe('seri');
    expect(sah(tanpaJoker, '2 wajik', '3 wajik', '4 wajik', '5 wajik', '6 wajik').kartu).toHaveLength(5);
  });

  it('urutan masukan bebas, hasil terurut', () => {
    const h = sah(tanpaJoker, '6 love', '4 love', '5 love');
    expect(h.kartu.map((d) => d.sebagai.rank)).toEqual([4, 5, 6]);
  });

  it('seri angka maksimal 2 s/d 10 (9 kartu)', () => {
    const c = ctx(1);
    const items = [2, 3, 4, 5, 6, 7, 8, 9, 10].map((r) => `${r} waru`);
    expect(sah(c, ...items).kartu).toHaveLength(9);
  });

  it('minimal 3 kartu', () => {
    expect(ditolak(tanpaJoker, '4 love', '5 love')).toBe('KARTU_JADI_TIDAK_SAH');
  });

  it('harus satu bunga dan berurutan', () => {
    expect(ditolak(tanpaJoker, '4 love', '5 wajik', '6 love')).toBe('KARTU_JADI_TIDAK_SAH');
    expect(ditolak(tanpaJoker, '4 love', '5 love', '7 love')).toBe('KARTU_JADI_TIDAK_SAH');
  });

  it('angka dan Londo tidak bisa disambung', () => {
    expect(ditolak(tanpaJoker, '10 love', 'J love', 'Q love')).toBe('KARTU_JADI_TIDAK_SAH');
    expect(ditolak(tanpaJoker, '8 love', '10 love', 'J love')).toBe('KARTU_JADI_TIDAK_SAH');
  });

  it('As tidak bisa masuk seri', () => {
    expect(ditolak(tanpaJoker, 'As love', '2 love', '3 love')).toBe('KARTU_JADI_TIDAK_SAH');
    expect(ditolak(tanpaJoker, 'Q love', 'K love', 'As love')).toBe('KARTU_JADI_TIDAK_SAH');
  });

  it('dua kartu yang sama (2 deck) tidak bisa dalam satu seri', () => {
    expect(ditolak(tanpaJoker, '5 love', '5 love#1', '6 love')).toBe('KARTU_JADI_TIDAK_SAH');
  });

  it('kembar selain As tidak sah: tiga 7 beda bunga', () => {
    expect(ditolak(tanpaJoker, '7 love', '7 wajik', '7 waru')).toBe('KARTU_JADI_TIDAK_SAH');
  });
});

describe('kembar As (7.2)', () => {
  it('4 As satu set bunga sah', () => {
    expect(sah(tanpaJoker, 'As waru', 'As love', 'As kriting', 'As wajik').jenis).toBe('kembarAs');
  });

  it('3 As beda bunga sah sebagai kombinasi', () => {
    expect(sah(tanpaJoker, 'As waru', 'As love', 'As kriting').jenis).toBe('kembarAs');
  });

  it('bunga harus beda semua (2 deck)', () => {
    expect(ditolak(tanpaJoker, 'As love', 'As love#1', 'As kriting')).toBe('KARTU_JADI_TIDAK_SAH');
    expect(ditolak(tanpaJoker, 'As love', 'As love#1', 'As kriting', 'As waru')).toBe('KARTU_JADI_TIDAK_SAH');
  });

  it('maksimal 4 kartu', () => {
    expect(
      ditolak(tanpaJoker, 'As love', 'As love#1', 'As kriting', 'As waru', 'As wajik'),
    ).toBe('KARTU_JADI_TIDAK_SAH');
  });

  it('nilai 3 As = 45', () => {
    expect(nilaiKartuJadi(sah(tanpaJoker, 'As waru', 'As love', 'As kriting'))).toBe(45);
  });
});

describe('joker (7.3 dan aturan selang-seling)', () => {
  const joker7 = ctx(7);

  it('contoh 1: 2, 3, 7 sebagai 2, 3, 4 → sah', () => {
    const h = sah(joker7, '2 love', '3 love', ['7 waru', '4 love']);
    expect(h.kartu.map((d) => d.pengganti)).toEqual([false, false, true]);
  });

  it('contoh 2: 2, 3, 7, 5 sebagai 2-5 → sah', () => {
    sah(joker7, '2 love', '3 love', ['7 waru', '4 love'], '5 love');
  });

  it('contoh 3: 7, 7, 4, 5 sebagai 2-5 → tidak sah (joker dempet)', () => {
    expect(ditolak(joker7, ['7 waru', '2 love'], ['7 wajik', '3 love'], '4 love', '5 love')).toBe('JOKER_TIDAK_SAH');
  });

  it('contoh 4: 2, 7, 4, 7 sebagai 2-5 → sah (selang-seling)', () => {
    sah(joker7, '2 love', ['7 waru', '3 love'], '4 love', ['7 wajik', '5 love']);
  });

  it('contoh 5: 7, 3, 7, 5, 7 sebagai 2-6 → tidak sah (joker lebih banyak)', () => {
    expect(
      ditolak(joker7, ['7 waru', '2 love'], '3 love', ['7 wajik', '4 love'], '5 love', ['7 kriting', '6 love']),
    ).toBe('JOKER_TIDAK_SAH');
  });

  it('joker tidak bisa menggantikan Londo, walaupun jokernya Londo', () => {
    const jokerJ = ctx(11);
    expect(ditolak(jokerJ, ['J waru', 'J love'], 'Q love', 'K love')).toBe('JOKER_TIDAK_SAH');
    expect(ditolak(joker7, ['7 waru', 'J love'], 'Q love', 'K love')).toBe('JOKER_TIDAK_SAH');
  });

  it('joker Londo tetap bisa dipakai sebagai kartu aslinya', () => {
    sah(ctx(11), 'J love', 'Q love', 'K love');
  });

  it('joker tidak bisa menggantikan As', () => {
    expect(ditolak(joker7, ['7 love', 'As love'], 'As waru', 'As kriting')).toBe('JOKER_TIDAK_SAH');
  });

  it('angka joker As: keempat As tetap bisa jadi kembar, dan As bisa jadi pengganti angka', () => {
    const jokerAs = ctx(1);
    expect(sah(jokerAs, 'As waru', 'As love', 'As kriting', 'As wajik').jenis).toBe('kembarAs');
    const h = sah(jokerAs, '4 love', ['As waru', '5 love'], '6 love');
    expect(nilaiKartuJadi(h)).toBe(15);
  });

  it('joker 7: 7 Love tetap bisa dipakai di 6-7-8 Love sebagai kartu aslinya', () => {
    const h = sah(joker7, '6 love', '7 love', '8 love');
    expect(h.kartu.every((d) => !d.pengganti)).toBe(true);
  });

  it('kartu bukan joker tidak bisa menggantikan kartu lain', () => {
    expect(ditolak(joker7, '2 love', '3 love', ['8 waru', '4 love'])).toBe('JOKER_TIDAK_SAH');
  });

  it('joker yang sudah dibuang (mati) tidak bisa jadi pengganti', () => {
    const c = ctx(7, [kartu('7 waru').id]);
    expect(ditolak(c, '2 love', '3 love', ['7 waru', '4 love'])).toBe('JOKER_TIDAK_SAH');
  });

  it('nilai: joker pengganti = nilai kartu yang digantikan; di tangan 25; joker mati 5', () => {
    expect(nilaiKartuJadi(sah(ctx(13), '2 love', '3 love', ['K waru', '4 love']))).toBe(15);
    expect(nilaiKartuTangan(kartu('7 waru'), joker7)).toBe(25);
    expect(nilaiKartuTangan(kartu('7 waru'), ctx(7, [kartu('7 waru').id]))).toBe(5);
    expect(nilaiKartuTangan(kartu('As waru'), ctx(1))).toBe(25);
  });
});

describe('opsi peran joker untuk UI', () => {
  it('ambigu: 7-8-9 Love dengan joker 7 bisa 7-8-9 atau 8-9-10', () => {
    const opsi = opsiPeranJoker(kartuSemua('7 love', '8 love', '9 love'), ctx(7));
    expect(opsi).toHaveLength(2);
  });

  it('tidak ambigu: 2, 3 Love + joker hanya bisa jadi 4', () => {
    const opsi = opsiPeranJoker(kartuSemua('2 love', '3 love', '7 waru'), ctx(7));
    expect(opsi).toHaveLength(1);
    expect(opsi[0].kartu[2].sebagai).toEqual({ rank: 4, bunga: 'love' });
  });

  it('joker 2: 2 Love jadi kartu asli, 2 Kriting menggantikan 3 Love', () => {
    const opsi = opsiPeranJoker(kartuSemua('2 love', '2 kriting', '4 love'), ctx(2));
    expect(opsi).toHaveLength(1);
    expect(opsi[0].kartu.map((d) => [d.kartu.id, d.sebagai.rank, d.pengganti])).toEqual([
      [kartu('2 love').id, 2, false],
      [kartu('2 kriting').id, 3, true],
      [kartu('4 love').id, 4, false],
    ]);
  });

  it('joker 2 yang sudah mati (pernah dibuang) tidak bisa menggantikan: 2 Love + 2 Kriting mati + 4 Love tidak sah', () => {
    expect(opsiPeranJoker(kartuSemua('2 love', '2 kriting', '4 love'), ctx(2, [kartu('2 kriting').id]))).toHaveLength(0);
  });

  it('tidak ada tafsiran sah → kosong', () => {
    expect(opsiPeranJoker(kartuSemua('2 love', '7 waru', '7 wajik'), ctx(7))).toHaveLength(0);
  });
});

describe('generator kandidat (untuk bot)', () => {
  it('semua kandidat sah', () => {
    const c = ctx(7);
    const kartuTangan = kartuSemua(
      '2 love', '3 love', '5 love', '7 waru', 'J kriting', 'Q kriting', 'K kriting',
      'As waru', 'As love', 'As wajik', '9 wajik', '10 wajik',
    );
    const kandidat = cariKandidatKartuJadi(kartuTangan, c);
    expect(kandidat.length).toBeGreaterThan(0);
    for (const k of kandidat) {
      validasiKartuJadi(k.map((p) => ({ kartu: kartuTangan.find((x) => x.id === p.id)!, sebagai: p.sebagai })), c);
    }
    const teks = kandidat.map((k) => k.map((p) => p.id).sort().join(','));
    expect(teks).toContain(['J kriting', 'Q kriting', 'K kriting'].map((t) => kartu(t).id).sort().join(','));
  });
});
