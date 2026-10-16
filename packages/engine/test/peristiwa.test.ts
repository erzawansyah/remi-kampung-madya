// Peristiwa terstruktur (untuk animasi & sorakan) dan "mode ingatan" seperti meja asli.

import { describe, expect, it } from 'vitest';
import { terapkan, viewUntuk, type GameState, type IsiPeristiwa } from '../src/index.js';
import { id, semuaSelesaiSusun, skenario, spek, type ItemTeks } from './bantu.js';

const terakhir = (g: GameState) => g.peristiwa.at(-1)!;
const cari = <J extends IsiPeristiwa['jenis']>(g: GameState, jenis: J) =>
  g.peristiwa.filter((p) => p.jenis === jenis) as Extract<GameState['peristiwa'][number], { jenis: J }>[];

const mulung = (g: GameState, pemain: number, jumlah: number, ...kj: ItemTeks[][]) =>
  terapkan(g, { jenis: 'mulung', pemain, jumlah, kartuJadi: kj.map((k) => spek(...k)) });

describe('peristiwa', () => {
  it('ambil deck dan buang tercatat; log tidak menyebut kartu yang dibuang', () => {
    const s = skenario({ rankJoker: 9, giliran: 0, tangan: [['4 love', 'K waru'], ['2 waru']] });
    const s2 = terapkan(s, { jenis: 'ambilDeck', pemain: 0 });
    expect(terakhir(s2)).toMatchObject({ jenis: 'ambilDeck', pemain: 0, deckHabis: false });
    const s3 = terapkan(s2, { jenis: 'buang', pemain: 0, kartuId: id('K waru') });
    expect(terakhir(s3)).toMatchObject({ jenis: 'buang', pemain: 0, kartu: { id: id('K waru') }, sisaTangan: 2, jokerDibuang: false });
    expect(s3.log.at(-1)!.pesan).toBe('Pemain 1 buang kartu.');
    expect(JSON.stringify(s3.log)).not.toContain('K Waru');
  });

  it('id peristiwa naik terus', () => {
    const s = skenario({ rankJoker: 9, giliran: 0, tangan: [['4 love', 'K waru'], ['2 waru']] });
    const s3 = terapkan(terapkan(s, { jenis: 'ambilDeck', pemain: 0 }), { jenis: 'buang', pemain: 0, kartuId: id('K waru') });
    const ids = s3.peristiwa.map((p) => p.id);
    expect(ids).toEqual([...ids].sort((a, b) => a - b));
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('mulung: kartu yang dipungut beserta pemiliknya; sapu bersih kalau ambil maksimal (n − 1 ≥ 2)', () => {
    const s = skenario({
      rankJoker: 9,
      giliran: 0,
      tangan: [['2 wajik', '4 wajik', '8 kriting'], ['2 kriting'], ['3 kriting'], ['4 kriting']],
      buangan: [
        ['3 wajik', 1],
        ['K kriting', 2],
        ['5 wajik', 3],
      ],
    });
    const g = mulung(s, 0, 3, ['2 wajik', '3 wajik', '4 wajik', '5 wajik']);
    const p = cari(g, 'mulung')[0];
    expect(p.kartu.map((e) => [e.kartu.id, e.pemilik])).toEqual([
      [id('3 wajik'), 1],
      [id('K kriting'), 2],
      [id('5 wajik'), 3],
    ]);
    expect(p.sapuBersih).toBe(true);
    expect(p.beruntun).toBe(1);
    expect(p.idKartuJadi).toHaveLength(1);
  });

  it('mulung 1 kartu di 2 pemain bukan sapu bersih', () => {
    const s = skenario({ rankJoker: 9, giliran: 0, tangan: [['4 love', '6 love', 'K waru'], ['2 waru']], buangan: [['5 love', 1]] });
    expect(cari(mulung(s, 0, 1, ['4 love', '5 love', '6 love']), 'mulung')[0].sapuBersih).toBe(false);
  });

  it('mulung beruntun dihitung per pemain, reset kalau ambil dari deck', () => {
    const s = skenario({ rankJoker: 9, giliran: 0, tangan: [['4 love', '6 love', 'K waru'], ['2 waru']], buangan: [['5 love', 1]] });
    s.putaran!.mulungBeruntun = [2, 0];
    const g = mulung(s, 0, 1, ['4 love', '5 love', '6 love']);
    expect(cari(g, 'mulung')[0].beruntun).toBe(3);
    const s2 = skenario({ rankJoker: 9, giliran: 0, tangan: [['4 love', 'K waru'], ['2 waru']] });
    s2.putaran!.mulungBeruntun = [2, 0];
    expect(terapkan(s2, { jenis: 'ambilDeck', pemain: 0 }).putaran!.mulungBeruntun[0]).toBe(0);
  });

  it('4 As turun → kembarAs', () => {
    const s = skenario({
      rankJoker: 9,
      giliran: 0,
      tangan: [['As love', 'As waru', 'As wajik', '8 kriting'], ['2 kriting'], ['3 kriting']],
      buangan: [['As kriting', 2]],
    });
    expect(cari(mulung(s, 0, 1, ['As love', 'As waru', 'As wajik', 'As kriting']), 'mulung')[0].kembarAs).toBe(true);
  });

  it('buang joker hidup → jokerDibuang', () => {
    const s = skenario({ rankJoker: 7, giliran: 0, tangan: [['7 waru', '2 kriting'], ['4 waru']] });
    const g = terapkan(terapkan(s, { jenis: 'ambilDeck', pemain: 0 }), { jenis: 'buang', pemain: 0, kartuId: id('7 waru') });
    expect(terakhir(g)).toMatchObject({ jenis: 'buang', jokerDibuang: true });
  });

  it('mentung: pentungan, kepentung, arah, lalu putaran selesai', () => {
    const s = skenario({
      rankJoker: 7,
      giliran: 3,
      tangan: [['2 waru'], ['3 waru'], ['4 waru'], ['5 love', '6 love', '7 waru']],
      buangan: [['4 love', 2]],
    });
    const g = terapkan(mulung(s, 3, 1, ['4 love', '5 love', '6 love']), { jenis: 'buang', pemain: 3, kartuId: id('7 waru') });
    const m = cari(g, 'mentung')[0];
    expect(m).toMatchObject({ pemain: 3, pentunganJoker: true, nilai: 250, kepentung: [2], dibalik: true });
    // Mentung langsung diumumkan, lalu susun akhir, baru putaran selesai.
    expect(terakhir(g)).toMatchObject({ jenis: 'susunAkhir', sebab: 'mentung' });
    expect(terakhir(semuaSelesaiSusun(g))).toMatchObject({ jenis: 'putaranSelesai', cara: 'mentung' });
  });
});

describe('peristiwa nutup pakai beberapa joker (#41)', () => {
  const s = skenario({
    rankJoker: 7,
    giliran: 3,
    tangan: [['2 waru'], ['3 waru'], ['4 waru'], ['5 love', '6 love', '7 waru', '7 kriting']],
    buangan: [['4 love', 2]],
  });
  const g0 = mulung(s, 3, 1, ['4 love', '5 love', '6 love']);
  const g = terapkan(g0, { jenis: 'buang', pemain: 3, kartuId: id('7 waru'), kartuIdLain: [id('7 kriting')] });
  const baru = g.peristiwa.slice(g0.peristiwa.length);

  it('tetap satu peristiwa buang, dengan kartuLain; tanpa penalti joker', () => {
    const buang = baru.filter((e) => e.jenis === 'buang');
    expect(buang).toHaveLength(1);
    expect(buang[0]).toMatchObject({ jenis: 'buang', pemain: 3, kartu: { id: id('7 waru') }, jokerDibuang: false, sisaTangan: 0 });
    expect((buang[0] as Extract<IsiPeristiwa, { jenis: 'buang' }>).kartuLain!.map((k) => k.id)).toEqual([id('7 kriting')]);
    // Urutan: buang, mentung, susun akhir.
    expect(baru.map((e) => e.jenis)).toEqual(['buang', 'mentung', 'susunAkhir']);
  });

  it('peristiwa mentung: pentunganLain dan nilai total', () => {
    const m = cari(g, 'mentung')[0];
    expect(m).toMatchObject({ pemain: 3, pentunganJoker: true, nilai: 500, kepentung: [2], dibalik: true });
    expect(m.pentungan.id).toBe(id('7 waru'));
    expect(m.pentunganLain!.map((k) => k.id)).toEqual([id('7 kriting')]);
  });

  it('buang dan mentung satu kartu tidak memuat field baru', () => {
    const t = skenario({ rankJoker: 7, giliran: 3, tangan: [['2 waru'], ['3 waru'], ['4 waru'], ['5 love', '6 love', '7 waru']], buangan: [['4 love', 2]] });
    const satu = terapkan(mulung(t, 3, 1, ['4 love', '5 love', '6 love']), { jenis: 'buang', pemain: 3, kartuId: id('7 waru') });
    expect(cari(satu, 'buang')[0]).not.toHaveProperty('kartuLain');
    expect(cari(satu, 'mentung')[0]).not.toHaveProperty('pentunganLain');
    expect(cari(satu, 'mentung')[0].nilai).toBe(250);
  });

  it('info mentung (sudah terbuka) ikut di view semua pemain selama susun akhir', () => {
    for (const saya of [0, 1, 2, 3]) {
      const v = viewUntuk(g, saya);
      expect(v.putaran!.mentung!.pentunganLain!.map((k) => k.id)).toEqual([id('7 kriting')]);
    }
  });
});

describe('jejak kartu: kartu jadi mencatat asal buangan', () => {
  it('kartu pungutan di kartu jadi diberi tanda pemilik buangannya', () => {
    const s = skenario({
      rankJoker: 9,
      giliran: 0,
      tangan: [['2 wajik', '4 wajik', '8 kriting'], ['2 kriting'], ['3 kriting'], ['4 kriting']],
      buangan: [
        ['3 wajik', 1],
        ['K kriting', 2],
        ['5 wajik', 3],
      ],
    });
    const g = mulung(s, 0, 3, ['2 wajik', '3 wajik', '4 wajik', '5 wajik']);
    const kj = g.putaran!.kartuJadi[0][0];
    expect(kj.kartu.map((d) => d.dari)).toEqual([undefined, 1, undefined, 3]);
    // K Kriting masuk tangan; kalau nanti diturunkan, asalnya tetap tercatat.
    expect(g.putaran!.asalKartu[id('K kriting')]).toBe(2);
  });

  it('kartu buangan sendiri yang dipungut lagi tidak diberi tanda', () => {
    const s = skenario({ rankJoker: 9, giliran: 0, tangan: [['4 love', '6 love', 'K waru'], ['2 waru']], buangan: [['5 love', 0]] });
    const g = mulung(s, 0, 1, ['4 love', '5 love', '6 love']);
    expect(g.putaran!.kartuJadi[0][0].kartu.every((d) => d.dari === undefined)).toBe(true);
  });
});

describe('mode ingatan: view hanya berisi yang terlihat di meja', () => {
  const s = skenario({
    rankJoker: 7,
    giliran: 0,
    tangan: [['2 waru', '7 love'], ['3 waru'], ['4 waru']],
    buangan: [
      ['7 kriting', 1],
      ['9 love', 2],
      ['10 love', 1],
      ['7 wajik', 2],
    ],
    jokerMati: ['7 love'],
  });

  it('buangan cuma (n − 1) kartu teratas, jumlahnya tetap dikirim', () => {
    const v = viewUntuk(s, 0);
    expect(v.putaran!.buangan.map((e) => e.kartu.id)).toEqual([id('10 love'), id('7 wajik')]);
    expect(v.putaran!.jumlahBuangan).toBe(4);
  });

  it('joker mati yang terkubur di buangan tidak dikirim; yang terlihat atau di tangan sendiri dikirim', () => {
    const v0 = viewUntuk(s, 0);
    expect(v0.putaran!.jokerMati.sort()).toEqual([id('7 love'), id('7 wajik')].sort());
    const v1 = viewUntuk(s, 1);
    expect(v1.putaran!.jokerMati).toEqual([id('7 wajik')]);
  });

  it('peristiwa di view dibatasi', () => {
    const g: GameState = { ...s, peristiwa: Array.from({ length: 100 }, (_, i) => ({ id: i + 1, putaran: 1, jenis: 'susunAkhir' as const, sebab: 'deckHabis' as const })) };
    const v = viewUntuk(g, 0);
    expect(v.peristiwa).toHaveLength(40);
    expect(v.peristiwa.at(-1)!.id).toBe(100);
  });
});
