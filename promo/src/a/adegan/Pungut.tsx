// Adegan 5 (13–17 dtk): kamera bergeser ke Cak Owner: menyeruput kopi pelan, mata setengah tertutup, cut ke
// jarinya mengetuk sekali tanpa melihat. Sisipan: kartu buangan Bang IT dipungut (panah kuning dari buangan ke
// panel Cak Owner). Caption "Kartu buanganmu dipakai dia buat nutup…".
import { AbsoluteFill, useCurrentFrame, useVideoConfig } from 'remotion';
import { trekPose } from '../animasi';
import { Bunyi, Caption } from '../efek';
import { LayarHp } from '../Hp';
import { K, kameraDari } from '../kamera';
import { Panggung, Suasana } from '../Panggung';
import { LAYAR_A1, REKAM_A } from '../rekam';
import { LayarRekam, Sisipan } from '../Sisipan';
import { bang, hidupkan, owner, sampul, TANGAN_OWNER, WAJAH } from '../tokoh/pose';
import { ADEGAN, CAPTION_PUNGUT } from '../waktu';
import { PanahLayar } from './lapisanHp';

const SERUPUT = 6;
const KETUK = 34;
const CAPTION = 60;
const SISIPAN = 6;

export const Pungut: React.FC = () => {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const lama = ADEGAN.pungut;
  const kamera = kameraDari(f, [
    [0, K(WAJAH.bang.x + 90, WAJAH.bang.y + 30, 2.8)],
    [14, K(WAJAH.owner.x + 120, WAJAH.owner.y + 30, 2.4)],
    [KETUK - 4, K(WAJAH.owner.x + 120, WAJAH.owner.y + 30, 2.5), 'linear'],
    [KETUK - 3, K(TANGAN_OWNER.x + 40, TANGAN_OWNER.y - 60, 2.0), 'tajam'],
    [KETUK + 20, K(TANGAN_OWNER.x + 40, TANGAN_OWNER.y - 60, 2.12), 'linear'],
    [KETUK + 21, K(WAJAH.owner.x + 120, WAJAH.owner.y + 30, 2.4), 'tajam'],
    [lama, K(WAJAH.owner.x + 120, WAJAH.owner.y + 30, 2.55), 'linear'],
  ]);
  const detikRekam = REKAM_A.a1.pungut - (KETUK + 2 - SISIPAN) / fps;
  return (
    <AbsoluteFill style={{ background: '#17110a' }}>
      <Panggung
        kamera={kamera}
        bang={{ pose: hidupkan(trekPose(f, [[0, bang.tolehKamera], [14, bang.sombong]]), f, 1), ekspresi: 'sombong' }}
        owner={{
          pose: hidupkan(
            trekPose(f, [
              [0, owner.santai],
              [SERUPUT, owner.santai],
              [SERUPUT + 10, owner.seruput],
              [KETUK - 6, owner.seruput],
              [KETUK + 2, owner.ketukTanpaLihat, 'burst'],
              [KETUK + 16, owner.ketukTanpaLihat],
              [KETUK + 34, owner.seruput],
            ]),
            f,
            2,
          ),
          ekspresi: 'datar',
        }}
        sampul={{ pose: hidupkan(sampul.lihatBang, f, 4), ekspresi: 'datar' }}
        benih={390}
      />
      <Suasana vinyet={0.52} dingin={0.1} />
      <Sisipan nama="kartu dipungut" dari={SISIPAN} lama={lama - SISIPAN} x={810} y={720} lebar={400} rot={4} masukDari={{ x: 60, y: 0 }}>
        <LayarRekam berkas="a1-kamu.mp4" detik={detikRekam} nama="Rekaman A1 pungut" />
        <LayarHp>
          <PanahLayar dari={KETUK + 2 - SISIPAN} sampai={lama - SISIPAN - 6} x1={LAYAR_A1.buangan.x} y1={LAYAR_A1.buangan.y - 60} x2={LAYAR_A1.panelOwner.x} y2={LAYAR_A1.panelOwner.y + 40} />
        </LayarHp>
      </Sisipan>
      <Caption teks={CAPTION_PUNGUT} dari={CAPTION} sampai={lama + 30} y={1250} ukuran={62} />
      <Bunyi nama="e:seruput" dari={SERUPUT} volume={0.45} />
      <Bunyi nama="a-ketukhp" dari={KETUK + 1} volume={0.8} />
      <Bunyi nama="mulung" dari={KETUK + 3} volume={0.9} />
      <Bunyi nama="pop" dari={CAPTION} volume={0.6} />
      <Bunyi nama="bahaya" dari={CAPTION + 16} volume={0.8} />
    </AbsoluteFill>
  );
};
