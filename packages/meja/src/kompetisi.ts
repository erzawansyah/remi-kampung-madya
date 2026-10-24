// Aturan kompetisi (keputusan pemilik #51, 23 Okt 2026; versi 2 diputuskan 24 Okt 2026). Satu sumber
// untuk server (penyimpan kompetisi di SQLite, apps/server/src/kompetisi.ts), meja kompetisi
// (meja.ts), dan layar Kompetisi di HP. Murni: tanpa DOM, tanpa Node API, tanpa jam sendiri (waktu
// selalu diberikan pemanggil, ms epoch).
//
// Ringkasnya:
// - Siapa saja boleh mengajukan kompetisi. Jalan begitu MIN_PESERTA orang (termasuk pengaju) menekan
//   "Ikut serta"; 24 jam belum cukup = batal sendiri. Ikut serta boleh sampai kompetisi selesai.
// - Masa berlaku (1 malam, 1 minggu, 1 bulan) dihitung sejak kompetisi jalan.
// - Hanya permainan di meja kompetisi yang dihitung: semua kursi peserta, tanpa warga kedai, dan
//   pengaturannya (termasuk jumlah pemain dan batas putaran) dikunci dari kompetisi. Meja mulai
//   sendiri begitu semua kursi terisi peserta yang terhubung.
// - Nilai satu permainan, skala 0–10 = banyaknya kursi lain yang kamu kalahkan ÷ (jumlah kursi − 1)
//   × 10 (meja 4 orang: 10; 6,67; 3,33; 0). Skor sama tidak saling mengalahkan.
// - Yang keluar di tengah permainan nilainya 0 dan tidak dihitung "dikalahkan" untuk siapa pun: kursi
//   lain hanya dibandingkan dengan kursi yang bertahan sampai akhir (keputusan pemilik 24 Okt 2026,
//   "Yang keluar tak dihitung"). Kalau yang bertahan kurang dari MIN_BERTAHAN_KOMPETISI, permainan itu
//   tidak dihitung untuk yang bertahan, tapi yang keluar tetap dicatat 0 dan 1× main (keputusan
//   pemilik 24 Okt 2026, "Yang keluar selalu dicatat 0"): keluar tidak pernah lebih untung daripada kalah.
//   Permainan yang tidak pernah selesai (ditinggal) hanya mencatat yang keluar (0, 1× main), saat
//   permainannya ditinggal.
// - Klasemen: rata-rata nilai per permainan, minimal MIN_MAIN_KOMPETISI kali main; seri = lebih
//   sering main, lalu rata-rata skor akhir, lalu abjad.
// - Permainan dihitung kalau dimulai selagi kompetisi berjalan (walau selesai sesudahnya).
// - Selesai lebih awal kalau lebih dari separuh peserta setuju. Di meja kompetisi sendiri tidak ada
//   voting "Akhiri permainan" maupun "Putaran terakhir": permainan jalan sampai batas putaran
//   (keputusan pemilik 24 Okt 2026).

import type { KursiPeringkat } from './peringkat.js';
import { PENGATURAN_BAWAAN, type HasilKompetisiKursi, type PengaturanMeja } from './protokol.js';
import { batasSkorSah, isLevel } from './validasi.js';

/** Peserta minimal (termasuk pengaju) supaya kompetisi jalan. */
export const MIN_PESERTA = 4;
/** Pengajuan yang belum cukup peserta sesudah sekian ms batal sendiri. */
export const BATAS_PENGAJUAN_MS = 24 * 60 * 60 * 1000;
/** Minimal main supaya masuk klasemen (sama dengan leaderboard #45). */
export const MIN_MAIN_KOMPETISI = 3;
/** Batas peserta satu kompetisi (jaga-jaga, bukan aturan main). */
export const MAKS_PESERTA = 100;
/** Nilai satu permainan paling tinggi (mengalahkan semua kursi lain di meja itu). */
export const NILAI_MAKS = 10;
/**
 * Kursi yang bertahan sampai akhir (tidak keluar) paling sedikit sekian supaya permainan dihitung
 * untuk yang bertahan (keputusan pemilik 24 Okt 2026). Kurang dari itu = hampir semua keluar: yang
 * bertahan tidak dicatat, yang keluar tetap dicatat 0.
 */
