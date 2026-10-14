// Strategi warga kedai level jago dan suhu.
//
// Dasarnya penilaian tangan: nilai susunan terbaik (seperti skor akhir putaran), peluang kartu yang
// belum terlihat menyempurnakan tangan, dan kesiapan mentung (kartu buangan yang bisa membuat tangan
// habis sekali mungut) yang ditimbang dengan nilai pentungannya. Kartu jadi sengaja DITAHAN di tangan
// (antem-anteman, seperti pemain kedai yang jago): di tangan, kartu jadi masih bisa jadi modal mulung
// dan disusun ulang untuk mentung, dan semuanya tetap boleh diturunkan di susun akhir (#19, #24).
// Arena: selalu menurunkan kartu jadi rugi 17–67 poin per putaran dibanding menahannya.
// Semua aksi divalidasi dengan fungsi di giliran.ts; bot hanya melihat ViewPemain.

import { AS, type Kartu } from '../kartu.js';
import { AturanError } from '../error.js';
import { isJokerHidup, type KonteksJoker, type SpesifikasiKartuJadi } from '../kartuJadi.js';
import { maksimalMulung, validasiBuang, validasiMulung, validasiTurunkan } from '../giliran.js';
import { nilaiPentungan, PENALTI_JOKER_DIBUANG } from '../skor.js';
import type { Aksi, EntriBuangan } from '../state.js';
import type { ViewPemain, ViewPutaran } from '../view.js';
import { bacaIngatan, type Ingatan } from './ingatan.js';
import {
  isiDari,
  keSpesifikasi,
  NILAI_JOKER_TANGAN,
  NILAI_TIPE,
  Penyusun,
  TETANGGA,
  tipeKartu,
  type IsiTangan,
} from './susun.js';

export interface ParamStrategi {
  /** Bobot peluang kartu yang belum terlihat menyempurnakan tangan. */
  potensi: number;
  /** Bobot kesiapan mentung (jumlah kartu yang bisa dipungut untuk mentung × nilai pentungan). */
  mentung: number;
  /** Bobot korban kepentung saat memilih cara mentung (× nilai pentungan per korban). */
  korban: number;
  /** Mulung (tanpa mentung) hanya bila nilainya melebihi ambil deck sebanyak ini. */
  ambangMulung: number;
  /** Bobot perkiraan kenaikan nilai dari satu kartu deck saat membandingkan mulung dengan ambil deck. */
  untungDeck: number;
  /** Bobot bahaya buangan dipakai lawan untuk mentung (× peluang lawan memegang pasangannya). */
  bahaya: number;
  /** Bobot buangan dipungut lawan untuk mulung biasa. */
  suap: number;
  /** Pengali bahaya dan suap di permainan 2 deck. */
  bahayaDuaDeck: number;
  /** Kesiapan mentung lawan menurut jumlah kartu di tangannya (indeks = jumlah kartu, maks 7). */
  siapLawan: readonly number[];
  /** Boleh menurunkan kartu jadi supaya As bisa dibuang, bila sisa giliran (deck ÷ pemain) paling banyak segini. */
  turunDemiAs: number;
  /** Batas atas perkiraan sisa giliran yang masih diperhitungkan. */
  batasCakrawala: number;
  /**
   * Mengingat kartu yang sudah tertimbun di buangan dan kartu hasil mungut lawan, sejauh peristiwanya
   * masih ada di view (BATAS_PERISTIWA_VIEW terakhir, kira-kira 20 giliran; lihat ingatan.ts).
   */
  ingatRiwayat: boolean;
  /** Jumlah cara mulung (selain mentung) yang dinilai lengkap, supaya waktu mikir tetap terbatas. */
  calonMulung: number;
  /** Turunkan kartu jadi yang dipegang bila ada lawan yang kartunya paling banyak segini; −1 = abaikan. */
  turunTanganLawan: number;
}

const SIAP_LAWAN = [0, 0, 0.5, 1, 0.35, 0.3, 0.2, 0.15];

/**
 * Suhu (sangat susah): ingat kartu yang lewat dalam BATAS_PERISTIWA_VIEW (40) peristiwa terakhir di
 * view (kira-kira 20 giliran; di meja besar buangan yang lebih lama terlupa), menimbang bahaya buangan
 * bagi lawan, dan sabar (mulung hanya kalau jelas lebih untung daripada kartu baru dari deck).
 * Angka-angkanya hasil ukur arena (packages/engine/scripts/arena.ts) dan orakel rollout.
 */
