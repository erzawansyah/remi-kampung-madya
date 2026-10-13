// Musik latar generatif (opsional, bawaan mati): iringan santai ala keroncong/lo-fi di D mayor.
// Bas petik di ketukan 1 dan 3, "cak" senar di ketukan lemah (sedikit berayun), dan sesekali melodi
// pentatonik dari bilah atau suling. Progresi akord dan pola melodi diundi tiap frasa supaya tidak
// membosankan. Dijadwalkan dengan teknik lookahead (timer jarang + jam audio presisi), berhenti total
// saat adegan 'diam', musik dimatikan, atau tab tersembunyi.

import { preferensi, saatPreferensiBerubah } from '../preferensi';
import { bangunRantai, catatSumber, mesinAudio, saatMesinSiap, type Rantai } from './mesinAudio';
import { acak, bilah, buatGema, hz, nada, petik, type Keluaran } from './sintesis';

export type AdeganMusik = 'beranda' | 'meja' | 'diam';
type Gaya = Exclude<AdeganMusik, 'diam'>;

interface Akord {
  /** Nada bas (MIDI). */
  bas: number;
  /** Nada akord untuk petikan (MIDI). */
  nada: readonly number[];
}

const AKORD = {
  I: { bas: 50, nada: [62, 66, 69] }, // D
  ii: { bas: 52, nada: [64, 67, 71] }, // Em
  iii: { bas: 54, nada: [61, 66, 69] }, // F#m
  IV: { bas: 55, nada: [62, 67, 71] }, // G
  V: { bas: 45, nada: [61, 64, 69] }, // A
  vi: { bas: 47, nada: [62, 66, 71] }, // Bm
} as const satisfies Record<string, Akord>;
type NamaAkord = keyof typeof AKORD;

/** Progresi 4 birama yang diundi per frasa. */
const PROGRESI: readonly (readonly NamaAkord[])[] = [
  ['I', 'vi', 'IV', 'V'],
  ['I', 'IV', 'I', 'V'],
  ['I', 'iii', 'IV', 'V'],
  ['IV', 'V', 'iii', 'vi'],
  ['ii', 'V', 'I', 'I'],
  ['I', 'V', 'vi', 'IV'],
];

/** Nada melodi: D mayor pentatonik, F#4 sampai D6. */
const MELODI = [66, 69, 71, 74, 76, 78, 81, 83, 86];

/** Pola ritme melodi per birama (indeks seperdelapan 0..7). */
const POLA_MELODI: readonly (readonly number[])[] = [[0, 3, 4], [0, 2, 4, 6], [0, 4], [0, 3, 6], [2, 4, 7], [0, 6]];

const GAYA: Record<Gaya, { bpm: number; petik: readonly number[]; peluangMelodi: number; kerasPetik: number; kerasMelodi: number }> = {
  // Beranda: sedikit lebih hidup.
  beranda: { bpm: 76, petik: [1, 3, 5, 7], peluangMelodi: 0.7, kerasPetik: 0.11, kerasMelodi: 0.16 },
  // Meja: lebih jarang dan lebih pelan supaya tidak mengganggu mikir.
  meja: { bpm: 66, petik: [2, 6], peluangMelodi: 0.35, kerasPetik: 0.1, kerasMelodi: 0.12 },
};

/** Pembuat musik: menyimpan posisi ketukan dan menjadwalkan nada sampai waktu tertentu. */
class Pemusik {
  private t: number;
  private slot = 0;
  private birama = 0;
  private progresi: readonly NamaAkord[] = PROGRESI[0];
  private adaMelodi = false;
  private suling = false;
  private polaBirama: readonly number[] = [];
  private iMelodi = 3;
  private gayaBerikut: Gaya;

  constructor(
    private readonly k: Keluaran,
    private gaya: Gaya,
    mulai: number,
  ) {
    this.t = mulai;
    this.gayaBerikut = gaya;
    this.frasaBaru();
  }

  /** Ganti gaya; berlaku mulai frasa berikutnya supaya tidak tersendat. */
  ganti(gaya: Gaya): void {
    this.gayaBerikut = gaya;
  }

  /** Lompati ketukan yang sudah lewat (mis. sesudah tab kembali terlihat) tanpa membunyikannya. */
  susulKe(t: number): void {
    while (this.t < t) this.maju();
  }

  jadwalkanSampai(tAkhir: number): void {
    while (this.t < tAkhir) {
      this.mainkan(this.t);
      this.maju();
    }
  }

