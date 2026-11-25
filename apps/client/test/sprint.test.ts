// @vitest-environment happy-dom
// Layar Sprint (25 Nov 2026): papan dari /api/sprint (dua tab), urut ulang lewat judul kolom (aturan
// urutan dari @remi/meja), piala juara mingguan, baris sendiri disorot, keadaan kosong/offline/galat;
// ubin Sprint di beranda; bab Bantuan Sprint.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.hoisted(() => {
  Object.assign(globalThis, { __VERSI_APP__: '0.0.0', __BUILD_SHA__: 'dev', __BUILD_WAKTU__: '2026-11-25T00:00:00.000Z' });
});

import { JUMLAH_PUTARAN_SPRINT, NAMA_LAWAN_SPRINT, type BarisSprint } from '@remi/meja';
import { BAB_BANTUAN } from '../src/konten/bantuan';
import { TEKS_SPRINT, teksPiala } from '../src/konten/sprint';
import { _setelUlangCache } from '../src/preferensi';
import { renderBeranda, type AksiBeranda } from '../src/ui/beranda';
import { tutupSemuaJendela } from '../src/ui/dom';
import { htmlPapanSprint, rapikanPapanSprint, renderSprint } from '../src/ui/sprint';
import { pasangMatchMediaPalsu } from './bantu';

const BARIS: BarisSprint[] = [
  { nama: 'Ani', menang: 1, mentung: 5, kepentung: 4, skor: 900, piala: 0 },
  { nama: 'Budi', menang: 3, mentung: 1, kepentung: 2, skor: -50, piala: 2 },
  { nama: 'Cici', menang: 1, mentung: 2, kepentung: 0, skor: 300, piala: 1 },
];

const namaBaris = (akar: ParentNode) => [...akar.querySelectorAll('tbody tr')].map((tr) => tr.querySelector('.nama-teks')!.textContent);
const tunggu = async () => {
  for (let i = 0; i < 6; i++) await Promise.resolve();
};

function jawab(isi: unknown, ok = true) {
  return Promise.resolve({ ok, status: ok ? 200 : 500, json: async () => isi } as Response);
}

beforeEach(() => {
  localStorage.clear();
  localStorage.setItem('remi.preferensi', JSON.stringify({ tutorialSelesai: true }));
  localStorage.setItem('remi.nama', JSON.stringify('cici'));
  _setelUlangCache();
  pasangMatchMediaPalsu(false);
  Object.defineProperty(navigator, 'onLine', { configurable: true, get: () => true });
  document.body.innerHTML = '<div id="ui"></div><div id="modal"></div><div id="lapisan-dialog"></div><div id="toast"></div>';
});
afterEach(() => {
  tutupSemuaJendela();
  vi.unstubAllGlobals();
  document.body.innerHTML = '';
});

