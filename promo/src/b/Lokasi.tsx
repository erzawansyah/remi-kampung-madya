// Empat HP yang menyala bergantian di empat tempat (brief §3 5–7 dtk, §6.2): jok motor, kamar, macet,
// teras rumah. Tanpa orang: hanya warna cahaya dominan, bokeh, dan siluet benda dari bentuk CSS/SVG.
import type { ReactNode } from 'react';
import { AbsoluteFill, Img, interpolate, staticFile, useCurrentFrame } from 'remotion';
import { burst, jepit, noise } from './efek';
import { Hp, LayarHp } from './Hp';
import { H, W } from './waktu';

const LEBAR_SEL = W / 2;
const TINGGI_SEL = H / 2;

interface Tempat {
  nama: string;
  /** Warna cahaya dominan dan latar. */
  cahaya: string;
  latar: string;
  bokeh: string;
  /** Siluet benda (SVG di koordinat 540 × 960). */
  siluet: ReactNode;
}

const TEMPAT: Tempat[] = [
  {
    nama: 'jok motor',
    cahaya: '#ff9a2e',
    latar: '#1a0f06',
    bokeh: '#ffb45c',
    siluet: (
      <g fill="#060402">
        {/* Lampu jalan: tiang dan kepala lampu. */}
        <rect x="430" y="120" width="14" height="520" />
        <path d="M 380 120 L 460 120 L 450 150 L 390 150 Z" />
        {/* Helm di atas jok. */}
        <path d="M 110 700 a 110 95 0 0 1 220 0 l 10 40 l -240 0 Z" />
        <path d="M 130 740 l 190 0 l -10 30 l -170 0 Z" fill="#0b0704" />
        {/* Jok motor melintang. */}
        <path d="M 0 760 Q 270 700 540 780 L 540 960 L 0 960 Z" />
      </g>
    ),
  },
  {
    nama: 'kamar',
    cahaya: '#ffd26a',
    latar: '#15110a',
    bokeh: '#ffe3a1',
    siluet: (
      <g fill="#070503">
        {/* Lampu meja: kap trapesium bercahaya, badan tiang. */}
        <path d="M 330 230 L 470 230 L 500 360 L 300 360 Z" fill="#2b1d08" />
        <rect x="393" y="360" width="14" height="260" />
        <ellipse cx="400" cy="630" rx="60" ry="14" />
        {/* Bantal dan sudut kasur. */}
        <path d="M 0 720 Q 60 640 220 660 Q 280 680 300 760 L 0 780 Z" fill="#0d0a05" />
        <path d="M 0 760 L 540 800 L 540 960 L 0 960 Z" />
      </g>
    ),
  },
  {
    nama: 'macet',
    cahaya: '#ff3d3d',
    latar: '#120608',
    bokeh: '#ff5a5a',
    siluet: (
      <g fill="#070203">
        {/* Dashboard dan kaca: siluet mobil depan. */}
        <path d="M 60 420 L 480 420 L 520 560 L 20 560 Z" fill="#0c0405" />
        <rect x="0" y="560" width="540" height="400" />
        <path d="M 150 600 l 240 0 l 20 90 l -280 0 Z" fill="#0a0304" />
      </g>
    ),
  },
  {
    nama: 'teras rumah',
    cahaya: '#ffc24a',
    latar: '#120e06',
    bokeh: '#ffd37a',
    siluet: (
      <g fill="#060402">
        {/* Bohlam gantung. */}
        <rect x="266" y="0" width="8" height="150" />
        <path d="M 240 150 L 300 150 L 292 180 L 248 180 Z" />
        <ellipse cx="270" cy="225" rx="34" ry="46" fill="#3a2a0a" opacity="0.5" />
        {/* Sepasang sandal. */}
        <path d="M 110 820 a 36 22 0 0 1 72 0 l 6 70 a 42 24 0 0 1 -84 0 Z" />
        <path d="M 210 830 a 36 22 0 0 1 72 0 l 6 70 a 42 24 0 0 1 -84 0 Z" />
        {/* Lantai teras. */}
        <path d="M 0 900 L 540 880 L 540 960 L 0 960 Z" />
      </g>
    ),
  },
];

