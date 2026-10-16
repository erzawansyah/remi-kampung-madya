// @vitest-environment happy-dom
// Beranda: gerbang simpanan offline, sisipan tombol tanpa gambar ulang, tawaran pasang aplikasi
// (ubin + tombol melayang, keputusan #46), pesan gagal online, dan pendengar preferensi kipas yang
// tidak menumpuk.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// Konstanta build biasanya disuntik Vite (define); di test diisi sebelum modul dimuat.
vi.hoisted(() => {
  Object.assign(globalThis, { __VERSI_APP__: '0.0.0', __BUILD_SHA__: 'dev', __BUILD_WAKTU__: '2026-10-12T00:00:00.000Z' });
});

import { Meja, type InfoMeja, type PesanServer } from '@remi/meja';
import { _setelUlangCache, aturPreferensi } from '../src/preferensi';
import { konfirmasiTimpaSimpanan, renderBeranda, type AksiBeranda, type TawaranPasangBeranda } from '../src/ui/beranda';
import { bukaDialog, tutupDialogTeratas } from '../src/ui/dom';
import { renderLobi } from '../src/ui/lobi';
import { pasangMatchMediaPalsu } from './bantu';

/** Simpanan offline minimal yang dianggap masih bisa dilanjutkan oleh beranda. */
const SIMPANAN = { versi: 1, pengaturan: { jumlahPemain: 5 }, kursi: [], game: { status: 'putaranBerjalan', putaran: { nomor: 2 }, riwayat: [], skor: [40] } };

const aksiPalsu = (): AksiBeranda => ({
  buatMeja: vi.fn(),
  gabung: vi.fn(),
  lihatPublik: vi.fn(),
  lihatRiwayat: vi.fn(),
  mainOffline: vi.fn(),
  lanjutOffline: vi.fn(),
  latihan: vi.fn(),
  bantuan: vi.fn(),
  pengaturan: vi.fn(),
  tentang: vi.fn(),
  pasangAplikasi: null,
  muatUlang: null,
});

const tawaranPalsu = (melayang = true): TawaranPasangBeranda => ({ melayang, pasang: vi.fn(), nanti: vi.fn() });
const melayang = () => document.querySelectorAll('.pasang-melayang');
const ubin = () => document.querySelectorAll('.beranda-nav [data-nav=pasang]');

const tunggu = async () => {
  for (let i = 0; i < 5; i++) await Promise.resolve();
};

beforeEach(() => {
  localStorage.clear();
  localStorage.setItem('remi.preferensi', JSON.stringify({ tutorialSelesai: true }));
  _setelUlangCache();
  pasangMatchMediaPalsu(false);
  document.body.innerHTML =
    '<div id="ui"></div><div id="ui2"></div><div id="game"></div><div id="modal"></div><div id="lapisan-dialog"></div><div id="toast"></div>';
});
afterEach(() => {
  while (tutupDialogTeratas());
  vi.unstubAllGlobals();
});

describe('konfirmasiTimpaSimpanan', () => {
  it('tanpa simpanan: langsung boleh, tanpa dialog', async () => {
    await expect(konfirmasiTimpaSimpanan('Latihan.')).resolves.toBe(true);
    expect(document.querySelector('.dialog.konfirmasi')).toBeNull();
  });

  it('ada simpanan: konfirmasi bahaya menyebut simpanannya; batal = false, setuju = true', async () => {
    localStorage.setItem('remi.mejaOffline', JSON.stringify(SIMPANAN));
    const batal = konfirmasiTimpaSimpanan('Latihan pakai slot simpanan yang sama.');
    const d = document.querySelector<HTMLElement>('.dialog.konfirmasi')!;
    expect(d.textContent).toContain('Hapus permainan yang tersimpan?');
    expect(d.textContent).toContain('5 pemain · putaran 2 · skormu 40');
    expect(d.querySelector('[data-ya]')!.classList.contains('bahaya')).toBe(true);
    // Aksi merusak: fokus awal di tombol batal.
    expect(document.activeElement).toBe(d.querySelector('[data-tidak]'));
    d.querySelector<HTMLElement>('[data-tidak]')!.click();
    await expect(batal).resolves.toBe(false);

    const setuju = konfirmasiTimpaSimpanan('Main baru.');
    document.querySelector<HTMLElement>('.dialog.konfirmasi [data-ya]')!.click();
    await expect(setuju).resolves.toBe(true);
  });

  it('simpanan permainan yang sudah selesai tidak perlu dikonfirmasi', async () => {
    localStorage.setItem('remi.mejaOffline', JSON.stringify({ ...SIMPANAN, game: { ...SIMPANAN.game, status: 'selesai' } }));
    await expect(konfirmasiTimpaSimpanan('Latihan.')).resolves.toBe(true);
  });
});

