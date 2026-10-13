// @vitest-environment happy-dom
// Statistik dari riwayat lokal (layar Riwayat, tab Statistik).

import { beforeEach, describe, expect, it } from 'vitest';
import { hitungStatistik, pasangIsyaratGulir, renderRiwayat } from '../src/ui/riwayat';
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
    const budi = s.pemain.find((p) => p.nama === 'Budi')!;
    expect(budi).toEqual({ nama: 'Budi', main: 3, menang: 1, rataRata: 88, terbaik: 120, terburuk: 55 });
    const bot = s.pemain.find((p) => p.nama === 'Bot 1')!;
    expect(bot).toMatchObject({ main: 3, menang: 1, rataRata: 37, terbaik: 60, terburuk: 10 });
  });

  it('skor tertinggi seri: semua yang tertinggi dihitung juara', () => {
    const s = hitungStatistik([main(1, 'offline', 2, [['A', 50], ['B', 50], ['C', 10]])]);
    expect(s.pemain.find((p) => p.nama === 'A')!.menang).toBe(1);
    expect(s.pemain.find((p) => p.nama === 'B')!.menang).toBe(1);
    expect(s.pemain.find((p) => p.nama === 'C')!.menang).toBe(0);
  });

  it('urut dari juara terbanyak, lalu paling sering main', () => {
    const s = hitungStatistik([
      main(1, 'offline', 1, [['A', 10], ['B', 5]]),
      main(2, 'offline', 1, [['C', 10], ['B', 5]]),
      main(3, 'offline', 1, [['C', 10], ['A', 5]]),
    ]);
    expect(s.pemain.map((p) => p.nama)).toEqual(['C', 'A', 'B']);
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
    expect(s.pemain.find((p) => p.nama === 'Budi')).toMatchObject({ main: 2, menang: 1 });
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
