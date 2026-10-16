// Batas skor bebas kelipatan 10 (keputusan pemilik #44): validasi pesan dari jaringan, perapian
// isian UI/simpanan (rapikanBatasSkor), dan satu permainan penuh yang selesai karena batas skor
// pilihan host (250 / −120). Pengecekan akhir permainan di engine tidak berubah.

import { describe, expect, it } from 'vitest';
import { Rng } from '@remi/engine';
import {
  BATAS_SKOR_MAKS,
  batasSkorSah,
  Meja,
  rapikanBatasSkor,
  validasiPengaturan,
  validasiPesan,
  type RingkasanAkhir,
} from '../src/index.js';
import { aksiManusia, siapkan, siapSemua } from './bantu.js';

describe('validasi batas skor (#44)', () => {
  it.each([10, 120, 250, 300, 500, 1000, 12340, BATAS_SKOR_MAKS, null])('batas atas %j diterima', (v) => {
    expect(batasSkorSah(v, 'atas')).toBe(true);
    expect(validasiPengaturan({ batasSkorAtas: v })).toEqual({ batasSkorAtas: v });
  });

  it.each([505, 0, -500, 5, 255.5, BATAS_SKOR_MAKS + 10, '500', undefined, NaN, Infinity])('batas atas %j ditolak', (v) => {
    expect(batasSkorSah(v, 'atas')).toBe(false);
    if (v !== undefined) expect(validasiPengaturan({ batasSkorAtas: v })).toBeNull();
  });

  it.each([-10, -120, -300, -500, -1000, -BATAS_SKOR_MAKS, null])('batas bawah %j diterima', (v) => {
    expect(batasSkorSah(v, 'bawah')).toBe(true);
    expect(validasiPengaturan({ batasSkorBawah: v })).toEqual({ batasSkorBawah: v });
  });

  it.each([500, 0, -505, -5, -BATAS_SKOR_MAKS - 10, '-500', -120.5])('batas bawah %j ditolak', (v) => {
    expect(batasSkorSah(v, 'bawah')).toBe(false);
    expect(validasiPengaturan({ batasSkorBawah: v })).toBeNull();
  });

  it('pesan pengaturan dari pilihan lama lobi (300/500/1000 dan negatifnya) tetap sah', () => {
    for (const [atas, bawah] of [
      [300, -300],
      [500, -500],
      [1000, -1000],
    ]) {
      expect(validasiPesan({ t: 'pengaturan', pengaturan: { batasSkorAtas: atas, batasSkorBawah: bawah } })).toEqual({
        t: 'pengaturan',
        pengaturan: { batasSkorAtas: atas, batasSkorBawah: bawah },
      });
    }
    expect(validasiPesan({ t: 'buat', nama: 'Budi', pengaturan: { batasSkorAtas: 250, batasSkorBawah: -120 } })).not.toBeNull();
    expect(validasiPesan({ t: 'pengaturan', pengaturan: { batasSkorAtas: 255 } })).toBeNull();
  });

  it('batas putaran tetap seperti dulu: null atau 1..100000', () => {
    expect(validasiPengaturan({ batasPutaran: null })).toEqual({ batasPutaran: null });
    expect(validasiPengaturan({ batasPutaran: 7 })).toEqual({ batasPutaran: 7 });
    for (const v of [0, -3, 2.5, 100001, '5']) expect(validasiPengaturan({ batasPutaran: v }), String(v)).toBeNull();
  });
});

