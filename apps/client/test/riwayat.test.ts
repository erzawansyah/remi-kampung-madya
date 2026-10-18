// @vitest-environment happy-dom
// Statistik dari riwayat lokal (layar Riwayat, tab Statistik).

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { urutkanPeringkat, type BarisPeringkat } from '@remi/meja';
import { ALASAN_SELESAI, alamatPapan, hitungStatistik, pasangIsyaratGulir, renderRiwayat } from '../src/ui/riwayat';
import type { CatatanPermainan } from '../src/penyimpanan';

const main = (waktu: number, mode: 'online' | 'offline', putaran: number, klasemen: [string, number][]): CatatanPermainan => ({
  waktu,
  mode,
  putaran,
  klasemen: klasemen.map(([nama, skor]) => ({ nama, skor })),
});

describe('hitungStatistik', () => {
  it('riwayat kosong', () => {
    const s = hitungStatistik([]);
    expect(s).toMatchObject({ jumlah: 0, offline: 0, online: 0, putaran: 0, rekor: null, terpanjang: null, pemain: [] });
  });

  it('menghitung main, juara, rata-rata, terbaik, terburuk per nama', () => {
    const s = hitungStatistik([
      main(3, 'offline', 5, [['Budi', 120], ['Bot 1', 40], ['Bot 2', -30]]),
      main(2, 'online', 10, [['Sari', 200], ['budi ', 90], ['Bot 1', 10]]),
      main(1, 'offline', 3, [['Bot 1', 60], ['Budi', 55]]),
    ]);
    expect(s.jumlah).toBe(3);
    expect(s.offline).toBe(2);
    expect(s.online).toBe(1);
    expect(s.putaran).toBe(18);
    expect(s.rekor).toEqual({ nama: 'Sari', skor: 200, waktu: 2 });
    expect(s.terpanjang).toEqual({ putaran: 10, waktu: 2 });
    // "Budi" dan "budi " digabung (tanpa beda huruf besar/kecil dan spasi tepi).
    // Dihitung lewat hitungPeringkat (@remi/meja), aturan yang sama dengan peringkat online.
    const budi = s.pemain.find((p) => p.nama === 'Budi')!;
    expect(budi).toMatchObject({ nama: 'Budi', main: 3, juara: 1, totalSkor: 265, rataRata: 88, skorTerbaik: 120, skorTerburuk: 55, keluar: 0 });
    expect(budi.persenJuara).toBeCloseTo(33.33, 2);
    // Posisi: 1 dari 3 (100), 2 dari 3 (50), 2 dari 2 (0) → 50.
    expect(budi.poinPosisi).toBe(50);
    const bot = s.pemain.find((p) => p.nama === 'Bot 1')!;
    expect(bot).toMatchObject({ main: 3, juara: 1, rataRata: 37, skorTerbaik: 60, skorTerburuk: 10 });
  });

  it('skor tertinggi seri: semua yang tertinggi dihitung juara', () => {
    const s = hitungStatistik([main(1, 'offline', 2, [['A', 50], ['B', 50], ['C', 10]])]);
    expect(s.pemain.find((p) => p.nama === 'A')!.juara).toBe(1);
    expect(s.pemain.find((p) => p.nama === 'B')!.juara).toBe(1);
    expect(s.pemain.find((p) => p.nama === 'C')!.juara).toBe(0);
  });

  it('urutan Per pemain lewat urutkanPeringkat yang sama dengan peringkat online', () => {
    const s = hitungStatistik([
      main(1, 'offline', 1, [['A', 10], ['B', 5]]),
      main(2, 'offline', 1, [['C', 10], ['B', 5]]),
      main(3, 'offline', 1, [['C', 10], ['A', 5]]),
    ]);
    expect(urutkanPeringkat(s.pemain, 'juara').peringkat.map((p) => p.nama)).toEqual(['C', 'A', 'B']);
    // Main sama-sama 2 kali: rata-rata yang lebih tinggi di atas (C 10, A 7,5, B 5).
    expect(urutkanPeringkat(s.pemain, 'main').peringkat.map((p) => p.nama)).toEqual(['C', 'A', 'B']);
    // Rata-rata butuh minimal 3 kali main: semuanya baru 2 kali.
    expect(urutkanPeringkat(s.pemain, 'rata')).toMatchObject({ peringkat: [] });
  });

  it('ejaan nama yang tampil = yang terakhir dipakai (riwayat tersimpan terbaru dulu)', () => {
    const s = hitungStatistik([main(9, 'online', 1, [['BUDI', 10], ['Sari', 0]]), main(1, 'online', 1, [['budi', 0], ['Sari', 10]])]);
    expect(s.pemain.map((p) => p.nama).sort()).toEqual(['BUDI', 'Sari']);
  });

  it('bot (ditandai) tidak masuk Per pemain maupun rekor; riwayat lama tanpa tanda tetap terbaca', () => {
    const bertanda = (waktu: number, klasemen: [string, number, boolean][]): CatatanPermainan => ({
      waktu,
      mode: 'offline',
      putaran: 3,
      klasemen: klasemen.map(([nama, skor, bot]) => (bot ? { nama, skor, bot } : { nama, skor })),
    });
    const s = hitungStatistik([
      // "Bot 1" dari dua meja berbeda: bukan pemain yang sama, dan skornya tidak boleh jadi rekor.
      bertanda(2, [['Bot 1', 500, true], ['Budi', 120, false], ['Bot 2', 30, true]]),
      bertanda(1, [['Budi', 90, false], ['Bot 1', -350, true]]),
      // Riwayat lama (tanpa field bot) tetap dihitung apa adanya.
      main(0, 'offline', 2, [['Sari', 60], ['Bot 9', 10]]),
    ]);
    expect(s.jumlah).toBe(3);
    expect(s.pemain.map((p) => p.nama).sort()).toEqual(['Bot 9', 'Budi', 'Sari']);
    expect(s.rekor).toEqual({ nama: 'Budi', skor: 120, waktu: 2 });
    // Juara tetap dibandingkan dengan seluruh meja (Budi kalah dari Bot 1 di permainan pertama).
    expect(s.pemain.find((p) => p.nama === 'Budi')).toMatchObject({ main: 2, juara: 1 });
  });

  it('entri rusak (tanpa klasemen) diabaikan, bukan bikin error', () => {
    const rusak = [null, { waktu: 1, mode: 'offline', putaran: 2 }, main(2, 'offline', 1, [['A', 1]])] as unknown as CatatanPermainan[];
    const s = hitungStatistik(rusak);
    expect(s.jumlah).toBe(1);
    expect(s.pemain).toHaveLength(1);
  });
});