  private get seperdelapan(): number {
    return 30 / GAYA[this.gaya].bpm;
  }

  private frasaBaru(): void {
    this.gaya = this.gayaBerikut;
    const lain = PROGRESI.filter((p) => p !== this.progresi);
    this.progresi = lain[Math.floor(Math.random() * lain.length)];
    // Melodi datang dan pergi per frasa (tanya-jawab), instrumennya bergantian.
    this.adaMelodi = Math.random() < GAYA[this.gaya].peluangMelodi;
    this.suling = Math.random() < 0.4;
  }

  private maju(): void {
    this.t += this.seperdelapan;
    if (++this.slot < 8) return;
    this.slot = 0;
    if (++this.birama < 4) return;
    this.birama = 0;
    this.frasaBaru();
  }

  private mainkan(t0: number): void {
    const g = GAYA[this.gaya];
    const ak: Akord = AKORD[this.progresi[this.birama]];
    const s = this.slot;
    const ketuk = this.seperdelapan * 2;
    // Seperdelapan lemah sedikit diayun, dan semua sedikit "manusiawi".
    const t = t0 + (s % 2 === 1 ? this.seperdelapan * 0.14 : 0) + acak(0, 0.008);

    if (s === 0) {
      const akhirFrasa = this.birama === 3;
      this.polaBirama = !this.adaMelodi ? [] : akhirFrasa ? [0] : Math.random() < 0.2 ? [] : POLA_MELODI[Math.floor(Math.random() * POLA_MELODI.length)];
    }

    // Bas petik: akar di ketukan 1, kuint di ketukan 3, kadang nada pendekat di akhir birama.
    if (s === 0) this.bas(t, ak.bas, ketuk * 1.8);
    if (s === 4) this.bas(t, ak.bas + 7 > 57 ? ak.bas - 5 : ak.bas + 7, ketuk * 1.6);
    if (s === 7 && Math.random() < 0.25) this.bas(t, ak.bas + (Math.random() < 0.5 ? 2 : -1), ketuk * 0.5, 0.6);

    // "Cak": petikan akord di ketukan lemah, nada digeser sedikit seperti digenjreng.
    if (g.petik.includes(s)) {
      const keras = g.kerasPetik * acak(0.75, 1) * (s === 3 || s === 7 ? 0.85 : 1);
      ak.nada.forEach((m, i) => petik(this.k, t + i * 0.012, hz(m), ketuk * 0.9, keras, 0.15));
    }

    if (this.polaBirama.includes(s)) this.melodi(t, ak, ketuk, this.birama === 3);
  }

  private bas(t: number, midi: number, dur: number, keras = 1): void {
    nada(this.k, t, hz(midi), dur, { tipe: 'triangle', puncak: 0.26 * keras * acak(0.85, 1), serang: 0.008, lowpass: 520 });
  }

  private melodi(t: number, ak: Akord, ketuk: number, akhirFrasa: boolean): void {
    const langkah = [-2, -1, -1, 0, 1, 1, 2][Math.floor(Math.random() * 7)];
    this.iMelodi = Math.min(MELODI.length - 1, Math.max(0, this.iMelodi + langkah));
    // Di ketukan kuat dan akhir frasa, tarik ke nada akord terdekat supaya terdengar "pulang".
    if (this.slot === 0 || this.slot === 4 || akhirFrasa) {
      const kelas = ak.nada.map((m) => m % 12);
      let terbaik = this.iMelodi;
      for (let jarak = 0; jarak < MELODI.length; jarak++) {
        const cari = [this.iMelodi - jarak, this.iMelodi + jarak].find((i) => i >= 0 && i < MELODI.length && kelas.includes(MELODI[i] % 12));
        if (cari !== undefined) {
          terbaik = cari;
          break;
        }
      }
      this.iMelodi = terbaik;
    }
    const f = hz(MELODI[this.iMelodi]);
    const keras = GAYA[this.gaya].kerasMelodi * acak(0.8, 1);
    const dur = akhirFrasa ? ketuk * 3 : ketuk * 1.4;
    if (this.suling) {
      nada(this.k, t, f, dur, { puncak: keras * 0.8, serang: 0.06, gema: 0.45 });
      nada(this.k, t, f * 2, dur * 0.7, { puncak: keras * 0.12, serang: 0.08 });
    } else {
      bilah(this.k, t, f, dur, keras, 0.5);
    }
  }
}

