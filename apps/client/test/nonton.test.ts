// @vitest-environment happy-dom
// Nonton (keputusan pemilik #60) di aplikasi:
// - layar penonton: nama pemain, kartu buangan, tombol minta lihat per keadaan (bisa, menunggu, jeda
//   dengan hitung mundur, dilihat, tidak bisa), tanpa kartu tangan siapa pun;
// - daftar meja publik: bagian "Lagi main" dengan tombol Tonton;
// - KontrolMeja mode penonton: tampilan meja pemain, tanpa aksi apa pun (ketuk, seret, tombol, keyboard),
//   bar bawah "Kamu lagi lihat kartu X" + Berhenti lihat;
// - KontrolMeja pemain: kotak permintaan (Izinkan/Tolak) dan tombol jumlah penonton + dialog Hentikan.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.hoisted(() => {
  Object.assign(globalThis, { __VERSI_APP__: '0.0.0', __BUILD_SHA__: 'dev', __BUILD_WAKTU__: '2026-11-07T00:00:00.000Z' });
});

import { buatPermainan, terapkanAksi, viewUntuk, type GameState, type Kartu } from '@remi/engine';
import { JEDA_TOLAK_LIHAT_MS, PENGATURAN_BAWAAN, type InfoMeja, type InfoTontonan, type RingkasanMeja } from '@remi/meja';

vi.mock('../src/efek/suara', () => ({ bunyi: vi.fn(), getar: vi.fn() }));
vi.mock('../src/efek/sorak', () => ({ sorak: vi.fn(async () => {}), bersihkanSorak: vi.fn() }));
vi.mock('../src/ui/pengaturan', () => ({ bukaPengaturan: vi.fn() }));
vi.mock('../src/ui/bantuan', () => ({ bukaBantuan: vi.fn() }));
vi.mock('../src/ui/tentang', () => ({ bukaTentang: vi.fn() }));
vi.mock('../src/ui/dom', async (asli) => ({ ...(await asli<typeof import('../src/ui/dom')>()), umumkan: vi.fn() }));

import { KontrolMeja, type AppUntukMeja } from '../src/kontrolMeja';
import { TEKS_TONTONAN } from '../src/konten/tontonan';
import { renderTontonan } from '../src/ui/tontonan';
import { renderDaftarPublik } from '../src/ui/beranda';
import { renderLobi } from '../src/ui/lobi';
import { bukaModal, tutupSemuaJendela } from '../src/ui/dom';
import type { MejaScene } from '../src/game/MejaScene';
import type { PesanKeMeja } from '../src/koneksi';

function scenePalsu(): MejaScene {
  const titik = { x: 0, y: 0, w: 10 };
  return new Proxy({} as MejaScene, {
    get(_, metode) {
      if (typeof metode !== 'string' || metode === 'then') return undefined;
      return (...args: unknown[]) => {
        if (metode === 'kotakLayar') return null;
        if (metode.startsWith('posisi')) return titik;
        for (const a of args) if (typeof a === 'function') (a as () => void)();
        return Promise.resolve(metode === 'naikPanggung' ? [] : undefined);
      };
    },
  });
}

function permainan(): GameState {
  for (let pengocok = 0; pengocok < 3; pengocok++) {
    const g0 = buatPermainan({ pemain: ['Ani', 'Budi', 'Warga'], seed: 11 });
    const h = terapkanAksi(g0, { jenis: 'mulaiPutaran', pengocok });
    if (h.ok && h.state.putaran!.giliran === 1) return h.state;
  }
  throw new Error('tidak ketemu pengocok yang membuat giliran kursi 1');
}

function infoMeja(g: GameState, kursiSaya: number, ubah: Partial<InfoMeja> = {}): InfoMeja {
  return {
    kode: 'TONTN',
    status: 'main',
    pengaturan: { ...PENGATURAN_BAWAAN, jumlahPemain: 3, detikGiliran: 0 },
    kursi: g.pemain.map((p, i) => ({ jenis: i < 2 ? 'manusia' : 'bot', nama: p.nama, terhubung: true, level: 'normal' })),
    host: 0,
    kursiSaya,
    setujuAkhiri: [],
    batasWaktu: null,
    diambilAlihBot: false,
    menungguJoker: [],
    botMikir: null,
    ...ubah,
  };
}

