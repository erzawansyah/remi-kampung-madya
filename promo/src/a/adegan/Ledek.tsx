// Adegan 8 (26–30 dtk): Mas Sampul menyodorkan HP ke muka Bang IT (sisipan: ledekan besar dari game), balon
// "Noob.". Bang IT bangkit, lalu perlahan menoleh ke kamera, wajah datar (reaksi telat 8 frame).
import { AbsoluteFill, useCurrentFrame, useVideoConfig } from 'remotion';
import { tawa, trek, trekEkspresi, trekPose } from '../animasi';
import { Bunyi } from '../efek';
import { K, kameraDari } from '../kamera';
import { BalonTokoh, Panggung, Suasana, type KeadaanTokoh } from '../Panggung';
import { REKAM_A } from '../rekam';
import { LayarRekam, Sisipan } from '../Sisipan';
import { bang, hidupkan, owner, sampul, WAJAH } from '../tokoh/pose';
import { ADEGAN, BALON } from '../waktu';

const SODOR = 6;
const BALON_NOOB = 20;
const TOLEH = 60;

export const Ledek: React.FC = () => {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const lama = ADEGAN.ledek;
  const kamera = kameraDari(f, [
    [0, K(560, 1180, 1.42)],
    [14, K(WAJAH.sampul.x - 90, WAJAH.sampul.y + 30, 2.2)],
    [TOLEH - 1, K(WAJAH.sampul.x - 90, WAJAH.sampul.y + 30, 2.35), 'linear'],
    [TOLEH, K(WAJAH.bang.x, WAJAH.bang.y + 30, 2.5), 'tajam'],
    [TOLEH + 20, K(WAJAH.bang.x, WAJAH.bang.y + 20, 2.9), 'burst'],
    [lama, K(WAJAH.bang.x, WAJAH.bang.y + 20, 2.95), 'linear'],
  ]);
  const bangkit = trek(f, [
    [0, -42],
    [16, 0, 'pegas'],
  ]);
  const squash = trek(f, [
    [10, 0],
    [16, 0.06, 'burst'],
    [26, 0, 'pegas'],
  ]);
  const keadaanSampul: KeadaanTokoh = {
    pose: hidupkan(
      trekPose(f, [
        [0, sampul.tertawa],
        [SODOR, sampul.tertawa],
        [SODOR + 10, sampul.sodorHp, 'burst'],
        [lama - 24, sampul.sodorHp],
        [lama - 4, sampul.santai],
      ]),
      f,
      4,
    ),
    ekspresi: 'tertawa',
    geserY: tawa(f, 0, 10, 6),
  };
  return (
    <AbsoluteFill style={{ background: '#17110a' }}>
      <Panggung
        kamera={kamera}
        bang={{
          pose: hidupkan(trekPose(f, [[0, bang.mendarat], [16, bang.datar, 'pegas'], [TOLEH, bang.datar], [TOLEH + 18, bang.datarKamera]]), f, 1),
          ekspresi: trekEkspresi(f, [[0, 'malu'], [TOLEH, 'datar']]),
          rot: bangkit,
          sx: 1 + squash,
          sy: 1 - squash,
        }}
        owner={{ pose: hidupkan(trekPose(f, [[0, owner.sesudah], [30, owner.sesudah], [50, owner.ambilCangkir], [54, owner.ambilCangkir], [76, owner.santai]]), f, 2), ekspresi: trekEkspresi(f, [[0, 'girang'], [40, 'datar']]) }}
        sampul={keadaanSampul}
        dingin={trek(f, [
          [0, 0.25],
          [20, 0],
        ])}
        tampilCangkirOwner={f < 50}
        benih={780}
      />
      <Suasana vinyet={0.5} />
      <Sisipan nama="ledekan" dari={SODOR + 10} lama={TOLEH - SODOR - 6} x={430} y={720} lebar={400} rot={-10} masukDari={{ x: 120, y: -20 }}>
        <LayarRekam berkas="a1-kamu.mp4" detik={(REKAM_A.a1.ledek ?? 0) - 6 / fps} nama="Rekaman A1 ledekan" />
      </Sisipan>
      <BalonTokoh teks={BALON.noob} dari={BALON_NOOB} sampai={lama - 24} siapa="sampul" keadaan={keadaanSampul} kamera={kamera} arah={1} lebar={260} />
      <Bunyi nama="e:whoosh" dari={SODOR + 4} volume={0.45} />
      <Bunyi nama="notifikasi" dari={SODOR + 16} volume={0.8} />
      <Bunyi nama="pop" dari={BALON_NOOB} volume={0.8} />
    </AbsoluteFill>
  );
};
