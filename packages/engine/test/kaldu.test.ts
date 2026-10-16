// Mode kaldu (keputusan pemilik #42, #43): putaran kaldu dipicu batas putaran atau voting "putaran
// berikutnya terakhir", pentungan dikali dua, putaran kaldu yang ditutup mentung mengakhiri permainan,
// yang deck-nya habis disusul kaldu lagi, dan batas skor tidak dipakai.

import { describe, expect, it } from 'vitest';
import {
  buatPermainan,
  hitungSkorPemain,
  kandidatPengocok,
  migrasiState,
  periksaInvarian,
  PENGALI_KALDU,
  pilihAksiBot,
  putaranBerikutKaldu,
  Rng,
  teksPerhitungan,
  terapkan,
  terapkanAksi,
  viewUntuk,
  type Aksi,
  type GameState,
  type LevelBot,
} from '../src/index.js';
import { ctx, id, semuaSelesaiSusun, skenario, spek, type ItemTeks, type Skenario } from './bantu.js';

/** Satu langkah warga kedai (giliran atau susun akhir); invarian diperiksa sesudahnya. */
function langkahBot(g: GameState, rng: Rng, level: LevelBot): GameState {
  const siapa = g.status === 'susunAkhir' ? g.putaran!.selesaiSusun.findIndex((x) => !x) : g.putaran!.giliran;
  const h = terapkan(g, pilihAksiBot(viewUntuk(g, siapa), level, rng));
  expect(periksaInvarian(h)).toEqual([]);
  return h;
}

/** Mainkan putaran yang sedang berjalan sampai selesai (semua kursi warga kedai). */
function mainkanPutaran(g: GameState, rng: Rng, level: LevelBot = 'normal'): GameState {
  let s = g;
  for (let i = 0; s.status === 'putaranBerjalan' || s.status === 'susunAkhir'; i++) {
    if (i > 5000) throw new Error('putaran tidak selesai');
    s = langkahBot(s, rng, level);
  }
  return s;
}

/** Permainan warga kedai dari awal, putaran demi putaran, dengan pola yang sama seperti seed yang dicari. */
function permainanBot(n: number, seed: number, konfigurasi: Parameters<typeof buatPermainan>[0]['konfigurasi']) {
  const rng = new Rng(seed);
  let g = buatPermainan({ pemain: Array.from({ length: n }, (_, i) => `P${i}`), seed, konfigurasi });
  const putaran = () => {
    g = mainkanPutaran(terapkan(g, { jenis: 'mulaiPutaran' }), rng);
    return g;
  };
  return { get g() { return g; }, set g(x: GameState) { g = x; }, putaran, rng };
}

const mulung = (s: GameState, pemain: number, jumlah: number, ...kj: ItemTeks[][]) =>
  terapkan(s, { jenis: 'mulung', pemain, jumlah, kartuJadi: kj.map((k) => spek(...k)) });

/** Contoh A dari README (pentungan 8 Kriting = 50), dengan tambahan opsi skenario. */
function contohA(lain: Partial<Skenario> = {}): GameState {
  return skenario({
    rankJoker: 9,
    giliran: 3,
    tangan: [['2 waru'], ['3 waru'], ['4 waru'], ['5 love', '6 love', '8 kriting']],
    buangan: [
      ['10 wajik', 1],
      ['4 love', 2],
    ],
    ...lain,
  });
}

/** Contoh A dimainkan sampai dihitung: pemain 4 mentung, pemain 3 kepentung. */
function mentungContohA(lain: Partial<Skenario> = {}): GameState {
  const g = mulung(contohA(lain), 3, 1, ['4 love', '5 love', '6 love']);
  return semuaSelesaiSusun(terapkan(g, { jenis: 'buang', pemain: 3, kartuId: id('8 kriting') }));
}

