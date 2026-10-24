// Efek suara dan getar HP: satu pintu untuk seluruh aplikasi.
// Semua bunyi disintesis Web Audio (tanpa file audio, aman offline). Karakternya "kartu fisik di meja kayu
// kedai": gesekan dan ketukan kertas dari derau tersaring, isyarat bernada dari bilah ala gamelan dan
// kendang yang dilunakkan, semuanya di tangga nada D mayor pentatonik supaya selaras dengan musik latar.
// Momen dramatis (pentungan dibuka, kepentung, joker dibuang) boleh lebih gelap: D minor dan tritonus,
// dentum rendah, kecrek wayang, tiupan rendah ala kuningan, dan gema aula yang panjang. Selama bunyi
// besar itu musik latar diredam sebentar (redamMusik).
//
// PAGAR INFO RAHASIA (keputusan pemilik): bunyi dan getar hanya boleh dipicu peristiwa publik atau aksi
// pemain sendiri. Tidak ada bunyi/getar yang membedakan joker di tangan, dan tidak ada peringatan
// "kartu berbahaya". Bunyi joker hanya untuk joker yang terlihat semua orang:
// - 'jokerDibuang': joker dibuang ke meja (peristiwa publik), bukan joker yang masuk tangan.
// - 'mentungJoker': baru diputar saat pentungan SUDAH terbuka di meja. 'tegang' sebelum dibuka selalu
//   sama untuk pentungan apa pun, jadi tidak membocorkan isinya.
// - 'kepentung' hanya untuk pemain yang kena; 'kepentungLain' (pelan) untuk yang lain. Siapa yang
//   kepentung memang ditampilkan ke semua orang di panel mentung.
// - 'jotos' (pukulan + kaca retak) hanya untuk pemain yang kena, 'jotosLain' (pelan) per kursi lain yang
//   kena. Keduanya baru diputar SESUDAH pentungan terbuka (efek/pemutar.ts), saat siapa yang kena
//   sudah publik.

import { gerakDikurangi, preferensi } from '../preferensi';
import { bangunRantai, bisaBersuara, keluaranEfek, mesinAudio, pasangMesinAudio, type Rantai } from './mesinAudio';
import { pasangMusik, redamMusik } from './musik';
import {
  acak,
  bilah,
  buatAula,
  dentum,
  desir,
  dung,
  gemeretak,
  gesek,
  gong,
  hz,
  kecrek,
  ketuk,
  nada,
  rentetDerau,
  rentetNada,
  tak,
  tiup,
  type Keluaran,
} from './sintesis';

export { suasanaMusik, type AdeganMusik } from './musik';
export { diagnostikAudio } from './mesinAudio';

export type JenisBunyi =
  // Kartu fisik
  | 'kartu' // ambil kartu dari deck
  | 'kocok' // mengocok (riffle) ~0,6 detik
  | 'bagi' // satu kartu dibagikan, meluncur pendek
  | 'balik' // kartu dibalik
  | 'angkat' // kartu terangkat dari tangan (sangat halus)
  | 'letak' // kartu diletakkan di meja
  | 'geser' // geser/susun ulang kartu di tangan
  | 'buang' // kartu dibuang ke buangan
  | 'mulung' // mungut dari buangan
  // Isyarat permainan
  | 'giliran'
  | 'sorak'
  | 'mentung' // pentungan dibuka
  | 'mentungJoker' // pentungan yang dibuka ternyata joker (250): versi paling besar
  | 'kepentung' // kamu kepentung
  | 'kepentungLain' // orang lain kepentung, kamu aman (pelan)
  | 'jotos' // kamu kepentung, sesaat sesudah pentungan terbuka: bogem berat + kaca retak + serpih kaca
  | 'jotosLain' // kursi lain kena (retakan kecil di panelnya): "buk" teredam + retak kecil
  | 'bahaya' // kejadian publik yang perlu diwaspadai (kartumu dipungut, lawan tinggal 1 kartu)
  | 'jokerDibuang' // joker dibuang ke meja (publik, lihat pagar di atas)
  | 'tegang' // gebukan kendang makin rapat sebelum pentungan dibuka, dipotong saat dibuka
  | 'detak' // detak jantung pelan
  | 'menang'
  | 'kalah'
  // Antarmuka
  | 'pop' // gelembung emote
  | 'klik' // tombol
  | 'tolak' // aksi tidak sah: lembut, bukan buzzer
  | 'notifikasi';

export interface OpsiBunyi {
  /**
   * Urutan dalam satu rangkaian (0, 1, 2, ...): nada naik sedikit per langkah (maks 12),
   * mis. kartu yang dibagikan beruntun atau kartu jadi yang diturunkan satu per satu.
   */
  urutan?: number;
}

