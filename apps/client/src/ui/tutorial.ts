// Tutorial coach mark untuk permainan latihan: gelembung panduan + sorotan area meja, dipicu
// oleh keadaan permainan yang sungguhan (bukan skenario palsu).
//
// Pagar info rahasia: tutorial hanya membaca keadaan publik/milik sendiri yang sudah terlihat
// (giliran, tahap, ada buangan, ada kartu jadi lawan). Tidak pernah membaca angka joker, tidak
// menunjuk kartu tertentu, dan tidak menyarankan kartu mana yang dibuang atau dijadikan.
// Langkah 'joker' dan 'skor' tidak tampil sebagai gelembung, tapi sebagai catatan di dalam
// popup joker dan modal hasil putaran (supaya tidak bertumpuk dengan jendela wajib). Di akhir
// latihan (satu putaran, langsung klasemen akhir), 'skor' dan penutup 'selesai' tampil di dalam
// klasemen akhir lewat htmlPenutup(); tutorial baru dianggap tuntas setelah penutup itu tampil.

import type { StatusPermainan } from '@remi/engine';
import type { AreaMeja, KotakLayar } from '../game/MejaScene';
import { TEKS_TUTORIAL, URUTAN_TUTORIAL, type IdLangkahTutorial } from '../konten/tutorial';
import { aturPreferensi } from '../preferensi';
import { esc, toast, umumkan } from './dom';
import '../gaya/tutorial.css';

/** Ringkasan keadaan meja yang dibutuhkan pemicu tutorial. Semuanya info yang sudah terlihat pemain. */
export interface KeadaanTutorial {
  status: StatusPermainan;
  /** Masih menunggu pemain menekan OK di pengumuman joker. */
  menungguJoker: boolean;
  /** Giliranku (dan bukan sedang dijalankan bot). */
  giliranku: boolean;
  tahap: 'ambil' | 'main' | null;
  /** Tombol Mulung aktif (buangan ada isinya dan giliranku tahap ambil). */
  bisaMulung: boolean;
  adaBuangan: boolean;
  /** Sedang memilih jumlah pungutan atau menyusun kombinasi mulung. */
  sedangMulung: boolean;
  /** Giliran ini diawali mulung. */
  habisMulung: boolean;
  /** Sudah ada yang mentung di putaran ini. */
  adaMentung: boolean;
  /** Fase susun akhir dan aku belum menekan Selesai. */
  susunSaya: boolean;
  /** Kursi lawan yang sedang jalan; null bila giliranku / tidak ada. */
  giliranLawan: number | null;
  /** Kursi lawan pertama yang sudah punya kartu jadi; null bila belum ada. */
  lawanBerkartuJadi: number | null;
  /** Ada jendela terbuka atau animasi berjalan: gelembung disembunyikan dulu. */
  sibuk: boolean;
}

/** Langkah yang ditampilkan di dalam jendela (bukan gelembung). */
export const LANGKAH_JENDELA: ReadonlySet<IdLangkahTutorial> = new Set(['joker', 'skor']);

const jalan = (k: KeadaanTutorial) => k.status === 'putaranBerjalan' && !k.menungguJoker;
const ambilku = (k: KeadaanTutorial) => jalan(k) && k.giliranku && k.tahap === 'ambil';
const mainku = (k: KeadaanTutorial) => jalan(k) && k.giliranku && k.tahap === 'main';

/** Kapan tiap langkah relevan. Langkah yang sedang tampil dianggap selesai begitu syaratnya hilang. */
export const SYARAT_TUTORIAL: Record<IdLangkahTutorial, (k: KeadaanTutorial, selesai: ReadonlySet<IdLangkahTutorial>) => boolean> = {
  sambutan: () => true,
  joker: (k) => k.menungguJoker,
  tangan: (k) => jalan(k),
  giliranAmbil: (k) => ambilku(k) && !k.sedangMulung,
  deck: (k) => ambilku(k) && !k.sedangMulung,
  buangan: (k) => ambilku(k) && k.adaBuangan,
  mulung: (k) => ambilku(k) && (k.bisaMulung || k.sedangMulung),
  turunkan: (k) => mainku(k),
  buang: (k) => mainku(k),
  giliranLawan: (k) => jalan(k) && k.giliranLawan !== null,
  kartuJadiLawan: (k) => k.lawanBerkartuJadi !== null && (k.status === 'putaranBerjalan' || k.status === 'susunAkhir'),
  mentung: (k) => k.adaMentung || (mainku(k) && k.habisMulung),
  susunAkhir: (k) => k.status === 'susunAkhir' && k.susunSaya,
  skor: (k) => k.status === 'putaranSelesai' || k.status === 'selesai',
  selesai: (k, selesai) => selesai.has('skor') || k.status === 'selesai',
};

