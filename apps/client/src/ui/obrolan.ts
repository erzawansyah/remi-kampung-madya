// Obrolan teks di lobi dan meja (0.7.0). Isinya emote/pesan yang lewat pesan `emote` meja yang sama
// (DAFTAR_EMOTE atau teks yang dirapikan rapikanPesan, maksimal MAKS_PESAN huruf), ditambah riwayat
// dari pesan `obrolan` saat duduk atau tersambung kembali. Pesan orang selalu ditulis lewat
// textContent, tidak pernah sebagai HTML.
//
// `Obrolan` = simpanan satu meja di aplikasi (main.ts): daftar pesan, draf yang sedang diketik, dan
// posisi gulir. Lobi digambar ulang setiap ada kabar meja, jadi panelnya dibangun lagi dari simpanan
// ini dan tidak kehilangan apa pun. Lembar obrolan di meja (kontrolMeja.ts, layar penuh) memakai panel
// yang sama: gelembung ala aplikasi chat (pesan orang di kiri dengan nama dan jam, pesanku di kanan),
// lalu bar tulis di bawah dengan tombol 😊 yang membuka baki celetukan dan emoji (tertutup bawaan).

import { DAFTAR_EMOTE, jumlahHuruf, kunciNama, MAKS_OBROLAN, MAKS_PESAN, rapikanPesan, type EntriObrolan } from '@remi/meja';
import { TEKS_OBROLAN } from '../konten/obrolan';
import { esc, toast, umumkan } from './dom';
import { apaEmoji } from './ledek';

/** Jarak minimal antarkiriman (meja membuang emote < 1,2 detik dari kursi yang sama). */
export const JEDA_KIRIM_OBROLAN_MS = 1250;

/**
 * Batas `maxlength` isian pesan. Browser menghitung maxlength dalam code unit UTF-16, sedangkan meja
 * (rapikanPesan) membatasi MAKS_PESAN huruf terlihat dan paling banyak MAKS_PESAN × 3 code point (tiap
 * code point paling banyak 2 code unit). Jadi isian tidak pernah memotong pesan yang masih diterima meja;
 * pemotongan ke MAKS_PESAN huruf tetap dilakukan rapikanPesan saat dikirim.
 */
export const MAKS_ISIAN_PESAN = MAKS_PESAN * 3 * 2;

/**
 * Isian dipotong ke MAKS_PESAN huruf terlihat saat diketik, supaya yang terlihat di isian = yang
 * terkirim (maxlength di atas hanya pengaman kasar dalam code unit).
 */
export function potongIsianPesan(teks: string): string {
  if (jumlahHuruf(teks) <= MAKS_PESAN && Array.from(teks).length <= MAKS_PESAN * 3) return teks;
  const Segmenter = (Intl as { Segmenter?: typeof Intl.Segmenter }).Segmenter;
  if (!Segmenter) return Array.from(teks).slice(0, MAKS_PESAN).join('');
  // Sama dengan potong() di meja: paling banyak MAKS_PESAN huruf dan MAKS_PESAN × 3 code point.
  let hasil = '';
  let huruf = 0;
  let cp = 0;
  for (const { segment } of new Segmenter(undefined, { granularity: 'grapheme' }).segment(teks)) {
    const n = Array.from(segment).length;
    if (huruf >= MAKS_PESAN || cp + n > MAKS_PESAN * 3) break;
    hasil += segment;
    huruf++;
    cp += n;
  }
  return hasil;
}

/** Satu baris obrolan di aplikasi. `milikku` diketahui untuk pesan langsung; riwayat dinilai dari nama. */
export interface BarisObrolan extends EntriObrolan {
  milikku?: boolean;
}

export type PeristiwaObrolan = { jenis: 'tambah'; baris: BarisObrolan } | { jenis: 'ganti' };

export class Obrolan {
  private baris: BarisObrolan[] = [];
  private pendengar = new Set<(e: PeristiwaObrolan) => void>();
  /** Kode meja pemilik obrolan ini (null = belum ada meja). */
  kode: string | null = null;
  /** Pesan yang sedang diketik (bertahan saat lobi digambar ulang). */
  draf = '';
  /** Posisi gulir daftar; null = menempel di pesan terbaru. */
  gulir: number | null = null;
  /** Waktu kirim terakhir dari HP ini (Date.now). */
  terakhirKirim = -Infinity;
  /** Baki celetukan/emoji sedang terbuka (bertahan saat lobi digambar ulang). */
  baki = false;

