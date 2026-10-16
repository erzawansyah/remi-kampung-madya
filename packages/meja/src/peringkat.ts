// Aturan hitung leaderboard (keputusan pemilik #45, 16 Okt 2026). Satu sumber untuk server
// (peringkat online dari SQLite, apps/server/src/riwayat.ts) dan client (Statistik di HP ini,
// apps/client/src/ui/riwayat.ts). Murni: tanpa DOM, tanpa Node API, tanpa jam sendiri.
//
// Ringkasnya:
// - Urutan bawaan = rata-rata skor akhir per permainan (Σ skor ÷ jumlah main), bukan per putaran.
// - Kursi warga kedai tidak masuk daftar, tapi tetap dihitung sebagai lawan untuk posisi dan juara.
// - Yang keluar di tengah permainan dihitung juru kunci dengan skor terendah di meja itu.
// - Nama digabung lewat kunciNama (tanpa beda huruf besar/kecil), ejaan terakhir yang tampil.
// Syarat "minimal 2 orang" hanya untuk peringkat online, jadi diterapkan server, bukan di sini.

import { kunciNama } from './validasi.js';

/** Pilihan urutan leaderboard. Urutan di sini = urutan di pilihan UI. */
export const DAFTAR_URUTAN = ['rata', 'terbaik', 'persen', 'juara', 'main', 'mentung', 'posisi'] as const;
export type UrutanPeringkat = (typeof DAFTAR_URUTAN)[number];
export const URUTAN_BAWAAN: UrutanPeringkat = 'rata';

/** Minimal main supaya masuk urutan yang berbasis rata-rata atau persentase. */
export const MIN_MAIN = 3;
export const BUTUH_MIN_MAIN: readonly UrutanPeringkat[] = ['rata', 'persen', 'posisi'];

export type PeriodePeringkat = 'semua' | 'bulan';

export interface SaringanPeringkat {
  /** 2–6 orang di meja (manusia + warga kedai); null = semua. */
  jumlahPemain: number | null;
  /** null = semua. Permainan lama yang jumlah deck-nya tidak tercatat tidak ikut kalau ini diisi. */
  jumlahDeck: 1 | 2 | null;
  /** 'bulan' = bulan kalender WIB yang sedang berjalan. */
  periode: PeriodePeringkat;
}

export const SARINGAN_BAWAAN: Readonly<SaringanPeringkat> = { jumlahPemain: null, jumlahDeck: null, periode: 'semua' };

/** Urutan dari data yang tidak dipercaya (parameter URL, isian UI): yang tidak dikenal jadi bawaan. */
export function rapikanUrutan(x: unknown): UrutanPeringkat {
  return (DAFTAR_URUTAN as readonly unknown[]).includes(x) ? (x as UrutanPeringkat) : URUTAN_BAWAAN;
}

const bilanganKecil = (x: unknown): number | null => {
  if (typeof x === 'number') return Number.isInteger(x) ? x : null;
  if (typeof x === 'string' && /^\s*\d{1,2}\s*$/.test(x)) return Number(x);
  return null;
};

/**
 * Saringan dari data yang tidak dipercaya, longgar: angka boleh berupa teks ("4"), nilai yang tidak
 * sah ("semua", 7, "x", kosong) jatuh ke bawaan masing-masing. Tidak pernah melempar.
 */
export function rapikanSaringan(x: unknown): SaringanPeringkat {
  const o = typeof x === 'object' && x !== null ? (x as Record<string, unknown>) : {};
  const n = bilanganKecil(o.jumlahPemain);
  const d = bilanganKecil(o.jumlahDeck);
  return {
    jumlahPemain: n !== null && n >= 2 && n <= 6 ? n : null,
    jumlahDeck: d === 1 || d === 2 ? d : null,
    periode: o.periode === 'bulan' ? 'bulan' : 'semua',
  };
}

/** WIB = UTC+7 tetap (tanpa musim panas). */
export const WIB_MS = 7 * 60 * 60 * 1000;

export interface BulanWib {
  /** Awal bulan (ISO UTC, inklusif): tanggal 1 pukul 00.00 WIB. */
  dari: string;
  /** Awal bulan berikutnya (ISO UTC, eksklusif). */
  sampai: string;
  /** 'YYYY-MM' menurut kalender WIB. */
  bulan: string;
}

/** Bulan kalender WIB tempat `sekarang` (ms epoch) jatuh. */
export function bulanWib(sekarang: number): BulanWib {
  const t = new Date(sekarang + WIB_MS);
  const y = t.getUTCFullYear();
  const m = t.getUTCMonth();
  return {
    dari: new Date(Date.UTC(y, m, 1) - WIB_MS).toISOString(),
    sampai: new Date(Date.UTC(y, m + 1, 1) - WIB_MS).toISOString(),
    bulan: `${String(y).padStart(4, '0')}-${String(m + 1).padStart(2, '0')}`,
  };
}

