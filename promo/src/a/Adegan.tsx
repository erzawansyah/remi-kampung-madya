// Adegan 2D Teaser A: tiga tokoh duduk melingkar di meja Kedai Madya (Bang IT di seberang menghadap kamera,
// Cak Owner di kiri menghadap kanan, Mas Sampul di kanan menghadap kiri), digerakkan lintasan keyframe (animasi.ts)
// sesuai storyboard brief A §4. Kamera virtual sinematik: close-up wajah bergantian (Bang IT → Cak Owner → Mas
// Sampul), glide, cut, burst, shake, dutch. Kedalaman lewat tiga lapisan paralaks (latar, meja, depan) yang
// bergerak dengan kecepatan berbeda saat kamera bergerak. Gaya main kartu tokoh tidak pernah digambarkan.
import type { ReactNode } from 'react';
import { AbsoluteFill, useCurrentFrame } from 'remotion';
import { tawa, trek, trekEkspresi, trekPose, type Kunci } from './animasi';
import { halus, shake } from './efek';
import { BENDA, KURSI, Latar, Meja } from './MejaKedai';
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

/** Titik wajah tiap tokoh di panggung (pusat kepala). */
const WAJAH = {
  bang: { x: 540, y: 866 },
  owner: { x: 170, y: 950 },
  sampul: { x: 910, y: 950 },
};
/** Tangan Cak Owner di HP-nya (untuk shot tangan mengetuk). */
const TANGAN_OWNER = { x: 300, y: 1235 };

