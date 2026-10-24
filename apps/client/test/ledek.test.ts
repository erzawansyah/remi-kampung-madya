// @vitest-environment happy-dom
// Ledekan di hasil putaran meja online (keputusan pemilik, 24 Okt 2026), bagian murni dan
// LedekBesar: sasaran bawaan, HTML bagian "Ledek" (isi dari daftar, di-escape), ledekan besar untukku
// (antri, ketuk untuk menutup, tutup sendiri, menunggu animasi meja, textContent saja, pembaca layar).

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DAFTAR_EMOTE, DAFTAR_LEDEKAN } from '@remi/meja';

vi.mock('../src/efek/suara', () => ({ bunyi: vi.fn(), getar: vi.fn() }));
vi.mock('../src/ui/dom', async (asli) => ({ ...(await asli<typeof import('../src/ui/dom')>()), umumkan: vi.fn() }));

import { bunyi } from '../src/efek/suara';
import { umumkan } from '../src/ui/dom';
import {
  apaEmoji,
  hapusLapisanLedek,
  htmlLedek,
  ISI_LEDEK,
  LAMA_LEDEK_MS,
  LedekBesar,
  MAKS_ANTRIAN_LEDEK,
  sasaranLedekBawaan,
} from '../src/ui/ledek';
import { TEKS_LEDEK } from '../src/konten/ledek';

beforeEach(() => {
  vi.mocked(bunyi).mockClear();
  vi.mocked(umumkan).mockClear();
});
afterEach(() => {
  vi.useRealTimers();
  hapusLapisanLedek();
});

describe('sasaranLedekBawaan', () => {
  it('aku tidak kepentung: yang kepentung (manusia) lebih dulu', () => {
    expect(sasaranLedekBawaan({ pementung: 0, kepentung: [2, 1] }, 0, [1, 2])).toBe(2);
    // Penonton (bukan yang mentung) juga mengarah ke yang kepentung.
    expect(sasaranLedekBawaan({ pementung: 2, kepentung: [1] }, 0, [1, 2])).toBe(1);
  });

  it('aku kepentung: membalas yang mentung', () => {
    expect(sasaranLedekBawaan({ pementung: 2, kepentung: [0, 1] }, 0, [1, 2])).toBe(2);
  });

  it('tidak ada yang kepentung, atau yang cocok warga kedai: orang pertama', () => {
    expect(sasaranLedekBawaan({ pementung: null, kepentung: [] }, 0, [2, 3])).toBe(2);
    // Yang kepentung warga kedai (bukan calon).
    expect(sasaranLedekBawaan({ pementung: 0, kepentung: [3] }, 0, [1])).toBe(1);
    // Aku kepentung oleh warga kedai.
    expect(sasaranLedekBawaan({ pementung: 3, kepentung: [0] }, 0, [1])).toBe(1);
    expect(sasaranLedekBawaan({ pementung: 3, kepentung: [0] }, 0, [])).toBeNull();
  });
});

describe('htmlLedek', () => {
  const wadah = (html: string) => {
    const el = document.createElement('div');
    el.innerHTML = html;
    return el;
  };

  it('kosong kalau tidak ada manusia lain', () => {
    expect(htmlLedek({ calon: [], sasaran: null, habis: false, jeda: false })).toBe('');
  });

  it('sasaran terpilih aria-pressed; ledekan dulu lalu emoji; tidak ada teks bebas', () => {
    const el = wadah(htmlLedek({ calon: [{ kursi: 1, nama: 'Budi' }, { kursi: 2, nama: 'Citra' }], sasaran: 2, habis: false, jeda: false }));
    const ke = [...el.querySelectorAll<HTMLButtonElement>('[data-ledek-ke]')];
    expect(ke.map((b) => [b.textContent, b.getAttribute('aria-pressed')])).toEqual([
      ['Budi', 'false'],
      ['Citra', 'true'],
    ]);
    const isi = [...el.querySelectorAll<HTMLButtonElement>('[data-ledek-isi]')].map((b) => b.dataset.ledekIsi!);
    expect(isi).toEqual([...ISI_LEDEK]);
    expect(isi.slice(0, DAFTAR_LEDEKAN.length)).toEqual([...DAFTAR_LEDEKAN]);
    expect(isi.slice(DAFTAR_LEDEKAN.length).every(apaEmoji)).toBe(true);
    for (const x of isi) expect([...DAFTAR_LEDEKAN, ...DAFTAR_EMOTE] as string[]).toContain(x);
    expect(el.querySelector('input, textarea')).toBeNull();
    expect(el.querySelector('[aria-disabled]')).toBeNull();
  });

  it('nama di-escape (bukan HTML); jeda mengunci tombol isi; habis menyembunyikannya', () => {
    const jahat = '<img src=x onerror=alert(1)>';
    const el = wadah(htmlLedek({ calon: [{ kursi: 1, nama: jahat }], sasaran: 1, habis: false, jeda: true }));
    expect(el.querySelector('img')).toBeNull();
    expect(el.querySelector('[data-ledek-ke="1"]')!.textContent).toBe(jahat);
    const isi = [...el.querySelectorAll('[data-ledek-isi]')];
    expect(isi.length).toBeGreaterThan(0);
    expect(isi.every((b) => b.getAttribute('aria-disabled') === 'true')).toBe(true);
    const habis = wadah(htmlLedek({ calon: [{ kursi: 1, nama: 'Budi' }], sasaran: 1, habis: true, jeda: false }));
    expect(habis.querySelector('[data-ledek-isi]')).toBeNull();
    expect(habis.textContent).toContain(TEKS_LEDEK.habis);
  });
});

