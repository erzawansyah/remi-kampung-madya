// Alat bantu DOM: escape teks, toast, modal, lapisan dialog, dan konfirmasi.
//
// Ada dua tingkat jendela:
// - Modal utama (#modal): satu slot untuk jendela permainan (joker, mentung, hasil, skor, menu…).
//   Modal "wajib" (bisaDitutup: false) tidak bisa ditutup dengan Escape/ketuk latar.
// - Lapisan dialog (#lapisan-dialog): tumpukan di ATAS modal utama untuk Pengaturan, Bantuan,
//   Tentang, dan konfirmasi. Membukanya tidak pernah menimpa modal utama, jadi popup joker
//   atau panel mentung (yang menahan antrian animasi) tetap aman.
// Keduanya mengatur fokus keyboard: fokus pindah ke dalam jendela, Tab berputar di dalamnya,
// Escape menutup jendela teratas yang boleh ditutup, dan fokus kembali ke pemicunya saat ditutup.

export function esc(s: unknown): string {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
}

export function $(sel: string, akar: ParentNode = document): HTMLElement {
  const el = akar.querySelector(sel);
  if (!el) throw new Error(`elemen ${sel} tidak ada`);
  return el as HTMLElement;
}

// ---------------------------------------------------------------------------------------------
// Toast

export interface AksiToast {
  label: string;
  jalankan: () => void;
}

/**
 * Pesan singkat di bawah layar. Diumumkan ke pembaca layar (aria-live).
 * `aksi` menambah satu tombol (mis. "Muat ulang"); toast dengan aksi bertahan lebih lama.
 */
export function toast(pesan: string, salah = false, ms = 3200, aksi?: AksiToast): void {
  const wadah = document.getElementById('toast');
  if (!wadah) return;
  if (!wadah.hasAttribute('aria-live')) {
    wadah.setAttribute('role', 'status');
    wadah.setAttribute('aria-live', 'polite');
  }
  // Pesan yang sama persis tidak ditumpuk: toast lama diganti yang baru (waktunya mulai lagi).
  for (const lama of [...wadah.children] as HTMLElement[]) {
    if (lama.dataset.pesan === pesan) lama.remove();
  }
  const el = document.createElement('div');
  el.dataset.pesan = pesan;
  el.className = `toast${salah ? ' salah' : ''}${aksi ? ' beraksi' : ''}`;
  const teks = document.createElement('span');
  teks.textContent = pesan;
  el.appendChild(teks);
  if (aksi) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'kecil utama';
    b.textContent = aksi.label;
    b.addEventListener('click', () => {
      el.remove();
      aksi.jalankan();
    });
    el.appendChild(b);
  }
  wadah.appendChild(el);
  setTimeout(() => el.remove(), aksi ? Math.max(ms, 9000) : ms);
  while (wadah.children.length > 3) wadah.firstElementChild?.remove();
}

/** Umumkan teks ke pembaca layar tanpa menampilkan apa pun (live region tersembunyi). */
export function umumkan(pesan: string, tegas = false): void {
  let el = document.getElementById('pengumuman-sr');
  if (!el) {
    el = document.createElement('div');
    el.id = 'pengumuman-sr';
    // Tersembunyi secara visual tapi tetap dibaca pembaca layar.
    el.style.cssText = 'position:absolute;width:1px;height:1px;margin:-1px;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap;border:0';
    el.setAttribute('aria-live', 'polite');
    el.setAttribute('aria-atomic', 'true');
    document.body.appendChild(el);
  }
  el.setAttribute('aria-live', tegas ? 'assertive' : 'polite');
  // Kosongkan dulu supaya pesan yang sama tetap diumumkan ulang.
  el.textContent = '';
  const target = el;
  requestAnimationFrame(() => (target.textContent = pesan));
}

// ---------------------------------------------------------------------------------------------
// Fokus & lapisan

const SELEKTOR_FOKUS =
  'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), details > summary, [tabindex]:not([tabindex="-1"])';

function bisaDifokus(akar: HTMLElement): HTMLElement[] {
  return [...akar.querySelectorAll<HTMLElement>(SELEKTOR_FOKUS)].filter((el) => el.offsetParent !== null || el === document.activeElement);
}

