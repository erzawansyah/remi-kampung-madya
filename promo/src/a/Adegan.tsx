// Adegan 2D Teaser A: ketiga tokoh di meja Kedai Madya sepanjang video, digerakkan lintasan keyframe (animasi.ts)
// sesuai storyboard brief A §4, plus kamera virtual (push-in, glide, burst, shake, dutch) dan proyeksi panggung →
// layar untuk balon kata. Semua fungsi murni dari frame. Gaya main kartu tokoh tidak pernah digambarkan: yang
// dianimasikan hanya sifat di luar meja (sombong, kalem ngopi, tukang ledek).
import type { ReactNode } from 'react';
import { AbsoluteFill, useCurrentFrame } from 'remotion';
import { tawa, trek, trekEkspresi, trekPose, type Kunci } from './animasi';
import { halus, shake } from './efek';
import { BENDA, Kedai, KURSI } from './MejaKedai';
import { TokohDiKursi } from './Panggung';
import { BANG_IT } from './tokoh/BangIT';
import { CAK_OWNER } from './tokoh/CakOwner';
import { MAS_SAMPUL } from './tokoh/MasSampul';
import { kedipDi, napasDi, pose, POSE_DASAR, type Ekspresi, type Pose } from './tokoh/rig';
import { H, M, T, W } from './waktu';

// ---------------------------------------------------------------------------------------------
// Kamera virtual: pusat (x, y) di panggung, skala, rotasi; (x, y) selalu jatuh di tengah layar.
// ---------------------------------------------------------------------------------------------
export interface PoseKamera {
  x: number;
  y: number;
  skala: number;
  rot: number;
}

const K_X: Kunci<number>[] = [
  [M.burstWajah, BENDA.hpBang.x],
  [M.burstWajah + 10, 566, 'burst'],
  [T.rewind[0], 566],
  [T.datang[0], 540, 'tajam'],
  [112, 556],
  [T.qr[0], 556],
  [T.qr[0] + 26, 790],
  [T.buang[0], 790],
  [T.buang[0] + 22, 566],
  [T.pungut[0], 566],
  [T.pungut[0] + 22, 300],
  [T.tegang[0], 300],
  [T.tegang[0] + 30, 540],
  [M.terpental, 540],
  [M.terpental + 1, 566, 'tajam'],
  [M.terpental + 10, 566],
  [M.terpental + 24, 470],
  [T.ledek[0] - 20, 470],
  [T.ledek[0] + 10, 660],
  [M.tolehDatar, 660],
  [M.tolehDatar + 20, 566],
  [M.montaseA, 566, 'tajam'],
  [M.montaseB, 566, 'tajam'],
  [M.montaseC, 566, 'tajam'],
  [T.tutup[0], 566],
  [T.tutup[0] + 44, 640],
  [1200, 640],
];
const K_Y: Kunci<number>[] = [
  [M.burstWajah, BENDA.hpBang.y],
  [M.burstWajah + 10, 905, 'burst'],
  [T.rewind[0], 905],
  [T.datang[0], 1060, 'tajam'],
  [112, 1040],
  [T.qr[0], 1040],
  [T.qr[0] + 26, 1240],
  [T.buang[0], 1240],
  [T.buang[0] + 22, 990],
  [T.pungut[0], 990],
  [T.pungut[0] + 22, 1020],
  [T.tegang[0], 1020],
  [T.tegang[0] + 30, 1090],
  [M.terpental, 1090],
  [M.terpental + 1, 990, 'tajam'],
  [M.terpental + 10, 990],
  [M.terpental + 24, 1030],
  [T.ledek[0] - 20, 1030],
  [T.ledek[0] + 10, 980],
  [M.tolehDatar, 980],
  [M.tolehDatar + 20, 920],
  [M.montaseA, 980, 'tajam'],
  [M.montaseB, 900, 'tajam'],
  [M.montaseC, 960, 'tajam'],
  [T.tutup[0], 960],
  [T.tutup[0] + 44, 1110],
  [1200, 1110],
];
const K_S: Kunci<number>[] = [
  [M.burstWajah, 3.0],
  [M.burstWajah + 10, 1.75, 'burst'],
  [T.rewind[0], 1.86, 'linear'],
  [T.datang[0], 1.0, 'tajam'],
  [112, 1.06, 'linear'],
  [T.qr[0], 1.1, 'linear'],
  [T.qr[0] + 26, 1.32],
  [T.buang[0], 1.4, 'linear'],
  [T.buang[0] + 22, 1.55],
  [M.tolehKamera, 1.62, 'linear'],
  [M.tolehKamera + 8, 1.7, 'burst'],
  [T.pungut[0], 1.74, 'linear'],
  [T.pungut[0] + 22, 1.55],
  [T.tegang[0], 1.62, 'linear'],
  [T.tegang[0] + 30, 1.22],
  [M.terpental, 1.46, 'linear'],
  [M.terpental + 1, 1.5, 'tajam'],
  [M.terpental + 10, 1.52, 'linear'],
  [M.terpental + 24, 1.12],
  [T.ledek[0] - 20, 1.18, 'linear'],
  [T.ledek[0] + 10, 1.38],
  [M.tolehDatar, 1.46, 'linear'],
  [M.tolehDatar + 20, 1.78],
  [M.montaseA, 1.55, 'tajam'],
  [M.montaseB - 1, 1.66, 'linear'],
  [M.montaseB, 1.85, 'tajam'],
  [M.montaseC - 1, 1.95, 'linear'],
  [M.montaseC, 1.6, 'tajam'],
  [T.tutup[0], 1.7, 'linear'],
  [T.tutup[0] + 44, 1.05],
  [T.stempel[0], 1.08, 'linear'],
  [1200, 1.1, 'linear'],
];
const K_R: Kunci<number>[] = [
  [T.tegang[0], 0],
  [T.tegang[0] + 50, 4],
  [M.terpental, 4],
  [M.terpental + 1, 0, 'tajam'],
];