  get daftar(): readonly BarisObrolan[] {
    return this.baris;
  }

  /** Obrolan untuk meja `kode`: meja lain = mulai kosong. */
  pakaiMeja(kode: string): void {
    if (this.kode === kode) return;
    this.kosongkan();
    this.kode = kode;
  }

  tambah(b: BarisObrolan): void {
    this.baris.push(b);
    if (this.baris.length > MAKS_OBROLAN) this.baris.splice(0, this.baris.length - MAKS_OBROLAN);
    this.siarkan({ jenis: 'tambah', baris: b });
  }

  /** Riwayat dari meja (pesan `obrolan`) menggantikan isi sekarang. */
  ganti(baris: readonly EntriObrolan[]): void {
    this.baris = baris.slice(-MAKS_OBROLAN).map((b) => ({ ...b }));
    this.siarkan({ jenis: 'ganti' });
  }

  kosongkan(): void {
    this.baris = [];
    this.kode = null;
    this.draf = '';
    this.gulir = null;
    this.terakhirKirim = -Infinity;
    this.baki = false;
    this.siarkan({ jenis: 'ganti' });
  }

  dengar(fn: (e: PeristiwaObrolan) => void): () => void {
    this.pendengar.add(fn);
    return () => this.pendengar.delete(fn);
  }

  private siarkan(e: PeristiwaObrolan): void {
    for (const fn of [...this.pendengar]) fn(e);
  }
}

export interface OpsiPanelObrolan {
  obrolan: Obrolan;
  /** Kirim emote/pesan ke meja (jalur yang sama dengan palet emote lama). */
  kirim: (isi: string) => void;
  /** Nama pemain di meja ini (untuk menandai pesan sendiri di riwayat). */
  namaSaya: () => string | null;
  /** Nama ini milik kursi warga kedai di meja (barisnya diberi label "warga kedai"). */
  wargaKedai?: (nama: string) => boolean;
  /** Alasan belum bisa mengirim (sambungan belum siap); '' = boleh. */
  alasanTolak?: () => string;
  /** Lobi: pesan orang diumumkan di sini (tidak ada gelembung meja); lembar meja: gelembung meja yang mengumumkan. */
  susunan: 'lobi' | 'lembar';
  /** Id isian (dipulihkan fokusnya saat lobi digambar ulang). Juga dasar id baki. */
  idIsian: string;
}

/** Kerangka panel (tanpa pesan; pesan diisi pasangPanelObrolan lewat textContent). */
export function htmlPanelObrolan(o: Pick<OpsiPanelObrolan, 'idIsian'>): string {
  const tombol = (e: string) => `<button type="button" class="cepat${apaEmoji(e) ? ' emoji' : ''}" data-emote="${esc(e)}">${esc(e)}</button>`;
  const emoji = DAFTAR_EMOTE.filter(apaEmoji);
  const celetukan = DAFTAR_EMOTE.filter((e) => !apaEmoji(e));
  const idBaki = `${o.idIsian}-baki`;
  return `
    <ol class="obrolan-daftar" tabindex="0" aria-label="${esc(TEKS_OBROLAN.labelDaftar)}"></ol>
    <form class="obrolan-tulis">
      <button type="button" class="tombol-baki" aria-expanded="false" aria-controls="${esc(idBaki)}" aria-label="${esc(TEKS_OBROLAN.labelBaki)}"><span aria-hidden="true">😊</span></button>
      <input type="text" id="${esc(o.idIsian)}" name="pesan" maxlength="${MAKS_ISIAN_PESAN}" placeholder="${esc(TEKS_OBROLAN.isian)}" aria-label="${esc(TEKS_OBROLAN.labelIsian)}" autocomplete="off" enterkeyhint="send" />
      <button type="submit" class="utama tombol-kirim" aria-label="${esc(TEKS_OBROLAN.kirim)}"><span aria-hidden="true">➤</span></button>
    </form>
    <div class="obrolan-cepat baki-obrolan" id="${esc(idBaki)}" role="group" aria-label="${esc(TEKS_OBROLAN.labelCepat)}" hidden>
      <h3 class="judul-baki">${esc(TEKS_OBROLAN.celetukan)}</h3>
      <div class="palet-celetukan">${celetukan.map(tombol).join('')}</div>
      <h3 class="judul-baki">${esc(TEKS_OBROLAN.emoji)}</h3>
      <div class="palet-emoji">${emoji.map(tombol).join('')}</div>
    </div>`;
}