/** Meja mode kaldu dengan putaran kaldu yang sedang jalan (batas putaran 1 = semua putaran kaldu). */
const KALDU: Partial<Skenario> = { modeKaldu: true, kaldu: true, konfigurasi: { batasPutaran: 1 } };

const ditolak = (g: GameState, aksi: Aksi, kode: string, pesan?: string) => {
  const sebelum = JSON.stringify(g);
  const h = terapkanAksi(g, aksi);
  expect(h.ok).toBe(false);
  if (!h.ok) {
    expect(h.error.kode).toBe(kode);
    if (pesan) expect(h.error.pesan).toBe(pesan);
  }
  // State tidak berubah.
  expect(JSON.stringify(g)).toBe(sebelum);
};

describe('mode kaldu mati (bawaan): aturan akhir permainan tidak berubah', () => {
  it('konfigurasi bawaan tidak memuat modeKaldu, state/view/peristiwa tanpa field kaldu', () => {
    const b = permainanBot(3, 1, { batasPutaran: 3 });
    expect(b.g.konfigurasi).not.toHaveProperty('modeKaldu');
    expect(putaranBerikutKaldu(b.g)).toBe(false);
    b.putaran();
    b.putaran();
    expect(putaranBerikutKaldu(b.g)).toBe(false);
    b.putaran();
    // Batas putaran tetap mengakhiri permainan seperti sebelumnya.
    expect(b.g.status).toBe('selesai');
    expect(b.g.alasanSelesai).toBe('batasPutaran');
    expect(JSON.stringify(b.g)).not.toContain('kaldu');
    expect(JSON.stringify(viewUntuk(b.g, 0))).not.toContain('kaldu');
    expect(b.g.log.map((e) => e.pesan).join('\n')).not.toContain('kaldu');
  });

  it('aksi putaranTerakhir ditolak di meja tanpa mode kaldu', () => {
    const g = buatPermainan({ pemain: ['A', 'B'], seed: 1 });
    ditolak(g, { jenis: 'putaranTerakhir' }, 'KONFIGURASI_TIDAK_SAH', 'Meja ini nggak pakai mode kaldu.');
    const b = permainanBot(2, 3, { batasPutaran: null });
    b.putaran();
    expect(b.g.status).toBe('putaranSelesai');
    ditolak(b.g, { jenis: 'putaranTerakhir' }, 'KONFIGURASI_TIDAK_SAH', 'Meja ini nggak pakai mode kaldu.');
    // modeKaldu: false sama dengan tidak ada.
    const mati = buatPermainan({ pemain: ['A', 'B'], seed: 1, konfigurasi: { modeKaldu: false, batasPutaran: 1 } });
    expect(putaranBerikutKaldu(mati)).toBe(false);
    ditolak(mati, { jenis: 'putaranTerakhir' }, 'KONFIGURASI_TIDAK_SAH');
  });

  it('pentungan tidak dikali, batas skor tetap berlaku', () => {
    const h = mentungContohA({ konfigurasi: { batasSkorAtas: 100 }, skor: [0, 0, 0, 90] });
    const r = h.riwayat[0];
    expect(r.nilaiPentungan).toBe(50);
    expect(r).not.toHaveProperty('kaldu');
    expect(r.rincian[3]).not.toHaveProperty('pengaliPentungan');
    expect(h.status).toBe('selesai');
    expect(h.alasanSelesai).toBe('batasSkor');
  });
});

