// Pelacak keyframe untuk animasi tokoh dan kamera: nilai di antara dua kunci diinterpolasi dengan ease yang
// disebut di kunci tujuan ('halus' smootherstep, 'burst' ease-out kuat, 'pegas' lewat-sedikit lalu kembali,
// 'tajam' lompat di frame kunci, 'linear'). Semua fungsi murni dari frame.
import { burst, halus } from './efek';
import { lerpPose, type Ekspresi, type Pose } from './tokoh/rig';

export type Ease = 'halus' | 'burst' | 'pegas' | 'tajam' | 'linear' | 'masuk';
export type Kunci<T> = [frame: number, nilai: T, ease?: Ease];

const pegas = (t: number): number => {
  const x = Math.min(1, Math.max(0, t));
  // Overshoot ±8% lalu meredam (pegas ringan, 1 ayunan).
  return 1 - Math.cos(x * Math.PI * 0.5) ** 1 * (1 - x) + Math.sin(x * Math.PI) * 0.09 * (1 - x);
};
const masuk = (t: number): number => Math.min(1, Math.max(0, t)) ** 2.2;

const ease = (jenis: Ease | undefined, t: number): number => {
  switch (jenis) {
    case 'burst':
      return burst(t);
    case 'pegas':
      return pegas(t);
    case 'tajam':
      return t >= 1 ? 1 : 0;
    case 'linear':
      return Math.min(1, Math.max(0, t));
    case 'masuk':
      return masuk(t);
    default:
      return halus(t);
  }
};

/** Cari segmen kunci untuk frame f: [a, b, t]. */
function segmen<T>(f: number, kunci: Kunci<T>[]): { a: Kunci<T>; b: Kunci<T>; t: number } {
  if (f <= kunci[0][0]) return { a: kunci[0], b: kunci[0], t: 1 };
  for (let i = 1; i < kunci.length; i++) {
    const a = kunci[i - 1];
    const b = kunci[i];
    if (f <= b[0]) return { a, b, t: ease(b[2], (f - a[0]) / Math.max(1, b[0] - a[0])) };
  }
  const akhir = kunci[kunci.length - 1];
  return { a: akhir, b: akhir, t: 1 };
}

export const trek = (f: number, kunci: Kunci<number>[]): number => {
  const { a, b, t } = segmen(f, kunci);
  return a[1] + (b[1] - a[1]) * t;
};

export const trekPose = (f: number, kunci: Kunci<Pose>[]): Pose => {
  const { a, b, t } = segmen(f, kunci);
  return t >= 1 ? b[1] : t <= 0 ? a[1] : lerpPose(a[1], b[1], t);
};

/** Ekspresi berganti di frame kunci (tanpa interpolasi). */
export const trekEkspresi = (f: number, kunci: [number, Ekspresi][]): Ekspresi => {
  let e = kunci[0][1];
  for (const [fr, x] of kunci) if (f >= fr) e = x;
  return e;
};

/** Getar tawa: badan naik-turun cepat (±amplitudo px) selama [dari, sampai). */
export const tawa = (f: number, dari: number, sampai: number, amp = 6): number => (f >= dari && f < sampai ? Math.sin((f - dari) * 1.3) * amp : 0);

/** Ayunan telat (follow-through) dari kecepatan gerak `nilai(f)`: selisih nilai 2 frame sebelumnya, diredam. */
export const telat = (f: number, nilai: (fr: number) => number, kuat = 0.6): number => (nilai(f - 2) - nilai(f)) * kuat;