/** Variasi acak kecil per putar supaya bunyi yang sering diulang tidak terasa seperti mesin. */
interface Variasi {
  /** Pengali frekuensi untuk bunyi derau (gesekan/ketukan). */
  p: number;
  /** Pengali frekuensi untuk bunyi bernada (lebih kecil supaya tetap selaras). */
  pn: number;
  /** Pengali volume. */
  v: number;
}

/** Resep bunyi: menjadwalkan node mulai waktu t, mengembalikan perkiraan durasi (detik). */
type Resep = (k: Keluaran, t: number, x: Variasi) => number;

// Nada (MIDI) di D mayor pentatonik.
const D4 = 62, E4 = 64, Fs4 = 66, A4 = 69, B4 = 71, D5 = 74, Fs5 = 78, A5 = 81, B5 = 83, D6 = 86;
const A3 = 57, B3 = 59, G3 = 55, D3 = 50, D2 = 38;
// Nada gelap untuk momen dramatis: F (D minor) dan G# (tritonus dari D).
const F3 = 53, Gs3 = 56, F4 = 65, Gs5 = 80;

const RESEP: Record<JenisBunyi, Resep> = {
  kartu: (k, t, { p, v }) => {
    gesek(k, t, 0.075, { frek: 2500 * p, frekAkhir: 3300 * p, q: 1.1, puncak: 0.5 * v });
    ketuk(k, t + 0.06, { puncak: 0.2 * v, badan: 210 * p, terang: 3000 * p });
    return 0.15;
  },
  bagi: (k, t, { p, v }) => {
    gesek(k, t, 0.05, { frek: 3000 * p, frekAkhir: 3800 * p, q: 1.3, puncak: 0.38 * v });
    ketuk(k, t + 0.042, { puncak: 0.15 * v, badan: 230 * p, terang: 3400 * p });
    return 0.12;
  },
  kocok: (k, t, { p, v }) => {
    // Riffle: dua belahan deck saling menyisip, puluhan klik kertas yang rapat lalu merenggang.
    const n = 30;
    const waktu = Array.from({ length: n }, (_, i) => t + 0.42 * (i / n) ** 0.92 + acak(-0.002, 0.002)).sort((x, y) => x - y);
    gemeretak(k, waktu, {
      frekMin: 2200 * p,
      frekMaks: 5200 * p,
      puncak: (i) => 0.32 * v * Math.sin((Math.PI * (i + 0.5)) / n) ** 0.6 * acak(0.6, 1),
    });
    // Kartu menyatu ("bridge") lalu dirapikan dengan diketuk ke meja.
    gesek(k, t + 0.43, 0.11, { frek: 1900 * p, frekAkhir: 1200 * p, q: 0.8, puncak: 0.12 * v, serang: 0.02 });
    ketuk(k, t + 0.56, { puncak: 0.2 * v, badan: 160 * p, terang: 1800 * p });
    return 0.66;
  },
  balik: (k, t, { p, v }) => {
    gesek(k, t, 0.06, { frek: 1400 * p, frekAkhir: 4200 * p, q: 1.4, puncak: 0.42 * v, serang: 0.014 });
    ketuk(k, t + 0.052, { puncak: 0.14 * v, badan: 250 * p, terang: 3600 * p });
    return 0.13;
  },
  angkat: (k, t, { p, v }) => {
    gesek(k, t, 0.035, { frek: 3800 * p, frekAkhir: 4600 * p, q: 1.5, puncak: 0.17 * v, serang: 0.008 });
    return 0.05;
  },
  letak: (k, t, { p, v }) => {
    ketuk(k, t, { puncak: 0.45 * v, badan: 160 * p, terang: 2000 * p });
    gesek(k, t, 0.03, { frek: 1400 * p, q: 1, puncak: 0.13 * v, serang: 0.002 });
    return 0.1;
  },
  geser: (k, t, { p, v }) => {
    gesek(k, t, 0.09, { frek: 2000 * p, frekAkhir: 1700 * p, q: 0.9, puncak: 0.29 * v, serang: 0.02 });
    return 0.1;
  },
  buang: (k, t, { p, v }) => {
    gesek(k, t, 0.09, { frek: 2800 * p, frekAkhir: 1700 * p, q: 1, puncak: 0.26 * v, serang: 0.006 });
    ketuk(k, t + 0.08, { puncak: 0.3 * v, badan: 150 * p, terang: 1900 * p });
    return 0.2;
  },
  mulung: (k, t, { p, pn, v }) => {
    // Kartu dikumpulkan dari buangan, lalu dua nada naik yang riang.
    const waktu = [0, 0.03, 0.055, 0.085, 0.11, 0.14].map((d) => t + d + acak(0, 0.006));
    gemeretak(k, waktu, { frekMin: 2000 * p, frekMaks: 4200 * p, puncak: () => 0.22 * v * acak(0.7, 1) });
    gesek(k, t, 0.16, { frek: 2200 * p, frekAkhir: 3600 * p, q: 0.9, puncak: 0.22 * v, serang: 0.03 });
    bilah(k, t + 0.12, hz(A4) * pn, 0.35, 0.19 * v);
    bilah(k, t + 0.21, hz(D5) * pn, 0.5, 0.19 * v);
    return 0.75;
  },
  giliran: (k, t, { pn, v }) => {
    bilah(k, t, hz(A4) * pn, 0.5, 0.19 * v);
    bilah(k, t + 0.13, hz(D5) * pn, 0.75, 0.19 * v);
    return 0.9;
  },
  sorak: (k, t, { pn, v }) => {
    tak(k, t, 0.22 * v);
    tak(k, t + 0.09, 0.17 * v);
    dung(k, t + 0.18, 0.28 * v);
    [D5, Fs5, A5, D6].forEach((m, i) => bilah(k, t + i * 0.07, hz(m) * pn, 0.45, 0.1 * v));
    return 0.85;
  },
  mentung: (k, t, { pn, v }) => {
    // Pentungan dibuka: dentum besar + kecrek, gong ageng, akord bilah terbuka, dan tiupan rendah yang megah.
    dentum(k, t, 0.34 * v, { frek: 100 });
    kecrek(k, t, 0.16 * v, 0.25);
    tak(k, t, 0.13 * v);
    gong(k, t + 0.01, hz(D2) * pn, 2.6, 0.18 * v);
    gong(k, t + 0.01, hz(D3) * pn, 1.8, 0.08 * v);
    [D5, Fs5, A5].forEach((m, i) => bilah(k, t + 0.04 + i * 0.03, hz(m) * pn, 1.1, 0.075 * v, 0.5));
    [D3, A3].forEach((m) => tiup(k, t + 0.02, hz(m) * pn, 1.4, { puncak: 0.028 * v, serang: 0.06, terang: 6, gema: 0.4 }));
    return 2.6;
  },
  mentungJoker: (k, t, { pn, v }) => {
    // Pentung joker (250): "dung-dung-DUAAANG", lalu akord D minor yang membengkak dan bilah tinggi
    // bergantian cepat (D dan G#, tritonus) yang memudar. Bunyi paling besar di permainan.
    [0, 0.2].forEach((d) => {
      dentum(k, t + d, 0.26 * v, { frek: 95, panjang: 0.35 });
      kecrek(k, t + d, 0.12 * v);
      tiup(k, t + d, hz(D3) * pn, 0.22, { puncak: 0.035 * v, serang: 0.01, terang: 7 });
    });
    const t3 = t + 0.42;
    dentum(k, t3, 0.4 * v, { frek: 90, panjang: 1.2 });
    kecrek(k, t3, 0.19 * v, 0.3);
    gong(k, t3, hz(D2) * pn, 2.6, 0.24 * v);
    [D3, A3, D4, F4].forEach((m) => tiup(k, t3, hz(m) * pn, 1.8, { puncak: 0.03 * v, serang: 0.25, terang: 6, gema: 0.45 }));
    // Imbal: dua bilah (D6 dan G#5) dipukul bergantian, masing-masing satu osilator + parsial logamnya
    // (bukan 8 bilah utuh), supaya momen paling ramai ini tetap ringan dijadwalkan.
    for (const [nada0, mulai] of [[D6, 0.05], [Gs5, 0.14]] as const) {
      const waktu = [0, 1, 2, 3].map((i) => t3 + mulai + i * 0.18);
      const keras = (i: number) => 0.075 * v * (1 - (i * 2 + (mulai > 0.1 ? 1 : 0)) / 10);
      rentetNada(k, waktu, { frek: hz(nada0) * pn, luruh: 0.28, puncak: keras, gema: 0.5 });
      rentetNada(k, waktu, { frek: hz(nada0) * pn * 2.76, luruh: 0.1, puncak: (i) => keras(i) * 0.22, gema: 0.25 });
    }
    return 3.1;
  },
  kepentung: (k, t, { pn, v }) => {
    // "DUAAR, kena!": hentakan berat, lalu motif D minor yang turun pelan di atas gong dan tiupan rendah.
    // Dramatis dan sendu, tidak mengejek.
    dentum(k, t, 0.42 * v, { frek: 85, panjang: 1.0 });
    kecrek(k, t, 0.18 * v, 0.22);
    tak(k, t, 0.2 * v);
    [D3, Gs3].forEach((m) => tiup(k, t, hz(m) * pn, 0.5, { puncak: 0.035 * v, serang: 0.02, terang: 7, geserKe: hz(m - 1) * pn }));
    [D5, A4, F4].forEach((m, i) => bilah(k, t + 0.32 + i * 0.17, hz(m) * pn, 0.6, 0.15 * v, 0.45));
    const akhir = t + 0.83;
    bilah(k, akhir, hz(D4) * pn, 1.3, 0.17 * v, 0.5);
    nada(k, akhir, hz(D4) * pn, 1.2, { tipe: 'triangle', puncak: 0.05 * v, geserKe: hz(D4 - 0.6) * pn, lowpass: 1200, serang: 0.03 });
    dung(k, akhir, 0.28 * v, 80);
    gong(k, akhir, hz(D2) * pn, 1.8, 0.18 * v);
    [D3, F3, A3].forEach((m) => tiup(k, akhir, hz(m) * pn, 1.3, { puncak: 0.025 * v, serang: 0.15, terang: 4, gema: 0.4 }));
    return 2.3;
  },
  jotos: (k, t, { p, pn, v }) => {
    // "Ketonjok": bogem berat di dada (sub rendah + badan pukulan), "KRAK" kaca retak yang menjalar,
    // lalu serpih kaca bergemerincing jatuh. Gong rendah di belakang supaya terasa berat, bukan lucu.
    dentum(k, t, 0.62 * v, { frek: 68, panjang: 0.9 });
    nada(k, t, 190 * p, 0.09, { tipe: 'triangle', puncak: 0.32 * v, serang: 0.0015, geserKe: 70 * p, lowpass: 1100 });
    gesek(k, t, 0.025, { frek: 1100 * p, q: 0.7, puncak: 0.48 * v, serang: 0.0008 });
    // Krak: klik-klik derau yang mula-mula rapat lalu merenggang (retakan menjalar), plus satu sapuan lebar.
    const krak = Array.from({ length: 16 }, (_, i) => t + 0.008 + 0.17 * (i / 16) ** 1.7 + i * 0.0015);
    gemeretak(k, krak, { frekMin: 1700 * p, frekMaks: 6800 * p, puncak: (i) => 0.52 * v * (1 - i / 18) * acak(0.55, 1) });
    gesek(k, t + 0.005, 0.2, { frek: 4200 * p, frekAkhir: 1300 * p, q: 0.6, puncak: 0.25 * v, serang: 0.002 });
    // Serpih kaca: tiga rentetan denting tinggi tak-harmonis yang bertaburan (satu osilator per rentetan),
    // ditemani desis pecahan yang halus.
    for (let jalur = 0; jalur < 3; jalur++) {
      const waktu: number[] = [];
      for (let d = 0.07 + jalur * 0.017, i = 0; i < 5; i++, d += acak(0.045, 0.12) * (1 + i * 0.3)) waktu.push(t + d);
      rentetNada(k, waktu, { frek: () => acak(2900, 7600) * pn, luruh: 0.12, puncak: (i) => 0.09 * v * (1 - i / 7), gema: 0.55 });
    }
    const desis: number[] = [];
    for (let d = 0.06, i = 0; i < 9; i++, d += acak(0.03, 0.07)) desis.push(t + d);
    rentetDerau(k, desis, { frek: 7200, q: 1.4, luruh: 0.035, puncak: (i) => 0.11 * v * (1 - i / 10) });
    gong(k, t + 0.015, hz(D2) * pn, 1.5, 0.16 * v);
    return 1.6;
  },
  jotosLain: (k, t, { p, v }) => {
    // Kursi lain kena: "buk" teredam dari seberang meja dan retakan kecil. Pelan saja.
    dung(k, t, 0.32 * v, 72);
    gesek(k, t, 0.02, { frek: 900 * p, q: 0.7, puncak: 0.18 * v, serang: 0.001 });
    const krak = [0, 0.014, 0.032, 0.055, 0.085].map((d) => t + 0.006 + d);
    gemeretak(k, krak, { frekMin: 2200 * p, frekMaks: 5200 * p, puncak: (i) => 0.2 * v * (1 - i / 6) });
    return 0.45;
  },
  kepentungLain: (k, t, { pn, v }) => {
    // Orang lain kepentung, kamu aman: dentum jauh yang teredam dan dua bilah turun. Pelan saja.
    dung(k, t, 0.16 * v, 85);
    kecrek(k, t, 0.05 * v);
    bilah(k, t + 0.12, hz(A4) * pn, 0.5, 0.07 * v, 0.4);
    bilah(k, t + 0.28, hz(D4) * pn, 0.8, 0.08 * v, 0.45);
    return 1.0;
  },
  bahaya: (k, t, { pn, v }) => {
    bilah(k, t, hz(B5) * pn, 0.26, 0.15 * v, 0.2);
    bilah(k, t + 0.16, hz(B5) * pn, 0.32, 0.15 * v, 0.2);
    return 0.5;
  },
  jokerDibuang: (k, t, { pn, v }) => {
    // "JOKER DIBUANG?!": desir pendek, hentakan pas sorakan mendarat (~0,16 dtk), bilah sumbang (tritonus),
    // luncuran turun "waduh", lalu dua nada rendah yang menggantung.
    desir(k, t, 0.15, { frek: 500, frekAkhir: 3800, puncak: 0.1 * v, lepas: 0.03 });
    const h = t + 0.16;
    dentum(k, h, 0.3 * v, { frek: 120, panjang: 0.6 });
    kecrek(k, h, 0.16 * v, 0.2);
    tak(k, h, 0.18 * v);
    [D5, Gs5].forEach((m) => bilah(k, h, hz(m) * pn, 0.7, 0.1 * v, 0.5));
    nada(k, h + 0.04, 880 * pn, 0.5, { tipe: 'triangle', puncak: 0.16 * v, geserKe: 200 * pn, lowpass: 2600, gema: 0.35 });
    tiup(k, h + 0.04, 440 * pn, 0.5, { puncak: 0.03 * v, serang: 0.02, terang: 4, geserKe: 110 * pn });
    dung(k, h + 0.5, 0.2 * v, 95);
    bilah(k, h + 0.5, hz(F4) * pn, 0.45, 0.1 * v, 0.4);
    bilah(k, h + 0.68, hz(E4) * pn, 0.8, 0.11 * v, 0.45);
    return 1.45;
  },
  tegang: (k, t, { pn, v }) => {
    // Gebukan kendang yang makin rapat dan makin keras sampai pentungan dibuka (bunyi ini dipotong
    // mendadak oleh 'mentung'/'mentungJoker'), ditemani kecrek wayang, desir yang membengkak, dan dengung
    // rendah yang sumbang (D + G#). Naiknya cepat di awal lalu melandai, supaya terasa memuncak di semua
    // kecepatan animasi (buka ~0,4 dtk saat gerak dikurangi, ~1,1 cepat, ~1,8 normal, ~2,3 santai).
    // Kalau tidak dipotong, memudar sendiri di ~2,6 detik.
    const panjang = 2.5;
    const waktu: number[] = [];
    for (let d = 0.04, jarak = 0.15; d < panjang; d += jarak, jarak = Math.max(0.045, jarak * 0.93)) waktu.push(t + d);
    const naik = (ti: number) => 1 - Math.exp(-(ti - t) / 1.1);
    // Pukulan pertama sedikit lebih keras: kartu pentungan dilempar ke meja.
    dung(k, t + 0.04, 0.14 * v, 100);
    // Gulungan dijadwalkan dengan satu sumber per lapisan (bukan satu per pukulan): puluhan pukulan
    // tidak membuat ratusan node sekaligus tepat saat animasi pentungan dimulai.
    const keras = (i: number) => naik(waktu[i]);
    rentetDerau(k, waktu, { frek: 1700, q: 2.2, luruh: 0.05, puncak: (i) => (0.045 + 0.25 * keras(i)) * v });
    rentetNada(k, waktu, { frek: 340, frekAkhir: 260, tipe: 'triangle', luruh: 0.05, puncak: (i) => (0.02 + 0.11 * keras(i)) * v });
    // Aksen dung makin sering menjelang dibuka (tiap 4 pukulan, lalu tiap 2).
    const aksen = waktu.filter((ti, i) => i > 0 && i % (naik(ti) < 0.6 ? 4 : 2) === 0);
    rentetNada(k, aksen, { frek: 118, frekAkhir: 74, luruh: 0.3, puncak: (i) => (0.07 + 0.2 * naik(aksen[i])) * v });
    rentetNada(k, aksen, { frek: 236, frekAkhir: 150, tipe: 'triangle', luruh: 0.12, puncak: (i) => (0.02 + 0.06 * naik(aksen[i])) * v });
    const crek = waktu.filter((_, i) => i % 2 === 1);
    rentetDerau(k, crek, { frek: 5200, q: 0.6, luruh: 0.07, puncak: (i) => (0.02 + 0.13 * naik(crek[i])) * v });
    desir(k, t + 0.3, panjang - 0.3, { frek: 350, frekAkhir: 3200, puncak: 0.12 * v, q: 0.8, lepas: 0.12 });
    tiup(k, t + 0.1, hz(D3) * pn, panjang, { puncak: 0.045 * v, serang: 1.6, terang: 3 });
    tiup(k, t + 0.1, hz(Gs3) * pn, panjang, { puncak: 0.032 * v, serang: 1.8, terang: 3 });
    return panjang + 0.15;
  },
  detak: (k, t, { v }) => {
    // Dua denyut rendah; harmoniknya supaya tetap terasa di speaker HP.
    nada(k, t, 64, 0.14, { puncak: 0.24 * v, serang: 0.006, geserKe: 48 });
    nada(k, t, 128, 0.1, { tipe: 'triangle', puncak: 0.14 * v, serang: 0.006, geserKe: 100, lowpass: 400 });
    nada(k, t + 0.2, 58, 0.15, { puncak: 0.18 * v, serang: 0.006, geserKe: 44 });
    nada(k, t + 0.2, 116, 0.1, { tipe: 'triangle', puncak: 0.1 * v, serang: 0.006, geserKe: 92, lowpass: 400 });
    return 0.4;
  },
  menang: (k, t, { pn, v }) => {
    tak(k, t, 0.18 * v);
    tak(k, t + 0.1, 0.16 * v);
    dung(k, t + 0.2, 0.28 * v);
    [D5, Fs5, A5].forEach((m, i) => bilah(k, t + 0.2 + i * 0.1, hz(m) * pn, 0.5, 0.11 * v));
    bilah(k, t + 0.55, hz(D6) * pn, 1.1, 0.12 * v, 0.45);
    // Akord hangat di belakang (D mayor), masuk pelan.
    [D4, Fs4, A4].forEach((m) => nada(k, t + 0.55, hz(m) * pn, 1.3, { tipe: 'triangle', puncak: 0.05 * v, serang: 0.08, lowpass: 1400, gema: 0.3 }));
    gong(k, t + 0.55, hz(D3) * pn, 1.6, 0.12 * v);
    return 2.2;
  },
  kalah: (k, t, { pn, v }) => {
    // Motif turun pelan di atas akord Bm: sendu, singkat, tidak mengejek.
    [B4, A4, Fs4, E4].forEach((m, i) => bilah(k, t + i * 0.24, hz(m) * pn, 0.6, 0.14 * v, 0.4));
    bilah(k, t + 0.96, hz(D4) * pn, 1.1, 0.15 * v, 0.45);
    [B3, D4, Fs4].forEach((m) => nada(k, t, hz(m) * pn, 1.5, { tipe: 'triangle', puncak: 0.035 * v, serang: 0.25, lowpass: 1000 }));
    nada(k, t + 0.96, hz(G3) * pn, 1.0, { tipe: 'triangle', puncak: 0.05 * v, serang: 0.1, lowpass: 700 });
    return 2.1;
  },
  pop: (k, t, { p, v }) => {
    nada(k, t, 520 * p, 0.08, { puncak: 0.23 * v, serang: 0.003, geserKe: 900 * p });
    return 0.1;
  },
  klik: (k, t, { p, v }) => {
    gesek(k, t, 0.008, { frek: 4500 * p, q: 3, puncak: 0.45 * v, serang: 0.0008 });
    nada(k, t, 1900 * p, 0.02, { puncak: 0.06 * v, serang: 0.001 });
    return 0.03;
  },
  tolak: (k, t, { pn, v }) => {
    // "Eh-eh" yang teredam: dua ketukan rendah turun, bukan dengung buzzer.
    nada(k, t, hz(A3) * pn, 0.09, { tipe: 'triangle', puncak: 0.2 * v, serang: 0.004, lowpass: 800 });
    nada(k, t + 0.11, hz(G3) * pn, 0.12, { tipe: 'triangle', puncak: 0.17 * v, serang: 0.004, lowpass: 700 });
    return 0.25;
  },
  notifikasi: (k, t, { pn, v }) => {
    bilah(k, t, hz(D5) * pn, 0.4, 0.14 * v);
    bilah(k, t + 0.09, hz(A5) * pn, 0.5, 0.11 * v);
    return 0.6;
  },
};

