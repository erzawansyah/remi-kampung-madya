// Gaya main warga kedai (keputusan pemilik #47): kebiasaan yang melekat ke persona (nama warga),
// terpisah dari level. Gaya TIDAK ditampilkan ke pemain di mana pun (bukan di view, protokol, UI,
// Bantuan, maupun teks pemain).
//
// Semua kait gaya hanya membaca info publik di ViewPemain: putaran (buangan beserta pemiliknya,
// kartu jadi beserta `dari`, jumlah kartu tangan, sisa deck), peristiwa yang ada di view, dan skor.
// Aksi tetap divalidasi fungsi di giliran.ts, dan pilihAksiBot tetap fungsi murni dari
// (view, level, rng, gaya). Bias gaya hanya diberikan ke calon yang sah, jadi buangan yang dipaksa
// aturan tetap terjadi.
//
// - 'standar' = perilaku lama, persis sama, dan tidak memakai rng: buatKonteksGaya mengembalikan null
//   dan setiap kait diperiksa `if (!kg)` dulu.
// - Mudah mengabaikan gaya (latihan tidak berubah). Susun akhir tanpa gaya.
// - 'berubah' tidak punya definisi sendiri: tiap putaran memakai salah satu GAYA_TETAP, dipilih dari
//   hash info publik putaran itu (gayaPutaran), jadi tetap murni dan tidak bisa ditebak dari putaran lalu.
//
// Supaya satu persona tidak gampang dibaca:
// - mood per putaran (moodPutaran, dari hash info publik putaran, tanpa memakai rng): kekuatan gaya
//   dikali 1 ± mood, dan dengan peluang `peluangLibur` gayanya libur di putaran itu (kali = 0);
// - nilai yang hampir seri (selisih ≤ `toleransi` dari yang terbaik) dipilih acak lewat rng (pilihDekat);
// - batas "gugup menurunkan kartu jadi" Jago digeser −1/0/+1 per putaran (selain gaya kilat).
//
// Angka di DEFINISI_GAYA hasil penyetelan arena (C3, 17 Okt 2026; semua tabel, syarat, dan kompromi di
// docs/keputusan-pemilik.md #47). 200 seed per meja, 4 putaran, lawan Normal standar kecuali disebut lain:
// - Kekuatan: Suhu bergaya apa pun signifikan di atas Normal di keenam meja (rata-rata meja +55,6 sampai
//   +59,9 per putaran, standar +58,4). Jago bergaya signifikan di atas Normal di 6/6 meja (+31,8 sampai
//   +37,1, standar +41,6) dan di bawah Suhu standar. Normal bergaya −5,6 sampai +2,6 (batas ±13,9 = ⅓
//   selisih Jago − Normal); per meja Pemburu Normal di 4 pemain lewat (−8,1, batas ±5,3), Sabar Londo
//   3 pemain (−10,1) dan Ngurutin 4 pemain (−5,2) tepat di batas. Normal bernama persona di meja 4
//   pemain rata-rata sekitar −3,8 per putaran; di 2 pemain Sabar Londo −17,8 sampai Penahan +15,0.
// - Kepala ke kepala [gaya, suhu, suhu, suhu]: suhu:gaya − suhu −2,7 sampai +3,6 (4 pemain) dan −3,5
//   sampai +2,3 (4 pemain 2 deck); pembanding jago − suhu −6,9 dan −15,9. Pemburu −2,7 sedikit lewat
//   batas −2,3 (⅓ dari −6,9).
// - Keterbacaan di meja persona (--lawan=normal:acak), standar → gabungan gaya: Suhu L|iso 93,1 → 56,6%,
//   As|boleh 63,7 → 31,2%, entropi buangan awal 1,41 → 1,65 bit; Jago 89,9 → 47,5% dan 72,4 → 32,7%;
//   Normal 88,4 → 61,6% dan 82,4 → 50,0% (L|iso −30,3%, pas di batas 30%; lawan Normal standar −28,9%).
//   Itu buangan ke-1..3. Buangan ke-4..6 gabungan semua meja juga turun 31–49%, TAPI di meja 4 pemain
//   (1 deck) tahanTinggi sudah lewat (fase 0,45 ≈ 3 giliran), jadi di sana efeknya terutama penundaan:
//   L|iso4-6 turun 9–19% dan As|boleh4-6 7–26% (Suhu 85,0 → 77,0% dan 45,5 → 42,2%). Penahan Normal
//   malah membuang As lebih sering dari standar (As|boleh 82,4 → 93,3%).
// - Metrik khas (Suhu, standar → gaya): londoDini 6,8 → 1,2%, nyambung 7,0 → 14,1%, disuap 6,18 → 5,98%,
//   pentungan rata² 108 → 129 (laju mentung 0,87×), laju mulung Kilat 11,4 → 14,1%.
// - Tidak tercapai: deck habis Kilat tidak turun di level mana pun (standar sudah nutup di setiap
//   kesempatan); disuap Penahan Suhu turun tapi CI-nya bertumpang tipis (setelan yang lebih berat kalah
//   −14 per putaran dari Suhu standar di 4 pemain 2 deck); pentungan Pemburu Normal hanya +9,7 (bukan +15).
// - Lama mikir (40 seed, dua jalan): p99 paling besar 1,10× standar di level yang sama; maksimum satu
//   keputusan berisik dan lewat 1,5× untuk sebagian gaya Jago/Suhu (paling buruk 157 ms vs 75 ms).

