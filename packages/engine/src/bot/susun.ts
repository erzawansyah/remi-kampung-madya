// Pencari susunan kartu jadi untuk warga kedai level jago dan suhu.
//
// Kartu dikelompokkan per "tipe" (bunga + angka, 52 tipe) supaya kartu kembar dari deck kedua tidak
// membuat pencarian bercabang dua kali. Joker hidup dicoba dalam tiap peran (dirinya sendiri atau
// pengganti). Hasilnya hanya dipakai untuk MENILAI; aksi yang dikirim bot tetap divalidasi dengan
// fungsi aturan di giliran.ts.

import { nilaiDasar, SEMUA_BUNGA, type Bunga, type Kartu, type Rank } from '../kartu.js';
import { isJokerHidup, type KonteksJoker, type SpesifikasiKartuJadi } from '../kartuJadi.js';
import { NILAI_PENTUNGAN_JOKER } from '../skor.js';

const IDX_BUNGA: Record<Bunga, number> = { waru: 0, love: 1, kriting: 2, wajik: 3 };

export function tipeKartu(k: { bunga: Bunga; rank: Rank }): number {
  return IDX_BUNGA[k.bunga] * 13 + k.rank - 1;
}

export const rankTipe = (t: number): Rank => ((t % 13) + 1) as Rank;
export const bungaTipe = (t: number): Bunga => SEMUA_BUNGA[(t / 13) | 0];

/** Nilai kartu biasa di tangan/kartu jadi, per tipe. */
export const NILAI_TIPE: readonly number[] = Array.from({ length: 52 }, (_, t) => nilaiDasar(rankTipe(t)));

/** Joker hidup yang tertinggal di tangan. */
export const NILAI_JOKER_TANGAN = 25;

/**
 * Tetangga tiap tipe: tipe lain yang bisa satu kartu jadi dengannya (seri angka ±2 sebunga,
 * Londo sebunga, As beda bunga).
 */
export const TETANGGA: readonly (readonly number[])[] = Array.from({ length: 52 }, (_, t) => {
  const s = (t / 13) | 0;
  const r = (t % 13) + 1;
  const hasil: number[] = [];
  if (r === 1) {
    for (let s2 = 0; s2 < 4; s2++) if (s2 !== s) hasil.push(s2 * 13);
  } else if (r >= 11) {
    for (let q = 11; q <= 13; q++) if (q !== r) hasil.push(s * 13 + q - 1);
  } else {
    for (let q = r - 2; q <= r + 2; q++) if (q !== r && q >= 2 && q <= 10) hasil.push(s * 13 + q - 1);
  }
  return hasil;
});

/** Isi tangan dalam bentuk hitungan per tipe. */
export interface IsiTangan {
  /** Kartu yang hanya bisa jadi dirinya sendiri (bukan joker hidup), dihitung per tipe. */
  alami: Int8Array;
  /** Tipe tiap joker hidup (bisa jadi dirinya sendiri atau pengganti). */
  joker: number[];
}

export function isiDari(kartu: readonly Kartu[], ctx: KonteksJoker): IsiTangan {
  const alami = new Int8Array(52);
  const joker: number[] = [];
  for (const k of kartu) {
    if (isJokerHidup(k, ctx)) joker.push(tipeKartu(k));
    else alami[tipeKartu(k)]++;
  }
  return { alami, joker };
}

export function jumlahIsi(isi: IsiTangan): number {
  let n = isi.joker.length;
  for (let t = 0; t < 52; t++) n += isi.alami[t];
  return n;
}

/** Satu kartu di susunan: tipe fisiknya, apakah joker hidup, dan perannya. */
export interface SlotJadi {
  t: number;
  hidup: boolean;
  liar: boolean;
  sebagai: number;
}

export interface HasilSusun {
  /** Mode bebas: nilai kartu jadi − nilai sisa tangan. Mode tepat: nilai pentungan sisa (0 bila tanpa sisa). */
  nilai: number;
  nilaiJadi: number;
  susunan: SlotJadi[][];
  /** Kartu yang tidak dijadikan. */
  sisa: { t: number; hidup: boolean }[];
}

