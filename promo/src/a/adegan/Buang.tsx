// Adegan 4 (9–13 dtk): close-up Bang IT mengangkat jari tinggi, mengetuk HP dengan gaya berlebihan (antisipasi →
// ketuk), lalu menoleh ke kamera dengan alis naik. Sisipan: kartunya disorot cincin kuning lalu masuk buangan.
import { AbsoluteFill, useCurrentFrame, useVideoConfig } from 'remotion';
import { trekPose } from '../animasi';
import { Bunyi } from '../efek';
import { LayarHp } from '../Hp';
import { K, kameraDari } from '../kamera';
import { BalonTokoh, Panggung, Suasana, type KeadaanTokoh } from '../Panggung';
import { LAYAR_A1, REKAM_A } from '../rekam';
import { LayarRekam, Sisipan } from '../Sisipan';
import { bang, hidupkan, owner, sampul, WAJAH } from '../tokoh/pose';
import { ADEGAN, BALON } from '../waktu';
import { CincinKartu } from './lapisanHp';

const BALON_BUANG = 12;
const ANGKAT = 18;
const KETUK = 48;
const TOLEH = 62;
const SISIPAN = 30;

export const Buang: React.FC = () => {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const lama = ADEGAN.buang;
  const kamera = kameraDari(f, [
    [0, K(760, 1180, 1.68)],
    [16, K(WAJAH.bang.x + 110, WAJAH.bang.y + 30, 2.3)],
    [KETUK, K(WAJAH.bang.x + 110, WAJAH.bang.y + 40, 2.4), 'linear'],
    [KETUK + 6, K(WAJAH.bang.x + 110, WAJAH.bang.y + 60, 2.2), 'burst'],
    [TOLEH, K(WAJAH.bang.x + 110, WAJAH.bang.y + 50, 2.26), 'linear'],
    [TOLEH + 8, K(WAJAH.bang.x + 90, WAJAH.bang.y + 30, 2.7), 'burst'],
    [lama, K(WAJAH.bang.x + 90, WAJAH.bang.y + 30, 2.8), 'linear'],
  ]);
  const keadaanBang: KeadaanTokoh = {
    pose: hidupkan(
      trekPose(f, [
        [0, bang.lihatHp],
        [ANGKAT, bang.lihatHp],
        [ANGKAT + 14, bang.jariTinggi, 'pegas'],
        [KETUK - 6, bang.jariTinggi],
        [KETUK - 1, { ...bang.jariTinggi, badanY: -4, kanan: { tangan: { x: 300, y: 70 }, isi: 'tunjuk', arahJari: -80 } }],
        [KETUK + 3, bang.ketuk, 'burst'],
        [TOLEH, bang.ketuk],
        [TOLEH + 12, bang.tolehKamera, 'pegas'],
      ]),
      f,
      1,
    ),
    ekspresi: 'sombong',
  };
  const detikRekam = REKAM_A.a1.buang - (KETUK + 4 - SISIPAN) / fps;
  return (
    <AbsoluteFill style={{ background: '#17110a' }}>
      <Panggung
        kamera={kamera}
        bang={keadaanBang}
        owner={{ pose: hidupkan(owner.santai, f, 2), ekspresi: 'datar' }}
        sampul={{ pose: hidupkan(trekPose(f, [[0, sampul.mainHp], [TOLEH, sampul.mainHp], [TOLEH + 14, sampul.lihatBang]]), f, 4), ekspresi: 'datar' }}
        benih={270}
      />
      <Suasana vinyet={0.5} />
      <Sisipan nama="kartu dibuang" dari={SISIPAN} lama={lama - SISIPAN} x={810} y={720} lebar={400} rot={4} masukDari={{ x: 60, y: 0 }}>
        <LayarRekam berkas="a1-kamu.mp4" detik={detikRekam} nama="Rekaman A1 buang" />
        <LayarHp>
          <CincinKartu x={LAYAR_A1.buangan.x} y={LAYAR_A1.buangan.y} dari={KETUK + 4 - SISIPAN} sampai={lama - SISIPAN - 8} />
        </LayarHp>
      </Sisipan>
      <BalonTokoh teks={BALON.buang} dari={BALON_BUANG} sampai={TOLEH} siapa="bang" keadaan={keadaanBang} kamera={kamera} arah={-1} lebar={400} />
      <Bunyi nama="pop" dari={BALON_BUANG} volume={0.8} />
      <Bunyi nama="angkat" dari={ANGKAT + 4} volume={0.6} />
      <Bunyi nama="a-ketukhp" dari={KETUK + 2} volume={0.9} />
      <Bunyi nama="buang" dari={KETUK + 4} volume={0.9} />
      <Bunyi nama="e:whoosh" dari={TOLEH} volume={0.35} rate={1.4} />
    </AbsoluteFill>
  );
};
