// Panggung Teaser A: tiga lapisan kamera 2.5D (latar jauh, meja + tokoh, benda depan) dan pembantu di sekitarnya:
// keadaan tokoh per frame, titik mulut untuk ekor balon, balon yang diproyeksikan ke layar, dan lapisan suasana
// (vinyet, redup kebiruan, keemasan) sebagai CSS biasa di ruang layar. Semua adegan memakai komponen ini.
import type { ReactNode } from 'react';
import { AbsoluteFill, useCurrentFrame } from 'remotion';
import { Balon } from './Balon';
import { Kamera, Lapisan, proyeksi, Z, type PoseKamera } from './kamera';
import { BendaDepan, KURSI, Latar, Meja } from './MejaKedai';
import { TokohDiKursi } from './PanggungTokoh';
import { BANG_IT } from './tokoh/BangIT';
import { CAK_OWNER } from './tokoh/CakOwner';
import { MAS_SAMPUL } from './tokoh/MasSampul';
import { kedipDi, napasDi, POSE_DASAR, type Desain, type Ekspresi, type Pose } from './tokoh/rig';

export interface KeadaanTokoh {
  pose: Pose;
  ekspresi: Ekspresi;
  geserX?: number;
  geserY?: number;
  rot?: number;
  sx?: number;
  sy?: number;
  ayun?: number;
  retakCangkir?: number;
}

export interface PropsPanggung {
  kamera: PoseKamera;
  bang: KeadaanTokoh;
  owner: KeadaanTokoh;
  sampul: KeadaanTokoh;
  /** 0..1 meredup kebiruan (adegan tegang) dan 0..1 keemasan (penutup). */
  dingin?: number;
  hangat?: number;
  lompatKartu?: number;
  glowQr?: number;
  /** Kursi Bang IT kosong (ia belum duduk) dan Bang IT digambar tanpa kursi (sedang berjalan). */
  kursiKosongBang?: boolean;
  bangTanpaKursi?: boolean;
  tampilCangkirBang?: boolean;
  tampilCangkirOwner?: boolean;
  retakCangkirBang?: number;
  /** Benih kedip/napas digeser supaya tiap adegan tidak mengulang pola yang sama persis. */
  benih?: number;
}

export const Panggung: React.FC<PropsPanggung> = ({ kamera, bang, owner, sampul, dingin = 0, hangat = 0, lompatKartu = 0, glowQr = 0, kursiKosongBang = false, bangTanpaKursi = false, tampilCangkirBang = true, tampilCangkirOwner = true, retakCangkirBang = 0, benih = 0 }) => {
  const f = useCurrentFrame() + benih;
  const tokoh = (D: Desain, kursi: (typeof KURSI)[keyof typeof KURSI], k: KeadaanTokoh, b: number, lapisan: 'badan' | 'lengan', pakaiKursi = true) => (
    <TokohDiKursi kursi={kursi} desain={D} ekspresi={k.ekspresi} kedip={kedipDi(f, b)} napas={napasDi(f, b)} pose={k.pose} geserX={k.geserX} geserY={k.geserY} rot={k.rot} sx={k.sx} sy={k.sy} ayun={k.ayun} retakCangkir={k.retakCangkir} lapisan={lapisan} pakaiKursi={pakaiKursi} />
  );
  return (
    <Kamera pose={kamera}>
      <Lapisan z={Z.latar}>
        <Latar />
      </Lapisan>
      <Lapisan z={Z.meja}>
        <Meja
          hangat={hangat}
          dingin={dingin}
          lompatKartu={lompatKartu}
          tanpaDepan
          tampilCangkirBang={tampilCangkirBang}
          tampilCangkirOwner={tampilCangkirOwner}
          retakCangkirBang={retakCangkirBang}
          bangBadan={
            <>
              {kursiKosongBang && <TokohDiKursi kursi={KURSI.bang} desain={BANG_IT} ekspresi="datar" kedip={0} napas={0} pose={POSE_DASAR} hanyaKursi />}
              {tokoh(BANG_IT, KURSI.bang, bang, 1, 'badan', !bangTanpaKursi)}
            </>
          }
          bangLengan={tokoh(BANG_IT, KURSI.bang, bang, 1, 'lengan', !bangTanpaKursi)}
          sisiBadan={
            <>
              {tokoh(CAK_OWNER, KURSI.owner, owner, 2, 'badan')}
              {tokoh(MAS_SAMPUL, KURSI.sampul, sampul, 3, 'badan')}
            </>
          }
          sisiLengan={
            <>
              {tokoh(CAK_OWNER, KURSI.owner, owner, 2, 'lengan')}
              {tokoh(MAS_SAMPUL, KURSI.sampul, sampul, 3, 'lengan')}
            </>
          }
        />
      </Lapisan>
      <Lapisan z={Z.depan}>
        <BendaDepan lompatKartu={lompatKartu} glowQr={glowQr} />
      </Lapisan>
    </Kamera>
  );
};

