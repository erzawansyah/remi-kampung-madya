// Rig SVG tokoh 2D Teaser A (brief A §3): flat 2D hangat ala ilustrasi editorial. Garis tinta tebal, isian datar,
// satu tingkat bayangan (multiply 18%) dan satu highlight hangat dari lampu kedai. Bagian terpisah: kepala, rambut,
// alis kiri/kanan, mata (kelopak bisa menutup), hidung, mulut (bentuk ganti), badan, lengan atas/bawah kiri/kanan,
// tangan (memegang HP, menunjuk, menggebrak, memegang cangkir). Properti: ekspresi, pose, kedip, napas.
//
// Lengan memakai IK dua ruas: pose hanya menyebut letak tangan, siku dihitung dari panjang lengan atas/bawah dan
// selalu menekuk ke luar badan. Jadi lengan tidak pernah memanjang melintang seperti tongkat. Pose main bawaan:
// HP dipegang dua tangan di depan dada, kepala menunduk ke layar (seperti orang main HP di meja).
//
// Tokoh digambar di kotak lokal 440 × 600 (titik duduk di (220, 600), pusat kepala di (220, 170)) lalu
// ditempatkan oleh pemanggil. Tidak meniru wajah orang asli: bentuk umum, tanpa karikatur.
import type { ReactNode } from 'react';

export const TINTA = '#1d1a16';
export const TEBAL = 7;
/** Ukuran kotak lokal tokoh. */
export const KOTAK = { w: 440, h: 600, duduk: { x: 220, y: 600 }, kepala: { x: 220, y: 170 } };
/** Panjang lengan atas dan bawah (px lokal). */
export const LENGAN_ATAS = 132;
export const LENGAN_BAWAH = 124;

export type Ekspresi = 'datar' | 'sombong' | 'kaget' | 'tertawa' | 'malu' | 'kesal' | 'girang' | 'pasrah' | 'merem' | 'fokus';
/**
 * Isi tangan. 'hpDua' (di tangan kanan) = HP dipegang dua tangan di antara kedua tangan.
 * 'hp' = HP satu tangan, punggungnya menghadap kamera; 'hpLayar' = layarnya menghadap kamera.
 */
export type IsiTangan = 'kosong' | 'hp' | 'hpLayar' | 'hpDua' | 'cangkir' | 'tunjuk' | 'kepal' | 'telapak';

export interface Titik {
  x: number;
  y: number;
}
export interface Lengan {
  /** Diabaikan (siku dihitung IK). */
  siku?: Titik;
  tangan: Titik;
  isi: IsiTangan;
  /** Rotasi benda di tangan (derajat). */
  rot?: number;
  /** Arah jari telunjuk (derajat, 90 = ke bawah); tanpa ini jari searah lengan bawah. */
  arahJari?: number;
}
export interface Pose {
  /** Condong badan (derajat, + = ke kanan layar) berporos di titik duduk. */
  badanRot: number;
  badanX: number;
  badanY: number;
  /** Bahu turun (px, pasrah) atau naik (negatif, kaget). */
  bahu: number;
  kepalaRot: number;
  kepalaX: number;
  kepalaY: number;
  /** Arah pandang pupil (−1..1). */
  lihat: Titik;
  /** Arah hadap kepala (−1 kiri layar .. 1 kanan layar, 0 ke kamera). */
  hadap: number;
  /** Arah hadap badan (−1..1). */
  hadapBadan: number;
  /** Menunduk (0..1): wajah turun, dahi/rambut lebih terlihat. */
  tunduk: number;
  kiri: Lengan;
  kanan: Lengan;
}

export const titik = (x: number, y: number): Titik => ({ x, y });
const lerpT = (a: Titik, b: Titik, t: number): Titik => ({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t });
const lerpN = (a: number, b: number, t: number): number => a + (b - a) * t;

/** Interpolasi pose (isi tangan ikut `b` begitu t ≥ 0,5). */
export function lerpPose(a: Pose, b: Pose, t: number): Pose {
  const lengan = (p: Lengan, q: Lengan): Lengan => ({
    tangan: lerpT(p.tangan, q.tangan, t),
    isi: t < 0.5 ? p.isi : q.isi,
    rot: lerpN(p.rot ?? 0, q.rot ?? 0, t),
    arahJari: p.arahJari !== undefined && q.arahJari !== undefined ? lerpN(p.arahJari, q.arahJari, t) : t < 0.5 ? p.arahJari : q.arahJari,
  });
  return {
    badanRot: lerpN(a.badanRot, b.badanRot, t),
    badanX: lerpN(a.badanX, b.badanX, t),
    badanY: lerpN(a.badanY, b.badanY, t),
    bahu: lerpN(a.bahu, b.bahu, t),
    kepalaRot: lerpN(a.kepalaRot, b.kepalaRot, t),
    kepalaX: lerpN(a.kepalaX, b.kepalaX, t),
    kepalaY: lerpN(a.kepalaY, b.kepalaY, t),
    lihat: lerpT(a.lihat, b.lihat, t),
    hadap: lerpN(a.hadap, b.hadap, t),
    hadapBadan: lerpN(a.hadapBadan, b.hadapBadan, t),
    tunduk: lerpN(a.tunduk, b.tunduk, t),
    kiri: lengan(a.kiri, b.kiri),
    kanan: lengan(a.kanan, b.kanan),
  };
}

