// Sprint (keputusan pemilik 25 Nov 2026): satu pemain lawan tiga warga kedai level Suhu, 5 putaran,
// hanya online (dijalankan server, supaya rekornya tidak bisa diakali dari HP). Satu percobaan = satu
// meja. Semua aturan hitung sprint (pengaturan, hasil satu percobaan, papan, juara mingguan) hanya di
// sini, dipakai server dan aplikasi. Jangan dihitung ulang di tempat lain.

import type { GameState, LevelBot } from '@remi/engine';
import { WIB_MS } from './peringkat.js';
import type { PengaturanMeja } from './protokol.js';
import { kunciNama } from './validasi.js';

/** Banyaknya putaran satu percobaan sprint. */
export const JUMLAH_PUTARAN_SPRINT = 5;

/** Level warga kedai di semua putaran sprint. */
export const LEVEL_SPRINT: LevelBot = 'suhu';

/**
 * Tiga lawan sprint, masing-masing main dengan gaya personanya (#47). Kalau nama pemain sama dengan
 * salah satunya, warga kedai itu diganti nama berikutnya di NAMA_LAWAN_BAWAAN (tafsiran pengembang).
 */
export const NAMA_LAWAN_SPRINT: readonly string[] = ['Kipas Dua', 'Cak Kopag', 'Mbak Teras'];

/**
 * Pengaturan meja sprint (dikunci): 4 pemain, 1 deck, 5 putaran, tanpa batas skor, tanpa batas waktu
 * giliran, tempo warga kedai cepat (pemain tetap boleh mengganti tempo selama main). Mode kaldu mati
 * (tidak ditulis = mati), urutan duduk selalu diacak (#62), meja privat tapi boleh ditonton.
 */
export const PENGATURAN_SPRINT: Readonly<PengaturanMeja> = Object.freeze({
  jumlahPemain: 4,
  duaDeckUntukEmpat: false,
  batasPutaran: JUMLAH_PUTARAN_SPRINT,
  batasSkorAtas: null,
  batasSkorBawah: null,
  publik: false,
  detikGiliran: 0,
  levelBot: LEVEL_SPRINT,
  tempoBot: 'cepat',
});

const HARI_MS = 24 * 60 * 60 * 1000;

/**
 * Awal minggu WIB tempat `ms` jatuh: Senin pukul 00.00 WIB (UTC+7 tetap), dalam ms epoch.
 * Minggu 23.59 WIB masih minggu lalu; Senin 00.00 WIB sudah minggu baru.
 */
export function awalMingguWib(ms: number): number {
  const hari = Math.floor((ms + WIB_MS) / HARI_MS);
  // 1 Jan 1970 hari Kamis: (hari + 3) % 7 = 0 untuk Senin.
  const keSenin = (((hari + 3) % 7) + 7) % 7;
  return (hari - keSenin) * HARI_MS - WIB_MS;
}

/** Hasil satu percobaan sprint untuk kursi pemain. */
export interface HasilSprint {
  /** Selesai 5 putaran dan skor akhirnya ≥ skor setiap warga kedai (seri = menang). */
  menang: boolean;
  /** Skor akumulasi pemain sesudah putaran terakhir yang selesai. */
  skor: number;
  /** Putaran yang ditutup pemain dengan mentung. */
  mentung: number;
  /** Berapa kali pemain kepentung. */
  kepentung: number;
  /** Putaran yang sudah selesai dimainkan. */
  putaran: number;
  /** Permainannya selesai (semua putaran); false = ditinggal di tengah jalan. */
  selesai: boolean;
}

/**
 * Hasil sprint kursi `kursi` (kursi pemain sesudah urutan duduk diacak) dari state permainan. Hanya
 * putaran yang sudah selesai yang dihitung. Percobaan yang ditinggal (permainan belum selesai) tidak
 * pernah menang (tafsiran pengembang: supaya percobaan yang jelek tidak bisa ditinggal demi
 * menjaga jumlah menang).
 */
export function hasilSprint(game: GameState, kursi: number): HasilSprint {
  const riwayat = game.riwayat;
  const skorAkhir = riwayat.at(-1)?.skorAkumulasi ?? game.pemain.map(() => 0);
  const skor = skorAkhir[kursi] ?? 0;
  const selesai = game.status === 'selesai';
  return {
    menang: selesai && skorAkhir.every((s, i) => i === kursi || skor >= s),
    skor,
    mentung: riwayat.filter((h) => h.pementung === kursi).length,
    kepentung: riwayat.filter((h) => h.kepentung.includes(kursi)).length,
    putaran: riwayat.length,
    selesai,
  };
}

/** Satu percobaan yang tercatat (bahan papan dan juara mingguan). */
export interface PercobaanSprint {
  nama: string;
  /** kunciNama(nama); kosong = dihitung dari nama. */
  kunci?: string;
  /** Kapan dicatat (ms epoch). */
  waktu: number;
  menang: boolean;
  skor: number;
  mentung: number;
  kepentung: number;
}