import { AS, isAngka, isLondo, type Kartu } from '../kartu.js';
import { isJokerHidup, type KonteksJoker } from '../kartuJadi.js';
import { aturanPembagian } from '../mesin.js';
import { Rng, seedKeState } from '../rng.js';
import type { ViewPemain, ViewPutaran } from '../view.js';
import type { LevelBot } from './bot.js';
import { bacaIngatan } from './ingatan.js';
import type { ParamStrategi } from './strategi.js';
import { bungaTipe, TETANGGA, tipeKartu } from './susun.js';

/** Gaya main warga kedai. 'standar' = perilaku lama; 'berubah' = tiap putaran salah satu GAYA_TETAP. */
export type GayaBot = 'standar' | 'sabarLondo' | 'ngurutin' | 'pemburu' | 'penahan' | 'kilat' | 'berubah';

/** Gaya yang punya definisi sendiri (selain standar dan berubah). */
export type GayaTetap = Exclude<GayaBot, 'standar' | 'berubah'>;

/** Semua gaya, 'standar' di indeks 0. Dipakai validasi dan arena. */
export const DAFTAR_GAYA_BOT: readonly GayaBot[] = ['standar', 'sabarLondo', 'ngurutin', 'pemburu', 'penahan', 'kilat', 'berubah'];

/** Lima gaya yang punya definisi sendiri; 'berubah' memilih salah satunya tiap putaran. */
export const GAYA_TETAP: readonly GayaTetap[] = ['sabarLondo', 'ngurutin', 'pemburu', 'penahan', 'kilat'];

export function isGaya(x: unknown): x is GayaBot {
  return typeof x === 'string' && (DAFTAR_GAYA_BOT as readonly string[]).includes(x);
}