describe('renderRiwayat tab Statistik', () => {
  beforeEach(() => {
    localStorage.clear();
    document.body.innerHTML = '<div id="ui"></div>';
  });

  it('tab ber-role tab, statistik tampil, nama pemain di-escape', () => {
    localStorage.setItem('remi.nama', JSON.stringify('<b>Kumis</b>'));
    localStorage.setItem('remi.riwayat', JSON.stringify([main(1, 'offline', 4, [['<b>Kumis</b>', 80], ['Bot 1', 20]])]));
    const akar = document.getElementById('ui')!;
    renderRiwayat(akar, () => {}, 'statistik');
    const tab = akar.querySelectorAll('[role=tab]');
    expect(tab).toHaveLength(4);
    expect(akar.querySelector('#tab-statistik')!.getAttribute('aria-selected')).toBe('true');
    expect(akar.querySelector('#isi-riwayat')!.getAttribute('role')).toBe('tabpanel');
    expect(akar.querySelector('#isi-riwayat b')?.textContent).not.toBe('Kumis');
    expect(akar.querySelector('tr.saya')!.textContent).toContain('<b>Kumis</b>');
    expect(akar.textContent).toContain('kali juara (100%)');
  });

  it("nama kosong: 'Kamu' dicocokkan dengan 'Pemain' (cadangan nama saat permainan dibuat)", () => {
    localStorage.setItem('remi.nama', JSON.stringify(''));
    localStorage.setItem('remi.riwayat', JSON.stringify([main(1, 'offline', 2, [['Pemain', 50], ['Bot 1', 10]])]));
    const akar = document.getElementById('ui')!;
    renderRiwayat(akar, () => {}, 'statistik');
    expect(akar.querySelector('.stat-saya')?.textContent).toContain('Kamu (Pemain)');
    expect(akar.querySelector('tr.saya')!.textContent).toContain('Pemain');
  });

  it('remi.riwayat bernilai null / bentuk aneh: tab HP ini dan Statistik tetap tampil', () => {
    for (const mentah of ['null', '{}', '"x"', '[null,{"klasemen":{}}]']) {
      localStorage.setItem('remi.riwayat', mentah);
      const akar = document.getElementById('ui')!;
      expect(() => renderRiwayat(akar, () => {}, 'lokal')).not.toThrow();
      expect(akar.querySelector('#isi-riwayat')!.textContent).toContain('Belum ada permainan');
      expect(() => renderRiwayat(akar, () => {}, 'statistik')).not.toThrow();
    }
  });

  it('tab HP ini menandai warga kedai (bot); skor negatif pakai minus tipografis', () => {
    localStorage.setItem(
      'remi.riwayat',
      JSON.stringify([
        {
          waktu: 1,
          mode: 'online',
          putaran: 2,
          klasemen: [{ nama: 'Kipas Dua', skor: 9, bot: true }, { nama: 'Budi', skor: 1 }, { nama: 'Bot 1', skor: -35, bot: true }],
        },
      ]),
    );
    const akar = document.getElementById('ui')!;
    renderRiwayat(akar, () => {}, 'lokal');
    const teks = akar.querySelector('#isi-riwayat')!.textContent!;
    expect(teks).toContain('1. Kipas Dua [warga kedai] (9)');
    expect(teks).toContain('2. Budi (1)');
    // Simpanan lama bernama "Bot 1" tetap tampil apa adanya.
    expect(teks).toContain('3. Bot 1 [warga kedai] (−35)');
    expect(teks).not.toMatch(/\bbot\b/);
  });

  it('riwayat kosong: ajakan main tanpa tautan', () => {
    const akar = document.getElementById('ui')!;
    renderRiwayat(akar, () => {}, 'lokal');
    const isi = akar.querySelector('#isi-riwayat')!;
    expect(isi.textContent).toContain('Kedai Madya');
    expect(isi.querySelector('a')).toBeNull();
  });

  it('label tab ringkas (muat satu baris di HP 360 px)', () => {
    const akar = document.getElementById('ui')!;
    renderRiwayat(akar, () => {}, 'lokal');
    const label = [...akar.querySelectorAll('[role=tab]')].map((t) => t.textContent);
    expect(label).toEqual(['Peringkat', 'Permainan', 'HP ini', 'Statistik']);
    expect(akar.querySelector('#tab-lokal')!.getAttribute('aria-selected')).toBe('true');
  });
});