/** Jarak minimal (ms) antar bunyi sejenis; yang lebih rapat dibuang, bukan ditunda. */
const JEDA_MIN: Partial<Record<JenisBunyi, number>> = {
  kartu: 35,
  bagi: 30,
  letak: 30,
  angkat: 40,
  geser: 50,
  balik: 40,
  klik: 40,
  pop: 60,
  giliran: 300,
  detak: 500,
  kocok: 500,
  tegang: 500,
  mentung: 800,
  mentungJoker: 800,
  kepentung: 800,
  kepentungLain: 800,
  jotos: 800,
  jotosLain: 60,
  jokerDibuang: 600,
  menang: 1000,
  kalah: 1000,
};
const JEDA_BAWAAN = 70;

/** Maksimal bunyi yang boleh tumpang tindih; bunyi penting tetap lolos. */
const MAKS_POLIFONI = 8;
const PENTING: ReadonlySet<JenisBunyi> = new Set(['giliran', 'mentung', 'mentungJoker', 'kepentung', 'jotos', 'jokerDibuang', 'menang', 'kalah', 'tegang']);

/** Bunyi besar yang memakai gema aula (ekor panjang), bukan gema ruangan biasa. */
const PAKAI_AULA: ReadonlySet<JenisBunyi> = new Set(['tegang', 'mentung', 'mentungJoker', 'kepentung', 'kepentungLain', 'jotos', 'jotosLain', 'jokerDibuang']);

