import { Composition } from 'remotion';
import { DURASI_TEASER, FPS, Teaser } from './Teaser';

export const Root: React.FC = () => (
  <Composition id="Teaser" component={Teaser} durationInFrames={DURASI_TEASER} fps={FPS} width={1080} height={1920} />
);