describe('batas putaran memicu putaran kaldu (#42)', () => {
  const b = permainanBot(3, 1, { modeKaldu: true, batasPutaran: 3 });
  b.putaran();
  const satu = b.g;
  b.putaran();
  const dua = b.g;
  const awalTiga = terapkan(dua, { jenis: 'mulaiPutaran' });

  it('putaran 1 dan 2 biasa', () => {
    expect(satu.riwayat[0]).not.toHaveProperty('kaldu');
    expect(dua.riwayat[1]).not.toHaveProperty('kaldu');
    expect(putaranBerikutKaldu(satu)).toBe(false);
    expect(satu.status).toBe('putaranSelesai');
    expect(dua.status).toBe('putaranSelesai');
  });

  it('sebelum putaran 3: putaranBerikutKaldu benar, juga dibaca dari view', () => {
    expect(putaranBerikutKaldu(dua)).toBe(true);
    expect(putaranBerikutKaldu(viewUntuk(dua, 1))).toBe(true);
    expect(putaranBerikutKaldu(viewUntuk(dua, null))).toBe(true);
  });

  it('putaran 3: state, view, peristiwa, dan log menandai kaldu', () => {
    const p = awalTiga.putaran!;
    expect(p.nomor).toBe(3);
    expect(p.kaldu).toBe(true);
    expect(viewUntuk(awalTiga, 0).putaran!.kaldu).toBe(true);
    const e = awalTiga.peristiwa.at(-1)!;
    expect(e).toMatchObject({ jenis: 'mulaiPutaran', putaran: 3, kaldu: true });
    expect(awalTiga.log.at(-1)!.pesan).toBe(`Putaran 3 dimulai. ${awalTiga.pemain[p.pengocok].nama} ngocok. Putaran kaldu: pentungan dikali dua.`);
    // Angka joker tetap tidak masuk log.
    expect(awalTiga.log.at(-1)!.pesan).not.toMatch(/joker/i);
  });

  it('seed ini ditutup mentung di putaran 3 → selesai karena kaldu', () => {
    const akhir = mainkanPutaran(awalTiga, b.rng);
    const h = akhir.riwayat[2];
    expect(h.kaldu).toBe(true);
    expect(h.cara).toBe('mentung');
    expect(akhir.status).toBe('selesai');
    expect(akhir.alasanSelesai).toBe('kaldu');
    expect(akhir.log.at(-1)!.pesan).toBe('Permainan selesai.');
    const ev = akhir.peristiwa.find((x) => x.jenis === 'mentung' && x.putaran === 3);
    expect(ev).toMatchObject({ kaldu: true, nilai: h.nilaiPentungan });
    expect(h.nilaiPentungan % PENGALI_KALDU).toBe(0);
  });
});

