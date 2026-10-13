// @vitest-environment happy-dom
// Tutorial coach mark (ui/tutorial.ts): pemicu murni dari keadaan meja + perilaku gelembungnya.
// Pagar info rahasia: teks tutorial tidak menyebut angka/kartu tertentu, dan pemicunya hanya
// membaca keadaan yang sudah terlihat pemain.

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { TEKS_TUTORIAL, URUTAN_TUTORIAL, type IdLangkahTutorial } from '../src/konten/tutorial';
import { _setelUlangCache, preferensi } from '../src/preferensi';
import {
  evaluasiTutorial,
  LANGKAH_JENDELA,
  posisiGelembung,
  posisiTepi,
  sorotanLangkah,
  SYARAT_TUTORIAL,
  tataGelembung,
  teksPengumuman,
  Tutorial,
  type KeadaanTutorial,
} from '../src/ui/tutorial';

const dasar: KeadaanTutorial = {
  status: 'putaranBerjalan',
  menungguJoker: false,
  giliranku: false,
  tahap: 'ambil',
  bisaMulung: false,
  adaBuangan: false,
  sedangMulung: false,
  habisMulung: false,
  adaMentung: false,
  susunSaya: false,
  giliranLawan: 1,
  lawanBerkartuJadi: null,
  sibuk: false,
};
const k = (ubah: Partial<KeadaanTutorial> = {}): KeadaanTutorial => ({ ...dasar, ...ubah });
const set = (...id: IdLangkahTutorial[]) => new Set<IdLangkahTutorial>(id);
/** Semua langkah sebelum `id` di URUTAN dianggap selesai. */
const sampai = (id: IdLangkahTutorial) => new Set(URUTAN_TUTORIAL.slice(0, URUTAN_TUTORIAL.indexOf(id)));

