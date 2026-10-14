// Layar meja: bar atas, bar aksi, jendela (joker, mentung, hasil, skor, log, menu), keyboard,
// tutorial, dan penghubung ke scene Phaser.
// Semua aksi divalidasi dulu dengan fungsi mesin aturan yang sama dengan server,
// jadi tombol yang tidak sah menampilkan alasannya sebelum ada yang dikirim.

import {
  AturanError,
  deskripsiKartuJadi,
  maksimalMulung,
  namaKartu,
  namaRank,
  opsiPeranJoker,
  validasiBuang,
  validasiKartuJadi,
  validasiMulung,
  validasiTurunkan,
  SEMUA_BUNGA,
  type HasilPutaran,
  type HasilValidasiKartuJadi,
  type Kartu,
  type KonteksJoker,
  type SpesifikasiKartuJadi,
  type Peristiwa,
  type ViewPemain,
  berikutnya,
} from '@remi/engine';
import { DAFTAR_EMOTE, type Emote, type InfoMeja, type PesanKlien, type TempoBot } from '@remi/meja';
import type { StatusKoneksi } from './koneksi';
import type { AksiAdegan, KotakLayar, MejaScene, ModelMeja } from './game/MejaScene';
import { gambarKartuKeKanvas } from './game/kartuGrafisGambar';
import { PENANDA_WARGA_KEDAI } from './game/tataMeja';
import { adaJendelaTerbuka, bukaDialog, bukaModal, esc, konfirmasi, modalTerbuka, toast, tutupModal, tutupSemuaJendela, umumkan } from './ui/dom';
import {
  htmlKartuJadiAsal,
  htmlKlasemen,
  htmlLog,
  htmlPeringkat,
  htmlRincianPutaran,
  htmlRingkasPutaranTerakhir,
  htmlRiwayat,
  angkaSkor,
  peringkatSeri,
  tanda,
  teksCaraSelesai,
} from './ui/rincianSkor';
import { opsiKonfirmasiKeluar } from './ui/lobi';
import { ATRIBUT_LUAR, KEDAI, TAUTAN_KEDAI } from './konten/kedai';
import { bukaPengaturan } from './ui/pengaturan';
import { bukaBantuan, bukaTentang } from './ui/jendelaMalas';
import { teksPengumuman, Tutorial, type KeadaanTutorial } from './ui/tutorial';
import { TEKS_TUTORIAL } from './konten/tutorial';
import { simpan } from './penyimpanan';
import { gerakDikurangi } from './preferensi';
import { durasi } from './gerak';
import { PemutarPeristiwa, labelKartu } from './efek/pemutar';
import { bersihkanSorak } from './efek/sorak';
import { bunyi, getar } from './efek/suara';

export interface AppUntukMeja {
  readonly jenis: 'online' | 'offline';
  kirim(p: PesanKlien): void;
  keluarMeja(): void;
  mainLagiOffline(): void;
  /** Permainan latihan dengan panduan (tutorial coach mark). */
  readonly tutorial?: boolean;
  /** Status koneksi saat ini (online); offline selalu 'tersambung'. */
  statusKoneksi?(): StatusKoneksi;
  /** Nomor sambungan online: naik setiap kali tersambung (lagi) ke server. Offline: tidak ada (0). */
  nomorSambungan?(): number;
}

interface Mulung {
  jumlah: number;
  kombinasi: SpesifikasiKartuJadi[];
}

type Urutan = 'bunga' | 'angka' | 'manual';

interface StatusTombol {
  aktif: boolean;
  alasan: string;
}

interface DaftarStatus {
  ambil: StatusTombol;
  mulung: StatusTombol;
  turunkan: StatusTombol;
  buang: StatusTombol;
  selesai: StatusTombol;
  /** Membuang kartu yang tersisa sekarang berarti mentung (menurut validasiBuang mesin aturan). */
  mentung: boolean;
}

function coba<T>(f: () => T): { ok: true; nilai: T } | { ok: false; pesan: string } {
  try {
    return { ok: true, nilai: f() };
  } catch (e) {
    if (e instanceof AturanError) return { ok: false, pesan: e.pesan };
    throw e;
  }
}

// ---------- keyboard ----------

/** Pintasan huruf → tombol bar aksi (data-a). Satu sumber untuk handler, aria-keyshortcuts, dan daftar bantuan. */
export const PINTASAN_HURUF: Readonly<Record<string, string>> = {
  d: 'ambil',
  m: 'mulung',
  t: 'turunkan',
  b: 'buang',
  j: 'jadikan',
  k: 'konfirmasi',
  s: 'selesai',
  u: 'urut',
  h: 'hasil',
};

const HURUF_AKSI: Readonly<Record<string, string>> = Object.fromEntries(Object.entries(PINTASAN_HURUF).map(([h, a]) => [a, h.toUpperCase()]));

/** Daftar pintasan untuk jendela bantuan keyboard. */
export const DAFTAR_PINTASAN: readonly { tombol: string; arti: string }[] = [
  { tombol: '← →', arti: 'Pindah sorotan antar kartu tangan (atau deck ↔ buangan)' },
  { tombol: '↑ ↓', arti: 'Pindah antara tangan dan deck/buangan' },
  { tombol: 'Home End', arti: 'Kartu paling kiri / paling kanan' },
  { tombol: 'Spasi / Enter', arti: 'Ketuk yang disorot: pilih kartu, ambil deck, mungut' },
  { tombol: '1–9', arti: 'Mungut sejumlah kartu teratas buangan (waktu giliran ambil)' },
  { tombol: 'D', arti: 'Ambil dari deck' },
  { tombol: 'M', arti: 'Mulung (lalu ketuk kartu buangan atau tekan angka)' },
  { tombol: 'J', arti: 'Jadikan kombinasi mulung dari kartu yang dipilih' },
  { tombol: 'K', arti: 'Konfirmasi mulung' },
  { tombol: 'T', arti: 'Turunkan kartu jadi dari kartu yang dipilih' },
  { tombol: 'B', arti: 'Buang kartu yang dipilih (atau mentung)' },
  { tombol: 'S', arti: 'Selesai menyusun (susun akhir)' },
  { tombol: 'U', arti: 'Urutkan kartu (bunga / angka)' },
  { tombol: 'H', arti: 'Buka hasil putaran / klasemen' },
  { tombol: 'Backspace', arti: 'Batalkan kombinasi mulung terakhir' },
  { tombol: 'Esc', arti: 'Batal mulung / lepas semua pilihan' },
  { tombol: '?', arti: 'Daftar pintasan ini' },
];

export type ArahFokus = 'kiri' | 'kanan' | 'atas' | 'bawah' | 'awal' | 'akhir';

const TENGAH = ['deck', 'buangan'] as const;
const diTengah = (f: string | null): f is 'deck' | 'buangan' => f === 'deck' || f === 'buangan';

/**
 * Sorotan keyboard berikutnya. `deret` = kartu tangan (+ kartu pungutan saat mulung) sesuai urutan
 * di layar; baris tengah = deck dan buangan. `ingat` = indeks terakhir di tangan (untuk kembali
 * dari baris tengah, atau kalau kartu yang disorot baru saja dibuang). Tidak berputar di ujung.
 * `mati`: sasaran baris tengah yang sedang tidak bisa diapa-apakan (deck di luar tahap ambil
 * giliranku atau deck habis, buangan kosong). Sorotan yang tertinggal di sana dibawa ke tangan oleh
 * ↓, Home, dan End, supaya pemain langsung bisa memilih kartu. Kiri/kanan tetap di baris tengah.
 */
export function geserFokus(fokus: string | null, arah: ArahFokus, deret: readonly string[], ingat = 0, mati: readonly string[] = []): string | null {
  const n = deret.length;
  const dekat = n ? Math.min(Math.max(0, ingat), n - 1) : 0;
  if (fokus !== null && mati.includes(fokus) && n) {
    if (arah === 'awal') return deret[0];
    if (arah === 'akhir') return deret[n - 1];
    if (arah === 'bawah') return deret[dekat];
  }
  if (diTengah(fokus)) {
    const i = TENGAH.indexOf(fokus);
    if (arah === 'kiri' || arah === 'awal') return TENGAH[arah === 'awal' ? 0 : Math.max(0, i - 1)];
    if (arah === 'kanan' || arah === 'akhir') return TENGAH[arah === 'akhir' ? 1 : Math.min(1, i + 1)];
    if (arah === 'bawah') return n ? deret[dekat] : fokus;
    return fokus;
  }
  if (!n) return arah === 'atas' || fokus === null ? 'deck' : fokus;
  const i = fokus === null ? -1 : deret.indexOf(fokus);
  switch (arah) {
    case 'atas':
      return 'deck';
    case 'awal':
      return deret[0];
    case 'akhir':
      return deret[n - 1];
    case 'kiri':
      return deret[i < 0 ? dekat : Math.max(0, i - 1)];
    case 'kanan':
      return deret[i < 0 ? dekat : Math.min(n - 1, i + 1)];
    case 'bawah':
      return deret[i < 0 ? dekat : i];
  }
}

const PANAH: Readonly<Record<string, ArahFokus>> = {
  ArrowLeft: 'kiri',
  ArrowRight: 'kanan',
  ArrowUp: 'atas',
  ArrowDown: 'bawah',
  Home: 'awal',
  End: 'akhir',
};

// ---------- animasi angka ----------

/**
 * Angka [data-nilai] di dalam `akar` dihitung naik dari 0 ke nilainya. Format: tanda (+12/−7),
 * atau angka polos untuk [data-polos]. Gerak dikurangi = langsung nilai akhir.
 * Cadangan: kalau frame animasi berhenti (aplikasi di latar belakang), nilai akhir tetap dipasang.
 */
function hitungNaik(akar: ParentNode, ms: number): void {
  const el = [...akar.querySelectorAll<HTMLElement>('[data-nilai]')];
  if (!el.length) return;
  const tulis = (e: HTMLElement, x: number) => (e.textContent = e.hasAttribute('data-polos') ? angkaSkor(x) : tanda(x));
  const akhir = () => el.forEach((e) => tulis(e, Number(e.dataset.nilai)));
  if (gerakDikurangi() || ms <= 0) return akhir();
  let selesai = false;
  const mulai = performance.now();
  const langkah = (t: number) => {
    if (selesai) return;
    const f = Math.min(1, Math.max(0, (t - mulai) / ms));
    const e = 1 - Math.pow(1 - f, 3);
    el.forEach((x) => tulis(x, Math.round(Number(x.dataset.nilai) * e)));
    if (f < 1) requestAnimationFrame(langkah);
    else selesai = true;
  };
  el.forEach((x) => tulis(x, 0));
  requestAnimationFrame(langkah);
  setTimeout(() => {
    if (selesai) return;
    selesai = true;
    akhir();
  }, ms + 300);
}

/** Lebar kartu besar di popup (px CSS), menyesuaikan layar. */
function lebarKartuPamer(): number {
  return Math.round(Math.max(72, Math.min(150, window.innerWidth * 0.36, window.innerHeight * 0.2)));
}

const LABEL_KONEKSI: Record<StatusKoneksi, string> = {
  menyambung: 'Menyambung…',
  tersambung: 'Tersambung',
  terputus: 'Terputus',
  gagal: 'Gagal nyambung',
};

const LABEL_TEMPO: Record<TempoBot, string> = { santai: 'santai', normal: 'normal', cepat: 'cepat' };

/** Batas waktu tombol "Mengirim…" sebelum bisa ditekan lagi (kalau server tidak menjawab). */
const BATAS_KIRIM_MS = 6000;

/**
 * Batas waktu kunci bar aksi sesudah aksi giliran dikirim. Normalnya kunci lepas begitu view
 * berikutnya datang; ini cadangan kalau server menolak (cuma kirim error) atau koneksi lambat.
 */
const BATAS_AKSI_MS = 3000;

/** Cadangan animasi kocok & bagi: kalau frame berhenti, antrian tetap jalan (bagiKartu sendiri ±6 dtk). */
const BATAS_BAGI_MS = 8000;

/** Janji yang selalu selesai paling lambat `ms` (cadangan animasi; kalau rAF berhenti, antrian tidak macet). */
function denganBatas(p: Promise<void>, ms: number): Promise<void> {
  let t: ReturnType<typeof setTimeout> | undefined;
  const cadangan = new Promise<void>((ok) => (t = setTimeout(ok, ms)));
  return Promise.race([p, cadangan]).finally(() => clearTimeout(t));
}

/**
 * View pertama (baru masuk meja): peristiwa 'mulaiPutaran' putaran ini masih perlu dianimasikan
 * (kocok & bagi) kalau belum ada kejadian lain sesudahnya dan aku belum melihat pengumuman joker.
 * Habis reload di tengah putaran (sudah ada aksi, atau joker sudah kutekan OK), kejadian lama
 * tidak diputar ulang.
 */
export function peristiwaAwalPerluDiputar(v: ViewPemain, menungguJoker: readonly number[]): Peristiwa | null {
  const p = v.putaran;
  const akhir = v.peristiwa[v.peristiwa.length - 1];
  if (v.status !== 'putaranBerjalan' || !p || !akhir || v.saya === null) return null;
  if (akhir.jenis !== 'mulaiPutaran' || akhir.putaran !== p.nomor) return null;
  return menungguJoker.includes(v.saya) ? akhir : null;
}

/**
 * OK joker sudah kutekan untuk putaran ini, tapi server masih menunggu kursiku. Ini terjadi kalau
 * pesan siapJoker hilang karena sinyal putus (pesan aksi tidak diantrikan) lalu server memasukkan
 * kursiku lagi ke menungguJoker saat tersambung kembali. Popup tidak dibuka lagi (sudah dilihat),
 * jadi siapJoker dikirim ulang, sekali per sambungan, supaya meja tidak tertahan sampai batas waktu.
 */
export function perluKirimUlangSiapJoker(k: {
  view: ViewPemain | null;
  menungguJoker: readonly number[];
  /** Putaran yang popup jokernya sudah kutekan OK (-1 = belum ada). */
  jokerDiOk: number;
  status: StatusKoneksi;
  /** Nomor sambungan sekarang dan nomor sambungan tempat siapJoker terakhir dikirim. */
  sambungan: number;
  sambunganTerkirim: number | null;
}): boolean {
  const v = k.view;
  const p = v?.putaran;
  if (!v || !p || v.saya === null || v.status !== 'putaranBerjalan') return false;
  return (
    p.nomor === k.jokerDiOk &&
    k.menungguJoker.includes(v.saya) &&
    k.status === 'tersambung' &&
    k.sambungan !== k.sambunganTerkirim
  );
}

/**
 * Teks bar atas: nomor (dan batas) putaran dipisah dari jenis meja supaya di layar sempit nomor
 * putaran tetap terbaca (jenis meja yang mengalah: dipotong/ditumpuk lewat CSS).
 */
