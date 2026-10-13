// Tekstur kartu untuk Phaser. Gambarnya dari kartuGrafisGambar.ts (Canvas 2D, tanpa file gambar → aman offline).
//
// Tiga tingkat resolusi, semuanya satu kunci tekstur per kartu (bisa langsung dipakai di this.add.image):
// - normal  `kunciMuka(b, r)` / KUNCI_PUNGGUNG: punggung dibuat di create(); muka dibuat saat pertama
//           diminta, sisanya dicicil saat senggang (panaskanTeksturKartu). Lebar ≈ 80 px CSS × dpr (200–240 px).
// - mini    `kartu-mini-…`: desain indeks raksasa untuk kartu < 36 px CSS. Dibuat saat pertama diminta.
//   Punggung tingkat normal punya dua isi medali: maskot (KUNCI_PUNGGUNG) untuk kartu yang tampil besar,
//   siluet cangkir (KUNCI_PUNGGUNG_SILUET) kalau maskotnya akan tampil < 28 px CSS (logoPunggungUntuk).
// - besar   `kartu-besar-…`: untuk panggung/pentungan (≈ 190 px CSS × dpr, maks 576 px). Dibuat saat
//           diminta dan dibuang lagi kalau sudah tidak tampil (hanya 4 cadangan yang disimpan).
// Ambil kunci yang pas lewat kunciKartu(scene, kartu, lebarTampil).
//
// Anggaran memori (HP dpr 3, RGBA): normal 53 × 240×336 ≈ 17 MB, mini ≤ 53 × 120×168 ≈ 4 MB,
// besar ≈ 1,9 MB per kartu (biasanya 1–4 kartu), pendukung < 1 MB. Kanvas sumbernya ikut tersimpan di RAM
// (ukurannya sama) supaya bisa digambar ulang dan dipulihkan saat konteks WebGL hilang.
// Bandingkan: kalau semua kartu 576 px, butuh ±100 MB. Tanpa mipmap (WebGL1 hanya untuk tekstur
// pangkat dua), jadi tingkat mini yang menjaga kartu kecil tetap tajam.

import Phaser from 'phaser';
import { SEMUA_BUNGA, SEMUA_RANK, type Bunga, type Rank } from '@remi/engine';
import { preferensi, type WarnaKartu } from '../preferensi';
import {
  BATAS_MINI_CSS,
  gambarBayangan,
  gambarFokus,
  gambarKartu,
  gambarSorot,
  logoPunggungUntuk,
  RASIO_KARTU,
  ukuranPendukung,
  type GayaKartu,
  type KartuGambar,
  type LogoPunggung,
} from './kartuGrafisGambar';

export {
  BATAS_MINI_CSS,
  gambarBunga,
  gambarKartu,
  gambarKartuKeKanvas,
  PAD_PENDUKUNG,
  RASIO_KARTU,
  RASIO_SUDUT,
  warnaBunga,
  type KartuGambar,
} from './kartuGrafisGambar';

export function kunciMuka(bunga: Bunga, rank: Rank): string {
  return `kartu-${bunga}-${rank}`;
}
/**
 * Versi desain punggung. Naikkan tiap kali gambar punggung berubah: kunci tekstur ikut berganti, jadi
 * tekstur lama yang masih tersimpan di TextureManager (mis. setelah HMR) tidak terpakai lagi.
 * v2: punggung Kedai Madya (arang + kawung kuning + medali maskot cangkir).
 * v3: maskot hanya kalau tampil ≥ 28 px CSS; kartu normal yang lebih kecil berisi siluet cangkir.
 */
const VERSI_PUNGGUNG = 3;
export const KUNCI_PUNGGUNG = `kartu-punggung-v${VERSI_PUNGGUNG}`;
/** Punggung tingkat normal dengan siluet cangkir (kartu yang maskotnya akan tampil terlalu kecil). */
export const KUNCI_PUNGGUNG_SILUET = `kartu-punggung-siluet-v${VERSI_PUNGGUNG}`;
/** Bayangan lembut hitam di bawah kartu terbang/terangkat. Ukur dengan ukuranBayangan(); alpha diatur scene. */
export const KUNCI_BAYANGAN = 'kartu-bayangan';
/** Cincin kuning MADYA bercahaya untuk kartu terpilih/wajib/bisa (sama untuk semua kartu). Ukur dengan ukuranSorot(). v2: kuning #f1a615. */
export const KUNCI_SOROT = 'kartu-sorot-v2';
/** Cincin fokus keyboard: putih tebal bergaris luar gelap, tanpa pendar (beda jelas dari cincin emas 'bisa'). */
export const KUNCI_FOKUS = 'kartu-fokus';

