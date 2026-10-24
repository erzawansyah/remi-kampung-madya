// Ledekan di hasil putaran meja online (keputusan pemilik, 24 Okt 2026).
// - htmlLedek: bagian "Ledek" di modal hasil putaran (pilih orang, lalu ketuk ledekannya).
// - sasaranLedekBawaan: siapa yang terpilih saat modal dibuka.
// - LedekBesar: ledekan untukku tampil besar di tengah layar, di atas modal, satu per satu (antri),
//   ketuk untuk menutup. Teks selalu lewat textContent, tidak pernah sebagai HTML.
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

export interface DataHtmlLedek {
  /** Manusia lain yang bisa diledek (kursi dan nama). Kosong = bagian ini tidak ditampilkan. */
  calon: { kursi: number; nama: string }[];
  sasaran: number | null;
  /** Jatah ledekan putaran ini habis. */
  habis: boolean;
  /** Baru saja mengirim ledekan: tombol isi dikunci sebentar (batas 1,2 detik di meja). */
  jeda: boolean;
}

/** Bagian "Ledek" di modal hasil putaran; '' kalau tidak ada manusia lain. */
export function htmlLedek(d: DataHtmlLedek): string {
  if (!d.calon.length || d.sasaran === null) return '';
  const sasaran = d.calon
    .map((c) => `<button type="button" data-ledek-ke="${c.kursi}" aria-pressed="${c.kursi === d.sasaran}">${esc(c.nama)}</button>`)
    .join('');
  const kunci = d.jeda ? ' aria-disabled="true"' : '';
  const tombol = (isi: string) => `<button type="button" data-ledek-isi="${esc(isi)}"${kunci}>${esc(isi)}</button>`;
  const isi = d.habis
    ? `<p class="redup rapat">${esc(TEKS_LEDEK.habis)}</p>`
    : `<div class="ledek-kata" role="group" aria-label="${esc(TEKS_LEDEK.pilihIsi)}">${DAFTAR_LEDEKAN.map(tombol).join('')}</div>
       <div class="ledek-emoji" role="group" aria-label="Emoji">${EMOJI_LEDEK.map(tombol).join('')}</div>`;
  return `<section class="bagian-ledek" aria-labelledby="judul-ledek">
      <h3 id="judul-ledek" class="judul-ledek">${esc(TEKS_LEDEK.judul)}</h3>
      <p class="redup rapat">${esc(TEKS_LEDEK.petunjuk)}</p>
      <div class="ledek-sasaran segmen" role="group" aria-label="${esc(TEKS_LEDEK.pilihSasaran)}">${sasaran}</div>
      ${isi}
    </section>`;
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
  isi: string;
  pengumuman: string;
  masuk: number;
}

/** Ledekan untukku: tampil besar satu per satu, antri, ketuk untuk menutup. */
export class LedekBesar {
  private antrian: Ledekan[] = [];
  private el: HTMLElement | null = null;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private timerCek: ReturnType<typeof setTimeout> | null = null;
  private mati = false;

  /** `sibuk`: animasi meja sedang berjalan (panel mentung, kocok); ledekan menunggu sebentar. */
  constructor(private readonly sibuk: () => boolean = () => false) {}

  /** Ledekan baru dari `dari` (nama tampilan) dengan `pengumuman` untuk pembaca layar. */
  tambah(dari: string, isi: string, pengumuman: string): void {
    if (this.mati) return;
    this.antrian.push({ dari, isi, pengumuman, masuk: Date.now() });
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
    if (this.sibuk() && Date.now() - this.antrian[0].masuk < TUNGGU_SIBUK_MAKS_MS) {
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
    const judul = document.createElement('p');
    judul.className = 'ledek-dari';
    judul.textContent = `${l.dari} ${TEKS_LEDEK.ngeledekKamu}`;
    const isi = document.createElement('p');
    isi.className = `ledek-isi${apaEmoji(l.isi) ? ' emoji' : ''}`;
    isi.textContent = l.isi;
    kotak.append(judul, isi);
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

  hancurkan(): void {
    this.mati = true;
    this.antrian = [];
    if (this.timer) clearTimeout(this.timer);
    if (this.timerCek) clearTimeout(this.timerCek);
    this.timer = null;
    this.timerCek = null;
    this.el?.remove();
    this.el = null;
  }
}
