// Kompetisi (keputusan pemilik #51, versi 2 24 Okt 2026): masa berlaku, status, nilai 0–10 per
// permainan, klasemen rata-rata (seri: lebih sering main, rata-rata skor, abjad), juara, isi pesan
// kompetisiHasil, voting tutup, pengaturan yang dikunci (termasuk jumlah pemain dan batas putaran),
// validasi tiket, dan meja kompetisi (tanpa warga kedai, mulai sendiri saat penuh, tanpa Main lagi,
// waktu mulai dicatat, ringkasan akhir dengan id peserta).

import { describe, expect, it } from 'vitest';
import { Rng, putaranBerikutKaldu } from '@remi/engine';
import {
  BATAS_PENGAJUAN_MS,
  BATAS_PUTARAN_KOMPETISI_BAWAAN,
  DETIK_GILIRAN_KOMPETISI_BAWAAN,
  JEDA_MULAI_KOMPETISI_MS,
  MIN_BERTAHAN_KOMPETISI,
  MIN_MAIN_KOMPETISI,
  Meja,
  PENGATURAN_KOMPETISI_BAWAAN,
  PILIHAN_BATAS_PUTARAN_KOMPETISI,
  PILIHAN_DETIK_GILIRAN_KOMPETISI,
  TEKS_TANPA_VOTING_KOMPETISI,
  TENGGANG_SAMBUNG_MS,
  akhirKompetisi,
  berjalanPada,
  dataMejaDipulihkan,
  hasilKompetisiMeja,
  hitungKlasemenKompetisi,
  juaraKompetisi,
  kursiDicatatKompetisi,
  nilaiKompetisi,
  permainanKompetisiDihitung,
  rapikanNamaKompetisi,
  rapikanPengaturanKompetisi,
  statusKompetisi,
  teksNilai,
  tutupDisetujui,
  ubahanTerkunci,
  validasiPesan,
  type HasilKompetisi,
  type KompetisiDataMeja,
  type OpsiMeja,
  type RingkasanAkhir,
} from '../src/index.js';
import { aksiManusia, siapkan, siapSemua } from './bantu.js';

const JAM = 60 * 60 * 1000;
/** ms epoch untuk jam WIB (UTC+7) tanggal tertentu Okt 2026. */
const wib = (tgl: number, jam: number, menit = 0) => Date.UTC(2026, 9, tgl, jam - 7, menit);

describe('masa berlaku kompetisi', () => {
  it('1 malam berakhir 06.00 WIB berikutnya, paling cepat 3 jam lagi', () => {
    expect(akhirKompetisi('malam', wib(23, 20))).toBe(wib(24, 6));
    expect(akhirKompetisi('malam', wib(23, 2))).toBe(wib(23, 6));
    expect(akhirKompetisi('malam', wib(23, 3))).toBe(wib(23, 6));
    expect(akhirKompetisi('malam', wib(23, 3, 1))).toBe(wib(24, 6));
    expect(akhirKompetisi('malam', wib(23, 5))).toBe(wib(24, 6));
    expect(akhirKompetisi('malam', wib(23, 6))).toBe(wib(24, 6));
    // Pergantian hari WIB yang masih tanggal sebelumnya di UTC.
    expect(akhirKompetisi('malam', wib(24, 1))).toBe(wib(24, 6));
  });

  it('1 minggu dan 1 bulan dihitung dari saat jalan', () => {
    expect(akhirKompetisi('minggu', wib(23, 20))).toBe(wib(30, 20));
    expect(akhirKompetisi('bulan', wib(1, 9))).toBe(wib(31, 9));
  });

  it('status: pengajuan → batal sesudah 24 jam; berjalan → selesai saat masa habis atau ditutup', () => {
    const aju = { diajukanPada: 1000, mulaiPada: null, berakhirPada: null, ditutupPada: null };
    expect(statusKompetisi(aju, 1000 + BATAS_PENGAJUAN_MS - 1)).toBe('pengajuan');
    expect(statusKompetisi(aju, 1000 + BATAS_PENGAJUAN_MS)).toBe('batal');
    const jalan = { ...aju, mulaiPada: 5000, berakhirPada: 5000 + JAM };
    // Yang sudah jalan tidak pernah batal karena batas pengajuan.
    expect(statusKompetisi(jalan, 1000 + BATAS_PENGAJUAN_MS)).toBe('selesai');
    expect(statusKompetisi(jalan, 5000 + JAM - 1)).toBe('berjalan');
    expect(statusKompetisi(jalan, 5000 + JAM)).toBe('selesai');
    expect(statusKompetisi({ ...jalan, ditutupPada: 6000 }, 6000)).toBe('selesai');
  });

  it('berjalan pada waktu mulai permainan: sejak jalan sampai sebelum berakhir atau disudahi', () => {
    const aju = { diajukanPada: 1000, mulaiPada: null, berakhirPada: null, ditutupPada: null };
    expect(berjalanPada(aju, 2000)).toBe(false);
    const jalan = { ...aju, mulaiPada: 5000, berakhirPada: 5000 + JAM };
    expect(berjalanPada(jalan, 4999)).toBe(false);
    expect(berjalanPada(jalan, 5000)).toBe(true);
    expect(berjalanPada(jalan, 5000 + JAM - 1)).toBe(true);
    expect(berjalanPada(jalan, 5000 + JAM)).toBe(false);
    // Disudahi lewat voting: yang dimulai sebelum disudahi tetap berjalan pada waktu mulainya.
    const disudahi = { ...jalan, ditutupPada: 9000 };
    expect(berjalanPada(disudahi, 8999)).toBe(true);
    expect(berjalanPada(disudahi, 9000)).toBe(false);
  });

  it('voting tutup lolos kalau lebih dari separuh peserta setuju', () => {
    expect(tutupDisetujui(2, 4)).toBe(false);
    expect(tutupDisetujui(3, 4)).toBe(true);
    expect(tutupDisetujui(3, 5)).toBe(true);
    expect(tutupDisetujui(2, 5)).toBe(false);
    expect(tutupDisetujui(0, 0)).toBe(false);
  });
});

