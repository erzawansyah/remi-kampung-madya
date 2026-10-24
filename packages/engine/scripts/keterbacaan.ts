// Metrik keterbacaan warga kedai untuk arena: seberapa gampang buangannya ditebak lawan.
// Dipakai arena.ts, diuji test/arena-alat.test.ts. Arena boleh membaca state penuh (ini alat ukur,
// bukan bot), tapi yang diukur hanya hal yang juga terlihat atau bisa diingat pemain di meja.
//
// Semua metrik dihitung per kursi dari state TEPAT SEBELUM aksi buang diterapkan. Buangan mentung
// (tangan habis) tidak dihitung. "Buangan ke-k" = buangan sendiri (bukan mentung) ke-k di putaran itu.
//
//   L|iso         P(membuang Londo terpencil | memegangnya, buangan ke-1..3). Terpencil = tidak ada
//                 Londo lain sebunga (beda angka) di tangan. Joker hidup bukan Londo dan bukan pasangan.
//   As|boleh      P(membuang As | memegang As yang sah dibuang, buangan ke-1..3). As joker hidup tidak dihitung.
//   L|iso4-6, As|boleh4-6
//                 Sama, untuk buangan ke-4..6. Pembanding supaya ketahuan apakah Londo/As cuma ditunda
//                 beberapa giliran (gaya menahan kartu tinggi hanya di awal deck, lihat tahanTinggi di gaya.ts).
//   londoDini     Bagian buangan Londo yang terjadi sebelum ada pemain LAIN membuang Londo di putaran itu.
//   giliranLondo1 Rata-rata nomor buangan sendiri saat Londo pertama dibuang (putaran tanpa buang Londo dilewati).
//   nyambung      P(buangan menyambung buangan pemain sebelumnya yang masih di atas | ambil dari deck, meja ≥ 3):
//                 sebunga dan selisih angka 1 untuk 2–10, atau sama-sama Londo sebunga (beda angka). Joker hidup tidak.
//   disuap        Bagian buangan yang langsung dipungut (mulung) pemain berikutnya. Dihitung dari peristiwa
//                 lengkap permainan; buangan terakhir sebelum susun akhir (deck habis) tidak dihitung.
//   entropiAwal   Entropi (bit) sebaran kelas buangan ke-1..3: 2–5, 6–10, Londo, As, joker. Maksimal log2(5) ≈ 2,32.
//   samaStandar   (--baca) P(aksi = aksi gaya standar level yang sama pada view yang sama), selama putaran berjalan.
//
// Selang kepercayaan: satu seed (semua rotasi kursinya) = satu sampel. Rasio Σa/Σb memakai linearisasi
// (z = a − R·b per seed, lalu ringkas()), entropi memakai jackknife buang-satu-seed.

import {
  AS,
  AturanError,
  berikutnya,
  isAngka,
  isJokerHidup,
  isLondo,
  validasiBuang,
  type Aksi,
  type Arah,
  type GameState,
  type HasilPutaran,
  type Kartu,
  type KonteksJoker,
  type Peristiwa,
} from '../src/index.js';

export type KelasBuang = 'kecil' | 'besar' | 'londo' | 'as' | 'joker';

/** Urutan kelas di `StatBaca.kelasAwal`. kecil = 2–5, besar = 6–10. */
export const KELAS_BUANG: readonly KelasBuang[] = ['kecil', 'besar', 'londo', 'as', 'joker'];

export function kelasBuang(k: Kartu, ctx: KonteksJoker): KelasBuang {
  if (isJokerHidup(k, ctx)) return 'joker';
  if (k.rank === AS) return 'as';
  if (isLondo(k.rank)) return 'londo';
  return k.rank <= 5 ? 'kecil' : 'besar';
}

const londoBiasa = (k: Kartu, ctx: KonteksJoker) => isLondo(k.rank) && !isJokerHidup(k, ctx);

/** Londo (bukan joker hidup) tanpa Londo lain sebunga yang beda angka di tangan. */
export function isLondoTerpencil(k: Kartu, tangan: readonly Kartu[], ctx: KonteksJoker): boolean {
  if (!londoBiasa(k, ctx)) return false;
  return !tangan.some((x) => x.id !== k.id && x.bunga === k.bunga && x.rank !== k.rank && londoBiasa(x, ctx));
}

