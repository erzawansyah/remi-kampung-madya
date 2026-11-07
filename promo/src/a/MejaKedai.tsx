// Meja dan latar Kedai Madya untuk Teaser A (brief A §3): meja kayu hangat bersudut 3/4 dengan kamera sedikit di
// atas meja, kartu fisik berpunggung cangkir, tiga cangkir, tiga HP, papan QR berdiri, lampu gantung kuning
// (kolam cahaya hangat), dinding dengan rak buku samar dan bokeh lampu senar. Gaya sama dengan tokoh: flat,
// garis tinta tebal, bayangan multiply satu tingkat. Semuanya di koordinat panggung 1080 × 1920.
import type { ReactNode } from 'react';
import { create as buatQr } from 'qrcode';
import { AbsoluteFill, Img, staticFile, useCurrentFrame } from 'remotion';
import { FONT, Logo, WARNA } from '../bagian';
import { noise } from './efek';
import { TINTA } from './tokoh/rig';
import { H, URL_GAME, W } from './waktu';

/**
 * Kursi melingkar (titik duduk di panggung, skala, arah hadap badan/kepala): Bang IT di seberang meja menghadap
 * kamera, Cak Owner di sisi kiri menghadap kanan, Mas Sampul di sisi kanan menghadap kiri. Yang di sisi lebih dekat
 * ke kamera, jadi lebih besar dan lebih rendah di layar.
 */
export const KURSI = {
  owner: { x: 118, y: 1446, skala: 1.15, hadapBadan: 0.8, hadap: 0.55 },
  bang: { x: 540, y: 1262, skala: 0.92, hadapBadan: 0, hadap: 0 },
  sampul: { x: 962, y: 1446, skala: 1.15, hadapBadan: -0.8, hadap: -0.55 },
} as const;

/** Meja oval (panggung). */
export const MEJA = { x: 540, y: 1330, rx: 480, ry: 255, tebal: 44 } as const;

/** Benda di meja (titik tengah, panggung). */
export const BENDA = {
  hpOwner: { x: 300, y: 1255, rot: 22 },
  cangkirBang: { x: 690, y: 1150 },
  cangkirOwner: { x: 360, y: 1175 },
  cangkirSampul: { x: 720, y: 1265 },
  qr: { x: 470, y: 1655 },
  kartu: { x: 560, y: 1225 },
} as const;

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

/** Papan QR berdiri (tenda kertas krem) bergaris tinta. `lebar` = lebar muka; titik (x, y) = tengah bawah. */
export const PapanQr: React.FC<{ x: number; y: number; lebar: number; glow?: number }> = ({ x, y, lebar, glow = 0 }) => {
  const tinggi = lebar * 1.22;
  const qr = lebar * 0.76;
  return (
    <div style={{ position: 'absolute', left: x - lebar / 2, top: y - tinggi, width: lebar, height: tinggi + lebar * 0.1 }}>
      <div style={{ position: 'absolute', left: lebar * 0.1, top: tinggi * 0.1, width: lebar, height: tinggi, background: '#000', opacity: 0.22, borderRadius: 10, filter: 'blur(10px)', transform: 'skewX(-8deg)' }} />
      {/* Sisi tenda (menyamping). */}
      <div style={{ position: 'absolute', left: lebar - 8, top: 8, width: lebar * 0.13, height: tinggi - 8, background: '#cfc3a6', border: `${6}px solid ${TINTA}`, borderLeft: 'none', transform: 'skewY(30deg)', transformOrigin: '0 0', borderRadius: '0 8px 8px 0' }} />
      <div
        style={{
          position: 'absolute',
          left: 0,
          top: 0,
          width: lebar,
          height: tinggi,
          background: '#fbf6ea',
          border: `6px solid ${TINTA}`,
          borderRadius: 12,
          boxSizing: 'border-box',
          boxShadow: `0 0 ${40 * glow}px ${12 * glow}px rgba(241,166,21,${0.6 * glow})`,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: lebar * 0.025,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: lebar * 0.03, fontFamily: FONT, fontWeight: 700, fontSize: lebar * 0.072, color: '#2a2215', lineHeight: 1, whiteSpace: 'nowrap' }}>
          <Logo varian="maskot" lebar={lebar * 0.1} warna="#2a2215" />
          Remi Kampung Madya
        </div>
        <Qr sisi={qr} />
        <div style={{ fontFamily: FONT, fontWeight: 600, fontSize: lebar * 0.056, color: '#6b5d3f', lineHeight: 1 }}>pindai buat main</div>
      </div>
    </div>
  );
};