describe('nilai per permainan (0–10)', () => {
  const nilai = (skor: number[]) => nilaiKompetisi(skor.map((s, i) => ({ nama: String(i), bot: false, skor: s }))).map((v) => v.nilai);

  it('meja 4 orang: 10; 6,67; 3,33; 0, dihitung dari banyaknya kursi lain yang dikalahkan', () => {
    const v = nilaiKompetisi([120, 30, -10, -200].map((skor, i) => ({ nama: String(i), bot: false, skor })));
    expect(v.map((x) => [x.dikalahkan, x.lawan])).toEqual([[3, 3], [2, 3], [1, 3], [0, 3]]);
    expect(v.map((x) => x.nilai)).toEqual([10, 20 / 3, 10 / 3, 0]);
    expect(v.map((x) => teksNilai(x.nilai))).toEqual(['10,0', '6,7', '3,3', '0,0']);
  });

  it('skor sama tidak saling mengalahkan; meja 2, 3, dan 6 orang', () => {
    expect(nilai([50, 50, 0])).toEqual([5, 5, 0]);
    expect(nilai([10, -10])).toEqual([10, 0]);
    expect(nilai([0, 0])).toEqual([0, 0]);
    expect(nilai([60, 50, 40, 30, 20, 10])).toEqual([10, 8, 6, 4, 2, 0]);
  });

  // Keputusan pemilik 24 Okt 2026 "Yang keluar tak dihitung": yang keluar tetap 0, tapi tidak
  // dihitung "dikalahkan" untuk siapa pun; yang lain hanya dibandingkan dengan yang bertahan.
  const kursi = (...x: [string, number, boolean?][]) => x.map(([nama, skor, keluar]) => ({ nama, bot: false, skor, ...(keluar ? { keluar } : {}) }));

  it('meja 4 orang, 1 keluar: nilai dibagi (yang bertahan − 1), yang keluar 0 dan tidak dihitung dikalahkan', () => {
    // Skor yang keluar tinggi atau rendah tidak berpengaruh ke nilai siapa pun.
    for (const skorKabur of [300, -500]) {
      const pemain = kursi(['Kabur', skorKabur, true], ['A', 50], ['B', 10], ['C', -20]);
      const v = nilaiKompetisi(pemain);
      expect(v.map((x) => [x.dikalahkan, x.lawan])).toEqual([[0, 3], [2, 2], [1, 2], [0, 2]]);
      expect(v.map((x) => x.nilai)).toEqual([0, 10, 5, 0]);
      expect(permainanKompetisiDihitung(pemain)).toBe(true);
    }
  });

  it('meja 4 orang, 2 keluar: yang bertahan cuma saling dibandingkan (10 dan 0; seri 0 dan 0)', () => {
    const v = nilaiKompetisi(kursi(['A', -400], ['Kabur1', 900, true], ['B', -450], ['Kabur2', -900, true]));
    expect(v.map((x) => [x.dikalahkan, x.lawan])).toEqual([[1, 1], [0, 2], [0, 1], [0, 2]]);
    expect(v.map((x) => x.nilai)).toEqual([10, 0, 0, 0]);
    expect(nilaiKompetisi(kursi(['A', 0], ['B', 0], ['K1', 0, true], ['K2', 0, true])).map((x) => x.nilai)).toEqual([0, 0, 0, 0]);
    expect(permainanKompetisiDihitung(kursi(['A', 0], ['B', 0], ['K1', 0, true], ['K2', 0, true]))).toBe(true);
  });

  it('meja 4 orang, 3 keluar (atau semua): tidak dihitung untuk yang bertahan, yang keluar tetap dicatat 0', () => {
    const tiga = kursi(['K1', 100, true], ['Tinggal', -300], ['K2', 50, true], ['K3', -900, true]);
    expect(permainanKompetisiDihitung(tiga)).toBe(false);
    expect(nilaiKompetisi(tiga).map((x) => x.nilai)).toEqual([0, 0, 0, 0]);
    expect(kursiDicatatKompetisi(tiga)).toEqual([true, false, true, true]);
    const semua = kursi(['K1', 100, true], ['K2', 50, true], ['K3', -900, true], ['K4', 0, true]);
    expect(permainanKompetisiDihitung(semua)).toBe(false);
    expect(kursiDicatatKompetisi(semua)).toEqual([true, true, true, true]);
    expect(nilaiKompetisi(semua).map((x) => [x.dikalahkan, x.lawan, x.nilai])).toEqual([[0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0]]);
    // Meja 2 orang: satu keluar = tinggal satu yang bertahan; yang keluar saja yang dicatat.
    expect(permainanKompetisiDihitung(kursi(['A', -10], ['B', 10, true]))).toBe(false);
    expect(kursiDicatatKompetisi(kursi(['A', -10], ['B', 10, true]))).toEqual([false, true]);
    expect(permainanKompetisiDihitung(kursi(['A', -10], ['B', 10]))).toBe(true);
    // Permainan yang dihitung: semua kursi dicatat, termasuk yang keluar.
    expect(kursiDicatatKompetisi(kursi(['A', 0], ['B', 0], ['K1', 0, true]))).toEqual([true, true, true]);
    expect(MIN_BERTAHAN_KOMPETISI).toBe(2);
    // Pesan kompetisiHasil untuk permainan yang tidak dihitung: kosong.
    const k = hitungKlasemenKompetisi([{ id: 1, nama: 'Tinggal' }], []);
    expect(hasilKompetisiMeja(tiga.map((p, i) => ({ ...p, kursi: i, peserta: i + 1 })), k, k)).toEqual([]);
  });

  it('seri di antara yang bertahan tetap tidak saling mengalahkan; yang keluar tidak ikut seri', () => {
    const v = nilaiKompetisi(kursi(['A', 50], ['B', 50], ['Kabur', 50, true], ['C', 0]));
    expect(v.map((x) => [x.dikalahkan, x.lawan])).toEqual([[1, 2], [1, 2], [0, 3], [0, 2]]);
    expect(v.map((x) => x.nilai)).toEqual([5, 5, 0, 0]);
    // Meja 6 orang, 1 keluar: pembaginya 4.
    const enam = nilaiKompetisi(kursi(['A', 60], ['B', 50], ['K', 999, true], ['C', 40], ['D', 40], ['E', 10]));
    expect(enam.map((x) => x.nilai)).toEqual([10, 7.5, 0, 2.5, 2.5, 0]);
  });

  it('teks nilai: satu desimal dengan koma, setengah dibulatkan ke atas', () => {
    expect(teksNilai(35 / 6)).toBe('5,8');
    expect(teksNilai(0.25)).toBe('0,3');
    expect(teksNilai(0.05)).toBe('0,1');
    expect(teksNilai(10)).toBe('10,0');
    expect(teksNilai(Number.NaN)).toBe('0,0');
  });
});

