// @vitest-environment happy-dom
// Jendela di ui/dom.ts: modal utama, lapisan dialog di atasnya, konfirmasi, Escape, kurungan fokus,
// inert latar belakang, tutupSemuaJendela, dan toast yang tidak menumpuk pesan sama.
// Yang dijaga: popup joker / panel mentung (modal wajib) tidak boleh hilang gara-gara Pengaturan,
// Bantuan, atau konfirmasi dibuka di atasnya, dan meja tidak boleh tetap inert setelah semua ditutup.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  adaJendelaTerbuka,
  bukaDialog,
  bukaModal,
  dialogTerbuka,
  konfirmasi,
  modalTerbuka,
  toast,
  tutupDialogTeratas,
  tutupModal,
  tutupSemuaJendela,
} from '../src/ui/dom';

const el = (id: string) => document.getElementById(id)!;
const inert = (id: string) => !!document.getElementById(id)?.inert;
const aktif = () => document.activeElement as HTMLElement | null;

/** Tekan tombol di elemen yang sedang fokus (bubble sampai document, seperti keyboard sungguhan). */
function tekan(key: string, shiftKey = false): KeyboardEvent {
  const e = new KeyboardEvent('keydown', { key, shiftKey, bubbles: true, cancelable: true });
  (aktif() ?? document.body).dispatchEvent(e);
  return e;
}

/** Ketuk latar gelap (di luar kotak dialog). */
function ketukLatar(dialog: HTMLElement): void {
  dialog.parentElement!.dispatchEvent(new MouseEvent('click', { bubbles: true }));
}

const JOKER = `<h2>Joker putaran ini</h2><p>Ingat baik-baik, Bos.</p><button type="button" class="utama" data-ok>OK</button>`;
const PENGATURAN = `<h2>Pengaturan</h2>
  <button type="button" data-satu>Satu</button>
  <button type="button" data-dua>Dua</button>
  <button type="button" data-tutup>Tutup</button>`;

beforeEach(() => {
  document.body.innerHTML = `
    <div id="ui"><button type="button" id="pemicu">Menu</button></div>
    <div id="game"></div>
    <div id="modal"></div>
    <div id="toast"></div>`;
});

afterEach(() => {
  tutupSemuaJendela();
  vi.useRealTimers();
});