export function teksBarAtas(jenis: string, nomor: number | null, batas: number | null): { jenis: string; putaran: string } {
  return { jenis, putaran: nomor === null ? '' : `Putaran ${nomor}${batas ? `/${batas}` : ''}` };
}

export class KontrolMeja implements AksiAdegan {
  private info: InfoMeja | null = null;
  private view: ViewPemain | null = null;
  private dipilih = new Set<string>();
  private urutanManual: string[] = simpan.urutanTangan();
  private urutan: Urutan = 'manual';
  private pilihJumlah = false;
  private mulung: Mulung | null = null;
  private petunjuk = '';
  private petunjukSalah = false;
  private kunciGiliran = '';
  /** Putaran + status: pilihan kartu dilepas kalau ini berganti (bukan saat tahap ambil → main). */
  private kunciPilih = '';
  /** Giliran di view yang terakhir ditampilkan (pilihan dilepas saat giliranku berakhir). */
  private giliranLalu: number | null = null;
  /** Aksi giliran baru dikirim dan view jawabannya belum datang: bar aksi dikunci (anti-dobel). */
  private menungguJawaban: ReturnType<typeof setTimeout> | null = null;
  /** Teks petunjuk yang terakhir diukur (cek terpotong hanya saat teksnya berganti). */
  private petunjukTerukur = '';
  private kunciUmum = '';
  private hasilTerlihat = 0;
  private timerWaktu: ReturnType<typeof setInterval>;
  private readonly elAtas: HTMLElement;
  private readonly elAksi: HTMLElement;
  private readonly elInfo: HTMLElement;
  private readonly elKoneksi: HTMLElement;
  private readonly elWaktu: HTMLElement;
  private readonly elLangkah: HTMLElement;
  private readonly elPetunjuk: HTMLElement;
  private readonly elTombol: HTMLElement;
  private htmlLangkah = '';
  private htmlTombol = '';
  /** View yang belum ditampilkan; diputar berurutan supaya animasi tiap kejadian sempat terlihat. */
  private antrian: ViewPemain[] = [];
  private sedangMemutar = false;
  private idPeristiwa = -1;
  private pemutar: PemutarPeristiwa;
  private aksiTerakhir: Record<number, string> = {};
  /** Kartu yang sedang dianimasikan; tidak digambar di tangan/buangan sampai view berikutnya tampil. */
  private disembunyikan = new Set<string>();
  /** View yang kejadiannya sedang diputar (belum tampil). */
  private viewTertunda: ViewPemain | null = null;
  /** Sedang memutar animasi kejadian: tombol aksi dikunci supaya tidak menekan keadaan lama. */
  private animasi = false;
  private timerAksi = new Map<number, ReturnType<typeof setTimeout>>();
  private giliranSayaSebelumnya = false;
  private hancur = false;
  private emoteTertunda: [number, Emote][] = [];
  private timerDetak: ReturnType<typeof setInterval> | null = null;
  /** Klasemen akhir sudah ditampilkan untuk permainan yang selesai ini. */
  private selesaiDitampilkan = false;
  /** Putaran yang popup jokernya sudah kutekan OK (jangan dibuka lagi sambil menunggu server). */
  private jokerDiOk = -1;
  /** Nomor sambungan tempat siapJoker terakhir dikirim (lihat perluKirimUlangSiapJoker). */
  private siapJokerDiSambungan: number | null = null;
  /** Cadangan supaya popup joker tidak tertunda selamanya kalau antrian animasi macet. */
  private timerJoker: ReturnType<typeof setTimeout> | null = null;
  /** Nomor putaran yang hasilnya sudah dianimasikan (gambar ulang karena voting tidak mengulang). */
  private hasilDianimasikan = -1;
  /** Pesan dari tombol jendela yang baru dikirim (cegah kirim ganda): kunci → waktu kirim. */
  private tertunda = new Map<string, number>();
  private akhiriDiminta: boolean | null = null;
  /** Isi wadah tombol lanjut di modal hasil yang sedang terpasang (ganti hanya kalau berubah). */
  private htmlLanjutTerpasang = '';
  private timerTertunda: ReturnType<typeof setTimeout>[] = [];
  /** Sorotan keyboard: id kartu (tangan/pungutan), 'deck', 'buangan', atau null. */
  private fokus: string | null = null;
  private indeksFokus = 0;
  /** Sorotan baru digambar setelah pemain memakai panah; sentuhan/klik menyembunyikannya lagi. */
  private modusKeyboard = false;
  private statusKoneksi: StatusKoneksi | null = null;
  private peringatanWaktu = '';
  private readonly tutorial: Tutorial | null;
  private readonly pengamatUkuran: ResizeObserver | null;
  private readonly saatTombol = (e: KeyboardEvent) => this.tombolKeyboard(e);
  private readonly saatSentuh = () => {
    if (!this.modusKeyboard) return;
    this.modusKeyboard = false;
    this.render();
  };

  constructor(
    private readonly app: AppUntukMeja,
    private readonly scene: MejaScene,
    private readonly akar: HTMLElement,
  ) {
    akar.innerHTML = `
      <div class="bar-atas">
        <button type="button" class="tombol-ikon" data-a="menu" aria-label="Menu" aria-haspopup="dialog"><span aria-hidden="true">☰</span></button>
        <div class="info"></div>
        <span class="status-koneksi tersembunyi" role="img"></span>
        <button type="button" data-a="skor" aria-haspopup="dialog">Skor</button>
        <button type="button" data-a="log" aria-haspopup="dialog">Log</button>
        <button type="button" class="tombol-ikon" data-a="emote" aria-label="Kirim emote" aria-expanded="false"><span aria-hidden="true">😀</span></button>
        <div class="waktu tersembunyi" aria-hidden="true"><div></div></div>
      </div>
      <div class="bar-aksi">
        <div class="langkah"></div>
        <div class="petunjuk"></div>
        <div class="tombol-aksi" role="group" aria-label="Aksi giliran"></div>
      </div>`;
    this.elAtas = akar.querySelector('.bar-atas')!;
    this.elAksi = akar.querySelector('.bar-aksi')!;
    this.elInfo = this.elAtas.querySelector('.info')!;
    this.elKoneksi = this.elAtas.querySelector('.status-koneksi')!;
    this.elWaktu = this.elAtas.querySelector('.waktu')!;
    this.elLangkah = this.elAksi.querySelector('.langkah')!;
    this.elPetunjuk = this.elAksi.querySelector('.petunjuk')!;
    this.elTombol = this.elAksi.querySelector('.tombol-aksi')!;

    this.elAtas.addEventListener('click', (e) => {
      const b = (e.target as HTMLElement).closest<HTMLElement>('[data-a]');
      if (!b) return;
      bunyi('klik');
      if (b.dataset.a === 'menu') this.bukaMenu();
      else if (b.dataset.a === 'skor') this.bukaSkor();
      else if (b.dataset.a === 'log') this.bukaLog();
      else if (b.dataset.a === 'emote') this.bukaPaletEmote(e.detail === 0);
    });
    this.elTombol.addEventListener('click', (e) => {
      const b = (e.target as HTMLElement).closest<HTMLElement>('[data-a]');
      if (b) this.tekanTombol(b.dataset.a!);
    });
    this.elPetunjuk.addEventListener('click', () => this.ketukPetunjuk());
    this.elInfo.innerHTML = '<span class="info-jenis"></span><span class="info-putaran"></span>';

    this.timerWaktu = setInterval(() => this.detik(), 500);
    document.addEventListener('keydown', this.saatTombol);
    document.addEventListener('pointerdown', this.saatSentuh, true);

    // Tinggi bar HTML sebenarnya (ikut ukuran teks, safe area, dan isi) → ruang meja di scene.
    this.pengamatUkuran = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(() => this.ukurBar());
    this.pengamatUkuran?.observe(this.elAtas);
    this.pengamatUkuran?.observe(this.elAksi);

    this.tutorial = app.tutorial
      ? new Tutorial({
          akar,
          kotak: (s) => ('meja' in s ? this.scene.kotakLayar(s.meja, s.indeks) : this.kotakDom(s.dom)),
          saatBerubah: () => this.tampilkan(),
        })
      : null;

    this.pemutar = new PemutarPeristiwa({
      scene,
      nama: (i) => this.view?.pemain[i]?.nama ?? '',
      saya: () => this.saya,
      catatAksi: (pemain, teks) => this.catatAksi(pemain, teks),
      sembunyikan: (ids) => {
        ids.forEach((id) => this.disembunyikan.add(id));
        this.render();
      },
      tampakkan: (ids) => {
        ids.forEach((id) => this.disembunyikan.delete(id));
        this.render();
      },
      viewSekarang: () => this.view,
      viewBerikut: () => this.viewTertunda,
      terapkanViewBerikut: (sembunyi) => this.terapkanViewBerikut(sembunyi),
      panelMentung: (e) => this.panelMentung(e),
    });
  }

  hancurkan() {
    this.hancur = true;
    this.antrian = [];
    // Timer pemutar (mis. pelepas goyang layar sesudah mentung) dibatalkan, dan peristiwa yang sedang
    // diputar tidak lagi menyentuh scene/DOM.
    this.pemutar.hentikan();
    bersihkanSorak();
    this.timerAksi.forEach((t) => clearTimeout(t));
    this.timerTertunda.forEach((t) => clearTimeout(t));
    clearInterval(this.timerWaktu);
    if (this.timerDetak) clearInterval(this.timerDetak);
    if (this.timerJoker) clearTimeout(this.timerJoker);
    if (this.menungguJawaban) clearTimeout(this.menungguJawaban);
    document.removeEventListener('keydown', this.saatTombol);
    document.removeEventListener('pointerdown', this.saatSentuh, true);
    this.pengamatUkuran?.disconnect();
    // Tutorial dimatikan dulu supaya jendela yang ditutup di bawah tidak memicu langkah berikutnya.
    this.tutorial?.hancurkan();
    this.scene.pasang(null, this);
    this.akar.innerHTML = '';
    this.akar.style.removeProperty('--tinggi-bar-atas-ukur');
    // Semua jendela meja (modal utama + dialog Skor/Log/Pintasan/peran joker/rincian) ikut ditutup,
    // supaya tidak ada jendela basi di beranda/lobi dan #ui tidak tertinggal inert.
    tutupSemuaJendela();
  }

  perbarui(info: InfoMeja | null, view: ViewPemain | null) {
    if (this.hancur) return;
    if (info) {
      this.info = info;
      this.kirimUlangSiapJokerBilaPerlu();
    }
    if (view) {
      // Jawaban (atau keadaan baru) datang: bar aksi boleh dipakai lagi.
      this.lepasKunciKirim();
      this.antrian.push(view);
      void this.putarAntrian();
    } else if (!this.sedangMemutar) this.tampilkan();
  }

  /**
   * Keadaan meja yang sedang TAMPIL, untuk keputusan pembaruan PWA (main.ts → pembaruan.ts). View terbaru
   * dari server bisa sudah 'selesai' sementara panel mentung atau animasi akhir putaran masih diputar.
   */
  keadaanTampil(): { status: string | null; sibuk: boolean; klasemen: boolean } {
    const modal = document.getElementById('modal');
    const jendelaMenahan = !!modal?.querySelector('[data-mentung], [data-joker]');
    return {
      status: this.view?.status ?? null,
      sibuk:
        !this.hancur &&
        (this.sedangMemutar || this.animasi || this.antrian.length > 0 || this.viewTertunda !== null || jendelaMenahan || this.tungguJokerSaya()),
      klasemen: !!modal?.querySelector('[data-selesai]'),
    };
  }

  /** Putar peristiwa baru dari tiap view secara berurutan, lalu tampilkan view-nya. */
  private async putarAntrian() {
    if (this.sedangMemutar) return;
    this.sedangMemutar = true;
    try {
      while (this.antrian.length && !this.hancur) {
        const v = this.antrian.shift()!;
        // View pertama (baru masuk / sambung ulang): jangan putar ulang kejadian lama, kecuali
        // kocok & bagi putaran yang baru dimulai (supaya putaran 1 juga terlihat dibagi).
        const pertama = this.idPeristiwa < 0 || !this.view;
        const awal = pertama && this.info ? peristiwaAwalPerluDiputar(v, this.info.menungguJoker) : null;
        const baru = pertama ? (awal ? [awal] : []) : v.peristiwa.filter((e) => e.id > this.idPeristiwa);
        if (baru.length) {
          this.animasi = true;
          this.render();
        }
        this.viewTertunda = v;
        for (let i = 0; i < baru.length; i++) {
          if (this.hancur) return;
          const e = baru[i];
          if (e.jenis === 'mulaiPutaran') {
            // Modal hasil putaran lalu ditutup DULU supaya kocok & bagi terlihat (popup joker menyusul).
            if (document.querySelector('#modal [data-hasil]')) tutupModal();
            await denganBatas(this.pemutar.putar(e, this.antrian.length > 2, baru[i + 1]), BATAS_BAGI_MS);
          } else await this.pemutar.putar(e, this.antrian.length > 2, baru[i + 1]);
        }
        this.viewTertunda = null;
        if (this.hancur) return;
        if (v.peristiwa.length) this.idPeristiwa = v.peristiwa[v.peristiwa.length - 1].id;
        else this.idPeristiwa = Math.max(this.idPeristiwa, 0);
        this.pasangView(v);
        this.disembunyikan.clear();
        this.animasi = false;
        this.tampilkan();
      }
    } finally {
      this.sedangMemutar = false;
      if (!this.hancur) {
        if (this.animasi) {
          this.animasi = false;
          this.render();
        }
        this.lepasEmoteTertunda();
        // Antrian sudah habis: popup joker yang tadi menunggu animasi boleh muncul sekarang.
        this.bukaJokerBilaPerlu();
      }
    }
  }

  /** Tampilkan view yang sedang diputar sekarang juga (dipakai pemutar untuk tahu posisi tujuan). */
  private terapkanViewBerikut(sembunyi: string[]) {
    if (this.hancur) return;
    const v = this.viewTertunda;
    if (v) this.pasangView(v);
    sembunyi.forEach((id) => this.disembunyikan.add(id));
    this.render();
    // View pertama: ukur bar sekarang (ResizeObserver baru melapor nanti) supaya kartu dibagi
    // langsung ke posisi akhirnya, bukan bergeser di tengah animasi.
    if (this.idPeristiwa < 0) this.ukurBar();
  }

  /** Pasang view baru (di tengah animasi atau sesudahnya). Putaran baru: keyboard mulai dari awal. */
  private pasangView(v: ViewPemain) {
    if (this.view === v) return;
    const nomorLama = this.view?.putaran?.nomor ?? null;
    this.pertahankanUrutan(v);
    this.view = v;
    if (v.putaran && v.putaran.nomor !== nomorLama) this.mulaiPutaranKeyboard();
  }

