// Meja Kedai Madya malam hari (brief §6.3), stilasi tanpa footage: kayu hangat di bawah lampu gantung
// kuning, empat HP tergeletak, dua gelas kopi berasap, kartu berpunggung cangkir, dan papan QR berdiri.
// Semuanya 2D (tanpa perspektif CSS 3D) supaya posisi tiap benda bisa dihitung untuk gerak kamera, dengan
// kesan tiga dimensi dari skala-Y benda yang tergeletak dan bidang meja yang melebar ke bawah.
import type { ReactNode } from 'react';
import { create as buatQr } from 'qrcode';
import { AbsoluteFill, Img, staticFile, useCurrentFrame } from 'remotion';
import { FONT, Logo, WARNA } from '../bagian';
import { halus, noise } from './efek';
import { Hp, LayarHp } from './Hp';
import { H, URL_GAME, W } from './waktu';

/** Pose HP: tergeletak (`pipih` ≈ 0,62) atau diangkat menghadap kamera (`pipih` 1). */
export interface PoseHp {
  x: number;
  y: number;
  lebar: number;
  rot: number;
  pipih: number;
}

export const lerpPose = (a: PoseHp, b: PoseHp, t: number): PoseHp => {
  const k = halus(t);
  return { x: a.x + (b.x - a.x) * k, y: a.y + (b.y - a.y) * k, lebar: a.lebar + (b.lebar - a.lebar) * k, rot: a.rot + (b.rot - a.rot) * k, pipih: a.pipih + (b.pipih - a.pipih) * k };
};

/** Posisi benda di meja (koordinat frame). */
export const POSE = {
  // Kamu di sisi kamera (HP paling dekat), Dimas dan Ayu di seberang meja, warga kedai = kursi kosong di kanan.
  kamuRebah: { x: 360, y: 1580, lebar: 300, rot: -12, pipih: 0.62 } as PoseHp,
  kamuAngkat: { x: 540, y: 1070, lebar: 700, rot: 0, pipih: 1 } as PoseHp,
  lawanRebah: { x: 800, y: 1450, lebar: 240, rot: 16, pipih: 0.6 } as PoseHp,
  lawanAngkat: { x: 540, y: 1160, lebar: 700, rot: 0, pipih: 1 } as PoseHp,
  hpDimas: { x: 290, y: 1050, lebar: 210, rot: 10, pipih: 0.58 } as PoseHp,
  hpAyu: { x: 610, y: 1060, lebar: 210, rot: -8, pipih: 0.58 } as PoseHp,
  qr: { x: 890, y: 960 },
  cangkir1: { x: 450, y: 1190 },
  cangkir2: { x: 600, y: 1440 },
};

/** QR menuju URL_GAME: koreksi galat M, modul hitam di atas krem, zona tenang 4 modul. Ukuran = sisi (px). */
export const Qr: React.FC<{ sisi: number }> = ({ sisi }) => {
  const kode = buatQr(URL_GAME, { errorCorrectionLevel: 'M' });
  const n = kode.modules.size;
  const tenang = 4;
  const total = n + tenang * 2;
  const modul = sisi / total;
  const kotak: ReactNode[] = [];
  for (let y = 0; y < n; y++)
    for (let x = 0; x < n; x++)
      if (kode.modules.get(y, x)) kotak.push(<rect key={`${x}-${y}`} x={(x + tenang) * modul} y={(y + tenang) * modul} width={modul + 0.2} height={modul + 0.2} />);
  return (
    <svg width={sisi} height={sisi} viewBox={`0 0 ${sisi} ${sisi}`} shapeRendering="crispEdges" style={{ display: 'block' }}>
      <rect width={sisi} height={sisi} fill={WARNA.krem} />
      <g fill="#111">{kotak}</g>
    </svg>
  );
};

