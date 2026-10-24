// @vitest-environment happy-dom
// KontrolMeja (layar meja HTML) dengan scene palsu dan mesin aturan asli:
// - keyboard: satu giliran penuh tanpa mouse (ambil deck → sorot → pilih → buang), pintasan,
//   alasan penolakan, Escape;
// - umpan balik tolak (scene.tolak + bunyi/getar 'tolak');
// - label mentung dari validasiBuang mesin aturan (bukan hitungan sendiri);
// - nutup pakai beberapa joker (#41): tombol, kirim, pintasan B, seret, alasan penolakan dari
//   validasiBuang, panel "PENTUNG 2 JOKER!", dan pagar kebocoran (sebelum memilih, tangan dua joker
//   hidup dan tangan dua kartu biasa tampil sama persis);
// - fokus tombol bertahan saat render ulang dengan isi sama;
// - popup joker (autofocus OK, tidak dibuka ulang sambil menunggu server, siapJoker yang hilang
//   karena sinyal putus dikirim ulang sekali per sambungan baru);
// - setelah hancurkan(): tidak ada render/kirim lagi;
// - pengumuman pembaca layar tidak menyebut angka joker maupun kartu yang dibuang lawan;
// - mode kaldu (#42): bar atas dan judul popup joker "Putaran N · Kaldu", tombol voting "Putaran
//   terakhir" di modal hasil (online n/m, offline langsung berlaku), baris pendek "Putaran berikutnya
//   kaldu." / "Belum ada yang mentung, kaldu lagi.", lencana ×2 di panel mentung, alasan di klasemen.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  buatPermainan,
  migrasiState,
  namaKartu,
  namaRank,
  terapkanAksi,
  viewUntuk,
  type Aksi,
  type GameState,
  type ViewPemain,
} from '@remi/engine';
import { PENGATURAN_BAWAAN, type InfoMeja, type PesanKlien } from '@remi/meja';
import { ctx, id, kartuJadi, semuaSelesaiSusun, skenario, spek, type Skenario } from '../../../packages/engine/test/bantu';

vi.mock('../src/efek/suara', () => ({ bunyi: vi.fn(), getar: vi.fn() }));
vi.mock('../src/efek/sorak', () => ({ sorak: vi.fn(async () => {}), bersihkanSorak: vi.fn() }));
// Jendela milik modul lain (dan konstanta build Vite di dalamnya) tidak dibutuhkan di sini.
vi.mock('../src/ui/pengaturan', () => ({ bukaPengaturan: vi.fn() }));
vi.mock('../src/ui/bantuan', () => ({ bukaBantuan: vi.fn() }));
vi.mock('../src/ui/tentang', () => ({ bukaTentang: vi.fn() }));
vi.mock('../src/ui/dom', async (asli) => ({ ...(await asli<typeof import('../src/ui/dom')>()), umumkan: vi.fn() }));

import { LAMA_HANTAM } from '../src/efek/retak';
import { bunyi, getar } from '../src/efek/suara';
import { durasi } from '../src/gerak';
import { tutupDialogTeratas, tutupModal, umumkan } from '../src/ui/dom';
import {
  geserFokus,
  KontrolMeja,
  peristiwaAwalPerluDiputar,
  perluKirimUlangSiapJoker,
  PINTASAN_HURUF,
  teksBarAtas,
  teksInfoKaldu,
  type AppUntukMeja,
} from '../src/kontrolMeja';
import { TEKS_KALDU } from '../src/konten/kaldu';
import { KEDAI } from '../src/konten/kedai';
import { TEKS_TUTORIAL } from '../src/konten/tutorial';
import { _setelUlangCache, preferensi } from '../src/preferensi';
import { mejaMasukPeringkat, opsiKonfirmasiKeluar } from '../src/ui/lobi';
import type { MejaScene, ModelMeja } from '../src/game/MejaScene';
import type { StatusKoneksi } from '../src/koneksi';

// ---------- perlengkapan ----------

interface ScenePalsu {
  scene: MejaScene;
  model: () => ModelMeja | null;
  tolak: string[];
  ruang: [number, number][];
  jumlahPasang: () => number;
  /** Nama metode animasi yang dipanggil (selain pasang/tolak/aturRuang/posisi*). */
  panggil: string[];
  /** Ganti perilaku satu metode animasi (mis. bagiKartu yang ditahan). */
  ganti: Record<string, (...args: unknown[]) => unknown>;
}

/** Scene palsu: animasi langsung selesai, posisi (0,0); pasang/tolak/aturRuang dicatat. */
function scenePalsu(): ScenePalsu {
  let model: ModelMeja | null = null;
  let pasang = 0;
  const tolak: string[] = [];
  const ruang: [number, number][] = [];
  const titik = { x: 0, y: 0, w: 10 };
  const panggil: string[] = [];
  const ganti: Record<string, (...args: unknown[]) => unknown> = {};
  const scene = new Proxy({} as MejaScene, {
    get(_, metode) {
      if (metode === 'posisiDeck' || metode === 'posisiBuangan') return titik;
      if (typeof metode !== 'string' || metode === 'then') return undefined;
      return (...args: unknown[]) => {
        if (metode === 'pasang') {
          model = args[0] as ModelMeja | null;
          pasang++;
          return;
        }
        if (metode === 'tolak') return void tolak.push(args[0] as string);
        if (metode === 'aturRuang') return void ruang.push([args[0] as number, args[1] as number]);
        if (metode === 'kotakLayar') return null;
        if (metode.startsWith('posisi')) return titik;
        panggil.push(metode);
        if (ganti[metode]) return ganti[metode](...args);
        for (const a of args) if (typeof a === 'function') (a as () => void)();
        return Promise.resolve(metode === 'naikPanggung' ? [] : undefined);
      };
    },
  });
  return { scene, model: () => model, tolak, ruang, jumlahPasang: () => pasang, panggil, ganti };
}

function infoMeja(g: GameState, ubah: Partial<InfoMeja> = {}): InfoMeja {
  return {
    kode: 'UJI01',
    status: 'main',
    pengaturan: { ...PENGATURAN_BAWAAN, jumlahPemain: g.pemain.length, detikGiliran: 0 },
    kursi: g.pemain.map((p, i) => ({ jenis: i === 0 ? 'manusia' : 'bot', nama: p.nama, terhubung: true, level: 'normal' })),
    host: 0,
    kursiSaya: 0,
    setujuAkhiri: [],
    batasWaktu: null,
    diambilAlihBot: false,
    menungguJoker: [],
    botMikir: null,
    ...ubah,
  };
}

/** Meja uji: mesin aturan asli; pesan aksi dari KontrolMeja langsung diterapkan lalu view baru dikirim. */
class MejaUji {
  terkirim: PesanKlien[] = [];
  /** true = server diam (pesan dicatat, tidak dijawab), meniru koneksi online yang lambat. */
  diam = false;
  readonly sp = scenePalsu();
  readonly akar = document.createElement('div');
  readonly kontrol: KontrolMeja;
  readonly app: AppUntukMeja;
  info: InfoMeja;

  constructor(
    public g: GameState,
    infoUbah: Partial<InfoMeja> = {},
    appUbah: Partial<AppUntukMeja> = {},
  ) {
    document.body.appendChild(this.akar);
    this.info = infoMeja(g, infoUbah);
    this.app = {
      jenis: 'offline',
      kirim: (p) => {
        this.terkirim.push(p);
        if (this.diam) return;
        if (p.t === 'putaranBerikut') {
          // Meja memulai putaran berikutnya; semua menunggu pengumuman joker.
          const h = terapkanAksi(this.g, { jenis: 'mulaiPutaran', pengocok: p.pengocok });
          if (!h.ok) throw new Error(`putaran berikut ditolak mesin: ${h.error.pesan}`);
          this.g = h.state;
          this.info = { ...this.info, menungguJoker: [0] };
          this.kontrol.perbarui(this.info, this.view());
        }
        if (p.t === 'aksi') {
          const h = terapkanAksi(this.g, { ...p.aksi, pemain: 0 } as Aksi);
          if (!h.ok) throw new Error(`aksi ditolak mesin: ${h.error.pesan}`);
          this.g = h.state;
          this.kontrol.perbarui(null, this.view());
        }
        if (p.t === 'putaranTerakhir' && p.setuju) {
          // Meja dengan satu manusia (offline): voting kaldu langsung berlaku.
          const h = terapkanAksi(this.g, { jenis: 'putaranTerakhir' });
          if (!h.ok) throw new Error(`putaran terakhir ditolak mesin: ${h.error.pesan}`);
          this.g = h.state;
          this.info = { ...this.info, setujuKaldu: [] };
          this.kontrol.perbarui(this.info, this.view());
        }
      },
      keluarMeja: vi.fn(),
      mainLagiOffline: vi.fn(),
      ...appUbah,
    };
    this.kontrol = new KontrolMeja(this.app, this.sp.scene, this.akar);
    this.kontrol.perbarui(this.info, this.view());
  }

  view(): ViewPemain {
    return viewUntuk(this.g, 0);
  }

  get aksi() {
    return this.terkirim.flatMap((p) => (p.t === 'aksi' ? [p.aksi] : []));
  }

  tombol(a: string) {
    return this.akar.querySelector<HTMLButtonElement>(`.tombol-aksi [data-a="${a}"]`);
  }

  petunjuk() {
    return this.akar.querySelector('.petunjuk')!.textContent;
  }

  hancurkan() {
    this.kontrol.hancurkan();
    this.akar.remove();
  }
}

/**
 * Tombol modal hasil yang sedang menunggu dikunci lewat aria-disabled (bukan `disabled`, yang
 * melepas fokus keyboard ke <body>). Pastikan juga `disabled` tidak pernah dipakai.
 */
const terkunci = (b: HTMLButtonElement): boolean => {
  expect(b.disabled).toBe(false);
  return b.getAttribute('aria-disabled') === 'true';
};

const tekan = (key: string, target: EventTarget = document.body, repeat = false) =>
  target.dispatchEvent(new KeyboardEvent('keydown', { key, repeat, bubbles: true, cancelable: true }));

/** Tunggu antrian animasi (promise palsu) selesai. */
const tunggu = () => new Promise((r) => setTimeout(r, 0));

/** Permainan 4 pemain baru dengan giliran pertama di kursi 0 (aku). */
function permainanGiliranku(konfigurasi?: Parameters<typeof buatPermainan>[0]['konfigurasi']): GameState {
  for (let pengocok = 0; pengocok < 4; pengocok++) {
    const g0 = buatPermainan({ pemain: ['Aku', 'Bot 1', 'Bot 2', 'Bot 3'], seed: 7, konfigurasi });
    const h = terapkanAksi(g0, { jenis: 'mulaiPutaran', pengocok });
    if (h.ok && h.state.putaran!.giliran === 0) return h.state;
  }
  throw new Error('tidak ketemu pengocok yang membuat giliran kursi 0');
}

let meja: MejaUji | null = null;

// Timer yang dipasang selama satu test (kode meja, pemutar, atau test-nya sendiri). Sebagian tidak ikut
// dibatalkan hancurkan(), misalnya setTimeout 500 ms pelepas kelas "goyang" milik pemutar saat mentung.
// Kalau test terakhir file ini baru saja mentung, timer itu bisa jalan setelah env happy-dom dibongkar
// (ReferenceError: document is not defined, muncul sebagai "Errors 1" di npm test yang padat).
// Semua yang masih menunggu dibatalkan di afterEach, sesudah meja dihancurkan.
const setTimeoutAsli = globalThis.setTimeout;
const timerTest = new Set<Parameters<typeof clearTimeout>[0]>();
beforeEach(() => {
  vi.spyOn(globalThis, 'setTimeout').mockImplementation(((fn: () => void, ms?: number, ...arg: unknown[]) => {
    const t = setTimeoutAsli(fn, ms, ...arg);
    timerTest.add(t);
    return t;
  }) as unknown as typeof setTimeout);
  if (!document.getElementById('modal')) {
    const modal = document.createElement('div');
    modal.id = 'modal';
    document.body.appendChild(modal);
  }
  vi.mocked(bunyi).mockClear();
  vi.mocked(getar).mockClear();
  vi.mocked(umumkan).mockClear();
});
afterEach(() => {
  meja?.hancurkan();
  meja = null;
  tutupModal();
  while (tutupDialogTeratas());
  timerTest.forEach((t) => clearTimeout(t));
  timerTest.clear();
  vi.mocked(globalThis.setTimeout).mockRestore();
  document.body.classList.remove('goyang');
});

// ---------- geserFokus (murni) ----------

describe('geserFokus', () => {
  const deret = ['a', 'b', 'c'];
  it('kiri/kanan berhenti di ujung, tanpa berputar', () => {
    expect(geserFokus('a', 'kiri', deret)).toBe('a');
    expect(geserFokus('a', 'kanan', deret)).toBe('b');
    expect(geserFokus('c', 'kanan', deret)).toBe('c');
    expect(geserFokus('b', 'awal', deret)).toBe('a');
    expect(geserFokus('a', 'akhir', deret)).toBe('c');
  });
  it('atas dari tangan ke deck; deck ↔ buangan; bawah kembali ke indeks yang diingat', () => {
    expect(geserFokus('b', 'atas', deret)).toBe('deck');
    expect(geserFokus('deck', 'kanan', deret)).toBe('buangan');
    expect(geserFokus('buangan', 'kiri', deret)).toBe('deck');
    expect(geserFokus('buangan', 'bawah', deret, 1)).toBe('b');
    expect(geserFokus('deck', 'atas', deret)).toBe('deck');
  });
  it('mulai dari kosong / kartu yang sudah hilang: pakai indeks yang diingat', () => {
    expect(geserFokus(null, 'kanan', deret)).toBe('a');
    expect(geserFokus('hilang', 'kanan', deret, 2)).toBe('c');
    expect(geserFokus(null, 'kanan', [])).toBe('deck');
  });
  it('buangan kosong (awal putaran): ↓, Home, dan End membawa sorotan ke tangan', () => {
    expect(geserFokus('buangan', 'bawah', deret, 1, ['buangan'])).toBe('b');
    expect(geserFokus('buangan', 'awal', deret, 1, ['buangan'])).toBe('a');
    expect(geserFokus('buangan', 'akhir', deret, 1, ['buangan'])).toBe('c');
    // Kiri/kanan tetap di baris tengah; buangan berisi tetap seperti biasa.
    expect(geserFokus('buangan', 'kiri', deret, 1, ['buangan'])).toBe('deck');
    expect(geserFokus('buangan', 'awal', deret, 1, [])).toBe('deck');
    // Tangan kosong: sorotan tidak ke mana-mana.
    expect(geserFokus('buangan', 'awal', [], 0, ['buangan'])).toBe('deck');
  });
  it('deck yang tidak bisa diambil (bukan tahap ambil, deck habis): ↓, Home, End ke tangan', () => {
    expect(geserFokus('deck', 'bawah', deret, 2, ['deck'])).toBe('c');
    expect(geserFokus('deck', 'awal', deret, 2, ['deck'])).toBe('a');
    expect(geserFokus('deck', 'akhir', deret, 0, ['deck'])).toBe('c');
    expect(geserFokus('deck', 'kanan', deret, 0, ['deck'])).toBe('buangan');
    // Deck masih bisa diambil: Home tetap di baris tengah.
    expect(geserFokus('deck', 'awal', deret, 0, ['buangan'])).toBe('deck');
  });
  it('pintasan huruf tidak bentrok dan semuanya huruf tunggal', () => {
    const huruf = Object.keys(PINTASAN_HURUF);
    expect(new Set(Object.values(PINTASAN_HURUF)).size).toBe(huruf.length);
    for (const h of huruf) expect(h).toMatch(/^[a-z]$/);
  });
});