describe('pasangIsyaratGulir (deret tab meluap)', () => {
  /** happy-dom tanpa layout: lebar isi/kotak dan posisi gulir ditiru lewat properti. */
  const deretPalsu = (lebarIsi: number, lebarKotak: number) => {
    const el = document.createElement('div');
    el.setAttribute('role', 'tablist');
    el.innerHTML = '<button role="tab">A</button><button role="tab">B</button>';
    document.body.appendChild(el);
    let kiri = 0;
    Object.defineProperty(el, 'scrollWidth', { configurable: true, get: () => lebarIsi });
    Object.defineProperty(el, 'clientWidth', { configurable: true, get: () => lebarKotak });
    Object.defineProperty(el, 'scrollLeft', {
      configurable: true,
      get: () => kiri,
      set: (v: number) => (kiri = Math.max(0, Math.min(lebarIsi - lebarKotak, v))),
    });
    return el;
  };

  it('tidak meluap: tanpa atribut (tanpa pudaran)', () => {
    const el = deretPalsu(300, 300);
    pasangIsyaratGulir(el);
    expect(el.hasAttribute('data-luap')).toBe(false);
  });

  it('meluap: sisi yang masih menyimpan tab ditandai, ikut berubah saat digulir', () => {
    const el = deretPalsu(500, 300);
    pasangIsyaratGulir(el);
    expect(el.getAttribute('data-luap')).toBe('kanan');
    el.scrollLeft = 100;
    el.dispatchEvent(new Event('scroll'));
    expect(el.getAttribute('data-luap')).toBe('kiri kanan');
    el.scrollLeft = 200;
    el.dispatchEvent(new Event('scroll'));
    expect(el.getAttribute('data-luap')).toBe('kiri');
  });

  it('renderRiwayat memasang isyarat di deret tab-nya', () => {
    const akar = document.getElementById('ui') ?? document.body.appendChild(Object.assign(document.createElement('div'), { id: 'ui' }));
    renderRiwayat(akar, () => {}, 'lokal');
    const deret = akar.querySelector<HTMLElement>('[role=tablist]')!;
    // Tanpa layout lebarnya 0: tidak dianggap meluap.
    expect(deret.hasAttribute('data-luap')).toBe(false);
    Object.defineProperty(deret, 'scrollWidth', { configurable: true, get: () => 480 });
    Object.defineProperty(deret, 'clientWidth', { configurable: true, get: () => 320 });
    deret.dispatchEvent(new Event('scroll'));
    expect(deret.getAttribute('data-luap')).toBe('kanan');
  });
});