export interface HasilEvaluasi {
  /** Langkah yang dianggap selesai karena momennya sudah lewat (atau pemain sudah melakukannya). */
  selesaiBaru: IdLangkahTutorial[];
  /** Langkah yang perlu tampil sebagai gelembung sekarang; null = tidak ada / sembunyikan. */
  tampil: IdLangkahTutorial | null;
}

/**
 * Fungsi murni pemicu tutorial. `terakhir` = langkah gelembung yang terakhir tampil.
 * Langkah dipilih menurut URUTAN_TUTORIAL: yang pertama belum selesai dan syaratnya terpenuhi.
 */
export function evaluasiTutorial(
  selesai: ReadonlySet<IdLangkahTutorial>,
  terakhir: IdLangkahTutorial | null,
  k: KeadaanTutorial,
): HasilEvaluasi {
  if (k.sibuk) return { selesaiBaru: [], tampil: null };
  const selesaiBaru = terakhir && !selesai.has(terakhir) && !SYARAT_TUTORIAL[terakhir](k, selesai) ? [terakhir] : [];
  const sudah = new Set([...selesai, ...selesaiBaru]);
  const tampil =
    URUTAN_TUTORIAL.find((id) => !sudah.has(id) && !LANGKAH_JENDELA.has(id) && SYARAT_TUTORIAL[id](k, sudah)) ?? null;
  return { selesaiBaru, tampil };
}

/** Sasaran sorotan: area meja (digambar Phaser) atau elemen HTML di bar aksi. null = tengah layar. */
export type Sorotan = { meja: AreaMeja; indeks?: number } | { dom: string } | null;

export function sorotanLangkah(id: IdLangkahTutorial, k: KeadaanTutorial): Sorotan {
  switch (id) {
    case 'tangan':
    case 'mentung':
      return { meja: 'tangan' };
    case 'giliranAmbil':
    case 'susunAkhir':
      return { dom: '.tombol-aksi' };
    case 'deck':
      return { meja: 'deck' };
    case 'buangan':
    case 'mulung':
      return { meja: 'buangan' };
    case 'turunkan':
      return { dom: '[data-a="turunkan"]' };
    case 'buang':
      return { dom: '[data-a="buang"]' };
    case 'giliranLawan':
      return k.giliranLawan !== null ? { meja: 'panel', indeks: k.giliranLawan } : null;
    case 'kartuJadiLawan':
      return k.lawanBerkartuJadi !== null ? { meja: 'panel', indeks: k.lawanBerkartuJadi } : null;
    default:
      return null;
  }
}

export interface OpsiTutorial {
  /** Wadah HTML meja (#ui milik KontrolMeja). */
  akar: HTMLElement;
  /** Kotak layar (px CSS) untuk sebuah sorotan, atau null bila tidak diketahui. */
  kotak(s: Exclude<Sorotan, null>): KotakLayar | null;
  /** Dipanggil saat langkah berganti karena tombol tutorial (mis. popup joker yang ditahan boleh dibuka). */
  saatBerubah(): void;
}

const JARAK = 12;
const TEPI = 8;

export class Tutorial {
  private selesai = new Set<IdLangkahTutorial>();
  private terakhir: IdLangkahTutorial | null = null;
  private tampil: IdLangkahTutorial | null = null;
  private keadaan: KeadaanTutorial | null = null;
  private tamat = false;
  /** Pemain menekan "Baca semua" di mode ringkas: langkah ini tampil penuh. */
  private dibuka = false;
  private readonly akar: HTMLElement;
  private readonly elSorot: HTMLElement;
  private readonly elGelembung: HTMLElement;
  private readonly saatUkuran = () => this.posisikan();

