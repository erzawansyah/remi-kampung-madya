// @vitest-environment happy-dom
// Dialog Usul fitur (keputusan pemilik 24 Okt 2026): isi dialog, pemeriksaan isian yang sama dengan
// server, offline (tulisan tetap ada), kirim ganda dicegah, pesan server tampil apa adanya, nama dari
// beranda, ubin beranda memastikan nama dulu, Tentang hanya menawarkan dari beranda, dan meja tidak
// pernah memuatnya.

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.hoisted(() => {
  Object.assign(globalThis, { __VERSI_APP__: '0.0.0', __BUILD_SHA__: 'dev', __BUILD_WAKTU__: '2026-10-24T00:00:00.000Z' });
});

import { DAFTAR_JENIS_USULAN, PESAN_USULAN } from '@remi/meja';
import { TEKS_USULAN } from '../src/konten/usulan';
import { TEKS_NAMA } from '../src/konten/nama';
import { _setelUlangCache } from '../src/preferensi';
import { renderBeranda, type AksiBeranda } from '../src/ui/beranda';
import { tutupSemuaJendela } from '../src/ui/dom';
import { bukaTentang } from '../src/ui/tentang';
import { _lupakanDrafUsulan, bukaUsulan, kirimUsulan } from '../src/ui/usulan';
import { pasangMatchMediaPalsu } from './bantu';

const tunggu = async () => {
  for (let i = 0; i < 5; i++) await new Promise((r) => setTimeout(r, 0));
};

interface Panggilan {
  url: string;
  init: RequestInit;
}

/** fetch palsu: `jawab` mengembalikan [status, isi], Error (jaringan putus), atau promise yang ditahan. */
function pasangFetch(jawab: (init: RequestInit) => [number, unknown] | Error | Promise<[number, unknown]>): Panggilan[] {
  const panggil: Panggilan[] = [];
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string, init: RequestInit) => {
      panggil.push({ url, init });
      const hasil = await jawab(init);
      if (hasil instanceof Error) throw hasil;
      const [status, data] = hasil;
      return { ok: status < 400, status, json: async () => data } as Response;
    }),
  );
  return panggil;
}

const dialog = () => document.querySelector<HTMLElement>('.dialog.usulan');
const q = <E extends HTMLElement>(sel: string) => dialog()!.querySelector<E>(sel)!;
const isi = (jenis: string, judul: string, teks: string) => {
  q<HTMLSelectElement>('#usulan-jenis').value = jenis;
  q<HTMLInputElement>('#usulan-judul').value = judul;
  const t = q<HTMLTextAreaElement>('#usulan-isi');
  t.value = teks;
  t.dispatchEvent(new Event('input', { bubbles: true }));
};
const kirim = () => q<HTMLFormElement>('.form-usulan').dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
const galat = () => q<HTMLElement>('#usulan-galat');
const toastTeks = () => [...document.querySelectorAll('#toast .toast')].map((t) => t.textContent);

const setelOnline = (online: boolean) => Object.defineProperty(navigator, 'onLine', { configurable: true, get: () => online });

beforeEach(() => {
  localStorage.clear();
  localStorage.setItem('remi.preferensi', JSON.stringify({ tutorialSelesai: true }));
  localStorage.setItem('remi.nama', JSON.stringify('Ani'));
  _setelUlangCache();
  _lupakanDrafUsulan();
  pasangMatchMediaPalsu(false);
  setelOnline(true);
  document.body.innerHTML = '<div id="ui"></div><div id="game"></div><div id="modal"></div><div id="lapisan-dialog"></div><div id="toast"></div>';
});
afterEach(() => {
  tutupSemuaJendela();
  vi.unstubAllGlobals();
});