export const MIN_BERTAHAN_KOMPETISI = 2;

/**
 * Pesan penolakan voting "Akhiri permainan" dan "Putaran terakhir" di meja kompetisi (keputusan
 * pemilik 24 Okt 2026): permainan jalan sampai batas putaran, kaldu mulai sendiri di batas putaran.
 */
export const TEKS_TANPA_VOTING_KOMPETISI = 'Di meja kompetisi permainan jalan sampai batas putaran, Bos.';

/** Jumlah pemain meja kompetisi: ditetapkan saat pengajuan (2–6, bawaan 4). */
export const MIN_PEMAIN_KOMPETISI = 2;
export const MAKS_PEMAIN_KOMPETISI = 6;
export const JUMLAH_PEMAIN_KOMPETISI_BAWAAN = 4;
/** Batas putaran meja kompetisi wajib angka; pilihan di formulir pengajuan dan bawaannya. */
export const PILIHAN_BATAS_PUTARAN_KOMPETISI = [3, 5, 10, 15, 20] as const;
export const BATAS_PUTARAN_KOMPETISI_BAWAAN = 5;
/**
 * Waktu per giliran meja kompetisi wajib ada (tanpa "Tanpa batas"): tanpa batas waktu satu pemain
 * yang tersambung bisa menahan giliran, pengumuman joker, atau susun akhir selamanya, dan juara
 * kompetisinya ikut tertahan karena menunggu meja terakhir selesai (tafsiran pengembang).
 */
export const PILIHAN_DETIK_GILIRAN_KOMPETISI = [30, 60, 90, 120] as const;
export const DETIK_GILIRAN_KOMPETISI_BAWAAN = 60;

/**
 * Jeda sebelum meja kompetisi yang kursinya sudah penuh (semua peserta terhubung) mulai sendiri,
 * supaya semua sempat melihat lobi penuh. Batal kalau ada yang keluar atau terputus di jeda itu.
 */
export const JEDA_MULAI_KOMPETISI_MS = 2_000;

/**
 * Alasan pesan `keluar` dari server untuk peserta di lobi meja kompetisi yang kompetisinya sudah
 * berakhir (lobinya dibubarkan). Aplikasi boleh mencocokkannya untuk membuka layar kompetisi itu.
 */
export const TEKS_LOBI_KOMPETISI_BUBAR = 'Kompetisinya sudah selesai, mejanya dibubarkan. Klasemennya ada di menu Kompetisi, Bos.';

/**
 * Alasan pesan `keluar` untuk peserta yang menyambung ulang ke meja kompetisi padahal kursinya sudah
 * tidak ada (kursi lobi dilepas karena ia terlalu lama terputus, lalu tidak bisa duduk lagi karena
 * kursinya sudah diisi orang lain atau permainannya sudah mulai).
 */
export const TEKS_KURSI_KOMPETISI_LEPAS = 'Kursimu di meja kompetisi dilepas karena kamu lama terputus. Duduk lagi dari daftar meja, Bos.';

export const DAFTAR_MASA = ['malam', 'minggu', 'bulan'] as const;
export type MasaKompetisi = (typeof DAFTAR_MASA)[number];

export const isMasa = (x: unknown): x is MasaKompetisi => (DAFTAR_MASA as readonly unknown[]).includes(x);

/**
 * Pengaturan meja yang dikunci kompetisi: semua yang memengaruhi aturan dan kekuatan permainan,
 * termasuk jumlah pemain (versi 2). Level warga kedai ikut dikunci karena giliran pemain yang
 * terputus atau kehabisan waktu tetap dijalankan warga kedai. Yang masih bebas diatur host hanya
 * tempo warga kedai dan meja publik (meja kompetisi tidak pernah masuk daftar meja publik).
 */
export const KUNCI_PENGATURAN_KOMPETISI = [
  'jumlahPemain',
  'duaDeckUntukEmpat',
  'batasPutaran',
  'batasSkorAtas',
  'batasSkorBawah',
  'modeKaldu',
  'detikGiliran',
  'levelBot',
] as const satisfies readonly (keyof PengaturanMeja)[];