  constructor(private readonly opsi: OpsiTutorial) {
    this.akar = document.createElement('div');
    this.akar.className = 'tutorial tersembunyi';
    this.akar.innerHTML = `<div class="tutorial-sorot" aria-hidden="true"></div>
      <section class="tutorial-gelembung" aria-label="Panduan latihan"></section>`;
    this.elSorot = this.akar.querySelector('.tutorial-sorot')!;
    this.elGelembung = this.akar.querySelector('.tutorial-gelembung')!;
    this.elGelembung.addEventListener('click', (e) => {
      const b = (e.target as HTMLElement).closest<HTMLElement>('[data-t]');
      if (!b) return;
      if (b.dataset.t === 'lewati') this.lewati();
      else if (b.dataset.t === 'selengkapnya') this.bukaTeks();
      else if (this.tampil) this.lanjut(this.tampil);
    });
    opsi.akar.appendChild(this.akar);
    window.addEventListener('resize', this.saatUkuran);
  }

  /** Tutorial masih berjalan. */
  get aktif(): boolean {
    return !this.tamat;
  }

  /** Popup joker ditahan sampai sambutan dibaca, supaya urutannya: sambutan → joker. */
  tahanPopupJoker(): boolean {
    return !this.tamat && !this.selesai.has('sambutan');
  }

  /** Catatan tutorial untuk ditaruh di dalam jendela ('joker' di popup joker, 'skor' di hasil putaran). */
  htmlCatatan(id: 'joker' | 'skor'): string {
    if (this.tamat || this.selesai.has(id) || !this.selesai.has('sambutan')) return '';
    return htmlCatatanTutorial(id);
  }

  /**
   * Penutup latihan di klasemen akhir. Latihan cuma satu putaran, jadi langsung ke klasemen (tanpa
   * modal hasil putaran) dan klasemennya tidak bisa ditutup: catatan 'skor' (kalau belum pernah
   * tampil) dan penutup 'selesai' ditaruh di dalam klasemen, bukan sebagai gelembung.
   * Kosong bila tutorial sudah tamat/dilewati.
   */
  htmlPenutup(): { skor: string; selesai: string } {
    if (this.tamat) return { skor: '', selesai: '' };
    return {
      skor: this.selesai.has('skor') ? '' : htmlCatatanTutorial('skor'),
      selesai: htmlCatatanTutorial('selesai', 'tutorial-penutup'),
    };
  }

  /** Penutup sudah tampil (di klasemen akhir): tutorial tuntas dan tidak ditawarkan lagi. */
  tuntaskan(): void {
    if (this.tamat) return;
    this.selesai.add('skor');
    this.selesai.add('selesai');
    this.akhiri();
  }

  /** Label tombol khusus langkah jendela (mis. 'Siap, sudah kuingat'); undefined bila tidak berlaku. */
  labelTombol(id: 'joker' | 'skor'): string | undefined {
    return this.htmlCatatan(id) ? TEKS_TUTORIAL[id].tombol : undefined;
  }

  /** Tandai langkah selesai (dipakai untuk langkah jendela saat jendelanya ditutup). */
  tandai(id: IdLangkahTutorial): void {
    if (this.tamat || this.selesai.has(id)) return;
    this.selesai.add(id);
    if (this.keadaan) this.perbarui(this.keadaan);
  }

  /** Nilai ulang keadaan meja: tampilkan, pindahkan, atau sembunyikan gelembung. */
  perbarui(k: KeadaanTutorial): void {
    if (this.tamat) return;
    this.keadaan = k;
    const h = evaluasiTutorial(this.selesai, this.terakhir, k);
    h.selesaiBaru.forEach((id) => this.selesai.add(id));
    if (!k.sibuk) this.terakhir = h.tampil;
    if (h.tampil !== this.tampil) this.gambar(h.tampil);
    else this.posisikan();
  }

  /** Lewati seluruh tutorial. */
  lewati(): void {
    this.akhiri();
    toast('Tutorial dilewati. Aturan lengkap ada di menu ☰ → Bantuan.');
  }

  hancurkan(): void {
    // Tanpa menyimpan preferensi (beda dengan akhiri): meja ditinggal, bukan tutorial tamat.
    // Jendela yang ditutup sesudah ini (mis. modal hasil → tandai('skor')) tidak memicu langkah baru.
    this.tamat = true;
    this.tampil = null;
    window.removeEventListener('resize', this.saatUkuran);
    this.akar.remove();
  }

  /** Mode ringkas: tampilkan teks lengkap (gelembung boleh menutupi area lain, tidak sasarannya). */
  private bukaTeks(): void {
    this.dibuka = true;
    this.posisikan();
    this.elGelembung.querySelector<HTMLElement>('[data-t="lanjut"]')?.focus({ preventScroll: true });
  }

