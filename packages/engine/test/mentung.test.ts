import { describe, expect, it } from 'vitest';
import { terapkan, terapkanAksi, type GameState } from '../src/index.js';
import { id, semuaSelesaiSusun, skenario, spek, type ItemTeks } from './bantu.js';

// Pemain 1..4 = indeks 0..3, urutan 1→2→3→4 (arah 1). Giliran pemain 4.
/** Mulung, buang kartu terakhir (mentung), lalu semua langsung Selesai di susun akhir. */
function mentung(s: GameState, pemain: number, jumlah: number, kartuJadi: ItemTeks[][], pentungan: string) {
  return semuaSelesaiSusun(mentungSaja(s, pemain, jumlah, kartuJadi, pentungan));
}

function mentungSaja(s: GameState, pemain: number, jumlah: number, kartuJadi: ItemTeks[][], pentungan: string) {
  const s2 = terapkan(s, { jenis: 'mulung', pemain, jumlah, kartuJadi: kartuJadi.map((k) => spek(...k)) });
  return terapkan(s2, { jenis: 'buang', pemain, kartuId: id(pentungan) });
}

describe('Contoh A: pemain sebelumnya kepentung → arah dibalik', () => {
  const s = skenario({
    rankJoker: 9,
    giliran: 3,
    tangan: [['2 waru'], ['3 waru'], ['4 waru'], ['5 love', '6 love', '8 kriting']],
    buangan: [
      ['10 wajik', 1],
      ['4 love', 2],
    ],
  });
  const akhir = mentung(s, 3, 1, [['4 love', '5 love', '6 love']], '8 kriting');
  const h = akhir.riwayat[0];

  it('setelah susun akhir, putaran selesai dengan cara mentung', () => {
    expect(akhir.status).toBe('putaranSelesai');
    expect(h.cara).toBe('mentung');
    expect(h.pementung).toBe(3);
  });

  it('pemain 3 kepentung, arah berikutnya dibalik (4→3→2→1)', () => {
    expect(h.kepentung).toEqual([2]);
    expect(h.dibalik).toBe(true);
    expect(h.arahBerikutnya).toBe(-1);
    expect(akhir.arah).toBe(-1);
  });

  it('skor: yang mentung + pentungan, yang kepentung − pentungan', () => {
    expect(h.nilaiPentungan).toBe(50);
    expect(h.rincian[3]).toMatchObject({ status: 'mentung', total: 15 + 50 });
    expect(h.rincian[2]).toMatchObject({ status: 'kepentung', total: -5 - 50 });
    expect(h.rincian[1]).toMatchObject({ status: 'aman', total: -5 });
  });
});

describe('Contoh B: lompat → arah tetap', () => {
  // Pungut 2: 6 Waru (milik pemain 3, atas) dan 4 Love (milik pemain 2, bawah).
  const s = skenario({
    rankJoker: 9,
    giliran: 3,
    tangan: [['2 waru'], ['3 waru'], ['4 waru'], ['5 love', '6 love']],
    buangan: [
      ['4 love', 1],
      ['6 waru', 2],
    ],
  });
  const akhir = mentung(s, 3, 2, [['4 love', '5 love', '6 love']], '6 waru');
  const h = akhir.riwayat[0];

  it('pemain 2 kepentung, pemain 3 (pemilik pentungan) aman', () => {
    expect(h.kepentung).toEqual([1]);
    expect(h.rincian[2].status).toBe('aman');
  });

  it('arah tetap', () => {
    expect(h.dibalik).toBe(false);
    expect(akhir.arah).toBe(1);
  });
});