/** Cangkir kuning Madya di meja (tampak 3/4), dengan uap; `retak` 0..1 menggambar retakan di badan gelas. */
export const CangkirMeja: React.FC<{ x: number; y: number; skala?: number; benih: number; retak?: number; uap?: boolean }> = ({ x, y, skala = 1, benih, retak = 0, uap = true }) => {
  const f = useCurrentFrame();
  const s = 110 * skala;
  return (
    <svg width={s * 1.6} height={s * 1.9} viewBox="-40 -90 80 95" style={{ position: 'absolute', left: x - s * 0.8, top: y - s * 1.76, overflow: 'visible' }}>
      <ellipse cx={4} cy={4} rx={30} ry={9} fill="#000" opacity={0.22} />
      <path d="M -24 -40 L -20 0 Q 0 6 20 0 L 24 -40 Z" fill="#f1a615" stroke={TINTA} strokeWidth={5} strokeLinejoin="round" />
      <path d="M 8 -40 L 12 -2 Q 18 -2 20 0 L 24 -40 Z" fill="#000" opacity={0.18} />
      <ellipse cx={0} cy={-40} rx={24} ry={8} fill="#ffd36a" stroke={TINTA} strokeWidth={5} />
      <ellipse cx={0} cy={-40} rx={17} ry={5} fill="#3b2314" />
      <path d="M 24 -30 Q 44 -28 42 -10 Q 40 2 22 0" fill="none" stroke={TINTA} strokeWidth={13} strokeLinecap="round" />
      <path d="M 24 -30 Q 44 -28 42 -10 Q 40 2 22 0" fill="none" stroke="#f1a615" strokeWidth={5} strokeLinecap="round" />
      {retak > 0 && (
        <g stroke={TINTA} strokeWidth={2.2} fill="none" strokeLinecap="round" strokeDasharray={120} strokeDashoffset={120 * (1 - retak)}>
          <path d="M -6 -36 L -2 -24 L -10 -16 L -4 -6 L -8 2" />
          <path d="M -2 -24 L 8 -20 L 6 -12" />
          <path d="M -10 -16 L -18 -14" />
        </g>
      )}
      {uap && (
        <g fill="none" stroke="rgba(255,245,225,0.6)" strokeWidth={3} strokeLinecap="round" opacity={0.75}>
          {[0, 1].map((i) => {
            const t = f * 0.09 + i * 2.3 + benih;
            const x0 = -8 + i * 14;
            return <path key={i} d={`M ${x0} -50 C ${x0 + 6 * Math.sin(t)} -60, ${x0 - 6 * Math.sin(t + 1)} -70, ${x0 + 5 * Math.sin(t + 2)} -82`} opacity={0.5 + 0.4 * Math.sin(t * 0.7)} />;
          })}
        </g>
      )}
    </svg>
  );
};

/** HP tergeletak di meja bergaris tinta (menampilkan still game kalau ada). */
export const HpMeja: React.FC<{ x: number; y: number; rot?: number; lebar?: number; layar?: string; nyala?: number }> = ({ x, y, rot = 0, lebar = 96, layar, nyala = 1 }) => {
  const tinggi = lebar * 2.05;
  return (
    <div style={{ position: 'absolute', left: x - lebar / 2, top: y - tinggi / 2, width: lebar, height: tinggi, transform: `rotate(${rot}deg) scaleY(0.78)`, borderRadius: lebar * 0.16, background: '#141317', border: `6px solid ${TINTA}`, boxSizing: 'border-box', boxShadow: '0 10px 14px rgba(0,0,0,0.35)', overflow: 'hidden' }}>
      <div style={{ position: 'absolute', inset: 6, borderRadius: lebar * 0.1, background: '#15542f', overflow: 'hidden', opacity: nyala }}>
        {layar && <Img src={staticFile(layar)} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />}
        <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(115deg, rgba(255,255,255,0.18) 0%, rgba(255,255,255,0) 40%)' }} />
      </div>
    </div>
  );
};

