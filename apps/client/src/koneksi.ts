// Dua jenis koneksi dengan antarmuka sama:
// - online: WebSocket ke server, sambung ulang otomatis pakai token.
// - offline: meja dijalankan langsung di browser melawan warga kedai (bot), disimpan di localStorage.

import { Meja, NAMA_LAWAN_BAWAAN, namaLawanAcak, type AksiKlien, type PengaturanMeja, type PesanKlien, type PesanServer } from '@remi/meja';
import { simpan, type SesiOnline } from './penyimpanan';

/**
 * - `menyambung`: sedang membuka sambungan.
 * - `tersambung`: sambungan terbuka.
 * - `terputus`: sambungan yang tadinya jalan putus; sambung ulang dijadwalkan.
 * - `gagal`: belum pernah tersambung sama sekali dan sudah gagal beberapa kali berturut-turut
 *   (server mati/tidak terjangkau). Tetap dicoba lagi di belakang layar.
 */
export type StatusKoneksi = 'menyambung' | 'tersambung' | 'terputus' | 'gagal';

/** Kabar koneksi yang layak disampaikan ke pemain (toast, pembaca layar). */
export type Kabar = 'putus' | 'gagal' | 'pulih';

/**
 * Menentukan kapan pemain perlu dikabari soal koneksi (satu objek per koneksi). Murni, tanpa DOM.
 * - `terputus` → 'putus' sekali; putus berikutnya sebelum tersambung lagi diam.
 * - `gagal` → 'gagal' sekali (boleh menyusul 'putus', karena kabarnya lebih buruk).
 * - `tersambung` → 'pulih' kalau sejak tersambung terakhir sudah ada kabar putus/gagal; kalau tidak, diam.
 * - `menyambung` → diam.
 *
 * Kenapa tidak membandingkan dengan status sebelumnya: KoneksiOnline selalu melapor 'menyambung'
 * tepat sebelum 'tersambung' (juga saat sambung ulang), dan setiap percobaan sambung ulang yang gagal
 * mengulang 'menyambung' → 'terputus'. Jadi "sebelumnya terputus" tidak pernah benar saat tersambung,
 * sementara "terputus" muncul berkali-kali dalam satu putus. Sebabnya sama dengan PemicuCekServer
 * (pembaruan.ts): yang diingat adalah kabar terakhir sejak tersambung terakhir.
 */
export class KabarKoneksi {
  private terakhir: 'putus' | 'gagal' | null = null;

  /** Status koneksi berubah. Null = tidak perlu mengabari apa-apa. */
  status(s: StatusKoneksi): Kabar | null {
    switch (s) {
      case 'terputus':
        if (this.terakhir) return null;
        return (this.terakhir = 'putus');
      case 'gagal':
        if (this.terakhir === 'gagal') return null;
        return (this.terakhir = 'gagal');
      case 'tersambung': {
        const adaKabar = this.terakhir !== null;
        this.terakhir = null;
        return adaKabar ? 'pulih' : null;
      }
      default:
        return null;
    }
  }
}

/**
 * Tambahan protokol dari perbaikan koneksi (semua field opsional, aditif). Ditulis di sini supaya client
 * cocok dengan server lama (field tambahan dibuang validasi pesannya, jenis pesan baru tidak pernah
 * dikirim) maupun server baru.
 * - `aksi.id`: id acak per aksi (1–64 huruf [A-Za-z0-9_-]); server baru menjawab `aksiDiterima` dengan id
 *   yang sama sesudah aksinya diproses (diterapkan atau ditolak), dan tidak menerapkan id yang sama dua kali.
 * - `siapJoker.putaran`: nomor putaran popup joker yang di-OK; meja mengabaikan nomor yang beda.
 * - `pong.w`: jam server (ms epoch) saat ping dijawab; hanya dari server online.
 * - `masuk.dijalankanWarga`: banyak langkah kursi ini yang dijalankan warga kedai selama terputus.
 */
export type PesanKeMeja =
  | Exclude<PesanKlien, { t: 'aksi' } | { t: 'siapJoker' }>
  | { t: 'aksi'; aksi: AksiKlien; id?: string }
  | { t: 'siapJoker'; putaran?: number };

export type PesanDariMeja =
  | Exclude<PesanServer, { t: 'masuk' } | { t: 'pong' } | { t: 'aksiDiterima' }>
  | { t: 'masuk'; kode: string; token: string; kursi: number; dijalankanWarga?: number }
  | { t: 'pong'; w?: number }
  | { t: 'aksiDiterima'; id: string };