type Tingkat = 'mini' | 'normal' | 'besar';

interface Isi {
  kartu: KartuGambar | null;
  gaya: GayaKartu;
  /** Isi medali punggung (muka kartu: diabaikan). */
  logo: LogoPunggung;
  /** Mode warna saat terakhir digambar (punggung tidak terpengaruh). */
  mode: WarnaKartu;
}

interface Daftar {
  lebar: Record<Tingkat, number>;
  isi: Map<string, Isi>;
  /** Kunci tekstur besar, urut dari yang paling lama tidak diminta. */
  besar: Set<string>;
}

/** Simpan per TextureManager (tiap Phaser.Game punya sendiri). */
const daftarPerManager = new WeakMap<Phaser.Textures.TextureManager, Daftar>();

/** Jumlah tekstur besar yang tidak sedang tampil tapi tetap disimpan (supaya tidak digambar ulang terus). */
const CADANGAN_BESAR = 4;

const kelipatan8 = (x: number) => Math.round(x / 8) * 8;
const jepit = (x: number, min: number, maks: number) => Math.min(maks, Math.max(min, x));
const dprSekarang = () => window.devicePixelRatio || 1;

function hitungLebar(dpr: number): Record<Tingkat, number> {
  const normal = jepit(kelipatan8(80 * dpr), 200, 240);
  return {
    normal,
    mini: jepit(kelipatan8(40 * dpr), 64, 120),
    besar: Math.max(normal, jepit(kelipatan8(190 * dpr), 256, 576)),
  };
}

function kunciTingkat(kartu: KartuGambar | null, tingkat: Tingkat, logo: LogoPunggung = 'maskot'): string {
  if (tingkat === 'normal') return kartu ? kunciMuka(kartu.bunga, kartu.rank) : logo === 'siluet' ? KUNCI_PUNGGUNG_SILUET : KUNCI_PUNGGUNG;
  return kartu ? `kartu-${tingkat}-${kartu.bunga}-${kartu.rank}` : `kartu-${tingkat}-punggung-v${VERSI_PUNGGUNG}`;
}

function gambarKe(t: Phaser.Textures.CanvasTexture, isi: Isi) {
  const ctx = t.getContext();
  ctx.clearRect(0, 0, t.width, t.height);
  gambarKartu(ctx, isi.kartu, t.width, isi.gaya, isi.mode, isi.logo);
  t.refresh();
}

function buatKartu(
  textures: Phaser.Textures.TextureManager,
  daftar: Daftar,
  kunci: string,
  kartu: KartuGambar | null,
  tingkat: Tingkat,
  logo: LogoPunggung = 'maskot',
) {
  if (daftar.isi.has(kunci) && textures.exists(kunci)) return;
  const isi: Isi = { kartu, gaya: tingkat === 'mini' ? 'mini' : 'normal', logo, mode: preferensi().warnaKartu };
  if (textures.exists(kunci)) {
    // Tekstur sudah ada tapi belum tercatat (mis. dibuat instance modul lain saat HMR): ambil alih dan
    // gambar ulang dengan mode warna sekarang, supaya ganti warna berikutnya tidak melewatkannya.
    const lama = textures.get(kunci);
    if (!(lama instanceof Phaser.Textures.CanvasTexture)) return;
    gambarKe(lama, isi);
    daftar.isi.set(kunci, isi);
    return;
  }
  const w = daftar.lebar[tingkat];
  const t = textures.createCanvas(kunci, w, Math.round(w * RASIO_KARTU));
  if (!t) return;
  gambarKe(t, isi);
  daftar.isi.set(kunci, isi);
}

function buatPendukung(textures: Phaser.Textures.TextureManager, kunci: string, lebarKartu: number, gambar: (ctx: CanvasRenderingContext2D, lebar: number) => void) {
  if (textures.exists(kunci)) return;
  const { w, h } = ukuranPendukung(lebarKartu);
  const t = textures.createCanvas(kunci, Math.round(w), Math.round(h));
  if (!t) return;
  gambar(t.getContext(), lebarKartu);
  t.refresh();
}