/** Bunyi besar yang meredam musik latar sebentar: [pengali volume musik, lama ditahan (detik)]. */
const REDAM_MUSIK: Partial<Record<JenisBunyi, readonly [number, number]>> = {
  tegang: [0.45, 2.6],
  mentung: [0.35, 1.6],
  mentungJoker: [0.25, 2.4],
  kepentung: [0.3, 1.8],
  jotos: [0.2, 1.6],
  jokerDibuang: [0.4, 1.0],
};

/** Bunyi yang menghentikan bunyi lain seketika: gebukan tegang berhenti tepat saat pentungan dibuka. */
const MEMOTONG: Partial<Record<JenisBunyi, JenisBunyi>> = { mentung: 'tegang', mentungJoker: 'tegang' };
const BISA_DIPOTONG: ReadonlySet<JenisBunyi> = new Set(Object.values(MEMOTONG));

/** Kapan tiap jenis terakhir diputar (performance.now), dan kapan bunyi yang sedang jalan selesai (waktu audio). */
const terakhirPutar = new Map<JenisBunyi, number>();
let sedangBerbunyi: { jenis: JenisBunyi; akhir: number }[] = [];

/** Gema aula per context, dibuat sekali saat bunyi besar pertama (murah, belasan node). */
const aula = new WeakMap<BaseAudioContext, AudioNode>();
/** Gain "rem" milik bunyi yang bisa dipotong yang sedang berjalan, per context. */
const rem = new WeakMap<BaseAudioContext, Map<JenisBunyi, readonly GainNode[]>>();

