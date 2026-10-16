// Aplikasi: memilih layar (beranda, daftar publik, riwayat, lobi, meja) berdasarkan pesan dari meja,
// mengelola koneksi online/offline, pembaruan PWA, tombol Back, musik latar, dan wake lock.

import './gaya.css';
import { registerSW } from 'virtual:pwa-register';
import type { ViewPemain } from '@remi/engine';
import type { InfoMeja, PengaturanMeja, PesanKlien, PesanServer } from '@remi/meja';
import { pasangPreferensi } from './preferensi';
import { KoneksiOffline, KoneksiOnline, urlServer, type Koneksi, type StatusKoneksi } from './koneksi';
import { catatanDariView, kunciPermainan, simpan } from './penyimpanan';
import { bangunkanGame, buatGame, tidurkanGame, type PenampungGame } from './game/game';
import { KontrolMeja, type AppUntukMeja } from './kontrolMeja';
import { konfirmasiTimpaSimpanan, renderBeranda, renderDaftarPublik, type BerandaTerpasang, type StatusOnline } from './ui/beranda';
import { mejaMasukPeringkat, opsiKonfirmasiKeluar, renderLobi } from './ui/lobi';
import { renderRiwayat } from './ui/riwayat';
import { bukaPengaturan } from './ui/pengaturan';
import { bukaBantuan, bukaTentang, siapkanJendelaMalas } from './ui/jendelaMalas';
import {
  adaJendelaTerbuka,
  dialogTerbuka,
  konfirmasi,
  modalTerbuka,
  pasangLandmarkUtama,
  toast,
  tutupModal,
  tutupSemuaJendela,
  umumkan,
} from './ui/dom';
import { siapkanAudio, suasanaMusik } from './efek/suara';
import { adaJaringan } from './jaringan';
import { PESAN_MEJA_MASIH_PUTUS, renderGalatMeja, renderPemuatMeja } from './ui/pemuatMeja';
import {
  adaIsianAktif,
  bolehCek,
  CEK_BERKALA_MS,
  JEDA_TOAST_MS,
  pasangPenjawabSapa,
  PemicuCekServer,
  PengelolaPembaruan,
  pesanSesudahPembaruan,
  serverBeda,
  TEKS_PASANG,
  type InfoBuild,
  type KeadaanPembaruan,
  type PenyimpananSesi,
} from './pembaruan';
import { BUILD_SHA, BUILD_WAKTU, labelVersi, VERSI } from './versi';

// Paling awal: jawab sapaan SW baru (jembatan transisi 0.1 → 0.2, lihat public/sw-transisi.js). Kalau
// terlambat, halaman ini dikira versi lama dan dimuat ulang begitu SW baru aktif.
pasangPenjawabSapa('serviceWorker' in navigator ? navigator.serviceWorker : null, `${VERSI}+${BUILD_SHA}`);
// Sedini mungkin: atribut tampilan (<html data-*>) sebelum layar pertama digambar, lalu audio.
pasangPreferensi();
siapkanAudio();

const BUILD: InfoBuild = { versi: VERSI, sha: BUILD_SHA, waktu: BUILD_WAKTU, label: labelVersi() };

/** Pengaturan permainan latihan: tiga pemain (kamu + 2 warga kedai mudah), satu putaran, kamu ngocok & jalan duluan. */
const PENGATURAN_LATIHAN: Partial<PengaturanMeja> = {
  jumlahPemain: 3,
  duaDeckUntukEmpat: false,
  levelBot: 'mudah',
  tempoBot: 'santai',
  batasPutaran: 1,
  batasSkorAtas: null,
  batasSkorBawah: null,
};

const PESAN_SERVER_GAGAL = 'Server-nya belum bisa dihubungi, Bos. Coba lagi nanti.';
/**
 * Di beranda, pesan gagal + "Coba lagi" tampil menetap di panel online. Toast hanya cadangan
 * singkat (tanpa tombol) kalau panel itu sedang tergulir keluar layar, jadi tidak lama menutupi
 * tombol "Buat meja baru".
 */
const TOAST_GAGAL_BERANDA_MS = 4500;
/**
 * Keluar meja saat sinyal putus: pesan 'keluar' tidak bisa sampai ke server (koneksi langsung
 * ditutup), jadi server masih menganggap kursinya sekadar terputus. Pemain diberi tahu apa adanya.
 */
const PESAN_KELUAR_TAK_SAMPAI: Record<'lobi' | 'meja', string> = {
  lobi: 'Sinyalnya lagi putus, jadi server belum tahu kamu keluar. Kursimu di lobi tercatat terputus sampai host mengosongkannya.',
  meja: 'Sinyalnya lagi putus, jadi server belum tahu kamu keluar. Selama itu kursimu tercatat terputus dan dimainkan warga kedai.',
};

interface PromptPasang extends Event {
  prompt(): Promise<void>;
}

type Layar = 'beranda' | 'publik' | 'riwayat' | 'lobi' | 'meja';

/** sessionStorage: halaman dimuat ulang oleh "Coba lagi" meja yang gagal dimuat; lanjutkan meja offline. */
const KUNCI_LANJUT = 'remi.lanjutSetelahMuatUlang';
const bacaLatihan = simpan.latihanTersimpan;
const tulisLatihan = simpan.setLatihanTersimpan;

