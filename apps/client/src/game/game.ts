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
}

export interface PenampungGame {
  game: GameMalas;
  scene: Promise<MejaScene>;
}

type ModulPhaser = typeof import('./gamePhaser');
let muatModul: Promise<ModulPhaser> | null = null;
const modulPhaser = (): Promise<ModulPhaser> => (muatModul ??= import('./gamePhaser'));

export function buatGame(parent: HTMLElement): PenampungGame {
  const g: GameMalas = { asli: null, tidur: false };
  const scene = modulPhaser().then(({ mulaiPhaser }) => {
    const h = mulaiPhaser(parent);
    g.asli = h.game;
    return h.scene.then((s) => {
      // Layar sudah pindah (mis. kembali ke beranda) sebelum Phaser siap: loop yang baru menyala ditidurkan.
      if (g.tidur) tidurkanGame(g);
      return s;
    });
  });
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
    void modulPhaser().catch(() => (muatModul = null));
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
  if (g.asli?.loop.running) g.asli.loop.sleep();
}

/** Jalankan lagi loop Phaser yang ditidurkan tidurkanGame(). Aman dipanggil berulang. */
export function bangunkanGame(g: GameMalas): void {
  g.tidur = false;
  if (g.asli && !g.asli.loop.running) g.asli.loop.wake(true);
}