describe('modal utama', () => {
  it('membuat #ui dan #game inert, fokus pindah ke tombol utama, dan kembali ke pemicu saat ditutup', () => {
    el('pemicu').focus();
    bukaModal(`<h2>Menu</h2><button type="button">Lain</button><button type="button" class="utama" data-tutup>Lanjut main</button>`);
    expect(modalTerbuka()).toBe(true);
    expect(inert('ui')).toBe(true);
    expect(inert('game')).toBe(true);
    expect(aktif()?.textContent).toBe('Lanjut main');
    const dialog = document.querySelector('#modal .dialog')!;
    expect(dialog.getAttribute('role')).toBe('dialog');
    expect(dialog.getAttribute('aria-modal')).toBe('true');
    expect(document.getElementById(dialog.getAttribute('aria-labelledby')!)?.textContent).toBe('Menu');

    (aktif() as HTMLButtonElement).click();
    expect(modalTerbuka()).toBe(false);
    expect(inert('ui')).toBe(false);
    expect(inert('game')).toBe(false);
    expect(aktif()?.id).toBe('pemicu');
  });

  it('Escape menutup modal biasa dan memanggil saatTutup sekali', () => {
    const saatTutup = vi.fn();
    bukaModal('<h2>Log</h2><button type="button">Oke</button>', undefined, { saatTutup });
    tekan('Escape');
    expect(modalTerbuka()).toBe(false);
    tekan('Escape');
    tutupModal();
    expect(saatTutup).toHaveBeenCalledTimes(1);
  });

  it('tombol tutup yang ditekan dua kali (ketuk ganda) tetap memanggil saatTutup sekali', () => {
    const saatTutup = vi.fn();
    bukaModal('<h2>Skor</h2><button type="button" data-tutup>Tutup</button>', undefined, { saatTutup });
    const tombol = document.querySelector<HTMLElement>('#modal [data-tutup]')!;
    tombol.click();
    tombol.click(); // klik kedua sampai ke tombol yang sudah dilepas dari DOM
    expect(modalTerbuka()).toBe(false);
    expect(saatTutup).toHaveBeenCalledTimes(1);
  });

  it('bukaModal B mengganti modal A tanpa memanggil saatTutup A (A tidak "ditutup" oleh pemain)', () => {
    const tutupA = vi.fn();
    const tutupB = vi.fn();
    bukaModal('<h2>Hasil putaran</h2><button type="button" class="utama">Oke</button>', undefined, { saatTutup: tutupA });
    bukaModal('<h2>Hasil putaran</h2><button type="button" class="utama">Oke</button>', undefined, { saatTutup: tutupB });
    expect(tutupA).not.toHaveBeenCalled();
    expect(document.querySelectorAll('#modal .dialog')).toHaveLength(1);
    tekan('Escape');
    expect(modalTerbuka()).toBe(false);
    expect(tutupA).not.toHaveBeenCalled();
    expect(tutupB).toHaveBeenCalledTimes(1);
  });

  it('Escape yang ditangani jendela tidak sampai ke pintasan meja (pendengar keydown di document)', () => {
    const pintasan = vi.fn();
    const sasaran = vi.fn();
    document.addEventListener('keydown', pintasan);
    try {
      // Tanpa jendela: Escape sampai ke pintasan (pendengar uji memang bekerja).
      tekan('Escape');
      expect(pintasan).toHaveBeenCalledTimes(1);
      bukaModal('<h2>Menu</h2><button type="button" class="utama">Lanjut</button>');
      aktif()!.addEventListener('keydown', sasaran);
      tekan('Escape');
      expect(modalTerbuka()).toBe(false);
      expect(pintasan).toHaveBeenCalledTimes(1);
      expect(sasaran).not.toHaveBeenCalled();
      // Dialog di atas modal wajib: Escape menutup dialog saja, pintasan tetap tidak menerima.
      bukaModal(JOKER, undefined, { bisaDitutup: false });
      bukaDialog(PENGATURAN);
      tekan('Escape');
      expect(dialogTerbuka()).toBe(false);
      expect(pintasan).toHaveBeenCalledTimes(1);
    } finally {
      document.removeEventListener('keydown', pintasan);
    }
  });

  it('modal wajib (bisaDitutup: false): Escape dan ketuk latar tidak menutupnya', () => {
    bukaModal(JOKER, undefined, { bisaDitutup: false });
    const dialog = document.querySelector<HTMLElement>('#modal .dialog')!;
    tekan('Escape');
    ketukLatar(dialog);
    expect(modalTerbuka()).toBe(true);
    expect(inert('ui')).toBe(true);
  });

  it('ketuk latar menutup modal biasa, ketuk di dalam kotak tidak', () => {
    bukaModal('<h2>Skor</h2><p>isi</p>');
    const dialog = document.querySelector<HTMLElement>('#modal .dialog')!;
    dialog.querySelector('p')!.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(modalTerbuka()).toBe(true);
    ketukLatar(dialog);
    expect(modalTerbuka()).toBe(false);
  });

  it('modal tanpa judul memakai label aksesibel dari opsi', () => {
    bukaModal('<p>Kocok…</p>', undefined, { label: 'Sedang mengocok' });
    expect(document.querySelector('#modal .dialog')!.getAttribute('aria-label')).toBe('Sedang mengocok');
  });
});