/** `k` menyambung `atas`: sebunga dan selisih 1 (2–10), atau sama-sama Londo sebunga yang beda angka. */
export function menyambung(k: Kartu, atas: Kartu, ctx: KonteksJoker): boolean {
  if (isJokerHidup(k, ctx) || k.bunga !== atas.bunga || k.rank === atas.rank) return false;
  if (isAngka(k.rank) && isAngka(atas.rank)) return Math.abs(k.rank - atas.rank) === 1;
  return isLondo(k.rank) && isLondo(atas.rank);
}

/** Entropi Shannon (bit) dari hitungan per kelas. Semua nol = 0. */
export function entropiBit(hitungan: readonly number[]): number {
  const total = hitungan.reduce((s, x) => s + x, 0);
  if (total <= 0) return 0;
  let h = 0;
  for (const x of hitungan) if (x > 0) h -= (x / total) * Math.log2(x / total);
  return h;
}

/**
 * Buangan (bukan mentung) per kursi yang disusul giliran ambil pemain berikutnya (`dasar`), dan yang
 * langsung dipungut pemain itu lewat mulung (`disuap`). Arah tiap putaran dari `arahSebelumnya` di riwayat.
 */
export function hitungDisuap(
  peristiwa: readonly Peristiwa[],
  riwayat: readonly HasilPutaran[],
  n: number,
): { dasar: number[]; disuap: number[] } {
  const dasar: number[] = Array(n).fill(0);
  const disuap: number[] = Array(n).fill(0);
  const perPutaran = new Map<number, Peristiwa[]>();
  for (const e of peristiwa) {
    const daftar = perPutaran.get(e.putaran);
    if (daftar) daftar.push(e);
    else perPutaran.set(e.putaran, [e]);
  }
  for (const h of riwayat) {
    const es = perPutaran.get(h.nomor) ?? [];
    for (let i = 0; i < es.length; i++) {
      const e = es[i];
      if (e.jenis !== 'buang' || e.sisaTangan === 0) continue;
      let ambil: Peristiwa | null = null;
      for (let j = i + 1; j < es.length && !ambil; j++) {
        const x = es[j];
        if (x.jenis === 'ambilDeck' || x.jenis === 'mulung') ambil = x;
        else if (x.jenis === 'buang' || x.jenis === 'susunAkhir' || x.jenis === 'putaranSelesai') break;
      }
      if (!ambil || (ambil.jenis !== 'ambilDeck' && ambil.jenis !== 'mulung')) continue;
      const tujuan = berikutnya(e.pemain, h.arahSebelumnya, n);
      if (ambil.pemain !== tujuan) {
        throw new Error(`putaran ${h.nomor}: sesudah buangan pemain ${e.pemain} yang ambil ${ambil.pemain}, bukan ${tujuan}`);
      }
      dasar[e.pemain]++;
      if (ambil.jenis === 'mulung' && ambil.kartu.some((x) => x.kartu.id === e.kartu.id)) disuap[e.pemain]++;
    }
  }
  return { dasar, disuap };
}

/** Penghitung keterbacaan satu peserta untuk satu seed. Pasangan xA/xB = pembilang/penyebut. */
export interface StatBaca {
  lIsoA: number;
  lIsoB: number;
  asA: number;
  asB: number;
  /** L|iso dan As|boleh untuk buangan ke-4..6. */
  lIso2A: number;
  lIso2B: number;
  as2A: number;
  as2B: number;
  diniA: number;
  diniB: number;
  londo1Jumlah: number;
  londo1N: number;
  sambungA: number;
  sambungB: number;
  suapA: number;
  suapB: number;
  /** Hitungan kelas buangan ke-1..3, urut KELAS_BUANG. */
  kelasAwal: number[];
  samaA: number;
  samaB: number;
}

type KunciAngka = Exclude<keyof StatBaca, 'kelasAwal'>;

export function statBacaKosong(): StatBaca {
  return {
    lIsoA: 0,
    lIsoB: 0,
    asA: 0,
    asB: 0,
    lIso2A: 0,
    lIso2B: 0,
    as2A: 0,
    as2B: 0,
    diniA: 0,
    diniB: 0,
    londo1Jumlah: 0,
    londo1N: 0,
    sambungA: 0,
    sambungB: 0,
    suapA: 0,
    suapB: 0,
    kelasAwal: KELAS_BUANG.map(() => 0),
    samaA: 0,
    samaB: 0,
  };
}

type AksiBuang = Extract<Aksi, { jenis: 'buang' }>;

