// Aturan hitung leaderboard (keputusan pemilik #45): skor/peringkat efektif, semua urutan beserta
// pemutus serinya, daftar "belum cukup main", perapian saringan, dan batas bulan WIB.

import { describe, expect, it } from 'vitest';
import {
  BUTUH_MIN_MAIN,
  DAFTAR_URUTAN,
  MIN_MAIN,
  SARINGAN_BAWAAN,
  URUTAN_BAWAAN,
  WIB_MS,
  bulanWib,
  hitungPeringkat,
  kunciNama,
  nilaiEfektif,
  nilaiUrutan,
  rapikanSaringan,
  rapikanUrutan,
  urutkanPeringkat,
  type BarisPeringkat,
  type KursiPeringkat,
  type PermainanPeringkat,
} from '../src/index.js';

/** Satu permainan dari [nama, skor, jenis?]; jenis 'b' = warga kedai, 'k' = keluar di tengah. */
const g = (...pemain: [string, number, ('b' | 'k')?][]): PermainanPeringkat => ({
  pemain: pemain.map(([nama, skor, j]): KursiPeringkat => ({ nama, skor, bot: j === 'b', ...(j === 'k' ? { keluar: true } : {}) })),
});

const baris = (nama: string, isi: Partial<BarisPeringkat>): BarisPeringkat => ({
  nama,
  main: 3,
  juara: 0,
  totalSkor: 0,
  rataRata: 0,
  skorTerbaik: 0,
  mentung: 0,
  kepentung: 0,
  persenJuara: 0,
  poinPosisi: 0,
  skorTerburuk: 0,
  keluar: 0,
  ...isi,
});

const nama = (xs: BarisPeringkat[]) => xs.map((b) => b.nama);

describe('nilaiEfektif', () => {
  it('tanpa yang keluar: peringkat = 1 + jumlah skor yang lebih tinggi, poin posisi 100 → 0', () => {
    const v = nilaiEfektif(g(['A', 50], ['B', 120], ['C', -30], ['D', 10]).pemain);
    expect(v.map((x) => x.peringkat)).toEqual([2, 1, 4, 3]);
    expect(v.map((x) => x.skor)).toEqual([50, 120, -30, 10]);
    expect(v.map((x) => x.juara)).toEqual([false, true, false, false]);
    expect(v.map((x) => Math.round(x.poinPosisi))).toEqual([67, 100, 0, 33]);
  });

  it('juara bareng: semua yang skornya tertinggi juara; yang di bawahnya tetap dihitung dari jumlah di atasnya', () => {
    const v = nilaiEfektif(g(['A', 80], ['B', 80], ['C', 10]).pemain);
    expect(v.map((x) => [x.peringkat, x.juara])).toEqual([
      [1, true],
      [1, true],
      [3, false],
    ]);
    expect(v[2].poinPosisi).toBe(0);
  });

  it('warga kedai ikut dihitung sebagai lawan: kalau di atas manusia, manusia turun posisi', () => {
    const v = nilaiEfektif(g(['Kipas Dua', 300, 'b'], ['Budi', 100], ['Siti', -20]).pemain);
    expect(v.map((x) => x.peringkat)).toEqual([1, 2, 3]);
    expect(v[1].juara).toBe(false);
    expect(v[1].poinPosisi).toBe(50);
  });

  it('yang keluar: juru kunci dengan skor terendah meja, walau skornya sedang paling tinggi', () => {
    const v = nilaiEfektif(g(['Budi', 400, 'k'], ['Siti', 50], ['Kipas Dua', -90, 'b']).pemain);
    expect(v[0]).toEqual({ skor: -90, peringkat: 3, juara: false, poinPosisi: 0 });
    // Kursi lain diurutkan di antara mereka sendiri: Siti juara.
    expect(v[1]).toMatchObject({ skor: 50, peringkat: 1, juara: true, poinPosisi: 100 });
    expect(v[2]).toMatchObject({ skor: -90, peringkat: 2, juara: false, poinPosisi: 50 });
  });

  it('yang keluar dengan skor paling rendah: skornya sendiri tetap dipakai', () => {
    const v = nilaiEfektif(g(['Budi', -300, 'k'], ['Siti', 50]).pemain);
    expect(v[0]).toMatchObject({ skor: -300, peringkat: 2 });
    expect(v[1]).toMatchObject({ peringkat: 1, juara: true });
  });

  it('dua orang keluar: keduanya juru kunci (peringkat n), tidak ada yang juara dari mereka', () => {
    const v = nilaiEfektif(g(['A', 100, 'k'], ['B', 90, 'k'], ['C', 0, 'b']).pemain);
    expect(v.map((x) => [x.peringkat, x.skor, x.juara])).toEqual([
      [3, 0, false],
      [3, 0, false],
      [1, 0, true],
    ]);
  });
});

