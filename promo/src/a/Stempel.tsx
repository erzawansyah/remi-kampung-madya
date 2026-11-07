// Cap stempel "BUKAN JUDI ONLINE" (brief A §4 adegan 11, §6.4 brief B): merah miring −8°, bingkai ganda persegi bulat,
// tekstur tinta kasar, menghantam (skala 1,7 → 1 dalam 5 frame), guncangan meluruh 7 frame, debu tinta.
import { AbsoluteFill, useCurrentFrame } from 'remotion';
import { FONT } from '../bagian';
import { burst, noise } from './efek';
import { H, W } from './waktu';

const MERAH = '#d62f2f';

export const Stempel: React.FC<{ teks: string; kena: number; sampai: number }> = ({ teks, kena, sampai }) => {
  const f = useCurrentFrame();
  if (f < kena || f >= sampai) return null;
  const t = f - kena;
  const skala = 1.7 - 0.7 * burst(t / 5);
  const opacity = Math.min(1, t / 2) * 0.94;
  const debu = burst(t / 10);
  return (
    <AbsoluteFill style={{ pointerEvents: 'none' }}>
      <svg width={W} height={H} style={{ position: 'absolute', left: 0, top: 0 }}>
        <defs>
          <filter id="tinta" x="-20%" y="-30%" width="140%" height="160%">
            <feTurbulence type="fractalNoise" baseFrequency="0.045" numOctaves="3" seed="7" result="n" />
            <feColorMatrix in="n" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 -2.2 2.3" result="m" />
            <feComposite in="SourceGraphic" in2="m" operator="in" />
          </filter>
        </defs>
        <g transform={`translate(${W / 2} ${H / 2 - 40}) rotate(-8) scale(${skala})`} opacity={opacity}>
          <g filter="url(#tinta)">
            <rect x={-500} y={-150} width={1000} height={300} rx={38} fill="none" stroke={MERAH} strokeWidth={18} />
            <rect x={-470} y={-120} width={940} height={240} rx={26} fill="none" stroke={MERAH} strokeWidth={7} />
            <text x={0} y={32} textAnchor="middle" fontFamily={FONT} fontWeight={800} fontSize={76} fill={MERAH} letterSpacing={0.5}>
              {teks}
            </text>
          </g>
        </g>
        {/* Debu tinta: titik-titik kecil memencar dari cap. */}
        {Array.from({ length: 26 }, (_, i) => {
          const a = (i / 26) * Math.PI * 2 + noise(i, 3) * 0.6;
          const jarak = (380 + Math.abs(noise(i, 5)) * 260) * debu;
          const x = W / 2 + Math.cos(a) * jarak * 1.6;
          const y = H / 2 - 40 + Math.sin(a) * jarak * 0.6;
          const r = 3 + Math.abs(noise(i, 9)) * 6;
          return <circle key={i} cx={x} cy={y} r={r * (1 - debu * 0.4)} fill={MERAH} opacity={0.7 * (1 - debu * 0.8)} />;
        })}
      </svg>
      {/* Versi multiply tipis supaya terasa tinta di atas gambar. */}
      <AbsoluteFill style={{ mixBlendMode: 'multiply', opacity: 0.35 * opacity }}>
        <svg width={W} height={H}>
          <g transform={`translate(${W / 2} ${H / 2 - 40}) rotate(-8) scale(${skala})`}>
            <rect x={-500} y={-150} width={1000} height={300} rx={38} fill={MERAH} opacity={0.25} />
          </g>
        </svg>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
