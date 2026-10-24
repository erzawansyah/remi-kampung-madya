// Perbaikan koneksi putus-putus di meja (keputusan pemilik 24 Okt 2026):
// - sisa waktu minimal saat kembali di giliran sendiri (#37 diubah), sekali per kursi per giliran;
// - toleransi tersembunyi sesudah batas waktu giliran sebelum warga kedai mengambil alih;
// - sesudah jeda total (#35), kursi yang masih terputus dapat tenggang penuh lagi, dan pengambilalihan
//   yang belum sempat dijalankan dibatalkan;
// - jeda mikir warga kedai tidak diundi ulang setiap ada perubahan lain;
// - kabar banyaknya langkah yang dijalankan warga kedai selama terputus (pesan 'masuk');
// - siapJoker membawa nomor putaran (OK untuk putaran lain diabaikan);
// - batas tunggu pengumuman joker yang habis selagi meja belum tahu sambungannya putus (jeda putus
//   di server) tidak dihitung "sudah melihat".
// Popup joker sambung ulang yang hanya untuk yang kembali (#34 diubah) diuji di meja.test.ts (#8).

import { afterEach, describe, expect, it, vi } from 'vitest';
import { Rng, type Kartu } from '@remi/engine';
import {
  idAksiSah,
  Meja,
  SISA_MIN_SAMBUNG_MS,
  TENGGANG_SAMBUNG_MS,
  TOLERANSI_BATAS_MS,
  validasiPesan,
  type DataMeja,
  type OpsiMeja,
} from '../src/index.js';
import { aksiManusia, siapkan, siapSemua } from './bantu.js';

afterEach(() => {
  vi.restoreAllMocks();
});

/**
 * Meja 3 kursi: host Budi (0), Siti/p2 (1), warga kedai (2). Nama warga kedai di luar daftar persona
 * supaya tanpa gaya (panjang permainan tidak ikut bergeser kalau gaya disetel ulang).
 */
function mejaDua(pengaturan: Record<string, unknown> = {}, extra: Partial<OpsiMeja> = {}) {
  const ctx = siapkan({ namaLawan: ['Warga A'], ...extra });
  const meja = Meja.buat(ctx.opsi, 'host', 'Budi', { jumlahPemain: 3, detikGiliran: 0, ...pengaturan });
  meja.masuk('p2', 'Siti');
  meja.terima('host', { t: 'aturKursi', kursi: 2, jenis: 'bot' });
  return { ...ctx, meja };
}

/** Giliran pertama milik Siti (kursi 1), joker sudah di-OK semua. */
function giliranSiti(pengaturan: Record<string, unknown> = {}, extra: Partial<OpsiMeja> = {}) {
  const ctx = mejaDua(pengaturan, extra);
  ctx.meja.terima('host', { t: 'mulai', pengocok: 1 });
  siapSemua(ctx.meja);
  expect(ctx.meja.data.game!.putaran!.giliran).toBe(1);
  return ctx;
}

/** Meja 1 manusia (host, kursi 0) + 1 warga kedai. Belum dimulai. */
function mejaSendiri(pengaturan: Record<string, unknown> = {}, extra: Partial<OpsiMeja> = {}) {
  const ctx = siapkan({ namaLawan: ['Warga A'], ...extra });
  const meja = Meja.buat(ctx.opsi, 'host', 'Budi', { jumlahPemain: 2, detikGiliran: 0, ...pengaturan });
  meja.terima('host', { t: 'aturKursi', kursi: 1, jenis: 'bot' });
  return { ...ctx, meja };
}

const jumlahAksi = (meja: Meja, pemain: number) =>
  meja.data.game!.peristiwa.filter((e) => 'pemain' in e && e.pemain === pemain).length;

/**
 * Meja mejaDua yang dipaksa masuk susun akhir (deck dipindah ke tangan warga kedai sampai tinggal satu
 * kartu, lalu host mengambilnya), dilanjutkan dengan meja baru tepat di awal susun akhir, sebelum ada
 * yang menyusun. `ubah` boleh mengubah data meja di titik itu.
 */
function susunAkhirDua(pengaturan: Record<string, unknown>, ubah: (data: DataMeja) => void = () => undefined) {
  const ctx = mejaDua(pengaturan);
  const { meja, surat, opsi } = ctx;
  meja.terima('host', { t: 'mulai', pengocok: 0 });
  siapSemua(meja);
  const data = meja.data;
  meja.hentikan();
  const p = data.game!.putaran!;
  p.tangan[2].push(...p.deck.splice(0, p.deck.length - 1));
  const tengah = new Meja(opsi, data);
  tengah.terhubung('host');
  const rng = new Rng(3);
  for (let i = 0; i < 10 && tengah.data.game!.status === 'putaranBerjalan'; i++) aksiManusia(tengah, surat, 'host', rng);
  expect(tengah.data.game!.status).toBe('susunAkhir');
  const awal = tengah.data;
  tengah.hentikan();
  expect(awal.game!.putaran!.selesaiSusun).toEqual([false, false, false]);
  ubah(awal);
  const lanjut = new Meja(opsi, awal);
  lanjut.terhubung('host');
  return { ...ctx, meja: lanjut };
}