export interface Koneksi {
  readonly jenis: 'online' | 'offline';
  kirim(p: PesanKeMeja): void;
  saatPesan(cb: (p: PesanDariMeja) => void): void;
  /** Dipanggil setiap status berubah. Langsung dipanggil sekali dengan status terkini. */
  saatStatus(cb: (s: StatusKoneksi) => void): void;
  /** Pesan yang dikirim sekarang langsung berangkat (online: socket terbuka; offline: selalu). */
  siapKirim(): boolean;
  /**
   * Periksa sambungan sekarang juga (mis. aksi lama tak berjawab). Online: socket terbuka dicek dengan ping
   * (diputus kalau 5 dtk tanpa kabar), yang putus langsung disambung ulang. Offline: tidak ada apa-apa.
   */
  periksa(): void;
  /**
   * Selisih jam server − jam HP (ms) yang layak dipakai untuk bar waktu giliran. 0 kalau selisihnya kecil
   * (dalam batas ketelitian sampel) atau belum diketahui. Offline selalu 0.
   */
  selisihJam(): number;
  /** Sesi meja yang dipegang koneksi ini (dari pesan 'masuk'); null kalau belum/tidak ada. */
  sesiAktif(): SesiOnline | null;
  /** Lupakan sesi meja (meja sudah bubar): sambung ulang berikutnya tidak meminta kursi itu lagi. */
  lupakanSesi(): void;
  /** Nyalakan/matikan mode lanjut sesi (lihat OpsiKoneksiOnline.lanjutSesi). */
  aturLanjutSesi(aktif: boolean): void;
  /** Mode lanjut sesi sedang aktif. */
  readonly melanjutkanSesi: boolean;
  tutup(): void;
}

/** Detak ping biasa. Sambungan yang diam lebih lama dari BATAS_PONG_MS dianggap setengah mati. */
const INTERVAL_PING_MS = 10_000;
/** Ping tanpa jawaban selama ini: anggap sambungan setengah mati (HP pindah jaringan, dll.). */
const BATAS_PONG_MS = 2 * INTERVAL_PING_MS;
/** Cek cepat (sesudah kirim pesan, tab terlihat lagi, sinyal berubah): tunggu jawaban sebentar saja. */
const BATAS_CEK_CEPAT_MS = 5_000;
/**
 * Socket lama yang dianggap mati tidak langsung ditutup: handler-nya dilepas, lalu ditutup sesudah socket
 * baru menerima 'masuk' (atau paling lambat sekian). Kalau ternyata masih hidup, 'gabung' lewat socket baru
 * sampai duluan, dan server menutup yang lama sendiri tanpa mencatat kursi ini terputus (host, voting,
 * dan masa tenggang tidak terganggu).
 */
const BATAS_PENSIUN_MS = 15_000;
/**
 * Jabat tangan (CONNECTING) yang tidak selesai-selesai: anggap gagal, tutup, lalu sambung ulang
 * dengan backoff. Tanpa batas ini, paket yang hilang di jalan (sinyal jelek, proxy macet) membuat
 * layar tertahan di "Menyambung…" selamanya, karena browser bisa menunggu sangat lama.
 */
const BATAS_SAMBUNG_MS = 10_000;
const JEDA_ULANG_AWAL_MS = 500;
const JEDA_ULANG_MAKS_MS = 8_000;
/** Berapa kali gagal berturut-turut (tanpa pernah tersambung) sebelum status 'gagal'. */
const BATAS_GAGAL_AWAL = 3;
/** Pesan antrian yang lebih tua dari ini dibuang: niat pemain sudah basi. */
const UMUR_ANTRIAN_MS = 30_000;
const PANJANG_ANTRIAN_MAKS = 8;
/**
 * Selisih jam baru dipakai kalau melebihi ini + RTT/2 (ketelitian sampelnya). HP dengan jam otomatis
 * biasanya meleset jauh di bawah ini, jadi tetap memakai jamnya sendiri (kebal latensi).
 */
export const AMBANG_SELISIH_JAM_MS = 1_500;
/** Waktu kirim ping yang belum dijawab (per sambungan) yang diingat. */
const PING_DIINGAT_MAKS = 32;

/**
 * Pesan yang aman dikirim belakangan setelah sambungan pulih. Pesan lain (aksi, vote,
 * mulai, putaranBerikut, emote, dll.) bisa diterapkan ke state yang sudah berubah, jadi dibuang.
 * 'keluar' sengaja tidak diantrikan: pemanggilnya langsung menutup koneksi (antrian ikut
 * dibuang), jadi aplikasi mengecek siapKirim() dulu dan memberi tahu pemain kalau tidak sampai.
 */