function ambilDaftar(textures: Phaser.Textures.TextureManager): Daftar {
  let daftar = daftarPerManager.get(textures);
  if (!daftar) {
    daftar = { lebar: hitungLebar(dprSekarang()), isi: new Map(), besar: new Set() };
    daftarPerManager.set(textures, daftar);
  }
  return daftar;
}

/**
 * Daftarkan tekstur kartu ke Phaser (dipanggil di create(); aman dipanggil berulang).
 * Yang dibuat SEKARANG hanya punggung kartu dan tekstur pendukung (bayangan, cincin). Muka kartu tingkat
 * normal dibuat saat pertama diminta (kunciKartu) dan sisanya dicicil saat browser senggang
 * (panaskanTeksturKartu), supaya membuka meja tidak macet ±100 ms karena mengunggah 53 tekstur sekaligus.
 * `{ ulang: true }`: gambar ulang semua muka kartu yang sudah ada (normal, mini, besar) dengan preferensi
 * warna terbaru, tanpa mengganti kuncinya. Kalau mode warnanya tidak berubah, tidak ada yang digambar ulang,
 * jadi aman dipanggil dari saatPreferensiBerubah untuk perubahan apa pun.
 */
export function daftarkanTeksturKartu(textures: Phaser.Textures.TextureManager, opsi: { ulang?: boolean } = {}): void {
  const daftar = ambilDaftar(textures);
  buatKartu(textures, daftar, KUNCI_PUNGGUNG, null, 'normal');
  // Bayangan cukup resolusi rendah (isinya buram); sorot & fokus butuh garis tegas, jadi seukuran kartu normal.
  buatPendukung(textures, KUNCI_BAYANGAN, 112, gambarBayangan);
  buatPendukung(textures, KUNCI_SOROT, daftar.lebar.normal, gambarSorot);
  buatPendukung(textures, KUNCI_FOKUS, daftar.lebar.normal, gambarFokus);

  if (!opsi.ulang) return;
  const mode = preferensi().warnaKartu;
  for (const [kunci, isi] of daftar.isi) {
    if (!isi.kartu || isi.mode === mode) continue;
    const t = textures.get(kunci) as Phaser.Textures.CanvasTexture;
    isi.mode = mode;
    gambarKe(t, isi);
  }
}

type PanggilSenggang = (cb: (batas: { timeRemaining(): number; didTimeout: boolean }) => void, opsi?: { timeout: number }) => number;

/**
 * Cicil pembuatan tekstur muka kartu tingkat normal saat browser senggang (requestIdleCallback, atau
 * setTimeout sebagai cadangan): beberapa kartu per jatah, berhenti kalau jatahnya habis. `dulu` = kartu
 * yang dibuat lebih dulu (mis. kartu tanganku sebelum dibalik saat bagi). Selesai sendiri; aman dipanggil
 * berulang (kartu yang sudah ada dilewati). Mengembalikan fungsi untuk membatalkan.
 */
export function panaskanTeksturKartu(
  textures: Phaser.Textures.TextureManager,
  dulu: readonly KartuGambar[] = [],
): () => void {
  const daftar = ambilDaftar(textures);
  const antre: KartuGambar[] = [...dulu];
  for (const bunga of SEMUA_BUNGA) for (const rank of SEMUA_RANK) antre.push({ bunga, rank });
  let batal = false;
  const senggang = (window as unknown as { requestIdleCallback?: PanggilSenggang }).requestIdleCallback;
  const jadwal = (fn: (sisaMs: () => number) => void) => {
    if (senggang)
      senggang(
        (b) => {
          // Jatah habis waktu tunggu (browser sibuk terus): tetap dibatasi ±6 ms per jatah.
          const mulai = performance.now();
          fn(() => (b.didTimeout ? 6 - (performance.now() - mulai) : b.timeRemaining()));
        },
        { timeout: 300 },
      );
    else setTimeout(() => {
      const mulai = performance.now();
      fn(() => 8 - (performance.now() - mulai));
    }, 30);
  };
  const kerja = (sisaMs: () => number) => {
    if (batal) return;
    try {
      // Minimal satu kartu per jatah supaya pasti maju; berhenti kalau jatah ≲ 4 ms.
      do {
        const k = antre.shift();
        if (!k) return;
        const kunci = kunciMuka(k.bunga, k.rank);
        if (daftar.isi.has(kunci) && textures.exists(kunci)) continue;
        buatKartu(textures, daftar, kunci, k, 'normal');
      } while (antre.length && sisaMs() > 4);
    } catch {
      // Game sudah dihancurkan (TextureManager tidak berlaku lagi): berhenti diam-diam.
      return;
    }
    if (antre.length) jadwal(kerja);
  };
  jadwal(kerja);
  return () => {
    batal = true;
  };
}

