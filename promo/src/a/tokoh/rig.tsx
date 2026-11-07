// Rig SVG tokoh 2D Teaser A (brief A §3): flat 2D hangat ala ilustrasi editorial. Garis tinta tebal, isian datar,
// satu tingkat bayangan (multiply 18%) dan satu highlight hangat dari lampu kedai. Bagian terpisah: kepala, rambut,
// alis kiri/kanan, mata (kelopak bisa menutup), mulut (bentuk ganti), badan, lengan atas/bawah kiri/kanan, tangan
// (memegang HP, menunjuk, menggebrak, memegang cangkir). Properti: ekspresi, pose, kedip, napas.
// Tokoh digambar di kotak lokal 440 × 600 (titik duduk di (220, 600), pusat kepala di (220, 170)) lalu
// ditempatkan oleh pemanggil. Tidak meniru wajah orang asli: bentuk umum, tanpa karikatur.
import type { ReactNode } from 'react';

export const TINTA = '#1d1a16';
export const TEBAL = 7;
/** Ukuran kotak lokal tokoh. */
export const KOTAK = { w: 440, h: 600, duduk: { x: 220, y: 600 }, kepala: { x: 220, y: 170 } };

export type Ekspresi = 'datar' | 'sombong' | 'kaget' | 'tertawa' | 'malu' | 'kesal' | 'girang' | 'pasrah' | 'merem';
export type IsiTangan = 'kosong' | 'hp' | 'cangkir' | 'tunjuk' | 'kepal' | 'telapak';

export interface Titik {
  x: number;
  y: number;
}
export interface Lengan {
  siku: Titik;
  tangan: Titik;
  isi: IsiTangan;
  /** Rotasi benda di tangan (derajat). */
  rot?: number;
}
export interface Pose {
  /** Condong badan (derajat, + = ke kanan layar) berporos di titik duduk. */
  badanRot: number;
  /** Geser badan (px lokal). */
  badanX: number;
  badanY: number;
  /** Bahu turun (px, pasrah) atau naik (negatif, kaget). */
  bahu: number;
  kepalaRot: number;
  kepalaX: number;
  kepalaY: number;
  /** Arah pandang pupil (−1..1). */
  lihat: Titik;
  kiri: Lengan;
  kanan: Lengan;
}

export const titik = (x: number, y: number): Titik => ({ x, y });
const lerpT = (a: Titik, b: Titik, t: number): Titik => ({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t });
const lerpN = (a: number, b: number, t: number): number => a + (b - a) * t;

/** Interpolasi pose (isi tangan ikut `b` begitu t ≥ 0,5). */
export function lerpPose(a: Pose, b: Pose, t: number): Pose {
  const lengan = (p: Lengan, q: Lengan): Lengan => ({ siku: lerpT(p.siku, q.siku, t), tangan: lerpT(p.tangan, q.tangan, t), isi: t < 0.5 ? p.isi : q.isi, rot: lerpN(p.rot ?? 0, q.rot ?? 0, t) });
  return {
    badanRot: lerpN(a.badanRot, b.badanRot, t),
    badanX: lerpN(a.badanX, b.badanX, t),
    badanY: lerpN(a.badanY, b.badanY, t),
    bahu: lerpN(a.bahu, b.bahu, t),
    kepalaRot: lerpN(a.kepalaRot, b.kepalaRot, t),
    kepalaX: lerpN(a.kepalaX, b.kepalaX, t),
    kepalaY: lerpN(a.kepalaY, b.kepalaY, t),
    lihat: lerpT(a.lihat, b.lihat, t),
    kiri: lengan(a.kiri, b.kiri),
    kanan: lengan(a.kanan, b.kanan),
  };
}

