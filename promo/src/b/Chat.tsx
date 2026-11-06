// Layar chat grup generik (brief §6.1): bukan WhatsApp. Latar arang bermotif kawung samar, header dengan
// maskot cangkir, status bar dengan jam dan baterai, bubble kiri/kanan tanpa centang biru.
import type { CSSProperties, ReactNode } from 'react';
import { AbsoluteFill, Img, spring, staticFile, useCurrentFrame, useVideoConfig } from 'remotion';
import { FONT, Logo, WARNA } from '../bagian';
import type { PesanChat } from './waktu';
import { H, W } from './waktu';

export const FONT_CHAT = "Inter, Roboto, 'Noto Sans', 'DejaVu Sans', system-ui, sans-serif";
export const WARNA_NAMA: Record<PesanChat['dari'], string> = { Dimas: '#1f8a9e', Ayu: '#f1a615', Rendi: '#6b865e', Kamu: '#c99a2e' };
const LATAR_CHAT = '#14120f';

/** Motif kawung samar (opacity 4%) dari bentuk punggung kartu. */
export const Kawung: React.FC<{ opacity?: number; warna?: string }> = ({ opacity = 0.04, warna = '#f1a615' }) => (
  <AbsoluteFill
    style={{
      pointerEvents: 'none',
      opacity,
      backgroundImage: `url("data:image/svg+xml;utf8,${encodeURIComponent(
        `<svg xmlns='http://www.w3.org/2000/svg' width='120' height='120' viewBox='0 0 120 120'><g fill='none' stroke='${warna}' stroke-width='2'><ellipse cx='60' cy='30' rx='22' ry='30'/><ellipse cx='60' cy='90' rx='22' ry='30'/><ellipse cx='30' cy='60' rx='30' ry='22'/><ellipse cx='90' cy='60' rx='30' ry='22'/><circle cx='60' cy='60' r='6'/></g></svg>`,
      )}")`,
      backgroundSize: '120px 120px',
    }}
  />
);

const Baterai: React.FC<{ persen: number }> = ({ persen }) => {
  const merah = persen <= 10;
  const warna = merah ? '#ff4d3d' : WARNA.krem;
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
      <span style={{ fontSize: 30, fontWeight: 600, color: warna, fontFamily: FONT_CHAT }}>{persen}%</span>
      <div style={{ position: 'relative', width: 58, height: 28, border: `3px solid ${warna}`, borderRadius: 8, opacity: 0.95 }}>
        <div style={{ position: 'absolute', left: 3, top: 3, bottom: 3, width: `${Math.max(6, persen)}%`, background: warna, borderRadius: 3 }} />
        <div style={{ position: 'absolute', right: -9, top: 7, width: 5, height: 10, background: warna, borderRadius: 2 }} />
      </div>
    </div>
  );
};

const Sinyal: React.FC = () => (
  <div style={{ display: 'flex', alignItems: 'flex-end', gap: 4, height: 28 }}>
    {[10, 16, 22, 28].map((h, i) => (
      <div key={i} style={{ width: 7, height: h, background: WARNA.krem, borderRadius: 2, opacity: i < 3 ? 1 : 0.35 }} />
    ))}
  </div>
);

