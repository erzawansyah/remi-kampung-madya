// Teaser Reels A "Aman, aku seng menang" (promo/BRIEF-teaser-a.md): animasi 2D tiga warga kedai di meja Kedai Madya
// dengan layar HP berisi rekaman game asli. Tanpa voice over: balon kata, caption, musik, dan bunyi game.
// Lapisan: adegan 2D di dalam kamera virtual (Adegan.tsx) → sisipan layar HP (rekaman, tajam, di luar kamera) →
// balon kata (diproyeksikan dari mulut tokoh) → caption, pil, logo, sorakan, stempel → audio.

import { AbsoluteFill, Audio, Img, OffthreadVideo, Sequence, staticFile, useCurrentFrame } from 'remotion';
import { FONT, Logo, Sorak, WARNA } from '../bagian';
import { Adegan, KameraA, kameraDi, mulutDi, proyeksi, type PoseKamera } from './Adegan';
import { Balon } from './Balon';
import { Bunyi, burst, Caption, Flash, Grain, jepit, LogoPojok, Pil, Retak, SplitTone, Vinyet, Whip } from './efek';
import { LayarHp } from './Hp';
import { Qr } from './MejaKedai';
import { LAYAR_A1, LAYAR_A2, REKAM_A } from './rekam';
import { LayarRekam, LayarStill, Sisipan } from './Sisipan';
import { Stempel } from './Stempel';
import { BALON, CAPTION_PUNGUT, CAPTION_SEBELUM, d, FPS, H, M, T, TEKS_PIL, TEKS_SORAK_KEPENTUNG, TEKS_STEMPEL, TEKS_TUTUP_BESAR, TEKS_TUTUP_KECIL, W } from './waktu';
import { interpolate } from 'remotion';

const A1 = REKAM_A.a1;
const A2 = REKAM_A.a2;

/** Balon kata di layar: letaknya dari mulut tokoh (panggung) yang diproyeksikan kamera, dijaga di zona aman. */
const BalonTokoh: React.FC<{ teks: string; dari: number; sampai: number; siapa: 'bang' | 'owner' | 'sampul'; arah?: -1 | 1; lebar?: number }> = ({ teks, dari, sampai, siapa, arah = -1, lebar = 440 }) => {
  const f = useCurrentFrame();
  if (f < dari || f >= sampai) return null;
  const k = kameraDi(f);
  const m = proyeksi(k, mulutDi(f, siapa).x, mulutDi(f, siapa).y);
  const tinggiKepala = 150 * k.skala;
  let x = m.x + arah * (lebar * 0.42);
  let y = m.y - tinggiKepala - 150;
  x = Math.min(940 - lebar / 2, Math.max(70 + lebar / 2, x));
  y = Math.max(300, y);
  return <Balon teks={teks} dari={dari} sampai={sampai} x={x} y={y} ekorX={m.x} ekorY={m.y - 8} lebar={lebar} />;
};