/** Pose duduk santai: kedua tangan di meja. */
export const POSE_DASAR: Pose = {
  badanRot: 0,
  badanX: 0,
  badanY: 0,
  bahu: 0,
  kepalaRot: 0,
  kepalaX: 0,
  kepalaY: 0,
  lihat: { x: 0, y: 0 },
  kiri: { siku: { x: 60, y: 440 }, tangan: { x: 150, y: 500 }, isi: 'kosong' },
  kanan: { siku: { x: 380, y: 440 }, tangan: { x: 290, y: 500 }, isi: 'kosong' },
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
  /** Rambut di belakang kepala (digambar sebelum kepala). */
  RambutBelakang?: React.FC;
  /** Rambut di depan/atas kepala. */
  RambutDepan: React.FC;
  /** Pakaian tambahan di atas badan (celemek, tudung, motif flanel). Koordinat lokal badan. */
  Pakaian?: React.FC;
  /** Tambahan wajah (kumis). Koordinat lokal kepala (pusat 0,0). */
  Wajah?: React.FC;
  /** Warna kursi. */
  kursi: string;
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
  /** Gambar kursi (bawaan ya). */
  pakaiKursi?: boolean;
  /** Lapisan tambahan di koordinat lokal (mis. gelas retak). */
  children?: ReactNode;
  /** Tudung/rambut ikut gerak telat (follow-through), px. */
  ayun?: number;
  /**
   * Lapisan yang digambar: 'badan' (kursi, badan, kepala; sebelum meja) atau 'lengan' (lengan dan tangan beserta
   * bendanya; sesudah meja, supaya tangan terlihat di atas meja). Bawaan semua.
   */
  lapisan?: 'badan' | 'lengan' | 'semua';
  /** Retakan di cangkir yang dipegang (0..1). */
  retakCangkir?: number;
  /** Hanya gambar kursinya (kursi kosong sebelum tokoh duduk). */
  hanyaKursi?: boolean;
}

/** Bentuk alis/mata/mulut per ekspresi. */
interface Wajah {
  /** Alis kiri/kanan: [geser y, rotasi derajat] (y negatif = naik). */
  alisKiri: [number, number];
  alisKanan: [number, number];
  /** Bukaan mata 0..1,2 (1 = normal, > 1 = melotot). */
  mata: number;
  /** Mata jadi lengkung tertawa. */
  mataLengkung?: boolean;
  mulut: 'garis' | 'miring' | 'o' | 'tawa' | 'bergelombang' | 'cemberut' | 'senyum' | 'tipis';
  pipi?: boolean;
}

const WAJAH: Record<Ekspresi, Wajah> = {
  datar: { alisKiri: [0, 0], alisKanan: [0, 0], mata: 1, mulut: 'garis' },
  sombong: { alisKiri: [-14, -12], alisKanan: [-4, 4], mata: 0.7, mulut: 'miring' },
  kaget: { alisKiri: [-20, 0], alisKanan: [-20, 0], mata: 1.25, mulut: 'o' },
  tertawa: { alisKiri: [-10, 0], alisKanan: [-10, 0], mata: 0, mataLengkung: true, mulut: 'tawa' },
  malu: { alisKiri: [6, 14], alisKanan: [6, -14], mata: 0.75, mulut: 'bergelombang', pipi: true },
  kesal: { alisKiri: [4, -18], alisKanan: [4, 18], mata: 0.6, mulut: 'cemberut' },
  girang: { alisKiri: [-12, 0], alisKanan: [-12, 0], mata: 1.05, mulut: 'senyum' },
  pasrah: { alisKiri: [2, 6], alisKanan: [2, -6], mata: 0.42, mulut: 'tipis' },
  merem: { alisKiri: [4, 8], alisKanan: [4, -8], mata: 0, mulut: 'tipis' },
};

