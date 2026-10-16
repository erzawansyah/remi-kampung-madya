// Pembaruan otomatis PWA: versi baru dipasang sendiri di momen yang aman, tanpa pemain harus menekan apa pun.
//
// Service worker tetap `registerType: 'prompt'` (vite.config.ts): SW baru MENUNGGU sampai kita yang
// menyuruhnya aktif. Modul ini yang memutuskan kapan:
// - Momen "bebas" (beranda, tidak ada dialog/isian/tunggu server): tab terlihat + pemain diam sebentar
//   → toast singkat "Pakai versi terbaru…" lalu muat ulang. Tab tersembunyi → langsung dipasang diam-diam.
// - Momen "senyap" (lobi online, daftar meja, riwayat, jeda antarputaran online): hanya dipasang saat
//   tab tersembunyi; selama terlihat cukup ditawarkan (toast + tombol Muat ulang).
// - Momen "tidak" (putaran berjalan, susun akhir, animasi/antrian meja, popup joker, panel mentung,
//   klasemen akhir yang sedang tampil, meja offline yang belum selesai, dialog terbuka, sedang mengetik,
//   menunggu jawaban server): ditunda. Meja dinilai dari yang TAMPIL di layar, bukan view terbaru server.
// Anti-loop: muat ulang otomatis dicatat di sessionStorage per build yang sedang jalan, paling banyak
// MAKS_MUAT_ULANG_OTOMATIS kali. Kalau tetap di build yang sama, sisanya hanya tawaran manual.
//
// Fungsi keputusan (momenPembaruan, putuskanPembaruan, serverBeda, percobaan) murni dan diuji di
// apps/client/test/pembaruan.test.ts; kelas PengelolaPembaruan merangkainya dengan timer dan toast.

import type { StatusKoneksi } from './koneksi';

export type LayarPembaruan = 'beranda' | 'publik' | 'riwayat' | 'lobi' | 'meja';

/** Seberapa aman memuat ulang halaman sekarang. */
export type MomenPembaruan = 'bebas' | 'senyap' | 'tidak';

export interface KeadaanPembaruan {
  layar: LayarPembaruan;
  /** Jenis koneksi meja/lobi saat ini (null kalau tidak ada). */
  jenis: 'online' | 'offline' | null;
  /**
   * Status permainan yang sedang TAMPIL di meja (view yang sudah dipasang KontrolMeja), bukan view
   * terbaru dari server yang mungkin masih antre di belakang animasi. Null kalau belum ada.
   */
  statusMeja: string | null;
  /** Layar meja sudah tampil penuh (bukan pemuat "Nyiapin meja…" atau galat meja). */
  mejaSiap: boolean;
  /**
   * Meja sedang memutar kejadian atau menahan antrian: animasi, view yang masih antre, panel mentung,
   * popup joker (atau popup joker yang masih menunggu dibuka).
   */
  mejaSibuk: boolean;
  /** Klasemen akhir sedang tampil (ditutup lewat "Main lagi" atau "Ke beranda"). */
  klasemenTampil: boolean;
  /** Klasemen akhir sudah tercatat di riwayat HP (atau latihan, yang memang tidak dicatat). */
  selesaiTercatat: boolean;
  /** Dialog di atas layar (Pengaturan, Bantuan, Tentang, konfirmasi) sedang dibuka pemain. */
  dialogTerbuka: boolean;
  /** Modal utama terbuka (di meja: popup joker, panel mentung, hasil, menu). */
  modalTerbuka: boolean;
  /** Ada isian teks yang sedang diketik atau belum dipakai (mis. kode meja). */
  sedangMengetik: boolean;
  /** Menunggu jawaban server (Buat meja, Gabung, menyambung lagi ke meja terakhir). */
  menungguServer: boolean;
}

export function momenPembaruan(k: KeadaanPembaruan): MomenPembaruan {
  if (k.dialogTerbuka || k.sedangMengetik || k.menungguServer) return 'tidak';
  switch (k.layar) {
    case 'beranda':
      return k.modalTerbuka ? 'tidak' : 'bebas';
    case 'publik':
    case 'riwayat':
      return k.modalTerbuka ? 'tidak' : 'senyap';
    case 'lobi':
      // Sesi online tersambung lagi sendiri sesudah dimuat ulang.
      return k.jenis === 'online' ? 'senyap' : 'tidak';
    case 'meja':
      if (!k.mejaSiap || k.mejaSibuk) return 'tidak';
      // Klasemen akhir yang sedang dibaca tidak boleh hilang: tunggu pemain menutupnya/ke beranda.
      if (k.klasemenTampil) return 'tidak';
      if (k.statusMeja === 'selesai') return k.selesaiTercatat ? 'senyap' : 'tidak';
      // Jeda antarputaran: online aman (meja tetap di server); offline belum selesai, jadi tidak pernah.
      if (k.statusMeja === 'putaranSelesai' && k.jenis === 'online') return 'senyap';
      return 'tidak';
  }
}