/** Layar HP adegan 3: bingkai kamera memindai QR, lalu beranda, isian nama, lobi. */
const LayarPindai: React.FC = () => {
  const f = useCurrentFrame();
  const t = f - M.qrPindai;
  const kena = f >= M.qrPindai + 26;
  const garis = 300 + ((t * 9) % 240);
  return (
    <LayarHp style={{ background: '#0c0a08' }}>
      {/* Pemandangan kamera: papan QR di meja (diburamkan sedikit lalu tajam). */}
      <div style={{ position: 'absolute', left: 0, top: 0, width: 390, height: 844, background: 'radial-gradient(ellipse 70% 50% at 50% 55%, #6a4420 0%, #2a1a0a 70%)' }} />
      <div style={{ position: 'absolute', left: 60, top: 250, width: 270, height: 330, background: '#fbf6ea', borderRadius: 10, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 8, transform: `scale(${1 + Math.min(1, t / 26) * 0.08})`, filter: `blur(${Math.max(0, 2 - t / 8)}px)` }}>
        <div style={{ fontFamily: FONT, fontWeight: 700, fontSize: 19, color: '#2a2215' }}>Remi Kampung Madya</div>
        <Qr sisi={210} />
        <div style={{ fontFamily: FONT, fontWeight: 600, fontSize: 15, color: '#6b5d3f' }}>pindai buat main</div>
      </div>
      {/* Bingkai pindai dan garis pindai. */}
      <svg width={390} height={844} style={{ position: 'absolute', left: 0, top: 0 }}>
        <g fill="none" stroke={kena ? '#5fd38a' : '#ffffff'} strokeWidth={5} strokeLinecap="round">
          <path d="M 50 250 L 50 220 L 80 220" />
          <path d="M 340 250 L 340 220 L 310 220" />
          <path d="M 50 590 L 50 620 L 80 620" />
          <path d="M 340 590 L 340 620 L 310 620" />
        </g>
        {!kena && <rect x={56} y={garis} width={278} height={3} fill="#f1a615" opacity={0.9} />}
      </svg>
      {kena && (
        <div style={{ position: 'absolute', left: 30, right: 30, top: 650, padding: '14px 18px', background: 'rgba(255,255,255,0.95)', borderRadius: 16, fontFamily: FONT, fontWeight: 600, fontSize: 18, color: '#111', textAlign: 'center', transform: `scale(${0.9 + 0.1 * burst((f - M.qrPindai - 26) / 6)})` }}>
          remi-madya.likrea.biz.id
        </div>
      )}
      <div style={{ position: 'absolute', left: 0, right: 0, bottom: 40, display: 'flex', justifyContent: 'center' }}>
        <div style={{ width: 70, height: 70, borderRadius: 35, border: '5px solid #fff', background: 'rgba(255,255,255,0.3)' }} />
      </div>
    </LayarHp>
  );
};

