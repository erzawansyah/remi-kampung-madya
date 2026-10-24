// Satu meja (room): kursi, host, bot, batas waktu giliran, sambung ulang, voting akhiri, dan voting
// "putaran berikutnya terakhir" (mode kaldu).
// Tidak tahu apa-apa soal jaringan: pesan keluar lewat `kirim`, waktu lewat `Penjadwal`.
// Dipakai server (online) dan client (offline lawan warga kedai).

import {
  AturanError,
  aturanPembagian,
  buatPermainan,
  isJokerHidup,
  migrasiState,
  pilihAksiBot,
  putaranBerikutKaldu,
  Rng,
  terapkanAksi,
  validasiBuang,
  viewUntuk,
  type Aksi,
  type GameState,
  type LevelBot,
  type Peristiwa,
  type ViewPemain,
} from '@remi/engine';
import {
  JEDA_BOT,
  PENGATURAN_BAWAAN,
  type Emote,
  type InfoMeja,
  type JenisKursi,
  type KompetisiMeja,
  type PengaturanMeja,
  type PesanKlien,
  type PesanServer,
  type RingkasanAkhir,
  type RingkasanMeja,
  type StatusMeja,
} from './protokol.js';
import { gayaKursi } from './gayaWarga.js';
import { ubahanTerkunci, type PengaturanKompetisi } from './kompetisi.js';
import { kunciNama, rapikanLevel, rapikanNama } from './validasi.js';

export interface Penjadwal {
  setel(ms: number, fn: () => void): unknown;
  batal(handle: unknown): void;
  sekarang(): number;
}

export const penjadwalNyata: Penjadwal = {
  setel: (ms, fn) => setTimeout(fn, ms),
  batal: (h) => clearTimeout(h as ReturnType<typeof setTimeout>),
  sekarang: () => Date.now(),
};

export interface Kursi {
  jenis: JenisKursi;
  nama: string;
  /** Token rahasia pemain manusia (juga dipakai untuk sambung ulang). */
  pemainId: string | null;
  terhubung: boolean;
  level: LevelBot;
  /**
   * Pemain manusia di kursi ini menekan Keluar saat permainan berjalan; kursinya diteruskan warga
   * kedai dengan nama yang sama. Di peringkat online dihitung juru kunci (keputusan pemilik #45).
   * Hanya ada kalau true (simpanan/golden lama tidak berubah); dihapus saat permainan baru dimulai
   * dan saat main lagi. Tidak ikut dikirim ke client (info() menyalin field satu per satu).
   */
  keluar?: true;
  /**
   * Hanya bersama `keluar`: banyaknya putaran yang hasilnya (siapa mentung, siapa kepentung)
   * sudah jatuh saat pemainnya keluar. Mentung/kepentung di klasemen akhir hanya dihitung dari
   * putaran itu; sisanya hasil main warga kedai yang meneruskan kursinya.
   */
  keluarSesudahPutaran?: number;
  /**
   * Meja kompetisi (#51): id peserta yang duduk di kursi ini. Tetap ada sesudah ia keluar, supaya
   * hasilnya (juru kunci) tercatat atas namanya. Tidak ikut dikirim ke client.
   */
  peserta?: number;
}

/** Meja kompetisi (#51): kompetisinya dan pengaturan yang dikunci. */
export interface KompetisiDataMeja extends KompetisiMeja {
  pengaturan: PengaturanKompetisi;
}

/** Semua yang perlu disimpan supaya meja bisa dilanjutkan (JSON). */
export interface DataMeja {
  versi: 1;
  kode: string;
  pengaturan: PengaturanMeja;
  kursi: Kursi[];
  host: number;
  game: GameState | null;
  rngBot: number;
  setujuAkhiri: number[];
  /**
   * Mode kaldu (#42): kursi yang setuju putaran berikutnya putaran terakhir. Hanya ditulis kalau ada
   * isinya (simpanan lama dan golden tidak berubah); tidak ada = belum ada yang setuju.
   */
  setujuKaldu?: number[];
  /** Bertambah setiap giliran berganti; identitas giliran untuk timer. */
  giliranKe: number;
  /** Kursi manusia yang belum menekan OK di pengumuman joker awal putaran. */
  menungguJoker: number[];
  /**
   * Kursi yang sudah melihat pengumuman joker putaran ini (menekan OK, popupnya sudah tampil sampai
   * batas waktu, atau sudah sekali ditanya ulang karena tersambung kembali). Dikosongkan tiap
   * putaran baru. Kursi manusia yang tersambung kembali dan belum ada di sini ditanya lagi (popup
   * joker muncul lagi untuknya), paling banyak sekali per kursi per putaran.
   */
  sudahLihatJoker: number[];
  /** Hanya ada di meja kompetisi (#51); meja biasa tidak berubah (golden). */
  kompetisi?: KompetisiDataMeja;
}

/** Masa tenggang bawaan sebelum warga kedai mengambil alih giliran pemain yang terputus. */
export const TENGGANG_SAMBUNG_MS = 20_000;

/**
 * Batas terlama tunggu pengumuman joker untuk pemain yang tersambung kembali di tengah putaran.
 * Berlaku juga kalau batas waktu giliran meja lebih panjang (yang lebih pendek dipakai). Supaya meja
 * yang sudah jalan tidak tertahan lama (misalnya OK-nya tertekan saat sinyal putus dan tidak sampai
 * ke server). Tiap kursi paling banyak sekali ditanya ulang per putaran.
 */
export const BATAS_JOKER_SAMBUNG_MS = 30_000;

/**
 * Jeda coba ulang sesudah langkah warga kedai gagal total (semua cadangan galat): 2 detik, lalu dua
 * kali lipat tiap gagal lagi di giliran yang sama, paling lama JEDA_ULANG_GALAT_MAKS_MS. Supaya meja
 * yang tersandung tidak berputar cepat menghabiskan CPU, tapi juga tidak berhenti selamanya.
 */
export const JEDA_ULANG_GALAT_MS = 2_000;
export const JEDA_ULANG_GALAT_MAKS_MS = 60_000;

function jedaUlangGalat(kali: number): number {
  return Math.min(JEDA_ULANG_GALAT_MAKS_MS, JEDA_ULANG_GALAT_MS * 2 ** Math.max(0, kali - 1));
}

