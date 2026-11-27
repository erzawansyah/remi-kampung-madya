// @vitest-environment happy-dom
// Layar Sprint (25 Nov 2026): papan dari /api/sprint (dua tab), urut ulang lewat judul kolom (aturan
// urutan dari @remi/meja), piala juara mingguan, baris sendiri disorot, keadaan kosong/offline/galat;
// ubin Sprint di beranda; bab Bantuan Sprint.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.hoisted(() => {
  Object.assign(globalThis, { __VERSI_APP__: '0.0.0', __BUILD_SHA__: 'dev', __BUILD_WAKTU__: '2026-11-25T00:00:00.000Z' });
});

import { awalMingguWib, KOLOM_SPRINT, NAMA_LAWAN_SPRINT, type BarisPeringkatSprint, type BarisSprint } from '@remi/meja';
import { BAB_BANTUAN } from '../src/konten/bantuan';
import { TEKS_SPRINT, teksMingguSprint, teksPiala } from '../src/konten/sprint';
import { _setelUlangCache } from '../src/preferensi';
import { renderBeranda, type AksiBeranda } from '../src/ui/beranda';
import { tutupSemuaJendela } from '../src/ui/dom';
import { htmlPapanSprint, rapikanPapanSprint, rapikanSprintSaya, renderSprint, sprintBisaDilanjut, type PapanSprint } from '../src/ui/sprint';
import { pasangMatchMediaPalsu } from './bantu';

