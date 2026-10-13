// @vitest-environment happy-dom
// Regresi info rahasia di sisi client: pemutar peristiwa (efek/pemutar.ts) diputar ulang untuk
// permainan bot-vs-bot sungguhan, dengan scene palsu (tanpa Phaser) dan suara/sorakan di-mock.
//
// Yang dijaga (keputusan pemilik, lihat AGENTS.md "Info rahasia"):
// - Angka joker hanya lewat popup: pemutar tidak membaca rankJoker/kartuDibuka, dan peristiwa
//   mulaiPutaran tidak memunculkan teks apa pun.
// - Teks yang dibangun client (catatan aksi di panel pemain, sorakan) hanya menyebut kartu yang
//   memang sedang terbuka di peristiwa itu (kartu yang dibuang/dipungut/pentungan), tidak pernah
//   kartu lain (mis. isi buangan yang sudah tertimbun atau kartu yang diambil lawan dari deck).
// - Kartu yang diambil lawan dari deck tidak pernah diperlihatkan (terbang tertutup, tanpa nama).
// - Pentungan tidak disebut saat dibuang; ia dibuka lewat animasi mentung.

import { beforeAll, describe, expect, it, vi } from 'vitest';
import { namaKartu, viewUntuk, type Kartu, type Peristiwa, type ViewPemain } from '@remi/engine';
import { mainkanBot, type LangkahPermainan } from './bantu';

vi.mock('../src/efek/suara', () => ({ bunyi: vi.fn(), getar: vi.fn() }));
vi.mock('../src/efek/sorak', () => ({ sorak: vi.fn(async () => {}), bersihkanSorak: vi.fn() }));

import { labelKartu, PemutarPeristiwa, type KonteksPemutar } from '../src/efek/pemutar';
import { sorak } from '../src/efek/sorak';

const RAHASIA = new Set(['rankJoker', 'kartuDibuka']);

/** Pencatat akses: berapa kali kunci rahasia dibaca selama peristiwa diputar. */
const aksesRahasia: string[] = [];
let mengawasi = false;

/** Bungkus objek (dalam) supaya setiap pembacaan rankJoker/kartuDibuka tercatat. */
function awasi<T>(obj: T, jalur = ''): T {
  if (!obj || typeof obj !== 'object') return obj;
  return new Proxy(obj as object, {
    get(target, kunci, penerima) {
      const nilai = Reflect.get(target, kunci, penerima);
      if (typeof kunci !== 'string') return nilai;
      if (mengawasi && RAHASIA.has(kunci)) aksesRahasia.push(`${jalur}.${kunci}`);
      return awasi(nilai, `${jalur}.${kunci}`);
    },
  }) as T;
}

const adalahKartu = (x: unknown): x is Kartu =>
  !!x && typeof x === 'object' && 'id' in x && 'rank' in x && 'bunga' in x;

interface PanggilanScene {
  metode: string;
  args: unknown[];
}

/** Scene palsu: semua animasi langsung selesai, semua posisi (0,0). Panggilannya dicatat. */
function sceneTiruan(catat: PanggilanScene[]): KonteksPemutar['scene'] {
  const titik = { x: 0, y: 0 };
  return new Proxy({} as KonteksPemutar['scene'], {
    get(_, metode) {
      if (metode === 'posisiDeck' || metode === 'posisiBuangan') return titik;
      if (typeof metode !== 'string' || metode === 'then') return undefined;
      return (...args: unknown[]) => {
        catat.push({ metode, args });
        if (metode.startsWith('posisi')) return titik;
        // Callback (mis. saat pentungan dibuka) dijalankan supaya jalurnya ikut teruji.
        for (const a of args) if (typeof a === 'function') (a as () => void)();
        return Promise.resolve(metode === 'naikPanggung' ? [] : undefined);
      };
    },
  });
}

/** Semua kartu yang disebut di dalam objek peristiwa (yang memang terbuka untuk semua pemain). */
function kartuTerbuka(e: Peristiwa): Kartu[] {
  switch (e.jenis) {
    case 'buang':
      return [e.kartu];
    case 'mulung':
      return e.kartu.map((x) => x.kartu);
    case 'mentung':
      return [e.pentungan];
    default:
      return [];
  }
}