  /**
   * Putaran baru terpasang (bisa masih di tengah kocok & bagi): pilihan dan sorotan sisa putaran lalu
   * dibuang sekarang juga, bukan nanti di tampilkan(). Jadi kartu yang dipilih dengan keyboard selagi
   * kartu dibagi tidak ikut terhapus, dan sorotan tidak tertinggal di deck/buangan putaran lalu.
   */
  private mulaiPutaranKeyboard() {
    const v = this.view!;
    const p = v.putaran!;
    this.dipilih.clear();
    this.mulung = null;
    this.pilihJumlah = false;
    this.kunciPilih = `${p.nomor}:${v.status}`;
    this.giliranLalu = p.giliran;
    this.indeksFokus = 0;
    // Sorotan belum tampak: kosongkan, panah pertama mulai dari kartu paling kiri (↑ ke deck).
    // Sedang tampak: deck kalau giliranku mengambil, selain itu kartu paling kiri.
    if (!this.modusKeyboard) this.fokus = null;
    else this.fokus = this.giliranSaya() && p.tahap === 'ambil' && p.jumlahDeck > 0 ? 'deck' : (this.deretBawah()[0] ?? null);
  }

  /** Kartu yang baru masuk tangan (dari deck atau pungutan) ditaruh di ujung kanan; urutan lain tetap. */
  private pertahankanUrutan(baru: ViewPemain) {
    const pl = this.view?.putaran;
    const pb = baru.putaran;
    if (!pl || !pb || pl.nomor !== pb.nomor) return;
    const idLama = new Set(this.tanganServer().map((k) => k.id));
    const tambah = (pb.tangan[this.saya] ?? []).filter((k) => !idLama.has(k.id)).map((k) => k.id);
    if (!tambah.length) return;
    this.urutanManual = [...this.tanganUrut().map((k) => k.id), ...tambah];
    this.urutan = 'manual';
    simpan.setUrutanTangan(this.urutanManual);
  }

  /**
   * Panel mentung: tiap pemain langsung tahu dia kepentung atau tidak. Rincian (kartu siapa yang
   * dipungut dan dipasangkan jadi apa) dibuka kalau diklik. Selesai saat pemain menekan Lanjut.
   */
  private panelMentung(e: Extract<Peristiwa, { jenis: 'mentung' }>): Promise<void> {
    return new Promise((selesai) => {
      const v = this.viewTertunda ?? this.view;
      if (this.hancur || !v?.putaran) return selesai();
      const saya = this.saya;
      const nama = (i: number) => v.pemain[i]?.nama ?? '';
      const namaAtauKamu = (i: number) => (i === saya ? 'Kamu' : nama(i));
      // Kartu jadi yang dibentuk di giliran mentung: dari mulung terakhir + turunkan sesudahnya.
      const semua = new Map<number, Peristiwa>();
      for (const x of [...(this.view?.peristiwa ?? []), ...v.peristiwa]) semua.set(x.id, x);
      const urut = [...semua.values()].filter((x) => x.putaran === e.putaran && x.id < e.id).sort((a, b) => a.id - b.id);
      const mulung = [...urut].reverse().find((x) => x.jenis === 'mulung' && x.pemain === e.pemain);
      const idKj = new Set<string>();
      if (mulung && mulung.jenis === 'mulung') {
        mulung.idKartuJadi.forEach((id) => idKj.add(id));
        for (const x of urut) if (x.jenis === 'turunkan' && x.pemain === e.pemain && x.id > mulung.id) x.idKartuJadi.forEach((id) => idKj.add(id));
      }
      const kjGiliran = v.putaran.kartuJadi[e.pemain].filter((kj) => idKj.has(kj.id));
      const kartuDari = (pemilik: number) =>
        kjGiliran.flatMap((kj) => kj.kartu).filter((d) => d.dari === pemilik).map((d) => labelKartu(d.kartu));

      let status: string;
      if (e.pemain === saya) status = `<div class="kotak-status emas">Kamu MENTUNG! +${e.nilai}</div>`;
      else if (e.kepentung.includes(saya)) {
        status = `<div class="kotak-status merah">Kamu KEPENTUNG −${e.nilai}
          <small>Kartumu yang dipakai: ${esc(kartuDari(saya).join(', ') || '-')}</small></div>`;
      } else status = '<div class="kotak-status aman">Kamu aman, nggak kepentung.</div>';

      const sebutan = { 2: 'DOUBLE PENTUNG!', 3: 'TRIPLE PENTUNG!', 4: 'QUADRA PENTUNG!', 5: 'PENTUNG MASSAL!' }[Math.min(e.kepentung.length, 5)];
      const lencana = [
        sebutan ? `<span class="lencana merah">${sebutan}</span>` : '',
        e.dibalik ? '<span class="lencana">↺ BALIK ARAH</span>' : e.kepentung.length ? '<span class="lencana">LOMPAT · arah tetap</span>' : '',
      ].join('');
      const daftarKepentung = e.kepentung.length
        ? e.kepentung.map((k) => `<b>${esc(namaAtauKamu(k))}</b> (${esc(kartuDari(k).join(', '))})`).join(' · ')
        : 'nggak ada';

      bukaModal(
        `<div data-mentung></div>
         <h2 class="rata-tengah">${e.pentunganJoker ? 'PENTUNG JOKER!' : 'MENTUNG!'}</h2>
         <p class="rata-tengah rapat">${esc(namaAtauKamu(e.pemain))} nutup pakai <b>${esc(namaKartu(e.pentungan))}</b> · nilai <b>${e.nilai}</b></p>
         <div class="kartu-pamer" data-kartu></div>
         ${status}
         ${lencana ? `<div class="lencana-deret">${lencana}</div>` : ''}
         <p class="redup rapat">Kepentung: ${daftarKepentung}</p>
         <details class="akordion">
           <summary tabindex="0"><span class="nama-skor"><b>Lihat kartu yang dipungut &amp; dipasangkan</b></span></summary>
           <div class="komponen">
             ${htmlKartuJadiAsal(kjGiliran, nama, saya)}
             <div class="komp"><span>Pentungan: ${esc(namaKartu(e.pentungan))}${e.pentunganJoker ? ' (joker)' : ''}, dari ${e.pemain === saya ? 'tanganmu' : `tangan ${esc(nama(e.pemain))}`}. Pemilik kartu pentungan tidak kena karena kartu itu.</span></div>
           </div>
         </details>
         <button type="button" class="utama" data-lanjut>Lanjut</button>`,
        (dlg) => {
          dlg.querySelector('[data-kartu]')!.appendChild(gambarKartuKeKanvas(e.pentungan, lebarKartuPamer()));
          dlg.querySelector('[data-lanjut]')!.addEventListener('click', () => {
            tutupModal();
            selesai();
          });
        },
        { bisaDitutup: false },
      );
      // Siapa yang kepentung sudah tampil untuk semua orang di panel ini: yang kena dapat bunyi besar,
      // yang lain cukup isyarat pelan.
      if (e.kepentung.includes(saya)) {
        bunyi('kepentung');
        getar('kepentung');
      } else if (e.kepentung.length > 0) bunyi('kepentungLain');
    });
  }

  private catatAksi(pemain: number, teks: string) {
    if (this.hancur) return;
    // Aksi dalam satu giliran digabung, misalnya "mungut 9♦ · buang kartu". Hanya tampil sebentar.
    const lama = this.aksiTerakhir[pemain];
    const gabung = lama && this.timerAksi.has(pemain) && !teks.startsWith('ambil') && !teks.startsWith('mungut');
    this.aksiTerakhir = { ...this.aksiTerakhir, [pemain]: gabung ? `${lama} · ${teks}` : teks };
    const timerLama = this.timerAksi.get(pemain);
    if (timerLama) clearTimeout(timerLama);
    this.timerAksi.set(
      pemain,
      setTimeout(() => {
        const { [pemain]: _, ...sisa } = this.aksiTerakhir;
        this.aksiTerakhir = sisa;
        this.timerAksi.delete(pemain);
        this.render();
      }, 3500),
    );
    this.render();
  }

  private tampilkan() {
    if (this.hancur) return;
    const v = this.view;
    if (!v || !this.info) return;
    const p = v.putaran;
    // Giliran/tahap berganti: buang mode mulung dan petunjuk yang basi.
    const kunci = p ? `${p.nomor}:${p.giliran}:${p.tahap}:${v.status}` : v.status;
    if (kunci !== this.kunciGiliran) {
      this.kunciGiliran = kunci;
      this.pilihJumlah = false;
      this.mulung = null;
      this.petunjuk = '';
      this.petunjukSalah = false;
    }
    // Pilihan kartu bertahan selama giliran yang sama (ambil → main), jadi kartu yang diketuk
    // selagi kartu deck masih terbang tidak hilang diam-diam. Pilihan sambil menunggu juga
    // terbawa ke giliranku. Dilepas saat giliranku berakhir, atau putaran/fase berganti.
    const kunciPilih = p ? `${p.nomor}:${v.status}` : v.status;
    const giliranKini = p ? p.giliran : null;
    if (kunciPilih !== this.kunciPilih || (this.giliranLalu === this.saya && giliranKini !== this.saya)) this.dipilih.clear();
    this.kunciPilih = kunciPilih;
    this.giliranLalu = giliranKini;
    const ids = new Set(this.tanganServer().map((k) => k.id));
    for (const id of [...this.dipilih]) if (!ids.has(id) && !this.idPungutan().has(id)) this.dipilih.delete(id);

    // Hasil putaran baru → tampilkan rinciannya.
    if (v.riwayat.length > this.hasilTerlihat && v.status !== 'putaranBerjalan') {
      this.hasilTerlihat = v.riwayat.length;
      if (v.status === 'selesai') this.modalSelesai();
      else this.modalHasil(v.riwayat[v.riwayat.length - 1]);
    } else if (v.status === 'selesai' && !this.selesaiDitampilkan) {
      // Misalnya semua sepakat mengakhiri dari modal hasil: ganti modal hasil dengan klasemen akhir.
      this.modalSelesai();
    } else if (v.status === 'putaranSelesai' && modalTerbuka() && document.querySelector('#modal [data-hasil]')) {
      // Perbarui modal hasil yang sedang terbuka (misalnya jumlah yang setuju mengakhiri).
      // Hanya bagian yang berubah: fokus dan posisi gulir pemain tidak direbut.
      this.modalHasil(v.riwayat[v.riwayat.length - 1]);
    }
    if (v.status === 'putaranBerjalan' && document.querySelector('[data-hasil]')) tutupModal();
    this.hasilTerlihat = Math.max(this.hasilTerlihat, v.riwayat.length);
    if (v.status !== 'selesai') this.selesaiDitampilkan = false;

    // Pengumuman joker: sekali di awal putaran, harus ditekan OK.
    if (!this.tungguJokerSaya() && document.querySelector('[data-joker]')) tutupModal();
    this.bukaJokerBilaPerlu();
    this.kirimUlangSiapJokerBilaPerlu();

    // Tanda giliranmu: bunyi + getar pendek.
    const giliranSaya = (this.giliranSaya() && !this.info.menungguJoker.length) || this.susunSaya();
    if (giliranSaya && !this.giliranSayaSebelumnya) {
      bunyi('giliran');
      getar('giliran');
    }
    this.giliranSayaSebelumnya = giliranSaya;
    this.umumkanKeadaan();
    this.render();
  }

  /**
   * Nama pemain untuk pembaca layar. Warga kedai diberi label "(warga kedai)", padanan ikon ☕ di
   * panel kanvas. Hanya bergantung pada jenis kursi, tidak pada kartu atau peristiwa.
   */
  private namaUntukPembaca(kursi: number): string {
    const nama = this.view?.pemain[kursi]?.nama ?? 'Pemain';
    return this.info?.kursi[kursi]?.jenis === 'bot' ? `${nama} (${PENANDA_WARGA_KEDAI.label})` : nama;
  }

  /** Umumkan pergantian giliran/fase ke pembaca layar (tanpa menyebut kartu apa pun). */
  private umumkanKeadaan() {
    const v = this.view!;
    const p = v.putaran;
    const tunggu = !!this.info?.menungguJoker.length;
    const kunci = p ? `${p.nomor}:${p.giliran}:${v.status}:${tunggu}` : v.status;
    if (kunci === this.kunciUmum) return;
    const pertama = this.kunciUmum === '';
    this.kunciUmum = kunci;
    if (pertama || !p || tunggu) return;
    if (v.status === 'susunAkhir') umumkan(this.susunSaya() ? 'Susun akhir. Turunkan kartu jadi kalau ada, lalu tekan Selesai.' : 'Susun akhir.');
    else if (v.status === 'putaranBerjalan') umumkan(p.giliran === this.saya ? 'Giliranmu.' : `Giliran ${this.namaUntukPembaca(p.giliran)}.`);
  }

  /** Popup joker dibuka setelah antrian animasi habis (bagi kartu dulu), sambutan tutorial dulu. */
  private bukaJokerBilaPerlu(paksa = false) {
    if (this.hancur || !this.tungguJokerSaya() || document.querySelector('[data-joker]')) return;
    if (this.tutorial?.tahanPopupJoker()) return;
    if (!paksa && (this.antrian.length > 0 || this.animasi)) {
      // Cadangan: kalau animasi tertahan (mis. aplikasi di latar belakang), popup tetap muncul.
      this.timerJoker ??= setTimeout(() => {
        this.timerJoker = null;
        this.bukaJokerBilaPerlu(true);
      }, 6000);
      return;
    }
    if (this.timerJoker) {
      clearTimeout(this.timerJoker);
      this.timerJoker = null;
    }
    this.modalJoker();
  }

  private sambunganKini(): number {
    return this.app.nomorSambungan?.() ?? 0;
  }

  /** OK joker sudah ditekan tapi pesannya hilang di jalan: kirim ulang (lihat perluKirimUlangSiapJoker). */
  private kirimUlangSiapJokerBilaPerlu() {
    if (this.hancur || !this.info) return;
    const sambungan = this.sambunganKini();
    const perlu = perluKirimUlangSiapJoker({
      view: this.view,
      menungguJoker: this.info.menungguJoker,
      jokerDiOk: this.jokerDiOk,
      status: this.app.statusKoneksi?.() ?? 'tersambung',
      sambungan,
      sambunganTerkirim: this.siapJokerDiSambungan,
    });
    if (!perlu) return;
    this.siapJokerDiSambungan = sambungan;
    this.app.kirim({ t: 'siapJoker' });
  }

  private tungguJokerSaya(): boolean {
    const v = this.view;
    const p = v?.putaran;
    return !!this.info && !!p && v!.status === 'putaranBerjalan' && this.info.menungguJoker.includes(this.saya) && this.jokerDiOk !== p.nomor;
  }

  // ---------- data turunan ----------

  private get saya(): number {
    return this.view?.saya ?? 0;
  }

  private ctx(): KonteksJoker {
    const p = this.view!.putaran!;
    return { rankJoker: p.rankJoker, jokerMati: p.jokerMati };
  }

