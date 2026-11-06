import { Composition } from 'remotion';
import { DURASI_TEASER, FPS, Teaser } from './Teaser';
import { TeaserB } from './b/TeaserB';
import { DURASI as DURASI_B, FPS as FPS_B } from './b/waktu';

export const Root: React.FC = () => (
  <>
    <Composition id="Teaser" component={Teaser} durationInFrames={DURASI_TEASER} fps={FPS} width={1080} height={1920} />
    <Composition id="TeaserB" component={TeaserB} durationInFrames={DURASI_B} fps={FPS_B} width={1080} height={1920} />
  </>
);
