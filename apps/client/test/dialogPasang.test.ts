// @vitest-environment happy-dom
// Dialog petunjuk pasang aplikasi (ui/pasang.ts, keputusan #46): tiga varian, tombol Nanti saja /
// Sudah kupasang / Tutup, Salin link (clipboard dan cadangannya), dan lewat lapisan dialog
// (bukaDialog) sehingga tidak menimpa modal utama.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MANFAAT_PASANG, PETUNJUK_PASANG, TEKS_TAWARAN } from '../src/konten/pasang';
import { bukaModal, dialogTerbuka, tutupSemuaJendela } from '../src/ui/dom';
import { bukaPetunjukPasang, htmlLangkah } from '../src/ui/pasang';

const opsi = (cara: 'ios' | 'android' | 'inapp') => ({ cara, url: 'https://remi.contoh/?meja=ABCDE', nanti: vi.fn(), sudah: vi.fn() });
const dialog = () => document.querySelector<HTMLElement>('#lapisan-dialog .dialog.pasang')!;
const tunggu = async () => {
  for (let i = 0; i < 5; i++) await Promise.resolve();
};

beforeEach(() => {
  document.body.innerHTML = '<div id="ui"><button id="pemicu">Pasang</button></div><div id="game"></div><div id="modal"></div><div id="lapisan-dialog"></div><div id="toast"></div>';
});
afterEach(() => {
  tutupSemuaJendela();
  vi.unstubAllGlobals();
});

