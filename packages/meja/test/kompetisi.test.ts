// Kompetisi (keputusan pemilik #51, versi 2 24 Okt 2026): masa berlaku, status, nilai 0–10 per
// permainan, klasemen rata-rata (seri: lebih sering main, rata-rata skor, abjad), juara, isi pesan
// kompetisiHasil, voting tutup, pengaturan yang dikunci (termasuk jumlah pemain dan batas putaran),
// validasi tiket, dan meja kompetisi (tanpa warga kedai, mulai sendiri saat penuh, tanpa Main lagi,
// waktu mulai dicatat, ringkasan akhir dengan id peserta).

import { describe, expect, it } from 'vitest';
import { Rng } from '@remi/engine';
import {
  BATAS_PENGAJUAN_MS,
  BATAS_PUTARAN_KOMPETISI_BAWAAN,
  JEDA_MULAI_KOMPETISI_MS,
  MIN_MAIN_KOMPETISI,
  Meja,
  PENGATURAN_KOMPETISI_BAWAAN,
  PILIHAN_BATAS_PUTARAN_KOMPETISI,
  TENGGANG_SAMBUNG_MS,
  akhirKompetisi,
  berjalanPada,
  dataMejaDipulihkan,
  hasilKompetisiMeja,
  hitungKlasemenKompetisi,
  juaraKompetisi,
  nilaiKompetisi,
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

  it('yang keluar di tengah permainan juru kunci: nilai 0, dikalahkan semua yang bertahan', () => {
    const v = nilaiKompetisi([
      { nama: 'Kabur', bot: false, keluar: true, skor: 300 },
      { nama: 'B', bot: false, skor: 10 },
      { nama: 'C', bot: false, skor: -50 },
    ]);
    expect(v.map((x) => x.nilai)).toEqual([0, 10, 5]);
    expect(
      nilaiKompetisi([
        { nama: 'Kabur1', bot: false, keluar: true, skor: 300 },
        { nama: 'Kabur2', bot: false, keluar: true, skor: -300 },
        { nama: 'C', bot: false, skor: -50 },
      ]).map((x) => x.nilai),
    ).toEqual([0, 0, 10]);
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

describe('pengaturan dan pesan kompetisi', () => {
  it('bawaan: 4 pemain, batas putaran 5; pilihan batas putaran tanpa "tanpa batas"', () => {
    expect(PENGATURAN_KOMPETISI_BAWAAN).toMatchObject({ jumlahPemain: 4, batasPutaran: 5, modeKaldu: false });
    expect(BATAS_PUTARAN_KOMPETISI_BAWAAN).toBe(5);
    expect([...PILIHAN_BATAS_PUTARAN_KOMPETISI]).toEqual([3, 5, 10, 15, 20]);
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
    expect(rapikanPengaturanKompetisi({ batasPutaran: 2 })).toMatchObject({ batasPutaran: 2 });
    for (const rusak of [1, 7, 3.5, '3', null]) expect(rapikanPengaturanKompetisi({ jumlahPemain: rusak })).toMatchObject({ jumlahPemain: 4 });
    expect(rapikanPengaturanKompetisi({ jumlahPemain: 2 })).toMatchObject({ jumlahPemain: 2 });
    // 2 deck hanya berarti di meja 4 orang.
    expect(rapikanPengaturanKompetisi({ jumlahPemain: 5, duaDeckUntukEmpat: true })).toMatchObject({ jumlahPemain: 5, duaDeckUntukEmpat: false });
    expect(rapikanPengaturanKompetisi({ jumlahPemain: 4, duaDeckUntukEmpat: true })).toMatchObject({ duaDeckUntukEmpat: true });
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
    expect(surat.errors('host').at(-1)).toMatch(/nggak bisa diisi warga kedai/);
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

  it('host mengosongkan kursi di tengah hitung mundur: batal', () => {
    const { meja, surat, jam } = penuh();
    meja.terima('host', { t: 'aturKursi', kursi: 1, jenis: 'kosong' });
    expect(surat.terakhir('budi', 'keluar')?.alasan).toMatch(/diganti oleh host/);
    expect(surat.info('host').mulaiOtomatis).toBeUndefined();
    jam.maju(10_000);
    expect(meja.status).toBe('lobi');
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
