// Balon kata (brief A §4): putih, garis tinta 5 px, ekor ke mulut tokoh, Baloo 2 700, 54–60 px. Masuk dengan pop
// (skala 0,8 → 1, 6 frame), tahan minimal 1,2 dtk; keluar memudar 5 frame. Koordinat panggung (ikut kamera).
import { useCurrentFrame } from 'remotion';
import { FONT } from '../bagian';
import { burst } from './efek';
import { TINTA } from './tokoh/rig';

export interface PropsBalon {
  teks: string;
  dari: number;
  sampai: number;
  /** Titik tengah balon (panggung). */
  x: number;
  y: number;
  /** Ujung ekor (mulut tokoh). */
  ekorX: number;
  ekorY: number;
  lebar?: number;
  ukuran?: number;
}

export const Balon: React.FC<PropsBalon> = ({ teks, dari, sampai, x, y, ekorX, ekorY, lebar = 420, ukuran = 56 }) => {
  const f = useCurrentFrame();
  if (f < dari || f >= sampai) return null;
  const t = f - dari;
  const s = 0.8 + 0.2 * burst(t / 6);
  const o = Math.min(1, t / 2) * (f >= sampai - 5 ? (sampai - f) / 5 : 1);
  const tinggi = ukuran * 2.1;
  // Ekor: segitiga dari tepi balon ke titik mulut.
  const dx = ekorX - x;
  const dy = ekorY - y;
  const pangkalX = x + Math.sign(dx || 1) * Math.min(Math.abs(dx) * 0.3, lebar * 0.25);
  const pangkalY = y + (dy > 0 ? tinggi / 2 - 6 : -tinggi / 2 + 6);
  return (
    <div style={{ position: 'absolute', left: 0, top: 0, opacity: o, transform: `translate(${x}px, ${y}px) scale(${s}) translate(${-x}px, ${-y}px)`, transformOrigin: `${x}px ${y}px`, pointerEvents: 'none' }}>
      <svg width={1080} height={1920} style={{ position: 'absolute', left: 0, top: 0, overflow: 'visible' }}>
        <path d={`M ${pangkalX - 26} ${pangkalY} L ${ekorX} ${ekorY} L ${pangkalX + 26} ${pangkalY} Z`} fill="#fff" stroke={TINTA} strokeWidth={5} strokeLinejoin="round" />
        <rect x={x - lebar / 2} y={y - tinggi / 2} width={lebar} height={tinggi} rx={tinggi / 2} fill="#fff" stroke={TINTA} strokeWidth={5} />
        <path d={`M ${pangkalX - 22} ${pangkalY} L ${pangkalX + 22} ${pangkalY}`} stroke="#fff" strokeWidth={8} />
      </svg>
      <div style={{ position: 'absolute', left: x - lebar / 2, top: y - tinggi / 2, width: lebar, height: tinggi, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: FONT, fontWeight: 700, fontSize: ukuran, color: TINTA, lineHeight: 1.05, textAlign: 'center', padding: '0 26px', boxSizing: 'border-box' }}>
        {teks}
      </div>
    </div>
  );
};