// ---------- keyboard ----------

describe('main dengan keyboard saja', () => {
  it('ambil deck (D) → sorot kartu (panah) → pilih (Spasi) → buang (B)', async () => {
    meja = new MejaUji(permainanGiliranku());
    expect(meja.tombol('ambil')).not.toBeNull();
    tekan('d');
    await tunggu();
    expect(meja.aksi).toEqual([{ jenis: 'ambilDeck' }]);
    expect(meja.g.putaran!.tahap).toBe('main');

    // Sorot kartu pertama yang bukan As (As belum boleh dibuang tanpa kartu jadi).
    tekan('ArrowRight');
    const tangan = meja.sp.model()!.tangan;
    const target = tangan.findIndex((k) => k.rank !== 1);
    for (let i = 0; i < target; i++) tekan('ArrowRight');
    const kartu = tangan[target];
    expect(meja.sp.model()!.fokus).toBe(kartu.id);
    expect(vi.mocked(umumkan).mock.calls.at(-1)![0]).toContain(namaKartu(kartu));

    tekan(' ');
    expect(meja.sp.model()!.dipilih.has(kartu.id)).toBe(true);
    expect(vi.mocked(umumkan).mock.calls.at(-1)![0]).toContain(`Dipilih: ${namaKartu(kartu)}`);

    tekan('b');
    await tunggu();
    expect(meja.aksi.at(-1)).toEqual({ jenis: 'buang', kartuId: kartu.id });
    expect(meja.g.putaran!.giliran).not.toBe(0);
    // Sorotan pindah ke kartu terdekat yang masih ada.
    expect(meja.sp.model()!.fokus).not.toBe(kartu.id);
  });

  it('Enter di deck yang disorot = ambil deck (entry point yang sama dengan ketuk)', async () => {
    meja = new MejaUji(permainanGiliranku());
    tekan('ArrowUp');
    expect(meja.sp.model()!.fokus).toBe('deck');
    tekan('Enter');
    await tunggu();
    expect(meja.aksi).toEqual([{ jenis: 'ambilDeck' }]);
  });

  it('pintasan yang belum sah: ditolak dengan alasan, goyang, bunyi dan getar tolak', () => {
    meja = new MejaUji(permainanGiliranku());
    tekan('b'); // masih tahap ambil: tombol buang belum ada
    expect(meja.aksi).toEqual([]);
    expect(meja.petunjuk()).toBe('Ambil kartu dulu (dari deck atau mulung).');
    expect(meja.sp.tolak).toEqual(['tangan']);
    expect(bunyi).toHaveBeenCalledWith('tolak');
    expect(getar).toHaveBeenCalledWith('tolak');
    expect(umumkan).toHaveBeenCalledWith('Ambil kartu dulu (dari deck atau mulung).');
  });

  it('tombol mati yang diklik juga menjelaskan alasannya (dan tidak mengirim apa pun)', async () => {
    meja = new MejaUji(permainanGiliranku());
    tekan('d');
    await tunggu();
    meja.tombol('buang')!.click();
    expect(meja.aksi).toEqual([{ jenis: 'ambilDeck' }]);
    expect(meja.petunjuk()).toBe('Pilih kartu yang mau dibuang.');
    expect(meja.sp.tolak.at(-1)).toBe('tangan');
  });

  it('angka = mungut sejumlah kartu teratas; lebih dari batas ditolak', async () => {
    const g = skenario({
      rankJoker: 2,
      tangan: [['5 love', '6 love', '9 waru', 'K kriting'], ['3 waru', '4 waru', '5 waru'], ['3 love', '4 love', '8 waru'], ['J love', 'Q love', '10 waru']],
      buangan: [
        ['9 kriting', 1],
        ['8 kriting', 2],
        ['7 love', 3],
      ],
      giliran: 0,
    });
    meja = new MejaUji(g);
    tekan('9');
    expect(meja.petunjuk()).toBe('Paling banyak mungut 3 kartu.');
    expect(meja.sp.tolak.at(-1)).toBe('buangan');
    tekan('1');
    expect(meja.sp.model()!.mulung?.jumlah).toBe(1);
    tekan('Escape');
    expect(meja.sp.model()!.mulung).toBeNull();
  });

  it('awal putaran, sorotan tertinggal di buangan kosong: Esc, ↓, Home, →, Spasi memilih kartu kedua', () => {
    meja = new MejaUji(permainanGiliranku());
    expect(meja.g.putaran!.buangan).toHaveLength(0);
    tekan('ArrowUp');
    tekan('ArrowRight');
    expect(meja.sp.model()!.fokus).toBe('buangan');
    tekan('Escape');
    expect(meja.sp.model()!.fokus).toBeNull();
    const tangan = meja.sp.model()!.tangan;
    tekan('ArrowDown');
    expect(tangan.map((k) => k.id)).toContain(meja.sp.model()!.fokus);
    tekan('Home');
    expect(meja.sp.model()!.fokus).toBe(tangan[0].id);
    tekan('ArrowRight');
    tekan(' ');
    expect([...meja.sp.model()!.dipilih]).toEqual([tangan[1].id]);
    expect(meja.aksi).toEqual([]);
  });

  it('sudah ambil deck, sorotan masih di deck: Esc, ↓, Home, Spasi memilih kartu paling kiri', async () => {
    meja = new MejaUji(permainanGiliranku());
    tekan('ArrowUp');
    expect(meja.sp.model()!.fokus).toBe('deck');
    tekan('d');
    await tunggu();
    expect(meja.g.putaran!.tahap).toBe('main');
    tekan('Escape');
    tekan('ArrowDown');
    const tangan = meja.sp.model()!.tangan;
    expect(tangan.map((k) => k.id)).toContain(meja.sp.model()!.fokus);
    tekan('Home');
    expect(meja.sp.model()!.fokus).toBe(tangan[0].id);
    tekan(' ');
    expect([...meja.sp.model()!.dipilih]).toEqual([tangan[0].id]);
  });

  it('sorotan deck yang belum tampak: panah pertama sesudah ambil langsung ke tangan', async () => {
    meja = new MejaUji(permainanGiliranku());
    tekan('d');
    await tunggu();
    tekan('ArrowRight');
    expect(meja.sp.model()!.fokus).toBe(meja.sp.model()!.tangan[0].id);
  });

  it('Home dari buangan kosong langsung ke kartu paling kiri', () => {
    meja = new MejaUji(permainanGiliranku());
    tekan('ArrowUp');
    tekan('ArrowRight');
    tekan('Home');
    expect(meja.sp.model()!.fokus).toBe(meja.sp.model()!.tangan[0].id);
  });

  it('Escape melepas semua pilihan', async () => {
    meja = new MejaUji(permainanGiliranku());
    tekan('ArrowRight');
    tekan(' ');
    expect(meja.sp.model()!.dipilih.size).toBe(1);
    tekan('Escape');
    expect(meja.sp.model()!.dipilih.size).toBe(0);
  });

  it('pintasan diabaikan saat mengetik di input atau saat jendela terbuka', () => {
    meja = new MejaUji(permainanGiliranku());
    const input = document.createElement('input');
    document.body.appendChild(input);
    tekan('d', input);
    expect(meja.aksi).toEqual([]);
    input.remove();
    (meja.akar.querySelector('[data-a=menu]') as HTMLElement).click();
    expect(document.querySelector('#modal .dialog')).not.toBeNull();
    tekan('d');
    expect(meja.aksi).toEqual([]);
  });
});

// ---------- pembaca layar: label warga kedai ----------

describe('pengumuman giliran untuk pembaca layar', () => {
  const giliranDiumumkan = () => vi.mocked(umumkan).mock.calls.map(([t]) => t).filter((t) => t.startsWith('Giliran '));

  it('giliran warga kedai diberi label "(warga kedai)"; pemain manusia tidak', async () => {
    meja = new MejaUji(permainanGiliranku());
    tekan('d');
    await tunggu();
    const kartu = meja.sp.model()!.tangan.find((k) => k.rank !== 1)!;
    meja.kontrol['ketukKartu'](kartu.id);
    tekan('b');
    await tunggu();
    const g = meja.g.putaran!.giliran;
    expect(g).not.toBe(0);
    expect(giliranDiumumkan()).toEqual([`Giliran ${meja.g.pemain[g].nama} (warga kedai).`]);
  });

  it('kursi manusia lain (online): nama saja', async () => {
    const g0 = permainanGiliranku();
    meja = new MejaUji(g0, { kursi: g0.pemain.map((p) => ({ jenis: 'manusia', nama: p.nama, terhubung: true, level: 'normal' })) });
    tekan('d');
    await tunggu();
    const kartu = meja.sp.model()!.tangan.find((k) => k.rank !== 1)!;
    meja.kontrol['ketukKartu'](kartu.id);
    tekan('b');
    await tunggu();
    const g = meja.g.putaran!.giliran;
    expect(giliranDiumumkan()).toEqual([`Giliran ${meja.g.pemain[g].nama}.`]);
    for (const [t] of vi.mocked(umumkan).mock.calls) expect(t).not.toMatch(/warga kedai/);
  });
});

describe('pengumuman koneksi untuk pembaca layar', () => {
  const PESAN_KONEKSI = /Koneksi putus|Tersambung lagi|Server nggak bisa dihubungi/;
  const koneksiDiumumkan = () => vi.mocked(umumkan).mock.calls.map(([t]) => t).filter((t) => PESAN_KONEKSI.test(t));

  it('putus lalu sambung ulang yang gagal berkali-kali: tepat dua pengumuman (putus, tersambung lagi)', async () => {
    let status: StatusKoneksi = 'tersambung';
    meja = new MejaUji(permainanGiliranku(), {}, { jenis: 'online', statusKoneksi: () => status });
    await tunggu();
    // Seperti KoneksiOnline: setiap percobaan sambung ulang yang gagal mengulang menyambung → terputus.
    const deret: StatusKoneksi[] = ['terputus', 'menyambung', 'terputus', 'menyambung', 'terputus', 'menyambung', 'tersambung'];
    for (const s of deret) {
      status = s;
      meja.kontrol.perbarui(meja.info, null);
    }
    expect(koneksiDiumumkan()).toEqual(['Koneksi putus, lagi nyambung ulang.', 'Tersambung lagi.']);
    // Lencana bar atas tetap mengikuti status terkini.
    expect(meja.akar.querySelector('.status-koneksi')!.classList.contains('tersembunyi')).toBe(true);
  });

  it('status pertama tidak diumumkan; meja dibuka saat putus tetap mengumumkan "Tersambung lagi."', async () => {
    let status: StatusKoneksi = 'terputus';
    meja = new MejaUji(permainanGiliranku(), {}, { jenis: 'online', statusKoneksi: () => status });
    await tunggu();
    expect(koneksiDiumumkan()).toEqual([]);
    expect(meja.akar.querySelector('.status-koneksi')!.textContent).toContain('Terputus');
    status = 'menyambung';
    meja.kontrol.perbarui(meja.info, null);
    status = 'tersambung';
    meja.kontrol.perbarui(meja.info, null);
    expect(koneksiDiumumkan()).toEqual(['Tersambung lagi.']);
  });
});

// ---------- mulung lalu mentung (label dari validasiBuang) ----------

describe('mentung', () => {
  it('label tombol buang mengikuti hasil validasiBuang: mentung hanya setelah mulung dengan 1 kartu', async () => {
    const g = skenario({
      rankJoker: 2,
      tangan: [['5 love', '6 love', '9 waru'], ['3 waru', '4 waru', '5 waru'], ['3 love', '4 love', '8 waru'], ['J love', 'Q love', '10 waru']],
      buangan: [['7 love', 1]],
      giliran: 0,
    });
    meja = new MejaUji(g);
    // Mulung lewat pesan langsung (bagian UI mulung sendiri diuji lewat alur keyboard di atas).
    meja.app.kirim({ t: 'aksi', aksi: { jenis: 'mulung', jumlah: 1, kartuJadi: [spek('5 love', '6 love', '7 love')] } });
    await tunggu();
    expect(meja.g.putaran!.tahap).toBe('main');
    expect(meja.tombol('buang')!.textContent).toContain('Pilih kartu buat mentung');
    expect(meja.petunjuk()).toBe('Tinggal satu kartu: buang untuk mentung!');
    tekan('ArrowRight');
    tekan(' ');
    expect(meja.tombol('buang')!.textContent).toContain('Mentung pakai 9♠!');
  });

  it('tanpa mulung (ambil deck) label tetap "Buang", bukan mentung', async () => {
    meja = new MejaUji(permainanGiliranku());
    tekan('d');
    await tunggu();
    expect(meja.tombol('buang')!.textContent).toContain('Pilih kartu');
    expect(meja.tombol('buang')!.textContent).not.toContain('mentung');
  });
});

// ---------- keputusan #41: nutup pakai beberapa joker ----------