export interface OpsiMeja {
  kode: string;
  kirim: (pemainId: string, pesan: PesanServer) => void;
  penjadwal?: Penjadwal;
  /** Jeda antaraksi bot (ms). Kosong = ikut pengaturan tempo bot meja. */
  jedaBotMs?: number;
  /** Sumber seed untuk permainan baru. */
  buatSeed?: () => number;
  /** Sumber acak untuk celetukan bot (bisa diganti di test). Tidak dipakai untuk nama lawan. */
  acak?: () => number;
  /**
   * Urutan calon nama lawan otomatis (warga kedai). Kosong = NAMA_LAWAN_BAWAAN. Server dan meja
   * offline mengirim daftar yang sudah diacak; latihan dengan panduan memakai urutan tetap.
   * Sengaja di opsi (bukan PengaturanMeja/DataMeja): nama yang sudah dipilih tersimpan di kursi.
   */
  namaLawan?: readonly string[];
  /** Jumlah entri log terakhir yang dikirim ke client. */
  batasLog?: number;
  /**
   * Masa tenggang (ms) sebelum warga kedai mengambil alih giliran pemain manusia yang terputus,
   * dihitung sejak ia terputus. Kosong = TENGGANG_SAMBUNG_MS, 0 = langsung diambil alih. Kalau meja
   * memakai batas waktu giliran, batas waktu itu tetap berlaku (yang lebih dulu habis).
   */
  tenggangSambungMs?: number;
  /** Dipanggil setiap data meja berubah (misalnya untuk disimpan). */
  saatBerubah?: (data: DataMeja) => void;
  /** Dipanggil sekali saat permainan selesai, membawa klasemen akhir. */
  saatSelesai?: (ringkasan: RingkasanAkhir) => void;
  /**
   * Dipanggil setiap ada galat yang ditangkap meja di dalam timer (langkah warga kedai, batas waktu,
   * dll.). Meja tetap jalan; ini hanya untuk dicatat/dihitung. Kosong = console.error.
   */
  saatGalat?: (konteks: string, galat: unknown) => void;
}

export class GalatMeja extends Error {}

function galat(pesan: string): never {
  throw new GalatMeja(pesan);
}

export class Meja {
  private d: DataMeja;
  private readonly penjadwal: Penjadwal;
  private timerBot: unknown = null;
  private timerGiliran: unknown = null;
  private kunciTimer: string | null = null;
  private batasWaktu: number | null = null;
  /** Waktu emote terakhir tiap kursi (batas supaya tidak nyampah). */
  private emoteTerakhir = new Map<number, number>();
  /** Bot yang sedang "mikir" sebelum aksi pertamanya (untuk ditampilkan). */
  private botMikir: number | null = null;
  /** Kunci giliran saat bot terakhir melangkah (untuk jeda awal giliran). */
  private kunciLangkahBot: string | null = null;
  /** Kunci giliran yang sedang diambil alih bot karena waktu habis. */
  private ambilAlih: string | null = null;
  private berhenti = false;
  /** Timer masa tenggang sambung ulang (warga kedai mengambil alih saat habis). */
  private timerTenggang: unknown = null;
  /** Waktu tiap kursi manusia terputus (untuk masa tenggang). Tidak disimpan. */
  private putusSejak = new Map<number, number>();
  /** Bertambah setiap tunggu joker baru karena pemain tersambung kembali (kunci batas waktu). */
  private seriJoker = 0;
  /** Tunggu joker yang sedang berjalan dimulai karena ada yang tersambung kembali. */
  private jokerSambung = false;
  /** Langkah warga kedai yang gagal total berturut-turut di satu giliran (untuk jeda coba ulang). */
  private galatBot: { kunci: string; kali: number } | null = null;
  /** Timer coba ulang menyusun jadwal kalau jadwalkan() sendiri galat, dan berapa kali sudah gagal. */
  private timerPulih: unknown = null;
  private gagalJadwal = 0;

  constructor(
    private readonly opsi: OpsiMeja,
    data: DataMeja,
  ) {
    const menungguJoker = Array.isArray(data.menungguJoker) ? data.menungguJoker : [];
    const pengaturan = { ...PENGATURAN_BAWAAN, ...data.pengaturan };
    this.d = {
      ...data,
      // Level yang tidak dikenal (simpanan rusak atau dari versi lain) jatuh ke bawaan.
      pengaturan: { ...pengaturan, levelBot: rapikanLevel(pengaturan.levelBot) },
      kursi: data.kursi.map((k) => ({ ...k, level: rapikanLevel(k.level) })),
      game: data.game && migrasiState(data.game),
      menungguJoker,
      // Simpanan lama (belum ada field ini): yang tidak sedang ditunggu dianggap sudah melihat
      // joker, supaya popup tidak muncul lagi saat simpanan dilanjutkan.
      sudahLihatJoker: Array.isArray(data.sudahLihatJoker)
        ? data.sudahLihatJoker
        : data.kursi.map((_, i) => i).filter((i) => !menungguJoker.includes(i)),
    };
    this.aturSetujuKaldu(Array.isArray(data.setujuKaldu) ? data.setujuKaldu.filter((i) => Number.isInteger(i)) : []);
    this.penjadwal = opsi.penjadwal ?? penjadwalNyata;
    const sekarang = this.penjadwal.sekarang();
    this.d.kursi.forEach((k, i) => {
      if (k.jenis === 'manusia' && !k.terhubung) this.putusSejak.set(i, sekarang);
    });
    this.jadwalkan();
  }

  /**
   * Meja baru dengan host di kursi 0. Meja kompetisi (#51): `kompetisi` diisi server sesudah tiket
   * pembuatnya dicek; pengaturan yang dikunci kompetisi menimpa `pengaturan`.
   */
  static buat(
    opsi: OpsiMeja,
    pemainId: string,
    nama: string,
    pengaturan: Partial<PengaturanMeja> = {},
    kompetisi?: KompetisiDataMeja & { peserta: number },
  ): Meja {
    const p = { ...PENGATURAN_BAWAAN, ...pengaturan, ...kompetisi?.pengaturan };
    p.levelBot = rapikanLevel(p.levelBot);
    const kursi: Kursi[] = Array.from({ length: p.jumlahPemain }, () => kursiKosong(p.levelBot));
    kursi[0] = { jenis: 'manusia', nama: rapikanNama(nama), pemainId, terhubung: true, level: p.levelBot };
    if (kompetisi) kursi[0].peserta = kompetisi.peserta;
    const data: DataMeja = {
      versi: 1,
      kode: opsi.kode,
      pengaturan: p,
      kursi,
      host: 0,
      game: null,
      rngBot: (opsi.buatSeed ?? acak)(),
      setujuAkhiri: [],
      giliranKe: 0,
      menungguJoker: [],
      sudahLihatJoker: [],
      ...(kompetisi ? { kompetisi: { kode: kompetisi.kode, nama: kompetisi.nama, pengaturan: { ...kompetisi.pengaturan } } } : {}),
    };
    const meja = new Meja(opsi, data);
    meja.kirimKe(pemainId, { t: 'masuk', kode: opsi.kode, token: pemainId, kursi: 0 });
    meja.siarkan();
    return meja;
  }

  get kode(): string {
    return this.d.kode;
  }

  /** Salinan data untuk disimpan. */
  get data(): DataMeja {
    return JSON.parse(JSON.stringify(this.d)) as DataMeja;
  }

  get status(): StatusMeja {
    if (!this.d.game) return 'lobi';
    return this.d.game.status === 'selesai' ? 'selesai' : 'main';
  }

  get jumlahManusiaTerhubung(): number {
    return this.d.kursi.filter((k) => k.jenis === 'manusia' && k.terhubung).length;
  }

  get publik(): boolean {
    return this.d.pengaturan.publik;
  }

  /** Kode kompetisi meja ini (#51); null = meja biasa. */
  get kompetisi(): string | null {
    return this.d.kompetisi?.kode ?? null;
  }

  punyaPemain(pemainId: string): boolean {
    return this.kursiDari(pemainId) !== null;
  }

  ringkasan(): RingkasanMeja {
    return {
      kode: this.d.kode,
      namaHost: this.d.kursi[this.d.host]?.nama ?? '',
      jumlahPemain: this.d.pengaturan.jumlahPemain,
      terisi: this.d.kursi.filter((k) => k.jenis !== 'kosong').length,
      status: this.status,
    };
  }