export interface DefinisiGaya {
  /** Rentang ± pengali kekuatan gaya per putaran: kali = 1 + mood·(2u − 1). */
  mood: number;
  /** Peluang per putaran gayanya libur (kali = 0: bias, ambang, dan ubahParam tidak berlaku). */
  peluangLibur: number;
  /** Calon yang nilainya paling jauh segini di bawah yang terbaik dipilih acak (pilihDekat). */
  toleransi: number;
  /** Pengali kekuatan gaya (kali) di level Normal; bawaan 1. Di arena, bias yang sama lebih merugikan Normal. */
  skalaNormal?: number;
  /** Sabar Londo: bias menahan Londo selama belum ada pemain lain yang membuang Londo di putaran ini. */
  tahanLondo?: number;
  /**
   * Menahan kartu tinggi di awal putaran (selama fase < `sampai`, bawaan 0,3); aktif di sebagian
   * putaran (`peluang`). `bobotAs` = bobot untuk As (bawaan `bobot`).
   */
  tahanTinggi?: { bobot: number; peluang: number; jenis: 'as' | 'asLondo'; sampai?: number; bobotAs?: number };
  /** Pemburu: bias menahan satu calon pentungan terbesar di tangan (As > Londo). */
  tahanPentungan?: number;
  /** Ngurutin: bias membuang kartu yang menyambung buangan teratas pemain sebelumnya (saat pesimis). */
  nyambung?: number;
  /** Penahan (Normal): bias menahan kartu yang dekat dengan kartu yang diketahui dipegang pemain berikutnya. */
  tahanBerikut?: number;
  /**
   * Penahan (Normal): bias menahan kartu angka per salinan tetangga sebunga (±1, ±2) yang belum terlihat
   * (bacaIngatan). Kartu yang tetangganya masih banyak lebih mungkin dipungut pemain berikutnya.
   */
  risikoNormal?: number;
  /** Ambang mulung Normal (bawaan 0: mulung bila skornya > 0). */
  ambangMulungNormal?: number;
  /** Peluang (× kali) menunda mentung berpentungan kecil demi pentungan lebih besar. Bawaan 0 = tidak pernah. */
  tundaMentung?: number;
  /** Menunda mentung hanya kalau semua lawan masih memegang paling sedikit segini kartu (bawaan 5). */
  tundaLawanMin?: number;
  /** Menunda mentung hanya kalau sisa giliran (deck ÷ pemain) paling sedikit segini (bawaan 3). */
  tundaSisaMin?: number;
  /** Ubahan parameter Jago/Suhu (berlaku kalau gayanya tidak libur). */
  ubahParam?: (base: ParamStrategi, level: 'jago' | 'suhu') => Partial<ParamStrategi>;
}

/**
 * Menahan As (bobot 16) dan Londo (bobot 10) selama 45% awal deck di sebagian putaran: sumber utama
 * "tidak terbaca" (Londo/As tidak lagi selalu dibuang di awal). Batas 45% tetap (tidak diacak), jadi di
 * meja 4 pemain 1 deck ini terutama menunda buangan As/Londo 1–3 giliran (lihat kepala berkas dan
 * docs/keputusan-pemilik.md #47, "Buangan ke-4..6"). Dengan bobot 10 untuk As juga, As
 * masih sering dibuang (As|boleh hanya turun ±25% di meja persona). Penahan tidak memakainya, karena
 * menahan kartu tinggi berarti membuang kartu angka yang gampang dipungut pemain berikutnya.
 */
const tahanAsLondo = (peluang: number): NonNullable<DefinisiGaya['tahanTinggi']> => ({
  bobot: 10,
  bobotAs: 16,
  peluang,
  jenis: 'asLondo',
  sampai: 0.45,
});

/**
 * Definisi tiap gaya, hasil penyetelan arena (C3, lihat angka di kepala berkas). standar dan berubah
 * tidak punya definisi sendiri.
 */