describe('dialog Usul fitur', () => {
  it('isi dialog: pembuka, pilihan jenis, judul, isi, nama dari beranda, Kirim/Batal', () => {
    bukaUsulan();
    const d = dialog()!;
    expect(d.getAttribute('role')).toBe('dialog');
    expect(d.textContent).toContain(TEKS_USULAN.pembuka);
    expect(d.textContent).toContain('Dikirim sebagai Ani.');
    const pilihan = [...q<HTMLSelectElement>('#usulan-jenis').options].map((o) => o.value);
    expect(pilihan).toEqual(['', ...DAFTAR_JENIS_USULAN]);
    expect(q<HTMLInputElement>('#usulan-judul').maxLength).toBe(80);
    expect(q<HTMLTextAreaElement>('#usulan-isi').maxLength).toBe(1000);
    expect(q<HTMLElement>('#usulan-hitung').textContent).toBe('0/1000');
    expect(q<HTMLButtonElement>('#usulan-kirim').textContent).toBe('Kirim');
    expect(d.querySelector('[data-tutup]')).not.toBeNull();
    // Dialog lapisan (bukaDialog), bukan modal utama permainan.
    expect(document.getElementById('lapisan-dialog')!.contains(d)).toBe(true);
    expect(document.getElementById('modal')!.childElementCount).toBe(0);
  });

  it('isian salah ditolak di HP dengan pesan yang sama dengan server, tanpa memanggil server', async () => {
    const panggil = pasangFetch(() => [200, { ok: true }]);
    bukaUsulan();
    isi('', 'ab', 'Isinya sudah cukup panjang.');
    kirim();
    await tunggu();
    expect(galat().hidden).toBe(false);
    expect(galat().textContent).toBe(PESAN_USULAN.judulPendek);
    expect(q('#usulan-judul').getAttribute('aria-invalid')).toBe('true');
    expect(document.activeElement).toBe(q('#usulan-judul'));
    isi('', 'Judul oke', 'pendek');
    expect(galat().hidden).toBe(true);
    kirim();
    await tunggu();
    expect(galat().textContent).toBe(PESAN_USULAN.isiPendek);
    expect(panggil).toHaveLength(0);
  });

  it('berhasil: dikirim sekali dengan nama tersimpan, dialog tertutup, toast terima kasih, tulisan dikosongkan', async () => {
    const panggil = pasangFetch(() => [200, { ok: true }]);
    bukaUsulan();
    isi('Perbaikan bug', '  Toast nutup kartu ', 'Di HP kecil toast\nnutup kartu paling kanan.');
    expect(q<HTMLElement>('#usulan-hitung').textContent).toBe('43/1000');
    kirim();
    await tunggu();
    expect(panggil).toHaveLength(1);
    expect(panggil[0]!.url).toBe('/api/usulan');
    expect(panggil[0]!.init.method).toBe('POST');
    expect(JSON.parse(String(panggil[0]!.init.body))).toEqual({
      nama: 'Ani',
      judul: 'Toast nutup kartu',
      isi: 'Di HP kecil toast\nnutup kartu paling kanan.',
      jenis: 'Perbaikan bug',
    });
    expect(dialog()).toBeNull();
    expect(toastTeks()).toContain(TEKS_USULAN.terkirim);
    bukaUsulan();
    expect(q<HTMLInputElement>('#usulan-judul').value).toBe('');
    expect(q<HTMLTextAreaElement>('#usulan-isi').value).toBe('');
  });

  it('kirim ganda dicegah: tombol terkunci selama menunggu server', async () => {
    let lepas!: (x: [number, unknown]) => void;
    const panggil = pasangFetch(() => new Promise((ok) => (lepas = ok)));
    bukaUsulan();
    isi('Fitur', 'Mode turnamen', 'Bisa ada turnamen antar meja?');
    kirim();
    kirim();
    await tunggu();
    kirim();
    await tunggu();
    expect(panggil).toHaveLength(1);
    const tombol = q<HTMLButtonElement>('#usulan-kirim');
    expect(tombol.disabled).toBe(true);
    expect(tombol.textContent).toBe(TEKS_USULAN.mengirim);
    lepas([200, { ok: true }]);
    await tunggu();
    expect(dialog()).toBeNull();
    expect(panggil).toHaveLength(1);
  });

  it('offline: pesan ramah, tulisan tetap di isian, server tidak dipanggil', async () => {
    const panggil = pasangFetch(() => [200, { ok: true }]);
    setelOnline(false);
    bukaUsulan();
    isi('Tampilan', 'Kartu lebih besar', 'Kartu di HP kecil susah dibaca.');
    kirim();
    await tunggu();
    expect(panggil).toHaveLength(0);
    expect(galat().textContent).toBe(TEKS_USULAN.offline);
    expect(q<HTMLTextAreaElement>('#usulan-isi').value).toBe('Kartu di HP kecil susah dibaca.');
    expect(q<HTMLButtonElement>('#usulan-kirim').disabled).toBe(false);
  });

  it('jaringan putus saat mengirim: tulisan tetap ada, juga sesudah dialog ditutup lalu dibuka lagi', async () => {
    pasangFetch(() => new TypeError('Failed to fetch'));
    bukaUsulan();
    isi('Aturan main', 'Joker dua kali', 'Boleh nggak joker dibuang dua kali?');
    kirim();
    await tunggu();
    expect(galat().textContent).toBe(TEKS_USULAN.gagalJaringan);
    expect(q<HTMLButtonElement>('#usulan-kirim').disabled).toBe(false);
    tutupSemuaJendela();
    bukaUsulan();
    expect(q<HTMLSelectElement>('#usulan-jenis').value).toBe('Aturan main');
    expect(q<HTMLInputElement>('#usulan-judul').value).toBe('Joker dua kali');
    expect(q<HTMLTextAreaElement>('#usulan-isi').value).toBe('Boleh nggak joker dibuang dua kali?');
  });

  it('penolakan server ditampilkan apa adanya', async () => {
    const pesan = 'Dari jaringanmu sudah masuk 5 usulan dalam sejam. Coba lagi nanti, Bos.';
    pasangFetch(() => [429, { error: pesan }]);
    bukaUsulan();
    isi('', 'Mode turnamen', 'Bisa ada turnamen antar meja?');
    kirim();
    await tunggu();
    expect(galat().textContent).toBe(pesan);
    expect(dialog()).not.toBeNull();
  });

  it('kirimUsulan: jawaban bukan JSON atau tanpa pesan = pesan umum', async () => {
    const tanpaJson = (async () => ({ ok: false, status: 502, json: async () => Promise.reject(new Error('html')) })) as unknown as typeof fetch;
    expect(await kirimUsulan({}, tanpaJson)).toEqual({ ok: false, pesan: TEKS_USULAN.gagalLain });
    const okTanpaTanda = (async () => ({ ok: true, status: 200, json: async () => ({}) })) as unknown as typeof fetch;
    expect(await kirimUsulan({}, okTanpaTanda)).toEqual({ ok: false, pesan: TEKS_USULAN.gagalLain });
  });

  it('belum ada nama tersimpan: diminta isi nama di beranda dulu, tanpa formulir', () => {
    localStorage.removeItem('remi.nama');
    bukaUsulan();
    expect(dialog()!.textContent).toContain(TEKS_USULAN.belumAdaNama);
    expect(dialog()!.querySelector('form')).toBeNull();
  });
});