  /** Hentikan semua timer (meja dibuang). */
  hentikan(): void {
    this.berhenti = true;
    this.batalTimer();
  }

  /**
   * Duduk di kursi kosong, atau sambung ulang bila pemainId sudah punya kursi. Meja kompetisi (#51):
   * `peserta` wajib (diisi server sesudah tiketnya dicek), dan satu peserta hanya boleh satu kursi.
   */
  masuk(pemainId: string, nama: string, peserta?: number): number {
    const ada = this.kursiDari(pemainId);
    if (ada !== null) {
      this.terhubung(pemainId);
      return ada;
    }
    if (this.status !== 'lobi') galat('Permainan di meja ini sudah mulai.');
    if (this.d.kompetisi) {
      if (peserta === undefined) galat(`Meja ini khusus peserta kompetisi "${this.d.kompetisi.nama}". Ikut serta dulu dari menu Kompetisi, Bos.`);
      if (this.d.kursi.some((k) => k.jenis === 'manusia' && k.peserta === peserta)) galat('Kamu sudah duduk di meja ini dari HP lain.');
    }
    const i = this.d.kursi.findIndex((k) => k.jenis === 'kosong');
    if (i < 0) galat('Mejanya sudah penuh, Bos.');
    this.d.kursi[i] = { jenis: 'manusia', nama: rapikanNama(nama), pemainId, terhubung: true, level: this.d.pengaturan.levelBot };
    if (this.d.kompetisi && peserta !== undefined) this.d.kursi[i].peserta = peserta;
    this.putusSejak.delete(i);
    // Nama yang baru masuk sama dengan nama warga kedai di lobi: warga kedainya yang ganti nama.
    const kunci = kunciNama(this.d.kursi[i].nama);
    this.d.kursi.forEach((k, j) => {
      if (k.jenis === 'bot' && kunciNama(k.nama) === kunci) k.nama = namaBot(this.d.kursi, j, this.opsi.namaLawan);
    });
    this.kirimKe(pemainId, { t: 'masuk', kode: this.d.kode, token: pemainId, kursi: i });
    this.perbaruiHost();
    this.berubah();
    return i;
  }

  terhubung(pemainId: string): void {
    const i = this.kursiDari(pemainId);
    if (i === null) return;
    this.d.kursi[i].terhubung = true;
    this.putusSejak.delete(i);
    // Belum sempat melihat pengumuman joker putaran ini (misalnya terputus atau refresh sebelum
    // menekan OK): popup joker muncul lagi untuknya. Yang sudah menekan OK tidak ditanya lagi.
    // Tanya ulang cuma sekali per kursi per putaran: kursinya langsung dicatat di sudahLihatJoker,
    // jadi kalau ia putus-sambung lagi, meja tidak ditahan lagi.
    if (
      this.d.game?.status === 'putaranBerjalan' &&
      !this.d.sudahLihatJoker.includes(i) &&
      !this.d.menungguJoker.includes(i)
    ) {
      if (!this.d.menungguJoker.length) {
        this.seriJoker++;
        this.jokerSambung = true;
      }
      this.d.menungguJoker = [...this.d.menungguJoker, i].sort((a, b) => a - b);
      this.d.sudahLihatJoker = [...this.d.sudahLihatJoker, i].sort((a, b) => a - b);
    }
    this.kirimKe(pemainId, { t: 'masuk', kode: this.d.kode, token: pemainId, kursi: i });
    this.perbaruiHost();
    this.berubah();
  }

  terputus(pemainId: string): void {
    const i = this.kursiDari(pemainId);
    if (i === null) return;
    this.d.kursi[i].terhubung = false;
    this.putusSejak.set(i, this.penjadwal.sekarang());
    this.lepasKursi(i);
  }

  /**
   * Keluar dengan sengaja. Di lobi kursinya kosong lagi; saat main, kursinya diteruskan bot dan
   * ditandai `keluar` (juru kunci di peringkat online). Sesudah permainan selesai tidak ditandai:
   * klasemen akhirnya sudah tercatat. Terputus/menutup aplikasi tanpa Keluar tidak lewat sini.
   */
  tinggalkan(pemainId: string): void {
    const i = this.kursiDari(pemainId);
    if (i === null) return;
    const k = this.d.kursi[i];
    if (this.status === 'lobi') this.d.kursi[i] = kursiKosong(this.d.pengaturan.levelBot);
    else {
      this.d.kursi[i] = { jenis: 'bot', nama: k.nama, pemainId: null, terhubung: false, level: this.d.pengaturan.levelBot };
      if (k.peserta !== undefined) this.d.kursi[i].peserta = k.peserta;
      const g = this.d.game;
      if (this.status === 'main' && g) {
        this.d.kursi[i].keluar = true;
        // Di susun akhir yang mentung dan kepentung putaran ini sudah ketahuan, jadi ikut dihitung.
        this.d.kursi[i].keluarSesudahPutaran = g.riwayat.length + (g.status === 'susunAkhir' ? 1 : 0);
      }
    }
    this.putusSejak.delete(i);
    this.lepasKursi(i);
  }

  /**
   * Kursi i tidak lagi ikut menentukan (terputus atau keluar): tidak ditunggu di pengumuman joker,
   * suaranya di voting akhiri dan voting kaldu dicabut, lalu kedua voting dicek ulang dengan pemilih
   * yang tersisa (keputusan #36). Akhiri didahulukan.
   */
  private lepasKursi(i: number): void {
    this.d.setujuAkhiri = this.d.setujuAkhiri.filter((x) => x !== i);
    this.aturSetujuKaldu((this.d.setujuKaldu ?? []).filter((x) => x !== i));
    this.d.menungguJoker = this.d.menungguJoker.filter((x) => x !== i);
    this.perbaruiHost();
    if (this.cekVotingAkhiri() || this.cekVotingKaldu()) return;
    this.berubah();
  }

  /** Simpan suara voting kaldu; daftar kosong tidak ditulis (DataMeja lama dan golden tetap sama). */
  private aturSetujuKaldu(kursi: number[]): void {
    if (kursi.length) this.d.setujuKaldu = kursi;
    else delete this.d.setujuKaldu;
  }

  /** Tangani satu pesan dari pemain. Kesalahan dikirim balik sebagai pesan error. */
  terima(pemainId: string, pesan: PesanKlien): void {
    try {
      this.proses(pemainId, pesan);
    } catch (e) {
      if (e instanceof GalatMeja || e instanceof AturanError) {
        this.kirimKe(pemainId, { t: 'error', pesan: e instanceof AturanError ? e.pesan : e.message });
        return;
      }
      throw e;
    }
  }