/** Jenis <input> yang bukan isian ketik (diketuk saja), jadi fokus di situ bukan "sedang mengetik". */
const INPUT_BUKAN_KETIK = ['button', 'checkbox', 'radio', 'range', 'submit', 'reset', 'color', 'file'];

/**
 * Isian teks sedang difokus, atau kode meja sudah diketik tapi belum dipakai: jangan muat ulang.
 * Isian angka (batas skor di Atur meja dan lobi, `type="number"`) ikut dihitung isian ketik.
 */
export function adaIsianAktif(doc: Document = document): boolean {
  const a = doc.activeElement;
  if (a instanceof HTMLTextAreaElement || (a instanceof HTMLElement && a.isContentEditable)) return true;
  if (a instanceof HTMLInputElement && !INPUT_BUKAN_KETIK.includes(a.type)) return true;
  const kode = doc.getElementById('kode');
  return kode instanceof HTMLInputElement && kode.value.trim() !== '' && kode.value !== kode.defaultValue;
}

/** Pemain dianggap diam (tidak sedang mengetuk apa pun) setelah sekian ms tanpa input. */
export const DIAM_MS = 5000;
/** Batas muat ulang otomatis per build yang sedang jalan (anti-loop). */
export const MAKS_MUAT_ULANG_OTOMATIS = 2;

export interface KondisiPasang {
  tersembunyi: boolean;
  /** Lama pemain tidak menyentuh layar/keyboard (ms). */
  diamMs: number;
  /** Berapa kali build ini sudah mencoba muat ulang otomatis. */
  percobaan: number;
}

/**
 * - 'pasang-diam': pasang sekarang tanpa toast (tab tersembunyi).
 * - 'pasang-toast': toast singkat lalu pasang (tab terlihat, momen bebas, pemain diam).
 * - 'tawarkan': jangan otomatis; cukup tawarkan tombol Muat ulang (momen senyap, atau jatah habis).
 * - 'tunda': belum apa-apa, nilai lagi nanti.
 */
export type KeputusanPembaruan = 'pasang-diam' | 'pasang-toast' | 'tawarkan' | 'tunda';

export function putuskanPembaruan(momen: MomenPembaruan, k: KondisiPasang): KeputusanPembaruan {
  if (momen === 'tidak') return 'tunda';
  if (k.percobaan >= MAKS_MUAT_ULANG_OTOMATIS) return 'tawarkan';
  if (k.tersembunyi) return 'pasang-diam';
  if (momen === 'senyap') return 'tawarkan';
  return k.diamMs >= DIAM_MS ? 'pasang-toast' : 'tunda';
}

export interface InfoBuild {
  versi: string;
  sha: string;
  /** Waktu build: pembeda build yang paling tepat (dua build dari commit sama tetap beda). */
  waktu: string;
  label: string;
}

/**
 * Identitas build yang bisa dibandingkan (scripts/idBuild.mjs): commit git (hex) atau hash isi sumber
 * ("h-" + hex, build tanpa GIT_SHA dan tanpa .git). 'dev' (dev server) dan kosong tidak.
 */
const shaDikenal = (s: unknown): s is string => typeof s === 'string' && /^(?:h-)?[0-9a-f]{7,40}$/i.test(s);

/**
 * Jawaban /healthz menunjukkan server memakai build lain dari client ini. Hanya kalau sha keduanya
 * dikenal (bukan 'dev'/kosong); sha pendek dibandingkan sepanjang yang lebih pendek. Commit dan hash
 * isi tidak pernah sama (commit tidak diawali "h-"), jadi build dengan GIT_SHA vs tanpa = beda.
 */
export function serverBeda(klien: Pick<InfoBuild, 'sha'>, healthz: unknown): boolean {
  if (!healthz || typeof healthz !== 'object') return false;
  const sha = (healthz as { sha?: unknown }).sha;
  if (!shaDikenal(klien.sha) || !shaDikenal(sha)) return false;
  const n = Math.min(klien.sha.length, sha.length);
  return klien.sha.slice(0, n).toLowerCase() !== sha.slice(0, n).toLowerCase();
}