type Shot = [frame: number, x: number, y: number, skala: number, ease?: 'halus' | 'burst' | 'tajam' | 'linear' | 'pegas' | 'masuk'];
/** Naskah kamera: satu daftar shot (frame, pusat x, pusat y, skala, ease ke shot itu). */
const NASKAH: Shot[] = [
  // Cold open: burst dari layar ke wajah Bang IT yang membeku.
  [M.burstWajah, WAJAH.bang.x, WAJAH.bang.y + 40, 3.6],
  [M.burstWajah + 10, WAJAH.bang.x, WAJAH.bang.y + 20, 2.7, 'burst'],
  [T.rewind[0], WAJAH.bang.x, WAJAH.bang.y + 20, 2.85, 'linear'],
  // Adegan 2: meja sepi (wide), Bang IT datang, glide ke medium saat ia duduk.
  [T.datang[0], 540, 1180, 1.0, 'tajam'],
  [M.bangDuduk - 4, 540, 1170, 1.05, 'linear'],
  [M.balonAman + 6, 560, 1010, 1.5],
  [T.qr[0], 560, 1000, 1.58, 'linear'],
  // Adegan 3: close-up Mas Sampul menunduk ke HP, lalu mundur sedikit memperlihatkan papan QR.
  [T.qr[0] + 16, WAJAH.sampul.x - 60, WAJAH.sampul.y + 40, 2.3],
  [M.qrBeranda, WAJAH.sampul.x - 60, WAJAH.sampul.y + 50, 2.42, 'linear'],
  [M.qrBeranda + 16, 760, 1180, 1.6],
  [T.buang[0], 760, 1180, 1.68, 'linear'],
  // Adegan 4: close-up Bang IT (wajah di kiri layar, sisipan di kanan), punch saat menoleh ke kamera.
  [T.buang[0] + 16, WAJAH.bang.x + 110, WAJAH.bang.y + 30, 2.3],
  [M.ketukHp, WAJAH.bang.x + 110, WAJAH.bang.y + 40, 2.4, 'linear'],
  [M.ketukHp + 6, WAJAH.bang.x + 110, WAJAH.bang.y + 60, 2.2, 'burst'],
  [M.tolehKamera, WAJAH.bang.x + 110, WAJAH.bang.y + 50, 2.26, 'linear'],
  [M.tolehKamera + 8, WAJAH.bang.x + 90, WAJAH.bang.y + 30, 2.7, 'burst'],
  [T.pungut[0], WAJAH.bang.x + 90, WAJAH.bang.y + 30, 2.8, 'linear'],
  // Adegan 5: whip ke close-up Cak Owner menyeruput (wajah di kiri, sisipan di kanan), cut ke tangannya mengetuk.
  [T.pungut[0] + 14, WAJAH.owner.x + 120, WAJAH.owner.y + 30, 2.4],
  [M.ketukOwner - 4, WAJAH.owner.x + 120, WAJAH.owner.y + 30, 2.5, 'linear'],
  [M.ketukOwner - 3, TANGAN_OWNER.x + 60, TANGAN_OWNER.y - 30, 2.6, 'tajam'],
  [M.ketukOwner + 20, TANGAN_OWNER.x + 60, TANGAN_OWNER.y - 30, 2.75, 'linear'],
  [M.ketukOwner + 21, WAJAH.owner.x + 120, WAJAH.owner.y + 30, 2.4, 'tajam'],
  [T.tegang[0], WAJAH.owner.x + 120, WAJAH.owner.y + 30, 2.55, 'linear'],
  // Adegan 6: wide tegang dengan dutch, lalu close-up bergantian: Cak Owner tersenyum tipis, Mas Sampul nyengir,
  // Bang IT cemas, lalu tangan Cak Owner yang akan mengetuk.
  [T.tegang[0] + 1, 540, 1200, 1.25, 'tajam'],
  [600, 540, 1180, 1.42, 'linear'],
  [601, WAJAH.owner.x + 20, WAJAH.owner.y + 10, 2.9, 'tajam'],
  [624, WAJAH.owner.x + 20, WAJAH.owner.y + 10, 3.05, 'linear'],
  [625, WAJAH.sampul.x - 20, WAJAH.sampul.y + 10, 2.9, 'tajam'],
  [648, WAJAH.sampul.x - 20, WAJAH.sampul.y + 10, 3.05, 'linear'],
  [649, WAJAH.bang.x, WAJAH.bang.y + 20, 3.0, 'tajam'],
  [M.heningMulai, WAJAH.bang.x, WAJAH.bang.y + 20, 3.2, 'linear'],
  [M.heningMulai + 1, TANGAN_OWNER.x + 40, TANGAN_OWNER.y - 20, 2.8, 'tajam'],
  [M.retak, TANGAN_OWNER.x + 40, TANGAN_OWNER.y - 20, 2.95, 'linear'],
  // Adegan 7: sisipan retak, lalu cut wide untuk Bang IT terpental dan Mas Sampul menggebrak.
  [M.terpental, TANGAN_OWNER.x + 40, TANGAN_OWNER.y - 20, 2.95],
  [M.terpental + 1, 540, 1150, 1.3, 'tajam'],
  [M.gebrak + 30, 560, 1180, 1.4, 'linear'],
  // Adegan 8: glide ke close-up Mas Sampul nyengir menyodorkan HP, cut ke close-up Bang IT datar menoleh ke kamera.
  [T.ledek[0] + 14, WAJAH.sampul.x - 90, WAJAH.sampul.y + 30, 2.2],
  [M.tolehDatar - 1, WAJAH.sampul.x - 90, WAJAH.sampul.y + 30, 2.35, 'linear'],
  [M.tolehDatar, WAJAH.bang.x, WAJAH.bang.y + 30, 2.5, 'tajam'],
  [M.tolehDatar + 20, WAJAH.bang.x, WAJAH.bang.y + 20, 2.9, 'burst'],
  [T.montase[0], WAJAH.bang.x, WAJAH.bang.y + 20, 2.95, 'linear'],
  // Adegan 9: montase tiga potongan (medium → close → medium dengan cangkir).
  [M.montaseA, WAJAH.bang.x + 90, WAJAH.bang.y + 90, 1.9, 'tajam'],
  [M.montaseB - 1, WAJAH.bang.x + 90, WAJAH.bang.y + 90, 2.05, 'linear'],
  [M.montaseB, WAJAH.bang.x, WAJAH.bang.y + 10, 2.8, 'tajam'],
  [M.montaseC - 1, WAJAH.bang.x, WAJAH.bang.y + 10, 3.0, 'linear'],
  [M.montaseC, WAJAH.bang.x + 40, WAJAH.bang.y + 80, 2.1, 'tajam'],
  [T.tutup[0], WAJAH.bang.x + 40, WAJAH.bang.y + 80, 2.25, 'linear'],
  // Adegan 10–11: tarik mundur keemasan, lalu hold dengan push pelan.
  [T.tutup[0] + 44, 540, 1075, 1.04],
  [T.stempel[0], 540, 1075, 1.07, 'linear'],
  [1200, 540, 1075, 1.09, 'linear'],
];
const K_X: Kunci<number>[] = NASKAH.map(([f, x, , , e]) => [f, x, e]);
const K_Y: Kunci<number>[] = NASKAH.map(([f, , y, , e]) => [f, y, e]);
const K_S: Kunci<number>[] = NASKAH.map(([f, , , s, e]) => [f, s, e]);
const K_R: Kunci<number>[] = [
  [T.tegang[0], 0],
  [T.tegang[0] + 50, 4],
  [600, 4],
  [601, 0, 'tajam'],
];