  private tanganServer(): Kartu[] {
    return this.view?.putaran?.tangan[this.saya] ?? [];
  }

  /** Fase susun akhir dan saya belum menekan Selesai. */
  private susunSaya(): boolean {
    const v = this.view;
    return v?.status === 'susunAkhir' && !v.putaran!.selesaiSusun[this.saya] && !this.info?.diambilAlihBot;
  }

  private giliranSaya(): boolean {
    const v = this.view;
    return !!v?.putaran && v.status === 'putaranBerjalan' && v.putaran.giliran === this.saya && !this.info?.diambilAlihBot;
  }

  private pungutan() {
    const p = this.view!.putaran!;
    return this.mulung ? p.buangan.slice(p.buangan.length - this.mulung.jumlah) : [];
  }

  private idPungutan(): Set<string> {
    return new Set(this.view?.putaran ? this.pungutan().map((e) => e.kartu.id) : []);
  }

  private idTerpakaiMulung(): Set<string> {
    return new Set((this.mulung?.kombinasi ?? []).flat().map((x) => x.id));
  }

  /** Tangan terurut sesuai pilihan pemain. */
  private tanganUrut(): Kartu[] {
    const t = [...this.tanganServer()];
    if (this.urutan === 'bunga') {
      t.sort((a, b) => SEMUA_BUNGA.indexOf(a.bunga) - SEMUA_BUNGA.indexOf(b.bunga) || a.rank - b.rank);
    } else if (this.urutan === 'angka') {
      t.sort((a, b) => a.rank - b.rank || SEMUA_BUNGA.indexOf(a.bunga) - SEMUA_BUNGA.indexOf(b.bunga));
    } else {
      const posisi = new Map(this.urutanManual.map((id, i) => [id, i]));
      t.sort((a, b) => (posisi.get(a.id) ?? 1e6) - (posisi.get(b.id) ?? 1e6));
    }
    return t;
  }

  private semuaKartuMulung(): Kartu[] {
    return [...this.tanganServer(), ...this.pungutan().map((e) => e.kartu)];
  }

  /**
   * Kartu yang bisa disorot keyboard di baris bawah, sesuai urutan di layar. Kartu tangan yang masih
   * terbang (dibagi, diambil dari deck) ikut, karena tempatnya sudah dipesan: panah yang ditekan
   * selagi kartu dibagi tidak tersangkut di deck/buangan.
   */
  private deretBawah(): string[] {
    const idMulung = this.idTerpakaiMulung();
    const tangan = this.tanganUrut().filter((k) => !idMulung.has(k.id));
    const pungutan = this.mulung ? this.pungutan().map((e) => e.kartu).filter((k) => !idMulung.has(k.id)) : [];
    return [...tangan, ...pungutan].map((k) => k.id);
  }

  // ---------- AksiAdegan (dari Phaser dan keyboard) ----------

  ketukKartu(id: string) {
    const k = this.semuaKartuMulung().find((x) => x.id === id);
    const pilih = !this.dipilih.has(id);
    if (pilih) this.dipilih.add(id);
    else this.dipilih.delete(id);
    bunyi(pilih ? 'angkat' : 'letak');
    getar('ketuk');
    this.ingatFokus(id);
    if (k) umumkan(`${pilih ? 'Dipilih' : 'Batal dipilih'}: ${namaKartu(k)}. ${this.dipilih.size} kartu terpilih.`);
    this.petunjuk = '';
    this.render();
  }

  ketukDeck() {
    this.ambilDeck();
  }

  ketukBuangan(jumlah: number) {
    if (this.mulung) return this.tolak('Lagi nyusun mulung. Batalkan dulu (✕) kalau mau ganti jumlah pungutan.', 'buangan');
    if (!this.pilihJumlah) {
      // Ketuk kartu di buangan saat giliran ambil = langsung mungut kartu itu dan semua di atasnya.
      const st = this.statusTombol().mulung;
      if (!st.aktif) return this.tolak(st.alasan, 'buangan');
    }
    this.pilihJumlah = false;
    this.mulung = { jumlah, kombinasi: [] };
    this.dipilih.clear();
    this.setPetunjuk('Pilih kartu dari tangan + pungutan, lalu tekan "Jadikan". Kartu bertanda emas wajib masuk kombinasi.');
    umumkan(`Mungut ${jumlah} kartu. Pilih kartu dari tangan dan pungutan, lalu Jadikan.`);
    this.render();
  }

  /** Kartu diseret ke tumpukan buangan = buang kartu itu. */
  lepasKeBuangan(id: string): 'abaikan' | void {
    // Aksi sebelumnya masih menunggu jawaban: kartu kembali ke tangan tanpa dianggap salah
    // ('abaikan' = scene mengembalikan kartunya tanpa goyang/kilat merah).
    if (this.menungguJawaban) return 'abaikan';
    const p = this.view?.putaran;
    if (!p || this.view?.status !== 'putaranBerjalan' || p.giliran !== this.saya || p.tahap !== 'main') {
      this.tolak(p?.tahap === 'ambil' && p.giliran === this.saya ? 'Ambil kartu dulu (dari deck atau mulung).' : 'Belum waktunya buang.', id);
      return this.render();
    }
    this.dipilih = new Set([id]);
    this.buang();
    this.render();
  }

  geserKartu(id: string, indeksBaru: number) {
    const t = this.tanganUrut().map((k) => k.id);
    const lama = t.indexOf(id);
    if (lama < 0) return;
    t.splice(lama, 1);
    t.splice(indeksBaru, 0, id);
    this.urutanManual = t;
    this.urutan = 'manual';
    simpan.setUrutanTangan(t);
    this.render();
  }

  ketukKombinasi(indeks: number) {
    if (!this.mulung) return;
    this.mulung.kombinasi.splice(indeks, 1);
    this.setPetunjuk('Kombinasi dibatalkan.');
    umumkan('Kombinasi dibatalkan.');
    this.render();
  }

  // ---------- umpan balik ----------

  /** Aksi tidak sah: goyang sasaran, bunyi + getar tolak, alasan di petunjuk dan pembaca layar. */
  private tolak(alasan: string, sasaran: string) {
    if (!alasan) return;
    this.setPetunjuk(alasan, true);
    this.scene.tolak(sasaran);
    bunyi('tolak');
    getar('tolak');
    umumkan(alasan);
  }

  /** Sasaran goyang untuk tombol yang ditolak. */
  private sasaranTombol(a: string): string {
    if (a === 'ambil') return 'deck';
    if (a === 'mulung') return 'buangan';
    if (a === 'buang' && this.dipilih.size === 1) return [...this.dipilih][0];
    return 'tangan';
  }

  // ---------- aksi ----------

  /**
   * Kirim aksi giliran. Bar aksi dikunci sampai view berikutnya datang (atau BATAS_AKSI_MS), supaya
   * tombol yang ditekan dua kali / pintasan yang ditahan tidak mengirim aksi yang sama berulang.
   * Ambil deck tidak melepas pilihan: kartu yang sudah dipilih tetap terpilih di tahap main.
   */
  private kirimAksi(aksi: Extract<PesanKlien, { t: 'aksi' }>['aksi']) {
    if (this.menungguJawaban) clearTimeout(this.menungguJawaban);
    // Kunci dipasang SEBELUM kirim: offline, view jawabannya bisa datang di dalam kirim() itu sendiri.
    this.menungguJawaban = setTimeout(() => {
      this.menungguJawaban = null;
      this.render();
    }, BATAS_AKSI_MS);
    if (aksi.jenis !== 'ambilDeck') this.dipilih.clear();
    this.app.kirim({ t: 'aksi', aksi });
    this.render();
  }

  private lepasKunciKirim() {
    if (!this.menungguJawaban) return;
    clearTimeout(this.menungguJawaban);
    this.menungguJawaban = null;
  }

  private ambilDeck() {
    // Ketukan kedua selagi aksi masih dikirim (double-tap): diabaikan diam-diam, bukan "salah".
    if (this.menungguJawaban) return;
    const s = this.statusTombol().ambil;
    if (!s.aktif) return this.tolak(s.alasan, 'deck');
    this.kirimAksi({ jenis: 'ambilDeck' });
  }

  /** Tentukan peran joker; bila ambigu tanya pemain. */
  private tentukanPeran(kartu: Kartu[], lanjut: (spek: SpesifikasiKartuJadi) => void) {
    const ctx = this.ctx();
    const opsi = opsiPeranJoker(kartu, ctx);
    if (opsi.length === 0) {
      const h = coba(() => validasiKartuJadi(kartu.map((k) => ({ kartu: k })), ctx));
      return this.tolak(h.ok ? 'Kombinasi tidak sah.' : h.pesan, 'tangan');
    }
    const keSpek = (h: HasilValidasiKartuJadi): SpesifikasiKartuJadi =>
      h.kartu.map((d) => ({ id: d.kartu.id, sebagai: d.pengganti ? d.sebagai : undefined }));
    if (opsi.length === 1) return lanjut(keSpek(opsi[0]));
    bukaDialog(
      `<h2>Joker-nya jadi apa?</h2>
       <p class="redup">Kombinasi ini bisa dibaca lebih dari satu cara. Pilih salah satu.</p>
       <div class="rincian">${opsi.map((o, i) => `<button type="button" data-opsi="${i}">${esc(deskripsiKartuJadi(o))}</button>`).join('')}</div>
       <button type="button" data-tutup>Batal</button>`,
      (dlg, tutup) =>
        dlg.querySelectorAll<HTMLElement>('[data-opsi]').forEach((b) =>
          b.addEventListener('click', () => {
            tutup();
            lanjut(keSpek(opsi[Number(b.dataset.opsi)]));
          }),
        ),
    );
  }

  private jadikanMulung() {
    if (!this.mulung) return;
    const pool = this.semuaKartuMulung();
    const kartu = pool.filter((k) => this.dipilih.has(k.id));
    if (kartu.length < 3) return this.tolak('Pilih minimal 3 kartu untuk satu kombinasi.', 'tangan');
    this.tentukanPeran(kartu, (spek) => {
      if (!this.mulung) return;
      this.mulung.kombinasi.push(spek);
      this.dipilih.clear();
      const cek = this.cekMulung();
      const pesan = cek.ok ? 'Siap. Tekan "Konfirmasi" untuk mulung.' : cek.pesan;
      this.setPetunjuk(pesan, !cek.ok);
      umumkan(pesan);
      this.render();
    });
  }

  private cekMulung() {
    const v = this.view!;
    const p = v.putaran!;
    return coba(() =>
      validasiMulung({
        tangan: this.tanganServer(),
        buangan: p.buangan,
        punyaKartuJadi: p.kartuJadi[this.saya].length > 0,
        jumlahPemain: v.pemain.length,
        jumlah: this.mulung!.jumlah,
        spesifikasi: this.mulung!.kombinasi,
        ctx: this.ctx(),
      }),
    );
  }

  private konfirmasiMulung() {
    if (!this.mulung) return;
    if (!this.mulung.kombinasi.length) return this.tolak('Susun dulu kombinasinya, lalu tekan "Jadikan".', 'tangan');
    const cek = this.cekMulung();
    if (!cek.ok) return this.tolak(cek.pesan, 'tangan');
    const { jumlah, kombinasi } = this.mulung;
    this.mulung = null;
    // Petunjuk "Tekan Konfirmasi" sudah basi: beri tahu mulungnya sedang jalan (dibersihkan
    // sendiri begitu tahap berganti ke main).
    this.setPetunjuk('Mulung dikirim, tunggu kartunya mendarat…');
    umumkan('Mulung dikirim.');
    this.kirimAksi({ jenis: 'mulung', jumlah, kartuJadi: kombinasi });
  }

  private turunkan() {
    const s = this.statusTombol().turunkan;
    if (!s.aktif) return this.tolak(s.alasan, 'tangan');
    const kartu = this.tanganUrut().filter((k) => this.dipilih.has(k.id));
    this.tentukanPeran(kartu, (spek) => {
      const p = this.view?.putaran;
      if (!p || this.hancur) return;
      const mode = this.view!.status === 'susunAkhir' ? 'akhir' : p.sumberAmbil!;
      const cek = coba(() => validasiTurunkan(this.tanganServer(), [spek], p.kartuJadi[this.saya].length > 0, mode, this.ctx()));
      if (!cek.ok) return this.tolak(cek.pesan, 'tangan');
      this.kirimAksi({ jenis: 'turunkan', kartuJadi: [spek] });
    });
  }

  private buang() {
    const s = this.statusTombol().buang;
    if (!s.aktif) return this.tolak(s.alasan, this.sasaranTombol('buang'));
    this.kirimAksi({ jenis: 'buang', kartuId: [...this.dipilih][0] });
  }

  private batalMulung() {
    this.pilihJumlah = false;
    this.mulung = null;
    this.dipilih.clear();
    this.petunjuk = '';
    umumkan('Mulung dibatalkan.');
    this.render();
  }