describe('hitungPeringkat', () => {
  it('rata-rata skor akhir per permainan (contoh pemilik: 200 + 100 → 150)', () => {
    const [budi] = hitungPeringkat([g(['Budi', 200], ['Siti', 0]), g(['Budi', 100], ['Siti', 300])]).filter((b) => b.nama === 'Budi');
    expect(budi).toMatchObject({ main: 2, totalSkor: 300, rataRata: 150, juara: 1, persenJuara: 50, skorTerbaik: 200, skorTerburuk: 100 });
  });

  it('warga kedai tidak masuk daftar; nama digabung tanpa beda huruf besar/kecil, ejaan terakhir yang tampil', () => {
    const b = hitungPeringkat([g(['budi', 10], ['Kipas Dua', 20, 'b']), g([' BUDI ', 30], ['Kipas Dua', 0, 'b']), g(['Budi', 50], ['Siti', 60])]);
    expect(nama(b).sort()).toEqual(['Budi', 'Siti']);
    expect(b.find((x) => x.nama === 'Budi')).toMatchObject({ main: 3, totalSkor: 90, juara: 1 });
  });

  it('ejaan dari luar menimpa ejaan terakhir di data', () => {
    const b = hitungPeringkat([g(['budi', 10], ['Siti', 0])], new Map([['budi', 'BuDi']]));
    expect(nama(b)).toContain('BuDi');
  });

  it('yang keluar: dihitung juru kunci, skornya skor terendah meja, dan dicatat jumlah keluarnya', () => {
    const [budi] = hitungPeringkat([g(['Budi', 500, 'k'], ['Siti', 40], ['Kipas Dua', -60, 'b'])]);
    expect(budi).toMatchObject({ nama: 'Budi', main: 1, juara: 0, totalSkor: -60, skorTerbaik: -60, poinPosisi: 0, keluar: 1 });
  });

  it('poin posisi dirata-rata per permainan, adil antar ukuran meja', () => {
    // Juara di meja 2 orang (100) + posisi 2 dari 5 (75) → 87,5.
    const [a] = hitungPeringkat([g(['A', 10], ['B', 0]), g(['X', 50, 'b'], ['A', 40], ['C', 30], ['D', 20], ['E', 10])]);
    expect(a.poinPosisi).toBe(87.5);
  });

  it('mentung dan kepentung dijumlah; entri rusak dilewati', () => {
    const rusak = [null, { pemain: [] }, { pemain: [{ nama: 'Z', skor: NaN, bot: false }] }] as unknown as PermainanPeringkat[];
    const b = hitungPeringkat([
      ...rusak,
      { pemain: [{ nama: 'A', skor: 10, bot: false, mentung: 2, kepentung: 1 }, { nama: 'B', skor: 0, bot: false }] },
      { pemain: [{ nama: 'A', skor: 10, bot: false, mentung: 1 }, { nama: 'B', skor: 0, bot: false, kepentung: 3 }] },
    ]);
    expect(b.find((x) => x.nama === 'A')).toMatchObject({ mentung: 3, kepentung: 1, main: 2 });
    expect(b.find((x) => x.nama === 'B')).toMatchObject({ mentung: 0, kepentung: 3 });
    expect(nama(b)).not.toContain('Z');
  });

  it('kunci yang sudah dihitung (dari database) dipakai apa adanya', () => {
    const b = hitungPeringkat([
      { pemain: [{ nama: 'Budi', kunci: 'k1', skor: 1, bot: false }, { nama: 'Siti', skor: 0, bot: false }] },
      { pemain: [{ nama: 'Budi S.', kunci: 'k1', skor: 3, bot: false }, { nama: 'Siti', skor: 0, bot: false }] },
    ]);
    expect(b.find((x) => x.nama === 'Budi S.')).toMatchObject({ main: 2, totalSkor: 4 });
    expect(nama(b)).not.toContain('Budi');
  });

  it('kunciNama juga mengecilkan huruf non-ASCII (lower() SQLite hanya ASCII)', () => {
    expect(kunciNama('  ÉLIA ')).toBe(kunciNama('élia'));
    expect(kunciNama('ÇAĞRI')).toBe('çağri');
  });
});

