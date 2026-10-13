// @vitest-environment happy-dom
// Alat bantu DOM (ui/dom.ts): escape teks, toast, dan modal.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { $, bukaModal, esc, modalTerbuka, pasangLandmarkUtama, toast, tutupModal } from '../src/ui/dom';

describe('esc', () => {
  it('meng-escape kelima karakter HTML', () => {
    expect(esc(`<a href="x">'&'</a>`)).toBe('&lt;a href=&quot;x&quot;&gt;&#39;&amp;&#39;&lt;/a&gt;');
  });

  it('null/undefined jadi string kosong, angka jadi teks', () => {
    expect(esc(null)).toBe('');
    expect(esc(undefined)).toBe('');
    expect(esc(0)).toBe('0');
    expect(esc(-25)).toBe('-25');
  });

  it('teks biasa (termasuk simbol bunga dan emoji) tidak berubah', () => {
    expect(esc('Bos Kumis 10♥ A♠ 🥇')).toBe('Bos Kumis 10♥ A♠ 🥇');
  });

  it('hasilnya aman dipasang sebagai innerHTML maupun nilai atribut', () => {
    const jahil = `"><img src=x onerror="alert(1)">`;
    const el = document.createElement('div');
    el.innerHTML = `<span title="${esc(jahil)}">${esc(jahil)}</span>`;
    expect(el.querySelector('img')).toBeNull();
    expect(el.querySelector('span')!.getAttribute('title')).toBe(jahil);
    expect(el.textContent).toBe(jahil);
  });
});

describe('toast', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    document.body.innerHTML = '<div id="toast"></div><div id="modal"></div>';
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('pesan tampil sebagai teks (bukan HTML), lalu hilang sendiri', () => {
    toast('<b>Modalnya kurang, Bos.</b>', true, 1000);
    const t = document.querySelector('#toast .toast')!;
    expect(t.textContent).toBe('<b>Modalnya kurang, Bos.</b>');
    expect(t.querySelector('b')).toBeNull();
    expect(t.classList.contains('salah')).toBe(true);
    vi.advanceTimersByTime(1000);
    expect(document.querySelector('#toast .toast')).toBeNull();
  });

  it('paling banyak 3 toast sekaligus; yang lama dibuang', () => {
    for (let i = 1; i <= 5; i++) toast(`pesan ${i}`);
    const isi = [...document.querySelectorAll('#toast .toast')].map((t) => t.textContent);
    expect(isi).toEqual(['pesan 3', 'pesan 4', 'pesan 5']);
  });

  it('tanpa wadah #toast: diam saja', () => {
    document.body.innerHTML = '';
    expect(() => toast('halo')).not.toThrow();
  });
});

describe('modal', () => {
  beforeEach(() => {
    document.body.innerHTML = '<div id="toast"></div><div id="modal"></div>';
  });

  it('bukaModal memasang dialog, data-tutup menutupnya', () => {
    const pasang = vi.fn();
    bukaModal('<p>Yakin?</p><button data-tutup>Batal</button>', pasang);
    expect(modalTerbuka()).toBe(true);
    const dialog = $('#modal .dialog');
    expect(dialog.getAttribute('role')).toBe('dialog');
    expect(dialog.getAttribute('aria-modal')).toBe('true');
    expect(pasang).toHaveBeenCalledWith(dialog);
    $('[data-tutup]', dialog).click();
    expect(modalTerbuka()).toBe(false);
  });

  it('klik latar menutup, kecuali bisaDitutup: false', () => {
    bukaModal('<p>a</p>');
    $('#modal .latar').click();
    expect(modalTerbuka()).toBe(false);

    bukaModal('<p>b</p>', undefined, { bisaDitutup: false });
    $('#modal .latar').click();
    expect(modalTerbuka()).toBe(true);
    tutupModal();
    expect(modalTerbuka()).toBe(false);
  });

  it('klik di dalam dialog tidak menutup modal', () => {
    bukaModal('<p id="isi">isi</p>');
    $('#isi').click();
    expect(modalTerbuka()).toBe(true);
  });

  it('$ melempar error yang jelas kalau elemen tidak ada', () => {
    expect(() => $('#tidak-ada')).toThrow('elemen #tidak-ada tidak ada');
  });
});

describe('pasangLandmarkUtama', () => {
  it('#game dan #ui dibungkus satu <main> (urutan & identitas elemen tetap); jendela/toast di luar', () => {
    document.body.innerHTML = '<div id="game"></div><div id="ui"><p>isi</p></div><div id="splash"></div><div id="modal"></div><div id="toast"></div>';
    const game = document.getElementById('game')!;
    const ui = document.getElementById('ui')!;
    pasangLandmarkUtama();
    const utama = document.querySelector('main')!;
    expect(utama).not.toBeNull();
    expect([...utama.children]).toEqual([game, ui]);
    expect(utama.parentElement).toBe(document.body);
    expect(document.body.firstElementChild).toBe(utama);
    expect(document.getElementById('modal')!.closest('main')).toBeNull();
    expect(document.getElementById('toast')!.closest('main')).toBeNull();
    // Dipanggil lagi (atau index.html sudah punya <main>): tidak dibungkus dua kali.
    pasangLandmarkUtama();
    expect(document.querySelectorAll('main')).toHaveLength(1);
    document.body.innerHTML = '';
  });

  it('tanpa #game/#ui (mis. halaman lain): diam saja', () => {
    document.body.innerHTML = '<div id="ui"></div>';
    expect(() => pasangLandmarkUtama()).not.toThrow();
    expect(document.querySelector('main')).toBeNull();
    document.body.innerHTML = '';
  });
});
