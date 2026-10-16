// Pemeriksa state legal. Dipakai test simulasi; bisa juga dipakai server untuk debug.

import { validasiKartuJadi } from './kartuJadi.js';
import { ctxPutaran, totalKartu } from './mesin.js';
import { NILAI_PENTUNGAN_JOKER } from './skor.js';
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
    // Keputusan #40: angka joker tidak pernah sama dengan putaran tepat sebelumnya.
    state.riwayat.forEach((h, i) => {
      if (i > 0 && h.rankJoker === state.riwayat[i - 1].rankJoker) salah.push(`joker putaran ${h.nomor} sama dengan putaran sebelumnya`);
      // Keputusan #41: pentungan beberapa kartu hanya joker hidup, 250 per kartu.
      const lain = h.pentunganLain;
      if (lain) {
        if (!lain.length) salah.push(`pentunganLain putaran ${h.nomor} kosong (harusnya tidak ditulis)`);
        if (!h.pentunganJoker || lain.some((k) => k.rank !== h.rankJoker)) salah.push(`pentungan putaran ${h.nomor} bukan joker semua`);
        if (h.nilaiPentungan !== NILAI_PENTUNGAN_JOKER * (1 + lain.length)) salah.push(`nilai pentungan putaran ${h.nomor} salah`);
      }
    });
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

  // Riwayat berisi putaran yang sudah selesai: putaran ke-k ada di indeks k − 1, jadi putaran
  // sebelumnya ada di indeks nomor − 2 (putaran pertama, termasuk sesudah "Main lagi", tanpa syarat).
  const sebelumnya = p.nomor >= 2 ? state.riwayat[p.nomor - 2] : undefined;
  if (sebelumnya && sebelumnya.rankJoker === p.rankJoker) salah.push(`joker putaran ${p.nomor} sama dengan putaran sebelumnya`);
  if (p.kartuDibuka.rank !== p.rankJoker) salah.push('angka joker tidak sama dengan kartu yang dibuka');

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
  const m = p.mentung;
  if (m?.pentunganLain) {
    // Semua pentungan sudah jadi joker mati (tidak bisa dipakai lagi) dan tangan yang mentung kosong.
    const semua = [m.pentungan, ...m.pentunganLain];
    if (!m.pentunganLain.length || !m.pentunganJoker || semua.some((k) => k.rank !== p.rankJoker || !p.jokerMati.includes(k.id))) {
      salah.push('pentungan beberapa kartu bukan joker semua');
    }
    if (p.tangan[m.pemain].length !== 0) salah.push('yang mentung masih punya kartu di tangan');
  }
  if (state.status === 'putaranBerjalan') {
    if (p.giliran < 0 || p.giliran >= n) salah.push('giliran tidak valid');
    if (p.deck.length === 0 && !p.deckHabis) salah.push('deck kosong tapi putaran belum ditandai habis');
    if (p.tahap === 'main' && p.tangan[p.giliran].length < 1) salah.push('tangan kosong sebelum buang');
  }
  return salah;
}
