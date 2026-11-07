// Adegan 6 (17–23 dtk): push-in pelan ke tengah meja, dutch 4°. Ketiganya mencondongkan badan, cahaya meredup
// kebiruan, vinyet berat. Close-up bergantian: Cak Owner tersenyum tipis, Mas Sampul nyengir, Bang IT cemas.
// Cak Owner meletakkan cangkir… hening 0,4 dtk… lalu mengetuk sekali (shot tangan).
import { AbsoluteFill, useCurrentFrame } from 'remotion';
import { trek, trekEkspresi, trekPose } from '../animasi';
import { Bunyi } from '../efek';
import { K, kameraDari } from '../kamera';
import { Panggung, Suasana } from '../Panggung';
import { bang, hidupkan, owner, sampul, TANGAN_OWNER, WAJAH } from '../tokoh/pose';
import { ADEGAN } from '../waktu';

const CONDONG = 50;
const CU_OWNER = 91;
const CU_SAMPUL = 115;
const CU_BANG = 139;
const LETAK_CANGKIR = 120;
/** Hening 0,4 dtk sebelum ketukan nutup (musik dan bunyi diam). */
export const HENING = 156;
export const KETUK_NUTUP = 168;

export const Tegang: React.FC = () => {
  const f = useCurrentFrame();
  const lama = ADEGAN.tegang;
  const kamera = kameraDari(f, [
    [0, K(540, 1200, 1.25, 0)],
    [CONDONG, K(540, 1190, 1.32, 4)],
    [CU_OWNER - 1, K(540, 1180, 1.42, 4), 'linear'],
    [CU_OWNER, K(WAJAH.owner.x + 20, WAJAH.owner.y + 10, 2.9, 0), 'tajam'],
    [CU_SAMPUL - 1, K(WAJAH.owner.x + 20, WAJAH.owner.y + 10, 3.05, 0), 'linear'],
    [CU_SAMPUL, K(WAJAH.sampul.x - 20, WAJAH.sampul.y + 10, 2.9, 0), 'tajam'],
    [CU_BANG - 1, K(WAJAH.sampul.x - 20, WAJAH.sampul.y + 10, 3.05, 0), 'linear'],
    [CU_BANG, K(WAJAH.bang.x, WAJAH.bang.y + 20, 3.0, 0), 'tajam'],
    [HENING, K(WAJAH.bang.x, WAJAH.bang.y + 20, 3.2, 0), 'linear'],
    [HENING + 1, K(TANGAN_OWNER.x + 40, TANGAN_OWNER.y - 20, 2.8, 0), 'tajam'],
    [lama, K(TANGAN_OWNER.x + 40, TANGAN_OWNER.y - 20, 2.95, 0), 'linear'],
  ]);
  const dingin = trek(f, [
    [0, 0],
    [CONDONG, 0.85],
    [lama, 0.95, 'linear'],
  ]);
  const poseOwner = trekPose(f, [
    [0, owner.seruput],
    [CONDONG, owner.condong],
    [CU_OWNER - 1, owner.condong],
    [CU_OWNER + 11, owner.senyumTipis],
    [LETAK_CANGKIR - 14, owner.senyumTipis],
    [LETAK_CANGKIR, owner.taruhCangkir],
    [LETAK_CANGKIR + 2, owner.taruhCangkir],
    [LETAK_CANGKIR + 16, owner.tanganLepas],
    [KETUK_NUTUP - 1, owner.tanganLepas],
    [KETUK_NUTUP + 2, owner.ketukNutup, 'burst'],
    [lama, owner.ketukNutup],
  ]);
  return (
    <AbsoluteFill style={{ background: '#17110a' }}>
      <Panggung
        kamera={kamera}
        bang={{ pose: hidupkan(trekPose(f, [[0, bang.sombong], [CONDONG, bang.condong], [CU_BANG - 9, bang.condong], [CU_BANG + 3, bang.cemas]]), f, 1), ekspresi: trekEkspresi(f, [[0, 'sombong'], [40, 'fokus'], [CU_BANG + 3, 'datar']]) }}
        owner={{ pose: hidupkan(poseOwner, f, 2), ekspresi: trekEkspresi(f, [[0, 'datar'], [CU_OWNER + 11, 'sombong'], [KETUK_NUTUP - 2, 'datar']]) }}
        sampul={{ pose: hidupkan(trekPose(f, [[0, sampul.lihatBang], [CONDONG, sampul.condong], [CU_SAMPUL - 3, sampul.condong], [CU_SAMPUL + 9, sampul.nyengir]]), f, 4), ekspresi: trekEkspresi(f, [[0, 'datar'], [40, 'fokus'], [CU_SAMPUL + 9, 'girang']]) }}
        dingin={dingin}
        tampilCangkirOwner={poseOwner.kanan.isi !== 'cangkir'}
        benih={510}
      />
      <Suasana vinyet={0.55 + dingin * 0.4} dingin={dingin} />
      <Bunyi nama="letak" dari={LETAK_CANGKIR} volume={0.7} />
      <Bunyi nama="tegang" dari={LETAK_CANGKIR - 6} volume={0.9} lama={HENING - (LETAK_CANGKIR - 6)} />
      <Bunyi nama="a-ketukhp" dari={KETUK_NUTUP} volume={1} />
      <Bunyi nama="letak" dari={KETUK_NUTUP + 4} volume={0.6} />
      <Bunyi nama="balik" dari={lama - 4} volume={0.7} />
    </AbsoluteFill>
  );
};