class Aplikasi implements AppUntukMeja {
  private koneksi: Koneksi | null = null;
  private layar: Layar = 'beranda';
  private info: InfoMeja | null = null;
  private view: ViewPemain | null = null;
  private kontrol: KontrolMeja | null = null;
  private game: PenampungGame | null = null;
  private beranda: BerandaTerpasang | null = null;
  private promptPasang: PromptPasang | null = null;
  private sudahDicatat = false;
  private wakeLock: { release(): Promise<void> } | null = null;
  private readonly ui = document.getElementById('ui')!;
  private readonly elGame = document.getElementById('game')!;
  private kodeAwal = new URLSearchParams(location.search).get('meja')?.toUpperCase() ?? '';
  /** Permainan offline yang sedang jalan adalah latihan dengan panduan. */
  private modeLatihan = false;
  private statusKini: StatusKoneksi = 'tersambung';
  /** Naik setiap kali tersambung (lagi) ke server; KontrolMeja memakainya untuk kirim ulang siapJoker. */
  private sambunganKe = 0;
  /** Aksi online terakhir dari beranda, untuk tombol "Coba lagi" saat server tidak terjangkau. */
  private niatOnline: (() => void) | null = null;
  /** Sudah ada entri riwayat "penjaga" untuk menangkap tombol Back. */
  private adaJaga = false;
  // Pembaruan PWA (lihat pembaruan.ts: kapan versi baru dipasang sendiri)
  private perbaruiSW: ((muatUlang?: boolean) => Promise<void>) | null = null;
  private regSW: ServiceWorkerRegistration | null = null;
  private urlSW = '';
  private terakhirCekSW: number | null = null;
  private terakhirCekServer: number | null = null;
  private readonly pembaruan = new PengelolaPembaruan({
    build: BUILD,
    keadaan: () => this.keadaanPembaruan(),
    tersembunyi: () => document.visibilityState === 'hidden',
    aktifkanSW: () => void this.perbaruiSW?.(true),
    muatUlang: () => location.reload(),
    toast: (pesan, aksi) => toast(pesan, false, aksi ? 20000 : JEDA_TOAST_MS + 1200, aksi),
    saatTombolBerubah: (f) => this.layar === 'beranda' && this.beranda?.aturMuatUlang(f),
    penyimpanan: penyimpananSesi(),
  });
  /** Pesan 'keluar' barusan tidak terkirim karena sinyal putus (dari layar mana). */
  private keluarTakSampai: 'lobi' | 'meja' | null = null;
  /**
   * Layar meja sedang menunggu Phaser (pemuat tampil) atau menampilkan galat "Meja gagal dimuat".
   * Selama itu info meja baru cukup disimpan; KontrolMeja memakainya begitu dibuat.
   */
  private mejaTertunda = false;
  /** Nomor percobaan memuat meja; jawaban dari percobaan lama diabaikan. */
  private nomorMuatMeja = 0;
  /**
   * Chunk Phaser pernah gagal dimuat di halaman ini. Chrome mengingat import() yang gagal per URL,
   * jadi percobaan berikutnya (juga lewat Lanjutkan dari beranda) langsung memuat ulang halaman kalau sinyal ada.
   */
  private mejaPernahGagal = false;

  get jenis(): 'online' | 'offline' {
    return this.koneksi?.jenis ?? 'online';
  }

  get tutorial(): boolean {
    return this.modeLatihan && this.jenis === 'offline';
  }

  statusKoneksi(): StatusKoneksi {
    return this.koneksi?.jenis === 'online' ? this.statusKini : 'tersambung';
  }

  nomorSambungan(): number {
    return this.sambunganKe;
  }

