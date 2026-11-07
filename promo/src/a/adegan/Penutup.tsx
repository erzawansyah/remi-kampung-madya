// Adegan 10 (34–38 dtk): tarik mundur keemasan, ketiganya tertawa termasuk Bang IT, Cak Owner mengangkat cangkir
// ke arah kamera, papan QR terlihat jelas, logo Kedai Madya muncul di atas. Teks: "Coba gratis. Link di bio." dan
// "Mau melu grup? DM @kedaimadya". TeksPenutup dipakai juga di adegan stempel supaya tetap tampil.
import { AbsoluteFill, Easing, interpolate, useCurrentFrame } from 'remotion';
import { tawa, trek, trekEkspresi, trekPose } from '../animasi';
import { FONT, Logo, WARNA } from '../../bagian';
import { Bunyi, Flash } from '../efek';
import { K, kameraDari } from '../kamera';
import { Panggung, Suasana } from '../Panggung';
import { bang, hidupkan, owner, sampul, WAJAH } from '../tokoh/pose';
import { ADEGAN, TEKS_TUTUP_BESAR, TEKS_TUTUP_KECIL } from '../waktu';

const LOGO = 16;
const AJAK = 30;

/** Logo besar + ajakan di atas (zona aman), masuk dengan pop; `sudahTampil` = tanpa animasi masuk (adegan stempel). */
export const TeksPenutup: React.FC<{ sudahTampil?: boolean }> = ({ sudahTampil }) => {
  const f = useCurrentFrame();
  const t = sudahTampil ? 1000 : f;
  const pop = (dari: number) => interpolate(t, [dari, dari + 10], [0.9, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: Easing.bezier(0.16, 1, 0.3, 1) });
  const muncul = (dari: number) => interpolate(t, [dari, dari + 6], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  return (
    <>
      <div style={{ position: 'absolute', left: 0, right: 0, top: 232, display: 'flex', justifyContent: 'center', opacity: muncul(LOGO), scale: String(pop(LOGO)) }}>
        <Logo varian="lengkap" lebar={420} warna={WARNA.kuning} style={{ filter: 'drop-shadow(0 8px 0 rgba(0,0,0,0.35))' }} />
      </div>
      <div style={{ position: 'absolute', left: 70, right: 100, top: 436, textAlign: 'center', fontFamily: FONT, whiteSpace: 'nowrap', opacity: muncul(AJAK), scale: String(pop(AJAK)) }}>
        <div style={{ fontSize: 62, fontWeight: 800, color: '#fff', WebkitTextStroke: '7px #000', paintOrder: 'stroke fill', lineHeight: 1.08, textShadow: '0 8px 0 rgba(0,0,0,0.35)' }}>{TEKS_TUTUP_BESAR}</div>
      </div>
      <div style={{ position: 'absolute', left: 70, right: 100, top: 522, textAlign: 'center', fontFamily: FONT, opacity: muncul(AJAK + 8), translate: `0px ${(1 - muncul(AJAK + 8)) * 14}px` }}>
        <div style={{ fontSize: 38, fontWeight: 700, color: WARNA.krem, WebkitTextStroke: '5px #000', paintOrder: 'stroke fill', lineHeight: 1.2, textShadow: '0 6px 0 rgba(0,0,0,0.3)' }}>{TEKS_TUTUP_KECIL}</div>
      </div>
    </>
  );
};

export const Penutup: React.FC = () => {
  const f = useCurrentFrame();
  const lama = ADEGAN.penutup;
  const kamera = kameraDari(f, [
    [0, K(WAJAH.bang.x + 40, WAJAH.bang.y + 80, 2.25)],
    [44, K(540, 1075, 1.04)],
    [lama, K(540, 1075, 1.08), 'linear'],
  ]);
  const hangat = trek(f, [
    [0, 0],
    [40, 1],
  ]);
  return (
    <AbsoluteFill style={{ background: '#17110a' }}>
      <Panggung
        kamera={kamera}
        bang={{ pose: hidupkan(trekPose(f, [[0, bang.lihatGelas], [20, bang.tertawa], [50, bang.tertawaLepas]]), f, 1), ekspresi: trekEkspresi(f, [[0, 'kaget'], [20, 'girang'], [44, 'tertawa']]), geserY: tawa(f, 44, lama, 5), retakCangkir: 1 }}
        owner={{ pose: hidupkan(trekPose(f, [[0, owner.santai], [24, owner.tertawa], [44, owner.tertawa], [62, owner.angkatCangkir, 'pegas']]), f, 2), ekspresi: trekEkspresi(f, [[0, 'datar'], [24, 'tertawa']]), geserY: tawa(f, 24, lama, 4) }}
        sampul={{ pose: hidupkan(trekPose(f, [[0, sampul.gebrak], [24, sampul.tertawaTutup]]), f, 4), ekspresi: 'tertawa', geserY: tawa(f, 0, lama, 6) }}
        hangat={hangat}
        glowQr={trek(f, [
          [20, 0],
          [40, 0.9],
        ])}
        tampilCangkirBang={f >= 50}
        benih={1020}
      />
      <Suasana vinyet={0.5 - hangat * 0.2} hangat={hangat} />
      <Flash dari={0} lama={3} warna="#ffe2a8" puncak={0.5} />
      <TeksPenutup />
      <Bunyi nama="e:whoosh" dari={0} volume={0.5} rate={0.9} />
      <Bunyi nama="sorak" dari={20} volume={0.4} />
      <Bunyi nama="e:tawa-riuh" dari={18} volume={0.8} />
      <Bunyi nama="menang" dari={24} volume={0.5} />
      <Bunyi nama="pop" dari={AJAK} volume={0.8} />
      <Bunyi nama="pop" dari={AJAK + 8} volume={0.5} />
    </AbsoluteFill>
  );
};