/** Pose main HP: dua tangan memegang HP di depan dada, kepala sedikit menunduk ke layar. */
export const POSE_DASAR: Pose = {
  badanRot: 0,
  badanX: 0,
  badanY: 4,
  bahu: 0,
  kepalaRot: 0,
  kepalaX: 0,
  kepalaY: 10,
  lihat: { x: 0, y: 0.9 },
  hadap: 0,
  hadapBadan: 0,
  tunduk: 0.55,
  kiri: { tangan: { x: 184, y: 446 }, isi: 'kosong' },
  kanan: { tangan: { x: 256, y: 446 }, isi: 'hpDua' },
};

export const pose = (ubah: Partial<Pose> & { kiri?: Partial<Lengan>; kanan?: Partial<Lengan> }, dasar: Pose = POSE_DASAR): Pose => ({
  ...dasar,
  ...ubah,
  kiri: { ...dasar.kiri, ...(ubah.kiri ?? {}) },
  kanan: { ...dasar.kanan, ...(ubah.kanan ?? {}) },
});

export interface Desain {
  nama: string;
  kulit: string;
  kulitGelap: string;
  rambut: string;
  baju: string;
  bajuGelap: string;
  /** Lengan baju pendek: lengan bawah berwarna kulit. */
  lenganPendek?: boolean;
  /** Skala lebar badan dan ukuran kepala (1 = sedang). */
  lebarBadan: number;
  kepala: number;
  /** Kelopak bawaan (1 = mata terbuka penuh; Cak Owner 0,6 = setengah tertutup). */
  kelopak: number;
  RambutBelakang?: React.FC;
  RambutDepan: React.FC;
  Pakaian?: React.FC;
  Wajah?: React.FC;
  kursi: string;
  /** Warna casing HP. */
  hp?: string;
  /** Warna lengan baju (bawaan = baju). */
  lengan?: string;
}

export interface PropsTokoh {
  desain: Desain;
  pose: Pose;
  ekspresi: Ekspresi;
  /** 0 = mata terbuka, 1 = terpejam (kedip). */
  kedip: number;
  /** Fase napas 0..1 (badan naik-turun ±1,5%). */
  napas: number;
  /** Squash & stretch (1 = normal). */
  sx?: number;
  sy?: number;
  /** Rotasi seluruh tokoh + kursi berporos titik duduk (terpental). */
  rot?: number;
  pakaiKursi?: boolean;
  children?: ReactNode;
  /** Rambut ikut gerak telat (follow-through), px. */
  ayun?: number;
  /** 'badan' (sebelum meja) atau 'lengan' (lengan, tangan, HP; sesudah meja). Bawaan semua. */
  lapisan?: 'badan' | 'lengan' | 'semua';
  /** Retakan di cangkir yang dipegang (0..1). */
  retakCangkir?: number;
  /** Hanya gambar kursinya (kursi kosong sebelum tokoh duduk). */
  hanyaKursi?: boolean;
}

interface Wajah {
  alisKiri: [number, number];
  alisKanan: [number, number];
  mata: number;
  mataLengkung?: boolean;
  mulut: 'garis' | 'miring' | 'o' | 'tawa' | 'bergelombang' | 'cemberut' | 'senyum' | 'tipis';
  pipi?: boolean;
}

const WAJAH: Record<Ekspresi, Wajah> = {
  datar: { alisKiri: [0, 0], alisKanan: [0, 0], mata: 1, mulut: 'garis' },
  sombong: { alisKiri: [-14, -12], alisKanan: [-4, 4], mata: 0.72, mulut: 'miring' },
  kaget: { alisKiri: [-20, 0], alisKanan: [-20, 0], mata: 1.25, mulut: 'o' },
  tertawa: { alisKiri: [-10, 0], alisKanan: [-10, 0], mata: 0, mataLengkung: true, mulut: 'tawa' },
  malu: { alisKiri: [6, 14], alisKanan: [6, -14], mata: 0.75, mulut: 'bergelombang', pipi: true },
  kesal: { alisKiri: [4, -18], alisKanan: [4, 18], mata: 0.65, mulut: 'cemberut' },
  girang: { alisKiri: [-12, 0], alisKanan: [-12, 0], mata: 1.05, mulut: 'senyum' },
  pasrah: { alisKiri: [2, 6], alisKanan: [2, -6], mata: 0.45, mulut: 'tipis' },
  merem: { alisKiri: [4, 8], alisKanan: [4, -8], mata: 0, mulut: 'tipis' },
  fokus: { alisKiri: [2, -4], alisKanan: [2, 4], mata: 0.72, mulut: 'tipis' },
};

