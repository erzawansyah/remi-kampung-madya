// Teaser Reels B "Info room?" (1080 × 1920, 30 fps, 1320 frame). Storyboard final: promo/BRIEF-teaser-b.md §3.
// Semua visual game adalah rekaman aplikasi asli (promo/public/rekam, dibuat scripts/rekam/rekam-browser.mjs);
// chat, HP, lokasi, meja kedai, dan stempel dibuat di sini. Tanpa voice over.
import type { ReactNode } from 'react';
import { AbsoluteFill, Audio, Img, interpolate, OffthreadVideo, Sequence, staticFile, useCurrentFrame } from 'remotion';
import { FONT, Logo, Sorak, WARNA } from '../bagian';
import { BubbleGame, BubbleTumpuk, Chat } from './Chat';
import { Bunyi, Sfx, Caption, Cincin, Flash, Grain, Kamera, LogoPojok, Panah, Pil, Retak, SplitTone, Vinyet, Whip, burst, glide, halus, jepit, noise } from './efek';
import { LayarHp } from './Hp';
import { Lokasi } from './Lokasi';
import { MejaKedai, POSE, Qr, lerpPose } from './MejaKedai';
import { REKAM } from './rekam';
import { Stempel } from './Stempel';
import { BUBBLE_GAME, CAPTION1, CHAT1, CHAT2, CHAT3, DURASI, FPS, H, M, STATUS, T, TEKS_PIL, TEKS_STEMPEL, TEKS_QR_AJAK, TEKS_QR_JUDUL, TEKS_QR_URL, TEKS_TUTUP_BESAR, TEKS_TUTUP_KECIL, W } from './waktu';

export { DURASI as DURASI_TEASER_B, FPS as FPS_TEASER_B };

/** Skala rekaman HP (1170 px) ke lebar frame, dan geseran atas supaya bar status rekaman terpotong. */
const SKALA_REKAM = W / 1170;
const TINGGI_REKAM = 2532 * SKALA_REKAM;
const GESER_REKAM = -200;
/** Koordinat CSS rekaman (390 × 844) → koordinat frame. */
const cssX = (x: number) => x * (W / 390);
const cssY = (y: number) => y * (W / 390) + GESER_REKAM;

/** Potongan rekaman layar penuh: `dari` detik di rekaman, mulai di frame `mulai` komposisi. */
const Klip: React.FC<{ klip: 'r1' | 'r2' | 'r3'; mulai: number; lama: number; dari: number; rate?: number; style?: React.CSSProperties }> = ({ klip, mulai, lama, dari, rate = 1, style }) => (
  <Sequence from={mulai} durationInFrames={lama} layout="none">
    <OffthreadVideo
      src={staticFile(`rekam/${klip}-kamu.mp4`)}
      startFrom={Math.max(0, Math.round(dari * FPS))}
      playbackRate={rate}
      muted
      style={{ position: 'absolute', left: 0, top: GESER_REKAM, width: W, height: TINGGI_REKAM, ...style }}
    />
  </Sequence>
);

/** Potongan rekaman di dalam layar HP 390 × 844 (dipakai di meja kedai). */
const KlipHp: React.FC<{ klip: 'r1' | 'r2' | 'r3'; mulai: number; lama: number; dari: number }> = ({ klip, mulai, lama, dari }) => (
  <LayarHp>
    <Sequence from={mulai} durationInFrames={lama} layout="none">
      <OffthreadVideo src={staticFile(`rekam/${klip}-kamu.mp4`)} startFrom={Math.max(0, Math.round(dari * FPS))} muted style={{ position: 'absolute', left: 0, top: 0, width: 390, height: 844 }} />
    </Sequence>
  </LayarHp>
);

const StillHp: React.FC<{ nama: string }> = ({ nama }) => (
  <LayarHp>
    <Img src={staticFile(`rekam/${nama}`)} style={{ width: 390, height: 844, objectFit: 'cover' }} />
  </LayarHp>
);

/** Still rekaman layar penuh (lobi). */
const Still: React.FC<{ nama: string; geser?: number }> = ({ nama, geser = GESER_REKAM }) => <Img src={staticFile(`rekam/${nama}`)} style={{ position: 'absolute', left: 0, top: geser, width: W, height: TINGGI_REKAM }} />;