export type KunciPengaturanKompetisi = (typeof KUNCI_PENGATURAN_KOMPETISI)[number];
/** Batas putaran meja kompetisi selalu angka (tanpa pilihan "Tanpa batas"). */
export type PengaturanKompetisi = Omit<Required<Pick<PengaturanMeja, KunciPengaturanKompetisi>>, 'batasPutaran'> & {
  batasPutaran: number;
};

export const PENGATURAN_KOMPETISI_BAWAAN: Readonly<PengaturanKompetisi> = {
  jumlahPemain: JUMLAH_PEMAIN_KOMPETISI_BAWAAN,
  duaDeckUntukEmpat: PENGATURAN_BAWAAN.duaDeckUntukEmpat,
  batasPutaran: BATAS_PUTARAN_KOMPETISI_BAWAAN,
  batasSkorAtas: PENGATURAN_BAWAAN.batasSkorAtas,
  batasSkorBawah: PENGATURAN_BAWAAN.batasSkorBawah,
  modeKaldu: false,
  detikGiliran: DETIK_GILIRAN_KOMPETISI_BAWAAN,
  levelBot: PENGATURAN_BAWAAN.levelBot,
};

/**
 * Asal pengaturan yang dirapikan:
 * - 'pengajuan' (bawaan): isian pengajuan dari API publik. Batas putaran dan waktu per giliran hanya
 *   boleh salah satu pilihan formulir (PILIHAN_BATAS_PUTARAN_KOMPETISI, PILIHAN_DETIK_GILIRAN_KOMPETISI).
 * - 'tersimpan': JSON di database. Lebih longgar (batas putaran 1–20, waktu 1–600 detik), supaya data
 *   uji yang ditulis langsung (permainan 1–2 putaran) tetap terbaca apa adanya. Bukan untuk isian.
 */
export type AsalPengaturanKompetisi = 'pengajuan' | 'tersimpan';

/**
 * Pengaturan kompetisi dari data yang tidak dipercaya (isian, JSON di database): tiap kunci yang
 * tidak sah jatuh ke bawaan masing-masing (batas putaran kosong/rusak → 5, jumlah pemain rusak → 4,
 * waktu per giliran kosong/0/rusak → 60 detik), kunci lain dibuang. "2 deck untuk 4 pemain" hanya
 * berarti di meja 4 orang, jadi selain itu false. Tidak pernah melempar.
 */
export function rapikanPengaturanKompetisi(x: unknown, asal: AsalPengaturanKompetisi = 'pengajuan'): PengaturanKompetisi {
  const o = typeof x === 'object' && x !== null ? (x as Record<string, unknown>) : {};
  const b = PENGATURAN_KOMPETISI_BAWAAN;
  const bulat = (v: unknown, min: number, maks: number): v is number =>
    typeof v === 'number' && Number.isInteger(v) && v >= min && v <= maks;
  const salahSatu = (v: unknown, pilihan: readonly number[]): v is number => typeof v === 'number' && pilihan.includes(v);
  const tersimpan = asal === 'tersimpan';
  const maksPutaran = Math.max(...PILIHAN_BATAS_PUTARAN_KOMPETISI);
  const jumlahPemain = bulat(o.jumlahPemain, MIN_PEMAIN_KOMPETISI, MAKS_PEMAIN_KOMPETISI) ? o.jumlahPemain : b.jumlahPemain;
  const batasPutaran = tersimpan ? bulat(o.batasPutaran, 1, maksPutaran) : salahSatu(o.batasPutaran, PILIHAN_BATAS_PUTARAN_KOMPETISI);
  const detikGiliran = tersimpan ? bulat(o.detikGiliran, 1, 600) : salahSatu(o.detikGiliran, PILIHAN_DETIK_GILIRAN_KOMPETISI);
  return {
    jumlahPemain,
    duaDeckUntukEmpat: jumlahPemain === 4 && typeof o.duaDeckUntukEmpat === 'boolean' ? o.duaDeckUntukEmpat : false,
    batasPutaran: batasPutaran ? (o.batasPutaran as number) : b.batasPutaran,
    batasSkorAtas: batasSkorSah(o.batasSkorAtas, 'atas') ? o.batasSkorAtas : b.batasSkorAtas,
    batasSkorBawah: batasSkorSah(o.batasSkorBawah, 'bawah') ? o.batasSkorBawah : b.batasSkorBawah,
    modeKaldu: typeof o.modeKaldu === 'boolean' ? o.modeKaldu : b.modeKaldu,
    detikGiliran: detikGiliran ? (o.detikGiliran as number) : b.detikGiliran,
    levelBot: isLevel(o.levelBot) ? o.levelBot : b.levelBot,
  };
}