export const DEFINISI_GAYA: Readonly<Record<GayaBot, DefinisiGaya | null>> = {
  standar: null,
  sabarLondo: {
    mood: 0.3,
    peluangLibur: 0.1,
    toleransi: 1.5,
    tahanLondo: 14,
    tahanTinggi: tahanAsLondo(0.6),
  },
  ngurutin: {
    mood: 0.35,
    peluangLibur: 0.1,
    toleransi: 1.5,
    skalaNormal: 0.7,
    nyambung: 14,
    tahanTinggi: tahanAsLondo(0.65),
  },
  pemburu: {
    mood: 0.3,
    peluangLibur: 0.1,
    toleransi: 1,
    skalaNormal: 0.6,
    tahanPentungan: 20,
    tahanTinggi: tahanAsLondo(0.5),
    // Jago/Suhu: pentungan angka ditunda selama semua lawan masih ≥ 3 kartu dan sisa giliran ≥ 1,5.
    // Normal tidak pernah menunda (tundaMentung hanya di aksiKuat).
    tundaMentung: 1,
    tundaLawanMin: 3,
    tundaSisaMin: 1.5,
    ubahParam: (b) => ({ mentung: b.mentung * 1.4, korban: b.korban * 2 }),
  },
  penahan: {
    mood: 0.25,
    peluangLibur: 0.1,
    toleransi: 1,
    tahanBerikut: 6,
    risikoNormal: 2,
    // Suhu: bahaya dan suap bagi pemain berikutnya lebih berat, bagi pemain lain sedikit lebih ringan
    // (bobotBerikut 8 dan suap 5 menurunkan disuap lebih banyak, tapi kalah ±14 per putaran dari Suhu
    // standar di meja 4 pemain 2 deck). Jago (aslinya tidak menimbang bahaya): hanya bahaya bagi pemain
    // berikutnya, dan ikut mengingat peristiwa di view (ingatRiwayat) supaya tahu kartu yang dipungut
    // pemain berikutnya; tanpa itu peluangPasangan Jago hanya perkiraan kasar dan bahayanya nyaris nol.
    ubahParam: (_b, level) =>
      level === 'suhu'
        ? { bobotBerikut: 5, suap: 4, bobotLainnya: 0.7 }
        : { bahaya: 20, suap: 10, bobotBerikut: 1, bobotLainnya: 0, ingatRiwayat: true },
  },
  kilat: {
    mood: 0.25,
    peluangLibur: 0.1,
    toleransi: 1.5,
    skalaNormal: 0.5,
    ambangMulungNormal: -3,
    tahanTinggi: tahanAsLondo(0.7),
    // Mulung lebih rakus. Menurunkan kartu jadi lebih awal (turunTanganLawan) tidak dipakai: di arena itu
    // justru menurunkan laju mulung dan laju mentung Jago.
    ubahParam: (_b, level) => (level === 'suhu' ? { ambangMulung: 6, untungDeck: 0.5 } : { ambangMulung: -20 }),
  },
  berubah: null,
};

/** Konteks gaya untuk satu keputusan. Hanya dibangun dari ViewPemain. */
export interface KonteksGaya {
  /** Gaya yang berlaku putaran ini ('berubah' sudah diganti salah satu GAYA_TETAP). */
  gaya: GayaTetap;
  def: DefinisiGaya;
  /** Level jago/suhu. */
  kuat: boolean;
  rng: Rng;
  ctx: KonteksJoker;
  /** Pengali kekuatan gaya putaran ini; 0 = libur. */
  kali: number;
  /** Geseran batas gugup menurunkan kartu jadi (hanya Jago bergaya; selain itu 0). */
  jitterTurun: -1 | 0 | 1;
  /** tahanTinggi berlaku di putaran ini. */
  tahanTinggiAktif: boolean;
  saya: number;
  n: number;
  /** Pemain sebelum saya (yang buangannya saya ambil) dan sesudah saya, menurut arah putaran. */
  prev: number;
  next: number;
  /** Sudah ada pemain lain yang membuang Londo di putaran ini (terlihat di meja). */
  londoLawan: boolean;
  /** Buangan teratas milik pemain sebelumnya, hanya di tahap main sesudah ambil deck; selain itu null. */
  atasPrev: Kartu | null;
  /** 0 di awal putaran (deck penuh sesudah dibagi) sampai 1 (deck habis). */
  fase: number;
  /** Kartu paling sedikit di tangan lawan. */
  minLawan: number;
  /** Sisa deck ÷ jumlah pemain. */
  sisaGiliran: number;
  /** Merasa tidak bakal menang putaran ini (perkiraanPesimis); diisi di tempat yang memakainya. */
  pesimis: boolean;
  /** Penahan Normal: skor "dibutuhkan pemain berikutnya" per tipe kartu; null bila tidak dipakai. */
  dekatBerikut: number[] | null;
  /** Penahan Normal (risikoNormal): salinan per tipe yang belum terlihat; null bila tidak dipakai. */
  belum: Int8Array | null;
}