/** Kilat merah + guncangan + KEPENTUNG! besar (menguatkan retak asli rekaman). */
const Kepentung: React.FC<{ dari: number; kuat?: number; lama?: number; y?: number }> = ({ dari, kuat = 1, lama = 60, y = 720 }) => {
  const f = useCurrentFrame();
  if (f < dari || f >= dari + lama) return null;
  const t = f - dari;
  const s = 1.45 - 0.45 * burst(t / 5);
  const o = interpolate(t, [0, 2, lama - 10, lama], [0, 1, 1, 0], jepit);
  return (
    <>
      <Retak dari={dari} kuat={kuat} lama={lama} skala={0.9 + 0.25 * kuat} />
      <Sorak teks="KEPENTUNG!" ukuran={118 + 22 * kuat} x={W / 2} y={y} skala={s} rot={-6} warna={WARNA.merah} opacity={o} />
    </>
  );
};

// ---------------------------------------------------------------------------------------------
// Adegan
// ---------------------------------------------------------------------------------------------

/** 0–2 dtk: cold open, langsung di retak ronde 1. */
const ColdOpen: React.FC = () => {
  const f = useCurrentFrame();
  const r = REKAM.r1;
  const retakDi = 3;
  return (
    <AbsoluteFill style={{ background: '#000' }}>
      <Kamera pose={{ skala: 1.12, y: 1000 }} pushPerFrame={0.004} shakeDari={retakDi} shakeKuat={26} shakeLama={8}>
        {/* Diperlambat 0,8× supaya 2 dtk cold open berhenti sebelum panel MENTUNG di rekaman muncul. */}
        <Klip klip="r1" mulai={0} lama={T.buka[1]} dari={r.retak - (retakDi / FPS) * 0.8} rate={0.8} />
      </Kamera>
      <Vinyet kuat={0.75} warna="rgba(10,20,50,1)" />
      <Kepentung dari={retakDi} kuat={1} lama={52} />
      {f >= 52 && <AbsoluteFill style={{ background: '#000', opacity: interpolate(f, [52, 60], [0, 0.6], jepit) }} />}
    </AbsoluteFill>
  );
};

/** Kode meja terbang dari bubble ke tengah lalu memecah ke empat HP. */
const KodeTerbang: React.FC<{ kode: string; mulai: number }> = ({ kode, mulai }) => {
  const f = useCurrentFrame();
  if (f < mulai || f >= mulai + 30) return null;
  const t = f - mulai;
  const naik = halus(t / 14);
  const x0 = 420;
  const y0 = 770;
  const x1 = W / 2;
  const y1 = H / 2;
  const sel = [
    [W / 4, H / 4],
    [(3 * W) / 4, H / 4],
    [W / 4, (3 * H) / 4],
    [(3 * W) / 4, (3 * H) / 4],
  ];
  const pecah = halus((t - 14) / 12);
  const gaya: React.CSSProperties = { position: 'absolute', fontFamily: FONT, fontWeight: 800, fontSize: 92, color: WARNA.kuning, letterSpacing: 6, WebkitTextStroke: '5px #000', paintOrder: 'stroke fill', textShadow: '0 0 40px rgba(241,166,21,0.8)', transform: 'translate(-50%, -50%)', whiteSpace: 'nowrap' };
  if (t < 14) return <div style={{ ...gaya, left: x0 + (x1 - x0) * naik, top: y0 + (y1 - y0) * naik, transform: `translate(-50%, -50%) scale(${0.6 + 0.6 * naik}) rotate(${-8 + 8 * naik}deg)` }}>{kode}</div>;
  return (
    <>
      {sel.map(([sx, sy], i) => (
        <div key={i} style={{ ...gaya, left: x1 + (sx - x1) * pecah, top: y1 + (sy - y1) * pecah, opacity: 1 - Math.max(0, (pecah - 0.75) / 0.25), transform: `translate(-50%, -50%) scale(${1.2 - 0.7 * pecah})`, fontSize: 80 }}>
          {kode}
        </div>
      ))}
    </>
  );
};

/** 2–7 dtk: chat ronde 1 (kamera mendorong pelan), lalu kode terbang ke empat HP. */
const AdeganChat1: React.FC<{ kode: string }> = ({ kode }) => {
  const f = useCurrentFrame();
  const [a] = T.chat1;
  const akhir = T.kodeTerbang[0];
  // Sesudah kode terbang, chat menjauh dan memudar.
  const jauh = f >= akhir ? halus((f - akhir) / 16) : 0;
  const skala = 1 + Math.max(0, f - a) * 0.0007 + jauh * 0.25;
  return (
    <AbsoluteFill>
      <Kamera pose={{ skala, y: 900 + 40 * jauh }} pushPerFrame={0} style={{ opacity: 1 - jauh }}>
        <Chat jam={STATUS.chat1.jam} baterai={STATUS.chat1.baterai} pesan={CHAT1(kode)} />
      </Kamera>
      {f >= akhir && <Lokasi mulai={akhir + 16} jarak={13} still="rekam/r1-lobi.png" />}
      <KodeTerbang kode={kode} mulai={akhir} />
    </AbsoluteFill>
  );
};