/** Kunci pengaturan yang ikut diubah di `ubah` padahal dikunci kompetisi (nilainya berbeda). */
export function ubahanTerkunci(kunci: Readonly<PengaturanKompetisi>, ubah: Partial<PengaturanMeja>): KunciPengaturanKompetisi[] {
  return KUNCI_PENGATURAN_KOMPETISI.filter((k) => k in ubah && ubah[k] !== kunci[k]);
}

const JAM_MS = 60 * 60 * 1000;
const HARI_MS = 24 * JAM_MS;
const WIB_MS = 7 * JAM_MS;
/** "1 malam" berakhir pukul 06.00 WIB, paling cepat sekian jam sesudah kompetisi jalan. */
const JAM_AKHIR_MALAM = 6;
const MIN_JAM_MALAM = 3;

/**
 * Kapan kompetisi berakhir (ms epoch), dihitung dari saat jalan:
 * - malam: pukul 06.00 WIB berikutnya yang paling cepat 3 jam lagi (jalan 05.00 → besoknya 06.00),
 * - minggu: 7 × 24 jam, bulan: 30 × 24 jam.
 */
export function akhirKompetisi(masa: MasaKompetisi, mulai: number): number {
  if (masa === 'minggu') return mulai + 7 * HARI_MS;
  if (masa === 'bulan') return mulai + 30 * HARI_MS;
  const t = new Date(mulai + WIB_MS);
  let akhir = Date.UTC(t.getUTCFullYear(), t.getUTCMonth(), t.getUTCDate(), JAM_AKHIR_MALAM) - WIB_MS;
  while (akhir < mulai + MIN_JAM_MALAM * JAM_MS) akhir += HARI_MS;
  return akhir;
}

export type StatusKompetisi = 'pengajuan' | 'batal' | 'berjalan' | 'selesai';

export interface WaktuKompetisi {
  diajukanPada: number;
  /** null = masih pengajuan (peserta belum cukup). */
  mulaiPada: number | null;
  /** null = belum jalan. */
  berakhirPada: number | null;
  /** Ditutup lebih awal lewat voting peserta. */
  ditutupPada: number | null;
}

export function statusKompetisi(k: WaktuKompetisi, sekarang: number): StatusKompetisi {
  if (k.mulaiPada === null) return sekarang >= k.diajukanPada + BATAS_PENGAJUAN_MS ? 'batal' : 'pengajuan';
  if (k.ditutupPada !== null || (k.berakhirPada !== null && sekarang >= k.berakhirPada)) return 'selesai';
  return 'berjalan';
}

/** Kapan kompetisi yang sudah selesai berakhir (tutup lebih awal atau masa habis); null = belum. */
export function selesaiPada(k: WaktuKompetisi): number | null {
  return k.ditutupPada ?? k.berakhirPada;
}

/**
 * Kompetisi berjalan pada waktu `t`: sudah jalan dan belum berakhir (masa habis atau disudahi).
 * Dipakai untuk waktu MULAI permainan: permainan yang dimulai sebelum kompetisi berakhir tetap
 * dihitung walau selesai sesudahnya (versi 2).
 */
export function berjalanPada(k: WaktuKompetisi, t: number): boolean {
  if (k.mulaiPada === null || t < k.mulaiPada) return false;
  const akhir = selesaiPada(k);
  return akhir === null || t < akhir;
}

