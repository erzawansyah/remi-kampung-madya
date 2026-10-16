// Keputusan pemilik #40: angka joker tidak boleh sama dengan joker putaran tepat sebelumnya. Kartu yang
// dibuka dengan angka sama dianulir (disisihkan), lalu kartu berikutnya dibuka, sampai angkanya beda.
// Putaran pertama (juga permainan baru sesudah "Main lagi") bebas, dan putaran 3 boleh sama dengan putaran 1.

import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  AturanError,
  aturanPembagian,
  bukaKartuJoker,
  buatDeck,
  buatPermainan,
  periksaInvarian,
  Rng,
  seedKeState,
  terapkan,
  type GameState,
  type HasilPutaran,
  type Kartu,
  type Rank,
} from '../src/index.js';
import { kartu, kartuSemua } from './bantu.js';

const KONFIGURASI = [
  { label: '2 pemain', n: 2, duaDeck: false },
  { label: '3 pemain', n: 3, duaDeck: false },
  { label: '4 pemain', n: 4, duaDeck: false },
  { label: '4 pemain 2 deck', n: 4, duaDeck: true },
  { label: '5 pemain', n: 5, duaDeck: false },
  { label: '6 pemain', n: 6, duaDeck: false },
];

/** Rng yang menghitung pemanggilan `int`. */
class RngHitung extends Rng {
  panggil = 0;
  override int(n: number): number {
    this.panggil++;
    return super.int(n);
  }
}

/** Salinan cara lama (sebelum #40): buka kartu teratas, selipkan ke posisi acak. */
function bukaCaraLama(deck: Kartu[], rng: Rng): Kartu {
  const k = deck.pop()!;
  deck.splice(rng.int(deck.length + 1), 0, k);
  return k;
}

/** Catat setiap kartu yang dibuka (di-pop) dari deck. */
function catatBuka(deck: Kartu[]): Kartu[] {
  const dibuka: Kartu[] = [];
  const pop = deck.pop.bind(deck);
  deck.pop = () => {
    const k = pop();
    if (k) dibuka.push(k);
    return k;
  };
  return dibuka;
}

const urutId = (d: Kartu[]) => d.map((k) => k.id).sort();

/** Deck yang sudah dikocok dan dibagi, seperti saat kartu joker hendak dibuka. */
function deckSesudahBagi(n: number, duaDeck: boolean, seed: number): Kartu[] {
  const { jumlahDeck, kartuPerPemain } = aturanPembagian(n, duaDeck);
  const deck = new Rng(seed).shuffle(buatDeck(jumlahDeck));
  deck.length -= n * kartuPerPemain;
  return deck;
}

