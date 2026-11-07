// Adegan 2 (2–5 dtk): meja sepi, Bang IT datang dari kanan, menaruh kopi, duduk melebar, dan bersandar sombong.
// Caption "15 menit sebelumnya", balon "Aman, aku seng menang."
import { AbsoluteFill, Easing, interpolate, useCurrentFrame } from 'remotion';
import { trek, trekPose } from '../animasi';
import { Bunyi, Caption } from '../efek';
import { K, kameraDari } from '../kamera';
import { BalonTokoh, Panggung, Suasana, type KeadaanTokoh } from '../Panggung';
import { bang, hidupkan, owner, sampul } from '../tokoh/pose';
import { ADEGAN, BALON, CAPTION_SEBELUM } from '../waktu';

const DUDUK = 32;
export const BALON_AMAN = 44;

export const Datang: React.FC = () => {
  const f = useCurrentFrame();
  const lama = ADEGAN.datang;
  const kamera = kameraDari(f, [
    [0, K(540, 1180, 1.0)],
    [DUDUK - 4, K(540, 1170, 1.05), 'linear'],
    [BALON_AMAN + 6, K(560, 1010, 1.5)],
    [lama, K(560, 1000, 1.58), 'linear'],
  ]);
  // Berjalan masuk dari kanan (berdiri lebih tinggi, ayunan langkah), lalu duduk dengan pegas.
  const jalan = interpolate(f, [0, DUDUK], [1, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: Easing.bezier(0.4, 0, 0.2, 1) });
  const berdiri = trek(f, [
    [DUDUK, 1],
    [DUDUK + 8, 0, 'pegas'],
  ]);
  const langkah = jalan > 0 && jalan < 1 ? Math.abs(Math.sin(f * 0.45)) * 14 : 0;
  const keadaanBang: KeadaanTokoh = {
    pose: hidupkan(
      trekPose(f, [
        [0, bang.jalan],
        [DUDUK, bang.jalan],
        [DUDUK + 8, bang.taruhCangkir, 'pegas'],
        [DUDUK + 12, bang.taruhCangkir],
        [BALON_AMAN + 2, bang.sombong, 'pegas'],
      ]),
      f,
      1,
    ),
    ekspresi: 'sombong',
    geserX: jalan * 620,
    geserY: -berdiri * 110 - langkah * jalan,
  };
  return (
    <AbsoluteFill style={{ background: '#17110a' }}>
      <Panggung
        kamera={kamera}
        bang={keadaanBang}
        owner={{ pose: hidupkan(owner.santai, f, 2), ekspresi: 'datar' }}
        sampul={{ pose: hidupkan(sampul.mainHp, f, 4), ekspresi: 'fokus' }}
        kursiKosongBang={f < DUDUK + 4}
        bangTanpaKursi={f < DUDUK + 4}
        tampilCangkirBang={f >= DUDUK + 12}
        benih={60}
      />
      <Suasana vinyet={0.5} />
      <Caption teks={CAPTION_SEBELUM} dari={2} sampai={BALON_AMAN + 30} y={1350} ukuran={66} />
      <BalonTokoh teks={BALON.aman} dari={BALON_AMAN} sampai={lama} siapa="bang" keadaan={keadaanBang} kamera={kamera} arah={-1} lebar={520} />
      <Bunyi nama="a-kursi-geser" dari={DUDUK - 4} volume={0.7} />
      <Bunyi nama="letak" dari={DUDUK + 12} volume={0.7} />
      <Bunyi nama="pop" dari={BALON_AMAN} volume={0.8} />
    </AbsoluteFill>
  );
};