export const PARAM_SUHU: ParamStrategi = {
  potensi: 0.5,
  mentung: 1.5,
  korban: 0.5,
  ambangMulung: 15,
  untungDeck: 1,
  bahaya: 40,
  suap: 3,
  bahayaDuaDeck: 0.5,
  siapLawan: SIAP_LAWAN,
  turunDemiAs: 1,
  batasCakrawala: 4,
  ingatRiwayat: true,
  calonMulung: 6,
  turunTanganLawan: -1,
};

/**
 * Jago (susah): menyusun, menahan kartu jadi, dan mengejar mentung seperti suhu. Bedanya: hanya
 * ingat yang terlihat di meja sekarang, tidak menimbang buangannya bakal dipakai siapa, rakus mulung
 * (tidak menunggu yang jelas lebih untung dari kartu deck), dan gugup menurunkan kartu jadinya begitu
 * ada lawan yang tinggal 2 kartu. Arena: jelas di atas normal di semua ukuran meja, jelas di bawah suhu,
 * juga saat diadu langsung di meja yang isinya jago semua.
 */
export const PARAM_JAGO: ParamStrategi = {
  ...PARAM_SUHU,
  ambangMulung: 0,
  untungDeck: 0,
  bahaya: 0,
  suap: 0,
  ingatRiwayat: false,
  turunTanganLawan: 2,
};

function coba<T>(f: () => T): T | null {
  try {
    return f();
  } catch (e) {
    if (e instanceof AturanError) return null;
    throw e;
  }
}

function salinIsi(isi: IsiTangan): IsiTangan {
  return { alami: isi.alami.slice(), joker: [...isi.joker] };
}

/** Isi tangan tanpa satu kartu. */
function tanpa(isi: IsiTangan, k: Kartu, ctx: KonteksJoker): IsiTangan {
  const baru = salinIsi(isi);
  const t = tipeKartu(k);
  if (isJokerHidup(k, ctx)) baru.joker.splice(baru.joker.indexOf(t), 1);
  else baru.alami[t]--;
  return baru;
}

export interface Komponen {
  dasar: number;
  potensi: number;
  mentung: number;
}

export class Penilai {
  readonly ctx: KonteksJoker;
  readonly ingat: Ingatan;
  readonly susun = new Penyusun();
  readonly n: number;
  /** Perkiraan sisa kesempatan ambil kartu untuk pemain ini. */
  readonly sisaGiliran: number;
  private cache = new Map<string, Komponen>();

  constructor(
    readonly view: ViewPemain,
    readonly p: ViewPutaran,
    readonly saya: number,
    readonly par: ParamStrategi,
  ) {
    this.ctx = { rankJoker: p.rankJoker, jokerMati: p.jokerMati };
    this.ingat = bacaIngatan(view, par.ingatRiwayat);
    this.n = view.konfigurasi.jumlahPemain;
    this.sisaGiliran = p.jumlahDeck / this.n;
  }

  get punyaJadi(): boolean {
    return this.p.kartuJadi[this.saya].length > 0;
  }

  /** Nilai susunan terbaik (kartu jadi − sisa), seperti skor dasar bila putaran selesai sekarang. */
  dasar(isi: IsiTangan, punyaJadi: boolean): number {
    return this.susun.cari(isi, punyaJadi)?.nilai ?? -Infinity;
  }