/** Pose kamera di frame f, termasuk guncangan hantaman (adegan 7, gebrak, stempel). */
export function kameraDi(f: number): PoseKamera {
  const g1 = shake(f, M.terpental, 26, 7);
  const g2 = shake(f, M.gebrak, 16, 6);
  const g3 = shake(f, M.stempelKena, 18, 7);
  const g4 = shake(f, 926, 10, 5);
  const g5 = shake(f, 950, 8, 5);
  const s = trek(f, K_S);
  return {
    x: trek(f, K_X) + (g1.x + g2.x + g3.x + g4.x + g5.x) / s,
    y: trek(f, K_Y) + (g1.y + g2.y + g3.y + g4.y + g5.y) / s,
    skala: s,
    rot: trek(f, K_R) + g1.rot + g2.rot + g3.rot,
  };
}

/** Proyeksi titik panggung ke layar untuk pose kamera. */
export function proyeksi(k: PoseKamera, x: number, y: number): { x: number; y: number } {
  const r = (k.rot * Math.PI) / 180;
  const dx = x - k.x;
  const dy = y - k.y;
  return { x: W / 2 + k.skala * (dx * Math.cos(r) - dy * Math.sin(r)), y: H / 2 + k.skala * (dx * Math.sin(r) + dy * Math.cos(r)) };
}

export const KameraA: React.FC<{ k: PoseKamera; children?: ReactNode }> = ({ k, children }) => (
  <AbsoluteFill style={{ overflow: 'hidden' }}>
    <AbsoluteFill style={{ transform: `translate(${W / 2}px, ${H / 2}px) scale(${k.skala}) rotate(${k.rot}deg) translate(${-k.x}px, ${-k.y}px)`, transformOrigin: '0 0' }}>{children}</AbsoluteFill>
  </AbsoluteFill>
);

// ---------------------------------------------------------------------------------------------
// Titik-titik lokal tiap tokoh untuk benda di meja (dihitung dari BENDA dan KURSI).
// ---------------------------------------------------------------------------------------------
const lokal = (kursi: { x: number; y: number; skala: number }, bx: number, by: number) => ({ x: (bx - kursi.x) / kursi.skala + 220, y: 600 - (kursi.y - by) / kursi.skala });
const L_HP_BANG = lokal(KURSI.bang, BENDA.hpBang.x, BENDA.hpBang.y);
const L_CANGKIR_BANG = lokal(KURSI.bang, BENDA.cangkirBang.x, BENDA.cangkirBang.y);
const L_HP_OWNER = lokal(KURSI.owner, BENDA.hpOwner.x, BENDA.hpOwner.y);
const L_CANGKIR_OWNER = lokal(KURSI.owner, BENDA.cangkirOwner.x, BENDA.cangkirOwner.y);
/** Titik di depan wajah Bang IT dalam koordinat lokal Mas Sampul (untuk menyodorkan HP). */
const L_WAJAH_BANG_DARI_SAMPUL = lokal(KURSI.sampul, KURSI.bang.x + 80, 905);