/** Kunci info publik putaran ini untuk kursi saya: berubah tiap putaran, sama sepanjang satu putaran. */
function kunciPutaran(view: ViewPemain, p: ViewPutaran): string {
  return `${view.saya}|${p.nomor}|${p.kartuDibuka.id}|${p.pengocok}|${view.skor.join(',')}`;
}

/** Gaya yang berlaku putaran ini. 'berubah' → salah satu GAYA_TETAP dari hash info publik putaran. */
export function gayaPutaran(view: ViewPemain, gaya: GayaTetap | 'berubah'): GayaTetap {
  if (gaya !== 'berubah') return gaya;
  const r = new Rng(seedKeState(`berubah|${kunciPutaran(view, view.putaran!)}`));
  return GAYA_TETAP[r.int(GAYA_TETAP.length)];
}

/** Empat angka [0, 1) per putaran dari hash info publik: mood, libur, tahanTinggi, jitter. Tidak memakai rng. */
export function moodPutaran(view: ViewPemain, gaya: GayaBot): [number, number, number, number] {
  const r = new Rng(seedKeState(`mood|${gaya}|${kunciPutaran(view, view.putaran!)}`));
  return [r.next(), r.next(), r.next(), r.next()];
}

/** `k` menyambung `atas`: sebunga dan selisih 1 (2–10), atau sama-sama Londo sebunga beda angka. Joker hidup tidak. */
export function menyambung(k: Kartu, atas: Kartu, ctx: KonteksJoker): boolean {
  if (isJokerHidup(k, ctx) || k.bunga !== atas.bunga || k.rank === atas.rank) return false;
  if (isAngka(k.rank) && isAngka(atas.rank)) return Math.abs(k.rank - atas.rank) === 1;
  return isLondo(k.rank) && isLondo(atas.rank);
}

/**
 * Sudah ada pemain lain yang membuang Londo di putaran ini, dari yang terlihat di meja: buangan
 * (beserta pemiliknya), peristiwa buang dan mulung putaran ini di view, dan kartu jadi yang dipungut
 * dari buangan pemain lain (`dari`). Londo buangan sendiri tidak dihitung.
 */
export function adaLondoLawan(view: ViewPemain): boolean {
  const p = view.putaran!;
  const saya = view.saya!;
  const londo = (k: Kartu) => isLondo(k.rank);
  if (p.buangan.some((e) => e.pemilik !== saya && londo(e.kartu))) return true;
  for (const e of view.peristiwa) {
    if (e.putaran !== p.nomor) continue;
    if (e.jenis === 'buang' && e.pemain !== saya && (londo(e.kartu) || (e.kartuLain ?? []).some(londo))) return true;
    if (e.jenis === 'mulung' && e.kartu.some((x) => x.pemilik !== saya && londo(x.kartu))) return true;
  }
  for (const kj of p.kartuJadi.flat()) {
    for (const d of kj.kartu) if (d.dari !== undefined && d.dari !== saya && londo(d.kartu)) return true;
  }
  return false;
}

/**
 * Merasa tidak bakal menang putaran ini: masih banyak kartu lepas, atau lawan sudah dekat mentung,
 * atau deck hampir habis. `sisaLepas`: Normal memakai jumlah kartu tangan (kartu jadinya sudah
 * diturunkan), Jago/Suhu memakai jumlah kartu sisa susunan terbaik.
 */