/** Pose kamera di frame f, termasuk guncangan hantaman (adegan 7, gebrak, stempel). */
export function kameraDi(f: number): PoseKamera {
  const g1 = shake(f, M.terpental, 26, 7);
  const g2 = shake(f, M.gebrak, 16, 6);
  const g3 = shake(f, M.stempelKena, 18, 7);
  const g4 = shake(f, M.montaseA + 28, 10, 5);
  const g5 = shake(f, M.montaseB + 12, 8, 5);
  const s = trek(f, K_S);
  return {
    x: trek(f, K_X) + (g1.x + g2.x + g3.x + g4.x + g5.x) / s,
    y: trek(f, K_Y) + (g1.y + g2.y + g3.y + g4.y + g5.y) / s,
    skala: s,
    rot: trek(f, K_R) + g1.rot + g2.rot + g3.rot,
  };
}

/** Kamera untuk lapisan paralaks: `dalam` < 1 bergerak lebih sedikit (latar), > 1 lebih banyak (depan). */
export function kameraLapisan(k: PoseKamera, dalam: number): PoseKamera {
  return { x: W / 2 + (k.x - W / 2) * dalam, y: H / 2 + (k.y - H / 2) * dalam, skala: 1 + (k.skala - 1) * dalam, rot: k.rot * dalam };
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
// Titik lokal tiap tokoh untuk benda di meja.
// ---------------------------------------------------------------------------------------------
const lokal = (kursi: { x: number; y: number; skala: number }, bx: number, by: number) => ({ x: (bx - kursi.x) / kursi.skala + 220, y: 600 - (kursi.y - by) / kursi.skala });
const L_CANGKIR_BANG = lokal(KURSI.bang, BENDA.cangkirBang.x, BENDA.cangkirBang.y);
const L_HP_OWNER = lokal(KURSI.owner, BENDA.hpOwner.x, BENDA.hpOwner.y);
const L_CANGKIR_OWNER = lokal(KURSI.owner, BENDA.cangkirOwner.x, BENDA.cangkirOwner.y);
/** Titik di depan wajah Bang IT dalam koordinat lokal Mas Sampul (menyodorkan HP). */
const L_WAJAH_BANG_DARI_SAMPUL = lokal(KURSI.sampul, WAJAH.bang.x + 150, WAJAH.bang.y + 90);

// ---------------------------------------------------------------------------------------------
// Bang IT (menghadap kamera; menoleh ke kiri/kanan ke teman-temannya).
// ---------------------------------------------------------------------------------------------
const B = (ubah: Parameters<typeof pose>[0]) => pose({ hadapBadan: 0, ...ubah });
const bangKaget = B({ badanY: -6, bahu: -12, kepalaY: 0, tunduk: 0.2, hadap: 0, lihat: { x: 0, y: 0.1 } });
const bangJalan = B({ kepalaY: 0, kepalaRot: 2, tunduk: 0, hadap: -0.5, lihat: { x: -0.3, y: 0.1 }, kiri: { tangan: { x: 150, y: 500 }, isi: 'hp' }, kanan: { tangan: { x: 320, y: 380 }, isi: 'cangkir' } });
const bangTaruhCangkir = B({ badanRot: 2, kepalaY: 4, kepalaRot: 4, tunduk: 0.5, hadap: 0.3, lihat: { x: 0.3, y: 0.5 }, kiri: { tangan: { x: 160, y: 470 }, isi: 'hp' }, kanan: { tangan: L_CANGKIR_BANG, isi: 'cangkir' } });
const bangSombong = B({ badanRot: -4, badanY: 10, kepalaY: 0, kepalaRot: -7, tunduk: 0, hadap: -0.45, lihat: { x: -0.2, y: 0.05 }, kiri: { tangan: { x: 130, y: 470 }, isi: 'kosong' }, kanan: { tangan: { x: 320, y: 420 }, isi: 'hp', rot: 6 } });
const bangLihatHp = B({ badanRot: -2, badanY: 6, kepalaRot: -3, tunduk: 0.6, hadap: 0, lihat: { x: 0, y: 0.9 }, kiri: { tangan: { x: 150, y: 470 }, isi: 'kosong' }, kanan: { tangan: { x: 300, y: 430 }, isi: 'hp', rot: 6 } });
const bangJariTinggi = B({ badanRot: -2, badanY: 4, kepalaY: -2, kepalaRot: -8, tunduk: 0, hadap: 0.35, lihat: { x: 0.55, y: -0.65 }, kiri: { tangan: { x: 175, y: 450 }, isi: 'hp' }, kanan: { tangan: { x: 292, y: 96 }, isi: 'tunjuk', arahJari: -80 } });
const bangJariAntisipasi = B({ ...bangJariTinggi, badanY: -4, kanan: { tangan: { x: 300, y: 70 }, isi: 'tunjuk', arahJari: -80 } });
const bangKetuk = B({ badanRot: 2, badanY: 12, kepalaY: 14, kepalaRot: 4, tunduk: 0.75, hadap: 0, lihat: { x: -0.1, y: 0.9 }, kiri: { tangan: { x: 185, y: 455 }, isi: 'hp' }, kanan: { tangan: { x: 222, y: 360 }, isi: 'tunjuk', arahJari: 120 } });
const bangTolehKamera = B({ badanRot: -3, badanY: 8, kepalaY: 0, kepalaRot: 5, tunduk: 0, hadap: 0, lihat: { x: 0, y: 0.12 }, kiri: { tangan: { x: 170, y: 455 }, isi: 'hp' }, kanan: { tangan: { x: 300, y: 480 }, isi: 'kosong' } });
const bangCondong = B({ badanY: -14, kepalaY: 18, tunduk: 0.7, hadap: 0, lihat: { x: 0, y: 0.95 } });
const bangCemas = B({ ...bangCondong, tunduk: 0.35, hadap: -0.25, lihat: { x: -0.5, y: 0.6 } });
const bangAntisipasiJatuh = B({ ...bangCondong, badanY: 6, kepalaY: 24, bahu: -8 });
const bangTerpental = B({ badanRot: -6, badanY: -26, bahu: -16, kepalaRot: -16, kepalaY: -10, tunduk: 0, hadap: 0, lihat: { x: 0, y: -0.4 }, kiri: { tangan: { x: 70, y: 170 }, isi: 'telapak' }, kanan: { tangan: { x: 370, y: 170 }, isi: 'telapak' } });
const bangMendarat = B({ ...bangTerpental, badanY: -8, bahu: -6, kepalaRot: -10, kepalaY: 0, kiri: { tangan: { x: 40, y: 260 }, isi: 'telapak' }, kanan: { tangan: { x: 400, y: 260 }, isi: 'telapak' } });
const bangDatar = B({ badanY: 2, kepalaY: 0, tunduk: 0.1, hadap: 0.6, lihat: { x: 0.6, y: 0.1 }, kiri: { tangan: { x: 170, y: 470 }, isi: 'kosong' }, kanan: { tangan: { x: 290, y: 470 }, isi: 'kosong' } });
const bangDatarKamera = B({ ...bangDatar, kepalaRot: 3, hadap: 0, lihat: { x: 0, y: 0.15 } });
const bangKesal = B({ badanY: -6, kepalaY: 16, kepalaRot: -3, tunduk: 0.7, hadap: 0, lihat: { x: 0, y: 0.85 } });
const bangTerlonjak = B({ ...bangKesal, badanY: -24, bahu: -14, kepalaY: 6, tunduk: 0.3 });
const bangMerem = B({ ...bangKesal, badanY: -2, kepalaRot: 4 });
const bangPasrah = B({ badanY: 14, bahu: 12, kepalaRot: 5, kepalaY: 8, tunduk: 0.3, hadap: 0, lihat: { x: 0.1, y: 0.3 }, kiri: { tangan: { x: 165, y: 470 }, isi: 'hp' }, kanan: { tangan: L_CANGKIR_BANG, isi: 'cangkir' } });
const bangSeruput = B({ ...bangPasrah, kepalaRot: 2, lihat: { x: 0.3, y: 0.45 }, kanan: { tangan: { x: 262, y: 262 }, isi: 'cangkir', rot: -10 } });
const bangLihatGelas = B({ ...bangSeruput, kepalaRot: 6, hadap: 0.3, lihat: { x: 0.6, y: 0.6 }, kanan: { tangan: { x: 292, y: 300 }, isi: 'cangkir', rot: -4 } });
const bangTertawa = B({ badanRot: -2, badanY: 4, kepalaY: 0, kepalaRot: -5, tunduk: 0, hadap: 0, lihat: { x: 0, y: 0 }, kiri: { tangan: { x: 155, y: 470 }, isi: 'telapak' }, kanan: { tangan: L_CANGKIR_BANG, isi: 'cangkir' } });
const bangTertawaLepas = B({ ...bangTertawa, kanan: { tangan: { x: 295, y: 470 }, isi: 'telapak' } });
const bangLirikStempel = B({ ...bangTertawaLepas, badanY: 2, kepalaRot: 0, lihat: { x: -0.1, y: 0.75 } });
const bangLirikKamera = B({ ...bangTertawaLepas, badanY: 2, kepalaRot: 6, lihat: { x: 0, y: 0.1 } });

const BANG_POSE: Kunci<Pose>[] = [
  [0, bangKaget],
  [T.datang[0], bangJalan, 'tajam'],
  [M.bangDuduk, bangJalan],
  [M.bangDuduk + 8, bangTaruhCangkir, 'pegas'],
  [M.bangDuduk + 12, bangTaruhCangkir],
  [M.balonAman + 2, bangSombong, 'pegas'],
  [T.qr[0] + 10, bangSombong],
  [T.qr[0] + 30, bangLihatHp],
  [M.angkatJari - 10, bangLihatHp],
  [M.angkatJari + 14, bangJariTinggi, 'pegas'],
  [M.ketukHp - 6, bangJariTinggi],
  [M.ketukHp - 1, bangJariAntisipasi],
  [M.ketukHp + 3, bangKetuk, 'burst'],
  [M.tolehKamera, bangKetuk],
  [M.tolehKamera + 12, bangTolehKamera, 'pegas'],
  [T.pungut[0], bangTolehKamera],
  [T.pungut[0] + 14, bangSombong],
  [T.tegang[0], bangSombong],
  [T.tegang[0] + 50, bangCondong],
  [640, bangCondong],
  [652, bangCemas],
  [M.retak + 8, bangCemas],
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
  [M.montaseB + 12, B({ ...bangMerem, badanY: -14, bahu: -8 }), 'burst'],
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
  [T.qr[0] + 30, 'fokus'],
  [M.angkatJari, 'sombong'],
  [T.tegang[0] + 40, 'fokus'],
  [652, 'datar'],
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
// Cak Owner (di kiri, badan menghadap kanan ke meja; kepala menoleh ke Bang IT, HP, atau cangkir).
// ---------------------------------------------------------------------------------------------
const O = (ubah: Parameters<typeof pose>[0]) => pose({ hadapBadan: KURSI.owner.hadapBadan, hadap: KURSI.owner.hadap, ...ubah });
const ownerSantai = O({ badanRot: 2, kepalaY: 4, kepalaRot: -4, tunduk: 0.3, lihat: { x: 0.5, y: 0.3 }, kiri: { tangan: { x: 250, y: 500 }, isi: 'kosong' }, kanan: { tangan: { x: 330, y: 330 }, isi: 'cangkir' } });
const ownerSeruput = O({ ...ownerSantai, kepalaY: 0, kepalaRot: -1, tunduk: 0.15, hadap: 0.4, lihat: { x: 0.3, y: 0.3 }, kanan: { tangan: { x: 268, y: 252 }, isi: 'cangkir', rot: -12 } });
const ownerKetukTanpaLihat = O({ ...ownerSeruput, kepalaRot: 5, hadap: 0.7, lihat: { x: 0.8, y: 0.1 }, kiri: { tangan: { x: L_HP_OWNER.x - 4, y: L_HP_OWNER.y - 50 }, isi: 'tunjuk', arahJari: 92 } });
const ownerCondong = O({ ...ownerSantai, badanRot: 3, badanY: -8, kepalaY: 12, tunduk: 0.55, hadap: 0.6, lihat: { x: 0.3, y: 0.7 }, kanan: { tangan: { x: 330, y: 350 }, isi: 'cangkir' } });
const ownerSenyumTipis = O({ ...ownerCondong, tunduk: 0.2, hadap: 0.7, lihat: { x: 0.6, y: 0.2 } });
const ownerTaruhCangkir = O({ ...ownerCondong, lihat: { x: 0.4, y: 0.7 }, kanan: { tangan: L_CANGKIR_OWNER, isi: 'cangkir' } });
const ownerTanganLepas = O({ ...ownerTaruhCangkir, kanan: { tangan: { x: 340, y: 470 }, isi: 'kosong' } });
const ownerKetukNutup = O({ ...ownerTanganLepas, kepalaRot: -2, tunduk: 0.6, lihat: { x: 0.2, y: 0.8 }, kiri: { tangan: { x: L_HP_OWNER.x - 4, y: L_HP_OWNER.y - 50 }, isi: 'tunjuk', arahJari: 92 } });
const ownerSesudah = O({ ...ownerTanganLepas, badanY: 0, kepalaY: 0, kepalaRot: -5, tunduk: 0.1, hadap: 0.7, lihat: { x: 0.7, y: 0.1 }, kiri: { tangan: { x: 250, y: 500 }, isi: 'kosong' } });
const ownerAmbilCangkir = O({ ...ownerSesudah, kanan: { tangan: L_CANGKIR_OWNER, isi: 'cangkir' } });
const ownerTertawa = O({ ...ownerSantai, badanRot: 0, kepalaY: 0, kepalaRot: -8, tunduk: 0, hadap: 0.2, lihat: { x: 0, y: 0 }, kanan: { tangan: { x: 330, y: 330 }, isi: 'cangkir' } });
const ownerAngkatCangkir = O({ ...ownerTertawa, kepalaRot: -6, hadap: 0, kanan: { tangan: { x: 360, y: 240 }, isi: 'cangkir', rot: -16 } });

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
  [600, ownerCondong],
  [612, ownerSenyumTipis],
  [M.letakCangkir - 14, ownerSenyumTipis],
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
  [612, 'sombong'],
  [M.ketukNutup - 2, 'datar'],
  [M.mendarat + 4, 'girang'],
  [M.mendarat + 60, 'datar'],
  [T.tutup[0] + 24, 'tertawa'],
  [M.stempelKena + 6, 'girang'],
];

// ---------------------------------------------------------------------------------------------
// Mas Sampul (di kanan, badan menghadap kiri; kepala ke HP, papan QR, atau Bang IT).
// ---------------------------------------------------------------------------------------------
const S = (ubah: Parameters<typeof pose>[0]) => pose({ hadapBadan: KURSI.sampul.hadapBadan, hadap: KURSI.sampul.hadap, ...ubah });
const sampulMainHp = S({ badanRot: -2, kepalaRot: 6, tunduk: 0.65, hadap: -0.3, kiri: { tangan: { x: 130, y: 440 }, isi: 'kosong' }, kanan: { tangan: { x: 200, y: 450 }, isi: 'hpDua' } });
const sampulArahkanQr = S({ badanRot: 4, badanY: -4, kepalaRot: 10, kepalaY: 14, tunduk: 0.7, hadap: -0.5, lihat: { x: -0.4, y: 0.9 }, kiri: { tangan: { x: 110, y: 470 }, isi: 'kosong' }, kanan: { tangan: { x: 150, y: 540 }, isi: 'hp', rot: -30 } });
const sampulLihatBang = S({ ...sampulMainHp, kepalaY: 0, kepalaRot: -6, tunduk: 0.1, hadap: -0.75, lihat: { x: -0.7, y: 0.1 } });
const sampulCondong = S({ badanRot: -5, badanY: -10, kepalaY: 16, kepalaRot: -4, tunduk: 0.6, hadap: -0.4, lihat: { x: -0.3, y: 0.7 }, kiri: { tangan: { x: 130, y: 440 }, isi: 'kosong' }, kanan: { tangan: { x: 200, y: 450 }, isi: 'hpDua' } });
const sampulNyengir = S({ ...sampulCondong, tunduk: 0.2, hadap: -0.7, lihat: { x: -0.7, y: 0.2 } });
const sampulAngkatTangan = S({ ...sampulCondong, badanY: -16, kepalaY: 0, kepalaRot: -10, tunduk: 0, hadap: -0.75, lihat: { x: -0.8, y: 0 }, kiri: { tangan: { x: 60, y: 210 }, isi: 'telapak' }, kanan: { tangan: { x: 300, y: 430 }, isi: 'hp', rot: 10 } });
const sampulGebrak = S({ ...sampulAngkatTangan, badanRot: -3, badanY: 4, kepalaY: 6, kepalaRot: -8, lihat: { x: -0.8, y: 0.2 }, kiri: { tangan: { x: 110, y: 505 }, isi: 'telapak' } });
const sampulTertawa = S({ ...sampulGebrak, badanY: 0, kepalaY: 0, kepalaRot: -6, kiri: { tangan: { x: 120, y: 480 }, isi: 'telapak' }, kanan: { tangan: { x: 300, y: 430 }, isi: 'hp', rot: 10 } });
const sampulSodorHp = S({ ...sampulTertawa, badanRot: -9, badanY: -4, kepalaRot: -12, hadap: -0.8, lihat: { x: -0.9, y: 0.1 }, kiri: { tangan: L_WAJAH_BANG_DARI_SAMPUL, isi: 'hpLayar', rot: -20 }, kanan: { tangan: { x: 290, y: 480 }, isi: 'telapak' } });
const sampulSantai = S({ ...sampulMainHp, kepalaY: 0, kepalaRot: -3, tunduk: 0.2, hadap: -0.6, lihat: { x: -0.5, y: 0.2 }, kiri: { tangan: { x: 120, y: 480 }, isi: 'kosong' }, kanan: { tangan: { x: 300, y: 440 }, isi: 'hp', rot: 10 } });
const sampulTertawaTutup = S({ ...sampulTertawa, badanRot: -2, kepalaRot: -9, hadap: -0.3, lihat: { x: 0, y: 0 } });
const sampulLihatStempel = S({ ...sampulTertawaTutup, kepalaRot: -3, lihat: { x: -0.4, y: 0.4 } });

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
  [622, sampulCondong],
  [634, sampulNyengir],
  [M.retak + 20, sampulNyengir],
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
  [T.datang[0], 'fokus'],
  [T.qr[0] + 16, 'girang'],
  [M.tolehKamera + 14, 'datar'],
  [T.tegang[0] + 40, 'fokus'],
  [634, 'girang'],
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
// Keadaan turunan per frame.
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
  const p = trekPose(f, BANG_POSE);
  const ayun = (trek(f - 2, [
    [M.terpental, 0],
    [M.terpental + 6, -34, 'burst'],
    [M.mendarat, -46, 'burst'],
    [M.mendarat + 6, -42, 'pegas'],
  ]) - rot) * 0.8;
  const tawaTutup = tawa(f, T.tutup[0] + 44, M.stempelKena, 5);
  const gemetar = f < T.datang[0] ? Math.sin(f * 2.1) * 1.2 : 0;
  // Kepala hidup: goyang kecil pelan sepanjang video.
  const goyang = Math.sin(f * 0.07) * 1.5;
  return {
    geserX,
    geserY: geserY + tawaTutup + gemetar,
    rot,
    sx: 1 + s,
    sy: 1 - s,
    pose: { ...p, kepalaRot: p.kepalaRot + goyang },
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
  const p = trekPose(f, OWNER_POSE);
  return { pose: { ...p, kepalaRot: p.kepalaRot + Math.sin(f * 0.05 + 2) * 1.5 }, ekspresi: trekEkspresi(f, OWNER_EKSPRESI), geserY: t0 };
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
  const p = trekPose(f, SAMPUL_POSE);
  return { pose: { ...p, kepalaRot: p.kepalaRot + Math.sin(f * 0.06 + 4) * 1.5 }, ekspresi: trekEkspresi(f, SAMPUL_EKSPRESI), geserY: t0, sx: 1 + gebrak, sy: 1 - gebrak };
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

const lompatDi = (f: number): number =>
  trek(f, [
    [M.gebrak, 0],
    [M.gebrak + 4, 1, 'burst'],
    [M.gebrak + 14, 0, 'halus'],
    [M.krakGelas + 10, 0],
    [M.krakGelas + 13, 0.6, 'burst'],
    [M.krakGelas + 22, 0],
  ]);

/** Titik mulut tokoh di panggung (untuk ekor balon), ikut arah hadap dan tunduk. */
export function mulutDi(f: number, siapa: 'bang' | 'owner' | 'sampul'): { x: number; y: number } {
  const k = siapa === 'bang' ? KURSI.bang : siapa === 'owner' ? KURSI.owner : KURSI.sampul;
  const D = siapa === 'bang' ? BANG_IT : siapa === 'owner' ? CAK_OWNER : MAS_SAMPUL;
  const b = siapa === 'bang' ? keadaanBang(f) : null;
  const p = b ? b.pose : siapa === 'owner' ? keadaanOwner(f).pose : keadaanSampul(f).pose;
  const lx = 220 + p.kepalaX + p.badanX + p.hadapBadan * 14 + (p.hadap * 34) * D.kepala;
  const ly = 170 + p.kepalaY + p.badanY + p.tunduk * 14 + (52 + p.tunduk * 22) * D.kepala;
  return { x: k.x + (b?.geserX ?? 0) + (lx - 220) * k.skala, y: k.y + (b?.geserY ?? 0) - (600 - ly) * k.skala };
}

/** Lapisan tengah (meja + tokoh) untuk frame kini; digambar di dalam KameraA oleh TeaserA. */
export const Adegan: React.FC = () => {
  const f = useCurrentFrame();
  const b = keadaanBang(f);
  const o = keadaanOwner(f);
  const s = keadaanSampul(f);
  const cahaya = cahayaDi(f);
  const kursiKosong = f >= T.datang[0] && f < M.bangDuduk + 4;
  const bang = (lapisan: 'badan' | 'lengan') => (
    <>
      {kursiKosong && lapisan === 'badan' && <TokohDiKursi kursi={KURSI.bang} desain={BANG_IT} ekspresi="datar" kedip={0} napas={0} pose={POSE_DASAR} hanyaKursi />}
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
    </>
  );
  const sisi = (lapisan: 'badan' | 'lengan') => (
    <>
      <TokohDiKursi kursi={KURSI.owner} desain={CAK_OWNER} ekspresi={o.ekspresi} kedip={kedipDi(f, 2)} napas={napasDi(f, 2)} pose={o.pose} geserY={o.geserY} lapisan={lapisan} />
      <TokohDiKursi kursi={KURSI.sampul} desain={MAS_SAMPUL} ekspresi={s.ekspresi} kedip={kedipDi(f, 3)} napas={napasDi(f, 3)} pose={s.pose} geserY={s.geserY} sx={s.sx} sy={s.sy} lapisan={lapisan} />
    </>
  );
  return (
    <Meja
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
      tampilCangkirBang={b.pose.kanan.isi !== 'cangkir' && f >= M.bangDuduk + 12}
      tampilCangkirOwner={o.pose.kanan.isi !== 'cangkir'}
      retakCangkirBang={b.retakCangkir}
      bangBadan={bang('badan')}
      bangLengan={bang('lengan')}
      sisiBadan={sisi('badan')}
      sisiLengan={sisi('lengan')}
    />
  );
};

/** Lapisan latar (paralaks belakang). */
export const AdeganLatar: React.FC = () => <Latar />;

export { halus };