  /**
   * Komponen nilai tangan di akhir giliran. Kartu yang belum terlihat ditimbang dengan jumlah salinannya:
   * - dasar: nilai susunan terbaik (kartu jadi − sisa), seperti skor bila putaran selesai sekarang
   * - potensi: Σ salinan × kenaikan dasar bila kartu itu datang
   * - mentung: Σ salinan × nilai pentungan, untuk kartu yang bila dipungut membuat tangan bisa mentung
   */
  komponen(isi: IsiTangan, punyaJadi: boolean): Komponen {
    const kunci = `${isi.alami.join('')}|${[...isi.joker].sort((a, b) => a - b).join(',')}|${punyaJadi ? 1 : 0}`;
    const ada = this.cache.get(kunci);
    if (ada !== undefined) return ada;
    const dasar = this.dasar(isi, punyaJadi);
    const { belum } = this.ingat;
    const rankJoker = this.ctx.rankJoker;
    // Tipe yang mungkin berguna: tetangga kartu di tangan.
    const dekat = new Set<number>();
    for (let t = 0; t < 52; t++) if (isi.alami[t] > 0) for (const u of TETANGGA[t]) dekat.add(u);
    for (const t of isi.joker) for (const u of TETANGGA[t]) dekat.add(u);
    const k: Komponen = { dasar, potensi: 0, mentung: 0 };
    for (const c of dekat) {
      const u = belum[c];
      if (u <= 0) continue;
      // Kartu c datang lewat buangan: joker yang sudah dibuang jadi kartu biasa. Dari deck, kartu
      // seangka joker masih joker hidup; itu dihitung terpisah di bawah.
      isi.alami[c]++;
      if ((c % 13) + 1 !== rankJoker) {
        const delta = this.dasar(isi, punyaJadi) - dasar + NILAI_TIPE[c];
        if (delta > 0) k.potensi += u * delta;
      }
      const m = this.susun.cari(isi, true, { tepat: 1, wajib: c });
      if (m) k.mentung += u * Math.floor(m.nilai / 1000);
      isi.alami[c]--;
    }
    // Joker hidup dari deck.
    let jokerBelum = 0;
    for (let s = 0; s < 4; s++) jokerBelum += belum[s * 13 + rankJoker - 1];
    if (jokerBelum > 0) {
      isi.joker.push(rankJoker - 1);
      const delta = this.dasar(isi, punyaJadi) - dasar + NILAI_JOKER_TANGAN;
      isi.joker.pop();
      if (delta > 0) k.potensi += jokerBelum * delta;
    }
    this.cache.set(kunci, k);
    return k;
  }

  /**
   * Perkiraan berapa kali tiap salinan kartu yang belum terlihat sampai ke saya sebelum putaran
   * berakhir: sisa giliran (dibatasi, karena tangan terus berubah) dibagi jumlah kartu yang belum terlihat.
   */
  get skala(): number {
    return Math.min(this.sisaGiliran, this.par.batasCakrawala) / Math.max(1, this.ingat.totalBelum);
  }

  /** Nilai tangan di akhir giliran: dasar + peluang membaik + kesiapan mentung. */
  nilai(isi: IsiTangan, punyaJadi: boolean): number {
    const k = this.komponen(isi, punyaJadi);
    return k.dasar + this.skala * (this.par.potensi * k.potensi + this.par.mentung * k.mentung);
  }

  /**
   * Peluang pemain j memegang kartu yang bersama `d` membentuk kartu jadi: dari kartu yang
   * diketahui ada di tangannya (hasil mungut) atau perkiraan dari kartu yang belum terlihat.
   */
  peluangPasangan(d: Kartu, j: number): number {
    const { belum, totalBelum, diketahui } = this.ingat;
    const tahu = new Int8Array(52);
    for (const k of diketahui[j]) tahu[tipeKartu(k)]++;
    const tidakTahu = Math.max(0, this.p.jumlahKartuTangan[j] - diketahui[j].length);
    const per = tidakTahu / Math.max(1, totalBelum);
    const q = (t: number) => (tahu[t] > 0 ? 1 : Math.min(1, belum[t] * per));
    const rj = this.ctx.rankJoker;
    let jokerBelum = 0;
    for (let s = 0; s < 4; s++) jokerBelum += belum[s * 13 + rj - 1];
    const qJ = Math.min(1, jokerBelum * per);
    const t = tipeKartu(d);
    const r = d.rank;
    let peluang = 0;
    if (r === AS) {
      const lain = [0, 1, 2, 3].map((s) => s * 13).filter((u) => u !== t);
      peluang = q(lain[0]) * q(lain[1]) + q(lain[0]) * q(lain[2]) + q(lain[1]) * q(lain[2]);
    } else if (r >= 11) {
      const lain = [11, 12, 13].filter((x) => x !== r).map((x) => t - r + x);
      peluang = q(lain[0]) * q(lain[1]);
    } else {
      const di = (x: number) => (x >= 2 && x <= 10 ? q(t - r + x) : 0);
      peluang = di(r - 2) * di(r - 1) + di(r - 1) * di(r + 1) + di(r + 1) * di(r + 2);
      // Joker pengganti ditambah satu kartu sebunga di dekatnya.
      peluang += qJ * (di(r - 2) + di(r - 1) + di(r + 1) + di(r + 2)) * 0.5;
    }
    return Math.min(1, peluang);
  }