/** Pindahkan satu seri angka (3 kartu sebunga berurutan, tanpa joker) dari tangan kursi `dari` ke `ke`. */
function pindahSeri(data: DataMeja, dari: number, ke: number): void {
  const p = data.game!.putaran!;
  const tangan = p.tangan[dari];
  for (const bunga of new Set(tangan.map((k) => k.bunga))) {
    for (let r = 2; r <= 8; r++) {
      const seri = [r, r + 1, r + 2].map((x) => (x === p.rankJoker ? undefined : tangan.find((k) => k.bunga === bunga && k.rank === x)));
      if (!seri.every((k): k is Kartu => k !== undefined)) continue;
      for (const k of seri) tangan.splice(tangan.indexOf(k), 1);
      p.tangan[ke].push(...seri);
      return;
    }
  }
  throw new Error('Tidak ada seri di tangan itu.');
}

describe('sisa waktu minimal saat kembali di giliran sendiri (#37 diubah 24 Okt 2026)', () => {
  it('putus 15 dtk berulang: sisa minimal hanya diberi sekali per giliran, dan hanya kalau sisanya kurang', () => {
    const { meja, surat, jam } = giliranSiti({ detikGiliran: 60 });
    const t0 = jam.sekarang();
    expect(surat.info('host').batasWaktu).toBe(t0 + 60_000);
    // Kembali pertama: sisa 35 dtk masih cukup, batas tidak berubah (jatahnya belum terpakai).
    jam.maju(10_000);
    meja.terputus('p2');
    jam.maju(15_000);
    meja.masuk('p2', 'Siti');
    expect(surat.info('p2').batasWaktu).toBe(t0 + 60_000);
    // Kembali kedua: sisa 10 dtk, dimundurkan sampai tersisa SISA_MIN_SAMBUNG_MS.
    jam.maju(10_000);
    meja.terputus('p2');
    jam.maju(15_000);
    meja.masuk('p2', 'Siti');
    expect(SISA_MIN_SAMBUNG_MS).toBe(20_000);
    expect(surat.info('p2').batasWaktu).toBe(jam.sekarang() + SISA_MIN_SAMBUNG_MS);
    expect(surat.info('host').batasWaktu).toBe(t0 + 70_000);
    // Kembali ketiga di giliran yang sama: tidak ditambah lagi.
    jam.maju(5_000);
    meja.terputus('p2');
    jam.maju(10_000);
    meja.masuk('p2', 'Siti');
    expect(surat.info('p2').batasWaktu).toBe(t0 + 70_000);
    // Tidak kembali bekerja: diambil alih di batas + toleransi.
    jam.maju(t0 + 70_000 + TOLERANSI_BATAS_MS - 1 - jam.sekarang());
    expect(surat.info('host').diambilAlihBot).toBe(false);
    jam.maju(1);
    expect(surat.info('host').diambilAlihBot).toBe(true);
  });

  it('kembali tanpa bukti putus (gabung ulang di sambungan yang sama): tanpa tambahan', () => {
    const { meja, surat, jam } = giliranSiti({ detikGiliran: 60 });
    const batas = surat.info('host').batasWaktu;
    jam.maju(50_000);
    meja.masuk('p2', 'Siti');
    expect(surat.info('p2').batasWaktu).toBe(batas);
  });

  it('sambungan baru menggantikan yang lama (tanda dari server): dapat tambahan walau meja belum tahu ia putus', () => {
    const { meja, surat, jam } = giliranSiti({ detikGiliran: 60 });
    jam.maju(50_000);
    meja.masuk('p2', 'Siti', undefined, true);
    expect(surat.info('p2').batasWaktu).toBe(jam.sekarang() + SISA_MIN_SAMBUNG_MS);
  });

  it('kembali sesudah batas resmi tapi masih di jendela toleransi: tetap dapat sisa minimal', () => {
    const { meja, surat, jam } = giliranSiti({ detikGiliran: 30 });
    jam.maju(20_000);
    meja.terputus('p2');
    jam.maju(11_000);
    expect(surat.info('host').diambilAlihBot).toBe(false);
    meja.masuk('p2', 'Siti');
    expect(surat.info('p2').batasWaktu).toBe(jam.sekarang() + SISA_MIN_SAMBUNG_MS);
    meja.terima('p2', { t: 'aksi', aksi: { jenis: 'ambilDeck' } });
    expect(surat.errors('p2')).toEqual([]);
  });

  it('tidak pernah lebih dari satu giliran penuh (batas waktu giliran lebih pendek dari sisa minimal)', () => {
    const { meja, surat, jam } = giliranSiti({ detikGiliran: 10 });
    jam.maju(8_000);
    meja.terputus('p2');
    jam.maju(1_000);
    meja.masuk('p2', 'Siti');
    expect(surat.info('p2').batasWaktu).toBe(jam.sekarang() + 10_000);
  });

  it('sudah diambil alih warga kedai karena waktu habis: pengambilalihan tidak dibatalkan, tanpa tambahan', () => {
    const { meja, surat, jam } = giliranSiti({ detikGiliran: 30 }, { jedaBotMs: 5_000 });
    jam.maju(30_000 + TOLERANSI_BATAS_MS);
    expect(surat.info('host').diambilAlihBot).toBe(true);
    meja.terputus('p2');
    jam.maju(1_000);
    meja.masuk('p2', 'Siti', undefined, true);
    expect(surat.info('p2').diambilAlihBot).toBe(true);
    meja.terima('p2', { t: 'aksi', aksi: { jenis: 'ambilDeck' } });
    expect(surat.errors('p2').at(-1)).toContain('Waktu habis');
  });

  it('bukan gilirannya: batas waktu giliran orang lain tidak ikut mundur', () => {
    const { meja, surat, jam } = mejaDua({ detikGiliran: 60 });
    meja.terima('host', { t: 'mulai', pengocok: 0 });
    siapSemua(meja);
    const batas = surat.info('host').batasWaktu;
    jam.maju(50_000);
    meja.terputus('p2');
    jam.maju(5_000);
    meja.masuk('p2', 'Siti', undefined, true);
    expect(surat.info('host').batasWaktu).toBe(batas);
  });

  it('susun akhir: yang belum selesai menyusun dapat sisa minimal sekali', () => {
    const { meja, surat, jam, opsi } = mejaDua({ detikGiliran: 30 });
    meja.terima('host', { t: 'mulai', pengocok: 0 });
    siapSemua(meja);
    // Paksa deck tinggal satu kartu lewat data meja, lalu lanjutkan (seperti test susun akhir lain).
    const data = meja.data;
    meja.hentikan();
    const p = data.game!.putaran!;
    p.tangan[2].push(...p.deck.splice(0, p.deck.length - 1));
    const lanjut = new Meja(opsi, data);
    lanjut.terhubung('host');
    const rng = new Rng(3);
    for (let i = 0; i < 10 && lanjut.data.game!.status === 'putaranBerjalan'; i++) aksiManusia(lanjut, surat, 'host', rng);
    expect(lanjut.data.game!.status).toBe('susunAkhir');
    const batas = surat.info('p2').batasWaktu!;
    jam.maju(batas - jam.sekarang() - 2_000);
    lanjut.terputus('p2');
    jam.maju(1_000);
    lanjut.masuk('p2', 'Siti');
    expect(surat.info('p2').batasWaktu).toBe(jam.sekarang() + SISA_MIN_SAMBUNG_MS);
    const batasBaru = surat.info('p2').batasWaktu;
    jam.maju(18_000);
    lanjut.terputus('p2');
    jam.maju(1_000);
    lanjut.masuk('p2', 'Siti');
    expect(surat.info('p2').batasWaktu).toBe(batasBaru);
    lanjut.hentikan();
  });

  it('main lagi: jatah di susun akhir tidak terbawa ke permainan baru (kunci susun akhir berulang)', () => {
    const { meja, surat, jam } = mejaDua({ detikGiliran: 30, batasPutaran: 1 });
    const rng = new Rng(11);
    const sisa: number[] = [];
    for (let main = 0; main < 2; main++) {
      if (main === 1) meja.terima('host', { t: 'mainLagi' });
      meja.terima('host', { t: 'mulai', pengocok: 0 });
      siapSemua(meja);
      for (let i = 0; i < 5000 && meja.data.game!.status === 'putaranBerjalan'; i++) {
        if (!aksiManusia(meja, surat, 'host', rng) && !aksiManusia(meja, surat, 'p2', rng)) jam.langkah();
      }
      // Susun akhir putaran 1 di kedua permainan: kunci gilirannya sama.
      expect(meja.data.game!.status).toBe('susunAkhir');
      expect(meja.data.game!.putaran!.nomor).toBe(1);
      expect(meja.data.game!.putaran!.selesaiSusun[1]).toBe(false);
      jam.maju(surat.info('p2').batasWaktu! - jam.sekarang() - 2_000);
      meja.terputus('p2');
      jam.maju(1_000);
      meja.masuk('p2', 'Siti');
      sisa.push(surat.info('p2').batasWaktu! - jam.sekarang());
      for (let i = 0; i < 200 && meja.data.game!.status === 'susunAkhir'; i++) {
        if (!aksiManusia(meja, surat, 'host', rng) && !aksiManusia(meja, surat, 'p2', rng)) jam.langkah();
      }
      expect(meja.status).toBe('selesai');
    }
    expect(sisa).toEqual([SISA_MIN_SAMBUNG_MS, SISA_MIN_SAMBUNG_MS]);
    meja.hentikan();
  });
});

