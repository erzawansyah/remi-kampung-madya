// Kumpulan pose tiap tokoh (koordinat lokal 440 × 600) yang dipakai adegan-adegan Teaser A. Hanya sifat di luar
// meja yang digambarkan (sombong, kalem ngopi, tukang ledek), bukan cara bermain kartu.
import { BENDA, KURSI } from '../MejaKedai';
import { pose, type Pose } from './rig';

/** Titik wajah tiap tokoh di panggung (pusat kepala), untuk kamera. */
export const WAJAH = {
  bang: { x: 540, y: 866 },
  owner: { x: 170, y: 950 },
  sampul: { x: 910, y: 950 },
} as const;
/** Tangan Cak Owner di HP-nya (shot tangan mengetuk). */
export const TANGAN_OWNER = { x: 300, y: 1235 } as const;

const lokal = (kursi: { x: number; y: number; skala: number }, bx: number, by: number) => ({ x: (bx - kursi.x) / kursi.skala + 220, y: 600 - (kursi.y - by) / kursi.skala });
export const L_CANGKIR_BANG = lokal(KURSI.bang, BENDA.cangkirBang.x, BENDA.cangkirBang.y);
export const L_HP_OWNER = lokal(KURSI.owner, BENDA.hpOwner.x, BENDA.hpOwner.y);
export const L_CANGKIR_OWNER = lokal(KURSI.owner, BENDA.cangkirOwner.x, BENDA.cangkirOwner.y);
const L_WAJAH_BANG_DARI_SAMPUL = lokal(KURSI.sampul, WAJAH.bang.x + 150, WAJAH.bang.y + 90);

