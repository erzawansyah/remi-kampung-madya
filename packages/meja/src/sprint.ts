// Sprint (keputusan pemilik 25 Nov 2026, diubah 26 Nov 2026): satu pemain lawan lima warga kedai level
// Suhu, 6 pemain (2 deck), tanpa batas putaran: main sepuasnya sampai pemainnya Keluar, dan setiap putaran
// yang selesai langsung dicatat di papan. Hanya online (dijalankan server, supaya rekornya tidak bisa
// diakali dari HP). Semua aturan hitung sprint (pengaturan, hasil per putaran, papan, juara mingguan) hanya
// di sini, dipakai server dan aplikasi. Jangan dihitung ulang di tempat lain.

import { BATAS_PERISTIWA_VIEW, type GameState, type HasilPutaran, type LevelBot } from '@remi/engine';
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
 * Hasil putaran `riwayat[indeks]` untuk kursi `kursi` (kursi pemain sesudah urutan duduk diacak). Skor
 * putaran = selisih skor akumulasi dengan putaran sebelumnya, untuk semua kursi. `dibuang` = putaran awal
 * yang sudah dibuang dari riwayat (GameState.riwayatDibuang), jadi nomor putarannya `dibuang + indeks + 1`;
 * kalau `dibuang` > 0, `indeks` 0 tidak bisa dihitung (putaran sebelumnya sudah tidak ada) dan tidak boleh diminta.
 */
export function hasilPutaranSprint(riwayat: RiwayatSprint, indeks: number, kursi: number, dibuang = 0): HasilPutaranSprint {
  const h = riwayat[indeks];
  const sebelum = indeks > 0 ? riwayat[indeks - 1].skorAkumulasi : [];
  const skorPutaran = h.skorAkumulasi.map((s, i) => s - (sebelum[i] ?? 0));
  const skor = skorPutaran[kursi] ?? 0;
  return {
    putaran: dibuang + indeks + 1,
    menang: skorPutaran.every((s, i) => i === kursi || skor >= s),
    skor,
    mentung: h.pementung === kursi ? 1 : 0,
    kepentung: h.kepentung.includes(kursi) ? 1 : 0,
  };
}

/**
 * Putaran sprint yang sudah selesai dan masih ada di riwayat, untuk kursi pemain. Menerima GameState maupun
 * ViewPemain. Kalau riwayat awalnya sudah dibuang (riwayatDibuang), putaran tertua yang tersisa tidak ikut
 * (skornya tidak bisa dihitung tanpa putaran sebelumnya).
 */
export function hasilSprint(game: Pick<GameState, 'riwayat' | 'riwayatDibuang'>, kursi: number): HasilPutaranSprint[] {
  const dibuang = game.riwayatDibuang ?? 0;
  return game.riwayat.flatMap((_, i) => (dibuang > 0 && i === 0 ? [] : [hasilPutaranSprint(game.riwayat, i, kursi, dibuang)]));
}

/** Berapa putaran terakhir yang tetap ada di riwayat meja sprint (dengan rincian kartu jadi dan kartu tangan). */
export const PUTARAN_RINCI_SPRINT = 10;

/**
 * Meja sprint tidak pernah selesai sendiri (keputusan pemilik 27 Nov 2026: "jumlah mainnya bisa sampe
 * ratusan"), jadi state permainannya (dan view yang dikirim tiap aksi, simpanan meja, dan setiap
 * salinannya) tidak boleh tumbuh tiap putaran. Dipanggil meja sprint setiap putaran baru dimulai;
 * mengembalikan state baru, `g` tidak diubah (entri riwayat tidak pernah diubah, hanya dibuang/disalin).
 * - `log`: hanya putaran yang sedang jalan dan putaran sebelumnya.
 * - `peristiwa`: hanya BATAS_PERISTIWA_VIEW terakhir (yang memang dikirim di view; id berikutnya tetap
 *   meneruskan id terakhir).
 * - `riwayat`: hanya PUTARAN_RINCI_SPRINT putaran terakhir; yang lebih lama dibuang dan dihitung di
 *   `riwayatDibuang` (nomor putaran tetap lanjut, skor total tetap di `skor`). Putaran yang belum dicatat
 *   server (indeks ≥ `putaranTercatat`) tidak pernah dibuang, begitu juga satu putaran tepat sebelumnya
 *   (skor putaran = selisih skor akumulasi dengan putaran sebelumnya). Kalau pencatatan tertinggal,
 *   putaran di luar PUTARAN_RINCI_SPRINT terakhir yang masih ditahan dibuang kartunya saja.
 * Meja biasa tidak pernah memakai ini (golden tetap).
 */
