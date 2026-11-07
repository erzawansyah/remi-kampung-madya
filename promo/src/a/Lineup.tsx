// Still "lineup" (brief A §7 langkah 3): ketiga tokoh di meja kedai, Bang IT `sombong`, Cak Owner `datar`
// (menyeruput kopi), Mas Sampul `tertawa`. Dipakai untuk memeriksa tampilan tokoh sebelum menyusun adegan.
import { AbsoluteFill, useCurrentFrame } from 'remotion';
import { FONT, WARNA } from '../bagian';
import { KURSI, Latar, Meja } from './MejaKedai';
import { TokohDiKursi } from './PanggungTokoh';
import { BANG_IT } from './tokoh/BangIT';
import { CAK_OWNER } from './tokoh/CakOwner';
import { MAS_SAMPUL } from './tokoh/MasSampul';
import { kedipDi, napasDi, pose } from './tokoh/rig';

export const Lineup: React.FC = () => {
  const f = useCurrentFrame();
  return (
    <AbsoluteFill>
      <Latar />
      <Meja
        hangat={0.15}
        dingin={0}
        layarHpOwner={null}
        bangBadan={<TokohDiKursi kursi={KURSI.bang} desain={BANG_IT} ekspresi="sombong" kedip={kedipDi(f, 1)} napas={napasDi(f, 1)} lapisan="badan" pose={pose({ badanRot: -4, badanY: 10, kepalaY: 0, tunduk: 0, hadap: -0.4, kepalaRot: -6, lihat: { x: -0.2, y: 0.1 }, kiri: { tangan: { x: 130, y: 480 }, isi: 'kosong' }, kanan: { tangan: { x: 310, y: 420 }, isi: 'hp', rot: 8 } })} />}
        bangLengan={<TokohDiKursi kursi={KURSI.bang} desain={BANG_IT} ekspresi="sombong" kedip={kedipDi(f, 1)} napas={napasDi(f, 1)} lapisan="lengan" pose={pose({ badanRot: -4, badanY: 10, kepalaY: 0, tunduk: 0, hadap: -0.4, kepalaRot: -6, lihat: { x: -0.2, y: 0.1 }, kiri: { tangan: { x: 130, y: 480 }, isi: 'kosong' }, kanan: { tangan: { x: 310, y: 420 }, isi: 'hp', rot: 8 } })} />}
        sisiBadan={
          <>
            <TokohDiKursi lapisan="badan" kursi={KURSI.owner} desain={CAK_OWNER} ekspresi="datar" kedip={kedipDi(f, 2)} napas={napasDi(f, 2)} pose={pose({ hadapBadan: 0.8, hadap: 0.5, tunduk: 0.2, kepalaRot: -3, lihat: { x: 0.4, y: 0.3 }, kiri: { tangan: { x: 250, y: 500 }, isi: 'kosong' }, kanan: { tangan: { x: 330, y: 330 }, isi: 'cangkir' } })} />
            <TokohDiKursi lapisan="badan" kursi={KURSI.sampul} desain={MAS_SAMPUL} ekspresi="tertawa" kedip={0} napas={napasDi(f, 3)} pose={pose({ hadapBadan: -0.8, hadap: -0.5, tunduk: 0.3, kepalaRot: 6, kiri: { tangan: { x: 130, y: 440 }, isi: 'kosong' }, kanan: { tangan: { x: 200, y: 450 }, isi: 'hpDua' } })} />
          </>
        }
        sisiLengan={
          <>
            <TokohDiKursi lapisan="lengan" kursi={KURSI.owner} desain={CAK_OWNER} ekspresi="datar" kedip={kedipDi(f, 2)} napas={napasDi(f, 2)} pose={pose({ hadapBadan: 0.8, hadap: 0.5, tunduk: 0.2, kepalaRot: -3, lihat: { x: 0.4, y: 0.3 }, kiri: { tangan: { x: 250, y: 500 }, isi: 'kosong' }, kanan: { tangan: { x: 330, y: 330 }, isi: 'cangkir' } })} />
            <TokohDiKursi lapisan="lengan" kursi={KURSI.sampul} desain={MAS_SAMPUL} ekspresi="tertawa" kedip={0} napas={napasDi(f, 3)} pose={pose({ hadapBadan: -0.8, hadap: -0.5, tunduk: 0.3, kepalaRot: 6, kiri: { tangan: { x: 130, y: 440 }, isi: 'kosong' }, kanan: { tangan: { x: 200, y: 450 }, isi: 'hpDua' } })} />
          </>
        }
      />
      <div style={{ position: 'absolute', left: 0, right: 0, top: 120, textAlign: 'center', fontFamily: FONT, fontWeight: 700, fontSize: 40, color: WARNA.krem, opacity: 0.85 }}>
        Cak Owner · Bang IT · Mas Sampul
      </div>
    </AbsoluteFill>
  );
};