  private proses(pemainId: string, pesan: PesanKlien): void {
    const kursi = this.kursiDari(pemainId);
    if (kursi === null) galat('Kamu belum duduk di meja ini.');
    switch (pesan.t) {
      case 'keluar':
        this.kirimKe(pemainId, { t: 'keluar', alasan: 'Kamu keluar dari meja.' });
        return this.tinggalkan(pemainId);
      case 'aturKursi':
        return this.aturKursi(kursi, pesan.kursi, pesan.jenis, pesan.level);
      case 'pengaturan':
        return this.ubahPengaturan(kursi, pesan.pengaturan);
      case 'mulai':
        return this.mulai(kursi, pesan.pengocok);
      case 'putaranBerikut':
        return this.putaranBerikut(kursi, pesan.pengocok);
      case 'aksi':
        return this.aksi(kursi, { ...pesan.aksi, pemain: kursi } as Aksi);
      case 'emote':
        return this.kirimEmote(kursi, pesan.isi);
      case 'siapJoker':
        this.d.menungguJoker = this.d.menungguJoker.filter((x) => x !== kursi);
        if (this.d.game?.status === 'putaranBerjalan' && !this.d.sudahLihatJoker.includes(kursi)) {
          this.d.sudahLihatJoker = [...this.d.sudahLihatJoker, kursi].sort((a, b) => a - b);
        }
        return this.berubah();
      case 'akhiri':
        return this.akhiri(kursi, pesan.setuju);
      case 'putaranTerakhir':
        return this.putaranTerakhir(kursi, pesan.setuju);
      case 'mainLagi':
        return this.mainLagi(kursi);
      case 'ping':
        return this.kirimKe(pemainId, { t: 'pong' });
      default:
        galat('Pesan tidak dikenal.');
    }
  }

  private wajibHost(kursi: number): void {
    if (kursi !== this.d.host) galat('Cuma host yang bisa melakukan ini.');
  }

  private aturKursi(oleh: number, i: number, jenis: 'bot' | 'kosong', level?: LevelBot): void {
    this.wajibHost(oleh);
    if (this.status !== 'lobi') galat('Kursi cuma bisa diatur sebelum permainan mulai.');
    if (!Number.isInteger(i) || i < 0 || i >= this.d.kursi.length) galat('Kursinya nggak ada.');
    if (i === oleh) galat('Kursimu sendiri nggak bisa diganti.');
    if (jenis === 'bot' && this.d.kompetisi) galat('Meja kompetisi khusus peserta, nggak bisa diisi warga kedai.');
    const lama = this.d.kursi[i];
    if (lama.jenis === 'manusia' && lama.pemainId) {
      this.kirimKe(lama.pemainId, { t: 'keluar', alasan: 'Kursimu diganti oleh host.' });
    }
    // Pesan dari jaringan sudah divalidasi; meja offline memanggil langsung dari isian UI.
    const lv = level === undefined ? this.d.pengaturan.levelBot : rapikanLevel(level);
    this.d.kursi[i] =
      jenis === 'bot'
        ? { jenis: 'bot', nama: namaBot(this.d.kursi, i, this.opsi.namaLawan), pemainId: null, terhubung: false, level: lv }
        : kursiKosong(lv);
    this.berubah();
  }

  private ubahPengaturan(oleh: number, ubah: Partial<PengaturanMeja>): void {
    this.wajibHost(oleh);
    if (this.status !== 'lobi') {
      // Saat main, yang boleh diubah hanya tempo bot.
      if (Object.keys(ubah).some((k) => k !== 'tempoBot')) galat('Pengaturan cuma bisa diubah sebelum permainan mulai.');
      this.d.pengaturan = { ...this.d.pengaturan, ...ubah };
      this.berubah();
      return;
    }
    if (this.d.kompetisi && ubahanTerkunci(this.d.kompetisi.pengaturan, ubah).length) {
      galat('Aturan meja kompetisi ikut kompetisinya, nggak bisa diubah.');
    }
    const baru = { ...this.d.pengaturan, ...ubah };
    const n = baru.jumlahPemain;
    if (n < this.d.kursi.length) {
      const terbuang = this.d.kursi.slice(n);
      if (terbuang.some((k) => k.jenis === 'manusia')) galat('Masih ada pemain di kursi yang mau dihapus.');
      if (this.d.host >= n) galat('Kursi host nggak bisa dihapus.');
      this.d.kursi = this.d.kursi.slice(0, n);
    }
    while (this.d.kursi.length < n) this.d.kursi.push(kursiKosong(baru.levelBot));
    this.d.pengaturan = baru;
    this.berubah();
  }

  private mulai(oleh: number, pengocok?: number): void {
    this.wajibHost(oleh);
    if (this.status !== 'lobi') galat('Permainan sudah berjalan.');
    if (this.d.kompetisi && this.d.kursi.some((k) => k.jenis !== 'manusia')) {
      galat('Masih ada kursi kosong. Tunggu peserta lain masuk, atau kurangi jumlah pemain.');
    }
    if (this.d.kursi.some((k) => k.jenis === 'kosong')) galat('Masih ada kursi kosong. Ajak warga kedai atau tunggu orang masuk.');
    hapusTandaKeluar(this.d.kursi);
    const p = this.d.pengaturan;
    const kaldu = p.modeKaldu === true;
    const game = buatPermainan({
      pemain: this.d.kursi.map((k) => k.nama),
      seed: (this.opsi.buatSeed ?? acak)(),
      konfigurasi: {
        duaDeckUntukEmpat: p.duaDeckUntukEmpat,
        batasPutaran: p.batasPutaran,
        // Mode kaldu tidak memakai batas skor (#43); isiannya tetap tersimpan di pengaturan.
        batasSkorAtas: kaldu ? null : p.batasSkorAtas,
        batasSkorBawah: kaldu ? null : p.batasSkorBawah,
        // Hanya dikirim kalau aktif, supaya konfigurasi meja biasa (dan golden) tidak berubah.
        ...(kaldu ? { modeKaldu: true } : {}),
      },
    });
    this.d.setujuAkhiri = [];
    this.aturSetujuKaldu([]);
    this.terapkan(game, { jenis: 'mulaiPutaran', pengocok });
  }

  private putaranBerikut(oleh: number, pengocok?: number): void {
    this.wajibHost(oleh);
    if (this.d.game?.status !== 'putaranSelesai') galat('Putaran belum selesai.');
    this.d.setujuAkhiri = [];
    this.aturSetujuKaldu([]);
    this.terapkan(this.d.game, { jenis: 'mulaiPutaran', pengocok });
  }

  private aksi(kursi: number, aksi: Aksi): void {
    const g = this.d.game;
    if (!g || (g.status !== 'putaranBerjalan' && g.status !== 'susunAkhir')) galat('Belum ada putaran yang berjalan.');
    if (this.d.menungguJoker.length) galat('Tunggu semua pemain melihat joker dulu.');
    const giliranSaya = g.status === 'susunAkhir' || g.putaran!.giliran === kursi;
    if (giliranSaya && this.ambilAlih !== null && this.ambilAlih === this.kunciGiliran()) {
      galat('Waktu habis, giliranmu dijalankan warga kedai dulu, Bos.');
    }
    this.terapkan(g, aksi);
  }

  private akhiri(kursi: number, setuju: boolean): void {
    if (this.d.game?.status !== 'putaranSelesai') galat('Permainan cuma bisa diakhiri di antara putaran.');
    const set = new Set(this.d.setujuAkhiri);
    if (setuju) set.add(kursi);
    else set.delete(kursi);
    this.d.setujuAkhiri = [...set].sort((a, b) => a - b);
    if (this.cekVotingAkhiri()) return;
    this.berubah();
  }