  mulai() {
    window.addEventListener('beforeinstallprompt', (e) => {
      e.preventDefault();
      this.promptPasang = e as PromptPasang;
      // Cukup sisipkan ubin "Pasang": beranda tidak digambar ulang, isian yang sedang diketik aman.
      if (this.layar === 'beranda') this.beranda?.aturPasang(this.aksiPasang());
    });
    window.addEventListener('appinstalled', () => {
      this.promptPasang = null;
      if (this.layar === 'beranda') this.beranda?.aturPasang(null);
    });
    // Escape di layar penuh (Riwayat, daftar meja publik) = kembali ke beranda, sama seperti Back.
    // dom.ts menangkap Escape lebih dulu (fase capture) untuk menutup dialog yang terbuka.
    document.addEventListener('keydown', (e) => {
      if (e.key !== 'Escape' || e.defaultPrevented || e.repeat || adaJendelaTerbuka()) return;
      if (this.layar !== 'riwayat' && this.layar !== 'publik') return;
      e.preventDefault();
      const dari = this.layar;
      this.tampilkanBeranda();
      if (dari === 'riwayat') this.beranda?.fokusNav('riwayat');
    });
    window.addEventListener('online', () => {
      if (this.layar === 'beranda') this.beranda?.aturStatusOnline('siap');
      this.cekPembaruan();
    });
    window.addEventListener('offline', () => this.layar === 'beranda' && this.beranda?.aturStatusOnline('offline'));
    document.addEventListener('visibilitychange', () => {
      const terlihat = document.visibilityState === 'visible';
      // Wake lock otomatis dilepas browser saat tab tersembunyi; minta lagi saat kembali ke meja.
      if (terlihat && this.layar === 'meja') this.mintaWakeLock();
      // Kembali terlihat: cek versi baru. Disembunyikan: momen terbaik memasang versi yang menunggu.
      if (terlihat) this.cekPembaruan();
      this.pembaruan.nilai();
    });
    this.pasangTombolKembali();
    this.pasangPembaruan();
    this.tampilkanBeranda();
    const pesanPembaruan = pesanSesudahPembaruan(penyimpananSesi(), BUILD);
    if (pesanPembaruan) toast(pesanPembaruan, false, 4000);
    // Ada sesi online yang belum selesai (misalnya aplikasi tertutup saat main): sambung lagi.
    if (simpan.sesi() && navigator.onLine) {
      toast('Menyambung lagi ke meja terakhir…');
      this.niatOnline = () => this.pakaiOnline();
      this.pakaiOnline();
    } else if (ambilLanjutSetelahMuatUlang() && simpan.mejaOffline()) {
      // Halaman dimuat ulang dari tombol "Coba lagi" meja yang gagal dimuat: kembali ke meja offline.
      this.lanjutOffline();
    } else if (bacaLatihan() && !simpan.mejaOffline()) tulisLatihan(false);
  }

  // ---------- pembaruan PWA ----------