  /** Status tiap tombol beserta alasan bila nonaktif. */
  private statusTombol(): DaftarStatus {
    const v = this.view;
    const p = v?.putaran;
    const mati = (alasan: string): StatusTombol => ({ aktif: false, alasan });
    const hidup: StatusTombol = { aktif: true, alasan: '' };
    const semua = (s: StatusTombol): DaftarStatus => ({ ambil: s, mulung: s, turunkan: s, buang: s, selesai: s, mentung: false });
    if (this.animasi) return semua(mati('Tunggu sebentar, kartu masih bergerak.'));
    if (this.menungguJawaban) return semua(mati('Sebentar, aksinya lagi diproses…'));
    if (v?.status === 'susunAkhir' && p) {
      const alasan = this.susunSaya()
        ? ''
        : this.info?.diambilAlihBot
          ? 'Waktu habis, kartumu disusun warga kedai.'
          : 'Kamu sudah selesai menyusun.';
      const terpilih = this.tanganServer().filter((k) => this.dipilih.has(k.id));
      let turunkanAlasan = alasan || (terpilih.length < 3 ? 'Pilih minimal 3 kartu untuk diturunkan.' : '');
      if (!turunkanAlasan && opsiPeranJoker(terpilih, this.ctx()).length === 0) {
        const h = coba(() => validasiKartuJadi(terpilih.map((k) => ({ kartu: k })), this.ctx()));
        turunkanAlasan = h.ok ? '' : h.pesan;
      }
      const tutup = mati(p.mentung ? 'Sudah ada yang mentung, tinggal menyusun kartu.' : 'Deck sudah habis.');
      return {
        ambil: tutup,
        mulung: tutup,
        turunkan: turunkanAlasan ? mati(turunkanAlasan) : hidup,
        buang: tutup,
        selesai: alasan ? mati(alasan) : hidup,
        mentung: false,
      };
    }
    if (this.info?.menungguJoker.length) return semua(mati('Tunggu semua pemain melihat joker dulu.'));
    const bukan =
      !v || !p || v.status !== 'putaranBerjalan'
        ? 'Putaran belum berjalan.'
        : this.info?.diambilAlihBot && p.giliran === this.saya
          ? 'Waktu habis, giliranmu dijalankan warga kedai dulu, Bos.'
          : p.giliran !== this.saya
            ? `Sabar, sekarang gilirannya ${v.pemain[p.giliran].nama}.`
            : '';
    if (bukan) return semua(mati(bukan));
    const pp = p!;
    const ambilAlasan = pp.tahap !== 'ambil' ? 'Kamu sudah ambil kartu giliran ini.' : '';
    const mulungAlasan = ambilAlasan || (pp.buangan.length === 0 ? 'Buangan masih kosong, ambil dari deck dulu.' : '');
    const mainAlasan = pp.tahap !== 'main' ? 'Ambil kartu dulu (dari deck atau mulung).' : '';
    const tangan = this.tanganServer();
    const terpilih = tangan.filter((k) => this.dipilih.has(k.id));
    const cekBuang = (kartuId: string) =>
      coba(() =>
        validasiBuang({
          tangan,
          punyaKartuJadi: pp.kartuJadi[this.saya].length > 0,
          sumberAmbil: pp.sumberAmbil!,
          kartuId,
          ctx: this.ctx(),
          asJokerBolehDibuangTanpaJadi: v!.konfigurasi.asJokerBolehDibuangTanpaJadi,
        }),
      );
    let turunkanAlasan = mainAlasan || (terpilih.length < 3 ? 'Pilih minimal 3 kartu untuk diturunkan.' : '');
    let buangAlasan = mainAlasan || (terpilih.length !== 1 ? 'Pilih tepat satu kartu untuk dibuang.' : '');
    if (!buangAlasan) {
      const h = cekBuang(terpilih[0].id);
      if (!h.ok) buangAlasan = h.pesan;
    }
    if (!turunkanAlasan && opsiPeranJoker(terpilih, this.ctx()).length === 0) {
      const h = coba(() => validasiKartuJadi(terpilih.map((k) => ({ kartu: k })), this.ctx()));
      turunkanAlasan = h.ok ? '' : h.pesan;
    }
    // Mentung atau bukan: ditentukan validasiBuang (bukan hitungan sendiri di UI).
    const mentung =
      !mainAlasan &&
      tangan.some((k) => {
        const h = cekBuang(k.id);
        return h.ok && h.nilai.mentung;
      });
    return {
      ambil: ambilAlasan ? mati(ambilAlasan) : hidup,
      mulung: mulungAlasan ? mati(mulungAlasan) : hidup,
      turunkan: turunkanAlasan ? mati(turunkanAlasan) : hidup,
      buang: buangAlasan ? mati(buangAlasan) : hidup,
      selesai: mati('Belum waktunya.'),
      mentung,
    };
  }

  private setPetunjuk(teks: string, salah = false) {
    this.petunjuk = teks;
    this.petunjukSalah = salah;
    const tampil = teks || this.petunjukBawaan();
    const kelasSalah = salah && !!teks;
    if (this.elPetunjuk.textContent === tampil && this.elPetunjuk.classList.contains('salah') === kelasSalah) return;
    this.elPetunjuk.textContent = tampil;
    // Alasan penolakan boleh tiga baris (lihat meja.css); di luar itu tetap dua baris.
    this.elPetunjuk.classList.toggle('salah', kelasSalah);
    this.tandaiPetunjukTerpotong();
  }

  /**
   * Petunjuk yang masih terpotong (layar sempit, alasan panjang) bisa diketuk untuk dibaca lengkap
   * lewat toast. Diukur hanya saat teks/kelasnya berganti (atau ukuran bar berubah) supaya render
   * biasa tidak memaksa reflow.
   */
  private tandaiPetunjukTerpotong(paksa = false) {
    const el = this.elPetunjuk;
    const teks = el.textContent ?? '';
    const kunci = `${el.classList.contains('salah')}|${teks}`;
    if (!paksa && kunci === this.petunjukTerukur) return;
    this.petunjukTerukur = kunci;
    const terpotong = !!teks && el.scrollHeight > el.clientHeight + 1;
    el.classList.toggle('terpotong', terpotong);
    if (terpotong) el.title = teks;
    else el.removeAttribute('title');
  }

  private ketukPetunjuk() {
    if (this.hancur || !this.elPetunjuk.classList.contains('terpotong')) return;
    toast(this.elPetunjuk.textContent ?? '', this.elPetunjuk.classList.contains('salah'), 6000);
  }

  private petunjukBawaan(): string {
    const v = this.view;
    const p = v?.putaran;
    if (!v || !p) return '';
    if (v.status === 'putaranSelesai') return 'Putaran selesai. Buka hasilnya buat lihat skor.';
    if (v.status === 'selesai') return 'Permainan selesai.';
    if (this.info?.menungguJoker.length) return 'Menunggu semua pemain menekan OK di pengumuman joker…';
    if (v.status === 'susunAkhir') {
      if (this.info?.diambilAlihBot && !p.selesaiSusun[this.saya]) return 'Waktu habis, kartumu disusun warga kedai.';
      if (p.selesaiSusun[this.saya]) return 'Menunggu pemain lain selesai menyusun…';
      const sebab = p.mentung ? `${p.mentung.pemain === this.saya ? 'Kamu' : v.pemain[p.mentung.pemain].nama} mentung!` : 'Deck habis!';
      return `${sebab} Turunkan kartu jadi dari tanganmu kalau ada (tanpa mulung), lalu tekan Selesai.`;
    }
    if (this.info?.diambilAlihBot && p.giliran === this.saya) return 'Waktu habis, giliranmu dijalankan warga kedai.';
    if (p.giliran !== this.saya) return 'Sambil nunggu, kamu boleh memilih dan mengatur urutan kartumu.';
    if (this.pilihJumlah) return 'Ketuk kartu di buangan: kamu mungut kartu itu dan semua di atasnya.';
    if (this.mulung) {
      return this.mulung.kombinasi.length
        ? 'Tambah kombinasi lain, atau tekan "Konfirmasi". Ketuk kombinasi untuk membatalkannya.'
        : 'Pilih kartu dari tangan + pungutan, lalu tekan "Jadikan". Kartu bertanda emas wajib masuk kombinasi.';
    }
    if (p.tahap === 'ambil') return 'Ambil satu kartu dari deck, atau mulung dari buangan.';
    if (this.statusTombol().mentung) return 'Tinggal satu kartu: buang untuk mentung!';
    return 'Turunkan kartu jadi kalau ada (boleh), lalu buang satu kartu.';
  }

  // ---------- tampilan ----------

  private render() {
    if (this.hancur) return;
    const v = this.view;
    const info = this.info;
    if (!v || !info) return;
    const st = this.statusTombol();
    this.renderAtas();
    this.renderAksi(st);
    const idMulung = this.idTerpakaiMulung();
    const semua = this.semuaKartuMulung();
    this.rapikanFokus();
    const model: ModelMeja = {
      view: v,
      info,
      aksiTerakhir: this.aksiTerakhir,
      disembunyikan: this.disembunyikan,
      tangan: this.tanganUrut().filter((k) => !idMulung.has(k.id)),
      dipilih: this.dipilih,
      pilihJumlahMulung: this.pilihJumlah,
      bisaPungut: !this.pilihJumlah && !this.mulung && st.mulung.aktif,
      kartukuDiAtas: this.kartukuDiAtas(),
      berikutnya:
        this.giliranSaya() && v.putaran!.tahap === 'main'
          ? v.pemain[berikutnya(this.saya, v.putaran!.arah, v.pemain.length)].nama
          : null,
      mulung: this.mulung
        ? {
            jumlah: this.mulung.jumlah,
            idPaling: this.pungutan()[0].kartu.id,
            sisaPungutan: this.pungutan()
              .map((e) => e.kartu)
              .filter((k) => !idMulung.has(k.id)),
            kombinasi: this.mulung.kombinasi.map((spek) => ({
              kartu: spek.map((x) => ({
                kartu: semua.find((k) => k.id === x.id)!,
                label: x.sebagai ? `→${namaRank(x.sebagai.rank)}` : undefined,
              })),
            })),
          }
        : null,
      fokus: this.modusKeyboard ? this.fokus : null,
    };
    this.scene.pasang(model, this);
    this.aturDetak(model.kartukuDiAtas);
    this.tutorial?.perbarui(this.keadaanTutorial(st));
  }

  private renderAtas() {
    const v = this.view!;
    const info = this.info!;
    const p = v.putaran;
    const t = teksBarAtas(
      this.app.jenis === 'offline' ? (this.app.tutorial ? 'Latihan' : 'Offline') : `Meja ${info.kode}`,
      p ? p.nomor : null,
      v.konfigurasi.batasPutaran,
    );
    const [elJenis, elPutaran] = [...this.elInfo.children] as HTMLElement[];
    if (elJenis.textContent !== t.jenis) elJenis.textContent = t.jenis;
    if (elPutaran.textContent !== t.putaran) elPutaran.textContent = t.putaran;
    this.perbaruiWaktu();
    this.perbaruiKoneksi();
  }

  /** Detak timer: bar waktu, status koneksi, dan tutorial (jendela bisa dibuka/ditutup tanpa render). */
  private detik() {
    if (this.hancur || !this.view || !this.info) return;
    this.perbaruiWaktu();
    this.perbaruiKoneksi();
    if (this.tutorial?.aktif) this.tutorial.perbarui(this.keadaanTutorial(this.statusTombol()));
  }

  private perbaruiWaktu() {
    const el = this.elWaktu;
    const info = this.info;
    if (!info) return;
    const batas = info.batasWaktu;
    const detik = info.pengaturan.detikGiliran;
    const st = this.view?.status;
    if (!batas || !detik || (st !== 'putaranBerjalan' && st !== 'susunAkhir')) {
      el.classList.add('tersembunyi');
      return;
    }
    const sisa = Math.max(0, batas - Date.now());
    el.classList.remove('tersembunyi');
    el.classList.toggle('mendesak', sisa < 10_000);
    (el.firstElementChild as HTMLElement).style.width = `${(100 * sisa) / (detik * 1000)}%`;
    // Peringatan sekali per giliran untuk pembaca layar.
    if (sisa < 10_000 && sisa > 0 && (this.giliranSaya() || this.susunSaya()) && this.peringatanWaktu !== this.kunciGiliran) {
      this.peringatanWaktu = this.kunciGiliran;
      umumkan('Waktumu tinggal 10 detik, Bos.');
    }
  }

  private perbaruiKoneksi() {
    const s = this.app.statusKoneksi?.() ?? 'tersambung';
    if (s === this.statusKoneksi) return;
    const lama = this.statusKoneksi;
    this.statusKoneksi = s;
    const el = this.elKoneksi;
    el.className = `status-koneksi ${s}${s === 'tersambung' ? ' tersembunyi' : ''}`;
    el.innerHTML = `<span class="titik" aria-hidden="true"></span><span class="teks">${LABEL_KONEKSI[s]}</span>`;
    el.setAttribute('aria-label', `Koneksi: ${LABEL_KONEKSI[s].replace('…', '')}`);
    if (lama === null) return;
    if (s === 'tersambung') umumkan('Tersambung lagi.');
    else if (s === 'terputus' || s === 'gagal') umumkan(s === 'gagal' ? 'Server nggak bisa dihubungi, Bos. Masih dicoba terus.' : 'Koneksi putus, lagi nyambung ulang.');
  }

  /** Ukur tinggi bar HTML sebenarnya lalu beri tahu scene supaya kartu tidak tertutup bar. */
  private ukurBar() {
    if (this.hancur) return;
    const atas = Math.ceil(this.elAtas.getBoundingClientRect().height);
    const bawah = Math.ceil(this.elAksi.getBoundingClientRect().height);
    if (!atas || !bawah) return;
    this.akar.style.setProperty('--tinggi-bar-atas-ukur', `${atas}px`);
    this.scene.aturRuang(atas, bawah);
    // Lebar berubah (putar layar, ukuran teks): petunjuk mungkin jadi (tidak) terpotong.
    this.tandaiPetunjukTerpotong(true);
  }

  private kotakDom(selektor: string): KotakLayar | null {
    const el = this.akar.querySelector(selektor);
    if (!el) return null;
    const r = el.getBoundingClientRect();
    return r.width && r.height ? { x: r.left, y: r.top, w: r.width, h: r.height } : null;
  }