  /** Perkiraan kerugian bila `d` dibuang: lawan mentung memakainya (kepentung) atau sekadar mulung. */
  bahaya(d: Kartu): number {
    const { par, p, n, saya } = this;
    // Dengan 2 deck tiap kartu punya kembaran, jadi perkiraan "lawan memegang pasangannya" jauh kurang tajam.
    const skala = this.ingat.salinan === 2 ? par.bahayaDuaDeck : 1;
    if (skala === 0 || (par.bahaya === 0 && par.suap === 0)) return 0;
    let total = 0;
    for (let jarak = 1; jarak < n; jarak++) {
      const j = (((saya + jarak * p.arah) % n) + n) % n;
      const h = p.jumlahKartuTangan[j];
      const pasangan = this.peluangPasangan(d, j);
      if (pasangan === 0) continue;
      // Tangan 2 kartu baru bisa mentung bila kartu ini bukan yang teratas saat gilirannya.
      const siap = h === 2 && jarak === 1 ? 0 : par.siapLawan[Math.min(h, par.siapLawan.length - 1)];
      total += pasangan * (par.bahaya * siap + par.suap);
    }
    return total * skala;
  }
}

export interface OpsiMulungKuat {
  jumlah: number;
  spek: SpesifikasiKartuJadi[];
  /** Tangan setelah mulung (sebelum buang). */
  tangan: Kartu[];
  nilaiJadi: number;
  diambil: EntriBuangan[];
}

