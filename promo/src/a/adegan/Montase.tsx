// Adegan 9 (30–34 dtk): montase kilat (rule of three), ±1,2 dtk per potongan. (a) Bang IT bangkit, kesal: "Siji
// maneh." → layar HP: avatar maskot cangkir (warga kedai) mentung, retak, Bang IT terlonjak kecil. (b) Kena
// lagi, Bang IT cuma memejamkan mata. (c) Ketiga kalinya Bang IT pasrah, menyeruput kopi… dan gelas kopinya retak.
import { AbsoluteFill, useCurrentFrame, useVideoConfig } from 'remotion';
import { tawa, trek, trekEkspresi, trekPose } from '../animasi';
import { Bunyi, shake, Whip } from '../efek';
import { LayarHp } from '../Hp';
import { K, kameraDari } from '../kamera';
import { BalonTokoh, Panggung, Suasana, type KeadaanTokoh } from '../Panggung';
import { LAYAR_A2, REKAM_A } from '../rekam';
import { LayarRekam, LayarStill, Sisipan } from '../Sisipan';
import { bang, hidupkan, owner, sampul, WAJAH } from '../tokoh/pose';
import { ADEGAN, BALON } from '../waktu';
import { AvatarMaskot, RetakLayar } from './lapisanHp';

const A = 0;
const B = 40;
const C = 78;
const KENA_A = 28;
const KENA_B = 52;
const KRAK = 104;