// ---------------------------------------------------------------------------------------------
// Leaderboard (keputusan pemilik #45)

const baris = (nama: string, isi: Partial<BarisPeringkat>): BarisPeringkat => ({
  nama,
  main: 3,
  juara: 0,
  totalSkor: 0,
  rataRata: 0,
  skorTerbaik: 0,
  mentung: 0,
  kepentung: 0,
  persenJuara: 0,
  poinPosisi: 0,
  skorTerburuk: 0,
  keluar: 0,
  ...isi,
});

const papanContoh = (isi: Partial<{ peringkat: BarisPeringkat[]; belumCukup: BarisPeringkat[]; periode: unknown; jumlahPermainan: number }> = {}) => ({
  v: 2,
  urut: 'rata',
  saringan: { jumlahPemain: null, jumlahDeck: null, periode: 'semua' },
  periode: null,
  minMain: 3,
  jumlahPermainan: 7,
  peringkat: [
    baris('Siti', { main: 4, juara: 1, totalSkor: 400, rataRata: 100, skorTerbaik: 300, persenJuara: 25, poinPosisi: 40, mentung: 6 }),
    baris('Budi', { main: 5, juara: 3, totalSkor: 250, rataRata: 50, skorTerbaik: 500, persenJuara: 60, poinPosisi: 70, mentung: 2, keluar: 1 }),
  ],
  belumCukup: [baris('Joko', { main: 1, juara: 1, totalSkor: 900, rataRata: 900, skorTerbaik: 900, persenJuara: 100, poinPosisi: 100 })],
  ...isi,
});

/** Stub fetch: jawaban per panggilan bisa ditahan (untuk menguji jawaban yang telat). */
function stubFetch(jawab: (url: string) => unknown | Promise<unknown>) {
  const panggil: string[] = [];
  const f = vi.fn(async (url: string) => {
    panggil.push(url);
    const isi = await jawab(url);
    if (isi instanceof Error) throw isi;
    return { ok: true, status: 200, json: async () => isi } as Response;
  });
  vi.stubGlobal('fetch', f);
  return panggil;
}

const tunggu = () => new Promise((r) => setTimeout(r, 0));
const namaBaris = (akar: ParentNode, sel = '#hasil-peringkat > .rincian:not(.belum-cukup) .baris-peringkat .nama-skor > b') =>
  [...akar.querySelectorAll(sel)].map((b) => b.textContent);
const ganti = (sel: HTMLSelectElement, nilai: string) => {
  sel.value = nilai;
  sel.dispatchEvent(new Event('change'));
};