describe('toleransi tersembunyi sesudah batas waktu giliran (24 Okt 2026)', () => {
  it('aksi yang tiba sesudah batas resmi tapi masih dalam toleransi diterima biasa, tanpa memperpanjang batas', () => {
    const { meja, surat, jam } = giliranSiti({ detikGiliran: 30 });
    const batas = surat.info('p2').batasWaktu!;
    jam.maju(30_000 + 500);
    meja.terima('p2', { t: 'aksi', aksi: { jenis: 'ambilDeck' } });
    expect(surat.errors('p2')).toEqual([]);
    expect(surat.info('p2').batasWaktu).toBe(batas);
    expect(surat.info('p2').diambilAlihBot).toBe(false);
    // Sisa toleransi habis: warga kedai mengambil alih sisa giliran, aksi Siti ditolak.
    jam.maju(TOLERANSI_BATAS_MS - 500);
    expect(surat.info('p2').diambilAlihBot).toBe(true);
    meja.terima('p2', { t: 'aksi', aksi: { jenis: 'buang', kartuId: surat.view('p2').putaran!.tangan[1]![0].id } });
    expect(surat.errors('p2').at(-1)).toContain('Waktu habis');
  });

  it('penyusunan ulang jadwal di jendela toleransi tidak memperpanjangnya', () => {
    const { meja, surat, jam } = giliranSiti({ detikGiliran: 30 });
    jam.maju(30_000 + 1_000);
    // Perubahan lain (host putus-sambung) menyusun ulang jadwal meja.
    meja.terputus('host');
    meja.masuk('host', 'Budi');
    jam.maju(TOLERANSI_BATAS_MS - 1_000 - 1);
    expect(surat.info('host').diambilAlihBot).toBe(false);
    jam.maju(1);
    expect(surat.info('host').diambilAlihBot).toBe(true);
  });
});