function aulaUntuk(r: Rantai): AudioNode {
  let n = aula.get(r.a);
  if (!n) {
    n = buatAula(r.a, r.busEfek, { detik: 1.6, basah: 0.32 });
    aula.set(r.a, n);
  }
  return n;
}

/** Hentikan bunyi `jenis` yang sedang berjalan di context ini mulai waktu `t` (pudar 25 ms, tanpa klik). */
function potong(a: BaseAudioContext, jenis: JenisBunyi, t: number): void {
  const daftar = rem.get(a);
  const g = daftar?.get(jenis);
  if (!daftar || !g) return;
  daftar.delete(jenis);
  for (const n of g) {
    n.gain.cancelScheduledValues(t);
    n.gain.setValueAtTime(1, t);
    n.gain.linearRampToValueAtTime(0, t + 0.025);
  }
}

/** Jadwalkan satu resep mulai `t`, dengan gema dan rem yang sesuai jenisnya. Kembalikan durasinya. */
function jadwalkan(r: Rantai, jenis: JenisBunyi, t: number, x: Variasi): number {
  const dasar = keluaranEfek(r);
  let k: Keluaran = PAKAI_AULA.has(jenis) ? { ...dasar, gema: aulaUntuk(r) } : dasar;
  const korban = MEMOTONG[jenis];
  if (korban) potong(r.a, korban, t);
  if (BISA_DIPOTONG.has(jenis)) {
    // Jalur kering dan kiriman gema lewat gain sendiri supaya bisa dihentikan bersama.
    const kering = r.a.createGain();
    kering.connect(k.ke);
    const basah = r.a.createGain();
    if (k.gema) basah.connect(k.gema);
    let daftar = rem.get(r.a);
    if (!daftar) rem.set(r.a, (daftar = new Map()));
    potong(r.a, jenis, t);
    daftar.set(jenis, [kering, basah]);
    k = { ...k, ke: kering, gema: basah };
  }
  return RESEP[jenis](k, t, x);
}