// ---------------------------------------------------------------------------------------------
// Bang IT (menghadap kamera; menoleh ke kiri/kanan ke teman-temannya).
// ---------------------------------------------------------------------------------------------
const B = (ubah: Parameters<typeof pose>[0]) => pose({ hadapBadan: 0, ...ubah });
export const bang = {
  kaget: B({ badanY: -6, bahu: -12, kepalaY: 0, tunduk: 0.2, hadap: 0, lihat: { x: 0, y: 0.1 } }),
  jalan: B({ kepalaY: 0, kepalaRot: 2, tunduk: 0, hadap: -0.5, lihat: { x: -0.3, y: 0.1 }, kiri: { tangan: { x: 150, y: 500 }, isi: 'hp' }, kanan: { tangan: { x: 320, y: 380 }, isi: 'cangkir' } }),
  taruhCangkir: B({ badanRot: 2, kepalaY: 4, kepalaRot: 4, tunduk: 0.5, hadap: 0.3, lihat: { x: 0.3, y: 0.5 }, kiri: { tangan: { x: 160, y: 470 }, isi: 'hp' }, kanan: { tangan: L_CANGKIR_BANG, isi: 'cangkir' } }),
  sombong: B({ badanRot: -4, badanY: 10, kepalaY: 0, kepalaRot: -7, tunduk: 0, hadap: -0.45, lihat: { x: -0.2, y: 0.05 }, kiri: { tangan: { x: 130, y: 470 }, isi: 'kosong' }, kanan: { tangan: { x: 320, y: 420 }, isi: 'hp', rot: 6 } }),
  lihatHp: B({ badanRot: -2, badanY: 6, kepalaRot: -3, tunduk: 0.6, hadap: 0, lihat: { x: 0, y: 0.9 }, kiri: { tangan: { x: 150, y: 470 }, isi: 'kosong' }, kanan: { tangan: { x: 300, y: 430 }, isi: 'hp', rot: 6 } }),
  jariTinggi: B({ badanRot: -2, badanY: 4, kepalaY: -2, kepalaRot: -8, tunduk: 0, hadap: 0.35, lihat: { x: 0.55, y: -0.65 }, kiri: { tangan: { x: 175, y: 450 }, isi: 'hp' }, kanan: { tangan: { x: 292, y: 96 }, isi: 'tunjuk', arahJari: -80 } }),
  ketuk: B({ badanRot: 2, badanY: 12, kepalaY: 14, kepalaRot: 4, tunduk: 0.75, hadap: 0, lihat: { x: -0.1, y: 0.9 }, kiri: { tangan: { x: 185, y: 455 }, isi: 'hp' }, kanan: { tangan: { x: 222, y: 360 }, isi: 'tunjuk', arahJari: 120 } }),
  tolehKamera: B({ badanRot: -3, badanY: 8, kepalaY: 0, kepalaRot: 5, tunduk: 0, hadap: 0, lihat: { x: 0, y: 0.12 }, kiri: { tangan: { x: 170, y: 455 }, isi: 'hp' }, kanan: { tangan: { x: 300, y: 480 }, isi: 'kosong' } }),
  condong: B({ badanY: -14, kepalaY: 18, tunduk: 0.7, hadap: 0, lihat: { x: 0, y: 0.95 } }),
  cemas: B({ badanY: -14, kepalaY: 18, tunduk: 0.35, hadap: -0.25, lihat: { x: -0.5, y: 0.6 } }),
  terpental: B({ badanRot: -6, badanY: -26, bahu: -16, kepalaRot: -16, kepalaY: -10, tunduk: 0, hadap: 0, lihat: { x: 0, y: -0.4 }, kiri: { tangan: { x: 70, y: 170 }, isi: 'telapak' }, kanan: { tangan: { x: 370, y: 170 }, isi: 'telapak' } }),
  mendarat: B({ badanRot: -6, badanY: -8, bahu: -6, kepalaRot: -10, kepalaY: 0, tunduk: 0, hadap: 0, lihat: { x: 0, y: -0.4 }, kiri: { tangan: { x: 40, y: 260 }, isi: 'telapak' }, kanan: { tangan: { x: 400, y: 260 }, isi: 'telapak' } }),
  datar: B({ badanY: 2, kepalaY: 0, tunduk: 0.1, hadap: 0.6, lihat: { x: 0.6, y: 0.1 }, kiri: { tangan: { x: 170, y: 470 }, isi: 'kosong' }, kanan: { tangan: { x: 290, y: 470 }, isi: 'kosong' } }),
  datarKamera: B({ badanY: 2, kepalaY: 0, kepalaRot: 3, tunduk: 0.1, hadap: 0, lihat: { x: 0, y: 0.15 }, kiri: { tangan: { x: 170, y: 470 }, isi: 'kosong' }, kanan: { tangan: { x: 290, y: 470 }, isi: 'kosong' } }),
  kesal: B({ badanY: -6, kepalaY: 16, kepalaRot: -3, tunduk: 0.7, hadap: 0, lihat: { x: 0, y: 0.85 } }),
  terlonjak: B({ badanY: -24, bahu: -14, kepalaY: 6, kepalaRot: -3, tunduk: 0.3, hadap: 0, lihat: { x: 0, y: 0.85 } }),
  merem: B({ badanY: -2, kepalaY: 16, kepalaRot: 4, tunduk: 0.7, hadap: 0, lihat: { x: 0, y: 0.85 } }),
  pasrah: B({ badanY: 14, bahu: 12, kepalaRot: 5, kepalaY: 8, tunduk: 0.3, hadap: 0, lihat: { x: 0.1, y: 0.3 }, kiri: { tangan: { x: 165, y: 470 }, isi: 'hp' }, kanan: { tangan: L_CANGKIR_BANG, isi: 'cangkir' } }),
  seruput: B({ badanY: 14, bahu: 12, kepalaRot: 2, kepalaY: 8, tunduk: 0.3, hadap: 0, lihat: { x: 0.3, y: 0.45 }, kiri: { tangan: { x: 165, y: 470 }, isi: 'hp' }, kanan: { tangan: { x: 262, y: 262 }, isi: 'cangkir', rot: -10 } }),
  lihatGelas: B({ badanY: 14, bahu: 12, kepalaRot: 6, kepalaY: 8, tunduk: 0.3, hadap: 0.3, lihat: { x: 0.6, y: 0.6 }, kiri: { tangan: { x: 165, y: 470 }, isi: 'hp' }, kanan: { tangan: { x: 292, y: 300 }, isi: 'cangkir', rot: -4 } }),
  tertawa: B({ badanRot: -2, badanY: 4, kepalaY: 0, kepalaRot: -5, tunduk: 0, hadap: 0, lihat: { x: 0, y: 0 }, kiri: { tangan: { x: 155, y: 470 }, isi: 'telapak' }, kanan: { tangan: L_CANGKIR_BANG, isi: 'cangkir' } }),
  tertawaLepas: B({ badanRot: -2, badanY: 4, kepalaY: 0, kepalaRot: -5, tunduk: 0, hadap: 0, lihat: { x: 0, y: 0 }, kiri: { tangan: { x: 155, y: 470 }, isi: 'telapak' }, kanan: { tangan: { x: 295, y: 470 }, isi: 'telapak' } }),
  lirikStempel: B({ badanRot: -2, badanY: 2, kepalaY: 0, kepalaRot: 0, tunduk: 0, hadap: 0, lihat: { x: -0.1, y: 0.75 }, kiri: { tangan: { x: 155, y: 470 }, isi: 'telapak' }, kanan: { tangan: { x: 295, y: 470 }, isi: 'telapak' } }),
  lirikKamera: B({ badanRot: -2, badanY: 2, kepalaY: 0, kepalaRot: 6, tunduk: 0, hadap: 0, lihat: { x: 0, y: 0.1 }, kiri: { tangan: { x: 155, y: 470 }, isi: 'telapak' }, kanan: { tangan: { x: 295, y: 470 }, isi: 'telapak' } }),
} satisfies Record<string, Pose>;

