// Acak urutan duduk (keputusan pemilik #62, 25 Nov 2026): kursi diacak waktu permainan dimulai dari
// lobi, yang dapat kursi pertama ngocok putaran pertama. Host bisa mematikannya (urutanTetap), meja
// kompetisi selalu diacak, dan tanpa sumber acak (test, golden, latihan) kursi tidak pernah diacak.

import { describe, expect, it } from 'vitest';
import { Meja, PENGATURAN_KOMPETISI_BAWAAN, validasiPengaturan, validasiPesan, type KompetisiDataMeja, type OpsiMeja, type PengaturanMeja } from '../src/index.js';
import { Rng } from '@remi/engine';
import { aksiManusia, siapkan, siapSemua } from './bantu.js';

/** Sumber acak yang memutar urutan: dengan nilai 0, Fisher–Yates menukar tiap kursi dengan kursi 0. */
const nol = () => 0;

/** Ani (host), Budi, Cici masuk berurutan, lalu satu warga kedai di kursi terakhir. */
function mejaEmpat(pengaturan: Partial<PengaturanMeja> = {}, extra: Partial<OpsiMeja> = {}) {
  const ctx = siapkan(extra);
  const meja = Meja.buat(ctx.opsi, 'ani', 'Ani', { jumlahPemain: 4, detikGiliran: 0, ...pengaturan });
  meja.masuk('budi', 'Budi');
  meja.masuk('cici', 'Cici');
  meja.terima('ani', { t: 'aturKursi', kursi: 3, jenis: 'bot' });
  return { ...ctx, meja };
}

const nama = (m: Meja) => m.data.kursi.map((k) => k.nama);

