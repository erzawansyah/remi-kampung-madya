// @vitest-environment happy-dom
// Info Kedai Madya (konten/kedai.ts) dan tempat promosinya:
// - semua tautan https, lolos tautanAman(), dibuka di tab baru tanpa referrer & tanpa pelacakan;
// - tidak ada jam buka, telepon, harga, rating, atau jumlah buku (info yang cepat basi);
// - kartu kedai di beranda: urutan baca/fokus sesudah menu, sebelum kaki; catatan offline;
// - Tentang memuat bagian Kedai Madya + kredit logo;
// - teks tidak memakai pola promosi klise.
// Bahwa kartu kedai tidak pernah muncul di layar meja (dan ajakan hanya di klasemen akhir, bukan
// di latihan) diuji di kontrolMeja.test.ts, yang punya perlengkapan meja lengkap.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.hoisted(() => {
  Object.assign(globalThis, { __VERSI_APP__: '0.0.0', __BUILD_SHA__: 'dev', __BUILD_WAKTU__: '2026-10-12T00:00:00.000Z' });
});

import { ATRIBUT_LUAR, htmlTautanKedai, KEDAI, TAUTAN_KEDAI } from '../src/konten/kedai';
import { _setelUlangCache } from '../src/preferensi';
import { renderBeranda, type AksiBeranda } from '../src/ui/beranda';
import { tutupSemuaJendela } from '../src/ui/dom';
import { bukaTentang, tautanAman } from '../src/ui/tentang';
import { pasangMatchMediaPalsu } from './bantu';

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

/** Semua teks di data kedai (rekursif), untuk dipindai pola terlarang. */
const semuaTeks = (x: unknown): string[] =>
  typeof x === 'string' ? [x] : x && typeof x === 'object' ? Object.values(x).flatMap(semuaTeks) : [];

const POLA_TERLARANG: [string, RegExp][] = [
  ['jam buka', /\b\d{1,2}[.:]\d{2}\b|\bWIB\b|\bbuka (setiap|tiap) hari\b/i],
  ['telepon', /(\+62|\b0)8\d[\d\s-]{6,}|\bwa\.me\b|\btel:/i],
  ['harga', /\bRp\.?\s?\d|\b\d+\s?(rb|ribu|k)\b|rupiah/i],
  ['rating', /\brating\b|★|\bbintang\b|\d,\d\s?\/\s?5/i],
  ['jumlah buku', /\b\d+\s+buku\b/i],
  ['pelacakan', /utm_|fbclid|gclid|[?&]ref=/i],
];

/** Pola promosi klise (antislop). */
const POLA_KLISE = /bukan sekadar|lebih dari sekadar|bukan .* biasa|\bkami\b[^.]*,\s*bukan\b|wajib (dicoba|mampir)|surga|hidden gem|nikmati|pengalaman (tak|yang) terlupakan/i;

beforeEach(() => {
  localStorage.clear();
  localStorage.setItem('remi.preferensi', JSON.stringify({ tutorialSelesai: true }));
  _setelUlangCache();
  pasangMatchMediaPalsu(false);
  document.body.innerHTML =
    '<div id="ui"></div><div id="game"></div><div id="modal"></div><div id="lapisan-dialog"></div><div id="toast"></div>';
});
afterEach(() => {
  tutupSemuaJendela();
  vi.unstubAllGlobals();
});