  private lanjut(id: IdLangkahTutorial): void {
    this.selesai.add(id);
    if (id === 'selesai') return this.akhiri();
    this.terakhir = null;
    this.gambar(null);
    this.opsi.saatBerubah();
    if (this.keadaan) this.perbarui(this.keadaan);
  }

  private akhiri(): void {
    this.tamat = true;
    this.tampil = null;
    this.akar.classList.add('tersembunyi');
    aturPreferensi({ tutorialSelesai: true });
    this.opsi.saatBerubah();
  }

  private gambar(id: IdLangkahTutorial | null): void {
    const fokusDiDalam = this.akar.contains(document.activeElement);
    this.tampil = id;
    if (!id) {
      this.akar.classList.add('tersembunyi');
      return;
    }
    const t = TEKS_TUTORIAL[id];
    const tengah = id === 'sambutan' || id === 'selesai';
    this.dibuka = false;
    // "Baca semua" hanya terlihat di mode ringkas yang teksnya terlipat (kelas .ringkas.luap).
    this.elGelembung.innerHTML = `<p class="tutorial-judul">${esc(t.judul)}</p>
      <p class="tutorial-teks">${esc(t.teks)}</p>
      <button type="button" class="hantu kecil tutorial-selengkapnya" data-t="selengkapnya">Baca semua</button>
      <div class="tutorial-tombol">
        ${id === 'selesai' ? '' : '<button type="button" class="hantu kecil" data-t="lewati">Lewati tutorial</button>'}
        <button type="button" class="utama kecil" data-t="lanjut">${esc(t.tombol ?? 'Lanjut')}</button>
      </div>`;
    this.akar.classList.remove('tersembunyi');
    // Animasi masuk diulang tiap langkah baru.
    this.elGelembung.classList.remove('masuk');
    void this.elGelembung.offsetWidth;
    this.elGelembung.classList.add('masuk');
    this.posisikan();
    umumkan(teksPengumuman(t.judul, t.teks));
    // Sambutan & penutup berperan seperti dialog: fokus ke tombolnya. Langkah lain tidak merebut
    // fokus supaya permainan dengan keyboard tidak terganggu (kecuali fokus sudah di gelembung).
    if (tengah || fokusDiDalam) this.elGelembung.querySelector<HTMLElement>('[data-t="lanjut"]')?.focus({ preventScroll: true });
  }

