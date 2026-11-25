// Obrolan (0.7.0): meja mengingat MAKS_OBROLAN emote/pesan terakhir (manusia dan celetukan warga
// kedai) dengan nama pengirim, hanya di memori, dan mengirimnya ke pemain yang duduk atau tersambung
// kembali. Penonton tidak pernah menerimanya.
import { describe, expect, it } from 'vitest';
import { Rng } from '@remi/engine';
import { Meja } from '../src/meja.js';
import { MAKS_OBROLAN, type PesanServer } from '../src/protokol.js';
import { validasiObrolan } from '../src/validasi.js';
import { aksiManusia, siapkan, siapSemua } from './bantu.js';

const obrolanDari = (semua: PesanServer[]) =>
  semua.filter((p): p is Extract<PesanServer, { t: 'obrolan' }> => p.t === 'obrolan');

describe('obrolan meja', () => {
  it('pesan di lobi dicatat dengan nama, lalu dikirim ke yang baru duduk', () => {
    const { opsi, surat, jam } = siapkan();
    const m = Meja.buat(opsi, 'A', 'Ani', { jumlahPemain: 3 });
    // Belum ada obrolan: yang baru duduk tidak dikirimi pesan obrolan.
    m.masuk('B', 'Budi');
    expect(obrolanDari(surat.semua('B'))).toEqual([]);
    m.terima('A', { t: 'emote', isi: 'Halo semua' });
    jam.maju(1500);
    m.terima('B', { t: 'emote', isi: '😂' });
    expect(surat.terakhir('A', 'emote')).toEqual({ t: 'emote', kursi: 1, isi: '😂' });
    m.masuk('C', 'Cici');
    const o = surat.terakhir('C', 'obrolan')!;
    expect(o.pesan.map((e) => [e.nama, e.isi])).toEqual([
      ['Ani', 'Halo semua'],
      ['Budi', '😂'],
    ]);
    expect(o.pesan[0]!.w).toBe(1_000_000);
    expect(o.pesan[1]!.w).toBe(1_001_500);
    // Dikirim sesudah 'masuk', supaya aplikasi tahu obrolan ini milik meja yang baru dimasuki.
    const jenis = surat.semua('C').map((p) => p.t);
    expect(jenis.indexOf('obrolan')).toBeGreaterThan(jenis.indexOf('masuk'));
  });

  it('batas 1,2 detik tetap berlaku: yang dibuang tidak masuk obrolan', () => {
    const { opsi, surat, jam } = siapkan();
    const m = Meja.buat(opsi, 'A', 'Ani', { jumlahPemain: 2 });
    m.terima('A', { t: 'emote', isi: 'satu' });
    m.terima('A', { t: 'emote', isi: 'dua' });
    jam.maju(1200);
    m.terima('A', { t: 'emote', isi: 'tiga' });
    expect(m.riwayatObrolan.map((e) => e.isi)).toEqual(['satu', 'tiga']);
    expect(surat.semua('A').filter((p) => p.t === 'emote')).toHaveLength(2);
  });

  it(`paling banyak ${MAKS_OBROLAN} baris terakhir`, () => {
    const { opsi, surat, jam } = siapkan();
    const m = Meja.buat(opsi, 'A', 'Ani', { jumlahPemain: 2 });
    for (let i = 0; i < MAKS_OBROLAN + 7; i++) {
      m.terima('A', { t: 'emote', isi: `pesan ${i}` });
      jam.maju(1200);
    }
    expect(m.riwayatObrolan).toHaveLength(MAKS_OBROLAN);
    expect(m.riwayatObrolan[0]!.isi).toBe('pesan 7');
    m.masuk('B', 'Budi');
    expect(surat.terakhir('B', 'obrolan')!.pesan).toHaveLength(MAKS_OBROLAN);
  });

  it('dikirim lagi saat tersambung kembali; tidak masuk DataMeja; ikut Main lagi', () => {
    const { opsi, surat, jam } = siapkan({ namaLawan: ['Warga A'] });
    const m = Meja.buat(opsi, 'A', 'Ani', { jumlahPemain: 2, detikGiliran: 0, batasPutaran: 1 });
    m.masuk('B', 'Budi');
    m.terima('B', { t: 'emote', isi: 'Siap kalah?' });
    jam.maju(1500);
    m.terima('A', { t: 'mulai', pengocok: 0 });
    siapSemua(m);
    m.terputus('B');
    surat.bersihkan();
    m.masuk('B', 'Budi');
    expect(surat.terakhir('B', 'obrolan')!.pesan.map((e) => e.isi)).toEqual(['Siap kalah?']);
    // Tidak di data simpanan meja.
    expect(JSON.stringify(m.data)).not.toContain('Siap kalah?');
    // Main sampai selesai, lalu Main lagi: obrolan tetap.
    const rng = new Rng(3);
    for (let i = 0; i < 20_000 && m.data.game?.status !== 'selesai'; i++) {
      if (m.data.game?.status === 'putaranSelesai') {
        m.terima(surat.info('A').host === surat.info('A').kursiSaya ? 'A' : 'B', { t: 'putaranBerikut' });
        continue;
      }
      if (aksiManusia(m, surat, 'A', rng) || aksiManusia(m, surat, 'B', rng)) continue;
      if (!jam.langkah()) break;
    }
    expect(m.data.game?.status).toBe('selesai');
    m.terima('A', { t: 'mainLagi' });
    expect(m.riwayatObrolan.map((e) => e.isi)).toContain('Siap kalah?');
  });

  it('nama pengirim tetap benar sesudah urutan duduk diacak (#62)', () => {
    const { opsi, surat, jam } = siapkan({ acakDuduk: () => 0, namaLawan: ['Warga A'] });
    const m = Meja.buat(opsi, 'ani', 'Ani', { jumlahPemain: 3, detikGiliran: 0 });
    m.masuk('budi', 'Budi');
    m.terima('ani', { t: 'emote', isi: 'sebelum' });
    m.terima('ani', { t: 'aturKursi', kursi: 2, jenis: 'bot' });
    m.terima('ani', { t: 'mulai' });
    // Ani tidak lagi di kursi 0.
    expect(m.data.kursi[0]!.nama).not.toBe('Ani');
    jam.maju(1500);
    m.terima('ani', { t: 'emote', isi: 'sesudah' });
    expect(m.riwayatObrolan.map((e) => [e.nama, e.isi])).toEqual([
      ['Ani', 'sebelum'],
      ['Ani', 'sesudah'],
    ]);
    expect(surat.terakhir('budi', 'emote')!.kursi).toBe(m.data.kursi.findIndex((k) => k.nama === 'Ani'));
  });

  it('penonton tidak pernah menerima obrolan', () => {
    const { opsi, surat, jam } = siapkan({ namaLawan: ['Warga A'] });
    const m = Meja.buat(opsi, 'A', 'Ani', { jumlahPemain: 3, publik: true });
    m.masuk('B', 'Budi');
    m.terima('A', { t: 'aturKursi', kursi: 2, jenis: 'bot' });
    m.terima('A', { t: 'emote', isi: 'rahasia kecil' });
    m.terima('A', { t: 'mulai', pengocok: 0 });
    siapSemua(m);
    m.tonton('P1', 'Penonton', 'tok1');
    jam.maju(1500);
    m.terima('B', { t: 'emote', isi: 'pesan baru' });
    const teks = JSON.stringify(surat.semua('P1'));
    expect(teks).not.toContain('rahasia kecil');
    expect(teks).not.toContain('pesan baru');
    expect(surat.semua('P1').some((p) => p.t === 'obrolan' || p.t === 'emote')).toBe(false);
  });

  it('celetukan warga kedai ikut tercatat dengan nama warganya', () => {
    const { opsi, surat, jam } = siapkan({ namaLawan: ['Warga A', 'Warga B'], acak: () => 0 });
    const m = Meja.buat(opsi, 'A', 'Ani', { jumlahPemain: 3, detikGiliran: 0, batasPutaran: 3 });
    m.terima('A', { t: 'aturKursi', kursi: 1, jenis: 'bot' });
    m.terima('A', { t: 'aturKursi', kursi: 2, jenis: 'bot' });
    m.terima('A', { t: 'mulai', pengocok: 0 });
    const rng = new Rng(5);
    for (let i = 0; i < 50_000 && m.data.game?.status !== 'selesai'; i++) {
      if (m.riwayatObrolan.length) break;
      if (m.data.game?.status === 'putaranSelesai') {
        m.terima('A', { t: 'putaranBerikut' });
        continue;
      }
      if (aksiManusia(m, surat, 'A', rng)) continue;
      if (!jam.langkah()) break;
    }
    const baris = m.riwayatObrolan[0];
    expect(baris).toBeDefined();
    expect(['Warga A', 'Warga B']).toContain(baris!.nama);
  });

  it('validasiObrolan merapikan data dari jaringan', () => {
    expect(validasiObrolan('x')).toBeNull();
    const hasil = validasiObrolan([
      { nama: 'Ani', isi: 'halo', w: 5 },
      { nama: 'Budi', isi: '   ' },
      { nama: 3, isi: 'x' },
      { nama: 'Cici', isi: '<b>tebal</b>', w: 'kemarin' },
      null,
    ]);
    expect(hasil).toEqual([
      { nama: 'Ani', isi: 'halo', w: 5 },
      { nama: 'Cici', isi: 'btebal/b', w: 0 },
    ]);
    const banyak = Array.from({ length: MAKS_OBROLAN + 5 }, (_, i) => ({ nama: 'A', isi: `p${i}`, w: i }));
    expect(validasiObrolan(banyak)).toHaveLength(MAKS_OBROLAN);
  });
});
