// Ledekan di hasil putaran meja online (keputusan pemilik, 24 Okt 2026).
// - htmlBarisLedek: baris kecil "Ledek 😏 Nama" di kaki modal hasil putaran (di atas Siap).
// - htmlLembarLedek/htmlIsiLembarLedek: lembar dari bawah (lewat bukaDialog) berisi ledekan dan emoji;
//   sekali ketuk langsung terkirim, lembarnya tetap terbuka.
// - sasaranLedekBawaan: siapa yang terpilih saat lembar dibuka dari "+N".
// - LedekBesar: ledekan untukku tampil besar di tengah layar, di atas modal, satu per satu (antri),
//   ketuk untuk menutup, dengan tombol "Bales". Teks selalu lewat textContent, tidak pernah sebagai HTML.
// Semua isinya info publik (nama, kursi, isi dari daftar tetap), jadi tidak ada yang bocor.

import { DAFTAR_EMOTE, DAFTAR_LEDEKAN } from '@remi/meja';
import type { HasilPutaran } from '@remi/engine';
import { TEKS_LEDEK } from '../konten/ledek';
import { bunyi } from '../efek/suara';
import { esc, umumkan } from './dom';

/** Emote berupa satu emoji (gambar, paling banyak dua code point), bukan celetukan/pesan teks. */
export const apaEmoji = (isi: string): boolean => [...isi].length <= 2 && /^\p{Extended_Pictographic}/u.test(isi);

const EMOJI_LEDEK: readonly string[] = DAFTAR_EMOTE.filter(apaEmoji);
/** Isi tombol ledekan: daftar ledekan dulu, lalu emoji dari palet emote. */
export const ISI_LEDEK: readonly string[] = [...DAFTAR_LEDEKAN, ...EMOJI_LEDEK];

/** Lama ledekan besar tampil (ms) kalau tidak diketuk. Waktu baca, jadi tidak ikut kecepatan animasi. */
export const LAMA_LEDEK_MS = 2500;
/** Ledekan untukku yang menunggu giliran tampil; yang lebih lama dibuang kalau lebih dari ini. */
export const MAKS_ANTRIAN_LEDEK = 6;
/** Ledekan menunggu animasi meja selesai paling lama sekian ms, sesudah itu tetap tampil. */
const TUNGGU_SIBUK_MAKS_MS = 6000;
const JEDA_CEK_SIBUK_MS = 400;

/**
 * Sasaran bawaan: yang kepentung putaran ini kalau aku tidak kepentung; kalau aku kepentung, yang
 * mentung (membalas); kalau tidak ada yang cocok, orang pertama di `calon` (manusia lain di meja).
 */
export function sasaranLedekBawaan(h: Pick<HasilPutaran, 'pementung' | 'kepentung'>, saya: number, calon: readonly number[]): number | null {
  if (!h.kepentung.includes(saya)) {
    const kena = h.kepentung.find((k) => calon.includes(k));
    if (kena !== undefined) return kena;
  } else if (h.pementung !== null && calon.includes(h.pementung)) return h.pementung;
  return calon[0] ?? null;
}

export interface CalonLedek {
  kursi: number;
  nama: string;
}

export interface DataBarisLedek {
  /** Manusia lain yang bisa diledek. Kosong = baris ini tidak ditampilkan. */
  calon: CalonLedek[];
  /** Jatah ledekan putaran ini habis: baris berisi catatan, bukan nama. */
  habis: boolean;
}

/**
 * Baris kecil "Ledek  😏 Budi  😏 Citra" di kaki modal hasil, tepat di atas Siap/tombol lanjut; '' kalau
 * tidak ada manusia lain. Nama-namanya turun ke baris berikut (tidak pernah digeser ke samping);
 * yang tidak muat dua baris disembunyikan rapikanBarisLedek() dan diganti tombol "+N".
 */