const MULUT: Record<Wajah['mulut'], ReactNode> = {
  garis: <path d="M -16 0 L 16 0" fill="none" stroke={TINTA} strokeWidth={6} strokeLinecap="round" />,
  miring: <path d="M -18 4 Q 4 8 22 -8" fill="none" stroke={TINTA} strokeWidth={6} strokeLinecap="round" />,
  o: <ellipse cx={0} cy={2} rx={13} ry={17} fill="#4a1c1a" stroke={TINTA} strokeWidth={6} />,
  tawa: (
    <g>
      <path d="M -28 -6 Q 0 40 28 -6 Z" fill="#4a1c1a" stroke={TINTA} strokeWidth={6} strokeLinejoin="round" />
      <path d="M -20 -2 Q 0 4 20 -2" fill="#fbf6ea" />
      <path d="M -11 16 Q 0 27 11 16 Q 0 20 -11 16 Z" fill="#d8605c" />
    </g>
  ),
  bergelombang: <path d="M -16 2 Q -8 -6 0 2 Q 8 10 16 2" fill="none" stroke={TINTA} strokeWidth={6} strokeLinecap="round" />,
  cemberut: <path d="M -16 6 Q 0 -7 16 6" fill="none" stroke={TINTA} strokeWidth={6} strokeLinecap="round" />,
  senyum: <path d="M -22 -4 Q 0 24 22 -4 Z" fill="#4a1c1a" stroke={TINTA} strokeWidth={6} strokeLinejoin="round" />,
  tipis: <path d="M -11 2 L 11 2" fill="none" stroke={TINTA} strokeWidth={5} strokeLinecap="round" />,
};

/** Mata: putih + pupil; kelopak atas (warna kulit) turun memotong dari atas untuk mata setengah terbuka. */
const Mata: React.FC<{ x: number; buka: number; lihat: Titik; id: string; lengkung?: boolean; kulit: string }> = ({ x, buka, lihat, id, lengkung, kulit }) => {
  if (lengkung) return <path d={`M ${x - 15} 2 Q ${x} -20 ${x + 15} 2`} fill="none" stroke={TINTA} strokeWidth={7} strokeLinecap="round" />;
  if (buka < 0.12) return <path d={`M ${x - 14} 2 Q ${x} 8 ${x + 14} 2`} fill="none" stroke={TINTA} strokeWidth={6} strokeLinecap="round" />;
  const besar = Math.max(0, buka - 1);
  const rx = 14 + besar * 10;
  const ry = 16 + besar * 10;
  const potong = Math.max(0, 1 - Math.min(1, buka));
  const garisKelopak = -ry + ry * 2 * potong * 0.8;
  return (
    <g>
      <defs>
        <clipPath id={id}>
          <ellipse cx={x} cy={0} rx={rx} ry={ry} />
        </clipPath>
      </defs>
      <ellipse cx={x} cy={0} rx={rx} ry={ry} fill="#fffaf0" />
      <g clipPath={`url(#${id})`}>
        <circle cx={x + lihat.x * 6} cy={lihat.y * 6 + 1} r={8 + besar * 4} fill={TINTA} />
        <circle cx={x + lihat.x * 6 + 3} cy={lihat.y * 6 - 2} r={2.5} fill="#fff" />
        {potong > 0 && <rect x={x - rx - 2} y={-ry - 2} width={rx * 2 + 4} height={garisKelopak + ry + 2} fill={kulit} />}
      </g>
      <ellipse cx={x} cy={0} rx={rx} ry={ry} fill="none" stroke={TINTA} strokeWidth={5} />
      {potong > 0 && <path d={`M ${x - rx + 1} ${garisKelopak} Q ${x} ${garisKelopak - 3} ${x + rx - 1} ${garisKelopak}`} fill="none" stroke={TINTA} strokeWidth={5} strokeLinecap="round" />}
    </g>
  );
};

/** IK dua ruas: siku dari bahu ke tangan, menekuk ke luar badan (arah −1 kiri layar, 1 kanan). Tangan dijepit ke jangkauan. */
export function hitungLengan(bahu: Titik, tangan: Titik, arah: 1 | -1): { siku: Titik; tangan: Titik } {
  const L1 = LENGAN_ATAS;
  const L2 = LENGAN_BAWAH;
  let dx = tangan.x - bahu.x;
  let dy = tangan.y - bahu.y;
  let d = Math.hypot(dx, dy);
  const maks = L1 + L2 - 2;
  const min = Math.abs(L1 - L2) + 30;
  if (d > maks) {
    dx *= maks / d;
    dy *= maks / d;
    d = maks;
  } else if (d < min) {
    if (d < 1) {
      dx = 0;
      dy = min;
    } else {
      dx *= min / d;
      dy *= min / d;
    }
    d = min;
  }
  const a = Math.acos(Math.min(1, Math.max(-1, (L1 * L1 + d * d - L2 * L2) / (2 * L1 * d))));
  const dasar = Math.atan2(dy, dx);
  const s1 = { x: bahu.x + Math.cos(dasar + a) * L1, y: bahu.y + Math.sin(dasar + a) * L1 };
  const s2 = { x: bahu.x + Math.cos(dasar - a) * L1, y: bahu.y + Math.sin(dasar - a) * L1 };
  // Pilih siku yang lebih ke luar badan (x searah `arah`), sedikit condong ke bawah.
  const skor = (s: Titik) => s.y + s.x * arah * 0.5;
  const siku = skor(s1) >= skor(s2) ? s1 : s2;
  return { siku, tangan: { x: bahu.x + dx, y: bahu.y + dy } };
}