/** Satu kursi di klasemen akhir satu permainan. */
export interface KursiPeringkat {
  nama: string;
  /** Kunci penggabung nama (kunciNama). Kosong = dihitung dari nama. */
  kunci?: string;
  /** Kursi warga kedai di akhir permainan. Yang keluar di tengah permainan tetap false. */
  bot: boolean;
  /** Pemain manusia yang menekan Keluar saat permainan berjalan (kursinya diteruskan warga kedai). */
  keluar?: boolean;
  skor: number;
  mentung?: number;
  kepentung?: number;
}

/** Klasemen akhir satu permainan, bentuk minimal yang dibutuhkan hitungan peringkat. */
export interface PermainanPeringkat {
  jumlahPutaran?: number;
  pemain: readonly KursiPeringkat[];
}

export interface BarisPeringkat {
  nama: string;
  main: number;
  juara: number;
  /** Jumlah skor efektif semua permainan. */
  totalSkor: number;
  /** totalSkor ÷ main, dibulatkan (bentuk lama API). Urutan memakai nilai yang belum dibulatkan. */
  rataRata: number;
  skorTerbaik: number;
  mentung: number;
  kepentung: number;
  /** juara ÷ main × 100, belum dibulatkan. */
  persenJuara: number;
  /** Rata-rata poin posisi 0–100 (juara 100, juru kunci 0), belum dibulatkan. */
  poinPosisi: number;
  skorTerburuk: number;
  /** Berapa kali keluar di tengah permainan. */
  keluar: number;
}

export interface NilaiEfektif {
  /** Skor yang dihitung: skor akhir, atau skor terendah di meja untuk yang keluar. */
  skor: number;
  /** 1 = juara. Skor sama = peringkat sama. Yang keluar selalu n (juru kunci). */
  peringkat: number;
  juara: boolean;
  /** (n − peringkat) ÷ (n − 1) × 100. */
  poinPosisi: number;
}

/** Poin posisi dalam satuan 1/60 (bulat untuk meja 2–6 orang), supaya rata-ratanya pas tanpa galat pecahan. */
function poin60(n: number, peringkat: number): number {
  return n > 1 ? ((n - peringkat) * 60) / (n - 1) : 60;
}

/**
 * Skor dan peringkat yang dihitung untuk tiap kursi satu permainan (urutan sama dengan masukan).
 * - Yang keluar: skor = min(skornya, skor terendah di meja), peringkat = n.
 * - Kursi lain (manusia maupun warga kedai) diurutkan di antara mereka sendiri:
 *   peringkat = 1 + banyaknya kursi lain yang tidak keluar dengan skor lebih tinggi.
 */
export function nilaiEfektif(pemain: readonly KursiPeringkat[]): NilaiEfektif[] {
  const n = pemain.length;
  const terendah = Math.min(...pemain.map((p) => p.skor));
  const bertahan = pemain.filter((p) => !p.keluar);
  return pemain.map((p) => {
    const peringkat = p.keluar ? n : 1 + bertahan.filter((q) => q.skor > p.skor).length;
    return {
      skor: p.keluar ? Math.min(p.skor, terendah) : p.skor,
      peringkat,
      juara: !p.keluar && peringkat === 1,
      poinPosisi: (poin60(n, peringkat) * 100) / 60,
    };
  });
}

interface Tumpukan {
  nama: string;
  main: number;
  juara: number;
  total: number;
  terbaik: number;
  terburuk: number;
  mentung: number;
  kepentung: number;
  poin60: number;
  keluar: number;
}

/**
 * Gabungkan klasemen beberapa permainan jadi baris per pemain manusia (urutan belum diatur; pakai
 * urutkanPeringkat). `permainan` urut dari yang paling lama supaya ejaan nama yang tampil adalah
 * yang terakhir dipakai; `ejaan` (kunciNama → nama) menimpanya, misalnya ejaan terbaru dari semua
 * permainan saat saringan periode dipakai. Entri rusak dilewati.
 */