/** Rekaman lobi dengan bubble Kamu (7–9 dtk dan 18–20 dtk). */
const AdeganLobi: React.FC<{ still: string; bubble: { frame: number; dari: 'Kamu'; teks: string }; mulai: number; jam: string; klip?: { klip: 'r2'; dari: number } }> = ({ still, bubble, mulai, jam, klip }) => {
  const f = useCurrentFrame();
  const lama = 60;
  return (
    <AbsoluteFill style={{ background: '#0c2a18' }}>
      <Kamera pose={{ skala: glide(f, mulai, mulai + lama, 1.0, 1.1), y: glide(f, mulai, mulai + lama, 790, 760) }} pushPerFrame={0}>
        {klip ? <Klip klip={klip.klip} mulai={mulai} lama={lama} dari={klip.dari} style={{ top: 0 }} /> : <Still nama={still} geser={0} />}
      </Kamera>
      <Vinyet kuat={0.45} />
      <BubbleGame pesan={bubble} jam={jam} y={1380} />
    </AbsoluteFill>
  );
};

/** Ronde 1, 9–16 dtk: buang → dipungut Ayu → kartu terakhir Ayu (diperlambat) → KEPENTUNG. */
const AdeganRonde1: React.FC = () => {
  const f = useCurrentFrame();
  const r = REKAM.r1;
  const [a0] = T.buang1;
  const pungutDi = a0 + 36; // 10,2 dtk: potong ke Ayu memungut
  const [b0, b1] = T.tegang1;
  const bukaDi = b0 + 50; // kartu tertutup diperlambat selama ±1,7 dtk, lalu dibuka
  const retak = M.retak1;
  // Retak di rekaman jatuh tepat di M.retak1; bagian tertutup diperlambat secukupnya sampai bukaDi.
  const tertutup = r.tertutup ?? r.retak - 1.5;
  const bukaKlip = r.retak - (retak - bukaDi) / FPS;
  const rateTegang = Math.max(0.25, (bukaKlip - tertutup) / ((bukaDi - b0) / FPS));
  // Posisi di rekaman (CSS 390 × 844): tumpukan buangan kanan tengah, panel Ayu = panel kedua dari atas.
  const pile = { x: cssX(330), y: cssY(430) };
  const panelAyu = { x: cssX(195), y: cssY(190) };
  const tegang = f >= b0;
  // Kamera (pusat dijaga di dalam gambar): dekat ke buangan, meluncur supaya buangan dan panel Ayu
  // sama-sama terlihat saat dipungut, lalu ke tengah saat tegang.
  const pose = !tegang
    ? f < pungutDi
      ? { skala: 1.4, x: glide(f, a0, pungutDi, 560, 690), y: glide(f, a0, pungutDi, 1250, 1000) }
      : { skala: glide(f, pungutDi, pungutDi + 30, 1.4, 1.3), x: glide(f, pungutDi + 4, pungutDi + 30, 690, 620), y: glide(f, pungutDi + 4, pungutDi + 30, 1000, 620) }
    : { skala: glide(f, b0, b0 + 30, 1.3, 1.2), x: glide(f, b0, b0 + 30, 620, W / 2), y: glide(f, b0, b0 + 30, 620, 980) };
  // Kartu terakhir Ayu bergetar (jitter kamera kecil) sampai dibuka.
  const getar = tegang && f < retak ? noise(f, 3) * 3 * Math.min(1, (f - b0) / 20) : 0;
  const biru = tegang ? interpolate(f, [b0, b0 + 24, retak, retak + 6], [0, 1, 1, 0.3], jepit) : 0;
  return (
    <AbsoluteFill style={{ background: '#06140c' }}>
      <Kamera pose={{ ...pose, x: pose.x + getar, rot: tegang ? glide(f, b0, b0 + 30, 0, 4) - (f >= retak ? 4 : 0) : 0 }} pushPerFrame={0.0025} pushDari={f < b0 ? a0 : b0} shakeDari={retak} shakeKuat={24} shakeLama={8}>
        {f < pungutDi && <Klip klip="r1" mulai={a0} lama={pungutDi - a0} dari={(r.buang ?? 0) - 0.9} />}
        {f >= pungutDi && f < b0 && <Klip klip="r1" mulai={pungutDi} lama={b0 - pungutDi} dari={(r.pungut ?? 0) - 0.5} />}
        {tegang && f < bukaDi && <Klip klip="r1" mulai={b0} lama={bukaDi - b0} dari={tertutup} rate={rateTegang} />}
        {f >= bukaDi && <Klip klip="r1" mulai={bukaDi} lama={b1 - bukaDi} dari={bukaKlip} />}
        {/* Cincin cahaya di kartu yang dibuang, lalu panah kuning dari buangan ke panel Ayu. */}
        <Cincin x={pile.x + 90} y={pile.y} r={70} dari={a0 + 16} sampai={pungutDi + 10} />
        <Panah dari={pungutDi + 10} lama={14} x1={pile.x + 40} y1={pile.y - 110} x2={panelAyu.x + 120} y2={panelAyu.y + 110} lengkung={-0.28} sampai={b0} />
      </Kamera>
      <SplitTone hangat={tegang ? 0.04 : 0.12} dingin={0.16 + 0.25 * biru} />
      <Vinyet kuat={0.45 + 0.5 * biru} warna={biru > 0.2 ? 'rgba(8,16,48,1)' : 'rgba(0,0,0,1)'} />
      <AbsoluteFill style={{ background: '#0a1a3a', mixBlendMode: 'multiply', opacity: 0.45 * biru, pointerEvents: 'none' }} />
      <Kepentung dari={retak} kuat={1} lama={b1 - retak} />
      {f < b0 && <BubbleGame pesan={BUBBLE_GAME.buang1} jam={STATUS.chat1.jam} y={1390} urut={5} />}
      <Caption teks={CAPTION1} dari={M.caption1} sampai={b1} y={1300} ukuran={64} />
      <BubbleGame pesan={BUBBLE_GAME.noob} jam={STATUS.chat1.jam} y={400} urut={6} />
    </AbsoluteFill>
  );
};