describe('bukaKartuJoker (#40)', () => {
  it('tanpa joker sebelumnya: kartu teratas langsung jadi joker, sama persis dengan cara lama', () => {
    for (const { n, duaDeck } of KONFIGURASI) {
      for (let seed = 0; seed < 40; seed++) {
        const a = deckSesudahBagi(n, duaDeck, seed);
        const b = [...a];
        const rngA = new RngHitung(seed * 31 + 5);
        const rngB = new Rng(seed * 31 + 5);
        const teratas = a.at(-1)!;
        expect(bukaKartuJoker(a, undefined, rngA)).toBe(teratas);
        expect(bukaCaraLama(b, rngB)).toBe(teratas);
        expect(a).toEqual(b);
        expect(rngA.state).toBe(rngB.state);
        expect(rngA.panggil).toBe(1);
      }
    }
  });

  it('joker sebelumnya beda dengan kartu teratas: tidak ada anulir, sama persis dengan cara lama', () => {
    for (let seed = 0; seed < 60; seed++) {
      const a = deckSesudahBagi(4, false, seed);
      const b = [...a];
      const beda = ((a.at(-1)!.rank % 13) + 1) as Rank;
      const rngA = new RngHitung(seed);
      const rngB = new Rng(seed);
      expect(bukaKartuJoker(a, beda, rngA)).toBe(bukaCaraLama(b, rngB));
      expect(a).toEqual(b);
      expect(rngA.state).toBe(rngB.state);
      expect(rngA.panggil).toBe(1);
    }
  });

  it('satu kartu dianulir: kartu berikutnya dibuka, yang dianulir diselipkan lagi ke deck', () => {
    // Dari bawah ke atas; joker putaran lalu 9.
    const deck = kartuSemua('3 waru', 'K love', '5 kriting', '9 wajik');
    const awal = urutId(deck);
    const dibuka = catatBuka(deck);
    const rng = new RngHitung(11);
    const joker = bukaKartuJoker(deck, 9, rng);
    expect(joker).toEqual(kartu('5 kriting'));
    expect(dibuka.map((k) => k.id)).toEqual([kartu('9 wajik').id, kartu('5 kriting').id]);
    expect(deck).toHaveLength(4);
    expect(urutId(deck)).toEqual(awal);
    expect(rng.panggil).toBe(2);
  });

  it('beberapa kartu beruntun dianulir (2 deck): dibuka terus sampai angkanya beda', () => {
    // Joker putaran lalu 7; tiga kartu teratas 7 semua, termasuk dua 7 Love dari deck berbeda.
    const deck = kartuSemua('2 waru', 'Q love', '4 kriting', '7 love#1', '7 waru', '7 love');
    const awal = urutId(deck);
    const dibuka = catatBuka(deck);
    const rng = new RngHitung(3);
    const joker = bukaKartuJoker(deck, 7, rng);
    expect(joker).toEqual(kartu('4 kriting'));
    expect(dibuka.map((k) => k.id)).toEqual(['7 love', '7 waru', '7 love#1', '4 kriting'].map((t) => kartu(t).id));
    // Setiap kartu dibuka paling banyak sekali; jumlah dan isi deck tetap.
    expect(new Set(dibuka.map((k) => k.id)).size).toBe(dibuka.length);
    expect(deck).toHaveLength(6);
    expect(urutId(deck)).toEqual(awal);
    expect(new Set(deck.map((k) => k.id)).size).toBe(6);
    // Satu rng.int untuk joker + satu per kartu yang dianulir.
    expect(rng.panggil).toBe(1 + 3);
  });

  it('urutan deck untuk seed tetap: joker diselipkan dulu, lalu kartu yang dianulir satu per satu', () => {
    // Rng(40).int(2), int(3), int(4), int(5) = 1, 2, 0, 3.
    const deck = kartuSemua('3 waru', '5 love', '7 waru', '7 love', '7 kriting');
    const joker = bukaKartuJoker(deck, 7, new Rng(40));
    expect(joker).toEqual(kartu('5 love'));
    // [3W] → 5L di 1 → [3W 5L] → 7K di 2 → [3W 5L 7K] → 7L di 0 → [7L 3W 5L 7K] → 7W di 3.
    expect(deck).toEqual(kartuSemua('7 love', '3 waru', '5 love', '7 waru', '7 kriting'));
  });

  it('deck acak: jumlah dan isi deck tetap, joker selalu beda, RNG dipakai 1 + jumlah anulir', () => {
    let pernahAnulir = 0;
    for (const { n, duaDeck } of KONFIGURASI) {
      for (let seed = 0; seed < 50; seed++) {
        const deck = deckSesudahBagi(n, duaDeck, seed);
        const awal = urutId(deck);
        const sebelumnya = deck.at(-1)!.rank; // pasti dianulir minimal satu
        const dibuka = catatBuka(deck);
        const rng = new RngHitung(seed);
        const joker = bukaKartuJoker(deck, sebelumnya, rng);
        expect(joker.rank).not.toBe(sebelumnya);
        expect(dibuka.at(-1)).toBe(joker);
        expect(dibuka.slice(0, -1).every((k) => k.rank === sebelumnya)).toBe(true);
        expect(new Set(dibuka.map((k) => k.id)).size).toBe(dibuka.length);
        expect(urutId(deck)).toEqual(awal);
        expect(rng.panggil).toBe(dibuka.length);
        pernahAnulir += dibuka.length - 1;
      }
    }
    expect(pernahAnulir).toBeGreaterThanOrEqual(KONFIGURASI.length * 50);
  });

  it('deck isinya angka joker lama semua: ditolak tanpa mengubah deck (mustahil di meja sungguhan)', () => {
    const deck = kartuSemua('7 waru', '7 love');
    const rng = new RngHitung(1);
    let galat: unknown;
    try {
      bukaKartuJoker(deck, 7, rng);
    } catch (e) {
      galat = e;
    }
    expect(galat).toBeInstanceOf(AturanError);
    expect((galat as AturanError).kode).toBe('KONFIGURASI_TIDAK_SAH');
    expect(deck).toEqual(kartuSemua('7 waru', '7 love'));
    expect(rng.panggil).toBe(0);
  });

  it('sisa deck sesudah dibagi selalu lebih banyak dari kartu satu angka, jadi anulir pasti berhenti', () => {
    for (const { n, duaDeck } of KONFIGURASI) {
      const { jumlahDeck, kartuPerPemain } = aturanPembagian(n, duaDeck);
      const sisa = jumlahDeck * 52 - n * kartuPerPemain;
      expect(sisa).toBeGreaterThanOrEqual(28);
      expect(sisa).toBeGreaterThan(4 * jumlahDeck);
    }
  });
});