  /** Isi penunjuk langkah dan deret tombol untuk keadaan sekarang. */
  private susunBar(st: DaftarStatus): { langkah: string; isi: string } {
    const v = this.view!;
    const p = v.putaran;
    const info = this.info!;
    const terpilih = this.tanganServer().filter((k) => this.dipilih.has(k.id));
    const hidup: StatusTombol = { aktif: true, alasan: '' };
    const mati = (alasan: string): StatusTombol => ({ aktif: false, alasan });
    const tombol = (a: string, label: string, s: StatusTombol, kelas: string) => {
      const huruf = HURUF_AKSI[a];
      return `<button type="button" data-a="${a}" class="${kelas}${s.aktif ? '' : ' mati'}" aria-disabled="${!s.aktif}"${
        s.alasan ? ` title="${esc(s.alasan)}" data-alasan="${esc(s.alasan)}"` : ''
      }${huruf ? ` aria-keyshortcuts="${huruf}"` : ''}><span class="label">${label}</span>${huruf ? `<kbd aria-hidden="true">${huruf}</kbd>` : ''}</button>`;
    };
    const namaUrut = this.urutan === 'angka' ? 'angka' : this.urutan === 'bunga' ? 'bunga' : 'urut';
    // Nama aksesibel diawali teks yang terlihat (WCAG 2.5.3: pengguna kontrol suara menyebut yang
    // tertulis). Ikon ⇅ digambar lewat CSS (.ikon-urut) supaya tidak ikut jadi "teks terlihat".
    const labelUrut =
      this.urutan === 'angka'
        ? 'Angka: kartu diurutkan menurut angka, ganti ke bunga'
        : this.urutan === 'bunga'
          ? 'Bunga: kartu diurutkan menurut bunga, ganti ke angka'
          : 'Urut kartu (sekarang susunan sendiri)';
    const urut = `<button type="button" data-a="urut" class="ikon" aria-label="${labelUrut}" aria-keyshortcuts="U"><span class="ikon-urut" aria-hidden="true"></span><small aria-hidden="true">${namaUrut}</small></button>`;
    const labelTurunkan = `Turunkan${terpilih.length >= 3 ? ` (${terpilih.length})` : ''}`;
    const tunggu = (label: string, alasan: string) => `${urut}${tombol('-', label, mati(alasan), 'utama')}`;

    if (v.status === 'susunAkhir') {
      const langkah = this.susunSaya()
        ? '<span class="aktif">Susun akhir: turunkan, lalu Selesai</span>'
        : `<span>${info.diambilAlihBot && !p!.selesaiSusun[this.saya] ? 'Kartumu disusun warga kedai' : 'Menunggu yang lain selesai menyusun'}</span>`;
      return { langkah, isi: `${urut}${tombol('turunkan', labelTurunkan, st.turunkan, 'kedua')}${tombol('selesai', 'Selesai', st.selesai, 'utama')}` };
    }
    if (v.status !== 'putaranBerjalan' || !p) {
      if (!v.riwayat.length) return { langkah: '', isi: tunggu('Menunggu putaran…', 'Putaran belum dimulai.') };
      return { langkah: '', isi: tombol('hasil', v.status === 'selesai' ? 'Klasemen akhir' : 'Hasil putaran', hidup, 'utama penuh') };
    }
    if (info.menungguJoker.length) {
      return { langkah: '<span>Menunggu semua lihat joker</span>', isi: tunggu('Tunggu sebentar', st.ambil.alasan) };
    }
    if (p.giliran === this.saya && info.diambilAlihBot) {
      return { langkah: '<span>Giliranmu dijalankan warga kedai</span>', isi: tunggu('Dijalankan warga kedai', st.ambil.alasan) };
    }
    if (p.giliran !== this.saya) {
      const mikir = info.botMikir === p.giliran ? ' · lagi mikir' : '';
      return { langkah: `<span>Giliran <b>${esc(v.pemain[p.giliran].nama)}</b>${mikir}</span>`, isi: tunggu('Tunggu giliranmu', st.ambil.alasan) };
    }

    // Giliranku. Penunjuk langkah: ① Ambil → ② Turunkan (boleh) → ③ Buang.
    const di = p.tahap === 'ambil' ? 1 : 2;
    const kelas = (n: number) => (n < di ? 'selesai' : n === di || (di === 2 && n === 3) ? 'aktif' : '');
    const langkah = `<span class="${kelas(1)}">① Ambil</span><i aria-hidden="true">→</i><span class="${kelas(2)}">② Turunkan <small>(boleh)</small></span><i aria-hidden="true">→</i><span class="${kelas(3)}">③ Buang</span>`;

    if (this.pilihJumlah) {
      const maks = maksimalMulung(v.pemain.length, p.buangan.length);
      return {
        langkah,
        isi: `${tombol('batal', 'Batal', hidup, 'kedua')}${tombol('-', 'Ketuk kartu di buangan', mati(`Ketuk kartu di buangan, atau tekan angka 1–${maks}.`), 'utama')}`,
      };
    }
    if (this.mulung) {
      const cek = this.mulung.kombinasi.length ? this.cekMulung() : { ok: false };
      const pilihMulung = this.semuaKartuMulung().filter((k) => this.dipilih.has(k.id)).length;
      return {
        langkah,
        isi: `${tombol('batal', '✕', hidup, 'ikon')}${tombol('jadikan', `Jadikan${pilihMulung ? ` (${pilihMulung})` : ''}`, pilihMulung >= 3 ? hidup : mati('Pilih minimal 3 kartu.'), 'kedua')}${tombol(
          'konfirmasi',
          'Konfirmasi mulung',
          cek.ok ? hidup : mati('Susun dulu kombinasinya.'),
          'utama',
        )}`,
      };
    }
    if (p.tahap === 'ambil') {
      return { langkah, isi: `${urut}${tombol('mulung', 'Mulung', st.mulung, 'kedua')}${tombol('ambil', 'Ambil deck', st.ambil, 'utama')}` };
    }
    const labelBuang =
      terpilih.length === 1
        ? st.mentung && st.buang.aktif
          ? `Mentung pakai ${labelKartu(terpilih[0])}!`
          : `Buang ${labelKartu(terpilih[0])}`
        : st.mentung
          ? 'Pilih kartu buat mentung'
          : 'Pilih kartu';
    return { langkah, isi: `${urut}${tombol('turunkan', labelTurunkan, st.turunkan, 'kedua')}${tombol('buang', labelBuang, st.buang, 'utama')}` };
  }

  /** Tulis ulang bar aksi hanya bila isinya berubah; fokus tombol dikembalikan berdasarkan data-a. */
  private renderAksi(st: DaftarStatus) {
    const { langkah, isi } = this.susunBar(st);
    if (langkah !== this.htmlLangkah) {
      this.htmlLangkah = langkah;
      this.elLangkah.innerHTML = langkah;
    }
    if (isi !== this.htmlTombol) {
      const aktif = document.activeElement as HTMLElement | null;
      const a = aktif && this.elTombol.contains(aktif) ? aktif.dataset.a : undefined;
      this.htmlTombol = isi;
      this.elTombol.innerHTML = isi;
      if (a) {
        const ganti =
          this.elTombol.querySelector<HTMLElement>(`[data-a="${a}"]`) ??
          this.elTombol.querySelector<HTMLElement>('button.utama') ??
          this.elTombol.querySelector<HTMLElement>('button');
        ganti?.focus({ preventScroll: true });
      }
    }
    this.setPetunjuk(this.petunjuk, this.petunjukSalah);
  }

  /** Tombol bar aksi ditekan (klik, sentuh, atau pintasan keyboard). */
  private tekanTombol(a: string) {
    if (this.hancur || !this.view) return;
    const b = this.elTombol.querySelector<HTMLElement>(`[data-a="${a}"]`);
    if (!b) return;
    // Aksi sebelumnya belum dijawab: tekan ulang (double-tap / tombol ditahan) diabaikan diam-diam.
    if (this.menungguJawaban && a !== 'urut') return;
    if (b.getAttribute('aria-disabled') === 'true') return this.tolak(b.dataset.alasan ?? '', this.sasaranTombol(a));
    bunyi('klik');
    const v = this.view;
    switch (a) {
      case 'ambil':
        return this.ambilDeck();
      case 'mulung':
        this.pilihJumlah = true;
        this.dipilih.clear();
        this.petunjuk = '';
        umumkan(`Pilih jumlah pungutan: ketuk kartu di buangan atau tekan angka 1 sampai ${maksimalMulung(v.pemain.length, v.putaran?.buangan.length ?? 0)}.`);
        return this.render();
      case 'batal':
        return this.batalMulung();
      case 'jadikan':
        return this.jadikanMulung();
      case 'konfirmasi':
        return this.konfirmasiMulung();
      case 'turunkan':
        return this.turunkan();
      case 'buang':
        return this.buang();
      case 'selesai':
        return this.kirimAksi({ jenis: 'selesaiSusun' });
      case 'urut':
        this.urutan = this.urutan === 'bunga' ? 'angka' : 'bunga';
        umumkan(`Kartu diurutkan menurut ${this.urutan}.`);
        return this.render();
      case 'hasil':
        return v.status === 'selesai' ? this.modalSelesai() : this.modalHasil(v.riwayat[v.riwayat.length - 1]);
    }
  }

  // ---------- keyboard ----------

  private tombolKeyboard(e: KeyboardEvent) {
    if (this.hancur || e.defaultPrevented || e.ctrlKey || e.metaKey || e.altKey || !this.view) return;
    // Jendela terbuka: keyboard milik jendela itu (dom.ts mengurus Tab/Escape).
    if (adaJendelaTerbuka()) return;
    const t = e.target as HTMLElement | null;
    if (t?.closest('input, textarea, select, [contenteditable="true"], .tutorial')) return;
    const diTombol = !!t?.closest('button');

    const arah = PANAH[e.key];
    if (arah) {
      e.preventDefault();
      // Lepas fokus tombol supaya Spasi/Enter berikutnya mengetuk kartu yang disorot.
      if (diTombol && this.akar.contains(t)) t!.closest('button')!.blur();
      return this.geserSorotan(arah);
    }
    // Tombol yang ditahan (auto-repeat) hanya berlaku untuk panah; aksi lain sekali per tekan.
    if (e.repeat) {
      if (PINTASAN_HURUF[e.key.toLowerCase()] || /^[1-9]$/.test(e.key) || ((e.key === ' ' || e.key === 'Enter') && !diTombol)) e.preventDefault();
      return;
    }
    switch (e.key) {
      case 'Enter':
      case ' ':
        if (diTombol || !this.modusKeyboard || !this.fokus) return;
        e.preventDefault();
        return this.ketukSorotan();
      case 'Escape': {
        const palet = this.akar.querySelector('.palet-emote');
        if (palet) return this.tutupPaletEmote(true);
        if (this.pilihJumlah || this.mulung) return this.batalMulung();
        if (this.dipilih.size) {
          this.dipilih.clear();
          umumkan('Semua pilihan dilepas.');
          return this.render();
        }
        if (this.modusKeyboard) {
          this.modusKeyboard = false;
          return this.render();
        }
        return;
      }
      case 'Backspace':
      case 'Delete':
        if (!this.mulung?.kombinasi.length) return;
        e.preventDefault();
        return this.ketukKombinasi(this.mulung.kombinasi.length - 1);
      case '?':
        e.preventDefault();
        return this.bukaPintasan();
    }
    if (/^[1-9]$/.test(e.key)) return this.mungutAngka(Number(e.key));
    const a = PINTASAN_HURUF[e.key.toLowerCase()];
    if (!a) return;
    e.preventDefault();
    if (this.elTombol.querySelector(`[data-a="${a}"]`)) return this.tekanTombol(a);
    // Tombolnya tidak ada di keadaan ini: jelaskan kenapa.
    const st = this.statusTombol();
    const peta: Partial<Record<string, StatusTombol>> = { ambil: st.ambil, mulung: st.mulung, turunkan: st.turunkan, buang: st.buang, selesai: st.selesai };
    const s = peta[a];
    const alasan =
      this.mulung || this.pilihJumlah
        ? 'Selesaikan atau batalkan mulung dulu (Esc).'
        : s && !s.aktif
          ? s.alasan
          : 'Pintasan itu belum bisa dipakai sekarang.';
    this.tolak(alasan, this.sasaranTombol(a));
  }

  /** Angka 1–9 di giliran ambil = mungut sejumlah kartu teratas (sama dengan mengetuk kartunya). */
  private mungutAngka(n: number) {
    const v = this.view!;
    const p = v.putaran;
    if (!p || (!this.pilihJumlah && !this.statusTombol().mulung.aktif) || this.mulung) return;
    const maks = maksimalMulung(v.pemain.length, p.buangan.length);
    if (n > maks) return this.tolak(`Paling banyak mungut ${maks} kartu.`, 'buangan');
    this.ketukBuangan(n);
  }

  /** Sasaran baris tengah yang sekarang tidak berguna untukku (lihat `geserFokus`). */
  private tengahMati(): string[] {
    const p = this.view?.putaran;
    if (!p) return [...TENGAH];
    const mati: string[] = [];
    if (!this.giliranSaya() || p.tahap !== 'ambil' || !p.jumlahDeck) mati.push('deck');
    if (!p.jumlahBuangan) mati.push('buangan');
    return mati;
  }

  private geserSorotan(arah: ArahFokus) {
    const deret = this.deretBawah();
    const mati = this.tengahMati();
    const fokusMati = !!this.fokus && mati.includes(this.fokus);
    // Biasanya tekan panah pertama (setelah Esc/sentuhan) hanya menampilkan lagi sorotan lama. Sorotan
    // di deck/buangan yang tidak berguna langsung digeser: kalau belum tampak, dianggap belum ada
    // (panah apa pun mulai dari tangan); kalau tampak, ↓/Home/End membawanya ke tangan.
    const asal = fokusMati && !this.modusKeyboard ? null : this.fokus;
    const geser = this.modusKeyboard || !asal;
    const baru = geser ? geserFokus(asal, arah, deret, this.indeksFokus, mati) : this.fokus;
    this.modusKeyboard = true;
    this.fokus = baru;
    if (baru && !diTengah(baru)) this.indeksFokus = Math.max(0, deret.indexOf(baru));
    this.umumkanSorotan();
    this.render();
  }

  private ingatFokus(id: string) {
    const i = this.deretBawah().indexOf(id);
    if (i < 0) return;
    this.fokus = id;
    this.indeksFokus = i;
  }

  /** Sorotan yang kartunya sudah tidak ada (dibuang/dijadikan) pindah ke kartu terdekat. */
  private rapikanFokus() {
    if (!this.fokus || diTengah(this.fokus)) return;
    const deret = this.deretBawah();
    if (deret.includes(this.fokus)) return;
    this.fokus = deret.length ? deret[Math.min(this.indeksFokus, deret.length - 1)] : 'deck';
  }

  private umumkanSorotan() {
    const f = this.fokus;
    const p = this.view?.putaran;
    if (!f || !p) return;
    if (f === 'deck') return umumkan(`Deck, ${p.jumlahDeck} kartu.`);
    if (f === 'buangan') {
      const st = this.statusTombol().mulung;
      const maks = maksimalMulung(this.view!.pemain.length, p.buangan.length);
      return umumkan(`Tumpukan buangan, ${p.jumlahBuangan} kartu.${st.aktif && !this.mulung ? ` Enter untuk mungut kartu teratas, angka 1–${maks} untuk mungut lebih.` : ''}`);
    }
    const deret = this.deretBawah();
    const k = this.semuaKartuMulung().find((x) => x.id === f);
    if (!k) return;
    const pungutan = this.idPungutan().has(f) ? 'Pungutan, ' : '';
    umumkan(`${pungutan}${namaKartu(k)}${this.dipilih.has(f) ? ', dipilih' : ''}. ${deret.indexOf(f) + 1} dari ${deret.length}.`);
  }

  private ketukSorotan() {
    const f = this.fokus;
    if (!f) return;
    if (f === 'deck') return this.ketukDeck();
    if (f === 'buangan') return this.mulung ? this.tolak('Lagi nyusun mulung. Batalkan dulu (✕) kalau mau ganti jumlah pungutan.', 'buangan') : this.ketukBuangan(1);
    this.ketukKartu(f);
  }

  private bukaPintasan() {
    bunyi('klik');
    bukaDialog(
      `<div class="kepala-dialog"><h2>Pintasan keyboard</h2><button type="button" class="tombol-ikon hantu tutup-dialog" data-tutup aria-label="Tutup"><span aria-hidden="true">✕</span></button></div>
       <p class="redup rapat">Main tanpa mouse: sorot kartu dengan panah, ketuk dengan Spasi atau Enter.</p>
       <table class="skor pintasan">
         <tbody>${DAFTAR_PINTASAN.map((x) => `<tr><th scope="row"><kbd>${esc(x.tombol)}</kbd></th><td class="kiri">${esc(x.arti)}</td></tr>`).join('')}</tbody>
       </table>
       <div class="kaki-dialog"><button type="button" class="utama" data-tutup>Siap</button></div>`,
      undefined,
      { label: 'Pintasan keyboard' },
    );
  }

  // ---------- tutorial ----------

