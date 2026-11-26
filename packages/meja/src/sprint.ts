// Sprint (keputusan pemilik 25 Nov 2026, diubah 26 Nov 2026): satu pemain lawan lima warga kedai level
// Suhu, 6 pemain (2 deck), tanpa batas putaran: main sepuasnya sampai pemainnya Keluar, dan setiap putaran
// yang selesai langsung dicatat di papan. Hanya online (dijalankan server, supaya rekornya tidak bisa
// diakali dari HP). Semua aturan hitung sprint (pengaturan, hasil per putaran, papan, juara mingguan) hanya
// di sini, dipakai server dan aplikasi. Jangan dihitung ulang di tempat lain.

import type { GameState, HasilPutaran, LevelBot } from '@remi/engine';
import { WIB_MS } from './peringkat.js';
import type { PengaturanMeja } from './protokol.js';
import { kunciNama } from './validasi.js';

/** Level warga kedai di semua putaran sprint. */
export const LEVEL_SPRINT: LevelBot = 'suhu';

/**
 * Lima lawan sprint (lima nama terdepan NAMA_LAWAN_BAWAAN), masing-masing main dengan gaya personanya
 * (#47). Kalau nama pemain sama dengan salah satunya, warga kedai itu diganti nama berikutnya di
 * NAMA_LAWAN_BAWAAN (tafsiran pengembang).
 */
export const NAMA_LAWAN_SPRINT: readonly string[] = ['Kipas Dua', 'Cak Kopag', 'Mbak Teras', 'Mas Sampul', 'Si Rak'];

/**
 * Pengaturan meja sprint (dikunci): 6 pemain (jadi 2 deck, 9 kartu per orang), tanpa batas putaran,
 * tanpa batas skor, tanpa batas waktu giliran, tempo warga kedai cepat (pemain tetap boleh mengganti
 * tempo selama main). Mode kaldu mati (tidak ditulis = mati), jadi permainannya tidak pernah selesai
 * sendiri. Urutan duduk selalu diacak (#62), meja privat tapi boleh ditonton.
 */
export const PENGATURAN_SPRINT: Readonly<PengaturanMeja> = Object.freeze({
  jumlahPemain: 6,
  duaDeckUntukEmpat: false,
  batasPutaran: null,
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

/** Hasil satu putaran sprint untuk kursi pemain (satu baris papan). */
export interface HasilPutaranSprint {
  /** Nomor putaran (1, 2, ...). */
  putaran: number;
  /** Skor putaran ini ≥ skor putaran ini setiap warga kedai (seri = menang). */
  menang: boolean;
  /** Skor pemain di putaran ini saja. */
  skor: number;
  /** 1 kalau pemain menutup putaran ini dengan mentung, selain itu 0. */
  mentung: number;
  /** 1 kalau pemain kepentung di putaran ini, selain itu 0. */
  kepentung: number;
}

type RiwayatSprint = readonly Pick<HasilPutaran, 'pementung' | 'kepentung' | 'skorAkumulasi'>[];

/**
 * Hasil putaran ke-`indeks` (0 = putaran pertama) untuk kursi `kursi` (kursi pemain sesudah urutan duduk
 * diacak). Skor putaran = selisih skor akumulasi dengan putaran sebelumnya, untuk semua kursi.
 */
export function hasilPutaranSprint(riwayat: RiwayatSprint, indeks: number, kursi: number): HasilPutaranSprint {
  const h = riwayat[indeks];
  const sebelum = indeks > 0 ? riwayat[indeks - 1].skorAkumulasi : [];
  const skorPutaran = h.skorAkumulasi.map((s, i) => s - (sebelum[i] ?? 0));
  const skor = skorPutaran[kursi] ?? 0;
  return {
    putaran: indeks + 1,
    menang: skorPutaran.every((s, i) => i === kursi || skor >= s),
    skor,
    mentung: h.pementung === kursi ? 1 : 0,
    kepentung: h.kepentung.includes(kursi) ? 1 : 0,
  };
}

/** Semua putaran sprint yang sudah selesai untuk kursi pemain. Menerima GameState maupun ViewPemain. */
export function hasilSprint(game: Pick<GameState, 'riwayat'>, kursi: number): HasilPutaranSprint[] {
  return game.riwayat.map((_, i) => hasilPutaranSprint(game.riwayat, i, kursi));
}

/**
 * Satu catatan papan (bahan papan dan juara mingguan): sejak 26 Nov 2026 satu putaran (menang, mentung,
 * kepentung 0/1); baris lama 0.8.0 satu percobaan 5 putaran (mentung/kepentung bisa lebih dari 1).
 */
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

/** Satu baris papan sprint (jumlah semua catatan di periodenya). */
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
 * Jumlahkan catatan (putaran, atau percobaan 0.8.0) per orang (nama tanpa beda huruf besar/kecil, kunciNama). Ejaan yang tampil:
 * `ejaan` kalau ada, selain itu ejaan catatan paling akhir. Urutan hasil: urutan bawaan.
 */
export function rekapSprint(
  catatan: readonly PercobaanSprint[],
  ejaan?: ReadonlyMap<string, string>,
  piala?: ReadonlyMap<string, number>,
): BarisSprint[] {
  const per = new Map<string, BarisSprint & { w: number }>();
  for (const p of catatan) {
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
 * paling sedikit satu catatan, baris pertama papan minggu itu menurut urutan bawaan. Urut dari minggu
 * paling lama.
 */
export function juaraMingguan(catatan: readonly PercobaanSprint[], sekarang: number): JuaraMingguan[] {
  const mingguIni = awalMingguWib(sekarang);
  const per = new Map<number, PercobaanSprint[]>();
  for (const p of catatan) {
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