describe('klasemen kompetisi', () => {
  const peserta = ['Ani', 'Budi', 'Cici', 'Dodi', 'Eko', 'Fafa'].map((nama, i) => ({ id: i + 1, nama }));
  /** Satu hasil: dikalahkan dari lawan, skor. */
  const h = (p: number, dikalahkan: number, lawan: number, skor: number, extra: Partial<HasilKompetisi> = {}): HasilKompetisi => ({
    peserta: p,
    dikalahkan,
    lawan,
    skor,
    juara: dikalahkan === lawan && lawan > 0,
    keluar: false,
    ...extra,
  });

  it(`rata-rata nilai per permainan; minimal ${MIN_MAIN_KOMPETISI}× main; meja ramai tidak lebih bernilai per permainan`, () => {
    const { peringkat, belumCukup } = hitungKlasemenKompetisi(peserta, [
      // Ani: 10, 10, 0 (meja 2 orang) → rata 6,67.
      h(1, 1, 1, 50), h(1, 1, 1, 50), h(1, 0, 1, -50),
      // Budi: 6,67 × 4 (meja 4 orang, kedua terus) → rata 6,67, tapi lebih sering main → di atas Ani.
      h(2, 2, 3, 0), h(2, 2, 3, 0), h(2, 2, 3, 0), h(2, 2, 3, 0),
      // Cici: 8, 8, 8 (meja 6 orang, kedua terus) → rata 8, teratas.
      h(3, 4, 5, -10), h(3, 4, 5, -10), h(3, 4, 5, -10),
      // Dodi keluar sekali (0) → rata (10 + 10 + 0) / 3.
      h(4, 3, 3, 20), h(4, 3, 3, 20), h(4, 0, 3, -300, { keluar: true }),
      // Eko cuma 2 kali main.
      h(5, 3, 3, 500), h(5, 3, 3, 500),
      // Peserta tak dikenal dilewati.
      h(99, 5, 5, 5),
    ]);
    expect(peringkat.map((b) => [b.nama, b.peringkat])).toEqual([
      ['Cici', 1],
      ['Budi', 2],
      // Ani dan Dodi: rata-rata 6,67 dan main 3 kali; Dodi rata-rata skornya (−260/3) di bawah Ani (50/3).
      ['Ani', 3],
      ['Dodi', 4],
    ]);
    expect(peringkat[0]).toMatchObject({ main: 3, juara: 0, totalNilai: 24, rataNilai: 8, rataSkor: -10 });
    expect(peringkat[3]).toMatchObject({ keluar: 1, juara: 2 });
    expect(teksNilai(peringkat[1].rataNilai)).toBe('6,7');
    expect(belumCukup.map((b) => [b.nama, b.main, b.peringkat])).toEqual([
      ['Eko', 2, null],
      ['Fafa', 0, null],
    ]);
  });

  it('seri persis tidak terpisah galat pecahan; seri berbagi peringkat, abjad hanya urutan tampil', () => {
    const { peringkat } = hitungKlasemenKompetisi(peserta, [
      // Budi: 3,33 × 3 (meja 4 orang) = 10 total.
      h(2, 1, 3, 0), h(2, 1, 3, 0), h(2, 1, 3, 0),
      // Ani: 6,67 + 0 + 3,33 = 10 total, sama persis dengan Budi (skor juga sama).
      h(1, 2, 3, 0), h(1, 0, 3, 0), h(1, 1, 3, 0),
      // Cici: 2 + 4 + 4 (meja 6 orang) = 10 total, juga sama.
      h(3, 1, 5, 0), h(3, 2, 5, 0), h(3, 2, 5, 0),
      // Dodi sedikit di bawah: 0 + 4 + 4 = 8 total... ditambah skor tinggi tidak menolong.
      h(4, 0, 5, 900), h(4, 2, 5, 900), h(4, 2, 5, 900),
    ]);
    expect(peringkat.map((b) => [b.nama, b.peringkat])).toEqual([
      ['Ani', 1],
      ['Budi', 1],
      ['Cici', 1],
      ['Dodi', 4],
    ]);
    expect(juaraKompetisi({ peringkat }).map((b) => b.nama)).toEqual(['Ani', 'Budi', 'Cici']);
    // Rata-rata skor beda = tidak seri lagi.
    const beda = hitungKlasemenKompetisi(peserta, [h(1, 1, 1, 10), h(1, 1, 1, 10), h(1, 1, 1, 10), h(2, 1, 1, 20), h(2, 1, 1, 20), h(2, 1, 1, 20)]);
    expect(beda.peringkat.map((b) => [b.nama, b.peringkat])).toEqual([
      ['Budi', 1],
      ['Ani', 2],
    ]);
    expect(juaraKompetisi(beda).map((b) => b.nama)).toEqual(['Budi']);
  });

  it('peserta yang belum main tetap tampil di belum cukup; belum ada juara', () => {
    const k = hitungKlasemenKompetisi(peserta.slice(0, 2), []);
    expect(k.peringkat).toEqual([]);
    expect(k.belumCukup.map((b) => [b.nama, b.main, b.rataNilai])).toEqual([
      ['Ani', 0, 0],
      ['Budi', 0, 0],
    ]);
    expect(juaraKompetisi(k)).toEqual([]);
  });

  it('isi pesan kompetisiHasil: nilai, rata-rata, main, dan peringkat sebelum/sesudah per kursi', () => {
    const awal = [h(1, 1, 1, 10), h(1, 1, 1, 10), h(1, 0, 1, -10), h(2, 0, 1, -10), h(2, 0, 1, -10), h(2, 1, 1, 10), h(3, 1, 1, 10), h(3, 1, 1, 10)];
    const sebelum = hitungKlasemenKompetisi(peserta, awal);
    // Permainan baru: Budi mengalahkan Cici (meja 2 orang).
    const pemain = [
      { kursi: 0, nama: 'Cici', bot: false, skor: -40, peserta: 3 },
      { kursi: 1, nama: 'Budi', bot: false, skor: 40, peserta: 2 },
    ];
    const sesudah = hitungKlasemenKompetisi(peserta, [...awal, h(3, 0, 1, -40), h(2, 1, 1, 40)]);
    expect(hasilKompetisiMeja(pemain, sebelum, sesudah)).toEqual([
      { kursi: 0, nama: 'Cici', nilai: 0, keluar: false, rataNilai: 20 / 3, main: 3, peringkatSebelum: null, peringkatSesudah: 2 },
      { kursi: 1, nama: 'Budi', nilai: 10, keluar: false, rataNilai: 5, main: 4, peringkatSebelum: 2, peringkatSesudah: 3 },
    ]);
    expect(sebelum.peringkat.map((b) => b.nama)).toEqual(['Ani', 'Budi']);
    // Ani dan Cici sama rata-rata nilai dan banyak main; rata-rata skor Ani lebih tinggi.
    expect(sesudah.peringkat.map((b) => [b.nama, b.peringkat])).toEqual([
      ['Ani', 1],
      ['Cici', 2],
      ['Budi', 3],
    ]);
  });
});

describe('yang keluar tak dihitung dan selalu dicatat 0 (keputusan pemilik 24 Okt 2026)', () => {
  const peserta = ['Ani', 'Budi', 'Cici', 'Boneka1', 'Boneka2', 'Boneka3'].map((nama, i) => ({ id: i + 1, nama }));
  type Kursi = { peserta: number; skor: number; keluar?: boolean };
  /**
   * Seperti server (catatHasil): yang keluar selalu dicatat 0; di permainan yang tidak dihitung
   * (kurang dari dua yang bertahan) yang bertahan tidak dicatat.
   */
  const catat = (...permainan: Kursi[][]): HasilKompetisi[] =>
    permainan.flatMap((meja) => {
      const pemain = meja.map((k) => ({ nama: String(k.peserta), bot: false, skor: k.skor, ...(k.keluar ? { keluar: true } : {}) }));
      const dicatat = kursiDicatatKompetisi(pemain);
      const nilai = nilaiKompetisi(pemain);
      return meja.flatMap((k, i) =>
        dicatat[i] ? [{ peserta: k.peserta, dikalahkan: nilai[i].dikalahkan, lawan: nilai[i].lawan, skor: k.skor, juara: false, keluar: !!k.keluar }] : [],
      );
    });

  it('skenario boneka: duduk dengan boneka yang langsung keluar tidak menghasilkan nilai untuk Ani; bonekanya dapat 0', () => {
    const budi = [
      ...Array.from({ length: 4 }, () => [{ peserta: 2, skor: 100 }, { peserta: 3, skor: 50 }, { peserta: 4, skor: 0 }, { peserta: 5, skor: -50 }]),
      [{ peserta: 3, skor: 100 }, { peserta: 2, skor: 50 }, { peserta: 4, skor: 0 }, { peserta: 5, skor: -50 }],
    ];
    const hasil = catat(
      // Ani di meja 2 orang dengan satu boneka yang keluar, tiga kali.
      ...Array.from({ length: 3 }, () => [{ peserta: 1, skor: -500 }, { peserta: 4, skor: 0, keluar: true }]),
      // Ani di meja 4 orang dengan tiga boneka yang keluar.
      [{ peserta: 1, skor: -500 }, { peserta: 4, skor: 0, keluar: true }, { peserta: 5, skor: 0, keluar: true }, { peserta: 6, skor: 0, keluar: true }],
      ...budi,
    );
    expect(hasil.filter((h) => h.peserta === 1)).toEqual([]);
    const k = hitungKlasemenKompetisi(peserta, hasil);
    // Budi: 4× 10 dan 1× 6,67 = 9,33, peringkat 1. Ani tidak pernah masuk klasemen. Boneka1 keluar
    // empat kali (4× 0) dan main lima kali di meja Budi (5× 3,33): 16,67 ÷ 9 = 1,85.
    expect(k.peringkat.map((b) => [b.nama, b.peringkat, b.main, teksNilai(b.rataNilai)])).toEqual([
      ['Budi', 1, 5, '9,3'],
      ['Cici', 2, 5, '7,3'],
      ['Boneka1', 3, 9, '1,9'],
      ['Boneka2', 4, 6, '0,0'],
    ]);
    expect(k.belumCukup.find((b) => b.nama === 'Ani')).toMatchObject({ main: 0, peringkat: null });
    expect(k.belumCukup.find((b) => b.nama === 'Boneka3')).toMatchObject({ main: 1, peringkat: null });
    // Semua baris boneka yang keluar bernilai 0.
    expect(hasil.filter((h) => h.keluar).every((h) => h.dikalahkan === 0)).toBe(true);
  });

  it('boneka yang keluar di meja dengan lawan sungguhan tidak menaikkan nilai: yang dihitung hanya lawan yang bertahan', () => {
    const hasil = catat(
      ...Array.from({ length: 3 }, () => [
        { peserta: 1, skor: -500 },
        { peserta: 4, skor: 0, keluar: true },
        { peserta: 3, skor: 200 },
        { peserta: 5, skor: 0, keluar: true },
      ]),
    );
    const k = hitungKlasemenKompetisi(peserta, hasil);
    expect(k.peringkat[0]).toMatchObject({ nama: 'Cici', peringkat: 1, rataNilai: 10 });
    expect(k.peringkat.find((b) => b.nama === 'Ani')).toMatchObject({ main: 3, rataNilai: 0 });
    // Dulu (yang keluar dikalahkan semua yang bertahan) Ani dapat 6,7 per permainan.
    expect(hasil.find((h) => h.peserta === 1)).toMatchObject({ dikalahkan: 0, lawan: 1 });
  });

  // Keluar menjelang kalah (tinjauan 24 Okt 2026; pemilik memutuskan "Yang keluar selalu dicatat 0"):
  // yang keluar dapat 0, sama dengan kalah. Sisanya (docs #51 "Sisa celah"): di meja 2 orang
  // kemenangan lawannya juga tidak tercatat, karena yang keluar tidak dihitung dikalahkan.
  it('keluar menjelang kalah di meja 2 orang: yang keluar tetap tercatat 0, kemenangan lawannya tidak tercatat', () => {
    // Ani lawan Budi, Cici, dan Dodi (yang tiga ini main jujur), semuanya di meja 2 orang.
    const empat = ['Ani', 'Budi', 'Cici', 'Dodi'].map((nama, i) => ({ id: i + 1, nama }));
    const lawan = [2, 3, 4];
    const sesama: Kursi[][] = [
      [{ peserta: 2, skor: 50 }, { peserta: 3, skor: -50 }],
      [{ peserta: 3, skor: 50 }, { peserta: 4, skor: -50 }],
      [{ peserta: 4, skor: 50 }, { peserta: 2, skor: -50 }],
      [{ peserta: 2, skor: -50 }, { peserta: 3, skor: 50 }],
      [{ peserta: 3, skor: -50 }, { peserta: 4, skor: 50 }],
      [{ peserta: 4, skor: -50 }, { peserta: 2, skor: 50 }],
    ];
    const menang = lawan.map((l): Kursi[] => [{ peserta: 1, skor: 100 }, { peserta: l, skor: -100 }]);
    const ani = (keluar: boolean) =>
      hitungKlasemenKompetisi(
        empat,
        catat(...menang, ...lawan.map((l): Kursi[] => [{ peserta: 1, skor: -100, keluar }, { peserta: l, skor: 100 }]), ...sesama),
      );
    // Ani keluar setiap kali kalah: tiga kemenangan (10) dan tiga kali keluar (0), sama dengan main
    // jujur. Lawannya kehilangan kemenangan atas Ani (permainan itu tidak dihitung untuk mereka).
    const curang = ani(true);
    expect(curang.peringkat.map((b) => [b.nama, b.peringkat, b.main, teksNilai(b.rataNilai), b.keluar])).toEqual([
      ['Ani', 1, 6, '5,0', 3],
      ['Budi', 2, 5, '4,0', 0],
      ['Cici', 2, 5, '4,0', 0],
      ['Dodi', 2, 5, '4,0', 0],
    ]);
    // Main jujur sampai habis: semuanya 5,0.
    expect(ani(false).peringkat.map((b) => [b.nama, b.main, teksNilai(b.rataNilai)])).toEqual([
      ['Ani', 6, '5,0'],
      ['Budi', 6, '5,0'],
      ['Cici', 6, '5,0'],
      ['Dodi', 6, '5,0'],
    ]);
  });

  it('isi pesan kompetisiHasil dengan yang keluar: nilai 0 (keluar), yang lain dibagi yang bertahan', () => {
    const pemain = [
      { kursi: 0, nama: 'Ani', bot: false, skor: 80, peserta: 1 },
      { kursi: 1, nama: 'Boneka1', bot: false, skor: 120, keluar: true, peserta: 4 },
      { kursi: 2, nama: 'Budi', bot: false, skor: 20, peserta: 2 },
      { kursi: 3, nama: 'Cici', bot: false, skor: -30, peserta: 3 },
    ];
    const sebelum = hitungKlasemenKompetisi(peserta, []);
    const sesudah = hitungKlasemenKompetisi(peserta, catat(pemain.map((p) => ({ peserta: p.peserta, skor: p.skor, keluar: p.keluar }))));
    expect(hasilKompetisiMeja(pemain, sebelum, sesudah).map((h) => [h.nama, h.nilai, h.keluar, h.main])).toEqual([
      ['Ani', 10, false, 1],
      ['Boneka1', 0, true, 1],
      ['Budi', 5, false, 1],
      ['Cici', 0, false, 1],
    ]);
  });
});