describe('urutkanPeringkat', () => {
  // Lima pemain, semuanya sudah ≥ MIN_MAIN main kecuali Eko.
  const A = baris('Adi', { main: 4, juara: 2, totalSkor: 480, skorTerbaik: 300, persenJuara: 50, poinPosisi: 60, mentung: 5 });
  const B = baris('Budi', { main: 10, juara: 3, totalSkor: 1000, skorTerbaik: 250, persenJuara: 30, poinPosisi: 55, mentung: 9 });
  const C = baris('Cici', { main: 3, juara: 3, totalSkor: 900, skorTerbaik: 500, persenJuara: 100, poinPosisi: 100, mentung: 2 });
  const D = baris('Dodi', { main: 6, juara: 0, totalSkor: -300, skorTerbaik: 50, persenJuara: 0, poinPosisi: 20, mentung: 1 });
  const E = baris('Eko', { main: 2, juara: 2, totalSkor: 800, skorTerbaik: 600, persenJuara: 100, poinPosisi: 100, mentung: 4 });
  const semua = [A, B, C, D, E];

  it('bawaan rata-rata; konstanta sesuai keputusan pemilik', () => {
    expect(URUTAN_BAWAAN).toBe('rata');
    expect(MIN_MAIN).toBe(3);
    expect([...BUTUH_MIN_MAIN].sort()).toEqual(['persen', 'posisi', 'rata']);
    expect(DAFTAR_URUTAN).toEqual(['rata', 'terbaik', 'persen', 'juara', 'main', 'mentung', 'posisi']);
  });

  it('rata: Σ skor ÷ main; yang kurang dari 3 main masuk belumCukup', () => {
    const h = urutkanPeringkat(semua, 'rata');
    expect(nama(h.peringkat)).toEqual(['Cici', 'Adi', 'Budi', 'Dodi']);
    expect(nama(h.belumCukup)).toEqual(['Eko']);
  });

  it('persen dan posisi juga butuh minimal 3 main', () => {
    expect(nama(urutkanPeringkat(semua, 'persen').peringkat)).toEqual(['Cici', 'Adi', 'Budi', 'Dodi']);
    expect(nama(urutkanPeringkat(semua, 'posisi').peringkat)).toEqual(['Cici', 'Adi', 'Budi', 'Dodi']);
    expect(nama(urutkanPeringkat(semua, 'posisi').belumCukup)).toEqual(['Eko']);
  });

  it('terbaik, juara, main, mentung: semua ikut, tanpa belumCukup', () => {
    expect(urutkanPeringkat(semua, 'terbaik')).toEqual({ peringkat: [E, C, A, B, D], belumCukup: [] });
    // juara = urutan lama: juara, lalu total skor.
    expect(nama(urutkanPeringkat(semua, 'juara').peringkat)).toEqual(['Budi', 'Cici', 'Eko', 'Adi', 'Dodi']);
    expect(nama(urutkanPeringkat(semua, 'main').peringkat)).toEqual(['Budi', 'Dodi', 'Adi', 'Cici', 'Eko']);
    expect(nama(urutkanPeringkat(semua, 'mentung').peringkat)).toEqual(['Budi', 'Adi', 'Eko', 'Cici', 'Dodi']);
  });

  it('pemutus seri tiap urutan', () => {
    // rata sama (100): lebih sering main di atas, lalu abjad.
    const r1 = baris('Rudi', { main: 5, totalSkor: 500 });
    const r2 = baris('Ani', { main: 3, totalSkor: 300 });
    const r3 = baris('Bambang', { main: 3, totalSkor: 300 });
    expect(nama(urutkanPeringkat([r2, r3, r1], 'rata').peringkat)).toEqual(['Rudi', 'Ani', 'Bambang']);
    // terbaik sama: rata lebih tinggi.
    const t1 = baris('T1', { skorTerbaik: 200, totalSkor: 30 });
    const t2 = baris('T2', { skorTerbaik: 200, totalSkor: 90 });
    expect(nama(urutkanPeringkat([t1, t2], 'terbaik').peringkat)).toEqual(['T2', 'T1']);
    // persen sama: lebih sering main.
    const p1 = baris('P1', { main: 4, juara: 2, persenJuara: 50 });
    const p2 = baris('P2', { main: 8, juara: 4, persenJuara: 50 });
    expect(nama(urutkanPeringkat([p1, p2], 'persen').peringkat)).toEqual(['P2', 'P1']);
    // juara sama: total skor.
    const j1 = baris('J1', { juara: 2, totalSkor: 10 });
    const j2 = baris('J2', { juara: 2, totalSkor: 20 });
    expect(nama(urutkanPeringkat([j1, j2], 'juara').peringkat)).toEqual(['J2', 'J1']);
    // main sama: rata lebih tinggi.
    expect(nama(urutkanPeringkat([j1, j2], 'main').peringkat)).toEqual(['J2', 'J1']);
    // mentung sama: rata lebih tinggi.
    expect(nama(urutkanPeringkat([baris('M1', { mentung: 3, totalSkor: 0 }), baris('M2', { mentung: 3, totalSkor: 9 })], 'mentung').peringkat)).toEqual(['M2', 'M1']);
    // posisi sama: lebih sering main.
    expect(nama(urutkanPeringkat([baris('O1', { poinPosisi: 50, main: 3 }), baris('O2', { poinPosisi: 50, main: 7 })], 'posisi').peringkat)).toEqual(['O2', 'O1']);
  });

  it('pembanding memakai nilai yang belum dibulatkan', () => {
    // 301 ÷ 3 = 100,33 dan 400 ÷ 4 = 100: dibulatkan sama-sama 100, tapi X lebih tinggi.
    const x = baris('X', { main: 3, totalSkor: 301, rataRata: 100 });
    const y = baris('Y', { main: 4, totalSkor: 400, rataRata: 100 });
    expect(nama(urutkanPeringkat([y, x], 'rata').peringkat)).toEqual(['X', 'Y']);
  });

  it('nilai yang sama dari hitungan berbeda tetap seri persis (poin posisi dalam satuan bulat)', () => {
    // A: 33,3 + 66,7 + 50 (posisi 3 dan 2 dari 4, posisi 2 dari 3) → 50; B: posisi 2 dari 3 tiga kali → 50.
    const b = hitungPeringkat([
      g(['Z', 9], ['Y', 8], ['A', 5], ['X', 0]),
      g(['Z', 9], ['A', 8], ['Y', 5], ['X', 0]),
      g(['Z', 9], ['A', 5], ['Y', 0]),
      g(['Y', 9], ['B', 5], ['Z', 0]),
      g(['Y', 9], ['B', 5], ['Z', 0]),
      g(['Y', 9], ['B', 5], ['Z', 0]),
    ]);
    const a = b.find((x) => x.nama === 'A')!;
    const bb = b.find((x) => x.nama === 'B')!;
    expect(a.poinPosisi).toBe(bb.poinPosisi);
    expect(nama(urutkanPeringkat([bb, a], 'posisi').peringkat)).toEqual(['A', 'B']);
  });

  it('belumCukup urut dari paling sering main, lalu abjad; masukan tidak diubah', () => {
    const xs = [baris('Zaki', { main: 1 }), baris('Ali', { main: 2 }), baris('Beni', { main: 2 })];
    const salinan = [...xs];
    expect(nama(urutkanPeringkat(xs, 'rata').belumCukup)).toEqual(['Ali', 'Beni', 'Zaki']);
    expect(xs).toEqual(salinan);
  });

  it('nilaiUrutan: angka yang dipakai tiap urutan', () => {
    expect(nilaiUrutan(C, 'rata')).toBe(300);
    expect(nilaiUrutan(C, 'terbaik')).toBe(500);
    expect(nilaiUrutan(C, 'persen')).toBe(100);
    expect(nilaiUrutan(B, 'juara')).toBe(3);
    expect(nilaiUrutan(B, 'main')).toBe(10);
    expect(nilaiUrutan(B, 'mentung')).toBe(9);
    expect(nilaiUrutan(B, 'posisi')).toBe(55);
  });
});