  private pasangPembaruan() {
    this.perbaruiSW = registerSW({
      immediate: true,
      // SW baru terpasang dan menunggu: pembaruan.ts memutuskan kapan dipasang (momen aman).
      onNeedRefresh: () => this.pembaruan.versiBaruSiap(),
      // SW baru mengambil alih. Dipasang dari tab ini = muat ulang; dari tab lain = tunggu momen aman,
      // jangan memotong putaran yang sedang berjalan di tab ini.
      onNeedReload: () => this.pembaruan.swMengambilAlih(),
      onOfflineReady: () => toast('Aplikasinya sudah tersimpan di HP, Bos. Main bareng warga kedai tetap jalan tanpa sinyal.', false, 5000),
      onRegisteredSW: (swUrl, r) => {
        if (!r) return;
        this.regSW = r;
        this.urlSW = swUrl;
      },
    });
    // SW baru bisa mengambil alih tanpa lewat onNeedReload: jembatan transisi (public/sw-transisi.js)
    // langsung mengaktifkannya kalau ada jendela lama, dan workbox-window tidak mengabari halaman yang
    // memicu pemeriksaannya sendiri kurang dari semenit sesudah dibuka. Halaman yang sejak awal sudah
    // dikendalikan SW lalu berganti pengendali = versi baru sudah aktif; dimuat ulang di momen aman.
    if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
      navigator.serviceWorker.addEventListener('controllerchange', () => this.pembaruan.swMengambilAlih());
    }
    // Pemain yang sedang menyentuh layar tidak dikagetkan muat ulang (lihat DIAM_MS).
    const sentuh = () => {
      if (this.pembaruan.catatInteraksi()) hapusToast(TEKS_PASANG);
    };
    for (const jenis of ['pointerdown', 'keydown', 'input'] as const) document.addEventListener(jenis, sentuh, { capture: true, passive: true });
    setInterval(() => this.cekPembaruan(), CEK_BERKALA_MS);
    // Saat start: register (immediate) sudah mengecek SW; server dicek kalau ada sinyal.
    void this.cekServer();
  }

  /** Cek versi baru: service worker dan (kalau ada) build server. Dibatasi JEDA_CEK_MIN_MS. */
  private cekPembaruan() {
    void this.cekSW();
    void this.cekServer();
  }

  private async cekSW(paksa = false) {
    const r = this.regSW;
    if (!r || !navigator.onLine || r.installing || r.waiting) return;
    if (!bolehCek(this.terakhirCekSW, Date.now(), paksa)) return;
    this.terakhirCekSW = Date.now();
    try {
      // sw.js dicek dulu: r.update() saat server mati melempar galat yang tidak perlu.
      const resp = await fetch(this.urlSW, { cache: 'no-store', headers: { 'cache-control': 'no-cache' } });
      if (resp.status === 200) await r.update();
    } catch {
      // Server tidak terjangkau: coba lagi di pemicu berikutnya.
    }
  }

  /**
   * Bandingkan build client dengan server (/healthz). Kalau server sudah build lain, versi baru dicari
   * sekarang juga (SW), atau, kalau browser tidak punya service worker (mis. http di jaringan lokal),
   * halaman dimuat ulang biasa di momen aman. Build 'dev' / server tanpa sha: diabaikan.
   */
  private async cekServer(paksa = false) {
    if (!navigator.onLine || !bolehCek(this.terakhirCekServer, Date.now(), paksa)) return;
    this.terakhirCekServer = Date.now();
    let isi: unknown;
    try {
      const resp = await fetch('/healthz', { cache: 'no-store' });
      if (!resp.ok) return;
      isi = await resp.json();
    } catch {
      return;
    }
    if (!serverBeda(BUILD, isi)) return;
    if (this.regSW) await this.cekSW(true);
    else if (!('serviceWorker' in navigator)) this.pembaruan.perluMuatUlangBiasa();
  }

  /** Keadaan aplikasi untuk keputusan pembaruan (lihat momenPembaruan di pembaruan.ts). */
  private keadaanPembaruan(): KeadaanPembaruan {
    // Meja dinilai dari yang tampil (KontrolMeja), bukan this.view: view terbaru bisa sudah 'selesai'
    // padahal panel mentung atau animasi akhir putaran masih di layar.
    const tampil = this.layar === 'meja' ? this.kontrol?.keadaanTampil() : undefined;
    return {
      layar: this.layar,
      jenis: this.koneksi?.jenis ?? null,
      statusMeja: tampil?.status ?? null,
      mejaSiap: !!this.kontrol,
      mejaSibuk: tampil?.sibuk ?? false,
      klasemenTampil: tampil?.klasemen ?? false,
      selesaiTercatat: this.sudahDicatat,
      dialogTerbuka: dialogTerbuka(),
      modalTerbuka: modalTerbuka(),
      sedangMengetik: adaIsianAktif(),
      menungguServer: !!this.niatOnline && this.koneksi?.jenis === 'online',
    };
  }

  /** Layar/view berganti: momen aman untuk memasang versi baru mungkin sudah tiba. */
  private nilaiPembaruan() {
    this.pembaruan.nilai();
  }

  // ---------- tombol Back ----------

  /**
   * Back (Android/browser) tidak langsung keluar aplikasi: tutup dialog teratas → tutup modal yang
   * boleh ditutup → di meja/lobi minta konfirmasi keluar → layar lain kembali ke beranda.
   * Caranya: selalu ada satu entri riwayat "penjaga" di atas entri dasar; Back memakan penjaga itu,
   * lalu penjaga dipasang lagi. Di beranda tanpa jendela terbuka, penjaga tidak dipasang lagi,
   * jadi Back berikutnya keluar seperti biasa.
   */
  private pasangTombolKembali() {
    window.addEventListener('popstate', () => {
      this.adaJaga = false;
      void this.tanganiKembali();
    });
    // Jendela baru (modal/dialog) atau pindah layar: pastikan Back tertangkap lagi.
    const amati = new MutationObserver(() => {
      if (adaJendelaTerbuka()) this.pastikanJaga();
    });
    for (const id of ['modal', 'lapisan-dialog']) {
      const el = document.getElementById(id);
      if (el) amati.observe(el, { childList: true });
    }
  }

  private pastikanJaga() {
    if (this.adaJaga) return;
    this.adaJaga = true;
    history.pushState({ remiJaga: true }, '');
  }

  /** Tutup jendela teratas kalau boleh ditutup. True kalau ada yang ditutup. */
  private tutupJendelaTeratas(): boolean {
    const lapisan = document.getElementById('lapisan-dialog');
    const modal = document.getElementById('modal');
    const wadah = lapisan?.lastElementChild ? lapisan : modal?.firstElementChild ? modal : null;
    const latar = wadah?.lastElementChild as HTMLElement | null | undefined;
    if (!wadah || !latar) return false;
    const sebelum = wadah.childElementCount;
    // Sama seperti mengetuk latar: jendela wajib (popup joker, panel mentung) tidak ikut tertutup.
    latar.click();
    return wadah.childElementCount < sebelum || !latar.isConnected;
  }

  private async tanganiKembali() {
    if (adaJendelaTerbuka()) {
      if (this.tutupJendelaTeratas() || this.layar !== 'meja') return this.pastikanJaga();
    }
    switch (this.layar) {
      case 'beranda':
        // Penjaga sudah terpakai: Back berikutnya keluar dari aplikasi.
        return toast('Tekan Back sekali lagi untuk keluar.', false, 2000);
      case 'publik':
      case 'riwayat':
        this.pastikanJaga();
        return this.tampilkanBeranda();
      case 'lobi':
      case 'meja':
        this.pastikanJaga();
        return this.konfirmasiKeluar(this.layar);
    }
  }

  /** Minta konfirmasi lalu keluar dari lobi/meja (Back, atau tombol beranda di galat meja). */
  private async konfirmasiKeluar(asal: 'lobi' | 'meja') {
    const offline = this.jenis === 'offline';
    // Teks sama dengan tombol keluar di lobi dan menu meja (ui/lobi.ts).
    const ya = await konfirmasi(
      opsiKonfirmasiKeluar({
        asal,
        offline,
        selesai: asal === 'meja' && this.view?.status === 'selesai',
        masukPeringkat: asal === 'meja' && !offline && mejaMasukPeringkat(this.info),
      }),
    );
    // Layar sudah berganti selagi dialog terbuka (mis. host memulai permainan dari lobi):
    // teks konfirmasinya sudah tidak berlaku, jadi jangan keluar.
    if (!ya || this.layar !== asal) return;
    if (!offline) this.kirim({ t: 'keluar' });
    this.keluarMeja();
  }

  // ---------- koneksi ----------

  private pasangKoneksi(k: Koneksi) {
    this.koneksi?.tutup();
    this.koneksi = k;
    this.info = null;
    this.view = null;
    this.statusKini = 'menyambung';
    k.saatPesan((p) => {
      if (this.koneksi === k) this.terimaPesan(p);
    });
    const pemicuCek = new PemicuCekServer();
    k.saatStatus((s) => {
      if (this.koneksi !== k || k.jenis === 'offline') return;
      const sebelum = this.statusKini;
      this.statusKini = s;
      if (s === 'tersambung' && sebelum !== 'tersambung') this.sambunganKe++;
      this.saatStatusBerubah(s, sebelum);
      // Baru tersambung ke server: pastikan client ini build yang sama dengan server. Sambung LAGI
      // sesudah putus (server bisa saja baru di-deploy ulang) dicek tanpa jeda minimum.
      const paksa = pemicuCek.status(s);
      if (paksa !== null && sebelum !== 'tersambung') void this.cekServer(paksa);
    });
  }

  private saatStatusBerubah(s: StatusKoneksi, sebelum: StatusKoneksi) {
    if (this.layar === 'beranda' || this.layar === 'publik') {
      if (s !== 'gagal') {
        this.beranda?.aturStatusOnline(s === 'terputus' ? 'menyambung' : s);
        return;
      }
      // Jangan coba terus di belakang layar dari beranda: niat yang tertahan bisa tiba-tiba
      // terkirim lama kemudian. Pemain bisa menekan "Coba lagi" kapan saja.
      this.koneksi?.tutup();
      this.koneksi = null;
      const cobaLagi = this.niatOnline ? () => this.cobaLagiOnline() : null;
      if (this.layar === 'beranda' && this.beranda) {
        this.beranda.aturStatusOnline('gagal', cobaLagi);
        // Pembaca layar tetap diberi tahu; toast (identik tidak menumpuk) hanya kalau pesannya tak terlihat.
        if (this.beranda.pesanGagalTerlihat()) umumkan(PESAN_SERVER_GAGAL, true);
        else toast(PESAN_SERVER_GAGAL, true, TOAST_GAGAL_BERANDA_MS);
      } else {
        toast(PESAN_SERVER_GAGAL, true, 8000, cobaLagi ? { label: 'Coba lagi', jalankan: cobaLagi } : undefined);
      }
      return;
    }
    // Di meja, indikator koneksi di bar atas (KontrolMeja membaca statusKoneksi()) sudah memberi tahu.
    if (this.layar === 'meja') return;
    if (s === 'terputus' && sebelum !== 'terputus') toast('Koneksi putus, mencoba menyambung lagi…', true);
    if (s === 'tersambung' && (sebelum === 'terputus' || sebelum === 'gagal')) toast('Tersambung lagi.');
  }

  private cobaLagiOnline() {
    const niat = this.niatOnline;
    // Tombol "Coba lagi" yang basi (pemain sudah pindah ke meja/lobi) tidak boleh mengganti koneksi.
    if (!niat || (this.layar !== 'beranda' && this.layar !== 'publik')) return;
    if (this.layar === 'beranda') this.beranda?.aturStatusOnline('menyambung');
    niat();
  }

  private pakaiOnline(): Koneksi {
    if (this.koneksi?.jenis !== 'online') this.pasangKoneksi(new KoneksiOnline(urlServer(), () => simpan.nama() || 'Pemain'));
    return this.koneksi!;
  }

  /** Kirim pesan online dari beranda; diingat untuk "Coba lagi" kalau server tidak terjangkau. */
  private kirimOnline(p: PesanKlien) {
    this.niatOnline = () => this.pakaiOnline().kirim(p);
    this.niatOnline();
  }

  kirim(p: PesanKlien) {
    const k = this.koneksi;
    if (p.t === 'keluar' && k?.jenis === 'online' && !k.siapKirim()) {
      // Tidak diantrikan: pemanggil langsung menutup koneksi lewat keluarMeja(). Ingat untuk
      // memberi tahu pemain bahwa kursinya belum dilepas.
      this.keluarTakSampai = this.layar === 'lobi' ? 'lobi' : 'meja';
      return;
    }
    k?.kirim(p);
  }

  private terimaPesan(p: PesanServer) {
    switch (p.t) {
      case 'meja':
        this.info = p.info;
        this.niatOnline = null;
        if (p.info.status === 'lobi') this.tampilkanLobi();
        else this.tampilkanMeja();
        // View 'selesai' bisa datang lebih dulu dari info meja (kode & kursi bot): catat sekarang.
        this.catatJikaSelesai();
        break;
      case 'view':
        this.view = p.view;
        this.catatJikaSelesai();
        if (this.layar === 'meja') this.kontrol?.perbarui(null, p.view);
        this.nilaiPembaruan();
        break;
      case 'error':
        if (p.pesan.includes('nggak ketemu') && simpan.sesi()) {
          simpan.setSesi(null);
          // Meja hilang biasanya karena server dinyalakan ulang, sering kali dengan build baru: cek
          // sekarang juga (tanpa jeda minimum), supaya versi baru dipasang begitu pemain di beranda.
          void this.cekServer(true);
          if (this.layar === 'beranda') {
            this.beranda?.aturStatusOnline('siap');
            return toast('Meja terakhir sudah tidak ada.');
          }
          // Meja hilang (mis. server baru dinyalakan ulang) padahal layar lobi/meja masih tampil.
          if (this.layar === 'lobi' || this.layar === 'meja') {
            toast('Mejanya sudah bubar, Bos. Balik ke beranda ya.', true);
            return this.keluarMeja();
          }
        }
        if (this.layar === 'beranda') this.beranda?.aturStatusOnline('tersambung');
        toast(p.pesan, true);
        break;
      case 'daftar':
        this.layar = 'publik';
        this.niatOnline = null;
        this.sembunyikanGame();
        suasanaMusik('beranda');
        renderDaftarPublik(
          this.ui,
          p.meja,
          (kode) => this.gabung(simpan.nama() || 'Pemain', kode),
          // Lewat kirimOnline: kalau koneksi sudah ditutup karena gagal, "Segarkan" menyambung lagi.
          () => this.kirimOnline({ t: 'daftar' }),
          () => this.tampilkanBeranda(),
        );
        this.pastikanJaga();
        break;
      case 'emote':
        this.kontrol?.terimaEmote(p.kursi, p.isi);
        break;
      case 'keluar':
        toast(p.alasan);
        this.keluarMeja(!p.alasan.includes('tab atau perangkat lain'));
        break;
      default:
        break;
    }
  }

  private catatJikaSelesai() {
    const v = this.view;
    if (!v) return;
    if (v.status !== 'selesai') {
      this.sudahDicatat = false;
      return;
    }
    if (this.sudahDicatat) return;
    // Butuh info meja (kode untuk penanda online, kursi untuk tanda bot); dicoba lagi saat datang.
    if (!this.info) return;
    this.sudahDicatat = true;
    if (this.tutorial) {
      // Latihan tidak dicatat di riwayat/statistik. Tutorial baru ditandai tuntas oleh KontrolMeja
      // setelah penutupnya tampil di klasemen akhir (keluar sebelum itu: latihan ditawarkan lagi).
      tulisLatihan(false);
    } else {
      // Online: meja yang selesai tetap ada di server dan sesinya disambung lagi tiap aplikasi
      // dibuka, jadi view 'selesai' yang sama bisa datang berkali-kali. Penanda persisten
      // mencegah klasemennya tercatat ulang. Offline tidak perlu: simpanannya dihapus di bawah.
      const kunci = this.jenis === 'online' ? kunciPermainan(this.info.kode, v) : null;
      simpan.tambahRiwayat(catatanDariView(v, this.jenis, this.info.kursi, Date.now()), kunci);
    }
    if (this.jenis === 'offline') simpan.setMejaOffline(null);
  }

  // ---------- layar ----------

  /** Beranda ditinggalkan / diganti: lepas pendengarnya supaya tidak menumpuk. */
  private tinggalkanBeranda() {
    this.beranda?.lepas();
    this.beranda = null;
  }

  private sembunyikanGame() {
    this.kontrol?.hancurkan();
    this.kontrol = null;
    this.mejaTertunda = false;
    this.tinggalkanBeranda();
    this.elGame.style.visibility = 'hidden';
    // Meja tidak tampil: hentikan loop Phaser supaya HP tidak menggambar kanvas tersembunyi.
    if (this.game) tidurkanGame(this.game.game);
    void this.wakeLock?.release().catch(() => undefined);
    this.wakeLock = null;
  }

  private tampilkanBeranda() {
    this.layar = 'beranda';
    this.sembunyikanGame();
    tutupModal();
    suasanaMusik('beranda');
    const online: StatusOnline = !navigator.onLine
      ? 'offline'
      : this.koneksi?.jenis === 'online' && this.statusKini !== 'tersambung'
        ? 'menyambung'
        : 'siap';
    this.beranda = renderBeranda(
      this.ui,
      {
        buatMeja: (nama) => this.kirimOnline({ t: 'buat', nama, pengaturan: { jumlahPemain: 4 } }),
        gabung: (nama, kode) => this.gabung(nama, kode),
        lihatPublik: () => this.kirimOnline({ t: 'daftar' }),
        lihatRiwayat: () => {
          this.layar = 'riwayat';
          this.tinggalkanBeranda();
          renderRiwayat(this.ui, () => this.tampilkanBeranda());
          this.pastikanJaga();
        },
        mainOffline: (nama, pengaturan, pengocokSaya) => this.mainOffline(nama, pengaturan, pengocokSaya),
        lanjutOffline: () => this.lanjutOffline(),
        latihan: (nama) => this.mulaiLatihan(nama),
        bantuan: () => bukaBantuan(),
        pengaturan: () =>
          bukaPengaturan({
            mulaiLatihan: () => this.mulaiLatihan(simpan.nama() || 'Pemain'),
            // Gerbang yang sama dengan tombol latihan di beranda: simpanan offline tidak hilang diam-diam.
            bolehLatihan: () => konfirmasiTimpaSimpanan('Latihan pakai slot simpanan yang sama.'),
          }),
        tentang: () => bukaTentang(),
        pasangAplikasi: this.aksiPasang(),
        muatUlang: this.pembaruan.tombol(),
      },
      { kodeAwal: this.kodeAwal, statusOnline: online },
    );
    // Versi baru yang tertunda (mis. keluar dari meja di tengah putaran) dipasang/ditawarkan sekarang.
    this.nilaiPembaruan();
  }

  /** Aksi tombol "Pasang ke layar utama", atau null kalau browser belum menawarkan pemasangan. */
  private aksiPasang(): (() => void) | null {
    if (!this.promptPasang) return null;
    return () => {
      void this.promptPasang?.prompt();
      this.promptPasang = null;
      this.beranda?.aturPasang(null);
    };
  }

  private gabung(nama: string, kodeMentah: string) {
    const kode = kodeMentah.trim().toUpperCase();
    if (!/^[A-Z0-9]{5}$/.test(kode)) {
      this.beranda?.aturStatusOnline(navigator.onLine ? 'siap' : 'offline');
      return toast('Kode meja 5 huruf/angka, Bos.', true);
    }
    const sesi = simpan.sesi();
    this.kirimOnline({ t: 'gabung', kode, nama, token: sesi?.kode === kode ? sesi.token : undefined });
  }

  private mainOffline(nama: string, pengaturan: Partial<PengaturanMeja>, pengocokSaya: boolean, latihan = false) {
    this.niatOnline = null;
    simpan.setMejaOffline(null);
    this.modeLatihan = latihan;
    tulisLatihan(latihan);
    // Latihan: nama warga kedai urutan tetap (lawannya selalu sama); main biasa: urutan acak.
    this.pasangKoneksi(KoneksiOffline.baru(nama, pengaturan, pengocokSaya ? 0 : undefined, { urutanNamaTetap: latihan }));
  }

  private mulaiLatihan(nama: string) {
    this.mainOffline(nama, PENGATURAN_LATIHAN, true, true);
  }

  private lanjutOffline() {
    const k = KoneksiOffline.lanjutkan();
    if (!k) {
      toast('Simpanan permainannya sudah nggak bisa dilanjutkan, jadi dihapus.', true);
      tulisLatihan(false);
      return this.tampilkanBeranda();
    }
    this.modeLatihan = bacaLatihan();
    this.niatOnline = null;
    this.pasangKoneksi(k);
  }

  mainLagiOffline() {
    this.mainOffline(simpan.nama() || 'Pemain', simpan.pengaturanOffline(), false);
  }

  keluarMeja(hapusSesi = true) {
    const takSampai = this.keluarTakSampai;
    this.keluarTakSampai = null;
    if (this.koneksi?.jenis === 'online' && hapusSesi) simpan.setSesi(null);
    this.koneksi?.tutup();
    this.koneksi = null;
    this.info = null;
    this.view = null;
    this.kodeAwal = '';
    this.niatOnline = null;
    history.replaceState(history.state, '', location.pathname);
    this.tampilkanBeranda();
    if (takSampai) toast(PESAN_KELUAR_TAK_SAMPAI[takSampai], true, 9000);
  }

  private tampilkanLobi() {
    // Dialog dari layar lain (mis. menu meja) tidak ikut terbawa ke lobi.
    if (this.layar !== 'lobi') tutupSemuaJendela();
    this.layar = 'lobi';
    this.sembunyikanGame();
    tutupModal();
    suasanaMusik('beranda');
    renderLobi(this.ui, this.info!, (p) => this.kirim(p), () => {
      this.kirim({ t: 'keluar' });
      this.keluarMeja();
    });
    this.pastikanJaga();
    this.nilaiPembaruan();
  }

  private tampilkanMeja() {
    if (this.layar === 'meja') {
      if (this.kontrol) return this.kontrol.perbarui(this.info, null);
      // Pemuat/galat sedang tampil: info terbaru sudah di this.info, dipakai saat meja siap.
      if (this.mejaTertunda) return;
    }
    // Dialog milik layar sebelumnya (mis. konfirmasi "Keluar dari meja?" di lobi saat host
    // memulai) tidak boleh ikut melayang di atas meja dengan teks yang sudah tidak berlaku.
    if (this.layar !== 'meja') tutupSemuaJendela();
    this.layar = 'meja';
    this.tinggalkanBeranda();
    this.elGame.style.visibility = 'visible';
    suasanaMusik('meja');
    this.siapkanMeja();
    window.dispatchEvent(new Event('resize'));
    this.mintaWakeLock();
    this.pastikanJaga();
  }

  /**
   * Pasang KontrolMeja begitu Phaser siap. Selama chunk Phaser diunduh (kunjungan pertama, sinyal lambat)
   * tampil pemuat "Nyiapin meja…"; kalau gagal dimuat, tampil galat dengan "Coba lagi" dan "Kembali ke
   * beranda" (simpanan offline tetap ada), bukan kanvas kosong tanpa jalan keluar.
   * `ulang`: percobaan dari tombol Coba lagi; kalau gagal lagi padahal sinyal ada, halaman dimuat ulang
   * (Chrome mengingat import() yang gagal per URL, jadi import ulang saja tidak cukup).
   */
  private siapkanMeja(ulang = false) {
    const nomor = ++this.nomorMuatMeja;
    // Game yang sudah ada dibangunkan; game baru menyalakan loop-nya sendiri saat boot.
    if (this.game) bangunkanGame(this.game.game);
    else this.game = buatGame(this.elGame);
    const penampung = this.game;
    const akar = this.ui;
    this.mejaTertunda = true;
    // Kalau Phaser sudah siap, pemuat ini diganti KontrolMeja di microtask yang sama (tidak sempat tampil).
    renderPemuatMeja(akar);
    penampung.scene.then(
      (scene) => {
        // Sudah pindah layar sebelum Phaser siap: tidurkan lagi loop yang baru menyala.
        if (this.layar !== 'meja') return tidurkanGame(penampung.game);
        if (nomor !== this.nomorMuatMeja || this.kontrol) return;
        this.mejaTertunda = false;
        this.kontrol = new KontrolMeja(this, scene, akar);
        this.kontrol.perbarui(this.info, this.view);
      },
      async (e: unknown) => {
        console.error('meja gagal dimuat', e);
        // Percobaan berikutnya membuat game baru (import ulang), bukan menunggu promise yang sudah ditolak.
        if (this.game === penampung) this.game = null;
        if (nomor !== this.nomorMuatMeja || this.layar !== 'meja' || this.kontrol) return;
        const pernahGagal = this.mejaPernahGagal;
        this.mejaPernahGagal = true;
        if ((ulang || pernahGagal) && (await adaJaringan())) {
          if (nomor === this.nomorMuatMeja && this.layar === 'meja') {
            // Sesudah dimuat ulang, permainan offline langsung dilanjutkan (sesi online tersambung lagi sendiri).
            if (this.jenis === 'offline') tandaiLanjutSetelahMuatUlang();
            location.reload();
          }
          return;
        }
        if (nomor !== this.nomorMuatMeja || this.layar !== 'meja') return;
        this.tampilkanGalatMeja(ulang ? PESAN_MEJA_MASIH_PUTUS : undefined);
      },
    );
  }

  private tampilkanGalatMeja(pesan?: string) {
    this.mejaTertunda = true;
    const nomor = this.nomorMuatMeja;
    const galat = renderGalatMeja(this.ui, {
      pesan,
      cobaLagi: async () => {
        galat.aturSibuk(true);
        const nyambung = await adaJaringan();
        // Pemain sudah keluar dari meja (Back) atau percobaan lain sudah berjalan.
        if (nomor !== this.nomorMuatMeja || this.layar !== 'meja' || !galat.el.isConnected) return;
        galat.aturSibuk(false);
        if (!nyambung) return galat.aturPesan(PESAN_MEJA_MASIH_PUTUS);
        this.siapkanMeja(true);
      },
      keBeranda: () => void this.konfirmasiKeluar('meja'),
    });
  }

  private mintaWakeLock() {
    if (this.wakeLock) return;
    const nav = navigator as Navigator & { wakeLock?: { request(t: 'screen'): Promise<{ release(): Promise<void> }> } };
    void nav.wakeLock
      ?.request('screen')
      .then((w) => {
        // Sudah pindah layar selagi menunggu izin: lepas lagi.
        if (this.layar !== 'meja') return void w.release().catch(() => undefined);
        this.wakeLock = w;
        (w as unknown as EventTarget).addEventListener?.('release', () => {
          if (this.wakeLock === w) this.wakeLock = null;
        });
      })
      .catch(() => undefined);
  }
}