/** Semua cara mulung sah: kartu jadi yang memuat kartu paling bawah, dengan berbagai pilihan modal. */
export function semuaMulung(nl: Penilai): OpsiMulungKuat[] {
  const { p, saya, ctx, view } = nl;
  const tangan = p.tangan[saya]!;
  const hasil: OpsiMulungKuat[] = [];
  const maks = maksimalMulung(nl.n, p.buangan.length);
  const jokerTangan = tangan.filter((k) => isJokerHidup(k, ctx));
  for (let jumlah = 1; jumlah <= maks; jumlah++) {
    const diambil = p.buangan.slice(p.buangan.length - jumlah);
    const bawah = diambil[0].kartu;
    const idAmbil = new Set(diambil.map((e) => e.kartu.id));
    const kolam = [...tangan, ...diambil.map((e) => e.kartu)];
    const calon: SpesifikasiKartuJadi[] = [];
    const alamiDari = (bunga: Kartu['bunga'], rank: number) => {
      // Satu kartu dari tangan (bukan joker hidup lebih dulu), satu dari pungutan.
      const dariTangan =
        tangan.find((k) => k.bunga === bunga && k.rank === rank && !isJokerHidup(k, ctx)) ??
        tangan.find((k) => k.bunga === bunga && k.rank === rank);
      const dariAmbil = diambil.find((e) => e.kartu.bunga === bunga && e.kartu.rank === rank)?.kartu;
      return [dariTangan, dariAmbil].filter((k): k is Kartu => !!k && k.id !== bawah.id);
    };
    if (bawah.rank === AS) {
      const lain = ['waru', 'love', 'kriting', 'wajik'].filter((b) => b !== bawah.bunga) as Kartu['bunga'][];
      const pilihan = lain.map((b) => alamiDari(b, AS));
      const jalan = (i: number, isi: Kartu[]) => {
        if (i === lain.length) {
          if (isi.length >= 2) calon.push([bawah, ...isi].map((k) => ({ id: k.id })));
          return;
        }
        jalan(i + 1, isi);
        for (const k of pilihan[i]) jalan(i + 1, [...isi, k]);
      };
      jalan(0, []);
    } else if (bawah.rank >= 11) {
      const lain = [11, 12, 13].filter((r) => r !== bawah.rank);
      for (const a of alamiDari(bawah.bunga, lain[0])) {
        for (const b of alamiDari(bawah.bunga, lain[1])) calon.push([bawah, a, b].map((k) => ({ id: k.id })));
      }
    } else {
      const rb = bawah.rank;
      for (let awal = Math.max(2, rb - 8); awal <= rb; awal++) {
        for (let akhir = Math.max(rb, awal + 2); akhir <= Math.min(10, awal + 8); akhir++) {
          // Isi tiap slot: kartu alami (tangan/pungutan) atau joker pengganti dari tangan.
          const slot: { pilihan: Kartu[]; q: number }[] = [];
          for (let q = awal; q <= akhir; q++) if (q !== rb) slot.push({ q, pilihan: alamiDari(bawah.bunga, q) });
          const dipakai: { k: Kartu; liar: boolean; q: number }[] = [];
          const jalan = (i: number, liarDipakai: number) => {
            if (calon.length > 60) return;
            if (i === slot.length) {
              const items = [{ k: bawah, liar: false, q: rb }, ...dipakai].sort((a, b) => a.q - b.q);
              const nLiar = items.filter((x) => x.liar).length;
              if (nLiar > items.length - nLiar) return;
              if (items.some((x, j) => x.liar && j > 0 && items[j - 1].liar)) return;
              calon.push(
                items.map((x) => (x.liar ? { id: x.k.id, sebagai: { rank: x.q as Kartu['rank'], bunga: bawah.bunga } } : { id: x.k.id })),
              );
              return;
            }
            const { q, pilihan } = slot[i];
            for (const k of pilihan) {
              if (dipakai.some((x) => x.k.id === k.id)) continue;
              dipakai.push({ k, liar: false, q });
              jalan(i + 1, liarDipakai);
              dipakai.pop();
            }
            const j = jokerTangan.find((k) => !dipakai.some((x) => x.k.id === k.id));
            if (j) {
              dipakai.push({ k: j, liar: true, q });
              jalan(i + 1, liarDipakai + 1);
              dipakai.pop();
            }
          };
          jalan(0, 0);
        }
      }
    }
    for (const spek of calon) {
      let semuaSpek = [spek];
      let h = coba(() =>
        validasiMulung({
          tangan,
          buangan: p.buangan,
          punyaKartuJadi: nl.punyaJadi,
          jumlahPemain: nl.n,
          jumlah,
          spesifikasi: semuaSpek,
          ctx,
        }),
      );
      if (!h && bawah.rank === AS && !nl.punyaJadi) {
        // 3 As tanpa kartu jadi lain: turunkan bersamaan satu kartu jadi lain dari sisa kolam.
        const dipakai = new Set(spek.map((x) => x.id));
        const sisa = kolam.filter((k) => !dipakai.has(k.id));
        const r = nl.susun.cari(isiDari(sisa, ctx), false, { catat: true });
        const pendamping = r && keSpesifikasi(r.susunan, sisa, ctx);
        if (pendamping?.length) {
          semuaSpek = [spek, pendamping[0]];
          h = coba(() =>
            validasiMulung({
              tangan,
              buangan: p.buangan,
              punyaKartuJadi: nl.punyaJadi,
              jumlahPemain: nl.n,
              jumlah,
              spesifikasi: semuaSpek,
              ctx,
            }),
          );
        }
      }
      if (!h) continue;
      const nilaiJadi = h.kartuJadi.reduce((s, kj) => s + kj.kartu.reduce((a, d) => a + NILAI_TIPE[tipeKartu(d.sebagai)], 0), 0);
      hasil.push({ jumlah, spek: semuaSpek, tangan: h.sisaTangan, nilaiJadi, diambil });
    }
    void idAmbil;
  }
  return hasil;
}

export function buangSah(nl: Penilai, tangan: readonly Kartu[], punyaJadi: boolean, sumberAmbil: 'deck' | 'buangan'): Kartu[] {
  return tangan.filter((k) =>
    coba(() =>
      validasiBuang({
        tangan,
        punyaKartuJadi: punyaJadi,
        sumberAmbil,
        kartuId: k.id,
        ctx: nl.ctx,
        asJokerBolehDibuangTanpaJadi: nl.view.konfigurasi.asJokerBolehDibuangTanpaJadi,
      }),
    ),
  );
}

/**
 * Batasi biaya menilai mulung: tangan hasil yang sama cukup dinilai sekali (pakai kartu jadi
 * bernilai terbesar), lalu hanya beberapa calon terbaik menurut nilai kasar (kartu jadi + susunan
 * tangan hasil) yang dinilai lengkap. Di meja 2 deck bisa ada puluhan cara mulung.
 */