describe('pengaturan dan pesan kompetisi', () => {
  it('bawaan: 4 pemain, batas putaran 5, 60 detik per giliran; pilihan batas putaran dan waktu tanpa "tanpa batas"', () => {
    expect(PENGATURAN_KOMPETISI_BAWAAN).toMatchObject({ jumlahPemain: 4, batasPutaran: 5, modeKaldu: false, detikGiliran: 60 });
    expect(BATAS_PUTARAN_KOMPETISI_BAWAAN).toBe(5);
    expect(DETIK_GILIRAN_KOMPETISI_BAWAAN).toBe(60);
    expect([...PILIHAN_BATAS_PUTARAN_KOMPETISI]).toEqual([3, 5, 10, 15, 20]);
    expect([...PILIHAN_DETIK_GILIRAN_KOMPETISI]).toEqual([30, 60, 90, 120]);
  });

  it('pengaturan dari data tak dipercaya: kunci rusak jatuh ke bawaan, kunci lain dibuang', () => {
    expect(rapikanPengaturanKompetisi(null)).toEqual(PENGATURAN_KOMPETISI_BAWAAN);
    expect(
      rapikanPengaturanKompetisi({ batasPutaran: 10, modeKaldu: true, batasSkorAtas: 255, detikGiliran: 9999, levelBot: 'dewa', publik: true, jumlahPemain: 6 }),
    ).toEqual({ ...PENGATURAN_KOMPETISI_BAWAAN, batasPutaran: 10, modeKaldu: true, jumlahPemain: 6 });
    expect(rapikanPengaturanKompetisi({ batasSkorAtas: 500, batasSkorBawah: -500, duaDeckUntukEmpat: true, levelBot: 'suhu' })).toMatchObject({
      batasSkorAtas: 500,
      batasSkorBawah: -500,
      duaDeckUntukEmpat: true,
      levelBot: 'suhu',
    });
    // Batas putaran wajib angka: kosong/rusak = 5. Jumlah pemain rusak = 4.
    expect(rapikanPengaturanKompetisi({ batasPutaran: null })).toMatchObject({ batasPutaran: 5 });
    expect(rapikanPengaturanKompetisi({ batasPutaran: 0 })).toMatchObject({ batasPutaran: 5 });
    for (const n of PILIHAN_BATAS_PUTARAN_KOMPETISI) expect(rapikanPengaturanKompetisi({ batasPutaran: n })).toMatchObject({ batasPutaran: n });
    for (const rusak of [1, 7, 3.5, '3', null]) expect(rapikanPengaturanKompetisi({ jumlahPemain: rusak })).toMatchObject({ jumlahPemain: 4 });
    expect(rapikanPengaturanKompetisi({ jumlahPemain: 2 })).toMatchObject({ jumlahPemain: 2 });
    // 2 deck hanya berarti di meja 4 orang.
    expect(rapikanPengaturanKompetisi({ jumlahPemain: 5, duaDeckUntukEmpat: true })).toMatchObject({ jumlahPemain: 5, duaDeckUntukEmpat: false });
    expect(rapikanPengaturanKompetisi({ jumlahPemain: 4, duaDeckUntukEmpat: true })).toMatchObject({ duaDeckUntukEmpat: true });
  });

  it('pengajuan: batas putaran dan waktu per giliran hanya dari pilihan formulir; yang tersimpan lebih longgar', () => {
    // Isian pengajuan (API publik): selain pilihan formulir jatuh ke bawaan, termasuk "tanpa batas"
    // yang disamarkan sebagai angka besar dan waktu 0 (tanpa batas waktu).
    for (const n of [1, 2, 4, 21, 100000, -5, 3.5]) expect(rapikanPengaturanKompetisi({ batasPutaran: n })).toMatchObject({ batasPutaran: 5 });
    for (const d of [0, 1, 45, 600, -30]) expect(rapikanPengaturanKompetisi({ detikGiliran: d })).toMatchObject({ detikGiliran: 60 });
    for (const d of PILIHAN_DETIK_GILIRAN_KOMPETISI) expect(rapikanPengaturanKompetisi({ detikGiliran: d })).toMatchObject({ detikGiliran: d });
    // Yang tersimpan di database (termasuk data uji yang ditulis langsung): 1–20 putaran, 1–600 detik.
    expect(rapikanPengaturanKompetisi({ batasPutaran: 2, detikGiliran: 45 }, 'tersimpan')).toMatchObject({ batasPutaran: 2, detikGiliran: 45 });
    expect(rapikanPengaturanKompetisi({ batasPutaran: 1 }, 'tersimpan')).toMatchObject({ batasPutaran: 1 });
    expect(rapikanPengaturanKompetisi({ batasPutaran: 21, detikGiliran: 0 }, 'tersimpan')).toMatchObject({ batasPutaran: 5, detikGiliran: 60 });
    expect(rapikanPengaturanKompetisi({ batasPutaran: 100000, detikGiliran: 601 }, 'tersimpan')).toMatchObject({ batasPutaran: 5, detikGiliran: 60 });
  });

  it('ubahan terkunci: kunci kompetisi (termasuk jumlah pemain) yang nilainya berubah', () => {
    const kunci = { ...PENGATURAN_KOMPETISI_BAWAAN, batasPutaran: 5 };
    expect(ubahanTerkunci(kunci, { publik: true, tempoBot: 'cepat' })).toEqual([]);
    expect(ubahanTerkunci(kunci, { batasPutaran: 5, jumlahPemain: 4 })).toEqual([]);
    expect(ubahanTerkunci(kunci, { jumlahPemain: 3 })).toEqual(['jumlahPemain']);
    expect(ubahanTerkunci(kunci, { batasPutaran: 6, modeKaldu: true })).toEqual(['batasPutaran', 'modeKaldu']);
  });

  it('nama kompetisi dirapikan, maksimal 32 huruf', () => {
    expect(rapikanNamaKompetisi('  Remi\nJumat   Kedai ')).toBe('Remi Jumat Kedai');
    expect(rapikanNamaKompetisi('x'.repeat(50))).toBe('x'.repeat(32));
    expect(rapikanNamaKompetisi('   ')).toBeNull();
    expect(rapikanNamaKompetisi(5)).toBeNull();
  });

  it('tiket di pesan buat dan gabung', () => {
    expect(validasiPesan({ t: 'buat', nama: 'Budi', kompetisi: { kode: 'abcde', token: 'rahasia' } })).toEqual({
      t: 'buat',
      nama: 'Budi',
      pengaturan: {},
      kompetisi: { kode: 'ABCDE', token: 'rahasia' },
    });
    expect(validasiPesan({ t: 'buat', nama: 'Budi', kompetisi: { kode: 'ABCDE' } })).toBeNull();
    expect(validasiPesan({ t: 'gabung', kode: 'QWERT', nama: 'Budi', tiket: [{ kode: 'ABCDE', token: 'x' }] })).toMatchObject({
      tiket: [{ kode: 'ABCDE', token: 'x' }],
    });
    expect(validasiPesan({ t: 'gabung', kode: 'QWERT', nama: 'Budi', tiket: [{ kode: 'ABCDE', token: '' }] })).toBeNull();
    expect(validasiPesan({ t: 'gabung', kode: 'QWERT', nama: 'Budi', tiket: Array(21).fill({ kode: 'ABCDE', token: 'x' }) })).toBeNull();
    // Pesan lama tanpa tiket tidak berubah bentuknya.
    expect(validasiPesan({ t: 'gabung', kode: 'QWERT', nama: 'Budi' })).toEqual({ t: 'gabung', kode: 'QWERT', nama: 'Budi', token: undefined });
  });
});