/** Pesan sendiri: langsung dari `milikku`, untuk riwayat dinilai dari nama. */
function milikkuBaris(b: BarisObrolan, namaSaya: string | null): boolean {
  return b.milikku ?? (namaSaya !== null && kunciNama(b.nama) === kunciNama(namaSaya));
}

/** Banyaknya warna nama di gelembung (`.nama[data-warna]` di komponen.css). */
export const JUMLAH_WARNA_NAMA = 6;

/** Warna nama tetap per nama (tanpa beda huruf besar/kecil), supaya orang yang sama selalu sewarna. */
export function warnaNama(nama: string): number {
  let h = 0;
  for (const c of kunciNama(nama)) h = (h * 31 + c.codePointAt(0)!) >>> 0;
  return h % JUMLAH_WARNA_NAMA;
}

/** Jam pesan di gelembung, gaya Indonesia: "20.05" (jam HP). */
export function jamObrolan(w: number): string {
  const t = new Date(w);
  if (!Number.isFinite(t.getTime())) return '';
  return `${String(t.getHours()).padStart(2, '0')}.${String(t.getMinutes()).padStart(2, '0')}`;
}

/**
 * Elemen satu baris: gelembung berisi nama (pesan orang), isi, dan jam. Semuanya lewat textContent.
 * Pesanku di kanan tanpa nama (pembaca layar tetap mendengar "Kamu:"); pesan warga kedai diberi label.
 */
function elBaris(b: BarisObrolan, opsi: Pick<OpsiPanelObrolan, 'namaSaya' | 'wargaKedai'>): HTMLLIElement {
  const li = document.createElement('li');
  const milikku = milikkuBaris(b, opsi.namaSaya());
  li.className = `baris-obrolan${milikku ? ' milikku' : ''}${apaEmoji(b.isi) ? ' emoji' : ''}`;
  const gelembung = document.createElement('div');
  gelembung.className = 'gelembung-obrolan';
  if (milikku) {
    const sr = document.createElement('span');
    sr.className = 'sr-saja';
    sr.textContent = `${TEKS_OBROLAN.kamu}: `;
    gelembung.append(sr);
  } else {
    const kepala = document.createElement('span');
    kepala.className = 'kepala-baris';
    const nama = document.createElement('b');
    nama.className = 'nama';
    nama.dataset.warna = String(warnaNama(b.nama));
    nama.textContent = b.nama;
    kepala.append(nama);
    if (opsi.wargaKedai?.(b.nama)) {
      const label = document.createElement('span');
      label.className = 'label-warga';
      label.textContent = TEKS_OBROLAN.warga;
      kepala.append(label);
    }
    const titikDua = document.createElement('span');
    titikDua.className = 'sr-saja';
    titikDua.textContent = ': ';
    kepala.append(titikDua);
    gelembung.append(kepala);
  }
  const isi = document.createElement('span');
  isi.className = 'isi';
  isi.textContent = b.isi;
  gelembung.append(isi);
  const jam = jamObrolan(b.w);
  if (jam) {
    const el = document.createElement('time');
    el.className = 'jam';
    el.textContent = jam;
    gelembung.append(el);
  }
  li.append(gelembung);
  return li;
}

/** Gulir ke bawah kalau memang menempel di bawah; selain itu posisi yang tersimpan dipakai. */
function aturGulir(daftar: HTMLElement, o: Obrolan): void {
  daftar.scrollTop = o.gulir === null ? daftar.scrollHeight : o.gulir;
}

/** Buka/tutup baki celetukan dan emoji di panel `wadah`. */
function aturBaki(wadah: HTMLElement, buka: boolean): void {
  const baki = wadah.querySelector<HTMLElement>('.baki-obrolan');
  const tombol = wadah.querySelector<HTMLElement>('.tombol-baki');
  if (baki) baki.hidden = !buka;
  tombol?.setAttribute('aria-expanded', String(buka));
  tombol?.classList.toggle('aktif', buka);
}