describe('jeda total karena semua manusia terputus (#35 diubah 24 Okt 2026)', () => {
  it('waktu habis sebelum jeda dan warga kedai belum melangkah: sesudah kembali, pengambilalihan batal dan waktu penuh', () => {
    const { meja, surat, jam } = mejaSendiri({ detikGiliran: 60 }, { jedaBotMs: 5_000 });
    meja.terima('host', { t: 'mulai', pengocok: 0 });
    siapSemua(meja);
    jam.maju(60_000 + TOLERANSI_BATAS_MS);
    expect(surat.info('host').diambilAlihBot).toBe(true);
    // Server baru tahu host terputus sesudah waktunya habis, sebelum warga kedai sempat melangkah.
    meja.terputus('host');
    jam.maju(60_000);
    meja.terhubung('host');
    expect(surat.info('host').diambilAlihBot).toBe(false);
    expect(surat.info('host').batasWaktu).toBe(jam.sekarang() + 60_000);
    expect(jumlahAksi(meja, 0)).toBe(0);
    meja.terima('host', { t: 'aksi', aksi: { jenis: 'ambilDeck' } });
    expect(surat.errors('host')).toEqual([]);
  });

  it('warga kedai sudah melangkah di giliran itu sebelum jeda: pengambilalihan tetap', () => {
    const { meja, surat, jam } = mejaSendiri({ detikGiliran: 60 }, { jedaBotMs: 1_000 });
    meja.terima('host', { t: 'mulai', pengocok: 0 });
    siapSemua(meja);
    jam.maju(60_000 + TOLERANSI_BATAS_MS + 1_000);
    expect(jumlahAksi(meja, 0)).toBe(1);
    expect(meja.data.game!.putaran!.giliran).toBe(0);
    meja.terputus('host');
    jam.maju(60_000);
    meja.terhubung('host');
    expect(surat.info('host').diambilAlihBot).toBe(true);
    meja.terima('host', { t: 'aksi', aksi: { jenis: 'buang', kartuId: surat.view('host').putaran!.tangan[0]![0].id } });
    expect(surat.errors('host').at(-1)).toContain('Waktu habis');
  });

  it('semua terputus lebih lama dari tenggang lalu satu kembali: yang masih terputus dapat tenggang penuh lagi', () => {
    const { meja, jam } = giliranSiti();
    meja.terputus('p2');
    jam.maju(5_000);
    meja.terputus('host');
    // Jeda total: tidak ada timer, tenggang Siti "habis" selama jeda.
    expect(jam.jumlahTimer).toBe(0);
    jam.maju(60_000);
    meja.masuk('host', 'Budi');
    // Tenggang Siti dihitung lagi sejak meja lanjut, jadi warga kedai belum menjalankan gilirannya.
    jam.maju(TENGGANG_SAMBUNG_MS - 1);
    expect(jumlahAksi(meja, 1)).toBe(0);
    jam.maju(1 + 100);
    expect(jumlahAksi(meja, 1)).toBeGreaterThan(0);
  });

  // Di susun akhir semua kursi berbagi satu kunci giliran, dan kursi warga kedai sendiri biasanya sudah
  // selesai menyusun jauh sebelum batas waktu manusia. Langkah itu tidak boleh dihitung sebagai
  // "warga kedai sudah menjalankan pengambilalihan".
  it('susun akhir: waktu habis, warga kedai belum menjalankan kursi manusia mana pun, lalu jeda: pengambilalihan batal', () => {
    const { meja, surat, jam } = susunAkhirDua({ detikGiliran: 30 });
    const batas = surat.info('host').batasWaktu!;
    jam.maju(batas + TOLERANSI_BATAS_MS - jam.sekarang());
    expect(meja.data.game!.putaran!.selesaiSusun).toEqual([false, false, true]);
    expect(surat.info('host').diambilAlihBot).toBe(true);
    // Kedua manusia terputus sebelum warga kedai sempat menyusunkan untuk mereka.
    meja.terputus('host');
    meja.terputus('p2');
    jam.maju(60_000);
    meja.masuk('host', 'Budi');
    expect(surat.info('host').diambilAlihBot).toBe(false);
    expect(surat.info('host').batasWaktu).toBe(jam.sekarang() + 30_000);
    // Siti yang masih terputus dapat tenggang penuh lagi.
    jam.maju(TENGGANG_SAMBUNG_MS - 1);
    expect(meja.data.game!.putaran!.selesaiSusun).toEqual([false, false, true]);
    meja.terima('host', { t: 'aksi', aksi: { jenis: 'selesaiSusun' } });
    expect(surat.errors('host')).toEqual([]);
    expect(meja.data.game!.putaran!.selesaiSusun[0]).toBe(true);
    meja.hentikan();
  });

  it('susun akhir: warga kedai sudah menyusun untuk manusia yang belum selesai sebelum jeda: pengambilalihan tetap', () => {
    // Host memegang satu seri, jadi langkah pertama warga kedai untuknya "turunkan" (belum selesai).
    const { meja, surat, jam } = susunAkhirDua({ detikGiliran: 30 }, (d) => pindahSeri(d, 2, 0));
    jam.maju(surat.info('host').batasWaktu! + TOLERANSI_BATAS_MS - jam.sekarang());
    expect(meja.data.game!.putaran!.selesaiSusun).toEqual([false, false, true]);
    jam.maju(100);
    expect(meja.data.game!.peristiwa.at(-1)).toMatchObject({ jenis: 'turunkan', pemain: 0 });
    expect(meja.data.game!.putaran!.selesaiSusun).toEqual([false, false, true]);
    meja.terputus('host');
    meja.terputus('p2');
    jam.maju(60_000);
    meja.masuk('host', 'Budi');
    expect(surat.info('host').diambilAlihBot).toBe(true);
    meja.terima('host', { t: 'aksi', aksi: { jenis: 'selesaiSusun' } });
    expect(surat.errors('host').at(-1)).toContain('Waktu habis');
    meja.hentikan();
  });

  it('susun akhir: manusia yang sudah diselesaikan warga kedai tidak menghalangi pembatalan untuk yang lain', () => {
    const { meja, surat, jam } = susunAkhirDua({ detikGiliran: 30 });
    jam.maju(surat.info('host').batasWaktu! + TOLERANSI_BATAS_MS - jam.sekarang());
    // Warga kedai menyelesaikan susun akhir host (tidak ada yang bisa diturunkan), Siti belum.
    jam.maju(100);
    expect(meja.data.game!.putaran!.selesaiSusun).toEqual([true, false, true]);
    meja.terputus('host');
    meja.terputus('p2');
    jam.maju(60_000);
    meja.masuk('p2', 'Siti');
    expect(surat.info('p2').diambilAlihBot).toBe(false);
    meja.terima('p2', { t: 'aksi', aksi: { jenis: 'selesaiSusun' } });
    expect(surat.errors('p2')).toEqual([]);
    meja.hentikan();
  });
});

