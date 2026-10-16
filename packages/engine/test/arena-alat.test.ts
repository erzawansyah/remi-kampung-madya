// Alat arena (packages/engine/scripts): pengurai peserta "level:gaya" dan metrik keterbacaan.
// Arena sendiri tidak ikut npm test; yang diuji di sini fungsi murni yang dipakainya.

import { describe, expect, it } from 'vitest';
import {
  buatPermainan,
  pilihAksiBot,
  Rng,
  terapkan,
  viewUntuk,
  type Aksi,
  type GameState,
  type HasilPutaran,
  type IsiPeristiwa,
  type Peristiwa,
} from '../src/index.js';
import {
  entropiBit,
  hitungDisuap,
  isLondoTerpencil,
  KELAS_BUANG,
  kelasBuang,
  menyambung,
  PencatatBaca,
  ringkas,
  ringkasEntropi,
  ringkasRasio,
  statBacaKosong,
  type StatBaca,
} from '../scripts/keterbacaan.js';
import {
  GAYA_ACAK,
  gayaUntukKursi,
  labelPeserta,
  silangGaya,
  uraiDaftarGaya,
  uraiPeserta,
} from '../scripts/peserta.js';
import { ctx, kartu, kartuJadi, kartuSemua, skenario } from './bantu.js';

describe('peserta arena', () => {
  const gaya = ['standar', 'kilat', 'penahan'];

  it('level polos dan level:standar berlabel level saja', () => {
    expect(uraiPeserta('jago', gaya)).toEqual({ label: 'jago', level: 'jago', gaya: 'standar' });
    expect(uraiPeserta('jago:standar', gaya)).toEqual({ label: 'jago', level: 'jago', gaya: 'standar' });
    expect(uraiPeserta('suhu:kilat', gaya)).toEqual({ label: 'suhu:kilat', level: 'suhu', gaya: 'kilat' });
    expect(uraiPeserta('normal:acak', ['standar'])).toEqual({ label: 'normal:acak', level: 'normal', gaya: GAYA_ACAK });
    expect(labelPeserta('mudah', 'standar')).toBe('mudah');
  });

  it('menolak level, gaya, atau format yang tidak dikenal', () => {
    expect(() => uraiPeserta('dewa', gaya)).toThrow(/level tidak dikenal/);
    expect(() => uraiPeserta('jago:kilat', ['standar'])).toThrow(/gaya tidak dikenal/);
    expect(() => uraiPeserta('jago:kilat:x', gaya)).toThrow(/level:gaya/);
    expect(() => uraiDaftarGaya('kilat,ngawur', gaya)).toThrow(/gaya tidak dikenal/);
  });

  it('--gaya dikalikan dengan --uji, "semua" = seluruh daftar', () => {
    expect(uraiDaftarGaya('semua', gaya)).toEqual(gaya);
    const uji = ['normal', 'suhu'].map((x) => uraiPeserta(x, gaya));
    expect(silangGaya(uji, ['standar', 'kilat']).map((p) => p.label)).toEqual([
      'normal',
      'normal:kilat',
      'suhu',
      'suhu:kilat',
    ]);
    expect(silangGaya(uji, null)).toEqual(uji);
    expect(() => silangGaya([uraiPeserta('suhu:kilat', gaya)], ['standar'])).toThrow(/sudah bergaya/);
  });

  it('acak: gaya non-standar dari seed dan kursi; tanpa gaya lain jadi standar', () => {
    expect(gayaUntukKursi(GAYA_ACAK, 5, 2, ['standar'])).toBe('standar');
    expect(gayaUntukKursi('kilat', 5, 2, gaya)).toBe('kilat');
    const tujuh = ['standar', 'a', 'b', 'c', 'd', 'e', 'f'];
    // 1 + ((seed·7 + kursi·3) mod 6)
    expect(gayaUntukKursi(GAYA_ACAK, 1, 1, tujuh)).toBe(tujuh[1 + ((7 + 3) % 6)]);
    expect(gayaUntukKursi(GAYA_ACAK, 20, 4, tujuh)).toBe(tujuh[1 + ((140 + 12) % 6)]);
    for (let s = 1; s < 30; s++) {
      for (let k = 0; k < 6; k++) expect(gayaUntukKursi(GAYA_ACAK, s, k, tujuh)).not.toBe('standar');
    }
  });
});