/** Voting tutup lebih awal lolos: lebih dari separuh peserta setuju. */
export const tutupDisetujui = (setuju: number, peserta: number): boolean => peserta > 0 && setuju * 2 > peserta;

export interface NilaiKompetisi {
  /** Banyaknya kursi lain yang bertahan sampai akhir dan skornya lebih rendah (yang keluar: 0). */
  dikalahkan: number;
  /**
   * Banyaknya kursi lain yang bertahan sampai akhir: pembagi nilai. Kursi yang bertahan = jumlah yang
   * bertahan − 1; kursi yang keluar = jumlah yang bertahan (nilainya tetap 0).
   */
  lawan: number;
  /** dikalahkan ÷ lawan × NILAI_MAKS, belum dibulatkan (0–10); 0 untuk yang keluar. */
  nilai: number;
}

/**
 * Permainan kompetisi dihitung untuk yang bertahan kalau paling sedikit MIN_BERTAHAN_KOMPETISI kursi
 * bertahan sampai akhir. Kalau tinggal satu (atau tidak ada) yang bertahan, nilainya tidak dicatat
 * untuk yang bertahan; yang keluar tetap dicatat 0 (`kursiDicatatKompetisi`, keputusan pemilik 24 Okt
 * 2026).
 */
export function permainanKompetisiDihitung(pemain: readonly Pick<KursiPeringkat, 'keluar'>[]): boolean {
  return pemain.filter((p) => !p.keluar).length >= MIN_BERTAHAN_KOMPETISI;
}

/**
 * Kursi mana yang hasilnya dicatat di kompetisi (urutan sama dengan masukan): yang keluar selalu
 * (nilai 0, 1× main), yang bertahan hanya kalau permainannya dihitung (`permainanKompetisiDihitung`).
 * Keputusan pemilik 24 Okt 2026 "Yang keluar selalu dicatat 0".
 *
 * `ditinggal` = permainannya tidak akan pernah selesai (semua peserta menekan Keluar, mejanya dihapus
 * karena lama kosong, atau simpanannya dibuang). Yang dicatat hanya yang keluar; yang bertahan tidak
 * pernah, juga kalau mereka dua orang atau lebih (terputus bukan keluar, #45).
 */
export function kursiDicatatKompetisi(pemain: readonly Pick<KursiPeringkat, 'keluar'>[], ditinggal = false): boolean[] {
  const dihitung = !ditinggal && permainanKompetisiDihitung(pemain);
  return pemain.map((p) => dihitung || !!p.keluar);
}

/**
 * Nilai tiap kursi satu permainan kompetisi (urutan sama dengan masukan), keputusan pemilik 24 Okt
 * 2026 "Yang keluar tak dihitung":
 * - Yang keluar di tengah permainan: nilai 0, dan tidak dihitung "dikalahkan" untuk siapa pun.
 * - Yang bertahan: banyaknya kursi lain yang bertahan dengan skor lebih rendah ÷ (banyaknya yang
 *   bertahan − 1) × 10. Skor sama = tidak saling mengalahkan.
 * Kalau permainannya tidak dihitung (permainanKompetisiDihitung false), semua nilainya 0; yang
 * dicatat hanya kursi yang keluar (`kursiDicatatKompetisi`).
 */
export function nilaiKompetisi(pemain: readonly KursiPeringkat[]): NilaiKompetisi[] {
  const bertahan = pemain.filter((p) => !p.keluar).length;
  return pemain.map((p, i) => {
    if (p.keluar) return { dikalahkan: 0, lawan: bertahan, nilai: 0 };
    const lawan = bertahan - 1;
    const dikalahkan = pemain.filter((q, j) => j !== i && !q.keluar && q.skor < p.skor).length;
    return { dikalahkan, lawan, nilai: lawan > 0 ? (dikalahkan * NILAI_MAKS) / lawan : 0 };
  });
}

/**
 * Nilai dalam satuan 1/60 dari "semua lawan dikalahkan" (bulat untuk meja 2–6 orang: 60/lawan bulat),
 * supaya jumlah dan perbandingan rata-rata pas tanpa galat pecahan. nilai = nilai60 ÷ 6.
 */