/** Ronde 2, 20–26 dtk: pola yang sama dua kali lebih cepat, kartu terakhir bot, retak lebih besar. */
const AdeganRonde2: React.FC = () => {
  const f = useCurrentFrame();
  const r = REKAM.r2;
  const [a0] = T.tegang2;
  const pungutDi = a0 + 14;
  const tegangDi = a0 + 28;
  const bukaDi = T.kena2[0]; // 23,0 dtk: kartu dibuka, retak di M.retak2
  const b1 = T.kena2[1];
  const retak = M.retak2;
  // Kartu tertutup diperlambat/dipercepat secukupnya supaya terbuka tepat di bukaDi.
  const tertutup = r.tertutup ?? r.retak - 1.5;
  // Ekor sesudah dibuka diperlambat 0,7× supaya berhenti sebelum panel MENTUNG di rekaman muncul.
  const RATE_KENA = 0.7;
  const bukaKlip = r.retak - ((retak - bukaDi) / FPS) * RATE_KENA;
  const rateTegang = Math.max(0.3, (bukaKlip - tertutup) / ((bukaDi - tegangDi) / FPS));
  const pile = { x: cssX(330), y: cssY(430) };
  const panelBot = { x: cssX(195), y: cssY(100) };
  const tegang = f >= tegangDi;
  const pose = !tegang
    ? f < pungutDi
      ? { skala: 1.45, x: glide(f, a0, pungutDi, 560, 690), y: glide(f, a0, pungutDi, 1250, 1000) }
      : { skala: 1.3, x: glide(f, pungutDi, pungutDi + 12, 690, 620), y: glide(f, pungutDi, pungutDi + 12, 1000, 500) }
    : { skala: glide(f, tegangDi, tegangDi + 18, 1.3, 1.22), x: glide(f, tegangDi, tegangDi + 18, 620, W / 2), y: glide(f, tegangDi, tegangDi + 18, 500, 980) };
  const getar = tegang && f < retak ? noise(f, 5) * 4 * Math.min(1, (f - tegangDi) / 14) : 0;
  const biru = tegang ? interpolate(f, [tegangDi, tegangDi + 16, retak, retak + 6], [0, 1, 1, 0.35], jepit) : 0.3;
  return (
    <AbsoluteFill style={{ background: '#06140c' }}>
      <Kamera pose={{ ...pose, x: pose.x + getar, rot: tegang ? glide(f, tegangDi, tegangDi + 18, 0, -5) + (f >= retak ? 5 : 0) : 0 }} pushPerFrame={0.0035} pushDari={tegang ? tegangDi : a0} shakeDari={retak} shakeKuat={44} shakeLama={9}>
        {f < pungutDi && <Klip klip="r2" mulai={a0} lama={pungutDi - a0} dari={(r.buang ?? 0) - 0.7} rate={2} />}
        {f >= pungutDi && f < tegangDi && <Klip klip="r2" mulai={pungutDi} lama={tegangDi - pungutDi} dari={(r.pungut ?? 0) - 0.3} rate={2} />}
        {tegang && f < bukaDi && <Klip klip="r2" mulai={tegangDi} lama={bukaDi - tegangDi} dari={tertutup} rate={rateTegang} />}
        {f >= bukaDi && <Klip klip="r2" mulai={bukaDi} lama={b1 - bukaDi} dari={bukaKlip} rate={RATE_KENA} />}
        <Cincin x={pile.x + 90} y={pile.y} r={70} dari={a0 + 4} sampai={pungutDi + 6} />
        <Panah dari={pungutDi + 5} lama={8} x1={pile.x + 40} y1={pile.y - 110} x2={panelBot.x + 120} y2={panelBot.y + 110} lengkung={-0.28} sampai={tegangDi} />
      </Kamera>
      <SplitTone hangat={0.03} dingin={0.2 + 0.3 * biru} />
      <Vinyet kuat={0.55 + 0.5 * biru} warna="rgba(6,12,40,1)" />
      <AbsoluteFill style={{ background: '#08163a', mixBlendMode: 'multiply', opacity: 0.5 * biru, pointerEvents: 'none' }} />
      <Kepentung dari={retak} kuat={1.4} lama={b1 - retak} />
      <BubbleTumpuk pesan={BUBBLE_GAME.kena2} jam={STATUS.chat2.jam} y={300} urut={3} />
    </AbsoluteFill>
  );
};