describe('klasifikasi buangan', () => {
  const c = ctx(4);

  it('kelas: 2–5, 6–10, Londo, As, joker hidup; joker mati dinilai kartu aslinya', () => {
    expect(KELAS_BUANG).toEqual(['kecil', 'besar', 'londo', 'as', 'joker']);
    expect(kelasBuang(kartu('2 love'), c)).toBe('kecil');
    expect(kelasBuang(kartu('5 love'), c)).toBe('kecil');
    expect(kelasBuang(kartu('6 love'), c)).toBe('besar');
    expect(kelasBuang(kartu('10 love'), c)).toBe('besar');
    expect(kelasBuang(kartu('J love'), c)).toBe('londo');
    expect(kelasBuang(kartu('As love'), c)).toBe('as');
    expect(kelasBuang(kartu('4 love'), c)).toBe('joker');
    expect(kelasBuang(kartu('4 love'), ctx(4, [kartu('4 love').id]))).toBe('kecil');
    expect(kelasBuang(kartu('As waru'), ctx(1))).toBe('joker');
  });

  it('Londo terpencil: tanpa Londo lain sebunga yang beda angka', () => {
    const tangan = kartuSemua('J love', 'K waru', 'Q waru', 'J kriting', 'J kriting#1', '7 love');
    expect(isLondoTerpencil(kartu('J love'), tangan, c)).toBe(true);
    expect(isLondoTerpencil(kartu('K waru'), tangan, c)).toBe(false);
    // Kartu kembar dari deck kedua bukan pasangan seri.
    expect(isLondoTerpencil(kartu('J kriting'), tangan, c)).toBe(true);
    expect(isLondoTerpencil(kartu('7 love'), tangan, c)).toBe(false);
    // Joker hidup bukan Londo dan bukan pasangan.
    const cQ = ctx(12);
    const t2 = kartuSemua('J love', 'Q love');
    expect(isLondoTerpencil(kartu('J love'), t2, cQ)).toBe(true);
    expect(isLondoTerpencil(kartu('Q love'), t2, cQ)).toBe(false);
  });

  it('menyambung: sebunga selisih 1 (2–10), atau Londo sebunga beda angka', () => {
    expect(menyambung(kartu('7 love'), kartu('6 love'), c)).toBe(true);
    expect(menyambung(kartu('7 love'), kartu('8 love'), c)).toBe(true);
    expect(menyambung(kartu('7 love'), kartu('9 love'), c)).toBe(false);
    expect(menyambung(kartu('7 love'), kartu('6 waru'), c)).toBe(false);
    expect(menyambung(kartu('J love'), kartu('10 love'), c)).toBe(false);
    expect(menyambung(kartu('2 love'), kartu('As love'), c)).toBe(false);
    expect(menyambung(kartu('Q love'), kartu('K love'), c)).toBe(true);
    expect(menyambung(kartu('J love'), kartu('K love'), c)).toBe(true);
    expect(menyambung(kartu('K love'), kartu('K love#1'), c)).toBe(false);
    // Joker hidup tidak dihitung menyambung.
    expect(menyambung(kartu('4 love'), kartu('5 love'), c)).toBe(false);
  });
});

