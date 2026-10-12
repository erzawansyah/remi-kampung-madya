// Membuat instance Phaser sekali. Kanvas digambar dengan resolusi perangkat (devicePixelRatio)
// lalu di-zoom balik supaya tajam di layar HP.

import Phaser from 'phaser';
import { MejaScene } from './MejaScene';

export interface PenampungGame {
  game: Phaser.Game;
  scene: Promise<MejaScene>;
}

export function buatGame(parent: HTMLElement): PenampungGame {
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
    input: { activePointers: 2 },
    render: { antialias: true, roundPixels: false },
  });
  game.events.once(Phaser.Core.Events.READY, () => siap(adegan));
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