describe('putaran kaldu ditutup mentung: pentungan × 2, bagian lain tetap', () => {
  it('Contoh A di putaran kaldu: +100 / −100, selesai karena kaldu', () => {
    const biasa = mentungContohA().riwayat[0];
    const g = mentungContohA(KALDU);
    const h = g.riwayat[0];
    expect(PENGALI_KALDU).toBe(2);
    expect(h.kaldu).toBe(true);
    expect(h.nilaiPentungan).toBe(100);
    expect(h.rincian[3]).toMatchObject({ status: 'mentung', nilaiPentungan: 100, pengaliPentungan: 2, total: 15 + 100 });
    expect(h.rincian[2]).toMatchObject({ status: 'kepentung', nilaiPentungan: -100, pengaliPentungan: 2, total: -5 - 100 });
    // Yang aman sama persis dengan putaran biasa, tanpa pengali.
    expect(h.rincian[0]).toEqual(biasa.rincian[0]);
    expect(h.rincian[1]).toEqual(biasa.rincian[1]);
    expect(h.rincian[1]).not.toHaveProperty('pengaliPentungan');
    // Kartu jadi dan tangan tidak dikali.
    expect(h.rincian[3].nilaiKartuJadi).toBe(biasa.rincian[3].nilaiKartuJadi);
    expect(h.rincian[2].nilaiTangan).toBe(biasa.rincian[2].nilaiTangan);
    // Kepentung dan arah ditentukan seperti biasa.
    expect(h.kepentung).toEqual(biasa.kepentung);
    expect(h.dibalik).toBe(biasa.dibalik);
    expect(g.skor).toEqual([-5, -5, -105, 115]);
    expect(g.status).toBe('selesai');
    expect(g.alasanSelesai).toBe('kaldu');
    expect(periksaInvarian(g)).toEqual([]);
  });

  it('peristiwa mentung membawa nilai yang sudah dikali dan tanda kaldu', () => {
    const g = mulung(contohA(KALDU), 3, 1, ['4 love', '5 love', '6 love']);
    const s = terapkan(g, { jenis: 'buang', pemain: 3, kartuId: id('8 kriting') });
    expect(s.peristiwa.at(-2)).toMatchObject({ jenis: 'mentung', nilai: 100, kaldu: true, kepentung: [2] });
    // Log mentung tetap seperti biasa.
    expect(s.log.map((e) => e.pesan)).toContain('Pemain 4 mentung pakai 8 Kriting!');
    // Di luar kaldu, peristiwa yang sama tanpa field kaldu.
    const biasa = terapkan(mulung(contohA(), 3, 1, ['4 love', '5 love', '6 love']), { jenis: 'buang', pemain: 3, kartuId: id('8 kriting') });
    expect(biasa.peristiwa.at(-2)).toMatchObject({ jenis: 'mentung', nilai: 50 });
    expect(biasa.peristiwa.at(-2)).not.toHaveProperty('kaldu');
  });

  it('penalti −25 buang joker tidak dikali', () => {
    const g = mulung(contohA(KALDU), 3, 1, ['4 love', '5 love', '6 love']);
    g.putaran!.jokerDibuang[1] = 1;
    const h = semuaSelesaiSusun(terapkan(g, { jenis: 'buang', pemain: 3, kartuId: id('8 kriting') })).riwayat[0];
    expect(h.rincian[1]).toMatchObject({ status: 'aman', penaltiJoker: 25, total: -5 - 25 });
  });

  it('pentungan As, dua kepentung → masing-masing −300, yang mentung +300', () => {
    const s = skenario({
      ...KALDU,
      rankJoker: 9,
      giliran: 3,
      tangan: [['2 waru'], ['3 waru'], ['4 waru'], ['2 love', '3 love', '6 love']],
      buangan: [
        ['4 love', 0],
        ['5 love', 1],
        ['As waru', 2],
      ],
    });
    const g = semuaSelesaiSusun(terapkan(mulung(s, 3, 3, ['2 love', '3 love', '4 love', '5 love', '6 love']), { jenis: 'buang', pemain: 3, kartuId: id('As waru') }));
    const h = g.riwayat[0];
    expect(h.kepentung).toEqual([0, 1]);
    expect(h.nilaiPentungan).toBe(300);
    expect(h.rincian[0]).toMatchObject({ nilaiPentungan: -300, total: -5 - 300 });
    expect(h.rincian[1]).toMatchObject({ nilaiPentungan: -300, total: -5 - 300 });
    expect(h.rincian[3]).toMatchObject({ nilaiPentungan: 300, total: 25 + 300 });
    expect(h.rincian[2]).toMatchObject({ status: 'aman', nilaiPentungan: 0, total: -5 });
    expect(g.alasanSelesai).toBe('kaldu');
  });

  it('dua joker sekaligus (#41) di putaran kaldu: 500 × 2 = ±1000', () => {
    const s = skenario({
      ...KALDU,
      rankJoker: 7,
      giliran: 3,
      tangan: [['2 waru'], ['3 waru'], ['4 waru'], ['5 love', '6 love', '7 waru', '7 kriting']],
      buangan: [['4 love', 2]],
    });
    const g0 = mulung(s, 3, 1, ['4 love', '5 love', '6 love']);
    const g1 = terapkan(g0, { jenis: 'buang', pemain: 3, kartuId: id('7 waru'), kartuIdLain: [id('7 kriting')] });
    expect(g1.peristiwa.find((e) => e.jenis === 'mentung')).toMatchObject({ nilai: 1000, kaldu: true });
    const g = semuaSelesaiSusun(g1);
    const h = g.riwayat[0];
    expect(h.nilaiPentungan).toBe(1000);
    expect(h.rincian[3]).toMatchObject({ status: 'mentung', nilaiPentungan: 1000, penaltiJoker: 0, total: 15 + 1000 });
    expect(h.rincian[2]).toMatchObject({ status: 'kepentung', nilaiPentungan: -1000, total: -5 - 1000 });
    expect(g.alasanSelesai).toBe('kaldu');
    expect(periksaInvarian(g)).toEqual([]);
  });

  it('teksPerhitungan menulis pengalinya: "+ 50 × 2" dan "− 50 × 2"', () => {
    const h = mentungContohA(KALDU).riwayat[0];
    const c = ctx(9);
    expect(teksPerhitungan(h.rincian[3], c)).toBe('(5+5+5) + 50 × 2 = 115');
    expect(teksPerhitungan(h.rincian[2], c)).toBe('0 − (5) − 50 × 2 = -105');
    expect(teksPerhitungan(h.rincian[1], c)).toBe('0 − (5) = -5');
    // Di luar kaldu tetap seperti dulu.
    expect(teksPerhitungan(mentungContohA().riwayat[0].rincian[3], c)).toBe('(5+5+5) + 50 = 65');
  });

  it('hitungSkorPemain: pengali hanya untuk pentungan, aman tanpa field pengali', () => {
    const dasar = { kartuJadi: [], tangan: [], nilaiPentungan: 150, jumlahJokerDibuang: 1, ctx: ctx(9) };
    expect(hitungSkorPemain({ ...dasar, pemain: 0, status: 'mentung', pengaliPentungan: 2 })).toMatchObject({ nilaiPentungan: 300, pengaliPentungan: 2, total: 300 - 25 });
    expect(hitungSkorPemain({ ...dasar, pemain: 0, status: 'kepentung', pengaliPentungan: 2 })).toMatchObject({ nilaiPentungan: -300, total: -300 - 25 });
    const aman = hitungSkorPemain({ ...dasar, pemain: 0, status: 'aman', pengaliPentungan: 2 });
    expect(aman).toMatchObject({ nilaiPentungan: 0, total: -25 });
    expect(aman).not.toHaveProperty('pengaliPentungan');
    expect(hitungSkorPemain({ ...dasar, pemain: 0, status: 'mentung' })).not.toHaveProperty('pengaliPentungan');
  });
});