const nilai60 = (dikalahkan: number, lawan: number): number => (lawan > 0 ? (dikalahkan * 60) / lawan : 0);

/** Satu baris hasil: satu peserta di satu permainan kompetisi. */
export interface HasilKompetisi {
  peserta: number;
  /** Lihat NilaiKompetisi. */
  dikalahkan: number;
  lawan: number;
  /** Skor efektif (yang keluar: skor terendah di meja), sama dengan leaderboard. */
  skor: number;
  /** Peringkat 1 di meja itu. */
  juara: boolean;
  keluar: boolean;
}

export interface PesertaKompetisi {
  id: number;
  nama: string;
}

export interface BarisKompetisi {
  id: number;
  nama: string;
  main: number;
  /** Berapa kali juara meja (peringkat 1 di permainan itu); bukan juara kompetisi. */
  juara: number;
  keluar: number;
  /** Jumlah nilai semua permainan (tiap permainan 0–10), belum dibulatkan. */
  totalNilai: number;
  /** totalNilai ÷ main (0–10), belum dibulatkan; 0 kalau belum main. Tampilkan dengan teksNilai(). */
  rataNilai: number;
  /** Σ skor ÷ main, belum dibulatkan (0 kalau belum main). */
  rataSkor: number;
  /**
   * Peringkat di klasemen (1 = teratas). Yang seri persis (rata-rata nilai, banyak main, dan
   * rata-rata skor sama) berbagi angka yang sama; abjad hanya mengatur urutan tampil. null = belum
   * MIN_MAIN_KOMPETISI kali main.
   */
  peringkat: number | null;
}

export interface KlasemenKompetisi {
  /** Yang sudah main minimal MIN_MAIN_KOMPETISI kali, urut peringkat. */
  peringkat: BarisKompetisi[];
  /** Sisanya, paling sering main dulu. */
  belumCukup: BarisKompetisi[];
}

const abjad = (a: { nama: string }, b: { nama: string }) =>
  a.nama.localeCompare(b.nama, 'id') || (a.nama < b.nama ? -1 : a.nama > b.nama ? 1 : 0);

/**
 * Klasemen kompetisi. Peserta yang sudah main minimal MIN_MAIN_KOMPETISI kali masuk `peringkat`:
 * rata-rata nilai per permainan, seri = lebih sering main, lalu rata-rata skor akhir, lalu abjad
 * (versi 2; urutan seri tafsiran pengembang). Sisanya `belumCukup` (paling sering main, lalu
 * rata-rata nilai, lalu abjad). Perbandingan rata-rata dihitung dengan bilangan bulat, jadi yang seri
 * tidak pernah terpisah karena galat pembulatan. Hasil milik peserta yang tidak dikenal dilewati.
 */
export function hitungKlasemenKompetisi(peserta: readonly PesertaKompetisi[], hasil: readonly HasilKompetisi[]): KlasemenKompetisi {
  interface Tumpukan {
    id: number;
    nama: string;
    main: number;
    juara: number;
    keluar: number;
    total60: number;
    totalSkor: number;
  }
  const per = new Map<number, Tumpukan>();
  for (const p of peserta) per.set(p.id, { id: p.id, nama: p.nama, main: 0, juara: 0, keluar: 0, total60: 0, totalSkor: 0 });
  for (const h of hasil) {
    const b = per.get(h.peserta);
    if (!b) continue;
    b.main++;
    b.total60 += nilai60(h.dikalahkan, h.lawan);
    b.totalSkor += h.skor;
    if (h.juara) b.juara++;
    if (h.keluar) b.keluar++;
  }
  // a lebih tinggi rata-rata nilainya ⇔ a.total60 × b.main > b.total60 × a.main (semuanya bulat).
  const bandingNilai = (a: Tumpukan, b: Tumpukan) => b.total60 * a.main - a.total60 * b.main;
  // Seri nilai: lebih sering main di atas; banyak main sama → rata-rata skor = total skor.
  const bandingSeri = (a: Tumpukan, b: Tumpukan) => bandingNilai(a, b) || b.main - a.main || b.totalSkor - a.totalSkor;
  const jadiBaris = (t: Tumpukan, peringkat: number | null): BarisKompetisi => ({
    id: t.id,
    nama: t.nama,
    main: t.main,
    juara: t.juara,
    keluar: t.keluar,
    totalNilai: t.total60 / 6,
    rataNilai: t.main ? t.total60 / 6 / t.main : 0,
    rataSkor: t.main ? t.totalSkor / t.main : 0,
    peringkat,
  });
  const semua = [...per.values()];
  const cukup = semua.filter((t) => t.main >= MIN_MAIN_KOMPETISI).sort((a, b) => bandingSeri(a, b) || abjad(a, b));
  const peringkat: BarisKompetisi[] = [];
  cukup.forEach((t, i) => {
    const seri = i > 0 && bandingSeri(cukup[i - 1], t) === 0;
    peringkat.push(jadiBaris(t, seri ? peringkat[i - 1].peringkat : i + 1));
  });
  return {
    peringkat,
    belumCukup: semua
      .filter((t) => t.main < MIN_MAIN_KOMPETISI)
      .sort((a, b) => b.main - a.main || bandingNilai(a, b) || abjad(a, b))
      .map((t) => jadiBaris(t, null)),
  };
}