/** Ruas lengan meruncing, bergaris tinta. */
const Ruas: React.FC<{ dari: Titik; ke: Titik; warna: string; t1: number; t2: number; tanpaGaris?: boolean; geser?: number; opacity?: number }> = ({ dari, ke, warna, t1, t2, tanpaGaris, geser = 0, opacity = 1 }) => {
  const sudut = Math.atan2(ke.y - dari.y, ke.x - dari.x);
  const nx = -Math.sin(sudut);
  const ny = Math.cos(sudut);
  const p = (q: Titik, t: number) => `${(q.x + nx * (t + geser)).toFixed(1)} ${(q.y + ny * (t + geser)).toFixed(1)}`;
  const d = `M ${p(dari, t1 / 2)} L ${p(ke, t2 / 2)} A ${t2 / 2} ${t2 / 2} 0 0 1 ${p(ke, -t2 / 2)} L ${p(dari, -t1 / 2)} A ${t1 / 2} ${t1 / 2} 0 0 1 ${p(dari, t1 / 2)} Z`;
  return <path d={d} fill={warna} stroke={tanpaGaris ? 'none' : TINTA} strokeWidth={6} strokeLinejoin="round" opacity={opacity} />;
};

/** HP: punggung (casing + kamera) atau layar (hijau meja game). */
const BendaHp: React.FC<{ w: number; h: number; casing: string; layar?: boolean }> = ({ w, h, casing, layar }) => (
  <g>
    <rect x={-w / 2} y={-h / 2} width={w} height={h} rx={w * 0.18} fill={layar ? '#141317' : casing} stroke={TINTA} strokeWidth={6} />
    {layar ? (
      <g>
        <rect x={-w / 2 + 6} y={-h / 2 + 6} width={w - 12} height={h - 12} rx={w * 0.12} fill="#1d6a3d" />
        <rect x={-w / 2 + 12} y={-h / 2 + 16} width={w - 24} height={h * 0.18} rx={4} fill="#fbf6ea" opacity={0.75} />
        <rect x={-w / 2 + 12} y={h * 0.15} width={w - 24} height={h * 0.14} rx={4} fill="#f1a615" opacity={0.85} />
      </g>
    ) : (
      <g>
        <rect x={-w / 2 + 8} y={-h / 2 + 8} width={w * 0.42} height={w * 0.42} rx={8} fill="#141317" stroke="#3a3a40" strokeWidth={2} />
        <circle cx={-w / 2 + 8 + w * 0.12} cy={-h / 2 + 8 + w * 0.12} r={w * 0.075} fill="#2c3e57" stroke="#000" strokeWidth={2} />
        <circle cx={-w / 2 + 8 + w * 0.3} cy={-h / 2 + 8 + w * 0.28} r={w * 0.075} fill="#2c3e57" stroke="#000" strokeWidth={2} />
        <path d={`M ${w / 2 - 8} ${-h / 2 + 22} L ${w / 2 - 8} ${h / 2 - 22}`} stroke="#fff" strokeOpacity={0.2} strokeWidth={4} strokeLinecap="round" />
      </g>
    )}
  </g>
);