const tunggu = () => new Promise((r) => setTimeout(r, 0));
/** Kotak permintaan lihat kartu: di lapisan anak <body>, bukan di #ui (supaya tidak ikut inert). */
const kotakMinta = () => document.querySelector<HTMLElement>('#lapisan-minta .permintaan-lihat');

let akar: HTMLDivElement;
let kontrol: KontrolMeja | null = null;
let terkirim: PesanKeMeja[] = [];

function pasang(app: Partial<AppUntukMeja>, info: InfoMeja, g: GameState) {
  terkirim = [];
  const lengkap: AppUntukMeja = {
    jenis: 'online',
    kirim: (p) => void terkirim.push(p),
    keluarMeja: vi.fn(),
    mainLagiOffline: vi.fn(),
    ...app,
  };
  kontrol = new KontrolMeja(lengkap, scenePalsu(), akar);
  kontrol.perbarui(info, viewUntuk(g, info.kursiSaya));
  return lengkap;
}

beforeEach(() => {
  akar = document.createElement('div');
  document.body.appendChild(akar);
});
afterEach(() => {
  kontrol?.hancurkan();
  kontrol = null;
  tutupSemuaJendela();
  akar.remove();
});

describe('layar penonton', () => {
  const kartu = (id: string, rank: Kartu['rank'], bunga: Kartu['bunga']): Kartu => ({ id, rank, bunga, deck: 0 });
  const info = (ubah: Partial<InfoTontonan> = {}): InfoTontonan => ({
    kode: 'TONTN',
    namaHost: 'Ani',
    status: 'main',
    pemain: [
      { nama: 'Ani', minta: 'bisa' },
      { nama: 'Budi', minta: 'jeda', jedaMs: JEDA_TOLAK_LIHAT_MS },
      { nama: 'Warga', minta: 'tidak' },
    ],
    buangan: [kartu('love-7-0', 7, 'love'), kartu('waru-13-0', 13, 'waru')],
    melihat: null,
    jumlahPenonton: 2,
    ...ubah,
  });

  it('menampilkan nama, buangan, dan tombol sesuai keadaan', () => {
    const minta = vi.fn();
    const berhenti = vi.fn();
    const t = renderTontonan(akar, info(), { minta, berhenti });
    // Judul pakai nama host; kode (kode tonton) tidak ditampilkan.
    expect(akar.querySelector('h1')!.textContent).toBe('Nonton meja Ani');
    expect(akar.textContent).not.toContain('TONTN');
    expect(akar.textContent).toContain('2 penonton');
    expect(akar.querySelectorAll('.buangan-tontonan canvas')).toHaveLength(2);
    const tombol = [...akar.querySelectorAll<HTMLButtonElement>('[data-minta]')];
    expect(tombol.map((b) => b.textContent)).toEqual([TEKS_TONTONAN.minta, 'Bisa minta lagi 3 menit lagi', TEKS_TONTONAN.tidakBisa]);
    expect(tombol.map((b) => b.disabled)).toEqual([false, true, true]);
    tombol[0].click();
    expect(minta).toHaveBeenCalledWith(0);
    // Ketuk ganda sebelum jawaban datang tidak mengirim dua kali.
    tombol[0].click();
    expect(minta).toHaveBeenCalledTimes(1);
    t.perbarui(info({ pemain: [{ nama: 'Ani', minta: 'menunggu' }, { nama: 'Budi', minta: 'bisa' }, { nama: 'Warga', minta: 'tidak' }], buangan: [] }));
    expect(akar.querySelector('[data-minta="0"]')!.textContent).toBe(TEKS_TONTONAN.menunggu);
    expect(akar.textContent).toContain(TEKS_TONTONAN.buanganKosong);
    akar.querySelector<HTMLButtonElement>('#berhenti-nonton')!.click();
    expect(berhenti).toHaveBeenCalled();
    t.lepas();
  });

  it('tombol hidup lagi sendiri begitu jeda habis', () => {
    vi.useFakeTimers();
    try {
      const t = renderTontonan(akar, info({ pemain: [{ nama: 'Ani', minta: 'jeda', jedaMs: 2000 }] }), { minta: vi.fn(), berhenti: vi.fn() });
      const b = () => akar.querySelector<HTMLButtonElement>('[data-minta="0"]')!;
      expect(b().disabled).toBe(true);
      vi.advanceTimersByTime(4000);
      expect(b().disabled).toBe(false);
      expect(b().textContent).toBe(TEKS_TONTONAN.minta);
      t.lepas();
    } finally {
      vi.useRealTimers();
    }
  });

  it('daftar meja publik punya bagian "Lagi main" dengan tombol Tonton', () => {
    const daftar: RingkasanMeja[] = [
      { kode: 'LOBI1', namaHost: 'Ani', jumlahPemain: 4, terisi: 2, status: 'lobi' },
      { kode: 'MAIN1', namaHost: 'Budi', jumlahPemain: 3, terisi: 3, status: 'main', tonton: true },
    ];
    const tonton = vi.fn();
    const gabung = vi.fn();
    renderDaftarPublik(akar, daftar, gabung, vi.fn(), vi.fn(), tonton);
    expect(akar.querySelectorAll('[data-kode]')).toHaveLength(1);
    // Entri tonton membawa kode tonton: tidak ditampilkan, cukup nama host dan jumlah pemain.
    const item = akar.querySelector<HTMLElement>('[data-tonton="MAIN1"]')!;
    expect(item.textContent).toContain('Budi');
    expect(item.textContent).toContain('3 pemain');
    expect(item.textContent).not.toContain('MAIN1');
    expect(item.getAttribute('aria-label')).not.toContain('MAIN1');
    item.click();
    expect(tonton).toHaveBeenCalledWith('MAIN1');
    expect(gabung).not.toHaveBeenCalled();
    // Tanpa penangan nonton (tidak pernah dari aplikasi ini), meja yang sedang main tidak tampil.
    renderDaftarPublik(akar, daftar, gabung, vi.fn(), vi.fn());
    expect(akar.querySelector('[data-tonton]')).toBeNull();
    expect(akar.textContent).not.toContain('Lagi main');
  });
});