describe('LedekBesar (ledekan untukku)', () => {
  const lapisan = () => document.getElementById('lapisan-ledek');
  const tampil = () => lapisan()?.querySelector<HTMLElement>('.ledek-besar') ?? null;

  it('tampil besar di lapisan di atas modal, textContent saja, bunyi dan pembaca layar', () => {
    vi.useFakeTimers();
    const l = new LedekBesar();
    l.tambah('Ani', '<b>Rasain!</b>', 'Ani ngeledek kamu: Rasain!');
    const el = tampil()!;
    expect(el).not.toBeNull();
    expect(el.getAttribute('aria-hidden')).toBe('true');
    expect(el.querySelector('.ledek-dari')!.textContent).toBe(`Ani ${TEKS_LEDEK.ngeledekKamu}`);
    expect(el.querySelector('.ledek-isi')!.textContent).toBe('<b>Rasain!</b>');
    expect(el.querySelector('b')).toBeNull();
    expect(bunyi).toHaveBeenCalledWith('notifikasi');
    expect(umumkan).toHaveBeenCalledWith('Ani ngeledek kamu: Rasain!');
    // Lapisannya anak <body>, bukan #ui/#modal (yang dibuat inert selama ada jendela).
    expect(lapisan()!.parentElement).toBe(document.body);
    l.hancurkan();
  });

  it('emoji tampil lebih besar (kelas emoji)', () => {
    const l = new LedekBesar();
    l.tambah('Ani', '😂', 'x');
    expect(tampil()!.querySelector('.ledek-isi')!.classList.contains('emoji')).toBe(true);
    l.hancurkan();
  });

  it('antri: satu per satu; ketuk menutup dan memunculkan berikutnya; tutup sendiri sesudah LAMA_LEDEK_MS', () => {
    vi.useFakeTimers();
    const l = new LedekBesar();
    l.tambah('Ani', 'Makan tuh!', 'a');
    l.tambah('Citra', 'Kasihan deh.', 'b');
    l.tambah('Ani', '🤡', 'c');
    expect(lapisan()!.querySelectorAll('.ledek-besar')).toHaveLength(1);
    expect(tampil()!.querySelector('.ledek-isi')!.textContent).toBe('Makan tuh!');
    expect(l.jumlahAntri).toBe(2);
    tampil()!.click();
    expect(tampil()!.querySelector('.ledek-isi')!.textContent).toBe('Kasihan deh.');
    expect(umumkan).toHaveBeenLastCalledWith('b');
    vi.advanceTimersByTime(LAMA_LEDEK_MS - 1);
    expect(tampil()!.querySelector('.ledek-isi')!.textContent).toBe('Kasihan deh.');
    vi.advanceTimersByTime(1);
    expect(tampil()!.querySelector('.ledek-isi')!.textContent).toBe('🤡');
    vi.advanceTimersByTime(LAMA_LEDEK_MS);
    expect(tampil()).toBeNull();
    l.hancurkan();
  });

  it('antrian dibatasi: yang paling lama dibuang', () => {
    const l = new LedekBesar();
    for (let i = 0; i < MAKS_ANTRIAN_LEDEK + 4; i++) l.tambah('Ani', `ke-${i}`, `ke-${i}`);
    expect(l.jumlahAntri).toBe(MAKS_ANTRIAN_LEDEK);
    l.hancurkan();
  });

  it('menunggu animasi meja selesai (sibuk), paling lama beberapa detik', () => {
    vi.useFakeTimers();
    let sibuk = true;
    const l = new LedekBesar(() => sibuk);
    l.tambah('Ani', 'Rasain!', 'x');
    expect(tampil()).toBeNull();
    vi.advanceTimersByTime(1000);
    expect(tampil()).toBeNull();
    sibuk = false;
    vi.advanceTimersByTime(400);
    expect(tampil()).not.toBeNull();
    l.tutup();
    // Animasi tidak selesai-selesai: tetap tampil sesudah batas tunggu.
    sibuk = true;
    l.tambah('Ani', 'Kok bisa, Bos?', 'y');
    vi.advanceTimersByTime(5000);
    expect(tampil()).toBeNull();
    vi.advanceTimersByTime(1500);
    expect(tampil()!.querySelector('.ledek-isi')!.textContent).toBe('Kok bisa, Bos?');
    l.hancurkan();
  });

  it('hancurkan: ledekan yang tampil dan antriannya dibuang, tidak ada yang muncul lagi', () => {
    vi.useFakeTimers();
    const l = new LedekBesar();
    l.tambah('Ani', 'a', 'a');
    l.tambah('Ani', 'b', 'b');
    l.hancurkan();
    expect(tampil()).toBeNull();
    vi.advanceTimersByTime(10_000);
    l.tambah('Ani', 'c', 'c');
    expect(tampil()).toBeNull();
  });
});