describe('meja kompetisi', () => {
  const KOMPETISI: KompetisiDataMeja = {
    kode: 'KOMPA',
    nama: 'Remi Jumat',
    pengaturan: { ...PENGATURAN_KOMPETISI_BAWAAN, jumlahPemain: 3, batasPutaran: 1, detikGiliran: 0 },
  };

  const buatMeja = (extra: Partial<OpsiMeja> = {}, kompetisi: KompetisiDataMeja = KOMPETISI) => {
    const galat: unknown[] = [];
    const ctx = siapkan({ saatGalat: (_k, e) => galat.push(e), ...extra });
    // Pengaturan kiriman host yang dikunci kompetisi ditimpa, termasuk jumlah pemain.
    const meja = Meja.buat(ctx.opsi, 'host', 'Ani', { jumlahPemain: 5, batasPutaran: 20, modeKaldu: true }, { ...kompetisi, peserta: 1 });
    return { ...ctx, meja, galat };
  };

  /** Meja 3 kursi penuh peserta terhubung: Ani (host), Budi, Cici. */
  const penuh = (extra: Partial<OpsiMeja> = {}) => {
    const ctx = buatMeja(extra);
    ctx.meja.masuk('budi', 'Budi', 2);
    ctx.meja.masuk('cici', 'Cici', 3);
    return ctx;
  };

  it('pengaturan terkunci dari kompetisi (termasuk jumlah pemain), info meja menyebut kompetisinya', () => {
    const { meja, surat } = buatMeja();
    const info = surat.info('host');
    expect(info.kompetisi).toEqual({ kode: 'KOMPA', nama: 'Remi Jumat' });
    expect(info.pengaturan).toMatchObject({ jumlahPemain: 3, batasPutaran: 1, modeKaldu: false, detikGiliran: 0 });
    expect(info.kursi).toHaveLength(3);
    expect(meja.kompetisi).toBe('KOMPA');
    // Id peserta tidak pernah dikirim ke client; lobi yang belum penuh tidak menghitung mundur.
    expect(JSON.stringify(info)).not.toContain('peserta');
    expect(info.mulaiOtomatis).toBeUndefined();
  });

  it('hanya peserta yang bisa duduk, satu peserta satu kursi, tanpa warga kedai, tanpa tombol Mulai', () => {
    const { meja, surat } = buatMeja();
    expect(() => meja.masuk('tamu', 'Tamu')).toThrow(/khusus peserta kompetisi "Remi Jumat"/);
    expect(() => meja.masuk('hp2', 'Ani', 1)).toThrow(/dari HP lain/);
    meja.masuk('budi', 'Budi', 2);
    meja.terima('host', { t: 'aturKursi', kursi: 2, jenis: 'bot' });
    expect(surat.errors('host').at(-1)).toMatch(/diisi peserta sendiri/);
    expect(meja.data.kursi[2].jenis).toBe('kosong');
    meja.terima('host', { t: 'mulai' });
    expect(surat.errors('host').at(-1)).toMatch(/mulai sendiri begitu semua kursi terisi/);
    meja.terima('host', { t: 'pengaturan', pengaturan: { batasPutaran: 3 } });
    expect(surat.errors('host').at(-1)).toMatch(/ikut kompetisinya/);
    // Jumlah pemain ikut dikunci (versi 2); tempo dan publik masih boleh.
    meja.terima('host', { t: 'pengaturan', pengaturan: { jumlahPemain: 2 } });
    expect(surat.errors('host').at(-1)).toMatch(/ikut kompetisinya/);
    meja.terima('host', { t: 'pengaturan', pengaturan: { publik: true, tempoBot: 'cepat' } });
    expect(surat.info('host').pengaturan).toMatchObject({ jumlahPemain: 3, publik: true, tempoBot: 'cepat', batasPutaran: 1 });
    expect(meja.status).toBe('lobi');
  });

  it('mulai sendiri begitu semua kursi terisi peserta yang terhubung; waktu mulai dicatat', () => {
    const { meja, surat, jam } = penuh();
    expect(surat.info('host').mulaiOtomatis).toEqual({ sisaMs: JEDA_MULAI_KOMPETISI_MS });
    expect(surat.info('cici').mulaiOtomatis).toEqual({ sisaMs: JEDA_MULAI_KOMPETISI_MS });
    jam.maju(JEDA_MULAI_KOMPETISI_MS - 1);
    expect(meja.status).toBe('lobi');
    const mulaiPada = jam.waktu + 1;
    jam.maju(1);
    expect(meja.status).toBe('main');
    expect(surat.info('host').mulaiOtomatis).toBeUndefined();
    expect(meja.data.kompetisi?.mulaiPada).toBe(mulaiPada);
    // Semua manusia menunggu pengumuman joker seperti meja biasa.
    expect(surat.info('host').menungguJoker).toEqual([0, 1, 2]);
  });

  it('hitung mundur batal kalau ada yang keluar atau terputus, dan mulai dari awal lagi saat penuh', () => {
    const { meja, surat, jam } = penuh();
    jam.maju(1500);
    meja.terima('cici', { t: 'keluar' });
    expect(meja.data.kursi[2].jenis).toBe('kosong');
    expect(surat.info('host').mulaiOtomatis).toBeUndefined();
    jam.maju(5000);
    expect(meja.status).toBe('lobi');
    // Peserta lain duduk: hitung mundur penuh lagi.
    meja.masuk('dodi', 'Dodi', 4);
    expect(surat.info('host').mulaiOtomatis).toEqual({ sisaMs: JEDA_MULAI_KOMPETISI_MS });
    jam.maju(1000);
    // Terputus di tengah hitung mundur: batal, tidak mulai selama kursinya terputus.
    meja.terputus('dodi');
    expect(surat.info('host').mulaiOtomatis).toBeUndefined();
    jam.maju(5000);
    expect(meja.status).toBe('lobi');
    // Kembali: hitung mundur dari awal.
    meja.terhubung('dodi');
    expect(surat.info('host').mulaiOtomatis).toEqual({ sisaMs: JEDA_MULAI_KOMPETISI_MS });
    jam.maju(JEDA_MULAI_KOMPETISI_MS);
    expect(meja.status).toBe('main');
  });

  it('host tidak bisa mengosongkan kursi peserta lain, juga di tengah hitung mundur', () => {
    const { meja, surat, jam } = penuh();
    meja.terima('host', { t: 'aturKursi', kursi: 1, jenis: 'kosong' });
    expect(surat.errors('host').at(-1)).toMatch(/diisi peserta sendiri/);
    expect(surat.terakhir('budi', 'keluar')).toBeUndefined();
    expect(meja.data.kursi[1]).toMatchObject({ jenis: 'manusia', nama: 'Budi' });
    expect(surat.info('host').mulaiOtomatis).toBeDefined();
    jam.maju(JEDA_MULAI_KOMPETISI_MS);
    expect(meja.status).toBe('main');
  });

  it('kompetisi yang sudah tidak berjalan: tidak mulai sendiri dan tidak menerima peserta baru', () => {
    let berjalan = true;
    const { meja, surat, jam, galat } = buatMeja({ kompetisiBerjalan: (k) => k === 'KOMPA' && berjalan });
    meja.masuk('budi', 'Budi', 2);
    berjalan = false;
    expect(() => meja.masuk('cici', 'Cici', 3)).toThrow(/sudah selesai/);
    // Sambung ulang peserta yang sudah duduk tetap boleh.
    meja.terputus('budi');
    meja.terhubung('budi');
    berjalan = true;
    meja.masuk('cici', 'Cici', 3);
    expect(surat.info('host').mulaiOtomatis).toBeDefined();
    berjalan = false;
    jam.maju(JEDA_MULAI_KOMPETISI_MS);
    expect(meja.status).toBe('lobi');
    expect(galat).toEqual([]);
  });

  it('kursi peserta yang lama terputus di lobi dikosongkan selama ada yang menunggu', () => {
    const { meja, surat, jam } = buatMeja();
    meja.masuk('budi', 'Budi', 2);
    meja.terputus('budi');
    jam.maju(TENGGANG_SAMBUNG_MS - 1);
    expect(meja.data.kursi[1].jenis).toBe('manusia');
    jam.maju(1);
    expect(meja.data.kursi[1].jenis).toBe('kosong');
    expect(surat.info('host').kursi.map((k) => k.jenis)).toEqual(['manusia', 'kosong', 'kosong']);
    // Host yang terputus juga dilepas; host pindah ke yang masih ada (Cici duduk di kursi 1 yang kosong).
    meja.masuk('cici', 'Cici', 3);
    meja.terputus('host');
    jam.maju(TENGGANG_SAMBUNG_MS);
    expect(meja.data.kursi[0].jenis).toBe('kosong');
    expect(surat.info('cici').host).toBe(1);
    // Tidak ada yang terhubung lagi: tidak ada yang dilepas (tidak ada yang menunggu).
    meja.terputus('cici');
    jam.maju(TENGGANG_SAMBUNG_MS * 3);
    expect(meja.data.kursi[1]).toMatchObject({ jenis: 'manusia', nama: 'Cici' });
  });

  it('lobi: yang kembali sesudah semua terputus tidak langsung melepas kursi peserta lain', () => {
    const { meja, surat, jam } = buatMeja();
    meja.masuk('budi', 'Budi', 2);
    meja.terputus('host');
    meja.terputus('budi');
    jam.maju(TENGGANG_SAMBUNG_MS * 3);
    // Tidak ada yang menunggu: tidak ada yang dilepas.
    expect(meja.data.kursi.map((k) => k.jenis)).toEqual(['manusia', 'manusia', 'kosong']);
    // Host kembali: Budi mendapat masa tenggang penuh lagi, dihitung sejak host kembali.
    meja.terhubung('host');
    jam.maju(TENGGANG_SAMBUNG_MS - 1);
    expect(meja.data.kursi[1]).toMatchObject({ jenis: 'manusia', nama: 'Budi' });
    meja.terhubung('budi');
    jam.maju(TENGGANG_SAMBUNG_MS * 2);
    expect(meja.data.kursi[1]).toMatchObject({ jenis: 'manusia', nama: 'Budi', terhubung: true });
    // Kalau Budi tidak kembali sampai tenggang barunya habis, kursinya baru dilepas.
    meja.terputus('budi');
    jam.maju(TENGGANG_SAMBUNG_MS);
    expect(surat.info('host').kursi.map((k) => k.jenis)).toEqual(['manusia', 'kosong', 'kosong']);
  });

  it('lobi yang dipulihkan: yang kembali lebih dari 20 detik sesudah server jalan tidak langsung melepas kursi lain', () => {
    const a = buatMeja();
    a.meja.masuk('budi', 'Budi', 2);
    const lobi = dataMejaDipulihkan(a.meja.data);
    a.meja.hentikan();
    const ctx = siapkan();
    const meja = new Meja(ctx.opsi, lobi);
    ctx.jam.maju(25_000);
    meja.terhubung('host');
    ctx.jam.maju(TENGGANG_SAMBUNG_MS - 1);
    expect(meja.data.kursi[1]).toMatchObject({ jenis: 'manusia', nama: 'Budi' });
    meja.terhubung('budi');
    ctx.jam.maju(TENGGANG_SAMBUNG_MS);
    expect(meja.data.kursi.map((k) => [k.jenis, k.terhubung])).toEqual([
      ['manusia', true],
      ['manusia', true],
      ['kosong', false],
    ]);
  });

  /** Meja kompetisi 2 orang yang sudah sampai hasil putaran 1 (Ani host, Budi). */
  const sampaiHasilPutaran = (extra: Partial<OpsiMeja> = {}, pengaturan: Partial<KompetisiDataMeja['pengaturan']> = {}) => {
    const ctx = buatMeja(
      { jedaLanjutMs: 10_000, ...extra },
      { ...KOMPETISI, pengaturan: { ...KOMPETISI.pengaturan, jumlahPemain: 2, batasPutaran: 3, detikGiliran: 30, ...pengaturan } },
    );
    ctx.meja.masuk('budi', 'Budi', 2);
    ctx.jam.maju(JEDA_MULAI_KOMPETISI_MS);
    siapSemua(ctx.meja);
    const rng = new Rng(3);
    for (let i = 0; i < 20000 && ctx.meja.data.game?.status !== 'putaranSelesai'; i++) {
      if (aksiManusia(ctx.meja, ctx.surat, 'host', rng) || aksiManusia(ctx.meja, ctx.surat, 'budi', rng)) continue;
      ctx.jam.langkah();
    }
    expect(ctx.meja.data.game?.status).toBe('putaranSelesai');
    return ctx;
  };

  it('hasil putaran: host yang diam tidak bisa menahan meja, putaran berikutnya mulai sendiri', () => {
    const { meja, surat, jam, galat } = sampaiHasilPutaran();
    // Jeda lanjut 10 detik + satu waktu giliran (30 detik).
    expect(surat.info('host').lanjutOtomatis).toEqual({ sisaMs: 40_000 });
    expect(surat.info('budi').lanjutOtomatis).toEqual({ sisaMs: 40_000 });
    // Budi menekan Siap: jeda lanjut selesai, tapi batas mulai sendiri tidak berubah.
    meja.terima('budi', { t: 'siapLanjut' });
    jam.maju(39_999);
    expect(meja.data.game?.status).toBe('putaranSelesai');
    // Budi bukan host: tidak bisa memulai sendiri, dan meja kompetisi tidak punya voting akhiri.
    meja.terima('budi', { t: 'putaranBerikut' });
    expect(surat.errors('budi').at(-1)).toMatch(/Cuma host/);
    meja.terima('budi', { t: 'akhiri', setuju: true });
    expect(surat.errors('budi').at(-1)).toBe(TEKS_TANPA_VOTING_KOMPETISI);
    expect(meja.status).toBe('main');
    jam.maju(1);
    expect(meja.data.game?.status).toBe('putaranBerjalan');
    expect(meja.data.game?.putaran?.nomor).toBe(2);
    expect(surat.info('host').lanjutOtomatis).toBeUndefined();
    expect(meja.data.setujuAkhiri).toEqual([]);
    expect(galat).toEqual([]);
  });

  it('hasil putaran: host yang memulai sendiri lebih dulu tetap boleh; meja biasa tidak mulai sendiri', () => {
    const { meja, surat, jam } = sampaiHasilPutaran();
    jam.maju(10_000);
    meja.terima('host', { t: 'putaranBerikut' });
    expect(meja.data.game?.putaran?.nomor).toBe(2);
    expect(surat.info('host').lanjutOtomatis).toBeUndefined();

    // Meja biasa (tanpa kompetisi): tidak ada mulai sendiri, info tanpa lanjutOtomatis.
    const ctx = siapkan({ jedaLanjutMs: 10_000 });
    const biasa = Meja.buat(ctx.opsi, 'host', 'Ani', { jumlahPemain: 2, batasPutaran: 3, detikGiliran: 30 });
    biasa.masuk('budi', 'Budi');
    biasa.terima('host', { t: 'mulai' });
    siapSemua(biasa);
    const rng = new Rng(3);
    for (let i = 0; i < 20000 && biasa.data.game?.status !== 'putaranSelesai'; i++) {
      if (aksiManusia(biasa, ctx.surat, 'host', rng) || aksiManusia(biasa, ctx.surat, 'budi', rng)) continue;
      ctx.jam.langkah();
    }
    expect('lanjutOtomatis' in ctx.surat.info('host')).toBe(false);
    ctx.jam.maju(10 * 60_000);
    expect(biasa.data.game?.status).toBe('putaranSelesai');
  });

  it('hasil putaran: semua pergi = tidak mulai sendiri; yang kembali mendapat waktu penuh lagi', () => {
    const { meja, surat, jam } = sampaiHasilPutaran();
    meja.terputus('host');
    meja.terputus('budi');
    jam.maju(10 * 60_000);
    expect(meja.data.game?.status).toBe('putaranSelesai');
    meja.terhubung('budi');
    // Jeda lanjut sudah lewat: tinggal satu waktu giliran.
    expect(surat.info('budi').lanjutOtomatis).toEqual({ sisaMs: 30_000 });
    jam.maju(30_000);
    expect(meja.data.game?.putaran?.nomor).toBe(2);
  });

  it('meja kompetisi tanpa waktu per giliran (data lama): mulai sendiri memakai 60 detik', () => {
    const { meja, surat, jam } = sampaiHasilPutaran({}, { detikGiliran: 0 });
    expect(surat.info('host').lanjutOtomatis).toEqual({ sisaMs: 70_000 });
    jam.maju(70_000);
    expect(meja.data.game?.putaran?.nomor).toBe(2);
  });

  // Keputusan pemilik 24 Okt 2026 "Matikan voting di meja kompetisi".
  it('meja kompetisi tanpa voting: Akhiri permainan dan Putaran terakhir ditolak, juga saat semua setuju', () => {
    const { meja, surat, galat } = sampaiHasilPutaran({}, { modeKaldu: true, batasPutaran: 3, batasSkorAtas: null, batasSkorBawah: null });
    expect(TEKS_TANPA_VOTING_KOMPETISI).toBe('Di meja kompetisi permainan jalan sampai batas putaran, Bos.');
    for (const id of ['host', 'budi']) {
      meja.terima(id, { t: 'akhiri', setuju: true });
      expect(surat.errors(id).at(-1)).toBe(TEKS_TANPA_VOTING_KOMPETISI);
      meja.terima(id, { t: 'putaranTerakhir', setuju: true });
      expect(surat.errors(id).at(-1)).toBe(TEKS_TANPA_VOTING_KOMPETISI);
      // Membatalkan juga ditolak dengan pesan yang sama (tidak ada voting sama sekali).
      meja.terima(id, { t: 'akhiri', setuju: false });
      expect(surat.errors(id).at(-1)).toBe(TEKS_TANPA_VOTING_KOMPETISI);
    }
    expect(meja.status).toBe('main');
    expect(meja.data.game?.status).toBe('putaranSelesai');
    expect(meja.data.game?.kalduDiminta).toBeFalsy();
    expect(meja.data.setujuAkhiri).toEqual([]);
    expect(meja.data.setujuKaldu).toBeUndefined();
    expect(surat.info('host').setujuAkhiri).toEqual([]);
    expect(surat.info('host').setujuKaldu).toEqual([]);
    // Satu-satunya yang terhubung pun tidak bisa mengakhiri sendiri (dulu meja biasa: langsung berlaku).
    meja.terputus('budi');
    meja.terima('host', { t: 'akhiri', setuju: true });
    expect(meja.status).toBe('main');
    expect(galat).toEqual([]);
  });

  it('meja kompetisi: penolakan juga selama putaran berjalan; kaldu tetap mulai sendiri di batas putaran', () => {
    const { meja, surat, jam } = sampaiHasilPutaran({}, { modeKaldu: true, batasPutaran: 2, batasSkorAtas: null, batasSkorBawah: null });
    expect(putaranBerikutKaldu(meja.data.game!)).toBe(true);
    jam.maju(10_000);
    meja.terima('host', { t: 'putaranBerikut' });
    expect(meja.data.game?.status).toBe('putaranBerjalan');
    expect(meja.data.game?.putaran?.kaldu).toBe(true);
    meja.terima('budi', { t: 'akhiri', setuju: true });
    expect(surat.errors('budi').at(-1)).toBe(TEKS_TANPA_VOTING_KOMPETISI);
    meja.terima('budi', { t: 'putaranTerakhir', setuju: true });
    expect(surat.errors('budi').at(-1)).toBe(TEKS_TANPA_VOTING_KOMPETISI);
  });

  it('meja kompetisi dari simpanan lama yang membawa suara voting: suaranya dibuang, tidak pernah berlaku', () => {
    const a = sampaiHasilPutaran({}, { modeKaldu: true, batasSkorAtas: null, batasSkorBawah: null });
    const data = dataMejaDipulihkan(a.meja.data);
    a.meja.hentikan();
    data.setujuAkhiri = [0, 1];
    data.setujuKaldu = [0, 1];
    const ctx = siapkan({ jedaLanjutMs: 10_000 });
    const meja = new Meja(ctx.opsi, data);
    meja.terhubung('host');
    meja.terhubung('budi');
    expect(meja.status).toBe('main');
    expect(meja.data.game?.status).toBe('putaranSelesai');
    expect(meja.data.game?.kalduDiminta).toBeFalsy();
    expect(meja.data.setujuAkhiri).toEqual([]);
    expect(meja.data.setujuKaldu).toBeUndefined();
  });

  it('meja biasa: voting akhiri dan kaldu tidak berubah, cukup suara manusia yang terhubung (#36)', () => {
    const mejaBiasa = (pengaturan: Record<string, unknown> = {}) => {
      const ctx = siapkan();
      const meja = Meja.buat(ctx.opsi, 'host', 'Ani', { jumlahPemain: 3, batasPutaran: 5, ...pengaturan });
      meja.masuk('budi', 'Budi');
      meja.masuk('cici', 'Cici');
      meja.terima('host', { t: 'mulai' });
      siapSemua(meja);
      const rng = new Rng(3);
      for (let i = 0; i < 20000 && meja.data.game?.status !== 'putaranSelesai'; i++) {
        if (aksiManusia(meja, ctx.surat, 'host', rng) || aksiManusia(meja, ctx.surat, 'budi', rng) || aksiManusia(meja, ctx.surat, 'cici', rng)) continue;
        ctx.jam.langkah();
      }
      expect(meja.data.game?.status).toBe('putaranSelesai');
      return { meja, surat: ctx.surat };
    };
    // Akhiri: Ani dan Budi setuju, Cici belum; Cici terputus = pemilih berkurang, voting lolos.
    const a = mejaBiasa();
    a.meja.terima('host', { t: 'akhiri', setuju: true });
    a.meja.terima('budi', { t: 'akhiri', setuju: true });
    expect(a.meja.status).toBe('main');
    expect(a.surat.info('host').setujuAkhiri).toEqual([0, 1]);
    a.meja.terputus('cici');
    expect(a.meja.status).toBe('selesai');
    expect(a.meja.data.game?.alasanSelesai).toBe('sepakat');
    // Kaldu: aturan pemilih sama.
    const k = mejaBiasa({ modeKaldu: true, batasSkorAtas: null, batasSkorBawah: null });
    k.meja.terputus('budi');
    k.meja.terima('host', { t: 'putaranTerakhir', setuju: true });
    expect(k.meja.data.game?.kalduDiminta).toBeFalsy();
    k.meja.terima('cici', { t: 'putaranTerakhir', setuju: true });
    expect(k.meja.data.game?.kalduDiminta).toBe(true);
    expect(k.surat.errors('host')).toEqual([]);
  });

  it('main sampai selesai: ringkasan akhir membawa kompetisi, waktu mulai, dan id peserta; Main lagi ditolak', () => {
    let ringkasan: RingkasanAkhir | null = null;
    const { meja, surat, jam, galat } = penuh({ saatSelesai: (r) => (ringkasan = r), jedaLanjutMs: 10_000 });
    jam.maju(JEDA_MULAI_KOMPETISI_MS);
    const mulaiPada = meja.data.kompetisi!.mulaiPada!;
    siapSemua(meja);
    // Cici keluar di tengah putaran: kursinya diteruskan warga kedai, tetap atas nama pesertanya.
    meja.terima('cici', { t: 'keluar' });
    expect(meja.data.kursi[2]).toMatchObject({ jenis: 'bot', keluar: true, peserta: 3 });
    const rng = new Rng(7);
    for (let i = 0; i < 20000 && meja.status === 'main'; i++) {
      if (aksiManusia(meja, surat, 'host', rng) || aksiManusia(meja, surat, 'budi', rng)) continue;
      jam.langkah();
    }
    expect(galat).toEqual([]);
    expect(meja.status).toBe('selesai');
    const r = ringkasan as RingkasanAkhir | null;
    expect(r?.kompetisi).toBe('KOMPA');
    expect(r?.mulaiPada).toBe(mulaiPada);
    expect(r!.selesaiPada).toBeGreaterThan(mulaiPada);
    expect(r?.pemain.map((p) => [p.nama, p.peserta, !!p.keluar]).sort()).toEqual([
      ['Ani', 1, false],
      ['Budi', 2, false],
      ['Cici', 3, true],
    ]);

    meja.terima('host', { t: 'mainLagi' });
    expect(surat.errors('host').at(-1)).toMatch(/cuma sekali main/);
    expect(meja.status).toBe('selesai');
  });

  it('jeda 10 detik di hasil putaran tetap berlaku di meja kompetisi', () => {
    const { meja, surat, jam, galat } = buatMeja(
      { jedaLanjutMs: 10_000 },
      { ...KOMPETISI, pengaturan: { ...KOMPETISI.pengaturan, jumlahPemain: 2, batasPutaran: 2 } },
    );
    meja.masuk('budi', 'Budi', 2);
    jam.maju(JEDA_MULAI_KOMPETISI_MS);
    siapSemua(meja);
    const rng = new Rng(3);
    for (let i = 0; i < 20000 && meja.data.game?.status !== 'putaranSelesai'; i++) {
      if (aksiManusia(meja, surat, 'host', rng) || aksiManusia(meja, surat, 'budi', rng)) continue;
      jam.langkah();
    }
    expect(meja.data.game?.status).toBe('putaranSelesai');
    expect(surat.info('host').lanjut?.sisaMs).toBe(10_000);
    meja.terima('host', { t: 'putaranBerikut' });
    expect(surat.errors('host').at(-1)).toMatch(/Tunggu sebentar/);
    meja.terima('budi', { t: 'siapLanjut' });
    meja.terima('host', { t: 'putaranBerikut' });
    expect(meja.data.game?.status).toBe('putaranBerjalan');
    expect(galat).toEqual([]);
  });

  it('meja kompetisi yang dipulihkan: waktu mulai tetap ada; lobi tidak mulai sebelum semua kembali', () => {
    const a = penuh();
    a.jam.maju(JEDA_MULAI_KOMPETISI_MS);
    const main = dataMejaDipulihkan(a.meja.data);
    expect(main.kompetisi?.mulaiPada).toBe(a.meja.data.kompetisi?.mulaiPada);
    a.meja.hentikan();

    const b = penuh();
    const lobi = dataMejaDipulihkan(b.meja.data);
    b.meja.hentikan();
    const ctx = siapkan();
    const meja = new Meja(ctx.opsi, lobi);
    ctx.jam.maju(TENGGANG_SAMBUNG_MS * 2);
    expect(meja.status).toBe('lobi');
    expect(meja.data.kursi.every((k) => k.jenis === 'manusia')).toBe(true);
    meja.terhubung('host');
    meja.terhubung('budi');
    expect(ctx.surat.info('host').mulaiOtomatis).toBeUndefined();
    meja.terhubung('cici');
    expect(ctx.surat.info('host').mulaiOtomatis).toEqual({ sisaMs: JEDA_MULAI_KOMPETISI_MS });
    ctx.jam.maju(JEDA_MULAI_KOMPETISI_MS);
    expect(meja.status).toBe('main');
  });

  it('meja biasa tidak berubah: tanpa kompetisi di data, info, dan ringkasan; Mulai dan Main lagi tetap ada', () => {
    const ctx = siapkan();
    const meja = Meja.buat(ctx.opsi, 'host', 'Ani', { jumlahPemain: 2 });
    expect('kompetisi' in meja.data).toBe(false);
    expect('kompetisi' in ctx.surat.info('host')).toBe(false);
    expect(meja.kompetisi).toBeNull();
    meja.masuk('tamu', 'Tamu', 5);
    expect('peserta' in meja.data.kursi[1]).toBe(false);
    // Penuh tapi tidak mulai sendiri.
    expect('mulaiOtomatis' in ctx.surat.info('host')).toBe(false);
    ctx.jam.maju(JEDA_MULAI_KOMPETISI_MS * 5);
    expect(meja.status).toBe('lobi');
    meja.terima('host', { t: 'mulai' });
    expect(meja.status).toBe('main');
  });
});