describe('evaluasiTutorial (murni)', () => {
  it('sambutan selalu pertama, bahkan saat masih menunggu popup joker', () => {
    expect(evaluasiTutorial(set(), null, k({ menungguJoker: true })).tampil).toBe('sambutan');
  });

  it('sibuk (jendela terbuka/animasi): tidak menampilkan apa pun dan tidak menandai selesai', () => {
    expect(evaluasiTutorial(set(), 'tangan', k({ sibuk: true, status: 'putaranSelesai' }))).toEqual({ selesaiBaru: [], tampil: null });
  });

  it('langkah jendela (joker, skor) tidak pernah jadi gelembung', () => {
    const h = evaluasiTutorial(set('sambutan'), null, k({ menungguJoker: true }));
    expect(h.tampil).not.toBe('joker');
    for (const id of LANGKAH_JENDELA) expect(URUTAN_TUTORIAL).toContain(id);
  });

  it('giliranku tahap ambil memicu giliranAmbil → deck → buangan → mulung sesuai urutan', () => {
    const ambil = k({ giliranku: true, tahap: 'ambil', adaBuangan: true, bisaMulung: true, giliranLawan: null });
    let selesai = set('sambutan', 'joker', 'tangan');
    const urut: IdLangkahTutorial[] = [];
    for (let i = 0; i < 4; i++) {
      const t = evaluasiTutorial(selesai, null, ambil).tampil!;
      urut.push(t);
      selesai = new Set([...selesai, t]);
    }
    expect(urut).toEqual(['giliranAmbil', 'deck', 'buangan', 'mulung']);
  });

  it('langkah yang sedang tampil dianggap selesai begitu momennya lewat (pemain sudah bertindak)', () => {
    // 'deck' tampil, pemain langsung ambil deck → tahap main: 'deck' selesai, lanjut ke 'turunkan'.
    const selesai = new Set([...sampai('deck')]);
    const h = evaluasiTutorial(selesai, 'deck', k({ giliranku: true, tahap: 'main', giliranLawan: null }));
    expect(h.selesaiBaru).toEqual(['deck']);
    expect(h.tampil).toBe('turunkan');
  });

  it('mentung relevan setelah mulung di giliranku, atau saat sudah ada yang mentung', () => {
    const sebelum = sampai('mentung');
    expect(evaluasiTutorial(sebelum, null, k({ giliranku: true, tahap: 'main', habisMulung: true, giliranLawan: null })).tampil).toBe('mentung');
    expect(evaluasiTutorial(sebelum, null, k({ giliranku: true, tahap: 'main', habisMulung: false, giliranLawan: null })).tampil).toBeNull();
    expect(evaluasiTutorial(sebelum, null, k({ status: 'susunAkhir', adaMentung: true, giliranLawan: null })).tampil).toBe('mentung');
  });

  it('susun akhir hanya kalau aku belum menekan Selesai', () => {
    const sebelum = sampai('susunAkhir');
    expect(evaluasiTutorial(sebelum, null, k({ status: 'susunAkhir', susunSaya: true, giliranLawan: null })).tampil).toBe('susunAkhir');
    expect(evaluasiTutorial(sebelum, null, k({ status: 'susunAkhir', susunSaya: false, giliranLawan: null })).tampil).toBeNull();
  });

  it('penutup muncul setelah skor dibahas', () => {
    const semua = new Set(URUTAN_TUTORIAL.filter((x) => x !== 'selesai'));
    expect(evaluasiTutorial(semua, null, k()).tampil).toBe('selesai');
    expect(SYARAT_TUTORIAL.selesai(k(), set())).toBe(false);
    expect(SYARAT_TUTORIAL.selesai(k({ status: 'selesai' }), set())).toBe(true);
  });

  it('sorotan: area meja untuk deck/buangan/tangan/panel lawan, tombol bar untuk aksi, tengah untuk sambutan', () => {
    expect(sorotanLangkah('deck', k())).toEqual({ meja: 'deck' });
    expect(sorotanLangkah('mulung', k())).toEqual({ meja: 'buangan' });
    expect(sorotanLangkah('giliranLawan', k({ giliranLawan: 2 }))).toEqual({ meja: 'panel', indeks: 2 });
    expect(sorotanLangkah('buang', k())).toEqual({ dom: '[data-a="buang"]' });
    expect(sorotanLangkah('sambutan', k())).toBeNull();
  });

  it('teks tutorial tidak menyebut angka kartu tertentu atau kartu "aman"', () => {
    for (const id of URUTAN_TUTORIAL) {
      const t = TEKS_TUTORIAL[id];
      const semua = `${t.judul} ${t.teks}`;
      expect(semua).not.toMatch(/\b(As|J|Q|K|[2-9]|10) (Love|Wajik|Kriting|Waru)\b/);
      expect(semua).not.toMatch(/aman dibuang/i);
    }
  });
});

