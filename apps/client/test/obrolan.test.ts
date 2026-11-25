// @vitest-environment happy-dom
// Obrolan (0.7.0): panel "Obrolan" di lobi (isi, draf, kursor, dan gulir tetap walau lobi digambar
// ulang tiap kabar meja), simpanan Obrolan per meja, dan isi pesan yang selalu ditulis sebagai teks.

import { afterEach, describe, expect, it, vi } from 'vitest';

vi.hoisted(() => {
  Object.assign(globalThis, { __VERSI_APP__: '0.0.0', __BUILD_SHA__: 'dev', __BUILD_WAKTU__: '2026-11-25T00:00:00.000Z' });
});

import { MAKS_OBROLAN, MAKS_PESAN, PENGATURAN_BAWAAN, type InfoMeja, type PesanKlien } from '@remi/meja';
import { renderLobi } from '../src/ui/lobi';
import { Obrolan } from '../src/ui/obrolan';
import { tutupSemuaJendela } from '../src/ui/dom';

function infoLobi(kursiSaya = 1): InfoMeja {
  return {
    kode: 'OBROL',
    status: 'lobi',
    pengaturan: { ...PENGATURAN_BAWAAN, jumlahPemain: 3 },
    kursi: [
      { jenis: 'manusia', nama: 'Ani', terhubung: true, level: 'normal' },
      { jenis: 'manusia', nama: 'Budi', terhubung: true, level: 'normal' },
      { jenis: 'kosong', nama: '', terhubung: false, level: 'normal' },
    ],
    host: 0,
    kursiSaya,
    setujuAkhiri: [],
    batasWaktu: null,
    diambilAlihBot: false,
    menungguJoker: [],
    botMikir: null,
  };
}

afterEach(() => {
  tutupSemuaJendela();
  document.body.innerHTML = '';
});

function lobi(obrolan: Obrolan, info = infoLobi()) {
  const akar = document.createElement('div');
  document.body.appendChild(akar);
  const kirim = vi.fn<(p: PesanKlien) => void>();
  const gambar = (i = info) => renderLobi(akar, i, kirim, vi.fn(), { obrolan });
  gambar();
  return { akar, kirim, gambar };
}