/** Fokuskan elemen awal dialog: [autofocus], lalu tombol .utama, lalu elemen pertama, lalu dialognya sendiri. */
function fokusAwal(dialog: HTMLElement): void {
  const sasaran =
    dialog.querySelector<HTMLElement>('[autofocus]') ??
    dialog.querySelector<HTMLElement>('button.utama:not([disabled])') ??
    bisaDifokus(dialog)[0] ??
    dialog;
  if (sasaran === dialog) dialog.tabIndex = -1;
  sasaran.focus({ preventScroll: true });
}

interface Lapisan {
  /** Elemen latar (berisi .dialog). */
  latar: HTMLElement;
  dialog: HTMLElement;
  bisaDitutup: boolean;
  tutup: () => void;
  /** Elemen yang fokus sebelum lapisan dibuka; dikembalikan saat ditutup. */
  fokusSebelum: Element | null;
}

/** Tumpukan jendela yang terbuka, dari bawah ke atas. Modal utama (bila ada) selalu di dasar. */
const tumpukan: Lapisan[] = [];

function teratas(): Lapisan | undefined {
  return tumpukan[tumpukan.length - 1];
}

/** Elemen latar belakang yang dibuat inert selama ada jendela terbuka. */
function aturInert(): void {
  const adaModal = tumpukan.length > 0;
  for (const id of ['ui', 'game']) {
    const el = document.getElementById(id);
    if (el) el.inert = adaModal;
  }
  // Modal utama ikut inert kalau ada dialog di atasnya.
  const modal = document.getElementById('modal');
  if (modal) modal.inert = tumpukan.length > 1 && tumpukan[0]?.latar.parentElement === modal;
  const lapisanDialog = document.getElementById('lapisan-dialog');
  if (lapisanDialog) {
    const dialogs = [...lapisanDialog.children] as HTMLElement[];
    dialogs.forEach((d, i) => (d.inert = i < dialogs.length - 1));
  }
}

let keyboardTerpasang = false;
function pasangKeyboard(): void {
  if (keyboardTerpasang) return;
  keyboardTerpasang = true;
  document.addEventListener(
    'keydown',
    (e) => {
      const atas = teratas();
      if (!atas) return;
      if (e.key === 'Escape') {
        if (atas.bisaDitutup) {
          e.preventDefault();
          e.stopPropagation();
          atas.tutup();
        }
        return;
      }
      if (e.key !== 'Tab') return;
      // Kurung fokus di dalam jendela teratas.
      const daftar = bisaDifokus(atas.dialog);
      if (!daftar.length) {
        e.preventDefault();
        atas.dialog.focus();
        return;
      }
      const pertama = daftar[0]!;
      const terakhir = daftar[daftar.length - 1]!;
      const aktif = document.activeElement;
      if (!atas.dialog.contains(aktif)) {
        e.preventDefault();
        pertama.focus();
      } else if (e.shiftKey && aktif === pertama) {
        e.preventDefault();
        terakhir.focus();
      } else if (!e.shiftKey && aktif === terakhir) {
        e.preventDefault();
        pertama.focus();
      }
    },
    true,
  );
}

function kembalikanFokus(el: Element | null): void {
  if (el instanceof HTMLElement && el.isConnected && !el.closest('[inert]')) el.focus({ preventScroll: true });
}

export interface OpsiJendela {
  /** false = jendela wajib: tidak bisa ditutup dengan Escape atau ketuk latar. Bawaan true. */
  bisaDitutup?: boolean;
  /** Label aksesibel bila dialog tidak punya judul <h2>. */
  label?: string;
  /** Dipanggil sekali setelah jendela ditutup (dengan cara apa pun). */
  saatTutup?: () => void;
  /** Kelas tambahan untuk elemen .dialog (mis. 'lebar'). */
  kelas?: string;
}

function bangunJendela(wadah: HTMLElement, html: string, opsi: OpsiJendela): { latar: HTMLElement; dialog: HTMLElement } {
  const latar = document.createElement('div');
  latar.className = 'latar';
  const dialog = document.createElement('div');
  dialog.className = `dialog${opsi.kelas ? ` ${opsi.kelas}` : ''}`;
  dialog.setAttribute('role', 'dialog');
  dialog.setAttribute('aria-modal', 'true');
  dialog.innerHTML = html;
  const judul = dialog.querySelector('h2, h3');
  if (judul) {
    judul.id ||= `judul-${Math.random().toString(36).slice(2, 8)}`;
    dialog.setAttribute('aria-labelledby', judul.id);
  } else if (opsi.label) {
    dialog.setAttribute('aria-label', opsi.label);
  }
  latar.appendChild(dialog);
  wadah.appendChild(latar);
  return { latar, dialog };
}