describe('renderBeranda', () => {
  it('tombol latihan di beranda memakai gerbang yang sama (batal = tidak latihan)', async () => {
    localStorage.setItem('remi.mejaOffline', JSON.stringify(SIMPANAN));
    const aksi = aksiPalsu();
    renderBeranda(document.getElementById('ui')!, aksi);
    document.querySelector<HTMLElement>('#latihan')!.click();
    await tunggu();
    document.querySelector<HTMLElement>('.dialog.konfirmasi [data-tidak]')!.click();
    await tunggu();
    expect(aksi.latihan).not.toHaveBeenCalled();
  });

  it('aturPasang / aturMuatUlang menyisipkan tombol tanpa menggambar ulang (isian & details aman)', () => {
    const aksi = aksiPalsu();
    const b = renderBeranda(document.getElementById('ui')!, aksi);
    const nama = document.querySelector<HTMLInputElement>('#nama')!;
    nama.value = 'Budiman';
    document.querySelector<HTMLDetailsElement>('.atur-meja')!.open = true;
    expect(ubin()).toHaveLength(0);
    expect(melayang()).toHaveLength(0);

    const t = tawaranPalsu();
    b.aturPasang(t);
    b.aturPasang(t); // tidak dobel
    b.aturPasang({ ...t });
    expect(ubin()).toHaveLength(1);
    expect(melayang()).toHaveLength(1);
    expect(document.querySelector('.layar.beranda')!.classList.contains('ada-pasang')).toBe(true);
    const muatUlang = vi.fn();
    b.aturMuatUlang(muatUlang);
    expect(document.querySelector<HTMLInputElement>('#nama')).toBe(nama);
    expect(nama.value).toBe('Budiman');
    expect(document.querySelector<HTMLDetailsElement>('.atur-meja')!.open).toBe(true);

    document.querySelector<HTMLElement>('.beranda-nav [data-nav=pasang] span:last-child')!.click();
    document.querySelector<HTMLElement>('.pasang-melayang [data-nav=pasang] span:last-child')!.click();
    document.querySelector<HTMLElement>('[data-nav=muat-ulang]')!.click();
    expect(t.pasang).toHaveBeenCalledTimes(2);
    expect(t.nanti).not.toHaveBeenCalled();
    expect(muatUlang).toHaveBeenCalledOnce();

    // Ditunda: ubin saja.
    b.aturPasang(tawaranPalsu(false));
    expect(ubin()).toHaveLength(1);
    expect(melayang()).toHaveLength(0);
    expect(document.querySelector('.layar.beranda')!.classList.contains('ada-pasang')).toBe(false);

    b.aturPasang(null);
    expect(ubin()).toHaveLength(0);
    expect(melayang()).toHaveLength(0);
    expect(nama.value).toBe('Budiman');
    // Ubin bawaan tetap jalan lewat pendengar yang sama.
    document.querySelector<HTMLElement>('[data-nav=riwayat]')!.click();
    expect(aksi.lihatRiwayat).toHaveBeenCalledOnce();
  });

  it('tawaran awal: melayang = ubin + tombol; ditunda = ubin saja; null = tidak ada apa-apa', () => {
    const ui = document.getElementById('ui')!;
    renderBeranda(ui, { ...aksiPalsu(), pasangAplikasi: tawaranPalsu(true) });
    expect([ubin().length, melayang().length]).toEqual([1, 1]);
    const m = melayang()[0]!;
    expect(m.tagName).toBe('ASIDE');
    expect(m.getAttribute('aria-label')).toBe('Pasang aplikasi');
    expect(m.querySelector('[data-pasang-nanti]')!.getAttribute('aria-label')).toBe('Nanti saja, sembunyikan 3 hari');
    expect(m.querySelector('[data-nav=pasang]')!.textContent).toContain('Pasang aplikasi');
    expect(m.querySelectorAll('button')).toHaveLength(2);

    renderBeranda(ui, { ...aksiPalsu(), pasangAplikasi: tawaranPalsu(false) });
    expect([ubin().length, melayang().length]).toEqual([1, 0]);
    renderBeranda(ui, aksiPalsu());
    expect([ubin().length, melayang().length]).toEqual([0, 0]);
  });

  it('kunjungan pertama (kartu "Warga baru, ya?"): ubin saja, tanpa tombol melayang; beranda berikutnya baru ada', () => {
    localStorage.setItem('remi.preferensi', JSON.stringify({}));
    _setelUlangCache();
    const ui = document.getElementById('ui')!;
    const b = renderBeranda(ui, { ...aksiPalsu(), pasangAplikasi: tawaranPalsu(true) });
    expect(document.querySelector('.tawaran-latihan')).not.toBeNull();
    expect([ubin().length, melayang().length]).toEqual([1, 0]);
    expect(document.querySelector('.layar.beranda')!.classList.contains('ada-pasang')).toBe(false);
    // Prompt browser datang belakangan (main.ts memanggil aturPasang): tetap tanpa tombol melayang.
    b.aturPasang(tawaranPalsu(true));
    expect(melayang()).toHaveLength(0);
    // Kartu latihan ditutup "Nanti saja": tombol pasang tidak langsung menyusul di layar yang sama.
    document.querySelector<HTMLElement>('#tawaran-nanti')!.click();
    b.aturPasang(tawaranPalsu(true));
    expect(melayang()).toHaveLength(0);
    // Beranda berikutnya (tutorial sudah ditandai selesai): tombol melayang muncul.
    renderBeranda(ui, { ...aksiPalsu(), pasangAplikasi: tawaranPalsu(true) });
    expect(document.querySelector('.tawaran-latihan')).toBeNull();
    expect([ubin().length, melayang().length]).toEqual([1, 1]);
  });

  it('"Nanti saja" memanggil nanti(), menyembunyikan tombol melayang, fokus pindah ke ubin menu', () => {
    const t = tawaranPalsu();
    renderBeranda(document.getElementById('ui')!, { ...aksiPalsu(), pasangAplikasi: t });
    const nanti = document.querySelector<HTMLElement>('.pasang-melayang [data-pasang-nanti]')!;
    nanti.focus();
    nanti.click();
    expect(t.nanti).toHaveBeenCalledOnce();
    expect(t.pasang).not.toHaveBeenCalled();
    expect(melayang()).toHaveLength(0);
    expect(ubin()).toHaveLength(1);
    expect(document.activeElement).toBe(ubin()[0]);
    // Ubin tetap memanggil pasang() yang sama.
    (ubin()[0] as HTMLElement).click();
    expect(t.pasang).toHaveBeenCalledOnce();
  });

  it('tombol melayang hilang saat sedang difokus: fokus tidak jatuh ke <body>', () => {
    const b = renderBeranda(document.getElementById('ui')!, { ...aksiPalsu(), pasangAplikasi: tawaranPalsu() });
    document.querySelector<HTMLElement>('.pasang-melayang [data-nav=pasang]')!.focus();
    b.aturPasang(tawaranPalsu(false));
    expect(document.activeElement).toBe(ubin()[0]);
    document.querySelector<HTMLElement>('.beranda-nav [data-nav=pasang]')!.focus();
    b.aturPasang(null);
    expect(document.activeElement).toBe(document.querySelector('[data-nav=bantuan]'));
  });

  it('tombol melayang = anak terakhir .layar.beranda, sesudah .beranda-kaki dan di luar area grid', () => {
    renderBeranda(document.getElementById('ui')!, { ...aksiPalsu(), pasangAplikasi: tawaranPalsu() });
    const layar = document.querySelector<HTMLElement>('#ui > .layar.beranda')!;
    const m = melayang()[0]!;
    expect(layar.lastElementChild).toBe(m);
    expect(m.parentElement).toBe(layar);
    expect(m.closest('.beranda-isi, .beranda-sisi, .beranda-aksi, .kartu-kedai')).toBeNull();
    const kaki = document.querySelector('.beranda-kaki')!;
    expect(kaki.compareDocumentPosition(m) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    // Urutan Tab: tombol melayang paling akhir, sesudah semua isi beranda.
    const fokus = [...document.querySelectorAll<HTMLElement>('a[href], button, input, select, summary')];
    expect(fokus.slice(-2)).toEqual([...m.querySelectorAll('button')]);
  });

  it('#ui (termasuk tombol melayang) inert selama dialog bukaDialog terbuka', () => {
    renderBeranda(document.getElementById('ui')!, { ...aksiPalsu(), pasangAplikasi: tawaranPalsu() });
    const ui = document.getElementById('ui')!;
    const d = bukaDialog('<h2>Uji</h2><button type="button" data-tutup>Tutup</button>');
    expect(ui.inert).toBe(true);
    expect(melayang()[0]!.closest('[inert]')).toBe(ui);
    d.tutup();
    expect(ui.inert).toBe(false);
  });

  it('pindah ke lobi: tombol melayang ikut hilang (lobi tidak pernah memuatnya)', () => {
    renderBeranda(document.getElementById('ui')!, { ...aksiPalsu(), pasangAplikasi: tawaranPalsu() });
    expect(melayang()).toHaveLength(1);
    let info: InfoMeja | null = null;
    const meja = Meja.buat(
      { kode: 'ABCDE', penjadwal: { setel: () => 0, batal: () => undefined, sekarang: () => 0 }, kirim: (_: string, p: PesanServer) => p.t === 'meja' && (info = p.info) },
      'host',
      'Budi',
      { jumlahPemain: 3 },
    );
    meja.hentikan();
    renderLobi(document.getElementById('ui')!, info!, vi.fn(), vi.fn());
    expect(document.querySelector('.layar-lobi')).not.toBeNull();
    expect(melayang()).toHaveLength(0);
    expect(document.querySelector('[data-nav=pasang], [data-pasang-nanti]')).toBeNull();
  });

  it("status 'gagal': pesan + Coba lagi di panel online; status lain menyembunyikannya", () => {
    const b = renderBeranda(document.getElementById('ui')!, aksiPalsu());
    const info = document.querySelector<HTMLElement>('#info-gagal')!;
    const coba = document.querySelector<HTMLElement>('#coba-lagi')!;
    expect(info.classList.contains('tersembunyi')).toBe(true);
    const ulang = vi.fn();
    b.aturStatusOnline('gagal', ulang);
    expect(info.classList.contains('tersembunyi')).toBe(false);
    expect(coba.classList.contains('tersembunyi')).toBe(false);
    expect(document.querySelector('#status-online')!.textContent).toBe('Server belum bisa dihubungi');
    coba.click();
    expect(ulang).toHaveBeenCalledOnce();
    b.aturStatusOnline('menyambung');
    expect(info.classList.contains('tersembunyi')).toBe(true);
    // Gagal tanpa niat yang bisa diulang: pesan tampil, tombol tidak.
    b.aturStatusOnline('gagal', null);
    expect(info.classList.contains('tersembunyi')).toBe(false);
    expect(coba.classList.contains('tersembunyi')).toBe(true);
  });

  it('urutan DOM = urutan baca HP: hero → tawaran → main → online → menu → kaki', () => {
    localStorage.setItem('remi.preferensi', JSON.stringify({ tutorialSelesai: false }));
    _setelUlangCache();
    renderBeranda(document.getElementById('ui')!, aksiPalsu());
    const urutan = [...document.querySelectorAll('.beranda-hero, .tawaran-latihan, .panel-main, .panel-online, .beranda-nav, .beranda-kaki')].map(
      (e) => e.className.split(' ').find((k) => /^(beranda-|tawaran-|panel-)/.test(k)),
    );
    expect(urutan).toEqual(['beranda-hero', 'tawaran-latihan', 'panel-main', 'panel-online', 'beranda-nav', 'beranda-kaki']);
    // Tombol pertama yang dicapai Tab ada di tawaran/panel main, bukan menu.
    const tombol = [...document.querySelectorAll<HTMLElement>('button, input, select, summary')];
    expect(tombol.findIndex((b) => b.dataset.nav === 'bantuan')).toBeGreaterThan(tombol.findIndex((b) => b.id === 'publik'));
  });

  it('simpanan latihan: tombol berbunyi "Lanjutkan latihan", simpanan biasa tetap "Lanjutkan permainan"', () => {
    localStorage.setItem('remi.mejaOffline', JSON.stringify(SIMPANAN));
    renderBeranda(document.getElementById('ui')!, aksiPalsu());
    expect(document.querySelector('#lanjut')!.textContent).toContain('Lanjutkan permainan');
    expect(document.querySelector('#lanjut')!.textContent).toContain('5 pemain · putaran 2 · skormu 40');

    localStorage.setItem('remi.latihanTersimpan', '1');
    renderBeranda(document.getElementById('ui')!, aksiPalsu());
    const lanjut = document.querySelector('#lanjut')!;
    expect(lanjut.textContent).toContain('Lanjutkan latihan');
    expect(lanjut.textContent).toContain('dengan panduan · putaran 2');
    expect(lanjut.textContent).not.toContain('Lanjutkan permainan');
  });

  it('remi.riwayat = null (rusak) tidak membuat beranda pemain baru melempar error', () => {
    localStorage.setItem('remi.preferensi', JSON.stringify({ tutorialSelesai: false }));
    localStorage.setItem('remi.riwayat', 'null');
    _setelUlangCache();
    expect(() => renderBeranda(document.getElementById('ui')!, aksiPalsu())).not.toThrow();
    expect(document.querySelector('.tawaran-latihan')).not.toBeNull();
  });

  it('pendengar preferensi kipas: dilepas saat beranda digambar ulang atau lepas()', () => {
    const kanvasPertama = (akar: HTMLElement) => akar.querySelector('.kipas canvas');
    const ui = document.getElementById('ui')!;
    const ui2 = document.getElementById('ui2')!;

    // Beranda lama tetap menempel di DOM (kasus terburuk): gambar ulang di akar lain tetap melepas pendengarnya.
    renderBeranda(ui, aksiPalsu());
    const lama = kanvasPertama(ui);
    const b2 = renderBeranda(ui2, aksiPalsu());
    const baru = kanvasPertama(ui2);
    aturPreferensi({ warnaKartu: 'empat' });
    expect(kanvasPertama(ui)).toBe(lama); // beranda lama tidak mendengar lagi
    expect(kanvasPertama(ui2)).not.toBe(baru); // beranda aktif menggambar ulang kipas

    const sesudah = kanvasPertama(ui2);
    b2.lepas();
    b2.lepas(); // aman dipanggil berulang
    aturPreferensi({ warnaKartu: 'dua' });
    expect(kanvasPertama(ui2)).toBe(sesudah);
  });
});