// ---------------------------------------------------------------------------------------------
// Cak Owner (di kiri, badan menghadap kanan ke meja; kepala menoleh ke Bang IT, HP, atau cangkir).
// ---------------------------------------------------------------------------------------------
const O = (ubah: Parameters<typeof pose>[0]) => pose({ hadapBadan: KURSI.owner.hadapBadan, hadap: KURSI.owner.hadap, ...ubah });
const ownerSantai = O({ badanRot: 2, kepalaY: 4, kepalaRot: -4, tunduk: 0.3, lihat: { x: 0.5, y: 0.3 }, kiri: { tangan: { x: 250, y: 500 }, isi: 'kosong' }, kanan: { tangan: { x: 330, y: 330 }, isi: 'cangkir' } });
const ownerCondong = O({ ...ownerSantai, badanRot: 3, badanY: -8, kepalaY: 12, tunduk: 0.55, hadap: 0.6, lihat: { x: 0.3, y: 0.7 }, kanan: { tangan: { x: 330, y: 350 }, isi: 'cangkir' } });
const ownerTaruhCangkir = O({ ...ownerCondong, lihat: { x: 0.4, y: 0.7 }, kanan: { tangan: L_CANGKIR_OWNER, isi: 'cangkir' } });
const ownerTanganLepas = O({ ...ownerTaruhCangkir, kanan: { tangan: { x: 340, y: 470 }, isi: 'kosong' } });
const ownerSesudah = O({ ...ownerTanganLepas, badanY: 0, kepalaY: 0, kepalaRot: -5, tunduk: 0.1, hadap: 0.7, lihat: { x: 0.7, y: 0.1 }, kiri: { tangan: { x: 250, y: 500 }, isi: 'kosong' } });
const ownerTertawa = O({ ...ownerSantai, badanRot: 0, kepalaY: 0, kepalaRot: -8, tunduk: 0, hadap: 0.2, lihat: { x: 0, y: 0 }, kanan: { tangan: { x: 330, y: 330 }, isi: 'cangkir' } });
export const owner = {
  santai: ownerSantai,
  seruput: O({ ...ownerSantai, kepalaY: 0, kepalaRot: -1, tunduk: 0.15, hadap: 0.4, lihat: { x: 0.3, y: 0.3 }, kanan: { tangan: { x: 268, y: 252 }, isi: 'cangkir', rot: -12 } }),
  ketukTanpaLihat: O({ ...ownerSantai, kepalaY: 0, kepalaRot: 5, tunduk: 0.15, hadap: 0.7, lihat: { x: 0.8, y: 0.1 }, kiri: { tangan: { x: L_HP_OWNER.x - 4, y: L_HP_OWNER.y - 50 }, isi: 'tunjuk', arahJari: 92 }, kanan: { tangan: { x: 268, y: 252 }, isi: 'cangkir', rot: -12 } }),
  condong: ownerCondong,
  senyumTipis: O({ ...ownerCondong, tunduk: 0.2, hadap: 0.7, lihat: { x: 0.6, y: 0.2 } }),
  taruhCangkir: ownerTaruhCangkir,
  tanganLepas: ownerTanganLepas,
  ketukNutup: O({ ...ownerTanganLepas, kepalaRot: -2, tunduk: 0.6, lihat: { x: 0.2, y: 0.8 }, kiri: { tangan: { x: L_HP_OWNER.x - 4, y: L_HP_OWNER.y - 50 }, isi: 'tunjuk', arahJari: 92 } }),
  sesudah: ownerSesudah,
  ambilCangkir: O({ ...ownerSesudah, kanan: { tangan: L_CANGKIR_OWNER, isi: 'cangkir' } }),
  tertawa: ownerTertawa,
  angkatCangkir: O({ ...ownerTertawa, kepalaRot: -6, hadap: 0, kanan: { tangan: { x: 360, y: 240 }, isi: 'cangkir', rot: -16 } }),
} satisfies Record<string, Pose>;