/** Tangan bergaris tinta, diputar searah lengan bawah (sudut = arah siku → tangan). */
const Tangan: React.FC<{ di: Titik; sudut: number; isi: IsiTangan; rot: number; D: Desain; arah: 1 | -1; retak?: number; arahJari?: number }> = ({ di, sudut, isi, rot, D, arah, retak = 0, arahJari }) => {
  const kulit = D.kulit;
  const deg = (sudut * 180) / Math.PI - 90;
  const kepal = (
    <g transform={`rotate(${deg})`}>
      <ellipse cx={0} cy={8} rx={20} ry={21} fill={kulit} stroke={TINTA} strokeWidth={6} />
      <ellipse cx={arah * 15} cy={0} rx={8} ry={12} fill={kulit} stroke={TINTA} strokeWidth={5} />
      <path d="M -10 18 Q 0 24 10 18" fill="none" stroke={D.kulitGelap} strokeWidth={3} />
    </g>
  );
  const santai = (
    <g transform={`rotate(${deg})`}>
      {[-15, -5, 5, 15].map((x, i) => (
        <rect key={i} x={x - 6} y={12} width={12} height={30 - Math.abs(x) * 0.4} rx={6} fill={kulit} stroke={TINTA} strokeWidth={5} />
      ))}
      <ellipse cx={0} cy={6} rx={22} ry={18} fill={kulit} stroke={TINTA} strokeWidth={6} />
      <ellipse cx={arah * 20} cy={2} rx={7} ry={12} fill={kulit} stroke={TINTA} strokeWidth={5} transform={`rotate(${-arah * 35} ${arah * 20} 2)`} />
    </g>
  );
  let isiGambar: ReactNode = isi === 'kosong' ? santai : kepal;
  switch (isi) {
    case 'hp':
    case 'hpLayar':
      isiGambar = (
        <g>
          <g transform={`translate(0 -30) rotate(${rot})`}>
            <BendaHp w={58} h={104} casing={D.hp ?? '#2b2b30'} layar={isi === 'hpLayar'} />
          </g>
          {kepal}
        </g>
      );
      break;
    case 'cangkir':
      isiGambar = (
        <g>
          <g transform={`translate(${arah * 4} -18) rotate(${rot})`}>
            <path d="M -26 -22 L -22 26 Q 0 34 22 26 L 26 -22 Z" fill="#f1a615" stroke={TINTA} strokeWidth={6} strokeLinejoin="round" />
            <path d="M 6 -22 L 8 28 Q 18 28 22 26 L 26 -22 Z" fill="#000" opacity={0.15} />
            <ellipse cx={0} cy={-22} rx={26} ry={8} fill="#ffd36a" stroke={TINTA} strokeWidth={6} />
            <ellipse cx={0} cy={-22} rx={18} ry={5} fill="#3b2314" />
            {retak > 0 && (
              <g stroke={TINTA} strokeWidth={3} fill="none" strokeLinecap="round" strokeDasharray={140} strokeDashoffset={140 * (1 - retak)}>
                <path d="M -6 -14 L 0 0 L -8 10 L -2 22 L -6 30" />
                <path d="M 0 0 L 12 4 L 10 14" />
                <path d="M -8 10 L -18 12" />
              </g>
            )}
          </g>
          <g transform={`translate(${-arah * 18} -10)`}>
            <ellipse cx={0} cy={0} rx={14} ry={20} fill={kulit} stroke={TINTA} strokeWidth={6} />
            <path d="M -6 -8 L 6 -8 M -6 2 L 6 2" stroke={D.kulitGelap} strokeWidth={3} strokeLinecap="round" />
          </g>
        </g>
      );
      break;
    case 'tunjuk':
      isiGambar = (
        <g transform={`rotate(${arahJari !== undefined ? arahJari - 90 : deg})`}>
          <rect x={-8} y={18} width={16} height={46} rx={8} fill={kulit} stroke={TINTA} strokeWidth={6} />
          <ellipse cx={0} cy={4} rx={20} ry={20} fill={kulit} stroke={TINTA} strokeWidth={6} />
          <path d="M -12 8 Q 0 14 12 8" fill="none" stroke={D.kulitGelap} strokeWidth={3} />
        </g>
      );
      break;
    case 'telapak':
      isiGambar = (
        <g transform={`rotate(${deg})`}>
          {[-14, -4, 6, 15].map((x, i) => (
            <rect key={i} x={x - 6} y={10} width={12} height={34 - Math.abs(x) * 0.5} rx={6} fill={kulit} stroke={TINTA} strokeWidth={5} />
          ))}
          <ellipse cx={0} cy={6} rx={23} ry={20} fill={kulit} stroke={TINTA} strokeWidth={6} />
          <ellipse cx={arah * 22} cy={-2} rx={8} ry={13} fill={kulit} stroke={TINTA} strokeWidth={5} transform={`rotate(${-arah * 40} ${arah * 22} -2)`} />
        </g>
      );
      break;
    default:
      break;
  }
  return <g transform={`translate(${di.x} ${di.y})`}>{isiGambar}</g>;
};