function saringMulung(nl: Penilai, opsi: OpsiMulungKuat[]): OpsiMulungKuat[] {
  const unik = new Map<string, OpsiMulungKuat>();
  for (const o of opsi) {
    const kunci = o.tangan
      .map((k) => `${tipeKartu(k)}${isJokerHidup(k, nl.ctx) ? '*' : ''}`)
      .sort()
      .join(',');
    const ada = unik.get(kunci);
    if (!ada || o.nilaiJadi > ada.nilaiJadi) unik.set(kunci, o);
  }
  const daftar = [...unik.values()];
  if (daftar.length <= nl.par.calonMulung) return daftar;
  return daftar
    .map((o) => ({ o, v: o.nilaiJadi + nl.dasar(isiDari(o.tangan, nl.ctx), true) }))
    .sort((a, b) => b.v - a.v)
    .slice(0, nl.par.calonMulung)
    .map((x) => x.o);
}

/** Pilih kartu buangan terbaik dari tangan; null bila tidak ada yang sah. */
export function pilihBuang(
  nl: Penilai,
  tangan: readonly Kartu[],
  punyaJadi: boolean,
  sumberAmbil: 'deck' | 'buangan',
): { kartu: Kartu; nilai: number } | null {
  const isi = isiDari(tangan, nl.ctx);
  let terbaik: { kartu: Kartu; nilai: number } | null = null;
  const sudah = new Set<string>();
  for (const k of buangSah(nl, tangan, punyaJadi, sumberAmbil)) {
    const hidup = isJokerHidup(k, nl.ctx);
    const kunci = `${tipeKartu(k)}${hidup ? '*' : ''}`;
    if (sudah.has(kunci)) continue;
    sudah.add(kunci);
    let v = nl.nilai(tanpa(isi, k, nl.ctx), punyaJadi) - nl.bahaya(k);
    if (hidup) v -= PENALTI_JOKER_DIBUANG;
    if (!terbaik || v > terbaik.nilai) terbaik = { kartu: k, nilai: v };
  }
  return terbaik;
}

/** Apakah kartu jadi yang dipegang diturunkan sekarang: ada lawan yang kartunya tinggal sedikit (jago gugup). */
function perluTurun(nl: Penilai): boolean {
  const { par, p, saya } = nl;
  for (let j = 0; j < nl.n; j++) if (j !== saya && p.jumlahKartuTangan[j] <= par.turunTanganLawan) return true;
  return false;
}

/** Kartu jadi dari susunan terbaik yang diturunkan sekarang (bagian yang paling menguntungkan), atau null. */
function turunkanSekarang(nl: Penilai, tangan: readonly Kartu[], sumberAmbil: 'deck' | 'buangan'): SpesifikasiKartuJadi[] | null {
  const r = nl.susun.cari(isiDari(tangan, nl.ctx), nl.punyaJadi, { catat: true });
  if (!r || r.susunan.length === 0) return null;
  const m = r.susunan.slice(0, 4);
  let terbaik: { spek: SpesifikasiKartuJadi[]; nilai: number } | null = null;
  for (let mask = 1; mask < 1 << m.length; mask++) {
    const pilih = m.filter((_, i) => mask & (1 << i));
    const spek = keSpesifikasi(pilih, tangan, nl.ctx);
    const v = spek && coba(() => validasiTurunkan(tangan, spek, nl.punyaJadi, sumberAmbil, nl.ctx));
    if (!v) continue;
    const b = pilihBuang(nl, v.sisaTangan, true, sumberAmbil);
    if (!b) continue;
    // Jangan sampai tinggal 1 kartu sesudah buang: tangan 1 kartu tidak bisa mulung/mentung lagi (#30).
    const kunci = v.sisaTangan.length - 1 === 1 ? -1000 : 0;
    const nilai = kunci + b.nilai + v.kartuJadi.reduce((s, kj) => s + kj.kartu.reduce((a, d) => a + NILAI_TIPE[tipeKartu(d.sebagai)], 0), 0);
    if (!terbaik || nilai > terbaik.nilai) terbaik = { spek: spek!, nilai };
  }
  return terbaik && terbaik.nilai > -500 ? terbaik.spek : null;
}