/** 26–29 dtk: chat ronde 3 dengan indikator mengetik, lalu flash putih ke kedai. */
const AdeganChat3: React.FC = () => {
  const f = useCurrentFrame();
  const [a] = T.chat3;
  return (
    <AbsoluteFill>
      <Kamera pose={{ skala: 1.0, y: 900 }} pushPerFrame={0.0007} pushDari={a}>
        <Chat jam={STATUS.chat3.jam} baterai={STATUS.chat3.baterai} pesan={CHAT3} mengetik={[a + 4, CHAT3[0].frame - 2]} />
      </Kamera>
    </AbsoluteFill>
  );
};

/** 29–40 dtk: meja Kedai Madya, HP Kamu diangkat (mentung), HP lawan (bot), pull-out dan penutup. */
const AdeganKedai: React.FC = () => {
  const f = useCurrentFrame();
  const [k0] = T.kedai;
  const [m0] = T.menang;
  const [l0] = T.lawanBot;
  const [t0, t1] = T.tutup;
  const r3 = REKAM.r3;
  // Kamera turun dari lampu ke meja (29–32), lalu diam-diam mendorong.
  const turun = halus((f - k0) / 80);
  // HP Kamu naik 32–32,6, turun lagi 35–35,5; HP lawan naik 35–35,6, turun 37–37,6.
  const naikKamu = halus((f - m0) / 18) * (1 - halus((f - l0) / 16));
  const naikLawan = halus((f - l0 - 4) / 18) * (1 - halus((f - t0) / 18));
  const poseKamu = lerpPose(POSE.kamuRebah, POSE.kamuAngkat, naikKamu);
  const poseLawan = lerpPose(POSE.lawanRebah, POSE.lawanAngkat, naikLawan);
  const terang = halus((f - t0) / 30);
  const skala = f < t0 ? 1 + Math.max(0, f - k0) * 0.0012 : glide(f, t0, t1, 1.1, 0.97);
  const y = f < t0 ? 960 : glide(f, t0, t1, 960, 1000);
  const emas = f >= M.mentung3 ? interpolate(f, [M.mentung3, M.mentung3 + 2, M.mentung3 + 14], [0, 0.8, 0], jepit) : 0;
  return (
    <AbsoluteFill style={{ background: '#0b0805' }}>
      <Kamera pose={{ skala, y }} pushPerFrame={0} shakeDari={M.mentung3} shakeKuat={16} shakeLama={7}>
        <MejaKedai
          turun={turun}
          terang={terang}
          poseKamu={poseKamu}
          poseLawan={poseLawan}
          angkatKamu={naikKamu > 0.01}
          angkatLawan={naikLawan > 0.01}
          glowQr={0.4 + 0.6 * terang}
          layarKamu={<KlipHp klip="r3" mulai={k0} lama={t1 - k0} dari={(r3.mentung ?? 0) - (M.mentung3 - k0) / FPS} />}
          layarLawan={<StillHp nama="r3-bot-retak.png" />}
          layarLain={<StillHp nama="r3-lobi-bot.png" />}
        />
      </Kamera>
      <AbsoluteFill style={{ background: WARNA.kuning, mixBlendMode: 'screen', opacity: emas, pointerEvents: 'none' }} />
      <SplitTone hangat={0.22 + 0.2 * terang} dingin={0.08} />
      <Vinyet kuat={0.5 - 0.25 * terang} />
      {/* Bubble MENANG!! dan reaksi teman. */}
      {f < l0 && <BubbleGame pesan={BUBBLE_GAME.menang} jam={STATUS.chat3.jam} y={300} urut={3} />}
      {f >= l0 && f < t0 && <BubbleTumpuk pesan={BUBBLE_GAME.lawanBot} jam={STATUS.chat3.jam} y={300} urut={4} />}
      {/* Penutup: logo besar dan ajakan. */}
      {f >= t0 && (
        <>
          <div style={{ position: 'absolute', left: 0, right: 0, top: 230, display: 'flex', justifyContent: 'center', opacity: halus((f - t0) / 12), transform: `translateY(${(1 - halus((f - t0) / 14)) * -30}px) scale(${0.9 + 0.1 * halus((f - t0) / 14)})` }}>
            <Logo varian="lengkap" lebar={620} warna={WARNA.kuning} style={{ filter: 'drop-shadow(0 10px 30px rgba(0,0,0,0.6))' }} />
          </div>
          <div style={{ position: 'absolute', left: 70, right: 140, top: 1340, textAlign: 'center', fontFamily: FONT, opacity: halus((f - t0 - 6) / 10) }}>
            <div style={{ fontSize: 76, fontWeight: 800, color: '#fff', WebkitTextStroke: '6px #000', paintOrder: 'stroke fill', textShadow: '0 8px 0 rgba(0,0,0,0.3), 0 16px 36px rgba(0,0,0,0.5)', lineHeight: 1.1 }}>{TEKS_TUTUP_BESAR}</div>
            <div style={{ fontSize: 40, fontWeight: 700, color: WARNA.krem, marginTop: 18, textShadow: '0 3px 0 rgba(0,0,0,0.6), 0 10px 24px rgba(0,0,0,0.6)', opacity: halus((f - t0 - 12) / 10) }}>{TEKS_TUTUP_KECIL}</div>
          </div>
        </>
      )}
    </AbsoluteFill>
  );
};

