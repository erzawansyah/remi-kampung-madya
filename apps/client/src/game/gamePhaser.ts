// Bagian yang butuh Phaser: membuat instance Phaser.Game dengan MejaScene. Modul ini (dan chunk Phaser
// ±300 KB terkompresi) hanya dimuat lewat import() dinamis dari game.ts saat meja pertama kali dibuka atau
// saat browser senggang, jadi beranda tampil tanpa menunggu Phaser diunduh & di-parse.
// Kanvas digambar dengan resolusi perangkat (devicePixelRatio) lalu di-zoom balik supaya tajam di layar HP.

import Phaser from 'phaser';
import { MejaScene } from './MejaScene';

export interface HasilPhaser {
  game: Phaser.Game;
  /** Selesai saat Phaser siap (event READY) dan MejaScene sudah dibuat. */
  scene: Promise<MejaScene>;
}

export function mulaiPhaser(parent: HTMLElement): HasilPhaser {
  const dpr = () => window.devicePixelRatio || 1;
  let siap!: (s: MejaScene) => void;
  const scene = new Promise<MejaScene>((ok) => (siap = ok));
  const adegan = new MejaScene();

  const game = new Phaser.Game({
    type: Phaser.AUTO,
    parent,
    transparent: true,
    width: window.innerWidth * dpr(),
    height: window.innerHeight * dpr(),
    scale: { mode: Phaser.Scale.NONE, zoom: 1 / dpr() },
    scene: [adegan],
    banner: false,
    // windowEvents: false → Phaser hanya mendengar sentuhan/klik di kanvas sendiri. Tanpa ini, tap pada
    // tombol HTML (menu, modal) yang kebetulan berada di atas deck/kartu ikut diproses sebagai aksi meja.
    input: { activePointers: 2, windowEvents: false },
    // Semua suara lewat efek/suara.ts (Web Audio sendiri); Phaser tidak perlu AudioContext kedua.
    audio: { noAudio: true },
    render: { antialias: true, roundPixels: false },
  });
  game.events.once(Phaser.Core.Events.READY, () => {
    tangkapPointerMouse(game.canvas);
    siap(adegan);
  });
  // Untuk debug saat pengembangan.
  if (import.meta.env.DEV) (window as unknown as { __remi: unknown }).__remi = { game, adegan };

  const ukurUlang = () => {
    game.scale.resize(window.innerWidth * dpr(), window.innerHeight * dpr());
    game.scale.setZoom(1 / dpr());
  };
  window.addEventListener('resize', ukurUlang);
  window.visualViewport?.addEventListener('resize', ukurUlang);
  return { game, scene };
}

/**
 * Seret dengan mouse yang dilepas di atas elemen HTML (bar aksi) tetap harus diakhiri: tangkap pointer
 * di kanvas selama tombol ditekan, jadi mouseup tetap sampai ke kanvas walau windowEvents mati.
 * Sentuhan tidak perlu: event sentuh selalu dikirim ke elemen tempat jari mulai menyentuh.
 */
function tangkapPointerMouse(canvas: HTMLCanvasElement) {
  canvas.addEventListener('pointerdown', (e) => {
    if (e.pointerType !== 'mouse') return;
    try {
      canvas.setPointerCapture(e.pointerId);
    } catch {
      // Pointer sudah tidak aktif: abaikan.
    }
  });
}