/** Tokoh lengkap di koordinat lokal 440 × 600. */
export const Tokoh: React.FC<PropsTokoh> = ({ desain: D, pose: P, ekspresi, kedip, napas, sx = 1, sy = 1, rot = 0, pakaiKursi = true, children, ayun = 0, lapisan = 'semua', retakCangkir = 0, hanyaKursi = false }) => {
  const w = WAJAH[ekspresi];
  const bukaMata = Math.max(0, w.mata * D.kelopak * (1 - kedip));
  const lengkung = !!w.mataLengkung && kedip < 0.5;
  const napasY = Math.sin(napas * Math.PI * 2) * 4;
  const napasS = 1 + Math.sin(napas * Math.PI * 2) * 0.015;
  const bahuY = 300 + P.bahu;
  const lb = D.lebarBadan;
  const hb = P.hadapBadan;
  const hk = P.hadap;
  const tk = P.tunduk;
  // Kepala ikut badan menoleh sedikit, dan menunduk menurunkan wajah.
  const kx = KOTAK.kepala.x + P.kepalaX + hb * 14;
  const ky = KOTAK.kepala.y + P.kepalaY + napasY * 0.5 + P.bahu * 0.5 + tk * 14;
  const id = D.nama.replace(/\W/g, '');
  const { x: dx, y: dy } = KOTAK.duduk;
  const lenganWarna = D.lenganPendek ? D.kulit : D.lengan ?? D.baju;
  const hpDua = P.kanan.isi === 'hpDua';
  // Geser fitur wajah saat menoleh (fx) dan menunduk (fy); sisi jauh wajah menyempit.
  const fx = hk * 30;
  const fy = tk * 22;
  const sempitJauh = 1 - Math.abs(hk) * 0.35;

  // Bahu: sisi yang menjauh dari kamera menyempit saat badan menoleh.
  const bahu = (arah: 1 | -1): Titik => {
    const jauh = arah * hb < 0 ? 1 - Math.abs(hb) * 0.28 : 1 + Math.abs(hb) * 0.06;
    return { x: 220 + arah * 82 * lb * jauh + hb * 10, y: bahuY + 12 + (arah * hb < 0 ? Math.abs(hb) * 6 : 0) };
  };
  const lk = hitungLengan(bahu(-1), P.kiri.tangan, -1);
  const lka = hitungLengan(bahu(1), P.kanan.tangan, 1);
  /** Satu lengan sebagai satu bentuk: garis tinta kedua ruas dulu, lalu isian + sendi, supaya tidak tampak tempelan. */
  const lengan = (L: Lengan, arah: 1 | -1, g: { siku: Titik; tangan: Titik }) => {
    const b = bahu(arah);
    const sudut = Math.atan2(g.tangan.y - g.siku.y, g.tangan.x - g.siku.x);
    const isi: IsiTangan = L.isi === 'hpDua' ? 'kepal' : hpDua && L.isi === 'kosong' ? 'kepal' : L.isi;
    const tA1 = 44;
    const tA2 = 36;
    const tB1 = D.lenganPendek ? 30 : 36;
    const tB2 = D.lenganPendek ? 24 : 30;
    const manset = (t: number) => ({ x: g.tangan.x - Math.cos(sudut) * 18 - Math.sin(sudut) * t, y: g.tangan.y - Math.sin(sudut) * 18 + Math.cos(sudut) * t });
    return (
      <g>
        <Ruas dari={b} ke={g.siku} warna={TINTA} t1={tA1 + 12} t2={tA2 + 12} tanpaGaris />
        <Ruas dari={g.siku} ke={g.tangan} warna={TINTA} t1={tB1 + 12} t2={tB2 + 12} tanpaGaris />
        <circle cx={b.x} cy={b.y} r={tA1 / 2 + 8} fill={TINTA} />
        <Ruas dari={b} ke={g.siku} warna={D.lengan ?? D.baju} t1={tA1} t2={tA2} tanpaGaris />
        <circle cx={b.x} cy={b.y} r={tA1 / 2 + 2} fill={D.lengan ?? D.baju} />
        {D.lenganPendek ? (
          <g>
            <Ruas dari={g.siku} ke={g.tangan} warna={lenganWarna} t1={tB1} t2={tB2} tanpaGaris />
            <circle cx={g.siku.x} cy={g.siku.y} r={tA2 / 2 + 1} fill={D.baju} />
            <path d={`M ${g.siku.x - 14} ${g.siku.y + 16} Q ${g.siku.x} ${g.siku.y + 26} ${g.siku.x + 14} ${g.siku.y + 16}`} fill="none" stroke={TINTA} strokeWidth={4} strokeLinecap="round" opacity={0.6} />
          </g>
        ) : (
          <g>
            <Ruas dari={g.siku} ke={g.tangan} warna={lenganWarna} t1={tB1} t2={tB2} tanpaGaris />
            <circle cx={g.siku.x} cy={g.siku.y} r={tA2 / 2 - 1} fill={lenganWarna} />
            <path d={`M ${g.siku.x - 10} ${g.siku.y - 6} Q ${g.siku.x - 2} ${g.siku.y + 2} ${g.siku.x - 10} ${g.siku.y + 10}`} fill="none" stroke={TINTA} strokeWidth={3.5} strokeLinecap="round" opacity={0.5} />
            <path d={`M ${manset(16).x} ${manset(16).y} L ${manset(-16).x} ${manset(-16).y}`} stroke={D.bajuGelap} strokeWidth={10} strokeLinecap="round" />
          </g>
        )}
        {/* Bayangan lengan sisi kanan supaya tetap satu tingkat bayangan dengan badan. */}
        <Ruas dari={b} ke={g.siku} warna="#000" t1={tA1 * 0.35} t2={tA2 * 0.35} tanpaGaris geser={arah * tA1 * 0.3} opacity={0.14} />
        <Tangan di={g.tangan} sudut={sudut} isi={isi} rot={L.rot ?? 0} D={D} arah={arah} retak={retakCangkir} arahJari={L.arahJari} />
      </g>
    );
  };
  const tengahHp = { x: (lk.tangan.x + lka.tangan.x) / 2, y: (lk.tangan.y + lka.tangan.y) / 2 - 26 };
  const miringHp = (Math.atan2(lka.tangan.y - lk.tangan.y, lka.tangan.x - lk.tangan.x) * 180) / Math.PI + (P.kanan.rot ?? 0);

  // Badan 3/4: sisi jauh menyempit lewat skala-X ringan dan geser detail pakaian.
  const badanSkew = -hb * 5;
  const telingaKiri = hk <= 0.35;
  const telingaKanan = hk >= -0.35;

  return (
    <g transform={`translate(${dx} ${dy}) rotate(${rot}) scale(${sx} ${sy}) translate(${-dx} ${-dy})`}>
      {lapisan !== 'lengan' && pakaiKursi && (
        <g transform={`translate(${P.badanX * 0.3} 0)`}>
          <rect x={220 - 152 * lb} y={326} width={304 * lb} height={274} rx={34} fill={D.kursi} stroke={TINTA} strokeWidth={TEBAL} />
          <rect x={220 - 132 * lb} y={348} width={264 * lb} height={230} rx={26} fill="none" stroke={TINTA} strokeWidth={5} opacity={0.45} />
          <rect x={220 - 152 * lb} y={326} width={60 * lb} height={274} rx={34} fill="#000" opacity={0.15} />
        </g>
      )}
      {!hanyaKursi && (
        <g transform={`translate(${dx + P.badanX} ${dy + P.badanY}) rotate(${P.badanRot}) scale(${napasS} ${napasS}) translate(${-dx} ${-dy})`}>
          {lapisan !== 'lengan' && (
            <g>
              {D.RambutBelakang && (
                <g transform={`translate(${kx - hk * 10} ${ky + ayun}) rotate(${P.kepalaRot}) scale(${D.kepala})`}>
                  <D.RambutBelakang />
                </g>
              )}
              {/* Badan: bahu membulat, menyempit ke pinggang; miring sedikit saat menoleh. */}
              <g transform={`translate(220 ${bahuY}) skewX(${badanSkew}) scale(${lb} 1) translate(-220 ${-bahuY})`}>
                <path
                  d={`M ${220 - 104} ${bahuY + 40} Q ${220 - 108} ${bahuY - 22} ${220 - 56} ${bahuY - 30} L ${220 + 56} ${bahuY - 30} Q ${220 + 108} ${bahuY - 22} ${220 + 104} ${bahuY + 40} L ${220 + 96} 600 L ${220 - 96} 600 Z`}
                  fill={D.baju}
                  stroke={TINTA}
                  strokeWidth={TEBAL}
                  strokeLinejoin="round"
                />
                <path d={`M ${220 + 34} ${bahuY - 28} Q ${220 + 106} ${bahuY - 20} ${220 + 104} ${bahuY + 40} L ${220 + 96} 600 L ${220 + 34} 600 Z`} fill="#000" opacity={0.18} />
                <ellipse cx={220 - 52} cy={bahuY + 34} rx={34} ry={54} fill="#ffd27a" opacity={0.2} />
                <g transform={`translate(${hb * 18} 0)`}>{D.Pakaian && <D.Pakaian />}</g>
              </g>
              {/* Leher. */}
              <path
                d={`M ${kx - 24} ${ky + 62 * D.kepala} L ${220 - 26 + hb * 10} ${bahuY - 22} Q ${220 + hb * 10} ${bahuY - 8} ${220 + 26 + hb * 10} ${bahuY - 22} L ${kx + 24} ${ky + 62 * D.kepala} Z`}
                fill={D.kulitGelap}
                stroke={TINTA}
                strokeWidth={TEBAL}
                strokeLinejoin="round"
              />
              {/* Kepala. */}
              <g transform={`translate(${kx} ${ky}) rotate(${P.kepalaRot}) scale(${D.kepala})`}>
                {telingaKiri && <ellipse cx={-78 - hk * 8} cy={10 + fy * 0.5} rx={14} ry={20} fill={D.kulit} stroke={TINTA} strokeWidth={6} />}
                {telingaKanan && <ellipse cx={78 - hk * 8} cy={10 + fy * 0.5} rx={14} ry={20} fill={D.kulit} stroke={TINTA} strokeWidth={6} />}
                {/* Wajah: lonjong dengan rahang membulat; saat menoleh, dagu bergeser ke arah hadap. */}
                <path
                  d={`M -78 -20 Q -80 -92 0 -94 Q 80 -92 78 -20 Q 78 50 ${50 + hk * 14} 78 Q ${24 + hk * 16} 98 ${hk * 16} 98 Q ${-24 + hk * 16} 98 ${-50 + hk * 14} 78 Q -78 50 -78 -20 Z`}
                  fill={D.kulit}
                  stroke={TINTA}
                  strokeWidth={TEBAL}
                  strokeLinejoin="round"
                />
                <path d="M 34 -88 Q 82 -50 76 20 Q 72 60 40 88 Q 62 40 58 -10 Q 54 -60 34 -88 Z" fill="#000" opacity={0.13} />
                <ellipse cx={-36} cy={-46} rx={20} ry={28} fill="#ffd27a" opacity={0.18} />
                {hpDua && <ellipse cx={fx} cy={80} rx={52} ry={22} fill="#9fe0c8" opacity={0.18} />}
                {/* Fitur wajah bergeser bersama arah hadap dan tunduk. */}
                <g transform={`translate(${fx} ${fy})`}>
                  {w.pipi && (
                    <g>
                      <ellipse cx={-44} cy={30} rx={17} ry={10} fill="#e2655a" opacity={0.6} />
                      <ellipse cx={44} cy={30} rx={17} ry={10} fill="#e2655a" opacity={0.6} />
                    </g>
                  )}
                  {/* Mata: yang di sisi jauh menyempit. */}
                  <g transform={`translate(${-30 - Math.max(0, hk) * 6} -2) scale(${hk > 0 ? sempitJauh : 1} 1)`}>
                    <Mata x={0} buka={bukaMata} lihat={P.lihat} id={`m-${id}-kiri`} lengkung={lengkung} kulit={D.kulit} />
                  </g>
                  <g transform={`translate(${30 + Math.min(0, hk) * 6} -2) scale(${hk < 0 ? sempitJauh : 1} 1)`}>
                    <Mata x={0} buka={bukaMata} lihat={P.lihat} id={`m-${id}-kanan`} lengkung={lengkung} kulit={D.kulit} />
                  </g>
                  <g transform={`translate(${-30 - Math.max(0, hk) * 6} ${-36 + w.alisKiri[0] - tk * 4}) rotate(${w.alisKiri[1]}) scale(${hk > 0 ? sempitJauh : 1} 1)`}>
                    <path d="M -20 4 Q 0 -8 20 2" fill="none" stroke={TINTA} strokeWidth={9} strokeLinecap="round" />
                  </g>
                  <g transform={`translate(${30 + Math.min(0, hk) * 6} ${-36 + w.alisKanan[0] - tk * 4}) rotate(${w.alisKanan[1]}) scale(${hk < 0 ? sempitJauh : 1} 1)`}>
                    <path d="M -20 2 Q 0 -8 20 4" fill="none" stroke={TINTA} strokeWidth={9} strokeLinecap="round" />
                  </g>
                  {/* Hidung: makin menoleh makin tampak samping. */}
                  <path d={`M ${2 + hk * 6} 10 Q ${12 + hk * 14} 26 ${hk * 6} 30`} fill="none" stroke={TINTA} strokeWidth={5} strokeLinecap="round" />
                  <g transform={`translate(${hk * 4} 52) scale(${1 - Math.abs(hk) * 0.18} 1)`}>{MULUT[w.mulut]}</g>
                  {D.Wajah && (
                    <g transform={`translate(${hk * 2} 0) scale(${1 - Math.abs(hk) * 0.15} 1)`}>
                      <D.Wajah />
                    </g>
                  )}
                </g>
                {/* Rambut depan: ikut arah hadap sebagian, dan turun sedikit saat menunduk (dahi lebih terlihat). */}
                <g transform={`translate(${ayun * 0.6 + hk * 12} ${-tk * 6}) rotate(${ayun * 0.15}) scale(${1 - Math.abs(hk) * 0.06} ${1 + tk * 0.08})`}>
                  <D.RambutDepan />
                </g>
              </g>
            </g>
          )}
          {lapisan !== 'badan' && (
            <g>
              {hpDua && (
                <g transform={`translate(${tengahHp.x} ${tengahHp.y}) rotate(${miringHp})`}>
                  <BendaHp w={70} h={124} casing={D.hp ?? '#2b2b30'} />
                </g>
              )}
              {/* Lengan sisi jauh digambar dulu. */}
              {hb >= 0 ? lengan(P.kiri, -1, lk) : lengan(P.kanan, 1, lka)}
              {hb >= 0 ? lengan(P.kanan, 1, lka) : lengan(P.kiri, -1, lk)}
              {children}
            </g>
          )}
        </g>
      )}
    </g>
  );
};

/** Kedip deterministik dari frame: tiap ±3,3 dtk (acak per benih), menutup 2 frame, membuka 3 frame. */
export function kedipDi(frame: number, benih: number): number {
  const periode = 92 + ((benih * 37) % 41);
  const f = (frame + benih * 17) % periode;
  if (f < 2) return f / 2;
  if (f < 6) return 1 - (f - 2) / 4;
  return 0;
}

/** Fase napas 0..1 dari frame (±3 dtk per siklus, benih menggeser fase). */
export const napasDi = (frame: number, benih: number): number => ((frame + benih * 23) % 90) / 90;