describe('renderRiwayat tab Peringkat (leaderboard v2)', () => {
  beforeEach(() => {
    localStorage.clear();
    document.body.innerHTML = '<div id="ui"></div>';
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it('alamat permintaan: bawaan hanya v=2&urut=rata; saringan ikut kalau dipilih', () => {
    expect(alamatPapan('rata', { jumlahPemain: null, jumlahDeck: null, periode: 'semua' })).toBe('/api/peringkat?v=2&urut=rata');
    expect(alamatPapan('posisi', { jumlahPemain: 4, jumlahDeck: 2, periode: 'bulan' })).toBe('/api/peringkat?v=2&urut=posisi&pemain=4&deck=2&periode=bulan');
  });

  it('permintaan bawaan, kontrol berlabel, angka besar = metrik terpilih, Belum cukup main, Cara hitungnya', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date(Date.UTC(2026, 9, 16, 5)));
    localStorage.setItem('remi.nama', JSON.stringify('budi'));
    const panggil = stubFetch(() => papanContoh());
    const akar = document.getElementById('ui')!;
    renderRiwayat(akar, () => {}, 'peringkat');
    await tunggu();
    expect(panggil).toEqual(['/api/peringkat?v=2&urut=rata']);
    // Empat pilihan, masing-masing <select> di dalam <label>.
    const label = [...akar.querySelectorAll('.kontrol-peringkat label')].map((l) => l.firstChild!.textContent!.trim());
    expect(label).toEqual(['Urutkan', 'Pemain', 'Deck', 'Periode']);
    for (const l of akar.querySelectorAll('.kontrol-peringkat label')) expect(l.querySelector('select')).not.toBeNull();
    expect(akar.querySelector<HTMLSelectElement>('#urut-peringkat')!.value).toBe('rata');
    expect([...akar.querySelectorAll('#saring-periode option')].map((o) => o.textContent)).toEqual(['Semua', 'Bulan ini']);
    // Urut rata-rata: Siti (100) di atas Budi (50); Joko baru 1 kali main.
    expect(namaBaris(akar)).toEqual(['Siti', 'Budi']);
    const pertama = akar.querySelector('#hasil-peringkat .baris-peringkat')!;
    expect(pertama.querySelector('.kanan-peringkat b')!.textContent).toBe('100');
    expect(pertama.querySelector('.kanan-peringkat small')!.textContent).toBe('rata-rata');
    const budi = akar.querySelectorAll('#hasil-peringkat .baris-peringkat')[1]!;
    expect(budi.classList.contains('saya')).toBe(true);
    expect(budi.querySelector('small')!.textContent).toBe('5× main · 3× juara · terbaik 500 · keluar 1×');
    expect(pertama.querySelector('small')!.textContent).not.toContain('keluar');
    expect(akar.querySelector('#hasil-peringkat')!.textContent).toContain('Belum 3 kali main');
    expect(namaBaris(akar, '.belum-cukup .baris-peringkat .nama-skor > b')).toEqual(['Joko']);
    // Penjelasan urutan ada di lipatan "Cara hitungnya", bukan di layar utama.
    expect(akar.querySelector('details.cara-hitung #jelas-urut')!.textContent).toContain('200 dan 100 jadi 150');
    expect(akar.querySelector('details.cara-hitung')!.textContent).toContain('sesudah 3 kali main');
    expect(akar.querySelector('.layar-riwayat .judul p')).toBeNull();
    expect(akar.querySelector('#ringkasan-peringkat')!.getAttribute('role')).toBe('status');
    expect(akar.querySelector('#ringkasan-peringkat')!.textContent).toBe('3 orang · 7 permainan');
    const cara = akar.querySelector('details.cara-hitung')!;
    expect(cara.querySelector('summary')!.textContent).toBe('Cara hitungnya');
    for (const kata of ['minimal 2 orang', 'Warga kedai', 'juru kunci', 'huruf besar/kecil']) expect(cara.textContent).toContain(kata);
    // Istilah UI: warga kedai, bukan "bot".
    expect(akar.querySelector('#isi-riwayat')!.textContent).not.toMatch(/\bbot\b/i);
  });

  it('ganti urutan: diurutkan ulang di HP tanpa ambil ke server, fokus tetap di pilihan', async () => {
    const panggil = stubFetch(() => papanContoh());
    const akar = document.getElementById('ui')!;
    renderRiwayat(akar, () => {}, 'peringkat');
    await tunggu();
    const sel = akar.querySelector<HTMLSelectElement>('#urut-peringkat')!;
    sel.focus();
    ganti(sel, 'terbaik');
    expect(panggil).toHaveLength(1);
    expect(document.activeElement).toBe(sel);
    expect(sel.isConnected).toBe(true);
    // Skor terbaik tidak butuh minimal main: Joko (900) ikut di atas.
    expect(namaBaris(akar)).toEqual(['Joko', 'Budi', 'Siti']);
    expect(akar.querySelector('#hasil-peringkat .kanan-peringkat small')!.textContent).toBe('skor terbaik');
    expect(akar.querySelector('#hasil-peringkat')!.textContent).not.toContain('Belum 3 kali main');
    ganti(sel, 'persen');
    expect(namaBaris(akar)).toEqual(['Budi', 'Siti']);
    expect(akar.querySelector('#hasil-peringkat .kanan-peringkat b')!.textContent).toBe('60%');
    ganti(sel, 'mentung');
    expect(namaBaris(akar)).toEqual(['Siti', 'Budi', 'Joko']);
    expect(akar.querySelector('#hasil-peringkat .kanan-peringkat b')!.textContent).toBe('6×');
    expect(akar.querySelector('#jelas-urut')!.textContent).toContain('Paling sering mentung');
    // Urut mentung: kepentung ikut di baris kecil.
    expect(akar.querySelector('#hasil-peringkat .baris-peringkat small')!.textContent).toContain('kepentung');
    expect(panggil).toHaveLength(1);
  });

  it('ganti saringan: ambil ulang dengan parameter baru; jawaban yang telat untuk saringan lama diabaikan', async () => {
    let lepasPertama: (x: unknown) => void = () => {};
    let ke = 0;
    const panggil = stubFetch(() => {
      ke++;
      if (ke === 2) return new Promise((r) => (lepasPertama = r));
      if (ke === 3) return papanContoh({ peringkat: [baris('Rina', { main: 3, totalSkor: 30 })], belumCukup: [], jumlahPermainan: 1 });
      return papanContoh();
    });
    const akar = document.getElementById('ui')!;
    renderRiwayat(akar, () => {}, 'peringkat');
    await tunggu();
    ganti(akar.querySelector<HTMLSelectElement>('#saring-pemain')!, '4');
    expect(akar.querySelector('#hasil-peringkat [aria-busy="true"]')).not.toBeNull();
    ganti(akar.querySelector<HTMLSelectElement>('#saring-deck')!, '2');
    await tunggu();
    expect(panggil).toEqual(['/api/peringkat?v=2&urut=rata', '/api/peringkat?v=2&urut=rata&pemain=4', '/api/peringkat?v=2&urut=rata&pemain=4&deck=2']);
    expect(namaBaris(akar)).toEqual(['Rina']);
    // Jawaban permintaan ke-2 baru datang sekarang: tidak boleh menimpa.
    lepasPertama(papanContoh());
    await tunggu();
    expect(namaBaris(akar)).toEqual(['Rina']);
    // Catatan deck tampil hanya kalau deck dipilih.
    expect(akar.querySelector<HTMLElement>('#catatan-deck')!.hidden).toBe(false);
    ganti(akar.querySelector<HTMLSelectElement>('#saring-deck')!, '');
    expect(akar.querySelector<HTMLElement>('#catatan-deck')!.hidden).toBe(true);
    await tunggu();
    // Periode bulan ini: ringkasan menyebut bulannya.
    vi.unstubAllGlobals();
    stubFetch(() => papanContoh({ periode: { dari: '', sampai: '', bulan: '2026-10' } }));
    ganti(akar.querySelector<HTMLSelectElement>('#saring-periode')!, 'bulan');
    await tunggu();
    expect(akar.querySelector('#ringkasan-peringkat')!.textContent).toContain('Oktober 2026');
  });

  it('kosong: pesan sesuai ada/tidaknya saringan', async () => {
    stubFetch(() => papanContoh({ peringkat: [], belumCukup: [], jumlahPermainan: 0 }));
    const akar = document.getElementById('ui')!;
    renderRiwayat(akar, () => {}, 'peringkat');
    await tunggu();
    expect(akar.querySelector('#hasil-peringkat')!.textContent).toContain('Belum ada permainan online bareng teman yang selesai.');
    ganti(akar.querySelector<HTMLSelectElement>('#saring-pemain')!, '6');
    await tunggu();
    expect(akar.querySelector('#hasil-peringkat')!.textContent).toContain('Belum ada permainan yang cocok.');
  });

  it('server lama (jawaban array): tampil cara lama, pilihan dimatikan, ada catatan singkat', async () => {
    stubFetch(() => [{ nama: 'Budi', main: 3, juara: 2, totalSkor: 150, rataRata: 50, skorTerbaik: 120, mentung: 1, kepentung: 0 }]);
    const akar = document.getElementById('ui')!;
    renderRiwayat(akar, () => {}, 'peringkat');
    await tunggu();
    for (const id of ['#urut-peringkat', '#saring-pemain', '#saring-deck', '#saring-periode']) expect(akar.querySelector<HTMLSelectElement>(id)!.disabled).toBe(true);
    expect(akar.querySelector<HTMLElement>('#catatan-server')!.hidden).toBe(false);
    expect(akar.querySelector('#hasil-peringkat')!.textContent).toContain('juara 2×');
    expect(akar.querySelector('#hasil-peringkat .kanan-peringkat b')!.textContent).toBe('150');
  });

  it('server galat: Coba lagi di tempat hasil (kontrol tetap), lalu berhasil', async () => {
    let gagal = true;
    stubFetch(() => (gagal ? new Error('putus') : papanContoh()));
    const akar = document.getElementById('ui')!;
    renderRiwayat(akar, () => {}, 'peringkat');
    await tunggu();
    expect(akar.querySelector('#hasil-peringkat [data-coba]')).not.toBeNull();
    expect(akar.querySelector('#urut-peringkat')).not.toBeNull();
    gagal = false;
    const coba = akar.querySelector<HTMLElement>('#hasil-peringkat [data-coba]')!;
    coba.focus();
    coba.click();
    // Tombolnya hilang, fokus pindah ke wadah hasil, bukan jatuh ke <body>.
    expect(document.activeElement).toBe(akar.querySelector('#hasil-peringkat'));
    await tunggu();
    expect(namaBaris(akar)).toEqual(['Siti', 'Budi']);
    expect(document.activeElement).toBe(akar.querySelector('#hasil-peringkat'));
  });

  it('pilihan bertahan saat pindah tab lalu kembali', async () => {
    const panggil = stubFetch((url) => (url.startsWith('/api/riwayat') ? [] : papanContoh()));
    const akar = document.getElementById('ui')!;
    renderRiwayat(akar, () => {}, 'peringkat');
    await tunggu();
    ganti(akar.querySelector<HTMLSelectElement>('#urut-peringkat')!, 'posisi');
    ganti(akar.querySelector<HTMLSelectElement>('#saring-pemain')!, '3');
    await tunggu();
    akar.querySelector<HTMLElement>('#tab-permainan')!.click();
    await tunggu();
    akar.querySelector<HTMLElement>('#tab-peringkat')!.click();
    await tunggu();
    expect(akar.querySelector<HTMLSelectElement>('#urut-peringkat')!.value).toBe('posisi');
    expect(akar.querySelector<HTMLSelectElement>('#saring-pemain')!.value).toBe('3');
    expect(panggil.at(-1)).toBe('/api/peringkat?v=2&urut=posisi&pemain=3');
  });
});