  /**
   * Akhiri permainan kalau semua manusia yang masih terhubung sudah setuju (minimal satu suara dan
   * satu pemilih; meja tanpa manusia terhubung tidak pernah diakhiri sendiri). Dipanggil saat ada
   * yang memilih, dan saat pemilih berkurang (terputus/keluar). True = permainan diakhiri.
   */
  private cekVotingAkhiri(): boolean {
    const g = this.d.game;
    if (g?.status !== 'putaranSelesai' || !this.d.setujuAkhiri.length) return false;
    const pemilih = this.d.kursi
      .map((k, i) => ({ k, i }))
      .filter(({ k }) => k.jenis === 'manusia' && k.terhubung)
      .map(({ i }) => i);
    if (!pemilih.length || !pemilih.every((i) => this.d.setujuAkhiri.includes(i))) return false;
    this.d.setujuAkhiri = [];
    this.terapkan(g, { jenis: 'akhiriPermainan' });
    return true;
  }

  /**
   * Mode kaldu (#42): setuju/batal "putaran berikutnya terakhir". Sama seperti voting akhiri: hanya di
   * antara putaran, berlaku kalau semua manusia yang masih terhubung setuju (meja offline dengan satu
   * manusia: langsung berlaku).
   */
  private putaranTerakhir(kursi: number, setuju: boolean): void {
    const g = this.d.game;
    if (g?.status !== 'putaranSelesai') galat('Putaran terakhir cuma bisa diminta di antara putaran.');
    if (g.konfigurasi.modeKaldu !== true) galat('Meja ini nggak pakai mode kaldu.');
    if (putaranBerikutKaldu(g)) galat('Putaran berikutnya memang sudah putaran terakhir.');
    const set = new Set(this.d.setujuKaldu ?? []);
    if (setuju) set.add(kursi);
    else set.delete(kursi);
    this.aturSetujuKaldu([...set].sort((a, b) => a - b));
    if (this.cekVotingKaldu()) return;
    this.berubah();
  }

  /**
   * Jadikan putaran berikutnya putaran kaldu kalau semua manusia yang masih terhubung sudah setuju
   * (aturan sama dengan cekVotingAkhiri, termasuk saat pemilih berkurang, keputusan #36). True =
   * diterapkan.
   */
  private cekVotingKaldu(): boolean {
    const g = this.d.game;
    const setuju = this.d.setujuKaldu ?? [];
    if (g?.status !== 'putaranSelesai' || !setuju.length) return false;
    if (g.konfigurasi.modeKaldu !== true || putaranBerikutKaldu(g)) {
      // Suara yang sudah tidak berarti (misalnya dari simpanan rusak): dibuang.
      this.aturSetujuKaldu([]);
      return false;
    }
    const pemilih = this.d.kursi
      .map((k, i) => ({ k, i }))
      .filter(({ k }) => k.jenis === 'manusia' && k.terhubung)
      .map(({ i }) => i);
    if (!pemilih.length || !pemilih.every((i) => setuju.includes(i))) return false;
    this.aturSetujuKaldu([]);
    this.terapkan(g, { jenis: 'putaranTerakhir' });
    return true;
  }

  private mainLagi(oleh: number): void {
    this.wajibHost(oleh);
    if (this.status !== 'selesai') galat('Permainan belum selesai.');
    hapusTandaKeluar(this.d.kursi);
    // Meja kompetisi tanpa warga kedai: kursi yang ditinggal kosong lagi untuk peserta lain.
    if (this.d.kompetisi) this.d.kursi = this.d.kursi.map((k) => (k.jenis === 'bot' ? kursiKosong(this.d.pengaturan.levelBot) : k));
    this.d.game = null;
    this.d.setujuAkhiri = [];
    this.aturSetujuKaldu([]);
    this.berubah();
  }

  /** Terapkan aksi ke game; melempar AturanError bila ditolak. */
  private terapkan(game: GameState, aksi: Aksi): void {
    const h = terapkanAksi(game, aksi);
    if (!h.ok) throw new AturanError(h.error.kode, h.error.pesan);
    const sebelum = game.putaran;
    const sesudah = h.state.putaran;
    if (
      !sebelum ||
      !sesudah ||
      sebelum.nomor !== sesudah.nomor ||
      sebelum.giliran !== sesudah.giliran ||
      game.status !== h.state.status
    ) {
      this.d.giliranKe++;
      this.ambilAlih = null;
    }
    if (h.state.status === 'putaranBerjalan' && h.state.putaran?.nomor !== sebelum?.nomor) {
      // Putaran baru: semua manusia yang terhubung harus melihat pengumuman joker dulu.
      this.d.menungguJoker = this.d.kursi
        .map((k, i) => (k.jenis === 'manusia' && k.terhubung ? i : -1))
        .filter((i) => i >= 0);
      this.d.sudahLihatJoker = [];
      this.jokerSambung = false;
    }
    const idTerakhir = game.peristiwa.at(-1)?.id ?? 0;
    this.d.game = h.state;
    this.berubah();
    if (game.status !== 'selesai' && h.state.status === 'selesai') {
      this.opsi.saatSelesai?.(buatRingkasanAkhir(this.d.kode, this.d.kursi, h.state, this.penjadwal.sekarang(), this.d.kompetisi?.kode));
    }
    this.celetukBot(h.state.peristiwa.filter((e) => e.id > idTerakhir));
  }

  /** Kirim emote/pesan ke semua pemain manusia. Maksimal satu per 1,2 detik per kursi. */
  private kirimEmote(kursi: number, isi: string): void {
    const sekarang = this.penjadwal.sekarang();
    if (sekarang - (this.emoteTerakhir.get(kursi) ?? -Infinity) < 1200) return;
    this.emoteTerakhir.set(kursi, sekarang);
    for (const k of this.d.kursi) {
      if (k.jenis === 'manusia' && k.pemainId && k.terhubung) this.kirimKe(k.pemainId, { t: 'emote', kursi, isi });
    }
  }

  /**
   * Bot sesekali nyeletuk menanggapi kejadian yang terlihat semua orang (tidak membocorkan kartu).
   * Panjang tiap daftar pilih([...]) sengaja tetap: urutan acaknya dikunci golden master meja.
   */
  private celetukBot(baru: Peristiwa[]): void {
    const acak = this.opsi.acak ?? Math.random;
    const bot = (i: number) => this.d.kursi[i]?.jenis === 'bot';
    const pilih = <T>(xs: readonly T[]) => xs[Math.floor(acak() * xs.length) % xs.length];
    const rencana: [number, Emote][] = [];
    for (const e of baru) {
      if (e.jenis === 'mulung' && bot(e.pemain) && e.kartu.some((x) => x.pemilik !== e.pemain) && acak() < 0.4) {
        rencana.push([e.pemain, pilih(['Suwun, Bos!', '😎', '👏'] as const)]);
      }
      if (e.jenis === 'mentung') {
        if (bot(e.pemain) && acak() < 0.7) rencana.push([e.pemain, pilih(['Nutup, rek!', '🔥', '😎', 'GG'] as const)]);
        for (const k of e.kepentung) if (bot(k) && acak() < 0.6) rencana.push([k, pilih(['Waduh!', '😱', 'Kartu itu bundar, kak.'] as const)]);
      }
    }
    rencana.slice(0, 3).forEach(([kursi, isi], i) =>
      this.pasangTimer(
        700 + i * 800 + Math.floor(acak() * 400),
        'celetukan warga kedai',
        () => {
          if (!this.berhenti) this.kirimEmote(kursi, isi);
        },
        false,
      ),
    );
  }

