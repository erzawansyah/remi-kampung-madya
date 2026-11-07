// Bang IT, Si Sombong (brief A §3): tinggi, bahu lebar, rambut jabrik ke atas, hoodie toska dengan tudung turun,
// alis tebal, duduk melebar sambil bersandar. Desain umum, bukan tiruan orang mana pun.
import { TINTA, type Desain } from './rig';

const TOSKA = '#1f8a9e';
const TOSKA_GELAP = '#176b7b';

const RambutDepan: React.FC = () => (
  <g>
    {/* Jabrik ke atas: deretan paku runcing dari pelipis ke pelipis. */}
    <path
      d="M -84 -30 L -92 -78 L -62 -56 L -58 -112 L -30 -70 L -12 -130 L 6 -74 L 30 -124 L 36 -70 L 66 -104 L 58 -56 L 90 -72 L 80 -24 Q 60 -50 0 -52 Q -60 -50 -84 -30 Z"
      fill="#1d1a16"
      stroke={TINTA}
      strokeWidth={7}
      strokeLinejoin="round"
    />
    <path d="M -70 -42 Q -30 -62 10 -58" fill="none" stroke="#4b443b" strokeWidth={5} strokeLinecap="round" opacity={0.8} />
  </g>
);

const Pakaian: React.FC = () => (
  <g>
    {/* Tudung turun: tumpukan kain di bahu/leher. */}
    <path d="M 120 300 Q 220 236 320 300 Q 290 268 220 268 Q 150 268 120 300 Z" fill={TOSKA_GELAP} stroke={TINTA} strokeWidth={7} strokeLinejoin="round" />
    <path d="M 116 318 Q 220 364 324 318 Q 300 352 220 356 Q 140 352 116 318 Z" fill={TOSKA_GELAP} stroke={TINTA} strokeWidth={7} strokeLinejoin="round" />
    {/* Tali tudung dan saku depan. */}
    <path d="M 206 356 L 200 440" fill="none" stroke="#fbf6ea" strokeWidth={6} strokeLinecap="round" />
    <path d="M 234 356 L 240 440" fill="none" stroke="#fbf6ea" strokeWidth={6} strokeLinecap="round" />
    <path d="M 140 520 L 160 480 L 280 480 L 300 520 L 300 600 L 140 600 Z" fill={TOSKA_GELAP} stroke={TINTA} strokeWidth={6} strokeLinejoin="round" opacity={0.9} />
  </g>
);

export const BANG_IT: Desain = {
  nama: 'Bang IT',
  kulit: '#c98e64',
  kulitGelap: '#a8714d',
  rambut: '#1d1a16',
  baju: TOSKA,
  bajuGelap: TOSKA_GELAP,
  lebarBadan: 1.16,
  kepala: 1.02,
  kelopak: 1,
  RambutDepan,
  Pakaian,
  kursi: '#5a3a1c',
};