const BOLEH_ANTRI = new Set<PesanKeMeja['t']>(['buat', 'gabung', 'daftar']);
/** Jenis yang cukup diwakili satu pesan terbaru di antrian. Buat dan gabung sama-sama "masuk meja". */
const kelompokAntri = (t: PesanKeMeja['t']) => (t === 'buat' || t === 'gabung' ? 'masuk' : t);

/** Pesan 'error' buatan koneksi sendiri: pesan yang dikirim saat putus tidak berangkat. */
export const PESAN_TERTAHAN = 'Sinyalnya lagi putus, Bos. Tunggu nyambung dulu, baru coba lagi.';

interface Antri {
  pesan: PesanKeMeja;
  waktu: number;
}

export interface OpsiKoneksiOnline {
  /**
   * Melanjutkan sesi meja tersimpan (aplikasi dibuka ulang di tengah permainan): koneksi tidak pernah
   * berstatus 'gagal' dan terus mencoba (backoff ≤ 8 dtk), karena sinyal jelek saat aplikasi baru dibuka
   * bukan alasan menyerah. Dimatikan lewat aturLanjutSesi(false) begitu pemain punya niat lain.
   */
  lanjutSesi?: boolean;
  /**
   * false: jangan minta kursi dari sesi tersimpan saat tersambung (sesudah kursi ini dibuka di tab atau
   * perangkat lain, kode 4000), supaya dua perangkat tidak saling rebut. Bawaan true.
   */
  pakaiSesiTersimpan?: boolean;
}

/** Id acak 32 huruf hex (penanda instans aplikasi, id aksi). */
export function idAcak(): string {
  const c = (globalThis as { crypto?: Crypto }).crypto;
  if (typeof c?.randomUUID === 'function') return c.randomUUID().replace(/-/g, '');
  const b = new Uint8Array(16);
  if (typeof c?.getRandomValues === 'function') c.getRandomValues(b);
  else for (let i = 0; i < b.length; i++) b[i] = Math.floor(Math.random() * 256);
  return [...b].map((x) => x.toString(16).padStart(2, '0')).join('');
}

interface Pensiun {
  ws: WebSocket;
  timer: ReturnType<typeof setTimeout>;
}

export class KoneksiOnline implements Koneksi {
  readonly jenis = 'online';
  /** Penanda instans aplikasi ini (tab/PWA) di sesi tersimpan; lihat SesiOnline.pemegang. */
  readonly idInstans = idAcak();
  private ws: WebSocket | null = null;
  private antrian: Antri[] = [];
  private pendengar: ((p: PesanDariMeja) => void)[] = [];
  private pendengarStatus: ((s: StatusKoneksi) => void)[] = [];
  private statusKini: StatusKoneksi = 'menyambung';
  private jedaUlang = JEDA_ULANG_AWAL_MS;
  private ditutup = false;
  private pernahTersambung = false;
  private gagalBeruntun = 0;
  private lanjutSesi: boolean;
  private readonly pakaiSesiTersimpan: boolean;
  /**
   * Sesi dari pesan 'masuk' di koneksi ini. Dipakai lebih dulu daripada localStorage saat sambung ulang:
   * penyimpanan bisa gagal ditulis (mode privat, penuh) atau ditimpa tab lain yang masuk meja lain.
   */
  private sesiMemori: SesiOnline | null = null;
  /** Sudah memberi tahu pemain bahwa aksinya tertahan (sekali per putus). */
  private sudahDiberitahu = false;
  private timerPing: ReturnType<typeof setInterval> | null = null;
  private timerUlang: ReturnType<typeof setTimeout> | null = null;
  private timerCekCepat: ReturnType<typeof setTimeout> | null = null;
  /** Batas waktu jabat tangan untuk socket yang sedang CONNECTING. */
  private timerSambung: ReturnType<typeof setTimeout> | null = null;
  /** Kapan socket yang sekarang mulai dibuka. */
  private mulaiSambung = 0;
  /** Waktu ping pertama yang belum dijawab; null = server terakhir menjawab. */
  private pingSejak: number | null = null;
  /** Waktu kirim tiap ping di socket ini yang belum dijawab (urut; pong datang berurutan). */
  private pingTerkirim: number[] = [];
  /** Sampel jam ber-RTT terkecil di sambungan ini. */
  private sampelJam: { rtt: number; selisih: number } | null = null;
  private selisihPakai = 0;
  /** Socket lama yang handler-nya sudah dilepas tapi belum ditutup (lihat BATAS_PENSIUN_MS). */
  private pensiun: Pensiun[] = [];
  private koneksiJaringan: EventTarget | null = null;