// ---------------------------------------------------------------------------------------------
// Bang IT
// ---------------------------------------------------------------------------------------------
const bangKaget = pose({ badanY: -6, bahu: -12, kepalaRot: 2, lihat: { x: 0, y: 0.55 }, kiri: { siku: { x: 30, y: 430 }, tangan: { x: 150, y: 575 }, isi: 'telapak' }, kanan: { siku: { x: 420, y: 430 }, tangan: { x: 300, y: 575 }, isi: 'telapak' } });
const bangJalan = pose({ badanRot: 0, kepalaRot: 2, lihat: { x: -0.5, y: 0.1 }, kiri: { siku: { x: 70, y: 450 }, tangan: { x: 130, y: 520 }, isi: 'kosong' }, kanan: { siku: { x: 390, y: 430 }, tangan: { x: 330, y: 330 }, isi: 'cangkir', rot: -6 } });
const bangTaruhCangkir = pose({ badanRot: 2, badanY: 4, kepalaRot: 4, lihat: { x: 0.3, y: 0.5 }, kiri: { siku: { x: 50, y: 450 }, tangan: { x: 140, y: 520 }, isi: 'kosong' }, kanan: { siku: { x: 410, y: 460 }, tangan: L_CANGKIR_BANG, isi: 'cangkir', rot: 0 } });
const bangSombong = pose({ badanRot: -4, badanY: 10, kepalaRot: -7, lihat: { x: -0.35, y: 0.05 }, kiri: { siku: { x: 10, y: 420 }, tangan: { x: 110, y: 505 }, isi: 'kosong' }, kanan: { siku: { x: 440, y: 420 }, tangan: { x: 335, y: 505 }, isi: 'kosong' } });
const bangJariTinggi = pose({ badanRot: -2, badanY: 4, kepalaRot: -10, lihat: { x: 0.55, y: -0.65 }, kiri: { siku: { x: 10, y: 420 }, tangan: { x: 110, y: 505 }, isi: 'kosong' }, kanan: { siku: { x: 420, y: 300 }, tangan: { x: 340, y: 130 }, isi: 'tunjuk', rot: 8 } });
const bangJariAntisipasi = pose({ ...bangJariTinggi, badanY: -4, kanan: { siku: { x: 430, y: 280 }, tangan: { x: 350, y: 96 }, isi: 'tunjuk', rot: 12 } });
const bangKetuk = pose({ badanRot: 2, badanY: 14, kepalaRot: 6, lihat: { x: 0.05, y: 0.7 }, kiri: { siku: { x: 10, y: 420 }, tangan: { x: 110, y: 505 }, isi: 'kosong' }, kanan: { siku: { x: 410, y: 470 }, tangan: { x: L_HP_BANG.x + 10, y: L_HP_BANG.y - 20 }, isi: 'tunjuk', rot: 178 } });
const bangTolehKamera = pose({ badanRot: -3, badanY: 8, kepalaRot: 5, lihat: { x: 0, y: 0.12 }, kiri: { siku: { x: 10, y: 420 }, tangan: { x: 110, y: 505 }, isi: 'kosong' }, kanan: { siku: { x: 420, y: 430 }, tangan: { x: 320, y: 500 }, isi: 'kosong' } });
const bangCondong = pose({ badanRot: 0, badanY: -14, kepalaY: 14, kepalaRot: 0, lihat: { x: 0, y: 0.6 }, kiri: { siku: { x: 30, y: 430 }, tangan: { x: 140, y: 560 }, isi: 'kepal' }, kanan: { siku: { x: 410, y: 430 }, tangan: { x: 300, y: 560 }, isi: 'kepal' } });
const bangAntisipasiJatuh = pose({ ...bangCondong, badanY: 6, kepalaY: 22, bahu: -8 });
const bangTerpental = pose({ badanRot: -6, badanY: -26, bahu: -16, kepalaRot: -16, kepalaY: -10, lihat: { x: 0, y: -0.4 }, kiri: { siku: { x: -40, y: 300 }, tangan: { x: -70, y: 160 }, isi: 'telapak', rot: -30 }, kanan: { siku: { x: 480, y: 300 }, tangan: { x: 500, y: 150 }, isi: 'telapak', rot: 30 } });
const bangMendarat = pose({ ...bangTerpental, badanY: -8, bahu: -6, kepalaRot: -10, kepalaY: 0, kiri: { siku: { x: -50, y: 360 }, tangan: { x: -60, y: 250 }, isi: 'telapak', rot: -40 }, kanan: { siku: { x: 490, y: 360 }, tangan: { x: 500, y: 240 }, isi: 'telapak', rot: 40 } });
const bangDatar = pose({ badanRot: 0, badanY: 2, kepalaRot: 0, lihat: { x: 0.9, y: 0.1 }, kiri: { siku: { x: 40, y: 440 }, tangan: { x: 150, y: 520 }, isi: 'kosong' }, kanan: { siku: { x: 400, y: 440 }, tangan: { x: 290, y: 520 }, isi: 'kosong' } });
const bangDatarKamera = pose({ ...bangDatar, kepalaRot: 3, lihat: { x: 0, y: 0.15 } });
const bangKesal = pose({ badanRot: 0, badanY: -6, kepalaRot: -3, lihat: { x: 0.2, y: 0.5 }, kiri: { siku: { x: 30, y: 430 }, tangan: { x: 150, y: 560 }, isi: 'kepal' }, kanan: { siku: { x: 410, y: 460 }, tangan: { x: L_HP_BANG.x + 10, y: L_HP_BANG.y - 20 }, isi: 'tunjuk', rot: 178 } });
const bangTerlonjak = pose({ ...bangKesal, badanY: -24, bahu: -14, kepalaY: -6 });
const bangMerem = pose({ ...bangKesal, badanY: -2, kepalaRot: 4, kiri: { siku: { x: 30, y: 430 }, tangan: { x: 150, y: 560 }, isi: 'kepal' }, kanan: { siku: { x: 410, y: 440 }, tangan: { x: 300, y: 555 }, isi: 'kepal' } });
const bangPasrah = pose({ badanRot: 0, badanY: 14, bahu: 12, kepalaRot: 5, kepalaY: 6, lihat: { x: 0.1, y: 0.3 }, kiri: { siku: { x: 40, y: 450 }, tangan: { x: 150, y: 560 }, isi: 'kosong' }, kanan: { siku: { x: 420, y: 470 }, tangan: L_CANGKIR_BANG, isi: 'cangkir', rot: 0 } });
const bangSeruput = pose({ ...bangPasrah, kepalaRot: 2, lihat: { x: 0.3, y: 0.45 }, kanan: { siku: { x: 400, y: 380 }, tangan: { x: 258, y: 232 }, isi: 'cangkir', rot: -12 } });
const bangLihatGelas = pose({ ...bangSeruput, kepalaRot: 6, lihat: { x: 0.6, y: 0.6 }, kanan: { siku: { x: 410, y: 400 }, tangan: { x: 290, y: 262 }, isi: 'cangkir', rot: -4 } });
const bangTertawa = pose({ badanRot: -2, badanY: 4, kepalaRot: -5, lihat: { x: 0, y: 0 }, kiri: { siku: { x: 30, y: 430 }, tangan: { x: 150, y: 540 }, isi: 'telapak' }, kanan: { siku: { x: 420, y: 470 }, tangan: L_CANGKIR_BANG, isi: 'cangkir', rot: 0 } });
const bangTertawaLepas = pose({ ...bangTertawa, kanan: { siku: { x: 420, y: 440 }, tangan: { x: 300, y: 540 }, isi: 'telapak' } });
const bangLirikStempel = pose({ ...bangTertawaLepas, badanY: 2, kepalaRot: 0, lihat: { x: -0.1, y: 0.75 } });
const bangLirikKamera = pose({ ...bangTertawaLepas, badanY: 2, kepalaRot: 6, lihat: { x: 0, y: 0.1 } });