pasangLandmarkUtama();
const aplikasi = new Aplikasi();
aplikasi.mulai();

// Penanda sekali pakai (sessionStorage, hanya tab ini) bahwa halaman dimuat ulang untuk melanjutkan meja offline.
function tandaiLanjutSetelahMuatUlang(): void {
  try {
    sessionStorage.setItem(KUNCI_LANJUT, '1');
  } catch {
    // Penyimpanan sesi tidak tersedia: pemain tinggal menekan Lanjutkan di beranda.
  }
}

function ambilLanjutSetelahMuatUlang(): boolean {
  try {
    const ada = sessionStorage.getItem(KUNCI_LANJUT) === '1';
    sessionStorage.removeItem(KUNCI_LANJUT);
    return ada;
  } catch {
    return false;
  }
}
/** sessionStorage, atau null kalau tidak bisa diakses (mode privat tertentu, data situs diblokir). */
function penyimpananSesi(): PenyimpananSesi | null {
  try {
    return window.sessionStorage;
  } catch {
    return null;
  }
}

/** Hapus toast dengan teks tertentu (mis. "Pakai versi terbaru…" yang dibatalkan karena pemain menyentuh layar). */
function hapusToast(pesan: string): void {
  for (const el of document.querySelectorAll<HTMLElement>('#toast .toast')) if (el.dataset.pesan === pesan) el.remove();
}

siapkanJendelaMalas();
// Untuk debug/uji saat pengembangan (mis. cek aplikasi.tutorial dari Playwright).
if (import.meta.env.DEV) (window as unknown as { __remiApp: Aplikasi }).__remiApp = aplikasi;