export type PenyimpananSesi = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

const KUNCI_PERCOBAAN = 'remi.pembaruanOtomatis';
const KUNCI_DARI = 'remi.pembaruanDari';

const kunciBuild = (b: InfoBuild) => `${b.versi}|${b.sha}|${b.waktu}`;

/** Berapa kali build ini sudah memuat ulang otomatis di tab ini. Data rusak/tidak ada = 0. */
export function bacaPercobaan(s: PenyimpananSesi | null, b: InfoBuild): number {
  try {
    const d = JSON.parse(s?.getItem(KUNCI_PERCOBAAN) ?? 'null') as { build?: unknown; n?: unknown } | null;
    return d && d.build === kunciBuild(b) && typeof d.n === 'number' && d.n >= 0 ? d.n : 0;
  } catch {
    return 0;
  }
}

export function catatPercobaan(s: PenyimpananSesi | null, b: InfoBuild): void {
  try {
    s?.setItem(KUNCI_PERCOBAAN, JSON.stringify({ build: kunciBuild(b), n: bacaPercobaan(s, b) + 1 }));
    s?.setItem(KUNCI_DARI, b.label);
  } catch {
    // sessionStorage tidak tersedia: anti-loop tetap jalan selama halaman ini hidup (lihat `sudahMencoba`).
  }
}

/**
 * Dipanggil sekali saat aplikasi mulai. Kalau halaman ini hasil muat ulang pembaruan dan build-nya
 * memang berganti, kembalikan pesan untuk pemain; kalau build masih sama (pembaruan gagal), null.
 */
export function pesanSesudahPembaruan(s: PenyimpananSesi | null, b: InfoBuild): string | null {
  try {
    const dari = s?.getItem(KUNCI_DARI);
    if (dari == null) return null;
    s?.removeItem(KUNCI_DARI);
    return dari !== b.label ? `Sudah pakai versi terbaru, ${b.label}.` : null;
  } catch {
    return null;
  }
}

export const TEKS_PASANG = 'Pakai versi terbaru, sebentar ya…';
export const TEKS_TAWARAN = 'Ada versi baru, Bos.';
/** Jeda antara toast "Pakai versi terbaru…" dan muat ulang; disentuh pemain = batal. */
export const JEDA_TOAST_MS = 2200;
/** Selama ada versi yang menunggu, keadaan dinilai ulang berkala (cadangan pemicu event). */
export const NILAI_ULANG_MS = 4000;
/** Kalau SW baru tidak mengambil alih (pesan skipWaiting hilang), muat ulang manual. */
export const CADANGAN_MUAT_ULANG_MS = 4000;

export interface DepsPembaruan {
  build: InfoBuild;
  keadaan(): KeadaanPembaruan;
  tersembunyi(): boolean;
  /** Suruh SW yang menunggu aktif (updateSW(true)); halaman dimuat ulang saat SW baru mengambil alih. */
  aktifkanSW(): void;
  muatUlang(): void;
  toast(pesan: string, aksi?: { label: string; jalankan: () => void }): void;
  /** Tombol "Muat ulang" yang menetap (kaki beranda) berubah: fungsi, atau null kalau tidak ada versi baru. */
  saatTombolBerubah(muatUlang: (() => void) | null): void;
  penyimpanan: PenyimpananSesi | null;
  sekarang?(): number;
}

/**
 * - 'tidak': tidak ada versi baru.
 * - 'menunggu': SW baru terpasang dan menunggu diaktifkan (onNeedRefresh).
 * - 'aktif': SW baru sudah mengambil alih (mis. dari tab lain), halaman ini tinggal dimuat ulang.
 */
type Siap = 'tidak' | 'menunggu' | 'aktif';

export class PengelolaPembaruan {
  private siap: Siap = 'tidak';
  private memasang = false;
  private ditawarkan = false;
  private terakhirInteraksi: number;
  private timerNilai: ReturnType<typeof setInterval> | null = null;
  private timerToast: ReturnType<typeof setTimeout> | null = null;
  /** Cadangan anti-loop bila sessionStorage tidak bisa ditulis. */
  private sudahMencoba = 0;

  constructor(private readonly d: DepsPembaruan) {
    this.terakhirInteraksi = this.kini();
  }

  private kini() {
    return this.d.sekarang?.() ?? Date.now();
  }

