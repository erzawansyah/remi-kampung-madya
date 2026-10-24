// Meja yang dipulihkan server sesudah restart/deploy (rencana koneksi langkah 9, 24 Okt 2026):
// dataMejaDipulihkan() menganggap semua kursi manusia terputus, persis seperti kalau semuanya terputus
// satu per satu. Meja dijeda sampai ada yang kembali; yang masih terputus lalu mendapat tenggang penuh
// (#35 diubah), dan yang belum sempat melihat joker ditanya ulang sendiri (#34 diubah).

import { describe, expect, it } from 'vitest';
import { dataMejaDipulihkan, Meja, TENGGANG_SAMBUNG_MS, type DataMeja } from '../src/index.js';
import { siapkan, siapSemua } from './bantu.js';

/** Meja 3 kursi: host Budi (0), Siti/p2 (1), warga kedai (2), permainan sudah mulai. */
function mejaJalan(pengaturan: Record<string, unknown> = {}, pengocok = 1) {
  const ctx = siapkan({ namaLawan: ['Warga A'] });
  const meja = Meja.buat(ctx.opsi, 'host', 'Budi', { jumlahPemain: 3, detikGiliran: 0, ...pengaturan });
  meja.masuk('p2', 'Siti');
  meja.terima('host', { t: 'aturKursi', kursi: 2, jenis: 'bot' });
  meja.terima('host', { t: 'mulai', pengocok });
  return { ...ctx, meja };
}

/** Meja baru dari data `d` (dipulihkan), dengan jam dan kotak surat sendiri. */
function pulihkan(d: DataMeja) {
  const ctx = siapkan({ namaLawan: ['Warga A'] });
  return { ...ctx, meja: new Meja(ctx.opsi, dataMejaDipulihkan(d)) };
}

const jumlahAksi = (meja: Meja, pemain: number) =>
  meja.data.game!.peristiwa.filter((e) => 'pemain' in e && e.pemain === pemain).length;

describe('dataMejaDipulihkan', () => {
  it('semua kursi manusia terputus, tidak ditunggu joker, suara voting dicabut; data asal tidak diubah', () => {
    const { meja } = mejaJalan({ modeKaldu: true });
    const d = meja.data;
    d.menungguJoker = [0, 1];
    d.setujuAkhiri = [0];
    d.setujuKaldu = [1];
    const salinan = JSON.parse(JSON.stringify(d));
    const p = dataMejaDipulihkan(d);
    expect(d).toEqual(salinan);
    expect(p.kursi.map((k) => [k.jenis, k.terhubung])).toEqual([
      ['manusia', false],
      ['manusia', false],
      ['bot', false],
    ]);
    expect(p.kursi.map((k) => k.pemainId)).toEqual(['host', 'p2', null]);
    expect(p.menungguJoker).toEqual([]);
    expect(p.setujuAkhiri).toEqual([]);
    expect(p).not.toHaveProperty('setujuKaldu');
    expect(p.host).toBe(0);
    expect(p.game).toEqual(d.game);
  });

  it('meja hasil pemulihan dijeda tanpa timer sampai ada yang kembali; sesudahnya timer disusun ulang', () => {
    const { meja } = mejaJalan({ detikGiliran: 60 }, 2);
    siapSemua(meja);
    // Pengocok 2: giliran pertama milik warga kedai (kursi 2).
    expect(meja.data.game!.putaran!.giliran).toBe(2);
    const d = meja.data;
    meja.hentikan();
    const { meja: lanjut, jam, surat } = pulihkan(d);
    expect(lanjut.jumlahManusiaTerhubung).toBe(0);
    expect(jam.jumlahTimer).toBe(0);
    jam.maju(10 * 60_000);
    expect(jumlahAksi(lanjut, 2)).toBe(0);
    lanjut.masuk('host', 'Budi');
    expect(surat.terakhir('host', 'masuk')).toEqual({ t: 'masuk', kode: 'ABCDE', token: 'host', kursi: 0 });
    expect(jam.jumlahTimer).toBeGreaterThan(0);
    jam.maju(100);
    expect(jumlahAksi(lanjut, 2)).toBeGreaterThan(0);
  });

  it('yang masih terputus mendapat tenggang penuh sejak orang pertama kembali, bukan sejak dipulihkan', () => {
    const { meja } = mejaJalan();
    siapSemua(meja);
    expect(meja.data.game!.putaran!.giliran).toBe(1);
    const { meja: lanjut, jam } = pulihkan(meja.data);
    meja.hentikan();
    // Server baru jalan, tapi pemain baru kembali 2 menit kemudian.
    jam.maju(120_000);
    lanjut.masuk('host', 'Budi');
    jam.maju(TENGGANG_SAMBUNG_MS - 1);
    expect(jumlahAksi(lanjut, 1)).toBe(0);
    jam.maju(1 + 100);
    expect(jumlahAksi(lanjut, 1)).toBeGreaterThan(0);
  });

  it('yang belum menekan OK di popup joker ditanya ulang sendiri saat kembali; yang sudah OK tidak', () => {
    const { meja } = mejaJalan();
    meja.terima('host', { t: 'siapJoker', putaran: 1 });
    expect(meja.data.menungguJoker).toEqual([1]);
    const { meja: lanjut, surat } = pulihkan(meja.data);
    meja.hentikan();
    lanjut.masuk('host', 'Budi');
    expect(surat.info('host').menungguJoker).toEqual([]);
    lanjut.masuk('p2', 'Siti');
    // Popup lagi hanya untuk Siti; meja tidak ikut menunggu.
    expect(surat.info('p2').menungguJoker).toEqual([1]);
    expect(surat.info('host').menungguJoker).toEqual([]);
  });

  it('host tetap host kalau ia yang kembali duluan; kalau orang lain duluan, host pindah seperti biasa', () => {
    const { meja } = mejaJalan();
    siapSemua(meja);
    const d = meja.data;
    meja.hentikan();
    const a = pulihkan(d);
    a.meja.masuk('host', 'Budi');
    a.meja.masuk('p2', 'Siti');
    expect(a.meja.data.host).toBe(0);
    const b = pulihkan(d);
    b.meja.masuk('p2', 'Siti');
    expect(b.meja.data.host).toBe(1);
  });
});