/** Juara kompetisi: semua yang berperingkat 1 di klasemen (lebih dari satu kalau seri persis). */
export function juaraKompetisi(k: Pick<KlasemenKompetisi, 'peringkat'>): BarisKompetisi[] {
  return k.peringkat.filter((b) => b.peringkat === 1);
}

/** Satu kursi klasemen akhir meja kompetisi (bentuk minimal RingkasanAkhir['pemain'][number]). */
export interface KursiHasilKompetisi extends KursiPeringkat {
  kursi: number;
  peserta?: number;
}

/**
 * Isi pesan `kompetisiHasil` untuk satu permainan yang baru dicatat: nilai tiap kursi peserta,
 * rata-rata dan banyak main sesudahnya, serta peringkat klasemen sebelum dan sesudah permainan itu
 * (null = belum masuk klasemen). Urut kursi. Kursi tanpa peserta dilewati. Permainan yang tidak
 * dihitung untuk yang bertahan (permainanKompetisiDihitung false) = daftar kosong: yang menerima
 * pesannya hanya yang bertahan, dan nilai 0 yang keluar tidak perlu dikabarkan ke meja.
 */
export function hasilKompetisiMeja(
  pemain: readonly KursiHasilKompetisi[],
  sebelum: KlasemenKompetisi,
  sesudah: KlasemenKompetisi,
): HasilKompetisiKursi[] {
  if (!permainanKompetisiDihitung(pemain)) return [];
  const nilai = nilaiKompetisi(pemain);
  const cari = (k: KlasemenKompetisi, id: number) => k.peringkat.find((b) => b.id === id) ?? k.belumCukup.find((b) => b.id === id) ?? null;
  return pemain
    .flatMap((p, i) => {
      if (p.peserta === undefined) return [];
      const kini = cari(sesudah, p.peserta);
      return [
        {
          kursi: p.kursi,
          nama: kini?.nama ?? p.nama,
          nilai: nilai[i].nilai,
          keluar: !!p.keluar,
          rataNilai: kini ? kini.rataNilai : nilai[i].nilai,
          main: kini ? kini.main : 1,
          peringkatSebelum: cari(sebelum, p.peserta)?.peringkat ?? null,
          peringkatSesudah: kini?.peringkat ?? null,
        },
      ];
    })
    .sort((a, b) => a.kursi - b.kursi);
}

/**
 * Nilai untuk ditampilkan: satu desimal dengan koma ("6,7", "10,0"). Pembulatan setengah ke atas.
 * Bilangan rusak (NaN/tak hingga) jadi "0,0".
 */
export function teksNilai(x: number): string {
  if (!Number.isFinite(x)) return '0,0';
  const sepuluh = Math.round(Math.abs(x) * 10 + 1e-9);
  return `${x < 0 && sepuluh ? '−' : ''}${Math.floor(sepuluh / 10)},${sepuluh % 10}`;
}
