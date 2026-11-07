// Adegan 7 (23–26 dtk): sisipan layar Bang IT retak, KEPENTUNG! (rekaman). Cut ke Bang IT terpental ke belakang
// bersama kursinya (antisipasi 3 frame, terpental 6 frame, squash saat mendarat, rambut follow-through), kilat
// merah, guncangan meluruh. Mas Sampul menggebrak meja sambil tertawa, kartu fisik melompat.
import { AbsoluteFill, Easing, interpolate, useCurrentFrame, useVideoConfig } from 'remotion';
import { tawa, trek, trekEkspresi, trekPose } from '../animasi';
import { Sorak, WARNA } from '../../bagian';
import { Bunyi, Flash, shake } from '../efek';
import { LayarHp } from '../Hp';
import { K, kameraDari } from '../kamera';
import { Panggung, Suasana } from '../Panggung';
import { REKAM_A } from '../rekam';
import { LayarRekam, Sisipan } from '../Sisipan';
import { bang, hidupkan, owner, sampul, TANGAN_OWNER } from '../tokoh/pose';
import { ADEGAN, TEKS_SORAK_KEPENTUNG } from '../waktu';
import { RetakLayar } from './lapisanHp';

const RETAK = 6;
export const TERPENTAL = 12;
const MENDARAT = 21;
const GEBRAK = 36;

export const Kepentung: React.FC = () => {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const lama = ADEGAN.kepentung;
  const g1 = shake(f, TERPENTAL, 26, 7);
  const g2 = shake(f, GEBRAK, 16, 6);
  const dasar = kameraDari(f, [
    [0, K(TANGAN_OWNER.x + 40, TANGAN_OWNER.y - 20, 2.95)],
    [TERPENTAL, K(TANGAN_OWNER.x + 40, TANGAN_OWNER.y - 20, 2.95)],
    [TERPENTAL + 1, K(540, 1150, 1.3), 'tajam'],
    [GEBRAK + 30, K(560, 1180, 1.4), 'linear'],
    [lama, K(560, 1180, 1.42), 'linear'],
  ]);
  const kamera = { ...dasar, x: dasar.x + (g1.x + g2.x) / dasar.skala, y: dasar.y + (g1.y + g2.y) / dasar.skala, rot: dasar.rot + g1.rot + g2.rot };
  // Terpental: rotasi seluruh tokoh + kursi berporos titik duduk; squash saat mendarat; rambut ikut telat.
  const rot = trek(f, [
    [TERPENTAL, 0],
    [TERPENTAL + 6, -34, 'burst'],
    [MENDARAT, -46, 'burst'],
    [MENDARAT + 6, -42, 'pegas'],
  ]);
  const squash = trek(f, [
    [TERPENTAL - 1, 0],
    [TERPENTAL, 0.06, 'burst'],
    [TERPENTAL + 6, -0.12, 'burst'],
    [MENDARAT, 0.2, 'burst'],
    [MENDARAT + 10, 0, 'pegas'],
  ]);
  const ayun =
    (trek(f - 2, [
      [TERPENTAL, 0],
      [TERPENTAL + 6, -34, 'burst'],
      [MENDARAT, -46, 'burst'],
      [MENDARAT + 6, -42, 'pegas'],
    ]) -
      rot) *
    0.8;
  const gebrak = trek(f, [
    [GEBRAK - 1, 0],
    [GEBRAK, 0.1, 'burst'],
    [GEBRAK + 8, 0, 'pegas'],
  ]);
  return (
    <AbsoluteFill style={{ background: '#17110a' }}>
      <Panggung
        kamera={kamera}
        bang={{
          pose: hidupkan(
            trekPose(f, [
              [0, bang.cemas],
              [TERPENTAL - 1, { ...bang.condong, badanY: 6, kepalaY: 24, bahu: -8 }, 'masuk'],
              [TERPENTAL + 6, bang.terpental, 'burst'],
              [MENDARAT, bang.mendarat, 'burst'],
            ]),
            f,
            1,
          ),
          ekspresi: trekEkspresi(f, [[0, 'datar'], [RETAK + 2, 'kaget']]),
          rot,
          sx: 1 + squash,
          sy: 1 - squash,
          ayun,
        }}
        owner={{ pose: hidupkan(trekPose(f, [[0, owner.ketukNutup], [20, owner.ketukNutup], [40, owner.sesudah]]), f, 2), ekspresi: trekEkspresi(f, [[0, 'datar'], [MENDARAT + 4, 'girang']]) }}
        sampul={{
          pose: hidupkan(
            trekPose(f, [
              [0, sampul.nyengir],
              [RETAK + 20, sampul.nyengir],
              [GEBRAK - 8, sampul.angkatTangan, 'pegas'],
              [GEBRAK - 2, sampul.angkatTangan],
              [GEBRAK, sampul.gebrak, 'burst'],
              [GEBRAK + 14, sampul.gebrak],
              [GEBRAK + 30, sampul.tertawa],
            ]),
            f,
            4,
          ),
          ekspresi: trekEkspresi(f, [[0, 'girang'], [RETAK + 4, 'kaget'], [GEBRAK - 8, 'tertawa']]),
          geserY: tawa(f, GEBRAK + 2, lama, 6),
          sx: 1 + gebrak,
          sy: 1 - gebrak,
        }}
        dingin={trek(f, [
          [0, 0.95],
          [RETAK, 0.95],
          [RETAK + 2, 0.7, 'burst'],
          [GEBRAK + 20, 0.25],
        ])}
        lompatKartu={trek(f, [
          [GEBRAK, 0],
          [GEBRAK + 4, 1, 'burst'],
          [GEBRAK + 14, 0],
        ])}
        benih={690}
      />
      <Suasana vinyet={interpolate(f, [0, GEBRAK + 20], [0.95, 0.6], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' })} dingin={interpolate(f, [RETAK, GEBRAK + 20], [0.9, 0.25], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' })} />
      <Sisipan nama="layar retak" dari={0} lama={TERPENTAL + 1} x={540} y={930} lebar={600} tanpaMasuk>
        <LayarRekam berkas="a1-kamu.mp4" detik={REKAM_A.a1.retak - RETAK / fps} nama="Rekaman A1 retak" />
        <LayarHp>
          <RetakLayar dari={RETAK} />
        </LayarHp>
      </Sisipan>
      <Flash dari={TERPENTAL} lama={3} warna="#ff3a2a" puncak={0.55} />
      {f >= RETAK + 2 && f < GEBRAK + 24 && (
        <Sorak
          teks={TEKS_SORAK_KEPENTUNG}
          ukuran={150}
          x={540}
          y={520}
          skala={interpolate(f, [RETAK + 2, RETAK + 8], [0.6, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: Easing.bezier(0.16, 1, 0.3, 1) })}
          rot={-6}
          warna={WARNA.merah}
          opacity={interpolate(f, [GEBRAK + 16, GEBRAK + 24], [1, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' })}
        />
      )}
      <Bunyi nama="mentungJoker" dari={RETAK} volume={1} />
      <Bunyi nama="jotos" dari={RETAK + 2} volume={1} />
      <Bunyi nama="kepentung" dari={RETAK + 2} volume={0.7} />
      <Bunyi nama="e:kursi-jatuh" dari={TERPENTAL + 2} volume={0.95} />
      <Bunyi nama="e:gebrak-meja" dari={GEBRAK} volume={0.95} />
      <Bunyi nama="e:tawa-riuh" dari={GEBRAK - 4} volume={0.75} />
      <Bunyi nama="a-gebrak-kecil" dari={GEBRAK + 3} volume={0.5} />
    </AbsoluteFill>
  );
};
