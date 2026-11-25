// Ikon "?" untuk penjelasan singkat sebuah pilihan (permintaan pemilik 25 Nov 2026): keterangan
// tidak lagi ditulis terus di bawah pilihan, tapi muncul dalam gelembung kecil kalau "?" diketuk
// (di desktop juga saat diarahkan mouse). Teksnya tetap ada di halaman sebagai elemen tersembunyi
// yang dirujuk aria-describedby, jadi pembaca layar tetap membacanya bersama kontrolnya.
//
// Pemakaian: sisipkan `htmlInfo(teks, label, id)` di samping nama pilihan, lalu pastikan
// `pasangInfo()` sudah dipanggil sekali (main.ts). Kontrolnya diberi `aria-describedby="<id>"`.
// Gelembung dipasang di <body> dengan posisi tetap, jadi tidak terpotong jendela yang bisa digulir.

import { esc } from './dom';

let urut = 0;

/**
 * Tombol "?" + teks penjelasan tersembunyi. `label` = nama pilihan (untuk pembaca layar). `id`
 * dipakai sebagai id teks penjelasan (rujukan aria-describedby dan test); kosong = dibuat otomatis.
 */
export function htmlInfo(teks: string, label: string, id = `info-${++urut}`): string {
  return (
    `<button type="button" class="tombol-info" data-info="${esc(id)}" aria-expanded="false" aria-label="Penjelasan ${esc(label)}">?</button>` +
    `<span class="teks-info" id="${esc(id)}" hidden>${esc(teks)}</span>`
  );
}

/** Nama pilihan + "?" dalam satu kelompok (sisi kiri label.baris). */
export function htmlLabelInfo(label: string, teks: string, id?: string): string {
  return `<span class="label-info">${esc(label)}${htmlInfo(teks, label, id)}</span>`;
}

let gelembung: HTMLElement | null = null;
let pemicu: HTMLButtonElement | null = null;
/** Dibuka lewat ketuk/klik (tetap terbuka sampai ditutup), bukan sekadar diarahkan mouse. */
let ditahan = false;
let terpasang = false;
/** Mengawasi layar yang digambar ulang (mis. lobi tiap ada kabar meja) selama gelembung terbuka. */
let pengamat: MutationObserver | null = null;

function bisaHover(): boolean {
  return typeof matchMedia === 'function' && matchMedia('(hover: hover) and (pointer: fine)').matches;
}

/** Tutup gelembung yang sedang terbuka. */
export function tutupInfo(): void {
  pengamat?.disconnect();
  pengamat = null;
  gelembung?.remove();
  gelembung = null;
  pemicu?.setAttribute('aria-expanded', 'false');
  pemicu = null;
  ditahan = false;
}

function letakkan(): void {
  if (!gelembung || !pemicu) return;
  if (!pemicu.isConnected) {
    // Layar digambar ulang: pakai tombol penggantinya (id sama) supaya gelembung tidak hilang sendiri.
    const id = pemicu.dataset.info ?? '';
    const ganti = document.querySelector<HTMLButtonElement>(`button[data-info="${id}"]`);
    if (!ganti) return tutupInfo();
    pemicu = ganti;
    ganti.setAttribute('aria-expanded', 'true');
  }
  const r = pemicu.getBoundingClientRect();
  const vw = document.documentElement.clientWidth || innerWidth;
  const vh = document.documentElement.clientHeight || innerHeight;
  const tepi = 12;
  const lebar = Math.min(300, vw - tepi * 2);
  gelembung.style.width = `${lebar}px`;
  const kiri = Math.min(Math.max(tepi, r.left + r.width / 2 - lebar / 2), vw - tepi - lebar);
  gelembung.style.left = `${kiri}px`;
  const tinggi = gelembung.offsetHeight;
  const bawah = r.bottom + 8;
  const atas = r.top - 8 - tinggi;
  const diAtas = bawah + tinggi > vh - tepi && atas >= tepi;
  gelembung.style.top = `${diAtas ? atas : bawah}px`;
  gelembung.dataset.sisi = diAtas ? 'atas' : 'bawah';
  // Panah menunjuk ke tengah "?" walau gelembungnya digeser supaya tidak keluar layar.
  gelembung.style.setProperty('--panah-x', `${Math.min(Math.max(14, r.left + r.width / 2 - kiri), lebar - 14)}px`);
}

/** Buka penjelasan untuk tombol `b`. */
export function bukaInfo(b: HTMLButtonElement, tahan: boolean): void {
  const id = b.dataset.info;
  const sumber = id ? document.getElementById(id) : null;
  if (!sumber) return;
  if (pemicu === b) {
    ditahan = ditahan || tahan;
    return;
  }
  tutupInfo();
  const el = document.createElement('div');
  el.className = 'gelembung-info';
  el.setAttribute('role', 'tooltip');
  el.textContent = sumber.textContent ?? '';
  document.body.appendChild(el);
  gelembung = el;
  pemicu = b;
  ditahan = tahan;
  b.setAttribute('aria-expanded', 'true');
  letakkan();
  if (typeof MutationObserver === 'function') {
    pengamat = new MutationObserver(() => letakkan());
    pengamat.observe(document.body, { childList: true, subtree: true });
  }
}

/** Pasang penangan "?" untuk seluruh dokumen (sekali saja; aman dipanggil berulang). */
export function pasangInfo(doc: Document = document): void {
  if (terpasang) return;
  terpasang = true;
  // Klik dan Escape didengar di window (fase capture), jadi selalu lebih dulu daripada penangan
  // jendela di document (`ui/dom.ts`), berapa pun urutan pemasangannya.
  const win: Window = doc.defaultView ?? window;
  win.addEventListener(
    'click',
    (e) => {
      const t = e.target as Element | null;
      const b = t?.closest?.<HTMLButtonElement>('button[data-info]');
      if (b) {
        // Tombol di dalam <label>: jangan ikut mencentang/membuka kontrolnya.
        e.preventDefault();
        if (pemicu === b && ditahan) tutupInfo();
        else bukaInfo(b, true);
        return;
      }
      if (gelembung && !(t && gelembung.contains(t))) {
        tutupInfo();
        // Ketuk latar jendela selagi gelembung terbuka: cukup gelembungnya yang ditutup.
        if (t instanceof HTMLElement && t.classList.contains('latar')) e.stopPropagation();
      }
    },
    true,
  );
  win.addEventListener(
    'keydown',
    (e) => {
      if (e.key !== 'Escape' || !gelembung) return;
      // Escape menutup gelembung dulu, bukan jendela di bawahnya.
      e.preventDefault();
      e.stopImmediatePropagation();
      const b = pemicu;
      tutupInfo();
      b?.focus({ preventScroll: true });
    },
    true,
  );
  doc.addEventListener('mouseover', (e) => {
    if (!bisaHover()) return;
    const b = (e.target as Element | null)?.closest?.<HTMLButtonElement>('button[data-info]');
    if (b && pemicu !== b && !ditahan) bukaInfo(b, false);
  });
  doc.addEventListener('mouseout', (e) => {
    if (!bisaHover() || ditahan || !pemicu) return;
    const ke = e.relatedTarget as Node | null;
    if ((e.target as Element | null)?.closest?.('button[data-info]') === pemicu && !(ke && pemicu.contains(ke))) tutupInfo();
  });
  // Posisi ikut tombolnya; kalau tombolnya hilang (layar berganti), gelembung ikut tutup.
  addEventListener('resize', () => letakkan());
  doc.addEventListener('scroll', () => letakkan(), true);
}