  /** Letakkan sorotan dan gelembung dekat area yang dibahas (atau di tengah bila tidak diketahui). */
  private posisikan(): void {
    if (!this.tampil || !this.keadaan) return;
    const s = sorotanLangkah(this.tampil, this.keadaan);
    const r = s ? this.opsi.kotak(s) : null;
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const g = this.elGelembung;
    this.akar.classList.toggle('tengah', !r);
    if (r) {
      this.elSorot.style.left = `${r.x - SOROT}px`;
      this.elSorot.style.top = `${r.y - SOROT}px`;
      this.elSorot.style.width = `${r.w + 2 * SOROT}px`;
      this.elSorot.style.height = `${r.h + 2 * SOROT}px`;
    }
    const teks = g.querySelector<HTMLElement>('.tutorial-teks');
    /** Pasang (atau lepas, bila null) mode ringkas beserta variannya, lalu tandai teks yang terlipat. */
    const pasangRingkas = (v: VarianRingkas | null) => {
      g.classList.toggle('ringkas', !!v);
      // Varian sempit/satu baris lewat gaya inline: lebar tetap & teks dilipat jadi satu baris.
      g.style.width = v?.lebar ? `${v.lebar}px` : '';
      if (teks) {
        teks.style.setProperty('-webkit-line-clamp', v?.mini ? '1' : '');
        teks.style.setProperty('line-clamp', v?.mini ? '1' : '');
      }
      g.classList.toggle('luap', !!v && !!teks && teks.scrollHeight > teks.clientHeight + 1);
    };
    pasangRingkas(null);
    delete g.dataset.panah;
    const ukur = (): Ukuran => ({ w: g.offsetWidth, h: g.offsetHeight });
    const penuh = ukur();
    if (!r || !s) {
      g.style.left = `${Math.round(Math.max(TEPI, (vw - penuh.w) / 2))}px`;
      g.style.top = `${Math.round(Math.max(TEPI, (vh - penuh.h) * 0.4))}px`;
      return;
    }
    // Ukuran mode ringkas baru diukur kalau dibutuhkan (layar sempit/pendek), per varian. Teks yang
    // terlipat diberi tombol "Baca semua" (kelas luap) sebelum diukur supaya ukurannya sudah final.
    const cache = new Map<string, Ukuran>();
    const ukurRingkas = (v: VarianRingkas = {}): Ukuran => {
      const kunci = `${v.lebar ?? ''}|${v.mini ? 1 : 0}`;
      const ada = cache.get(kunci);
      if (ada) return ada;
      pasangRingkas(v);
      const uk = ukur();
      pasangRingkas(null);
      cache.set(kunci, uk);
      return uk;
    };
    const hasil = tataGelembung(r, penuh, this.dibuka ? null : ukurRingkas, {
      layar: { w: vw, h: vh },
      batasAtas: this.batasAtas(),
      sasaranPanel: 'meja' in s && s.meja === 'panel',
      hindari: this.areaPenting(),
    });
    if (hasil.ringkas) pasangRingkas(hasil.varian ?? {});
    const { x, y, panah } = hasil.posisi;
    g.style.left = `${Math.round(x)}px`;
    g.style.top = `${Math.round(y)}px`;
    if (panah) {
      const uk = hasil.ringkas ? ukur() : penuh;
      g.dataset.panah = panah;
      // Ujung panah menunjuk tengah sasaran, tapi tetap di dalam badan gelembung.
      const px = Math.min(Math.max(r.x + r.w / 2 - x, 18), uk.w - 18);
      const py = Math.min(Math.max(r.y + r.h / 2 - y, 18), uk.h - 18);
      g.style.setProperty('--panah-x', `${Math.round(px)}px`);
      g.style.setProperty('--panah-y', `${Math.round(py)}px`);
    }
  }

  /** Area yang sebaiknya tidak ditutupi gelembung: kartu tangan dan tombol aksi (tempat pemain bertindak). */
  private areaPenting(): KotakLayar[] {
    const daftar = [this.opsi.kotak({ meja: 'tangan' }), this.opsi.kotak({ dom: '.tombol-aksi' })];
    return daftar.filter((k): k is KotakLayar => !!k);
  }

  /** Tepi bawah bar atas (px CSS): gelembung tidak menutupi tombol menu/skor. */
  private batasAtas(): number {
    return this.opsi.akar.querySelector('.bar-atas')?.getBoundingClientRect().bottom ?? 0;
  }
}


/** Satu langkah tutorial sebagai catatan di dalam jendela (popup joker, hasil putaran, klasemen akhir). */
function htmlCatatanTutorial(id: IdLangkahTutorial, kelas = ''): string {
  const t = TEKS_TUTORIAL[id];
  return `<div class="tutorial-catatan${kelas ? ` ${kelas}` : ''}" role="note" data-tutorial="${id}"><b>${esc(t.judul)}</b><p>${esc(t.teks)}</p></div>`;
}

/**
 * Teks pembaca layar untuk satu langkah: judul + isi tanpa tanda baca dobel
 * ("Giliranmu! Tiap giliran…", bukan "Giliranmu!. Tiap giliran…").
 */
export function teksPengumuman(judul: string, teks: string): string {
  const j = judul.trim();
  const isi = teks.trim();
  if (!j) return isi;
  if (!isi) return j;
  return `${j}${/[.!?…:]$/.test(j) ? '' : '.'} ${isi}`;
}

export interface Ukuran {
  w: number;
  h: number;
}

/**
 * Varian mode ringkas: `lebar` = lebar gelembung tetap (px CSS) supaya muat di samping sasaran;
 * `mini` = teks dilipat jadi satu baris (sisanya lewat "Baca semua"). Kosong = ringkas biasa.
 */
export interface VarianRingkas {
  lebar?: number;
  mini?: boolean;
}

/** Lebar ringkas sempit yang dicoba (px CSS), dari yang paling lega. */
const LEBAR_SEMPIT = [480, 420, 360, 300] as const;

/** Arah panah gelembung (ke arah sasaran): 'bawah' = gelembung di atas sasaran, dst. */
export type ArahPanah = 'atas' | 'bawah' | 'kiri' | 'kanan';

