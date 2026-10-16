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

describe('#41: mentung pakai beberapa joker sekaligus', () => {
  /** Buang beberapa kartu dalam satu aksi (kartu pertama + kartu lain). */
  const buangBeberapa = (s: GameState, pemain: number, ...kartu: string[]) =>
    terapkanAksi(s, { jenis: 'buang', pemain, kartuId: id(kartu[0]), kartuIdLain: kartu.slice(1).map(id) });
  const mulung = (s: GameState, pemain: number, jumlah: number, ...kj: ItemTeks[][]) =>
    terapkan(s, { jenis: 'mulung', pemain, jumlah, kartuJadi: kj.map((k) => spek(...k)) });
  const harusDitolak = (s: GameState, h: ReturnType<typeof buangBeberapa>, kode: string, pesan?: string) => {
    const sebelum = JSON.stringify(s);
    expect(h.ok).toBe(false);
    if (h.ok) return;
    expect(h.error.kode).toBe(kode);
    if (pesan) expect(h.error.pesan).toBe(pesan);
    // State tidak berubah.
    expect(JSON.stringify(s)).toBe(sebelum);
  };

  // Joker 7. Pemain 4 mulung 4 Love milik pemain 3, sisa tangannya 7 Waru + 7 Kriting (dua joker hidup).
  const duaJoker = () =>
    mulung(
      skenario({
        rankJoker: 7,
        giliran: 3,
        tangan: [['2 waru'], ['3 waru'], ['4 waru'], ['5 love', '6 love', '7 waru', '7 kriting']],
        buangan: [['4 love', 2]],
      }),
      3,
      1,
      ['4 love', '5 love', '6 love'],
    );

  describe('dua joker: pentungan 500', () => {
    const h0 = buangBeberapa(duaJoker(), 3, '7 waru', '7 kriting');
    const g = h0.ok ? h0.state : null!;
    const h = semuaSelesaiSusun(g).riwayat[0];

    it('diterima: tangan kosong, kedua joker jadi joker mati dan masuk buangan berurutan', () => {
      expect(h0.ok).toBe(true);
      const p = g.putaran!;
      expect(g.status).toBe('susunAkhir');
      expect(p.tangan[3]).toEqual([]);
      expect(p.jokerMati).toEqual(expect.arrayContaining([id('7 waru'), id('7 kriting')]));
      expect(p.buangan.slice(-2).map((e) => [e.kartu.id, e.pemilik])).toEqual([
        [id('7 waru'), 3],
        [id('7 kriting'), 3],
      ]);
      // Joker yang dipakai mentung tidak kena −25.
      expect(p.jokerDibuang).toEqual([0, 0, 0, 0]);
      expect(p.mentung).toMatchObject({ pemain: 3, pentunganJoker: true, kepentung: [2] });
      expect(p.mentung!.pentungan.id).toBe(id('7 waru'));
      expect(p.mentung!.pentunganLain!.map((k) => k.id)).toEqual([id('7 kriting')]);
    });

    it('yang mentung +500 sekali, yang kepentung −500, tanpa penalti joker', () => {
      expect(h.cara).toBe('mentung');
      expect(h.pentunganJoker).toBe(true);
      expect(h.pentunganLain!.map((k) => k.id)).toEqual([id('7 kriting')]);
      expect(h.nilaiPentungan).toBe(500);
      expect(h.rincian[3]).toMatchObject({ status: 'mentung', nilaiPentungan: 500, penaltiJoker: 0, total: 15 + 500 });
      expect(h.rincian[2]).toMatchObject({ status: 'kepentung', nilaiPentungan: -500, total: -5 - 500 });
      expect(h.rincian[0]).toMatchObject({ status: 'aman', total: -5 });
      expect(h.rincian[1]).toMatchObject({ status: 'aman', total: -5 });
    });

    it('kepentung dan arah tetap seperti biasa: pemain tepat sebelumnya kepentung → dibalik', () => {
      expect(h.kepentung).toEqual([2]);
      expect(h.dibalik).toBe(true);
    });

    it('log menyebut semua pentungan, seperti log mentung satu kartu', () => {
      expect(g.log.map((e) => e.pesan)).toContain('Pemain 4 mentung pakai 7 Waru dan 7 Kriting!');
    });
  });

  it('tiga joker, 2 deck, dua kepentung → masing-masing −750, yang mentung +750 (lompat, arah tetap)', () => {
    const s = skenario({
      rankJoker: 9,
      giliran: 3,
      konfigurasi: { duaDeckUntukEmpat: true },
      tangan: [['2 waru'], ['3 waru'], ['4 waru'], ['2 love', '3 love', '9 waru', '9 kriting', '9 waru#1']],
      buangan: [
        ['4 love', 0],
        ['5 love', 1],
      ],
    });
    const g = mulung(s, 3, 2, ['2 love', '3 love', '4 love', '5 love']);
    const hasil = buangBeberapa(g, 3, '9 waru', '9 kriting', '9 waru#1');
    expect(hasil.ok).toBe(true);
    const akhir = semuaSelesaiSusun(hasil.ok ? hasil.state : g);
    const h = akhir.riwayat[0];
    expect(h.kepentung).toEqual([0, 1]);
    expect(h.nilaiPentungan).toBe(750);
    expect(h.rincian[0]).toMatchObject({ status: 'kepentung', total: -5 - 750 });
    expect(h.rincian[1]).toMatchObject({ status: 'kepentung', total: -5 - 750 });
    expect(h.rincian[2]).toMatchObject({ status: 'aman', total: -5 });
    expect(h.rincian[3]).toMatchObject({ status: 'mentung', penaltiJoker: 0, total: 20 + 750 });
    expect(h.dibalik).toBe(false);
    expect(akhir.arah).toBe(1);
    expect(akhir.log.map((e) => e.pesan)).toContain('Pemain 4 mentung pakai 9 Waru, 9 Kriting dan 9 Waru!');
  });

  it('tangan isinya joker semua: mulung pakai joker, sisa dua joker dibuang sekaligus', () => {
    const s = skenario({
      rankJoker: 7,
      giliran: 1,
      tangan: [['2 waru'], ['7 waru', '7 love', '7 kriting', '7 wajik']],
      buangan: [['6 waru', 0]],
    });
    // 6-7-8 Waru: 7 Waru jadi dirinya sendiri, 7 Love jadi 8 Waru.
    const g = mulung(s, 1, 1, ['6 waru', '7 waru', ['7 love', '8 waru']]);
    const hasil = buangBeberapa(g, 1, '7 kriting', '7 wajik');
    expect(hasil.ok).toBe(true);
    const h = semuaSelesaiSusun(hasil.ok ? hasil.state : g).riwayat[0];
    expect(h.nilaiPentungan).toBe(500);
    expect(h.rincian[1]).toMatchObject({ status: 'mentung', total: 15 + 500 });
    expect(h.rincian[0]).toMatchObject({ status: 'kepentung', total: -5 - 500 });
  });

  it('turunkan dulu sesudah mulung, baru nutup pakai dua joker', () => {
    const s = skenario({
      rankJoker: 7,
      giliran: 3,
      tangan: [['2 waru'], ['3 waru'], ['4 waru'], ['5 love', '6 love', 'J kriting', 'Q kriting', 'K kriting', '7 waru', '7 wajik']],
      buangan: [['4 love', 2]],
    });
    const g = mulung(s, 3, 1, ['4 love', '5 love', '6 love']);
    const g2 = terapkan(g, { jenis: 'turunkan', pemain: 3, kartuJadi: [spek('J kriting', 'Q kriting', 'K kriting')] });
    const hasil = buangBeberapa(g2, 3, '7 wajik', '7 waru');
    expect(hasil.ok).toBe(true);
    const h = semuaSelesaiSusun(hasil.ok ? hasil.state : g2).riwayat[0];
    expect(h.pentungan!.id).toBe(id('7 wajik'));
    expect(h.rincian[3].total).toBe(15 + 30 + 500);
  });

  it('arah mundur: pemain tepat sebelumnya menurut arah saat ini kepentung → dibalik', () => {
    const s = skenario({
      rankJoker: 7,
      giliran: 1,
      arah: -1,
      tangan: [['2 waru'], ['5 love', '6 love', '7 waru', '7 kriting'], ['4 waru'], ['3 waru']],
      buangan: [['4 love', 2]],
    });
    const hasil = buangBeberapa(mulung(s, 1, 1, ['4 love', '5 love', '6 love']), 1, '7 waru', '7 kriting');
    const akhir = semuaSelesaiSusun(hasil.ok ? hasil.state : s);
    expect(akhir.riwayat[0]).toMatchObject({ kepentung: [2], dibalik: true, nilaiPentungan: 500 });
    expect(akhir.arah).toBe(1);
  });

  describe('ditolak (state tidak berubah)', () => {
    it('joker + kartu biasa', () => {
      const g = mulung(
        skenario({
          rankJoker: 7,
          giliran: 3,
          tangan: [['2 waru'], ['3 waru'], ['4 waru'], ['5 love', '6 love', '7 waru', 'K kriting']],
          buangan: [['4 love', 2]],
        }),
        3,
        1,
        ['4 love', '5 love', '6 love'],
      );
      harusDitolak(
        g,
        buangBeberapa(g, 3, '7 waru', 'K kriting'),
        'PENTUNGAN_BUKAN_JOKER',
        'Nutup pakai beberapa kartu cuma boleh kalau semuanya joker. Joker yang sudah pernah dibuang dihitung kartu biasa.',
      );
    });

    it('joker hidup + joker mati (sudah pernah dibuang) dihitung kartu biasa', () => {
      const g = mulung(
        skenario({
          rankJoker: 7,
          giliran: 3,
          tangan: [['2 waru'], ['3 waru'], ['4 waru'], ['5 love', '6 love', '7 waru', '7 kriting']],
          buangan: [['4 love', 2]],
          jokerMati: ['7 kriting'],
        }),
        3,
        1,
        ['4 love', '5 love', '6 love'],
      );
      harusDitolak(g, buangBeberapa(g, 3, '7 waru', '7 kriting'), 'PENTUNGAN_BUKAN_JOKER');
      harusDitolak(g, buangBeberapa(g, 3, '7 kriting', '7 waru'), 'PENTUNGAN_BUKAN_JOKER');
    });

    it('2 dari 3 kartu di tangan ditolak (semua sisa harus ikut); ketiganya sah = 750', () => {
      const g = mulung(
        skenario({
          rankJoker: 7,
          giliran: 3,
          tangan: [['2 waru'], ['3 waru'], ['4 waru'], ['5 love', '6 love', '7 waru', '7 kriting', '7 wajik']],
          buangan: [['4 love', 2]],
        }),
        3,
        1,
        ['4 love', '5 love', '6 love'],
      );
      harusDitolak(
        g,
        buangBeberapa(g, 3, '7 waru', '7 kriting'),
        'BUANG_SATU_KARTU',
        'Buangnya satu kartu aja, Bos. Lebih dari satu cuma boleh buat nutup, dan semua sisa kartumu harus ikut dibuang.',
      );
      const ok = buangBeberapa(g, 3, '7 waru', '7 kriting', '7 wajik');
      expect(ok.ok && semuaSelesaiSusun(ok.state).riwayat[0].nilaiPentungan).toBe(750);
    });

    it('struktur diperiksa dulu: sebagian tangan (joker + kartu biasa) ditolak tanpa menyebut joker', () => {
      const g = mulung(
        skenario({
          rankJoker: 7,
          giliran: 3,
          tangan: [['2 waru'], ['3 waru'], ['4 waru'], ['5 love', '6 love', '7 waru', 'K kriting', '2 love']],
          buangan: [['4 love', 2]],
        }),
        3,
        1,
        ['4 love', '5 love', '6 love'],
      );
      const h = buangBeberapa(g, 3, '7 waru', 'K kriting');
      harusDitolak(g, h, 'BUANG_SATU_KARTU');
      expect(!h.ok && h.error.pesan.toLowerCase()).not.toContain('joker');
    });

    it('habis ambil dari deck nggak bisa nutup, juga pakai beberapa joker', () => {
      const s = skenario({ rankJoker: 7, giliran: 0, tangan: [['7 waru'], ['2 waru']], deck: ['9 love', '7 kriting'] });
      const g = terapkan(s, { jenis: 'ambilDeck', pemain: 0 });
      expect(g.putaran!.tangan[0].map((k) => k.id)).toEqual([id('7 waru'), id('7 kriting')]);
      harusDitolak(g, buangBeberapa(g, 0, '7 waru', '7 kriting'), 'NUTUP_TANPA_MULUNG', 'Nutup cuma sah kalau giliran ini kamu mulung.');
      // Urutan: syarat mulung diperiksa sebelum syarat joker.
      const s2 = skenario({ rankJoker: 7, giliran: 0, tangan: [['K waru'], ['2 waru']], deck: ['9 love', '3 kriting'] });
      const g2 = terapkan(s2, { jenis: 'ambilDeck', pemain: 0 });
      harusDitolak(g2, buangBeberapa(g2, 0, 'K waru', '3 kriting'), 'NUTUP_TANPA_MULUNG');
    });

    it('kartu dobel atau kartu yang tidak ada di tangan', () => {
      const g = duaJoker();
      harusDitolak(g, buangBeberapa(g, 3, '7 waru', '7 waru'), 'KARTU_DOBEL', '7 Waru kepilih dua kali.');
      harusDitolak(g, buangBeberapa(g, 3, '7 waru', '7 kriting', '7 waru'), 'KARTU_DOBEL');
      harusDitolak(g, buangBeberapa(g, 3, '7 waru', '7 love'), 'KARTU_TIDAK_ADA', 'Kartu itu nggak ada di tanganmu.');
      harusDitolak(g, terapkanAksi(g, { jenis: 'buang', pemain: 3, kartuId: id('7 waru'), kartuIdLain: ['bukan-kartu'] }), 'KARTU_TIDAK_ADA');
      harusDitolak(g, terapkanAksi(g, { jenis: 'buang', pemain: 3, kartuId: 'bukan-kartu', kartuIdLain: [id('7 waru')] }), 'KARTU_TIDAK_ADA');
    });
  });

  it('daftar kartu lain yang kosong = buang satu kartu (state sama persis)', () => {
    // Mentung satu kartu (Contoh A) dan buang biasa.
    const s = skenario({
      rankJoker: 9,
      giliran: 3,
      tangan: [['2 waru'], ['3 waru'], ['4 waru'], ['5 love', '6 love', '8 kriting']],
      buangan: [
        ['10 wajik', 1],
        ['4 love', 2],
      ],
    });
    const g = mulung(s, 3, 1, ['4 love', '5 love', '6 love']);
    const satu = terapkan(g, { jenis: 'buang', pemain: 3, kartuId: id('8 kriting') });
    const kosong = terapkan(g, { jenis: 'buang', pemain: 3, kartuId: id('8 kriting'), kartuIdLain: [] });
    expect(kosong).toEqual(satu);
    expect(JSON.stringify(kosong)).toBe(JSON.stringify(satu));
    expect(satu.putaran!.mentung).not.toHaveProperty('pentunganLain');
    expect(satu.log.at(-2)!.pesan).toBe('Pemain 4 mentung pakai 8 Kriting!');
    const h = semuaSelesaiSusun(satu).riwayat[0];
    expect(h).not.toHaveProperty('pentunganLain');
    expect(h.nilaiPentungan).toBe(50);

    const b = skenario({ rankJoker: 9, giliran: 0, tangan: [['4 love', 'K waru'], ['2 waru']] });
    const b2 = terapkan(b, { jenis: 'ambilDeck', pemain: 0 });
    expect(terapkan(b2, { jenis: 'buang', pemain: 0, kartuId: id('K waru'), kartuIdLain: [] })).toEqual(
      terapkan(b2, { jenis: 'buang', pemain: 0, kartuId: id('K waru') }),
    );
  });
});