/** Satu baris papan sprint (jumlah semua percobaan di periodenya). */
export interface BarisSprint {
  nama: string;
  menang: number;
  mentung: number;
  kepentung: number;
  skor: number;
  /** Berapa kali juara mingguan (minggu yang sudah lewat), sepanjang masa. */
  piala: number;
}

export const KOLOM_SPRINT = ['menang', 'mentung', 'kepentung', 'skor'] as const;
export type KolomSprint = (typeof KOLOM_SPRINT)[number];

const kunciDari = (p: PercobaanSprint) => p.kunci || kunciNama(p.nama);

/**
 * Jumlahkan percobaan per orang (nama tanpa beda huruf besar/kecil, kunciNama). Ejaan yang tampil:
 * `ejaan` kalau ada, selain itu ejaan percobaan paling akhir. Urutan hasil: urutan bawaan.
 */
export function rekapSprint(
  percobaan: readonly PercobaanSprint[],
  ejaan?: ReadonlyMap<string, string>,
  piala?: ReadonlyMap<string, number>,
): BarisSprint[] {
  const per = new Map<string, BarisSprint & { w: number }>();
  for (const p of percobaan) {
    const kunci = kunciDari(p);
    let b = per.get(kunci);
    if (!b) {
      b = { nama: p.nama, menang: 0, mentung: 0, kepentung: 0, skor: 0, piala: piala?.get(kunci) ?? 0, w: -Infinity };
      per.set(kunci, b);
    }
    if (p.waktu >= b.w) {
      b.nama = p.nama;
      b.w = p.waktu;
    }
    if (p.menang) b.menang++;
    b.mentung += p.mentung;
    b.kepentung += p.kepentung;
    b.skor += p.skor;
  }
  const baris = [...per].map(([kunci, { w: _w, ...b }]) => ({ ...b, nama: ejaan?.get(kunci) ?? b.nama }));
  return urutkanSprint(baris);
}

/**
 * Urutkan papan sprint. Bawaan: menang terbanyak, lalu skor tertinggi, mentung terbanyak, kepentung
 * tersedikit, lalu nama. `kolom` (pemain mengetuk judul kolom): kolom itu didahulukan (kepentung dari
 * yang tersedikit, yang lain dari yang terbanyak), sisanya urutan bawaan. Mengembalikan salinan.
 */
export function urutkanSprint<T extends Omit<BarisSprint, 'piala'>>(baris: readonly T[], kolom?: KolomSprint | null): T[] {
  const bawaan = (a: T, b: T) =>
    b.menang - a.menang ||
    b.skor - a.skor ||
    b.mentung - a.mentung ||
    a.kepentung - b.kepentung ||
    kunciNama(a.nama).localeCompare(kunciNama(b.nama), 'id-ID') ||
    a.nama.localeCompare(b.nama, 'id-ID');
  const depan = (a: T, b: T) => {
    if (!kolom || !(KOLOM_SPRINT as readonly string[]).includes(kolom)) return 0;
    return kolom === 'kepentung' ? a.kepentung - b.kepentung : b[kolom] - a[kolom];
  };
  return [...baris].sort((a, b) => depan(a, b) || bawaan(a, b));
}

/** Juara satu minggu yang sudah lewat. */
export interface JuaraMingguan {
  /** Awal minggunya (awalMingguWib). */
  mulai: number;
  kunci: string;
  nama: string;
}

/**
 * Juara mingguan: untuk setiap minggu WIB yang sudah lewat (sebelum minggu `sekarang`) yang punya
 * paling sedikit satu percobaan, baris pertama papan minggu itu menurut urutan bawaan. Urut dari minggu
 * paling lama.
 */
export function juaraMingguan(percobaan: readonly PercobaanSprint[], sekarang: number): JuaraMingguan[] {
  const mingguIni = awalMingguWib(sekarang);
  const per = new Map<number, PercobaanSprint[]>();
  for (const p of percobaan) {
    const m = awalMingguWib(p.waktu);
    if (m >= mingguIni) continue;
    let xs = per.get(m);
    if (!xs) per.set(m, (xs = []));
    xs.push(p);
  }
  const hasil: JuaraMingguan[] = [];
  for (const m of [...per.keys()].sort((a, b) => a - b)) {
    const pertama = rekapSprint(per.get(m)!)[0];
    if (pertama) hasil.push({ mulai: m, kunci: kunciNama(pertama.nama), nama: pertama.nama });
  }
  return hasil;
}

/** Banyaknya piala juara mingguan per orang (kunciNama). */
export function pialaSprint(juara: readonly JuaraMingguan[]): Map<string, number> {
  const n = new Map<string, number>();
  for (const j of juara) n.set(j.kunci, (n.get(j.kunci) ?? 0) + 1);
  return n;
}