export function htmlBarisLedek(d: DataBarisLedek): string {
  if (!d.calon.length) return '';
  const isi = d.habis
    ? `<p class="redup rapat habis-ledek">${esc(TEKS_LEDEK.habis)}</p>`
    : d.calon
        .map(
          (c) =>
            `<button type="button" class="chip-ledek" data-ledek-buka="${c.kursi}" aria-label="${esc(`${TEKS_LEDEK.judul} ${c.nama}`)}" aria-haspopup="dialog">` +
            `<span class="ikon-ledek" aria-hidden="true">${esc(TEKS_LEDEK.ikon)}</span><span class="nama-ledek">${esc(c.nama)}</span></button>`,
        )
        .join('') +
      `<button type="button" class="chip-ledek lebih-ledek" data-ledek-lebih hidden aria-label="${esc(TEKS_LEDEK.lainnya)}" aria-haspopup="dialog"></button>`;
  return `<div class="baris-ledek" role="group" aria-label="${esc(TEKS_LEDEK.judul)}"><span class="label-ledek" aria-hidden="true">${esc(TEKS_LEDEK.judul)}</span>${isi}</div>`;
}

/** Paling banyak sekian baris nama di kaki modal hasil (kakinya menempel, jadi harus tetap pendek). */
const MAKS_BARIS_LEDEK = 2;

/**
 * Nama yang tidak muat MAKS_BARIS_LEDEK baris disembunyikan dari belakang dan diganti "+N" (membuka
 * lembar, yang memuat semua nama). Dipanggil sesudah baris dipasang dan saat lebarnya berubah.
 */
export function rapikanBarisLedek(akar: ParentNode): void {
  const baris = akar.querySelector<HTMLElement>('.baris-ledek');
  if (!baris) return;
  const chip = [...baris.querySelectorAll<HTMLElement>('[data-ledek-buka]')];
  const lebih = baris.querySelector<HTMLElement>('[data-ledek-lebih]');
  if (!lebih) return;
  chip.forEach((c) => (c.hidden = false));
  lebih.hidden = true;
  // Butir sebaris saling tumpang tindih secara vertikal (align-items: center membuat label lebih rendah
  // dari chip), jadi baris baru dihitung dari butir yang mulai di bawah dasar baris sebelumnya.
  const jumlahBaris = () => {
    let n = 0;
    let dasar = -Infinity;
    for (const el of [...baris.children] as HTMLElement[]) {
      if (el.hidden || !el.offsetHeight) continue;
      if (el.offsetTop >= dasar - 1) {
        n++;
        dasar = el.offsetTop + el.offsetHeight;
      } else dasar = Math.max(dasar, el.offsetTop + el.offsetHeight);
    }
    return n;
  };
  let sembunyi = 0;
  while (jumlahBaris() > MAKS_BARIS_LEDEK && sembunyi < chip.length - 1) {
    sembunyi++;
    chip[chip.length - sembunyi].hidden = true;
    lebih.hidden = false;
    lebih.textContent = `+${sembunyi}`;
    // Nama yang terbaca memuat teks yang terlihat ("+3"), supaya kontrol suara dan pembaca layar cocok.
    lebih.setAttribute('aria-label', `+${sembunyi} ${TEKS_LEDEK.lainnya}`);
  }
}

export interface DataLembarLedek {
  calon: CalonLedek[];
  /** Sasaran yang sedang dipilih (selalu salah satu calon). */
  sasaran: number;
  habis: boolean;
  /** Baru saja mengirim: tombol isi dikunci sebentar (batas 1,2 detik di meja). */
  jeda: boolean;
  /** Isi yang baru terkirim (diberi tanda ✓ selama jeda). */
  baruDikirim: string | null;
}

/** Isi lembar Ledek (di bawah judul): pilihan sasaran (kalau 2+ orang), ledekan, dan emoji. */
export function htmlIsiLembarLedek(d: DataLembarLedek): string {
  // Jatah habis: pilihan sasaran juga tidak perlu lagi.
  if (d.habis) return `<p class="redup rapat habis-ledek">${esc(TEKS_LEDEK.habis)}</p>`;
  const sasaran =
    d.calon.length > 1
      ? `<div class="ledek-sasaran segmen penuh" role="group" aria-label="${esc(TEKS_LEDEK.pilihSasaran)}">${d.calon
          .map((c) => `<button type="button" data-ledek-ke="${c.kursi}" aria-pressed="${c.kursi === d.sasaran}">${esc(c.nama)}</button>`)
          .join('')}</div>`
      : '';
  const kunci = d.jeda ? ' aria-disabled="true"' : '';
  const tombol = (isi: string) =>
    `<button type="button" data-ledek-isi="${esc(isi)}"${kunci}${d.jeda && isi === d.baruDikirim ? ' class="terkirim"' : ''}>${esc(isi)}</button>`;
  return `${sasaran}<div class="ledek-kata" role="group" aria-label="${esc(TEKS_LEDEK.pilihIsi)}">${DAFTAR_LEDEKAN.map(tombol).join('')}</div>
      <div class="ledek-emoji" role="group" aria-label="${esc(TEKS_LEDEK.emoji)}">${EMOJI_LEDEK.map(tombol).join('')}</div>`;
}

