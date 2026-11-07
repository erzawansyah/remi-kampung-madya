// Kamera 2.5D untuk adegan meja kedai: panggung 1080 × 1920 ditaruh di ruang 3D CSS (perspective), tiap lapisan
// (latar, meja + tokoh, benda depan) di kedalaman translateZ sendiri. Kamera "dolly" dengan menggeser dunia ke
// arah sumbu Z, jadi lapisan dekat membesar dan bergeser lebih cepat daripada lapisan jauh (paralaks sungguhan),
// bukan sekadar zoom. Titik (x, y) di lapisan meja selalu jatuh di tengah layar. Nilai per frame dihitung dengan
// interpolate() di pemanggil (skill remotion-markup), kameraDari() hanya pembantu keyframe multi-nilai.
import type { ReactNode } from 'react';
import { AbsoluteFill } from 'remotion';
import { trek, type Ease, type Kunci } from './animasi';
import { H, W } from './waktu';

export interface PoseKamera {
  /** Titik yang dilihat kamera (koordinat panggung, lapisan meja). */
  x: number;
  y: number;
  /** Perbesaran lapisan meja (1 = pas frame). */
  skala: number;
  /** Dutch roll (derajat). */
  rot: number;
}

/** Jarak perspektif (px). Makin kecil, paralaks makin terasa. */
export const JARAK_PERSPEKTIF = 1500;
/** Kedalaman lapisan (translateZ): latar jauh di belakang, benda depan mendekat ke kamera. */
export const Z = { latar: -620, meja: 0, depan: 230 } as const;

/** Geser dunia ke arah kamera supaya lapisan meja (z = 0) tampak sebesar `skala`. */
export const zKamera = (skala: number): number => JARAK_PERSPEKTIF - JARAK_PERSPEKTIF / skala;

/** Perbesaran tampak sebuah lapisan di kedalaman z untuk pose kamera k. */
export const skalaLapisan = (k: PoseKamera, z: number): number => JARAK_PERSPEKTIF / (JARAK_PERSPEKTIF - zKamera(k.skala) - z);

/** Proyeksi titik panggung (lapisan z) ke layar. */
export function proyeksi(k: PoseKamera, x: number, y: number, z = 0): { x: number; y: number } {
  const s = skalaLapisan(k, z);
  const r = (k.rot * Math.PI) / 180;
  const dx = x - k.x;
  const dy = y - k.y;
  return { x: W / 2 + s * (dx * Math.cos(r) - dy * Math.sin(r)), y: H / 2 + s * (dx * Math.sin(r) + dy * Math.cos(r)) };
}

type KunciKamera = [frame: number, pose: PoseKamera, ease?: Ease];
/** Pose kamera di frame f dari daftar keyframe (tiap nilai di-ease terpisah). */
export function kameraDari(f: number, kunci: KunciKamera[]): PoseKamera {
  const ambil = (p: (k: PoseKamera) => number): Kunci<number>[] => kunci.map(([fr, k, e]) => [fr, p(k), e]);
  return { x: trek(f, ambil((k) => k.x)), y: trek(f, ambil((k) => k.y)), skala: trek(f, ambil((k) => k.skala)), rot: trek(f, ambil((k) => k.rot)) };
}

export const K = (x: number, y: number, skala: number, rot = 0): PoseKamera => ({ x, y, skala, rot });

/** Wadah kamera: perspective + dunia yang digeser/diputar. Anaknya berupa <Lapisan z={…}>. */
export const Kamera: React.FC<{ pose: PoseKamera; children?: ReactNode }> = ({ pose, children }) => (
  <AbsoluteFill style={{ overflow: 'hidden', perspective: `${JARAK_PERSPEKTIF}px`, perspectiveOrigin: '50% 50%' }}>
    <div
      style={{
        position: 'absolute',
        left: 0,
        top: 0,
        width: W,
        height: H,
        transformStyle: 'preserve-3d',
        transformOrigin: `${pose.x}px ${pose.y}px`,
        // translate3d memakai transform string karena perlu komponen Z (bukan properti translate biasa).
        transform: `translate3d(${W / 2 - pose.x}px, ${H / 2 - pose.y}px, ${zKamera(pose.skala)}px) rotate(${pose.rot}deg)`,
      }}
    >
      {children}
    </div>
  </AbsoluteFill>
);

/** Satu lapisan di kedalaman z (koordinat panggung 1080 × 1920). */
export const Lapisan: React.FC<{ z: number; children?: ReactNode }> = ({ z, children }) => (
  <div style={{ position: 'absolute', left: 0, top: 0, width: W, height: H, transformStyle: 'preserve-3d', transform: `translateZ(${z}px)` }}>{children}</div>
);
