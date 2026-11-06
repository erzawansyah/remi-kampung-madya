// Komponen dasar video: kartu (gambar asli dari kode game), latar laken/arang, teks, dan logo.
import type { CSSProperties, ReactNode } from 'react';
import { AbsoluteFill, cancelRender, continueRender, delayRender, Img, staticFile } from 'remotion';

export const W = 1080;
export const H = 1920;
export const RASIO_KARTU = 1.4;

/** Palet dari apps/client/src/gaya/token.css. */
export const WARNA = {
  laken: '#15542f',
  lakenTerang: '#1d6a3d',
  lakenGelap: '#0c3a20',
  lakenPekat: '#072414',
  arang: '#1d1a16',
  arangTerang: '#29241d',
  arangPekat: '#13110e',
  kuning: '#f1a615',
  emasMuda: '#ecc65c',
  krem: '#fbf6ea',
  tinta: '#111111',
  merah: '#ff5a4e',
};

export const FONT = "'Baloo 2', ui-rounded, system-ui, sans-serif";

// Font Baloo 2 yang sama dengan aplikasi (apps/client/public/font).
const tungguFont = delayRender('Memuat font Baloo 2');
new FontFace('Baloo 2', `url(${staticFile('aset/baloo2-latin.woff2')}) format('woff2')`, { weight: '400 800' })
  .load()
  .then((f) => {
    document.fonts.add(f);
    continueRender(tungguFont);
  })
  .catch((e) => cancelRender(e));

export type IdKartu = `${'love' | 'wajik' | 'kriting' | 'waru'}-${number}`;

export interface PropsKartu {
  /** Kartu yang dibuka, atau null untuk punggung saja. */
  kartu: IdKartu | null;
  lebar: number;
  /** Titik tengah kartu. */
  x: number;
  y: number;
  rot?: number;
  skala?: number;
  /** 0 = tertutup (punggung), 1 = terbuka. Di antaranya kartu sedang dibalik. */
  buka?: number;
  /** Tinggi kartu di atas meja (0..1): bayangan makin lebar dan jauh. */
  angkat?: number;
  opacity?: number;
  children?: ReactNode;
}

/** Kartu dengan gambar dari kartuGrafisGambar.ts. Dibalik dengan rotateY dua sisi. */
export const Kartu: React.FC<PropsKartu> = ({ kartu, lebar, x, y, rot = 0, skala = 1, buka = kartu ? 1 : 0, angkat = 0, opacity = 1, children }) => {
  const tinggi = lebar * RASIO_KARTU;
  const sudut = lebar * 0.07;
  const bayangan = `0 ${6 + angkat * 40}px ${14 + angkat * 50}px rgba(0,0,0,${0.42 - angkat * 0.12})`;
  const sisi: CSSProperties = {
    position: 'absolute',
    inset: 0,
    borderRadius: sudut,
    backfaceVisibility: 'hidden',
    boxShadow: bayangan,
    overflow: 'hidden',
  };
  const putar = (1 - buka) * 180;
  return (
    <div
      style={{
        position: 'absolute',
        left: x - lebar / 2,
        top: y - tinggi / 2,
        width: lebar,
        height: tinggi,
        transform: `rotate(${rot}deg) scale(${skala * (1 + angkat * 0.08)})`,
        perspective: lebar * 6,
        opacity,
      }}
    >
      <div style={{ position: 'absolute', inset: 0, transformStyle: 'preserve-3d', transform: `rotateY(${putar}deg)` }}>
        {kartu && (
          <div style={sisi}>
            <Img src={staticFile(`aset/kartu-${kartu}.png`)} style={{ width: '100%', height: '100%' }} />
          </div>
        )}
        <div style={{ ...sisi, transform: 'rotateY(180deg)' }}>
          <Img src={staticFile('aset/kartu-punggung.png')} style={{ width: '100%', height: '100%' }} />
        </div>
      </div>
      {children}
    </div>
  );
};