/** Papan QR berdiri: tenda kertas krem dengan QR, tulisan kecil, dan maskot. `lebar` = lebar muka. */
export const PapanQr: React.FC<{ x: number; y: number; lebar: number; glow?: number }> = ({ x, y, lebar, glow = 0 }) => {
  const tinggi = lebar * 1.26;
  const qr = lebar * 0.78;
  return (
    <div style={{ position: 'absolute', left: x - lebar / 2, top: y - tinggi, width: lebar, height: tinggi + lebar * 0.1 }}>
      {/* Sisi tenda (menyamping) dan bayangan di meja. */}
      <div style={{ position: 'absolute', left: lebar * 0.06, top: tinggi * 0.08, width: lebar, height: tinggi, background: '#0a0804', opacity: 0.5, borderRadius: 8, filter: 'blur(10px)', transform: 'skewX(-6deg)' }} />
      <div style={{ position: 'absolute', left: lebar - 10, top: 8, width: lebar * 0.14, height: tinggi - 8, background: 'linear-gradient(90deg, #d8cfb8, #a79c82)', transform: 'skewY(28deg)', transformOrigin: '0 0', borderRadius: '0 6px 6px 0' }} />
      <div
        style={{
          position: 'absolute',
          left: 0,
          top: 0,
          width: lebar,
          height: tinggi,
          background: 'linear-gradient(180deg, #fbf6ea 0%, #f1e9d6 100%)',
          borderRadius: 10,
          boxShadow: `0 10px 30px rgba(0,0,0,0.45), 0 0 ${40 * glow}px ${12 * glow}px rgba(241,166,21,${0.55 * glow})`,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: lebar * 0.03,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: lebar * 0.03, fontFamily: FONT, fontWeight: 700, fontSize: lebar * 0.075, color: '#2a2215', lineHeight: 1 }}>
          <Logo varian="maskot" lebar={lebar * 0.1} warna="#2a2215" />
          Remi Kampung Madya
        </div>
        <Qr sisi={qr} />
        <div style={{ fontFamily: FONT, fontWeight: 600, fontSize: lebar * 0.058, color: '#6b5d3f', lineHeight: 1 }}>pindai buat main</div>
      </div>
    </div>
  );
};

/** Gelas kopi bening tampak 3/4 dari atas, dengan uap. */
const Cangkir: React.FC<{ x: number; y: number; skala?: number; benih: number }> = ({ x, y, skala = 1, benih }) => {
  const f = useCurrentFrame();
  const s = 150 * skala;
  return (
    <div style={{ position: 'absolute', left: x - s / 2, top: y - s * 0.95, width: s, height: s * 1.2 }}>
      <svg width={s} height={s * 1.2} viewBox="0 0 100 120">
        <defs>
          <radialGradient id={`kopi${benih}`} cx="45%" cy="40%" r="60%">
            <stop offset="0" stopColor="#5a3416" />
            <stop offset="1" stopColor="#1e0e05" />
          </radialGradient>
        </defs>
        {/* Bayangan dan tatakan */}
        <ellipse cx="52" cy="104" rx="46" ry="14" fill="rgba(0,0,0,0.45)" />
        <ellipse cx="50" cy="100" rx="42" ry="13" fill="#e9dfca" />
        <ellipse cx="50" cy="98" rx="34" ry="10" fill="#d9ceb5" />
        {/* Badan gelas (bening, sedikit menyempit ke bawah) */}
        <path d="M 14 40 L 20 96 L 80 96 L 86 40 Z" fill="rgba(220,230,240,0.18)" stroke="rgba(255,255,255,0.35)" strokeWidth="1.5" />
        <path d="M 19 52 L 23 92 L 77 92 L 81 52 Z" fill={`url(#kopi${benih})`} />
        {/* Permukaan kopi dan bibir gelas */}
        <ellipse cx="50" cy="52" rx="31" ry="9" fill="#4a2a12" />
        <ellipse cx="50" cy="52" rx="31" ry="9" fill="none" stroke="rgba(255,255,255,0.25)" strokeWidth="1" />
        <ellipse cx="50" cy="40" rx="36" ry="11" fill="none" stroke="rgba(255,255,255,0.5)" strokeWidth="2" />
        <path d="M 22 44 Q 26 70 24 90" stroke="rgba(255,255,255,0.35)" strokeWidth="3" fill="none" />
        {/* Uap: sinusoida yang diburamkan */}
        <g fill="none" stroke="rgba(255,245,225,0.55)" strokeWidth="4" strokeLinecap="round" filter="blur(2px)" opacity="0.8">
          {[0, 1, 2].map((i) => {
            const t = f * 0.08 + i * 2.1 + benih;
            const x0 = 36 + i * 14;
            const d = `M ${x0} 36 C ${x0 + 8 * Math.sin(t)} 24, ${x0 - 8 * Math.sin(t + 1)} 14, ${x0 + 6 * Math.sin(t + 2)} 2`;
            return <path key={i} d={d} opacity={0.5 + 0.4 * Math.sin(t * 0.7)} />;
          })}
        </g>
      </svg>
    </div>
  );
};

