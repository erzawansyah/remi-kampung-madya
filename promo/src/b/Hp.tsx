// Bingkai HP (brief §6.2): persegi bulat hitam, bezel, kilau tepi, bayangan lembut. Layar 390:844;
// anaknya digambar di koordinat 390 × 844 lalu diskalakan ke lebar layar (rekaman, still, atau chat).
import type { CSSProperties, ReactNode } from 'react';

export const RASIO_LAYAR = 844 / 390;

export interface PropsHp {
  /** Lebar luar HP (px frame). Bezel dan radius ikut proporsional (bezel 14, radius 70 pada lebar 418). */
  lebar: number;
  /** Titik tengah HP. */
  x: number;
  y: number;
  rot?: number;
  /** Transform tambahan (mis. rotateX untuk HP tergeletak di meja), diterapkan setelah rotate. */
  transform?: string;
  /** 0..1 terang layar (0 = layar mati). */
  nyala?: number;
  style?: CSSProperties;
  children?: ReactNode;
  /** Bayangan lembut di bawah (bawaan ya). */
  bayangan?: boolean;
}

export const Hp: React.FC<PropsHp> = ({ lebar, x, y, rot = 0, transform = '', nyala = 1, style, children, bayangan = true }) => {
  const bezel = lebar * (14 / 418);
  const radius = lebar * (70 / 418);
  const lebarLayar = lebar - bezel * 2;
  const tinggiLayar = lebarLayar * RASIO_LAYAR;
  const tinggi = tinggiLayar + bezel * 2;
  const skala = lebarLayar / 390;
  return (
    <div
      style={{
        position: 'absolute',
        left: x - lebar / 2,
        top: y - tinggi / 2,
        width: lebar,
        height: tinggi,
        borderRadius: radius,
        background: 'linear-gradient(160deg, #2b2b2e 0%, #0d0d0f 35%, #050506 100%)',
        boxShadow: bayangan ? `0 ${lebar * 0.06}px ${lebar * 0.16}px rgba(0,0,0,0.55), inset 0 0 0 2px rgba(255,255,255,0.08), inset 0 0 0 4px rgba(0,0,0,0.6)` : 'none',
        transform: `rotate(${rot}deg) ${transform}`,
        transformStyle: 'preserve-3d',
        ...style,
      }}
    >
      <div
        style={{
          position: 'absolute',
          left: bezel,
          top: bezel,
          width: lebarLayar,
          height: tinggiLayar,
          borderRadius: radius - bezel,
          overflow: 'hidden',
          background: '#000',
        }}
      >
        <div style={{ position: 'absolute', left: 0, top: 0, width: 390, height: 844, transform: `scale(${skala})`, transformOrigin: '0 0', opacity: nyala }}>{children}</div>
        {/* Kilau tipis di tepi layar. */}
        <div style={{ position: 'absolute', inset: 0, borderRadius: radius - bezel, boxShadow: 'inset 0 0 0 1px rgba(255,255,255,0.06)', pointerEvents: 'none' }} />
        <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(115deg, rgba(255,255,255,0.07) 0%, rgba(255,255,255,0) 30%)', pointerEvents: 'none', opacity: nyala > 0.5 ? 0.6 : 1 }} />
      </div>
    </div>
  );
};

/** Isi layar HP: lapisan 390 × 844 dengan konten apa pun (anak diposisikan absolut). */
export const LayarHp: React.FC<{ children?: ReactNode; style?: CSSProperties }> = ({ children, style }) => (
  <div style={{ position: 'absolute', left: 0, top: 0, width: 390, height: 844, overflow: 'hidden', ...style }}>{children}</div>
);