const aksiPalsu = (): AksiBeranda => ({
  buatMeja: vi.fn(),
  gabung: vi.fn(),
  lihatPublik: vi.fn(),
  lihatRiwayat: vi.fn(),
  lihatKompetisi: vi.fn(),
  mainOffline: vi.fn(),
  lanjutOffline: vi.fn(),
  latihan: vi.fn(),
  bantuan: vi.fn(),
  pengaturan: vi.fn(),
  tentang: vi.fn(),
  usulFitur: vi.fn(),
  pasangAplikasi: null,
  muatUlang: null,
});

describe('jalan masuk Usul fitur', () => {
  it('ubin "💡 Usul fitur" di menu beranda memastikan nama dulu (#49)', async () => {
    localStorage.removeItem('remi.nama');
    const aksi = aksiPalsu();
    renderBeranda(document.getElementById('ui')!, aksi);
    const ubin = document.querySelector<HTMLElement>('.beranda-nav [data-nav=usulan]')!;
    expect(ubin.textContent).toContain('Usul fitur');
    ubin.click();
    await tunggu();
    expect(aksi.usulFitur).not.toHaveBeenCalled();
    expect(toastTeks()).toContain(TEKS_NAMA.isiDulu);
    document.querySelector<HTMLInputElement>('#nama')!.value = 'Budi';
    ubin.click();
    await tunggu();
    expect(aksi.usulFitur).toHaveBeenCalledTimes(1);
    expect(JSON.parse(localStorage.getItem('remi.nama')!)).toBe('Budi');
  });

  it('Tentang menawarkan Usul fitur hanya kalau diminta (dari beranda), bukan dari menu meja', () => {
    bukaTentang();
    expect(document.querySelector('.dialog.tentang [data-usulan]')).toBeNull();
    tutupSemuaJendela();
    const usulFitur = vi.fn();
    bukaTentang({ usulFitur });
    const tombol = document.querySelector<HTMLElement>('.dialog.tentang [data-usulan]')!;
    expect(tombol.textContent).toContain('Usul fitur');
    tombol.click();
    expect(usulFitur).toHaveBeenCalledTimes(1);
  });

  it('meja (kontrolMeja, menu ☰) tidak memuat Usul fitur; main.ts hanya memasangnya di beranda', () => {
    // join + fileURLToPath: di happy-dom, URL global bukan milik Node sehingga ditolak readFileSync.
    const src = join(dirname(fileURLToPath(import.meta.url)), '../src');
    const kontrol = readFileSync(join(src, 'kontrolMeja.ts'), 'utf8');
    expect(kontrol).not.toMatch(/usulan|usul fitur|usulFitur/i);
    const main = readFileSync(join(src, 'main.ts'), 'utf8');
    const pemakai = main.split('\n').filter((b) => /bukaUsulan|usulFitur/.test(b) && !/^\s*(import|\/\/)/.test(b));
    expect(pemakai.map((b) => b.trim())).toEqual([
      'tentang: () => bukaTentang({ usulFitur: () => bukaUsulan() }),',
      'usulFitur: () => bukaUsulan(),',
    ]);
  });
});