/** Kartu di meja (punggung cangkir, atau satu kartu muka). */
const KartuMeja: React.FC<{ x: number; y: number; rot: number; muka?: string; lebar?: number }> = ({ x, y, rot, muka, lebar = 130 }) => (
  <div style={{ position: 'absolute', left: x - lebar / 2, top: y - lebar * 0.7, width: lebar, height: lebar * 1.4, transform: `rotate(${rot}deg) scaleY(0.66)`, borderRadius: lebar * 0.07, overflow: 'hidden', boxShadow: '0 8px 16px rgba(0,0,0,0.45)' }}>
    <Img src={staticFile(muka ? `aset/kartu-${muka}.png` : 'aset/kartu-punggung.png')} style={{ width: '100%', height: '100%' }} />
  </div>
);

/**
 * Pemain di seberang meja: siluet ilustrasi tanpa wajah (bukan orang asli, brief §2), disinari lampu dari
 * atas. Badan digambar sebelum bidang meja (tertutup meja), lengan digambar sesudahnya (bertumpu di meja).
 */
const Badan: React.FC<{ x: number; bahu: number; k?: number; sanggul?: boolean }> = ({ x, bahu, k = 1, sanggul }) => (
  <svg width={W} height={H} style={{ position: 'absolute', left: 0, top: 0, overflow: 'visible', filter: 'blur(1.5px)' }}>
    <defs>
      <linearGradient id={`badan${x}`} x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor="#4a3218" />
        <stop offset="0.25" stopColor="#24170b" />
        <stop offset="1" stopColor="#120b05" />
      </linearGradient>
    </defs>
    {/* Sandaran kursi di belakang. */}
    <rect x={x - 175 * k} y={bahu - 40 * k} width={350 * k} height={260 * k} rx={30 * k} fill="#1a1007" />
    {/* Bahu dan badan (bawahnya tertutup meja). */}
    <path
      d={`M ${x - 165 * k} ${bahu + 300 * k} C ${x - 170 * k} ${bahu + 40 * k}, ${x - 120 * k} ${bahu}, ${x - 40 * k} ${bahu - 8 * k} L ${x + 40 * k} ${bahu - 8 * k} C ${x + 120 * k} ${bahu}, ${x + 170 * k} ${bahu + 40 * k}, ${x + 165 * k} ${bahu + 300 * k} Z`}
      fill={`url(#badan${x})`}
      stroke="#8a6230"
      strokeOpacity={0.55}
      strokeWidth={3}
    />
    <rect x={x - 26 * k} y={bahu - 50 * k} width={52 * k} height={60 * k} rx={14 * k} fill="#2a1b0c" />
    {/* Kepala tanpa wajah, diterangi dari atas. */}
    <ellipse cx={x} cy={bahu - 110 * k} rx={62 * k} ry={74 * k} fill={`url(#badan${x})`} stroke="#9a7038" strokeOpacity={0.6} strokeWidth={3} />
    {sanggul && <circle cx={x + 30 * k} cy={bahu - 180 * k} r={30 * k} fill="#2e1e0d" stroke="#9a7038" strokeOpacity={0.5} strokeWidth={2} />}
  </svg>
);

/** Lengan bertumpu di meja menuju HP di depannya. */
const Lengan: React.FC<{ x: number; bahu: number; ke: { x: number; y: number }; k?: number }> = ({ x, bahu, ke, k = 1 }) => (
  <svg width={W} height={H} style={{ position: 'absolute', left: 0, top: 0, overflow: 'visible', filter: 'blur(1.5px)' }}>
    {[-1, 1].map((sisi) => (
      <g key={sisi}>
        <path d={`M ${x + sisi * 130 * k} ${bahu + 150 * k} Q ${x + sisi * 150 * k} ${930} ${ke.x + sisi * 70 * k} ${ke.y - 10}`} stroke="#1c1208" strokeWidth={58 * k} strokeLinecap="round" fill="none" />
        <path d={`M ${x + sisi * 130 * k} ${bahu + 150 * k} Q ${x + sisi * 150 * k} ${930} ${ke.x + sisi * 70 * k} ${ke.y - 10}`} stroke="#8a6230" strokeOpacity={0.35} strokeWidth={3} fill="none" transform={`translate(0 ${-26 * k})`} />
      </g>
    ))}
  </svg>
);