describe('#41: nutup pakai beberapa joker', () => {
  const PESAN_SATU_KARTU = 'Buangnya satu kartu aja, Bos. Lebih dari satu cuma boleh buat nutup, dan semua sisa kartumu harus ikut dibuang.';
  const PESAN_TANPA_MULUNG = 'Nutup cuma sah kalau giliran ini kamu mulung.';
  const PESAN_BUKAN_JOKER = 'Nutup pakai beberapa kartu cuma boleh kalau semuanya joker. Joker yang sudah pernah dibuang dihitung kartu biasa.';

  /**
   * Joker 7. Aku mulung 4 Love (punya kursi 1) dengan 5-6 Love; sisa tanganku `sisa`
   * (mis. 7 Waru + 7 Kriting = dua joker hidup, atau dua kartu biasa).
   */
  async function mejaSesudahMulung(sisa: string[], infoUbah: Partial<InfoMeja> = {}): Promise<MejaUji> {
    const g = skenario({
      rankJoker: 7,
      tangan: [['5 love', '6 love', ...sisa], ['3 waru', '4 waru', '5 waru'], ['3 love', '8 love', '8 waru'], ['J love', 'Q love', '10 waru']],
      buangan: [['4 love', 1]],
      giliran: 0,
    });
    const m = new MejaUji(g, infoUbah);
    m.app.kirim({ t: 'aksi', aksi: { jenis: 'mulung', jumlah: 1, kartuJadi: [spek('4 love', '5 love', '6 love')] } });
    await sampai(() => m.g.putaran!.tahap === 'main' && !!m.tombol('buang'));
    return m;
  }

  /** Id kartu tanganku sesuai urutan di layar. */
  const tanganLayar = (m: MejaUji) => m.sp.model()!.tangan.map((k) => k.id);
  const pilih = (m: MejaUji, ...teks: string[]) => teks.forEach((t) => m.kontrol.ketukKartu(id(t)));
  const buang = (m: MejaUji) => m.tombol('buang')!;

  it('dua joker hidup dipilih: tombol "Mentung pakai 2 kartu!", ditekan = satu aksi buang dengan kartuIdLain', async () => {
    const m = (meja = await mejaSesudahMulung(['7 waru', '7 kriting']));
    pilih(m, '7 waru', '7 kriting');
    expect(buang(m).textContent).toContain('Mentung pakai 2 kartu!');
    expect(buang(m).getAttribute('aria-disabled')).toBe('false');
    expect(buang(m).textContent).not.toMatch(/joker/i);
    const [a, b] = tanganLayar(m);
    buang(m).click();
    await tunggu();
    expect(meja.aksi.at(-1)).toEqual({ jenis: 'buang', kartuId: a, kartuIdLain: [b] });
    expect(meja.g.status).toBe('susunAkhir');
    expect(meja.g.putaran!.mentung!.pentunganLain).toHaveLength(1);
  });

  it('pintasan B lewat jalur yang sama', async () => {
    const m = (meja = await mejaSesudahMulung(['7 waru', '7 kriting']));
    // Urutan memilih tidak penting: yang dikirim urut seperti di layar.
    pilih(m, '7 kriting', '7 waru');
    const [a, b] = tanganLayar(m);
    tekan('b');
    await tunggu();
    expect(meja.aksi.at(-1)).toEqual({ jenis: 'buang', kartuId: a, kartuIdLain: [b] });
    expect(meja.g.putaran!.mentung).toMatchObject({ pemain: 0, pentunganJoker: true });
  });

  it('tiga alasan penolakan (dari validasiBuang): bukan semua sisa kartu, tanpa mulung, bukan joker semua', async () => {
    // 1) Dua dari tiga sisa kartu.
    let m = (meja = await mejaSesudahMulung(['7 waru', '7 kriting', '9 waru']));
    pilih(m, '7 waru', '7 kriting');
    expect(buang(m).textContent).toContain('Buang 2 kartu');
    expect(buang(m).getAttribute('aria-disabled')).toBe('true');
    expect(buang(m).dataset.alasan).toBe(PESAN_SATU_KARTU);
    buang(m).click();
    expect(m.petunjuk()).toBe(PESAN_SATU_KARTU);
    expect(m.sp.tolak.at(-1)).toBe('tangan');
    expect(m.aksi.filter((a) => a.jenis === 'buang')).toEqual([]);
    m.hancurkan();

    // 2) Sesudah ambil deck (bukan mulung): semua kartu dipilih tetap ditolak.
    const g = skenario({
      rankJoker: 7,
      tangan: [['7 waru'], ['3 waru', '4 waru', '5 waru'], ['3 love', '8 love', '8 waru'], ['J love', 'Q love', '10 waru']],
      giliran: 0,
    });
    m = meja = new MejaUji(g);
    tekan('d');
    await tunggu();
    for (const k of meja.g.putaran!.tangan[0]) m.kontrol.ketukKartu(k.id);
    expect(buang(m).textContent).toContain('Buang 2 kartu');
    expect(buang(m).dataset.alasan).toBe(PESAN_TANPA_MULUNG);
    tekan('b');
    expect(m.petunjuk()).toBe(PESAN_TANPA_MULUNG);
    expect(m.aksi.filter((a) => a.jenis === 'buang')).toEqual([]);
    m.hancurkan();

    // 3) Joker + kartu biasa.
    m = meja = await mejaSesudahMulung(['7 waru', '9 waru']);
    pilih(m, '7 waru', '9 waru');
    expect(buang(m).textContent).toContain('Buang 2 kartu');
    expect(buang(m).dataset.alasan).toBe(PESAN_BUKAN_JOKER);
    expect(buang(m).textContent).not.toMatch(/joker/i);
  });

  it('belum ada kartu dipilih: "Pilih kartu yang mau dibuang."', async () => {
    const m = (meja = await mejaSesudahMulung(['7 waru', '7 kriting']));
    expect(buang(m).textContent).toContain('Pilih kartu');
    expect(buang(m).dataset.alasan).toBe('Pilih kartu yang mau dibuang.');
  });

  it('kebocoran: sebelum memilih, bar, petunjuk, dan pembaca layar sama persis untuk dua joker hidup vs dua kartu biasa', async () => {
    const rekam = async (sisa: string[]) => {
      vi.mocked(umumkan).mockClear();
      const m = await mejaSesudahMulung(sisa);
      try {
        await tunggu();
        const hasil = {
          atas: m.akar.querySelector('.bar-atas')!.innerHTML,
          aksi: m.akar.querySelector('.bar-aksi')!.innerHTML,
          tombol: m.akar.querySelector('.tombol-aksi')!.innerHTML,
          petunjuk: m.petunjuk(),
          umumkan: vi.mocked(umumkan).mock.calls.map(([t]) => t),
        };
        // Pilih satu kartu: tetap buang biasa di keduanya (bukan mentung), tanpa alasan.
        m.kontrol.ketukKartu(id(sisa[0]));
        const satu = { label: buang(m).textContent!.replace(/\S+[♥♦♠♣]/, 'X'), mati: buang(m).getAttribute('aria-disabled') };
        return { ...hasil, satu };
      } finally {
        m.hancurkan();
      }
    };
    const joker = await rekam(['7 waru', '7 kriting']);
    const biasa = await rekam(['9 waru', 'K kriting']);
    expect(joker.tombol).toContain('Pilih kartu');
    expect(joker.tombol).not.toContain('mentung');
    expect(joker).toEqual(biasa);
    expect(joker.satu).toEqual({ label: expect.stringContaining('Buang X'), mati: 'false' });
    for (const t of [...joker.umumkan, joker.petunjuk]) expect(t).not.toMatch(/joker|mentung/i);
  });

  describe('seret ke buangan', () => {
    it('kartu yang diseret ikut pilihan seluruh tangan: nutup pakai semuanya, kartu yang diseret jadi kartuId', async () => {
      const m = (meja = await mejaSesudahMulung(['7 waru', '7 kriting']));
      pilih(m, '7 waru', '7 kriting');
      expect(m.kontrol.lepasKeBuangan(id('7 kriting'))).toBeUndefined();
      await tunggu();
      expect(m.aksi.at(-1)).toEqual({ jenis: 'buang', kartuId: id('7 kriting'), kartuIdLain: [id('7 waru')] });
    });

    it('kartu yang diseret tidak dipilih, atau pilihan tidak mencakup seluruh tangan: buang satu kartu seperti biasa', async () => {
      let m = (meja = await mejaSesudahMulung(['7 waru', '7 kriting']));
      pilih(m, '7 waru');
      m.kontrol.lepasKeBuangan(id('7 kriting'));
      await tunggu();
      expect(m.aksi.at(-1)).toEqual({ jenis: 'buang', kartuId: id('7 kriting') });
      m.hancurkan();

      m = meja = await mejaSesudahMulung(['7 waru', '7 kriting', '9 waru']);
      pilih(m, '7 waru', '7 kriting');
      m.kontrol.lepasKeBuangan(id('7 waru'));
      await tunggu();
      expect(m.aksi.at(-1)).toEqual({ jenis: 'buang', kartuId: id('7 waru') });
    });

    it('nutup beberapa kartu yang tidak sah ditolak (kartu kembali), tidak diam-diam jadi buang satu kartu', async () => {
      const m = (meja = await mejaSesudahMulung(['7 waru', '9 waru']));
      pilih(m, '7 waru', '9 waru');
      expect(m.kontrol.lepasKeBuangan(id('9 waru'))).toBe(false);
      await tunggu();
      expect(m.aksi.filter((a) => a.jenis === 'buang')).toEqual([]);
      expect(m.petunjuk()).toBe(PESAN_BUKAN_JOKER);
      expect(m.sp.tolak.at(-1)).toBe('tangan');
      expect(bunyi).toHaveBeenCalledWith('tolak');
      // Pilihan dibiarkan: pemain tinggal melepas salah satunya.
      expect([...m.sp.model()!.dipilih].sort()).toEqual([id('7 waru'), id('9 waru')].sort());
    });
  });

  it('panel mentung: "PENTUNG 2 JOKER!", kedua kartu, nilai 500; yang mentung +500', async () => {
    const m = (meja = await mejaSesudahMulung(['7 waru', '7 kriting'], {
      kursi: ['Aku', 'Bot 1', 'Bot 2', 'Bot 3'].map((nama, i) => ({ jenis: i < 2 ? 'manusia' : 'bot', nama, terhubung: true, level: 'normal' })),
    }));
    pilih(m, '7 waru', '7 kriting');
    const urut = tanganLayar(m).map((x) => (x === id('7 waru') ? '7 Waru' : '7 Kriting'));
    tekan('b');
    await sampai(() => !!document.querySelector('#modal [data-mentung]'));
    const dlg = document.querySelector('#modal .dialog')!;
    expect(dlg.querySelector('h2')!.textContent).toBe('PENTUNG 2 JOKER!');
    expect(dlg.querySelector('p.rata-tengah')!.textContent).toBe(`Kamu nutup pakai ${urut.join(' dan ')} · nilai 500`);
    expect(dlg.querySelectorAll('[data-kartu] canvas')).toHaveLength(2);
    expect(dlg.querySelector('.kotak-status')!.textContent).toContain('Kamu MENTUNG! +500');
    expect(m.sp.panggil).toContain('pentung');
  });

  it('panel mentung dari sisi yang kepentung: −500', async () => {
    const g = skenario({
      rankJoker: 7,
      tangan: [['3 waru', '4 waru', '8 waru'], ['5 love', '6 love', '7 waru', '7 kriting'], ['3 love', '8 love', '9 waru'], ['J love', 'Q love', '10 waru']],
      buangan: [['4 love', 0]],
      giliran: 1,
    });
    const m = (meja = new MejaUji(g, { kursi: g.pemain.map((p, i) => ({ jenis: i < 2 ? 'manusia' : 'bot', nama: p.nama, terhubung: true, level: 'normal' })) }));
    const terapkan = (aksi: Aksi) => {
      const h = terapkanAksi(m.g, aksi);
      if (!h.ok) throw new Error(h.error.pesan);
      m.g = h.state;
      m.kontrol.perbarui(null, m.view());
    };
    terapkan({ jenis: 'mulung', pemain: 1, jumlah: 1, kartuJadi: [spek('4 love', '5 love', '6 love')] });
    terapkan({ jenis: 'buang', pemain: 1, kartuId: id('7 waru'), kartuIdLain: [id('7 kriting')] });
    await sampai(() => !!document.querySelector('#modal [data-mentung]'));
    const dlg = document.querySelector('#modal .dialog')!;
    expect(dlg.querySelector('h2')!.textContent).toBe('PENTUNG 2 JOKER!');
    expect(dlg.querySelector('p.rata-tengah')!.textContent).toBe(`${g.pemain[1].nama} nutup pakai 7 Waru dan 7 Kriting · nilai 500`);
    expect(dlg.querySelector('.kotak-status')!.textContent).toContain('Kamu KEPENTUNG −500');
    expect(bunyi).toHaveBeenCalledWith('kepentung');
  });
});

// ---------- keputusan #52 (nutup paling banyak 2 kartu) dan #53 (pentungan bukan kembaran pungutan) ----------