describe('posisiGelembung / tataGelembung', () => {
  type Kotak = { x: number; y: number; w: number; h: number };
  const iris = (a: Kotak, b: Kotak, pad = 0) =>
    a.x < b.x + b.w + pad && b.x - pad < a.x + a.w && a.y < b.y + b.h + pad && b.y - pad < a.y + a.h;
  /** Gelembung di layar, di bawah bar atas, dan tidak menutupi sasaran (+ bingkai sorot 6px). */
  const cekBersih = (p: { x: number; y: number }, uk: { w: number; h: number }, r: Kotak, layar: { w: number; h: number }, batasAtas: number) => {
    const g = { ...p, ...uk };
    expect(g.x).toBeGreaterThanOrEqual(8);
    expect(g.x + g.w).toBeLessThanOrEqual(layar.w - 8);
    expect(g.y).toBeGreaterThanOrEqual(batasAtas + 8);
    expect(g.y + g.h).toBeLessThanOrEqual(layar.h - 8);
    expect(iris(g, r, 6)).toBe(false);
    return g;
  };

  describe('HP 390x844 (potret)', () => {
    const layar = { w: 390, h: 844 };
    const tangan = { x: 8, y: 574, w: 374, h: 129 };
    const aksi = { x: 8, y: 784, w: 374, h: 52 };
    const opsi = { layar, batasAtas: 56, sasaranPanel: false, hindari: [tangan, aksi] };
    const penuh = { w: 340, h: 160 };

    it('sasaran di tengah/bawah: gelembung penuh di zona atas, tidak menutupi tangan/tombol', () => {
      const deck = { x: 120, y: 330, w: 60, h: 84 };
      for (const r of [tangan, deck, aksi]) {
        const h = tataGelembung(r, penuh, () => ({ w: 374, h: 90 }), opsi);
        expect(h.ringkas).toBe(false);
        expect(h.posisi.y).toBe(64);
        expect(h.posisi.panah).toBe('bawah');
        const g = cekBersih(h.posisi, penuh, r, layar, 56);
        expect(iris(g, tangan)).toBe(false);
        expect(iris(g, aksi)).toBe(false);
      }
    });

    it('sasaran panel lawan (di atas): gelembung di bawahnya, panah ke atas', () => {
      const panel = { x: 8, y: 60, w: 374, h: 70 };
      const h = tataGelembung(panel, penuh, null, { ...opsi, sasaranPanel: true });
      expect(h.posisi.y).toBe(60 + 70 + 6 + 12);
      expect(h.posisi.panah).toBe('atas');
      cekBersih(h.posisi, penuh, panel, layar, 56);
    });
  });

  describe('HP lanskap 844x390 (kasus laporan verifikasi)', () => {
    const layar = { w: 844, h: 390 };
    const tangan = { x: 160, y: 178, w: 524, h: 88 };
    const aksi = { x: 102, y: 340, w: 640, h: 44 };
    const opsi = { layar, batasAtas: 56, sasaranPanel: false, hindari: [tangan, aksi] };
    const penuh = { w: 330, h: 175 };
    const ringkas = { w: 560, h: 99 };

    it('dulu: "Kartu di tanganmu" menutup tangan. Sekarang: ringkas di atas tangan, tidak menimpa', () => {
      expect(posisiGelembung(tangan, penuh, opsi)).toBeNull(); // atas/bawah/kiri/kanan tidak muat
      const h = tataGelembung(tangan, penuh, () => ringkas, opsi);
      expect(h.ringkas).toBe(true);
      const g = cekBersih(h.posisi, ringkas, tangan, layar, 56);
      expect(iris(g, aksi)).toBe(false);
      expect(h.posisi.panah).toBe('bawah');
    });

    it('panel lawan di kiri: bawah tidak muat → kanan panel (panah ke kiri)', () => {
      const panel = { x: 15, y: 64, w: 169, h: 207 };
      const h = tataGelembung(panel, { w: 340, h: 160 }, () => ringkas, { ...opsi, sasaranPanel: true });
      const uk = h.ringkas ? ringkas : { w: 340, h: 160 };
      cekBersih(h.posisi, uk, panel, layar, 56);
      expect(h.posisi.x).toBeGreaterThan(panel.x + panel.w);
    });

    it('deck/buangan di atas tangan: tidak menutupi sasaran maupun tombol aksi', () => {
      for (const r of [
        { x: 299, y: 80, w: 45, h: 58 },
        { x: 470, y: 86, w: 40, h: 50 },
      ]) {
        const h = tataGelembung(r, { w: 340, h: 160 }, () => ringkas, opsi);
        const uk = h.ringkas ? ringkas : { w: 340, h: 160 };
        const g = cekBersih(h.posisi, uk, r, layar, 56);
        expect(iris(g, aksi)).toBe(false);
      }
    });

    it('Mulung (teks panjang): tidak ada tempat bersih → posisi yang paling sedikit menutupi tangan & tombol', () => {
      const buangan = { x: 470, y: 70, w: 45, h: 62 };
      const besar = { w: 340, h: 200 };
      const h = tataGelembung(buangan, besar, () => ({ w: 560, h: 120 }), opsi);
      const uk = h.ringkas ? { w: 560, h: 120 } : besar;
      const g = cekBersih(h.posisi, uk, buangan, layar, 56);
      // Dulu: tepat di bawah buangan (menutupi tangan + tombol aksi). Sekarang: tombol aksi bebas.
      expect(iris(g, aksi)).toBe(false);
      expect(h.posisi.y).not.toBe(70 + 62 + 6 + 12);
    });

    describe('pita sempit di antara bar atas dan tangan (ukuran meja sungguhan, verifikasi F)', () => {
      // Diukur dari meja latihan 844x390: tangan di tengah, panel lawan di kiri/kanan, deck &
      // buangan di pita atas. Ringkas biasa (560 px) tidak muat di samping sasaran mana pun.
      const tanganNyata = { x: 165, y: 165, w: 518, h: 95 };
      const aksiNyata = { x: 102, y: 338, w: 640, h: 44 };
      const o = { layar, batasAtas: 50, sasaranPanel: false, hindari: [tanganNyata, aksiNyata] };
      /** Pengukur ringkas palsu: lebih sempit = teks lebih tinggi; satu baris = lebih pendek. */
      const ukurVarian = (v: { lebar?: number; mini?: boolean } = {}) => {
        const w = v.lebar ?? 560;
        return { w, h: (v.mini ? 70 : 96) + (w < 400 ? 20 : 0) };
      };
      const tidakMenutupTangan = (h: ReturnType<typeof tataGelembung>, r: Kotak) => {
        const uk = h.ringkas ? ukurVarian(h.varian) : { w: 340, h: 200 };
        const g = cekBersih(h.posisi, uk, r, layar, 50);
        expect(iris(g, tanganNyata)).toBe(false);
        expect(iris(g, aksiNyata)).toBe(false);
        expect(h.posisi.panah).toBeDefined();
      };

      it('Mulung / Tumpukan buangan: ringkas sempit di samping buangan, tangan bebas', () => {
        const buangan = { x: 360, y: 80, w: 80, h: 56 };
        const h = tataGelembung(buangan, { w: 340, h: 200 }, ukurVarian, o);
        expect(h.ringkas).toBe(true);
        expect(h.varian?.lebar).toBeDefined();
        tidakMenutupTangan(h, buangan);
      });

      it('Giliran lawan (panel kiri yang tinggi): rata atas di kanan panel, panah ke kiri', () => {
        const panel = { x: 8, y: 60, w: 152, h: 200 };
        const h = tataGelembung(panel, { w: 340, h: 200 }, ukurVarian, { ...o, sasaranPanel: true });
        tidakMenutupTangan(h, panel);
        expect(h.posisi.x).toBeGreaterThan(panel.x + panel.w);
        expect(h.posisi.panah).toBe('kiri');
      });

      it('pita lebih pendek lagi: turun ke ringkas satu baris (sisanya lewat "Baca semua")', () => {
        const buangan = { x: 360, y: 80, w: 80, h: 56 };
        const pendek = { ...o, hindari: [{ ...tanganNyata, y: 150 }, aksiNyata] };
        const h = tataGelembung(buangan, { w: 340, h: 200 }, ukurVarian, pendek);
        expect(h.varian?.mini).toBe(true);
        const uk = ukurVarian(h.varian);
        const g = cekBersih(h.posisi, uk, buangan, layar, 50);
        expect(iris(g, pendek.hindari[0]!)).toBe(false);
      });
    });

    it('tombol aksi sebagai sasaran: gelembung di atasnya', () => {
      const r = { x: 160, y: 340, w: 226, h: 44 };
      const h = tataGelembung(r, penuh, () => ringkas, opsi);
      const uk = h.ringkas ? ringkas : penuh;
      const g = cekBersih(h.posisi, uk, r, layar, 56);
      expect(g.y + g.h).toBeLessThanOrEqual(r.y);
    });
  });

  describe('HP 360x640 teks besar', () => {
    const layar = { w: 360, h: 640 };
    const tangan = { x: 2, y: 408, w: 356, h: 93 };
    const aksi = { x: 8, y: 574, w: 344, h: 58 };
    const opsi = { layar, batasAtas: 54, sasaranPanel: false, hindari: [tangan, aksi] };
    const penuh = { w: 344, h: 227 };

    it('Mulung (sasaran buangan): tidak menutupi buangan, kartu tangan, tombol, maupun bar atas', () => {
      const buangan = { x: 200, y: 300, w: 60, h: 84 };
      const h = tataGelembung(buangan, penuh, () => ({ w: 344, h: 150 }), opsi);
      const uk = h.ringkas ? { w: 344, h: 150 } : penuh;
      const g = cekBersih(h.posisi, uk, buangan, layar, 54);
      expect(iris(g, tangan)).toBe(false);
      expect(iris(g, aksi)).toBe(false);
    });

    it('tidak ada tempat sama sekali: tepi yang paling sedikit menutupi sasaran, tanpa panah', () => {
      const besar = { x: 2, y: 150, w: 356, h: 330 };
      const h = tataGelembung(besar, penuh, () => ({ w: 344, h: 200 }), opsi);
      expect(h.ringkas).toBe(true);
      expect(h.posisi.y === 54 + 8 || h.posisi.y === 640 - 200 - 8).toBe(true);
      expect(h.posisi.panah).toBeUndefined();
    });
  });

  describe('Desktop 1440x900', () => {
    const layar = { w: 1440, h: 900 };
    const tangan = { x: 420, y: 640, w: 600, h: 140 };
    const aksi = { x: 450, y: 830, w: 540, h: 52 };
    const opsi = { layar, batasAtas: 64, sasaranPanel: false, hindari: [tangan, aksi] };

    it('selalu ukuran penuh, tidak menutupi sasaran', () => {
      for (const r of [tangan, aksi, { x: 640, y: 380, w: 70, h: 98 }]) {
        const h = tataGelembung(r, { w: 340, h: 160 }, () => ({ w: 560, h: 90 }), opsi);
        expect(h.ringkas).toBe(false);
        cekBersih(h.posisi, { w: 340, h: 160 }, r, layar, 64);
      }
    });
  });

  it('posisiTepi: memilih tepi atas/bawah yang menutupi paling sedikit', () => {
    const opsi = { layar: { w: 400, h: 400 }, batasAtas: 40, sasaranPanel: false };
    // Sasaran di bawah: tepi atas bersih → panah ke bawah.
    expect(posisiTepi({ x: 0, y: 300, w: 400, h: 90 }, { w: 300, h: 200 }, opsi)).toMatchObject({ y: 48, panah: 'bawah' });
    // Sasaran di atas: tepi bawah.
    expect(posisiTepi({ x: 0, y: 50, w: 400, h: 100 }, { w: 300, h: 200 }, opsi).y).toBe(192);
  });

  it('tanpa pengukur ringkas (pemain menekan "Baca semua"): tetap ukuran penuh', () => {
    const opsi = { layar: { w: 844, h: 390 }, batasAtas: 56, sasaranPanel: false, hindari: [] };
    const h = tataGelembung({ x: 160, y: 178, w: 524, h: 88 }, { w: 330, h: 175 }, null, opsi);
    expect(h.ringkas).toBe(false);
  });
});