/** Kartu yang boleh dilihat pemain `saya` di view: tangannya sendiri, buangan terlihat, kartu jadi. */
function kartuDiView(v: ViewPemain | null, saya: number): Kartu[] {
  const p = v?.putaran;
  if (!p) return [];
  return [...(p.tangan[saya] ?? []), ...p.buangan.map((b) => b.kartu), ...p.kartuJadi.flat().flatMap((kj) => kj.kartu.map((d) => d.kartu))];
}

/** Sebutan kartu di teks: label pendek (7♥, As♠) atau nama panjang (7 Love). */
const POLA_KARTU = /(?:As|10|[2-9JQK])(?:[♥♦♠♣]| (?:Love|Wajik|Waru|Kriting)\b)/g;

interface Rekaman {
  peristiwa: Peristiwa;
  teks: string[];
  scene: PanggilanScene[];
  sebelum: ViewPemain | null;
  sesudah: ViewPemain;
}

/** Putar ulang semua peristiwa permainan dari sudut pandang pemain `saya`. */
async function putarUlang(langkah: LangkahPermainan[], saya: number): Promise<Rekaman[]> {
  const rekaman: Rekaman[] = [];
  let sebelum: ViewPemain | null = null;
  let sesudah: ViewPemain | null = null;
  let catatTeks: string[] = [];
  let catatScene: PanggilanScene[] = [];
  const konteks: KonteksPemutar = {
    get scene() {
      return sceneTiruan(catatScene);
    },
    nama: (i) => `Pemain ${i}`,
    saya: () => saya,
    catatAksi: (_, teks) => catatTeks.push(teks),
    sembunyikan: () => {},
    tampakkan: () => {},
    viewSekarang: () => sebelum,
    viewBerikut: () => sesudah,
    terapkanViewBerikut: () => {},
    panelMentung: async () => {},
  };
  const pemutar = new PemutarPeristiwa(konteks);
  let idTerakhir = -1;
  for (const l of langkah) {
    const vSebelum = awasi(viewUntuk(l.sebelum, saya));
    const vSesudah = awasi(viewUntuk(l.sesudah, saya));
    const baru = l.sesudah.peristiwa.filter((e) => e.id > idTerakhir);
    idTerakhir = l.sesudah.peristiwa.at(-1)?.id ?? idTerakhir;
    for (let i = 0; i < baru.length; i++) {
      sebelum = vSebelum;
      sesudah = vSesudah;
      catatTeks = [];
      catatScene = [];
      vi.mocked(sorak).mockClear();
      mengawasi = true;
      await pemutar.putar(awasi(baru[i]), false, baru[i + 1] && awasi(baru[i + 1]));
      mengawasi = false;
      const teksSorak = vi.mocked(sorak).mock.calls.flatMap(([s]) => [s.judul, s.sub ?? '']);
      rekaman.push({ peristiwa: baru[i], teks: [...catatTeks, ...teksSorak], scene: catatScene, sebelum: vSebelum, sesudah: vSesudah });
    }
  }
  return rekaman;
}

let langkah: LangkahPermainan[];
const SUDUT: number[] = [0, 2];
const rekamanPer = new Map<number, Rekaman[]>();

beforeAll(async () => {
  // 4 pemain, seed 14: tiga putaran yang semuanya berakhir mentung, ada mulung dan joker pengganti.
  langkah = mainkanBot(4, 14, 3);
  for (const s of SUDUT) rekamanPer.set(s, await putarUlang(langkah, s));
});

