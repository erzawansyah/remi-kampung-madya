// Pemeriksa state legal. Dipakai test simulasi; bisa juga dipakai server untuk debug.

import { validasiKartuJadi } from './kartuJadi.js';
import { ctxPutaran, totalKartu } from './mesin.js';
import type { GameState } from './state.js';

export function periksaInvarian(state: GameState): string[] {
  const salah: string[] = [];
  const n = state.konfigurasi.jumlahPemain;
  if (state.pemain.length !== n || state.skor.length !== n) salah.push('jumlah pemain tidak konsisten');
  if (state.riwayat.length) {
    const terakhir = state.riwayat[state.riwayat.length - 1].skorAkumulasi;
    if (terakhir.some((x, i) => x !== state.skor[i])) salah.push('skor akumulasi tidak cocok dengan riwayat');
    const jumlahTotal = state.riwayat.reduce(
      (acc, h) => acc.map((x, i) => x + h.rincian[i].total),
      state.skor.map(() => 0),
    );
    if (jumlahTotal.some((x, i) => x !== state.skor[i])) salah.push('skor bukan jumlah skor per putaran');
  }

  const p = state.putaran;
  if (!p) return salah;
  const semua = [
    ...p.deck,
    ...p.buangan.map((e) => e.kartu),
    ...p.tangan.flat(),
    ...p.kartuJadi.flat().flatMap((kj) => kj.kartu.map((d) => d.kartu)),
  ];
  const total = totalKartu(state.konfigurasi);
  if (semua.length !== total) salah.push(`jumlah kartu ${semua.length}, harusnya ${total}`);
  const id = new Set(semua.map((k) => k.id));
  if (id.size !== semua.length) salah.push('ada kartu ganda');

  const ctx = ctxPutaran(p);
  p.kartuJadi.forEach((daftar, i) =>
    daftar.forEach((kj) => {
      if (kj.pemilik !== i) salah.push(`kartu jadi ${kj.id} pemiliknya salah`);
      try {
        // Joker yang dipakai di kartu jadi tidak pernah dibuang, jadi validasi ulang harus tetap sah.
        validasiKartuJadi(kj.kartu.map((d) => ({ kartu: d.kartu, sebagai: d.pengganti ? d.sebagai : undefined })), ctx);
      } catch {
        salah.push(`kartu jadi ${kj.id} tidak sah`);
      }
    }),
  );
  p.buangan.forEach((e) => {
    if (e.pemilik < 0 || e.pemilik >= n) salah.push('pemilik buangan tidak valid');
  });
  if (state.status === 'susunAkhir' && p.deck.length !== 0 && !p.mentung) salah.push('susun akhir padahal deck belum habis dan tidak ada yang mentung');
  if (state.status === 'putaranBerjalan') {
    if (p.giliran < 0 || p.giliran >= n) salah.push('giliran tidak valid');
    if (p.deck.length === 0 && !p.deckHabis) salah.push('deck kosong tapi putaran belum ditandai habis');
    if (p.tahap === 'main' && p.tangan[p.giliran].length < 1) salah.push('tangan kosong sebelum buang');
  }
  return salah;
}