describe('putaran kaldu yang deck-nya habis: kaldu lagi sampai ada yang mentung', () => {
  it('skenario: deck habis di putaran kaldu → putaran berikutnya kaldu, pengocok skor terendah', () => {
    const s = skenario({
      ...KALDU,
      rankJoker: 9,
      giliran: 0,
      tangan: [['2 waru', 'K love'], ['3 waru', '7 kriting'], ['4 waru', '5 wajik']],
      deck: ['Q kriting'],
      skor: [40, -30, 10],
    });
    let g = terapkan(s, { jenis: 'ambilDeck', pemain: 0 });
    g = semuaSelesaiSusun(terapkan(g, { jenis: 'buang', pemain: 0, kartuId: id('Q kriting') }));
    const h = g.riwayat[0];
    expect(h.cara).toBe('deckHabis');
    expect(h.kaldu).toBe(true);
    // Deck habis: tidak ada pentungan, skor dasar saja.
    expect(h.rincian.map((r) => r.nilaiPentungan)).toEqual([0, 0, 0]);
    expect(g.status).toBe('putaranSelesai');
    expect(g.alasanSelesai).toBeNull();
    expect(g.log.at(-1)!.pesan).toBe('Belum ada yang mentung, kaldu lagi.');
    expect(putaranBerikutKaldu(g)).toBe(true);
    // Pengocok berikutnya tetap pemain dengan skor terendah.
    const min = Math.min(...g.skor);
    expect(kandidatPengocok(g)).toEqual(g.skor.map((x, i) => (x === min ? i : -1)).filter((i) => i >= 0));
    const bukan = g.skor.findIndex((x) => x !== min);
    ditolak(g, { jenis: 'mulaiPutaran', pengocok: bukan }, 'PENGOCOK_TIDAK_SAH');
    const g2 = terapkan(g, { jenis: 'mulaiPutaran' });
    expect(g2.putaran).toMatchObject({ nomor: 2, kaldu: true });
    expect(kandidatPengocok(g)).toContain(g2.putaran!.pengocok);
  });

  it('3 pemain seed 2, batas putaran 3: putaran 3 dan 4 deck habis, putaran 5 ditutup mentung', () => {
    const b = permainanBot(3, 2, { modeKaldu: true, batasPutaran: 3 });
    for (let i = 0; i < 5; i++) {
      expect(b.g.status).not.toBe('selesai');
      // Pengocok putaran kaldu lanjutan tetap dari skor terendah (mulaiPutaran menolak yang lain).
      const kandidat = kandidatPengocok(b.g);
      b.putaran();
      expect(kandidat).toContain(b.g.riwayat.at(-1)!.pengocok);
    }
    const ringkas = b.g.riwayat.map((h) => `${h.nomor}${h.kaldu ? 'K' : ''}:${h.cara}`);
    expect(ringkas).toEqual(['1:mentung', '2:deckHabis', '3K:deckHabis', '4K:deckHabis', '5K:mentung']);
    expect(b.g.status).toBe('selesai');
    expect(b.g.alasanSelesai).toBe('kaldu');
    const log = b.g.log.map((e) => e.pesan);
    expect(log.filter((x) => x === 'Belum ada yang mentung, kaldu lagi.')).toHaveLength(2);
    expect(log.filter((x) => x.endsWith('Putaran kaldu: pentungan dikali dua.'))).toHaveLength(3);
  });

  it('"Akhiri permainan" tetap bisa di tengah kaldu lanjutan', () => {
    const b = permainanBot(3, 2, { modeKaldu: true, batasPutaran: 3 });
    for (let i = 0; i < 3; i++) b.putaran();
    expect(b.g.riwayat[2]).toMatchObject({ kaldu: true, cara: 'deckHabis' });
    const g = terapkan(b.g, { jenis: 'akhiriPermainan' });
    expect(g.status).toBe('selesai');
    expect(g.alasanSelesai).toBe('sepakat');
    expect(periksaInvarian(g)).toEqual([]);
  });

  it('tanpa batas putaran dan tanpa voting: main biasa terus sampai Akhiri', () => {
    const b = permainanBot(2, 4, { modeKaldu: true, batasPutaran: null, batasSkorAtas: 50, batasSkorBawah: -50 });
    for (let i = 0; i < 6; i++) {
      b.putaran();
      expect(b.g.status).toBe('putaranSelesai');
      expect(b.g.riwayat.at(-1)).not.toHaveProperty('kaldu');
    }
    expect(putaranBerikutKaldu(b.g)).toBe(false);
    expect(terapkan(b.g, { jenis: 'akhiriPermainan' }).alasanSelesai).toBe('sepakat');
  });
});