export interface PosisiGelembung {
  x: number;
  y: number;
  /** Panah ke sasaran; tidak ada bila gelembung terpaksa ditaruh di tepi (dan mungkin menimpa). */
  panah?: ArahPanah;
}

export interface OpsiPosisi {
  layar: Ukuran;
  /** Tepi bawah bar atas: gelembung tidak menutupi tombol menu/skor. */
  batasAtas: number;
  /** Sasaran panel lawan (di atas): gelembung diutamakan di bawah/samping panel. */
  sasaranPanel: boolean;
  /** Area tempat pemain bertindak (tangan, tombol aksi): dihindari selama masih ada tempat lain. */
  hindari?: readonly KotakLayar[];
}

/** Bingkai sorotan melebar sekian px dari sasaran (lihat posisikan). */
const SOROT = 6;

const iris = (a: KotakLayar, b: KotakLayar, pad = 0) =>
  a.x < b.x + b.w + pad && b.x - pad < a.x + a.w && a.y < b.y + b.h + pad && b.y - pad < a.y + a.h;

const luasIris = (a: KotakLayar, b: KotakLayar) =>
  Math.max(0, Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x)) * Math.max(0, Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y));

const jepit = (v: number, min: number, maks: number) => Math.max(min, Math.min(v, maks));

/**
 * Posisi gelembung yang tidak menutupi sasaran (termasuk bingkai sorotnya) dan tetap di layar,
 * di bawah bar atas. `ketat` = juga tidak menutupi area `hindari`. null = tidak ada tempat.
 *
 * Urutan coba: sasaran di tengah/bawah → zona atas (di atas panel lawan, tidak perlu disentuh),
 * tepat di atas sasaran, di bawahnya, lalu kiri/kanan (HP lanskap punya ruang horizontal lebar).
 * Sasaran panel lawan (di atas) → bawah, kanan, kiri dulu.
 */
export function posisiGelembung(r: KotakLayar, uk: Ukuran, opsi: OpsiPosisi, ketat = true): PosisiGelembung | null {
  const hindari = ketat ? (opsi.hindari ?? []) : [];
  return kandidatPosisi(r, uk, opsi).find((p) => !hindari.some((a) => iris({ ...p, ...uk }, a))) ?? null;
}

/** Semua posisi yang muat di layar dan tidak menutupi sasaran, urut prioritas. */
function kandidatPosisi(r: KotakLayar, uk: Ukuran, opsi: OpsiPosisi): PosisiGelembung[] {
  const { w, h } = uk;
  const vw = opsi.layar.w;
  const vh = opsi.layar.h;
  const atasMin = opsi.batasAtas + TEPI;
  const xTengah = jepit(r.x + r.w / 2 - w / 2, TEPI, vw - w - TEPI);
  const yTengah = jepit(r.y + r.h / 2 - h / 2, atasMin, vh - h - TEPI);
  const zonaAtas: PosisiGelembung = { x: xTengah, y: atasMin, panah: 'bawah' };
  const atas: PosisiGelembung = { x: xTengah, y: r.y - SOROT - JARAK - h, panah: 'bawah' };
  const bawah: PosisiGelembung = { x: xTengah, y: r.y + r.h + SOROT + JARAK, panah: 'atas' };
  const kiri: PosisiGelembung = { x: r.x - SOROT - JARAK - w, y: yTengah, panah: 'kanan' };
  const kanan: PosisiGelembung = { x: r.x + r.w + SOROT + JARAK, y: yTengah, panah: 'kiri' };
  // Samping sasaran tapi rata atas (tepat di bawah bar atas): di HP lanskap, pita sempit di antara
  // bar atas dan kartu tangan sering satu-satunya tempat bersih di samping panel lawan / buangan.
  const kiriAtas: PosisiGelembung = { x: kiri.x, y: atasMin, panah: 'kanan' };
  const kananAtas: PosisiGelembung = { x: kanan.x, y: atasMin, panah: 'kiri' };
  const dasar = opsi.sasaranPanel ? [bawah, kanan, kiri, zonaAtas, atas] : [zonaAtas, atas, bawah, kiri, kanan];
  const kandidat = [...dasar, ...(opsi.sasaranPanel ? [kananAtas, kiriAtas] : [kiriAtas, kananAtas])];
  return kandidat.filter((p) => {
    if (p.x < TEPI || p.x + w > vw - TEPI || p.y < atasMin || p.y + h > vh - TEPI) return false;
    return !iris({ x: p.x, y: p.y, w, h }, r, SOROT);
  });
}