export const StatusBar: React.FC<{ jam: string; baterai: number }> = ({ jam, baterai }) => (
  <div style={{ position: 'absolute', left: 0, right: 0, top: 0, height: 96, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 56px', fontFamily: FONT_CHAT }}>
    <span style={{ fontSize: 34, fontWeight: 700, color: WARNA.krem, letterSpacing: 0.5 }}>{jam}</span>
    <div style={{ display: 'flex', alignItems: 'center', gap: 22 }}>
      <Sinyal />
      <Baterai persen={baterai} />
    </div>
  </div>
);

export const HeaderChat: React.FC<{ top?: number }> = ({ top = 96 }) => (
  <div style={{ position: 'absolute', left: 0, right: 0, top, height: 140, display: 'flex', alignItems: 'center', gap: 26, padding: '0 48px', borderBottom: '1px solid rgba(251,246,234,0.08)', background: 'rgba(0,0,0,0.18)' }}>
    <div style={{ width: 96, height: 96, borderRadius: 48, background: '#2a2620', display: 'flex', alignItems: 'center', justifyContent: 'center', border: `2px solid rgba(241,166,21,0.35)` }}>
      <Logo varian="maskot" lebar={60} warna={WARNA.kuning} />
    </div>
    <div style={{ fontFamily: FONT_CHAT }}>
      <div style={{ fontSize: 40, fontWeight: 700, color: WARNA.krem, lineHeight: 1.1 }}>Remi Kampung Madya</div>
      <div style={{ fontSize: 28, color: 'rgba(251,246,234,0.62)', marginTop: 6 }}>Dimas, Ayu, Rendi, Kamu</div>
    </div>
  </div>
);

/** Jam kecil di pojok bubble (jam adegan + menit berjalan). */
function jamBubble(jam: string, urut: number): string {
  const [j, m] = jam.split('.').map(Number);
  const total = j * 60 + m + urut;
  return `${String(Math.floor(total / 60) % 24).padStart(2, '0')}.${String(total % 60).padStart(2, '0')}`;
}

export interface PropsBubble {
  pesan: PesanChat;
  /** Frame masuk (pegas 8 frame). */
  frame: number;
  jam?: string;
  urut?: number;
  /** Lebar maksimum bubble. */
  maks?: number;
  ukuran?: number;
  style?: CSSProperties;
}

/** Satu bubble: geser naik 24 px + skala 0,92 → 1 (pegas 8 frame). */
export const Bubble: React.FC<PropsBubble> = ({ pesan, frame, jam = '23.41', urut = 0, maks = 760, ukuran = 42, style }) => {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  if (f < frame) return null;
  const p = spring({ frame: f - frame, fps, config: { damping: 13, stiffness: 220, mass: 0.7 }, durationInFrames: 10 });
  const kamu = pesan.dari === 'Kamu';
  const isi: ReactNode = pesan.kode ? (
    <div style={{ display: 'flex', gap: 20, alignItems: 'center' }}>
      <div style={{ width: 92, height: 92 * 1.4, borderRadius: 8, overflow: 'hidden', boxShadow: '0 4px 12px rgba(0,0,0,0.4)', flex: 'none' }}>
        <Img src={staticFile('aset/kartu-punggung.png')} style={{ width: '100%', height: '100%' }} />
      </div>
      <div style={{ lineHeight: 1.25 }}>
        <div style={{ fontSize: ukuran - 6, color: 'rgba(251,246,234,0.78)' }}>Gabung meja Remi Kampung Madya, kode</div>
        <div style={{ fontFamily: FONT, fontSize: ukuran + 18, fontWeight: 800, color: WARNA.kuning, letterSpacing: 4, marginTop: 4 }}>{pesan.kode}</div>
      </div>
    </div>
  ) : (
    pesan.teks
  );
  return (
    <div
      style={{
        display: 'flex',
        justifyContent: kamu ? 'flex-end' : 'flex-start',
        // Zona aman Reels: kiri 70, kanan 140 px tertutup UI Instagram.
        padding: '0 150px 0 80px',
        marginBottom: 18,
        transform: `translateY(${(1 - p) * 24}px) scale(${0.92 + 0.08 * p})`,
        transformOrigin: kamu ? 'right bottom' : 'left bottom',
        opacity: Math.min(1, p * 1.6),
        ...style,
      }}
    >
      <div
        style={{
          maxWidth: maks,
          background: kamu ? '#c99a2e' : '#2a2620',
          color: kamu ? '#111' : WARNA.krem,
          borderRadius: 22,
          borderBottomRightRadius: kamu ? 6 : 22,
          borderBottomLeftRadius: kamu ? 22 : 6,
          padding: '18px 26px 14px',
          fontFamily: FONT_CHAT,
          fontSize: ukuran,
          lineHeight: 1.3,
          boxShadow: '0 6px 18px rgba(0,0,0,0.35)',
        }}
      >
        {!kamu && <div style={{ fontSize: ukuran - 12, fontWeight: 700, color: WARNA_NAMA[pesan.dari], marginBottom: 6 }}>{pesan.dari}</div>}
        <div>{isi}</div>
        <div style={{ fontSize: ukuran - 18, textAlign: 'right', marginTop: 6, opacity: 0.55 }}>{jamBubble(jam, urut)}</div>
      </div>
    </div>
  );
};

/** "Kamu sedang mengetik…" dengan tiga titik berdenyut. */
export const Mengetik: React.FC<{ dari: number; sampai: number }> = ({ dari, sampai }) => {
  const f = useCurrentFrame();
  if (f < dari || f >= sampai) return null;
  return (
    <div style={{ display: 'flex', justifyContent: 'flex-end', padding: '0 150px 0 80px', marginBottom: 18 }}>
      <div style={{ background: 'rgba(201,154,46,0.35)', borderRadius: 22, padding: '16px 24px', display: 'flex', alignItems: 'center', gap: 14, fontFamily: FONT_CHAT, fontSize: 30, color: WARNA.krem }}>
        <span style={{ opacity: 0.8 }}>Kamu sedang mengetik</span>
        {[0, 1, 2].map((i) => (
          <span key={i} style={{ width: 12, height: 12, borderRadius: 6, background: WARNA.kuning, opacity: 0.35 + 0.65 * Math.max(0, Math.sin((f - dari) * 0.55 - i * 1.1)) }} />
        ))}
      </div>
    </div>
  );
};

export interface PropsChat {
  jam: string;
  baterai: number;
  pesan: PesanChat[];
  /** Indikator mengetik [dari, sampai]. */
  mengetik?: [number, number];
  /** Posisi atas daftar bubble (zona aman: 260–1000). */
  atas?: number;
  /** Redup (layar chat di malam hari, adegan loop). */
  redup?: number;
  children?: ReactNode;
}

/** Layar chat penuh 1080 × 1920. */
/** Layar chat dimulai di bawah logo pojok dan pil (brief: lapisan tetap di y 70–216). */
export const ATAS_CHAT = 236;

export const Chat: React.FC<PropsChat> = ({ jam, baterai, pesan, mengetik, atas = ATAS_CHAT + 300, redup = 0, children }) => (
  <AbsoluteFill style={{ background: LATAR_CHAT }}>
    <Kawung />
    <AbsoluteFill style={{ background: `radial-gradient(ellipse 90% 60% at 50% 30%, rgba(255,255,255,0.04), rgba(0,0,0,0.25))` }} />
    <div style={{ position: 'absolute', left: 0, right: 0, top: ATAS_CHAT, height: 96 }}>
      <StatusBar jam={jam} baterai={baterai} />
    </div>
    <HeaderChat top={ATAS_CHAT + 96} />
    <div style={{ position: 'absolute', left: 0, right: 0, top: atas, width: W }}>
      {pesan.map((p, i) => (
        <Bubble key={i} pesan={p} frame={p.frame} jam={jam} urut={i} />
      ))}
      {mengetik && <Mengetik dari={mengetik[0]} sampai={mengetik[1]} />}
    </div>
    {/* Kotak ketik di bawah (dekoratif, di luar zona aman tidak apa-apa). */}
    <div style={{ position: 'absolute', left: 40, right: 40, top: H - 560, height: 92, borderRadius: 46, background: '#1f1c17', border: '1px solid rgba(251,246,234,0.1)', display: 'flex', alignItems: 'center', padding: '0 36px', fontFamily: FONT_CHAT, fontSize: 32, color: 'rgba(251,246,234,0.35)' }}>
      Tulis pesan
    </div>
    {children}
    {redup > 0 && <AbsoluteFill style={{ background: '#000', opacity: redup, pointerEvents: 'none' }} />}
  </AbsoluteFill>
);

/** Beberapa bubble bertumpuk (kolom) di atas rekaman game, masing-masing muncul di frame-nya. */
export const BubbleTumpuk: React.FC<{ pesan: readonly PesanChat[]; jam?: string; y?: number; urut?: number }> = ({ pesan, jam = '23.41', y = 300, urut = 0 }) => (
  <div style={{ position: 'absolute', left: 0, right: 0, top: y, filter: 'drop-shadow(0 10px 30px rgba(0,0,0,0.6))' }}>
    {pesan.map((p, i) => (
      <Bubble key={p.teks} pesan={p} frame={p.frame} jam={jam} urut={urut + i} maks={820} ukuran={44} />
    ))}
  </div>
);

/** Bubble tunggal yang ditumpangkan di atas rekaman game (separuh atas layar, zona aman). */
export const BubbleGame: React.FC<{ pesan: PesanChat; jam?: string; y?: number; urut?: number }> = ({ pesan, jam = '23.41', y = 330, urut = 0 }) => (
  <div style={{ position: 'absolute', left: 0, right: 0, top: y, filter: 'drop-shadow(0 10px 30px rgba(0,0,0,0.6))' }}>
    <Bubble pesan={pesan} frame={pesan.frame} jam={jam} urut={urut} maks={820} ukuran={44} />
  </div>
);