/**
 * Kerangka lembar Ledek (lewat bukaDialog): judul + ✕ dan baris status (tidak ikut digulir), lalu isi
 * (htmlIsiLembarLedek) yang digulir sendiri. Baris status hanya untuk mata; pembaca layar mendapat
 * umumkan() di setiap kiriman (ledekan kedua ke orang yang sama tetap diumumkan).
 */
export function htmlLembarLedek(namaSasaran: string, isi: string): string {
  return `<div class="kepala-dialog kepala-lembar-ledek">
      <h2 data-judul-ledek>${esc(`${TEKS_LEDEK.judul} ${namaSasaran}`)}</h2>
      <button type="button" class="tutup-dialog tombol-ikon" data-tutup aria-label="${esc(TEKS_LEDEK.tutup)}">✕</button>
    </div>
    <p class="status-ledek" data-status-ledek aria-hidden="true"></p>
    <div class="isi-lembar-ledek" data-lembar-isi>${isi}</div>`;
}

/**
 * Lapisan tetap di atas modal hasil putaran (di bawah dialog Skor/Bantuan dan toast), untuk ledekan
 * besar dan gelembung ledekan. Sengaja di luar #ui/#modal: keduanya dibuat inert selama ada jendela,
 * jadi ledekan besar di dalamnya tidak bisa diketuk dan gelembungnya tertutup tirai modal.
 */
export function lapisanLedek(): HTMLElement {
  let el = document.getElementById('lapisan-ledek');
  if (!el) {
    el = document.createElement('div');
    el.id = 'lapisan-ledek';
    document.body.appendChild(el);
  }
  return el;
}

/** Bongkar lapisan ledekan (meja ditutup). */
export function hapusLapisanLedek(): void {
  document.getElementById('lapisan-ledek')?.remove();
}

interface Ledekan {
  dari: string;
  /** Kursi pengirim (untuk tombol Bales); tidak ada = tanpa Bales. */
  kursi?: number;
  isi: string;
  pengumuman: string;
  masuk: number;
}

/** Tombol "Bales <nama>" di ledekan besar: `bisa` diperiksa saat ledekan tampil, `buka` saat diketuk. */
export interface BalesLedek {
  bisa: (kursi: number) => boolean;
  buka: (kursi: number) => void;
}

/** Ledekan untukku: tampil besar satu per satu, antri, ketuk untuk menutup. */
export class LedekBesar {
  private antrian: Ledekan[] = [];
  private el: HTMLElement | null = null;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private timerCek: ReturnType<typeof setTimeout> | null = null;
  private mati = false;

  /**
   * `sibuk`: animasi meja sedang berjalan; ledekan menunggu paling lama TUNGGU_SIBUK_MAKS_MS (cadangan
   * kalau animasi macet). `tahan`: hasil putaran belum tampil di layar ini, atau ada jendela yang
   * menunggu pemain (panel mentung, popup joker); ledekan menunggu tanpa batas waktu, karena antriannya
   * dikosongkan (kosongkan()) begitu hasil putaran ditinggalkan.
   */
  constructor(
    private readonly sibuk: () => boolean = () => false,
    private readonly tahan: () => boolean = () => false,
    private readonly bales: BalesLedek | null = null,
  ) {}

  /** Ledekan baru dari `dari` (nama tampilan) dengan `pengumuman` untuk pembaca layar. */
  tambah(dari: string, isi: string, pengumuman: string, kursi?: number): void {
    if (this.mati) return;
    this.antrian.push({ dari, isi, pengumuman, kursi, masuk: Date.now() });
    while (this.antrian.length > MAKS_ANTRIAN_LEDEK) this.antrian.shift();
    this.berikut();
  }

  /** Ledekan yang sedang tampil (untuk test). */
  get tampil(): HTMLElement | null {
    return this.el;
  }

  get jumlahAntri(): number {
    return this.antrian.length;
  }

  /** Tutup ledekan yang sedang tampil, lalu tampilkan berikutnya. */
  tutup(): void {
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
    this.el?.remove();
    this.el = null;
    this.berikut();
  }

