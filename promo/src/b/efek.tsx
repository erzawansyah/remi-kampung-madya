// Alat sinematografi Teaser B (brief §5): kamera yang tidak pernah diam (push-in, glide, burst, shake,
// dutch roll), vinyet/grain/split tone, flash putih, caption, pil, logo pojok, retak, panah, dan bunyi.
import type { CSSProperties, ReactNode } from 'react';
import { AbsoluteFill, Audio, Img, interpolate, Sequence, staticFile, useCurrentFrame } from 'remotion';
import { FONT, Logo, WARNA } from '../bagian';
import { H, W } from './waktu';

export const jepit = { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' } as const;

/** smootherstep 0..1. */
export const halus = (t: number): number => {
  const x = Math.min(1, Math.max(0, t));
  return x * x * x * (x * (x * 6 - 15) + 10);
};
/** Ease-out kuat untuk burst: kecepatan puncak di awal, meluruh. */
export const burst = (t: number): number => 1 - Math.pow(1 - Math.min(1, Math.max(0, t)), 3);
/** Glide ease in/out (smootherstep) dari `a` ke `b` antara frame f0..f1. */
export const glide = (f: number, f0: number, f1: number, a: number, b: number): number => a + (b - a) * halus((f - f0) / Math.max(1, f1 - f0));

/** Guncangan hantaman: arah bolak-balik tiap frame, meluruh dalam `lama` frame. */
export function shake(f: number, mulai: number, kuat: number, lama = 7): { x: number; y: number; rot: number } {
  const t = f - mulai;
  if (t < 0 || t >= lama) return { x: 0, y: 0, rot: 0 };
  const sisa = 1 - t / lama;
  const arah = t % 2 === 0 ? 1 : -1;
  return { x: arah * kuat * sisa, y: -arah * kuat * 0.6 * sisa * (t % 3 === 0 ? 1 : 0.5), rot: arah * sisa * kuat * 0.05 };
}

/** Noise deterministik kecil (untuk gemetar kartu, dsb.). */
export const noise = (f: number, benih = 1): number => {
  const x = Math.sin(f * 12.9898 + benih * 78.233) * 43758.5453;
  return x - Math.floor(x) - 0.5;
};

export interface Pose {
  /** Skala kamera (1 = pas frame). */
  skala?: number;
  /** Titik pusat yang dilihat kamera, koordinat frame 1080 × 1920 (bawaan tengah). */
  x?: number;
  y?: number;
  rot?: number;
}

/**
 * Kamera virtual: anaknya digambar di bidang 1080 × 1920, lalu diperbesar `skala` dengan pusat (x, y).
 * `pushPerFrame` menambah skala tiap frame (0,0015 = 0,15%/frame). `shakeDari` = frame hantaman.
 */
export const Kamera: React.FC<{
  pose: Pose;
  pushPerFrame?: number;
  pushDari?: number;
  shakeDari?: number;
  shakeKuat?: number;
  shakeLama?: number;
  children?: ReactNode;
  style?: CSSProperties;
}> = ({ pose, pushPerFrame = 0.002, pushDari = 0, shakeDari, shakeKuat = 0, shakeLama = 7, children, style }) => {
  const f = useCurrentFrame();
  const s = (pose.skala ?? 1) * (1 + Math.max(0, f - pushDari) * pushPerFrame);
  const g = shakeDari === undefined ? { x: 0, y: 0, rot: 0 } : shake(f, shakeDari, shakeKuat, shakeLama);
  const cx = (pose.x ?? W / 2) + g.x;
  const cy = (pose.y ?? H / 2) + g.y;
  const rot = (pose.rot ?? 0) + g.rot;
  return (
    <AbsoluteFill style={{ overflow: 'hidden', ...style }}>
      <AbsoluteFill
        style={{
          // Titik (cx, cy) dipindah ke pusat frame, lalu diputar dan diskalakan di sana. Origin harus 0 0:
          // versi lama memakai origin (cx, cy) sambil tetap mengurangi cx·s, sehingga gambar bergeser ke kiri
          // atas setiap kali zoom (pentungan hanya kelihatan seperempat, panah keluar layar).
          transform: `translate(${W / 2}px, ${H / 2}px) rotate(${rot}deg) scale(${s}) translate(${-cx}px, ${-cy}px)`,
          transformOrigin: '0 0',
        }}
      >
        {children}
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

/** Vinyet: `kuat` 0..1, `warna` bayangan (biru untuk low-key). */
export const Vinyet: React.FC<{ kuat?: number; warna?: string; style?: CSSProperties }> = ({ kuat = 0.5, warna = 'rgba(0,0,0,1)', style }) => (
  <AbsoluteFill
    style={{
      pointerEvents: 'none',
      background: `radial-gradient(ellipse 70% 60% at 50% 48%, rgba(0,0,0,0) 35%, ${warna.replace(/1\)$/, `${(0.55 * kuat).toFixed(3)})`)} 72%, ${warna.replace(/1\)$/, `${Math.min(1, 1.1 * kuat).toFixed(3)})`)} 100%)`,
      ...style,
    }}
  />
);

/** Split tone: highlight hangat, bayangan dingin (dua lapisan blend). */
export const SplitTone: React.FC<{ hangat?: number; dingin?: number }> = ({ hangat = 0.12, dingin = 0.18 }) => (
  <>
    <AbsoluteFill style={{ pointerEvents: 'none', background: '#1a2a4a', mixBlendMode: 'lighten', opacity: dingin }} />
    <AbsoluteFill style={{ pointerEvents: 'none', background: '#ffb347', mixBlendMode: 'soft-light', opacity: hangat }} />
  </>
);

/** Grain halus 2–3%: pola titik acak yang bergeser tiap frame. */
export const Grain: React.FC<{ kuat?: number }> = ({ kuat = 0.03 }) => {
  const f = useCurrentFrame();
  const gx = (f * 37) % 97;
  const gy = (f * 53) % 89;
  return (
    <AbsoluteFill
      style={{
        pointerEvents: 'none',
        opacity: kuat,
        mixBlendMode: 'overlay',
        backgroundImage: `url("data:image/svg+xml;utf8,${encodeURIComponent(
          `<svg xmlns='http://www.w3.org/2000/svg' width='220' height='220'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/><feColorMatrix values='0 0 0 0 0.5 0 0 0 0 0.5 0 0 0 0 0.5 0 0 0 1 0'/></filter><rect width='220' height='220' filter='url(#n)'/></svg>`,
        )}")`,
        backgroundPosition: `${gx}px ${gy}px`,
      }}
    />
  );
};

/** Flash putih `lama` frame dari `dari` (memudar). */
export const Flash: React.FC<{ dari: number; lama?: number; warna?: string; puncak?: number }> = ({ dari, lama = 4, warna = '#fff', puncak = 1 }) => {
  const f = useCurrentFrame();
  const o = f < dari || f >= dari + lama + 2 ? 0 : interpolate(f, [dari, dari + 1, dari + lama + 2], [puncak, puncak, 0], jepit);
  return o <= 0 ? null : <AbsoluteFill style={{ background: warna, opacity: o, pointerEvents: 'none' }} />;
};

/** Caption di luar chat (Baloo 2 800, 62–72 px, putih bergaris hitam, y ±1250–1350). */
export const Caption: React.FC<{ teks: ReactNode; dari: number; sampai?: number; y?: number; ukuran?: number }> = ({ teks, dari, sampai = 1e9, y = 1290, ukuran = 68 }) => {
  const f = useCurrentFrame();
  if (f < dari || f >= sampai) return null;
  const t = f - dari;
  const s = 0.92 + 0.08 * burst(t / 6);
  const o = Math.min(1, t / 3);
  return (
    <div
      style={{
        position: 'absolute',
        left: 70,
        right: 140,
        top: y - ukuran,
        textAlign: 'center',
        fontFamily: FONT,
        fontWeight: 800,
        fontSize: ukuran,
        lineHeight: 1.15,
        color: '#fff',
        WebkitTextStroke: '6px #000',
        paintOrder: 'stroke fill',
        textShadow: '0 6px 0 rgba(0,0,0,0.35), 0 14px 30px rgba(0,0,0,0.5)',
        transform: `scale(${s})`,
        opacity: o,
      }}
    >
      {teks}
    </div>
  );
};

/** Pil di atas tengah: "gratis · tanpa login · tanpa top up". */
export const Pil: React.FC<{ teks: string; dari: number; sampai: number; y?: number }> = ({ teks, dari, sampai, y = 150 }) => {
  const f = useCurrentFrame();
  if (f < dari || f >= sampai + 8) return null;
  const masuk = Math.min(1, (f - dari) / 8);
  const keluar = f >= sampai ? 1 - Math.min(1, (f - sampai) / 8) : 1;
  const o = burst(masuk) * keluar;
  return (
    <div
      style={{
        position: 'absolute',
        left: 0,
        right: 0,
        top: y,
        display: 'flex',
        justifyContent: 'center',
        opacity: o,
        transform: `translateY(${(1 - burst(masuk)) * -16}px)`,
      }}
    >
      <div
        style={{
          fontFamily: FONT,
          fontWeight: 600,
          fontSize: 34,
          lineHeight: 1,
          color: WARNA.krem,
          background: 'rgba(29,26,22,0.75)',
          border: `1.5px solid ${WARNA.kuning}`,
          borderRadius: 999,
          padding: '16px 34px',
          letterSpacing: 0.5,
          boxShadow: '0 8px 24px rgba(0,0,0,0.35)',
        }}
      >
        {teks}
      </div>
    </div>
  );
};

/** Logo Kedai Madya kecil di pojok kiri atas (sejak frame 0). */
export const LogoPojok: React.FC = () => <Logo varian="lengkap" lebar={170} warna={WARNA.kuning} style={{ position: 'absolute', left: 56, top: 70, opacity: 0.9 }} />;

/** Lapisan retak (aset/retak.png dari efek/retak.ts) + kilat merah, untuk menguatkan retak asli rekaman. */
export const Retak: React.FC<{ dari: number; kuat?: number; lama?: number; skala?: number }> = ({ dari, kuat = 1, lama = 90, skala = 1 }) => {
  const f = useCurrentFrame();
  if (f < dari || f >= dari + lama) return null;
  const t = f - dari;
  const kilat = interpolate(t, [0, 1, 6], [0.55 * kuat, 0.45 * kuat, 0], jepit);
  const o = interpolate(t, [0, 1, lama - 12, lama], [0, 0.95 * kuat, 0.9 * kuat, 0], jepit);
  return (
    <>
      <AbsoluteFill style={{ background: '#ff2a1a', opacity: kilat, mixBlendMode: 'screen', pointerEvents: 'none' }} />
      <AbsoluteFill style={{ opacity: o, pointerEvents: 'none', transform: `scale(${skala})` }}>
        <Img src={staticFile('aset/retak.png')} style={{ width: W, height: H }} />
      </AbsoluteFill>
    </>
  );
};

/** Panah kuning melengkung yang "tergambar" dari (x1,y1) ke (x2,y2), dengan glow. */
export const Panah: React.FC<{ dari: number; lama?: number; x1: number; y1: number; x2: number; y2: number; lengkung?: number; sampai?: number }> = ({ dari, lama = 14, x1, y1, x2, y2, lengkung = 0.35, sampai = 1e9 }) => {
  const f = useCurrentFrame();
  if (f < dari || f >= sampai) return null;
  const t = Math.min(1, (f - dari) / lama);
  const mx = (x1 + x2) / 2;
  const my = (y1 + y2) / 2;
  const dx = x2 - x1;
  const dy = y2 - y1;
  const cx = mx - dy * lengkung;
  const cy = my + dx * lengkung;
  const panjang = Math.hypot(dx, dy) * 1.25;
  const o = f >= sampai - 6 ? (sampai - f) / 6 : 1;
  // Ujung panah di titik akhir, menghadap arah kurva.
  const sudut = (Math.atan2(y2 - cy, x2 - cx) * 180) / Math.PI;
  return (
    <svg width={W} height={H} style={{ position: 'absolute', left: 0, top: 0, pointerEvents: 'none', opacity: o }}>
      <defs>
        <filter id="glowPanah" x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur stdDeviation="8" result="b" />
          <feMerge>
            <feMergeNode in="b" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>
      <g filter="url(#glowPanah)">
        <path
          d={`M ${x1} ${y1} Q ${cx} ${cy} ${x2} ${y2}`}
          fill="none"
          stroke={WARNA.kuning}
          strokeWidth={12}
          strokeLinecap="round"
          strokeDasharray={panjang}
          strokeDashoffset={panjang * (1 - burst(t))}
        />
        {t >= 0.95 && (
          <g transform={`translate(${x2} ${y2}) rotate(${sudut})`}>
            <path d="M 0 0 L -40 -26 L -28 0 L -40 26 Z" fill={WARNA.kuning} />
          </g>
        )}
      </g>
    </svg>
  );
};

/** Cincin cahaya kuning berdenyut di sekitar benda kunci. */
export const Cincin: React.FC<{ x: number; y: number; r: number; dari: number; sampai: number; rasio?: number }> = ({ x, y, r, dari, sampai, rasio = 1.4 }) => {
  const f = useCurrentFrame();
  if (f < dari || f >= sampai) return null;
  const t = f - dari;
  const denyut = 1 + 0.06 * Math.sin(t * 0.5);
  const o = Math.min(1, t / 5) * (f >= sampai - 6 ? (sampai - f) / 6 : 1);
  return (
    <div
      style={{
        position: 'absolute',
        left: x - r,
        top: y - r * rasio,
        width: r * 2,
        height: r * 2 * rasio,
        borderRadius: r * 0.16,
        border: `6px solid ${WARNA.kuning}`,
        boxShadow: `0 0 30px 10px rgba(241,166,21,0.55), inset 0 0 24px rgba(241,166,21,0.35)`,
        transform: `scale(${denyut})`,
        opacity: o,
        pointerEvents: 'none',
      }}
    />
  );
};

/** Bunyi dari aset game (bunyi-<nama>.wav), mulai di frame `dari`. */
export const Bunyi: React.FC<{ nama: string; dari: number; volume?: number; rate?: number; lama?: number }> = ({ nama, dari, volume = 1, rate = 1, lama }) => (
  <Sequence from={dari} durationInFrames={lama} layout="none">
    <Audio src={staticFile(`aset/bunyi-${nama}.wav`)} volume={volume} playbackRate={rate} />
  </Sequence>
);

/** Efek suara ElevenLabs (aset/el-<nama>.wav, dibuat scripts/ambil-sfx.mjs), mulai di frame `dari`. */
export const Sfx: React.FC<{ nama: string; dari: number; volume?: number | ((f: number) => number); lama?: number }> = ({ nama, dari, volume = 1, lama }) => (
  <Sequence from={dari} durationInFrames={lama} layout="none">
    <Audio src={staticFile(`aset/el-${nama}.wav`)} volume={volume} />
  </Sequence>
);

/** Whip/rewind: blur gerak + garis pindai selama `lama` frame dari `dari`. */
export const Whip: React.FC<{ dari: number; lama?: number }> = ({ dari, lama = 8 }) => {
  const f = useCurrentFrame();
  if (f < dari || f >= dari + lama) return null;
  const t = (f - dari) / lama;
  const o = Math.sin(t * Math.PI);
  const geser = (f % 2 === 0 ? 1 : -1) * 26 * o;
  return (
    <AbsoluteFill style={{ pointerEvents: 'none' }}>
      <AbsoluteFill style={{ background: `repeating-linear-gradient(180deg, rgba(255,255,255,0.14) 0 3px, rgba(0,0,0,0) 3px 11px)`, opacity: 0.9 * o, transform: `translateY(${geser}px)` }} />
      <AbsoluteFill style={{ background: 'linear-gradient(90deg, rgba(255,255,255,0.12), rgba(255,255,255,0) 40%, rgba(255,255,255,0) 60%, rgba(255,255,255,0.12))', opacity: o }} />
      <AbsoluteFill style={{ backdropFilter: `blur(${10 * o}px)`, WebkitBackdropFilter: `blur(${10 * o}px)` }} />
    </AbsoluteFill>
  );
};