describe('#52/#53: alasan penolakan nutup dari mesin aturan', () => {
  const PESAN_KEBANYAKAN = 'Nutup paling banyak pakai 2 kartu, Bos.';
  const PESAN_SATU = 'Buangnya satu kartu aja, Bos. Lebih dari satu cuma boleh buat nutup, dan semua sisa kartumu harus ikut dibuang.';
  const PESAN_KEMBARAN = 'Nggak bisa mentung pakai kembaran kartu yang barusan kamu pungut, Bos.';
  const PESAN_SISA_KEMBARAN =
    'Kartu terakhirmu nanti kembaran kartu yang barusan kamu pungut, jadi nggak bisa buat mentung. Sisakan minimal dua kartu: satu dibuang, satu tetap di tangan.';
  const pilih = (m: MejaUji, ...teks: string[]) => teks.forEach((t) => m.kontrol.ketukKartu(id(t)));
  const buang = (m: MejaUji) => m.tombol('buang')!;
  const lawan = [['3 waru', '4 waru', '5 waru'], ['3 love', '8 waru', '9 waru'], ['J love', 'Q love', '10 waru']];

  /** Aku (Budi) di kursi 0, Ani tepat sebelumku di kursi 3. Mulung lewat pesan langsung. */
  async function mejaSesudahMulung(s: Omit<Skenario, 'giliran'>, kartuJadiMulung: string[]): Promise<MejaUji> {
    const g = skenario({ ...s, giliran: 0 });
    g.pemain = ['Budi', 'Cici', 'Dodi', 'Ani'].map((nama) => ({ nama }));
    const m = new MejaUji(g);
    m.app.kirim({ t: 'aksi', aksi: { jenis: 'mulung', jumlah: 1, kartuJadi: [spek(...kartuJadiMulung)] } });
    await sampai(() => m.g.putaran!.tahap === 'main' && !!m.tombol('buang'));
    return m;
  }

  /** Contoh pemilik (#53; nama Ani dan Budi dari pengembang), 2 deck, joker 3: Ani membuang 8 Love deck kedua, aku memegang 7-8-9 Love + J-Q-K Wajik. */
  const contohAniBudi: Omit<Skenario, 'giliran'> = {
    rankJoker: 3,
    konfigurasi: { duaDeckUntukEmpat: true },
    tangan: [['7 love', '8 love', '9 love', 'J wajik', 'Q wajik', 'K wajik'], ...lawan],
    buangan: [['8 love#1', 3]],
  };

  it('#52: tiga joker dipilih (semua sisa kartu, sesudah mulung): "Buang 3 kartu" mati dengan alasan dari mesin, satu joker tetap bisa dibuang', async () => {
    const m = (meja = await mejaSesudahMulung(
      { rankJoker: 7, tangan: [['5 love', '6 love', '7 waru', '7 kriting', '7 wajik'], ...lawan], buangan: [['4 love', 3]] },
      ['4 love', '5 love', '6 love'],
    ));
    pilih(m, '7 waru', '7 kriting', '7 wajik');
    expect(buang(m).textContent).toContain('Buang 3 kartu');
    expect(buang(m).getAttribute('aria-disabled')).toBe('true');
    expect(buang(m).dataset.alasan).toBe(PESAN_KEBANYAKAN);
    expect(buang(m).textContent).not.toMatch(/joker/i);
    buang(m).click();
    expect(m.petunjuk()).toBe(PESAN_KEBANYAKAN);
    // Seret salah satunya juga ditolak (kartu kembali), tidak diam-diam jadi buang satu kartu.
    expect(m.kontrol.lepasKeBuangan(id('7 wajik'))).toBe(false);
    expect(m.aksi.filter((a) => a.jenis === 'buang')).toEqual([]);
    // Nggak bisa nutup: buang satu joker seperti biasa (−25).
    pilih(m, '7 waru', '7 kriting');
    expect(buang(m).getAttribute('aria-disabled')).toBe('false');
    buang(m).click();
    await tunggu();
    expect(m.aksi.at(-1)).toEqual({ jenis: 'buang', kartuId: id('7 wajik') });
    expect(m.g.putaran!.jokerDibuang[0]).toBe(1);
    expect(m.g.putaran!.mentung).toBeNull();
  });

  it('#52: tiga kartu dipilih dari tangan yang lebih besar (mau turunkan): alasan Buang tetap "buang satu kartu", bukan pesan jumlah nutup', async () => {
    const m = (meja = await mejaSesudahMulung(
      { rankJoker: 7, tangan: [['5 love', '6 love', 'J kriting', 'Q kriting', 'K kriting', '2 wajik'], ...lawan], buangan: [['4 love', 3]] },
      ['4 love', '5 love', '6 love'],
    ));
    pilih(m, 'J kriting', 'Q kriting', 'K kriting');
    expect(m.tombol('turunkan')!.getAttribute('aria-disabled')).toBe('false');
    expect(buang(m).textContent).toContain('Buang 3 kartu');
    expect(buang(m).getAttribute('aria-disabled')).toBe('true');
    expect(buang(m).dataset.alasan).toBe(PESAN_SATU);
    buang(m).click();
    expect(m.petunjuk()).toBe(PESAN_SATU);
    expect(m.aksi.filter((a) => a.jenis === 'buang')).toEqual([]);
  });

  it('#53 contoh Ani dan Budi: turunkan J-Q-K Wajik yang menyisakan 8 Love sendirian ditolak, 8 Love tetap bisa dibuang biasa', async () => {
    const m = (meja = await mejaSesudahMulung(contohAniBudi, ['7 love', '8 love#1', '9 love']));
    expect(m.g.putaran!.pungutan.map((e) => e.kartu.id)).toEqual([id('8 love#1')]);
    pilih(m, 'J wajik', 'Q wajik', 'K wajik');
    expect(m.tombol('turunkan')!.getAttribute('aria-disabled')).toBe('false');
    m.tombol('turunkan')!.click();
    await tunggu();
    expect(m.petunjuk()).toBe(PESAN_SISA_KEMBARAN);
    expect(m.aksi.filter((a) => a.jenis === 'turunkan')).toEqual([]);
    pilih(m, 'J wajik', 'Q wajik', 'K wajik', '8 love');
    expect(buang(m).textContent).toContain('Buang 8♥');
    expect(buang(m).getAttribute('aria-disabled')).toBe('false');
    buang(m).click();
    await tunggu();
    expect(m.aksi.at(-1)).toEqual({ jenis: 'buang', kartuId: id('8 love') });
    expect(m.g.putaran!.mentung).toBeNull();
  });

  /** Contoh Ani dan Budi sesudah turunkan J-Q-K Wajik (aturan lama): kartu terakhirku 8 Love, kembaran pungutan. */
  function kartuTerakhirKembaran(): GameState {
    const h = terapkanAksi(skenario({ ...contohAniBudi, giliran: 0 }), {
      jenis: 'mulung',
      pemain: 0,
      jumlah: 1,
      kartuJadi: [spek('7 love', '8 love#1', '9 love')],
    });
    if (!h.ok) throw new Error(h.error.pesan);
    const g: GameState = JSON.parse(JSON.stringify(h.state));
    // Langkah turunkan J-Q-K Wajik dipasang langsung (lewat aksi sekarang ditolak, lihat test di atas).
    g.putaran!.tangan[0] = g.putaran!.tangan[0].filter((k) => k.id === id('8 love'));
    g.putaran!.kartuJadi[0].push(kartuJadi(0, ctx(3), 'J wajik', 'Q wajik', 'K wajik'));
    g.peristiwa = [];
    return g;
  }

  it('#53: simpanan dari sebelum aturan ini (lewat migrasiState): giliran itu bisa ditutup dengan mentung seperti dulu', async () => {
    const m = (meja = new MejaUji(migrasiState(kartuTerakhirKembaran())));
    await tunggu();
    expect(m.petunjuk()).toBe('Tinggal satu kartu: buang untuk mentung!');
    pilih(m, '8 love');
    expect(buang(m).textContent).toContain('Mentung pakai 8♥!');
    expect(buang(m).getAttribute('aria-disabled')).toBe('false');
    buang(m).click();
    await tunggu();
    expect(m.aksi.at(-1)).toEqual({ jenis: 'buang', kartuId: id('8 love') });
    expect(m.g.putaran!.mentung).toMatchObject({ pemain: 0, kepentung: [3] });
  });

  it('#53: kartu terakhir kembaran pungutan (state dibuat langsung): bukan penanda mentung, tombol mati dengan alasan dari mesin', async () => {
    const m = (meja = new MejaUji(kartuTerakhirKembaran()));
    await tunggu();
    expect(m.petunjuk()).not.toBe('Tinggal satu kartu: buang untuk mentung!');
    expect(buang(m).textContent).not.toContain('mentung');
    pilih(m, '8 love');
    expect(buang(m).textContent).toContain('Buang 8♥');
    expect(buang(m).getAttribute('aria-disabled')).toBe('true');
    expect(buang(m).dataset.alasan).toBe(PESAN_KEMBARAN);
    buang(m).click();
    expect(m.petunjuk()).toBe(PESAN_KEMBARAN);
    expect(m.aksi).toEqual([]);
  });

  it('#53: nutup dua joker yang salah satunya kembaran pungutan: "Buang 2 kartu" mati dengan alasan dari mesin', async () => {
    const m = (meja = await mejaSesudahMulung(
      { rankJoker: 7, konfigurasi: { duaDeckUntukEmpat: true }, tangan: [['5 waru', '6 waru', '7 waru', '7 kriting'], ...lawan.map((t) => t.map((x) => x.replace('waru', 'wajik')))], buangan: [['7 waru#1', 3]] },
      ['5 waru', '6 waru', '7 waru#1'],
    ));
    pilih(m, '7 waru', '7 kriting');
    expect(buang(m).textContent).toContain('Buang 2 kartu');
    expect(buang(m).getAttribute('aria-disabled')).toBe('true');
    expect(buang(m).dataset.alasan).toBe(PESAN_KEMBARAN);
    expect(buang(m).textContent).not.toMatch(/joker/i);
  });
});

// ---------- bar aksi ----------

describe('bar aksi', () => {
  it('render ulang dengan isi sama tidak menulis ulang tombol (fokus keyboard bertahan)', () => {
    meja = new MejaUji(permainanGiliranku());
    const ambil = meja.tombol('ambil')!;
    ambil.focus();
    meja.kontrol.perbarui(meja.info, null);
    meja.kontrol.terimaEmote(1, '🔥');
    expect(meja.tombol('ambil')).toBe(ambil);
    expect(document.activeElement).toBe(ambil);
  });

  it('bukan giliranku: pil giliran, petunjuk, dan tombol tidak mengulang teks yang sama', () => {
    const g = permainanGiliranku();
    const h = terapkanAksi(g, { jenis: 'ambilDeck', pemain: 0 });
    if (!h.ok) throw new Error(h.error.pesan);
    const kartuBuang = h.state.putaran!.tangan[0].find((k) => k.rank !== 1)!;
    const h2 = terapkanAksi(h.state, { jenis: 'buang', pemain: 0, kartuId: kartuBuang.id });
    if (!h2.ok) throw new Error(h2.error.pesan);
    meja = new MejaUji(h2.state);
    const lawan = h2.state.pemain[h2.state.putaran!.giliran].nama;
    const langkah = meja.akar.querySelector('.langkah')!.textContent!;
    const tombol = meja.akar.querySelector('.tombol-aksi button.utama')!.textContent!;
    expect(langkah).toContain(lawan);
    expect(meja.petunjuk()).not.toContain(lawan);
    expect(tombol).not.toContain(lawan);
    expect(tombol).not.toContain('Aku');
  });

  it('menunggu joker di giliranku: tidak menampilkan "Menunggu <namaku>"', () => {
    meja = new MejaUji(permainanGiliranku(), { menungguJoker: [1] });
    expect(meja.akar.querySelector('.bar-aksi')!.textContent).not.toContain('Menunggu Aku');
    expect(meja.akar.querySelector('.langkah')!.textContent).toContain('joker');
  });
});

// ---------- popup joker ----------

describe('palet emote (#48: celetukan dan pesan sendiri)', () => {
  const buka = () => (meja!.akar.querySelector('[data-a=emote]') as HTMLElement).click();
  const emote = () => meja!.terkirim.filter((p) => p.t === 'emote');

  it('palet berisi emoji, celetukan warga Madya, dan isian pesan', () => {
    meja = new MejaUji(permainanGiliranku());
    buka();
    const palet = meja.akar.querySelector('.palet-emote')!;
    const celetukan = [...palet.querySelectorAll('.palet-celetukan button')].map((b) => b.textContent);
    for (const isi of ['Gedein!', 'Buruan!', 'Lumayan!', 'CEKI!', 'Njir lah!', 'Give me!', 'GG']) expect(celetukan).toContain(isi);
    expect(palet.querySelectorAll('.palet-emoji button').length).toBeGreaterThanOrEqual(20);
    expect(palet.querySelector('.palet-tulis input')).not.toBeNull();
    (palet.querySelector('[data-emote="CEKI!"]') as HTMLElement).click();
    expect(emote()).toEqual([{ t: 'emote', isi: 'CEKI!' }]);
    expect(meja.akar.querySelector('.palet-emote')).toBeNull();
  });

  it('pesan yang diketik dikirim sesudah dirapikan; kosong tidak dikirim', () => {
    meja = new MejaUji(permainanGiliranku());
    buka();
    const form = meja.akar.querySelector<HTMLFormElement>('.palet-tulis')!;
    const isian = form.querySelector('input')!;
    isian.value = '   ';
    form.requestSubmit();
    expect(emote()).toEqual([]);
    expect(meja.akar.querySelector('.palet-emote')).not.toBeNull();
    isian.value = '  gedein   dong ';
    form.requestSubmit();
    expect(emote()).toEqual([{ t: 'emote', isi: 'gedein dong' }]);
    expect(meja.akar.querySelector('.palet-emote')).toBeNull();
  });

  it('mengetik huruf pintasan di isian pesan tidak memicu aksi meja; Esc menutup palet', () => {
    meja = new MejaUji(permainanGiliranku());
    buka();
    const isian = meja.akar.querySelector<HTMLInputElement>('.palet-tulis input')!;
    isian.focus();
    tekan('d', isian);
    expect(meja.aksi).toEqual([]);
    isian.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    expect(meja.akar.querySelector('.palet-emote')).toBeNull();
  });

  it('pesan panjang tampil di gelembung bertanda panjang, teksnya apa adanya (bukan HTML)', () => {
    meja = new MejaUji(permainanGiliranku());
    meja.kontrol.terimaEmote(1, 'jangan buang As dulu ya, aku butuh <b>');
    const g = meja.akar.querySelector('.gelembung')!;
    expect(g.classList.contains('panjang')).toBe(true);
    expect(g.textContent).toBe('jangan buang As dulu ya, aku butuh <b>');
    expect(g.querySelector('b')).toBeNull();
  });
});

describe('popup joker', () => {
  it('fokus otomatis di OK, kartu digambar kanvas, OK mengirim siapJoker sekali', async () => {
    const g = permainanGiliranku();
    meja = new MejaUji(g, { menungguJoker: [0] });
    await tunggu(); // kocok & bagi putaran 1 diputar dulu
    const dlg = document.querySelector('#modal [data-joker]')!.closest('.dialog')!;
    expect(dlg.querySelector('canvas')).not.toBeNull();
    const ok = dlg.querySelector<HTMLButtonElement>('[data-ok]')!;
    expect(document.activeElement).toBe(ok);
    expect(dlg.textContent).toContain(namaRank(g.putaran!.rankJoker));
    ok.click();
    expect(meja.terkirim.filter((p) => p.t === 'siapJoker')).toHaveLength(1);
    // Server belum menjawab (info lama masih menunggu aku): popup tidak dibuka lagi.
    meja.kontrol.perbarui(meja.info, null);
    expect(document.querySelector('[data-joker]')).toBeNull();
  });

  it('OK ditekan saat sinyal putus: siapJoker dikirim ulang sekali per sambungan baru, popup tidak dibuka lagi', async () => {
    const g = permainanGiliranku();
    let status: 'tersambung' | 'terputus' = 'tersambung';
    let sambungan = 1;
    meja = new MejaUji(g, { menungguJoker: [0] }, { jenis: 'online', statusKoneksi: () => status, nomorSambungan: () => sambungan });
    meja.diam = true;
    await tunggu();
    status = 'terputus';
    expect(document.querySelector('#modal [data-joker]')).not.toBeNull();
    document.querySelector<HTMLButtonElement>('#modal [data-ok]')!.click();
    const siap = () => meja!.terkirim.filter((p) => p.t === 'siapJoker').length;
    expect(siap()).toBe(1); // hilang di jalan (sinyal putus)
    // Masih putus: info lama tidak memicu kirim ulang.
    meja.kontrol.perbarui(meja.info, null);
    expect(siap()).toBe(1);
    // Tersambung lagi; server memasukkan kursiku lagi ke menungguJoker.
    status = 'tersambung';
    sambungan = 2;
    meja.kontrol.perbarui({ ...meja.info, menungguJoker: [0] }, meja.view());
    await tunggu();
    expect(siap()).toBe(2);
    expect(document.querySelector('[data-joker]')).toBeNull();
    // Info berikutnya di sambungan yang sama (server belum sempat menjawab): tidak dikirim lagi.
    meja.kontrol.perbarui({ ...meja.info, menungguJoker: [0, 1] }, null);
    meja.kontrol.perbarui({ ...meja.info, menungguJoker: [0] }, meja.view());
    await tunggu();
    expect(siap()).toBe(2);
    // Putus dan tersambung lagi sebelum sampai: dikirim sekali lagi di sambungan baru.
    sambungan = 3;
    meja.kontrol.perbarui({ ...meja.info, menungguJoker: [0] }, null);
    expect(siap()).toBe(3);
    // Server sudah mencatat: tidak ada kirim ulang.
    sambungan = 4;
    meja.kontrol.perbarui({ ...meja.info, menungguJoker: [] }, null);
    expect(siap()).toBe(3);
  });

  it('perluKirimUlangSiapJoker: hanya putaran yang sudah di-OK, kursiku masih ditunggu, tersambung, sambungan baru', () => {
    const v = viewUntuk(permainanGiliranku(), 0);
    const nomor = v.putaran!.nomor;
    const dasar = { view: v, menungguJoker: [0], jokerDiOk: nomor, status: 'tersambung' as const, sambungan: 2, sambunganTerkirim: 1 };
    expect(perluKirimUlangSiapJoker(dasar)).toBe(true);
    expect(perluKirimUlangSiapJoker({ ...dasar, sambunganTerkirim: 2 })).toBe(false);
    expect(perluKirimUlangSiapJoker({ ...dasar, jokerDiOk: -1 })).toBe(false); // belum di-OK: popup yang dibuka
    expect(perluKirimUlangSiapJoker({ ...dasar, jokerDiOk: nomor - 1 })).toBe(false); // putaran lalu
    expect(perluKirimUlangSiapJoker({ ...dasar, menungguJoker: [1, 2] })).toBe(false);
    expect(perluKirimUlangSiapJoker({ ...dasar, status: 'terputus' })).toBe(false);
    expect(perluKirimUlangSiapJoker({ ...dasar, view: null })).toBe(false);
    expect(perluKirimUlangSiapJoker({ ...dasar, view: { ...v, status: 'susunAkhir' } })).toBe(false);
  });

  it('angka joker tidak pernah ada di bar, petunjuk, maupun pengumuman pembaca layar', async () => {
    const g = permainanGiliranku();
    meja = new MejaUji(g);
    tekan('d');
    await tunggu();
    for (let i = 0; i < 8; i++) tekan('ArrowRight');
    tekan(' ');
    const bar = meja.akar.textContent!;
    expect(bar).not.toMatch(/joker/i);
    for (const [teks] of vi.mocked(umumkan).mock.calls) expect(teks).not.toMatch(/joker/i);
  });
});