function sahDibuang(g: GameState, pemain: number, k: Kartu, ctx: KonteksJoker): boolean {
  const p = g.putaran!;
  try {
    validasiBuang({
      tangan: p.tangan[pemain],
      punyaKartuJadi: p.kartuJadi[pemain].length > 0,
      sumberAmbil: p.sumberAmbil!,
      kartuId: k.id,
      pungutan: p.pungutan,
      ctx,
      asJokerBolehDibuangTanpaJadi: g.konfigurasi.asJokerBolehDibuangTanpaJadi,
    });
    return true;
  } catch (e) {
    if (e instanceof AturanError) return false;
    throw e;
  }
}

/**
 * Mencatat metrik buangan satu permainan. `stat(kursi)` mengembalikan penghitung peserta di kursi itu
 * (beberapa kursi boleh berbagi penghitung). Panggil `sebelumBuang` tepat sebelum setiap aksi buang
 * diterapkan, lalu `akhir` sekali sesudah permainan selesai.
 */
export class PencatatBaca {
  private nomor: number | null = null;
  private keBuang: number[] = [];
  private sudahLondo: boolean[] = [];

  constructor(private readonly stat: (kursi: number) => StatBaca) {}

  sebelumBuang(g: GameState, aksi: AksiBuang): void {
    const p = g.putaran;
    if (!p) throw new Error('buang tanpa putaran');
    const n = g.pemain.length;
    if (p.nomor !== this.nomor) {
      this.nomor = p.nomor;
      this.keBuang = Array(n).fill(0);
      this.sudahLondo = Array(n).fill(false);
    }
    const x = aksi.pemain;
    const tangan = p.tangan[x];
    // Mentung (semua sisa tangan dibuang) tidak dihitung.
    if (tangan.length === 1 + (aksi.kartuIdLain?.length ?? 0)) return;
    const kartu = tangan.find((k) => k.id === aksi.kartuId);
    if (!kartu) throw new Error(`kartu ${aksi.kartuId} tidak ada di tangan pemain ${x}`);
    const ctx: KonteksJoker = { rankJoker: p.rankJoker, jokerMati: p.jokerMati };
    const s = this.stat(x);
    const ke = ++this.keBuang[x];
    const kelas = kelasBuang(kartu, ctx);

    if (ke <= 6) {
      // Buangan ke-1..3 masuk lIso/as (dan kelasAwal), ke-4..6 masuk lIso2/as2.
      const awal = ke <= 3;
      if (awal) s.kelasAwal[KELAS_BUANG.indexOf(kelas)]++;
      if (tangan.some((k) => isLondoTerpencil(k, tangan, ctx))) {
        const kena = isLondoTerpencil(kartu, tangan, ctx) ? 1 : 0;
        if (awal) {
          s.lIsoB++;
          s.lIsoA += kena;
        } else {
          s.lIso2B++;
          s.lIso2A += kena;
        }
      }
      if (tangan.some((k) => k.rank === AS && !isJokerHidup(k, ctx) && sahDibuang(g, x, k, ctx))) {
        const kena = kelas === 'as' ? 1 : 0;
        if (awal) {
          s.asB++;
          s.asA += kena;
        } else {
          s.as2B++;
          s.as2A += kena;
        }
      }
    }

    if (kelas === 'londo') {
      s.diniB++;
      if (!this.sudahLondo.some((sudah, i) => sudah && i !== x)) s.diniA++;
      if (!this.sudahLondo[x]) {
        s.londo1Jumlah += ke;
        s.londo1N++;
      }
    }

    if (n >= 3 && p.sumberAmbil === 'deck' && p.buangan.length > 0) {
      const atas = p.buangan[p.buangan.length - 1];
      if (atas.pemilik === berikutnya(x, -p.arah as Arah, n)) {
        s.sambungB++;
        if (menyambung(kartu, atas.kartu, ctx)) s.sambungA++;
      }
    }

    if (kelas === 'londo') this.sudahLondo[x] = true;
  }

  akhir(g: GameState): void {
    const { dasar, disuap } = hitungDisuap(g.peristiwa, g.riwayat, g.pemain.length);
    dasar.forEach((d, i) => {
      const s = this.stat(i);
      s.suapB += d;
      s.suapA += disuap[i];
    });
  }
}

export interface Ringkas {
  rata: number;
  ci: number;
  n: number;
}

