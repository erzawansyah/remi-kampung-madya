// Lapisan tambahan di dalam layar HP sisipan (koordinat 390 × 844): retak + kilat merah, avatar maskot cangkir di
// panel warga kedai, cincin sorot kartu, dan panah kuning yang "tergambar". Semua digerakkan frame lokal sisipan.
import { Easing, Img, interpolate, staticFile, useCurrentFrame } from 'remotion';
import { Logo, WARNA } from '../../bagian';

const jepit = { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' } as const;

/** Retak kaca (aset/retak.png dari efek/retak.ts) di layar HP sejak frame `dari` (lokal sisipan). */
export const RetakLayar: React.FC<{ dari: number; kuat?: number }> = ({ dari, kuat = 1 }) => {
  const f = useCurrentFrame();
  if (f < dari) return null;
  return (
    <>
      <div style={{ position: 'absolute', inset: 0, background: '#ff2a1a', mixBlendMode: 'screen', opacity: interpolate(f, [dari, dari + 1, dari + 5], [0.5 * kuat, 0.4 * kuat, 0], jepit) }} />
      <Img src={staticFile('aset/retak.png')} style={{ position: 'absolute', left: 0, top: 0, width: 390, height: 844, objectFit: 'cover', opacity: interpolate(f, [dari, dari + 1, dari + 40], [0, 0.95 * kuat, 0.85 * kuat], jepit) }} />
    </>
  );
};

/** Avatar maskot cangkir (bot) ditempel di atas panel nama warga kedai (adegan 9). */
export const AvatarMaskot: React.FC<{ x: number; y: number }> = ({ x, y }) => (
  <div style={{ position: 'absolute', left: x, top: y, width: 34, height: 34, borderRadius: 17, background: WARNA.krem, display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 2px 6px rgba(0,0,0,0.5)' }}>
    <Logo varian="maskot" lebar={24} warna={WARNA.kuning} />
  </div>
);

/** Cincin kuning berdenyut di sekitar kartu (adegan 4). */
export const CincinKartu: React.FC<{ x: number; y: number; dari: number; sampai: number }> = ({ x, y, dari, sampai }) => {
  const f = useCurrentFrame();
  if (f < dari || f >= sampai) return null;
  return (
    <div
      style={{
        position: 'absolute',
        left: x - 42,
        top: y - 58,
        width: 84,
        height: 116,
        borderRadius: 8,
        border: '4px solid #f1a615',
        boxShadow: '0 0 18px 6px rgba(241,166,21,0.6)',
        opacity: interpolate(f, [dari, dari + 4, sampai - 6, sampai], [0, 1, 1, 0], jepit),
        scale: String(1 + 0.05 * Math.sin((f - dari) * 0.5)),
      }}
    />
  );
};

/** Panah kuning di layar HP, tergambar dari (x1,y1) ke (x2,y2) selama 14 frame sejak `dari`. */
export const PanahLayar: React.FC<{ dari: number; sampai: number; x1: number; y1: number; x2: number; y2: number }> = ({ dari, sampai, x1, y1, x2, y2 }) => {
  const f = useCurrentFrame();
  if (f < dari || f >= sampai) return null;
  const t = interpolate(f, [dari, dari + 14], [0, 1], { ...jepit, easing: Easing.bezier(0.16, 1, 0.3, 1) });
  const mx = (x1 + x2) / 2;
  const my = (y1 + y2) / 2;
  const dx = x2 - x1;
  const dy = y2 - y1;
  const cx = mx - dy * 0.35;
  const cy = my + dx * 0.35;
  const panjang = Math.hypot(dx, dy) * 1.25;
  const sudut = (Math.atan2(y2 - cy, x2 - cx) * 180) / Math.PI;
  return (
    <svg width={390} height={844} style={{ position: 'absolute', left: 0, top: 0, opacity: interpolate(f, [sampai - 6, sampai], [1, 0], jepit) }}>
      <defs>
        <filter id="glowPanahLayar" x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur stdDeviation="4" result="b" />
          <feMerge>
            <feMergeNode in="b" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>
      <g filter="url(#glowPanahLayar)">
        <path d={`M ${x1} ${y1} Q ${cx} ${cy} ${x2} ${y2}`} fill="none" stroke="#f1a615" strokeWidth={7} strokeLinecap="round" strokeDasharray={panjang} strokeDashoffset={panjang * (1 - t)} />
        {t >= 0.95 && (
          <g transform={`translate(${x2} ${y2}) rotate(${sudut})`}>
            <path d="M 0 0 L -22 -14 L -16 0 L -22 14 Z" fill="#f1a615" />
          </g>
        )}
      </g>
    </svg>
  );
};
