import { describe, expect, it } from 'vitest';
import { hitungSkorPemain, nilaiPentungan, nilaiPentunganTotal, teksPerhitungan, type StatusSkor } from '../src/index.js';
import { ctx, kartu, kartuJadi, kartuSemua, type ItemTeks } from './bantu.js';

// Angka joker 7: tidak muncul di contoh mana pun.
const c = ctx(7);

function skor(status: StatusSkor, jadi: ItemTeks[][], tangan: string[], pentungan?: string) {
  return hitungSkorPemain({
    pemain: 0,
    status,
    kartuJadi: jadi.map((items) => kartuJadi(0, c, ...items)),
    tangan: kartuSemua(...tangan),
    nilaiPentungan: pentungan ? nilaiPentungan(kartu(pentungan), false) : 0,
    jumlahJokerDibuang: 0,
    ctx: c,
  });
}

describe('contoh wajib 8.3', () => {
  it('Pemain A (skor dasar) = 15', () => {
    const r = skor('aman', [['J love', 'Q love', 'K love']], ['5 love', '8 wajik', '9 wajik']);
    expect(r.total).toBe(15);
    expect(teksPerhitungan(r, c)).toBe('(10+10+10) − (5+5+5) = 15');
  });

  it('Pemain B (skor dasar) = −20', () => {
    const r = skor('aman', [['2 love', '3 love', '4 love']], ['2 love#1', '9 waru', 'As wajik', 'J waru']);
    expect(r.total).toBe(-20);
    expect(teksPerhitungan(r, c)).toBe('(5+5+5) − (5+5+15+10) = -20');
  });

  it('Pemain C (mentung) = 110', () => {
    const r = skor(
      'mentung',
      [
        ['3 kriting', '4 kriting', '5 kriting'],
        ['As waru', 'As love', 'As kriting'],
      ],
      [],
      '6 love',
    );
    expect(r.total).toBe(110);
    expect(teksPerhitungan(r, c)).toBe('(5+5+5) + (15+15+15) + 50 = 110');
  });

  it('Pemain D (kepentung) = −85', () => {
    const r = skor('kepentung', [['J kriting', 'Q kriting', 'K kriting']], ['3 love', '10 kriting', '5 waru'], 'Q love');
    expect(r.total).toBe(-85);
    expect(teksPerhitungan(r, c)).toBe('(10+10+10) − (5+5+5) − 100 = -85');
  });

  it('dua pemain kepentung dengan pentungan As → masing-masing dikurangi 150', () => {
    const a = skor('kepentung', [], ['3 love'], 'As love');
    const b = skor('kepentung', [['J kriting', 'Q kriting', 'K kriting']], [], 'As love');
    expect(a.total).toBe(-5 - 150);
    expect(b.total).toBe(30 - 150);
  });
});

describe('nilai kartu (8.1)', () => {
  it('nilai pentungan: angka 50, Londo 100, As 150', () => {
    expect(nilaiPentungan(kartu('10 love'), false)).toBe(50);
    expect(nilaiPentungan(kartu('K love'), false)).toBe(100);
    expect(nilaiPentungan(kartu('As love'), false)).toBe(150);
  });

  it('pentungan joker selalu 250, apa pun angkanya', () => {
    expect(nilaiPentungan(kartu('K love'), true)).toBe(250);
    expect(nilaiPentungan(kartu('J waru'), true)).toBe(250);
    expect(nilaiPentungan(kartu('As love'), true)).toBe(250);
    expect(nilaiPentungan(kartu('7 love'), true)).toBe(250);
  });

  it('pentungan total (#41): satu kartu sama dengan nilaiPentungan, tiap joker lain +250', () => {
    expect(nilaiPentunganTotal(kartu('6 love'), false)).toBe(50);
    expect(nilaiPentunganTotal(kartu('As love'), false, [])).toBe(150);
    expect(nilaiPentunganTotal(kartu('7 love'), true)).toBe(250);
    expect(nilaiPentunganTotal(kartu('7 love'), true, kartuSemua('7 waru'))).toBe(500);
    expect(nilaiPentunganTotal(kartu('7 love'), true, kartuSemua('7 waru', '7 kriting'))).toBe(750);
    expect(nilaiPentunganTotal(kartu('7 love'), true, kartuSemua('7 waru', '7 kriting', '7 wajik', '7 love#1'))).toBe(1250);
  });

  it('skor mentung/kepentung memakai nilai total sekali: +500 / −500', () => {
    const r = hitungSkorPemain({
      pemain: 0,
      status: 'mentung',
      kartuJadi: [kartuJadi(0, c, '4 love', '5 love', '6 love')],
      tangan: [],
      nilaiPentungan: 500,
      jumlahJokerDibuang: 0,
      ctx: c,
    });
    expect(r).toMatchObject({ nilaiPentungan: 500, penaltiJoker: 0, total: 15 + 500 });
    expect(teksPerhitungan(r, c)).toBe('(5+5+5) + 500 = 515');
    const k = hitungSkorPemain({ pemain: 1, status: 'kepentung', kartuJadi: [], tangan: kartuSemua('3 love'), nilaiPentungan: 500, jumlahJokerDibuang: 0, ctx: c });
    expect(k).toMatchObject({ nilaiPentungan: -500, total: -5 - 500 });
  });

  it('joker di tangan bernilai 25', () => {
    const r = hitungSkorPemain({
      pemain: 0,
      status: 'aman',
      kartuJadi: [],
      tangan: kartuSemua('7 love', '8 love'),
      nilaiPentungan: 0,
      jumlahJokerDibuang: 0,
      ctx: c,
    });
    expect(r.total).toBe(-30);
  });

  it('penalti buang joker −25 per kartu', () => {
    const r = hitungSkorPemain({
      pemain: 0,
      status: 'aman',
      kartuJadi: [],
      tangan: [],
      nilaiPentungan: 0,
      jumlahJokerDibuang: 2,
      ctx: c,
    });
    expect(r.total).toBe(-50);
  });
});