// ---------- hancurkan ----------

describe('hancurkan', () => {
  it('sesudah hancurkan tidak ada render, kirim, atau listener keyboard yang tersisa', async () => {
    const m = new MejaUji(permainanGiliranku());
    const sebelum = m.sp.jumlahPasang();
    m.hancurkan();
    const sesudahHancur = m.sp.jumlahPasang(); // hancurkan memanggil pasang(null) sekali
    expect(sesudahHancur).toBe(sebelum + 1);
    m.kontrol.perbarui(m.info, m.view());
    m.kontrol.terimaEmote(1, '🔥');
    tekan('d');
    await tunggu();
    expect(m.sp.jumlahPasang()).toBe(sesudahHancur);
    expect(m.terkirim).toEqual([]);
  });
});

// ---------- perbaikan putaran C2 ----------

/** Tunggu sampai syarat terpenuhi (antrian animasi palsu bisa memakai beberapa giliran timer). */
async function sampai(syarat: () => boolean, ms = 3000): Promise<void> {
  const batas = Date.now() + ms;
  while (!syarat()) {
    if (Date.now() > batas) throw new Error('syarat tidak terpenuhi');
    await new Promise((r) => setTimeout(r, 5));
  }
}

/** Permainan yang aku tinggal membuang satu kartu untuk mentung (habis mulung 7 love). */
async function mejaSiapMentung(konfigurasi?: { batasPutaran: number }, appUbah: Partial<AppUntukMeja> = {}): Promise<MejaUji> {
  const g = skenario({
    konfigurasi,
    rankJoker: 2,
    tangan: [['5 love', '6 love', '9 waru'], ['3 waru', '4 waru', '5 waru'], ['3 love', '4 love', '8 waru'], ['J love', 'Q love', '10 waru']],
    buangan: [['7 love', 1]],
    giliran: 0,
  });
  const m = new MejaUji(g, { kursi: g.pemain.map((p, i) => ({ jenis: i < 2 ? 'manusia' : 'bot', nama: p.nama, terhubung: true, level: 'normal' })) }, appUbah);
  m.app.kirim({ t: 'aksi', aksi: { jenis: 'mulung', jumlah: 1, kartuJadi: [spek('5 love', '6 love', '7 love')] } });
  await sampai(() => m.g.putaran!.tahap === 'main' && !!m.tombol('buang'));
  return m;
}

/** Mainkan sampai modal hasil putaran 1 terbuka (mentung → Lanjut → susun akhir selesai). */
async function sampaiHasil(m: MejaUji, selektor = '[data-hasil]'): Promise<HTMLElement> {
  tekan('ArrowRight');
  tekan(' ');
  tekan('b');
  await sampai(() => !!document.querySelector('#modal [data-mentung]'));
  document.querySelector<HTMLButtonElement>('#modal [data-lanjut]')!.click();
  await sampai(() => m.g.status === 'susunAkhir' && !document.querySelector('#modal [data-mentung]'));
  m.g = semuaSelesaiSusun(m.g);
  m.kontrol.perbarui(m.info, m.view());
  await sampai(() => !!document.querySelector(`#modal ${selektor}`));
  return document.querySelector(`#modal ${selektor}`)!.closest<HTMLElement>('.dialog')!;
}

describe('hancurkan menghentikan pemutar', () => {
  it('sesudah mentung (layar goyang): hancurkan melepas goyang dan membatalkan timernya', async () => {
    const m = (meja = await mejaSiapMentung());
    tekan('ArrowRight');
    tekan(' ');
    tekan('b');
    await sampai(() => document.body.classList.contains('goyang'));
    m.hancurkan();
    meja = null;
    expect(document.body.classList.contains('goyang')).toBe(false);
    // Kelas dipasang lagi dari luar: timer 500 ms pemutar sudah batal, jadi tidak ada yang melepasnya.
    document.body.classList.add('goyang');
    await new Promise((r) => setTimeout(r, 600));
    expect(document.body.classList.contains('goyang')).toBe(true);
    document.body.classList.remove('goyang');
  });
});

describe('bunyi panel mentung (siapa yang kepentung sudah tampil untuk semua orang)', () => {
  it("aku mentung, orang lain kena: getar mentung, bunyi 'kepentungLain' (pelan), bukan 'kepentung'", async () => {
    meja = await mejaSiapMentung();
    tekan('ArrowRight');
    tekan(' ');
    tekan('b');
    await sampai(() => !!document.querySelector('#modal [data-mentung]'));
    expect(bunyi).toHaveBeenCalledWith('tegang');
    expect(bunyi).toHaveBeenCalledWith('mentung');
    expect(getar).toHaveBeenCalledWith('mentung');
    expect(bunyi).toHaveBeenCalledWith('kepentungLain');
    expect(bunyi).not.toHaveBeenCalledWith('kepentung');
    // Sesudah pentungan terbuka, kursi yang kena dapat "buk" pelan; aku tidak kena, jadi tanpa pukulan besar.
    await sampai(() => vi.mocked(bunyi).mock.calls.some(([j]) => j === 'jotosLain'));
    expect(bunyi).not.toHaveBeenCalledWith('jotos');
    expect(getar).not.toHaveBeenCalledWith('kepentung');
    expect(document.querySelector('.retak-layar')).toBeNull();
  });

  it("aku kepentung (kartuku dipungut lalu lawan mentung): bunyi 'kepentung', pukulan 'jotos' + getar 'kepentung' sekali", async () => {
    const g = skenario({
      rankJoker: 2,
      tangan: [['3 waru', '4 waru', '8 waru'], ['5 love', '6 love', '9 waru'], ['3 love', '4 love', '8 kriting'], ['J love', 'Q love', '10 waru']],
      buangan: [['7 love', 0]],
      giliran: 1,
    });
    const m = (meja = new MejaUji(g, { kursi: g.pemain.map((p, i) => ({ jenis: i < 2 ? 'manusia' : 'bot', nama: p.nama, terhubung: true, level: 'normal' })) }));
    const terapkan = (aksi: Aksi) => {
      const h = terapkanAksi(m.g, aksi);
      if (!h.ok) throw new Error(h.error.pesan);
      m.g = h.state;
      m.kontrol.perbarui(null, m.view());
    };
    terapkan({ jenis: 'mulung', pemain: 1, jumlah: 1, kartuJadi: [spek('5 love', '6 love', '7 love')] });
    terapkan({ jenis: 'buang', pemain: 1, kartuId: m.g.putaran!.tangan[1][0].id });
    await sampai(() => !!document.querySelector('#modal [data-mentung]'));
    expect(document.querySelector('#modal .kotak-status')!.textContent).toContain('KEPENTUNG');
    // "Kamu KEPENTUNG" ikut retak: kanvas retakan di belakang tulisannya, tanpa label.
    expect(document.querySelector('#modal [data-kena] canvas.retak-status')?.getAttribute('aria-hidden')).toBe('true');
    // Lama "menghantam masuk" ikut preferensi kecepatan (CSS --hantam-lama).
    expect(document.querySelector<HTMLElement>('#modal [data-kena]')!.style.getPropertyValue('--hantam-lama')).toBe(`${durasi(LAMA_HANTAM)}ms`);
    expect(bunyi).toHaveBeenCalledWith('kepentung');
    // Getar kepentung ikut pukulannya (sesaat sesudah pentungan terbuka), tidak diulang di panel.
    await sampai(() => vi.mocked(getar).mock.calls.some(([j]) => j === 'kepentung'));
    expect(vi.mocked(getar).mock.calls.filter(([j]) => j === 'kepentung')).toHaveLength(1);
    expect(bunyi).toHaveBeenCalledWith('jotos');
    expect(document.querySelector('#retak .retak-layar')).not.toBeNull();
    expect(bunyi).not.toHaveBeenCalledWith('kepentungLain');
    // Yang mentung lawan: aku tidak ikut getar mentung.
    expect(getar).not.toHaveBeenCalledWith('mentung');
  });
});

describe('kocok & bagi kartu terlihat', () => {
  it('peristiwaAwalPerluDiputar: hanya mulaiPutaran yang belum diikuti aksi dan joker belum kulihat', () => {
    const g = permainanGiliranku();
    const v = viewUntuk(g, 0);
    expect(peristiwaAwalPerluDiputar(v, [0, 1])?.jenis).toBe('mulaiPutaran');
    // Joker sudah kutekan OK (sambung ulang): tidak diputar ulang.
    expect(peristiwaAwalPerluDiputar(v, [1])).toBeNull();
    // Sudah ada aksi sesudahnya (reload di tengah putaran): tidak diputar ulang.
    const h = terapkanAksi(g, { jenis: 'ambilDeck', pemain: 0 });
    if (!h.ok) throw new Error(h.error.pesan);
    expect(peristiwaAwalPerluDiputar(viewUntuk(h.state, 0), [0])).toBeNull();
  });

  it('view pertama putaran 1: kartu dibagi dulu, popup joker sesudah animasi selesai', async () => {
    const g = permainanGiliranku();
    let lepas: () => void = () => {};
    const sp = scenePalsu();
    // bagiKartu ditahan sampai test melepasnya.
    const akar = document.createElement('div');
    document.body.appendChild(akar);
    sp.ganti.bagiKartu = () => new Promise<void>((r) => (lepas = r));
    const terkirim: PesanKlien[] = [];
    const k = new KontrolMeja({ jenis: 'offline', kirim: (p) => terkirim.push(p), keluarMeja: vi.fn(), mainLagiOffline: vi.fn() }, sp.scene, akar);
    k.perbarui(infoMeja(g, { menungguJoker: [0] }), viewUntuk(g, 0));
    await tunggu();
    expect(sp.panggil).toContain('bagiKartu');
    // Selama dibagi: tangan disembunyikan (kartu sedang terbang), popup joker belum ada.
    expect(sp.model()!.disembunyikan.size).toBeGreaterThan(0);
    expect(document.querySelector('[data-joker]')).toBeNull();
    lepas();
    await sampai(() => !!document.querySelector('#modal [data-joker]'));
    expect(sp.model()!.disembunyikan.size).toBe(0);
    k.hancurkan();
    akar.remove();
  });

  it('reload di tengah putaran (sudah ada aksi): kejadian lama tidak diputar ulang', async () => {
    const h = terapkanAksi(permainanGiliranku(), { jenis: 'ambilDeck', pemain: 0 });
    if (!h.ok) throw new Error(h.error.pesan);
    meja = new MejaUji(h.state, { menungguJoker: [0] });
    await tunggu();
    expect(meja.sp.panggil).not.toContain('bagiKartu');
  });

  it('putaran berikutnya: modal hasil ditutup SEBELUM kocok & bagi, label offline "Mengocok…"', async () => {
    meja = await mejaSiapMentung();
    const dlg = await sampaiHasil(meja);
    let hasilMasihAda: boolean | null = null;
    meja.sp.ganti.bagiKartu = () => {
      hasilMasihAda = !!document.querySelector('#modal [data-hasil]');
      return Promise.resolve();
    };
    // Server/meja belum menjawab: label tombol offline bukan "Mengirim…".
    meja.diam = true;
    const kocok = dlg.querySelector<HTMLButtonElement>('[data-kocok="acak"]')!;
    kocok.click();
    expect(kocok.textContent).toBe('Mengocok…');
    expect(terkunci(kocok)).toBe(true);
    expect(meja.terkirim.filter((p) => p.t === 'putaranBerikut')).toHaveLength(1);
    // Meja menjawab: putaran 2 dimulai.
    meja.diam = false;
    meja.terkirim = [];
    meja.app.kirim({ t: 'putaranBerikut' });
    await sampai(() => !!document.querySelector('#modal [data-joker]'));
    expect(hasilMasihAda).toBe(false);
    expect(meja.sp.panggil).toContain('bagiKartu');
  });
});

describe('keyboard saat putaran berganti', () => {
  it('sorotan putaran lalu dibuang; panah & Spasi selagi kartu dibagi memilih kartu baru dan pilihannya bertahan', async () => {
    meja = await mejaSiapMentung();
    const dlg = await sampaiHasil(meja);
    // Sisa putaran 1: sorotan tampak di buangan.
    meja.kontrol['fokus'] = 'buangan';
    meja.kontrol['modusKeyboard'] = true;
    let lepas: () => void = () => {};
    meja.sp.ganti.bagiKartu = () => new Promise<void>((r) => (lepas = r));
    dlg.querySelector<HTMLButtonElement>('[data-kocok="acak"]')!.click();
    await sampai(() => meja!.sp.panggil.includes('bagiKartu'));
    expect(meja.g.putaran!.nomor).toBe(2);
    const p = meja.g.putaran!;
    const model = meja.sp.model()!;
    expect(model.view.putaran!.nomor).toBe(2);
    // Posisi awal: deck kalau giliranku ambil, selain itu kartu tangan paling kiri.
    const harap = p.giliran === 0 && p.tahap === 'ambil' ? 'deck' : model.tangan[0].id;
    expect(model.fokus).toBe(harap);
    // Kartu masih terbang (disembunyikan), tapi sudah bisa disorot dan dipilih.
    expect(model.disembunyikan.size).toBeGreaterThan(0);
    tekan('Escape');
    tekan('ArrowDown');
    tekan('Home');
    tekan('ArrowRight');
    tekan(' ');
    const tangan = meja.sp.model()!.tangan;
    expect([...meja.sp.model()!.dipilih]).toEqual([tangan[1].id]);
    lepas();
    await sampai(() => !!document.querySelector('#modal [data-joker]'));
    expect([...meja.sp.model()!.dipilih]).toEqual([tangan[1].id]);
  });
});