  private readonly saatOnline = () => this.sambungSekarang();
  /** Sinyal hilang: sambungan yang kelihatan terbuka dicek (biasanya ikut mati), tanpa membuka yang baru. */
  private readonly saatOffline = () => {
    const ws = this.ws;
    if (!this.ditutup && ws?.readyState === WebSocket.OPEN) this.cekCepat(ws);
  };
  /** Jenis jaringan berganti (Wi-Fi ↔ seluler): socket lama sering mati diam-diam. */
  private readonly saatJaringanBerubah = () => this.sambungSekarang();
  private readonly saatTerlihat = () => {
    if (document.visibilityState === 'visible') this.sambungSekarang();
  };

  constructor(
    private readonly url: string,
    private readonly nama: () => string,
    opsi: OpsiKoneksiOnline = {},
  ) {
    this.lanjutSesi = opsi.lanjutSesi ?? false;
    this.pakaiSesiTersimpan = opsi.pakaiSesiTersimpan ?? true;
    window.addEventListener('online', this.saatOnline);
    window.addEventListener('offline', this.saatOffline);
    document.addEventListener('visibilitychange', this.saatTerlihat);
    // Network Information API (Chrome Android); tidak ada di Safari dan Firefox.
    const jaringan = (navigator as Navigator & { connection?: EventTarget }).connection;
    if (jaringan && typeof jaringan.addEventListener === 'function') {
      this.koneksiJaringan = jaringan;
      jaringan.addEventListener('change', this.saatJaringanBerubah);
    }
    this.sambung();
  }

  private status(s: StatusKoneksi) {
    this.statusKini = s;
    this.pendengarStatus.forEach((cb) => cb(s));
  }

  private teruskan(p: PesanDariMeja) {
    this.pendengar.forEach((cb) => cb(p));
  }

  /**
   * Instans ini tersembunyi, dan instans lain (tab/PWA lain) yang terakhir masuk ke meja yang sama:
   * jangan menyambung ulang sendiri, nanti kursinya direbut bolak-balik. Begitu terlihat lagi, ia
   * menyambung (pemain sedang melihat instans ini). Sesi tanpa penanda pemegang tetap disambung, dan
   * niat baru (buat/gabung/daftar di antrian) selalu dikirim.
   */
  private mengalahKePemegang(): boolean {
    if (document.visibilityState !== 'hidden' || this.antrian.length) return false;
    const tersimpan = simpan.sesi();
    if (!tersimpan?.pemegang || tersimpan.pemegang === this.idInstans) return false;
    const milikku = this.sesiMemori ?? (this.pakaiSesiTersimpan ? tersimpan : null);
    return !!milikku && milikku.kode === tersimpan.kode;
  }

  private sambung() {
    if (this.ditutup || this.ws) return;
    this.timerUlang = null;
    if (this.mengalahKePemegang()) {
      this.status('terputus');
      return;
    }
    this.status('menyambung');
    let ws: WebSocket;
    try {
      ws = new WebSocket(this.url);
    } catch {
      // URL tidak valid / diblokir: perlakukan seperti sambungan yang langsung gagal.
      return this.jadwalUlang();
    }
    this.ws = ws;
    this.mulaiSambung = Date.now();
    this.timerSambung = setTimeout(() => {
      this.timerSambung = null;
      if (this.ws === ws && ws.readyState === WebSocket.CONNECTING) this.putuskan(ws);
    }, BATAS_SAMBUNG_MS);
    ws.onopen = () => {
      this.hentikanBatasSambung();
      this.jedaUlang = JEDA_ULANG_AWAL_MS;
      this.pernahTersambung = true;
      this.gagalBeruntun = 0;
      this.sudahDiberitahu = false;
      this.pingSejak = null;
      this.pingTerkirim = [];
      this.sampelJam = null;
      this.status('tersambung');
      // Pendengar status boleh menutup koneksi ini.
      if (this.ditutup || this.ws !== ws) return;
      const antri = this.ambilAntrian();
      // Lanjutkan sesi lama (misalnya habis sinyal hilang atau aplikasi ditutup), kecuali pemain
      // barusan minta masuk meja lain: niat terbarunya yang menang. Sesi dari 'masuk' di koneksi ini
      // dipakai lebih dulu daripada localStorage (bisa gagal ditulis atau ditimpa tab lain).
      const sesi = this.sesiMemori ?? (this.pakaiSesiTersimpan ? simpan.sesi() : null);
      const mauMasuk = antri.some((p) => p.t === 'buat' || p.t === 'gabung');
      if (sesi && !mauMasuk) ws.send(JSON.stringify({ t: 'gabung', kode: sesi.kode, nama: this.nama(), token: sesi.token }));
      for (const p of antri) ws.send(JSON.stringify(p));
      // Ping pertama langsung: watchdog mulai dari sekarang dan sampel jam server cepat ada.
      this.kirimPing(ws);
      this.timerPing = setInterval(() => this.detak(), INTERVAL_PING_MS);
    };
    ws.onmessage = (e) => {
      this.adaKabar();
      let p: PesanDariMeja;
      try {
        p = JSON.parse(String(e.data));
      } catch {
        return;
      }
      if (p.t === 'pong') this.catatPong(p.w);
      if (p.t === 'masuk') {
        const sesi: SesiOnline = { kode: p.kode, token: p.token, pemegang: this.idInstans };
        this.sesiMemori = sesi;
        simpan.setSesi(sesi);
        // Kursi sudah dipegang socket ini: socket lama yang masih menunggu boleh ditutup.
        this.tutupPensiun();
      }
      if (p.t === 'keluar') {
        this.sesiMemori = null;
        simpan.setSesi(null);
      }
      this.teruskan(p);
    };
    ws.onclose = (e) => this.lepas(ws, e.code);
  }

