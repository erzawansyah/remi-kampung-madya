import { describe, expect, it } from 'vitest';
import { hitungSkorPemain, nilaiPentungan, teksPerhitungan, type StatusSkor } from '../src/index.js';
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
