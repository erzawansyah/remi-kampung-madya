// Bentuk state permainan. Semua bisa diserialisasi ke JSON.

import type { Kartu, Rank } from './kartu.js';
import type { KartuJadi, SpesifikasiKartuJadi } from './kartuJadi.js';

export type Arah = 1 | -1;

export interface KonfigurasiPermainan {
  /** 2 s/d 6. */
  jumlahPemain: number;
  /** Hanya berlaku untuk 4 pemain: pakai 2 deck, 12 kartu per pemain. */
  duaDeckUntukEmpat: boolean;
  /** null = syarat tidak aktif. */
  batasPutaran: number | null;
  batasSkorAtas: number | null;
  batasSkorBawah: number | null;
  /** Arah putaran pertama. 1 = searah urutan duduk. */
  arahAwal: Arah;
  /** Aturan Terbuka: apakah As yang ber-angka joker boleh dibuang sebelum punya kartu jadi. Default false. */
  asJokerBolehDibuangTanpaJadi: boolean;
}

export const KONFIGURASI_BAWAAN: Omit<KonfigurasiPermainan, 'jumlahPemain'> = {
  duaDeckUntukEmpat: false,
  // Bawaan: tanpa batas; permainan berakhir kalau semua sepakat berhenti.
  batasPutaran: null,
  batasSkorAtas: null,
  batasSkorBawah: null,
  arahAwal: 1,
  asJokerBolehDibuangTanpaJadi: false,
};

export interface EntriBuangan {
  kartu: Kartu;
  /** Indeks pemain yang membuang. Menentukan siapa yang kepentung. */
  pemilik: number;
}

export type TahapGiliran = 'ambil' | 'main';

export interface InfoMentung {
  pemain: number;
  pentungan: Kartu;
  pentunganJoker: boolean;
  kepentung: number[];
  /**
   * Keputusan #41: pentungan lain kalau nutup pakai beberapa joker hidup sekaligus (semuanya joker
   * hidup, 250 per kartu). Hanya ditulis kalau ada, jadi simpanan lama dan golden tidak berubah.
   */
  pentunganLain?: Kartu[];
}

export interface StatePutaran {
  nomor: number;
  pengocok: number;
  arah: Arah;
  /** Kartu yang dibuka pengocok; sudah dikembalikan ke deck. */
  kartuDibuka: Kartu;
  rankJoker: Rank;
  /** Kartu teratas = elemen terakhir. */
  deck: Kartu[];
  /** Indeks 0 = paling bawah, elemen terakhir = teratas. */
  buangan: EntriBuangan[];
  tangan: Kartu[][];
  kartuJadi: KartuJadi[][];
  giliran: number;
  tahap: TahapGiliran;
  sumberAmbil: 'deck' | 'buangan' | null;
  /** Kartu yang dipungut pada giliran ini, dari bawah ke atas. */
  pungutan: EntriBuangan[];
  /** Joker yang sudah pernah dibuang: kehilangan status joker. */
  jokerMati: string[];
  /** Jumlah joker hidup yang dibuang tiap pemain (penalti −25 per kartu). */
  jokerDibuang: number[];
  /** Kartu terakhir deck sudah diambil: setelah giliran ini masuk fase susun akhir. */
  deckHabis: boolean;
  /** Fase susun akhir: pemain yang sudah menekan "Selesai". */
  selesaiSusun: boolean[];
  /** Berapa giliran berturut-turut tiap pemain berhasil mulung di putaran ini. */
  mulungBeruntun: number[];
  /**
   * Sudah ada yang mentung (putaran masuk susun akhir sebelum dihitung). Kepentung dan arah
   * ditentukan saat mentung, tidak berubah oleh susunan sesudahnya.
   */
  mentung: InfoMentung | null;
  /** Kartu yang pernah dipungut putaran ini → pemilik buangannya (untuk jejak "kartumu di meja lawan"). */
  asalKartu: Record<string, number>;
  /** Penomoran id kartu jadi. */
  urutanKartuJadi: number;
}

export type StatusSkor = 'mentung' | 'kepentung' | 'aman';

export interface RincianSkor {
  pemain: number;
  status: StatusSkor;
  nilaiKartuJadi: number;
  /** 0 untuk yang mentung (tangan kosong). */
  nilaiTangan: number;
  /** Nilai tiap kartu di tangan (sejajar dengan `tangan`): joker hidup 25, selain itu nilai dasar. */
  nilaiKartuTangan: number[];
  /** Positif untuk yang mentung, negatif untuk yang kepentung, 0 lainnya. */
  nilaiPentungan: number;
  jumlahJokerDibuang: number;
  penaltiJoker: number;
  total: number;
  kartuJadi: KartuJadi[];
  tangan: Kartu[];
}