  /** Ada versi baru yang menunggu. */
  get adaVersiBaru(): boolean {
    return this.siap !== 'tidak';
  }

  /** Untuk tombol "Muat ulang" (kaki beranda, toast): fungsi, atau null kalau tidak ada versi baru. */
  tombol(): (() => void) | null {
    return this.siap === 'tidak' ? null : () => this.pasang(true);
  }

  /** onNeedRefresh: SW baru terpasang dan menunggu. */
  versiBaruSiap() {
    if (this.siap === 'tidak') this.siap = 'menunggu';
    this.d.saatTombolBerubah(this.tombol());
    this.nilai();
  }

  /**
   * onNeedReload: SW baru sudah mengambil alih halaman ini. Kalau kita yang memintanya, muat ulang
   * sekarang. Kalau bukan (tab lain yang memasang), jangan memotong permainan: tunggu momen aman.
   */
  swMengambilAlih() {
    if (this.memasang) return this.d.muatUlang();
    this.siap = 'aktif';
    this.d.saatTombolBerubah(this.tombol());
    this.nilai();
  }

  /**
   * Server sudah build lain, tapi tidak ada service worker yang bisa diperbarui (browser tanpa SW):
   * cukup muat ulang biasa di momen aman supaya halaman terbaru diambil dari server.
   */
  perluMuatUlangBiasa() {
    if (this.siap !== 'tidak') return;
    this.siap = 'aktif';
    this.d.saatTombolBerubah(this.tombol());
    this.nilai();
  }

  /**
   * Pemain menyentuh layar/keyboard: batalkan toast "Pakai versi terbaru…" yang sedang menghitung mundur
   * (dicoba lagi setelah pemain diam). True kalau ada yang dibatalkan, supaya toast-nya ikut dihapus.
   */
  catatInteraksi(): boolean {
    this.terakhirInteraksi = this.kini();
    if (!this.timerToast) return false;
    clearTimeout(this.timerToast);
    this.timerToast = null;
    return true;
  }

  private percobaan() {
    return Math.max(bacaPercobaan(this.d.penyimpanan, this.d.build), this.sudahMencoba);
  }

  /** Nilai keadaan sekarang dan bertindak. Aman dipanggil sesering apa pun. */
  nilai() {
    if (this.siap === 'tidak' || this.memasang) return this.hentikanNilaiUlang();
    this.mulaiNilaiUlang();
    const momen = momenPembaruan(this.d.keadaan());
    const keputusan = putuskanPembaruan(momen, {
      tersembunyi: this.d.tersembunyi(),
      diamMs: this.kini() - this.terakhirInteraksi,
      percobaan: this.percobaan(),
    });
    if (keputusan !== 'pasang-toast' && this.timerToast && momen !== 'bebas') {
      clearTimeout(this.timerToast);
      this.timerToast = null;
    }
    switch (keputusan) {
      case 'pasang-diam':
        return this.pasang(false);
      case 'pasang-toast':
        if (this.timerToast) return;
        this.d.toast(TEKS_PASANG);
        this.timerToast = setTimeout(() => {
          this.timerToast = null;
          // Dinilai sekali lagi: pemain bisa saja membuka dialog atau pindah layar selama toast tampil.
          const lagi = momenPembaruan(this.d.keadaan());
          if (lagi === 'bebas' || (lagi === 'senyap' && this.d.tersembunyi())) this.pasang(false);
        }, JEDA_TOAST_MS);
        return;
      case 'tawarkan':
        if (this.ditawarkan || this.d.tersembunyi()) return;
        this.ditawarkan = true;
        this.d.toast(TEKS_TAWARAN, { label: 'Muat ulang', jalankan: () => this.pasang(true) });
        return;
      case 'tunda':
        return;
    }
  }

  /** Pasang versi baru. `manual`: dari tombol pemain (tidak dibatasi jatah anti-loop). */
  private pasang(manual: boolean) {
    if (this.siap === 'tidak' || this.memasang) return;
    if (!manual && this.percobaan() >= MAKS_MUAT_ULANG_OTOMATIS) return;
    this.memasang = true;
    this.hentikanNilaiUlang();
    if (this.timerToast) clearTimeout(this.timerToast);
    this.timerToast = null;
    this.sudahMencoba = this.percobaan() + 1;
    catatPercobaan(this.d.penyimpanan, this.d.build);
    if (this.siap === 'aktif') return this.d.muatUlang();
    this.d.aktifkanSW();
    setTimeout(() => this.d.muatUlang(), CADANGAN_MUAT_ULANG_MS);
  }