/** Titik mulut tokoh di panggung (ekor balon), ikut arah hadap dan tunduk. */
export function mulutDi(k: KeadaanTokoh, siapa: 'bang' | 'owner' | 'sampul'): { x: number; y: number } {
  const kursi = KURSI[siapa];
  const D = siapa === 'bang' ? BANG_IT : siapa === 'owner' ? CAK_OWNER : MAS_SAMPUL;
  const p = k.pose;
  const lx = 220 + p.kepalaX + p.badanX + p.hadapBadan * 14 + p.hadap * 34 * D.kepala;
  const ly = 170 + p.kepalaY + p.badanY + p.tunduk * 14 + (52 + p.tunduk * 22) * D.kepala;
  return { x: kursi.x + (k.geserX ?? 0) + (lx - 220) * kursi.skala, y: kursi.y + (k.geserY ?? 0) - (600 - ly) * kursi.skala };
}

/** Balon kata di ruang layar: letaknya dari mulut tokoh yang diproyeksikan kamera, dijaga di zona aman Reels. */
export const BalonTokoh: React.FC<{ teks: string; dari: number; sampai: number; siapa: 'bang' | 'owner' | 'sampul'; keadaan: KeadaanTokoh; kamera: PoseKamera; arah?: -1 | 1; lebar?: number }> = ({ teks, dari, sampai, siapa, keadaan, kamera, arah = -1, lebar = 440 }) => {
  const f = useCurrentFrame();
  if (f < dari || f >= sampai) return null;
  const m0 = mulutDi(keadaan, siapa);
  const m = proyeksi(kamera, m0.x, m0.y, Z.meja);
  const tinggiKepala = 150 * kamera.skala;
  const x = Math.min(940 - lebar / 2, Math.max(70 + lebar / 2, m.x + arah * (lebar * 0.42)));
  const y = Math.max(300, m.y - tinggiKepala - 150);
  return <Balon teks={teks} dari={dari} sampai={sampai} x={x} y={y} ekorX={m.x} ekorY={m.y - 8} lebar={lebar} />;
};

/** Suasana di ruang layar (CSS): langit-langit gelap, split tone, vinyet, redup kebiruan, dan keemasan. */
export const Suasana: React.FC<{ vinyet?: number; dingin?: number; hangat?: number; children?: ReactNode }> = ({ vinyet = 0.5, dingin = 0, hangat = 0, children }) => (
  <>
    <AbsoluteFill style={{ background: 'linear-gradient(180deg, rgba(8,5,2,0.55) 0%, rgba(8,5,2,0) 26%, rgba(8,5,2,0) 78%, rgba(8,5,2,0.5) 100%)', pointerEvents: 'none' }} />
    <AbsoluteFill style={{ pointerEvents: 'none', background: '#1a2a4a', mixBlendMode: 'lighten', opacity: 0.16 + dingin * 0.24 }} />
    <AbsoluteFill style={{ pointerEvents: 'none', background: '#ffb347', mixBlendMode: 'soft-light', opacity: 0.12 + hangat * 0.3 }} />
    <AbsoluteFill style={{ pointerEvents: 'none', background: `radial-gradient(ellipse 70% 60% at 50% 48%, rgba(0,0,0,0) 35%, ${dingin > 0.3 ? 'rgba(4,10,28,' : 'rgba(0,0,0,'}${(0.55 * vinyet).toFixed(3)}) 72%, ${dingin > 0.3 ? 'rgba(4,10,28,' : 'rgba(0,0,0,'}${Math.min(1, 1.1 * vinyet).toFixed(3)}) 100%)` }} />
    {children}
  </>
);