/** Kartu fisik di meja (punggung cangkir), tergeletak. `lompat` 0..1 = melompat saat meja digebrak. */
export const KartuMeja: React.FC<{ x: number; y: number; rot: number; muka?: string; lebar?: number; lompat?: number }> = ({ x, y, rot, muka, lebar = 92, lompat = 0 }) => (
  <div
    style={{
      position: 'absolute',
      left: x - lebar / 2,
      top: y - lebar * 0.7 - lompat * 26,
      width: lebar,
      height: lebar * 1.4,
      transform: `rotate(${rot + lompat * 9}deg) scaleY(0.72)`,
      borderRadius: lebar * 0.08,
      overflow: 'hidden',
      border: `4px solid ${TINTA}`,
      boxSizing: 'border-box',
      boxShadow: `0 ${8 + lompat * 18}px ${14 + lompat * 20}px rgba(0,0,0,0.4)`,
    }}
  >
    <Img src={staticFile(muka ? `aset/kartu-${muka}.png` : 'aset/kartu-punggung.png')} style={{ width: '100%', height: '100%' }} />
  </div>
);

/** Buku di rak (kotak warna-warni), diburamkan: cukup terbaca sebagai kedai tanpa orang lain. */
const RakBuku: React.FC<{ x: number; y: number; lebar: number; benih: number }> = ({ x, y, lebar, benih }) => {
  const warna = ['#b5473c', '#1f8a9e', '#f1a615', '#6b865e', '#e9dfca', '#7a4a1f', '#3b4a6b'];
  const buku: ReactNode[] = [];
  let bx = 0;
  let i = 0;
  while (bx < lebar - 20) {
    const w = 22 + Math.abs(noise(i + benih, 5)) * 26;
    const h = 90 + Math.abs(noise(i + benih, 6)) * 60;
    buku.push(<rect key={i} x={bx} y={160 - h} width={w} height={h} rx={3} fill={warna[(i + benih) % warna.length]} opacity={0.85} />);
    bx += w + 4;
    i++;
  }
  return (
    <svg width={lebar} height={360} style={{ position: 'absolute', left: x, top: y, filter: 'blur(5px)', opacity: 0.8 }}>
      <rect x={0} y={160} width={lebar} height={14} fill="#3a2410" />
      <g>{buku}</g>
      <g transform="translate(0 190)">{buku.map((b, j) => (j % 3 === 0 ? null : b))}</g>
      <rect x={0} y={350} width={lebar} height={10} fill="#3a2410" />
    </svg>
  );
};

export interface PropsMeja {
  /** 0 = malam biasa, 1 = penutup keemasan paling hangat. */
  hangat: number;
  /** 0..1: adegan tegang, cahaya meredup kebiruan. */
  dingin: number;
  /** Bang IT: badan (sebelum meja) dan lengan (sesudah meja). */
  bangBadan: ReactNode;
  bangLengan: ReactNode;
  /** Tokoh di sisi meja: badan sebelum meja (pangkuan tertutup meja), lengan sesudahnya. */
  sisiBadan: ReactNode;
  sisiLengan: ReactNode;
  lompatKartu?: number;
  glowQr?: number;
  layarHpOwner?: string | null;
  tampilCangkirBang?: boolean;
  tampilCangkirOwner?: boolean;
  retakCangkirBang?: number;
  /** Benda depan (kartu depan, papan QR) digambar pemanggil di lapisan depan kamera. */
  tanpaDepan?: boolean;
}

/** Benda di tepi depan meja (lapisan paralaks depan): satu kartu dan papan QR berdiri. */
export const BendaDepan: React.FC<{ lompatKartu?: number; glowQr?: number }> = ({ lompatKartu = 0, glowQr = 0 }) => (
  <>
    <KartuMeja x={610} y={1470} rot={58} lebar={100} lompat={lompatKartu * 0.6} />
    <PapanQr x={BENDA.qr.x} y={BENDA.qr.y} lebar={300} glow={glowQr} />
  </>
);