describe('renderRiwayat tab Permainan: lencana', () => {
  beforeEach(() => {
    document.body.innerHTML = '<div id="ui"></div>';
  });
  afterEach(() => vi.unstubAllGlobals());

  it('yang keluar ditandai "keluar", warga kedai "warga kedai", main sendirian "nggak masuk peringkat"; tanpa kata bot', async () => {
    const k = (kursi: number, nama: string, skor: number, extra: object = {}) => ({ kursi, peringkat: kursi + 1, nama, bot: false, skor, mentung: 0, kepentung: 0, ...extra });
    stubFetch(() => [
      { id: 2, kodeMeja: 'SOLO1', selesaiPada: '2026-10-16T05:00:00.000Z', alasan: 'sepakat', jumlahPutaran: 2, dihitung: false, klasemen: [k(0, 'Budi', 50), k(1, 'Kipas Dua', 0, { bot: true })] },
      { id: 1, kodeMeja: 'AAAAA', selesaiPada: '2026-10-15T05:00:00.000Z', alasan: 'sepakat', jumlahPutaran: 2, dihitung: true, klasemen: [k(0, 'Siti', 50), k(1, 'Budi', 300, { keluar: true })] },
      // Server lama: tanpa field dihitung/keluar.
      { id: 0, kodeMeja: 'LAMAA', selesaiPada: '2026-10-14T05:00:00.000Z', alasan: null, jumlahPutaran: 1, klasemen: [k(0, 'Siti', 5), k(1, 'Budi', 0)] },
    ]);
    const akar = document.getElementById('ui')!;
    renderRiwayat(akar, () => {}, 'permainan');
    await tunggu();
    const g = [...akar.querySelectorAll('#isi-riwayat details')];
    expect(g).toHaveLength(3);
    expect(g[0]!.querySelector('summary')!.textContent).toContain('nggak masuk peringkat');
    expect(g[0]!.textContent).toContain('warga kedai');
    expect(g[1]!.querySelector('summary')!.textContent).not.toContain('nggak masuk peringkat');
    const keluar = [...g[1]!.querySelectorAll('.lencana')].map((l) => l.textContent);
    expect(keluar).toEqual(['keluar']);
    expect(g[2]!.querySelectorAll('.lencana')).toHaveLength(0);
    expect(akar.querySelector('#isi-riwayat')!.textContent).not.toMatch(/\bbot\b/i);
  });
});