describe('statistik', () => {
  it('entropi dalam bit', () => {
    expect(entropiBit([1, 1, 1, 1, 0])).toBeCloseTo(2);
    expect(entropiBit([5, 0, 0, 0, 0])).toBe(0);
    expect(entropiBit([0, 0])).toBe(0);
    expect(entropiBit([1, 1, 1, 1, 1])).toBeCloseTo(Math.log2(5));
  });

  it('rasio: Σa/Σb dengan CI linearisasi per sampel', () => {
    const a = [1, 2, 0, 3];
    const b = [2, 4, 1, 3];
    const r = ringkasRasio(a, b);
    expect(r.rata).toBeCloseTo(6 / 10);
    expect(r.n).toBe(10);
    const rataB = 10 / 4;
    const z = a.map((x, i) => (x - 0.6 * b[i]) / rataB);
    expect(r.ci).toBeCloseTo(ringkas(z).ci);
    // Proporsi yang sama di semua sampel: tanpa ketidakpastian.
    expect(ringkasRasio([1, 2, 3], [2, 4, 6]).ci).toBeCloseTo(0);
    expect(Number.isNaN(ringkasRasio([0, 0], [0, 0]).rata)).toBe(true);
  });

  it('entropi gabungan dengan jackknife', () => {
    const sama = ringkasEntropi([
      [1, 1, 0, 0, 0],
      [2, 2, 0, 0, 0],
      [1, 1, 0, 0, 0],
    ]);
    expect(sama.rata).toBeCloseTo(1);
    expect(sama.ci).toBeCloseTo(0);
    expect(sama.n).toBe(8);
    const beda = ringkasEntropi([
      [4, 0, 0, 0, 0],
      [0, 4, 0, 0, 0],
      [2, 2, 0, 0, 0],
    ]);
    expect(beda.rata).toBeCloseTo(1);
    expect(beda.ci).toBeGreaterThan(0);
  });
});

describe('hitungDisuap', () => {
  let nomor = 0;
  const e = (putaran: number, isi: IsiPeristiwa): Peristiwa => ({ ...isi, id: ++nomor, putaran }) as Peristiwa;
  const buang = (putaran: number, pemain: number, teks: string, sisaTangan: number) =>
    e(putaran, { jenis: 'buang', pemain, kartu: kartu(teks), jokerDibuang: false, sisaTangan });
  const mulung = (putaran: number, pemain: number, dari: [string, number][]) =>
    e(putaran, {
      jenis: 'mulung',
      pemain,
      kartu: dari.map(([t, pemilik]) => ({ kartu: kartu(t), pemilik })),
      idKartuJadi: ['kj1'],
      sapuBersih: false,
      beruntun: 1,
      kembarAs: false,
    });
  const riwayat = [
    { nomor: 1, arahSebelumnya: 1 },
    { nomor: 2, arahSebelumnya: -1 },
  ] as HasilPutaran[];

  it('menghitung buangan yang langsung dipungut pemain berikutnya, mengikuti arah putaran', () => {
    const peristiwa = [
      e(1, { jenis: 'mulaiPutaran', pengocok: 0, rankJoker: 4 }),
      e(1, { jenis: 'ambilDeck', pemain: 0, deckHabis: false }),
      buang(1, 0, '7 love', 5),
      mulung(1, 1, [['7 love', 0]]),
      buang(1, 1, '9 waru', 4),
      e(1, { jenis: 'ambilDeck', pemain: 2, deckHabis: false }),
      // Mentung tidak dihitung.
      buang(1, 2, 'K waru', 0),
      e(1, { jenis: 'susunAkhir', sebab: 'mentung' }),
      e(1, { jenis: 'putaranSelesai', cara: 'mentung' }),
      e(2, { jenis: 'mulaiPutaran', pengocok: 1, rankJoker: 9 }),
      buang(2, 0, '3 wajik', 6),
      // Arah −1: sesudah pemain 0 giliran pemain 2.
      mulung(2, 2, [
        ['2 wajik', 1],
        ['3 wajik', 0],
      ]),
      buang(2, 2, '5 wajik', 3),
      // Deck habis: buangan terakhir tidak sempat diambil siapa pun.
      e(2, { jenis: 'susunAkhir', sebab: 'deckHabis' }),
    ];
    expect(hitungDisuap(peristiwa, riwayat, 3)).toEqual({ dasar: [2, 1, 0], disuap: [2, 0, 0] });
  });

  it('gagal keras kalau yang mengambil bukan pemain berikutnya', () => {
    const peristiwa = [buang(1, 0, '7 love', 5), e(1, { jenis: 'ambilDeck', pemain: 2, deckHabis: false })];
    expect(() => hitungDisuap(peristiwa, riwayat, 3)).toThrow(/bukan 1/);
  });
});