describe('rapikanBatasSkor: isian UI dan simpanan', () => {
  it.each([
    ['250', 'atas', 250],
    ['255', 'atas', 260],
    ['254', 'atas', 250],
    ['5', 'atas', 10],
    ['1', 'atas', 10],
    [' 300 ', 'atas', 300],
    ['1e3', 'atas', 1000],
    [12.5, 'atas', 10],
    ['999999', 'atas', BATAS_SKOR_MAKS],
    ['99995', 'atas', BATAS_SKOR_MAKS],
    // Batas bawah diketik positif (keyboard angka iPhone tanpa minus), disimpan negatif.
    ['120', 'bawah', -120],
    ['125', 'bawah', -130],
    ['-120', 'bawah', -120],
    ['−120', 'bawah', -120],
    [-500, 'bawah', -500],
    [500, 'bawah', -500],
    // Minus nyasar di batas atas: angkanya yang dipakai.
    ['-250', 'atas', 250],
    // Titik/koma ribuan (cara orang sini menulis seribu), bukan pecahan. Isian type=number di
    // Chrome menyerahkan "1.000" apa adanya; tanpa ini jadi 1 → 10 dan permainan tamat di putaran 1.
    ['1.000', 'atas', 1000],
    ['1.500', 'atas', 1500],
    ['1,500', 'atas', 1500],
    ['10.000', 'atas', 10000],
    ['100.000', 'atas', BATAS_SKOR_MAKS],
    ['1.000.000', 'atas', BATAS_SKOR_MAKS],
    ['1.000', 'bawah', -1000],
    ['-1.500', 'bawah', -1500],
    ['−2.000', 'bawah', -2000],
    // Bukan kelompok ribuan: tetap angka biasa (pecahan dibulatkan ke kelipatan 10).
    ['2.5', 'atas', 10],
    ['254.9', 'atas', 250],
    ['1.0000', 'atas', 10],
  ] as const)('%j (%s) → %j', (x, arah, hasil) => {
    expect(rapikanBatasSkor(x, arah)).toBe(hasil);
    expect(batasSkorSah(hasil, arah)).toBe(true);
  });

  it.each(['', '   ', '0', 0, -0, 'abc', '12abc', NaN, Infinity, null, undefined, true, {}, []])('%j = tanpa batas (null)', (x) => {
    expect(rapikanBatasSkor(x, 'atas')).toBeNull();
    expect(rapikanBatasSkor(x, 'bawah')).toBeNull();
  });
});

describe('permainan penuh dengan batas skor pilihan host', () => {
  // Seed tetap: 250/−120 selesai di putaran pertama (pentungan joker 250), 600/−400 butuh banyak putaran.
  it.each([
    [250, -120, 1],
    [600, -400, 5],
  ])('host atur %j / %j di lobi: permainan selesai karena batas skor, tidak lebih awal', (atas, bawah, minPutaran) => {
    let ringkasan: RingkasanAkhir | null = null;
    const galat: unknown[] = [];
    const ctx = siapkan({ saatSelesai: (r) => (ringkasan = r), saatGalat: (_k, e) => galat.push(e) });
    const meja = Meja.buat(ctx.opsi, 'host', 'Budi', { jumlahPemain: 3, detikGiliran: 0, batasPutaran: null });
    for (let i = 1; i < 3; i++) meja.terima('host', { t: 'aturKursi', kursi: i, jenis: 'bot' });
    meja.terima('host', { t: 'pengaturan', pengaturan: { batasSkorAtas: atas, batasSkorBawah: bawah } });
    const info = ctx.surat.info('host');
    expect([info.pengaturan.batasSkorAtas, info.pengaturan.batasSkorBawah]).toEqual([atas, bawah]);

    meja.terima('host', { t: 'mulai' });
    siapSemua(meja);
    expect(meja.data.game!.konfigurasi).toMatchObject({ batasSkorAtas: atas, batasSkorBawah: bawah, batasPutaran: null });

    const rng = new Rng(44);
    for (let putaran = 0; putaran < 60 && meja.status === 'main'; putaran++) {
      for (let i = 0; i < 5000; i++) {
        const st = meja.data.game?.status;
        if (st !== 'putaranBerjalan' && st !== 'susunAkhir') break;
        if (aksiManusia(meja, ctx.surat, 'host', rng)) continue;
        if (!ctx.jam.langkah()) throw new Error('macet');
      }
      if (meja.status === 'main') {
        meja.terima('host', { t: 'putaranBerikut' });
        siapSemua(meja);
      }
    }

    expect(meja.status).toBe('selesai');
    const g = meja.data.game!;
    expect(g.alasanSelesai).toBe('batasSkor');
    expect(g.skor.some((s) => s >= atas || s <= bawah)).toBe(true);
    // Putaran-putaran sebelumnya belum ada yang menyentuh batas.
    for (const h of g.riwayat.slice(0, -1)) expect(h.skorAkumulasi.every((s) => s < atas && s > bawah), `putaran ${h.nomor}`).toBe(true);
    expect(g.riwayat.length).toBeGreaterThanOrEqual(minPutaran);
    expect(ringkasan).not.toBeNull();
    expect(ringkasan!.alasan).toBe('batasSkor');
    expect(ctx.surat.errors('host')).toEqual([]);
    expect(galat).toEqual([]);
  });
});