export function rampingkanGameSprint(g: GameState, putaranTercatat: number): GameState {
  const dibuangLama = g.riwayatDibuang ?? 0;
  const total = dibuangLama + g.riwayat.length;
  const nomor = g.putaran?.nomor ?? total + 1;
  const dibuang = Math.max(dibuangLama, Math.min(total - PUTARAN_RINCI_SPRINT, putaranTercatat - 1));
  const sisa = dibuang > dibuangLama ? g.riwayat.slice(dibuang - dibuangLama) : g.riwayat;
  const batasRinci = sisa.length - PUTARAN_RINCI_SPRINT;
  const ramping = (h: HasilPutaran): HasilPutaran =>
    h.rincian.every((r) => !r.kartuJadi.length && !r.tangan.length && !r.nilaiKartuTangan.length)
      ? h
      : { ...h, rincian: h.rincian.map((r) => ({ ...r, kartuJadi: [], tangan: [], nilaiKartuTangan: [] })) };
  const riwayat = sisa.map((h, i) => (i < batasRinci ? ramping(h) : h));
  const log = g.log.filter((e) => e.putaran >= nomor - 1);
  const peristiwa = g.peristiwa.length > BATAS_PERISTIWA_VIEW ? g.peristiwa.slice(-BATAS_PERISTIWA_VIEW) : g.peristiwa;
  return { ...g, riwayat, log, peristiwa, ...(dibuang > 0 ? { riwayatDibuang: dibuang } : {}) };
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
  /**
   * Berapa putaran yang selesai dimainkan di catatan ini. Tidak ada = 1 (catatan per putaran sejak
   * 26 Nov 2026); baris lama 0.8.0 membawa kolom `putaran`-nya sendiri (putaran yang selesai di percobaan itu).
   */
  putaran?: number;
}

/** Satu baris papan sprint (jumlah semua catatan di periodenya). */
export interface BarisSprint {
  nama: string;
  /** Putaran yang selesai dimainkan (permintaan pemilik 27 Nov 2026). */
  putaran: number;
  menang: number;
  mentung: number;
  kepentung: number;
  skor: number;
  /** Berapa kali juara mingguan (minggu yang sudah lewat), sepanjang masa. */
  piala: number;
}

/** Kolom angka papan, urut seperti di layar. */
export const KOLOM_SPRINT = ['putaran', 'menang', 'mentung', 'kepentung', 'skor'] as const;
export type KolomSprint = (typeof KOLOM_SPRINT)[number];

const kunciDari = (p: PercobaanSprint) => p.kunci || kunciNama(p.nama);

/** Putaran yang dibawa satu catatan: `putaran` kalau bilangan bulat ≥ 0, selain itu 1. */
export const putaranCatatan = (p: Pick<PercobaanSprint, 'putaran'>): number =>
  typeof p.putaran === 'number' && Number.isInteger(p.putaran) && p.putaran >= 0 ? p.putaran : 1;

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
      b = { nama: p.nama, putaran: 0, menang: 0, mentung: 0, kepentung: 0, skor: 0, piala: piala?.get(kunci) ?? 0, w: -Infinity };
      per.set(kunci, b);
    }
    if (p.waktu >= b.w) {
      b.nama = p.nama;
      b.w = p.waktu;
    }
    b.putaran += putaranCatatan(p);
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
 * tersedikit, lalu nama (putaran tidak ikut urutan bawaan). `kolom` (pemain mengetuk judul kolom): kolom
 * itu didahulukan (kepentung dari yang tersedikit, yang lain dari yang terbanyak), sisanya urutan bawaan.
 * Mengembalikan salinan.
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