export function perkiraanPesimis(kg: Pick<KonteksGaya, 'minLawan' | 'sisaGiliran'>, sisaLepas: number): boolean {
  return sisaLepas >= 4 || (kg.minLawan <= 3 && sisaLepas >= 2) || (kg.sisaGiliran < 1.5 && sisaLepas >= 3);
}

/**
 * Penahan Normal: +2 untuk tiap tipe tetangga kartu yang diketahui dipegang pemain berikutnya (hasil
 * mungut yang belum dijadikan, dari bacaIngatan), −1 untuk tetangga sebunga kartu yang dibuangnya
 * sendiri di putaran ini (kartu yang dia lepas berarti tidak dia kejar).
 */
function hitungDekatBerikut(view: ViewPemain, p: ViewPutaran, next: number): number[] {
  const d: number[] = Array(52).fill(0);
  for (const k of bacaIngatan(view, true).diketahui[next]) for (const u of TETANGGA[tipeKartu(k)]) d[u] += 2;
  for (const e of view.peristiwa) {
    if (e.putaran !== p.nomor || e.jenis !== 'buang' || e.pemain !== next) continue;
    for (const k of [e.kartu, ...(e.kartuLain ?? [])]) {
      for (const u of TETANGGA[tipeKartu(k)]) if (bungaTipe(u) === k.bunga) d[u] -= 1;
    }
  }
  return d;
}

/**
 * Konteks gaya untuk satu keputusan, atau null untuk standar, gaya tak dikenal, level mudah, atau
 * view tanpa putaran. Hanya membaca ViewPemain dan tidak memakai rng (rng disimpan untuk pilihDekat).
 */
export function buatKonteksGaya(view: ViewPemain, level: LevelBot, gaya: GayaBot, rng: Rng): KonteksGaya | null {
  if (level === 'mudah' || gaya === 'standar' || !isGaya(gaya)) return null;
  const p = view.putaran;
  const saya = view.saya;
  if (!p || saya === null) return null;
  const nyata = gayaPutaran(view, gaya);
  const def = DEFINISI_GAYA[nyata]!;
  const kuat = level === 'jago' || level === 'suhu';
  const [uMood, uLibur, uTinggi, uJitter] = moodPutaran(view, nyata);
  const kali = (uLibur < def.peluangLibur ? 0 : 1 + def.mood * (2 * uMood - 1)) * (kuat ? 1 : (def.skalaNormal ?? 1));
  const n = view.konfigurasi.jumlahPemain;
  const prev = (((saya - p.arah) % n) + n) % n;
  const next = (((saya + p.arah) % n) + n) % n;
  const atas = p.buangan.at(-1);
  const atasPrev = p.tahap === 'main' && p.sumberAmbil === 'deck' && atas && atas.pemilik === prev ? atas.kartu : null;
  // Sisa deck sesudah kartu dibagi (kartu joker yang dibuka diselipkan kembali ke deck).
  const { jumlahDeck: setDeck, kartuPerPemain } = aturanPembagian(n, view.konfigurasi.duaDeckUntukEmpat);
  const deckAwal = setDeck * 52 - n * kartuPerPemain;
  const fase = Math.min(1, Math.max(0, 1 - p.jumlahDeck / deckAwal));
  let minLawan = Infinity;
  for (let j = 0; j < n; j++) if (j !== saya) minLawan = Math.min(minLawan, p.jumlahKartuTangan[j]);
  const kg: KonteksGaya = {
    gaya: nyata,
    def,
    kuat,
    rng,
    ctx: { rankJoker: p.rankJoker, jokerMati: p.jokerMati },
    kali,
    jitterTurun: level === 'jago' ? (uJitter < 1 / 3 ? -1 : uJitter < 2 / 3 ? 0 : 1) : 0,
    tahanTinggiAktif: !!def.tahanTinggi && uTinggi < def.tahanTinggi.peluang,
    saya,
    n,
    prev,
    next,
    londoLawan: adaLondoLawan(view),
    atasPrev,
    fase,
    minLawan,
    sisaGiliran: p.jumlahDeck / n,
    pesimis: false,
    dekatBerikut: null,
    belum: null,
  };
  // Normal (dan cadangan normal Jago/Suhu): kartu jadi sudah diturunkan, jadi kartu lepas = tangan.
  // Jago/Suhu mengisi ulang pesimis dari susunan terbaik di aksiKuat.
  if (def.nyambung && kali > 0 && n >= 3 && atasPrev) kg.pesimis = perkiraanPesimis(kg, p.tangan[saya]!.length);
  if (def.tahanBerikut && kali > 0 && !kuat && p.tahap === 'main') kg.dekatBerikut = hitungDekatBerikut(view, p, next);
  if (def.risikoNormal && !kuat && kali > 0 && p.tahap === 'main') kg.belum = bacaIngatan(view, true).belum;
  return kg;
}