/** 44–47 dtk (penutup): kartu khusus QR (besar, diam cukup lama supaya bisa dipindai dari layar lain). */
const AdeganQr: React.FC = () => {
  const f = useCurrentFrame();
  const [a] = T.qr;
  const masuk = halus((f - a) / 10);
  // Dorongan kamera sangat pelan (±4% selama 3 dtk) supaya tidak diam, tapi QR tetap tajam.
  const skala = 0.96 + 0.04 * masuk + Math.max(0, f - a) * 0.0004;
  const SISI = 680;
  return (
    <AbsoluteFill style={{ background: 'radial-gradient(ellipse 80% 60% at 50% 45%, #6a4512 0%, #3a2408 55%, #170e04 100%)' }}>
      {/* Kolom isi dipusatkan di zona aman Reels (x 70–940). */}
      <div style={{ position: 'absolute', left: 70, width: 870, top: 0, height: H, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 34, transform: `scale(${skala})`, opacity: Math.min(1, (f - a + 1) / 4) }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 20, fontFamily: FONT, fontWeight: 800, fontSize: 60, color: WARNA.krem, textShadow: '0 4px 14px rgba(0,0,0,0.5)' }}>
          <Logo varian="maskot" lebar={86} warna={WARNA.kuning} />
          {TEKS_QR_JUDUL}
        </div>
        <div style={{ padding: 22, background: WARNA.krem, borderRadius: 28, boxShadow: '0 20px 60px rgba(0,0,0,0.55), 0 0 60px 10px rgba(241,166,21,0.35)' }}>
          <Qr sisi={SISI} />
        </div>
        <div style={{ textAlign: 'center', fontFamily: FONT }}>
          <div style={{ fontSize: 62, fontWeight: 800, color: '#fff', WebkitTextStroke: '5px #000', paintOrder: 'stroke fill', lineHeight: 1.1 }}>{TEKS_QR_AJAK}</div>
          <div style={{ fontSize: 40, fontWeight: 700, color: WARNA.emasMuda, marginTop: 14, letterSpacing: 0.5, textShadow: '0 3px 10px rgba(0,0,0,0.6)' }}>{TEKS_QR_URL}</div>
        </div>
      </div>
      <Vinyet kuat={0.35} />
    </AbsoluteFill>
  );
};

/** 42–44 dtk: kembali ke chat gelap, satu notifikasi masuk, lalu potong (loop ke frame 0). */
const AdeganLoop: React.FC = () => {
  const f = useCurrentFrame();
  const [a] = T.loop;
  const pesan = { frame: M.notifAkhir, dari: 'Kamu' as const, teks: 'Info room?' };
  return (
    <AbsoluteFill>
      <Kamera pose={{ skala: 1.0, y: 900 }} pushPerFrame={0.0012} pushDari={a}>
        <Chat jam={STATUS.loop.jam} baterai={STATUS.loop.baterai} pesan={[pesan]} mengetik={[a + 6, M.notifAkhir - 1]} redup={interpolate(f, [a, a + 8], [0.35, 0.08], jepit)} />
      </Kamera>
      <Vinyet kuat={0.45} warna="rgba(5,10,30,1)" />
    </AbsoluteFill>
  );
};