const BANG_POSE: Kunci<Pose>[] = [
  [0, bangKaget],
  [T.datang[0], bangJalan, 'tajam'],
  [M.bangDuduk, bangJalan],
  [M.bangDuduk + 8, bangTaruhCangkir, 'pegas'],
  [M.bangDuduk + 12, bangTaruhCangkir],
  [M.balonAman + 2, bangSombong, 'pegas'],
  [M.angkatJari, bangSombong],
  [M.angkatJari + 20, bangJariTinggi, 'pegas'],
  [M.ketukHp - 6, bangJariTinggi],
  [M.ketukHp - 1, bangJariAntisipasi],
  [M.ketukHp + 3, bangKetuk, 'burst'],
  [M.tolehKamera, bangKetuk],
  [M.tolehKamera + 12, bangTolehKamera, 'pegas'],
  [T.pungut[0], bangTolehKamera],
  [T.pungut[0] + 14, bangSombong],
  [T.tegang[0], bangSombong],
  [T.tegang[0] + 50, bangCondong],
  [M.retak + 8, bangCondong],
  [M.terpental - 1, bangAntisipasiJatuh, 'masuk'],
  [M.terpental + 6, bangTerpental, 'burst'],
  [M.mendarat, bangMendarat, 'burst'],
  [M.mendarat + 40, bangMendarat],
  [M.mendarat + 70, bangDatar, 'pegas'],
  [M.tolehDatar, bangDatar],
  [M.tolehDatar + 18, bangDatarKamera],
  [M.montaseA, bangKesal, 'tajam'],
  [M.montaseA + 25, bangKesal],
  [M.montaseA + 28, bangTerlonjak, 'burst'],
  [M.montaseA + 36, bangKesal, 'pegas'],
  [M.montaseB, bangMerem, 'tajam'],
  [M.montaseB + 9, bangMerem],
  [M.montaseB + 12, pose({ ...bangMerem, badanY: -14, bahu: -8 }), 'burst'],
  [M.montaseB + 22, bangMerem, 'pegas'],
  [M.montaseC, bangPasrah, 'tajam'],
  [M.montaseC + 4, bangPasrah],
  [M.montaseC + 18, bangSeruput],
  [M.krakGelas, bangSeruput],
  [M.krakGelas + 10, bangLihatGelas, 'pegas'],
  [T.tutup[0], bangLihatGelas],
  [T.tutup[0] + 20, bangTertawa],
  [T.tutup[0] + 50, bangTertawaLepas],
  [M.stempelKena, bangTertawaLepas],
  [M.lirikStempel, bangLirikStempel, 'burst'],
  [M.lirikKamera, bangLirikStempel],
  [M.lirikKamera + 12, bangLirikKamera],
];
const BANG_EKSPRESI: [number, Ekspresi][] = [
  [0, 'kaget'],
  [T.datang[0], 'sombong'],
  [M.ketukHp + 3, 'sombong'],
  [T.tegang[0] + 40, 'datar'],
  [M.retak + 2, 'kaget'],
  [M.mendarat + 70, 'malu'],
  [M.tolehDatar, 'datar'],
  [M.montaseA, 'kesal'],
  [M.montaseA + 28, 'kaget'],
  [M.montaseA + 38, 'kesal'],
  [M.montaseB, 'merem'],
  [M.montaseC, 'pasrah'],
  [M.krakGelas + 8, 'kaget'],
  [T.tutup[0] + 20, 'girang'],
  [T.tutup[0] + 44, 'tertawa'],
  [M.stempelKena + 4, 'datar'],
];

