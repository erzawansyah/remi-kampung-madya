// Pesan antara client dan meja (dipakai server online maupun meja lokal offline).

import type { Aksi, LevelBot, ViewPemain } from '@remi/engine';

export interface PengaturanMeja {
  /** 2 s/d 6. */
  jumlahPemain: number;
  duaDeckUntukEmpat: boolean;
  batasPutaran: number | null;
  batasSkorAtas: number | null;
  batasSkorBawah: number | null;
  /** Muncul di daftar room publik. */
  publik: boolean;
  /** Batas waktu per giliran untuk pemain manusia; 0 = tanpa batas. Lewat batas, bot yang jalan. */
  detikGiliran: number;
  /**
   * Level warga kedai untuk kursi yang diisi tanpa level sendiri (mis. "Ajak warga kedai isi kursi
   * kosong", atau pemain yang keluar saat main). Nilai sah: DAFTAR_LEVEL_BOT di engine.
   */
  levelBot: LevelBot;
  /** Jeda antaraksi bot supaya pemain sempat melihat apa yang diambil dan dibuang. */
  tempoBot: TempoBot;
  /**
   * Mode kaldu (#42, #43): putaran kaldu (pentungan × 2) mulai di batas putaran atau sesudah semua
   * setuju "putaran berikutnya terakhir"; batas skor tidak dipakai. Hanya bisa diubah di lobi.
   * Sengaja tidak ada di PENGATURAN_BAWAAN: tidak ada = mati (simpanan lama dan golden tidak berubah).
   */
  modeKaldu?: boolean;
}

export type TempoBot = 'santai' | 'normal' | 'cepat';

/**
 * Jeda bot dalam ms, diacak dalam rentang [min, maks]:
 * - mikir: sebelum aksi pertama di gilirannya (seperti orang yang sedang menimbang),
 * - lanjut: antaraksi berikutnya di giliran yang sama.
 */
export const JEDA_BOT: Record<TempoBot, { mikir: [number, number]; lanjut: [number, number] }> = {
  santai: { mikir: [3000, 10000], lanjut: [1500, 3000] },
  normal: { mikir: [2000, 5000], lanjut: [1000, 2000] },
  cepat: { mikir: [800, 2000], lanjut: [500, 900] },
};

export const PENGATURAN_BAWAAN: PengaturanMeja = {
  jumlahPemain: 4,
  duaDeckUntukEmpat: false,
  // Bawaan: tanpa batas; permainan berakhir kalau semua sepakat berhenti.
  batasPutaran: null,
  batasSkorAtas: null,
  batasSkorBawah: null,
  publik: false,
  detikGiliran: 60,
  levelBot: 'normal',
  tempoBot: 'santai',
};

/**
 * Celetukan dan emoji siap pakai di palet emote. Pemain juga boleh mengetik pesan sendiri
 * (keputusan pemilik #48, dirapikan `rapikanPesan`), tapi celetukan warga kedai (Meja.celetukBot)
 * hanya boleh memakai isi daftar ini. "Kartu itu bundar, kak." diambil dari balasan Kedai Madya di
 * Threads; "Gedein!", "Lumayan!", "CEKI!", "Njir lah!", dan "Give me!" kata-kata warga Madya dari
 * pemilik (18 Okt 2026). Urutan menentukan susunan palet.
 */
export const DAFTAR_EMOTE = [
  '😂',
  '😱',
  '🔥',
  '👏',
  '😤',
  '🙏',
  '😎',
  '🤔',
  '😭',
  '🤣',
  '😡',
  '🥶',
  '🤡',
  '😴',
  '😏',
  '🙄',
  '👍',
  '👀',
  '💀',
  '🃏',
  '☕',
  '🎉',
  '💸',
  '🍀',
  'Awas!',
  'Sabar…',
  'Mantap!',
  'Waduh!',
  'Suwun, Bos!',
  'Buruan!',
  'Nutup, rek!',
  'GG',
  'Gedein!',
  'Lumayan!',
  'CEKI!',
  'Njir lah!',
  'Give me!',
  'Kartu itu bundar, kak.',
] as const;

export type Emote = (typeof DAFTAR_EMOTE)[number];

/**
 * Emote versi lama yang sudah diganti, beserta padanannya sekarang. HP yang masih memakai aplikasi
 * lama (0.1.0, atau build pra-rilis 0.2.0) tetap bisa mengirimnya; meja meneruskannya sebagai
 * padanan baru (validasiPesan). Jangan dihapus selama masih ada pemain yang memakai versi lama.
 */
export const EMOTE_LAMA: ReadonlyMap<string, Emote> = new Map<string, Emote>([
  ['Makasih, Bos!', 'Suwun, Bos!'],
  ['Tutup!', 'Nutup, rek!'],
  ['Kartu itu bundar…', 'Kartu itu bundar, kak.'],
  ['Cepetan!', 'Buruan!'],
]);

