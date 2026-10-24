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

/**
 * Ledekan (keputusan pemilik, 24 Okt 2026): hanya selama hasil putaran tampil di meja online, dikirim
 * langsung ke satu pemain dan tampil besar di layarnya. Siapa pun boleh ngeledek siapa pun (yang
 * kepentung boleh membalas). Isinya daftar ini atau DAFTAR_EMOTE (EMOTE_LAMA dipetakan); tidak ada
 * teks bebas untuk ledekan. Warga kedai tidak pernah ngeledek. Daftar ini dipilih pengembang (pemilik:
 * "tentukan"); urutan menentukan susunan tombol.
 */
export const DAFTAR_LEDEKAN = [
  'Kepentung, rek!',
  'Makan tuh!',
  'Cup cup cup…',
  'Pulang aja, Bos.',
  'Kok bisa, Bos?',
  'Sabar ya 😂',
  'Kasihan deh.',
  'Rasain!',
] as const;

export type Ledekan = (typeof DAFTAR_LEDEKAN)[number];

/** Ledekan paling banyak per kursi di satu hasil putaran (di luar batas 1,2 detik bersama emote). */
export const MAKS_LEDEK_PER_PUTARAN = 12;

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

/** Meja kompetisi (keputusan #51): kode dan nama kompetisinya. */
export interface KompetisiMeja {
  kode: string;
  nama: string;
}

/**
 * Bukti ikut serta kompetisi, disimpan di HP peserta. Token hanya dicocokkan server dengan hash-nya
 * di database; meja tidak pernah melihatnya.
 */
export interface TiketKompetisi {
  kode: string;
  token: string;
}

/** Tiket paling banyak yang dikirim bersama pesan gabung. */
export const MAKS_TIKET = 20;

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
  /**
   * Giliran saat ini sedang dijalankan bot karena waktu habis (lewat batas + toleransi tersembunyi).
   * Giliran pemain yang terputus dan dijalankan warga kedai sesudah masa tenggang tidak ditandai di
   * sini; pemainnya diberi kabar lewat `dijalankanWarga` di pesan `masuk` saat ia kembali.
   */
  diambilAlihBot: boolean;
  /**
   * Awal putaran: kursi manusia yang belum menekan OK di pengumuman joker. Permainan menunggu.
   * Kursi yang tersambung kembali di tengah putaran tanpa sempat melihat joker hanya dimasukkan ke
   * info miliknya sendiri (popup muncul lagi untuknya, meja lain tidak ikut tertahan).
   */
  menungguJoker: number[];
  /** Kursi bot yang sedang "mikir" sebelum aksi pertamanya. */
  botMikir: number | null;
  /** Hanya ada di meja kompetisi (#51). */
  kompetisi?: KompetisiMeja;
  /**
   * Jeda lanjut (keputusan pemilik, 24 Okt 2026): hasil putaran di meja online, host belum bisa
   * memulai putaran berikutnya supaya yang lain sempat melihat kartu. Hanya ada selama terkunci
   * (OpsiMeja.jedaLanjutMs, pemain manusia lain yang terhubung belum semuanya menekan Siap).
   * `sisaMs` relatif terhadap saat pesan dikirim (jam HP sering melenceng; client mengubahnya jadi
   * waktu lokal saat menerima). `siap`: kursi yang sudah menekan Siap. Aplikasi lama mengabaikannya.
   */
  lanjut?: { sisaMs: number; siap: number[] };
  /**
   * Meja kompetisi (#51 versi 2): semua kursi terisi peserta yang terhubung, meja mulai sendiri
   * `sisaMs` lagi (relatif terhadap saat pesan dikirim, seperti `lanjut`). Hanya ada selama hitung
   * mundur berjalan; batal (hilang) kalau ada yang keluar atau terputus.
   */
  mulaiOtomatis?: { sisaMs: number };
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
  /** Kode kompetisi; hanya ada di meja kompetisi (#51). */
  kompetisi?: string;
  /**
   * Meja kompetisi saja (#51 versi 2): kapan permainan ini dimulai (ms epoch, jam meja). Permainan
   * dihitung kalau dimulai selagi kompetisinya berjalan, walau selesai sesudahnya.
   */
  mulaiPada?: number;
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
    /** Id peserta kompetisi yang duduk di kursi ini; hanya di meja kompetisi. */
    peserta?: number;
  }[];
}

/**
 * Hasil kompetisi satu kursi peserta di permainan yang baru dicatat (pesan `kompetisiHasil`). Angka
 * nilai belum dibulatkan; tampilkan dengan `teksNilai()`.
 */