/**
 * Pencarian susunan. Mode:
 * - bebas: maksimalkan (nilai kartu jadi − nilai kartu sisa), seperti skor dasar akhir putaran.
 * - tepat(n): tepat n kartu tidak dijadikan (n = 1: syarat mentung; n = 0: semuanya jadi).
 *   Bila n = 1, maksimalkan nilai pentungan kartu sisa itu.
 */
export class Penyusun {
  private cnt = new Int8Array(52);
  /** Joker hidup berperan dirinya sendiri, per tipe (sudah termasuk di cnt). */
  private hidupAlami = new Int8Array(52);
  private liar: number[] = [];
  private liarPakai = 0;
  private tumpuk: SlotJadi[][] = [];
  private lepas: { t: number; hidup: boolean }[] = [];
  private batasLepas = Infinity;
  private tepat = false;
  private wajib = -1;
  private wajibJadi = 0;
  private punyaJadi = false;
  private catat = false;
  /** Mode tepat(1): kartu sisa (tipe, joker hidup) yang tidak boleh jadi pentungan; null = semua boleh. */
  private larangSisa: ((t: number, hidup: boolean) => boolean) | null = null;
  private terbaik = -Infinity;
  private terbaikJadi = 0;
  private terbaikSusunan: SlotJadi[][] = [];
  private terbaikSisa: { t: number; hidup: boolean }[] = [];
  /** Penghitung langkah, untuk mengukur dan membatasi biaya. */
  langkah = 0;

  /**
   * @param punyaJadi pemain sudah punya kartu jadi di meja (syarat 3 As)
   * @param catat simpan susunan terbaik (lebih lambat sedikit)
   * @param wajib tipe yang minimal satu kartunya wajib dijadikan (kartu pungutan paling bawah), −1 bila tidak ada
   * @param larangSisa mode tepat(1): kartu sisa yang tidak boleh jadi pentungan (keputusan #53, kembaran
   *   kartu pungutan giliran ini); tidak ada = semua boleh, hasilnya sama persis dengan sebelum opsi ini ada
   */
  cari(
    isi: IsiTangan,
    punyaJadi: boolean,
    opsi: { tepat?: number; wajib?: number; catat?: boolean; larangSisa?: (t: number, hidup: boolean) => boolean } = {},
  ): HasilSusun | null {
    this.punyaJadi = punyaJadi;
    this.catat = opsi.catat ?? false;
    this.larangSisa = opsi.larangSisa ?? null;
    this.tepat = opsi.tepat !== undefined;
    this.wajib = opsi.wajib ?? -1;
    this.terbaik = -Infinity;
    this.terbaikJadi = 0;
    this.terbaikSusunan = [];
    this.terbaikSisa = [];
    this.cnt.set(isi.alami);
    this.hidupAlami.fill(0);

    // Kelompokkan joker per tipe; joker yang tidak punya tetangga sama sekali tidak mungkin
    // dijadikan sebagai dirinya sendiri, jadi cukup dicoba sebagai pengganti.
    const tipeJoker: number[] = [];
    const jumlahJoker: number[] = [];
    for (const t of isi.joker) {
      const i = tipeJoker.indexOf(t);
      if (i < 0) {
        tipeJoker.push(t);
        jumlahJoker.push(1);
      } else jumlahJoker[i]++;
    }
    const adaTetangga = (t: number) =>
      TETANGGA[t].some((u) => isi.alami[u] > 0 || isi.joker.includes(u)) || isi.alami[t] > 0;
    const maksAlami = tipeJoker.map((t, i) => (adaTetangga(t) ? jumlahJoker[i] : 0));
    const sisaTepat = opsi.tepat ?? 0;

    // Enumerasi peran: per tipe joker, berapa yang jadi dirinya sendiri; di mode tepat(1),
    // satu joker boleh jadi kartu sisa (pentungan joker).
    const alami = new Array<number>(tipeJoker.length).fill(0);
    const jalan = (i: number, jokerSisa: number) => {
      if (i === tipeJoker.length) {
        this.liar = [];
        let sisaMaks = 0;
        for (let t = 0; t < 52; t++) sisaMaks += this.cnt[t] * NILAI_TIPE[t];
        tipeJoker.forEach((t, j) => {
          const nLiar = jumlahJoker[j] - alami[j] - (jokerSisa === j ? 1 : 0);
          for (let x = 0; x < nLiar; x++) this.liar.push(t);
        });
        sisaMaks += this.liar.length * 5;
        this.liarPakai = 0;
        this.lepas = jokerSisa >= 0 ? [{ t: tipeJoker[jokerSisa], hidup: true }] : [];
        this.batasLepas = this.tepat ? sisaTepat - (jokerSisa >= 0 ? 1 : 0) : Infinity;
        this.wajibJadi = 0;
        const awal = jokerSisa >= 0 ? -NILAI_JOKER_TANGAN : 0;
        this.dfs(0, awal, 0, sisaMaks, 0, 0);
        return;
      }
      for (let a = 0; a <= maksAlami[i]; a++) {
        alami[i] = a;
        this.cnt[tipeJoker[i]] += a;
        this.hidupAlami[tipeJoker[i]] += a;
        jalan(i + 1, jokerSisa);
        this.cnt[tipeJoker[i]] -= a;
        this.hidupAlami[tipeJoker[i]] -= a;
      }
      alami[i] = 0;
    };
    jalan(0, -1);
    if (this.tepat && sisaTepat === 1) {
      for (let j = 0; j < tipeJoker.length; j++) {
        const simpan = jumlahJoker[j];
        // Joker ke-j jadi sisa; sisanya dicoba semua peran.
        const maksSimpan = maksAlami[j];
        maksAlami[j] = Math.min(maksAlami[j], simpan - 1);
        jalan(0, j);
        maksAlami[j] = maksSimpan;
      }
    }
    if (this.terbaik === -Infinity) return null;
    return { nilai: this.terbaik, nilaiJadi: this.terbaikJadi, susunan: this.terbaikSusunan, sisa: this.terbaikSisa };
  }

