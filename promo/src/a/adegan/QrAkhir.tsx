// Adegan 12 (3 dtk terakhir): khusus QR. Kartu krem besar memenuhi layar dengan QR ≥ 600 px menuju URL_GAME, alamat
// situs, dan ajakan singkat, di atas latar kedai keemasan yang diburamkan. Dibuat lama dan besar supaya penonton
// sempat memindai dari layar lain.
import { AbsoluteFill, Easing, interpolate, useCurrentFrame } from 'remotion';
import { FONT, Logo, WARNA } from '../../bagian';
import { Bunyi } from '../efek';
import { K } from '../kamera';
import { Qr } from '../MejaKedai';
import { Panggung, Suasana } from '../Panggung';
import { bang, hidupkan, owner, sampul } from '../tokoh/pose';
import { TEKS_PIL, URL_GAME } from '../waktu';

export const QrAkhir: React.FC = () => {
  const f = useCurrentFrame();
  const masuk = interpolate(f, [0, 12], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: Easing.bezier(0.16, 1, 0.3, 1) });
  return (
    <AbsoluteFill style={{ background: '#17110a' }}>
      {/* Latar: meja kedai keemasan, diburamkan supaya QR jadi satu-satunya fokus. */}
      <AbsoluteFill style={{ filter: 'blur(14px)', scale: '1.06' }}>
        <Panggung kamera={K(540, 1075, 1.1)} bang={{ pose: hidupkan(bang.tertawaLepas, f, 1), ekspresi: 'tertawa' }} owner={{ pose: hidupkan(owner.angkatCangkir, f, 2), ekspresi: 'tertawa' }} sampul={{ pose: hidupkan(sampul.tertawaTutup, f, 4), ekspresi: 'tertawa' }} hangat={1} benih={1200} />
      </AbsoluteFill>
      <Suasana vinyet={0.5} hangat={1} />
      <AbsoluteFill style={{ background: 'rgba(23,17,10,0.45)' }} />
      <div
        style={{
          position: 'absolute',
          left: 110,
          top: 330,
          width: 860,
          borderRadius: 36,
          background: WARNA.krem,
          border: '8px solid #1d1a16',
          boxShadow: '0 30px 80px rgba(0,0,0,0.6), 0 0 60px 10px rgba(241,166,21,0.35)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          padding: '46px 40px 42px',
          boxSizing: 'border-box',
          opacity: masuk,
          scale: String(0.9 + 0.1 * masuk),
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 18, fontFamily: FONT, fontWeight: 800, fontSize: 52, color: '#2a2215', lineHeight: 1 }}>
          <Logo varian="maskot" lebar={70} warna="#2a2215" />
          Remi Kampung Madya
        </div>
        <div style={{ marginTop: 30, padding: 14, background: '#fff', borderRadius: 20, border: '4px solid #1d1a16' }}>
          <Qr sisi={620} />
        </div>
        <div style={{ marginTop: 28, fontFamily: FONT, fontWeight: 700, fontSize: 44, color: '#1d1a16', lineHeight: 1.1 }}>{URL_GAME.replace('https://', '')}</div>
        <div style={{ marginTop: 14, fontFamily: FONT, fontWeight: 600, fontSize: 32, color: '#6b5d3f', lineHeight: 1.2 }}>{TEKS_PIL}</div>
      </div>
      <div style={{ position: 'absolute', left: 0, right: 0, top: 1400, textAlign: 'center', fontFamily: FONT, fontWeight: 800, fontSize: 58, color: '#fff', WebkitTextStroke: '6px #000', paintOrder: 'stroke fill', opacity: interpolate(f, [10, 18], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }) }}>
        Pindai, langsung main.
      </div>
      <Bunyi nama="pop" dari={2} volume={0.7} />
      <Bunyi nama="notifikasi" dari={14} volume={0.5} />
    </AbsoluteFill>
  );
};