  /** Ada pesan masuk: sambungan hidup. Cek cepat yang sedang menunggu dianggap lolos. */
  private adaKabar() {
    this.pingSejak = null;
    if (this.timerCekCepat) clearTimeout(this.timerCekCepat);
    this.timerCekCepat = null;
  }

  /** Bersihkan sambungan yang sudah (atau dianggap) mati, lalu jadwalkan sambung ulang. */
  private lepas(ws: WebSocket, kode: number) {
    if (this.ws !== ws) return;
    ws.onopen = ws.onmessage = ws.onclose = null;
    this.ws = null;
    this.hentikanBatasSambung();
    this.hentikanDetak();
    if (this.ditutup) return;
    if (kode === 4000) {
      // Server menutup karena kursi ini dibuka di tab/perangkat lain: jangan rebutan sambung ulang.
      this.tutup();
      this.teruskan({ t: 'keluar', alasan: 'Meja ini sedang dibuka di tab atau perangkat lain.' });
      return;
    }
    this.jadwalUlang();
  }

  private jadwalUlang() {
    if (this.pernahTersambung || this.lanjutSesi) this.status('terputus');
    else this.status(++this.gagalBeruntun >= BATAS_GAGAL_AWAL ? 'gagal' : 'terputus');
    // Pendengar status boleh langsung menutup koneksi (mis. beranda menyerah saat 'gagal'):
    // jangan pasang timer sambung ulang yang lolos dari tutup().
    if (this.ditutup) return;
    if (this.timerUlang) clearTimeout(this.timerUlang);
    this.timerUlang = setTimeout(() => this.sambung(), this.jedaUlang);
    this.jedaUlang = Math.min(this.jedaUlang * 2, JEDA_ULANG_MAKS_MS);
  }

  private kirimPing(ws: WebSocket) {
    const sekarang = Date.now();
    this.pingSejak ??= sekarang;
    this.pingTerkirim.push(sekarang);
    if (this.pingTerkirim.length > PING_DIINGAT_MAKS) this.pingTerkirim.shift();
    ws.send(JSON.stringify({ t: 'ping' }));
  }

  /**
   * Pong datang (berurutan dengan ping-nya). Server online menyertakan jamnya (`w`); dari semua sampel di
   * sambungan ini dipakai yang RTT-nya terkecil (paling teliti), dan selisihnya baru dipakai kalau lebih
   * besar dari ketelitiannya (RTT/2) + ambang. Sampel yang terlambat (RTT besar) tidak pernah menggeser
   * bar waktu: tidak terpilih kalau ada yang lebih cepat, dan ambangnya ikut membesar.
   */
  private catatPong(w: unknown) {
    const t0 = this.pingTerkirim.shift();
    if (t0 === undefined || typeof w !== 'number' || !Number.isFinite(w)) return;
    const t1 = Date.now();
    const rtt = Math.max(0, t1 - t0);
    if (this.sampelJam && this.sampelJam.rtt <= rtt) return;
    const selisih = w - (t0 + t1) / 2;
    this.sampelJam = { rtt, selisih };
    this.selisihPakai = Math.abs(selisih) > AMBANG_SELISIH_JAM_MS + rtt / 2 ? Math.round(selisih) : 0;
  }

  /** Ping berkala + watchdog: ping yang lama tak berjawab berarti sambungan setengah mati. */
  private detak() {
    const ws = this.ws;
    if (!ws || ws.readyState !== WebSocket.OPEN) return;
    if (this.pingSejak !== null && Date.now() - this.pingSejak >= BATAS_PONG_MS) return this.putuskan(ws);
    this.kirimPing(ws);
  }

