// Adegan 1 (0–2 dtk): cold open. Layar HP Bang IT penuh frame: rekaman game, retak, KEPENTUNG!. Lalu burst ke
// wajah Bang IT yang membeku kaget, Cak Owner dan Mas Sampul meledak tertawa. Ditutup efek rewind (transisi).
import { Video } from '@remotion/media';
import { AbsoluteFill, staticFile, useCurrentFrame, useVideoConfig } from 'remotion';
import { tawa } from '../animasi';
import { Bunyi, Retak, Whip } from '../efek';
import { K, kameraDari } from '../kamera';
import { Panggung, Suasana } from '../Panggung';
import { REKAM_A } from '../rekam';
import { bang, hidupkan, owner, sampul, WAJAH } from '../tokoh/pose';
import { ADEGAN, H, TRANSISI, W } from '../waktu';

/** Frame burst dari layar ke wajah. */
export const BURST = 14;

export const ColdOpen: React.FC = () => {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const lama = ADEGAN.coldOpen;
  const kamera = kameraDari(f, [
    [BURST, K(WAJAH.bang.x, WAJAH.bang.y + 40, 3.6)],
    [BURST + 10, K(WAJAH.bang.x, WAJAH.bang.y + 20, 2.7), 'burst'],
    [lama, K(WAJAH.bang.x, WAJAH.bang.y + 20, 2.95), 'linear'],
  ]);
  return (
    <AbsoluteFill style={{ background: '#000' }}>
      {f < BURST ? (
        <>
          <Video name="Rekaman A1 kepentung" src={staticFile('rekam/a1-kamu.mp4')} trimBefore={Math.round(REKAM_A.a1.retak * fps) - 3} muted style={{ width: W, height: H, objectFit: 'cover' }} />
          <Retak dari={0} kuat={1} lama={BURST} />
        </>
      ) : (
        <>
          <Panggung
            kamera={kamera}
            bang={{ pose: bang.kaget, ekspresi: 'kaget', geserY: Math.sin(f * 2.1) * 1.2 }}
            owner={{ pose: hidupkan(owner.tertawa, f, 2), ekspresi: 'tertawa', geserY: tawa(f, BURST, lama, 5) }}
            sampul={{ pose: hidupkan(sampul.tertawa, f, 4), ekspresi: 'tertawa', geserY: tawa(f, BURST, lama, 7) }}
          />
          <Suasana vinyet={0.55} />
        </>
      )}
      {/* Rewind ke "15 menit sebelumnya": garis pindai + blur, bertumpang tindih dengan transisi. */}
      <Whip dari={lama - TRANSISI.rewind} lama={TRANSISI.rewind} />
      <Bunyi nama="jotos" dari={0} volume={0.9} />
      <Bunyi nama="e:tawa-riuh" dari={BURST} volume={0.8} />
      <Bunyi nama="kepentung" dari={0} volume={0.6} />
      <Bunyi nama="e:whoosh" dari={BURST} volume={0.7} />
      <Bunyi nama="e:whoosh" dari={lama - TRANSISI.rewind} volume={0.8} rate={0.7} />
    </AbsoluteFill>
  );
};