describe('batas tunggu pengumuman joker habis selagi kabar putus ditunda server (#34)', () => {
  /** Joker putaran 1 diumumkan (batas tunggu 20 dtk), host sudah OK, Siti belum. */
  function jokerDitunggu() {
    const ctx = mejaDua({ detikGiliran: 20 });
    ctx.meja.terima('host', { t: 'mulai', pengocok: 0 });
    ctx.meja.terima('host', { t: 'siapJoker', putaran: 1 });
    expect(ctx.surat.info('host').menungguJoker).toEqual([1]);
    return { ...ctx, habis: ctx.jam.sekarang() + 20_000 };
  }

  it('sambungan tertutup sebelum batas, meja baru diberi tahu sesudahnya: saat kembali, popup muncul lagi untuknya saja', () => {
    const { meja, surat, jam, habis } = jokerDitunggu();
    jam.maju(17_000);
    const tutup = jam.sekarang();
    // Batas tunggu habis selagi meja masih mengira Siti tersambung.
    jam.maju(habis - jam.sekarang());
    expect(surat.info('host').menungguJoker).toEqual([]);
    expect(meja.data.sudahLihatJoker).toEqual([0, 1]);
    // Kabar putus dari server datang belakangan, membawa waktu sambungannya tertutup.
    jam.maju(2_000);
    meja.terputus('p2', tutup);
    jam.maju(4_000);
    meja.masuk('p2', 'Siti');
    expect(surat.info('p2').menungguJoker).toEqual([1]);
    expect(surat.info('host').menungguJoker).toEqual([]);
    // Ditanya ulang sekali saja.
    meja.terima('p2', { t: 'siapJoker', putaran: 1 });
    expect(surat.info('p2').menungguJoker).toEqual([]);
    meja.terputus('p2');
    meja.masuk('p2', 'Siti');
    expect(surat.info('p2').menungguJoker).toEqual([]);
  });

  it('kembali lewat sambungan baru sebelum meja diberi tahu (dalam jeda putus): popup muncul lagi', () => {
    const { meja, surat, jam, habis } = jokerDitunggu();
    jam.maju(17_000);
    const tutup = jam.sekarang();
    jam.maju(habis - jam.sekarang() + 1_000);
    meja.masuk('p2', 'Siti', undefined, true, tutup);
    expect(surat.info('p2').menungguJoker).toEqual([1]);
    expect(surat.info('host').menungguJoker).toEqual([]);
  });

  it('sambungan lama setengah mati digantikan (waktu putusnya tidak diketahui): popup muncul lagi', () => {
    const { meja, surat, jam, habis } = jokerDitunggu();
    jam.maju(habis - jam.sekarang() + 5_000);
    meja.masuk('p2', 'Siti', undefined, true);
    expect(surat.info('p2').menungguJoker).toEqual([1]);
  });

  it('putus sesudah batas tunggu habis: popupnya sudah tampil sampai habis, tidak ditanya lagi', () => {
    for (const lewatServer of [false, true]) {
      const { meja, surat, jam, habis } = jokerDitunggu();
      jam.maju(habis - jam.sekarang() + 3_000);
      const tutup = jam.sekarang();
      jam.maju(lewatServer ? 1_000 : 6_000);
      if (lewatServer) meja.masuk('p2', 'Siti', undefined, true, tutup);
      else {
        meja.terputus('p2', tutup);
        meja.masuk('p2', 'Siti');
      }
      expect(surat.info('p2').menungguJoker, `lewatServer ${lewatServer}`).toEqual([]);
      meja.hentikan();
    }
  });

  it('sudah menekan OK sesudah batas tunggu habis: tidak ditanya lagi', () => {
    const { meja, surat, jam, habis } = jokerDitunggu();
    jam.maju(habis - jam.sekarang());
    meja.terima('p2', { t: 'siapJoker', putaran: 1 });
    jam.maju(5_000);
    meja.masuk('p2', 'Siti', undefined, true);
    expect(surat.info('p2').menungguJoker).toEqual([]);
  });
});

