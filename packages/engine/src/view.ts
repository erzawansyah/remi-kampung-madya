// Tampilan state dari sudut pandang satu pemain: tangan lawan dan urutan deck disembunyikan.
// Dipakai server untuk mengirim state ke client, dan oleh bot supaya tidak bisa curang.

import { klon } from './klon.js';
import type { Kartu, Rank } from './kartu.js';
import type { KartuJadi } from './kartuJadi.js';
import type {
  Arah,
  EntriBuangan,
  EntriLog,
  Peristiwa,
  GameState,
  HasilPutaran,
  InfoMentung,
  KonfigurasiPermainan,
  StatusPermainan,
  TahapGiliran,
} from './state.js';

export interface ViewPutaran {
  nomor: number;
  pengocok: number;
  arah: Arah;
  kartuDibuka: Kartu;
  rankJoker: Rank;
  jumlahDeck: number;
  /** Hanya (jumlah pemain − 1) kartu teratas, seperti yang terlihat di meja asli. */
  buangan: EntriBuangan[];
  jumlahBuangan: number;
  /** Hanya tangan pemain yang melihat; lawan berisi null. */
  tangan: (Kartu[] | null)[];
  jumlahKartuTangan: number[];
  kartuJadi: KartuJadi[][];
  giliran: number;
  tahap: TahapGiliran;
  sumberAmbil: 'deck' | 'buangan' | null;
  pungutan: EntriBuangan[];
  /** Joker mati yang masih relevan untuk pemain ini (di buangan teratas, tangannya, atau kartu jadi). */
  jokerMati: string[];
  deckHabis: boolean;
  selesaiSusun: boolean[];
  /** Info mentung (sudah terbuka untuk semua) selama susun akhir sesudah mentung. */
  mentung: InfoMentung | null;
  /** Putaran kaldu (#42, info publik). Hanya ada kalau true. */
  kaldu?: true;
}

export interface ViewPemain {
  /** Indeks pemain pemilik view; null = penonton. */
  saya: number | null;
  konfigurasi: KonfigurasiPermainan;
  pemain: { nama: string }[];
  skor: number[];
  status: StatusPermainan;
  putaran: ViewPutaran | null;
  riwayat: HasilPutaran[];
  arah: Arah;
  log: EntriLog[];
  /** Kejadian terakhir (untuk animasi dan sorakan). */
  peristiwa: Peristiwa[];
  alasanSelesai: GameState['alasanSelesai'];
  /** Mode kaldu (#42, info publik): semua sudah sepakat putaran berikutnya putaran terakhir. Hanya ada kalau true. */
  kalduDiminta?: true;
}

/** Jumlah peristiwa terakhir yang ikut dikirim di view. */
export const BATAS_PERISTIWA_VIEW = 40;

export function viewUntuk(state: GameState, saya: number | null): ViewPemain {
  const p = state.putaran;
  // Setelah putaran selesai semua tangan dibuka (rincian skor juga memuatnya).
  const terbuka = state.status !== 'putaranBerjalan' && state.status !== 'susunAkhir';
  const n = state.pemain.length;
  const buanganTerlihat = p ? p.buangan.slice(-Math.max(1, n - 1)) : [];
  const relevan = new Set<string>([
    ...buanganTerlihat.map((e) => e.kartu.id),
    ...(p && saya !== null ? p.tangan[saya].map((k) => k.id) : []),
    ...(p ? p.kartuJadi.flat().flatMap((kj) => kj.kartu.map((d) => d.kartu.id)) : []),
  ]);
  // Bagian putaran disalin dalam; riwayat dan log hanya array-nya (entrinya tidak pernah diubah).
  return {
    saya,
    status: state.status,
    putaran: p && klon({
      nomor: p.nomor,
      pengocok: p.pengocok,
      arah: p.arah,
      kartuDibuka: p.kartuDibuka,
      rankJoker: p.rankJoker,
      jumlahDeck: p.deck.length,
      buangan: buanganTerlihat,
      jumlahBuangan: p.buangan.length,
      tangan: p.tangan.map((t, i) => (terbuka || i === saya ? t : null)),
      jumlahKartuTangan: p.tangan.map((t) => t.length),
      kartuJadi: p.kartuJadi,
      giliran: p.giliran,
      tahap: p.tahap,
      sumberAmbil: p.sumberAmbil,
      pungutan: p.pungutan,
      jokerMati: p.jokerMati.filter((id) => relevan.has(id)),
      deckHabis: p.deckHabis,
      selesaiSusun: p.selesaiSusun,
      mentung: p.mentung,
      ...(p.kaldu ? { kaldu: true as const } : {}),
    }),
    konfigurasi: { ...state.konfigurasi },
    pemain: state.pemain.map((x) => ({ ...x })),
    skor: [...state.skor],
    riwayat: [...state.riwayat],
    arah: state.arah,
    log: [...state.log],
    peristiwa: state.peristiwa.slice(-BATAS_PERISTIWA_VIEW),
    alasanSelesai: state.alasanSelesai,
    // Hanya ditulis kalau true, supaya view lama dan golden tidak berubah.
    ...(state.kalduDiminta ? { kalduDiminta: true as const } : {}),
  };
}
