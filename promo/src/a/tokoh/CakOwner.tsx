// Cak Owner, Si Kalem (brief A §3): sedang, rambut pendek rapi, kumis tipis, celemek arang dengan saku, selalu
// memegang cangkir kopi, mata setengah tertutup (santai). Desain umum, bukan tiruan orang mana pun.
import { TINTA, type Desain } from './rig';

const RambutDepan: React.FC = () => (
  <g>
    {/* Rambut pendek rapi: topi rambut dengan belahan samping. */}
    <path d="M -86 -22 Q -88 -96 -10 -98 Q 86 -100 86 -24 Q 70 -46 30 -54 Q -10 -62 -50 -46 Q -78 -36 -86 -22 Z" fill="#2a211a" stroke={TINTA} strokeWidth={7} strokeLinejoin="round" />
    <path d="M -40 -60 Q 0 -80 50 -62" fill="none" stroke="#5a4a3a" strokeWidth={5} strokeLinecap="round" opacity={0.8} />
  </g>
);

const Wajah: React.FC = () => (
  // Kumis tipis di atas mulut.
  <path d="M -26 32 Q -14 24 -2 32 M 2 32 Q 14 24 26 32" fill="none" stroke={TINTA} strokeWidth={6} strokeLinecap="round" />
);

const Pakaian: React.FC = () => (
  <g>
    {/* Celemek arang dengan tali leher dan saku dada. */}
    <path d="M 150 420 L 162 330 Q 220 316 278 330 L 290 420 L 300 600 L 140 600 Z" fill="#1d1a16" stroke={TINTA} strokeWidth={7} strokeLinejoin="round" />
    <path d="M 168 332 Q 220 280 272 332" fill="none" stroke="#1d1a16" strokeWidth={12} strokeLinecap="round" />
    <rect x={190} y={420} width={60} height={56} rx={8} fill="#2b2620" stroke="#3a342c" strokeWidth={4} />
    <path d="M 200 430 L 210 466" fill="none" stroke="#f1a615" strokeWidth={6} strokeLinecap="round" />
    {/* Highlight tipis supaya celemek tidak menyatu dengan garis tinta. */}
    <path d="M 164 345 L 158 430" fill="none" stroke="#3a342c" strokeWidth={5} strokeLinecap="round" />
  </g>
);

export const CAK_OWNER: Desain = {
  nama: 'Cak Owner',
  kulit: '#e0b48e',
  kulitGelap: '#c3926d',
  rambut: '#2a211a',
  baju: '#fbf6ea',
  bajuGelap: '#e9e1cf',
  lenganPendek: true,
  lebarBadan: 1,
  kepala: 1,
  kelopak: 0.6,
  RambutDepan,
  Wajah,
  Pakaian,
  kursi: '#5a3a1c',
};