describe('dialog di atas modal wajib (Pengaturan/Bantuan/konfirmasi di atas popup joker)', () => {
  it('membuka dialog tidak menutup atau mengganti modal wajib; modal jadi inert selama dialog terbuka', () => {
    bukaModal(JOKER, undefined, { bisaDitutup: false });
    bukaDialog(PENGATURAN);
    expect(dialogTerbuka()).toBe(true);
    expect(document.querySelector('#modal [data-ok]')).not.toBeNull();
    expect(inert('modal')).toBe(true);
    expect(inert('ui')).toBe(true);
    expect(document.querySelector('#lapisan-dialog .dialog')!.contains(aktif())).toBe(true);
  });

  it('Escape menutup dialog teratas saja; modal wajib tetap ada, aktif lagi, dan dapat fokus', () => {
    bukaModal(JOKER, undefined, { bisaDitutup: false });
    bukaDialog(PENGATURAN);
    tekan('Escape');
    expect(dialogTerbuka()).toBe(false);
    expect(modalTerbuka()).toBe(true);
    expect(inert('modal')).toBe(false);
    expect(inert('ui')).toBe(true);
    expect(document.querySelector('#modal .dialog')!.contains(aktif())).toBe(true);
    // Escape berikutnya tetap tidak bisa menutup popup joker.
    tekan('Escape');
    expect(modalTerbuka()).toBe(true);
  });

  it('dialog bertumpuk: yang bawah inert, Escape menutup satu per satu dari atas', () => {
    bukaModal(JOKER, undefined, { bisaDitutup: false });
    bukaDialog(PENGATURAN);
    const atas = bukaDialog('<h2>Yakin?</h2><button type="button" class="utama">Iya</button>');
    const dialogs = [...el('lapisan-dialog').children] as HTMLElement[];
    expect(dialogs).toHaveLength(2);
    expect(dialogs[0]!.inert).toBe(true);
    expect(dialogs[1]!.inert).toBe(false);
    expect(atas.dialog.contains(aktif())).toBe(true);

    tekan('Escape');
    expect(el('lapisan-dialog').children).toHaveLength(1);
    expect((el('lapisan-dialog').children[0] as HTMLElement).inert).toBe(false);
    tekan('Escape');
    expect(dialogTerbuka()).toBe(false);
    expect(modalTerbuka()).toBe(true);
  });

  it('modal utama yang dibuka ulang saat dialog terbuka tidak merebut fokus dari dialog', () => {
    bukaModal(JOKER, undefined, { bisaDitutup: false });
    const d = bukaDialog(PENGATURAN);
    (d.dialog.querySelector('[data-dua]') as HTMLElement).focus();
    // Mis. view baru datang dan panel mentung digambar ulang di belakang Pengaturan.
    bukaModal('<h2>Mentung!</h2><button type="button" class="utama" data-lanjut>Lanjut</button>', undefined, { bisaDitutup: false });
    expect(aktif()?.hasAttribute('data-dua')).toBe(true);
    expect(inert('modal')).toBe(true);
    d.tutup();
    expect(document.querySelector('#modal [data-lanjut]')).not.toBeNull();
    expect(document.querySelector('#modal .dialog')!.contains(aktif())).toBe(true);
  });

  it('modal utama yang dibuka saat dialog terbuka tidak memanggil focus() di belakang dialog', () => {
    // Di browser tanpa dukungan inert, focus() ke modal di belakang dialog akan benar-benar merebut fokus.
    bukaModal(JOKER, undefined, { bisaDitutup: false });
    bukaDialog(PENGATURAN);
    const fokus = vi.spyOn(HTMLElement.prototype, 'focus');
    try {
      bukaModal('<h2>Mentung!</h2><button type="button" class="utama" data-lanjut>Lanjut</button>', undefined, { bisaDitutup: false });
      const keModal = fokus.mock.contexts.filter((el) => el instanceof HTMLElement && el.closest('#modal'));
      expect(keModal).toEqual([]);
    } finally {
      fokus.mockRestore();
    }
  });

  it('menutup dialog tidak mengembalikan fokus ke pemicu yang kini inert di belakang modal wajib', () => {
    el('pemicu').focus();
    const d = bukaDialog(PENGATURAN); // dibuka dari tombol Menu di #ui
    bukaModal(JOKER, undefined, { bisaDitutup: false }); // view baru datang: popup joker di belakang dialog
    const fokus = vi.spyOn(HTMLElement.prototype, 'focus');
    try {
      d.tutup();
      expect(inert('ui')).toBe(true);
      expect(fokus.mock.contexts).not.toContain(el('pemicu'));
      expect(document.querySelector('#modal .dialog')!.contains(aktif())).toBe(true);
    } finally {
      fokus.mockRestore();
    }
  });

  it('tutupDialogTeratas tidak pernah menutup modal utama', () => {
    bukaModal(JOKER, undefined, { bisaDitutup: false });
    expect(tutupDialogTeratas()).toBe(false);
    expect(modalTerbuka()).toBe(true);
    bukaDialog(PENGATURAN);
    expect(tutupDialogTeratas()).toBe(true);
    expect(tutupDialogTeratas()).toBe(false);
    expect(modalTerbuka()).toBe(true);
  });

  it('[data-tutup] di dialog hanya menutup dialog itu', () => {
    bukaModal(JOKER, undefined, { bisaDitutup: false });
    const d = bukaDialog(PENGATURAN);
    (d.dialog.querySelector('[data-tutup]') as HTMLElement).click();
    expect(dialogTerbuka()).toBe(false);
    expect(modalTerbuka()).toBe(true);
  });
});