  private daun(nilai: number, jadi: number, as3: number, lain: number): void {
    if (as3 > 0 && lain === 0 && !this.punyaJadi) return;
    if (this.wajib >= 0 && this.wajibJadi === 0) return;
    let skor: number;
    if (this.tepat) {
      if (this.liarPakai < this.liar.length || this.batasLepas !== 0) return;
      // Nilai pentungan kartu sisa (bila ada), lalu nilai kartu jadi sebagai pemecah seri.
      const s = this.lepas[0];
      if (s && this.larangSisa?.(s.t, s.hidup)) return;
      const pentungan = !s ? 0 : s.hidup ? NILAI_PENTUNGAN_JOKER : NILAI_TIPE[s.t] * 10;
      skor = pentungan * 1000 + jadi;
    } else {
      skor = nilai - (this.liar.length - this.liarPakai) * NILAI_JOKER_TANGAN;
    }
    if (skor <= this.terbaik) return;
    this.terbaik = skor;
    this.terbaikJadi = jadi;
    if (this.catat) {
      this.terbaikSusunan = this.tumpuk.map((m) => m.map((s) => ({ ...s })));
      const sisa = [...this.lepas];
      for (let i = this.liarPakai; i < this.liar.length; i++) sisa.push({ t: this.liar[i], hidup: true });
      this.terbaikSisa = sisa;
    }
  }

  /** Ambil satu kartu tipe t untuk dijadikan (joker hidup berperan alami dipakai lebih dulu). */
  private pakai(t: number, sebagai: number): SlotJadi {
    this.cnt[t]--;
    let hidup = false;
    if (this.hidupAlami[t] > 0) {
      this.hidupAlami[t]--;
      hidup = true;
    }
    if (t === this.wajib) this.wajibJadi++;
    return { t, hidup, liar: false, sebagai };
  }