describe('acak urutan duduk (#62)', () => {
  it('bawaan: kursi diacak waktu Mulai, pengocok pertama = kursi pertama, pilihan pengocok host diabaikan', () => {
    const { meja, surat } = mejaEmpat({}, { acakDuduk: nol });
    expect(nama(meja).slice(0, 3)).toEqual(['Ani', 'Budi', 'Cici']);
    meja.terima('ani', { t: 'mulai', pengocok: 2 });
    // Dengan acak = 0: [0,1,2,3] → tukar 3↔0, 2↔0, 1↔0 → [1,2,3,0].
    expect(nama(meja)).toEqual(['Budi', 'Cici', meja.data.kursi[2]!.nama, 'Ani']);
    expect(meja.data.kursi[2]!.jenis).toBe('bot');
    expect(meja.data.game!.putaran!.pengocok).toBe(0);
    expect(meja.data.game!.pemain.map((p) => p.nama)).toEqual(nama(meja));
    // Host ikut pindah kursi, dan tiap pemain diberi tahu kursi barunya.
    expect(meja.data.host).toBe(3);
    expect(surat.info('ani').kursiSaya).toBe(3);
    expect(surat.info('budi').kursiSaya).toBe(0);
    expect(surat.info('cici').kursiSaya).toBe(1);
    expect(surat.info('ani').host).toBe(3);
    // Kursi baru dipakai untuk aksi: pemain yang sekarang di kursi pertama yang jalan duluan.
    siapSemua(meja);
    expect(surat.view('budi').putaran!.giliran).toBe(surat.view('budi').saya);
  });

  it('urutanTetap: kursi tetap seperti urutan masuk dan host memilih pengocok', () => {
    const { meja } = mejaEmpat({ urutanTetap: true }, { acakDuduk: nol });
    meja.terima('ani', { t: 'mulai', pengocok: 2 });
    expect(nama(meja).slice(0, 3)).toEqual(['Ani', 'Budi', 'Cici']);
    expect(meja.data.game!.putaran!.pengocok).toBe(2);
    expect(meja.data.host).toBe(0);
  });

  it('tanpa sumber acak (test, golden, latihan) kursi tidak pernah diacak', () => {
    const { meja } = mejaEmpat();
    meja.terima('ani', { t: 'mulai', pengocok: 1 });
    expect(nama(meja).slice(0, 3)).toEqual(['Ani', 'Budi', 'Cici']);
    expect(meja.data.game!.putaran!.pengocok).toBe(1);
  });

  it('putaran berikutnya tidak mengacak lagi; Main lagi lalu Mulai mengacak lagi', () => {
    // Satu manusia + tiga warga kedai; giliran Ani dijalankan aksiManusia. Acak 0 lalu 0,5.
    let n = 0;
    const ctx = siapkan({ acakDuduk: () => (n++ < 3 ? 0 : 0.5), namaLawan: ['Warga A', 'Warga B', 'Warga C'] });
    const meja = Meja.buat(ctx.opsi, 'ani', 'Ani', { jumlahPemain: 4, detikGiliran: 0, batasPutaran: 2 });
    for (const i of [1, 2, 3]) meja.terima('ani', { t: 'aturKursi', kursi: i, jenis: 'bot' });
    meja.terima('ani', { t: 'mulai' });
    const urutan1 = nama(meja);
    expect(urutan1).toEqual(['Warga A', 'Warga B', 'Warga C', 'Ani']);
    const rng = new Rng(3);
    const mainkan = (sampai: string) => {
      for (let i = 0; i < 20000 && meja.data.game?.status !== sampai; i++) {
        if (aksiManusia(meja, ctx.surat, 'ani', rng)) continue;
        if (!ctx.jam.langkah()) throw new Error('macet');
      }
      expect(meja.data.game?.status).toBe(sampai);
    };
    siapSemua(meja);
    mainkan('putaranSelesai');
    meja.terima('ani', { t: 'putaranBerikut' });
    expect(nama(meja)).toEqual(urutan1);
    siapSemua(meja);
    mainkan('selesai');
    meja.terima('ani', { t: 'mainLagi' });
    expect(meja.data.game).toBeNull();
    meja.terima('ani', { t: 'mulai' });
    expect(nama(meja)).toEqual(['Warga A', 'Ani', 'Warga B', 'Warga C']);
    expect(meja.data.game!.putaran!.pengocok).toBe(0);
  });

  it('meja kompetisi selalu diacak walau urutanTetap dikirim; mengubahnya di lobi ditolak', () => {
    const kompetisi: KompetisiDataMeja = {
      kode: 'KOMPA',
      nama: 'Remi Jumat',
      pengaturan: { ...PENGATURAN_KOMPETISI_BAWAAN, jumlahPemain: 3, batasPutaran: 1, detikGiliran: 0 },
    };
    const ctx = siapkan({ acakDuduk: nol });
    const meja = Meja.buat(ctx.opsi, 'ani', 'Ani', { urutanTetap: true }, { ...kompetisi, peserta: 1 });
    meja.terima('ani', { t: 'pengaturan', pengaturan: { urutanTetap: true } });
    expect(ctx.surat.errors('ani').at(-1)).toMatch(/selalu diacak/);
    meja.masuk('budi', 'Budi', 2);
    meja.masuk('cici', 'Cici', 3);
    for (let i = 0; i < 10 && !meja.data.game; i++) ctx.jam.langkah();
    expect(meja.data.game).not.toBeNull();
    expect(nama(meja)).toEqual(['Budi', 'Cici', 'Ani']);
    expect(meja.data.game!.putaran!.pengocok).toBe(0);
    // Peserta kompetisi ikut pindah bersama kursinya.
    expect(meja.data.kursi.map((k) => k.peserta)).toEqual([2, 3, 1]);
  });

  it('validasi: urutanTetap harus boolean', () => {
    expect(validasiPengaturan({ urutanTetap: true })).toEqual({ urutanTetap: true });
    expect(validasiPengaturan({ urutanTetap: false })).toEqual({ urutanTetap: false });
    expect(validasiPengaturan({ urutanTetap: 'ya' })).toBeNull();
    expect(validasiPesan({ t: 'pengaturan', pengaturan: { urutanTetap: true } })).toEqual({ t: 'pengaturan', pengaturan: { urutanTetap: true } });
  });
});
