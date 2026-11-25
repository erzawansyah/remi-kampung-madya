// Obrolan teks di lobi dan meja (0.7.0). Isinya emote/pesan yang lewat pesan `emote` meja yang sama
// (DAFTAR_EMOTE atau teks yang dirapikan rapikanPesan, maksimal MAKS_PESAN huruf), ditambah riwayat
// dari pesan `obrolan` saat duduk atau tersambung kembali. Pesan orang selalu ditulis lewat
// textContent, tidak pernah sebagai HTML.
//
// `Obrolan` = simpanan satu meja di aplikasi (main.ts): daftar pesan, draf yang sedang diketik, dan
// posisi gulir. Lobi digambar ulang setiap ada kabar meja, jadi panelnya dibangun lagi dari simpanan
// ini dan tidak kehilangan apa pun. Lembar obrolan di meja (kontrolMeja.ts) memakai panel yang sama.

import { DAFTAR_EMOTE, kunciNama, MAKS_OBROLAN, MAKS_PESAN, rapikanPesan, type EntriObrolan } from '@remi/meja';
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
  /** Alasan belum bisa mengirim (sambungan belum siap); '' = boleh. */
  alasanTolak?: () => string;
  /** Sesudah pesan cepat (emoji/celetukan) dikirim, mis. menutup lembar di meja. */
  sesudahCepat?: (dariKeyboard: boolean) => void;
  /** Lembar meja: emoji dalam kisi dan celetukan dilipat; lobi: satu deret yang bisa digeser. */
  susunan: 'lobi' | 'lembar';
  /** Id isian (dipulihkan fokusnya saat lobi digambar ulang). */
  idIsian: string;
}

/** Kerangka panel (tanpa pesan; pesan diisi pasangPanelObrolan lewat textContent). */
export function htmlPanelObrolan(o: Pick<OpsiPanelObrolan, 'susunan' | 'idIsian'>): string {
  const tombol = (e: string) => `<button type="button" class="cepat${apaEmoji(e) ? ' emoji' : ''}" data-emote="${esc(e)}">${esc(e)}</button>`;
  const emoji = DAFTAR_EMOTE.filter(apaEmoji);
  const celetukan = DAFTAR_EMOTE.filter((e) => !apaEmoji(e));
  const cepat =
    o.susunan === 'lembar'
      ? `<div class="obrolan-cepat" role="group" aria-label="${esc(TEKS_OBROLAN.labelCepat)}">
          <div class="palet-emoji">${emoji.map(tombol).join('')}</div>
          <div class="palet-celetukan">${celetukan.map(tombol).join('')}</div>
        </div>`
      : `<div class="obrolan-cepat deret-geser" role="group" aria-label="${esc(TEKS_OBROLAN.labelCepat)}">${[...celetukan, ...emoji].map(tombol).join('')}</div>`;
  return `
    <ol class="obrolan-daftar" tabindex="0" aria-label="${esc(TEKS_OBROLAN.labelDaftar)}"></ol>
    <form class="obrolan-tulis palet-tulis">
      <input type="text" id="${esc(o.idIsian)}" name="pesan" maxlength="${MAKS_ISIAN_PESAN}" placeholder="${esc(TEKS_OBROLAN.isian)}" aria-label="${esc(TEKS_OBROLAN.labelIsian)}" autocomplete="off" enterkeyhint="send" />
      <button type="submit" class="utama">${esc(TEKS_OBROLAN.kirim)}</button>
    </form>
    ${cepat}`;
}

/** Pesan sendiri: langsung dari `milikku`, untuk riwayat dinilai dari nama. */
function milikkuBaris(b: BarisObrolan, namaSaya: string | null): boolean {
  return b.milikku ?? (namaSaya !== null && kunciNama(b.nama) === kunciNama(namaSaya));
}

/** Elemen satu baris (nama tebal + isi), semuanya lewat textContent. */
function elBaris(b: BarisObrolan, namaSaya: string | null): HTMLLIElement {
  const li = document.createElement('li');
  const milikku = milikkuBaris(b, namaSaya);
  li.className = `baris-obrolan${milikku ? ' milikku' : ''}${apaEmoji(b.isi) ? ' emoji' : ''}`;
  const nama = document.createElement('b');
  nama.className = 'nama';
  nama.textContent = b.nama;
  const isi = document.createElement('span');
  isi.className = 'isi';
  isi.textContent = b.isi;
  li.append(nama, isi);
  return li;
}

/** Gulir ke bawah kalau memang menempel di bawah; selain itu posisi yang tersimpan dipakai. */
function aturGulir(daftar: HTMLElement, o: Obrolan): void {
  daftar.scrollTop = o.gulir === null ? daftar.scrollHeight : o.gulir;
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
    const nama = opsi.namaSaya();
    if (!obrolan.daftar.length) {
      const li = document.createElement('li');
      li.className = 'obrolan-kosong redup';
      li.textContent = TEKS_OBROLAN.kosong;
      daftar.append(li);
    } else for (const b of obrolan.daftar) daftar.append(elBaris(b, nama));
    aturGulir(daftar, obrolan);
  };
  gambarSemua();
  isian.value = obrolan.draf;

  const lepas = obrolan.dengar((e) => {
    if (!daftar.isConnected) return lepas();
    if (e.jenis === 'ganti') return gambarSemua();
    daftar.querySelector('.obrolan-kosong')?.remove();
    daftar.append(elBaris(e.baris, opsi.namaSaya()));
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
    obrolan.draf = isian.value;
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

  wadah.querySelector('.obrolan-cepat')?.addEventListener('click', (ev) => {
    const b = (ev.target as HTMLElement).closest<HTMLElement>('[data-emote]');
    if (!b) return;
    if (kirim(b.dataset.emote!)) opsi.sesudahCepat?.((ev as MouseEvent).detail === 0);
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