  private kembali(s: SlotJadi): void {
    if (s.liar) {
      this.liarPakai--;
      return;
    }
    this.cnt[s.t]++;
    if (s.hidup) this.hidupAlami[s.t]++;
    if (s.t === this.wajib) this.wajibJadi--;
  }

  private dfs(t: number, nilai: number, jadi: number, sisaMaks: number, as3: number, lain: number): void {
    this.langkah++;
    const cnt = this.cnt;
    while (t < 52 && cnt[t] === 0) t++;
    if (t === 52) {
      this.daun(nilai, jadi, as3, lain);
      return;
    }
    if (!this.tepat && nilai + sisaMaks <= this.terbaik) return;
    const v = NILAI_TIPE[t];
    const r = (t % 13) + 1;

    // (1) Kartu ini tidak dijadikan. Kartu biasa dilepas lebih dulu daripada joker berperan alami.
    this.cobaLepas(t, v, nilai, jadi, sisaMaks, as3, lain);

    // (2) Kembar As: kartu ini As terendah yang tersisa; pasangannya As bunga lain.
    if (r === 1) {
      const s = (t / 13) | 0;
      const lainAs: number[] = [];
      for (let s2 = s + 1; s2 < 4; s2++) if (cnt[s2 * 13] > 0) lainAs.push(s2 * 13);
      if (lainAs.length >= 2) {
        const a = this.pakai(t, t);
        for (let i = 0; i < lainAs.length; i++) {
          for (let j = i + 1; j < lainAs.length; j++) {
            const b = this.pakai(lainAs[i], lainAs[i]);
            const c = this.pakai(lainAs[j], lainAs[j]);
            this.tumpuk.push([a, b, c]);
            this.dfs(t, nilai + 45, jadi + 45, sisaMaks - 45, as3 + 1, lain);
            this.tumpuk.pop();
            for (let k = j + 1; k < lainAs.length; k++) {
              const d = this.pakai(lainAs[k], lainAs[k]);
              this.tumpuk.push([a, b, c, d]);
              this.dfs(t, nilai + 60, jadi + 60, sisaMaks - 60, as3, lain + 1);
              this.tumpuk.pop();
              this.kembali(d);
            }
            this.kembali(c);
            this.kembali(b);
          }
        }
        this.kembali(a);
      }
      return;
    }

    // (3) Seri Londo J-Q-K (joker tidak bisa menggantikan Londo).
    if (r >= 11) {
      if (r === 11 && cnt[t + 1] > 0 && cnt[t + 2] > 0) {
        const a = this.pakai(t, t);
        const b = this.pakai(t + 1, t + 1);
        const c = this.pakai(t + 2, t + 2);
        this.tumpuk.push([a, b, c]);
        this.dfs(t, nilai + 30, jadi + 30, sisaMaks - 30, as3, lain + 1);
        this.tumpuk.pop();
        this.kembali(c);
        this.kembali(b);
        this.kembali(a);
      }
      return;
    }

    // (4) Seri angka dengan kartu ini sebagai kartu biasa terendah; boleh diawali satu pengganti.
    const dasar = t - r; // tipe angka q di bunga ini = dasar + q
    const seri: SlotJadi[] = [this.pakai(t, t)];
    this.panjangkan(t, dasar, r, 1, 0, false, seri, nilai + 5, jadi + 5, sisaMaks - 5, as3, lain);
    this.kembali(seri[0]);
    if (r - 1 >= 2 && this.liarPakai < this.liar.length) {
      const w = this.pakaiLiar(dasar + r - 1);
      const a = this.pakai(t, t);
      const seri2 = [w, a];
      this.panjangkan(t, dasar, r, 1, 1, false, seri2, nilai + 10, jadi + 10, sisaMaks - 10, as3, lain);
      this.kembali(a);
      this.kembali(w);
    }
  }