describe('rapikanUrutan dan rapikanSaringan', () => {
  it('urutan tidak dikenal jatuh ke bawaan', () => {
    for (const u of DAFTAR_URUTAN) expect(rapikanUrutan(u)).toBe(u);
    for (const x of [undefined, null, '', 'RATA', 'skor', 3, {}]) expect(rapikanUrutan(x)).toBe('rata');
  });

  it('saringan longgar: angka teks diterima, sisanya bawaan', () => {
    expect(rapikanSaringan(undefined)).toEqual(SARINGAN_BAWAAN);
    expect(rapikanSaringan({ jumlahPemain: '4', jumlahDeck: '2', periode: 'bulan' })).toEqual({ jumlahPemain: 4, jumlahDeck: 2, periode: 'bulan' });
    expect(rapikanSaringan({ jumlahPemain: 6, jumlahDeck: 1, periode: 'semua' })).toEqual({ jumlahPemain: 6, jumlahDeck: 1, periode: 'semua' });
    for (const n of [1, 7, '', 'semua', '4.5', 4.5, -2, '١', null]) expect(rapikanSaringan({ jumlahPemain: n }).jumlahPemain).toBeNull();
    for (const d of [0, 3, '1 deck', 'x']) expect(rapikanSaringan({ jumlahDeck: d }).jumlahDeck).toBeNull();
    for (const p of ['BULAN', 'minggu', 1]) expect(rapikanSaringan({ periode: p }).periode).toBe('semua');
    expect(rapikanSaringan('aneh')).toEqual(SARINGAN_BAWAAN);
  });
});