/** Latar kedai (lapisan paralaks belakang): dinding, rak buku samar, lampu senar, lampu gantung. */
export const Latar: React.FC = () => {
  const f = useCurrentFrame();
  const kedip = 1 + noise(f, 2) * 0.025;
  return (
    <AbsoluteFill style={{ background: '#17110a', overflow: 'hidden' }}>
      <div style={{ position: 'absolute', left: -300, top: -300, width: W + 600, height: 1700, background: 'radial-gradient(ellipse 70% 55% at 50% 50%, #5a3d1e 0%, #3a2712 48%, #1c1309 85%)' }} />
      <RakBuku x={-60} y={420} lebar={380} benih={1} />
      <RakBuku x={760} y={390} lebar={400} benih={4} />
      {Array.from({ length: 12 }, (_, i) => {
        const x = 40 + i * 92 + noise(i, 3) * 30;
        const y = 300 + Math.sin(i * 0.9) * 70 + 40;
        const r = 16 + Math.abs(noise(i, 4)) * 12;
        return <div key={i} style={{ position: 'absolute', left: x - r, top: y - r, width: r * 2, height: r * 2, borderRadius: r, background: '#ffd36a', opacity: 0.35 + Math.abs(noise(i + 2, 4)) * 0.3, filter: `blur(${r * 0.45}px)` }} />;
      })}
      <svg width={W} height={500} style={{ position: 'absolute', left: 0, top: 0 }}>
        <path d="M 0 300 Q 270 420 540 330 Q 810 240 1080 360" fill="none" stroke="#120c05" strokeWidth={3} opacity={0.6} />
      </svg>
      <div style={{ position: 'absolute', left: W / 2 - 4, top: -20, width: 8, height: 250, background: TINTA }} />
      <svg width={420} height={200} style={{ position: 'absolute', left: W / 2 - 210, top: 225 }}>
        <path d="M 150 0 L 270 0 L 410 150 L 10 150 Z" fill="#2e1d0b" stroke={TINTA} strokeWidth={7} strokeLinejoin="round" />
        <path d="M 150 0 L 210 0 L 150 150 L 10 150 Z" fill="#4a2f12" opacity={0.5} />
        <ellipse cx={210} cy={150} rx={200} ry={26} fill="#ffe9b0" opacity={0.95 * kedip} />
        <circle cx={210} cy={160} r={34} fill="#fff3cf" />
      </svg>
      <div style={{ position: 'absolute', left: W / 2 - 60, top: 350, width: 120, height: 120, borderRadius: 60, background: '#fff3cf', filter: 'blur(28px)', opacity: 0.9 * kedip }} />
      <div style={{ position: 'absolute', left: W / 2 - 760, top: 360, width: 1520, height: 1500, background: 'radial-gradient(ellipse 48% 56% at 50% 64%, rgba(255,205,110,0.36), rgba(255,205,110,0) 70%)', pointerEvents: 'none' }} />
    </AbsoluteFill>
  );
};