// ---------------------------------------------------------------------------------------------
// Modal utama

let modalUtama: Lapisan | null = null;

/** Tampilkan modal utama (mengganti modal utama sebelumnya). `pasang` dipanggil dengan elemen dialog. */
export function bukaModal(html: string, pasang?: (dialog: HTMLElement) => void, opsi: OpsiJendela = {}): void {
  const wadah = document.getElementById('modal')!;
  // Ganti modal lama tanpa memanggil saatTutup-nya dua kali.
  const fokusSebelum = modalUtama ? modalUtama.fokusSebelum : document.activeElement;
  if (modalUtama) lepasDariTumpukan(modalUtama);
  wadah.innerHTML = '';
  pasangKeyboard();
  const { latar, dialog } = bangunJendela(wadah, html, opsi);
  const bisaDitutup = opsi.bisaDitutup !== false;
  let sudahTutup = false;
  const lapisan: Lapisan = {
    latar,
    dialog,
    bisaDitutup,
    fokusSebelum,
    tutup: () => {
      if (sudahTutup) return;
      sudahTutup = true;
      if (modalUtama === lapisan) {
        modalUtama = null;
        wadah.innerHTML = '';
      }
      lepasDariTumpukan(lapisan);
      opsi.saatTutup?.();
      // Kembalikan fokus hanya kalau tidak ada dialog lain di atas.
      if (!teratas()) kembalikanFokus(lapisan.fokusSebelum);
    },
  };
  modalUtama = lapisan;
  // Modal utama selalu di dasar tumpukan (di bawah dialog lapisan yang mungkin terbuka).
  tumpukan.unshift(lapisan);
  if (bisaDitutup) {
    latar.addEventListener('click', (e) => {
      if (e.target === latar) lapisan.tutup();
    });
  }
  dialog.querySelectorAll<HTMLElement>('[data-tutup]').forEach((b) => b.addEventListener('click', () => lapisan.tutup()));
  pasang?.(dialog);
  aturInert();
  // Jangan rebut fokus dari dialog lapisan yang sedang terbuka di atasnya.
  if (teratas() === lapisan) fokusAwal(dialog);
}

export function tutupModal(): void {
  if (modalUtama) modalUtama.tutup();
  else {
    const wadah = document.getElementById('modal');
    if (wadah) wadah.innerHTML = '';
  }
}

export function modalTerbuka(): boolean {
  return !!document.getElementById('modal')?.firstElementChild;
}

function lepasDariTumpukan(l: Lapisan): void {
  const i = tumpukan.indexOf(l);
  if (i >= 0) tumpukan.splice(i, 1);
  aturInert();
}

// ---------------------------------------------------------------------------------------------
// Lapisan dialog (di atas modal utama)

function wadahLapisan(): HTMLElement {
  let el = document.getElementById('lapisan-dialog');
  if (!el) {
    el = document.createElement('div');
    el.id = 'lapisan-dialog';
    document.body.appendChild(el);
  }
  return el;
}

export interface PenanganDialog {
  dialog: HTMLElement;
  tutup: () => void;
}

/**
 * Buka dialog di atas segalanya (Pengaturan, Bantuan, Tentang, konfirmasi). Bisa bertumpuk.
 * Tidak pernah menimpa modal utama. Kembalikan penangan untuk menutupnya.
 */
export function bukaDialog(html: string, pasang?: (dialog: HTMLElement, tutup: () => void) => void, opsi: OpsiJendela = {}): PenanganDialog {
  pasangKeyboard();
  const fokusSebelum = document.activeElement;
  const { latar, dialog } = bangunJendela(wadahLapisan(), html, opsi);
  const bisaDitutup = opsi.bisaDitutup !== false;
  let sudahTutup = false;
  const lapisan: Lapisan = {
    latar,
    dialog,
    bisaDitutup,
    fokusSebelum,
    tutup: () => {
      if (sudahTutup) return;
      sudahTutup = true;
      latar.remove();
      lepasDariTumpukan(lapisan);
      opsi.saatTutup?.();
      const atas = teratas();
      if (atas && !atas.dialog.contains(document.activeElement)) fokusAwal(atas.dialog);
      kembalikanFokus(lapisan.fokusSebelum);
    },
  };
  tumpukan.push(lapisan);
  if (bisaDitutup) {
    latar.addEventListener('click', (e) => {
      if (e.target === latar) lapisan.tutup();
    });
  }
  dialog.querySelectorAll<HTMLElement>('[data-tutup]').forEach((b) => b.addEventListener('click', () => lapisan.tutup()));
  pasang?.(dialog, lapisan.tutup);
  aturInert();
  fokusAwal(dialog);
  return { dialog, tutup: lapisan.tutup };
}