describe('Tutorial (gelembung)', () => {
  let akar: HTMLElement;
  let berubah: ReturnType<typeof vi.fn<() => void>>;
  let t: Tutorial;
  const kotak = vi.fn(() => ({ x: 20, y: 300, w: 100, h: 140 }));

  beforeEach(() => {
    localStorage.clear();
    _setelUlangCache();
    document.body.innerHTML = '';
    akar = document.createElement('div');
    document.body.appendChild(akar);
    berubah = vi.fn();
    t = new Tutorial({ akar, kotak, saatBerubah: berubah });
  });

  const gelembung = () => akar.querySelector<HTMLElement>('.tutorial-gelembung')!;
  const terlihat = () => !akar.querySelector('.tutorial')!.classList.contains('tersembunyi');

  it('sambutan menahan popup joker; "Ayo mulai" melepasnya dan memberi kabar', () => {
    expect(t.tahanPopupJoker()).toBe(true);
    t.perbarui(k({ menungguJoker: true }));
    expect(terlihat()).toBe(true);
    expect(gelembung().textContent).toContain(TEKS_TUTORIAL.sambutan.judul);
    expect(document.activeElement).toBe(gelembung().querySelector('[data-t="lanjut"]'));
    gelembung().querySelector<HTMLElement>('[data-t="lanjut"]')!.click();
    expect(t.tahanPopupJoker()).toBe(false);
    expect(berubah).toHaveBeenCalled();
  });

  it('catatan joker hanya muncul di popup setelah sambutan, dan hilang setelah ditandai', () => {
    expect(t.htmlCatatan('joker')).toBe('');
    t.perbarui(k({ menungguJoker: true }));
    gelembung().querySelector<HTMLElement>('[data-t="lanjut"]')!.click();
    expect(t.htmlCatatan('joker')).toContain(TEKS_TUTORIAL.joker.judul);
    expect(t.labelTombol('joker')).toBe(TEKS_TUTORIAL.joker.tombol);
    t.tandai('joker');
    expect(t.htmlCatatan('joker')).toBe('');
    expect(t.labelTombol('joker')).toBeUndefined();
  });

  it('gelembung disembunyikan saat sibuk dan diletakkan dekat area sorotan', () => {
    t.perbarui(k());
    gelembung().querySelector<HTMLElement>('[data-t="lanjut"]')!.click(); // sambutan → tangan
    expect(gelembung().textContent).toContain(TEKS_TUTORIAL.tangan.judul);
    expect(kotak).toHaveBeenCalledWith({ meja: 'tangan' });
    expect(akar.querySelector('.tutorial')!.classList.contains('tengah')).toBe(false);
    t.perbarui(k({ sibuk: true }));
    expect(terlihat()).toBe(false);
    t.perbarui(k());
    expect(gelembung().textContent).toContain(TEKS_TUTORIAL.tangan.judul);
  });

  it('Lanjut pada langkah terakhir yang relevan menyembunyikan gelembung (tidak tertinggal basi)', () => {
    const ambil = k({ giliranku: true, tahap: 'ambil', giliranLawan: null });
    for (const id of ['sambutan', 'joker', 'tangan', 'giliranAmbil'] as const) t.tandai(id);
    t.perbarui(ambil);
    expect(gelembung().textContent).toContain(TEKS_TUTORIAL.deck.judul);
    gelembung().querySelector<HTMLElement>('[data-t="lanjut"]')!.click();
    expect(terlihat()).toBe(false);
  });

  it('lapisan tutorial tidak menghalangi sentuhan: hanya gelembung yang interaktif', () => {
    t.perbarui(k());
    expect(akar.querySelector('.tutorial-sorot')!.getAttribute('aria-hidden')).toBe('true');
    // Lewati + Lanjut, plus "Baca semua" yang hanya terlihat di mode ringkas berteks terlipat (CSS).
    expect([...gelembung().querySelectorAll<HTMLElement>('button')].map((b) => b.dataset.t)).toEqual(['selengkapnya', 'lewati', 'lanjut']);
  });

  it('"Baca semua": teks dibuka penuh dan fokus pindah ke Lanjut; langkah baru kembali boleh ringkas', () => {
    t.perbarui(k());
    gelembung().querySelector<HTMLElement>('[data-t="lanjut"]')!.click(); // sambutan → tangan
    gelembung().querySelector<HTMLElement>('[data-t="selengkapnya"]')!.click();
    expect(gelembung().classList.contains('ringkas')).toBe(false);
    expect(document.activeElement).toBe(gelembung().querySelector('[data-t="lanjut"]'));
    expect(gelembung().textContent).toContain(TEKS_TUTORIAL.tangan.judul);
  });

  it('gelembung dekat sasaran diberi panah ke arah sasaran', () => {
    t.perbarui(k());
    gelembung().querySelector<HTMLElement>('[data-t="lanjut"]')!.click(); // sambutan → tangan (sasaran tangan)
    expect(['atas', 'bawah', 'kiri', 'kanan']).toContain(gelembung().dataset.panah);
  });

  it('lewati: tutorial berakhir dan preferensi tutorialSelesai disimpan', () => {
    t.perbarui(k());
    gelembung().querySelector<HTMLElement>('[data-t="lewati"]')!.click();
    expect(t.aktif).toBe(false);
    expect(preferensi().tutorialSelesai).toBe(true);
    expect(terlihat()).toBe(false);
    t.perbarui(k());
    expect(terlihat()).toBe(false);
  });

  it('penutup "Ayo main" menyelesaikan tutorial', () => {
    for (const id of URUTAN_TUTORIAL) if (id !== 'selesai') t.tandai(id);
    t.perbarui(k());
    expect(gelembung().textContent).toContain(TEKS_TUTORIAL.selesai.judul);
    expect(gelembung().querySelector('[data-t="lewati"]')).toBeNull();
    gelembung().querySelector<HTMLElement>('[data-t="lanjut"]')!.click();
    expect(t.aktif).toBe(false);
    expect(preferensi().tutorialSelesai).toBe(true);
  });

  it('penutup klasemen (latihan satu putaran): catatan skor + penutup, lalu tuntaskan menyimpan tutorialSelesai', () => {
    for (const id of ['sambutan', 'joker', 'tangan'] as const) t.tandai(id);
    const p = t.htmlPenutup();
    expect(p.skor).toContain(TEKS_TUTORIAL.skor.judul);
    expect(p.skor).toContain('data-tutorial="skor"');
    expect(p.selesai).toContain(TEKS_TUTORIAL.selesai.judul);
    expect(p.selesai).toContain(TEKS_TUTORIAL.selesai.teks);
    expect(p.selesai).toContain('role="note"');
    // Membuat HTML saja belum menandai apa pun: tutorial masih jalan sampai penutup benar-benar tampil.
    expect(t.aktif).toBe(true);
    expect(preferensi().tutorialSelesai).toBe(false);
    t.tuntaskan();
    expect(t.aktif).toBe(false);
    expect(preferensi().tutorialSelesai).toBe(true);
    expect(terlihat()).toBe(false);
    // Sesudah tuntas: penutup tidak muncul lagi (mis. klasemen dibuka ulang).
    expect(t.htmlPenutup()).toEqual({ skor: '', selesai: '' });
  });

  it('penutup: catatan skor yang sudah tampil di hasil putaran tidak diulang; tutorial yang dilewati tanpa penutup', () => {
    t.tandai('sambutan');
    t.tandai('skor');
    expect(t.htmlPenutup().skor).toBe('');
    expect(t.htmlPenutup().selesai).toContain(TEKS_TUTORIAL.selesai.judul);
    t.perbarui(k());
    gelembung().querySelector<HTMLElement>('[data-t="lewati"]')?.click();
    expect(t.aktif).toBe(false);
    expect(t.htmlPenutup()).toEqual({ skor: '', selesai: '' });
  });

  it('hancurkan melepas elemennya', () => {
    t.hancurkan();
    expect(akar.querySelector('.tutorial')).toBeNull();
  });
});