export interface HasilKompetisiKursi {
  kursi: number;
  /** Nama peserta yang terdaftar di kompetisi. */
  nama: string;
  /** Nilai permainan ini, 0–10 (keluar di tengah permainan = 0). */
  nilai: number;
  /** Peserta ini keluar di tengah permainan (juru kunci). */
  keluar: boolean;
  /** Rata-rata nilai sesudah permainan ini, 0–10. */
  rataNilai: number;
  /** Berapa kali main di kompetisi ini, termasuk permainan ini. */
  main: number;
  /** Peringkat klasemen sebelum dan sesudah permainan ini; null = belum masuk klasemen (main < minMain). */
  peringkatSebelum: number | null;
  peringkatSesudah: number | null;
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
  /** `kompetisi`: buat meja kompetisi (#51); pembuatnya wajib peserta. */
  | { t: 'buat'; nama: string; pengaturan?: Partial<PengaturanMeja>; kompetisi?: TiketKompetisi }
  /** `tiket`: semua tiket kompetisi di HP ini, untuk duduk di meja kompetisi (#51). */
  | { t: 'gabung'; kode: string; nama: string; token?: string; tiket?: TiketKompetisi[] }
  | { t: 'daftar' }
  | { t: 'keluar' }
  | { t: 'aturKursi'; kursi: number; jenis: 'bot' | 'kosong'; level?: LevelBot }
  | { t: 'pengaturan'; pengaturan: Partial<PengaturanMeja> }
  | { t: 'mulai'; pengocok?: number }
  /**
   * `id` (opsional, 1–64 huruf/angka/`_`/`-`, lihat `idAksiSah`): penanda aksi dari client supaya
   * aksi yang dikirim ulang sesudah sambung ulang tidak diterapkan dua kali. Server (bukan meja)
   * menjawabnya dengan `aksiDiterima`. Server lama membuang field ini.
   */
  | { t: 'aksi'; aksi: AksiKlien; id?: string }
  | { t: 'putaranBerikut'; pengocok?: number }
  | { t: 'akhiri'; setuju: boolean }
  /** Mode kaldu (#42): setuju/batal "putaran berikutnya terakhir". Hanya di antara putaran. */
  | { t: 'putaranTerakhir'; setuju: boolean }
  /**
   * OK di pengumuman joker. `putaran` (opsional): nomor putaran yang jokernya sudah dilihat; meja
   * mengabaikan OK untuk putaran lain (misalnya OK putaran lama yang terkirim sesudah sambung ulang).
   */
  | { t: 'siapJoker'; putaran?: number }
  /** Jeda lanjut: pemain selain host sudah selesai melihat hasil putaran. */
  | { t: 'siapLanjut' }
  | { t: 'emote'; isi: string }
  /** Ledekan ke kursi `ke`; hanya di hasil putaran. Isi dari DAFTAR_LEDEKAN atau DAFTAR_EMOTE. */
  | { t: 'ledek'; ke: number; isi: string }
  | { t: 'mainLagi' }
  | { t: 'ping' };

export type PesanServer =
  /**
   * `dijalankanWarga` (opsional, hanya kalau > 0): banyaknya langkah yang dijalankan warga kedai di
   * kursi ini selama pemainnya terputus, dikabarkan sekali saat ia tersambung kembali.
   */
  | { t: 'masuk'; kode: string; token: string; kursi: number; dijalankanWarga?: number }
  | { t: 'meja'; info: InfoMeja }
  | { t: 'view'; view: ViewPemain }
  | { t: 'error'; pesan: string }
  | { t: 'daftar'; meja: RingkasanMeja[] }
  | { t: 'keluar'; alasan: string }
  | { t: 'emote'; kursi: number; isi: string }
  /** Ledekan dari kursi `dari` ke kursi `ke`; dikirim ke semua manusia yang terhubung. */
  | { t: 'ledek'; dari: number; ke: number; isi: string }
  /**
   * Aksi ber-`id` sudah diproses server (diterapkan, atau ditolak dan `error`-nya sudah dikirim lebih
   * dulu). Hanya dari server online; aksi yang sama dengan `id` yang sudah tercatat dijawab lagi
   * tanpa diterapkan ulang.
   */
  | { t: 'aksiDiterima'; id: string }
  /** `w` (opsional): jam server (ms epoch) saat menjawab; hanya dari server online, tidak dari meja offline. */
  | { t: 'pong'; w?: number }
  /**
   * Meja kompetisi (#51 versi 2): hasil permainan yang baru selesai sudah tercatat di kompetisi.
   * Dikirim server ke kursi manusia yang terhubung di meja itu (dan sekali lagi ke yang tersambung
   * kembali selama klasemen akhir masih tampil). Tidak dikirim kalau permainannya tidak dihitung.
   * Aplikasi lama mengabaikannya.
   */
  | {
      t: 'kompetisiHasil';
      kompetisi: KompetisiMeja;
      /** Minimal main supaya masuk klasemen (MIN_MAIN_KOMPETISI). */
      minMain: number;
      /** Banyaknya peserta di klasemen (sudah ≥ minMain kali main) sesudah permainan ini. */
      jumlahPeringkat: number;
      /** Satu per kursi peserta meja ini, urut kursi. */
      pemain: HasilKompetisiKursi[];
    };