/** Avatar maskot cangkir (bot) ditempel di atas panel nama warga kedai di layar HP (adegan 9). */
const AvatarMaskot: React.FC<{ x: number; y: number }> = ({ x, y }) => (
  <div style={{ position: 'absolute', left: x, top: y, width: 34, height: 34, borderRadius: 17, background: WARNA.krem, display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 2px 6px rgba(0,0,0,0.5)' }}>
    <Logo varian="maskot" lebar={24} warna={WARNA.kuning} />
  </div>
);

/** Retak di dalam layar HP (versi kecil dari aset/retak.png). */
const RetakLayar: React.FC<{ dari: number; kuat?: number }> = ({ dari, kuat = 1 }) => {
  const f = useCurrentFrame();
  if (f < dari) return null;
  const t = f - dari;
  const o = interpolate(t, [0, 1, 40], [0, 0.95 * kuat, 0.85 * kuat], jepit);
  const kilat = interpolate(t, [0, 1, 5], [0.5 * kuat, 0.4 * kuat, 0], jepit);
  return (
    <>
      <div style={{ position: 'absolute', inset: 0, background: '#ff2a1a', opacity: kilat, mixBlendMode: 'screen' }} />
      <Img src={staticFile('aset/retak.png')} style={{ position: 'absolute', left: 0, top: 0, width: 390, height: 844 * (1920 / 1920), opacity: o, objectFit: 'cover' }} />
    </>
  );
};

/** Volume musik per frame: diredam di adegan tegang (6–7), hening 0,4 dtk sebelum ketukan nutup. */
const volumeMusik = (fr: number): number => {
  if (fr >= M.heningMulai && fr < M.ketukNutup) return 0;
  return interpolate(fr, [0, 60, T.tegang[0], T.tegang[0] + 60, M.heningMulai - 1, M.ketukNutup, M.gebrak + 20, T.ledek[0] + 20, T.montase[0], T.tutup[0], T.tutup[0] + 30, 1200], [0.3, 0.32, 0.32, 0.1, 0.08, 0.12, 0.12, 0.26, 0.28, 0.3, 0.38, 0.34], jepit);
};

export const TeaserA: React.FC = () => {
  const f = useCurrentFrame();
  const k: PoseKamera = kameraDi(f);
  const vinyet = interpolate(f, [0, T.tegang[0], T.tegang[0] + 60, M.gebrak + 20, T.tutup[0], T.tutup[0] + 40], [0.55, 0.5, 0.95, 0.6, 0.5, 0.3], jepit);
  const dingin = interpolate(f, [T.tegang[0], T.tegang[0] + 60, M.gebrak + 20, T.tutup[0]], [0.16, 0.4, 0.22, 0.1], jepit);
  const hangat = interpolate(f, [T.tutup[0], T.tutup[0] + 40], [0.12, 0.3], jepit);
  return (
    <AbsoluteFill style={{ background: '#17110a' }}>
      {/* 1. Adegan 2D di dalam kamera virtual (mulai burst wajah; sebelum itu cold open layar penuh). */}
      {f >= M.burstWajah && (
        <KameraA k={k}>
          <Adegan />
        </KameraA>
      )}
      {f < M.burstWajah && (
        <AbsoluteFill style={{ background: '#000' }}>
          <OffthreadVideo src={staticFile('rekam/a1-kamu.mp4')} startFrom={d(A1.retak) - 3} muted style={{ width: W, height: H, objectFit: 'cover' }} />
          <Retak dari={0} kuat={1} lama={M.burstWajah} />
        </AbsoluteFill>
      )}
      {/* Gradasi atas (langit-langit gelap) dan bawah (bayangan meja depan) + split tone + vinyet + grain. */}
      <AbsoluteFill style={{ background: 'linear-gradient(180deg, rgba(8,5,2,0.55) 0%, rgba(8,5,2,0) 26%, rgba(8,5,2,0) 78%, rgba(8,5,2,0.5) 100%)', pointerEvents: 'none' }} />
      <SplitTone hangat={hangat} dingin={dingin} />
      <Vinyet kuat={vinyet} warna={f >= T.tegang[0] && f < M.gebrak + 20 ? 'rgba(4,10,28,1)' : 'rgba(0,0,0,1)'} />
      {/* Rewind 8 frame ke "15 menit sebelumnya" dan whip pendek di potongan montase. */}
      <Whip dari={T.rewind[0]} lama={8} />
      <Whip dari={M.montaseA} lama={4} />
      <Whip dari={M.montaseB} lama={4} />
      <Whip dari={M.montaseC} lama={4} />
      <Flash dari={M.terpental} lama={3} warna="#ff3a2a" puncak={0.55} />
      <Flash dari={T.tutup[0]} lama={3} warna="#ffe2a8" puncak={0.5} />
      {/* Adegan 3: layar HP Mas Sampul: pindai QR → beranda → nama → lobi. */}
      <Sisipan dari={M.qrPindai} sampai={M.qrBeranda} x={330} y={820} lebar={430} rot={-4} masukDari={{ x: -60, y: 20 }}>
        <LayarPindai />
      </Sisipan>
      <Sisipan dari={M.qrBeranda} sampai={M.qrNama} x={330} y={820} lebar={430} rot={-4} masukDari={{ x: 0, y: 0 }}>
        <LayarStill berkas="a1-beranda.png" />
      </Sisipan>
      <Sisipan dari={M.qrNama} sampai={M.qrLobi} x={330} y={820} lebar={430} rot={-4} masukDari={{ x: 0, y: 0 }}>
        <LayarStill berkas="a1-nama.png" />
      </Sisipan>
      <Sisipan dari={M.qrLobi} sampai={T.buang[0]} x={330} y={820} lebar={430} rot={-4} masukDari={{ x: 0, y: 0 }}>
        <LayarStill berkas="a1-sampul-lobi.png" />
      </Sisipan>
      {/* Adegan 4: kartu Bang IT disorot cincin kuning lalu masuk buangan. */}
      <Sisipan dari={T.buang[0] + 30} sampai={T.buang[1]} x={810} y={720} lebar={400} rot={4} masukDari={{ x: 60, y: 0 }}>
        <LayarRekam berkas="a1-kamu.mp4" detik={A1.buang - (M.ketukHp + 4 - (T.buang[0] + 30)) / FPS} dari={T.buang[0] + 30} />
        <LayarHp>
          <div style={{ position: 'absolute', left: LAYAR_A1.buangan.x - 42, top: LAYAR_A1.buangan.y - 58, width: 84, height: 116, borderRadius: 8, border: '4px solid #f1a615', boxShadow: '0 0 18px 6px rgba(241,166,21,0.6)', opacity: f >= M.ketukHp + 4 && f < T.buang[1] - 8 ? 0.95 + 0.05 * Math.sin(f * 0.5) : 0 }} />
        </LayarHp>
      </Sisipan>
      {/* Adegan 5: kartu buangan Bang IT dipungut, panah kuning dari buangan ke panel Cak Owner. */}
      <Sisipan dari={T.pungut[0] + 6} sampai={T.tegang[0] + 10} x={810} y={720} lebar={400} rot={4} masukDari={{ x: 60, y: 0 }}>
        <LayarRekam berkas="a1-kamu.mp4" detik={A1.pungut - (M.ketukOwner + 2 - (T.pungut[0] + 6)) / FPS} dari={T.pungut[0] + 6} />
        <LayarHp>
          <PanahLayar dari={M.ketukOwner + 2} sampai={T.tegang[0] + 4} x1={LAYAR_A1.buangan.x} y1={LAYAR_A1.buangan.y - 60} x2={LAYAR_A1.panelOwner.x} y2={LAYAR_A1.panelOwner.y + 40} />
        </LayarHp>
      </Sisipan>
      {/* Adegan 7: layar Bang IT retak, KEPENTUNG! (rekaman), lalu cut ke Bang IT terpental. */}
      <Sisipan dari={M.retak - 6} sampai={M.terpental + 1} x={540} y={930} lebar={600} rot={0} masukDari={{ x: 0, y: 30 }}>
        <LayarRekam berkas="a1-kamu.mp4" detik={A1.retak - 6 / FPS} dari={M.retak - 6} />
        <LayarHp>
          <RetakLayar dari={M.retak} />
        </LayarHp>
      </Sisipan>
      {/* Adegan 8: ledekan besar dari game di HP Mas Sampul yang disodorkan ke muka Bang IT. */}
      <Sisipan dari={M.sodorHp + 10} sampai={M.tolehDatar + 4} x={430} y={720} lebar={400} rot={-10} masukDari={{ x: 120, y: -20 }}>
        <LayarRekam berkas="a1-kamu.mp4" detik={(A1.ledek ?? 0) - 6 / FPS} dari={M.sodorHp + 10} />
      </Sisipan>
      {/* Adegan 9: montase (a) warga kedai (avatar maskot) mentung, (b) kena lagi. */}
      <Sisipan dari={M.montaseA + 6} sampai={M.montaseB} x={790} y={700} lebar={380} rot={5} masukDari={{ x: 50, y: 0 }}>
        <LayarRekam berkas="a2-kamu.mp4" detik={A2.retak - (M.montaseA + 28 - (M.montaseA + 6)) / FPS} dari={M.montaseA + 6} />
        <LayarHp>
          <AvatarMaskot x={LAYAR_A2.panelBot.x} y={LAYAR_A2.panelBot.y} />
          <RetakLayar dari={M.montaseA + 28} kuat={0.9} />
        </LayarHp>
      </Sisipan>
      <Sisipan dari={M.montaseB + 4} sampai={M.montaseC} x={790} y={640} lebar={360} rot={-6} masukDari={{ x: 50, y: -20 }}>
        <LayarStill berkas="a2-retak.png">
          <AvatarMaskot x={LAYAR_A2.panelBot.x} y={LAYAR_A2.panelBot.y} />
          <RetakLayar dari={M.montaseB + 12} kuat={1} />
        </LayarStill>
      </Sisipan>
      {/* Balon kata (teks persis §4). */}
      <BalonTokoh teks={BALON.aman} dari={M.balonAman} sampai={T.qr[0]} siapa="bang" arah={-1} lebar={520} />
      <BalonTokoh teks={BALON.buang} dari={M.balonBuang} sampai={M.tolehKamera} siapa="bang" arah={-1} lebar={400} />
      <BalonTokoh teks={BALON.noob} dari={M.balonNoob} sampai={T.ledek[1] - 24} siapa="sampul" arah={1} lebar={260} />
      <BalonTokoh teks={BALON.sijiManeh} dari={M.montaseA + 2} sampai={M.montaseB} siapa="bang" arah={-1} lebar={360} />
      {/* Caption di luar balon. */}
      <Caption teks={CAPTION_SEBELUM} dari={T.datang[0] + 2} sampai={M.balonAman + 30} y={1350} ukuran={66} />
      <Caption teks={CAPTION_PUNGUT} dari={M.captionPungut} sampai={T.tegang[0] + 24} y={1250} ukuran={62} />
      {/* Sorakan KEPENTUNG! (adegan 7). */}
      {f >= M.retak + 2 && f < M.gebrak + 24 && (
        <Sorak teks={TEKS_SORAK_KEPENTUNG} ukuran={150} x={540} y={520} skala={0.6 + 0.4 * burst((f - M.retak - 2) / 6)} rot={-6} warna={WARNA.merah} opacity={f >= M.gebrak + 16 ? (M.gebrak + 24 - f) / 8 : 1} />
      )}
      {/* Penutup: logo besar, ajakan, DM. */}
      {f >= T.tutup[0] + 16 && (
        <div style={{ position: 'absolute', left: 0, right: 0, top: 250, display: 'flex', justifyContent: 'center', opacity: Math.min(1, (f - T.tutup[0] - 16) / 8), transform: `scale(${0.9 + 0.1 * burst((f - T.tutup[0] - 16) / 10)})` }}>
          <Logo varian="lengkap" lebar={560} warna={WARNA.kuning} style={{ filter: 'drop-shadow(0 8px 0 rgba(0,0,0,0.35))' }} />
        </div>
      )}
      {f >= M.teksAjak && (
        <div style={{ position: 'absolute', left: 70, width: 620, top: 1130, textAlign: 'left', fontFamily: FONT, opacity: Math.min(1, (f - M.teksAjak) / 5), transform: `scale(${0.92 + 0.08 * burst((f - M.teksAjak) / 7)})`, transformOrigin: '0 50%' }}>
          <div style={{ fontSize: 76, fontWeight: 800, color: '#fff', WebkitTextStroke: '7px #000', paintOrder: 'stroke fill', lineHeight: 1.08, textShadow: '0 8px 0 rgba(0,0,0,0.35)' }}>{TEKS_TUTUP_BESAR}</div>
        </div>
      )}
      {f >= M.teksAjak + 8 && (
        <div style={{ position: 'absolute', left: 70, width: 620, top: 1320, textAlign: 'left', fontFamily: FONT, opacity: Math.min(1, (f - M.teksAjak - 8) / 5), transform: `translateY(${(1 - burst((f - M.teksAjak - 8) / 8)) * 14}px)` }}>
          <div style={{ fontSize: 42, fontWeight: 700, color: WARNA.krem, WebkitTextStroke: '5px #000', paintOrder: 'stroke fill', lineHeight: 1.2, textShadow: '0 6px 0 rgba(0,0,0,0.3)' }}>{TEKS_TUTUP_KECIL}</div>
        </div>
      )}
      <Stempel teks={TEKS_STEMPEL} kena={M.stempelKena} sampai={1200} />
      {/* Lapisan tetap: pil dan logo pojok. */}
      <Pil teks={TEKS_PIL} dari={T.pil[0]} sampai={T.pil[1]} />
      <LogoPojok />
      <Grain kuat={0.028} />
      {/* ---------------- Audio ---------------- */}
      <Sequence from={0} layout="none">
        <Audio src={staticFile('aset/musik.wav')} volume={volumeMusik} />
      </Sequence>
      {/* Cold open: hantaman + jotos, burst, rewind. */}
      <Bunyi nama="jotos" dari={0} volume={0.9} />
      <Bunyi nama="kepentung" dari={0} volume={0.6} />
      <Bunyi nama="a-whoosh" dari={M.burstWajah} volume={0.7} />
      <Bunyi nama="a-whoosh" dari={T.rewind[0]} volume={0.8} rate={0.7} />
      {/* Adegan 2: Bang IT datang, duduk, menaruh kopi, balon. */}
      <Bunyi nama="a-kursi-geser" dari={M.bangDuduk - 4} volume={0.7} />
      <Bunyi nama="letak" dari={M.bangDuduk + 12} volume={0.7} />
      <Bunyi nama="pop" dari={M.balonAman} volume={0.8} />
      {/* Adegan 3: pindai QR, beranda, nama, lobi. */}
      <Bunyi nama="a-whoosh" dari={T.qr[0]} volume={0.45} rate={1.2} />
      <Bunyi nama="klik" dari={M.qrPindai + 2} volume={0.6} />
      <Bunyi nama="notifikasi" dari={M.qrPindai + 26} volume={0.6} />
      <Bunyi nama="pop" dari={M.qrBeranda} volume={0.6} />
      <Bunyi nama="pop" dari={M.qrNama} volume={0.6} />
      <Bunyi nama="klik" dari={M.qrNama + 4} volume={0.35} />
      <Bunyi nama="klik" dari={M.qrNama + 8} volume={0.35} />
      <Bunyi nama="klik" dari={M.qrNama + 12} volume={0.35} />
      <Bunyi nama="pop" dari={M.qrLobi} volume={0.6} />
      <Bunyi nama="giliran" dari={M.qrLobi + 6} volume={0.4} />
      {/* Adegan 4: balon, jari naik, ketuk, buang. */}
      <Bunyi nama="pop" dari={M.balonBuang} volume={0.8} />
      <Bunyi nama="angkat" dari={M.angkatJari + 4} volume={0.6} />
      <Bunyi nama="a-ketukhp" dari={M.ketukHp + 2} volume={0.9} />
      <Bunyi nama="buang" dari={M.ketukHp + 4} volume={0.9} />
      <Bunyi nama="a-whoosh" dari={M.tolehKamera} volume={0.35} rate={1.4} />
      {/* Adegan 5: seruput, ketuk tanpa melihat, mulung, bahaya. */}
      <Bunyi nama="a-seruput" dari={M.seruput} volume={0.8} />
      <Bunyi nama="a-ketukhp" dari={M.ketukOwner + 1} volume={0.8} />
      <Bunyi nama="mulung" dari={M.ketukOwner + 3} volume={0.9} />
      <Bunyi nama="bahaya" dari={M.captionPungut + 16} volume={0.8} />
      <Bunyi nama="pop" dari={M.captionPungut} volume={0.6} />
      {/* Adegan 6: cangkir diletakkan, kendang tegang (dipotong), hening, ketukan. */}
      <Bunyi nama="letak" dari={M.letakCangkir} volume={0.7} />
      <Bunyi nama="tegang" dari={M.letakCangkir - 6} volume={0.9} lama={M.heningMulai - (M.letakCangkir - 6)} />
      <Bunyi nama="a-ketukhp" dari={M.ketukNutup} volume={1} />
      <Bunyi nama="letak" dari={M.ketukNutup + 4} volume={0.6} />
      {/* Adegan 7: pentungan dibuka (joker), jotos, kursi terjengkang, gebrak. */}
      <Bunyi nama="balik" dari={M.retak - 4} volume={0.7} />
      <Bunyi nama="mentungJoker" dari={M.retak} volume={1} />
      <Bunyi nama="jotos" dari={M.retak + 2} volume={1} />
      <Bunyi nama="kepentung" dari={M.retak + 2} volume={0.7} />
      <Bunyi nama="a-kursi" dari={M.terpental + 2} volume={0.95} />
      <Bunyi nama="a-gebrak" dari={M.gebrak} volume={0.95} />
      <Bunyi nama="a-gebrak-kecil" dari={M.gebrak + 3} volume={0.5} />
      {/* Adegan 8: HP disodorkan, ledekan besar (notifikasi game), balon Noob. */}
      <Bunyi nama="a-whoosh" dari={M.sodorHp + 4} volume={0.45} />
      <Bunyi nama="notifikasi" dari={M.sodorHp + 16} volume={0.8} />
      <Bunyi nama="pop" dari={M.balonNoob} volume={0.8} />
      {/* Adegan 9: montase. */}
      <Bunyi nama="a-whoosh" dari={M.montaseA} volume={0.5} rate={1.3} />
      <Bunyi nama="pop" dari={M.montaseA + 2} volume={0.8} />
      <Bunyi nama="mentung" dari={M.montaseA + 26} volume={0.7} />
      <Bunyi nama="jotosLain" dari={M.montaseA + 28} volume={0.9} />
      <Bunyi nama="a-whoosh" dari={M.montaseB} volume={0.45} rate={1.3} />
      <Bunyi nama="jotosLain" dari={M.montaseB + 12} volume={0.85} />
      <Bunyi nama="kepentung" dari={M.montaseB + 12} volume={0.4} />
      <Bunyi nama="a-whoosh" dari={M.montaseC} volume={0.45} rate={1.3} />
      <Bunyi nama="a-seruput" dari={M.montaseC + 18} volume={0.7} />
      <Bunyi nama="a-krak" dari={M.krakGelas} volume={0.9} />
      <Bunyi nama="a-gebrak" dari={M.krakGelas + 10} volume={0.6} />
      {/* Penutup: tarik mundur, sorak, teks, stempel. */}
      <Bunyi nama="a-whoosh" dari={T.tutup[0]} volume={0.5} rate={0.9} />
      <Bunyi nama="sorak" dari={T.tutup[0] + 20} volume={0.6} />
      <Bunyi nama="menang" dari={T.tutup[0] + 24} volume={0.5} />
      <Bunyi nama="pop" dari={M.teksAjak} volume={0.8} />
      <Bunyi nama="pop" dari={M.teksAjak + 8} volume={0.5} />
      <Bunyi nama="a-dok" dari={M.stempelKena} volume={1} />
      <Bunyi nama="klik" dari={M.lirikKamera + 6} volume={0.4} />
    </AbsoluteFill>
  );
};

/** Panah kuning di koordinat layar HP (390 × 844), tergambar dari (x1,y1) ke (x2,y2). */
const PanahLayar: React.FC<{ dari: number; sampai: number; x1: number; y1: number; x2: number; y2: number }> = ({ dari, sampai, x1, y1, x2, y2 }) => {
  const f = useCurrentFrame();
  if (f < dari || f >= sampai) return null;
  const t = Math.min(1, (f - dari) / 14);
  const mx = (x1 + x2) / 2;
  const my = (y1 + y2) / 2;
  const dx = x2 - x1;
  const dy = y2 - y1;
  const cx = mx - dy * 0.35;
  const cy = my + dx * 0.35;
  const panjang = Math.hypot(dx, dy) * 1.25;
  const sudut = (Math.atan2(y2 - cy, x2 - cx) * 180) / Math.PI;
  const o = f >= sampai - 6 ? (sampai - f) / 6 : 1;
  return (
    <svg width={390} height={844} style={{ position: 'absolute', left: 0, top: 0, opacity: o }}>
      <defs>
        <filter id="glowPanahLayar" x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur stdDeviation="4" result="b" />
          <feMerge>
            <feMergeNode in="b" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>
      <g filter="url(#glowPanahLayar)">
        <path d={`M ${x1} ${y1} Q ${cx} ${cy} ${x2} ${y2}`} fill="none" stroke="#f1a615" strokeWidth={7} strokeLinecap="round" strokeDasharray={panjang} strokeDashoffset={panjang * (1 - burst(t))} />
        {t >= 0.95 && (
          <g transform={`translate(${x2} ${y2}) rotate(${sudut})`}>
            <path d="M 0 0 L -22 -14 L -16 0 L -22 14 Z" fill="#f1a615" />
          </g>
        )}
      </g>
    </svg>
  );
};

