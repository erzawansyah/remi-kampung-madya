// Penempatan tokoh di panggung 1080 × 1920: kotak lokal 440 × 600 diskalakan dan ditaruh dengan titik duduknya
// di kursi (KURSI di MejaKedai.tsx). SVG-nya overflow visible supaya rambut, lengan, dan benda di tangan yang
// keluar kotak tetap tergambar.
import { KOTAK, Tokoh, type PropsTokoh } from './tokoh/rig';

export interface Kursi {
  x: number;
  y: number;
  skala: number;
}

export const TokohDiKursi: React.FC<PropsTokoh & { kursi: Kursi; geserX?: number; geserY?: number; opacity?: number }> = ({ kursi, geserX = 0, geserY = 0, opacity = 1, ...tokoh }) => {
  const w = KOTAK.w * kursi.skala;
  const h = KOTAK.h * kursi.skala;
  return (
    <svg
      width={KOTAK.w}
      height={KOTAK.h}
      viewBox={`0 0 ${KOTAK.w} ${KOTAK.h}`}
      style={{ position: 'absolute', left: kursi.x - w / 2 + geserX, top: kursi.y - h + geserY, width: w, height: h, overflow: 'visible', opacity }}
    >
      <Tokoh {...tokoh} />
    </svg>
  );
};
