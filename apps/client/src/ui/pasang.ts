// Dialog petunjuk pasang aplikasi (keputusan pemilik #46), dibuka dari tombol melayang atau ubin
// "Pasang ke layar utama" di beranda kalau browser tidak menawarkan prompt sendiri. Tiga varian:
// iPhone/iPad (Bagikan → Tambah ke Layar Utama), Android (menu browser → Instal aplikasi), dan
// browser bawaan aplikasi (buka di Chrome/Safari dulu, dengan tombol Salin link).
// Lewat bukaDialog (lapisan di atas modal), sesuai AGENTS.md. Teksnya di konten/pasang.ts.

import { MANFAAT_PASANG, PETUNJUK_PASANG, TEKS_TAWARAN, type LangkahPasang } from '../konten/pasang';
import type { CaraPasang } from '../pasangAplikasi';
import { bukaDialog, esc, toast, type PenanganDialog } from './dom';

export type CaraPetunjuk = Exclude<CaraPasang, 'prompt'>;

export interface OpsiPetunjukPasang {
  cara: CaraPetunjuk;
  /** Link yang disalin (varian in-app). Bawaan: halaman ini tanpa #. */
  url?: string;
  /** "Nanti saja": dipanggil sesudah dialog ditutup. */
  nanti(): void;
  /** "Sudah kupasang" (iPhone/iPad dan Android): dipanggil sesudah dialog ditutup. */
  sudah(): void;
}

const ATRIBUT_IKON = 'viewBox="0 0 24 24" width="20" height="20" aria-hidden="true" focusable="false" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"';

/** Ikon kecil (inline SVG, warna ikut teks) yang mirip tombol di browser. */
const IKON: Record<NonNullable<LangkahPasang['ikon']>, string> = {
  // Bagikan di Safari: kotak terbuka dengan panah ke atas.
  bagikan: `<svg ${ATRIBUT_IKON}><path d="M12 3v12"/><path d="M8 7l4-4 4 4"/><path d="M8 11H6a1 1 0 0 0-1 1v8a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-8a1 1 0 0 0-1-1h-2"/></svg>`,
  // Tambah ke Layar Utama: kotak bertanda plus.
  tambah: `<svg ${ATRIBUT_IKON}><rect x="4" y="4" width="16" height="16" rx="3"/><path d="M12 8v8"/><path d="M8 12h8"/></svg>`,
  // Menu browser: tiga titik.
  menu: `<svg ${ATRIBUT_IKON}><circle cx="12" cy="5" r="1.2"/><circle cx="12" cy="12" r="1.2"/><circle cx="12" cy="19" r="1.2"/></svg>`,
};

/** Teks langkah: di-escape dulu, lalu *nama tombol* ditebalkan. */
export function htmlLangkah(teks: string): string {
  return esc(teks).replace(/\*([^*]+)\*/g, '<b>$1</b>');
}

function urlHalaman(): string {
  return location.href.split('#')[0] ?? location.href;
}

/** Salin ke clipboard; cadangannya memilih isi kotak link lalu execCommand('copy'). */
async function salinLink(url: string, kotak: HTMLInputElement): Promise<boolean> {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(url);
      return true;
    }
  } catch {
    // Ditolak (izin, webview lama): coba cara lama di bawah.
  }
  try {
    kotak.focus();
    kotak.select();
    kotak.setSelectionRange?.(0, kotak.value.length);
    return typeof document.execCommand === 'function' && document.execCommand('copy');
  } catch {
    return false;
  }
}

export function bukaPetunjukPasang(o: OpsiPetunjukPasang): PenanganDialog {
  const p = PETUNJUK_PASANG[o.cara];
  const inapp = o.cara === 'inapp';
  const url = o.url ?? urlHalaman();
  const langkah = p.langkah
    .map((l) => `<li>${l.ikon ? `<span class="ikon-langkah">${IKON[l.ikon]}</span>` : ''}<span>${htmlLangkah(l.teks)}</span></li>`)
    .join('');
  return bukaDialog(
    `<div class="kepala-dialog">
       <h2>${esc(p.judul)}</h2>
       <button type="button" class="tombol-ikon hantu tutup-dialog" data-tutup aria-label="${esc(TEKS_TAWARAN.tutup)}">✕</button>
     </div>
     <p class="pasang-manfaat">${esc(MANFAAT_PASANG)}</p>
     ${p.penjelasan ? `<p>${esc(p.penjelasan)}</p>` : ''}
     <ol class="langkah-pasang">${langkah}</ol>
     ${p.catatan ? `<p class="redup rapat">${esc(p.catatan)}</p>` : ''}
     ${
       inapp
         ? `<div class="salin-link">
              <label class="medan" for="link-pasang">${esc(TEKS_TAWARAN.labelLink)}
                <input type="text" id="link-pasang" readonly value="${esc(url)}" spellcheck="false" autocomplete="off" />
              </label>
              <button type="button" class="utama" data-salin>${esc(TEKS_TAWARAN.salin)}</button>
            </div>`
         : ''
     }
     <div class="kaki-dialog">
       <button type="button" class="hantu" data-nanti>${esc(TEKS_TAWARAN.nanti)}</button>
       ${
         inapp
           ? `<button type="button" data-tutup>${esc(TEKS_TAWARAN.tutup)}</button>`
           : `<button type="button" class="utama" data-sudah>${esc(TEKS_TAWARAN.sudah)}</button>`
       }
     </div>`,
    (d, tutup) => {
      // Dialog ditutup dulu (fokus kembali ke pemicunya), baru keputusan dijalankan: beranda lalu
      // memindahkan fokus ke ubin menu kalau tombol melayangnya hilang.
      d.querySelector('[data-nanti]')!.addEventListener('click', () => {
        tutup();
        o.nanti();
      });
      d.querySelector('[data-sudah]')?.addEventListener('click', () => {
        tutup();
        o.sudah();
      });
      const kotak = d.querySelector<HTMLInputElement>('#link-pasang');
      kotak?.addEventListener('focus', () => kotak.select());
      d.querySelector('[data-salin]')?.addEventListener('click', async () => {
        const ok = await salinLink(url, kotak!);
        toast(ok ? TEKS_TAWARAN.toastTersalin : TEKS_TAWARAN.toastGagalSalin, !ok);
      });
    },
    { kelas: 'pasang' },
  );
}