/** Rata-rata ± 1,96 × sd / √n. */
export function ringkas(xs: readonly number[]): Ringkas {
  const n = xs.length;
  const rata = xs.reduce((s, x) => s + x, 0) / n;
  const varian = n > 1 ? xs.reduce((s, x) => s + (x - rata) ** 2, 0) / (n - 1) : 0;
  return { rata, ci: (1.96 * Math.sqrt(varian)) / Math.sqrt(n), n };
}

/**
 * Rasio Σa/Σb dengan selang kepercayaan per sampel (seed): linearisasi z = (a − R·b) / rata-rata b,
 * lalu ringkas(z).ci. `n` = Σb (jumlah kejadian yang jadi penyebut). Σb = 0 → rata NaN.
 */
export function ringkasRasio(a: readonly number[], b: readonly number[]): Ringkas {
  const sa = a.reduce((s, x) => s + x, 0);
  const sb = b.reduce((s, x) => s + x, 0);
  if (sb <= 0) return { rata: NaN, ci: NaN, n: 0 };
  const r = sa / sb;
  const rataB = sb / b.length;
  const z = a.map((x, i) => (x - r * b[i]) / rataB);
  return { rata: r, ci: ringkas(z).ci, n: sb };
}

/** Entropi gabungan semua sampel, CI 95% dari jackknife buang-satu-sampel. `n` = jumlah buangan. */
export function ringkasEntropi(hitunganPerSampel: readonly (readonly number[])[]): Ringkas {
  const k = hitunganPerSampel[0]?.length ?? 0;
  const total = Array(k).fill(0);
  for (const h of hitunganPerSampel) h.forEach((x, i) => (total[i] += x));
  const nBuang = total.reduce((s, x) => s + x, 0);
  const rata = entropiBit(total);
  const m = hitunganPerSampel.length;
  if (m < 2) return { rata, ci: 0, n: nBuang };
  const jk = hitunganPerSampel.map((h) => entropiBit(total.map((x, i) => x - h[i])));
  const rataJk = jk.reduce((s, x) => s + x, 0) / m;
  const varian = ((m - 1) / m) * jk.reduce((s, x) => s + (x - rataJk) ** 2, 0);
  return { rata, ci: 1.96 * Math.sqrt(varian), n: nBuang };
}

const persen = (r: Ringkas) => (r.n ? `${(100 * r.rata).toFixed(1)}±${(100 * r.ci).toFixed(1)}%` : '-');
const angka = (r: Ringkas, d: number) => (r.n ? `${r.rata.toFixed(d)}±${r.ci.toFixed(d)}` : '-');

/** Satu baris "baca:" dari sampel per seed. `baca` = tampilkan samaStandar (--baca). */
export function barisBaca(sampel: readonly StatBaca[], baca: boolean): string {
  const rasio = (a: KunciAngka, b: KunciAngka) =>
    ringkasRasio(
      sampel.map((s) => s[a]),
      sampel.map((s) => s[b]),
    );
  const lIso = rasio('lIsoA', 'lIsoB');
  const as = rasio('asA', 'asB');
  const lIso2 = rasio('lIso2A', 'lIso2B');
  const as2 = rasio('as2A', 'as2B');
  const dini = rasio('diniA', 'diniB');
  const londo1 = rasio('londo1Jumlah', 'londo1N');
  const sambung = rasio('sambungA', 'sambungB');
  const suap = rasio('suapA', 'suapB');
  const entropi = ringkasEntropi(sampel.map((s) => s.kelasAwal));
  const bagian = [
    `L|iso ${persen(lIso)} (${lIso.n})`,
    `As|boleh ${persen(as)} (${as.n})`,
    `L|iso4-6 ${persen(lIso2)} (${lIso2.n})`,
    `As|boleh4-6 ${persen(as2)} (${as2.n})`,
    `londoDini ${persen(dini)} (${dini.n})`,
    `giliranLondo1 ${angka(londo1, 2)} (${londo1.n})`,
    `nyambung ${persen(sambung)} (${sambung.n})`,
    `disuap ${persen(suap)} (${suap.n})`,
    `entropiAwal ${angka(entropi, 3)} bit (${entropi.n})`,
  ];
  if (baca) {
    const sama = rasio('samaA', 'samaB');
    bagian.push(`samaStandar ${sama.n ? `${persen(sama)} (${sama.n})` : '- (gaya standar)'}`);
  }
  return `baca: ${bagian.join('  ')}`;
}