/** Meja oval dan semua yang ada di atasnya, plus tokoh (lapisan paralaks tengah). */
export const Meja: React.FC<PropsMeja> = ({ hangat, dingin, bangBadan, bangLengan, sisiBadan, sisiLengan, lompatKartu = 0, glowQr = 0, layarHpOwner = 'rekam/a1-lobi.png', tampilCangkirBang = true, tampilCangkirOwner = true, retakCangkirBang = 0, tanpaDepan = false }) => {
  const { x: mx, y: my, rx, ry, tebal } = MEJA;
  return (
    <AbsoluteFill style={{ overflow: 'visible' }}>
      {bangBadan}
      {sisiBadan}
      {/* Meja oval: bidang atas, lalu sisi tebal di bawah lengkung depan. */}
      <svg width={W} height={H} style={{ position: 'absolute', left: 0, top: 0, overflow: 'visible' }}>
        <defs>
          <radialGradient id="kayuOval" cx="50%" cy="35%" r="70%">
            <stop offset="0" stopColor="#a4682f" />
            <stop offset="0.55" stopColor="#8a5527" />
            <stop offset="1" stopColor="#5c3614" />
          </radialGradient>
          <radialGradient id="kolamOval" cx="50%" cy="30%" r="55%">
            <stop offset="0" stopColor="#ffd98a" stopOpacity={0.5} />
            <stop offset="1" stopColor="#ffd98a" stopOpacity={0} />
          </radialGradient>
          <clipPath id="atasMeja">
            <ellipse cx={mx} cy={my} rx={rx} ry={ry} />
          </clipPath>
        </defs>
        <path d={`M ${mx - rx} ${my} A ${rx} ${ry} 0 0 0 ${mx + rx} ${my} L ${mx + rx} ${my + tebal} A ${rx} ${ry} 0 0 1 ${mx - rx} ${my + tebal} Z`} fill="#4a2a10" stroke={TINTA} strokeWidth={8} strokeLinejoin="round" />
        <ellipse cx={mx} cy={my} rx={rx} ry={ry} fill="url(#kayuOval)" stroke={TINTA} strokeWidth={8} />
        <g clipPath="url(#atasMeja)" opacity={0.4}>
          {Array.from({ length: 16 }, (_, i) => {
            const y = my - ry + 20 + i * 32;
            return <path key={i} d={`M ${mx - rx} ${y} Q ${mx - 200} ${y + noise(i, 7) * 12} ${mx} ${y + noise(i, 8) * 8} Q ${mx + 240} ${y - noise(i, 9) * 12} ${mx + rx} ${y}`} stroke="#5c3614" strokeWidth={2 + Math.abs(noise(i, 10)) * 2} fill="none" />;
          })}
        </g>
        <ellipse cx={mx} cy={my} rx={rx} ry={ry} fill="url(#kolamOval)" />
        <ellipse cx={mx} cy={my} rx={rx - 4} ry={ry - 4} fill="none" stroke="#000" strokeWidth={10} opacity={0.12} />
      </svg>
      {/* Benda di meja (belakang → depan). */}
      <KartuMeja x={BENDA.kartu.x - 70} y={BENDA.kartu.y + 30} rot={-24} lompat={lompatKartu} />
      <KartuMeja x={BENDA.kartu.x - 20} y={BENDA.kartu.y + 44} rot={-8} lompat={lompatKartu * 0.8} />
      <KartuMeja x={BENDA.kartu.x + 30} y={BENDA.kartu.y + 30} rot={10} lompat={lompatKartu * 1.2} />
      <KartuMeja x={BENDA.kartu.x + 80} y={BENDA.kartu.y + 50} rot={26} muka="wajik-8" lompat={lompatKartu * 0.9} />
      {tampilCangkirBang && <CangkirMeja x={BENDA.cangkirBang.x} y={BENDA.cangkirBang.y} benih={2} skala={0.9} retak={retakCangkirBang} />}
      {bangLengan}
      {tampilCangkirOwner && <CangkirMeja x={BENDA.cangkirOwner.x} y={BENDA.cangkirOwner.y} benih={1} skala={0.95} />}
      {layarHpOwner !== null && <HpMeja x={BENDA.hpOwner.x} y={BENDA.hpOwner.y} rot={BENDA.hpOwner.rot} lebar={84} layar={layarHpOwner ?? undefined} />}
      <CangkirMeja x={BENDA.cangkirSampul.x} y={BENDA.cangkirSampul.y} benih={3} skala={1} />
      {sisiLengan}
      {!tanpaDepan && <BendaDepan lompatKartu={lompatKartu} glowQr={glowQr} />}
      {dingin > 0 && <AbsoluteFill style={{ background: '#0a1a33', mixBlendMode: 'multiply', opacity: 0.75 * dingin, pointerEvents: 'none' }} />}
      {hangat > 0 && <AbsoluteFill style={{ background: '#ffb63a', mixBlendMode: 'soft-light', opacity: 0.45 * hangat, pointerEvents: 'none' }} />}
    </AbsoluteFill>
  );
};