  private cobaLepas(t: number, v: number, nilai: number, jadi: number, sisaMaks: number, as3: number, lain: number): void {
    if (this.tepat && this.batasLepas <= 0) return;
    const biasa = this.cnt[t] - this.hidupAlami[t];
    if (biasa > 0) {
      this.cnt[t]--;
      this.lepas.push({ t, hidup: false });
      this.batasLepas--;
      this.dfs(t, nilai - v, jadi, sisaMaks - v, as3, lain);
      this.batasLepas++;
      this.lepas.pop();
      this.cnt[t]++;
    } else if (!this.tepat) {
      // Joker hidup berperan alami yang tidak dijadikan: tetap 25 di tangan.
      this.cnt[t]--;
      this.hidupAlami[t]--;
      this.lepas.push({ t, hidup: true });
      this.dfs(t, nilai - NILAI_JOKER_TANGAN, jadi, sisaMaks - v, as3, lain);
      this.lepas.pop();
      this.hidupAlami[t]++;
      this.cnt[t]++;
    }
  }

  private pakaiLiar(sebagai: number): SlotJadi {
    const t = this.liar[this.liarPakai++];
    return { t, hidup: true, liar: true, sebagai };
  }

  private panjangkan(
    t0: number,
    dasar: number,
    atas: number,
    nAlami: number,
    nLiar: number,
    liarTerakhir: boolean,
    seri: SlotJadi[],
    nilai: number,
    jadi: number,
    sisaMaks: number,
    as3: number,
    lain: number,
  ): void {
    if (nAlami + nLiar >= 3 && nLiar <= nAlami) {
      this.tumpuk.push([...seri]);
      this.dfs(t0, nilai, jadi, sisaMaks, as3, lain + 1);
      this.tumpuk.pop();
    }
    if (atas >= 10) return;
    const q = atas + 1;
    const tq = dasar + q;
    if (this.cnt[tq] > 0) {
      const s = this.pakai(tq, tq);
      seri.push(s);
      this.panjangkan(t0, dasar, q, nAlami + 1, nLiar, false, seri, nilai + 5, jadi + 5, sisaMaks - 5, as3, lain);
      seri.pop();
      this.kembali(s);
    }
    // Pengganti: tidak boleh dempet, dan masih mungkin memenuhi "pengganti ≤ kartu biasa".
    if (!liarTerakhir && this.liarPakai < this.liar.length && nLiar + 1 <= nAlami + (10 - q)) {
      const w = this.pakaiLiar(tq);
      seri.push(w);
      this.panjangkan(t0, dasar, q, nAlami, nLiar + 1, true, seri, nilai + 5, jadi + 5, sisaMaks - 5, as3, lain);
      seri.pop();
      this.kembali(w);
    }
  }
}

/**
 * Ubah susunan (per tipe) jadi spesifikasi kartu jadi dengan id kartu sungguhan dari `kartu`.
 * Kartu kembar (deck kedua) saling menggantikan; joker hidup dan kartu biasa dibedakan.
 */
export function keSpesifikasi(susunan: SlotJadi[][], kartu: readonly Kartu[], ctx: KonteksJoker): SpesifikasiKartuJadi[] | null {
  const hidup = new Map<number, Kartu[]>();
  const biasa = new Map<number, Kartu[]>();
  for (const k of kartu) {
    const m = isJokerHidup(k, ctx) ? hidup : biasa;
    const t = tipeKartu(k);
    const daftar = m.get(t);
    if (daftar) daftar.push(k);
    else m.set(t, [k]);
  }
  const hasil: SpesifikasiKartuJadi[] = [];
  for (const m of susunan) {
    const spek: SpesifikasiKartuJadi = [];
    for (const s of m) {
      const k = (s.hidup ? hidup : biasa).get(s.t)?.pop();
      if (!k) return null;
      spek.push(s.liar ? { id: k.id, sebagai: { rank: rankTipe(s.sebagai), bunga: bungaTipe(s.sebagai) } } : { id: k.id });
    }
    hasil.push(spek);
  }
  return hasil;
}
