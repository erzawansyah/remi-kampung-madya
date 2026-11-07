// Adegan 11 (38–40 dtk): stempel merah miring −8° menghantam tengah layar dengan bunyi DOK dan guncangan. Bang IT
// melirik stempel, lalu melirik kamera. Potong 0,2 dtk sesudahnya.
import { AbsoluteFill, useCurrentFrame } from 'remotion';
import { tawa, trekEkspresi, trekPose } from '../animasi';
import { Bunyi, shake } from '../efek';
import { K, kameraDari } from '../kamera';
import { Panggung, Suasana } from '../Panggung';
import { Stempel } from '../Stempel';
import { bang, hidupkan, owner, sampul } from '../tokoh/pose';
import { ADEGAN, TEKS_STEMPEL } from '../waktu';
import { TeksPenutup } from './Penutup';

const KENA = 6;
const LIRIK_STEMPEL = 16;
const LIRIK_KAMERA = 34;
/** Durasi tampil (sebelum fade ke bagian QR). */

export const StempelAkhir: React.FC = () => {
  const f = useCurrentFrame();
  const lama = ADEGAN.stempel;
  const g = shake(f, KENA, 18, 7);
  const dasar = kameraDari(f, [
    [0, K(540, 1075, 1.08)],
    [lama, K(540, 1075, 1.1), 'linear'],
  ]);
  const kamera = { ...dasar, x: dasar.x + g.x / dasar.skala, y: dasar.y + g.y / dasar.skala, rot: g.rot };
  return (
    <AbsoluteFill style={{ background: '#17110a' }}>
      <Panggung
        kamera={kamera}
        bang={{
          pose: hidupkan(trekPose(f, [[0, bang.tertawaLepas], [KENA, bang.tertawaLepas], [LIRIK_STEMPEL, bang.lirikStempel, 'burst'], [LIRIK_KAMERA, bang.lirikStempel], [LIRIK_KAMERA + 12, bang.lirikKamera]]), f, 1),
          ekspresi: trekEkspresi(f, [[0, 'tertawa'], [KENA + 4, 'datar']]),
          geserY: tawa(f, 0, KENA, 5),
        }}
        owner={{ pose: hidupkan(owner.angkatCangkir, f, 2), ekspresi: trekEkspresi(f, [[0, 'tertawa'], [KENA + 6, 'girang']]), geserY: tawa(f, 0, KENA, 4) }}
        sampul={{ pose: hidupkan(trekPose(f, [[0, sampul.tertawaTutup], [KENA + 6, sampul.tertawaTutup], [KENA + 18, sampul.lihatStempel]]), f, 4), ekspresi: trekEkspresi(f, [[0, 'tertawa'], [KENA + 6, 'kaget'], [KENA + 18, 'girang']]), geserY: tawa(f, 0, KENA, 6) }}
        hangat={1}
        glowQr={0.9}
        benih={1140}
      />
      <Suasana vinyet={0.3} hangat={1} />
      <TeksPenutup sudahTampil />
      <Stempel teks={TEKS_STEMPEL} kena={KENA} sampai={lama} />
      <Bunyi nama="e:stempel-dok" dari={KENA} volume={0.8} />
      <Bunyi nama="klik" dari={LIRIK_KAMERA + 6} volume={0.4} />
    </AbsoluteFill>
  );
};