const MULUT: Record<Wajah['mulut'], ReactNode> = {
  garis: <path d="M -18 0 L 18 0" fill="none" stroke={TINTA} strokeWidth={6} strokeLinecap="round" />,
  miring: <path d="M -20 4 Q 4 8 24 -8" fill="none" stroke={TINTA} strokeWidth={6} strokeLinecap="round" />,
  o: <ellipse cx={0} cy={2} rx={14} ry={19} fill="#4a1c1a" stroke={TINTA} strokeWidth={6} />,
  tawa: (
    <g>
      <path d="M -30 -6 Q 0 44 30 -6 Z" fill="#4a1c1a" stroke={TINTA} strokeWidth={6} strokeLinejoin="round" />
      <path d="M -22 -2 Q 0 4 22 -2" fill="#fbf6ea" />
      <path d="M -12 18 Q 0 30 12 18 Q 0 22 -12 18 Z" fill="#d8605c" />
    </g>
  ),
  bergelombang: <path d="M -18 2 Q -9 -6 0 2 Q 9 10 18 2" fill="none" stroke={TINTA} strokeWidth={6} strokeLinecap="round" />,
  cemberut: <path d="M -18 6 Q 0 -8 18 6" fill="none" stroke={TINTA} strokeWidth={6} strokeLinecap="round" />,
  senyum: <path d="M -24 -4 Q 0 26 24 -4 Z" fill="#4a1c1a" stroke={TINTA} strokeWidth={6} strokeLinejoin="round" />,
  tipis: <path d="M -12 2 L 12 2" fill="none" stroke={TINTA} strokeWidth={5} strokeLinecap="round" />,
};

/** Satu mata: putih + pupil (terpotong), kelopak atas menutup sesuai `buka`. */
const Mata: React.FC<{ x: number; buka: number; lihat: Titik; id: string; lengkung?: boolean }> = ({ x, buka, lihat, id, lengkung }) => {
  if (lengkung) return <path d={`M ${x - 16} 2 Q ${x} -22 ${x + 16} 2`} fill="none" stroke={TINTA} strokeWidth={7} strokeLinecap="round" />;
  const ry = Math.max(0, 17 * Math.min(buka, 1.25));
  if (ry < 1.5) return <path d={`M ${x - 15} 2 Q ${x} 8 ${x + 15} 2`} fill="none" stroke={TINTA} strokeWidth={6} strokeLinecap="round" />;
  const rx = 15 + Math.max(0, buka - 1) * 10;
  return (
    <g>
      <defs>
        <clipPath id={id}>
          <ellipse cx={x} cy={0} rx={rx} ry={ry} />
        </clipPath>
      </defs>
      <ellipse cx={x} cy={0} rx={rx} ry={ry} fill="#fffaf0" stroke={TINTA} strokeWidth={5} />
      <g clipPath={`url(#${id})`}>
        <circle cx={x + lihat.x * 7} cy={lihat.y * 5 + 1} r={8 + Math.max(0, buka - 1) * 4} fill={TINTA} />
        <circle cx={x + lihat.x * 7 + 3} cy={lihat.y * 5 - 2} r={2.5} fill="#fff" />
      </g>
      {/* Kelopak atas untuk mata setengah tertutup. */}
      {buka < 0.95 && <ellipse cx={x} cy={0} rx={rx + 1} ry={ry} fill="none" stroke={TINTA} strokeWidth={4} />}
    </g>
  );
};

/** Segmen lengan: garis tinta tebal lalu warna lengan/kulit di dalamnya. */
const SegmenLengan: React.FC<{ dari: Titik; ke: Titik; warna: string; tebal?: number }> = ({ dari, ke, warna, tebal = 38 }) => (
  <g>
    <line x1={dari.x} y1={dari.y} x2={ke.x} y2={ke.y} stroke={TINTA} strokeWidth={tebal + TEBAL * 2} strokeLinecap="round" />
    <line x1={dari.x} y1={dari.y} x2={ke.x} y2={ke.y} stroke={warna} strokeWidth={tebal} strokeLinecap="round" />
  </g>
);