describe('jeda mikir warga kedai tidak diundi ulang setiap perubahan (24 Okt 2026)', () => {
  /** Math.random tetap 0,5: jeda mikir santai = 3000 + 0,5 × 7000 = 6500 ms. */
  const MIKIR = 6_500;

  function giliranWarga(extra: Partial<OpsiMeja> = {}) {
    vi.spyOn(Math, 'random').mockReturnValue(0.5);
    const ctx = mejaDua({ tempoBot: 'santai' }, { jedaBotMs: undefined, ...extra });
    ctx.meja.terima('host', { t: 'mulai', pengocok: 2 });
    siapSemua(ctx.meja);
    expect(ctx.meja.data.game!.putaran!.giliran).toBe(2);
    return ctx;
  }

  it('putus-sambung pemain lain tidak menggeser waktu langkah warga kedai', () => {
    const { meja, jam } = giliranWarga();
    // Siti putus-sambung tiap 2 dtk (dulu: jeda mikir diundi ulang tiap kali, warga kedai tidak pernah jalan).
    for (let t = 0; t < 3; t++) {
      jam.maju(1_000);
      meja.terputus('p2');
      jam.maju(1_000);
      meja.masuk('p2', 'Siti', undefined, true);
    }
    expect(jumlahAksi(meja, 2)).toBe(0);
    jam.maju(MIKIR - 6_000 - 1);
    expect(jumlahAksi(meja, 2)).toBe(0);
    jam.maju(1);
    expect(jumlahAksi(meja, 2)).toBe(1);
  });

  it('sesudah jeda total, warga kedai mendapat jeda mikir baru', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.5);
    const { meja, jam } = mejaSendiri({ tempoBot: 'santai' }, { jedaBotMs: undefined });
    meja.terima('host', { t: 'mulai', pengocok: 1 });
    siapSemua(meja);
    jam.maju(3_000);
    meja.terputus('host');
    jam.maju(30_000);
    meja.terhubung('host');
    jam.maju(MIKIR - 1);
    expect(jumlahAksi(meja, 1)).toBe(0);
    jam.maju(1);
    expect(jumlahAksi(meja, 1)).toBe(1);
  });

  it('tempo diubah host: jeda baru langsung berlaku', () => {
    const { meja, jam } = giliranWarga();
    jam.maju(1_000);
    meja.terima('host', { t: 'pengaturan', pengaturan: { tempoBot: 'cepat' } });
    // Cepat: 800 + 0,5 × 1200 = 1400 ms sejak diubah.
    jam.maju(1_399);
    expect(jumlahAksi(meja, 2)).toBe(0);
    jam.maju(1);
    expect(jumlahAksi(meja, 2)).toBe(1);
  });
});