describe('penentuan kepentung', () => {
  it('dua pemain kepentung dengan pentungan As → masing-masing −150', () => {
    const s = skenario({
      rankJoker: 9,
      giliran: 3,
      tangan: [['2 waru'], ['3 waru'], ['4 waru'], ['2 love', '3 love', '6 love']],
      buangan: [
        ['4 love', 0],
        ['5 love', 1],
        ['As waru', 2],
      ],
      kartuJadi: [[], [], [], []],
    });
    const h = mentung(s, 3, 3, [['2 love', '3 love', '4 love', '5 love', '6 love']], 'As waru').riwayat[0];
    expect(h.kepentung).toEqual([0, 1]);
    expect(h.nilaiPentungan).toBe(150);
    expect(h.rincian[0].nilaiPentungan).toBe(-150);
    expect(h.rincian[1].nilaiPentungan).toBe(-150);
    expect(h.rincian[2].status).toBe('aman');
    // Pemain tepat sebelum (indeks 2) tidak kepentung → arah tetap.
    expect(h.dibalik).toBe(false);
  });

  it('satu pemain dengan dua kartu terpakai tetap kena pentungan sekali (D9)', () => {
    const s = skenario({
      rankJoker: 9,
      giliran: 3,
      tangan: [['2 waru'], ['3 waru'], ['4 waru'], ['2 love', '3 love', '6 love']],
      buangan: [
        ['4 love', 1],
        ['5 love', 1],
        ['9 kriting', 2],
      ],
    });
    const h = mentung(s, 3, 3, [['2 love', '3 love', '4 love', '5 love', '6 love']], '9 kriting').riwayat[0];
    expect(h.kepentung).toEqual([1]);
    expect(h.rincian[1].nilaiPentungan).toBe(-50);
  });

  it('kartu buangan sendiri yang terpakai tidak bikin diri sendiri kepentung (D8)', () => {
    const s = skenario({
      rankJoker: 9,
      giliran: 3,
      tangan: [['2 waru'], ['3 waru'], ['4 waru'], ['3 love', '6 love', 'K kriting']],
      buangan: [
        ['4 love', 3],
        ['5 love', 2],
      ],
    });
    const h = mentung(s, 3, 2, [['3 love', '4 love', '5 love', '6 love']], 'K kriting').riwayat[0];
    expect(h.kepentung).toEqual([2]);
    expect(h.rincian[3].status).toBe('mentung');
    expect(h.dibalik).toBe(true);
  });

  it('kartu pungutan yang hanya masuk tangan lalu dijadikan di giliran yang sama tetap bikin kepentung', () => {
    // Pungut 3: 3 Wajik (P1, bawah), 8 Love (P2), Q Waru (P3, atas).
    // 3 Wajik dijadikan saat mulung; 8 Love masuk tangan lalu diturunkan; Q Waru jadi pentungan.
    const s = skenario({
      rankJoker: 2,
      giliran: 3,
      tangan: [['2 waru'], ['3 waru'], ['4 waru'], ['4 wajik', '5 wajik', '7 love', '9 love']],
      buangan: [
        ['3 wajik', 0],
        ['8 love', 1],
        ['Q waru', 2],
      ],
    });
    const s2 = terapkan(s, { jenis: 'mulung', pemain: 3, jumlah: 3, kartuJadi: [spek('3 wajik', '4 wajik', '5 wajik')] });
    const s3 = terapkan(s2, { jenis: 'turunkan', pemain: 3, kartuJadi: [spek('7 love', '8 love', '9 love')] });
    const h = semuaSelesaiSusun(terapkan(s3, { jenis: 'buang', pemain: 3, kartuId: id('Q waru') })).riwayat[0];
    expect(h.kepentung).toEqual([0, 1]);
    expect(h.nilaiPentungan).toBe(100);
    expect(h.dibalik).toBe(false);
  });

  it('arah mundur: pemain sebelumnya dihitung menurut arah saat ini', () => {
    // Urutan 4→3→2→1 (arah −1). Giliran pemain 2 (indeks 1); pemain tepat sebelumnya = pemain 3 (indeks 2).
    const s = skenario({
      rankJoker: 9,
      giliran: 1,
      arah: -1,
      tangan: [['2 waru'], ['5 love', '6 love', '8 kriting'], ['4 waru'], ['3 waru']],
      buangan: [['4 love', 2]],
    });
    const akhir = mentung(s, 1, 1, [['4 love', '5 love', '6 love']], '8 kriting');
    expect(akhir.riwayat[0].dibalik).toBe(true);
    expect(akhir.arah).toBe(1);
  });

  it('mentung pakai joker 7 (masih hidup) → pentungan 250, tanpa penalti', () => {
    const s = skenario({
      rankJoker: 7,
      giliran: 1,
      tangan: [['2 waru'], ['5 love', '6 love', '7 waru']],
      buangan: [['4 love', 0]],
    });
    const h = mentung(s, 1, 1, [['4 love', '5 love', '6 love']], '7 waru').riwayat[0];
    expect(h.nilaiPentungan).toBe(250);
    expect(h.rincian[1].penaltiJoker).toBe(0);
    expect(h.rincian[1].total).toBe(15 + 250);
    expect(h.rincian[0].total).toBe(-5 - 250);
  });

  it('mentung pakai joker K (masih hidup) → pentungan 250', () => {
    const s = skenario({
      rankJoker: 13,
      giliran: 1,
      tangan: [['2 waru'], ['5 love', '6 love', 'K waru']],
      buangan: [['4 love', 0]],
    });
    const h = mentung(s, 1, 1, [['4 love', '5 love', '6 love']], 'K waru').riwayat[0];
    expect(h.pentunganJoker).toBe(true);
    expect(h.nilaiPentungan).toBe(250);
    expect(h.rincian[1].penaltiJoker).toBe(0);
    expect(h.rincian[1].total).toBe(15 + 250);
    expect(h.rincian[0].total).toBe(-5 - 250);
  });

  it('mentung pakai joker As (masih hidup) → pentungan 250', () => {
    const s = skenario({
      rankJoker: 1,
      giliran: 1,
      tangan: [['2 waru'], ['5 love', '6 love', 'As waru']],
      buangan: [['4 love', 0]],
    });
    expect(mentung(s, 1, 1, [['4 love', '5 love', '6 love']], 'As waru').riwayat[0].nilaiPentungan).toBe(250);
  });

  it('joker K hasil mungut (sudah mati) dipakai mentung → nilai aslinya 100', () => {
    // K Waru pernah dibuang pemain 1, lalu ikut dipungut bersama 4 Love.
    const s = skenario({
      rankJoker: 13,
      giliran: 1,
      tangan: [['2 waru'], ['5 love', '6 love'], ['3 waru']],
      buangan: [
        ['4 love', 0],
        ['K waru', 0],
      ],
      jokerMati: ['K waru'],
    });
    const h = mentung(s, 1, 2, [['4 love', '5 love', '6 love']], 'K waru').riwayat[0];
    expect(h.pentunganJoker).toBe(false);
    expect(h.nilaiPentungan).toBe(100);
  });

  it('joker 7 hasil mungut (sudah pernah dibuang) dipakai mentung → 50', () => {
    const s = skenario({
      rankJoker: 7,
      giliran: 1,
      tangan: [['2 waru'], ['5 love', '6 love'], ['3 waru']],
      buangan: [
        ['4 love', 0],
        ['7 waru', 0],
      ],
      jokerMati: ['7 waru'],
    });
    const h = mentung(s, 1, 2, [['4 love', '5 love', '6 love']], '7 waru').riwayat[0];
    expect(h.nilaiPentungan).toBe(50);
  });

  it('nutup hanya lewat mulung', () => {
    const s = skenario({ rankJoker: 9, giliran: 0, tangan: [['K waru'], ['2 waru']] });
    const s2 = terapkan(s, { jenis: 'ambilDeck', pemain: 0 });
    // Tangan 2 kartu. Membuang satu menyisakan satu: putaran lanjut, bukan mentung.
    const s3 = terapkan(s2, { jenis: 'buang', pemain: 0, kartuId: id('K waru') });
    expect(s3.status).toBe('putaranBerjalan');
    expect(terapkanAksi(s3, { jenis: 'ambilDeck', pemain: 1 }).ok).toBe(true);
  });
});