describe('renderRiwayat tab Permainan: alasan selesai', () => {
  beforeEach(() => {
    document.body.innerHTML = '<div id="ui"></div>';
  });
  afterEach(() => vi.unstubAllGlobals());

  it('semua alasan dari server punya label, termasuk mode kaldu (#42) "putaran kaldu"', async () => {
    // Alasan yang mungkin dikirim server (RingkasanAkhir.alasan selain null).
    expect(Object.keys(ALASAN_SELESAI).sort()).toEqual(['batasPutaran', 'batasSkor', 'kaldu', 'sepakat']);
    const k = (kursi: number, nama: string, skor: number) => ({ kursi, peringkat: kursi + 1, nama, bot: false, skor, mentung: 0, kepentung: 0 });
    stubFetch(() => [
      { id: 2, kodeMeja: 'KALDU', selesaiPada: '2026-10-16T05:00:00.000Z', alasan: 'kaldu', jumlahPutaran: 7, dihitung: true, klasemen: [k(0, 'Siti', 500), k(1, 'Budi', -200)] },
      { id: 1, kodeMeja: 'BIASA', selesaiPada: '2026-10-15T05:00:00.000Z', alasan: 'batasSkor', jumlahPutaran: 4, dihitung: true, klasemen: [k(0, 'Siti', 500), k(1, 'Budi', 0)] },
    ]);
    const akar = document.getElementById('ui')!;
    renderRiwayat(akar, () => {}, 'permainan');
    await tunggu();
    const ringkas = [...akar.querySelectorAll('#isi-riwayat details > summary small')].map((e) => e.textContent);
    expect(ringkas[0]).toContain('7 putaran · putaran kaldu · juara Siti');
    expect(ringkas[1]).toContain('4 putaran · batas skor · juara Siti');
  });
});