function variasi(opsi: OpsiBunyi): Variasi {
  const naik = 2 ** (Math.min(12, Math.max(0, opsi.urutan ?? 0)) / 12);
  return { p: acak(0.94, 1.06) * naik, pn: acak(0.995, 1.005) * naik, v: acak(0.85, 1) };
}

/** Browser baru mengizinkan audio setelah ada sentuhan pertama: pasang pembuka audio dan musik latar. */
export function siapkanAudio(): void {
  pasangMesinAudio();
  pasangMusik();
}

/** Putar satu efek suara. Diam saja kalau suara dimatikan, tab tersembunyi, atau audio belum dibuka. */
export function bunyi(jenis: JenisBunyi, opsi: OpsiBunyi = {}): void {
  if (!preferensi().suara) return;
  const r = mesinAudio();
  if (!r) return;
  const t = r.a.currentTime;
  const mulai = t + 0.005;
  // Pentungan dibuka: gebukan tegang dihentikan walau bunyi pembukanya sendiri tidak jadi diputar
  // (mis. tab sempat tersembunyi), supaya sisa gulungannya tidak menyusul saat kembali.
  const korban = MEMOTONG[jenis];
  if (korban) {
    potong(r.a, korban, mulai);
    for (const b of sedangBerbunyi) if (b.jenis === korban) b.akhir = Math.min(b.akhir, mulai + 0.03);
  }
  if (!bisaBersuara(r)) return;
  const kini = performance.now();
  const lalu = terakhirPutar.get(jenis);
  if (lalu !== undefined && kini - lalu < (JEDA_MIN[jenis] ?? JEDA_BAWAAN)) return;
  sedangBerbunyi = sedangBerbunyi.filter((b) => b.akhir > t);
  if (sedangBerbunyi.length >= MAKS_POLIFONI && !PENTING.has(jenis)) return;
  terakhirPutar.set(jenis, kini);
  const durasi = jadwalkan(r, jenis, mulai, variasi(opsi));
  sedangBerbunyi.push({ jenis, akhir: mulai + durasi });
  const redam = REDAM_MUSIK[jenis];
  if (redam) redamMusik(redam[0], redam[1]);
}