describe('obrolan di lobi', () => {
  it('panel berjudul Obrolan dengan isian (maxlength MAKS_PESAN, enterkeyhint send) dan pesan cepat', () => {
    const { akar } = lobi(new Obrolan());
    const panel = akar.querySelector('.panel-obrolan')!;
    expect(panel.querySelector('h2')!.textContent).toBe('Obrolan');
    const isian = panel.querySelector<HTMLInputElement>('.obrolan-tulis input')!;
    expect(isian.maxLength).toBe(MAKS_PESAN);
    expect(isian.getAttribute('enterkeyhint')).toBe('send');
    expect(panel.querySelectorAll('.obrolan-cepat [data-emote]').length).toBeGreaterThan(20);
    expect(panel.querySelector('.obrolan-kosong')).not.toBeNull();
  });

  it('tanpa simpanan obrolan (pemanggil lama) panel tidak tampil', () => {
    const akar = document.createElement('div');
    document.body.appendChild(akar);
    renderLobi(akar, infoLobi(), vi.fn(), vi.fn());
    expect(akar.querySelector('.panel-obrolan')).toBeNull();
  });

  it('kirim pesan dan pesan cepat lewat emote; pesan cepat tidak menutup panel', () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    try {
      const { akar, kirim } = lobi(new Obrolan());
      const form = akar.querySelector<HTMLFormElement>('.obrolan-tulis')!;
      form.querySelector('input')!.value = ' halo   semua ';
      form.requestSubmit();
      expect(kirim).toHaveBeenLastCalledWith({ t: 'emote', isi: 'halo semua' });
      vi.advanceTimersByTime(1300);
      akar.querySelector<HTMLElement>('.obrolan-cepat [data-emote="GG"]')!.click();
      expect(kirim).toHaveBeenLastCalledWith({ t: 'emote', isi: 'GG' });
      expect(akar.querySelector('.panel-obrolan')).not.toBeNull();
    } finally {
      vi.useRealTimers();
    }
  });

  it('isi pesan dan nama selalu teks, tidak pernah HTML; pesanku ditandai dari nama', () => {
    const obrolan = new Obrolan();
    obrolan.ganti([
      { nama: 'Ani', isi: '<img src=x onerror=alert(1)>', w: 1 },
      { nama: 'budi', isi: 'iya', w: 2 },
    ]);
    const { akar } = lobi(obrolan);
    const baris = [...akar.querySelectorAll('.baris-obrolan')];
    expect(baris.map((b) => b.querySelector('.isi')!.textContent)).toEqual(['<img src=x onerror=alert(1)>', 'iya']);
    expect(akar.querySelector('.panel-obrolan img')).toBeNull();
    // Aku = Budi (kursi 1), tanpa beda huruf besar/kecil.
    expect(baris.map((b) => b.classList.contains('milikku'))).toEqual([false, true]);
  });

  it('pesan baru langsung tampil tanpa lobi digambar ulang', () => {
    const obrolan = new Obrolan();
    const { akar } = lobi(obrolan);
    obrolan.tambah({ nama: 'Ani', isi: 'siap?', w: 1, milikku: false });
    expect([...akar.querySelectorAll('.baris-obrolan .isi')].map((e) => e.textContent)).toEqual(['siap?']);
    expect(akar.querySelector('.obrolan-kosong')).toBeNull();
  });

  it('lobi digambar ulang: pesan, draf, fokus, kursor, dan posisi gulir tetap', () => {
    const obrolan = new Obrolan();
    for (let i = 0; i < 30; i++) obrolan.tambah({ nama: 'Ani', isi: `pesan ${i}`, w: i, milikku: false });
    const { akar, gambar } = lobi(obrolan);
    const isian = akar.querySelector<HTMLInputElement>('#isian-obrolan-lobi')!;
    isian.focus();
    isian.value = 'lagi ngetik';
    isian.dispatchEvent(new Event('input'));
    isian.setSelectionRange(4, 4);
    const daftar = akar.querySelector<HTMLElement>('.obrolan-daftar')!;
    // happy-dom tidak menghitung tata letak: tinggi isi dipalsukan supaya bisa digulir.
    Object.defineProperty(HTMLElement.prototype, 'scrollHeight', { configurable: true, get: () => 1000 });
    Object.defineProperty(HTMLElement.prototype, 'clientHeight', { configurable: true, get: () => 100 });
    try {
      daftar.scrollTop = 300;
      daftar.dispatchEvent(new Event('scroll'));
      expect(obrolan.gulir).toBe(300);
      // Ada yang masuk meja: lobi digambar ulang.
      const info = infoLobi();
      info.kursi[2] = { jenis: 'manusia', nama: 'Cici', terhubung: true, level: 'normal' };
      gambar(info);
      const baru = akar.querySelector<HTMLInputElement>('#isian-obrolan-lobi')!;
      expect(baru).not.toBe(isian);
      expect(baru.value).toBe('lagi ngetik');
      expect(document.activeElement).toBe(baru);
      expect(baru.selectionStart).toBe(4);
      expect(akar.querySelectorAll('.baris-obrolan')).toHaveLength(30);
      expect(akar.querySelector<HTMLElement>('.obrolan-daftar')!.scrollTop).toBe(300);
      // Pesan orang lain selagi menggulir ke atas: posisi tidak melompat.
      obrolan.tambah({ nama: 'Cici', isi: 'halo', w: 99, milikku: false });
      expect(akar.querySelector<HTMLElement>('.obrolan-daftar')!.scrollTop).toBe(300);
      // Pesan sendiri: ke bawah.
      obrolan.tambah({ nama: 'Budi', isi: 'iya', w: 100, milikku: true });
      expect(obrolan.gulir).toBeNull();
    } finally {
      delete (HTMLElement.prototype as unknown as Record<string, unknown>).scrollHeight;
      delete (HTMLElement.prototype as unknown as Record<string, unknown>).clientHeight;
    }
  });

  it('sambungan belum siap: pesan ditahan dan drafnya tetap', () => {
    const obrolan = new Obrolan();
    const akar = document.createElement('div');
    document.body.appendChild(akar);
    const kirim = vi.fn<(p: PesanKlien) => void>();
    renderLobi(akar, infoLobi(), kirim, vi.fn(), { obrolan, alasanTolak: () => 'Lagi nyambung…' });
    const form = akar.querySelector<HTMLFormElement>('.obrolan-tulis')!;
    form.querySelector('input')!.value = 'halo';
    form.requestSubmit();
    expect(kirim).not.toHaveBeenCalled();
    expect(form.querySelector('input')!.value).toBe('halo');
  });
});

describe('simpanan Obrolan', () => {
  it(`paling banyak ${MAKS_OBROLAN} baris; meja lain mulai kosong, meja yang sama tetap`, () => {
    const o = new Obrolan();
    o.pakaiMeja('AAAAA');
    for (let i = 0; i < MAKS_OBROLAN + 3; i++) o.tambah({ nama: 'A', isi: `p${i}`, w: i });
    expect(o.daftar).toHaveLength(MAKS_OBROLAN);
    expect(o.daftar[0]!.isi).toBe('p3');
    o.draf = 'draf';
    o.pakaiMeja('AAAAA');
    expect(o.daftar).toHaveLength(MAKS_OBROLAN);
    expect(o.draf).toBe('draf');
    o.pakaiMeja('BBBBB');
    expect(o.daftar).toHaveLength(0);
    expect(o.draf).toBe('');
  });
});