/** Panjang maksimal pesan yang diketik sendiri (huruf yang tampil). */
export const MAKS_PESAN = 60;

export type JenisKursi = 'kosong' | 'manusia' | 'bot';

export interface InfoKursi {
  jenis: JenisKursi;
  nama: string;
  terhubung: boolean;
  /**
   * Level warga kedai kursi ini (hanya berarti untuk jenis 'bot'). Aplikasi versi lama hanya mengenal
   * 'mudah' dan 'normal'; client wajib tahan menerima level yang belum dikenalnya.
   */
  level: LevelBot;
}

export type StatusMeja = 'lobi' | 'main' | 'selesai';

export interface InfoMeja {
  kode: string;
  status: StatusMeja;
  pengaturan: PengaturanMeja;
  kursi: InfoKursi[];
  /** Indeks kursi host. */
  host: number;
  /** Kursi pemain yang menerima pesan ini; null bila belum duduk. */
  kursiSaya: number | null;
  /** Kursi yang setuju mengakhiri permainan. */
  setujuAkhiri: number[];
  /**
   * Mode kaldu (#42): kursi yang setuju putaran berikutnya putaran terakhir (kaldu). Hanya ada di meja
   * mode kaldu.
   */
  setujuKaldu?: number[];
  /** Waktu (ms epoch) batas giliran saat ini; null bila tidak ada batas. */
  batasWaktu: number | null;
  /** Giliran saat ini sedang dijalankan bot karena waktu habis atau pemain terputus. */
  diambilAlihBot: boolean;
  /** Awal putaran: kursi manusia yang belum menekan OK di pengumuman joker. Permainan menunggu. */
  menungguJoker: number[];
  /** Kursi bot yang sedang "mikir" sebelum aksi pertamanya. */
  botMikir: number | null;
}

/** Klasemen akhir satu permainan (disimpan server ke database saat permainan selesai). */
export interface RingkasanAkhir {
  kode: string;
  /** ms epoch */
  selesaiPada: number;
  /** 'kaldu': putaran kaldu ditutup mentung (#42). */
  alasan: 'sepakat' | 'batasPutaran' | 'batasSkor' | 'kaldu' | null;
  jumlahPutaran: number;
  /** 1 atau 2 (aturanPembagian di engine). */
  jumlahDeck: number;
  /** Permainan memakai mode kaldu (#42). */
  modeKaldu: boolean;
  /** Urut dari peringkat 1. Skor sama = peringkat sama. */
  pemain: {
    kursi: number;
    nama: string;
    /** Kursi warga kedai di akhir permainan. Pemain yang keluar di tengah permainan tetap false. */
    bot: boolean;
    /** Pemain manusia yang menekan Keluar saat permainan berjalan (dihitung juru kunci di peringkat). */
    keluar?: true;
    skor: number;
    peringkat: number;
    mentung: number;
    kepentung: number;
  }[];
}

export interface RingkasanMeja {
  kode: string;
  namaHost: string;
  jumlahPemain: number;
  terisi: number;
  status: StatusMeja;
}

/** Aksi giliran dari client; indeks pemain diisi meja berdasarkan kursi pengirim. */
export type AksiGiliran = Extract<Aksi, { pemain: number }>;
export type AksiKlien = AksiGiliran extends infer A ? (A extends { pemain: number } ? Omit<A, 'pemain'> : never) : never;

export type PesanKlien =
  | { t: 'buat'; nama: string; pengaturan?: Partial<PengaturanMeja> }
  | { t: 'gabung'; kode: string; nama: string; token?: string }
  | { t: 'daftar' }
  | { t: 'keluar' }
  | { t: 'aturKursi'; kursi: number; jenis: 'bot' | 'kosong'; level?: LevelBot }
  | { t: 'pengaturan'; pengaturan: Partial<PengaturanMeja> }
  | { t: 'mulai'; pengocok?: number }
  | { t: 'aksi'; aksi: AksiKlien }
  | { t: 'putaranBerikut'; pengocok?: number }
  | { t: 'akhiri'; setuju: boolean }
  /** Mode kaldu (#42): setuju/batal "putaran berikutnya terakhir". Hanya di antara putaran. */
  | { t: 'putaranTerakhir'; setuju: boolean }
  | { t: 'siapJoker' }
  | { t: 'emote'; isi: string }
  | { t: 'mainLagi' }
  | { t: 'ping' };

export type PesanServer =
  | { t: 'masuk'; kode: string; token: string; kursi: number }
  | { t: 'meja'; info: InfoMeja }
  | { t: 'view'; view: ViewPemain }
  | { t: 'error'; pesan: string }
  | { t: 'daftar'; meja: RingkasanMeja[] }
  | { t: 'keluar'; alasan: string }
  | { t: 'emote'; kursi: number; isi: string }
  | { t: 'pong' };