/**
 * Isi dan hidupkan panel obrolan di `wadah` (yang sudah berisi htmlPanelObrolan). Mengembalikan
 * fungsi pelepas. Panel yang sudah lepas dari dokumen berhenti mendengarkan sendiri.
 */
export function pasangPanelObrolan(wadah: HTMLElement, opsi: OpsiPanelObrolan): () => void {
  const { obrolan } = opsi;
  const daftar = wadah.querySelector<HTMLOListElement>('.obrolan-daftar')!;
  const form = wadah.querySelector<HTMLFormElement>('.obrolan-tulis')!;
  const isian = form.querySelector('input')!;

  const gambarSemua = () => {
    daftar.replaceChildren();
    if (!obrolan.daftar.length) {
      const li = document.createElement('li');
      li.className = 'obrolan-kosong redup';
      li.textContent = TEKS_OBROLAN.kosong;
      daftar.append(li);
    } else for (const b of obrolan.daftar) daftar.append(elBaris(b, opsi));
    aturGulir(daftar, obrolan);
  };
  gambarSemua();
  isian.value = obrolan.draf;
  aturBaki(wadah, obrolan.baki);

  const lepas = obrolan.dengar((e) => {
    if (!daftar.isConnected) return lepas();
    if (e.jenis === 'ganti') return gambarSemua();
    daftar.querySelector('.obrolan-kosong')?.remove();
    daftar.append(elBaris(e.baris, opsi));
    while (daftar.children.length > MAKS_OBROLAN) daftar.firstElementChild?.remove();
    // Pesan sendiri selalu menggulir ke bawah; pesan orang hanya kalau sedang menempel di bawah.
    if (e.baris.milikku) obrolan.gulir = null;
    aturGulir(daftar, obrolan);
    // Lobi tidak punya gelembung (yang di meja mengumumkan pesan orang), jadi pesan orang diumumkan
    // di sini. Hanya panel yang sedang terpasang yang mendengar, jadi tidak terumumkan dua kali.
    if (opsi.susunan === 'lobi' && !milikkuBaris(e.baris, opsi.namaSaya())) umumkan(`${e.baris.nama}: ${e.baris.isi}`);
  });

  daftar.addEventListener('scroll', () => {
    const bawah = daftar.scrollHeight - daftar.clientHeight - daftar.scrollTop <= 8;
    obrolan.gulir = bawah ? null : daftar.scrollTop;
  });
  isian.addEventListener('input', () => {
    const pendek = potongIsianPesan(isian.value);
    if (pendek !== isian.value) isian.value = pendek;
    obrolan.draf = isian.value;
  });
  wadah.querySelector('.tombol-baki')?.addEventListener('click', () => {
    obrolan.baki = !obrolan.baki;
    aturBaki(wadah, obrolan.baki);
    // Baki membuat daftar lebih pendek: yang menempel di bawah tetap melihat pesan terbaru.
    aturGulir(daftar, obrolan);
  });

  /** Kirim satu isi; false kalau ditahan (sambungan belum siap atau terlalu cepat). */
  const kirim = (isi: string): boolean => {
    const alasan = opsi.alasanTolak?.() ?? '';
    if (alasan) {
      toast(alasan, true, 3500);
      return false;
    }
    const sekarang = Date.now();
    if (sekarang - obrolan.terakhirKirim < JEDA_KIRIM_OBROLAN_MS) {
      toast(TEKS_OBROLAN.pelan, true, 2000);
      return false;
    }
    obrolan.terakhirKirim = sekarang;
    opsi.kirim(isi);
    return true;
  };

  // Pesan cepat dari baki: terkirim, baki dan lembar tetap terbuka (bisa nyeletuk lagi).
  wadah.querySelector('.baki-obrolan')?.addEventListener('click', (ev) => {
    const b = (ev.target as HTMLElement).closest<HTMLElement>('[data-emote]');
    if (!b) return;
    if (kirim(b.dataset.emote!)) obrolan.gulir = null;
  });
  form.addEventListener('submit', (ev) => {
    ev.preventDefault();
    const isi = rapikanPesan(isian.value);
    if (!isi) return isian.focus();
    if (!kirim(isi)) return;
    isian.value = '';
    obrolan.draf = '';
    obrolan.gulir = null;
  });
  return lepas;
}