  private keadaanTutorial(st: DaftarStatus): KeadaanTutorial {
    const v = this.view!;
    const p = v.putaran;
    const saya = this.saya;
    const lawanJadi = p ? v.pemain.findIndex((_, i) => i !== saya && p.kartuJadi[i].length > 0) : -1;
    return {
      status: v.status,
      menungguJoker: !!this.info?.menungguJoker.length,
      giliranku: this.giliranSaya(),
      tahap: p?.tahap ?? null,
      bisaMulung: st.mulung.aktif,
      adaBuangan: !!p?.buangan.length,
      sedangMulung: this.pilihJumlah || !!this.mulung,
      habisMulung: p?.sumberAmbil === 'buangan',
      adaMentung: !!p?.mentung,
      susunSaya: this.susunSaya(),
      giliranLawan: p && v.status === 'putaranBerjalan' && p.giliran !== saya ? p.giliran : null,
      lawanBerkartuJadi: lawanJadi >= 0 ? lawanJadi : null,
      sibuk: this.animasi || this.sedangMemutar || adaJendelaTerbuka(),
    };
  }

  // ---------- emote ----------

  private bukaPaletEmote(dariKeyboard: boolean) {
    if (this.akar.querySelector('.palet-emote')) return this.tutupPaletEmote(dariKeyboard);
    const el = document.createElement('div');
    el.className = 'palet-emote';
    el.setAttribute('role', 'group');
    el.setAttribute('aria-label', 'Pilih emote');
    el.innerHTML = DAFTAR_EMOTE.map((e) => `<button type="button" data-emote="${esc(e)}" class="${[...e].length <= 2 ? 'emoji' : ''}">${esc(e)}</button>`).join('');
    el.addEventListener('click', (ev) => {
      const b = (ev.target as HTMLElement).closest<HTMLElement>('[data-emote]');
      if (!b) return;
      this.app.kirim({ t: 'emote', isi: b.dataset.emote as Emote });
      this.tutupPaletEmote(ev.detail === 0);
    });
    this.akar.appendChild(el);
    this.elAtas.querySelector('[data-a=emote]')!.setAttribute('aria-expanded', 'true');
    if (dariKeyboard) el.querySelector<HTMLElement>('button')?.focus();
  }

  private tutupPaletEmote(kembalikanFokus: boolean) {
    this.akar.querySelector('.palet-emote')?.remove();
    const b = this.elAtas.querySelector<HTMLElement>('[data-a=emote]')!;
    b.setAttribute('aria-expanded', 'false');
    if (kembalikanFokus) b.focus();
  }

  /** Emote masuk. Kalau animasi sedang berjalan, ditunda sebentar supaya tidak mendahului kejadiannya. */
  terimaEmote(kursi: number, isi: Emote) {
    if (this.hancur) return;
    if (this.animasi) {
      this.emoteTertunda.push([kursi, isi]);
      setTimeout(() => this.lepasEmoteTertunda(), 4000);
      return;
    }
    this.gelembung(kursi, isi);
  }

  private lepasEmoteTertunda() {
    for (const [kursi, isi] of this.emoteTertunda.splice(0)) this.gelembung(kursi, isi);
  }

  private gelembung(kursi: number, isi: Emote) {
    if (this.hancur) return;
    const pos = this.scene.posisiPemain(kursi);
    const dpr = window.devicePixelRatio || 1;
    const el = document.createElement('div');
    const emoji = [...isi].length <= 2;
    const milikku = kursi === this.saya;
    el.className = `gelembung${emoji ? ' emoji' : ''}${milikku ? ' milikku' : ''}`;
    el.textContent = isi;
    el.setAttribute('aria-hidden', 'true');
    const x = pos ? pos.x / dpr : window.innerWidth / 2;
    const y = pos ? pos.y / dpr : window.innerHeight / 2;
    el.style.left = `${Math.min(window.innerWidth - 60, Math.max(60, x))}px`;
    el.style.top = `${Math.max(40, y - (milikku ? 70 : 10))}px`;
    this.akar.appendChild(el);
    if (milikku) bunyi('pop');
    else {
      bunyi('notifikasi');
      umumkan(`${this.namaUntukPembaca(kursi)}: ${isi}`);
    }
    setTimeout(() => el.remove(), 2600);
  }

  // ---------- jendela ----------

  /** Pesan dari tombol jendela sedang dikirim (cegah kirim ganda) sampai dijawab atau batas waktu. */
  private sedangDikirim(kunci: string): boolean {
    const t = this.tertunda.get(kunci);
    return t !== undefined && Date.now() - t < BATAS_KIRIM_MS;
  }

  /** Tandai tombol sedang diproses, kunci tombol sekelompoknya, lalu segarkan modal hasil kalau server diam. */
  private tandaiKirim(kunci: 'kocok' | 'akhiri', tombol: HTMLButtonElement, kelompok: Iterable<HTMLButtonElement>) {
    this.tertunda.set(kunci, Date.now());
    // aria-disabled, bukan disabled: tombol yang dimatikan dengan `disabled` melepas fokus keyboard
    // ke <body> (Chrome), jadi pemain keyboard kehilangan posisinya di modal selagi menunggu.
    for (const b of kelompok) b.setAttribute('aria-disabled', 'true');
    tombol.setAttribute('aria-busy', 'true');
    tombol.textContent = this.labelSibuk(kunci);
    // DOM tombol lanjut baru saja diubah langsung, jadi tidak lagi sama dengan htmlLanjutTerpasang.
    // Tandai kotor supaya perbaruiModalHasil berikutnya (info baru atau cadangan batas waktu di bawah)
    // pasti memasang ulang tombolnya; kalau tidak, HTML non-sibuk sesudah batas waktu dianggap "sama"
    // dan tombol terkunci selamanya di "Mengocok…"/"Mengirim…".
    if (kunci === 'kocok') this.htmlLanjutTerpasang = '';
    this.timerTertunda.push(
      setTimeout(() => {
        // Cek modal hasil yang terbuka SEKARANG, bukan tombol lama: wadah lanjut boleh sudah dipasang
        // ulang, atau modalnya ditutup lalu dibuka lagi dari "Hasil putaran" selagi masih menunggu.
        // Kalau modalnya sudah ditutup, jangan dibuka lagi tanpa diminta.
        if (this.hancur || !document.querySelector('#modal [data-hasil]')) return;
        const v = this.view;
        if (v?.status === 'putaranSelesai') this.modalHasil(v.riwayat[v.riwayat.length - 1]);
      }, BATAS_KIRIM_MS + 50),
    );
  }

  /** Label tombol yang sedang menunggu. Offline langsung diproses di HP ini, jadi bukan "Mengirim…". */
  private labelSibuk(kunci: 'kocok' | 'akhiri'): string {
    if (this.app.jenis === 'offline') return kunci === 'kocok' ? 'Mengocok…' : 'Sebentar…';
    return 'Mengirim…';
  }

  /** Bagian tombol "Putaran berikutnya" / pilihan pengocok di modal hasil (berubah saat kirim/host berganti). */
  private htmlLanjutHasil(): string {
    const v = this.view!;
    const info = this.info!;
    const min = Math.min(...v.skor);
    const kandidat = v.skor.map((s, i) => (s === min ? i : -1)).filter((i) => i >= 0);
    if (info.kursiSaya !== info.host) return '<p class="redup rapat">Menunggu host memulai putaran berikutnya…</p>';
    const sibuk = this.sedangDikirim('kocok');
    const atribut = sibuk ? ' aria-disabled="true"' : '';
    if (kandidat.length > 1) {
      return `<p class="redup rapat">Skor terendah sama. Pilih pengocok berikutnya:</p>
           <div class="deret">${kandidat.map((i) => `<button type="button" data-kocok="${i}"${atribut}>${esc(v.pemain[i].nama)}</button>`).join('')}<button type="button" class="utama" data-kocok="acak"${atribut}>Acak</button></div>`;
    }
    return `<button type="button" class="utama" data-kocok="acak"${atribut}${sibuk ? ' aria-busy="true"' : ''}>${
      sibuk ? this.labelSibuk('kocok') : `Putaran berikutnya (${esc(v.pemain[kandidat[0]].nama)} ngocok)`
    }</button>`;
  }

  /** Keadaan tombol "Akhiri permainan" (voting) di modal hasil. */
  private keadaanAkhiri(): { teks: string; bahaya: boolean; sibuk: boolean } {
    const info = this.info!;
    const setuju = info.setujuAkhiri.length;
    const manusia = info.kursi.filter((k) => k.jenis === 'manusia' && k.terhubung).length;
    const sayaSetuju = info.setujuAkhiri.includes(this.saya);
    if (this.akhiriDiminta !== null && (sayaSetuju === this.akhiriDiminta || !this.sedangDikirim('akhiri'))) {
      this.akhiriDiminta = null;
      this.tertunda.delete('akhiri');
    }
    const sibuk = this.sedangDikirim('akhiri');
    return {
      teks: sibuk ? this.labelSibuk('akhiri') : `${sayaSetuju ? 'Batal akhiri' : 'Akhiri permainan'}${manusia > 1 ? ` (${setuju}/${manusia})` : ''}`,
      bahaya: sayaSetuju,
      sibuk,
    };
  }

  /**
   * Modal hasil putaran. Kalau modal untuk putaran yang sama sudah terbuka, hanya tombol lanjut dan
   * voting akhiri yang diperbarui di tempat: fokus keyboard dan posisi gulir pemain tidak direbut
   * (dulu modal digambar ulang total dan fokus lompat ke "Putaran berikutnya").
   */
  private modalHasil(h: HasilPutaran | undefined) {
    if (this.hancur || !h) return;
    const lanjut = this.htmlLanjutHasil();
    const akhiri = this.keadaanAkhiri();
    const ada = document.querySelector<HTMLElement>(`#modal [data-hasil="${h.nomor}"]`)?.closest<HTMLElement>('.dialog');
    if (ada) return this.perbaruiModalHasil(ada, lanjut, akhiri);

    const v = this.view!;
    // Pertahankan akordion yang sedang terbuka (modal dibuka lagi dari tombol "Hasil putaran").
    const terbuka = new Set<number>([this.saya]);
    const animasikan = this.hasilDianimasikan !== h.nomor;
    this.hasilDianimasikan = h.nomor;
    const baris = `<div data-hasil-rincian>${htmlRincianPutaran(h, (i) => v.pemain[i].nama, this.saya, terbuka)}</div>`;
    const cara = esc(teksCaraSelesai(h, (i) => v.pemain[i].nama));
    const min = Math.min(...v.skor);
    const kandidat = v.skor.map((s, i) => (s === min ? i : -1)).filter((i) => i >= 0);
    const arah = `Arah berikutnya: ${h.arahBerikutnya === 1 ? 'searah' : 'berbalik'}${h.cara === 'mentung' ? (h.dibalik ? ' (dibalik)' : ' (lompat, tetap)') : ''}.`;
    this.htmlLanjutTerpasang = lanjut;
    bukaModal(
      `<div data-hasil="${h.nomor}"></div>
       <h2>Hasil putaran ${h.nomor}</h2>
       ${this.tutorial?.htmlCatatan('skor') ?? ''}
       <p class="rapat">${cara}</p>
       <p class="redup rapat">Diurutkan dari skor tertinggi. Ketuk nama untuk melihat rinciannya.</p>
       ${baris}
       <p class="redup rapat">${arah} Pengocok berikutnya: skor terendah (${kandidat.map((i) => esc(v.pemain[i].nama)).join(', ')}).</p>
       <div class="kaki-dialog aksi-hasil">
         <div class="aksi-hasil-lanjut" data-lanjut-wadah>${lanjut}</div>
         <div class="deret">
           <button type="button" data-tutup>Lihat meja</button>
           <button type="button" data-akhiri class="${akhiri.bahaya ? 'bahaya' : ''}"${akhiri.sibuk ? ' aria-disabled="true" aria-busy="true"' : ''}>${esc(akhiri.teks)}</button>
         </div>
       </div>`,
      (dlg) => {
        if (animasikan) {
          dlg.querySelector('[data-hasil-rincian] .rincian')?.classList.add('muncul-bertahap');
          hitungNaik(dlg.querySelector('[data-hasil-rincian]')!, durasi(700));
        }
        // Satu pendengar untuk semua tombol: isi tombol boleh diganti tanpa memasang ulang.
        dlg.addEventListener('click', (ev) => {
          const b = (ev.target as HTMLElement).closest<HTMLButtonElement>('button');
          if (!b || b.disabled || b.getAttribute('aria-disabled') === 'true' || this.hancur) return;
          if (b.dataset.kocok !== undefined) {
            if (this.sedangDikirim('kocok')) return;
            bunyi('klik');
            const k = b.dataset.kocok;
            this.tandaiKirim('kocok', b, dlg.querySelectorAll<HTMLButtonElement>('[data-kocok]'));
            this.app.kirim({ t: 'putaranBerikut', pengocok: k === 'acak' ? undefined : Number(k) });
          } else if (b.hasAttribute('data-akhiri')) {
            if (this.sedangDikirim('akhiri')) return;
            bunyi('klik');
            const setuju = !(this.info?.setujuAkhiri.includes(this.saya) ?? false);
            this.akhiriDiminta = setuju;
            this.tandaiKirim('akhiri', b, [b]);
            this.app.kirim({ t: 'akhiri', setuju });
          }
        });
      },
      {
        saatTutup: () => {
          this.tutorial?.tandai('skor');
          this.fokusKeTombolHasil();
        },
      },
    );
  }

  /**
   * Modal hasil ditutup (Escape, ketuk latar, Back, "Lihat meja"): fokus keyboard pindah ke tombol
   * "Hasil putaran" di bar aksi, bukan lepas ke <body>. Modal ini muncul sendiri tanpa elemen pemicu,
   * jadi dom.ts tidak punya sasaran untuk mengembalikan fokus. Ditunda sampai render selesai; tidak
   * merebut fokus yang sudah dipindah ke tempat lain (mis. popup joker putaran berikutnya).
   */
  private fokusKeTombolHasil() {
    setTimeout(() => {
      if (this.hancur || adaJendelaTerbuka()) return;
      const aktif = document.activeElement;
      if (aktif && aktif !== document.body && aktif.isConnected) return;
      this.elTombol.querySelector<HTMLElement>('[data-a="hasil"]')?.focus({ preventScroll: true });
    }, 0);
  }