describe('voting "putaran berikutnya terakhir" (aksi putaranTerakhir)', () => {
  it('tanpa batas putaran: sesudah putaranTerakhir, putaran berikutnya kaldu', () => {
    const b = permainanBot(3, 1, { modeKaldu: true, batasPutaran: null });
    b.putaran();
    expect(putaranBerikutKaldu(b.g)).toBe(false);
    const g = terapkan(b.g, { jenis: 'putaranTerakhir' });
    expect(g.kalduDiminta).toBe(true);
    expect(b.g).not.toHaveProperty('kalduDiminta');
    expect(g.status).toBe('putaranSelesai');
    expect(g.log.at(-1)!.pesan).toBe('Sepakat: putaran berikutnya putaran kaldu.');
    expect(putaranBerikutKaldu(g)).toBe(true);
    const v = viewUntuk(g, 0);
    expect(v.kalduDiminta).toBe(true);
    expect(putaranBerikutKaldu(v)).toBe(true);
    const g2 = terapkan(g, { jenis: 'mulaiPutaran' });
    expect(g2.putaran).toMatchObject({ nomor: 2, kaldu: true });
    expect(periksaInvarian(g2)).toEqual([]);
  });

  it('boleh juga sebelum putaran pertama', () => {
    const g = terapkan(buatPermainan({ pemain: ['A', 'B'], seed: 5, konfigurasi: { modeKaldu: true } }), { jenis: 'putaranTerakhir' });
    expect(terapkan(g, { jenis: 'mulaiPutaran' }).putaran).toMatchObject({ nomor: 1, kaldu: true });
  });

  it('ditolak di tengah putaran (giliran maupun susun akhir)', () => {
    const b = permainanBot(3, 1, { modeKaldu: true, batasPutaran: null });
    const jalan = terapkan(b.g, { jenis: 'mulaiPutaran' });
    ditolak(jalan, { jenis: 'putaranTerakhir' }, 'STATUS_SALAH', 'Putaran terakhir cuma bisa diminta di antara putaran.');
    const s = mulung(contohA({ modeKaldu: true }), 3, 1, ['4 love', '5 love', '6 love']);
    const susun = terapkan(s, { jenis: 'buang', pemain: 3, kartuId: id('8 kriting') });
    expect(susun.status).toBe('susunAkhir');
    ditolak(susun, { jenis: 'putaranTerakhir' }, 'STATUS_SALAH');
  });

  it('ditolak kalau putaran berikutnya memang sudah kaldu (voting atau batas putaran)', () => {
    const g = terapkan(buatPermainan({ pemain: ['A', 'B'], seed: 5, konfigurasi: { modeKaldu: true } }), { jenis: 'putaranTerakhir' });
    ditolak(g, { jenis: 'putaranTerakhir' }, 'STATUS_SALAH', 'Putaran berikutnya memang sudah putaran terakhir.');
    const batas = buatPermainan({ pemain: ['A', 'B'], seed: 5, konfigurasi: { modeKaldu: true, batasPutaran: 1 } });
    ditolak(batas, { jenis: 'putaranTerakhir' }, 'STATUS_SALAH', 'Putaran berikutnya memang sudah putaran terakhir.');
    const b = permainanBot(3, 2, { modeKaldu: true, batasPutaran: 3 });
    for (let i = 0; i < 3; i++) b.putaran();
    expect(b.g.riwayat[2]).toMatchObject({ kaldu: true, cara: 'deckHabis' });
    ditolak(b.g, { jenis: 'putaranTerakhir' }, 'STATUS_SALAH');
  });

  it('putaran kaldu dari voting yang deck-nya habis juga disusul kaldu lagi', () => {
    const s = skenario({
      modeKaldu: true,
      kaldu: true,
      kalduDiminta: true,
      rankJoker: 9,
      giliran: 0,
      tangan: [['2 waru', 'K love'], ['3 waru', '7 kriting']],
      deck: ['Q kriting'],
    });
    let g = terapkan(s, { jenis: 'ambilDeck', pemain: 0 });
    g = semuaSelesaiSusun(terapkan(g, { jenis: 'buang', pemain: 0, kartuId: id('Q kriting') }));
    expect(g.status).toBe('putaranSelesai');
    expect(putaranBerikutKaldu(g)).toBe(true);
    expect(terapkan(g, { jenis: 'mulaiPutaran' }).putaran!.kaldu).toBe(true);
  });
});