/**
 * Parameter Jago/Suhu dengan gaya. Tanpa gaya: objek yang SAMA (bukan salinan). Ubahan gaya hanya
 * kalau gayanya tidak libur; Jago bergaya (selain kilat) menggeser turunTanganLawan −1/0/+1.
 */
export function paramDenganGaya(base: ParamStrategi, level: LevelBot, kg: KonteksGaya | null): ParamStrategi {
  if (!kg || (level !== 'jago' && level !== 'suhu')) return base;
  let par = base;
  if (kg.kali > 0 && kg.def.ubahParam) par = { ...par, ...kg.def.ubahParam(base, level) };
  if (level === 'jago' && kg.gaya !== 'kilat' && kg.jitterTurun !== 0) {
    par = { ...par, turunTanganLawan: par.turunTanganLawan + kg.jitterTurun };
  }
  return par;
}

/**
 * Calon pentungan terbesar yang ditahan Pemburu: tipe As pertama di tangan, kalau tidak ada Londo
 * pertama; −1 bila tidak ada, bila ada joker hidup (calon terbesar, sudah ditahan strategi dasar), atau
 * bila tipe itu ada dua salinan (membuang satu masih menyisakan calon).
 */
function calonPentungan(tangan: readonly Kartu[], ctx: KonteksJoker): number {
  let as = -1;
  let londo = -1;
  for (const k of tangan) {
    if (isJokerHidup(k, ctx)) return -1;
    if (k.rank === AS && as < 0) as = tipeKartu(k);
    else if (isLondo(k.rank) && londo < 0) londo = tipeKartu(k);
  }
  const t = as >= 0 ? as : londo;
  if (t < 0) return -1;
  let salinan = 0;
  for (const k of tangan) if (tipeKartu(k) === t) salinan++;
  return salinan === 1 ? t : -1;
}

/**
 * Bias gaya untuk membuang kartu `k` dari `tangan` (positif = lebih condong dibuang). Ditambahkan ke
 * nilai buang calon yang sah saja; 0 kalau gayanya libur. Lunak: tidak pernah melarang buangan.
 */