describe('data kedai', () => {
  it('semua URL https, lolos tautanAman sebagai tautan luar', () => {
    const url = [KEDAI.peta, KEDAI.petaCadangan, KEDAI.instagram, KEDAI.threads, KEDAI.rakBuku.url, ...TAUTAN_KEDAI.map((t) => t.url)];
    for (const u of url) {
      expect(u.startsWith('https://')).toBe(true);
      expect(tautanAman(u)).toBe('luar');
    }
    // Peta utama = URL cid Google Maps (membuka aplikasi Maps di HP); share.google hanya cadangan.
    expect(KEDAI.peta).toBe('https://maps.google.com/?cid=9894150911920021606');
    expect(TAUTAN_KEDAI.map((t) => t.id)).toEqual(['peta', 'instagram', 'threads', 'rakBuku']);
  });

  it('tidak memuat jam buka, telepon, harga, rating, jumlah buku, atau parameter pelacakan', () => {
    const teks = [...semuaTeks(KEDAI), ...semuaTeks(TAUTAN_KEDAI), htmlTautanKedai()];
    for (const [nama, pola] of POLA_TERLARANG) {
      for (const t of teks) expect(t, `${nama}: "${t}"`).not.toMatch(pola);
    }
  });

  it('tautan dibuka di tab baru tanpa referrer; label aksesibel diawali teks yang terlihat', () => {
    expect(ATRIBUT_LUAR).toBe('target="_blank" rel="noopener noreferrer"');
    const ul = document.createElement('div');
    ul.innerHTML = htmlTautanKedai();
    const a = [...ul.querySelectorAll('a')];
    expect(a).toHaveLength(TAUTAN_KEDAI.length);
    for (const el of a) {
      expect(el.getAttribute('target')).toBe('_blank');
      expect(el.getAttribute('rel')).toBe('noopener noreferrer');
      expect(el.getAttribute('aria-label')!.startsWith(el.textContent!)).toBe(true);
    }
    expect(ul.textContent).toContain('Rak Buku Kedai Madya');
  });
});