describe('lobi: Boleh ditonton', () => {
  it('meja publik maupun privat bisa ditonton: keterangannya sama', () => {
    const g = permainan();
    const lobi = (publik: boolean) => {
      const info = infoMeja(g, 0, { status: 'lobi' });
      renderLobi(akar, { ...info, pengaturan: { ...info.pengaturan, publik } }, vi.fn(), vi.fn());
      return akar.querySelector('#ket-ditonton')!.textContent!;
    };
    expect(lobi(false)).toBe(lobi(true));
    expect(lobi(false)).not.toMatch(/meja publik/);
    expect(akar.querySelector<HTMLInputElement>('#ditonton')!.checked).toBe(true);
  });
});

describe('KontrolMeja mode penonton', () => {
  it('menampilkan meja pemain tanpa satu pun aksi', async () => {
    const g = permainan();
    const berhentiLihat = vi.fn();
    pasang({ penonton: true, berhentiLihat }, infoMeja(g, 1, { penonton: { jumlah: 1 } }), g);
    await tunggu();
    expect(document.documentElement.dataset.penonton).toBe('1');
    expect(akar.querySelector('.langkah')!.textContent).toBe(TEKS_TONTONAN.melihat('Budi'));
    // Bar atas tanpa kode meja (penonton hanya memegang kode tonton).
    expect(akar.querySelector('.bar-atas .info, .info')!.firstElementChild!.textContent).toBe(TEKS_TONTONAN.labelAtas);
    expect(akar.querySelector('.info')!.textContent).not.toContain('TONTN');
    // Menu ☰ juga tanpa kode meja.
    if (!document.getElementById('modal')) document.body.appendChild(Object.assign(document.createElement('div'), { id: 'modal' }));
    akar.querySelector<HTMLButtonElement>('[data-a="menu"]')!.click();
    expect(document.body.textContent).toContain(TEKS_TONTONAN.menuPenonton);
    expect(document.body.textContent).not.toContain('Kode meja: TONTN');
    tutupSemuaJendela();
    const tombol = [...akar.querySelectorAll<HTMLButtonElement>('.tombol-aksi button')];
    expect(tombol.map((b) => b.dataset.a)).toEqual(['berhentiLihat']);
    // Ketuk deck, kartu, buangan, seret, dan pintasan keyboard tidak mengirim apa pun.
    const k = kontrol!;
    k.ketukDeck();
    k.ketukKartu(g.putaran!.tangan[1][0].id);
    k.ketukBuangan(1);
    expect(k.lepasKeBuangan(g.putaran!.tangan[1][0].id)).toBe('abaikan');
    document.body.dispatchEvent(new KeyboardEvent('keydown', { key: 'd', bubbles: true }));
    await tunggu();
    expect(terkirim.filter((p) => p.t !== 'siapJoker')).toEqual([]);
    // Tidak ada tombol jumlah penonton maupun kotak permintaan di layar penonton.
    expect(akar.querySelector('.tombol-penonton')!.classList.contains('tersembunyi')).toBe(true);
    expect(kotakMinta()!.classList.contains('tersembunyi')).toBe(true);
    tombol[0].click();
    expect(berhentiLihat).toHaveBeenCalled();
    kontrol!.hancurkan();
    kontrol = null;
    expect(document.documentElement.dataset.penonton).toBeUndefined();
  });

  it('penanda data-penonton dilepas walau tontonan sudah berakhir sebelum meja dibongkar', async () => {
    const g = permainan();
    let menonton = true;
    pasang({ get penonton() { return menonton; } } as Partial<AppUntukMeja>, infoMeja(g, 1), g);
    await tunggu();
    expect(document.documentElement.dataset.penonton).toBe('1');
    // main.ts keluarTontonan: tontonan dikosongkan, baru meja dibongkar.
    menonton = false;
    kontrol!.hancurkan();
    kontrol = null;
    expect(document.documentElement.dataset.penonton).toBeUndefined();
  });

  it('penonton tidak menimpa urutan tangan tersimpan dan tidak diberi petunjuk/deck giliran', async () => {
    const g = permainan();
    localStorage.setItem('remi.urutanTangan', JSON.stringify(['milikku-1', 'milikku-2']));
    pasang({ penonton: true }, infoMeja(g, 1), g);
    await tunggu();
    expect(akar.querySelector('.petunjuk')!.textContent).toBe('');
    // Pemain yang dilihat mengambil kartu dari deck: tangannya bertambah.
    const h = terapkanAksi(g, { jenis: 'ambilDeck', pemain: 1 } as never);
    expect(h.ok).toBe(true);
    kontrol!.perbarui(null, viewUntuk((h as { state: GameState }).state, 1));
    await tunggu();
    expect(JSON.parse(localStorage.getItem('remi.urutanTangan')!)).toEqual(['milikku-1', 'milikku-2']);
    localStorage.removeItem('remi.urutanTangan');
  });

  it('permintaan untuk kursi yang dilihat tidak pernah tampil ke penonton', async () => {
    const g = permainan();
    pasang({ penonton: true }, infoMeja(g, 1, { penonton: { jumlah: 2, minta: [{ id: 5, nama: 'Tono' }] } }), g);
    await tunggu();
    expect(kotakMinta()!.textContent).toBe('');
  });
});