describe('kabar langkah yang dijalankan warga kedai selama terputus', () => {
  it('tenggang habis dan warga kedai melangkah: pesan masuk membawa dijalankanWarga, sekali saja', () => {
    const { meja, surat, jam } = giliranSiti();
    meja.terputus('p2');
    // Langkah pertama warga kedai tepat di tenggang + jeda (100 ms); langkah kedua 100 ms sesudahnya.
    jam.maju(TENGGANG_SAMBUNG_MS + 100);
    expect(jumlahAksi(meja, 1)).toBeGreaterThan(0);
    meja.masuk('p2', 'Siti');
    expect(surat.terakhir('p2', 'masuk')).toEqual({ t: 'masuk', kode: 'ABCDE', token: 'p2', kursi: 1, dijalankanWarga: 1 });
    // Sudah dikabarkan: sambung ulang berikutnya tanpa kabar.
    meja.terputus('p2');
    meja.masuk('p2', 'Siti');
    expect(surat.terakhir('p2', 'masuk')).not.toHaveProperty('dijalankanWarga');
  });

  it('menghitung semua langkah selama terputus, termasuk di giliran berikutnya', () => {
    const { meja, surat, jam } = giliranSiti();
    meja.terputus('p2');
    jam.maju(TENGGANG_SAMBUNG_MS);
    const rng = new Rng(4);
    // Warga kedai menjalankan giliran Siti sampai selesai, lalu giliran berputar sampai Siti lagi.
    let lewat = false;
    for (let i = 0; i < 500; i++) {
      const p = meja.data.game!.putaran!;
      if (meja.data.game!.status !== 'putaranBerjalan') break;
      if (p.giliran !== 1) lewat = true;
      else if (lewat && jumlahAksi(meja, 1) > 2) break;
      if (!aksiManusia(meja, surat, 'host', rng)) jam.langkah();
    }
    const langkah = meja.data.game!.peristiwa.filter((e) => 'pemain' in e && e.pemain === 1 && e.jenis !== 'mentung').length;
    meja.masuk('p2', 'Siti');
    const n = surat.terakhir('p2', 'masuk')!.dijalankanWarga!;
    expect(n).toBeGreaterThanOrEqual(2);
    expect(n).toBeLessThanOrEqual(langkah);
  });

  it('kembali sebelum tenggang habis: tanpa kabar', () => {
    const { meja, surat, jam } = giliranSiti();
    meja.terputus('p2');
    jam.maju(TENGGANG_SAMBUNG_MS - 1);
    meja.masuk('p2', 'Siti');
    expect(surat.terakhir('p2', 'masuk')).toEqual({ t: 'masuk', kode: 'ABCDE', token: 'p2', kursi: 1 });
  });

  it('langkah warga kedai karena waktu habis selagi masih tersambung tidak dihitung', () => {
    const { meja, surat, jam } = giliranSiti({ detikGiliran: 30 });
    jam.maju(30_000 + TOLERANSI_BATAS_MS + 100);
    expect(jumlahAksi(meja, 1)).toBeGreaterThan(0);
    meja.terputus('p2');
    meja.masuk('p2', 'Siti');
    expect(surat.terakhir('p2', 'masuk')).not.toHaveProperty('dijalankanWarga');
  });

  it('main lagi mengosongkan hitungan (kabar tidak terbawa ke permainan baru)', () => {
    const { meja, surat, jam } = giliranSiti({ batasPutaran: 1 });
    meja.terputus('p2');
    const rng = new Rng(6);
    for (let i = 0; i < 5000 && meja.status === 'main'; i++) {
      if (meja.data.game!.status === 'putaranSelesai') break;
      if (!aksiManusia(meja, surat, 'host', rng)) jam.langkah();
    }
    expect(meja.status).toBe('selesai');
    expect(jumlahAksi(meja, 1)).toBeGreaterThan(0);
    meja.terima('host', { t: 'mainLagi' });
    meja.masuk('p2', 'Siti');
    expect(surat.terakhir('p2', 'masuk')).not.toHaveProperty('dijalankanWarga');
  });

  it('terputus dengan waktu putus sebenarnya (dari server): tenggang dihitung dari situ', () => {
    const { meja, surat, jam } = giliranSiti();
    meja.terputus('p2', jam.sekarang() - 5_000);
    jam.maju(TENGGANG_SAMBUNG_MS - 5_000 - 1);
    expect(surat.info('host').botMikir).toBeNull();
    jam.maju(1);
    expect(surat.info('host').botMikir).toBe(1);
  });
});