describe('kartu kedai di beranda', () => {
  it('urutan baca/fokus: hero → main → online → menu → kartu kedai → kaki', () => {
    renderBeranda(document.getElementById('ui')!, aksiPalsu());
    const urutan = [...document.querySelectorAll('.beranda-hero, .panel-main, .panel-online, .beranda-nav, .kartu-kedai, .beranda-kaki')].map(
      (e) => e.className.split(' ').find((k) => /^(beranda-|panel-|kartu-kedai)/.test(k)),
    );
    expect(urutan).toEqual(['beranda-hero', 'panel-main', 'panel-online', 'beranda-nav', 'kartu-kedai', 'beranda-kaki']);
    // Tautan kedai dicapai Tab sesudah semua ubin menu, bukan sebelum tombol main.
    const fokus = [...document.querySelectorAll<HTMLElement>('a[href], button, input, select, summary')];
    const kedaiPertama = fokus.findIndex((e) => e.closest('.kartu-kedai'));
    expect(kedaiPertama).toBeGreaterThan(fokus.findIndex((e) => e.dataset.nav === 'tentang'));
    expect(kedaiPertama).toBeGreaterThan(fokus.findIndex((e) => e.id === 'mulai-bot'));
  });

  it('tombol pasang melayang (keputusan #46) sesudah kaki, di luar kartu kedai, tanpa teks kedai', () => {
    renderBeranda(document.getElementById('ui')!, { ...aksiPalsu(), pasangAplikasi: { melayang: true, pasang: vi.fn(), nanti: vi.fn() } });
    const m = document.querySelector<HTMLElement>('.pasang-melayang')!;
    const kaki = document.querySelector('.beranda-kaki')!;
    expect(kaki.compareDocumentPosition(m) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(m.closest('.kartu-kedai')).toBeNull();
    expect(document.querySelector('.kartu-kedai .pasang-melayang, .kartu-kedai [data-nav=pasang]')).toBeNull();
    // Urutan kartu kedai tidak berubah: tetap sesudah menu, sebelum kaki.
    const urutan = [...document.querySelectorAll('.beranda-nav, .kartu-kedai, .beranda-kaki, .pasang-melayang')].map((e) => e.className.split(' ')[0]);
    expect(urutan).toEqual(['beranda-nav', 'kartu-kedai', 'beranda-kaki', 'pasang-melayang']);
    // Tawaran pasang bukan tempat promosi kedai.
    expect(m.textContent).not.toMatch(/kedai|madya/i);
    expect(m.innerHTML).not.toMatch(/https?:/);
    expect(m.textContent).not.toMatch(POLA_KLISE);
  });

  it('isi: judul, bio, alamat singkat, empat tautan, catatan jam (tanpa angka jam)', () => {
    renderBeranda(document.getElementById('ui')!, aksiPalsu());
    const k = document.querySelector<HTMLElement>('section.kartu-kedai')!;
    expect(k.getAttribute('aria-labelledby')).toBe('judul-kedai');
    expect(k.querySelector('#judul-kedai')!.textContent).toBe('Main bareng di Kedai Madya');
    expect(k.textContent).toContain(KEDAI.bio);
    expect(k.textContent).toContain(KEDAI.alamatSingkat);
    expect(k.textContent).toContain(KEDAI.catatanJam);
    expect([...k.querySelectorAll('a')].map((a) => a.getAttribute('href'))).toEqual(TAUTAN_KEDAI.map((t) => t.url));
    for (const [nama, pola] of POLA_TERLARANG) expect(k.textContent, nama).not.toMatch(pola);
  });

  it('offline: catatan "butuh internet" muncul, dan hilang lagi saat online', () => {
    const b = renderBeranda(document.getElementById('ui')!, aksiPalsu(), { statusOnline: 'offline' });
    const catatan = document.querySelector('#kedai-offline')!;
    expect(catatan.classList.contains('tersembunyi')).toBe(false);
    expect(catatan.textContent).toBe(KEDAI.catatanOffline);
    b.aturStatusOnline('siap');
    expect(catatan.classList.contains('tersembunyi')).toBe(true);
  });

  it('hero memakai logo Kedai Madya dengan label aksesibel; istilah "bot" tidak tampil', () => {
    localStorage.setItem('remi.preferensi', JSON.stringify({ tutorialSelesai: false }));
    _setelUlangCache();
    renderBeranda(document.getElementById('ui')!, aksiPalsu());
    const logo = document.querySelector('.beranda-hero svg.logo-madya')!;
    expect(logo.getAttribute('role')).toBe('img');
    expect(logo.getAttribute('aria-label')).toBe('Kedai Madya');
    const layar = document.querySelector<HTMLElement>('.beranda')!;
    // Teks terlihat + label opsi: "warga kedai", bukan "bot" (id seperti #mulai-bot tetap).
    expect(layar.textContent).not.toMatch(/\bbot\b/i);
    expect(document.querySelector('#mulai-bot')!.textContent).toContain('Main bareng warga kedai');
    expect(layar.textContent).not.toMatch(POLA_KLISE);
  });
});

describe('Tentang', () => {
  it('bagian Kedai Madya: logo, alamat lengkap, empat tautan, kredit logo', () => {
    bukaTentang();
    const d = document.querySelector<HTMLElement>('.dialog.tentang')!;
    const kedai = d.querySelector<HTMLElement>('.tentang-kedai')!;
    expect(kedai.textContent).toContain(KEDAI.alamat);
    expect(kedai.querySelectorAll('a[target="_blank"][rel="noopener noreferrer"]')).toHaveLength(TAUTAN_KEDAI.length);
    expect(d.querySelector('.tentang-logo svg')!.getAttribute('aria-label')).toBe('Logo Kedai Madya');
    expect(d.querySelector('.tentang-kredit')!.textContent).toContain(KEDAI.kredit);
    // Aturan main datang dari teman-teman tongkrongan; pemilik kedai tidak disebut sebagai sumbernya.
    expect(d.querySelector('.tentang-kredit')!.textContent).toContain('Aturan main: teman-teman tongkrongan di Kedai Madya.');
    expect(d.querySelector('.tentang-kredit')!.textContent).not.toMatch(/pemilik Kedai Madya/i);
    for (const [nama, pola] of POLA_TERLARANG) expect(kedai.textContent, nama).not.toMatch(pola);
    // Di luar catatan perubahan (riwayat versi lama tidak ditulis ulang): istilahnya "warga kedai".
    d.querySelector('.tentang-changelog')!.remove();
    expect(d.textContent).not.toMatch(/\bbot\b/i);
    expect(d.textContent).toContain('warga kedai');
  });

  it('offline: catatan butuh internet', () => {
    vi.stubGlobal('navigator', { ...navigator, onLine: false });
    bukaTentang();
    expect(document.querySelector('.tentang-kedai')!.textContent).toContain(KEDAI.catatanOffline);
  });
});