describe('pemutar peristiwa: info rahasia', () => {
  it('cakupan: semua jenis peristiwa penting ikut diputar', () => {
    const jenis = new Set(rekamanPer.get(0)!.map((r) => r.peristiwa.jenis));
    for (const j of ['mulaiPutaran', 'ambilDeck', 'mulung', 'turunkan', 'buang', 'mentung', 'susunAkhir', 'putaranSelesai']) {
      expect(jenis, `peristiwa ${j} tidak muncul di skenario`).toContain(j);
    }
  });

  it('tidak pernah membaca rankJoker/kartuDibuka (angka joker hanya lewat popup)', () => {
    expect(aksesRahasia).toEqual([]);
  });

  it('mulaiPutaran tidak memunculkan teks maupun animasi kartu', () => {
    for (const s of SUDUT) {
      for (const r of rekamanPer.get(s)!.filter((x) => x.peristiwa.jenis === 'mulaiPutaran')) {
        expect(r.teks).toEqual([]);
        expect(r.scene.filter((c) => c.args.some(adalahKartu))).toEqual([]);
      }
    }
  });

  it('teks hanya menyebut kartu yang terbuka di peristiwa itu', () => {
    for (const s of SUDUT) {
      for (const r of rekamanPer.get(s)!) {
        const boleh = new Set(kartuTerbuka(r.peristiwa).flatMap((k) => [labelKartu(k), namaKartu(k)]));
        for (const t of r.teks) {
          for (const sebut of t.match(POLA_KARTU) ?? []) {
            expect(boleh, `"${t}" (peristiwa ${r.peristiwa.jenis}, sudut ${s})`).toContain(sebut);
          }
        }
      }
    }
  });

  it('kartu yang diambil lawan dari deck tidak pernah diperlihatkan', () => {
    for (const s of SUDUT) {
      const lawan = rekamanPer.get(s)!.filter((r) => r.peristiwa.jenis === 'ambilDeck' && r.peristiwa.pemain !== s);
      expect(lawan.length).toBeGreaterThan(0);
      for (const r of lawan) {
        expect(r.teks).toEqual(['ambil deck']);
        expect(r.scene.filter((c) => c.args.some(adalahKartu))).toEqual([]);
      }
    }
  });

  it('kartu yang kuambil dari deck dipamerkan tertutup dulu (hanya di layarku)', () => {
    const milikku = rekamanPer.get(0)!.filter((r) => r.peristiwa.jenis === 'ambilDeck' && r.peristiwa.pemain === 0);
    const dipamerkan = milikku.flatMap((r) => r.scene.filter((c) => c.metode === 'naikPanggung').map((c) => ({ r, c })));
    expect(dipamerkan.length).toBeGreaterThan(0);
    for (const { r, c: panggung } of dipamerkan) {
      const daftar = panggung.args[0] as { kartu: Kartu; tertutup?: boolean }[];
      expect(daftar.every((d) => d.tertutup === true)).toBe(true);
      const tanganku = new Set((r.sesudah.putaran?.tangan[0] ?? []).map((k) => k.id));
      expect(daftar.every((d) => tanganku.has(d.kartu.id))).toBe(true);
    }
  });

  it('kartu yang dianimasikan selalu kartu yang memang terlihat oleh pemain ini', () => {
    for (const s of SUDUT) {
      for (const r of rekamanPer.get(s)!) {
        const terlihat = new Set(
          [...kartuTerbuka(r.peristiwa), ...kartuDiView(r.sebelum, s), ...kartuDiView(r.sesudah, s)].map((k) => k.id),
        );
        for (const c of r.scene) {
          for (const a of c.args.flatMap((x) => (Array.isArray(x) ? x.map((d) => (d as { kartu?: unknown }).kartu ?? d) : [x]))) {
            if (adalahKartu(a)) expect(terlihat, `${c.metode} di peristiwa ${r.peristiwa.jenis}`).toContain(a.id);
          }
        }
      }
    }
  });

  it('pentungan tidak disebut saat dibuang; dibuka lewat animasi mentung', () => {
    for (const s of SUDUT) {
      const rek = rekamanPer.get(s)!;
      const pasangan = rek.flatMap((r, i) => (r.peristiwa.jenis === 'buang' && rek[i + 1]?.peristiwa.jenis === 'mentung' ? [i] : []));
      expect(pasangan.length).toBeGreaterThan(0);
      for (const i of pasangan) {
        expect(rek[i].teks).toEqual([]);
        expect(rek[i].scene).toEqual([]);
        expect(rek[i + 1].teks).toEqual(['MENTUNG!']);
        expect(rek[i + 1].scene.some((c) => c.metode === 'pentung')).toBe(true);
      }
    }
  });
});