/** Beberapa bunyi berurutan untuk rekamBunyi: `detik` = kapan tiap bunyi mulai. */
export type RangkaianBunyi = readonly { jenis: JenisBunyi; detik: number }[];

/**
 * Rekam satu bunyi (atau rangkaian, mis. 'tegang' lalu 'mentung' saat pentungan dibuka) secara offline,
 * volume efek 100%, untuk memeriksa level puncak dan durasi. Pemotongan antarbunyi ikut berlaku.
 * Hanya alat ukur (skrip uji/konsol dev); tidak dipakai saat main.
 */
export async function rekamBunyi(jenis: JenisBunyi | RangkaianBunyi, opsi: OpsiBunyi = {}): Promise<AudioBuffer> {
  const daftar: RangkaianBunyi = typeof jenis === 'string' ? [{ jenis, detik: 0 }] : jenis;
  const laju = 48000;
  const panjang = Math.max(0, ...daftar.map((d) => d.detik)) + 4.5;
  const a = new OfflineAudioContext(2, Math.ceil(laju * panjang), laju);
  const r = bangunRantai(a);
  r.busMusik.gain.value = 0;
  for (const d of [...daftar].sort((x, y) => x.detik - y.detik)) jadwalkan(r, d.jenis, 0.02 + d.detik, variasi(opsi));
  return a.startRendering();
}