export function biasBuang(kg: KonteksGaya, k: Kartu, tangan: readonly Kartu[]): number {
  const { def, kali } = kg;
  if (kali === 0 || isJokerHidup(k, kg.ctx)) return 0;
  let b = 0;
  // Sabar Londo: tahan Londo sampai ada pemain lain yang membuang Londo; dilonggarkan menjelang deck habis.
  if (def.tahanLondo && isLondo(k.rank) && !kg.londoLawan) b -= def.tahanLondo * kali * (kg.fase > 0.85 ? 0.5 : 1);
  // Tahan kartu tinggi di awal putaran.
  const tinggi = def.tahanTinggi;
  if (
    tinggi &&
    kg.tahanTinggiAktif &&
    kg.fase < (tinggi.sampai ?? 0.3) &&
    (k.rank === AS || (tinggi.jenis === 'asLondo' && isLondo(k.rank)))
  ) {
    b -= (k.rank === AS ? (tinggi.bobotAs ?? tinggi.bobot) : tinggi.bobot) * kali;
  }
  // Pemburu: simpan satu calon pentungan besar.
  if (def.tahanPentungan && tangan.length >= 3 && tipeKartu(k) === calonPentungan(tangan, kg.ctx)) b -= def.tahanPentungan * kali;
  // Ngurutin: kalau merasa tidak bakal menang, sambung buangan pemain sebelumnya.
  if (def.nyambung && kg.n >= 3 && kg.pesimis && kg.atasPrev && menyambung(k, kg.atasPrev, kg.ctx)) b += def.nyambung * kali;
  // Penahan (Normal): jangan suapi pemain berikutnya.
  if (def.tahanBerikut && kg.dekatBerikut) b -= def.tahanBerikut * kali * Math.max(0, kg.dekatBerikut[tipeKartu(k)]);
  // Penahan (Normal): kartu angka yang tetangga sebunganya masih banyak belum terlihat.
  if (def.risikoNormal && kg.belum && isAngka(k.rank)) {
    let r = 0;
    for (const d of [-2, -1, 1, 2]) {
      const q = k.rank + d;
      if (q >= 2 && q <= 10) r += kg.belum[tipeKartu({ bunga: k.bunga, rank: q as Kartu['rank'] })];
    }
    b -= def.risikoNormal * kali * r;
  }
  return b;
}

/**
 * Pilih satu calon: yang skornya paling jauh `toleransi` di bawah yang terbaik dianggap seri dan
 * dipilih acak lewat rng. rng hanya dipakai kalau memang ada lebih dari satu calon yang seri; kalau
 * tidak, hasilnya calon terbaik pertama (sama dengan urutan stabil).
 */
export function pilihDekat<T>(calon: readonly { isi: T; skor: number }[], kg: Pick<KonteksGaya, 'def' | 'rng'>): T {
  if (calon.length === 0) throw new Error('pilihDekat: tidak ada calon');
  let iMaks = 0;
  for (let i = 1; i < calon.length; i++) if (calon[i].skor > calon[iMaks].skor) iMaks = i;
  const batas = calon[iMaks].skor - kg.def.toleransi;
  const dekat = calon.filter((c) => c.skor >= batas);
  if (dekat.length <= 1) return calon[iMaks].isi;
  return dekat[kg.rng.int(dekat.length)].isi;
}

/**
 * Boleh menunda mentung: pentungannya satu kartu angka biasa, semua lawan masih ≥ `tundaLawanMin` (5)
 * kartu, sisa giliran ≥ `tundaSisaMin` (3), tangan masih memegang As/Londo/joker hidup (calon pentungan
 * lebih besar), dan bukan putaran kaldu.
 */
export function bolehTundaMentung(kg: KonteksGaya, p: ViewPutaran, pentungan: readonly Kartu[], tangan: readonly Kartu[]): boolean {
  if (pentungan.length !== 1 || p.kaldu) return false;
  const k = pentungan[0];
  if (isJokerHidup(k, kg.ctx) || !isAngka(k.rank)) return false;
  const lawanMin = kg.def.tundaLawanMin ?? 5;
  for (let j = 0; j < kg.n; j++) if (j !== kg.saya && p.jumlahKartuTangan[j] < lawanMin) return false;
  if (kg.sisaGiliran < (kg.def.tundaSisaMin ?? 3)) return false;
  return tangan.some((x) => x.rank === AS || isLondo(x.rank) || isJokerHidup(x, kg.ctx));
}

/** Tunda mentung kali ini? rng hanya dipakai kalau peluangnya > 0 dan syarat bolehTundaMentung terpenuhi. */
export function tundaMentung(kg: KonteksGaya, p: ViewPutaran, pentungan: readonly Kartu[], tangan: readonly Kartu[]): boolean {
  const peluang = (kg.def.tundaMentung ?? 0) * kg.kali;
  if (peluang <= 0 || !bolehTundaMentung(kg, p, pentungan, tangan)) return false;
  return kg.rng.next() < peluang;
}