// ---------------------------------------------------------------------------------------------
// Audio
// ---------------------------------------------------------------------------------------------

/** Volume musik: ±10 dB di bawah SFX, diredam ke 15% di bagian tegang, hening sebelum pentungan dibuka. */
function volumeMusik(f: number): number {
  const dasar = 0.42;
  const redam = (a: number, b: number) => f >= a - 8 && f < b + 8 ? interpolate(f, [a - 8, a, b, b + 8], [1, 0.15, 0.15, 1], jepit) : 1;
  const hening = (a: number, b: number) => (f >= a && f < b ? 0 : 1);
  return dasar * Math.min(redam(T.tegang1[0], T.tegang1[1]), redam(T.tegang2[0], T.kena2[1]), redam(T.menang[0], T.tutup[0])) * hening(M.heningMulai1, M.retak1) * hening(M.heningMulai2, M.retak2) * hening(M.heningMulai3, M.chatBot) * interpolate(f, [DURASI - 4, DURASI], [1, 0.7], jepit);
}

const AudioTeaser: React.FC<{ kode: string }> = ({ kode }) => {
  const r1 = REKAM.r1;
  const r2 = REKAM.r2;
  const semuaBubble = [...CHAT1(kode), ...CHAT2, ...CHAT3, BUBBLE_GAME.lobi1, BUBBLE_GAME.buang1, BUBBLE_GAME.noob, BUBBLE_GAME.lobi2, ...BUBBLE_GAME.kena2, BUBBLE_GAME.menang, ...BUBBLE_GAME.lawanBot];
  void r1;
  void r2;
  return (
    <>
      <Audio src={staticFile('aset/musik.wav')} volume={(f) => volumeMusik(f)} />
      {/* Cold open: hantaman + jotos. */}
      <Bunyi nama="mentung" dari={0} volume={0.8} />
      <Bunyi nama="jotos" dari={3} />
      <Bunyi nama="kepentung" dari={4} volume={0.7} />
      {/* Whip ke chat, pop tiap bubble, whoosh kode terbang, HP menyala. */}
      <Sfx nama="whoosh" dari={T.whip[0] - 2} volume={0.9} />
      {semuaBubble.map((p) => (
        <Bunyi key={`${p.frame}-${p.teks}`} nama="pop" dari={p.frame} volume={0.9} />
      ))}
      <Sfx nama="whoosh" dari={T.kodeTerbang[0]} volume={0.8} />
      <Sfx nama="whoosh-kecil" dari={T.kodeTerbang[0] + 14} volume={0.8} />
      {[0, 1, 2, 3].map((i) => (
        <Bunyi key={i} nama="notifikasi" dari={T.kodeTerbang[0] + 16 + i * 13} volume={0.55} rate={1 + i * 0.06} />
      ))}
      {/* Ronde 1: buang, pungut, tegang, mentung, jotos. */}
      <Bunyi nama="buang" dari={T.buang1[0] + 27} />
      <Bunyi nama="mulung" dari={T.buang1[0] + 36 + 15} />
      <Bunyi nama="bahaya" dari={T.buang1[0] + 36 + 39} volume={0.8} />
      <Bunyi nama="letak" dari={T.tegang1[0] + 4} volume={0.8} />
      <Bunyi nama="tegang" dari={T.tegang1[0] + 14} volume={0.9} lama={M.heningMulai1 - T.tegang1[0] - 14} />
      <Bunyi nama="mentung" dari={M.retak1 - 2} />
      <Bunyi nama="jotos" dari={M.retak1} />
      <Bunyi nama="kepentung" dari={M.retak1 + 1} volume={0.8} />
      {/* Ronde 2: sama, lebih cepat dan lebih keras. */}
      <Bunyi nama="buang" dari={T.tegang2[0] + 10} />
      <Bunyi nama="mulung" dari={T.tegang2[0] + 18} />
      <Bunyi nama="bahaya" dari={T.tegang2[0] + 25} volume={0.8} />
      <Bunyi nama="letak" dari={T.tegang2[0] + 30} volume={0.8} />
      <Bunyi nama="tegang" dari={T.tegang2[0] + 40} volume={1} lama={M.heningMulai2 - T.tegang2[0] - 40} />
      <Bunyi nama="mentung" dari={M.retak2 - 2} />
      <Bunyi nama="jotos" dari={M.retak2} volume={1} />
      <Bunyi nama="jotos" dari={M.retak2 + 2} volume={0.6} rate={0.85} />
      <Bunyi nama="kepentung" dari={M.retak2 + 1} />
      {/* Ronde 3: flash ke kedai, menang, sorak, panel bot retak. */}
      <Sfx nama="flash" dari={M.flashKedai - 2} volume={0.8} />
      <Sfx nama="kedai" dari={M.flashKedai} lama={T.stempel[0] - M.flashKedai} volume={(f) => 0.32 * interpolate(f, [0, 15, T.stempel[0] - M.flashKedai - 20, T.stempel[0] - M.flashKedai], [0, 1, 1, 0], jepit) * (f + M.flashKedai >= M.heningMulai3 && f + M.flashKedai < M.chatBot ? 0.4 : 1)} />
      <Bunyi nama="geser" dari={T.menang[0]} volume={0.8} rate={0.9} />
      <Bunyi nama="mentung" dari={M.mentung3 - 1} />
      <Bunyi nama="menang" dari={M.mentung3} />
      <Bunyi nama="sorak" dari={M.mentung3 + 6} volume={0.9} />
      <Bunyi nama="jotosLain" dari={M.mentung3 + 9} volume={0.9} />
      <Bunyi nama="geser" dari={T.lawanBot[0]} volume={0.7} rate={0.9} />
      {/* Penutup, stempel DOK, notifikasi loop. */}
      <Bunyi nama="giliran" dari={T.tutup[0] + 2} volume={0.7} />
      <Sfx nama="dok" dari={M.stempelKena - 1} volume={1} />
      <Sfx nama="whoosh" dari={T.qr[0] - 5} volume={0.7} />
      <Sfx nama="whoosh-kecil" dari={T.loop[0] - 5} volume={0.7} />
      <Bunyi nama="notifikasi" dari={M.notifAkhir} volume={1} />
    </>
  );
};