describe('kurungan fokus (Tab)', () => {
  it('Tab di tombol terakhir kembali ke yang pertama; Shift+Tab di yang pertama ke yang terakhir', () => {
    const d = bukaDialog(PENGATURAN);
    const [satu, , tutup] = [...d.dialog.querySelectorAll<HTMLElement>('button')];
    tutup!.focus();
    expect(tekan('Tab').defaultPrevented).toBe(true);
    expect(aktif()).toBe(satu);
    expect(tekan('Tab', true).defaultPrevented).toBe(true);
    expect(aktif()).toBe(tutup);
  });

  it('fokus yang lari ke luar jendela ditarik kembali ke dalam', () => {
    const d = bukaDialog(PENGATURAN);
    el('pemicu').focus(); // #ui inert di browser sungguhan; di sini dipaksa untuk menguji cadangannya
    tekan('Tab');
    expect(d.dialog.contains(aktif())).toBe(true);
  });

  it('dialog tanpa elemen fokus: dialognya sendiri yang menerima fokus', () => {
    const d = bukaDialog('<h2>Sebentar</h2><p>Lagi mikir…</p>');
    expect(aktif()).toBe(d.dialog);
    expect(tekan('Tab').defaultPrevented).toBe(true);
    expect(aktif()).toBe(d.dialog);
  });

  it('[autofocus] didahulukan daripada tombol utama', () => {
    const d = bukaDialog('<h2>Nama</h2><input autofocus id="isian" /><button type="button" class="utama">Simpan</button>');
    expect(aktif()).toBe(d.dialog.querySelector('#isian'));
  });

  it('tanpa jendela terbuka, Tab dan Escape tidak diganggu', () => {
    bukaDialog(PENGATURAN).tutup();
    expect(adaJendelaTerbuka()).toBe(false);
    expect(tekan('Tab').defaultPrevented).toBe(false);
    expect(tekan('Escape').defaultPrevented).toBe(false);
  });
});

describe('konfirmasi', () => {
  it('tombol setuju → true; fokus awal di tombol setuju', async () => {
    const jawab = konfirmasi({ judul: 'Mulai lagi?', pesan: 'Meja baru.' });
    const d = document.querySelector<HTMLElement>('#lapisan-dialog .dialog')!;
    expect(aktif()?.hasAttribute('data-ya')).toBe(true);
    (d.querySelector('[data-ya]') as HTMLElement).click();
    await expect(jawab).resolves.toBe(true);
    expect(dialogTerbuka()).toBe(false);
  });

  it('aksi bahaya: fokus awal di tombol batal, tombol setuju bergaya bahaya', async () => {
    const jawab = konfirmasi({ judul: 'Hapus riwayat?', pesan: 'Nggak bisa dibalikin.', bahaya: true, ya: 'Hapus' });
    const d = document.querySelector<HTMLElement>('#lapisan-dialog .dialog')!;
    expect(aktif()?.hasAttribute('data-tidak')).toBe(true);
    // Fokus di tombol batal dipilih eksplisit (autofocus), bukan kebetulan karena urutan tombol.
    expect(d.querySelector('[data-tidak]')!.hasAttribute('autofocus')).toBe(true);
    expect(d.querySelector('[data-ya]')!.hasAttribute('autofocus')).toBe(false);
    expect(d.querySelector('[data-ya]')!.classList.contains('bahaya')).toBe(true);
    expect(d.querySelector('[data-ya]')!.textContent).toBe('Hapus');
    (aktif() as HTMLElement).click();
    await expect(jawab).resolves.toBe(false);
  });

  it('Escape dan ketuk latar = batal', async () => {
    const a = konfirmasi({ judul: 'Keluar?', pesan: '…' });
    tekan('Escape');
    await expect(a).resolves.toBe(false);
    const b = konfirmasi({ judul: 'Keluar?', pesan: '…' });
    ketukLatar(document.querySelector<HTMLElement>('#lapisan-dialog .dialog')!);
    await expect(b).resolves.toBe(false);
  });

  it('konfirmasi di atas modal wajib: dijawab, modal wajib tetap utuh', async () => {
    bukaModal(JOKER, undefined, { bisaDitutup: false });
    const jawab = konfirmasi({ judul: 'Simpan & ke beranda?', pesan: '…' });
    tekan('Escape');
    await expect(jawab).resolves.toBe(false);
    expect(document.querySelector('#modal [data-ok]')).not.toBeNull();
  });

  it('judul dan pesan di-escape', () => {
    void konfirmasi({ judul: '<img src=x>', pesan: '<b>tebal</b>' });
    const d = document.querySelector<HTMLElement>('#lapisan-dialog .dialog')!;
    expect(d.querySelector('img, b')).toBeNull();
    expect(d.textContent).toContain('<b>tebal</b>');
  });
});