/** Hasil putaran palsu: hanya field yang dibaca mesin dan pemeriksa invarian. */
function hasilPalsu(nomor: number, rankJoker: Rank, n: number): HasilPutaran {
  return {
    nomor,
    rankJoker,
    skorAkumulasi: Array(n).fill(0),
    rincian: Array.from({ length: n }, (_, pemain) => ({ pemain, total: 0 })),
  } as unknown as HasilPutaran;
}

/** Permainan yang sudah memainkan putaran dengan angka joker `riwayat`, siap memulai putaran berikutnya. */
function permainanSesudah(n: number, duaDeck: boolean, seed: number, riwayat: Rank[]): GameState {
  const g = buatPermainan({ pemain: Array.from({ length: n }, (_, i) => `P${i + 1}`), seed, konfigurasi: { duaDeckUntukEmpat: duaDeck } });
  return {
    ...g,
    status: riwayat.length ? 'putaranSelesai' : 'menungguPutaran',
    riwayat: riwayat.map((r, i) => hasilPalsu(i + 1, r, n)),
  };
}

/** Mulai putaran (pengocok kursi 0, supaya RNG tidak dipakai memilih pengocok) dan hitung panggilan RNG. */
function mulai(g: GameState): { g: GameState; panggilRng: number } {
  const mata = vi.spyOn(Rng.prototype, 'next');
  try {
    const hasil = terapkan(g, { jenis: 'mulaiPutaran', pengocok: 0 });
    return { g: hasil, panggilRng: mata.mock.calls.length };
  } finally {
    mata.mockRestore();
  }
}