  /**
   * Cek cepat socket yang kelihatan terbuka: kirim ping, lalu putus kalau dalam 5 dtk tidak ada pesan
   * masuk apa pun. Dipakai sesudah setiap pesan yang dikirim (aksi, siapJoker, vote, emote…), saat tab
   * terlihat lagi, dan saat sinyal berubah. Socket setengah mati jadi ketahuan dalam hitungan detik.
   */
  private cekCepat(ws: WebSocket) {
    if (this.timerCekCepat || ws.readyState !== WebSocket.OPEN) return;
    this.kirimPing(ws);
    this.timerCekCepat = setTimeout(() => {
      this.timerCekCepat = null;
      if (this.ws === ws) this.putuskan(ws);
    }, BATAS_CEK_CEPAT_MS);
  }

  private hentikanBatasSambung() {
    if (this.timerSambung) clearTimeout(this.timerSambung);
    this.timerSambung = null;
  }

  private hentikanDetak() {
    if (this.timerPing) clearInterval(this.timerPing);
    if (this.timerCekCepat) clearTimeout(this.timerCekCepat);
    this.timerPing = this.timerCekCepat = null;
    this.pingSejak = null;
    this.pingTerkirim = [];
  }

  /**
   * Lepas sambungan yang dianggap mati tanpa menunggu jabat tangan penutupan (bisa lama di sambungan mati).
   * Socket yang masih CONNECTING langsung ditutup. Socket yang terbuka dipensiunkan (lihat BATAS_PENSIUN_MS):
   * semua handler-nya dilepas (kode 4000 darinya tidak dibaca lagi), tapi close() menunggu socket baru.
   */
  private putuskan(ws: WebSocket) {
    const terbuka = ws.readyState === WebSocket.OPEN;
    ws.onopen = ws.onmessage = ws.onclose = null;
    if (terbuka && !this.ditutup) this.pensiunkan(ws);
    else tutupSocket(ws);
    this.lepas(ws, 1006);
  }

  private pensiunkan(ws: WebSocket) {
    const timer = setTimeout(() => this.tutupPensiun(ws), BATAS_PENSIUN_MS);
    this.pensiun.push({ ws, timer });
  }

  /** Tutup socket pensiunan (semua, atau satu saja). */
  private tutupPensiun(hanya?: WebSocket) {
    this.pensiun = this.pensiun.filter((x) => {
      if (hanya && x.ws !== hanya) return true;
      clearTimeout(x.timer);
      tutupSocket(x.ws);
      return false;
    });
  }

  /** Tab terlihat lagi, sinyal kembali/berganti, atau diminta periksa: jangan tunggu backoff. */
  private sambungSekarang(): void {
    if (this.ditutup) return;
    const ws = this.ws;
    if (!ws) {
      if (this.timerUlang) clearTimeout(this.timerUlang);
      this.timerUlang = null;
      this.jedaUlang = JEDA_ULANG_AWAL_MS;
      this.sambung();
      return;
    }
    if (ws.readyState === WebSocket.CONNECTING) {
      // Percobaan yang sudah lama menggantung kemungkinan besar lewat jaringan lama yang sudah mati:
      // buang dan mulai baru sekarang. Yang baru dimulai dibiarkan (jangan sampai sambungan ganda).
      if (Date.now() - this.mulaiSambung < BATAS_CEK_CEPAT_MS) return;
      this.putuskan(ws);
      return this.sambungSekarang();
    }
    // Sambungan kelihatan terbuka, tapi setelah HP tidur atau pindah jaringan bisa saja sudah mati diam-diam.
    if (ws.readyState === WebSocket.OPEN) this.cekCepat(ws);
  }

  /** Ambil isi antrian yang belum basi, lalu kosongkan antriannya. */
  private ambilAntrian(): PesanKeMeja[] {
    const batas = Date.now() - UMUR_ANTRIAN_MS;
    return this.antrian.splice(0).filter((a) => a.waktu >= batas).map((a) => a.pesan);
  }

  private antrikan(p: PesanKeMeja) {
    const kelompok = kelompokAntri(p.t);
    this.antrian = this.antrian.filter((a) => kelompokAntri(a.pesan.t) !== kelompok);
    this.antrian.push({ pesan: p, waktu: Date.now() });
    if (this.antrian.length > PANJANG_ANTRIAN_MAKS) this.antrian.splice(0, this.antrian.length - PANJANG_ANTRIAN_MAKS);
  }