describe('bukaPetunjukPasang', () => {
  it('iPhone/iPad: manfaat dulu, langkah Bagikan → Tambah ke Layar Utama → Tambah, catatan Safari', () => {
    bukaPetunjukPasang(opsi('ios'));
    const d = dialog();
    expect(d.getAttribute('role')).toBe('dialog');
    expect(d.querySelector('h2')!.textContent).toBe('Pasang ke layar utama');
    // Baris pertama sesudah judul = manfaat.
    expect(d.querySelector('.kepala-dialog')!.nextElementSibling!.textContent).toBe(MANFAAT_PASANG);
    const langkah = [...d.querySelectorAll('.langkah-pasang li')].map((l) => l.textContent!.trim());
    expect(langkah).toHaveLength(3);
    expect(langkah[0]).toContain('Bagikan');
    expect(langkah[1]).toContain('Tambah ke Layar Utama');
    expect(langkah[2]).toContain('Tambah');
    // Ikon Bagikan = SVG kecil yang mengikuti warna teks, disembunyikan dari pembaca layar.
    const svg = d.querySelector('.langkah-pasang li:first-child svg')!;
    expect(svg.getAttribute('stroke')).toBe('currentColor');
    expect(svg.getAttribute('aria-hidden')).toBe('true');
    expect(d.querySelector('.langkah-pasang b')!.textContent).toBe('Bagikan');
    expect(d.textContent).toContain('Pilihan itu nggak ada? Buka halaman ini di Safari dulu.');
    expect([...d.querySelectorAll('.kaki-dialog button')].map((b) => b.textContent)).toEqual(['Nanti saja', 'Sudah kupasang']);
    expect(d.querySelector('[data-salin]')).toBeNull();
  });

  it('Android: menu ⋮ Chrome / ≡ Samsung Internet → Instal aplikasi, catatan Chrome', () => {
    bukaPetunjukPasang(opsi('android'));
    const d = dialog();
    expect(d.textContent).toContain(MANFAAT_PASANG);
    expect(d.textContent).toContain('⋮');
    expect(d.textContent).toContain('≡');
    expect(d.textContent).toContain('Instal aplikasi');
    expect(d.textContent).toContain('Tambahkan ke layar utama');
    expect(d.textContent).toContain('Buka halaman ini di Chrome dulu.');
    expect([...d.querySelectorAll('.kaki-dialog button')].map((b) => b.textContent)).toEqual(['Nanti saja', 'Sudah kupasang']);
  });

  it('in-app: judul "Buka di browser dulu", link readonly + Salin link, tombol Nanti saja / Tutup', () => {
    bukaPetunjukPasang(opsi('inapp'));
    const d = dialog();
    expect(d.querySelector('h2')!.textContent).toBe('Buka di browser dulu');
    expect(d.textContent).toContain(MANFAAT_PASANG);
    expect(d.textContent).toContain(PETUNJUK_PASANG.inapp.penjelasan!);
    expect(d.textContent).toContain('Buka di Chrome');
    const kotak = d.querySelector<HTMLInputElement>('#link-pasang')!;
    expect(kotak.readOnly).toBe(true);
    expect(kotak.value).toBe('https://remi.contoh/?meja=ABCDE');
    expect(d.querySelector('label[for="link-pasang"]')).not.toBeNull();
    expect([...d.querySelectorAll('.kaki-dialog button')].map((b) => b.textContent)).toEqual(['Nanti saja', 'Tutup']);
    expect(d.querySelector('[data-sudah]')).toBeNull();
    // Fokus awal di aksi utamanya.
    expect(document.activeElement).toBe(d.querySelector('[data-salin]'));
  });

  it('Nanti saja / Sudah kupasang: dialog ditutup dulu, baru keputusannya dijalankan', () => {
    const o = opsi('ios');
    document.getElementById('pemicu')!.focus();
    bukaPetunjukPasang(o);
    o.nanti.mockImplementation(() => {
      expect(dialogTerbuka()).toBe(false);
      // Fokus sudah kembali ke pemicunya, jadi beranda bisa memindahkannya kalau tombolnya hilang.
      expect(document.activeElement!.id).toBe('pemicu');
    });
    dialog().querySelector<HTMLElement>('[data-nanti]')!.click();
    expect(o.nanti).toHaveBeenCalledOnce();
    expect(o.sudah).not.toHaveBeenCalled();

    const o2 = opsi('android');
    bukaPetunjukPasang(o2);
    dialog().querySelector<HTMLElement>('[data-sudah]')!.click();
    expect(o2.sudah).toHaveBeenCalledOnce();
    expect(o2.nanti).not.toHaveBeenCalled();
    expect(dialogTerbuka()).toBe(false);
  });

  it('Tutup, ✕, atau Escape menutup tanpa keputusan apa pun', () => {
    for (const cara of ['ios', 'inapp'] as const) {
      const o = opsi(cara);
      bukaPetunjukPasang(o);
      dialog().querySelector<HTMLElement>('.tutup-dialog')!.click();
      expect(dialogTerbuka()).toBe(false);
      bukaPetunjukPasang(o);
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
      expect(dialogTerbuka()).toBe(false);
      expect(o.nanti).not.toHaveBeenCalled();
      expect(o.sudah).not.toHaveBeenCalled();
    }
    const o = opsi('inapp');
    bukaPetunjukPasang(o);
    dialog().querySelector<HTMLElement>('.kaki-dialog [data-tutup]')!.click();
    expect(dialogTerbuka()).toBe(false);
    expect(o.nanti).not.toHaveBeenCalled();
  });

  it('Salin link: navigator.clipboard.writeText, lalu toast "Link-nya sudah disalin."', async () => {
    const writeText = vi.fn(() => Promise.resolve());
    vi.stubGlobal('navigator', { ...navigator, clipboard: { writeText } });
    bukaPetunjukPasang(opsi('inapp'));
    dialog().querySelector<HTMLElement>('[data-salin]')!.click();
    await tunggu();
    expect(writeText).toHaveBeenCalledWith('https://remi.contoh/?meja=ABCDE');
    expect(document.querySelector('#toast .toast')!.textContent).toBe(TEKS_TAWARAN.toastTersalin);
  });

  it('clipboard ditolak: cadangan memilih isi link (select) dan execCommand; gagal juga → toast petunjuk', async () => {
    vi.stubGlobal('navigator', { ...navigator, clipboard: { writeText: () => Promise.reject(new Error('ditolak')) } });
    const exec = vi.fn(() => true);
    (document as unknown as { execCommand: unknown }).execCommand = exec;
    bukaPetunjukPasang(opsi('inapp'));
    const kotak = dialog().querySelector<HTMLInputElement>('#link-pasang')!;
    const pilih = vi.spyOn(kotak, 'select');
    dialog().querySelector<HTMLElement>('[data-salin]')!.click();
    await tunggu();
    expect(pilih).toHaveBeenCalled();
    expect(exec).toHaveBeenCalledWith('copy');
    expect(document.querySelector('#toast .toast')!.textContent).toBe(TEKS_TAWARAN.toastTersalin);

    exec.mockReturnValue(false);
    dialog().querySelector<HTMLElement>('[data-salin]')!.click();
    await tunggu();
    const t = document.querySelector('#toast .toast.salah')!;
    expect(t.textContent).toBe(TEKS_TAWARAN.toastGagalSalin);
    delete (document as unknown as { execCommand?: unknown }).execCommand;
  });

  it('lewat lapisan dialog: modal utama (mis. popup) yang sedang terbuka tidak tertimpa', () => {
    bukaModal('<h2>Popup</h2><button type="button" data-ok>OK</button>', undefined, { bisaDitutup: false });
    bukaPetunjukPasang(opsi('android'));
    expect(document.querySelector('#modal .dialog h2')!.textContent).toBe('Popup');
    expect(dialog()).not.toBeNull();
    expect(document.getElementById('modal')!.inert).toBe(true);
  });

  it('htmlLangkah: teks di-escape, *nama tombol* ditebalkan', () => {
    expect(htmlLangkah('Ketuk *Bagikan* <script>')).toBe('Ketuk <b>Bagikan</b> &lt;script&gt;');
    for (const p of Object.values(PETUNJUK_PASANG)) for (const l of p.langkah) expect(l.teks.split('*').length % 2, l.teks).toBe(1);
  });
});