export function hitungPeringkat(
  permainan: readonly PermainanPeringkat[],
  ejaan?: ReadonlyMap<string, string>,
): BarisPeringkat[] {
  const per = new Map<string, Tumpukan>();
  for (const g of permainan) {
    if (!g || !Array.isArray(g.pemain) || !g.pemain.length) continue;
    if (g.pemain.some((p) => !p || typeof p.nama !== 'string' || !Number.isFinite(p.skor))) continue;
    const n = g.pemain.length;
    const nilai = nilaiEfektif(g.pemain);
    g.pemain.forEach((p, i) => {
      if (p.bot) return;
      const kunci = p.kunci || kunciNama(p.nama);
      if (!kunci) return;
      const v = nilai[i];
      const s =
        per.get(kunci) ??
        ({ nama: '', main: 0, juara: 0, total: 0, terbaik: -Infinity, terburuk: Infinity, mentung: 0, kepentung: 0, poin60: 0, keluar: 0 } satisfies Tumpukan);
      s.nama = p.nama.trim();
      s.main++;
      if (v.juara) s.juara++;
      s.total += v.skor;
      s.terbaik = Math.max(s.terbaik, v.skor);
      s.terburuk = Math.min(s.terburuk, v.skor);
      s.mentung += p.mentung ?? 0;
      s.kepentung += p.kepentung ?? 0;
      s.poin60 += poin60(n, v.peringkat);
      if (p.keluar) s.keluar++;
      per.set(kunci, s);
    });
  }
  return [...per].map(([kunci, s]) => ({
    nama: ejaan?.get(kunci) ?? s.nama,
    main: s.main,
    juara: s.juara,
    totalSkor: s.total,
    rataRata: Math.round(s.total / s.main),
    skorTerbaik: s.terbaik,
    mentung: s.mentung,
    kepentung: s.kepentung,
    // Satu pembagian bilangan bulat: dua pemain dengan nilai sama persis selalu seri.
    persenJuara: (s.juara * 100) / s.main,
    poinPosisi: (s.poin60 * 100) / (60 * s.main),
    skorTerburuk: s.terburuk,
    keluar: s.keluar,
  }));
}

const turun = (a: number, b: number) => (a > b ? -1 : a < b ? 1 : 0);
const rata = (b: BarisPeringkat) => (b.main ? b.totalSkor / b.main : 0);
const abjad = (a: BarisPeringkat, b: BarisPeringkat) =>
  a.nama.localeCompare(b.nama, 'id') || (a.nama < b.nama ? -1 : a.nama > b.nama ? 1 : 0);

/** Pembanding tiap urutan. Seri diputus dengan aturan di komentar, terakhir abjad nama. */
const PEMBANDING: Record<UrutanPeringkat, (a: BarisPeringkat, b: BarisPeringkat) => number> = {
  // Rata-rata sama: yang lebih sering main di atas.
  rata: (a, b) => turun(rata(a), rata(b)) || turun(a.main, b.main) || abjad(a, b),
  // Skor terbaik sama: rata-rata lebih tinggi di atas.
  terbaik: (a, b) => turun(a.skorTerbaik, b.skorTerbaik) || turun(rata(a), rata(b)) || abjad(a, b),
  // Persen sama: yang lebih sering main (berarti lebih banyak juara) di atas.
  persen: (a, b) => turun(a.persenJuara, b.persenJuara) || turun(a.main, b.main) || abjad(a, b),
  // Urutan lama: jumlah juara, lalu total skor.
  juara: (a, b) => turun(a.juara, b.juara) || turun(a.totalSkor, b.totalSkor) || abjad(a, b),
  main: (a, b) => turun(a.main, b.main) || turun(rata(a), rata(b)) || abjad(a, b),
  mentung: (a, b) => turun(a.mentung, b.mentung) || turun(rata(a), rata(b)) || abjad(a, b),
  posisi: (a, b) => turun(a.poinPosisi, b.poinPosisi) || turun(a.main, b.main) || abjad(a, b),
};

/**
 * Urutkan baris peringkat. Untuk urutan berbasis rata-rata/persentase (BUTUH_MIN_MAIN), yang main
 * kurang dari MIN_MAIN dipisah ke `belumCukup` (paling sering main dulu). Masukan tidak diubah.
 */
export function urutkanPeringkat(
  baris: readonly BarisPeringkat[],
  urut: UrutanPeringkat,
): { peringkat: BarisPeringkat[]; belumCukup: BarisPeringkat[] } {
  const butuh = BUTUH_MIN_MAIN.includes(urut);
  const cukup = baris.filter((b) => !butuh || b.main >= MIN_MAIN);
  const kurang = butuh ? baris.filter((b) => b.main < MIN_MAIN) : [];
  return {
    peringkat: [...cukup].sort(PEMBANDING[rapikanUrutan(urut)]),
    belumCukup: [...kurang].sort((a, b) => turun(a.main, b.main) || abjad(a, b)),
  };
}

/** Angka yang dipakai urutan itu (belum dibulatkan), untuk angka besar di tampilan. */
export function nilaiUrutan(b: BarisPeringkat, urut: UrutanPeringkat): number {
  switch (urut) {
    case 'rata':
      return rata(b);
    case 'terbaik':
      return b.skorTerbaik;
    case 'persen':
      return b.persenJuara;
    case 'juara':
      return b.juara;
    case 'main':
      return b.main;
    case 'mentung':
      return b.mentung;
    case 'posisi':
      return b.poinPosisi;
  }
}