/** Kunci tekstur yang sedang dipakai objek di scene (termasuk di dalam Container). */
function kunciTerpakai(scene: Phaser.Scene): Set<string> {
  const pakai = new Set<string>();
  const jelajah = (daftar: Phaser.GameObjects.GameObject[]) => {
    for (const o of daftar) {
      const t = (o as { texture?: Phaser.Textures.Texture }).texture;
      if (t) pakai.add(t.key);
      const anak = (o as { list?: unknown }).list;
      if (Array.isArray(anak)) jelajah(anak as Phaser.GameObjects.GameObject[]);
    }
  };
  jelajah(scene.children.list);
  return pakai;
}

/** Buang tekstur besar yang paling lama tidak diminta dan tidak sedang tampil, sisakan CADANGAN_BESAR. */
function rapikanBesar(scene: Phaser.Scene, daftar: Daftar, baruDiminta: string) {
  if (daftar.besar.size <= CADANGAN_BESAR) return;
  const terpakai = kunciTerpakai(scene);
  // Kunci yang baru saja diminta belum dipakai objek mana pun (objeknya baru akan dibuat): jangan dibuang.
  terpakai.add(baruDiminta);
  let lebih = daftar.besar.size - CADANGAN_BESAR;
  for (const kunci of [...daftar.besar]) {
    if (lebih <= 0) break;
    if (terpakai.has(kunci)) continue;
    scene.textures.remove(kunci);
    daftar.besar.delete(kunci);
    daftar.isi.delete(kunci);
    lebih--;
  }
}

/**
 * Kunci tekstur terbaik untuk kartu (null = punggung) yang akan tampil selebar `lebarTampil` piksel perangkat
 * (satuan yang sama dengan setDisplaySize di scene). Kartu kecil (< 36 px CSS) dapat desain mini,
 * kartu yang jauh lebih besar dari tekstur normal (panggung, pentungan) dapat tekstur besar.
 * Untuk animasi yang membesar/mengecil, mintalah sesuai ukuran TERBESAR yang akan dicapai.
 * Tekstur besar dibuang otomatis setelah tidak tampil, jadi jangan simpan objek bertekstur besar di luar scene.
 */
export function kunciKartu(scene: Phaser.Scene, kartu: KartuGambar | null, lebarTampil: number): string {
  if (!daftarPerManager.has(scene.textures)) daftarkanTeksturKartu(scene.textures);
  const daftar = daftarPerManager.get(scene.textures)!;
  const dpr = dprSekarang();
  const tingkat: Tingkat = lebarTampil / dpr < BATAS_MINI_CSS ? 'mini' : lebarTampil > daftar.lebar.normal * 1.15 ? 'besar' : 'normal';
  // Punggung tingkat normal: maskot hanya kalau cukup besar di layar, selain itu siluet cangkir.
  const logo: LogoPunggung = !kartu && tingkat === 'normal' ? logoPunggungUntuk(lebarTampil / dpr) : 'maskot';
  const kunci = kunciTingkat(kartu, tingkat, logo);
  buatKartu(scene.textures, daftar, kunci, kartu, tingkat, logo);
  if (tingkat === 'besar') {
    // Pindahkan ke ujung antrean (paling baru), lalu rapikan yang lama.
    daftar.besar.delete(kunci);
    daftar.besar.add(kunci);
    rapikanBesar(scene, daftar, kunci);
  }
  return kunci;
}

/** Ukuran tampil KUNCI_BAYANGAN untuk kartu selebar `lebarKartu` (kartu menempati bagian tengahnya). */
export const ukuranBayangan = (lebarKartu: number) => ukuranPendukung(lebarKartu);
/** Ukuran tampil KUNCI_SOROT untuk kartu selebar `lebarKartu` (pasang dengan pusat yang sama dengan kartu). */
export const ukuranSorot = (lebarKartu: number) => ukuranPendukung(lebarKartu);