describe('modal hasil putaran', () => {
  it('voting berubah: diperbarui di tempat, fokus & gulir tidak direbut; tombol di kaki sticky', async () => {
    meja = await mejaSiapMentung();
    const dlg = await sampaiHasil(meja);
    expect(dlg.querySelector('.kaki-dialog.aksi-hasil [data-kocok]')).not.toBeNull();
    const lihat = dlg.querySelector<HTMLButtonElement>('[data-tutup]')!;
    lihat.focus();
    dlg.scrollTop = 40;
    expect(dlg.querySelector('[data-akhiri]')!.textContent).toBe('Akhiri permainan (0/2)');
    meja.info = { ...meja.info, setujuAkhiri: [1] };
    meja.kontrol.perbarui(meja.info, null);
    const sesudah = document.querySelector('#modal [data-hasil]')!.closest('.dialog');
    expect(sesudah).toBe(dlg); // dialog yang sama, bukan bukaModal ulang
    expect(document.activeElement).toBe(lihat);
    expect(dlg.scrollTop).toBe(40);
    expect(dlg.querySelector('[data-akhiri]')!.textContent).toBe('Akhiri permainan (1/2)');
  });

  it('akhiri: tombol "Sebentar…" saat menunggu, lalu "Batal akhiri" setelah info datang', async () => {
    meja = await mejaSiapMentung();
    const dlg = await sampaiHasil(meja);
    meja.diam = true;
    const akhiri = dlg.querySelector<HTMLButtonElement>('[data-akhiri]')!;
    akhiri.click();
    expect(meja.terkirim.at(-1)).toEqual({ t: 'akhiri', setuju: true });
    expect(akhiri.textContent).toBe('Sebentar…');
    meja.info = { ...meja.info, setujuAkhiri: [0] };
    meja.kontrol.perbarui(meja.info, null);
    expect(dlg.querySelector('[data-akhiri]')).toBe(akhiri);
    expect(akhiri.textContent).toBe('Batal akhiri (1/2)');
    expect(terkunci(akhiri)).toBe(false);
    expect(akhiri.classList.contains('bahaya')).toBe(true);
  });

  /** Klik kocok selagi meja diam; kembalikan tombolnya. Fake timer dipasang SEBELUM klik. */
  const kocokTanpaJawaban = (dlg: HTMLElement): HTMLButtonElement => {
    meja!.diam = true;
    const kocok = dlg.querySelector<HTMLButtonElement>('[data-kocok="acak"]')!;
    kocok.click();
    expect(terkunci(kocok)).toBe(true);
    expect(kocok.getAttribute('aria-busy')).toBe('true');
    expect(kocok.textContent).toBe('Mengocok…');
    return kocok;
  };
  const tombolKocok = () => document.querySelector<HTMLButtonElement>('#modal [data-kocok="acak"]')!;
  const jumlahKocok = () => meja!.terkirim.filter((p) => p.t === 'putaranBerikut').length;

  it('kocok tidak dijawab: sesudah batas waktu tombol "Putaran berikutnya" pulih dan bisa diklik lagi', async () => {
    meja = await mejaSiapMentung();
    const dlg = await sampaiHasil(meja);
    vi.useFakeTimers();
    try {
      dlg.querySelector<HTMLButtonElement>('[data-kocok="acak"]')!.focus();
      const kocok = kocokTanpaJawaban(dlg);
      expect(document.activeElement).toBe(kocok); // fokus keyboard tidak lepas ke <body>
      kocok.click(); // klik lagi selagi menunggu: diabaikan
      expect(jumlahKocok()).toBe(1);
      vi.advanceTimersByTime(3000);
      expect(terkunci(tombolKocok())).toBe(true); // belum lewat batas: tetap terkunci
      vi.advanceTimersByTime(3100);
      const pulih = tombolKocok();
      expect(document.querySelector('#modal [data-hasil]')!.closest('.dialog')).toBe(dlg); // diperbarui di tempat
      expect(document.activeElement).toBe(pulih); // fokus pindah ke tombol yang dipasang ulang
      expect(terkunci(pulih)).toBe(false);
      expect(pulih.hasAttribute('aria-busy')).toBe(false);
      expect(pulih.textContent).toMatch(/^Putaran berikutnya \(.+ ngocok\)$/);
      pulih.click();
      expect(jumlahKocok()).toBe(2);
    } finally {
      vi.useRealTimers();
    }
  });

  it('kocok tidak dijawab, info berubah selagi menunggu (tombol dipasang ulang): tetap pulih', async () => {
    meja = await mejaSiapMentung();
    const dlg = await sampaiHasil(meja);
    vi.useFakeTimers();
    try {
      const lama = kocokTanpaJawaban(dlg);
      // Voting akhiri berubah selagi menunggu: modal diperbarui, tombol lanjut tetap sibuk.
      meja.info = { ...meja.info, setujuAkhiri: [1] };
      meja.kontrol.perbarui(meja.info, null);
      expect(terkunci(tombolKocok())).toBe(true);
      expect(tombolKocok().textContent).toBe('Mengocok…');
      vi.advanceTimersByTime(6100);
      expect(lama.isConnected).toBe(false);
      expect(terkunci(tombolKocok())).toBe(false);
      expect(tombolKocok().textContent).toMatch(/^Putaran berikutnya/);
    } finally {
      vi.useRealTimers();
    }
  });

  it('kocok tidak dijawab, modal ditutup: batas waktu tidak membuka modal lagi; dibuka ulang tetap pulih', async () => {
    meja = await mejaSiapMentung();
    const dlg = await sampaiHasil(meja);
    vi.useFakeTimers();
    try {
      kocokTanpaJawaban(dlg);
      dlg.querySelector<HTMLButtonElement>('[data-tutup]')!.click();
      expect(document.querySelector('#modal [data-hasil]')).toBeNull();
      // Lewat batas waktu dengan modal tertutup: tidak muncul sendiri.
      vi.advanceTimersByTime(20000);
      expect(document.querySelector('#modal [data-hasil]')).toBeNull();
      // Dibuka lagi: kunci sudah kedaluwarsa, tombol bisa dipakai.
      meja.tombol('hasil')!.click();
      expect(terkunci(tombolKocok())).toBe(false);
      // Kocok lagi, tutup, lalu buka ulang selagi masih menunggu: masih sibuk, lalu pulih sendiri.
      const dlg2 = document.querySelector('#modal [data-hasil]')!.closest<HTMLElement>('.dialog')!;
      kocokTanpaJawaban(dlg2);
      expect(jumlahKocok()).toBe(2);
      dlg2.querySelector<HTMLButtonElement>('[data-tutup]')!.click();
      vi.advanceTimersByTime(1000);
      meja.tombol('hasil')!.click();
      expect(terkunci(tombolKocok())).toBe(true);
      expect(tombolKocok().textContent).toBe('Mengocok…');
      vi.advanceTimersByTime(5200);
      expect(terkunci(tombolKocok())).toBe(false);
      expect(tombolKocok().textContent).toMatch(/^Putaran berikutnya/);
    } finally {
      vi.useRealTimers();
    }
  });
});

describe('fokus sesudah modal hasil ditutup', () => {
  /** Tunggu setTimeout(0) penunda fokus. */
  const fokusDiHasil = async (m: MejaUji) => {
    await sampai(() => document.activeElement === m.tombol('hasil'));
    expect(document.activeElement).toBe(m.tombol('hasil'));
  };

  it('Escape: fokus pindah ke tombol "Hasil putaran" di bar aksi, bukan lepas ke <body>', async () => {
    meja = await mejaSiapMentung();
    await sampaiHasil(meja);
    tekan('Escape');
    expect(document.querySelector('#modal [data-hasil]')).toBeNull();
    await fokusDiHasil(meja);
  });

  it('"Lihat meja" dan ketuk latar: fokus juga ke tombol "Hasil putaran"', async () => {
    meja = await mejaSiapMentung();
    const dlg = await sampaiHasil(meja);
    dlg.querySelector<HTMLButtonElement>('[data-tutup]')!.click();
    await fokusDiHasil(meja);
    // Dibuka lagi dari tombolnya, lalu tutup lewat latar.
    meja.tombol('hasil')!.click();
    const latar = document.querySelector<HTMLElement>('#modal .latar')!;
    latar.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(document.querySelector('#modal [data-hasil]')).toBeNull();
    await fokusDiHasil(meja);
  });

  it('modal ditutup karena putaran berikutnya dimulai: fokus tidak dipaksa ke mana-mana', async () => {
    meja = await mejaSiapMentung();
    const dlg = await sampaiHasil(meja);
    dlg.querySelector<HTMLButtonElement>('[data-kocok="acak"]')!.click();
    await sampai(() => !!document.querySelector('#modal [data-joker]'));
    await tunggu();
    expect(meja.tombol('hasil')).toBeNull();
    expect(document.activeElement).toBe(document.querySelector('#modal [data-ok]'));
  });
});

describe('klasemen akhir', () => {
  it('memuat skor putaran terakhir tiap pemain dan rincian putaran terakhir (terlipat)', async () => {
    meja = await mejaSiapMentung({ batasPutaran: 1 });
    const dlg = await sampaiHasil(meja, '[data-selesai]');
    const h = meja.g.riwayat.at(-1)!;
    expect(meja.g.status).toBe('selesai');
    expect(dlg.querySelector('thead th.delta')!.textContent).toBe('P1');
    for (const r of h.rincian) {
      const sel = dlg.querySelector(`table.klasemen tr[data-pemain="${r.pemain}"] td.delta`)!;
      expect(sel.textContent).toBe(r.total > 0 ? `+${r.total}` : r.total < 0 ? `−${-r.total}` : '0');
    }
    const ringkas = dlg.querySelector<HTMLDetailsElement>('details.putaran-terakhir')!;
    expect(ringkas.open).toBe(false);
    expect(ringkas.querySelector('summary')!.textContent).toContain('mentung pakai');
    expect(ringkas.querySelectorAll('.rincian > details.akordion')).toHaveLength(h.rincian.length);
  });
});

describe('keadaanTampil (pembaruan PWA dinilai dari yang tampil)', () => {
  it('panel mentung menahan antrian: sibuk walau view terbaru sudah selesai; klasemen akhir = klasemen', async () => {
    meja = await mejaSiapMentung({ batasPutaran: 1 });
    tekan('ArrowRight');
    tekan(' ');
    tekan('b');
    await sampai(() => !!document.querySelector('#modal [data-mentung]'));
    await sampai(() => meja!.g.status === 'susunAkhir');
    // Warga kedai cepat selesai menyusun: view 'selesai' datang selagi panel mentung masih di layar.
    meja.g = semuaSelesaiSusun(meja.g);
    expect(meja.g.status).toBe('selesai');
    meja.kontrol.perbarui(meja.info, meja.view());
    await tunggu();
    const selagiPanel = meja.kontrol.keadaanTampil();
    expect(selagiPanel.sibuk).toBe(true);
    expect(selagiPanel.status).not.toBe('selesai');
    expect(selagiPanel.klasemen).toBe(false);
    document.querySelector<HTMLButtonElement>('#modal [data-lanjut]')!.click();
    await sampai(() => !!document.querySelector('#modal [data-selesai]'));
    await tunggu();
    expect(meja.kontrol.keadaanTampil()).toEqual({ status: 'selesai', sibuk: false, klasemen: true });
  });

  it('popup joker yang belum di-OK = sibuk; sesudah OK tidak', async () => {
    meja = new MejaUji(permainanGiliranku(), { menungguJoker: [0] });
    await sampai(() => !!document.querySelector('#modal [data-joker]'));
    expect(meja.kontrol.keadaanTampil()).toMatchObject({ status: 'putaranBerjalan', sibuk: true, klasemen: false });
    document.querySelector<HTMLButtonElement>('#modal [data-ok]')!.click();
    await tunggu();
    expect(meja.kontrol.keadaanTampil().sibuk).toBe(false);
  });
});

describe('konfirmasi keluar meja', () => {
  it('teks semua jalur dari satu sumber, sesuai perilaku Meja', () => {
    const main = opsiKonfirmasiKeluar({ asal: 'meja', offline: false });
    expect(main.pesan).toContain('diteruskan warga kedai sampai permainan selesai');
    expect(main.pesan).toContain('nggak bisa balik');
    expect(main.bahaya).toBe(true);
    const lobi = opsiKonfirmasiKeluar({ asal: 'lobi', offline: false });
    expect(lobi.pesan).toContain('kode meja');
    expect(lobi.pesan).not.toContain('warga kedai');
    // Permainan sudah selesai: tidak menakut-nakuti soal kursi yang diteruskan.
    const selesai = opsiKonfirmasiKeluar({ asal: 'meja', offline: false, selesai: true });
    expect(selesai.pesan).not.toContain('diteruskan');
    expect(selesai.bahaya).toBeFalsy();
    // Offline: tidak ada yang hilang, tombolnya jujur "Simpan & ke beranda".
    const offline = opsiKonfirmasiKeluar({ asal: 'meja', offline: true });
    expect(offline.ya).toBe('Simpan & ke beranda');
    expect(offline.bahaya).toBeFalsy();
    expect(opsiKonfirmasiKeluar({ asal: 'meja', offline: true, selesai: true }).pesan).not.toContain('tersimpan otomatis');
    for (const o of [main, lobi, selesai, offline]) expect(`${o.judul} ${o.pesan} ${o.ya} ${o.tidak}`).not.toMatch(/\bbot\b/i);
    // Semua jalur online memakai label batal yang sama.
    expect(new Set([main, lobi, selesai].map((o) => o.tidak))).toEqual(new Set(['Tetap di sini']));
  });

  it('meja online yang masuk peringkat (≥ 2 orang): keluar di tengah permainan disebut juru kunci (#45)', () => {
    const KALIMAT = 'Di peringkat online kamu dihitung juru kunci.';
    const masuk = opsiKonfirmasiKeluar({ asal: 'meja', offline: false, masukPeringkat: true });
    expect(masuk.pesan).toBe(`Kursimu diteruskan warga kedai sampai permainan selesai, dan kamu nggak bisa balik ke kursi ini lagi. ${KALIMAT}`);
    expect(opsiKonfirmasiKeluar({ asal: 'meja', offline: false, masukPeringkat: false }).pesan).not.toContain('juru kunci');
    expect(opsiKonfirmasiKeluar({ asal: 'meja', offline: false }).pesan).not.toContain('juru kunci');
    // Di lobi, sesudah selesai, dan offline tidak ada yang dihitung keluar.
    for (const k of [
      { asal: 'lobi' as const, offline: false },
      { asal: 'meja' as const, offline: false, selesai: true },
      { asal: 'meja' as const, offline: true },
    ]) {
      expect(opsiKonfirmasiKeluar({ ...k, masukPeringkat: true }).pesan).not.toContain('juru kunci');
    }
    // ≥ 2 kursi manusia; yang sudah keluar (jadi warga kedai) tidak dihitung.
    const kursi = (...jenis: ('manusia' | 'bot' | 'kosong')[]) => ({ kursi: jenis.map((j) => ({ jenis: j, nama: 'x', terhubung: true, level: 'normal' as const })) });
    expect(mejaMasukPeringkat(kursi('manusia', 'manusia', 'bot'))).toBe(true);
    expect(mejaMasukPeringkat(kursi('manusia', 'bot', 'bot'))).toBe(false);
    expect(mejaMasukPeringkat(null)).toBe(false);
  });

  it('menu meja online dengan 2 orang → Keluar meja: dialog menyebut juru kunci', async () => {
    const g = permainanGiliranku();
    const kursi = g.pemain.map((p, i) => ({ jenis: i < 2 ? ('manusia' as const) : ('bot' as const), nama: p.nama, terhubung: true, level: 'normal' as const }));
    meja = new MejaUji(g, { kursi }, { jenis: 'online' });
    meja.akar.querySelector<HTMLElement>('[data-a="menu"]')!.click();
    document.querySelector<HTMLElement>('#modal [data-m="keluar"]')!.click();
    const d = document.querySelector<HTMLElement>('.dialog.konfirmasi')!;
    expect(d.querySelector('p')!.textContent).toBe(opsiKonfirmasiKeluar({ asal: 'meja', offline: false, masukPeringkat: true }).pesan);
    expect(d.querySelector('p')!.textContent).toContain('juru kunci');
    d.querySelector<HTMLElement>('[data-tidak]')!.click();
    await tunggu();
    expect(meja.terkirim.some((p) => p.t === 'keluar')).toBe(false);
  });

  it('menu meja online → Keluar meja: dialognya sama persis dengan jalur Back', async () => {
    meja = new MejaUji(permainanGiliranku(), {}, { jenis: 'online' });
    meja.akar.querySelector<HTMLElement>('[data-a="menu"]')!.click();
    document.querySelector<HTMLElement>('#modal [data-m="keluar"]')!.click();
    const d = document.querySelector<HTMLElement>('.dialog.konfirmasi')!;
    const harap = opsiKonfirmasiKeluar({ asal: 'meja', offline: false });
    expect(d.querySelector('h2')!.textContent).toBe(harap.judul);
    expect(d.querySelector('p')!.textContent).toBe(harap.pesan);
    expect(d.querySelector('[data-tidak]')!.textContent).toBe(harap.tidak);
    d.querySelector<HTMLElement>('[data-tidak]')!.click();
    await tunggu();
    expect(meja.terkirim.some((p) => p.t === 'keluar')).toBe(false);
  });
});