/**
 * Pilihan terakhir: tepi atas (di bawah bar atas) atau tepi bawah layar, mana yang paling sedikit
 * menutupi sasaran. Tanpa panah kalau tetap menimpa.
 */
export function posisiTepi(r: KotakLayar, uk: Ukuran, opsi: OpsiPosisi): PosisiGelembung {
  const { w, h } = uk;
  const x = jepit(r.x + r.w / 2 - w / 2, TEPI, opsi.layar.w - w - TEPI);
  const yAtas = Math.max(TEPI, Math.min(opsi.batasAtas + TEPI, opsi.layar.h - h - TEPI));
  const yBawah = Math.max(TEPI, opsi.layar.h - h - TEPI);
  const sorot = { x: r.x - SOROT, y: r.y - SOROT, w: r.w + 2 * SOROT, h: r.h + 2 * SOROT };
  const tutup = (y: number) => luasIris({ x, y, w, h }, sorot);
  const y = tutup(yBawah) < tutup(yAtas) ? yBawah : yAtas;
  if (tutup(y) > 0) return { x, y };
  return { x, y, panah: y + h <= r.y ? 'bawah' : 'atas' };
}

/**
 * Tata letak gelembung: ukuran penuh tanpa menutupi sasaran & area penting → mode ringkas (teks
 * dilipat dua baris, gelembung lebar) → ringkas yang lebih sempit (muat di samping sasaran) →
 * ringkas satu baris ("Baca semua" untuk sisanya), lebar biasa lalu sempit → posisi (penuh/ringkas)
 * yang paling sedikit menutupi area penting, tetap tanpa menutupi sasaran → tepi layar.
 * `ringkas` = pengukur ukuran mode ringkas per varian (null = pemain sudah membuka teks lengkap).
 */
export function tataGelembung(
  r: KotakLayar,
  penuh: Ukuran,
  ringkas: ((v?: VarianRingkas) => Ukuran) | null,
  opsi: OpsiPosisi,
): { posisi: PosisiGelembung; ringkas: boolean; varian?: VarianRingkas } {
  const p = posisiGelembung(r, penuh, opsi);
  if (p) return { posisi: p, ringkas: false };
  const ukRingkas = ringkas?.();
  const pr = ukRingkas && posisiGelembung(r, ukRingkas, opsi);
  if (pr) return { posisi: pr, ringkas: true };
  if (ringkas && ukRingkas) {
    // Varian yang lebih kecil, hanya yang memang lebih sempit dari ringkas biasa di layar ini.
    const lebar = LEBAR_SEMPIT.filter((l) => l < ukRingkas.w);
    const varian: VarianRingkas[] = [...lebar.map((l) => ({ lebar: l })), { mini: true }, ...lebar.map((l) => ({ lebar: l, mini: true }))];
    for (const v of varian) {
      const uk = ringkas(v);
      const pv = posisiGelembung(r, uk, opsi);
      if (pv) return { posisi: pv, ringkas: true, varian: v };
    }
  }
  // Tidak ada yang bersih: pilih yang paling sedikit menutupi area penting (seri → urutan prioritas,
  // ukuran penuh dulu). Sasaran tetap tidak ditutupi.
  const hindari = opsi.hindari ?? [];
  const tutup = (q: PosisiGelembung, uk: Ukuran) => hindari.reduce((n, a) => n + luasIris({ ...q, ...uk }, a), 0);
  let terbaik: { posisi: PosisiGelembung; ringkas: boolean; tutup: number } | null = null;
  for (const [uk, pakaiRingkas] of [[penuh, false], ...(ukRingkas ? [[ukRingkas, true]] : [])] as [Ukuran, boolean][]) {
    for (const q of kandidatPosisi(r, uk, opsi)) {
      const n = tutup(q, uk);
      if (!terbaik || n < terbaik.tutup) terbaik = { posisi: q, ringkas: pakaiRingkas, tutup: n };
    }
  }
  if (terbaik) return { posisi: terbaik.posisi, ringkas: terbaik.ringkas };
  return ukRingkas ? { posisi: posisiTepi(r, ukRingkas, opsi), ringkas: true } : { posisi: posisiTepi(r, penuh, opsi), ringkas: false };
}