describe('siapJoker dengan nomor putaran', () => {
  it('OK untuk putaran lain diabaikan; OK putaran ini dan OK tanpa nomor (aplikasi lama) diterima', () => {
    const { meja, surat } = mejaDua();
    meja.terima('host', { t: 'mulai', pengocok: 0 });
    expect(surat.info('host').menungguJoker).toEqual([0, 1]);
    meja.terima('host', { t: 'siapJoker', putaran: 2 });
    expect(meja.data.menungguJoker).toEqual([0, 1]);
    meja.terima('host', { t: 'siapJoker', putaran: 1 });
    expect(meja.data.menungguJoker).toEqual([1]);
    meja.terima('p2', { t: 'siapJoker' });
    expect(meja.data.menungguJoker).toEqual([]);
    expect(surat.errors('host')).toEqual([]);
  });

  it('OK putaran lama yang terkirim sesudah sambung ulang tidak menutup popup putaran baru', () => {
    const ctx = mejaDua({ batasPutaran: null, batasSkorAtas: null, batasSkorBawah: null });
    const { meja, surat, jam } = ctx;
    meja.terima('host', { t: 'mulai', pengocok: 0 });
    siapSemua(meja);
    const rng = new Rng(8);
    for (let i = 0; i < 5000 && meja.data.game!.status !== 'putaranSelesai'; i++) {
      if (!aksiManusia(meja, surat, 'host', rng) && !aksiManusia(meja, surat, 'p2', rng)) jam.langkah();
    }
    expect(meja.data.game!.status).toBe('putaranSelesai');
    // Siti terputus di antara putaran; putaran 2 mulai tanpa dia.
    meja.terputus('p2');
    meja.terima('host', { t: 'putaranBerikut' });
    meja.terima('host', { t: 'siapJoker', putaran: 2 });
    meja.masuk('p2', 'Siti');
    expect(surat.info('p2').menungguJoker).toEqual([1]);
    // OK putaran 1 yang baru sampai: diabaikan, popup putaran 2 tetap ditunggu.
    meja.terima('p2', { t: 'siapJoker', putaran: 1 });
    expect(surat.info('p2').menungguJoker).toEqual([1]);
    meja.terima('p2', { t: 'siapJoker', putaran: 2 });
    expect(surat.info('p2').menungguJoker).toEqual([]);
  });
});

describe('validasi pesan baru (protokol aditif)', () => {
  it('siapJoker: nomor putaran opsional, bentuk salah ditolak', () => {
    expect(validasiPesan({ t: 'siapJoker' })).toEqual({ t: 'siapJoker' });
    expect(validasiPesan({ t: 'siapJoker', putaran: 3 })).toEqual({ t: 'siapJoker', putaran: 3 });
    for (const putaran of ['3', -1, 1.5, null, 2_000_000]) expect(validasiPesan({ t: 'siapJoker', putaran }), String(putaran)).toBeNull();
  });

  it('aksi: id opsional 1–64 huruf/angka/_/-; id tidak sah = seluruh pesan ditolak', () => {
    const aksi = { jenis: 'ambilDeck' };
    expect(validasiPesan({ t: 'aksi', aksi })).toEqual({ t: 'aksi', aksi });
    expect(validasiPesan({ t: 'aksi', aksi })).not.toHaveProperty('id');
    expect(validasiPesan({ t: 'aksi', aksi, id: 'a1-B_2' })).toEqual({ t: 'aksi', aksi, id: 'a1-B_2' });
    const uuid = '0d5c2f7e-1b8a-4c1e-9a55-3f1d2b7c9e10';
    expect(validasiPesan({ t: 'aksi', aksi, id: uuid })).toEqual({ t: 'aksi', aksi, id: uuid });
    expect(validasiPesan({ t: 'aksi', aksi, id: 'x'.repeat(64) })).not.toBeNull();
    for (const id of ['', 'x'.repeat(65), 'a b', 'a/b', 'ä', 5, null, {}]) {
      expect(validasiPesan({ t: 'aksi', aksi, id }), JSON.stringify(id)).toBeNull();
      expect(idAksiSah(id)).toBe(false);
    }
  });
});
