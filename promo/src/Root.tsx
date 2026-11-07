import { Composition } from 'remotion';
import { DURASI_TEASER, FPS, Teaser } from './Teaser';
import { Lineup } from './a/Lineup';
import { TeaserA } from './a/TeaserA';
import { DURASI as DURASI_A, FPS as FPS_A } from './a/waktu';

export const Root: React.FC = () => (
  <>
    <Composition id="Teaser" component={Teaser} durationInFrames={DURASI_TEASER} fps={FPS} width={1080} height={1920} />
    <Composition id="TeaserA" component={TeaserA} durationInFrames={DURASI_A} fps={FPS_A} width={1080} height={1920} />
    <Composition id="LineupA" component={Lineup} durationInFrames={30} fps={FPS_A} width={1080} height={1920} />
  </>
);