describe('mulaiPutaran memakai joker yang beda dari putaran sebelumnya (#40)', () => {
  afterEach(() => vi.restoreAllMocks());

  it('putaran pertama tidak pernah menganulir: RNG dipakai persis seperti dulu', () => {
    for (const { n, duaDeck } of KONFIGURASI) {
      const { jumlahDeck } = aturanPembagian(n, duaDeck);
      for (let seed = 0; seed < 20; seed++) {
        const g = permainanSesudah(n, duaDeck, seed, []);
        const { g: h, panggilRng } = mulai(g);
        // Kocok (52·deck − 1) + selipkan joker (1); tanpa riwayat tidak ada yang dibandingkan.
        expect(panggilRng).toBe(jumlahDeck * 52 - 1 + 1);
        expect(h.putaran!.nomor).toBe(1);
        expect(h.putaran!.deck.map((k) => k.id)).toContain(h.putaran!.kartuDibuka.id);
        expect(periksaInvarian(h)).toEqual([]);
      }
    }
  });

  it('putaran pertama sama persis dengan cara lama (deck, tangan, dan state RNG)', () => {
    for (const seed of [1, 2, 3, 42, 'kedai']) {
      const g = terapkan(buatPermainan({ pemain: ['A', 'B', 'C', 'D'], seed }), { jenis: 'mulaiPutaran' });
      const rng = new Rng(seedKeState(seed));
      const pengocok = rng.pick([0, 1, 2, 3]);
      const deck = rng.shuffle(buatDeck(1));
      const tangan: Kartu[][] = [[], [], [], []];
      for (let i = 0; i < 6; i++) for (let p = 0; p < 4; p++) tangan[(pengocok + p) % 4].push(deck.pop()!);
      const kartuDibuka = bukaCaraLama(deck, rng);
      expect(g.putaran!.pengocok).toBe(pengocok);
      expect(g.putaran!.tangan).toEqual(tangan);
      expect(g.putaran!.kartuDibuka).toEqual(kartuDibuka);
      expect(g.putaran!.deck).toEqual(deck);
      expect(g.rng).toBe(rng.state);
    }
  });

  for (const { label, n, duaDeck } of KONFIGURASI) {
    it(`${label}: joker selalu beda dari putaran sebelumnya, kartu yang sama dianulir`, () => {
      let anulir = 0;
      let anulirBeruntun = 0;
      for (let seed = 0; seed < 150; seed++) {
        // Kartu teratas sesudah dibagi = joker kalau tidak ada anulir (putaran pertama, seed sama).
        const pertama = mulai(permainanSesudah(n, duaDeck, seed, []));
        const teratas = pertama.g.putaran!.kartuDibuka;
        const lain = ((teratas.rank % 13) + 1) as Rank;

        // Joker lalu beda dengan kartu teratas: tidak ada anulir.
        const aman = mulai(permainanSesudah(n, duaDeck, seed, [lain]));
        expect(aman.g.putaran!.kartuDibuka).toEqual(teratas);
        expect(aman.g.putaran!.deck).toEqual(pertama.g.putaran!.deck);
        expect(aman.panggilRng).toBe(pertama.panggilRng);
        expect(aman.g.putaran!.nomor).toBe(2);
        expect(periksaInvarian(aman.g)).toEqual([]);

        // Joker lalu sama dengan kartu teratas: dianulir, buka kartu lagi.
        const kena = mulai(permainanSesudah(n, duaDeck, seed, [teratas.rank]));
        const p = kena.g.putaran!;
        expect(p.rankJoker).not.toBe(teratas.rank);
        expect(p.rankJoker).toBe(p.kartuDibuka.rank);
        expect(p.kartuDibuka.id).not.toBe(teratas.id);
        expect(p.deck.map((k) => k.id)).toContain(p.kartuDibuka.id);
        expect(p.deck.map((k) => k.id)).toContain(teratas.id);
        expect(urutId(p.deck)).toEqual(urutId(pertama.g.putaran!.deck));
        expect(p.tangan).toEqual(pertama.g.putaran!.tangan);
        expect(periksaInvarian(kena.g)).toEqual([]);
        const jumlahAnulir = kena.panggilRng - pertama.panggilRng;
        expect(jumlahAnulir).toBeGreaterThanOrEqual(1);
        anulir++;
        if (jumlahAnulir >= 2) anulirBeruntun++;
      }
      expect(anulir).toBe(150);
      expect(anulirBeruntun).toBeGreaterThan(0);
    });
  }

  it('hanya dibandingkan dengan putaran tepat sebelumnya: putaran 3 boleh sama dengan putaran 1', () => {
    let diuji = 0;
    for (let seed = 0; seed < 30; seed++) {
      const teratas = mulai(permainanSesudah(4, false, seed, [])).g.putaran!.kartuDibuka;
      const lain = ((teratas.rank % 13) + 1) as Rank;
      const { g, panggilRng } = mulai(permainanSesudah(4, false, seed, [teratas.rank, lain]));
      expect(g.putaran!.nomor).toBe(3);
      expect(g.putaran!.kartuDibuka).toEqual(teratas);
      expect(g.putaran!.rankJoker).toBe(g.riwayat[0].rankJoker);
      expect(panggilRng).toBe(52 - 1 + 1);
      expect(periksaInvarian(g)).toEqual([]);
      diuji++;
    }
    expect(diuji).toBe(30);
  });

  it('pemeriksa invarian menangkap joker yang sama dengan putaran sebelumnya', () => {
    const g = mulai(permainanSesudah(3, false, 5, [])).g;
    const p = g.putaran!;
    const salahPutaran: GameState = { ...g, status: 'putaranBerjalan', riwayat: [hasilPalsu(1, p.rankJoker, 3)], putaran: { ...p, nomor: 2 } };
    expect(periksaInvarian(salahPutaran)).toContain('joker putaran 2 sama dengan putaran sebelumnya');
    const salahRiwayat: GameState = { ...g, riwayat: [hasilPalsu(1, 4, 3), hasilPalsu(2, 4, 3)], putaran: { ...p, nomor: 3 } };
    expect(periksaInvarian(salahRiwayat)).toContain('joker putaran 2 sama dengan putaran sebelumnya');
  });
});
