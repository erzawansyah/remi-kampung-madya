// Sisipan layar HP (brief A §4): bingkai HP (Hp.tsx) di ruang layar berisi rekaman game asli lewat <Video> dari
// @remotion/media (trimBefore = detik di berkas rekaman) atau still (<Img>). Masuk dengan pop (scale 0,86 → 1)
// dan keluar memudar; waktu dibagi lewat satu <Sequence> supaya bingkai, video, dan lapisan tambahannya
// berangkat dari frame yang sama. Di luar kamera virtual supaya rekaman tetap tajam.
import { Video } from '@remotion/media';
import type { ReactNode } from 'react';
import { Easing, Img, interpolate, Sequence, staticFile, useCurrentFrame, useVideoConfig } from 'remotion';
import { Hp, LayarHp } from './Hp';

export interface PropsSisipan {
  nama: string;
  dari: number;
  lama: number;
  x: number;
  y: number;
  lebar: number;
  rot?: number;
  children?: ReactNode;
  /** Geser masuk dari arah ini (px). */
  masukDari?: { x: number; y: number };
  /** Tanpa animasi masuk (mis. sudah tampil sejak frame 0 adegan). */
  tanpaMasuk?: boolean;
}

const BingkaiSisipan: React.FC<Omit<PropsSisipan, 'dari' | 'nama'>> = ({ lama, x, y, lebar, rot = 0, children, masukDari = { x: 0, y: 40 }, tanpaMasuk }) => {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const masuk = tanpaMasuk ? 1 : interpolate(f, [0, 0.25 * fps], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: Easing.bezier(0.16, 1, 0.3, 1) });
  return (
    <div
      style={{
        position: 'absolute',
        left: 0,
        top: 0,
        width: 1080,
        height: 1920,
        pointerEvents: 'none',
        opacity: Math.min(tanpaMasuk ? 1 : interpolate(f, [0, 3], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }), interpolate(f, [lama - 6, lama], [1, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' })),
        translate: `${(1 - masuk) * masukDari.x}px ${(1 - masuk) * masukDari.y}px`,
      }}
    >
      <Hp lebar={lebar} x={x} y={y} rot={rot} style={{ transform: `rotate(${rot}deg) scale(${0.86 + 0.14 * masuk})` }}>
        {children}
      </Hp>
    </div>
  );
};

export const Sisipan: React.FC<PropsSisipan> = ({ nama, dari, lama, ...sisa }) => (
  <Sequence name={`Sisipan ${nama}`} from={dari} durationInFrames={lama} layout="none">
    <BingkaiSisipan lama={lama} {...sisa} />
  </Sequence>
);

/** Rekaman game di layar HP, mulai dari detik `detik` di berkas saat sisipannya muncul. */
export const LayarRekam: React.FC<{ berkas: string; detik: number; nama?: string }> = ({ berkas, detik, nama }) => {
  const { fps } = useVideoConfig();
  return (
    <LayarHp>
      <Video name={nama ?? berkas} src={staticFile(`rekam/${berkas}`)} trimBefore={Math.max(0, Math.round(detik * fps))} muted style={{ width: 390, height: 844, objectFit: 'cover' }} />
    </LayarHp>
  );
};

/** Still game di layar HP. */
export const LayarStill: React.FC<{ berkas: string; children?: ReactNode }> = ({ berkas, children }) => (
  <LayarHp>
    <Img src={staticFile(`rekam/${berkas}`)} style={{ width: 390, height: 844, objectFit: 'cover' }} />
    {children}
  </LayarHp>
);