describe('promosi Kedai Madya (soft selling)', () => {
  /** Semua tautan/kartu kedai yang ada di dokumen saat ini. */
  const promosi = () => document.querySelectorAll('.kartu-kedai, .ajakan-kedai, a[href*="maps.google"], a[href*="kedaimadya"], a[href*="lovable.app"]');

  it('tidak pernah di layar meja: putaran berjalan, menu, panel mentung, susun akhir, hasil putaran', async () => {
    meja = await mejaSiapMentung();
    expect(promosi()).toHaveLength(0);
    // Menu meja.
    meja.akar.querySelector<HTMLElement>('[data-a="menu"]')!.click();
    expect(document.querySelector('#modal .menu-meja')).not.toBeNull();
    expect(promosi()).toHaveLength(0);
    tutupModal();
    // Mentung → panel mentung → susun akhir → hasil putaran.
    tekan('ArrowRight');
    tekan(' ');
    tekan('b');
    await sampai(() => !!document.querySelector('#modal [data-mentung]'));
    expect(promosi()).toHaveLength(0);
    document.querySelector<HTMLButtonElement>('#modal [data-lanjut]')!.click();
    await sampai(() => meja!.g.status === 'susunAkhir' && !document.querySelector('#modal [data-mentung]'));
    expect(promosi()).toHaveLength(0);
    meja.g = semuaSelesaiSusun(meja.g);
    meja.kontrol.perbarui(meja.info, meja.view());
    await sampai(() => !!document.querySelector('#modal [data-hasil]'));
    expect(promosi()).toHaveLength(0);
  });

  it('klasemen akhir: tepat satu baris ajakan dengan tautan peta polos (tab baru, tanpa pelacakan)', async () => {
    meja = await mejaSiapMentung({ batasPutaran: 1 });
    const dlg = await sampaiHasil(meja, '[data-selesai]');
    const ajakan = dlg.querySelectorAll('.ajakan-kedai');
    expect(ajakan).toHaveLength(1);
    const a = ajakan[0]!.querySelectorAll('a');
    expect(a).toHaveLength(1);
    expect(a[0]!.getAttribute('href')).toBe(KEDAI.peta);
    expect(a[0]!.getAttribute('target')).toBe('_blank');
    expect(a[0]!.getAttribute('rel')).toBe('noopener noreferrer');
    // Sesudah tombol-tombol klasemen, bukan sebelum.
    const deret = dlg.querySelector('.deret')!;
    expect(deret.compareDocumentPosition(ajakan[0]!) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('latihan dengan panduan: klasemen akhir tanpa ajakan', async () => {
    meja = await mejaSiapMentung({ batasPutaran: 1 }, { tutorial: true });
    // Gelembung tutorial dilewati supaya alur keyboard sama dengan permainan biasa.
    meja.akar.querySelector<HTMLElement>('.tutorial-gelembung [data-t="lewati"]')?.click();
    const dlg = await sampaiHasil(meja, '[data-selesai]');
    expect(dlg.querySelector('.ajakan-kedai')).toBeNull();
    expect(promosi()).toHaveLength(0);
  });
});

describe('latihan dengan panduan: penutup di klasemen akhir', () => {
  it('klasemen memuat penjelasan skor dan penutup; tutorialSelesai baru disimpan setelah penutup tampil', async () => {
    localStorage.removeItem('remi.preferensi');
    _setelUlangCache();
    meja = await mejaSiapMentung({ batasPutaran: 1 }, { tutorial: true });
    // Sambutan dibaca (tidak dilewati), langkah-langkah lain dibiarkan.
    await sampai(() => !!meja!.akar.querySelector('.tutorial-gelembung [data-t="lanjut"]'));
    meja.akar.querySelector<HTMLElement>('.tutorial-gelembung [data-t="lanjut"]')!.click();
    expect(preferensi().tutorialSelesai).toBe(false);
    const dlg = await sampaiHasil(meja, '[data-selesai]');
    const skor = dlg.querySelector('[data-tutorial="skor"]');
    const penutup = dlg.querySelector('[data-tutorial="selesai"]');
    expect(skor?.textContent).toContain(TEKS_TUTORIAL.skor.judul);
    expect(penutup?.textContent).toContain(TEKS_TUTORIAL.selesai.judul);
    // Penutup sesudah rincian, sebelum tombol; tombol utamanya "Ayo main" (main sungguhan offline).
    const deret = dlg.querySelector('.deret')!;
    expect(penutup!.compareDocumentPosition(deret) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(dlg.querySelector('[data-a="lagi"]')!.textContent).toBe(TEKS_TUTORIAL.selesai.tombol);
    expect(preferensi().tutorialSelesai).toBe(true);
    // Gelembung tutorial tidak tertinggal di atas klasemen, dan tidak ada promosi kedai di latihan.
    expect(meja.akar.querySelector('.tutorial')?.classList.contains('tersembunyi') ?? true).toBe(true);
    expect(dlg.querySelector('.ajakan-kedai')).toBeNull();
    // Pagar info rahasia: catatannya tidak menyebut angka joker putaran ini.
    const teks = `${skor!.textContent} ${penutup!.textContent}`;
    expect(teks).not.toMatch(/\b2\b|joker/i);
  });

  it('latihan yang tutorialnya dilewati: klasemen tanpa catatan tutorial, tombol tetap "Main lagi"', async () => {
    meja = await mejaSiapMentung({ batasPutaran: 1 }, { tutorial: true });
    await sampai(() => !!meja!.akar.querySelector('.tutorial-gelembung [data-t="lewati"]'));
    meja.akar.querySelector<HTMLElement>('.tutorial-gelembung [data-t="lewati"]')!.click();
    const dlg = await sampaiHasil(meja, '[data-selesai]');
    expect(dlg.querySelector('.tutorial-catatan')).toBeNull();
    expect(dlg.querySelector('[data-a="lagi"]')!.textContent).toBe('Main lagi');
  });
});

describe('seret ke buangan', () => {
  it('selagi aksi sebelumnya menunggu jawaban: "abaikan" (kembali tanpa goyang), tanpa tolak & tanpa kirim', async () => {
    const h = terapkanAksi(permainanGiliranku(), { jenis: 'ambilDeck', pemain: 0 });
    if (!h.ok) throw new Error(h.error.pesan);
    meja = new MejaUji(h.state);
    meja.diam = true;
    const [a, b] = meja.g.putaran!.tangan[0].filter((k) => k.rank !== 1);
    expect(meja.kontrol.lepasKeBuangan(a.id)).toBeUndefined(); // buang terkirim, menunggu jawaban
    expect(meja.aksi).toEqual([{ jenis: 'buang', kartuId: a.id }]);
    vi.mocked(bunyi).mockClear();
    expect(meja.kontrol.lepasKeBuangan(b.id)).toBe('abaikan');
    expect(meja.aksi).toHaveLength(1);
    expect(meja.sp.tolak).toEqual([]);
    expect(bunyi).not.toHaveBeenCalledWith('tolak');
  });

  it('belum waktunya buang tetap ditolak (goyang) seperti biasa', () => {
    meja = new MejaUji(permainanGiliranku()); // tahap ambil
    const k = meja.g.putaran!.tangan[0][0];
    expect(meja.kontrol.lepasKeBuangan(k.id)).not.toBe('abaikan');
    expect(meja.sp.tolak.length).toBeGreaterThan(0);
  });
});

describe('pilihan kartu & anti-dobel', () => {
  it('kartu yang diketuk selagi kartu deck masih terbang tetap terpilih di tahap main', async () => {
    meja = new MejaUji(permainanGiliranku());
    const target = meja.g.putaran!.tangan[0].find((k) => k.rank !== 1)!;
    tekan('d');
    // View jawaban sudah diterima, animasi ambil deck belum selesai: pemain cepat mengetuk kartu.
    meja.kontrol.ketukKartu(target.id);
    await tunggu();
    expect(meja.g.putaran!.tahap).toBe('main');
    expect(meja.sp.model()!.dipilih.has(target.id)).toBe(true);
    expect(meja.tombol('buang')!.textContent).toContain('Buang');
  });

  it('pilihan sambil menunggu terbawa ke giliranku; dilepas saat giliranku berakhir', async () => {
    const g = permainanGiliranku();
    const h = terapkanAksi(g, { jenis: 'ambilDeck', pemain: 0 });
    if (!h.ok) throw new Error(h.error.pesan);
    meja = new MejaUji(h.state);
    const tangan = meja.g.putaran!.tangan[0].filter((k) => k.rank !== 1);
    const [a, b, buang] = tangan;
    meja.kontrol.ketukKartu(a.id);
    meja.kontrol.ketukKartu(b.id);
    // Giliranku berakhir (mis. dijalankan bot karena waktu habis): pilihan basi dilepas.
    const h2 = terapkanAksi(meja.g, { jenis: 'buang', pemain: 0, kartuId: buang.id });
    if (!h2.ok) throw new Error(h2.error.pesan);
    meja.g = h2.state;
    meja.kontrol.perbarui(null, meja.view());
    await tunggu();
    expect(meja.sp.model()!.dipilih.size).toBe(0);
    // Sambil menunggu lawan: pilih kartu, lalu giliran kembali padaku → pilihan tetap.
    meja.kontrol.ketukKartu(a.id);
    let gs = meja.g;
    while (gs.putaran!.giliran !== 0) {
      const p = gs.putaran!.giliran;
      const x = terapkanAksi(gs, { jenis: 'ambilDeck', pemain: p });
      if (!x.ok) throw new Error(x.error.pesan);
      const kartuBuang = x.state.putaran!.tangan[p].find((k) => k.rank !== 1 && k.rank !== x.state.putaran!.rankJoker)!;
      const y = terapkanAksi(x.state, { jenis: 'buang', pemain: p, kartuId: kartuBuang.id });
      if (!y.ok) throw new Error(y.error.pesan);
      gs = y.state;
    }
    meja.g = gs;
    meja.kontrol.perbarui(null, meja.view());
    await sampai(() => meja!.sp.model()!.view.putaran!.giliran === 0);
    expect(meja.sp.model()!.dipilih.has(a.id)).toBe(true);
  });

  it('tahan D / tekan dua kali sebelum jawaban datang: ambil deck terkirim sekali', async () => {
    meja = new MejaUji(permainanGiliranku());
    meja.diam = true;
    tekan('d');
    tekan('d', document.body, true);
    tekan('d', document.body, true);
    vi.mocked(bunyi).mockClear();
    tekan('d'); // tekan lagi (bukan repeat) selagi menunggu jawaban: diabaikan diam-diam
    meja.tombol('ambil')!.click(); // double-tap tombol
    meja.kontrol.ketukDeck(); // double-tap deck di kanvas
    expect(meja.aksi).toEqual([{ jenis: 'ambilDeck' }]);
    expect(bunyi).not.toHaveBeenCalledWith('tolak');
    expect(meja.tombol('ambil')!.dataset.alasan).toBe('Sebentar, aksinya lagi diproses…');
    // Jawaban datang: kunci lepas.
    meja.diam = false;
    const h = terapkanAksi(meja.g, { jenis: 'ambilDeck', pemain: 0 });
    if (!h.ok) throw new Error(h.error.pesan);
    meja.g = h.state;
    meja.kontrol.perbarui(null, meja.view());
    await tunggu();
    expect(meja.tombol('buang')!.getAttribute('aria-disabled')).toBe('true'); // mati karena belum pilih, bukan karena kunci
    expect(meja.tombol('buang')!.dataset.alasan).toBe('Pilih kartu yang mau dibuang.');
  });

  it('kunci kirim lepas sendiri setelah batas waktu kalau server tidak menjawab', async () => {
    vi.useFakeTimers();
    try {
      meja = new MejaUji(permainanGiliranku());
      meja.diam = true;
      tekan('d');
      expect(meja.tombol('ambil')!.dataset.alasan).toBe('Sebentar, aksinya lagi diproses…');
      vi.advanceTimersByTime(3100);
      expect(meja.tombol('ambil')!.getAttribute('aria-disabled')).toBe('false');
      tekan('d');
      expect(meja.aksi).toEqual([{ jenis: 'ambilDeck' }, { jenis: 'ambilDeck' }]);
    } finally {
      vi.useRealTimers();
    }
  });

  it('panah tetap boleh auto-repeat', () => {
    meja = new MejaUji(permainanGiliranku());
    tekan('ArrowRight');
    tekan('ArrowRight', document.body, true);
    const tangan = meja.sp.model()!.tangan;
    expect(meja.sp.model()!.fokus).toBe(tangan[1].id);
  });
});

describe('petunjuk & bar atas', () => {
  it('sesudah konfirmasi mulung petunjuk tidak lagi menyuruh menekan Konfirmasi', async () => {
    const g = skenario({
      rankJoker: 2,
      tangan: [['5 love', '6 love', '9 waru', 'K kriting'], ['3 waru', '4 waru', '5 waru'], ['3 love', '4 love', '8 waru'], ['J love', 'Q love', '10 waru']],
      buangan: [['7 love', 1]],
      giliran: 0,
    });
    meja = new MejaUji(g);
    tekan('1');
    const id = (t: string) => [...meja!.g.putaran!.tangan[0], ...meja!.g.putaran!.buangan.map((e) => e.kartu)].find((k) => namaKartu(k).startsWith(t))!.id;
    meja.kontrol.ketukKartu(id('5 Love'));
    meja.kontrol.ketukKartu(id('6 Love'));
    meja.kontrol.ketukKartu(id('7 Love'));
    tekan('j');
    expect(meja.petunjuk()).toBe('Siap. Tekan "Konfirmasi" untuk mulung.');
    meja.diam = true;
    tekan('k');
    expect(meja.aksi.at(-1)).toMatchObject({ jenis: 'mulung', jumlah: 1 });
    expect(meja.petunjuk()).toBe('Mulung dikirim, tunggu kartunya mendarat…');
  });

  it('nomor & batas putaran terpisah dari jenis meja (nomor tidak ikut terpotong)', () => {
    expect(teksBarAtas('Offline', 1, 3)).toEqual({ jenis: 'Offline', putaran: 'Putaran 1/3' });
    expect(teksBarAtas('Meja AB12C', 2, null)).toEqual({ jenis: 'Meja AB12C', putaran: 'Putaran 2' });
    expect(teksBarAtas('Offline', null, 3).putaran).toBe('');
    // Putaran kaldu (#42): penandanya menggantikan batas putaran (kaldu bisa berulang sesudah batas).
    expect(teksBarAtas('Offline', 6, 6, true)).toEqual({ jenis: 'Offline', putaran: 'Putaran 6 · Kaldu' });
    expect(teksBarAtas('Meja AB12C', 7, null, true).putaran).toBe('Putaran 7 · Kaldu');
    expect(teksBarAtas('Offline', null, 6, true).putaran).toBe('');
    meja = new MejaUji(permainanGiliranku());
    expect(meja.akar.querySelector('.info .info-putaran')!.textContent).toMatch(/^Putaran 1/);
    expect(meja.akar.querySelector('.info .info-jenis')!.textContent).toBe('Offline');
  });
});

describe('hancurkan menutup semua jendela', () => {
  it('dialog Skor/Pintasan yang terbuka ikut ditutup dan #ui tidak tertinggal inert', () => {
    const ui = document.createElement('div');
    ui.id = 'ui';
    document.body.appendChild(ui);
    try {
      const m = new MejaUji(permainanGiliranku());
      (m.akar.querySelector('[data-a=skor]') as HTMLElement).click();
      expect(document.querySelector('#lapisan-dialog .dialog')).not.toBeNull();
      expect(ui.inert).toBe(true);
      m.hancurkan();
      expect(document.querySelector('#lapisan-dialog .dialog')).toBeNull();
      expect(document.querySelector('#modal .dialog')).toBeNull();
      expect(ui.inert).toBe(false);
    } finally {
      ui.remove();
    }
  });
});

describe('tombol urut: nama aksesibel diawali teks yang terlihat (WCAG 2.5.3)', () => {
  it('tiap mode urutan: aria-label diawali tulisan kecil di tombol; ikon bukan teks DOM', async () => {
    meja = new MejaUji(permainanGiliranku());
    const dilihat = new Set<string>();
    for (let i = 0; i < 3; i++) {
      const b = meja.tombol('urut')!;
      const terlihat = b.textContent!.trim();
      // Satu-satunya teks DOM di tombol adalah tulisan kecilnya (ikon ⇅ lewat CSS).
      expect(terlihat).toBe(b.querySelector('small')!.textContent);
      expect(b.querySelector('.ikon-urut')!.textContent).toBe('');
      expect(b.getAttribute('aria-label')!.toLowerCase().startsWith(terlihat.toLowerCase())).toBe(true);
      dilihat.add(terlihat);
      b.click();
      await tunggu();
    }
    expect(dilihat).toEqual(new Set(['urut', 'bunga', 'angka']));
  });
});

// ---------- mode kaldu (#42, #43) ----------

describe('mode kaldu (#42): teks pendek di meja', () => {
  /** Kursi: aku + `manusia - 1` orang lain, sisanya warga kedai. */
  const kursi = (g: GameState, manusia: number): Partial<InfoMeja> => ({
    kursi: g.pemain.map((p, i) => ({ jenis: i < manusia ? 'manusia' : 'bot', nama: p.nama, terhubung: true, level: 'normal' })),
    setujuKaldu: [],
  });

  /**
   * Meja mode kaldu: aku tinggal membuang 9 Waru (nilai pentungan 50) untuk mentung, habis mulung
   * 7 Love, seperti mejaSiapMentung. `s` mengatur putaran kaldu, voting, dan batas putaran.
   */
  async function mejaKalduSiapMentung(s: Partial<Skenario>, manusia = 2, appUbah: Partial<AppUntukMeja> = {}): Promise<MejaUji> {
    const g = skenario({
      modeKaldu: true,
      rankJoker: 2,
      tangan: [['5 love', '6 love', '9 waru'], ['3 waru', '4 waru', '5 waru'], ['3 love', '4 love', '8 waru'], ['J love', 'Q love', '10 waru']],
      buangan: [['7 love', 1]],
      giliran: 0,
      ...s,
    });
    const m = new MejaUji(g, kursi(g, manusia), appUbah);
    m.app.kirim({ t: 'aksi', aksi: { jenis: 'mulung', jumlah: 1, kartuJadi: [spek('5 love', '6 love', '7 love')] } });
    await sampai(() => m.g.putaran!.tahap === 'main' && !!m.tombol('buang'));
    return m;
  }

  const tombolKaldu = () => document.querySelector<HTMLButtonElement>('#modal [data-kaldu]');
  const infoKaldu = () => document.querySelector<HTMLElement>('#modal [data-info-kaldu]')!;
  const infoTerlihat = () => (infoKaldu().classList.contains('tersembunyi') ? '' : infoKaldu().textContent);

  it('bar atas di putaran kaldu: "Putaran 1 · Kaldu" (tanpa batas putaran); meja biasa tetap "Putaran 1/3"', () => {
    meja = new MejaUji(permainanGiliranku({ modeKaldu: true, batasPutaran: 1 }));
    expect(meja.g.putaran!.kaldu).toBe(true);
    expect(meja.akar.querySelector('.info .info-putaran')!.textContent).toBe('Putaran 1 · Kaldu');
    meja.hancurkan();
    // Meja mode kaldu, putaran yang belum kaldu: tampil biasa.
    meja = new MejaUji(permainanGiliranku({ modeKaldu: true, batasPutaran: 3 }));
    expect(meja.g.putaran!.kaldu).toBeUndefined();
    expect(meja.akar.querySelector('.info .info-putaran')!.textContent).toBe('Putaran 1/3');
  });

  it('popup joker di putaran kaldu: judulnya "Putaran 1 · Kaldu", isi lainnya sama persis dengan popup biasa', async () => {
    const isiPopup = async (g: GameState) => {
      meja = new MejaUji(g, { menungguJoker: [0] });
      await sampai(() => !!document.querySelector('#modal [data-joker]'));
      const dlg = document.querySelector('#modal [data-joker]')!.closest('.dialog')!;
      const hasil = { judul: dlg.querySelector('h2')!.textContent, sisa: [...dlg.querySelectorAll('p, button')].map((e) => e.textContent) };
      meja.hancurkan();
      meja = null;
      tutupModal();
      return hasil;
    };
    const biasa = await isiPopup(permainanGiliranku({ batasPutaran: 3 }));
    const kaldu = await isiPopup(permainanGiliranku({ modeKaldu: true, batasPutaran: 1 }));
    expect(biasa.judul).toBe('Putaran 1 · Joker');
    expect(kaldu.judul).toBe('Putaran 1 · Kaldu');
    // Popup joker tidak bertambah penjelasan apa pun (keputusan pemilik: teks di meja sesingkat mungkin).
    expect(kaldu.sisa).toEqual(biasa.sisa);
  });

  it('panel mentung putaran kaldu: lencana "×2 KALDU" dan nilai yang sudah dikali; klasemen menyebut alasannya', async () => {
    const m = (meja = await mejaKalduSiapMentung({ kaldu: true, konfigurasi: { batasPutaran: 1 } }));
    tekan('ArrowRight');
    tekan(' ');
    tekan('b');
    await sampai(() => !!document.querySelector('#modal [data-mentung]'));
    const dlg = document.querySelector('#modal [data-mentung]')!.closest('.dialog')!;
    const lencana = [...dlg.querySelectorAll('.lencana-deret .lencana')].map((e) => e.textContent);
    expect(lencana).toContain(TEKS_KALDU.lencana);
    expect(TEKS_KALDU.lencana).toBe('×2 KALDU');
    expect(dlg.querySelector('p.rata-tengah')!.textContent).toBe('Kamu nutup pakai 9 Waru · nilai 100');
    expect(dlg.querySelector('.kotak-status')!.textContent).toContain('Kamu MENTUNG! +100');

    document.querySelector<HTMLButtonElement>('#modal [data-lanjut]')!.click();
    await sampai(() => m.g.status === 'susunAkhir' && !document.querySelector('#modal [data-mentung]'));
    m.g = semuaSelesaiSusun(m.g);
    expect(m.g.alasanSelesai).toBe('kaldu');
    m.kontrol.perbarui(m.info, m.view());
    await sampai(() => !!document.querySelector('#modal [data-selesai]'));
    const klasemen = document.querySelector('#modal [data-selesai]')!.closest('.dialog')!;
    expect(klasemen.textContent).toContain('Putaran kaldu ditutup mentung. 1 putaran.');
    expect(klasemen.querySelector('details.putaran-terakhir summary')!.textContent).toContain('(50 × 2 = 100)');
  });

  it('panel mentung meja biasa: tanpa lencana kaldu', async () => {
    meja = await mejaSiapMentung();
    tekan('ArrowRight');
    tekan(' ');
    tekan('b');
    await sampai(() => !!document.querySelector('#modal [data-mentung]'));
    expect(document.querySelector('#modal .dialog')!.textContent).not.toContain('KALDU');
  });

  it('modal hasil online: "Putaran terakhir (n/m)" meniru voting akhiri, lalu hilang begitu disepakati', async () => {
    const m = (meja = await mejaKalduSiapMentung({}, 2, { jenis: 'online' }));
    const dlg = await sampaiHasil(m);
    expect(m.g.status).toBe('putaranSelesai');
    const b = tombolKaldu()!;
    expect(b.textContent).toBe('Putaran terakhir (0/2)');
    // Urutan di kaki: Lihat meja · Putaran terakhir · Akhiri permainan.
    expect([...dlg.querySelectorAll('[data-deret-voting] button')].map((x) => x.textContent)).toEqual([
      'Lihat meja',
      'Putaran terakhir (0/2)',
      'Akhiri permainan (0/2)',
    ]);
    expect(infoTerlihat()).toBe('');

    m.diam = true;
    b.click();
    expect(m.terkirim.at(-1)).toEqual({ t: 'putaranTerakhir', setuju: true });
    expect(b.textContent).toBe('Mengirim…');
    expect(terkunci(b)).toBe(true);
    b.click(); // selagi menunggu: diabaikan
    expect(m.terkirim.filter((p) => p.t === 'putaranTerakhir')).toHaveLength(1);

    // Info meja datang: aku sudah setuju, tinggal satu orang lagi. Diperbarui di tempat.
    m.info = { ...m.info, setujuKaldu: [0] };
    m.kontrol.perbarui(m.info, null);
    expect(document.querySelector('#modal [data-hasil]')!.closest('.dialog')).toBe(dlg);
    expect(tombolKaldu()).toBe(b);
    expect(b.textContent).toBe('Batal putaran terakhir (1/2)');
    expect(terkunci(b)).toBe(false);
    b.click();
    expect(m.terkirim.at(-1)).toEqual({ t: 'putaranTerakhir', setuju: false });
    m.info = { ...m.info, setujuKaldu: [] };
    m.kontrol.perbarui(m.info, null);
    expect(b.textContent).toBe('Putaran terakhir (0/2)');

    // Semua setuju: meja menerapkan putaranTerakhir, suara dikosongkan.
    b.focus();
    const h = terapkanAksi(m.g, { jenis: 'putaranTerakhir' });
    if (!h.ok) throw new Error(h.error.pesan);
    m.g = h.state;
    m.info = { ...m.info, setujuKaldu: [] };
    m.kontrol.perbarui(m.info, m.view());
    await sampai(() => !tombolKaldu());
    expect(document.querySelector('#modal [data-hasil]')!.closest('.dialog')).toBe(dlg);
    expect(infoTerlihat()).toBe(TEKS_KALDU.berikutnya);
    // Fokus tidak lepas ke <body>.
    expect(document.activeElement).toBe(dlg.querySelector('[data-kocok]'));
    expect(dlg.querySelector('[data-akhiri]')!.textContent).toBe('Akhiri permainan (0/2)');
  });

  it('modal hasil offline (satu orang): "Putaran terakhir" tanpa hitungan, langsung berlaku', async () => {
    const m = (meja = await mejaKalduSiapMentung({}, 1));
    await sampaiHasil(m);
    const b = tombolKaldu()!;
    expect(b.textContent).toBe(TEKS_KALDU.tombol);
    b.click();
    expect(m.terkirim.at(-1)).toEqual({ t: 'putaranTerakhir', setuju: true });
    await sampai(() => !tombolKaldu());
    expect(m.g.kalduDiminta).toBe(true);
    expect(infoTerlihat()).toBe(TEKS_KALDU.berikutnya);
    // Putaran berikutnya benar-benar kaldu.
    document.querySelector<HTMLButtonElement>('#modal [data-kocok="acak"]')!.click();
    await sampai(() => !!document.querySelector('#modal [data-joker]'));
    expect(m.g.putaran!.kaldu).toBe(true);
    expect(document.querySelector('#modal [data-joker] ~ h2')!.textContent).toBe('Putaran 2 · Kaldu');
  });

  it('putaran berikutnya sudah pasti kaldu (batas putaran): tanpa tombol, satu baris saja', async () => {
    meja = await mejaKalduSiapMentung({ konfigurasi: { batasPutaran: 2 } }, 2, { jenis: 'online' });
    await sampaiHasil(meja);
    expect(tombolKaldu()).toBeNull();
    expect(infoTerlihat()).toBe('Putaran berikutnya kaldu.');
  });

  it('putaran kaldu habis tanpa mentung: "Belum ada yang mentung, kaldu lagi.", tanpa tombol', async () => {
    // Deck tinggal satu kartu: aku ambil, buang, deck habis, susun akhir, putaran selesai.
    let g = skenario({
      modeKaldu: true,
      kaldu: true,
      konfigurasi: { batasPutaran: 1 },
      rankJoker: 2,
      tangan: [['5 love', '6 love', '9 waru'], ['3 waru', '4 waru', '5 waru'], ['3 love', '4 love', '8 waru'], ['J love', 'Q love', '10 waru']],
      deck: ['K waru'],
      giliran: 0,
    });
    for (const a of [{ jenis: 'ambilDeck', pemain: 0 }, { jenis: 'buang', pemain: 0, kartuId: id('K waru') }] as Aksi[]) {
      const h = terapkanAksi(g, a);
      if (!h.ok) throw new Error(h.error.pesan);
      g = h.state;
    }
    g = semuaSelesaiSusun(g);
    expect([g.status, g.riwayat.at(-1)!.cara, g.riwayat.at(-1)!.kaldu]).toEqual(['putaranSelesai', 'deckHabis', true]);
    meja = new MejaUji(g, kursi(g, 2), { jenis: 'online' });
    await sampai(() => !!document.querySelector('#modal [data-hasil]'));
    expect(tombolKaldu()).toBeNull();
    expect(infoTerlihat()).toBe(TEKS_KALDU.lagi);
  });

  it('meja biasa: tanpa tombol dan tanpa baris kaldu', async () => {
    meja = await mejaSiapMentung();
    await sampaiHasil(meja);
    expect(tombolKaldu()).toBeNull();
    expect(infoTerlihat()).toBe('');
  });

  it('teksInfoKaldu: hanya kalau putaran berikutnya pasti kaldu', () => {
    const v = (konfigurasi: object, riwayat: number, kalduDiminta?: true) =>
      ({ konfigurasi: { batasPutaran: null, ...konfigurasi }, riwayat: Array(riwayat).fill({}), ...(kalduDiminta ? { kalduDiminta } : {}) }) as unknown as ViewPemain;
    const mentung = { cara: 'mentung' } as HasilPutaranUji;
    const habisKaldu = { cara: 'deckHabis', kaldu: true } as HasilPutaranUji;
    expect(teksInfoKaldu(v({}, 1), mentung)).toBe('');
    expect(teksInfoKaldu(v({ modeKaldu: true }, 1), mentung)).toBe('');
    expect(teksInfoKaldu(v({ modeKaldu: true }, 1, true), mentung)).toBe(TEKS_KALDU.berikutnya);
    expect(teksInfoKaldu(v({ modeKaldu: true, batasPutaran: 3 }, 2), mentung)).toBe(TEKS_KALDU.berikutnya);
    expect(teksInfoKaldu(v({ modeKaldu: true, batasPutaran: 3 }, 3), habisKaldu)).toBe(TEKS_KALDU.lagi);
    // Meja biasa dengan batas putaran: tidak ada kaldu.
    expect(teksInfoKaldu(v({ batasPutaran: 3 }, 2), mentung)).toBe('');
  });
});

type HasilPutaranUji = Parameters<typeof teksInfoKaldu>[1];