// ---------------------------------------------------------------------------------------------
// Cak Owner
// ---------------------------------------------------------------------------------------------
const ownerSantai = pose({ badanRot: 2, kepalaRot: -4, lihat: { x: 0.3, y: 0.25 }, kiri: { siku: { x: 70, y: 440 }, tangan: { x: 150, y: 535 }, isi: 'kosong' }, kanan: { siku: { x: 400, y: 410 }, tangan: { x: 300, y: 300 }, isi: 'cangkir', rot: -6 } });
const ownerSeruput = pose({ ...ownerSantai, kepalaRot: -1, lihat: { x: 0.2, y: 0.4 }, kanan: { siku: { x: 390, y: 380 }, tangan: { x: 252, y: 238 }, isi: 'cangkir', rot: -14 } });
const ownerKetukTanpaLihat = pose({ ...ownerSeruput, kepalaRot: 7, lihat: { x: 0.7, y: 0.2 }, kiri: { siku: { x: 50, y: 470 }, tangan: { x: L_HP_OWNER.x + 8, y: L_HP_OWNER.y - 18 }, isi: 'tunjuk', rot: 178 } });
const ownerCondong = pose({ ...ownerSantai, badanRot: 3, badanY: -8, kepalaY: 8, lihat: { x: 0.35, y: 0.5 }, kanan: { siku: { x: 400, y: 420 }, tangan: { x: 300, y: 320 }, isi: 'cangkir', rot: -6 } });
const ownerTaruhCangkir = pose({ ...ownerCondong, lihat: { x: 0.4, y: 0.6 }, kanan: { siku: { x: 410, y: 480 }, tangan: L_CANGKIR_OWNER, isi: 'cangkir', rot: 0 } });
const ownerTanganLepas = pose({ ...ownerTaruhCangkir, kanan: { siku: { x: 400, y: 460 }, tangan: { x: 300, y: 560 }, isi: 'kosong' } });
const ownerKetukNutup = pose({ ...ownerTanganLepas, kepalaRot: -2, lihat: { x: 0.3, y: 0.45 }, kiri: { siku: { x: 50, y: 470 }, tangan: { x: L_HP_OWNER.x + 8, y: L_HP_OWNER.y - 18 }, isi: 'tunjuk', rot: 178 } });
const ownerSesudah = pose({ ...ownerTanganLepas, badanY: 0, kepalaY: 0, kepalaRot: -5, lihat: { x: 0.5, y: 0.1 }, kiri: { siku: { x: 70, y: 440 }, tangan: { x: 150, y: 535 }, isi: 'kosong' } });
const ownerAmbilCangkir = pose({ ...ownerSesudah, kanan: { siku: { x: 410, y: 480 }, tangan: L_CANGKIR_OWNER, isi: 'cangkir', rot: 0 } });
const ownerTertawa = pose({ ...ownerSantai, badanRot: 0, kepalaRot: -8, lihat: { x: 0, y: 0 }, kanan: { siku: { x: 400, y: 400 }, tangan: { x: 300, y: 290 }, isi: 'cangkir', rot: -6 } });
const ownerAngkatCangkir = pose({ ...ownerTertawa, kepalaRot: -6, kanan: { siku: { x: 410, y: 360 }, tangan: { x: 330, y: 300 }, isi: 'cangkir', rot: -22 } });

const OWNER_POSE: Kunci<Pose>[] = [
  [0, ownerTertawa],
  [T.datang[0], ownerSantai, 'tajam'],
  [128, ownerSantai],
  [142, ownerSeruput],
  [160, ownerSeruput],
  [176, ownerSantai],
  [M.seruput - 4, ownerSantai],
  [M.seruput + 10, ownerSeruput],
  [M.ketukOwner - 6, ownerSeruput],
  [M.ketukOwner + 2, ownerKetukTanpaLihat, 'burst'],
  [M.ketukOwner + 16, ownerKetukTanpaLihat],
  [M.ketukOwner + 34, ownerSeruput],
  [T.tegang[0], ownerSeruput],
  [T.tegang[0] + 50, ownerCondong],
  [M.letakCangkir - 14, ownerCondong],
  [M.letakCangkir, ownerTaruhCangkir],
  [M.letakCangkir + 2, ownerTaruhCangkir],
  [M.letakCangkir + 16, ownerTanganLepas],
  [M.ketukNutup - 1, ownerTanganLepas],
  [M.ketukNutup + 2, ownerKetukNutup, 'burst'],
  [M.ketukNutup + 20, ownerKetukNutup],
  [M.ketukNutup + 40, ownerSesudah],
  [M.mendarat + 30, ownerSesudah],
  [M.mendarat + 50, ownerAmbilCangkir],
  [M.mendarat + 54, ownerAmbilCangkir],
  [M.mendarat + 76, ownerSantai],
  [T.tutup[0], ownerSantai],
  [T.tutup[0] + 24, ownerTertawa],
  [T.tutup[0] + 44, ownerTertawa],
  [T.tutup[0] + 62, ownerAngkatCangkir, 'pegas'],
  [1200, ownerAngkatCangkir],
];
const OWNER_EKSPRESI: [number, Ekspresi][] = [
  [0, 'tertawa'],
  [T.datang[0], 'datar'],
  [M.mendarat + 4, 'girang'],
  [M.mendarat + 60, 'datar'],
  [T.tutup[0] + 24, 'tertawa'],
  [M.stempelKena + 6, 'girang'],
];