describe('papan sprint (htmlPapanSprint)', () => {
  it('urutan bawaan: menang, lalu skor (Ani 900 di atas Cici 300); nomor 🥇🥈🥉; piala di samping nama; baris sendiri disorot tanpa beda huruf', () => {
    const d = document.createElement('div');
    d.innerHTML = htmlPapanSprint(BARIS, null, 'CICI', 'minggu');
    expect(namaBaris(d)).toEqual(['Budi', 'Ani', 'Cici']);
    expect([...d.querySelectorAll('.nomor-sprint')].map((x) => x.textContent)).toEqual(['🥇', '🥈', '🥉']);
    const budi = d.querySelector('tbody tr')!;
    expect(budi.querySelector('.piala')!.textContent).toBe(teksPiala(2));
    expect(budi.querySelector('.piala')!.textContent).toBe('🏆2');
    expect(budi.querySelector('.piala')!.getAttribute('aria-label')).toBe('juara sprint mingguan 2 kali');
    expect(d.querySelectorAll('tbody tr')[2]!.querySelector('.piala')!.textContent).toBe('🏆');
    expect(d.querySelectorAll('tbody tr')[1]!.querySelector('.piala')).toBeNull();
    const saya = d.querySelectorAll('tbody tr.saya');
    expect(saya[0]?.textContent).toContain('Cici');
    expect(saya).toHaveLength(1);
    expect(saya[0]!.textContent).toContain(TEKS_SPRINT.lencanaKamu);
    // Skor negatif memakai minus tipografis.
    expect(budi.textContent).toContain('−50');
    // Kolom: Menang, Mentung, Kepentung, Skor (judulnya tombol), urutan bawaan = Menang menurun.
    expect([...d.querySelectorAll('thead [data-kolom]')].map((b) => b.textContent)).toEqual(['Menang', 'Mentung', 'Kepentung', 'Skor']);
    expect(d.querySelector('th[aria-sort]')!.textContent).toBe('Menang');
    expect(d.querySelector('th[aria-sort]')!.getAttribute('aria-sort')).toBe('descending');
  });

  it('urut per kolom: menurun, kecuali kepentung (paling sedikit di atas)', () => {
    const d = document.createElement('div');
    d.innerHTML = htmlPapanSprint(BARIS, 'skor', 'x', 'semua');
    expect(namaBaris(d)).toEqual(['Ani', 'Cici', 'Budi']);
    d.innerHTML = htmlPapanSprint(BARIS, 'mentung', 'x', 'semua');
    expect(namaBaris(d)).toEqual(['Ani', 'Cici', 'Budi']);
    d.innerHTML = htmlPapanSprint(BARIS, 'kepentung', 'x', 'semua');
    expect(namaBaris(d)).toEqual(['Cici', 'Budi', 'Ani']);
    expect(d.querySelector('th[aria-sort]')!.getAttribute('aria-sort')).toBe('ascending');
    expect(d.querySelector('[data-kolom="kepentung"]')!.classList.contains('aktif')).toBe(true);
  });

  it('kosong: kalimat per periode', () => {
    expect(htmlPapanSprint([], null, 'x', 'minggu')).toContain(TEKS_SPRINT.kosongMinggu);
    expect(htmlPapanSprint([], null, 'x', 'semua')).toContain(TEKS_SPRINT.kosongSemua);
  });

  it('nama dari server ditulis aman (tanpa HTML)', () => {
    const d = document.createElement('div');
    d.innerHTML = htmlPapanSprint([{ nama: '<img src=x onerror=1>', menang: 0, mentung: 0, kepentung: 0, skor: 0, piala: 0 }], null, 'x', 'semua');
    expect(d.querySelector('img')).toBeNull();
  });

  it('rapikanPapanSprint: bentuk asing ditolak, angka rusak jadi 0, baris tanpa nama dibuang', () => {
    expect(rapikanPapanSprint(null)).toBeNull();
    expect(rapikanPapanSprint({ periode: 'minggu' })).toBeNull();
    expect(rapikanPapanSprint({ periode: 'aneh', mulai: 5, baris: [{ nama: 'A', menang: 'x', piala: 1.7 }, { menang: 3 }] })).toEqual({
      periode: 'minggu',
      mulai: 5,
      baris: [{ nama: 'A', menang: 0, mentung: 0, kepentung: 0, skor: 0, piala: 1 }],
    });
  });
});