/** Kursi kosong (tempat warga kedai): sandaran kayu di tepi kanan depan. */
const KursiKosong: React.FC = () => (
  <svg width={W} height={H} style={{ position: 'absolute', left: 0, top: 0, overflow: 'visible', filter: 'blur(2px)' }}>
    <rect x={960} y={1260} width={230} height={420} rx={26} fill="#3a230e" stroke="#9a6a34" strokeOpacity={0.5} strokeWidth={4} />
    <rect x={990} y={1300} width={170} height={60} rx={12} fill="#24160a" />
    <rect x={990} y={1400} width={170} height={60} rx={12} fill="#24160a" />
  </svg>
);

/** HP tergeletak/diangkat sesuai pose. */
export const HpMeja: React.FC<{ pose: PoseHp; children?: ReactNode; nyala?: number }> = ({ pose, children, nyala = 1 }) => (
  <Hp lebar={pose.lebar} x={pose.x} y={pose.y} rot={pose.rot} transform={`scaleY(${pose.pipih})`} nyala={nyala} style={{ transformOrigin: 'center' }}>
    {children}
  </Hp>
);

export interface PropsMeja {
  /** 0..1 kamera turun dari lampu ke meja. */
  turun: number;
  /** 0..1 terang keseluruhan (penutup paling terang dan keemasan). */
  terang: number;
  poseKamu: PoseHp;
  poseLawan: PoseHp;
  layarKamu: ReactNode;
  layarLawan: ReactNode;
  layarLain: ReactNode;
  glowQr?: number;
  /** HP yang diangkat digambar di atas semuanya. */
  angkatKamu?: boolean;
  angkatLawan?: boolean;
}

