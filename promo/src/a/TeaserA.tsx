// Teaser Reels A "Aman, aku seng menang" (promo/BRIEF-teaser-a.md): animasi 2D tiga warga kedai di meja Kedai Madya
// dengan layar HP berisi rekaman game asli. Tanpa voice over: balon kata, caption, musik, dan bunyi game.
//
// Struktur mengikuti skill Remotion (multi-scene): satu komponen per adegan dengan frame lokal, dirangkai
// TransitionSeries (rewind sesudah cold open, fade ke penutup). Lapisan tetap (pil, logo pojok, grain) dan musik
// latar berada di luar seri karena menyentuh seluruh garis waktu.
import { Audio } from '@remotion/media';
import { linearTiming, TransitionSeries, type TransitionPresentationComponentProps } from '@remotion/transitions';
import { fade } from '@remotion/transitions/fade';
import { AbsoluteFill, interpolate, staticFile, useCurrentFrame } from 'remotion';
import { Buang } from './adegan/Buang';
import { ColdOpen } from './adegan/ColdOpen';
import { Datang } from './adegan/Datang';
import { Kepentung } from './adegan/Kepentung';
import { Ledek } from './adegan/Ledek';
import { Montase } from './adegan/Montase';
import { Penutup } from './adegan/Penutup';
import { PindaiQr } from './adegan/PindaiQr';
import { Pungut } from './adegan/Pungut';
import { HENING, KETUK_NUTUP, Tegang } from './adegan/Tegang';
import { QrAkhir } from './adegan/QrAkhir';
import { StempelAkhir } from './adegan/StempelAkhir';
import { Grain, LogoPojok, Pil } from './efek';
import { ADEGAN, MULAI, TEKS_PIL, TRANSISI } from './waktu';

/** Transisi rewind: adegan lama tertarik ke atas sambil memudar, adegan baru muncul dari sedikit lebih kecil. */
const RewindPresentation: React.FC<TransitionPresentationComponentProps<Record<string, never>>> = ({ children, presentationDirection, presentationProgress }) => {
  const p = presentationProgress;
  if (presentationDirection === 'exiting') {
    return <AbsoluteFill style={{ opacity: 1 - p, translate: `0px ${-p * 140}px`, filter: `blur(${p * 10}px)` }}>{children}</AbsoluteFill>;
  }
  return <AbsoluteFill style={{ opacity: p, scale: String(0.94 + 0.06 * p) }}>{children}</AbsoluteFill>;
};
const rewind = () => ({ component: RewindPresentation, props: {} as Record<string, never> });

/** Musik latar dari ElevenLabs (Eleven Music, bukan musik game) + suasana kedai pelan: diredam di adegan tegang, hening 0,4 dtk sebelum ketukan nutup. */
const MusikLatar: React.FC = () => {
  const frame = useCurrentFrame();
  const t0 = MULAI.tegang;
  const hening = frame >= t0 + HENING && frame < t0 + KETUK_NUTUP;
  return (
    <>
      <Audio name="Suasana kedai" src={staticFile('aset/eleven/suasana-kedai.mp3')} loop volume={hening ? 0 : interpolate(frame, [0, 30, t0, t0 + 60, MULAI.ledek, MULAI.penutup], [0.12, 0.16, 0.16, 0.05, 0.14, 0.18], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' })} />
    <Audio
      name="Musik kedai"
      src={staticFile('aset/eleven/musik-kedai.mp3')}
      volume={
        hening
          ? 0
          : interpolate(frame, [0, 60, t0, t0 + 60, t0 + HENING - 1, t0 + KETUK_NUTUP, MULAI.kepentung + 56, MULAI.ledek + 20, MULAI.montase, MULAI.penutup, MULAI.penutup + 30, MULAI.qrAkhir, MULAI.qrAkhir + 60, MULAI.qrAkhir + 90], [0.3, 0.32, 0.32, 0.1, 0.08, 0.12, 0.12, 0.26, 0.28, 0.3, 0.38, 0.34, 0.3, 0.02], {
              extrapolateLeft: 'clamp',
              extrapolateRight: 'clamp',
            })
      }
    />
    </>
  );
};

export const TeaserA: React.FC = () => (
  <AbsoluteFill style={{ background: '#17110a' }}>
    <TransitionSeries>
      <TransitionSeries.Sequence name="1 Cold open" durationInFrames={ADEGAN.coldOpen}>
        <ColdOpen />
      </TransitionSeries.Sequence>
      <TransitionSeries.Transition presentation={rewind()} timing={linearTiming({ durationInFrames: TRANSISI.rewind })} />
      <TransitionSeries.Sequence name="2 Bang IT datang" durationInFrames={ADEGAN.datang}>
        <Datang />
      </TransitionSeries.Sequence>
      <TransitionSeries.Sequence name="3 Pindai QR" durationInFrames={ADEGAN.pindaiQr}>
        <PindaiQr />
      </TransitionSeries.Sequence>
      <TransitionSeries.Sequence name="4 Buang iki ae" durationInFrames={ADEGAN.buang}>
        <Buang />
      </TransitionSeries.Sequence>
      <TransitionSeries.Sequence name="5 Dipungut" durationInFrames={ADEGAN.pungut}>
        <Pungut />
      </TransitionSeries.Sequence>
      <TransitionSeries.Sequence name="6 Tegang" durationInFrames={ADEGAN.tegang}>
        <Tegang />
      </TransitionSeries.Sequence>
      <TransitionSeries.Sequence name="7 Kepentung" durationInFrames={ADEGAN.kepentung}>
        <Kepentung />
      </TransitionSeries.Sequence>
      <TransitionSeries.Sequence name="8 Noob" durationInFrames={ADEGAN.ledek}>
        <Ledek />
      </TransitionSeries.Sequence>
      <TransitionSeries.Sequence name="9 Siji maneh" durationInFrames={ADEGAN.montase}>
        <Montase />
      </TransitionSeries.Sequence>
      <TransitionSeries.Transition presentation={fade()} timing={linearTiming({ durationInFrames: TRANSISI.fadePenutup })} />
      <TransitionSeries.Sequence name="10 Penutup" durationInFrames={ADEGAN.penutup}>
        <Penutup />
      </TransitionSeries.Sequence>
      <TransitionSeries.Sequence name="11 Stempel" durationInFrames={ADEGAN.stempel}>
        <StempelAkhir />
      </TransitionSeries.Sequence>
      <TransitionSeries.Transition presentation={fade()} timing={linearTiming({ durationInFrames: TRANSISI.fadeQr })} />
      <TransitionSeries.Sequence name="12 QR" durationInFrames={ADEGAN.qrAkhir}>
        <QrAkhir />
      </TransitionSeries.Sequence>
    </TransitionSeries>
    <Pil teks={TEKS_PIL} dari={MULAI.datang} sampai={MULAI.penutup} />
    <LogoPojok />
    <Grain kuat={0.028} />
    <MusikLatar />
  </AbsoluteFill>
);