// ---------------------------------------------------------------------------------------------
// Mas Sampul
// ---------------------------------------------------------------------------------------------
const sampulMainHp = pose({ badanRot: -2, kepalaRot: 7, lihat: { x: 0.45, y: 0.6 }, kiri: { siku: { x: 40, y: 440 }, tangan: { x: 130, y: 540 }, isi: 'kosong' }, kanan: { siku: { x: 400, y: 440 }, tangan: { x: 330, y: 380 }, isi: 'hp', rot: 10 } });
const sampulArahkanQr = pose({ badanRot: 4, badanY: -4, kepalaRot: 12, kepalaY: 6, lihat: { x: 0.3, y: 0.85 }, kiri: { siku: { x: 40, y: 440 }, tangan: { x: 130, y: 540 }, isi: 'kosong' }, kanan: { siku: { x: 400, y: 500 }, tangan: { x: 215, y: 650 }, isi: 'hp', rot: -40 } });
const sampulLihatBang = pose({ ...sampulMainHp, kepalaRot: -6, lihat: { x: -0.85, y: 0.1 } });
const sampulCondong = pose({ ...sampulMainHp, badanRot: -5, badanY: -10, kepalaY: 8, kepalaRot: -4, lihat: { x: -0.5, y: 0.55 }, kanan: { siku: { x: 400, y: 440 }, tangan: { x: 300, y: 500 }, isi: 'hp', rot: 60 } });
const sampulAngkatTangan = pose({ ...sampulCondong, badanY: -16, kepalaRot: -10, lihat: { x: -0.8, y: 0 }, kiri: { siku: { x: 10, y: 360 }, tangan: { x: 90, y: 260 }, isi: 'telapak', rot: -20 } });
const sampulGebrak = pose({ ...sampulCondong, badanRot: -3, badanY: 4, kepalaRot: -8, kepalaY: 6, lihat: { x: -0.8, y: 0.2 }, kiri: { siku: { x: 30, y: 470 }, tangan: { x: 120, y: 585 }, isi: 'telapak', rot: 0 } });
const sampulTertawa = pose({ ...sampulGebrak, badanY: 0, kepalaRot: -6, kiri: { siku: { x: 40, y: 450 }, tangan: { x: 130, y: 560 }, isi: 'telapak', rot: 0 }, kanan: { siku: { x: 400, y: 440 }, tangan: { x: 320, y: 420 }, isi: 'hp', rot: 20 } });
const sampulSodorHp = pose({ ...sampulTertawa, badanRot: -9, badanY: -4, kepalaRot: -12, lihat: { x: -0.9, y: 0.1 }, kiri: { siku: { x: 30, y: 320 }, tangan: L_WAJAH_BANG_DARI_SAMPUL, isi: 'hp', rot: -80 }, kanan: { siku: { x: 400, y: 440 }, tangan: { x: 300, y: 540 }, isi: 'telapak', rot: 0 } });
const sampulSantai = pose({ ...sampulMainHp, kepalaRot: -3, lihat: { x: -0.6, y: 0.2 }, kanan: { siku: { x: 400, y: 440 }, tangan: { x: 320, y: 440 }, isi: 'hp', rot: 20 } });
const sampulTertawaTutup = pose({ ...sampulTertawa, badanRot: -2, kepalaRot: -9, lihat: { x: 0, y: 0 } });
const sampulLihatStempel = pose({ ...sampulTertawaTutup, kepalaRot: -3, lihat: { x: -0.4, y: 0.4 } });

const SAMPUL_POSE: Kunci<Pose>[] = [
  [0, sampulTertawa],
  [T.datang[0], sampulMainHp, 'tajam'],
  [T.qr[0], sampulMainHp],
  [T.qr[0] + 16, sampulArahkanQr, 'pegas'],
  [M.qrLobi - 6, sampulArahkanQr],
  [M.qrLobi + 12, sampulMainHp, 'pegas'],
  [M.tolehKamera, sampulMainHp],
  [M.tolehKamera + 14, sampulLihatBang],
  [T.tegang[0], sampulLihatBang],
  [T.tegang[0] + 50, sampulCondong],
  [M.retak + 20, sampulCondong],
  [M.gebrak - 8, sampulAngkatTangan, 'pegas'],
  [M.gebrak - 2, sampulAngkatTangan],
  [M.gebrak, sampulGebrak, 'burst'],
  [M.gebrak + 14, sampulGebrak],
  [M.gebrak + 30, sampulTertawa],
  [M.sodorHp, sampulTertawa],
  [M.sodorHp + 10, sampulSodorHp, 'burst'],
  [T.ledek[1] - 24, sampulSodorHp],
  [T.ledek[1] - 4, sampulSantai],
  [M.montaseC + 20, sampulSantai],
  [M.krakGelas + 6, sampulAngkatTangan],
  [M.krakGelas + 10, sampulGebrak, 'burst'],
  [T.tutup[0], sampulGebrak],
  [T.tutup[0] + 24, sampulTertawaTutup],
  [M.stempelKena + 6, sampulTertawaTutup],
  [M.stempelKena + 18, sampulLihatStempel],
];
const SAMPUL_EKSPRESI: [number, Ekspresi][] = [
  [0, 'tertawa'],
  [T.datang[0], 'datar'],
  [T.qr[0] + 16, 'girang'],
  [M.tolehKamera + 14, 'datar'],
  [M.retak + 4, 'kaget'],
  [M.gebrak - 8, 'tertawa'],
  [M.montaseA, 'girang'],
  [M.montaseA + 30, 'tertawa'],
  [M.montaseB, 'girang'],
  [M.montaseB + 14, 'tertawa'],
  [M.montaseC, 'girang'],
  [M.krakGelas + 6, 'tertawa'],
  [M.stempelKena + 6, 'kaget'],
  [M.stempelKena + 18, 'girang'],
];