describe('tutupSemuaJendela', () => {
  it('menutup dialog bertumpuk dan modal wajib, lalu membersihkan inert', () => {
    const tutupModalWajib = vi.fn();
    const tutupDialog = vi.fn();
    bukaModal(JOKER, undefined, { bisaDitutup: false, saatTutup: tutupModalWajib });
    bukaDialog(PENGATURAN, undefined, { saatTutup: tutupDialog });
    bukaDialog('<h2>Bantuan</h2><button type="button">x</button>', undefined, { saatTutup: tutupDialog });

    tutupSemuaJendela();
    expect(modalTerbuka()).toBe(false);
    expect(dialogTerbuka()).toBe(false);
    expect(adaJendelaTerbuka()).toBe(false);
    expect(el('lapisan-dialog').children).toHaveLength(0);
    for (const id of ['ui', 'game', 'modal']) expect(inert(id)).toBe(false);
    expect(tutupModalWajib).toHaveBeenCalledTimes(1);
    expect(tutupDialog).toHaveBeenCalledTimes(2);
  });

  it('konfirmasi yang masih menunggu ikut dijawab false (tidak menggantung)', async () => {
    const jawab = konfirmasi({ judul: 'Yakin?', pesan: '…' });
    tutupSemuaJendela();
    await expect(jawab).resolves.toBe(false);
  });

  it('aman dipanggil tanpa jendela, dan berkali-kali', () => {
    expect(() => {
      tutupSemuaJendela();
      tutupSemuaJendela();
    }).not.toThrow();
    expect(inert('ui')).toBe(false);
  });

  it('sesudahnya Escape tidak lagi diserap jendela basi', () => {
    bukaModal(JOKER, undefined, { bisaDitutup: false });
    tutupSemuaJendela();
    expect(tekan('Escape').defaultPrevented).toBe(false);
    // Jendela baru setelah itu tetap bekerja normal.
    bukaModal('<h2>Menu</h2><button type="button" class="utama">Lanjut</button>');
    tekan('Escape');
    expect(modalTerbuka()).toBe(false);
  });
});

describe('toast', () => {
  beforeEach(() => vi.useFakeTimers());

  it('pesan identik tidak ditumpuk; waktunya mulai lagi dari toast terakhir', () => {
    toast('Sinyalnya lagi putus, Bos.', true, 1000);
    vi.advanceTimersByTime(600);
    toast('Sinyalnya lagi putus, Bos.', true, 1000);
    toast('Sinyalnya lagi putus, Bos.', true, 1000);
    expect(document.querySelectorAll('#toast .toast')).toHaveLength(1);
    vi.advanceTimersByTime(600); // 1200 ms sejak yang pertama: toast terbaru masih tampil
    expect(document.querySelectorAll('#toast .toast')).toHaveLength(1);
    vi.advanceTimersByTime(500);
    expect(document.querySelectorAll('#toast .toast')).toHaveLength(0);
  });

  it('pesan berbeda tetap tampil berdampingan', () => {
    toast('Modalnya kurang, Bos.');
    toast('Belum giliranmu, Bos.');
    toast('Modalnya kurang, Bos.');
    const isi = [...document.querySelectorAll('#toast .toast')].map((t) => t.textContent);
    expect(isi).toEqual(['Belum giliranmu, Bos.', 'Modalnya kurang, Bos.']);
  });

  it('paling banyak 3 toast tampil; yang tertua dibuang duluan', () => {
    for (const p of ['Satu', 'Dua', 'Tiga', 'Empat', 'Lima']) toast(p);
    const isi = [...document.querySelectorAll('#toast .toast')].map((t) => t.textContent);
    expect(isi).toEqual(['Tiga', 'Empat', 'Lima']);
  });

  it('toast beraksi bertahan minimal 9 detik walau diminta lebih singkat', () => {
    toast('Ada versi baru.', false, 3000, { label: 'Muat ulang', jalankan: () => {} });
    vi.advanceTimersByTime(8_900);
    expect(document.querySelector('#toast .toast')).not.toBeNull();
    vi.advanceTimersByTime(200);
    expect(document.querySelector('#toast .toast')).toBeNull();
  });

  it('wadah toast diumumkan ke pembaca layar (role=status, aria-live=polite)', () => {
    toast('Halo');
    expect(el('toast').getAttribute('role')).toBe('status');
    expect(el('toast').getAttribute('aria-live')).toBe('polite');
  });

  it('toast beraksi: tombolnya menjalankan aksi lalu toast hilang', () => {
    const jalankan = vi.fn();
    toast('Ada versi baru.', false, 3000, { label: 'Muat ulang', jalankan });
    const b = document.querySelector<HTMLButtonElement>('#toast .toast button')!;
    expect(b.textContent).toBe('Muat ulang');
    b.click();
    expect(jalankan).toHaveBeenCalledTimes(1);
    expect(document.querySelector('#toast .toast')).toBeNull();
  });
});