export const Montase: React.FC = () => {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const lama = ADEGAN.montase;
  const g1 = shake(f, KENA_A, 10, 5);
  const g2 = shake(f, KENA_B, 8, 5);
  const dasar = kameraDari(f, [
    [A, K(WAJAH.bang.x + 90, WAJAH.bang.y + 90, 1.9)],
    [B - 1, K(WAJAH.bang.x + 90, WAJAH.bang.y + 90, 2.05), 'linear'],
    [B, K(WAJAH.bang.x, WAJAH.bang.y + 10, 2.8), 'tajam'],
    [C - 1, K(WAJAH.bang.x, WAJAH.bang.y + 10, 3.0), 'linear'],
    [C, K(WAJAH.bang.x + 40, WAJAH.bang.y + 80, 2.1), 'tajam'],
    [lama, K(WAJAH.bang.x + 40, WAJAH.bang.y + 80, 2.25), 'linear'],
  ]);
  const kamera = { ...dasar, x: dasar.x + (g1.x + g2.x) / dasar.skala, y: dasar.y + (g1.y + g2.y) / dasar.skala };
  const lonjak = trek(f, [
    [KENA_A - 1, 0],
    [KENA_A + 1, 0.1, 'burst'],
    [KENA_A + 8, 0, 'pegas'],
    [KENA_B - 1, 0],
    [KENA_B + 1, 0.07, 'burst'],
    [KENA_B + 8, 0, 'pegas'],
  ]);
  const retakCangkir = trek(f, [
    [KRAK, 0],
    [KRAK + 7, 1, 'burst'],
  ]);
  const keadaanBang: KeadaanTokoh = {
    pose: hidupkan(
      trekPose(f, [
        [A, bang.kesal],
        [KENA_A - 3, bang.kesal],
        [KENA_A, bang.terlonjak, 'burst'],
        [KENA_A + 8, bang.kesal, 'pegas'],
        [B, bang.merem, 'tajam'],
        [KENA_B - 3, bang.merem],
        [KENA_B, { ...bang.merem, badanY: -14, bahu: -8 }, 'burst'],
        [KENA_B + 10, bang.merem, 'pegas'],
        [C, bang.pasrah, 'tajam'],
        [C + 4, bang.pasrah],
        [C + 18, bang.seruput],
        [KRAK, bang.seruput],
        [KRAK + 10, bang.lihatGelas, 'pegas'],
      ]),
      f,
      1,
    ),
    ekspresi: trekEkspresi(f, [[A, 'kesal'], [KENA_A, 'kaget'], [KENA_A + 10, 'kesal'], [B, 'merem'], [C, 'pasrah'], [KRAK + 8, 'kaget']]),
    sx: 1 + lonjak,
    sy: 1 - lonjak,
    retakCangkir,
  };
  const gebrak = trek(f, [
    [KRAK + 9, 0],
    [KRAK + 10, 0.08, 'burst'],
    [KRAK + 18, 0, 'pegas'],
  ]);
  return (
    <AbsoluteFill style={{ background: '#17110a' }}>
      <Panggung
        kamera={kamera}
        bang={keadaanBang}
        owner={{ pose: hidupkan(owner.santai, f, 2), ekspresi: 'datar' }}
        sampul={{
          pose: hidupkan(trekPose(f, [[A, sampul.santai], [KRAK + 2, sampul.santai], [KRAK + 6, sampul.angkatTangan], [KRAK + 10, sampul.gebrak, 'burst']]), f, 4),
          ekspresi: trekEkspresi(f, [[A, 'girang'], [KENA_A + 2, 'tertawa'], [B, 'girang'], [KENA_B + 2, 'tertawa'], [C, 'girang'], [KRAK + 6, 'tertawa']]),
          geserY: tawa(f, KENA_A + 2, B, 5) + tawa(f, KENA_B + 2, C, 5) + tawa(f, KRAK + 12, lama, 6),
          sx: 1 + gebrak,
          sy: 1 - gebrak,
        }}
        tampilCangkirBang={keadaanBang.pose.kanan.isi !== 'cangkir'}
        retakCangkirBang={0}
        lompatKartu={trek(f, [
          [KRAK + 10, 0],
          [KRAK + 13, 0.6, 'burst'],
          [KRAK + 22, 0],
        ])}
        benih={900}
      />
      <Suasana vinyet={0.5} />
      <Whip dari={B} lama={4} />
      <Whip dari={C} lama={4} />
      <Sisipan nama="warga kedai mentung" dari={A + 6} lama={B - A - 6} x={790} y={700} lebar={380} rot={5} masukDari={{ x: 50, y: 0 }}>
        <LayarRekam berkas="a2-kamu.mp4" detik={REKAM_A.a2.retak - (KENA_A - A - 6) / fps} nama="Rekaman A2 retak" />
        <LayarHp>
          <AvatarMaskot x={LAYAR_A2.panelBot.x} y={LAYAR_A2.panelBot.y} />
          <RetakLayar dari={KENA_A - A - 6} kuat={0.9} />
        </LayarHp>
      </Sisipan>
      <Sisipan nama="kena lagi" dari={B + 4} lama={C - B - 4} x={880} y={560} lebar={300} rot={-6} masukDari={{ x: 50, y: -20 }}>
        <LayarStill berkas="a2-retak.png">
          <AvatarMaskot x={LAYAR_A2.panelBot.x} y={LAYAR_A2.panelBot.y} />
          <RetakLayar dari={KENA_B - B - 4} kuat={1} />
        </LayarStill>
      </Sisipan>
      <BalonTokoh teks={BALON.sijiManeh} dari={A + 2} sampai={B} siapa="bang" keadaan={keadaanBang} kamera={kamera} arah={-1} lebar={360} />
      <Bunyi nama="e:whoosh" dari={A} volume={0.5} rate={1.3} />
      <Bunyi nama="pop" dari={A + 2} volume={0.8} />
      <Bunyi nama="mentung" dari={KENA_A - 2} volume={0.7} />
      <Bunyi nama="jotosLain" dari={KENA_A} volume={0.9} />
      <Bunyi nama="e:whoosh" dari={B} volume={0.45} rate={1.3} />
      <Bunyi nama="jotosLain" dari={KENA_B} volume={0.85} />
      <Bunyi nama="kepentung" dari={KENA_B} volume={0.4} />
      <Bunyi nama="e:whoosh" dari={C} volume={0.45} rate={1.3} />
      <Bunyi nama="e:seruput" dari={C + 18} volume={0.4} />
      <Bunyi nama="e:gelas-retak" dari={KRAK} volume={0.9} />
      <Bunyi nama="e:gebrak-meja" dari={KRAK + 10} volume={0.6} />
    </AbsoluteFill>
  );
};