// ---------------------------------------------------------------------------------------------
// Keadaan turunan per frame (dipakai Adegan dan untuk menempatkan balon).
// ---------------------------------------------------------------------------------------------
export interface KeadaanBang {
  geserX: number;
  geserY: number;
  rot: number;
  sx: number;
  sy: number;
  pose: Pose;
  ekspresi: Ekspresi;
  ayun: number;
  retakCangkir: number;
}

export function keadaanBang(f: number): KeadaanBang {
  // Datang dari kanan: berdiri (lebih tinggi) lalu duduk di kursinya, dengan ayunan langkah.
  const jalan = trek(f, [
    [T.datang[0], 1],
    [M.bangDuduk, 0, 'halus'],
  ]);
  const berdiri = trek(f, [
    [M.bangDuduk, 1],
    [M.bangDuduk + 8, 0, 'pegas'],
  ]);
  const langkah = jalan > 0 && jalan < 1 ? Math.abs(Math.sin((f - T.datang[0]) * 0.45)) * 14 : 0;
  const geserX = f < T.datang[0] ? 0 : jalan * 620;
  const geserY = f < T.datang[0] ? 0 : -berdiri * 110 - langkah * jalan;
  // Terpental ke belakang bersama kursi (rotasi berporos titik duduk), squash saat mendarat, bangkit lagi.
  const rot = trek(f, [
    [M.terpental, 0],
    [M.terpental + 6, -34, 'burst'],
    [M.mendarat, -46, 'burst'],
    [M.mendarat + 6, -42, 'pegas'],
    [M.mendarat + 40, -42],
    [M.mendarat + 70, 0, 'pegas'],
  ]);
  const squash = trek(f, [
    [M.terpental - 1, 0],
    [M.terpental, 0.06, 'burst'],
    [M.terpental + 6, -0.12, 'burst'],
    [M.mendarat, 0.2, 'burst'],
    [M.mendarat + 10, 0, 'pegas'],
    [M.mendarat + 70, 0],
    [M.mendarat + 76, 0.06, 'burst'],
    [M.mendarat + 86, 0, 'pegas'],
  ]);
  const lonjak = trek(f, [
    [M.montaseA + 27, 0],
    [M.montaseA + 29, 0.1, 'burst'],
    [M.montaseA + 36, 0, 'pegas'],
    [M.montaseB + 11, 0],
    [M.montaseB + 13, 0.07, 'burst'],
    [M.montaseB + 20, 0, 'pegas'],
  ]);
  const s = squash + lonjak;
  const sx = 1 + s;
  const sy = 1 - s;
  const p = trekPose(f, BANG_POSE);
  const ayun = (trek(f - 2, [
    [M.terpental, 0],
    [M.terpental + 6, -34, 'burst'],
    [M.mendarat, -46, 'burst'],
    [M.mendarat + 6, -42, 'pegas'],
  ]) - rot) * 0.8;
  const tawaTutup = tawa(f, T.tutup[0] + 44, M.stempelKena, 5);
  const gemetar = f < T.datang[0] ? Math.sin(f * 2.1) * 1.2 : 0;
  return {
    geserX,
    geserY: geserY + tawaTutup + gemetar,
    rot,
    sx,
    sy,
    pose: p,
    ekspresi: trekEkspresi(f, BANG_EKSPRESI),
    ayun,
    retakCangkir: trek(f, [
      [M.krakGelas, 0],
      [M.krakGelas + 7, 1, 'burst'],
    ]),
  };
}

export function keadaanOwner(f: number): { pose: Pose; ekspresi: Ekspresi; geserY: number } {
  const t0 = tawa(f, 0, T.datang[0], 5) + tawa(f, T.tutup[0] + 24, M.stempelKena, 4);
  return { pose: trekPose(f, OWNER_POSE), ekspresi: trekEkspresi(f, OWNER_EKSPRESI), geserY: t0 };
}

export function keadaanSampul(f: number): { pose: Pose; ekspresi: Ekspresi; geserY: number; sx: number; sy: number } {
  const t0 = tawa(f, 0, T.datang[0], 7) + tawa(f, M.gebrak + 2, T.ledek[0] + 10, 6) + tawa(f, M.montaseA + 30, M.montaseB, 5) + tawa(f, M.montaseB + 14, M.montaseC, 5) + tawa(f, M.krakGelas + 12, M.stempelKena, 6);
  const gebrak = trek(f, [
    [M.gebrak - 1, 0],
    [M.gebrak, 0.1, 'burst'],
    [M.gebrak + 8, 0, 'pegas'],
    [M.krakGelas + 9, 0],
    [M.krakGelas + 10, 0.08, 'burst'],
    [M.krakGelas + 18, 0, 'pegas'],
  ]);
  return { pose: trekPose(f, SAMPUL_POSE), ekspresi: trekEkspresi(f, SAMPUL_EKSPRESI), geserY: t0, sx: 1 + gebrak, sy: 1 - gebrak };
}