  siapKirim(): boolean {
    return !this.ditutup && this.ws?.readyState === WebSocket.OPEN;
  }

  kirim(p: PesanKeMeja) {
    if (this.ditutup) return;
    const ws = this.ws;
    if (ws?.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(p));
      // Setiap pesan yang dikirim berbuah jawaban (view, info, pong, emote, error). Kalau 5 dtk diam,
      // socket-nya mati diam-diam: sambung ulang sekarang, jangan tunggu watchdog.
      if (p.t !== 'ping') this.cekCepat(ws);
      return;
    }
    if (p.t === 'ping') return;
    if (BOLEH_ANTRI.has(p.t)) return this.antrikan(p);
    // Aksi saat putus tidak diantrikan (bisa basi), tapi pemain perlu tahu kenapa tidak terjadi apa-apa.
    if (this.sudahDiberitahu) return;
    this.sudahDiberitahu = true;
    queueMicrotask(() => this.teruskan({ t: 'error', pesan: PESAN_TERTAHAN }));
  }

  periksa() {
    this.sambungSekarang();
  }

  selisihJam(): number {
    return this.selisihPakai;
  }

  sesiAktif(): SesiOnline | null {
    return this.sesiMemori;
  }

  lupakanSesi() {
    this.sesiMemori = null;
  }

  aturLanjutSesi(aktif: boolean) {
    this.lanjutSesi = aktif;
  }

  get melanjutkanSesi(): boolean {
    return this.lanjutSesi;
  }

  saatPesan(cb: (p: PesanDariMeja) => void) {
    this.pendengar.push(cb);
  }

  saatStatus(cb: (s: StatusKoneksi) => void) {
    this.pendengarStatus.push(cb);
    cb(this.statusKini);
  }

  tutup() {
    this.ditutup = true;
    window.removeEventListener('online', this.saatOnline);
    window.removeEventListener('offline', this.saatOffline);
    document.removeEventListener('visibilitychange', this.saatTerlihat);
    this.koneksiJaringan?.removeEventListener('change', this.saatJaringanBerubah);
    this.koneksiJaringan = null;
    if (this.timerUlang) clearTimeout(this.timerUlang);
    this.timerUlang = null;
    this.hentikanBatasSambung();
    this.hentikanDetak();
    this.tutupPensiun();
    this.antrian = [];
    this.sesiMemori = null;
    const ws = this.ws;
    this.ws = null;
    if (ws) {
      ws.onopen = ws.onmessage = ws.onclose = null;
      tutupSocket(ws);
    }
  }
}

function tutupSocket(ws: WebSocket) {
  try {
    ws.close();
  } catch {
    // Abaikan: yang penting sambungan dilepas.
  }
}

const ID_SAYA = 'saya';
const JEDA_SIMPAN_MS = 300;

export class KoneksiOffline implements Koneksi {
  readonly jenis = 'offline';
  private meja: Meja | null = null;
  private pendengar: ((p: PesanDariMeja) => void)[] = [];
  private tertunda: PesanDariMeja[] = [];
  readonly melanjutkanSesi = false;
  private timerSimpan: ReturnType<typeof setTimeout> | null = null;

  // Tab ditutup/di-refresh/pindah aplikasi: kalau ada perubahan yang belum ditulis, tulis sekarang.
  private readonly saatHalamanPergi = () => {
    if (this.timerSimpan) this.simpanSekarang();
  };
  private readonly saatTersembunyi = () => {
    if (document.visibilityState === 'hidden' && this.timerSimpan) this.simpanSekarang();
  };

  private constructor() {
    window.addEventListener('pagehide', this.saatHalamanPergi);
    document.addEventListener('visibilitychange', this.saatTersembunyi);
  }

  private opsi(namaLawan?: readonly string[]) {
    return {
      kode: 'OFFLINE',
      kirim: (_: string, p: PesanServer) => this.kirimKeUI(p),
      batasLog: 200,
      saatBerubah: () => this.jadwalSimpan(),
      namaLawan,
    };
  }

  /**
   * Meja baru: saya + warga kedai (bot) di kursi lainnya, langsung mulai.
   * Nama warga kedai diambil dari NAMA_LAWAN_BAWAAN dengan urutan acak (Math.random), kecuali
   * `urutanNamaTetap` (latihan dengan panduan: lawannya selalu sama, mis. "Kipas Dua" & "Cak Kopag").
   */
  static baru(
    nama: string,
    pengaturan: Partial<PengaturanMeja>,
    pengocok?: number,
    pilihan: { urutanNamaTetap?: boolean } = {},
  ): KoneksiOffline {
    const k = new KoneksiOffline();
    const namaLawan = pilihan.urutanNamaTetap ? NAMA_LAWAN_BAWAAN : namaLawanAcak();
    const meja = Meja.buat(k.opsi(namaLawan), ID_SAYA, nama, { ...pengaturan, detikGiliran: 0, publik: false });
    k.meja = meja;
    for (let i = 1; i < (pengaturan.jumlahPemain ?? 4); i++) {
      meja.terima(ID_SAYA, { t: 'aturKursi', kursi: i, jenis: 'bot', level: pengaturan.levelBot });
    }
    meja.terima(ID_SAYA, { t: 'mulai', pengocok });
    return k;
  }