  /** Perbarui tombol modal hasil yang sudah terbuka tanpa menggambar ulang dialognya. */
  private perbaruiModalHasil(dlg: HTMLElement, lanjut: string, akhiri: { teks: string; bahaya: boolean; sibuk: boolean }) {
    const wadah = dlg.querySelector<HTMLElement>('[data-lanjut-wadah]');
    if (wadah && lanjut !== this.htmlLanjutTerpasang) {
      const aktif = document.activeElement;
      const fokusKocok = aktif instanceof HTMLElement && wadah.contains(aktif) ? (aktif.dataset.kocok ?? '') : null;
      this.htmlLanjutTerpasang = lanjut;
      wadah.innerHTML = lanjut;
      if (fokusKocok !== null) {
        const ganti = wadah.querySelector<HTMLElement>(`[data-kocok="${fokusKocok}"]`) ?? wadah.querySelector<HTMLElement>('button');
        ganti?.focus({ preventScroll: true });
      }
    }
    const b = dlg.querySelector<HTMLButtonElement>('[data-akhiri]');
    if (!b) return;
    if (b.textContent !== akhiri.teks) b.textContent = akhiri.teks;
    b.classList.toggle('bahaya', akhiri.bahaya);
    if (akhiri.sibuk) {
      b.setAttribute('aria-disabled', 'true');
      b.setAttribute('aria-busy', 'true');
    } else {
      b.removeAttribute('aria-disabled');
      b.removeAttribute('aria-busy');
    }
  }

  private modalJoker() {
    if (this.hancur) return;
    const v = this.view!;
    const p = v.putaran!;
    const k = p.kartuDibuka;
    const nomor = p.nomor;
    const catatan = this.tutorial?.htmlCatatan('joker') ?? '';
    const label = this.tutorial?.labelTombol('joker') ?? 'OK, sudah ingat';
    bunyi('balik');
    bukaModal(
      `<div data-joker></div>
       <h2 class="rata-tengah">Putaran ${nomor} · Joker</h2>
       <p class="redup rata-tengah rapat">${esc(v.pemain[p.pengocok].nama)} ngocok dan membuka kartu:</p>
       <div class="kartu-pamer" data-kartu></div>
       <p class="rata-tengah rapat">Semua kartu <b>${esc(namaRank(k.rank))}</b> jadi joker putaran ini.</p>
       <p class="redup rata-tengah rapat">Ingat baik-baik, kartu ini tidak ditampilkan lagi.</p>
       ${catatan}
       <button type="button" class="utama" data-ok autofocus>${esc(label)}</button>`,
      (dlg) => {
        dlg.querySelector('[data-kartu]')!.appendChild(gambarKartuKeKanvas(k, lebarKartuPamer()));
        dlg.querySelector('[data-ok]')!.addEventListener('click', () => {
          this.jokerDiOk = nomor;
          // Kalau sinyal sedang putus, pesan ini hilang; nomor sambungan yang baru nanti memicu kirim ulang.
          this.siapJokerDiSambungan = this.sambunganKini();
          tutupModal();
          this.tutorial?.tandai('joker');
          this.app.kirim({ t: 'siapJoker' });
        });
      },
      { bisaDitutup: false },
    );
  }

  /** Kartu teratas buangan milikku dan pemain lain sedang menimbang mau ambil apa. */
  private kartukuDiAtas(): boolean {
    const v = this.view;
    const p = v?.putaran;
    if (!v || !p || v.status !== 'putaranBerjalan' || this.info?.menungguJoker.length) return false;
    const atas = p.buangan[p.buangan.length - 1];
    return !!atas && atas.pemilik === this.saya && p.giliran !== this.saya && p.tahap === 'ambil';
  }

  /** Detak jantung selama kartumu di atas tumpukan dan lawan sedang menimbang. */
  private aturDetak(nyala: boolean) {
    if (nyala && !this.timerDetak) this.timerDetak = setInterval(() => bunyi('detak'), 950);
    if (!nyala && this.timerDetak) {
      clearInterval(this.timerDetak);
      this.timerDetak = null;
    }
  }

  private modalSelesai() {
    if (this.hancur) return;
    const pertama = !this.selesaiDitampilkan;
    this.selesaiDitampilkan = true;
    const v = this.view!;
    const info = this.info!;
    const nama = v.pemain.map((pm) => pm.nama);
    const peringkat = peringkatSeri(v.skor);
    const juara = nama.filter((_, i) => peringkat[i] === 1);
    const alasan = { sepakat: 'Semua sepakat berhenti.', batasPutaran: 'Batas putaran tercapai.', batasSkor: 'Ada yang mencapai batas skor.' };
    const host = info.kursiSaya === info.host;
    const offline = this.app.jenis === 'offline';
    const menang = v.saya !== null && peringkat[v.saya] === 1;
    // Putaran terakhir tidak sempat tampil di modal hasil (langsung ke klasemen): ringkasannya di sini.
    const terakhir = v.riwayat.at(-1);
    // Latihan: penjelasan skor + penutup tutorial di dalam klasemen (latihan langsung ke sini).
    const penutup = this.tutorial?.htmlPenutup() ?? { skor: '', selesai: '' };
    const labelLagi = penutup.selesai ? (TEKS_TUTORIAL.selesai.tombol ?? 'Main lagi') : 'Main lagi';
    bukaModal(
      `<div data-selesai></div>
       <h2>Klasemen akhir</h2>
       <p class="juara-teks"><span aria-hidden="true">🏆</span> ${esc(juara.join(' & '))} ${juara.length > 1 ? 'juara bareng' : 'juara'}!</p>
       <p class="redup rapat">${esc(v.alasanSelesai ? alasan[v.alasanSelesai] : '')} ${v.riwayat.length} putaran.</p>
       ${penutup.skor}
       ${htmlKlasemen(nama, v.skor, v.saya, terakhir)}
       ${terakhir ? htmlRingkasPutaranTerakhir(terakhir, (i) => nama[i], v.saya) : ''}
       ${penutup.selesai}
       <div class="deret">
         ${offline ? `<button type="button" class="utama" data-a="lagi">${esc(labelLagi)}</button>` : host ? '<button type="button" class="utama" data-a="lagi">Main lagi (ke lobi)</button>' : ''}
         <button type="button" data-a="skor">Rincian skor</button>
         <button type="button" data-a="keluar">Ke beranda</button>
       </div>
       ${this.app.tutorial ? '' : this.htmlAjakanKedai()}`,
      (dlg) => {
        if (pertama) {
          dlg.querySelector('table.klasemen tbody')?.classList.add('muncul-bertahap');
          hitungNaik(dlg, durasi(900));
        }
        dlg.querySelector('[data-a=lagi]')?.addEventListener('click', () => {
          bunyi('klik');
          if (offline) {
            tutupModal();
            return this.app.mainLagiOffline();
          }
          void konfirmasi({
            judul: 'Main lagi?',
            pesan: 'Semua pemain dibawa balik ke lobi untuk permainan baru, skornya mulai dari nol lagi.',
            ya: 'Ayo, ke lobi',
          }).then((ya) => {
            if (!ya || this.hancur) return;
            tutupModal();
            this.app.kirim({ t: 'mainLagi' });
          });
        });
        dlg.querySelector('[data-a=skor]')!.addEventListener('click', () => this.bukaSkor('riwayat'));
        dlg.querySelector('[data-a=keluar]')!.addEventListener('click', () => {
          tutupModal();
          this.app.keluarMeja();
        });
      },
      { bisaDitutup: false },
    );
    if (pertama && v.saya !== null) {
      bunyi(menang ? 'menang' : 'kalah');
      if (menang) getar('menang');
      const hasil = menang ? 'Selamat, kamu juara!' : `Permainan selesai. Kamu peringkat ${peringkat[v.saya]}.`;
      const tutup = penutup.selesai ? ` ${teksPengumuman(TEKS_TUTORIAL.selesai.judul, TEKS_TUTORIAL.selesai.teks)}` : '';
      umumkan(hasil + tutup);
    }
    // Penutup latihan sudah tampil: baru sekarang tutorial dianggap tuntas (tidak ditawarkan lagi).
    if (penutup.selesai) this.tutorial?.tuntaskan();
  }

  /**
   * Satu baris ajakan main di Kedai Madya, hanya di klasemen akhir (tidak di hasil per putaran,
   * tidak di latihan). Tautan polos ke peta; offline diberi catatan butuh internet.
   */
  private htmlAjakanKedai(): string {
    const offline = navigator.onLine === false ? ` <span class="kedai-offline">(${esc(KEDAI.catatanOffline.replace(/\.$/, ''))})</span>` : '';
    const peta = TAUTAN_KEDAI.find((t) => t.id === 'peta')!;
    return `<p class="redup rapat ajakan-kedai">Lanjut main bareng di Kedai Madya? <a href="${peta.url}" ${ATRIBUT_LUAR} data-tautan="peta" aria-label="${peta.aria}">${peta.label}</a>${offline}</p>`;
  }

  private bukaSkor(tab: 'peringkat' | 'riwayat' = 'peringkat') {
    const v = this.view;
    if (!v) return;
    const isi = (t: 'peringkat' | 'riwayat') => {
      const sekarang = this.view ?? v;
      return t === 'peringkat'
        ? htmlPeringkat(sekarang.pemain.map((p) => p.nama), sekarang.skor, sekarang.riwayat, this.saya)
        : htmlRiwayat((i) => sekarang.pemain[i].nama, sekarang.riwayat, this.saya);
    };
    const id = `skor-${Math.random().toString(36).slice(2, 8)}`;
    const tabHtml = (t: 'peringkat' | 'riwayat', label: string) =>
      `<button type="button" role="tab" id="${id}-${t}" data-tab="${t}" aria-controls="${id}-isi" aria-selected="${t === tab}" tabindex="${t === tab ? 0 : -1}">${label}</button>`;
    bukaDialog(
      `<div class="kepala-dialog"><h2>Papan skor</h2><button type="button" class="tombol-ikon hantu tutup-dialog" data-tutup aria-label="Tutup"><span aria-hidden="true">✕</span></button></div>
       <div role="tablist" aria-label="Papan skor">${tabHtml('peringkat', 'Peringkat')}${tabHtml('riwayat', 'Riwayat putaran')}</div>
       <div class="isi-tab" id="${id}-isi" role="tabpanel" aria-labelledby="${id}-${tab}" tabindex="0">${isi(tab)}</div>`,
      (dlg) => {
        const tombolTab = [...dlg.querySelectorAll<HTMLButtonElement>('[role=tab]')];
        const panel = dlg.querySelector<HTMLElement>('[role=tabpanel]')!;
        const pilih = (b: HTMLButtonElement) => {
          const t = b.dataset.tab as 'peringkat' | 'riwayat';
          tombolTab.forEach((x) => {
            x.setAttribute('aria-selected', String(x === b));
            x.tabIndex = x === b ? 0 : -1;
          });
          panel.setAttribute('aria-labelledby', b.id);
          panel.innerHTML = isi(t);
          b.focus();
        };
        tombolTab.forEach((b, i) => {
          b.addEventListener('click', () => pilih(b));
          b.addEventListener('keydown', (e) => {
            if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
            e.preventDefault();
            pilih(tombolTab[(i + (e.key === 'ArrowRight' ? 1 : tombolTab.length - 1)) % tombolTab.length]);
          });
        });
      },
      { kelas: 'lebar' },
    );
  }

  private bukaLog() {
    const v = this.view;
    if (!v) return;
    bukaDialog(
      `<div class="kepala-dialog"><h2>Log permainan</h2><button type="button" class="tombol-ikon hantu tutup-dialog" data-tutup aria-label="Tutup"><span aria-hidden="true">✕</span></button></div>
       ${htmlLog(v.log)}`,
    );
  }

  private bukaMenu() {
    const offline = this.app.jenis === 'offline';
    const info = this.info;
    const bolehTempo = offline || info?.kursiSaya === info?.host;
    const bisaLayarPenuh = !!document.fullscreenEnabled;
    // Daftar pintasan hanya berguna kalau ada keyboard/mouse (HP sentuh saja: disembunyikan).
    const adaKeyboard = window.matchMedia?.('(any-pointer: fine)').matches ?? true;
    bukaModal(
      `<div class="kepala-dialog"><h2>Menu</h2><button type="button" class="tombol-ikon hantu tutup-dialog" data-tutup aria-label="Tutup"><span aria-hidden="true">✕</span></button></div>
       <p class="redup rapat">${
         offline
           ? 'Permainan offline tersimpan otomatis. Kamu bisa lanjut kapan saja dari beranda.'
           : `Kode meja: <b>${esc(info?.kode)}</b>. Ajak teman gabung pakai kode ini.`
       }</p>
       <div class="menu-meja">
         <button type="button" class="utama" data-tutup>Lanjut main</button>
         <button type="button" data-m="pengaturan"><span aria-hidden="true">⚙️</span> Pengaturan</button>
         <button type="button" data-m="bantuan"><span aria-hidden="true">📖</span> Bantuan &amp; aturan</button>
         ${adaKeyboard ? '<button type="button" data-m="pintasan"><span aria-hidden="true">⌨️</span> Pintasan keyboard</button>' : ''}
         ${bisaLayarPenuh ? `<button type="button" data-m="layar"><span aria-hidden="true">⛶</span> ${document.fullscreenElement ? 'Keluar layar penuh' : 'Layar penuh'}</button>` : ''}
         <button type="button" data-m="tentang"><span aria-hidden="true">ℹ️</span> Tentang</button>
         <button type="button" data-m="keluar"${offline ? '' : ' class="bahaya"'}>${offline ? 'Simpan &amp; ke beranda' : 'Keluar meja'}</button>
       </div>`,
      (dlg) =>
        dlg.addEventListener('click', (e) => {
          const b = (e.target as HTMLElement).closest<HTMLElement>('[data-m]');
          if (!b) return;
          bunyi('klik');
          switch (b.dataset.m) {
            case 'pengaturan':
              return bukaPengaturan({
                diMeja: true,
                tempoBot: bolehTempo
                  ? {
                      nilai: this.info?.pengaturan.tempoBot ?? 'santai',
                      ubah: (tempoBot) => {
                        this.app.kirim({ t: 'pengaturan', pengaturan: { tempoBot } });
                        if (offline) simpan.setPengaturanOffline({ ...simpan.pengaturanOffline(), tempoBot });
                        umumkan(`Tempo warga kedai: ${LABEL_TEMPO[tempoBot]}.`);
                      },
                    }
                  : undefined,
              });
            case 'bantuan':
              return bukaBantuan();
            case 'pintasan':
              return this.bukaPintasan();
            case 'tentang':
              return bukaTentang();
            case 'layar':
              tutupModal();
              if (document.fullscreenElement) void document.exitFullscreen();
              else void document.documentElement.requestFullscreen?.().catch(() => toast('Layar penuh tidak didukung di sini.'));
              return;
            case 'keluar':
              if (offline) {
                tutupModal();
                return this.app.keluarMeja();
              }
              // Teks sama dengan jalur tombol Back (main.ts) lewat opsiKonfirmasiKeluar.
              void konfirmasi(opsiKonfirmasiKeluar({ asal: 'meja', offline: false, selesai: this.view?.status === 'selesai' })).then((ya) => {
                if (!ya || this.hancur) return;
                tutupModal();
                this.app.kirim({ t: 'keluar' });
                this.app.keluarMeja();
              });
              return;
          }
        }),
      { label: 'Menu' },
    );
  }
}
