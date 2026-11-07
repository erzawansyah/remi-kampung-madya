// Adegan 3 (5–9 dtk): Mas Sampul mengarahkan HP ke papan QR. Sisipan layar: QR terpindai → game terbuka tanpa
// login → ketik nama → lobi game asli terisi Bang IT, Cak Owner, Mas Sampul.
import { AbsoluteFill, Easing, interpolate, useCurrentFrame } from 'remotion';
import { trek, trekEkspresi, trekPose } from '../animasi';
import { FONT } from '../../bagian';
import { Bunyi } from '../efek';
import { LayarHp } from '../Hp';
import { K, kameraDari } from '../kamera';
import { Qr } from '../MejaKedai';
import { Panggung, Suasana } from '../Panggung';
import { LayarStill, Sisipan } from '../Sisipan';
import { bang, hidupkan, owner, sampul, WAJAH } from '../tokoh/pose';
import { ADEGAN } from '../waktu';

const PINDAI = 10;
const BERANDA = 42;
const NAMA = 64;
const LOBI = 86;

/** Layar HP: bingkai kamera memindai papan QR, lalu tautan terbaca. */
const LayarPindai: React.FC = () => {
  const f = useCurrentFrame();
  const kena = f >= 26;
  return (
    <LayarHp style={{ background: '#0c0a08' }}>
      <div style={{ position: 'absolute', left: 0, top: 0, width: 390, height: 844, background: 'radial-gradient(ellipse 70% 50% at 50% 55%, #6a4420 0%, #2a1a0a 70%)' }} />
      <div
        style={{
          position: 'absolute',
          left: 60,
          top: 250,
          width: 270,
          height: 330,
          background: '#fbf6ea',
          borderRadius: 10,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 8,
          scale: String(interpolate(f, [0, 26], [1, 1.08], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: Easing.bezier(0.16, 1, 0.3, 1) })),
          filter: `blur(${interpolate(f, [0, 16], [2, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' })}px)`,
        }}
      >
        <div style={{ fontFamily: FONT, fontWeight: 700, fontSize: 19, color: '#2a2215' }}>Remi Kampung Madya</div>
        <Qr sisi={210} />
        <div style={{ fontFamily: FONT, fontWeight: 600, fontSize: 15, color: '#6b5d3f' }}>pindai buat main</div>
      </div>
      <svg width={390} height={844} style={{ position: 'absolute', left: 0, top: 0 }}>
        <g fill="none" stroke={kena ? '#5fd38a' : '#ffffff'} strokeWidth={5} strokeLinecap="round">
          <path d="M 50 250 L 50 220 L 80 220" />
          <path d="M 340 250 L 340 220 L 310 220" />
          <path d="M 50 590 L 50 620 L 80 620" />
          <path d="M 340 590 L 340 620 L 310 620" />
        </g>
        {!kena && <rect x={56} y={300 + ((f * 9) % 240)} width={278} height={3} fill="#f1a615" opacity={0.9} />}
      </svg>
      {kena && (
        <div style={{ position: 'absolute', left: 30, right: 30, top: 650, padding: '14px 18px', background: 'rgba(255,255,255,0.95)', borderRadius: 16, fontFamily: FONT, fontWeight: 600, fontSize: 18, color: '#111', textAlign: 'center', scale: String(interpolate(f, [26, 32], [0.9, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: Easing.bezier(0.16, 1, 0.3, 1) })) }}>
          remi-madya.likrea.biz.id
        </div>
      )}
      <div style={{ position: 'absolute', left: 0, right: 0, bottom: 40, display: 'flex', justifyContent: 'center' }}>
        <div style={{ width: 70, height: 70, borderRadius: 35, border: '5px solid #fff', background: 'rgba(255,255,255,0.3)' }} />
      </div>
    </LayarHp>
  );
};

export const PindaiQr: React.FC = () => {
  const f = useCurrentFrame();
  const lama = ADEGAN.pindaiQr;
  const kamera = kameraDari(f, [
    [0, K(560, 1000, 1.58)],
    [16, K(WAJAH.sampul.x - 60, WAJAH.sampul.y + 40, 2.3)],
    [BERANDA, K(WAJAH.sampul.x - 60, WAJAH.sampul.y + 50, 2.42), 'linear'],
    [BERANDA + 16, K(760, 1180, 1.6)],
    [lama, K(760, 1180, 1.68), 'linear'],
  ]);
  return (
    <AbsoluteFill style={{ background: '#17110a' }}>
      <Panggung
        kamera={kamera}
        bang={{ pose: hidupkan(trekPose(f, [[0, bang.sombong], [20, bang.sombong], [40, bang.lihatHp]]), f, 1), ekspresi: trekEkspresi(f, [[0, 'sombong'], [40, 'fokus']]) }}
        owner={{ pose: hidupkan(trekPose(f, [[0, owner.santai], [20, owner.santai], [34, owner.seruput], [52, owner.seruput], [68, owner.santai]]), f, 2), ekspresi: 'datar' }}
        sampul={{ pose: hidupkan(trekPose(f, [[0, sampul.mainHp], [16, sampul.arahkanQr, 'pegas'], [LOBI, sampul.arahkanQr], [LOBI + 12, sampul.mainHp, 'pegas']]), f, 4), ekspresi: trekEkspresi(f, [[0, 'fokus'], [16, 'girang']]) }}
        glowQr={trek(f, [
          [0, 0],
          [12, 1],
          [BERANDA, 1],
          [BERANDA + 10, 0],
        ])}
        benih={150}
      />
      <Suasana vinyet={0.5} />
      <Sisipan nama="pindai QR" dari={PINDAI} lama={BERANDA - PINDAI} x={330} y={820} lebar={430} rot={-4} masukDari={{ x: -60, y: 20 }}>
        <LayarPindai />
      </Sisipan>
      <Sisipan nama="beranda" dari={BERANDA} lama={NAMA - BERANDA} x={330} y={820} lebar={430} rot={-4} masukDari={{ x: 0, y: 0 }}>
        <LayarStill berkas="a1-beranda.png" />
      </Sisipan>
      <Sisipan nama="isian nama" dari={NAMA} lama={LOBI - NAMA} x={330} y={820} lebar={430} rot={-4} masukDari={{ x: 0, y: 0 }}>
        <LayarStill berkas="a1-nama.png" />
      </Sisipan>
      <Sisipan nama="lobi" dari={LOBI} lama={lama - LOBI} x={330} y={820} lebar={430} rot={-4} masukDari={{ x: 0, y: 0 }}>
        <LayarStill berkas="a1-sampul-lobi.png" />
      </Sisipan>
      <Bunyi nama="e:whoosh" dari={0} volume={0.45} rate={1.2} />
      <Bunyi nama="klik" dari={PINDAI + 2} volume={0.6} />
      <Bunyi nama="notifikasi" dari={PINDAI + 26} volume={0.6} />
      <Bunyi nama="pop" dari={BERANDA} volume={0.6} />
      <Bunyi nama="pop" dari={NAMA} volume={0.6} />
      <Bunyi nama="klik" dari={NAMA + 4} volume={0.35} />
      <Bunyi nama="klik" dari={NAMA + 8} volume={0.35} />
      <Bunyi nama="klik" dari={NAMA + 12} volume={0.35} />
      <Bunyi nama="pop" dari={LOBI} volume={0.6} />
      <Bunyi nama="giliran" dari={LOBI + 6} volume={0.4} />
    </AbsoluteFill>
  );
};