  /** Coba tampilkan berikutnya (dipanggil juga saat antrian animasi meja habis). */
  berikut(): void {
    if (this.mati || this.el || !this.antrian.length) return;
    const tahan = this.tahan();
    // Selama ditahan, batas tunggu animasi belum mulai dihitung: dihitung dari saat tahanan lepas.
    if (tahan) this.antrian[0].masuk = Date.now();
    if (tahan || (this.sibuk() && Date.now() - this.antrian[0].masuk < TUNGGU_SIBUK_MAKS_MS)) {
      if (!this.timerCek) {
        this.timerCek = setTimeout(() => {
          this.timerCek = null;
          this.berikut();
        }, JEDA_CEK_SIBUK_MS);
      }
      return;
    }
    const l = this.antrian.shift()!;
    const el = document.createElement('div');
    el.className = 'ledek-besar';
    // Pembaca layar mendapat umumkan(); kotak ini hanya visual.
    el.setAttribute('aria-hidden', 'true');
    el.style.setProperty('--durasi', `${LAMA_LEDEK_MS}ms`);
    const kotak = document.createElement('div');
    kotak.className = 'ledek-kotak';
    // Pil gelap "<inisial> <nama> ngeledek kamu": terbaca di atas modal yang ramai.
    const judul = document.createElement('p');
    judul.className = 'ledek-dari';
    const inisial = document.createElement('span');
    inisial.className = 'ledek-inisial';
    inisial.textContent = [...l.dari.trim()][0]?.toUpperCase() ?? '?';
    // Nama dan "ngeledek kamu" satu butir flex, jadi kalau tidak muat sebaris turunnya seperti teks biasa.
    const teks = document.createElement('span');
    teks.className = 'ledek-dari-teks';
    const nama = document.createElement('b');
    nama.textContent = l.dari;
    teks.append(nama, ` ${TEKS_LEDEK.ngeledekKamu}`);
    judul.append(inisial, teks);
    const isi = document.createElement('p');
    isi.className = `ledek-isi${apaEmoji(l.isi) ? ' emoji' : ''}`;
    isi.textContent = l.isi;
    kotak.append(judul, isi);
    const kursi = l.kursi;
    if (kursi !== undefined && this.bales?.bisa(kursi)) {
      // Kotaknya aria-hidden (pembaca layar mendapat umumkan()), jadi tombol ini juga hanya untuk mata dan
      // jari; lembar Ledek tetap bisa dibuka dari baris Ledek di modal hasil.
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'bales-ledek';
      b.tabIndex = -1;
      b.textContent = `${TEKS_LEDEK.bales} ${l.dari}`;
      // pointerdown juga dihentikan: ketukan ini tidak boleh ikut menutup lalu "tembus" ke modal di bawah.
      b.addEventListener('pointerdown', (e) => e.stopPropagation());
      b.addEventListener('click', (e) => {
        e.stopPropagation();
        e.preventDefault();
        if (this.el !== el) return;
        // Lembar dibuka dulu, baru ledekan ini ditutup: antrian ditahan selama lembar terbuka, jadi
        // ledekan berikutnya tidak langsung muncul menutupi lembar balasan.
        if (this.bales?.bisa(kursi)) this.bales.buka(kursi);
        this.tutup();
      });
      kotak.appendChild(b);
    }
    el.appendChild(kotak);
    el.addEventListener('click', () => {
      if (this.el === el) this.tutup();
    });
    lapisanLedek().appendChild(el);
    this.el = el;
    bunyi('notifikasi');
    umumkan(l.pengumuman);
    this.timer = setTimeout(() => {
      this.timer = null;
      if (this.el === el) this.tutup();
    }, LAMA_LEDEK_MS);
  }

  /**
   * Hasil putaran ditinggalkan (putaran berikutnya mulai, permainan selesai): buang antrian dan ledekan
   * yang sedang tampil, supaya tidak muncul di atas kocok & bagi atau popup joker putaran baru.
   */
  kosongkan(): void {
    this.antrian = [];
    if (this.timer) clearTimeout(this.timer);
    if (this.timerCek) clearTimeout(this.timerCek);
    this.timer = null;
    this.timerCek = null;
    this.el?.remove();
    this.el = null;
  }

  hancurkan(): void {
    this.mati = true;
    this.kosongkan();
  }
}