export const MejaKedai: React.FC<PropsMeja> = ({ turun, terang, poseKamu, poseLawan, layarKamu, layarLawan, layarLain, glowQr = 0, angkatKamu, angkatLawan }) => {
  const f = useCurrentFrame();
  // Kamera mulai di lampu (isi digeser turun), lalu turun ke meja.
  const geserY = (1 - turun) * 520;
  const kedip = 1 + noise(f, 2) * 0.03;
  const hpKamu = <HpMeja pose={poseKamu}>{layarKamu}</HpMeja>;
  const hpLawan = <HpMeja pose={poseLawan}>{layarLawan}</HpMeja>;
  return (
    <AbsoluteFill style={{ background: '#0b0805', overflow: 'hidden' }}>
      <AbsoluteFill style={{ transform: `translateY(${geserY}px)` }}>
        {/* Latar kedai gelap dengan bokeh lampu kuning. */}
        <div style={{ position: 'absolute', left: -200, top: -200, width: W + 400, height: H + 900, background: 'radial-gradient(ellipse 70% 40% at 50% 38%, #3a2608 0%, #1b1206 45%, #0b0805 75%)' }} />
        {Array.from({ length: 9 }, (_, i) => {
          const r = 40 + Math.abs(noise(i, 7)) * 70;
          const x = 60 + Math.abs(noise(i + 3, 7)) * (W - 120);
          const y = 120 + Math.abs(noise(i + 9, 7)) * 600;
          return <div key={i} style={{ position: 'absolute', left: x - r, top: y - r, width: r * 2, height: r * 2, borderRadius: r, background: '#ffcc66', opacity: 0.1 + Math.abs(noise(i + 1, 7)) * 0.12, filter: `blur(${r * 0.5}px)` }} />;
        })}
        {/* Lampu gantung: kabel, kap, bohlam. */}
        <div style={{ position: 'absolute', left: W / 2 - 3, top: -600, width: 6, height: 640, background: '#120c05' }} />
        <div style={{ position: 'absolute', left: W / 2 - 190, top: 40, width: 380, height: 150, background: 'linear-gradient(180deg, #2a1c0a, #0e0903)', clipPath: 'polygon(32% 0, 68% 0, 100% 100%, 0 100%)' }} />
        <div style={{ position: 'absolute', left: W / 2 - 190, top: 150, width: 380, height: 70, background: 'radial-gradient(ellipse at 50% 0%, #ffe9b0, rgba(255,210,120,0) 70%)', opacity: 0.9 * kedip }} />
        <div style={{ position: 'absolute', left: W / 2 - 40, top: 160, width: 80, height: 80, borderRadius: 40, background: '#fff3cf', boxShadow: '0 0 60px 30px rgba(255,214,130,0.75)', opacity: kedip }} />
        {/* Kerucut cahaya ke meja. */}
        <div style={{ position: 'absolute', left: W / 2 - 700, top: 200, width: 1400, height: 1700, background: 'radial-gradient(ellipse 50% 60% at 50% 70%, rgba(255,200,100,0.34), rgba(255,200,100,0) 70%)', pointerEvents: 'none' }} />
        {/* Dimas dan Ayu di seberang meja (badan di belakang meja). */}
        <Badan x={260} bahu={760} />
        <Badan x={600} bahu={772} k={0.96} sanggul />
        {/* Bidang meja kayu (melebar ke bawah). */}
        <div
          style={{
            position: 'absolute',
            left: -260,
            top: 900,
            width: W + 520,
            height: 1250,
            clipPath: 'polygon(14% 0, 86% 0, 100% 100%, 0 100%)',
            background: 'linear-gradient(180deg, #7a4a1f 0%, #8a5527 18%, #6e4019 60%, #4a2a10 100%)',
          }}
        >
          <svg width="100%" height="100%" viewBox="0 0 1600 1250" preserveAspectRatio="none" style={{ position: 'absolute', inset: 0, opacity: 0.35 }}>
            {Array.from({ length: 26 }, (_, i) => {
              const y = 20 + i * 48 + noise(i, 11) * 12;
              return <path key={i} d={`M 0 ${y} C 400 ${y + noise(i, 4) * 30}, 800 ${y - noise(i, 5) * 30}, 1600 ${y + noise(i, 6) * 20}`} stroke="#2f1a08" strokeWidth={1.5 + Math.abs(noise(i, 8)) * 2} fill="none" />;
            })}
          </svg>
          {/* Kolam cahaya di meja. */}
          <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(ellipse 60% 50% at 50% 32%, rgba(255,214,140,0.6), rgba(255,214,140,0) 72%)' }} />
          <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(180deg, rgba(0,0,0,0) 40%, rgba(0,0,0,0.5) 100%)' }} />
        </div>
        {/* Benda di meja. */}
        <KartuMeja x={480} y={1310} rot={-28} />
        <KartuMeja x={530} y={1328} rot={-14} />
        <KartuMeja x={572} y={1300} rot={6} />
        <KartuMeja x={200} y={1330} rot={62} />
        <KartuMeja x={760} y={1200} rot={-70} />
        <KartuMeja x={680} y={1600} rot={22} muka="wajik-8" />
        <Cangkir x={POSE.cangkir1.x} y={POSE.cangkir1.y} benih={1} skala={0.95} />
        <Cangkir x={POSE.cangkir2.x} y={POSE.cangkir2.y} benih={2} skala={1.05} />
        <Lengan x={260} bahu={760} ke={POSE.hpDimas} />
        <Lengan x={600} bahu={772} ke={POSE.hpAyu} k={0.96} />
        <HpMeja pose={POSE.hpDimas}>{layarLain}</HpMeja>
        <HpMeja pose={POSE.hpAyu}>{layarLain}</HpMeja>
        <KursiKosong />
        {/* Papan QR kecil di sudut belakang meja, tidak menutupi pemain dan HP. */}
        <PapanQr x={POSE.qr.x} y={POSE.qr.y} lebar={300} glow={glowQr} />
        {!angkatLawan && hpLawan}
        {!angkatKamu && hpKamu}
        {angkatLawan && hpLawan}
        {angkatKamu && hpKamu}
      </AbsoluteFill>
      {/* Terang keemasan penutup. */}
      <AbsoluteFill style={{ background: '#ffb63a', mixBlendMode: 'soft-light', opacity: 0.35 * terang, pointerEvents: 'none' }} />
      <AbsoluteFill style={{ background: 'rgba(255,230,180,1)', mixBlendMode: 'overlay', opacity: 0.18 * terang, pointerEvents: 'none' }} />
    </AbsoluteFill>
  );
};