describe('teksPengumuman (aria-live)', () => {
  it('tanpa tanda baca dobel setelah judul yang sudah bertanda baca', () => {
    expect(teksPengumuman('Giliranmu!', 'Tiap giliran ambil satu kartu.')).toBe('Giliranmu! Tiap giliran ambil satu kartu.');
    expect(teksPengumuman('Angka joker', 'Ingat baik-baik.')).toBe('Angka joker. Ingat baik-baik.');
    expect(teksPengumuman('Siap?', 'Ayo.')).toBe('Siap? Ayo.');
    expect(teksPengumuman('Judul', '')).toBe('Judul');
  });
  it('semua langkah tutorial asli: tidak ada "!." / "?." / ".."', () => {
    for (const id of URUTAN_TUTORIAL) {
      const t = TEKS_TUTORIAL[id];
      expect(teksPengumuman(t.judul, t.teks)).not.toMatch(/[!?.…]\.\s/);
    }
  });
  it('hancurkan: jendela yang ditutup sesudahnya tidak memicu langkah lain / menyimpan tutorialSelesai', () => {
    const akar = document.createElement('div');
    document.body.appendChild(akar);
    const saatBerubah = vi.fn();
    const tut = new Tutorial({ akar, kotak: () => null, saatBerubah });
    tut.perbarui(k());
    tut.hancurkan();
    tut.tandai('skor');
    expect(tut.aktif).toBe(false);
    expect(saatBerubah).not.toHaveBeenCalled();
    expect(akar.querySelector('.tutorial')).toBeNull();
    akar.remove();
  });
});
