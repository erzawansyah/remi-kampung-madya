// @vitest-environment happy-dom
// Ledekan di hasil putaran meja online (keputusan pemilik, 24 Okt 2026), bagian murni dan
// LedekBesar: sasaran bawaan, HTML bagian "Ledek" (isi dari daftar, di-escape), ledekan besar untukku
// (antri, ketuk untuk menutup, tutup sendiri, menunggu animasi meja, textContent saja, pembaca layar).

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { DAFTAR_EMOTE, DAFTAR_LEDEKAN } from '@remi/meja';

vi.mock('../src/efek/suara', () => ({ bunyi: vi.fn(), getar: vi.fn() }));
vi.mock('../src/ui/dom', async (asli) => ({ ...(await asli<typeof import('../src/ui/dom')>()), umumkan: vi.fn() }));

import { bunyi } from '../src/efek/suara';
import { umumkan } from '../src/ui/dom';
import {
  apaEmoji,
  hapusLapisanLedek,
  htmlBarisLedek,
  htmlIsiLembarLedek,
  htmlLembarLedek,
  ISI_LEDEK,
  LAMA_LEDEK_MS,
  LedekBesar,
  MAKS_ANTRIAN_LEDEK,
  rapikanBarisLedek,
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

const wadah = (html: string) => {
  const el = document.createElement('div');
  el.innerHTML = html;
  return el;
};

describe('htmlBarisLedek (baris kecil di kaki modal hasil)', () => {
  it('kosong kalau tidak ada manusia lain', () => {
    expect(htmlBarisLedek({ calon: [], habis: false })).toBe('');
    expect(htmlBarisLedek({ calon: [], habis: true })).toBe('');
  });

  it('label "Ledek" lalu satu chip per orang; chip turun baris (bukan digeser ke samping)', () => {
    const el = wadah(htmlBarisLedek({ calon: [{ kursi: 1, nama: 'Budi' }, { kursi: 3, nama: 'Ning Kukis' }], habis: false }));
    const baris = el.querySelector<HTMLElement>('.baris-ledek')!;
    expect(baris.querySelector('.label-ledek')!.textContent).toBe(TEKS_LEDEK.judul);
    const chip = [...baris.querySelectorAll<HTMLButtonElement>('[data-ledek-buka]')];
    expect(chip.map((b) => [b.dataset.ledekBuka, b.querySelector('.nama-ledek')!.textContent, b.getAttribute('aria-label')])).toEqual([
      ['1', 'Budi', 'Ledek Budi'],
      ['3', 'Ning Kukis', 'Ledek Ning Kukis'],
    ]);
    expect(chip.every((b) => b.classList.contains('chip-ledek') && b.querySelector('.ikon-ledek')!.textContent === TEKS_LEDEK.ikon)).toBe(true);
    // "+N" hanya muncul kalau nama tidak muat dua baris (rapikanBarisLedek).
    expect(baris.querySelector<HTMLElement>('[data-ledek-lebih]')!.hidden).toBe(true);
    // Tidak ada isi ledekan di baris ini: dipilih di lembar.
    expect(baris.querySelector('[data-ledek-isi]')).toBeNull();
  });

  it('CSS baris: flex-wrap, tanpa gulir ke samping; nama panjang dipotong elipsis', () => {
    const css = readFileSync(join(dirname(fileURLToPath(import.meta.url)), '../src/gaya/meja.css'), 'utf8');
    const aturan = (sel: string) => css.match(new RegExp(`\\n${sel.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')} \\{([^}]*)\\}`))?.[1] ?? '';
    expect(aturan('.baris-ledek')).toContain('flex-wrap: wrap');
    expect(aturan('.baris-ledek')).not.toMatch(/overflow-x/);
    expect(aturan('.chip-ledek .nama-ledek')).toContain('text-overflow: ellipsis');
  });

  it('jatah habis: catatan, tanpa chip', () => {
    const el = wadah(htmlBarisLedek({ calon: [{ kursi: 1, nama: 'Budi' }], habis: true }));
    expect(el.querySelector('[data-ledek-buka]')).toBeNull();
    expect(el.textContent).toContain(TEKS_LEDEK.habis);
  });

  it('nama di-escape (bukan HTML)', () => {
    const jahat = '<img src=x onerror=alert(1)>';
    const el = wadah(htmlBarisLedek({ calon: [{ kursi: 1, nama: jahat }], habis: false }));
    expect(el.querySelector('img')).toBeNull();
    expect(el.querySelector('.nama-ledek')!.textContent).toBe(jahat);
  });

  it('rapikanBarisLedek: nama yang tidak muat dua baris diganti "+N"', () => {
    const el = wadah(
      htmlBarisLedek({ calon: [1, 2, 3, 4, 5].map((k) => ({ kursi: k, nama: `Pemain ${k}` })), habis: false }),
    );
    document.body.appendChild(el);
    // Tata letak palsu: dua butir (label, chip, "+N") per baris.
    const anak = () => [...el.querySelector('.baris-ledek')!.children].filter((c) => !(c as HTMLElement).hidden) as HTMLElement[];
    // Label lebih pendek dan di tengah baris (align-items: center): top-nya beda dari chip sebaris.
    const asliTop = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'offsetTop')!;
    const asliTinggi = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'offsetHeight')!;
    const label = (x: HTMLElement) => x.classList.contains('label-ledek');
    Object.defineProperty(HTMLElement.prototype, 'offsetTop', {
      configurable: true,
      get(this: HTMLElement) {
        const i = anak().indexOf(this);
        return i < 0 ? 0 : Math.floor(i / 2) * 50 + (label(this) ? 12 : 0);
      },
    });
    Object.defineProperty(HTMLElement.prototype, 'offsetHeight', {
      configurable: true,
      get(this: HTMLElement) {
        return label(this) ? 20 : 44;
      },
    });
    try {
      rapikanBarisLedek(el);
    } finally {
      Object.defineProperty(HTMLElement.prototype, 'offsetTop', asliTop);
      Object.defineProperty(HTMLElement.prototype, 'offsetHeight', asliTinggi);
      el.remove();
    }
    const tampil = [...el.querySelectorAll<HTMLElement>('[data-ledek-buka]')].filter((c) => !c.hidden).map((c) => c.dataset.ledekBuka);
    const lebih = el.querySelector<HTMLElement>('[data-ledek-lebih]')!;
    expect(lebih.hidden).toBe(false);
    expect(tampil.length + Number(lebih.textContent!.slice(1))).toBe(5);
    // Label + 2 nama + "+3" = dua baris.
    expect(tampil).toEqual(['1', '2']);
    expect(lebih.textContent).toBe('+3');
    // Nama yang terbaca memuat teks yang terlihat (WCAG 2.5.3).
    expect(lebih.getAttribute('aria-label')).toBe(`+3 ${TEKS_LEDEK.lainnya}`);
  });
});