/** Laken hijau meja (sama dengan --laken* di aplikasi), dengan vinyet. */
export const Laken: React.FC<{ children?: ReactNode; style?: CSSProperties }> = ({ children, style }) => (
  <AbsoluteFill
    style={{
      background: `radial-gradient(ellipse 80% 60% at 50% 46%, ${WARNA.lakenTerang} 0%, ${WARNA.laken} 42%, ${WARNA.lakenGelap} 78%, ${WARNA.lakenPekat} 100%)`,
      ...style,
    }}
  >
    {children}
  </AbsoluteFill>
);

/** Arang punggung kartu ("papan nama MADYA di malam hari"). */
export const Arang: React.FC<{ children?: ReactNode }> = ({ children }) => (
  <AbsoluteFill
    style={{ background: `radial-gradient(ellipse 85% 60% at 50% 42%, ${WARNA.arangTerang} 0%, ${WARNA.arang} 50%, ${WARNA.arangPekat} 100%)` }}
  >
    {children}
  </AbsoluteFill>
);

/** Logo Kedai Madya (path dari aset/logoMadya.ts) diwarnai lewat mask. */
export const Logo: React.FC<{ varian: 'lengkap' | 'maskot'; lebar: number; warna: string; style?: CSSProperties }> = ({ varian, lebar, warna, style }) => {
  const rasio = varian === 'lengkap' ? 246 / 576 : 246 / 330;
  const url = `url(${staticFile(`aset/logo-${varian}.svg`)})`;
  return (
    <div
      style={{
        width: lebar,
        height: lebar * rasio,
        backgroundColor: warna,
        WebkitMaskImage: url,
        maskImage: url,
        WebkitMaskSize: 'contain',
        maskSize: 'contain',
        WebkitMaskRepeat: 'no-repeat',
        maskRepeat: 'no-repeat',
        ...style,
      }}
    />
  );
};

const bayanganTeks = '0 4px 0 rgba(0,0,0,0.35), 0 10px 30px rgba(0,0,0,0.45)';

/** Teks keterangan di area aman Reels (atas tengah). */
export const Keterangan: React.FC<{ judul: ReactNode; sub?: ReactNode; opacity?: number; geser?: number; subOpacity?: number; top?: number }> = ({
  judul,
  sub,
  opacity = 1,
  geser = 0,
  subOpacity = 1,
  top = 250,
}) => (
  <div
    style={{
      position: 'absolute',
      top,
      left: 80,
      right: 80,
      textAlign: 'center',
      fontFamily: FONT,
      color: WARNA.krem,
      opacity,
      transform: `translateY(${geser}px)`,
    }}
  >
    <div style={{ fontSize: 92, fontWeight: 800, lineHeight: 1.05, textShadow: bayanganTeks }}>{judul}</div>
    {sub && (
      <div style={{ fontSize: 54, fontWeight: 600, lineHeight: 1.2, marginTop: 18, color: WARNA.emasMuda, opacity: subOpacity, textShadow: bayanganTeks }}>
        {sub}
      </div>
    )}
  </div>
);

/** Sorakan besar ala meja (kuning bergaris tinta). */
export const Sorak: React.FC<{ teks: ReactNode; ukuran: number; x: number; y: number; skala: number; rot?: number; warna?: string; opacity?: number }> = ({
  teks,
  ukuran,
  x,
  y,
  skala,
  rot = -4,
  warna = WARNA.kuning,
  opacity = 1,
}) => (
  <div
    style={{
      position: 'absolute',
      left: 0,
      width: W,
      top: y - ukuran * 0.6,
      textAlign: 'center',
      fontFamily: FONT,
      fontWeight: 800,
      fontSize: ukuran,
      lineHeight: 1.1,
      color: warna,
      transform: `translateX(${x - W / 2}px) rotate(${rot}deg) scale(${skala})`,
      WebkitTextStroke: `${Math.round(ukuran / 14)}px ${WARNA.tinta}`,
      paintOrder: 'stroke fill',
      textShadow: '0 10px 0 rgba(0,0,0,0.35), 0 18px 40px rgba(0,0,0,0.5)',
      opacity,
      whiteSpace: 'nowrap',
    }}
  >
    {teks}
  </div>
);