// ---------------------------------------------------------------------------------------------
// Komposisi
// ---------------------------------------------------------------------------------------------

export const TeaserB: React.FC = () => {
  const f = useCurrentFrame();
  const kode = REKAM.r1.kode;
  const di = (b: readonly [number, number]) => f >= b[0] && f < b[1];
  const [c2a] = T.chat2;
  let isi: ReactNode = null;
  if (di(T.buka)) isi = <ColdOpen />;
  else if (f < T.lobi1[0]) isi = <AdeganChat1 kode={kode} />;
  else if (di(T.lobi1)) isi = <AdeganLobi still="r1-lobi.png" bubble={BUBBLE_GAME.lobi1} mulai={T.lobi1[0]} jam={STATUS.chat1.jam} />;
  else if (f < T.chat2[0]) isi = <AdeganRonde1 />;
  else if (di(T.chat2))
    isi = (
      <Kamera pose={{ skala: 1.0, y: 900 }} pushPerFrame={0.0009} pushDari={c2a}>
        <Chat jam={STATUS.chat2.jam} baterai={STATUS.chat2.baterai} pesan={CHAT2} />
      </Kamera>
    );
  else if (di(T.lobi2)) isi = <AdeganLobi still="r2-lobi-bot.png" bubble={BUBBLE_GAME.lobi2} mulai={T.lobi2[0]} jam={STATUS.chat2.jam} klip={REKAM.r2.lobi !== undefined ? { klip: 'r2', dari: REKAM.r2.lobi } : undefined} />;
  else if (f < T.chat3[0]) isi = <AdeganRonde2 />;
  else if (di(T.chat3)) isi = <AdeganChat3 />;
  else if (f < T.stempel[1]) isi = <AdeganKedai />;
  else if (f < T.loop[1]) isi = <AdeganLoop />;
  else isi = <AdeganQr />;

  return (
    <AbsoluteFill style={{ background: '#000', fontFamily: FONT }}>
      {isi}
      {/* Lapisan tetap: whip, flash, stempel, pil, logo pojok, grain. */}
      <Whip dari={T.whip[0]} lama={8} />
      <Whip dari={T.qr[0] - 4} lama={8} />
      <Whip dari={T.loop[0] - 4} lama={8} />
      <Flash dari={M.flashKedai} lama={4} />
      <Stempel teks={TEKS_STEMPEL} kena={M.stempelKena} sampai={T.stempel[1]} />
      <Pil teks={TEKS_PIL} dari={T.pil[0]} sampai={T.pil[1]} />
      <LogoPojok />
      <Grain kuat={0.028} />
      <AudioTeaser kode={kode} />
    </AbsoluteFill>
  );
};
