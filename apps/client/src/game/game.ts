// Membuat instance Phaser sekali, saat meja pertama kali dibuka. Phaser (±1,4 MB mentah, ±300 KB terkompresi)
// TIDAK ikut dimuat di beranda: chunk-nya diambil lewat import() dinamis (gamePhaser.ts), lebih dulu saat
// browser senggang sesudah beranda tampil (pramuatGame), jadi membuka meja tetap cepat.

import type Phaser from 'phaser';
import type { MejaScene } from './MejaScene';

/**
 * Pegangan game yang Phaser-nya dimuat belakangan. `asli` null sampai chunk Phaser selesai dimuat; tidur/bangun
 * yang diminta sebelum itu diingat dan diterapkan begitu game jadi.
 */
export interface GameMalas {
  asli: Phaser.Game | null;
  tidur: boolean;
  /** Phaser sudah boot (READY) dan loop-nya sudah pernah jalan: baru boleh ditidurkan/dibangunkan. */
  siap: boolean;
}

export interface PenampungGame {
  game: GameMalas;
  scene: Promise<MejaScene>;
}

type ModulPhaser = typeof import('./gamePhaser');
let muatModul: Promise<ModulPhaser> | null = null;
let imporPhaser = (): Promise<ModulPhaser> => import('./gamePhaser');

/** Khusus test: ganti cara mengambil chunk Phaser (mis. simulasi gagal jaringan). */
export function _aturImporPhaser(impor: () => Promise<ModulPhaser>): void {
  imporPhaser = impor;
  muatModul = null;
}

/**
 * Ambil chunk Phaser sekali. Kalau gagal (sinyal putus, 404 sesudah deploy), promise-nya dibuang supaya
 * percobaan berikutnya benar-benar meminta lagi, bukan menerima penolakan lama selamanya.
 */
function modulPhaser(): Promise<ModulPhaser> {
  if (muatModul) return muatModul;
  const p = imporPhaser();
  muatModul = p;
  p.catch(() => {
    if (muatModul === p) muatModul = null;
  });
  return p;
}

/**
 * Batas tunggu Phaser boot (READY) sesudah chunk-nya termuat. Normalnya < 1 detik; lebih dari ini berarti
 * macet (mis. konteks grafis gagal dibuat), dan pemain diberi jalan keluar alih-alih kanvas kosong.
 */
export const BATAS_BOOT_MS = 20_000;

export function buatGame(parent: HTMLElement): PenampungGame {
  const g: GameMalas = { asli: null, tidur: false, siap: false };
  const scene = modulPhaser().then(
    ({ mulaiPhaser }) =>
      new Promise<MejaScene>((ok, gagal) => {
        const h = mulaiPhaser(parent);
        g.asli = h.game;
        const batas = setTimeout(() => {
          // Boot tidak pernah selesai: buang game setengah jadi (kanvasnya ikut dilepas) supaya
          // percobaan berikutnya mulai bersih.
          g.asli = null;
          try {
            h.game.destroy(true);
          } catch {
            // Game yang belum boot bisa menolak dihancurkan; abaikan.
          }
          gagal(new Error('Phaser tidak siap dalam batas waktu'));
        }, BATAS_BOOT_MS);
        h.scene.then((s) => {
          clearTimeout(batas);
          if (g.asli !== h.game) return;
          g.siap = true;
          // Layar sudah pindah (mis. kembali ke beranda) sebelum Phaser siap: loop yang baru menyala ditidurkan.
          if (g.tidur) tidurkanGame(g);
          ok(s);
        });
      }),
  );
  return { game: g, scene };
}

/**
 * Muat chunk Phaser lebih dulu saat browser senggang (sesudah beranda tampil), supaya membuka meja tidak
 * menunggu unduhan & parse. Aman dipanggil berulang. Dipanggil otomatis sekali saat modul ini dimuat.
 */
export function pramuatGame(): void {
  type Senggang = (cb: () => void, opsi?: { timeout: number }) => number;
  const senggang = (window as unknown as { requestIdleCallback?: Senggang }).requestIdleCallback;
  let sudah = false;
  const mulai = () => {
    if (sudah) return;
    sudah = true;
    window.removeEventListener('pointerdown', mulai, true);
    window.removeEventListener('keydown', mulai, true);
    // Sinyal jelas putus: jangan memancing kegagalan di belakang layar (Chrome mengingatnya per URL).
    if (navigator.onLine === false) return;
    void modulPhaser().catch(() => undefined);
  };
  // Evaluasi Phaser satu tugas panjang (±250 ms di HP menengah), jadi jangan berebut dengan tampilan pertama
  // beranda: mulai saat pemain pertama kali menyentuh/mengetik (biasanya menuju meja), atau saat senggang
  // beberapa detik sesudah 'load'. Unduhannya sendiri juga sudah dicakup precache service worker.
  window.addEventListener('pointerdown', mulai, { capture: true, passive: true });
  window.addEventListener('keydown', mulai, true);
  const nanti = () => setTimeout(() => (senggang ? senggang(mulai, { timeout: 4000 }) : mulai()), 6000);
  if (document.readyState === 'complete') nanti();
  else window.addEventListener('load', nanti, { once: true });
}

if (typeof window !== 'undefined' && typeof document !== 'undefined') pramuatGame();

/**
 * Hentikan loop Phaser (tidak menggambar sama sekali) saat meja tidak tampil, mis. di beranda/lobi.
 * Hemat baterai HP. Panggil bangunkanGame() sebelum meja ditampilkan lagi.
 */
export function tidurkanGame(g: GameMalas): void {
  g.tidur = true;
  if (g.siap && g.asli?.loop.running) g.asli.loop.sleep();
}

/** Jalankan lagi loop Phaser yang ditidurkan tidurkanGame(). Aman dipanggil berulang. */
export function bangunkanGame(g: GameMalas): void {
  g.tidur = false;
  // Sebelum boot selesai, loop belum pernah jalan: membangunkannya sekarang akan menjalankan langkah
  // game yang belum siap. Phaser menyalakan loop-nya sendiri saat boot.
  if (g.siap && g.asli && !g.asli.loop.running) g.asli.loop.wake(true);
}
