// Still "lineup" (brief A §7 langkah 3): ketiga tokoh di meja kedai, Bang IT `sombong`, Cak Owner `datar`
// (menyeruput kopi), Mas Sampul `tertawa`. Dipakai untuk memeriksa tampilan tokoh sebelum menyusun adegan.
import { AbsoluteFill, useCurrentFrame } from 'remotion';
import { FONT, WARNA } from '../bagian';
import { Kedai, KURSI } from './MejaKedai';
import { TokohDiKursi } from './Panggung';
import { BANG_IT } from './tokoh/BangIT';
import { CAK_OWNER } from './tokoh/CakOwner';
import { MAS_SAMPUL } from './tokoh/MasSampul';
import { kedipDi, napasDi, pose } from './tokoh/rig';

export const Lineup: React.FC = () => {
  const f = useCurrentFrame();
  return (
    <AbsoluteFill>
      <Kedai
        hangat={0.15}
        dingin={0}
        layarHpBang={null}
        layarHpOwner={null}
        layarHpSampul={null}
        tokoh={
          <>
            <TokohDiKursi
              kursi={KURSI.owner}
              desain={CAK_OWNER}
              ekspresi="datar"
              kedip={kedipDi(f, 2)}
              napas={napasDi(f, 2)}
              pose={pose({ kepalaRot: -4, lihat: { x: 0.3, y: 0.2 }, kiri: { siku: { x: 70, y: 430 }, tangan: { x: 160, y: 500 }, isi: 'kosong' }, kanan: { siku: { x: 400, y: 400 }, tangan: { x: 300, y: 250 }, isi: 'cangkir', rot: -8 } })}
            />
            <TokohDiKursi
              kursi={KURSI.sampul}
              desain={MAS_SAMPUL}
              ekspresi="tertawa"
              kedip={0}
              napas={napasDi(f, 3)}
              pose={pose({ kepalaRot: 8, badanRot: 3, kiri: { siku: { x: 40, y: 430 }, tangan: { x: 120, y: 470 }, isi: 'telapak' }, kanan: { siku: { x: 400, y: 440 }, tangan: { x: 330, y: 380 }, isi: 'hp', rot: 10 } })}
            />
            <TokohDiKursi
              kursi={KURSI.bang}
              desain={BANG_IT}
              ekspresi="sombong"
              kedip={kedipDi(f, 1)}
              napas={napasDi(f, 1)}
              pose={pose({ badanRot: -3, badanY: 10, kepalaRot: -6, lihat: { x: -0.4, y: 0 }, kiri: { siku: { x: 20, y: 420 }, tangan: { x: 110, y: 500 }, isi: 'kosong' }, kanan: { siku: { x: 430, y: 420 }, tangan: { x: 330, y: 500 }, isi: 'kosong' } })}
            />
          </>
        }
      />
      <div style={{ position: 'absolute', left: 0, right: 0, top: 120, textAlign: 'center', fontFamily: FONT, fontWeight: 700, fontSize: 40, color: WARNA.krem, opacity: 0.85 }}>
        Cak Owner · Bang IT · Mas Sampul
      </div>
    </AbsoluteFill>
  );
};