/** Tutup dialog lapisan teratas (bukan modal utama). Mengembalikan false bila tidak ada. */
export function tutupDialogTeratas(): boolean {
  const atas = teratas();
  if (!atas || atas === modalUtama) return false;
  atas.tutup();
  return true;
}

/**
 * Tutup SEMUA jendela: dialog lapisan (dari atas ke bawah) lalu modal utama.
 * Dipakai saat meninggalkan layar (mis. meja dihancurkan) supaya tidak ada jendela basi yang
 * menutupi layar berikutnya dan membuat #ui tetap inert.
 */
export function tutupSemuaJendela(): void {
  for (const l of [...tumpukan].reverse()) l.tutup();
  tutupModal();
  aturInert();
}

/** Ada dialog lapisan yang terbuka (Pengaturan/Bantuan/konfirmasi). */
export function dialogTerbuka(): boolean {
  return tumpukan.some((l) => l !== modalUtama);
}

/** Ada jendela apa pun (modal utama atau dialog) yang terbuka. */
export function adaJendelaTerbuka(): boolean {
  return tumpukan.length > 0;
}

// ---------------------------------------------------------------------------------------------
// Konfirmasi

export interface OpsiKonfirmasi {
  judul: string;
  pesan: string;
  /** Label tombol setuju. Bawaan "Iya". */
  ya?: string;
  /** Label tombol batal. Bawaan "Nggak jadi". */
  tidak?: string;
  /** Aksi merusak (hapus/keluar): tombol setuju bergaya bahaya, fokus awal di tombol batal. */
  bahaya?: boolean;
}

/** Minta konfirmasi. Resolve true bila setuju; false bila batal, Escape, atau ketuk latar. */
export function konfirmasi(o: OpsiKonfirmasi): Promise<boolean> {
  return new Promise((selesai) => {
    let jawaban = false;
    bukaDialog(
      `<h2>${esc(o.judul)}</h2>
       <p>${esc(o.pesan)}</p>
       <div class="deret">
         <button type="button" data-tidak ${o.bahaya ? 'autofocus' : ''}>${esc(o.tidak ?? 'Nggak jadi')}</button>
         <button type="button" data-ya class="${o.bahaya ? 'bahaya' : 'utama'}" ${o.bahaya ? '' : 'autofocus'}>${esc(o.ya ?? 'Iya')}</button>
       </div>`,
      (d, tutup) => {
        d.querySelector('[data-ya]')!.addEventListener('click', () => {
          jawaban = true;
          tutup();
        });
        d.querySelector('[data-tidak]')!.addEventListener('click', () => tutup());
      },
      { kelas: 'konfirmasi', saatTutup: () => selesai(jawaban) },
    );
  });
}

/**
 * Landmark <main> untuk isi aplikasi: kanvas meja (#game) dan layar HTML (#ui) dibungkus satu
 * <main>, supaya pembaca layar bisa lompat ke isi utama dan tidak ada konten di luar landmark.
 * Jendela (#modal, #lapisan-dialog) dan toast tetap di luar, sebagai dialog/live region sendiri.
 * #game dan #ui berposisi fixed, jadi pembungkus tanpa gaya ini tidak mengubah tata letak maupun
 * urutan tumpukan (z-index). Splash tetap hilang lewat splash.js (mengamati #ui yang sama).
 * Kalau index.html kelak sudah memakai <main>, tidak dibungkus dua kali.
 */
export function pasangLandmarkUtama(doc: Document = document): void {
  const game = doc.getElementById('game');
  const ui = doc.getElementById('ui');
  if (!game || !ui || game.closest('main') || ui.closest('main')) return;
  const utama = doc.createElement('main');
  utama.id = 'utama';
  game.before(utama);
  utama.append(game, ui);
}