describe('layar Sprint (renderSprint)', () => {
  it('pembuka satu kalimat, Main sprint, papan minggu ini; ketuk judul kolom = urut, ketuk lagi = urutan bawaan', async () => {
    const url: string[] = [];
    vi.stubGlobal(
      'fetch',
      vi.fn((u: string) => {
        url.push(u);
        return jawab({ periode: 'minggu', mulai: 0, baris: BARIS });
      }),
    );
    const akar = document.getElementById('ui')!;
    const main = vi.fn();
    renderSprint(akar, { kembali: vi.fn(), main });
    expect(akar.querySelector('.judul p')!.textContent).toBe(TEKS_SPRINT.intro);
    expect(TEKS_SPRINT.intro).toContain(`${JUMLAH_PUTARAN_SPRINT} putaran lawan 3 warga kedai level Suhu`);
    expect(akar.querySelector('#tab-sprint-minggu')!.getAttribute('aria-selected')).toBe('true');
    await tunggu();
    expect(url).toEqual(['/api/sprint?periode=minggu']);
    expect(namaBaris(akar)).toEqual(['Budi', 'Ani', 'Cici']);
    akar.querySelector<HTMLButtonElement>('[data-kolom="skor"]')!.click();
    expect(namaBaris(akar)).toEqual(['Ani', 'Cici', 'Budi']);
    expect(document.activeElement?.getAttribute('data-kolom')).toBe('skor');
    akar.querySelector<HTMLButtonElement>('[data-kolom="skor"]')!.click();
    expect(namaBaris(akar)).toEqual(['Budi', 'Ani', 'Cici']);
    // Main sprint: aksi dipanggil sekali, tombolnya menunggu.
    const tombol = akar.querySelector<HTMLButtonElement>('#main-sprint')!;
    expect(tombol.textContent).toBe(TEKS_SPRINT.tombolMain);
    tombol.click();
    tombol.click();
    expect(main).toHaveBeenCalledTimes(1);
    expect(tombol.getAttribute('aria-busy')).toBe('true');
  });

  it('tab Sepanjang masa mengambil periode semua; urutan kolom yang dipilih tetap', async () => {
    const url: string[] = [];
    vi.stubGlobal(
      'fetch',
      vi.fn((u: string) => {
        url.push(u);
        return jawab({ periode: u.includes('semua') ? 'semua' : 'minggu', mulai: null, baris: BARIS });
      }),
    );
    const akar = document.getElementById('ui')!;
    renderSprint(akar, { kembali: vi.fn(), main: vi.fn() });
    await tunggu();
    akar.querySelector<HTMLButtonElement>('[data-kolom="kepentung"]')!.click();
    akar.querySelector<HTMLButtonElement>('#tab-sprint-semua')!.click();
    await tunggu();
    expect(url).toEqual(['/api/sprint?periode=minggu', '/api/sprint?periode=semua']);
    expect(akar.querySelector('#tab-sprint-semua')!.getAttribute('aria-selected')).toBe('true');
    expect(namaBaris(akar)).toEqual(['Cici', 'Budi', 'Ani']);
  });

  it('galat server: pesan + Coba lagi yang mengambil ulang', async () => {
    let gagal = true;
    vi.stubGlobal(
      'fetch',
      vi.fn(() => (gagal ? jawab({ error: 'x' }, false) : jawab({ periode: 'minggu', mulai: 0, baris: [] }))),
    );
    const akar = document.getElementById('ui')!;
    renderSprint(akar, { kembali: vi.fn(), main: vi.fn() });
    await tunggu();
    expect(akar.querySelector('#papan-sprint')!.textContent).toContain(TEKS_SPRINT.gagal);
    gagal = false;
    akar.querySelector<HTMLButtonElement>('[data-coba]')!.click();
    await tunggu();
    expect(akar.querySelector('#papan-sprint')!.textContent).toContain(TEKS_SPRINT.kosongMinggu);
  });

  it('offline: papan tidak diambil, Main sprint = toast', async () => {
    Object.defineProperty(navigator, 'onLine', { configurable: true, get: () => false });
    const f = vi.fn(() => jawab({}));
    vi.stubGlobal('fetch', f);
    const akar = document.getElementById('ui')!;
    const main = vi.fn();
    renderSprint(akar, { kembali: vi.fn(), main });
    await tunggu();
    expect(f).not.toHaveBeenCalled();
    expect(akar.querySelector('#papan-sprint')!.textContent).toContain(TEKS_SPRINT.offline);
    akar.querySelector<HTMLButtonElement>('#main-sprint')!.click();
    expect(main).not.toHaveBeenCalled();
    expect([...document.querySelectorAll<HTMLElement>('#toast .toast')].map((t) => t.dataset.pesan)).toContain(TEKS_SPRINT.butuhInternet);
  });

  it('Kembali memanggil aksi kembali; aturSibuk(false) membuka lagi tombol Main sprint', async () => {
    vi.stubGlobal('fetch', vi.fn(() => new Promise(() => {})));
    const akar = document.getElementById('ui')!;
    const kembali = vi.fn();
    const layar = renderSprint(akar, { kembali, main: vi.fn() });
    expect(akar.querySelector('#papan-sprint')!.textContent).toContain(TEKS_SPRINT.memuat);
    akar.querySelector<HTMLButtonElement>('#main-sprint')!.click();
    layar.aturSibuk(false);
    expect(akar.querySelector('#main-sprint')!.hasAttribute('aria-busy')).toBe(false);
    akar.querySelector<HTMLButtonElement>('#kembali')!.click();
    expect(kembali).toHaveBeenCalled();
  });
});

