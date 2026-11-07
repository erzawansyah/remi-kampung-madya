// Sisipan layar HP (brief A §4): bingkai HP (Hp.tsx) di koordinat layar, berisi rekaman game asli (OffthreadVideo)
// atau still, masuk dengan pop (skala 0,86 → 1, burst 7 frame) dan keluar memudar 6 frame. Di luar kamera virtual
// supaya rekaman tetap tajam.
import type { ReactNode } from 'react';
import { Img, OffthreadVideo, staticFile, useCurrentFrame } from 'remotion';
import { burst } from './efek';
import { Hp, LayarHp } from './Hp';
import { FPS } from './waktu';

export interface PropsSisipan {
  dari: number;
  sampai: number;
  x: number;
  y: number;
  lebar: number;
  rot?: number;
  children?: ReactNode;
  /** Tanpa animasi masuk (mis. sudah tampil sejak frame 0). */
  tanpaMasuk?: boolean;
  /** Geser masuk dari arah ini (px). */
  masukDari?: { x: number; y: number };
}

export const Sisipan: React.FC<PropsSisipan> = ({ dari, sampai, x, y, lebar, rot = 0, children, tanpaMasuk, masukDari = { x: 0, y: 40 } }) => {
  const f = useCurrentFrame();
  if (f < dari || f >= sampai) return null;
  const t = f - dari;
  const m = tanpaMasuk ? 1 : burst(t / 7);
  const s = 0.86 + 0.14 * m;
  const o = (tanpaMasuk ? 1 : Math.min(1, t / 3)) * (f >= sampai - 6 ? (sampai - f) / 6 : 1);
  return (
    <div style={{ position: 'absolute', left: 0, top: 0, width: 1080, height: 1920, opacity: o, transform: `translate(${(1 - m) * masukDari.x}px, ${(1 - m) * masukDari.y}px)`, pointerEvents: 'none' }}>
      <Hp lebar={lebar} x={x} y={y} rot={rot} style={{ transform: `rotate(${rot}deg) scale(${s})` }}>
        {children}
      </Hp>
    </div>
  );
};

/** Rekaman game di layar HP: mulai dari `detik` di berkas rekaman saat sisipan tampil di frame `dari`. */
export const LayarRekam: React.FC<{ berkas: string; detik: number; dari: number; rate?: number }> = ({ berkas, detik, dari, rate = 1 }) => (
  <LayarHp>
    <OffthreadVideo src={staticFile(`rekam/${berkas}`)} startFrom={Math.max(0, Math.round(detik * FPS) - Math.round(dari * rate))} playbackRate={rate} muted style={{ width: 390, height: 844, objectFit: 'cover' }} />
  </LayarHp>
);

/** Still game di layar HP. */
export const LayarStill: React.FC<{ berkas: string; children?: ReactNode }> = ({ berkas, children }) => (
  <LayarHp>
    <Img src={staticFile(`rekam/${berkas}`)} style={{ width: 390, height: 844, objectFit: 'cover' }} />
    {children}
  </LayarHp>
);