describe('renderRiwayat tab Statistik: pemilih urutan', () => {
  beforeEach(() => {
    localStorage.clear();
    document.body.innerHTML = '<div id="ui"></div>';
  });

  it('kolom Nama · Main · Juara · Rata-rata · Terbaik · Posisi, aria-sort ikut urutan, tanpa pilihan mentung', () => {
    localStorage.setItem('remi.nama', JSON.stringify('Budi'));
    localStorage.setItem(
      'remi.riwayat',
      JSON.stringify([
        main(5, 'online', 2, [['Sari', 300], ['Budi', 20]]),
        { waktu: 4, mode: 'offline', putaran: 2, klasemen: [{ nama: 'Budi', skor: 100 }, { nama: 'Kipas Dua', skor: 50, bot: true }] },
        main(3, 'offline', 2, [['Sari', 90], ['Budi', 80]]),
        main(2, 'online', 2, [['Sari', 10], ['Budi', 0]]),
        main(1, 'online', 2, [['Joko', 999], ['Budi', 0]]),
      ]),
    );
    const akar = document.getElementById('ui')!;
    renderRiwayat(akar, () => {}, 'statistik');
    const kepala = [...akar.querySelectorAll('#tabel-statistik thead th')];
    expect(kepala.map((th) => th.textContent)).toEqual(['Nama', 'Main', 'Juara', 'Rata-rata', 'Terbaik', 'Posisi']);
    expect(kepala.find((th) => th.getAttribute('aria-sort'))!.textContent).toBe('Rata-rata');
    const sel = akar.querySelector<HTMLSelectElement>('#urut-lokal')!;
    expect([...sel.options].map((o) => o.value)).not.toContain('mentung');
    expect(sel.value).toBe('rata');
    const nama = () => [...akar.querySelectorAll('#tabel-statistik tbody tr td:first-child')].map((td) => td.textContent!.replace(' kamu', ''));
    // Rata-rata: Sari 133 (3 main), Budi 40 (5 main); Joko baru 1 kali → Belum cukup main.
    expect(nama()).toEqual(['Sari', 'Budi', 'Joko']);
    expect(akar.querySelector('#tabel-statistik .sub-judul')!.textContent).toContain('Belum 3 kali main');
    expect(akar.querySelector('#tabel-statistik tr.saya')!.textContent).toContain('1 (20%)');
    ganti(sel, 'main');
    expect(nama()).toEqual(['Budi', 'Sari', 'Joko']);
    expect(akar.querySelector('#tabel-statistik th[aria-sort]')!.textContent).toBe('Main');
    expect(akar.querySelector('#tabel-statistik .sub-judul')).toBeNull();
    ganti(sel, 'terbaik');
    expect(nama()).toEqual(['Joko', 'Sari', 'Budi']);
  });
});