// ---------- getar ----------

/** Pola getar bernama (ms). Pakai nama ini supaya rasa getar konsisten di seluruh aplikasi. */
export const POLA_GETAR = {
  /** Tekan tombol/kartu. */
  ketuk: 8,
  /** Kartu mendarat di tanganmu. */
  letak: 12,
  /** Aksi tidak sah. */
  tolak: [12, 40, 12],
  /** Giliranmu. */
  giliran: 35,
  /** Pemberitahuan lembut. */
  notifikasi: [15, 50, 15],
  /** Kejadian publik yang perlu diwaspadai (kartumu dipungut, lawan tinggal 1 kartu). */
  bahaya: [30, 60, 30],
  /** Kamu mentung (saat pentungan dibuka). */
  mentung: [50, 40, 140],
  /** Kamu mentung pakai joker (saat pentungan dibuka): dung-dung-DUAAANG. */
  mentungJoker: [60, 60, 60, 60, 240],
  /**
   * Kamu kepentung (saat pukulannya mendarat, sesudah pentungan terbuka): "BUK!" panjang, "krek-krek"
   * kaca retak, lalu bergetar turun. Pola terkuat di permainan.
   */
  kepentung: [260, 40, 30, 30, 30, 70, 80, 60, 300],
  /** Menang permainan. */
  menang: [30, 50, 30, 50, 80],
} as const satisfies Record<string, number | readonly number[]>;

export type NamaPolaGetar = keyof typeof POLA_GETAR;

/** Pola yang tetap lolos walau baru saja ada getar lain. */
const GETAR_PENTING: ReadonlySet<NamaPolaGetar> = new Set(['mentung', 'mentungJoker', 'kepentung', 'menang']);
let getarTerakhir = 0;

/** True kalau HP ini bisa bergetar (iPhone/Safari tidak). UI bisa menyembunyikan setelan getar. */
export function getarDidukung(): boolean {
  return typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function';
}

/**
 * Getarkan HP. Menerima nama pola (disarankan) atau pola mentah ms.
 * Menghormati preferensi getar; saat gerak dikurangi, pola panjang dipangkas jadi satu denyut pendek.
 */
export function getar(pola: NamaPolaGetar | number | readonly number[]): void {
  if (!preferensi().getar || !getarDidukung()) return;
  // Browser memblokir getar sebelum ada sentuhan dan saat halaman tidak terlihat.
  if (document.visibilityState !== 'visible' || navigator.userActivation?.hasBeenActive === false) return;
  const penting = typeof pola === 'string' && GETAR_PENTING.has(pola);
  const kini = performance.now();
  if (!penting && kini - getarTerakhir < 80) return;
  getarTerakhir = kini;
  const mentah = typeof pola === 'string' ? POLA_GETAR[pola] : pola;
  let akhir: number | number[] = typeof mentah === 'number' ? mentah : [...mentah];
  if (gerakDikurangi()) akhir = Math.min(30, typeof akhir === 'number' ? akhir : akhir[0] ?? 0);
  try {
    navigator.vibrate(akhir);
  } catch {
    // Tidak didukung: abaikan.
  }
}