describe('lembar Ledek', () => {
  const calon = [
    { kursi: 1, nama: 'Budi' },
    { kursi: 2, nama: 'Citra' },
  ];

  it('judul "Ledek <nama>", tombol tutup, baris status hanya visual (kiriman diumumkan lewat umumkan)', () => {
    const el = wadah(htmlLembarLedek('<b>Budi</b>', ''));
    expect(el.querySelector('[data-judul-ledek]')!.textContent).toBe('Ledek <b>Budi</b>');
    expect(el.querySelector('b')).toBeNull();
    expect(el.querySelector('[data-tutup]')!.getAttribute('aria-label')).toBe(TEKS_LEDEK.tutup);
    expect(el.querySelector('[data-status-ledek]')!.getAttribute('aria-hidden')).toBe('true');
    expect(el.querySelector('[data-status-ledek]')!.hasAttribute('aria-live')).toBe(false);
    // Judul dan status di luar wadah isi yang digulir, jadi tetap terlihat.
    expect(el.querySelector('[data-lembar-isi] [data-status-ledek], [data-lembar-isi] [data-judul-ledek]')).toBeNull();
  });

  it('2+ orang: pilihan sasaran aria-pressed; ledekan dulu lalu semua emoji; tidak ada teks bebas', () => {
    const el = wadah(htmlIsiLembarLedek({ calon, sasaran: 2, habis: false, jeda: false, baruDikirim: null }));
    const ke = [...el.querySelectorAll<HTMLButtonElement>('[data-ledek-ke]')];
    // Pilihan sasaran berbentuk segmen, beda dari tombol ledekan.
    expect(el.querySelector('.ledek-sasaran')!.classList.contains('segmen')).toBe(true);
    expect(ke.map((b) => [b.textContent, b.getAttribute('aria-pressed')])).toEqual([
      ['Budi', 'false'],
      ['Citra', 'true'],
    ]);
    const isi = [...el.querySelectorAll<HTMLButtonElement>('[data-ledek-isi]')].map((b) => b.dataset.ledekIsi!);
    expect(isi).toEqual([...ISI_LEDEK]);
    expect(isi.slice(0, DAFTAR_LEDEKAN.length)).toEqual([...DAFTAR_LEDEKAN]);
    expect(isi.slice(DAFTAR_LEDEKAN.length)).toEqual(DAFTAR_EMOTE.filter(apaEmoji));
    expect(el.querySelectorAll('.ledek-kata button')).toHaveLength(DAFTAR_LEDEKAN.length);
    expect(el.querySelector('input, textarea')).toBeNull();
    expect(el.querySelector('[aria-disabled]')).toBeNull();
  });

  it('satu orang: tanpa pilihan sasaran', () => {
    const el = wadah(htmlIsiLembarLedek({ calon: [calon[0]], sasaran: 1, habis: false, jeda: false, baruDikirim: null }));
    expect(el.querySelector('[data-ledek-ke]')).toBeNull();
    expect(el.querySelector('[data-ledek-isi]')).not.toBeNull();
  });

  it('jeda: semua tombol isi dikunci, yang baru terkirim diberi tanda; habis: catatan tanpa tombol isi', () => {
    const el = wadah(htmlIsiLembarLedek({ calon, sasaran: 1, habis: false, jeda: true, baruDikirim: 'Rasain!' }));
    const isi = [...el.querySelectorAll('[data-ledek-isi]')];
    expect(isi.every((b) => b.getAttribute('aria-disabled') === 'true')).toBe(true);
    expect([...el.querySelectorAll('.terkirim')].map((b) => b.getAttribute('data-ledek-isi'))).toEqual(['Rasain!']);
    const habis = wadah(htmlIsiLembarLedek({ calon, sasaran: 1, habis: true, jeda: false, baruDikirim: null }));
    expect(habis.querySelector('[data-ledek-isi]')).toBeNull();
    expect(habis.textContent).toContain(TEKS_LEDEK.habis);
  });

  it('nama sasaran di-escape', () => {
    const jahat = '<img src=x onerror=alert(1)>';
    const el = wadah(htmlIsiLembarLedek({ calon: [{ kursi: 1, nama: jahat }, calon[1]], sasaran: 1, habis: false, jeda: false, baruDikirim: null }));
    expect(el.querySelector('img')).toBeNull();
    expect(el.querySelector('[data-ledek-ke="1"]')!.textContent).toBe(jahat);
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
    expect(el.querySelector('.ledek-dari')!.textContent).toBe(`AAni ${TEKS_LEDEK.ngeledekKamu}`);
    expect(el.querySelector('.ledek-dari b')!.textContent).toBe('Ani');
    // Tanpa petunjuk "ketuk di mana saja", dan tanpa Bales kalau tidak diminta.
    expect(el.querySelector('.bales-ledek')).toBeNull();
    expect(el.querySelector('.ledek-isi')!.textContent).toBe('<b>Rasain!</b>');
    expect(el.querySelector('.ledek-isi b')).toBeNull();
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

  it('tahan (hasil putaran belum tampil, panel mentung terbuka): menunggu tanpa batas waktu', () => {
    vi.useFakeTimers();
    let tahan = true;
    let sibuk = true;
    const l = new LedekBesar(() => sibuk, () => tahan);
    l.tambah('Ani', 'Rasain!', 'x');
    vi.advanceTimersByTime(60_000);
    expect(tampil()).toBeNull();
    expect(l.jumlahAntri).toBe(1);
    // Tahanan lepas tapi animasi masih jalan: batas tunggu animasi baru dihitung dari sekarang.
    tahan = false;
    vi.advanceTimersByTime(4_000);
    expect(tampil()).toBeNull();
    sibuk = false;
    vi.advanceTimersByTime(400);
    expect(tampil()!.querySelector('.ledek-isi')!.textContent).toBe('Rasain!');
    l.tutup();
    // Animasi macet sesudah tahanan lepas: tetap tampil sesudah batas tunggunya.
    tahan = true;
    sibuk = true;
    l.tambah('Ani', 'Kok bisa, Bos?', 'y');
    vi.advanceTimersByTime(30_000);
    tahan = false;
    vi.advanceTimersByTime(5_000);
    expect(tampil()).toBeNull();
    vi.advanceTimersByTime(1_500);
    expect(tampil()!.querySelector('.ledek-isi')!.textContent).toBe('Kok bisa, Bos?');
    l.hancurkan();
  });

  it('kosongkan (hasil putaran ditinggalkan): yang tampil dan antriannya dibuang, ledekan baru tetap bisa tampil', () => {
    vi.useFakeTimers();
    let sibuk = false;
    const l = new LedekBesar(() => sibuk);
    l.tambah('Ani', 'a', 'a');
    l.tambah('Ani', 'b', 'b');
    l.tambah('Ani', 'c', 'c');
    l.kosongkan();
    expect(tampil()).toBeNull();
    expect(l.jumlahAntri).toBe(0);
    vi.advanceTimersByTime(10_000);
    expect(tampil()).toBeNull();
    // Timer cek "sibuk" yang sedang menunggu juga dibatalkan.
    sibuk = true;
    l.tambah('Ani', 'd', 'd');
    l.kosongkan();
    sibuk = false;
    vi.advanceTimersByTime(10_000);
    expect(tampil()).toBeNull();
    // Belum dihancurkan: hasil putaran berikutnya tetap bisa menampilkan ledekan.
    l.tambah('Ani', 'e', 'e');
    expect(tampil()!.querySelector('.ledek-isi')!.textContent).toBe('e');
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

  it('Bales: hanya kalau pengirimnya masih bisa diledek; ketuk = buka lembar dulu lalu tutup, tidak ikut menutup berikutnya', () => {
    vi.useFakeTimers();
    let bisa = true;
    let lembarTerbuka = false;
    const buka = vi.fn(() => (lembarTerbuka = true));
    const l = new LedekBesar(undefined, () => lembarTerbuka, { bisa: () => bisa, buka });
    l.tambah('<i>Budi</i>', 'Rasain!', 'x', 1);
    l.tambah('Budi', 'Makan tuh!', 'y', 1);
    const b = tampil()!.querySelector<HTMLButtonElement>('.bales-ledek')!;
    expect(b.textContent).toBe(`${TEKS_LEDEK.bales} <i>Budi</i>`);
    expect(b.querySelector('i')).toBeNull();
    b.click();
    expect(buka).toHaveBeenCalledWith(1);
    // Lembar balasan terbuka: ledekan berikutnya menunggu, tidak muncul menutupi lembar.
    expect(tampil()).toBeNull();
    expect(l.jumlahAntri).toBe(1);
    // Lembar ditutup: ledekan berikutnya tampil (dan TIDAK ikut tertutup oleh ketukan tadi).
    lembarTerbuka = false;
    vi.advanceTimersByTime(500);
    expect(tampil()!.querySelector('.ledek-isi')!.textContent).toBe('Makan tuh!');
    l.tutup();
    // Pengirim sudah tidak bisa diledek (putus, modal hasil tertutup): tanpa Bales.
    bisa = false;
    l.tambah('Budi', 'Rasain!', 'z', 1);
    expect(tampil()!.querySelector('.bales-ledek')).toBeNull();
    l.tutup();
    // Tanpa kursi pengirim: tanpa Bales.
    bisa = true;
    l.tambah('Budi', 'Rasain!', 'z');
    expect(tampil()!.querySelector('.bales-ledek')).toBeNull();
    l.hancurkan();
  });
});