/** Satu kartu jadi yang sebaiknya diturunkan supaya As boleh dibuang, atau null. */
function turunkanDemiAs(
  nl: Penilai,
  tangan: readonly Kartu[],
  sumberAmbil: 'deck' | 'buangan',
  nilaiSekarang: number,
): SpesifikasiKartuJadi[] | null {
  const r = nl.susun.cari(isiDari(tangan, nl.ctx), false, { catat: true });
  if (!r) return null;
  let terbaik: { spek: SpesifikasiKartuJadi[]; nilai: number } | null = null;
  for (const m of r.susunan) {
    const spek = keSpesifikasi([m], tangan, nl.ctx);
    const v = spek && coba(() => validasiTurunkan(tangan, spek, false, sumberAmbil, nl.ctx));
    if (!v) continue;
    const b = pilihBuang(nl, v.sisaTangan, true, sumberAmbil);
    if (!b) continue;
    const nilai = b.nilai + v.kartuJadi.reduce((s, kj) => s + kj.kartu.reduce((a, d) => a + NILAI_TIPE[tipeKartu(d.sebagai)], 0), 0);
    if (nilai > nilaiSekarang && (!terbaik || nilai > terbaik.nilai)) terbaik = { spek: spek!, nilai };
  }
  return terbaik?.spek ?? null;
}

/** Cari cara mentung dari tangan ini (tepat satu kartu sisa); null bila tidak bisa. */
export function rencanaMentung(nl: Penilai, tangan: readonly Kartu[]): { spek: SpesifikasiKartuJadi[]; sisa: Kartu; pentungan: number } | null {
  if (tangan.length === 1) {
    const k = tangan[0];
    return { spek: [], sisa: k, pentungan: nilaiPentungan(k, isJokerHidup(k, nl.ctx)) };
  }
  const m = nl.susun.cari(isiDari(tangan, nl.ctx), true, { tepat: 1, catat: true });
  if (!m) return null;
  const spek = keSpesifikasi(m.susunan, tangan, nl.ctx);
  if (!spek) return null;
  const v = coba(() => validasiTurunkan(tangan, spek, true, 'buangan', nl.ctx));
  if (!v || v.sisaTangan.length !== 1) return null;
  const sisa = v.sisaTangan[0];
  return { spek, sisa, pentungan: nilaiPentungan(sisa, isJokerHidup(sisa, nl.ctx)) };
}

/**
 * Tangan paling besar yang masih dinilai strategi jago/suhu di giliran sendiri. Biayanya tumbuh sangat
 * cepat dengan jumlah kartu (turunkanSekarang × pilihBuang × Penyusun): di permainan wajar tangan tidak
 * lewat 13 kartu (keputusan terburuk ±70 ms), tapi kursi manusia yang ditinggal jadi warga kedai bisa
 * mewariskan tangan 15+ kartu (150 ms sampai 2,5 dtk per keputusan) yang memblok server. Lebih dari
 * ini: strategi normal.
 */
export const BATAS_TANGAN_KUAT = 14;

/**
 * Aksi jago/suhu di giliran sendiri; null bila tidak menemukan aksi sah atau tangannya lebih dari
 * BATAS_TANGAN_KUAT kartu (pemanggil memakai strategi normal).
 */