/** Cahaya: 0..1 meredup kebiruan (adegan 6–7) dan 0..1 keemasan (penutup). */
export const cahayaDi = (f: number) => ({
  dingin: trek(f, [
    [T.tegang[0], 0],
    [T.tegang[0] + 50, 0.85],
    [M.retak, 0.95, 'linear'],
    [M.retak + 2, 0.7, 'burst'],
    [M.gebrak + 20, 0.25],
    [T.ledek[0] + 20, 0],
  ]),
  hangat: trek(f, [
    [T.tutup[0], 0],
    [T.tutup[0] + 40, 1],
  ]),
});

/** Kartu melompat saat meja digebrak. */
const lompatDi = (f: number): number =>
  trek(f, [
    [M.gebrak, 0],
    [M.gebrak + 4, 1, 'burst'],
    [M.gebrak + 14, 0, 'halus'],
    [M.krakGelas + 10, 0],
    [M.krakGelas + 13, 0.6, 'burst'],
    [M.krakGelas + 22, 0],
  ]);

/** Titik mulut tokoh di panggung (untuk ekor balon). */
export function mulutDi(f: number, siapa: 'bang' | 'owner' | 'sampul'): { x: number; y: number } {
  if (siapa === 'bang') {
    const b = keadaanBang(f);
    const k = KURSI.bang;
    return { x: k.x + b.geserX + (b.pose.kepalaX + b.pose.badanX) * k.skala, y: k.y + b.geserY - (600 - 170 - 44) * k.skala + (b.pose.kepalaY + b.pose.badanY) * k.skala };
  }
  const k = siapa === 'owner' ? KURSI.owner : KURSI.sampul;
  const p = siapa === 'owner' ? keadaanOwner(f).pose : keadaanSampul(f).pose;
  return { x: k.x + (p.kepalaX + p.badanX) * k.skala, y: k.y - (600 - 170 - 44) * k.skala + (p.kepalaY + p.badanY) * k.skala };
}

/** Panggung 2D lengkap untuk frame kini (digambar di dalam KameraA oleh TeaserA). */
export const Adegan: React.FC = () => {
  const f = useCurrentFrame();
  const b = keadaanBang(f);
  const o = keadaanOwner(f);
  const s = keadaanSampul(f);
  const cahaya = cahayaDi(f);
  const bangPegangCangkir = b.pose.kanan.isi === 'cangkir';
  const ownerPegangCangkir = o.pose.kanan.isi === 'cangkir';
  const kursiKosong = f >= T.datang[0] && f < M.bangDuduk + 4;
  const lapis = (lapisan: 'badan' | 'lengan') => (
    <>
      <TokohDiKursi kursi={KURSI.owner} desain={CAK_OWNER} ekspresi={o.ekspresi} kedip={kedipDi(f, 2)} napas={napasDi(f, 2)} pose={o.pose} geserY={o.geserY} lapisan={lapisan} />
      <TokohDiKursi kursi={KURSI.sampul} desain={MAS_SAMPUL} ekspresi={s.ekspresi} kedip={kedipDi(f, 3)} napas={napasDi(f, 3)} pose={s.pose} geserY={s.geserY} sx={s.sx} sy={s.sy} lapisan={lapisan} />
      {kursiKosong && lapisan === 'badan' && <TokohDiKursi kursi={KURSI.bang} desain={BANG_IT} ekspresi="datar" kedip={0} napas={0} pose={POSE_DASAR} hanyaKursi />}
      {(
        <TokohDiKursi
          kursi={KURSI.bang}
          desain={BANG_IT}
          ekspresi={b.ekspresi}
          kedip={kedipDi(f, 1)}
          napas={napasDi(f, 1)}
          pose={b.pose}
          geserX={b.geserX}
          geserY={b.geserY}
          rot={b.rot}
          sx={b.sx}
          sy={b.sy}
          ayun={b.ayun}
          lapisan={lapisan}
          retakCangkir={b.retakCangkir}
          pakaiKursi={f >= M.bangDuduk + 4 || f < T.datang[0]}
        />
      )}
    </>
  );
  return (
    <Kedai
      hangat={cahaya.hangat}
      dingin={cahaya.dingin}
      lompatKartu={lompatDi(f)}
      glowQr={trek(f, [
        [T.qr[0], 0],
        [T.qr[0] + 12, 1],
        [M.qrBeranda, 1],
        [M.qrBeranda + 10, 0],
        [T.tutup[0] + 20, 0],
        [T.tutup[0] + 40, 0.9],
      ])}
      tampilCangkirBang={!bangPegangCangkir && f >= M.bangDuduk + 12}
      tampilCangkirOwner={!ownerPegangCangkir}
      retakCangkirBang={b.retakCangkir}
      tokoh={lapis('badan')}
      diMeja={lapis('lengan')}
    />
  );
};

export { halus };