const Tangan: React.FC<{ di: Titik; isi: IsiTangan; rot: number; kulit: string; kulitGelap: string; arah: 1 | -1; retak?: number }> = ({ di, isi, rot, kulit, kulitGelap, arah, retak = 0 }) => {
  const telapak = <circle cx={0} cy={0} r={23} fill={kulit} stroke={TINTA} strokeWidth={6} />;
  let benda: ReactNode = null;
  switch (isi) {
    case 'hp':
      benda = (
        <g transform={`translate(${arah * 6} -16) rotate(${-arah * 18})`}>
          <rect x={-30} y={-58} width={60} height={110} rx={10} fill="#141317" stroke={TINTA} strokeWidth={6} />
          <rect x={-24} y={-50} width={48} height={94} rx={6} fill="#2f6f7d" />
          <rect x={-24} y={-50} width={48} height={94} rx={6} fill="url(#kilauHp)" />
          <circle cx={0} cy={-20} r={10} fill="#f1a615" opacity={0.9} />
          <rect x={-16} y={2} width={32} height={6} rx={3} fill="#fbf6ea" opacity={0.7} />
          <rect x={-16} y={14} width={22} height={6} rx={3} fill="#fbf6ea" opacity={0.5} />
        </g>
      );
      break;
    case 'cangkir':
      benda = (
        <g transform="translate(0 -14)">
          <path d="M -26 -22 L -22 26 Q 0 34 22 26 L 26 -22 Z" fill="#f1a615" stroke={TINTA} strokeWidth={6} strokeLinejoin="round" />
          <ellipse cx={0} cy={-22} rx={26} ry={8} fill="#ffd36a" stroke={TINTA} strokeWidth={6} />
          <ellipse cx={0} cy={-22} rx={18} ry={5} fill="#3b2314" />
          <path d={`M ${arah * 26} -10 Q ${arah * 48} -8 ${arah * 44} 12 Q ${arah * 40} 24 ${arah * 24} 20`} fill="none" stroke={TINTA} strokeWidth={14} strokeLinecap="round" />
          <path d={`M ${arah * 26} -10 Q ${arah * 48} -8 ${arah * 44} 12 Q ${arah * 40} 24 ${arah * 24} 20`} fill="none" stroke="#f1a615" strokeWidth={6} strokeLinecap="round" />
          {retak > 0 && (
            <g stroke={TINTA} strokeWidth={3} fill="none" strokeLinecap="round" strokeDasharray={140} strokeDashoffset={140 * (1 - retak)}>
              <path d="M -6 -14 L 0 0 L -8 10 L -2 22 L -6 30" />
              <path d="M 0 0 L 12 4 L 10 14" />
              <path d="M -8 10 L -18 12" />
            </g>
          )}
        </g>
      );
      break;
    case 'tunjuk':
      benda = <rect x={-9} y={-62} width={18} height={56} rx={9} fill={kulit} stroke={TINTA} strokeWidth={6} />;
      break;
    case 'kepal':
      benda = <g>{null}</g>;
      break;
    case 'telapak':
      benda = (
        <g>
          <ellipse cx={0} cy={-6} rx={28} ry={24} fill={kulit} stroke={TINTA} strokeWidth={6} />
          {[-16, 0, 16].map((x, i) => (
            <rect key={i} x={x - 8} y={-46 + Math.abs(x) * 0.3} width={16} height={40} rx={8} fill={kulit} stroke={TINTA} strokeWidth={6} />
          ))}
        </g>
      );
      break;
    default:
      break;
  }
  return (
    <g transform={`translate(${di.x} ${di.y}) rotate(${rot})`}>
      {isi === 'telapak' ? benda : telapak}
      {isi !== 'telapak' && benda}
      {isi === 'kepal' && <circle cx={0} cy={0} r={26} fill={kulit} stroke={TINTA} strokeWidth={6} />}
      {isi === 'cangkir' || isi === 'hp' ? <path d={`M ${-arah * 14} -4 Q 0 14 ${arah * 14} -4`} fill="none" stroke={kulitGelap} strokeWidth={4} opacity={0.6} /> : null}
    </g>
  );
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
  const kepalaR = { rx: 80 * D.kepala, ry: 92 * D.kepala };
  const kx = KOTAK.kepala.x + P.kepalaX + P.badanX;
  const ky = KOTAK.kepala.y + P.kepalaY + P.badanY + napasY * 0.5 + P.bahu * 0.5;
  const id = D.nama.replace(/\W/g, '');
  const { x: dx, y: dy } = KOTAK.duduk;
  const lenganWarna = D.lenganPendek ? D.kulit : D.bajuGelap;
  const lengan = (L: Lengan, arah: 1 | -1) => {
    const bahu = { x: 220 + arah * 92 * lb + P.badanX, y: bahuY + P.badanY };
    return (
      <g>
        <SegmenLengan dari={bahu} ke={L.siku} warna={D.baju} tebal={40} />
        <SegmenLengan dari={L.siku} ke={L.tangan} warna={lenganWarna} tebal={34} />
        {D.lenganPendek && <circle cx={L.siku.x} cy={L.siku.y} r={20} fill={D.baju} stroke={TINTA} strokeWidth={6} />}
        <Tangan di={L.tangan} isi={L.isi} rot={L.rot ?? 0} kulit={D.kulit} kulitGelap={D.kulitGelap} arah={arah} retak={retakCangkir} />
      </g>
    );
  };
  return (
    <g transform={`translate(${dx} ${dy}) rotate(${rot}) scale(${sx} ${sy}) translate(${-dx} ${-dy})`}>
      <defs>
        <linearGradient id="kilauHp" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#fff" stopOpacity={0.35} />
          <stop offset="0.5" stopColor="#fff" stopOpacity={0} />
        </linearGradient>
      </defs>
      {/* Kursi (sandaran) di belakang badan. */}
      {lapisan !== 'lengan' && pakaiKursi && (
        <g transform={`translate(${P.badanX * 0.3} 0)`}>
          <rect x={220 - 152 * lb} y={326} width={304 * lb} height={274} rx={34} fill={D.kursi} stroke={TINTA} strokeWidth={TEBAL} />
          <rect x={220 - 132 * lb} y={348} width={264 * lb} height={230} rx={26} fill="none" stroke={TINTA} strokeWidth={5} opacity={0.45} />
          <rect x={220 - 152 * lb} y={326} width={60 * lb} height={274} rx={34} fill="#000" opacity={0.15} />
        </g>
      )}
      {/* Badan: condong berporos titik duduk, napas skala kecil. */}
      {!hanyaKursi && (
      <g transform={`translate(${dx + P.badanX} ${dy + P.badanY}) rotate(${P.badanRot}) scale(${napasS} ${napasS}) translate(${-dx} ${-dy})`}>
        {lapisan !== 'lengan' && D.RambutBelakang && (
          <g transform={`translate(${KOTAK.kepala.x + P.kepalaX} ${KOTAK.kepala.y + P.kepalaY + P.bahu * 0.5 + ayun}) rotate(${P.kepalaRot}) scale(${D.kepala})`}>
            <D.RambutBelakang />
          </g>
        )}
        {lapisan !== 'lengan' && (
        <g>
        {/* Badan (torso) dengan bahu membulat. */}
        <g transform={`translate(220 ${bahuY}) scale(${lb} 1) translate(-220 ${-bahuY})`}>
          <path
            d={`M ${220 - 118} ${bahuY + 10} Q ${220 - 118} ${bahuY - 30} ${220 - 70} ${bahuY - 32} L ${220 + 70} ${bahuY - 32} Q ${220 + 118} ${bahuY - 30} ${220 + 118} ${bahuY + 10} L ${220 + 132} 600 L ${220 - 132} 600 Z`}
            fill={D.baju}
            stroke={TINTA}
            strokeWidth={TEBAL}
            strokeLinejoin="round"
          />
          {/* Bayangan sisi kanan (multiply 18%) dan highlight hangat kiri atas. */}
          <path d={`M ${220 + 40} ${bahuY - 30} Q ${220 + 118} ${bahuY - 20} ${220 + 118} ${bahuY + 10} L ${220 + 132} 600 L ${220 + 40} 600 Z`} fill="#000" opacity={0.18} />
          <ellipse cx={220 - 60} cy={bahuY + 40} rx={40} ry={60} fill="#ffd27a" opacity={0.22} />
          {D.Pakaian && (
            <g>
              <D.Pakaian />
            </g>
          )}
        </g>
        {/* Leher. */}
        <rect x={220 - 26 + P.kepalaX * 0.5} y={238 + P.kepalaY * 0.5 + P.bahu * 0.3} width={52} height={70} rx={14} fill={D.kulitGelap} stroke={TINTA} strokeWidth={TEBAL} />
        {/* Kepala. */}
        <g transform={`translate(${kx} ${ky}) rotate(${P.kepalaRot})`}>
          <g transform={`scale(${D.kepala})`}>
            {/* Telinga */}
            <ellipse cx={-80} cy={8} rx={14} ry={20} fill={D.kulit} stroke={TINTA} strokeWidth={6} />
            <ellipse cx={80} cy={8} rx={14} ry={20} fill={D.kulit} stroke={TINTA} strokeWidth={6} />
            <ellipse cx={0} cy={0} rx={kepalaR.rx / D.kepala} ry={kepalaR.ry / D.kepala} fill={D.kulit} stroke={TINTA} strokeWidth={TEBAL} />
            <path d={`M 30 -86 Q 84 -40 76 40 Q 70 76 30 90 Q 60 40 56 -10 Q 52 -60 30 -86 Z`} fill="#000" opacity={0.14} />
            <ellipse cx={-36} cy={-44} rx={22} ry={30} fill="#ffd27a" opacity={0.2} />
            {/* Pipi merah (malu). */}
            {w.pipi && (
              <g>
                <ellipse cx={-44} cy={26} rx={18} ry={11} fill="#e2655a" opacity={0.6} />
                <ellipse cx={44} cy={26} rx={18} ry={11} fill="#e2655a" opacity={0.6} />
              </g>
            )}
            {/* Mata */}
            <g transform="translate(0 -4)">
              <Mata x={-32} buka={bukaMata} lihat={P.lihat} id={`m-${id}-kiri`} lengkung={lengkung} />
              <Mata x={32} buka={bukaMata} lihat={P.lihat} id={`m-${id}-kanan`} lengkung={lengkung} />
            </g>
            {/* Alis */}
            <g transform={`translate(-32 ${-40 + w.alisKiri[0]}) rotate(${w.alisKiri[1]})`}>
              <path d="M -22 4 Q 0 -8 22 2" fill="none" stroke={TINTA} strokeWidth={9} strokeLinecap="round" />
            </g>
            <g transform={`translate(32 ${-40 + w.alisKanan[0]}) rotate(${w.alisKanan[1]})`}>
              <path d="M -22 2 Q 0 -8 22 4" fill="none" stroke={TINTA} strokeWidth={9} strokeLinecap="round" />
            </g>
            {/* Mulut */}
            <g transform="translate(0 44)">{MULUT[w.mulut]}</g>
            {D.Wajah && <D.Wajah />}
            {/* Rambut depan (ikut ayun telat). */}
            <g transform={`translate(${ayun * 0.6} 0) rotate(${ayun * 0.15})`}>
              <D.RambutDepan />
            </g>
          </g>
        </g>
        </g>
        )}
        {/* Lengan di depan badan (lapisan 'lengan' digambar sesudah meja). */}
        {lapisan !== 'badan' && lengan(P.kiri, -1)}
        {lapisan !== 'badan' && lengan(P.kanan, 1)}
        {lapisan !== 'badan' && children}
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