describe('ubin Sprint di beranda', () => {
  const aksiPalsu = (): AksiBeranda => ({
    buatMeja: vi.fn(),
    gabung: vi.fn(),
    lihatPublik: vi.fn(),
    lihatRiwayat: vi.fn(),
    lihatKompetisi: vi.fn(),
    lihatSprint: vi.fn(),
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

  it('menggantikan Kompetisi "Segera hadir"; diketuk = layar Sprint', async () => {
    const aksi = aksiPalsu();
    const b = renderBeranda(document.getElementById('ui')!, aksi);
    const tombol = document.querySelector<HTMLButtonElement>('#sprint')!;
    expect(tombol.textContent).toContain(TEKS_SPRINT.tombolBeranda);
    expect(tombol.closest('.panel-online')).not.toBeNull();
    expect(document.querySelector('#kompetisi')).toBeNull();
    expect(document.querySelector('.tombol-segera')).toBeNull();
    tombol.click();
    await tunggu();
    expect(aksi.lihatSprint).toHaveBeenCalledTimes(1);
    expect(aksi.lihatKompetisi).not.toHaveBeenCalled();
    b.lepas();
  });

  it('tanpa nama: nama dipastikan dulu (layar Sprint belum dibuka)', async () => {
    localStorage.removeItem('remi.nama');
    const aksi = aksiPalsu();
    const b = renderBeranda(document.getElementById('ui')!, aksi);
    document.querySelector<HTMLButtonElement>('#sprint')!.click();
    await tunggu();
    expect(aksi.lihatSprint).not.toHaveBeenCalled();
    b.lepas();
  });

  it('offline: tetap bisa diketuk, isinya toast "butuh internet"', async () => {
    Object.defineProperty(navigator, 'onLine', { configurable: true, get: () => false });
    const aksi = aksiPalsu();
    const b = renderBeranda(document.getElementById('ui')!, aksi, { statusOnline: 'offline' });
    const tombol = document.querySelector<HTMLButtonElement>('#sprint')!;
    expect(tombol.disabled).toBe(false);
    tombol.click();
    await tunggu();
    expect(aksi.lihatSprint).not.toHaveBeenCalled();
    expect([...document.querySelectorAll<HTMLElement>('#toast .toast')].map((t) => t.dataset.pesan)).toContain(TEKS_SPRINT.butuhInternet);
    b.lepas();
  });
});

describe('Bantuan: bab Sprint', () => {
  const bab = () => BAB_BANTUAN.find((b) => b.id === 'sprint')!;
  it('ada, sesudah Main online, dan memuat lawan, jumlah putaran, menang, keluar, papan, dan piala', () => {
    const id = BAB_BANTUAN.map((b) => b.id);
    expect(id.indexOf('sprint')).toBe(id.indexOf('online') + 1);
    const t = JSON.stringify(bab());
    for (const nama of NAMA_LAWAN_SPRINT) expect(t).toContain(nama);
    for (const x of [`${JUMLAH_PUTARAN_SPRINT} putaran`, 'level Suhu', 'Skor sama dihitung menang', 'nggak dihitung menang', TEKS_SPRINT.tabMinggu, TEKS_SPRINT.tabSemua, 'Senin pukul 00.00 WIB', '🏆', TEKS_SPRINT.sprintLagi])
      expect(t, x).toContain(x);
    expect(t).not.toMatch(/\bbot\b/i);
  });

  it('tidak ada lagi yang menyuruh ke Kompetisi', () => {
    const t = JSON.stringify(BAB_BANTUAN);
    expect(t).not.toMatch(/kompetisi/i);
  });
});