// ---------------------------------------------------------------------------------------------
// Mas Sampul (di kanan, badan menghadap kiri; kepala ke HP, papan QR, atau Bang IT).
// ---------------------------------------------------------------------------------------------
const S = (ubah: Parameters<typeof pose>[0]) => pose({ hadapBadan: KURSI.sampul.hadapBadan, hadap: KURSI.sampul.hadap, ...ubah });
const sampulMainHp = S({ badanRot: -2, kepalaRot: 6, tunduk: 0.65, hadap: -0.3, kiri: { tangan: { x: 130, y: 440 }, isi: 'kosong' }, kanan: { tangan: { x: 200, y: 450 }, isi: 'hpDua' } });
const sampulCondong = S({ badanRot: -5, badanY: -10, kepalaY: 16, kepalaRot: -4, tunduk: 0.6, hadap: -0.4, lihat: { x: -0.3, y: 0.7 }, kiri: { tangan: { x: 130, y: 440 }, isi: 'kosong' }, kanan: { tangan: { x: 200, y: 450 }, isi: 'hpDua' } });
const sampulAngkatTangan = S({ ...sampulCondong, badanY: -16, kepalaY: 0, kepalaRot: -10, tunduk: 0, hadap: -0.75, lihat: { x: -0.8, y: 0 }, kiri: { tangan: { x: 60, y: 210 }, isi: 'telapak' }, kanan: { tangan: { x: 300, y: 430 }, isi: 'hp', rot: 10 } });
const sampulGebrak = S({ ...sampulAngkatTangan, badanRot: -3, badanY: 4, kepalaY: 6, kepalaRot: -8, lihat: { x: -0.8, y: 0.2 }, kiri: { tangan: { x: 110, y: 505 }, isi: 'telapak' } });
const sampulTertawa = S({ ...sampulGebrak, badanY: 0, kepalaY: 0, kepalaRot: -6, kiri: { tangan: { x: 120, y: 480 }, isi: 'telapak' }, kanan: { tangan: { x: 300, y: 430 }, isi: 'hp', rot: 10 } });
const sampulTertawaTutup = S({ ...sampulTertawa, badanRot: -2, kepalaRot: -9, hadap: -0.3, lihat: { x: 0, y: 0 } });
export const sampul = {
  mainHp: sampulMainHp,
  arahkanQr: S({ badanRot: 4, badanY: -4, kepalaRot: 10, kepalaY: 14, tunduk: 0.7, hadap: -0.5, lihat: { x: -0.4, y: 0.9 }, kiri: { tangan: { x: 110, y: 470 }, isi: 'kosong' }, kanan: { tangan: { x: 150, y: 540 }, isi: 'hp', rot: -30 } }),
  lihatBang: S({ ...sampulMainHp, kepalaY: 0, kepalaRot: -6, tunduk: 0.1, hadap: -0.75, lihat: { x: -0.7, y: 0.1 } }),
  condong: sampulCondong,
  nyengir: S({ ...sampulCondong, tunduk: 0.2, hadap: -0.7, lihat: { x: -0.7, y: 0.2 } }),
  angkatTangan: sampulAngkatTangan,
  gebrak: sampulGebrak,
  tertawa: sampulTertawa,
  sodorHp: S({ ...sampulTertawa, badanRot: -9, badanY: -4, kepalaRot: -12, hadap: -0.8, lihat: { x: -0.9, y: 0.1 }, kiri: { tangan: L_WAJAH_BANG_DARI_SAMPUL, isi: 'hpLayar', rot: -20 }, kanan: { tangan: { x: 290, y: 480 }, isi: 'telapak' } }),
  santai: S({ ...sampulMainHp, kepalaY: 0, kepalaRot: -3, tunduk: 0.2, hadap: -0.6, lihat: { x: -0.5, y: 0.2 }, kiri: { tangan: { x: 120, y: 480 }, isi: 'kosong' }, kanan: { tangan: { x: 300, y: 440 }, isi: 'hp', rot: 10 } }),
  tertawaTutup: sampulTertawaTutup,
  lihatStempel: S({ ...sampulTertawaTutup, kepalaRot: -3, lihat: { x: -0.4, y: 0.4 } }),
} satisfies Record<string, Pose>;

/** Tokoh hidup terus: goyang kepala pelan, deterministik dari frame global-ish (benih menggeser fase). */
export const hidupkan = (p: Pose, frame: number, benih: number): Pose => ({ ...p, kepalaRot: p.kepalaRot + Math.sin(frame * 0.06 + benih) * 1.5 });