describe('mode kaldu tidak memakai batas skor (#43)', () => {
  it('batas skor tercapai di putaran biasa: permainan jalan terus', () => {
    const g = mentungContohA({ modeKaldu: true, konfigurasi: { batasSkorAtas: 100, batasSkorBawah: -10 }, skor: [0, 0, 0, 90] });
    expect(g.skor[3]).toBe(155);
    expect(g.skor[2]).toBe(-55);
    expect(g.status).toBe('putaranSelesai');
    expect(g.alasanSelesai).toBeNull();
  });

  it('batas putaran tidak mengakhiri permainan, hanya memicu kaldu', () => {
    const b = permainanBot(3, 2, { modeKaldu: true, batasPutaran: 3, batasSkorAtas: 10, batasSkorBawah: -10 });
    for (let i = 0; i < 3; i++) b.putaran();
    expect(b.g.riwayat).toHaveLength(3);
    expect(b.g.status).toBe('putaranSelesai');
    expect(b.g.skor.some((x) => x >= 10 || x <= -10)).toBe(true);
  });
});

describe('simpanan dan invarian', () => {
  it('simpanan lama tanpa field kaldu = mode kaldu mati', () => {
    const b = permainanBot(3, 1, { batasPutaran: null });
    b.putaran();
    const lama = migrasiState(JSON.parse(JSON.stringify(b.g)) as GameState);
    expect(putaranBerikutKaldu(lama)).toBe(false);
    ditolak(lama, { jenis: 'putaranTerakhir' }, 'KONFIGURASI_TIDAK_SAH');
    const lanjut = terapkan(lama, { jenis: 'mulaiPutaran' });
    expect(lanjut.putaran).not.toHaveProperty('kaldu');
  });

  it('state kaldu bisa diserialisasi dan dilanjutkan', () => {
    const b = permainanBot(3, 1, { modeKaldu: true, batasPutaran: null });
    b.putaran();
    const g = terapkan(b.g, { jenis: 'putaranTerakhir' });
    const simpan = migrasiState(JSON.parse(JSON.stringify(g)) as GameState);
    expect(simpan).toEqual(g);
    expect(terapkan(simpan, { jenis: 'mulaiPutaran' }).putaran!.kaldu).toBe(true);
  });

  it('putaranTerakhir tidak mengubah state masukan', () => {
    const b = permainanBot(3, 1, { modeKaldu: true, batasPutaran: null });
    b.putaran();
    const sebelum = JSON.stringify(b.g);
    terapkan(b.g, { jenis: 'putaranTerakhir' });
    expect(JSON.stringify(b.g)).toBe(sebelum);
  });

  it('rumus skor tetap: total = jadi − tangan + pentungan − penalti', () => {
    const b = permainanBot(3, 2, { modeKaldu: true, batasPutaran: 3 });
    for (let i = 0; i < 5; i++) b.putaran();
    for (const h of b.g.riwayat) {
      for (const r of h.rincian) expect(r.total).toBe(r.nilaiKartuJadi - r.nilaiTangan + r.nilaiPentungan - r.penaltiJoker);
    }
  });

  it('invarian menangkap state kaldu yang tidak sah', () => {
    const g = mentungContohA(KALDU);
    // Permainan lanjut sesudah putaran kaldu ditutup mentung.
    expect(periksaInvarian({ ...g, status: 'putaranSelesai', alasanSelesai: null })).toEqual(
      expect.arrayContaining([expect.stringContaining('tidak selesai karena kaldu')]),
    );
    // Nilai pentungan tidak dikali.
    const r = g.riwayat[0];
    expect(periksaInvarian({ ...g, riwayat: [{ ...r, nilaiPentungan: 50 }] }).length).toBeGreaterThan(0);
    // Putaran kaldu di meja tanpa mode kaldu.
    expect(periksaInvarian({ ...g, konfigurasi: { ...g.konfigurasi, modeKaldu: undefined } }).length).toBeGreaterThan(0);
    // Mode kaldu yang selesai karena batas skor.
    const biasa = mentungContohA({ modeKaldu: true });
    expect(periksaInvarian({ ...biasa, status: 'selesai', alasanSelesai: 'batasSkor' })).toEqual(
      expect.arrayContaining([expect.stringContaining('batasSkor')]),
    );
  });
});