describe('bulanWib', () => {
  it('awal dan akhir bulan kalender WIB (UTC+7) dalam ISO UTC', () => {
    expect(WIB_MS).toBe(7 * 3600_000);
    // 16 Okt 2026 12.00 WIB.
    expect(bulanWib(Date.UTC(2026, 9, 16, 5))).toEqual({
      dari: '2026-09-30T17:00:00.000Z',
      sampai: '2026-10-31T17:00:00.000Z',
      bulan: '2026-10',
    });
  });

  it('batas: 31 Okt 23.59 WIB masih Oktober, 1 Nov 00.00 WIB sudah November', () => {
    expect(bulanWib(Date.UTC(2026, 9, 31, 16, 59, 59, 999)).bulan).toBe('2026-10');
    expect(bulanWib(Date.UTC(2026, 9, 31, 17)).bulan).toBe('2026-11');
    // 30 Sep 17.00 UTC = 1 Okt 00.00 WIB.
    expect(bulanWib(Date.UTC(2026, 8, 30, 17)).bulan).toBe('2026-10');
    expect(bulanWib(Date.UTC(2026, 8, 30, 16, 59)).bulan).toBe('2026-09');
  });

  it('pergantian tahun', () => {
    expect(bulanWib(Date.UTC(2026, 11, 31, 17))).toEqual({ dari: '2026-12-31T17:00:00.000Z', sampai: '2027-01-31T17:00:00.000Z', bulan: '2027-01' });
    expect(bulanWib(Date.UTC(2026, 11, 15)).sampai).toBe('2026-12-31T17:00:00.000Z');
  });
});