  private kunciGiliran(): string | null {
    const g = this.d.game;
    if (!g || !g.putaran) return null;
    if (g.status === 'susunAkhir') return `${g.putaran.nomor}:akhir`;
    if (g.status !== 'putaranBerjalan') return null;
    return `${g.putaran.nomor}:${this.d.giliranKe}`;
  }

  private batalTimer(): void {
    if (this.timerBot !== null) this.penjadwal.batal(this.timerBot);
    if (this.timerGiliran !== null) this.penjadwal.batal(this.timerGiliran);
    if (this.timerTenggang !== null) this.penjadwal.batal(this.timerTenggang);
    if (this.timerPulih !== null) this.penjadwal.batal(this.timerPulih);
    this.timerBot = null;
    this.timerGiliran = null;
    this.timerTenggang = null;
    this.timerPulih = null;
  }

  /**
   * Pasang timer meja. Galat di dalam callback tidak pernah lolos keluar: di Node galat timer yang
   * lolos bisa mematikan proses, dan di browser meja offline diam macet. Galatnya dicatat, lalu
   * (kalau `pulihkan`) jadwal meja disusun ulang supaya meja tidak tertinggal tanpa timer.
   */
  private pasangTimer(ms: number, konteks: string, fn: () => void, pulihkan = true): unknown {
    return this.penjadwal.setel(ms, () => {
      try {
        fn();
      } catch (e) {
        this.catatGalat(konteks, e);
        if (pulihkan) this.pulihkanJadwal();
      }
    });
  }

  /**
   * Susun ulang timer sesudah galat. Kalau jadwalkan() sendiri galat, coba lagi nanti dengan jeda
   * yang makin panjang (tidak pernah berputar cepat), sampai berhasil atau ada perubahan lain.
   */
  private pulihkanJadwal(): void {
    if (this.berhenti) return;
    try {
      this.jadwalkan();
      this.gagalJadwal = 0;
    } catch (e) {
      this.catatGalat('menyusun ulang jadwal meja', e);
      try {
        this.timerPulih = this.penjadwal.setel(jedaUlangGalat(++this.gagalJadwal), () => {
          this.timerPulih = null;
          this.pulihkanJadwal();
        });
      } catch (e2) {
        this.catatGalat('memasang timer pemulihan', e2);
      }
    }
  }

  /** Catat galat lewat opsi.saatGalat (bawaan console.error). Tidak pernah melempar lagi. */
  private catatGalat(konteks: string, e: unknown): void {
    try {
      if (this.opsi.saatGalat) this.opsi.saatGalat(konteks, e);
      else console.error(`[meja ${this.d.kode}] ${konteks}`, e);
    } catch {
      // Pencatatnya sendiri galat: diamkan, yang penting meja jalan terus.
    }
  }

  /** Atur ulang timer bot dan batas waktu giliran sesuai state sekarang. */
  private jadwalkan(): void {
    this.batalTimer();
    if (this.berhenti) return;
    const g = this.d.game;
    const kunci = this.kunciGiliran();
    if (!g || !kunci) {
      this.batasWaktu = null;
      this.kunciTimer = null;
      return;
    }
    // Semua manusia pergi: permainan dijeda sampai ada yang kembali. Batas waktu yang sedang
    // berjalan dibuang, jadi saat ada yang kembali giliran (atau pengumuman joker) dapat waktu penuh
    // lagi, tidak langsung diambil alih warga kedai karena waktunya habis selama jeda.
    if (this.jumlahManusiaTerhubung === 0) {
      this.kunciTimer = null;
      this.batasWaktu = null;
      return;
    }
    this.botMikir = null;
    const sekarang = this.penjadwal.sekarang();

    // Pengumuman joker: permainan menunggu semua menekan OK (kalau ada batas waktu, dibatasi juga).
    // Tunggu karena ada yang tersambung kembali di tengah putaran selalu dibatasi, paling lama
    // BATAS_JOKER_SAMBUNG_MS walau batas waktu giliran lebih panjang, supaya meja yang sudah jalan
    // tidak tertahan lama.
    if (this.d.menungguJoker.length) {
      const lamaGiliran = Math.max(0, this.d.pengaturan.detikGiliran) * 1000;
      const lamaJoker = this.jokerSambung
        ? lamaGiliran > 0
          ? Math.min(lamaGiliran, BATAS_JOKER_SAMBUNG_MS)
          : BATAS_JOKER_SAMBUNG_MS
        : lamaGiliran;
      if (lamaJoker > 0) {
        const kunciJoker = `joker:${g.putaran!.nomor}:${this.seriJoker}`;
        if (this.kunciTimer !== kunciJoker) {
          this.kunciTimer = kunciJoker;
          this.batasWaktu = sekarang + lamaJoker;
        }
        this.timerGiliran = this.pasangTimer(Math.max(0, this.batasWaktu! - sekarang), 'batas waktu pengumuman joker', () => {
          // Popupnya sudah tampil sampai batas waktu: dianggap sudah melihat, tidak ditanya lagi.
          this.d.sudahLihatJoker = [...new Set([...this.d.sudahLihatJoker, ...this.d.menungguJoker])].sort((a, b) => a - b);
          this.d.menungguJoker = [];
          this.jokerSambung = false;
          this.berubah();
        });
      } else this.batasWaktu = null;
      return;
    }
    this.jokerSambung = false;

    // Susun akhir: semua yang belum selesai menyusun bersamaan; bot (dan manusia yang terputus
    // atau kehabisan waktu) dijalankan satu per satu, manusia lain diberi batas waktu bersama.
    // Manusia yang baru terputus diberi masa tenggang dulu (giliran tetap miliknya kalau ia kembali);
    // batas waktu giliran tetap berlaku, mana yang lebih dulu habis.
    const menunggu =
      g.status === 'susunAkhir'
        ? g.putaran!.selesaiSusun.map((x, i) => (x ? -1 : i)).filter((i) => i >= 0)
        : [g.putaran!.giliran];
    const tenggang = Math.max(0, this.opsi.tenggangSambungMs ?? TENGGANG_SAMBUNG_MS);
    let akhirTenggang = Infinity;
    const olehBot = menunggu.filter((i) => {
      const k = this.d.kursi[i];
      if (k.jenis !== 'manusia' || this.ambilAlih === kunci) return true;
      if (k.terhubung) return false;
      const akhir = (this.putusSejak.get(i) ?? -Infinity) + tenggang;
      if (akhir <= sekarang) return true;
      akhirTenggang = Math.min(akhirTenggang, akhir);
      return false;
    });
    if (akhirTenggang !== Infinity) {
      this.timerTenggang = this.pasangTimer(akhirTenggang - sekarang, 'masa tenggang sambung ulang', () => {
        this.timerTenggang = null;
        if (this.kunciGiliran() === kunci) this.berubah();
      });
    }
    if (olehBot.length) {
      const awalGiliran = this.kunciLangkahBot !== kunci;
      const [min, maks] = JEDA_BOT[this.d.pengaturan.tempoBot ?? 'santai'][awalGiliran ? 'mikir' : 'lanjut'];
      // Langkah sebelumnya di giliran ini gagal total: coba lagi dengan jeda yang makin panjang.
      const gagal = this.galatBot?.kunci === kunci ? this.galatBot.kali : 0;
      const jeda = gagal ? jedaUlangGalat(gagal) : (this.opsi.jedaBotMs ?? Math.round(min + Math.random() * (maks - min)));
      if (awalGiliran) this.botMikir = olehBot[0];
      this.timerBot = this.pasangTimer(jeda, 'langkah warga kedai', () => {
        this.kunciLangkahBot = kunci;
        this.botMikir = null;
        this.langkahBot(olehBot[0], kunci);
      });
      if (olehBot.length === menunggu.length) return;
    }
    const detik = this.d.pengaturan.detikGiliran;
    if (detik <= 0) {
      this.batasWaktu = null;
      return;
    }
    if (this.kunciTimer !== kunci) {
      this.kunciTimer = kunci;
      this.batasWaktu = this.penjadwal.sekarang() + detik * 1000;
    }
    const sisa = Math.max(0, this.batasWaktu! - this.penjadwal.sekarang());
    this.timerGiliran = this.pasangTimer(sisa, 'batas waktu giliran', () => {
      if (this.kunciGiliran() !== kunci) return;
      this.ambilAlih = kunci;
      this.berubah();
    });
  }