/** Jalur musik di satu context: nada → saringan hangat → fader → bus musik, plus gema sendiri. */
interface Jalur {
  readonly a: BaseAudioContext;
  readonly fader: GainNode;
  readonly k: Keluaran;
}

function bangunJalur(r: Rantai, lacak?: (d: number) => void): Jalur {
  const { a } = r;
  const fader = a.createGain();
  fader.gain.value = 0;
  fader.connect(r.busMusik);
  const hangat = a.createBiquadFilter();
  hangat.type = 'lowpass';
  hangat.frequency.value = 3200;
  hangat.Q.value = 0.5;
  hangat.connect(fader);
  // Gema masuk sebelum fader supaya ikut memudar saat musik dihentikan.
  const gema = buatGema(a, fader, { tunda: 0.34, umpan: 0.3, basah: 0.25, lowpass: 1800 });
  return { a, fader, k: { a, ke: hangat, gema, derau: r.derau, lacak } };
}

const LOOKAHEAD = 1.2;
const TIAP_MS = 300;

let adegan: AdeganMusik = 'diam';
let jalur: Jalur | null = null;
let pemusik: Pemusik | null = null;
let timer: ReturnType<typeof setTimeout> | undefined;
let timerLupa: ReturnType<typeof setTimeout> | undefined;
let terpasang = false;

const ingin = (): boolean => adegan !== 'diam' && preferensi().musik && document.visibilityState === 'visible';

function detak(): void {
  timer = undefined;
  if (!ingin() || !pemusik || !jalur) return;
  pemusik.jadwalkanSampai(jalur.a.currentTime + LOOKAHEAD);
  timer = setTimeout(detak, TIAP_MS);
}

function mulai(gaya: Gaya): void {
  const r = mesinAudio();
  if (!r) return; // Belum ada sentuhan: dicoba lagi lewat saatMesinSiap.
  if (!jalur || jalur.a !== r.a) jalur = bangunJalur(r, catatSumber);
  clearTimeout(timerLupa);
  const kini = r.a.currentTime;
  const g = jalur.fader.gain;
  g.cancelScheduledValues(kini);
  g.setValueAtTime(g.value, kini);
  g.setTargetAtTime(1, kini, 0.8);
  if (pemusik) {
    pemusik.ganti(gaya);
    pemusik.susulKe(kini + 0.05);
  } else {
    pemusik = new Pemusik(jalur.k, gaya, kini + 0.15);
  }
  if (timer === undefined) detak();
}

function berhenti(): void {
  clearTimeout(timer);
  timer = undefined;
  if (!jalur) return;
  const kini = jalur.a.currentTime;
  const g = jalur.fader.gain;
  g.cancelScheduledValues(kini);
  g.setValueAtTime(g.value, kini);
  g.setTargetAtTime(0, kini, 0.35);
  // Kalau tidak dilanjutkan dalam 2 detik, mulai dari frasa baru nanti.
  clearTimeout(timerLupa);
  timerLupa = setTimeout(() => {
    if (!ingin()) pemusik = null;
  }, 2000);
}

function perbarui(): void {
  if (ingin()) mulai(adegan as Gaya);
  else berhenti();
}

/** Pasang pendengar (preferensi, tab tersembunyi, audio siap). Aman dipanggil berkali-kali. */
export function pasangMusik(): void {
  if (terpasang || typeof document === 'undefined') return;
  terpasang = true;
  saatPreferensiBerubah(perbarui);
  saatMesinSiap(perbarui);
  document.addEventListener('visibilitychange', perbarui);
}

/**
 * Pilih suasana musik latar sesuai layar: 'beranda', 'meja', atau 'diam' (berhenti total).
 * Musik hanya berbunyi kalau preferensi musik nyala; pindah adegan berganti gaya di frasa berikutnya.
 */
export function suasanaMusik(baru: AdeganMusik): void {
  pasangMusik();
  adegan = baru;
  perbarui();
}

/** Rekam musik secara offline (volume musik 100%) untuk memeriksa level. Hanya alat ukur. */
export async function rekamMusik(gaya: Gaya, detik: number): Promise<AudioBuffer> {
  const laju = 48000;
  const a = new OfflineAudioContext(2, Math.ceil(laju * (detik + 2)), laju);
  const r = bangunRantai(a);
  r.busMusik.gain.value = 1;
  const j = bangunJalur(r);
  j.fader.gain.value = 1;
  new Pemusik(j.k, gaya, 0.1).jadwalkanSampai(detik);
  return a.startRendering();
}