const BARIS: BarisSprint[] = [
  { nama: 'Ani', putaran: 12, menang: 1, mentung: 5, kepentung: 4, skor: 900, piala: 0 },
  { nama: 'Budi', putaran: 4, menang: 3, mentung: 1, kepentung: 2, skor: -50, piala: 2 },
  { nama: 'Cici', putaran: 30, menang: 1, mentung: 2, kepentung: 0, skor: 300, piala: 1 },
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

/** Papan bentuk lama (baris saja) dirapikan seperti jawaban server sebelum 0.10.2. */
const papanLama = (baris: BarisSprint[], periode: 'minggu' | 'semua' = 'minggu', nama?: string) =>
  rapikanPapanSprint({ periode, mulai: 0, baris }, nama)!;

/** n orang, peringkat 1..n (skor menurun), untuk potongan 10 teratas / 10 terbawah. */
function papanBanyak(n: number, saya: number | null, periode: 'minggu' | 'semua' = 'minggu'): PapanSprint {
  const semua: BarisPeringkatSprint[] = Array.from({ length: n }, (_, i) => ({
    nama: i + 1 === saya ? 'Cici' : `Orang ${i + 1}`,
    putaran: i + 1,
    menang: 0,
    mentung: 0,
    kepentung: 0,
    skor: 1000 - i * 10,
    piala: 0,
    peringkat: i + 1,
    ...(periode === 'semua' ? { minggu: SENIN } : {}),
  }));
  const muat = n <= 20;
  const milik = saya ? semua[saya - 1]! : null;
  return {
    periode,
    mulai: null,
    jumlah: n,
    atas: muat ? semua : semua.slice(0, 10),
    bawah: muat ? [] : semua.slice(-10),
    saya: milik && !muat && saya! > 10 && saya! <= n - 10 ? milik : null,
  };
}
const SENIN = awalMingguWib(Date.UTC(2026, 10, 25, 5));
const nomor = (akar: ParentNode) => [...akar.querySelectorAll('tbody tr:not(.pemisah) .kol-no')].map((x) => x.textContent);

describe('papan sprint (htmlPapanSprint)', () => {
  it('# paling kiri (peringkat, 🥇🥈🥉), Nama, lalu Ptr M Mtg Kpg Skor; piala di samping nama; baris sendiri disorot tanpa beda huruf', () => {
    const d = document.createElement('div');
    d.innerHTML = htmlPapanSprint(papanLama(BARIS), null, 'CICI');
    expect(namaBaris(d)).toEqual(['Budi', 'Ani', 'Cici']);
    expect(nomor(d)).toEqual(['🥇', '🥈', '🥉']);
    const budi = d.querySelector('tbody tr')!;
    expect(budi.querySelector('.piala')!.textContent).toBe(teksPiala(2));
    expect(budi.querySelector('.piala')!.textContent).toBe('🏆2');
    expect(budi.querySelector('.piala')!.getAttribute('aria-label')).toBe('juara sprint mingguan 2 kali');
    // Piala menempel di kata terakhir nama (spasi tak terpatah), tidak turun sendirian ke baris baru.
    expect(budi.querySelector('.piala')!.previousSibling!.textContent).toBe('\u00a0');
    expect(d.querySelectorAll('tbody tr')[2]!.querySelector('.piala')!.textContent).toBe('🏆');
    expect(d.querySelectorAll('tbody tr')[1]!.querySelector('.piala')).toBeNull();
    const saya = d.querySelectorAll('tbody tr.saya');
    expect(saya).toHaveLength(1);
    expect(saya[0]!.textContent).toContain('Cici');
    expect(saya[0]!.textContent).toContain(TEKS_SPRINT.lencanaKamu);
    // Skor negatif memakai minus tipografis.
    expect(budi.textContent).toContain('−50');
    // Judul: # (tombol kembali ke peringkat), Nama, lalu singkatan; nama lengkap di aria-label dan title.
    const judul = [...d.querySelectorAll('thead th')];
    expect(judul.map((th) => th.textContent)).toEqual(['#', 'Nama', 'Ptr', 'M', 'Mtg', 'Kpg', 'Skor']);
    expect([...d.querySelectorAll('thead [data-kolom]')].map((b) => b.getAttribute('aria-label'))).toEqual([
      'Peringkat',
      'Putaran',
      'Menang',
      'Mentung',
      'Kepentung',
      'Skor',
    ]);
    expect([...d.querySelectorAll('thead abbr')].map((x) => x.getAttribute('title'))).toEqual(['Peringkat', 'Putaran', 'Menang', 'Mentung', 'Kepentung', 'Skor']);
    expect(KOLOM_SPRINT.map((k) => TEKS_SPRINT.kolomSingkat[k])).toEqual(['Ptr', 'M', 'Mtg', 'Kpg', 'Skor']);
    // Keterangan singkatan satu baris di bawah tabel.
    // Spasi di sekitar "=" dan sebelum "·" tak terpatah: baris hanya pindah sesudah "·".
    expect(d.querySelector('.legenda-sprint')!.textContent!.replace(/\u00a0/g, ' ')).toBe('Ptr = putaran · M = menang · Mtg = mentung · Kpg = kepentung');
    expect(TEKS_SPRINT.legenda.split(' ')).toEqual(['Ptr\u00a0=\u00a0putaran\u00a0·', 'M\u00a0=\u00a0menang\u00a0·', 'Mtg\u00a0=\u00a0mentung\u00a0·', 'Kpg\u00a0=\u00a0kepentung']);
    // Isi sel per baris sesuai judulnya.
    expect([...budi.querySelectorAll('td')].map((td) => td.textContent).slice(2)).toEqual(['4', '3', '1', '2', '−50']);
    // Urutan peringkat aktif: # yang diberi aria-sort.
    expect(d.querySelector('th[aria-sort] button')!.getAttribute('data-kolom')).toBe('peringkat');
    expect(d.querySelector('th[aria-sort]')!.getAttribute('aria-sort')).toBe('ascending');
    // Kelas penempel: # dan Nama di kiri, Skor di kanan (judul dan isi).
    for (const tr of d.querySelectorAll('tr')) {
      const sel = [...tr.children];
      expect(sel[0]!.classList.contains('kol-no')).toBe(true);
      expect(sel[1]!.classList.contains('kol-nama')).toBe(true);
      expect(sel.at(-1)!.classList.contains('kol-skor')).toBe(true);
    }
    expect(d.querySelector('.tabel-gulir table.papan-sprint')).not.toBeNull();
  });

  it('urut per kolom: baris yang tampil diurutkan, angka # tetap peringkat resmi', () => {
    const d = document.createElement('div');
    const p = papanLama(BARIS);
    d.innerHTML = htmlPapanSprint(p, 'skor', 'x');
    expect(namaBaris(d)).toEqual(['Ani', 'Cici', 'Budi']);
    expect(nomor(d)).toEqual(['🥈', '🥉', '🥇']);
    d.innerHTML = htmlPapanSprint(p, 'kepentung', 'x');
    expect(namaBaris(d)).toEqual(['Cici', 'Budi', 'Ani']);
    expect(d.querySelector('th[aria-sort]')!.getAttribute('aria-sort')).toBe('ascending');
    expect(d.querySelector('[data-kolom="kepentung"]')!.classList.contains('aktif')).toBe(true);
    expect(d.querySelector('[data-kolom="peringkat"]')!.classList.contains('aktif')).toBe(false);
    d.innerHTML = htmlPapanSprint(p, 'putaran', 'x');
    expect(namaBaris(d)).toEqual(['Cici', 'Ani', 'Budi']);
    expect(d.querySelector('th[aria-sort] button')!.getAttribute('aria-label')).toBe('Putaran');
    expect(d.querySelector('th[aria-sort]')!.getAttribute('aria-sort')).toBe('descending');
  });

  it('lebih dari 20 orang: 10 teratas, "…", 10 terbawah; baris sendiri di tengah dengan peringkat aslinya', () => {
    const d = document.createElement('div');
    d.innerHTML = htmlPapanSprint(papanBanyak(35, 17), null, 'cici');
    const baris = [...d.querySelectorAll('tbody tr')];
    expect(baris).toHaveLength(10 + 1 + 1 + 1 + 10);
    expect(baris[10]!.classList.contains('pemisah')).toBe(true);
    expect(baris[10]!.textContent).toBe('…');
    expect(baris[10]!.querySelector('td')!.getAttribute('colspan')).toBe('7');
    expect(baris[11]!.classList.contains('saya')).toBe(true);
    expect(baris[11]!.querySelector('.kol-no')!.textContent).toBe('17');
    expect(baris[11]!.textContent).toContain(TEKS_SPRINT.lencanaKamu);
    expect(baris[12]!.classList.contains('pemisah')).toBe(true);
    expect(nomor(d).slice(-10)).toEqual(['26', '27', '28', '29', '30', '31', '32', '33', '34', '35']);
    // Baris sendiri bersambung dengan 10 teratas: tidak ada pemisah di antaranya.
    d.innerHTML = htmlPapanSprint(papanBanyak(35, 11), null, 'cici');
    expect([...d.querySelectorAll('tbody tr')].map((tr) => tr.classList.contains('pemisah'))).toEqual([
      ...Array(11).fill(false),
      true,
      ...Array(10).fill(false),
    ]);
    // Tidak di papan / sudah di 10 teratas: satu pemisah.
    d.innerHTML = htmlPapanSprint(papanBanyak(35, null), null, 'cici');
    expect(d.querySelectorAll('tbody tr.pemisah')).toHaveLength(1);
    expect(d.querySelectorAll('tbody tr')).toHaveLength(21);
    // Pas 21 orang: 10 + pemisah + 10 (peringkat 11 tidak tampil).
    d.innerHTML = htmlPapanSprint(papanBanyak(21, null), null, 'x');
    expect(d.querySelectorAll('tbody tr.pemisah')).toHaveLength(1);
    expect(nomor(d)).not.toContain('11');
    // 20 orang atau kurang: semua, tanpa pemisah.
    d.innerHTML = htmlPapanSprint(papanBanyak(20, 15), null, 'cici');
    expect(d.querySelectorAll('tbody tr')).toHaveLength(20);
    expect(d.querySelectorAll('tbody tr.pemisah')).toHaveLength(0);
    expect(d.querySelectorAll('tbody tr.saya')).toHaveLength(1);
    // Diurutkan per kolom: tanpa pemisah, # tetap.
    d.innerHTML = htmlPapanSprint(papanBanyak(35, 17), 'putaran', 'cici');
    expect(d.querySelectorAll('tbody tr.pemisah')).toHaveLength(0);
    expect(nomor(d)[0]).toBe('35');
    expect(d.querySelector('tr.saya .kol-no')!.textContent).toBe('17');
  });

  it('Sepanjang masa: label minggu terbaik di bawah nama', () => {
    const d = document.createElement('div');
    d.innerHTML = htmlPapanSprint(papanBanyak(3, null, 'semua'), null, 'x', SENIN + 86_400_000);
    const label = d.querySelector('tbody tr .minggu-sprint')!;
    expect(label.textContent).toBe('23–29 Nov');
    expect(label.getAttribute('aria-label')).toBe('minggu terbaik 23–29 Nov');
    // Minggu ini tidak memakai label.
    d.innerHTML = htmlPapanSprint(papanBanyak(3, null, 'minggu'), null, 'x');
    expect(d.querySelector('.minggu-sprint')).toBeNull();
  });

  it('teksMingguSprint: bulan singkat, beda bulan, tahun hanya kalau bukan tahun ini (WIB)', () => {
    const now = Date.UTC(2026, 10, 27);
    expect(teksMingguSprint(awalMingguWib(Date.UTC(2026, 10, 25)), now)).toBe('23–29 Nov');
    expect(teksMingguSprint(awalMingguWib(Date.UTC(2026, 9, 28)), now)).toBe('26 Okt–1 Nov');
    expect(teksMingguSprint(awalMingguWib(Date.UTC(2025, 10, 25)), now)).toBe('24–30 Nov 2025');
    expect(teksMingguSprint(awalMingguWib(Date.UTC(2025, 11, 31)), now)).toBe('29 Des 2025–4 Jan');
    expect(teksMingguSprint(awalMingguWib(Date.UTC(2026, 11, 31)), now)).toBe('28 Des–3 Jan 2027');
  });

  it('kosong: kalimat per periode', () => {
    expect(htmlPapanSprint(papanLama([]), null, 'x')).toContain(TEKS_SPRINT.kosongMinggu);
    expect(htmlPapanSprint(papanLama([], 'semua'), null, 'x')).toContain(TEKS_SPRINT.kosongSemua);
  });

  it('nama dari server ditulis aman (tanpa HTML)', () => {
    const d = document.createElement('div');
    d.innerHTML = htmlPapanSprint(papanLama([{ nama: '<img src=x onerror=1>', putaran: 0, menang: 0, mentung: 0, kepentung: 0, skor: 0, piala: 0 }]), null, 'x');
    expect(d.querySelector('img')).toBeNull();
  });

  it('rapikanPapanSprint: bentuk v2 dipakai, peringkat rusak dibuang; bentuk lama (server sebelum 0.10.2) dipotong di aplikasi', () => {
    expect(rapikanPapanSprint(null)).toBeNull();
    expect(rapikanPapanSprint({ periode: 'minggu' })).toBeNull();
    const v2 = rapikanPapanSprint({
      v: 2,
      periode: 'semua',
      mulai: null,
      jumlah: 40,
      atas: [{ nama: 'A', peringkat: 1, skor: 9, minggu: SENIN }, { nama: 'B', peringkat: 0 }, { peringkat: 2 }],
      bawah: [{ nama: 'Z', peringkat: 40, skor: -5, menang: 'x' }],
      saya: { nama: 'S', peringkat: 20 },
    })!;
    expect(v2).toEqual({
      periode: 'semua',
      mulai: null,
      jumlah: 40,
      atas: [{ nama: 'A', putaran: 0, menang: 0, mentung: 0, kepentung: 0, skor: 9, piala: 0, minggu: SENIN, peringkat: 1 }],
      bawah: [{ nama: 'Z', putaran: 0, menang: 0, mentung: 0, kepentung: 0, skor: -5, piala: 0, peringkat: 40 }],
      saya: { nama: 'S', putaran: 0, menang: 0, mentung: 0, kepentung: 0, skor: 0, piala: 0, peringkat: 20 },
    });
    // Bentuk lama: angka rusak jadi 0, tanpa nama dibuang, diurutkan urutan bawaan periodenya.
    expect(rapikanPapanSprint({ periode: 'aneh', mulai: 5, baris: [{ nama: 'A', menang: 'x', piala: 1.7 }, { menang: 3 }] })).toEqual({
      periode: 'minggu',
      mulai: 5,
      jumlah: 1,
      atas: [{ nama: 'A', putaran: 0, menang: 0, mentung: 0, kepentung: 0, skor: 0, piala: 1, peringkat: 1 }],
      bawah: [],
      saya: null,
    });
    // Sepanjang masa bentuk lama: skor dulu.
    expect(papanLama(BARIS, 'semua').atas.map((b) => b.nama)).toEqual(['Ani', 'Cici', 'Budi']);
    // 30 orang dari server lama: dipotong 10/10, baris sendiri dicari dari nama.
    const banyak = Array.from({ length: 30 }, (_, i) => ({ nama: `O${i}`, putaran: 1, menang: 30 - i, mentung: 0, kepentung: 0, skor: 0, piala: 0 }));
    const p = papanLama(banyak, 'minggu', 'o14');
    expect([p.jumlah, p.atas.length, p.bawah.length, p.saya?.peringkat]).toEqual([30, 10, 10, 15]);
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
    renderSprint(akar, { kembali: vi.fn(), main, lanjut: vi.fn() });
    expect(akar.querySelector('.judul p')!.textContent).toBe(TEKS_SPRINT.intro);
    expect(TEKS_SPRINT.intro).toContain('Lawan 5 warga kedai level Suhu pakai 2 deck');
    expect(TEKS_SPRINT.intro).toContain('tiap putaran langsung masuk papan');
    expect(TEKS_SPRINT.intro).not.toMatch(/\d putaran/);
    expect(akar.querySelector('#tab-sprint-minggu')!.getAttribute('aria-selected')).toBe('true');
    await tunggu();
    expect(url).toEqual(['/api/sprint?periode=minggu&v=2&nama=cici']);
    expect(namaBaris(akar)).toEqual(['Budi', 'Ani', 'Cici']);
    akar.querySelector<HTMLButtonElement>('[data-kolom="skor"]')!.click();
    expect(namaBaris(akar)).toEqual(['Ani', 'Cici', 'Budi']);
    expect(document.activeElement?.getAttribute('data-kolom')).toBe('skor');
    akar.querySelector<HTMLButtonElement>('[data-kolom="skor"]')!.click();
    expect(namaBaris(akar)).toEqual(['Budi', 'Ani', 'Cici']);
    // Kolom Putaran juga bisa diketuk.
    akar.querySelector<HTMLButtonElement>('[data-kolom="putaran"]')!.click();
    expect(namaBaris(akar)).toEqual(['Cici', 'Ani', 'Budi']);
    akar.querySelector<HTMLButtonElement>('[data-kolom="putaran"]')!.click();
    expect(namaBaris(akar)).toEqual(['Budi', 'Ani', 'Cici']);
    // # = kembali ke urutan peringkat dari kolom mana pun.
    akar.querySelector<HTMLButtonElement>('[data-kolom="mentung"]')!.click();
    expect(namaBaris(akar)).toEqual(['Ani', 'Cici', 'Budi']);
    akar.querySelector<HTMLButtonElement>('[data-kolom="peringkat"]')!.click();
    expect(namaBaris(akar)).toEqual(['Budi', 'Ani', 'Cici']);
    expect(document.activeElement?.getAttribute('data-kolom')).toBe('peringkat');
    // Isyarat masih bisa digeser (data-luap, bayangan di tepi kolom yang menempel) ikut lebar tabel.
    const gulir = akar.querySelector<HTMLElement>('.papan-sprint-gulir')!;
    expect(gulir.hasAttribute('data-luap')).toBe(false);
    Object.defineProperty(gulir, 'scrollWidth', { configurable: true, get: () => 340 });
    Object.defineProperty(gulir, 'clientWidth', { configurable: true, get: () => 318 });
    gulir.dispatchEvent(new Event('scroll'));
    expect(gulir.getAttribute('data-luap')).toBe('kanan');
    gulir.scrollLeft = 22;
    gulir.dispatchEvent(new Event('scroll'));
    expect(gulir.getAttribute('data-luap')).toBe('kiri');
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
    renderSprint(akar, { kembali: vi.fn(), main: vi.fn(), lanjut: vi.fn() });
    await tunggu();
    akar.querySelector<HTMLButtonElement>('[data-kolom="kepentung"]')!.click();
    akar.querySelector<HTMLButtonElement>('#tab-sprint-semua')!.click();
    await tunggu();
    expect(url).toEqual(['/api/sprint?periode=minggu&v=2&nama=cici', '/api/sprint?periode=semua&v=2&nama=cici']);
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
    renderSprint(akar, { kembali: vi.fn(), main: vi.fn(), lanjut: vi.fn() });
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
    renderSprint(akar, { kembali: vi.fn(), main, lanjut: vi.fn() });
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
    const layar = renderSprint(akar, { kembali, main: vi.fn(), lanjut: vi.fn() });
    expect(akar.querySelector('#papan-sprint')!.textContent).toContain(TEKS_SPRINT.memuat);
    akar.querySelector<HTMLButtonElement>('#main-sprint')!.click();
    layar.aturSibuk(false);
    expect(akar.querySelector('#main-sprint')!.hasAttribute('aria-busy')).toBe(false);
    akar.querySelector<HTMLButtonElement>('#kembali')!.click();
    expect(kembali).toHaveBeenCalled();
  });
});

// Sprint bisa dilanjut (27 Nov 2026): HP yang punya sprint minggu ini hanya melihat Lanjut sprint (tanpa Mulai
// dari 0 sejak 0.10.3).
describe('layar Sprint: Lanjut sprint', () => {
  const TOKEN = 'T'.repeat(32);
  const simpanSprint = (minggu = awalMingguWib(Date.now())) => localStorage.setItem('remi.sprintSaya', JSON.stringify({ token: TOKEN, minggu }));
  /** fetch: papan kosong; /api/sprint/saya dijawab `saya`. */
  function pasangFetch(saya: unknown) {
    const panggilan: { url: string; init?: RequestInit }[] = [];
    vi.stubGlobal(
      'fetch',
      vi.fn((url: string, init?: RequestInit) => {
        panggilan.push({ url, init });
        return url === '/api/sprint/saya' ? jawab(saya) : jawab({ periode: 'minggu', mulai: 0, baris: [] });
      }),
    );
    return panggilan;
  }

  it('sprint minggu ini: hanya Lanjut sprint (tanpa Mulai dari 0) dengan putaran dan skor dari server; Lanjut mengirim tokennya sekali', async () => {
    simpanSprint();
    const panggilan = pasangFetch({ ada: true, minggu: 1, putaran: 37, skor: -1240 });
    const akar = document.getElementById('ui')!;
    const lanjut = vi.fn();
    const main = vi.fn();
    renderSprint(akar, { kembali: vi.fn(), main, lanjut });
    expect(akar.querySelector('#main-sprint')).toBeNull();
    const tombol = akar.querySelector<HTMLButtonElement>('#lanjut-sprint')!;
    expect(tombol.textContent).toBe(TEKS_SPRINT.tombolLanjut);
    // Satu-satunya tombol (0.10.3, "Harusnya gak ada tombol Mulai dari 0").
    expect(akar.querySelectorAll('.aksi-sprint button')).toHaveLength(1);
    expect(akar.querySelector('#nol-sprint')).toBeNull();
    expect(akar.textContent).not.toMatch(/mulai dari 0/i);
    await tunggu();
    // Token dikirim di isi POST, bukan di alamat.
    const tanya = panggilan.find((x) => x.url === '/api/sprint/saya')!;
    expect(tanya.init?.method).toBe('POST');
    expect(JSON.parse(String(tanya.init?.body))).toEqual({ token: TOKEN });
    expect(panggilan.every((x) => !x.url.includes(TOKEN))).toBe(true);
    expect(tombol.querySelector('[data-ket-lanjut]')!.textContent).toBe('Putaran 37 · skor −1240');
    tombol.click();
    tombol.click();
    expect(lanjut).toHaveBeenCalledTimes(1);
    expect(lanjut).toHaveBeenCalledWith(TOKEN);
    expect(main).not.toHaveBeenCalled();
    expect(tombol.getAttribute('aria-busy')).toBe('true');
  });

  it('server bilang sudah tidak bisa dilanjut: token dilupakan, tombolnya jadi Main sprint', async () => {
    simpanSprint();
    pasangFetch({ ada: false });
    const akar = document.getElementById('ui')!;
    const layar = renderSprint(akar, { kembali: vi.fn(), main: vi.fn(), lanjut: vi.fn() });
    await tunggu();
    expect(localStorage.getItem('remi.sprintSaya')).toBeNull();
    expect(akar.querySelector('#lanjut-sprint')).toBeNull();
    expect(akar.querySelector('#main-sprint')).not.toBeNull();
    // segarkanAksi (pesan sprintSaya dari server) menggambar ulang dari simpanan.
    simpanSprint();
    layar.segarkanAksi();
    expect(akar.querySelector('#lanjut-sprint')).not.toBeNull();
  });

  it('token tidak dibuang karena jam HP: tetap Lanjut sprint, server yang memutuskan', async () => {
    // Jam HP bilang minggunya sudah lewat (misalnya jam HP kecepetan), tapi server masih menganggapnya minggu ini.
    simpanSprint(awalMingguWib(Date.now()) - 7 * 86_400_000);
    const panggilan = pasangFetch({ ada: true, putaran: 2, skor: 10 });
    const akar = document.getElementById('ui')!;
    renderSprint(akar, { kembali: vi.fn(), main: vi.fn(), lanjut: vi.fn() });
    await tunggu();
    expect(localStorage.getItem('remi.sprintSaya')).not.toBeNull();
    expect(akar.querySelector('#lanjut-sprint')).not.toBeNull();
    expect(panggilan.some((x) => x.url === '/api/sprint/saya')).toBe(true);
    expect(sprintBisaDilanjut()).toBe(false);
  });

  it('sprint minggu lalu: server bilang sudah tidak ada, baru dilupakan (Senin 00.00 WIB mulai lagi)', async () => {
    simpanSprint(awalMingguWib(Date.now()) - 7 * 86_400_000);
    pasangFetch({ ada: false });
    const akar = document.getElementById('ui')!;
    renderSprint(akar, { kembali: vi.fn(), main: vi.fn(), lanjut: vi.fn() });
    await tunggu();
    expect(localStorage.getItem('remi.sprintSaya')).toBeNull();
    expect(akar.querySelector('#main-sprint')).not.toBeNull();
    expect(akar.querySelector('#lanjut-sprint')).toBeNull();
  });

  it('sprintBisaDilanjut: token minggu ini (jam HP), tanpa membuang apa pun', () => {
    expect(sprintBisaDilanjut()).toBe(false);
    simpanSprint();
    expect(sprintBisaDilanjut()).toBe(true);
    expect(sprintBisaDilanjut(Date.now() + 8 * 86_400_000)).toBe(false);
    expect(localStorage.getItem('remi.sprintSaya')).not.toBeNull();
  });

  it('jawaban /api/sprint/saya dirapikan', () => {
    expect(rapikanSprintSaya({ ada: false })).toEqual({ ada: false });
    expect(rapikanSprintSaya({ ada: true, putaran: 3, skor: 50, minggu: 1 })).toEqual({ ada: true, putaran: 3, skor: 50 });
    expect(rapikanSprintSaya({ ada: true, putaran: 3, skor: 'x' })).toEqual({ ada: true, putaran: 3, skor: 0 });
    for (const x of [null, 5, {}, { ada: true }, { ada: true, putaran: 0 }, { ada: true, putaran: 1.5 }]) expect(rapikanSprintSaya(x)).toBeNull();
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
  it('ada, sesudah Main online, dan memuat lawan, tanpa batas putaran, menang per putaran, keluar = disimpan, Lanjut, satu sprint tiap minggu (tanpa Mulai dari 0), reset Senin, papan mode baru, dan piala', () => {
    const id = BAB_BANTUAN.map((b) => b.id);
    expect(id.indexOf('sprint')).toBe(id.indexOf('online') + 1);
    const t = JSON.stringify(bab());
    for (const nama of NAMA_LAWAN_SPRINT) expect(t).toContain(nama);
    expect(NAMA_LAWAN_SPRINT).toHaveLength(5);
    for (const x of [
      'tanpa batas putaran',
      '6 pemain, 2 deck',
      'level Suhu',
      'Menang putaran',
      'Skor sama dihitung menang',
      'sprint-mu disimpan, termasuk putaran yang lagi jalan',
      TEKS_SPRINT.tombolLanjut,
      'Satu sprint tiap minggu',
      'nggak bisa diulang dari 0',
      'Mulai lagi Senin pukul 00.00 WIB',
      'sprint versi lama nggak masuk papan',
      'bukan dari nama',
      TEKS_SPRINT.tabMinggu,
      TEKS_SPRINT.tabSemua,
      'Senin pukul 00.00 WIB',
      '🏆',
    ])
      expect(t, x).toContain(x);
    expect(t).not.toMatch(/\d putaran|percobaan|Sprint lagi|lagi jalan nggak dihitung|Mulai dari 0/);
    expect(t).not.toMatch(/\bbot\b/i);
  });

  it('tidak ada lagi yang menyuruh ke Kompetisi', () => {
    const t = JSON.stringify(BAB_BANTUAN);
    expect(t).not.toMatch(/kompetisi/i);
  });
});