export function aksiKuat(view: ViewPemain, par: ParamStrategi): Aksi | null {
  const p = view.putaran!;
  const saya = view.saya!;
  const tangan = p.tangan[saya]!;
  if (tangan.length > BATAS_TANGAN_KUAT) return null;
  const nl = new Penilai(view, p, saya, par);

  if (p.tahap === 'ambil') {
    const opsi = p.buangan.length ? semuaMulung(nl) : [];
    // 1) Mentung kalau bisa: pilih pentungan dan korban kepentung terbesar.
    let mentung: { o: OpsiMulungKuat; skor: number } | null = null;
    for (const o of opsi) {
      const r = rencanaMentung(nl, o.tangan);
      if (!r) continue;
      const korban = new Set(
        o.diambil.filter((e) => e.pemilik !== saya && e.kartu.id !== r.sisa.id).map((e) => e.pemilik),
      ).size;
      const skor = r.pentungan * (1 + par.korban * korban) + o.nilaiJadi;
      if (!mentung || skor > mentung.skor) mentung = { o, skor };
    }
    if (mentung) return { jenis: 'mulung', pemain: saya, jumlah: mentung.o.jumlah, kartuJadi: mentung.o.spek };

    // 2) Mulung biasa kalau hasilnya lebih baik daripada ambil deck.
    if (opsi.length) {
      // Ambil deck juga memberi satu kartu baru: tambahkan perkiraan kenaikan dari satu kartu acak.
      const isiTangan = isiDari(tangan, nl.ctx);
      const kom = nl.komponen(isiTangan, nl.punyaJadi);
      const dasarDeck = nl.nilai(isiTangan, nl.punyaJadi) + (par.untungDeck * kom.potensi) / Math.max(1, nl.ingat.totalBelum);
      let terbaik: { o: OpsiMulungKuat; skor: number } | null = null;
      for (const o of saringMulung(nl, opsi)) {
        const b = pilihBuang(nl, o.tangan, true, 'buangan');
        if (!b) continue;
        const skor = o.nilaiJadi + b.nilai;
        if (!terbaik || skor > terbaik.skor) terbaik = { o, skor };
      }
      if (terbaik && terbaik.skor > dasarDeck + par.ambangMulung) {
        return { jenis: 'mulung', pemain: saya, jumlah: terbaik.o.jumlah, kartuJadi: terbaik.o.spek };
      }
    }
    return { jenis: 'ambilDeck', pemain: saya };
  }

  // Tahap main. Giliran mulung: mentung kalau tangan bisa habis.
  if (p.sumberAmbil === 'buangan') {
    const r = rencanaMentung(nl, tangan);
    if (r) {
      if (r.spek.length === 0) return { jenis: 'buang', pemain: saya, kartuId: r.sisa.id };
      return { jenis: 'turunkan', pemain: saya, kartuJadi: r.spek };
    }
  }
  const b = pilihBuang(nl, tangan, nl.punyaJadi, p.sumberAmbil!);
  // As baru boleh dibuang setelah punya kartu jadi di meja. Kalau membuang As (atau joker As)
  // lebih menguntungkan, turunkan dulu satu kartu jadi yang dipegang.
  if (nl.sisaGiliran <= par.turunDemiAs && !nl.punyaJadi && tangan.some((k) => k.rank === AS)) {
    const turun = turunkanDemiAs(nl, tangan, p.sumberAmbil!, b?.nilai ?? -Infinity);
    if (turun) return { jenis: 'turunkan', pemain: saya, kartuJadi: turun };
  }
  // Tahan kartu jadi (bawaan): di tangan, kartu jadi masih bisa jadi modal mulung dan disusun ulang
  // untuk mentung, dan tetap boleh diturunkan di susun akhir. Turunkan hanya bila parameter memintanya.
  if (perluTurun(nl)) {
    const turun = turunkanSekarang(nl, tangan, p.sumberAmbil!);
    if (turun) return { jenis: 'turunkan', pemain: saya, kartuJadi: turun };
  }
  if (b) return { jenis: 'buang', pemain: saya, kartuId: b.kartu.id };
  // Tidak ada kartu yang sah dibuang (misalnya tangan As semua sebelum punya kartu jadi): turunkan dulu.
  const r = nl.susun.cari(isiDari(tangan, nl.ctx), nl.punyaJadi, { catat: true });
  const spek = r && keSpesifikasi(r.susunan, tangan, nl.ctx);
  if (spek?.length && coba(() => validasiTurunkan(tangan, spek, nl.punyaJadi, p.sumberAmbil!, nl.ctx))) {
    return { jenis: 'turunkan', pemain: saya, kartuJadi: spek };
  }
  return null;
}

/** Susun akhir: turunkan susunan terbaik (bukan serakah), lalu selesai. */
export function susunAkhirKuat(view: ViewPemain): Aksi | null {
  const p = view.putaran!;
  const saya = view.saya!;
  const tangan = p.tangan[saya]!;
  const ctx = { rankJoker: p.rankJoker, jokerMati: p.jokerMati };
  const punya = p.kartuJadi[saya].length > 0;
  const r = new Penyusun().cari(isiDari(tangan, ctx), punya, { catat: true });
  const spek = r && keSpesifikasi(r.susunan, tangan, ctx);
  if (spek?.length && coba(() => validasiTurunkan(tangan, spek, punya, 'akhir', ctx))) {
    return { jenis: 'turunkan', pemain: saya, kartuJadi: spek };
  }
  return spek?.length ? null : { jenis: 'selesaiSusun', pemain: saya };
}