describe('PencatatBaca', () => {
  const buatPencatat = (n: number) => {
    const stat: StatBaca[] = Array.from({ length: n }, statBacaKosong);
    return { stat, p: new PencatatBaca((k) => stat[k]) };
  };
  const aksiBuang = (pemain: number, teks: string): Extract<Aksi, { jenis: 'buang' }> => ({
    jenis: 'buang',
    pemain,
    kartuId: kartu(teks).id,
  });
  /** Meja 3 pemain, pemain 0 sudah ambil dari deck; buangan teratas milik pemain 2 (pemain sebelumnya). */
  const meja = (tangan0: string[], opsi: { kartuJadi0?: boolean } = {}): GameState => {
    let g = skenario({
      rankJoker: 4,
      tangan: [tangan0, ['2 waru', '3 waru', '8 waru'], ['2 kriting', '3 kriting', '8 kriting']],
      buangan: [['6 kriting', 2]],
      kartuJadi: opsi.kartuJadi0 ? [[['5 love', '6 love', '7 love']]] : undefined,
      deck: ['9 wajik', '10 wajik', '2 wajik'],
      giliran: 0,
    });
    g = terapkan(g, { jenis: 'ambilDeck', pemain: 0 });
    return g;
  };

  it('buangan Londo terpencil di awal putaran tercatat di semua metrik', () => {
    const { stat, p } = buatPencatat(3);
    p.sebelumBuang(meja(['J love', 'K waru', 'Q waru', '7 kriting']), aksiBuang(0, 'J love'));
    const s = stat[0];
    expect([s.lIsoA, s.lIsoB]).toEqual([1, 1]);
    expect([s.asA, s.asB]).toEqual([0, 0]);
    expect([s.diniA, s.diniB]).toEqual([1, 1]);
    expect([s.londo1Jumlah, s.londo1N]).toEqual([1, 1]);
    expect([s.sambungA, s.sambungB]).toEqual([0, 1]);
    expect(s.kelasAwal).toEqual([0, 0, 1, 0, 0]);
  });

  it('buangan yang menyambung buangan pemain sebelumnya', () => {
    const { stat, p } = buatPencatat(3);
    p.sebelumBuang(meja(['J love', 'K waru', 'Q waru', '7 kriting']), aksiBuang(0, '7 kriting'));
    const s = stat[0];
    expect([s.sambungA, s.sambungB]).toEqual([1, 1]);
    expect([s.lIsoA, s.lIsoB]).toEqual([0, 1]);
    expect([s.diniA, s.diniB]).toEqual([0, 0]);
    expect(s.kelasAwal).toEqual([0, 1, 0, 0, 0]);
  });

  it('As hanya dihitung kalau sah dibuang (sudah punya kartu jadi)', () => {
    const tanpaJadi = buatPencatat(3);
    tanpaJadi.p.sebelumBuang(meja(['As love', 'K waru', '9 kriting']), aksiBuang(0, '9 kriting'));
    expect([tanpaJadi.stat[0].asA, tanpaJadi.stat[0].asB]).toEqual([0, 0]);
    const punyaJadi = buatPencatat(3);
    punyaJadi.p.sebelumBuang(meja(['As love', 'K waru', '9 kriting'], { kartuJadi0: true }), aksiBuang(0, 'As love'));
    expect([punyaJadi.stat[0].asA, punyaJadi.stat[0].asB]).toEqual([1, 1]);
    expect(punyaJadi.stat[0].kelasAwal).toEqual([0, 0, 0, 1, 0]);
  });

  it('Londo sesudah pemain lain membuang Londo tidak dihitung dini; nomor buangan bertambah per pemain', () => {
    const { stat, p } = buatPencatat(3);
    const g = meja(['J love', 'K waru', 'Q waru', '7 kriting']);
    p.sebelumBuang(g, aksiBuang(0, '7 kriting'));
    // Pemain 1 membuang Londo (state dibaca apa adanya; pencatat hanya membaca tangan dan buangan).
    g.putaran!.tangan[1] = kartuSemua('Q kriting', '3 waru');
    g.putaran!.sumberAmbil = 'deck';
    p.sebelumBuang(g, aksiBuang(1, 'Q kriting'));
    p.sebelumBuang(g, aksiBuang(0, 'J love'));
    expect([stat[1].diniA, stat[1].diniB]).toEqual([1, 1]);
    expect([stat[0].diniA, stat[0].diniB]).toEqual([0, 1]);
    // Londo pertama pemain 0 ada di buangan sendirinya yang ke-2.
    expect([stat[0].londo1Jumlah, stat[0].londo1N]).toEqual([2, 1]);
  });

  it('buangan mentung tidak dihitung', () => {
    const { stat, p } = buatPencatat(3);
    const g = meja(['J love', 'K waru']);
    g.putaran!.tangan[0] = kartuSemua('J love');
    g.putaran!.sumberAmbil = 'buangan';
    g.putaran!.kartuJadi[0] = [kartuJadi(0, ctx(4), '5 love', '6 love', '7 love')];
    p.sebelumBuang(g, aksiBuang(0, 'J love'));
    expect(stat[0]).toEqual(statBacaKosong());
  });

  it('permainan bot penuh: hitungan konsisten dengan peristiwa', () => {
    const n = 4;
    let g = buatPermainan({ pemain: ['A', 'B', 'C', 'D'], seed: 7, konfigurasi: { batasPutaran: 3 } });
    const rng = new Rng(11);
    const { stat, p } = buatPencatat(n);
    let langkah = 0;
    while (g.status !== 'selesai') {
      let aksi: Aksi;
      if (g.status === 'putaranBerjalan') aksi = pilihAksiBot(viewUntuk(g, g.putaran!.giliran), 'normal', rng);
      else if (g.status === 'susunAkhir') {
        const belum = g.putaran!.selesaiSusun.findIndex((x) => !x);
        aksi = pilihAksiBot(viewUntuk(g, belum), 'normal', rng);
      } else aksi = { jenis: 'mulaiPutaran' };
      if (aksi.jenis === 'buang') p.sebelumBuang(g, aksi);
      g = terapkan(g, aksi);
      if (++langkah > 20000) throw new Error('permainan tidak selesai');
    }
    p.akhir(g);
    // Buangan ke-1..3 per pemain per putaran, dihitung ulang dari peristiwa.
    const perPutaranPemain = new Map<string, number>();
    for (const e of g.peristiwa) {
      if (e.jenis !== 'buang' || e.sisaTangan === 0) continue;
      const kunci = `${e.putaran}/${e.pemain}`;
      perPutaranPemain.set(kunci, (perPutaranPemain.get(kunci) ?? 0) + 1);
    }
    for (let i = 0; i < n; i++) {
      const awal = [...perPutaranPemain].filter(([k]) => k.endsWith(`/${i}`)).reduce((s, [, x]) => s + Math.min(3, x), 0);
      const s = stat[i];
      expect(s.kelasAwal.reduce((a, b) => a + b, 0)).toBe(awal);
      for (const [a, b] of [
        [s.lIsoA, s.lIsoB],
        [s.asA, s.asB],
        [s.diniA, s.diniB],
        [s.sambungA, s.sambungB],
        [s.suapA, s.suapB],
      ]) {
        expect(a).toBeLessThanOrEqual(b);
      }
      expect(s.londo1N).toBeLessThanOrEqual(s.diniB);
      expect(s.londo1Jumlah).toBeGreaterThanOrEqual(s.londo1N);
      expect(s.suapB).toBeGreaterThan(0);
    }
  });
});