describe('susun akhir setelah mentung', () => {
  // Pemain 4 mentung pakai 8 Kriting; pemain 3 kepentung (punya 7-8-9 Wajik di tangan).
  const s = skenario({
    rankJoker: 2,
    giliran: 3,
    tangan: [['K waru'], ['3 waru'], ['7 wajik', '8 wajik', '9 wajik', 'Q waru'], ['5 love', '6 love', '8 kriting']],
    buangan: [['4 love', 2]],
  });
  const g = mentungSaja(s, 3, 1, [['4 love', '5 love', '6 love']], '8 kriting');

  it('mentung tidak langsung mengakhiri putaran: semua masih boleh menyusun', () => {
    expect(g.status).toBe('susunAkhir');
    expect(g.riwayat).toHaveLength(0);
    // Yang mentung tangannya kosong, jadi langsung dianggap selesai.
    expect(g.putaran!.selesaiSusun).toEqual([false, false, false, true]);
    expect(g.putaran!.mentung).toMatchObject({ pemain: 3, kepentung: [2] });
  });

  it('yang kepentung boleh menurunkan kartu jadi; tetap kepentung tapi tangannya berkurang', () => {
    const g2 = terapkan(g, { jenis: 'turunkan', pemain: 2, kartuJadi: [spek('7 wajik', '8 wajik', '9 wajik')] });
    const h = semuaSelesaiSusun(g2).riwayat[0];
    expect(h.cara).toBe('mentung');
    expect(h.kepentung).toEqual([2]);
    // (5+5+5) − (10) − 50
    expect(h.rincian[2]).toMatchObject({ status: 'kepentung', total: 15 - 10 - 50 });
    expect(h.rincian[3]).toMatchObject({ status: 'mentung', total: 15 + 50 });
    expect(h.dibalik).toBe(true);
  });

  it('tanpa menyusun, kartu tetap dihitung di tangan', () => {
    const h = semuaSelesaiSusun(g).riwayat[0];
    expect(h.rincian[2].total).toBe(-(5 + 5 + 5 + 10) - 50);
  });

  it('tidak ada mulung atau buang di fase ini', () => {
    expect(terapkanAksi(g, { jenis: 'mulung', pemain: 0, jumlah: 1, kartuJadi: [spek('K waru')] }).ok).toBe(false);
    expect(terapkanAksi(g, { jenis: 'buang', pemain: 0, kartuId: id('K waru') }).ok).toBe(false);
  });
});