  private mulaiNilaiUlang() {
    if (!this.timerNilai) this.timerNilai = setInterval(() => this.nilai(), NILAI_ULANG_MS);
  }

  private hentikanNilaiUlang() {
    if (this.timerNilai) clearInterval(this.timerNilai);
    this.timerNilai = null;
  }
}

// ---------------------------------------------------------------------------------------------
// Jembatan transisi dari 0.1.x (lihat public/sw-transisi.js)

/** Sapaan SW baru yang sedang dipasang ke tiap jendela. */
export const SAPA_SW = 'REMI_SAPA';
/** Jawaban halaman 0.2+: "aku bisa memilih momen aman sendiri, jangan langsung aktif". */
export const JAWAB_SW = 'REMI_JAWAB';

export interface WadahPesanSW {
  addEventListener(jenis: 'message', f: (e: MessageEvent) => void): void;
  startMessages?(): void;
}

/**
 * Jawab sapaan SW baru. Dipasang di navigator.serviceWorker (bukan hanya controller), jadi tetap menjawab
 * walau halaman ini masih dikendalikan SW 0.1 atau belum dikendalikan sama sekali. Halaman yang tidak
 * menjawab dianggap versi lama, dan SW baru langsung aktif lalu memuat ulang halaman itu.
 * Dipanggil sedini mungkin di main.ts. False kalau browser tidak punya service worker.
 */
export function pasangPenjawabSapa(wadah: WadahPesanSW | null | undefined, versi: string): boolean {
  if (!wadah) return false;
  wadah.addEventListener('message', (e) => {
    const d: unknown = e.data;
    if (!d || typeof d !== 'object' || (d as { t?: unknown }).t !== SAPA_SW) return;
    const jawab = { t: JAWAB_SW, versi };
    try {
      const port = e.ports?.[0];
      if (port) port.postMessage(jawab);
      else (e.source as { postMessage?(x: unknown): void } | null)?.postMessage?.(jawab);
    } catch {
      // SW-nya sudah hilang (mis. pemasangan dibatalkan): tidak ada yang perlu dijawab.
    }
  });
  // Pesan SW biasanya ditahan sampai DOMContentLoaded; mulai sekarang supaya jawaban tidak terlambat.
  try {
    wadah.startMessages?.();
  } catch {
    // abaikan
  }
  return true;
}

/** Jeda minimum antar-cek SW yang dipicu tab kembali terlihat / sinyal kembali. */
export const JEDA_CEK_MIN_MS = 60 * 1000;
/** Cek berkala selama aplikasi terbuka. */
export const CEK_BERKALA_MS = 30 * 60 * 1000;

/** Perlu cek sekarang? Dipaksa (mis. server beda versi) selalu boleh. */
export function bolehCek(terakhir: number | null, sekarang: number, paksa = false): boolean {
  return paksa || terakhir === null || sekarang - terakhir >= JEDA_CEK_MIN_MS;
}

/**
 * Cek /healthz yang dipicu status koneksi online (satu objek per koneksi). Setiap sambungan yang
 * berhasil = cek paksa (tanpa JEDA_CEK_MIN_MS), termasuk sambungan pertama: deploy bisa selesai
 * kurang dari semenit sesudah cek saat start, dan tanpa paksa client lama bisa main di server baru
 * sampai mejanya selesai. KoneksiOnline hanya melapor 'tersambung' dari onopen, jadi yang dipaksa
 * memang hanya sambungan yang benar-benar terbuka.
 * 'tersambung' berulang tanpa putus di antaranya (tidak terjadi di KoneksiOnline, tapi aman kalau
 * pemanggil melapor ulang) = cek biasa. Status persis sebelumnya tidak bisa dipakai penanda putus,
 * karena KoneksiOnline selalu melapor 'menyambung' tepat sebelum 'tersambung', juga saat sambung ulang.
 */
export class PemicuCekServer {
  /** Belum ada cek paksa sejak sambungan terakhir terbuka (awal koneksi, atau sesudah putus/gagal). */
  private perluPaksa = true;

  /** Status koneksi berubah. Null = tidak perlu cek; false = cek biasa; true = cek paksa. */
  status(s: StatusKoneksi): boolean | null {
    if (s === 'terputus' || s === 'gagal') this.perluPaksa = true;
    if (s !== 'tersambung') return null;
    const paksa = this.perluPaksa;
    this.perluPaksa = false;
    return paksa;
  }
}