export interface HasilPutaran {
  nomor: number;
  pengocok: number;
  rankJoker: Rank;
  cara: 'mentung' | 'deckHabis';
  pementung: number | null;
  pentungan: Kartu | null;
  /** Pentungan masih berstatus joker saat dibuang. */
  pentunganJoker: boolean;
  /** Keputusan #41: joker hidup lain yang ikut jadi pentungan (nutup pakai beberapa joker). Tidak ada = satu kartu. */
  pentunganLain?: Kartu[];
  /** Nilai pentungan penuh (sebelum diberi tanda), jumlah semua pentungan. */
  nilaiPentungan: number;
  kepentung: number[];
  rincian: RincianSkor[];
  arahSebelumnya: Arah;
  arahBerikutnya: Arah;
  dibalik: boolean;
  /** Skor akumulasi setelah putaran ini. */
  skorAkumulasi: number[];
}

/**
 * susunAkhir: deck habis atau ada yang mentung; semua pemain boleh menurunkan kartu jadi dari
 * tangan (tanpa mulung, tanpa buang), lalu menekan "Selesai". Setelah semua selesai, putaran dihitung.
 */
export type StatusPermainan = 'menungguPutaran' | 'putaranBerjalan' | 'susunAkhir' | 'putaranSelesai' | 'selesai';

/**
 * Kejadian terstruktur untuk animasi dan sorakan di UI. Hanya berisi hal yang terlihat semua
 * pemain di meja asli (kartu yang dibuang/dipungut, kartu jadi), tidak pernah isi tangan.
 */
export type IsiPeristiwa =
  | { jenis: 'mulaiPutaran'; pengocok: number; rankJoker: Rank }
  | { jenis: 'ambilDeck'; pemain: number; deckHabis: boolean }
  | {
      jenis: 'mulung';
      pemain: number;
      kartu: EntriBuangan[];
      idKartuJadi: string[];
      /** Mungut jumlah maksimal (n − 1, minimal 2 kartu). */
      sapuBersih: boolean;
      /** Mulung ke berapa berturut-turut oleh pemain ini di putaran ini. */
      beruntun: number;
      kembarAs: boolean;
    }
  | { jenis: 'turunkan'; pemain: number; idKartuJadi: string[]; kembarAs: boolean }
  | {
      jenis: 'buang';
      pemain: number;
      kartu: Kartu;
      /** Keputusan #41: kartu lain yang dibuang bersamaan (nutup pakai beberapa joker). Tidak ada = satu kartu. */
      kartuLain?: Kartu[];
      jokerDibuang: boolean;
      sisaTangan: number;
    }
  | {
      jenis: 'mentung';
      pemain: number;
      pentungan: Kartu;
      pentunganJoker: boolean;
      /** Keputusan #41: joker hidup lain yang ikut jadi pentungan. */
      pentunganLain?: Kartu[];
      /** Jumlah nilai semua pentungan. */
      nilai: number;
      kepentung: number[];
      dibalik: boolean;
    }
  | { jenis: 'susunAkhir'; sebab: 'deckHabis' | 'mentung' }
  | { jenis: 'putaranSelesai'; cara: 'mentung' | 'deckHabis' };

export type Peristiwa = IsiPeristiwa & { id: number; putaran: number };

export interface EntriLog {
  putaran: number;
  pesan: string;
}

export interface GameState {
  versi: 1;
  konfigurasi: KonfigurasiPermainan;
  pemain: { nama: string }[];
  skor: number[];
  status: StatusPermainan;
  putaran: StatePutaran | null;
  riwayat: HasilPutaran[];
  /** Arah untuk putaran berikutnya. */
  arah: Arah;
  rng: number;
  log: EntriLog[];
  peristiwa: Peristiwa[];
  alasanSelesai: 'sepakat' | 'batasPutaran' | 'batasSkor' | null;
}

export type Aksi =
  | { jenis: 'mulaiPutaran'; pengocok?: number }
  | { jenis: 'ambilDeck'; pemain: number }
  | { jenis: 'mulung'; pemain: number; jumlah: number; kartuJadi: SpesifikasiKartuJadi[] }
  | { jenis: 'turunkan'; pemain: number; kartuJadi: SpesifikasiKartuJadi[] }
  | {
      jenis: 'buang';
      pemain: number;
      kartuId: string;
      /**
       * Keputusan #41: kartu lain yang dibuang bersamaan. Hanya sah untuk nutup: semua sisa tangan
       * ikut dibuang, semuanya joker hidup, dan giliran ini diawali mulung. Kosong = buang satu kartu.
       */
      kartuIdLain?: string[];
    }
  | { jenis: 'selesaiSusun'; pemain: number }
  | { jenis: 'akhiriPermainan' };