  /**
   * Satu aksi warga kedai untuk kursi `giliran`. Galat di sini tidak boleh membuat meja macet
   * (keputusan pemilik #38), jadi ada cadangan berlapis, semuanya aksi sah yang tetap divalidasi
   * mesin: strategi sesuai level kursi, lalu strategi mudah, lalu aksiAman(). Kalau semuanya galat,
   * giliran ini dicoba lagi nanti dengan jeda yang makin panjang; selama itu meja tetap melayani
   * pemain (emote, keluar, sambung ulang, aksi manusia yang sah).
   */
  private langkahBot(giliran: number, kunci: string): void {
    this.timerBot = null;
    const g = this.d.game;
    if (!g || !g.putaran) return;
    if (g.status === 'putaranBerjalan' ? g.putaran.giliran !== giliran : g.status !== 'susunAkhir') return;
    const k = this.d.kursi[giliran];
    // Manusia yang terputus atau kehabisan waktu dimainkan level normal tanpa gaya.
    const level: LevelBot = k.jenis === 'bot' ? k.level : 'normal';
    // Gaya persona (keputusan #47) hanya untuk strategi level kursi; cadangan mudah/aman tanpa gaya.
    const gaya = gayaKursi(k);
    // Dikosongkan dulu supaya jadwal sesudah aksi yang berhasil kembali ke jeda biasa.
    const gagalSebelumnya = this.galatBot?.kunci === kunci ? this.galatBot.kali : 0;
    this.galatBot = null;
    // Satu rng bersama untuk semua kursi warga kedai di meja ini (rngBot). Gaya standar memakai rng
    // persis seperti sebelum ada gaya; gaya lain bisa memakai rng lebih banyak (pilihDekat, tunda
    // mentung), jadi urutan acak kursi lain di meja yang sama ikut bergeser.
    const rng = new Rng(this.d.rngBot);
    let view: ViewPemain | null = null;
    for (const cara of [level, 'mudah', 'aman'] as const) {
      let aksi: Aksi | null = null;
      try {
        view ??= viewUntuk(g, giliran);
        aksi = cara === 'aman' ? aksiAman(view) : pilihAksiBot(view, cara, rng, cara === level ? gaya : 'standar');
        this.d.rngBot = rng.state;
        this.terapkan(g, aksi);
        return;
      } catch (e) {
        if (this.d.game !== g) {
          // Aksinya sudah diterapkan, yang galat sesudahnya (menyiarkan/menyimpan). Jangan disusul
          // aksi lain; cukup pastikan jadwal meja tetap tersusun.
          this.catatGalat(`sesudah langkah warga kedai kursi ${giliran}`, e);
          this.pulihkanJadwal();
          return;
        }
        this.catatGalat(`langkah warga kedai kursi ${giliran} (${cara})${aksi ? ` ditolak: ${JSON.stringify(aksi)}` : ''}`, e);
      }
    }
    // Semua cara galat: coba lagi nanti, jedanya makin panjang tiap gagal lagi di giliran yang sama.
    this.galatBot = { kunci, kali: gagalSebelumnya + 1 };
    this.pulihkanJadwal();
  }

  private perbaruiHost(): void {
    const h = this.d.kursi[this.d.host];
    if (h?.jenis === 'manusia' && h.terhubung) return;
    const baru = this.d.kursi.findIndex((k) => k.jenis === 'manusia' && k.terhubung);
    if (baru >= 0) this.d.host = baru;
  }

  /** Setelah setiap perubahan: atur timer, kirim info ke semua, beri tahu penyimpan. */
  private berubah(): void {
    this.jadwalkan();
    this.siarkan();
    this.opsi.saatBerubah?.(this.d);
  }

  private siarkan(): void {
    const batasLog = this.opsi.batasLog ?? 150;
    this.d.kursi.forEach((k, i) => {
      if (k.jenis !== 'manusia' || !k.pemainId || !k.terhubung) return;
      this.kirimKe(k.pemainId, { t: 'meja', info: this.info(i) });
      if (this.d.game) {
        const view = viewUntuk(this.d.game, i);
        view.log = view.log.slice(-batasLog);
        this.kirimKe(k.pemainId, { t: 'view', view });
      }
    });
  }

  info(kursiSaya: number | null): InfoMeja {
    return {
      kode: this.d.kode,
      status: this.status,
      pengaturan: { ...this.d.pengaturan },
      kursi: this.d.kursi.map((k) => ({ jenis: k.jenis, nama: k.nama, terhubung: k.terhubung, level: k.level })),
      host: this.d.host,
      kursiSaya,
      setujuAkhiri: [...this.d.setujuAkhiri],
      // Hanya di meja mode kaldu, supaya info meja biasa (dan golden) tidak berubah.
      ...(this.d.pengaturan.modeKaldu === true ? { setujuKaldu: [...(this.d.setujuKaldu ?? [])] } : {}),
      batasWaktu: this.batasWaktu,
      diambilAlihBot: this.ambilAlih !== null && this.ambilAlih === this.kunciGiliran(),
      menungguJoker: [...this.d.menungguJoker],
      botMikir: this.botMikir,
      ...(this.d.kompetisi ? { kompetisi: { kode: this.d.kompetisi.kode, nama: this.d.kompetisi.nama } } : {}),
    };
  }

  private kirimKe(pemainId: string, pesan: PesanServer): void {
    this.opsi.kirim(pemainId, pesan);
  }

  private kursiDari(pemainId: string): number | null {
    const i = this.d.kursi.findIndex((k) => k.pemainId === pemainId);
    return i < 0 ? null : i;
  }
}

/** Kursi yang ditandai keluar kembali biasa (permainan baru, atau main lagi). */
function hapusTandaKeluar(kursi: Kursi[]): void {
  for (const k of kursi) {
    delete k.keluar;
    delete k.keluarSesudahPutaran;
  }
}