describe('KontrolMeja pemain: penonton', () => {
  it('kotak permintaan Izinkan/Tolak mengirim jawaban lalu hilang', async () => {
    const g = permainan();
    pasang({}, infoMeja(g, 1, { penonton: { jumlah: 2, minta: [{ id: 3, nama: 'Tono' }, { id: 4, nama: 'Sari' }] } }), g);
    await tunggu();
    const kotak = kotakMinta()!;
    expect(kotak.classList.contains('tersembunyi')).toBe(false);
    expect(kotak.textContent).toContain(TEKS_TONTONAN.permintaan('Tono'));
    kotak.querySelector<HTMLButtonElement>('[data-lihat="izinkan"]')!.click();
    expect(terkirim).toContainEqual({ t: 'jawabLihat', penonton: 3, terima: true });
    // Permintaan berikutnya langsung tampil.
    expect(kotak.textContent).toContain(TEKS_TONTONAN.permintaan('Sari'));
    kotak.querySelector<HTMLButtonElement>('[data-lihat="tolak"]')!.click();
    expect(terkirim).toContainEqual({ t: 'jawabLihat', penonton: 4, terima: false });
    expect(kotak.classList.contains('tersembunyi')).toBe(true);
    const tombol = akar.querySelector<HTMLElement>('.tombol-penonton')!;
    expect(tombol.classList.contains('tersembunyi')).toBe(false);
    expect(tombol.textContent).toBe('👀 2');
  });

  it('kotak permintaan ada di lapisan di luar #ui, jadi tetap bisa dijawab selagi modal terbuka', async () => {
    const g = permainan();
    const ui = document.createElement('div');
    ui.id = 'ui';
    const modal = document.createElement('div');
    modal.id = 'modal';
    document.body.append(ui, modal);
    try {
      pasang({}, infoMeja(g, 1, { penonton: { jumlah: 1, minta: [{ id: 3, nama: 'Tono' }] } }), g);
      await tunggu();
      bukaModal('<p>Hasil putaran</p>');
      expect(ui.inert).toBe(true);
      const lapisan = document.getElementById('lapisan-minta')!;
      expect(lapisan.parentElement).toBe(document.body);
      expect(lapisan.closest('[inert]')).toBeNull();
      kotakMinta()!.querySelector<HTMLButtonElement>('[data-lihat="izinkan"]')!.click();
      expect(terkirim).toContainEqual({ t: 'jawabLihat', penonton: 3, terima: true });
      kontrol!.hancurkan();
      kontrol = null;
      expect(document.getElementById('lapisan-minta')).toBeNull();
    } finally {
      tutupSemuaJendela();
      ui.remove();
      modal.remove();
    }
  });

  it('jawaban dan Hentikan tidak dikirim selagi sambungan belum siap; kotaknya tetap', async () => {
    const g = permainan();
    let siap = false;
    pasang(
      { statusKoneksi: () => (siap ? 'tersambung' : 'terputus'), siapKirim: () => siap },
      infoMeja(g, 1, { penonton: { jumlah: 2, minta: [{ id: 3, nama: 'Tono' }], melihat: [{ id: 7, nama: 'Sari' }] } }),
      g,
    );
    await tunggu();
    kotakMinta()!.querySelector<HTMLButtonElement>('[data-lihat="izinkan"]')!.click();
    expect(terkirim.filter((p) => p.t === 'jawabLihat')).toEqual([]);
    expect(kotakMinta()!.classList.contains('tersembunyi')).toBe(false);
    akar.querySelector<HTMLButtonElement>('.tombol-penonton')!.click();
    const hentikan = document.querySelector<HTMLButtonElement>('[data-hentikan="7"]')!;
    hentikan.click();
    expect(terkirim.filter((p) => p.t === 'hentikanLihat')).toEqual([]);
    expect(hentikan.isConnected && !hentikan.disabled).toBe(true);
    tutupSemuaJendela();

    // Terkirim, tapi lalu ketahuan tidak berangkat (PESAN_TERTAHAN): kotaknya muncul lagi.
    siap = true;
    kotakMinta()!.querySelector<HTMLButtonElement>('[data-lihat="izinkan"]')!.click();
    expect(terkirim).toContainEqual({ t: 'jawabLihat', penonton: 3, terima: true });
    expect(kotakMinta()!.classList.contains('tersembunyi')).toBe(true);
    kontrol!.saatError(false);
    expect(kotakMinta()!.classList.contains('tersembunyi')).toBe(false);
  });

  it('dialog penonton menampilkan yang melihat kartuku dengan tombol Hentikan', async () => {
    const g = permainan();
    pasang({}, infoMeja(g, 1, { penonton: { jumlah: 3, melihat: [{ id: 7, nama: 'Tono' }] } }), g);
    await tunggu();
    const tombol = akar.querySelector<HTMLButtonElement>('.tombol-penonton')!;
    expect(tombol.classList.contains('dilihat')).toBe(true);
    tombol.click();
    const hentikan = document.querySelector<HTMLButtonElement>('[data-hentikan="7"]')!;
    expect(hentikan.closest('li')!.textContent).toContain('Tono');
    hentikan.click();
    expect(terkirim).toContainEqual({ t: 'hentikanLihat', penonton: 7 });
  });

  it('tanpa penonton: tidak ada tombol maupun kotak', async () => {
    const g = permainan();
    pasang({}, infoMeja(g, 1), g);
    await tunggu();
    expect(akar.querySelector('.tombol-penonton')!.classList.contains('tersembunyi')).toBe(true);
    expect(kotakMinta()!.classList.contains('tersembunyi')).toBe(true);
  });
});