  /**
   * Lanjutkan simpanan offline. Null kalau tidak ada, rusak, atau permainannya sudah selesai
   * (simpanan seperti itu dibuang supaya klasemennya tidak tercatat dua kali di riwayat).
   */
  static lanjutkan(): KoneksiOffline | null {
    const data = simpan.mejaOffline();
    if (!data || data.versi !== 1) return null;
    if (data.game?.status === 'selesai') {
      simpan.setMejaOffline(null);
      return null;
    }
    const k = new KoneksiOffline();
    try {
      k.meja = new Meja(k.opsi(), data);
      k.meja.terhubung(ID_SAYA);
    } catch (e) {
      // Simpanan rusak/tidak cocok: buang supaya tidak macet terus.
      console.error('simpanan offline tidak bisa dilanjutkan', e);
      k.meja?.hentikan();
      k.meja = null;
      k.tutup();
      simpan.setMejaOffline(null);
      return null;
    }
    return k;
  }

  private kirimKeUI(p: PesanServer) {
    if (p.t === 'keluar') {
      this.batalSimpan();
      simpan.setMejaOffline(null);
      this.meja?.hentikan();
      this.meja = null;
    }
    if (!this.pendengar.length) {
      this.tertunda.push(p);
      return;
    }
    // Asinkron supaya UI tidak dipanggil di tengah pemrosesan meja.
    queueMicrotask(() => this.pendengar.forEach((cb) => cb(p)));
  }

  private jadwalSimpan() {
    if (this.timerSimpan) return;
    this.timerSimpan = setTimeout(() => this.simpanSekarang(), JEDA_SIMPAN_MS);
  }

  private batalSimpan() {
    if (this.timerSimpan) clearTimeout(this.timerSimpan);
    this.timerSimpan = null;
  }

  /**
   * Tulis simpanan sekarang. Permainan yang sudah selesai tidak pernah ditulis (dan sisa
   * simpanannya dihapus): kalau tidak, beranda menawarkan "lanjutkan" untuk permainan yang
   * sudah tamat dan klasemennya tercatat ulang di riwayat.
   */
  private simpanSekarang() {
    this.batalSimpan();
    if (!this.meja) return;
    if (this.meja.status === 'selesai') simpan.setMejaOffline(null);
    else simpan.setMejaOffline(this.meja.data);
  }

  kirim(p: PesanKeMeja) {
    if (!this.meja) return;
    if (p.t === 'ping') return this.kirimKeUI({ t: 'pong' });
    // Id aksi hanya untuk server online (konfirmasi + anti-dobel); meja di HP ini langsung menjawab.
    if (p.t === 'aksi' && p.id !== undefined) {
      const { id: _, ...tanpaId } = p;
      return this.meja.terima(ID_SAYA, tanpaId);
    }
    this.meja.terima(ID_SAYA, p);
  }

  periksa() {
    // Meja di HP ini: tidak ada sambungan yang perlu diperiksa.
  }

  selisihJam(): number {
    return 0;
  }

  sesiAktif(): SesiOnline | null {
    return null;
  }

  lupakanSesi() {
    // Tidak ada sesi online.
  }

  aturLanjutSesi() {
    // Tidak ada sesi online.
  }

  saatPesan(cb: (p: PesanDariMeja) => void) {
    this.pendengar.push(cb);
    const lama = this.tertunda.splice(0);
    queueMicrotask(() => lama.forEach((p) => cb(p)));
  }

  saatStatus(cb: (s: StatusKoneksi) => void) {
    cb('tersambung');
  }

  siapKirim(): boolean {
    return this.meja !== null;
  }

  tutup() {
    window.removeEventListener('pagehide', this.saatHalamanPergi);
    document.removeEventListener('visibilitychange', this.saatTersembunyi);
    this.simpanSekarang();
    this.meja?.hentikan();
    this.meja = null;
  }
}

export function urlServer(): string {
  const proto = location.protocol === 'https:' ? 'wss' : 'ws';
  return `${proto}://${location.host}/ws`;
}