/**
 * Klasemen akhir dari state permainan yang sudah selesai. Peringkat di sini murni dari skor akhir
 * (skor sama = peringkat sama); aturan juru kunci untuk yang keluar diterapkan saat peringkat online
 * dihitung (`nilaiEfektif`, peringkat.ts), jadi klasemen yang tampil di meja tetap apa adanya.
 * Pemain yang keluar di tengah permainan ditulis `bot: false, keluar: true`, dan mentung/kepentung-nya
 * hanya dari putaran sebelum ia keluar (sesudahnya yang main warga kedai). Skornya tetap skor kursi.
 */
export function buatRingkasanAkhir(
  kode: string,
  kursi: Kursi[],
  game: GameState,
  selesaiPada: number,
  kompetisi?: string,
): RingkasanAkhir {
  const pemain: RingkasanAkhir['pemain'] = game.pemain
    .map((p, i) => {
      const keluar = !!kursi[i]?.keluar;
      const dimainkan = keluar ? game.riwayat.slice(0, kursi[i].keluarSesudahPutaran ?? game.riwayat.length) : game.riwayat;
      return {
        kursi: i,
        nama: p.nama,
        bot: kursi[i]?.jenis !== 'manusia' && !keluar,
        ...(keluar ? { keluar: true as const } : {}),
        skor: game.skor[i],
        peringkat: 0,
        mentung: dimainkan.filter((h) => h.pementung === i).length,
        kepentung: dimainkan.filter((h) => h.kepentung.includes(i)).length,
        ...(kompetisi !== undefined && kursi[i]?.peserta !== undefined ? { peserta: kursi[i].peserta } : {}),
      };
    })
    .sort((a, b) => b.skor - a.skor || a.kursi - b.kursi);
  pemain.forEach((p, j) => (p.peringkat = j > 0 && p.skor === pemain[j - 1].skor ? pemain[j - 1].peringkat : j + 1));
  return {
    kode,
    selesaiPada,
    alasan: game.alasanSelesai,
    jumlahPutaran: game.riwayat.length,
    jumlahDeck: aturanPembagian(game.pemain.length, game.konfigurasi.duaDeckUntukEmpat).jumlahDeck,
    modeKaldu: game.konfigurasi.modeKaldu === true,
    ...(kompetisi !== undefined ? { kompetisi } : {}),
    pemain,
  };
}

/**
 * Cadangan terakhir kalau strategi warga kedai galat: aksi sah paling sederhana, dipilih dari view
 * dengan validator engine yang sama (tidak ada aturan baru). Tahap ambil = ambil dari deck, tahap
 * main = buang kartu pertama yang sah (joker hidup paling akhir, supaya tidak kena −25 kalau masih
 * ada pilihan lain), susun akhir = Selesai. Melempar kalau tidak ada aksi aman.
 */
function aksiAman(view: ViewPemain): Aksi {
  const p = view.putaran;
  const saya = view.saya;
  if (p && saya !== null) {
    if (view.status === 'susunAkhir' && !p.selesaiSusun[saya]) return { jenis: 'selesaiSusun', pemain: saya };
    if (view.status === 'putaranBerjalan' && p.giliran === saya) {
      if (p.tahap === 'ambil' && p.jumlahDeck > 0) return { jenis: 'ambilDeck', pemain: saya };
      const tangan = p.tangan[saya];
      const sumberAmbil = p.sumberAmbil;
      if (p.tahap === 'main' && tangan && sumberAmbil) {
        const ctx = { rankJoker: p.rankJoker, jokerMati: p.jokerMati };
        const sah = tangan.filter((kartu) => {
          try {
            validasiBuang({
              tangan,
              punyaKartuJadi: p.kartuJadi[saya].length > 0,
              sumberAmbil,
              kartuId: kartu.id,
              pungutan: p.pungutan,
              ctx,
              asJokerBolehDibuangTanpaJadi: view.konfigurasi.asJokerBolehDibuangTanpaJadi,
            });
            return true;
          } catch (e) {
            if (e instanceof AturanError) return false;
            throw e;
          }
        });
        const kartu = sah.find((x) => !isJokerHidup(x, ctx)) ?? sah[0];
        if (kartu) return { jenis: 'buang', pemain: saya, kartuId: kartu.id };
      }
    }
  }
  throw new Error('Tidak ada aksi aman untuk warga kedai ini.');
}

function kursiKosong(level: LevelBot): Kursi {
  return { jenis: 'kosong', nama: '', pemainId: null, terhubung: false, level };
}

/**
 * Nama lawan otomatis bawaan. Sepuluh pertama "Warga Madya" (sapaan + benda/suasana Kedai Madya); sisanya
 * nama pilihan pemilik (14 Okt 2026, "Mas Sampul" di daftar itu sudah ada di atas). Nama baru ditambahkan di
 * belakang: golden meja dan latihan memakai nama-nama terdepan sesuai urutan. Semua ≤ 10 huruf (muat di
 * panel HP 360 dengan teks besar) dan unik tanpa beda huruf besar/kecil. Label sempit di buangan dibedakan
 * di client (`labelSempit`, tataMeja.ts) terhadap nama lain di meja, termasuk nama satu kata (Jurik, Juragan).
 * Nama tidak pernah bergantung pada level, kartu, giliran, atau peristiwa.
 */
export const NAMA_LAWAN_BAWAAN: readonly string[] = [
  'Kipas Dua',
  'Cak Kopag',
  'Mbak Teras',
  'Mas Sampul',
  'Si Rak',
  'Pak Seng',
  'Dik Toska',
  'Ning Sore',
  'Om Garpu',
  'Bu Sendok',
  'Cak Owner',
  'Penampil',
  'Koki-Kun',
  'Bang IT',
  'Bos Bocil',
  'Jurik',
  'Bajigur',
  'Pak Tani',
  'Juragan',
  'Ning Kukis',
  'Mbak Mata',
  'Om Napi',
];

/** Daftar nama lawan bawaan dengan urutan acak (Fisher–Yates). Sumber acak bisa diganti di test. */
export function namaLawanAcak(acak: () => number = Math.random): string[] {
  const xs = [...NAMA_LAWAN_BAWAAN];
  for (let i = xs.length - 1; i > 0; i--) {
    const j = Math.floor(acak() * (i + 1)) % (i + 1);
    [xs[i], xs[j]] = [xs[j], xs[i]];
  }
  return xs;
}

/**
 * Nama untuk warga kedai di kursi i: nama pertama dari daftar yang belum dipakai kursi lain (manusia
 * maupun warga kedai, tanpa beda huruf besar/kecil). Habis: "Warga 1", "Warga 2", ...
 */
function namaBot(kursi: Kursi[], i: number, daftar: readonly string[] = NAMA_LAWAN_BAWAAN): string {
  const dipakai = new Set(kursi.filter((k, j) => j !== i && k.jenis !== 'kosong').map((k) => kunciNama(k.nama)));
  for (const calon of daftar.length ? daftar : NAMA_LAWAN_BAWAAN) {
    if (typeof calon !== 'string' || !calon.trim()) continue;
    const nama = rapikanNama(calon);
    if (!dipakai.has(kunciNama(nama))) return nama;
  }
  for (let n = 1; ; n++) if (!dipakai.has(kunciNama(`Warga ${n}`))) return `Warga ${n}`;
}

function acak(): number {
  return Math.floor(Math.random() * 0x7fffffff);
}
