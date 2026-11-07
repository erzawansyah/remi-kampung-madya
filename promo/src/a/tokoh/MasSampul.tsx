// Mas Sampul, Si Penggembira (brief A §3): pendek dan bulat, rambut keriting mengembang, kemeja flanel
// zaitun-krem, tawa lebar, tangan suka menggebrak meja. Desain umum, bukan tiruan orang mana pun.
import { TINTA, type Desain } from './rig';

const ZAITUN = '#6b865e';
const ZAITUN_GELAP = '#55704a';
const KRIM = '#fbf6ea';

/** Gumpalan keriting: lingkaran-lingkaran bertumpuk mengelilingi kepala. */
const gumpal = (r: number, n: number, mulai: number, akhir: number, ry = r) =>
  Array.from({ length: n }, (_, i) => {
    const a = mulai + ((akhir - mulai) * i) / Math.max(1, n - 1);
    return { x: Math.cos(a) * r, y: Math.sin(a) * ry, s: 26 + ((i * 7) % 3) * 6 };
  });

const RambutBelakang: React.FC = () => (
  <g>
    {gumpal(96, 11, Math.PI * 1.05, Math.PI * 1.95, 104).map((g, i) => (
      <circle key={i} cx={g.x} cy={g.y - 10} r={g.s + 6} fill="#2a211a" stroke={TINTA} strokeWidth={7} />
    ))}
    <ellipse cx={0} cy={-40} rx={118} ry={88} fill="#2a211a" />
  </g>
);

const RambutDepan: React.FC = () => (
  <g>
    {/* Poni keriting di dahi. */}
    {[-62, -34, -6, 22, 50].map((x, i) => (
      <circle key={i} cx={x} cy={-74 + (i % 2) * 8} r={24} fill="#2a211a" stroke={TINTA} strokeWidth={6} />
    ))}
    <path d="M -84 -40 Q -50 -70 0 -66 Q 50 -70 84 -40" fill="#2a211a" />
  </g>
);

const Pakaian: React.FC = () => (
  <g>
    {/* Motif flanel: kotak-kotak zaitun di atas krem (badan sudah krem, tambah garis zaitun). */}
    <defs>
      <pattern id="flanel" width="44" height="44" patternUnits="userSpaceOnUse">
        <rect width="44" height="44" fill={KRIM} />
        <rect x="0" y="0" width="22" height="44" fill={ZAITUN} opacity={0.55} />
        <rect x="0" y="0" width="44" height="22" fill={ZAITUN} opacity={0.55} />
        <rect x="0" y="0" width="22" height="22" fill={ZAITUN_GELAP} opacity={0.5} />
      </pattern>
      <clipPath id="badanSampul">
        <path d="M 102 310 Q 102 270 150 268 L 290 268 Q 338 270 338 310 L 352 600 L 88 600 Z" />
      </clipPath>
    </defs>
    <rect x={88} y={260} width={264} height={340} fill="url(#flanel)" clipPath="url(#badanSampul)" />
    {/* Kerah dan kancing. */}
    <path d="M 176 268 L 220 316 L 264 268" fill="none" stroke={TINTA} strokeWidth={7} strokeLinejoin="round" />
    <path d="M 176 268 L 220 316 L 264 268 L 240 262 L 220 290 L 200 262 Z" fill={KRIM} stroke={TINTA} strokeWidth={6} strokeLinejoin="round" />
    {[340, 390, 440, 490].map((y) => (
      <circle key={y} cx={220} cy={y} r={6} fill={TINTA} />
    ))}
  </g>
);

export const MAS_SAMPUL: Desain = {
  nama: 'Mas Sampul',
  kulit: '#c98e64',
  kulitGelap: '#a8714d',
  rambut: '#2a211a',
  baju: KRIM,
  bajuGelap: ZAITUN,
  lebarBadan: 1.22,
  kepala: 1.08,
  kelopak: 1,
  RambutBelakang,
  RambutDepan,
  Pakaian,
  kursi: '#5a3a1c',
  hp: '#b5473c',
  lengan: '#a9b99c',
};