const Bokeh: React.FC<{ warna: string; benih: number }> = ({ warna, benih }) => (
  <>
    {Array.from({ length: 7 }, (_, i) => {
      const r = 50 + Math.abs(noise(i, benih)) * 140;
      const x = Math.abs(noise(i + 11, benih)) * 2 * LEBAR_SEL;
      const y = Math.abs(noise(i + 23, benih)) * 2 * (TINGGI_SEL * 0.6);
      return <div key={i} style={{ position: 'absolute', left: x - r, top: y - r, width: r * 2, height: r * 2, borderRadius: r, background: warna, opacity: 0.16 + Math.abs(noise(i + 5, benih)) * 0.2, filter: `blur(${r * 0.35}px)` }} />;
    })}
  </>
);

/** Satu sel lokasi dengan HP yang menyala di frame `nyalaDi` (layar: still lobi). */
const Sel: React.FC<{ tempat: Tempat; nyalaDi: number; benih: number; still: string }> = ({ tempat, nyalaDi, benih, still }) => {
  const f = useCurrentFrame();
  const nyala = burst((f - nyalaDi) / 8);
  const goyang = noise(f * 0.5, benih) * 1.2;
  return (
    <div style={{ position: 'absolute', width: LEBAR_SEL, height: TINGGI_SEL, overflow: 'hidden', background: tempat.latar }}>
      <div style={{ position: 'absolute', inset: 0, background: `radial-gradient(ellipse 60% 45% at 50% 20%, ${tempat.cahaya}55, transparent 70%)` }} />
      <Bokeh warna={tempat.bokeh} benih={benih} />
      <svg width={LEBAR_SEL} height={TINGGI_SEL} viewBox="0 0 540 960" style={{ position: 'absolute', left: 0, top: 0, filter: 'blur(3px)', opacity: 0.95 }}>
        {tempat.siluet}
      </svg>
      {/* Cahaya layar memantul ke sekitar saat menyala. */}
      <div style={{ position: 'absolute', left: LEBAR_SEL / 2 - 260, top: TINGGI_SEL / 2 - 300, width: 520, height: 600, borderRadius: 300, background: 'radial-gradient(ellipse, rgba(251,246,234,0.35), transparent 65%)', opacity: nyala, filter: 'blur(30px)' }} />
      <Hp lebar={250} x={LEBAR_SEL / 2 + goyang} y={TINGGI_SEL / 2 + 30} rot={-6 + benih * 3} nyala={nyala}>
        <LayarHp>
          <Img src={staticFile(still)} style={{ width: 390, height: 844, objectFit: 'cover' }} />
        </LayarHp>
      </Hp>
      {/* Sedikit DOF: tepi sel diburamkan. */}
      <div style={{ position: 'absolute', inset: 0, boxShadow: 'inset 0 0 120px 40px rgba(0,0,0,0.55)', pointerEvents: 'none' }} />
    </div>
  );
};

export interface PropsLokasi {
  /** Frame mulai tampil (kode mendarat) dan jarak nyala antar-HP (±0,45 dtk = 13 frame). */
  mulai: number;
  jarak?: number;
  still: string;
}

/** Grid 2 × 2 empat lokasi. */
export const Lokasi: React.FC<PropsLokasi> = ({ mulai, jarak = 13, still }) => {
  const f = useCurrentFrame();
  const masuk = interpolate(f, [mulai - 6, mulai], [0, 1], jepit);
  return (
    <AbsoluteFill style={{ background: '#0a0806', opacity: masuk }}>
      {TEMPAT.map((t, i) => (
        <div key={t.nama} style={{ position: 'absolute', left: (i % 2) * LEBAR_SEL, top: Math.floor(i / 2) * TINGGI_SEL }}>
          <Sel tempat={t} nyalaDi={mulai + i * jarak} benih={i + 1} still={still} />
        </div>
      ))}
      {/* Garis pemisah tipis. */}
      <div style={{ position: 'absolute', left: LEBAR_SEL - 2, top: 0, width: 4, height: H, background: '#000' }} />
      <div style={{ position: 'absolute', top: TINGGI_SEL - 2, left: 0, height: 4, width: W, background: '#000' }} />
    </AbsoluteFill>
  );
};
