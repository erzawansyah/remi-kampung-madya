// @vitest-environment happy-dom
// Ikon "?" untuk penjelasan pilihan (ui/info.ts): buka/tutup gelembung, tidak mencentang kontrol
// di label yang sama, Escape/ketuk luar tidak ikut menutup jendela di bawahnya, dan gelembung
// bertahan saat layar digambar ulang dengan id yang sama.

import { afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { bukaDialog, dialogTerbuka, tutupSemuaJendela } from '../src/ui/dom';
import { htmlInfo, htmlLabelInfo, pasangInfo, tutupInfo } from '../src/ui/info';
import { teksTerlihat } from './bantu';

const gelembung = () => document.querySelector<HTMLElement>('.gelembung-info');
const tombol = (id: string) => document.querySelector<HTMLButtonElement>(`button[data-info="${id}"]`)!;
const klik = (el: Element) => el.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
const tekan = (key: string) => document.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true }));
const jeda = () => new Promise((r) => setTimeout(r, 0));

const htmlCentang = () =>
  `<label class="baris">${htmlLabelInfo('Mode kaldu', 'Pentungan dikali dua.', 'ket-x')}<input type="checkbox" id="x" aria-describedby="ket-x" /></label>`;

beforeAll(() => pasangInfo());

beforeEach(() => {
  document.body.innerHTML = '<div id="ui"></div><div id="modal"></div>';
});

afterEach(() => {
  tutupInfo();
  tutupSemuaJendela();
});

describe('htmlInfo', () => {
  it('tombol "?" berlabel + teks tersembunyi yang dirujuk aria-describedby', () => {
    document.getElementById('ui')!.innerHTML = htmlCentang();
    const b = tombol('ket-x');
    expect(b.type).toBe('button');
    expect(b.textContent).toBe('?');
    expect(b.getAttribute('aria-label')).toBe('Penjelasan Mode kaldu');
    expect(b.getAttribute('aria-expanded')).toBe('false');
    const teks = document.getElementById('ket-x')!;
    expect(teks.hidden).toBe(true);
    expect(teks.textContent).toBe('Pentungan dikali dua.');
    expect(teksTerlihat(document.querySelector('label')!)).toBe('Mode kaldu');
  });

  it('teks di-escape dan id otomatis berbeda-beda', () => {
    const a = htmlInfo('<b>x</b>', 'A');
    const b = htmlInfo('y', 'B');
    expect(a).not.toContain('<b>');
    expect(a.match(/data-info="([^"]+)"/)![1]).not.toBe(b.match(/data-info="([^"]+)"/)![1]);
  });
});

describe('pasangInfo', () => {
  it('ketuk "?" membuka gelembung; ketuk lagi menutup', () => {
    document.getElementById('ui')!.innerHTML = htmlCentang();
    klik(tombol('ket-x'));
    expect(gelembung()!.textContent).toBe('Pentungan dikali dua.');
    expect(gelembung()!.getAttribute('role')).toBe('tooltip');
    expect(tombol('ket-x').getAttribute('aria-expanded')).toBe('true');
    klik(tombol('ket-x'));
    expect(gelembung()).toBeNull();
    expect(tombol('ket-x').getAttribute('aria-expanded')).toBe('false');
  });

  it('"?" di dalam label tidak mencentang kotaknya', () => {
    document.getElementById('ui')!.innerHTML = htmlCentang();
    const centang = document.querySelector<HTMLInputElement>('#x')!;
    // Klik "?" dibatalkan bawaannya, jadi browser tidak meneruskannya ke kontrol milik label.
    // (happy-dom tidak meniru aktivasi label, jadi yang diperiksa pembatalannya.)
    expect(klik(tombol('ket-x'))).toBe(false);
    expect(centang.checked).toBe(false);
    expect(gelembung()).not.toBeNull();
    // Kontrolnya sendiri tetap bisa dicentang.
    klik(centang);
    expect(centang.checked).toBe(true);
  });

  it('ketuk di luar menutup gelembung', () => {
    document.getElementById('ui')!.innerHTML = `${htmlCentang()}<p id="lain">lain</p>`;
    klik(tombol('ket-x'));
    klik(document.getElementById('lain')!);
    expect(gelembung()).toBeNull();
  });

  it('di dalam dialog: Escape dan ketuk latar hanya menutup gelembung, dialognya tetap', () => {
    const { dialog } = bukaDialog(`<h2>Pengaturan</h2>${htmlCentang()}`);
    klik(dialog.querySelector('button[data-info]')!);
    expect(gelembung()).not.toBeNull();
    tekan('Escape');
    expect(gelembung()).toBeNull();
    expect(dialogTerbuka()).toBe(true);
    expect(document.activeElement).toBe(dialog.querySelector('button[data-info]'));

    klik(dialog.querySelector('button[data-info]')!);
    klik(dialog.parentElement!); // latar
    expect(gelembung()).toBeNull();
    expect(dialogTerbuka()).toBe(true);

    // Tanpa gelembung, Escape kembali menutup dialognya.
    tekan('Escape');
    expect(dialogTerbuka()).toBe(false);
  });

  it('layar digambar ulang dengan id yang sama: gelembung tetap, pindah ke tombol baru', async () => {
    const ui = document.getElementById('ui')!;
    ui.innerHTML = htmlCentang();
    klik(tombol('ket-x'));
    ui.innerHTML = htmlCentang();
    await jeda();
    expect(gelembung()).not.toBeNull();
    expect(tombol('ket-x').getAttribute('aria-expanded')).toBe('true');
    // Tombol baru menutupnya dengan sekali ketuk.
    klik(tombol('ket-x'));
    expect(gelembung()).toBeNull();
  });

  it('tombolnya hilang dari layar: gelembung ikut tutup', async () => {
    const ui = document.getElementById('ui')!;
    ui.innerHTML = htmlCentang();
    klik(tombol('ket-x'));
    ui.innerHTML = '<p>layar lain</p>';
    await jeda();
    expect(gelembung()).toBeNull();
  });
});
