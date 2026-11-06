// Teaser Reels (9:16, ±42 detik) Remi Kampung Madya.
// Dua tujuan: memperkenalkan Kedai Madya sebagai tempat main remi, dan mengintip game-nya tanpa
// membuka alamatnya (versi online belum dibuka untuk umum). Penutup mengajak main langsung di kedai.
// Ceritanya diambil dari putaran sungguhan (meja lokal DRRS8, 3 pemain, joker 6): pemain baru membuang
// 8 Wajik, Mbak Teras (warga kedai) memungutnya jadi 8-9-10 Wajik dengan 6 Waru sebagai 9, lalu mentung
// pakai 6 Wajik. Itu joker, jadi pentungannya 250, dan skor si pemain baru −290 (tangan 40 + 250).
// Semua yang tampil sesuai aturan di README; label "→9" memang terlihat semua orang di meja (keputusan #25).
import type { ReactNode } from 'react';
import { AbsoluteFill, Audio, Img, interpolate, Easing, Sequence, spring, staticFile, useCurrentFrame, useVideoConfig } from 'remotion';
import { Arang, FONT, H, Kartu, Keterangan, Laken, Logo, Sorak, W, WARNA, type IdKartu } from './bagian';

export const FPS = 30;

/** Awal tiap adegan (frame) dan panjangnya. */
const URUTAN = [
  ['kedai', 165],
  ['buka', 120],
  ['joker', 84],
  ['kembar', 84],
  ['londo', 84],
  ['cerita', 60],
  ['buang', 80],
  ['mungut', 74],
  ['mentung', 100],
  ['skor', 90],
  ['warga', 110],
  ['tutup', 200],
] as const;
type NamaAdegan = (typeof URUTAN)[number][0];
const ADEGAN = (() => {
  const a = {} as Record<NamaAdegan, { dari: number; lama: number }>;
  let dari = 0;
  for (const [nama, lama] of URUTAN) {
    a[nama] = { dari, lama };
    dari += lama;
  }
  return a;
})();
export const DURASI_TEASER = ADEGAN.tutup.dari + ADEGAN.tutup.lama;

const jepit = { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' } as const;
const lerp = (f: number, dari: [number, number], ke: [number, number], easing = Easing.out(Easing.cubic)) =>
  interpolate(f, dari, ke, { ...jepit, easing });

/** Pegas mulai di frame `mulai`. */
function usePegas(mulai: number, config: Parameters<typeof spring>[0]['config'] = { damping: 14, stiffness: 140 }) {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  return (geser = 0) => spring({ frame: f - mulai - geser, fps, config });
}

/** Masuk-keluar halus tiap adegan (pudar 6 frame di awal dan akhir). */
const Pudar: React.FC<{ lama: number; children: ReactNode; awal?: boolean }> = ({ lama, children, awal = true }) => {
  const f = useCurrentFrame();
  const o = Math.min(awal ? lerp(f, [0, 6], [0, 1]) : 1, lerp(f, [lama - 6, lama], [1, 0]));
  return <AbsoluteFill style={{ opacity: o }}>{children}</AbsoluteFill>;
};

const Bunyi: React.FC<{ nama: string; dari: number; volume?: number }> = ({ nama, dari, volume = 1 }) => (
  <Sequence from={dari} layout="none">
    <Audio src={staticFile(`aset/bunyi-${nama}.wav`)} volume={volume} />
  </Sequence>
);

// ---------------------------------------------------------------------------------------------
// 1. Pembuka: kartu dikocok dan disebar, judul.
// ---------------------------------------------------------------------------------------------
const Pembuka: React.FC = () => {
  const f = useCurrentFrame();
  const pegas = usePegas(0, { damping: 15, stiffness: 120 });
  const n = 7;
  const judul = pegas(14);
  return (
    <Pudar lama={ADEGAN.buka.lama}>
      <Laken>
        {Array.from({ length: n }, (_, i) => {
          const p = pegas(i * 2);
          const tengah = i - (n - 1) / 2;
          return (
            <Kartu
              key={i}
              kartu={null}
              lebar={300}
              x={540 + tengah * 70 * p}
              y={interpolate(p, [0, 1], [2300, 1180 + Math.abs(tengah) ** 2 * 9])}
              rot={tengah * 9 * p + (1 - p) * 40}
            />
          );
        })}
        <div
          style={{
            position: 'absolute',
            top: 300,
            width: W,
            textAlign: 'center',
            fontFamily: FONT,
            opacity: judul,
            transform: `translateY(${(1 - judul) * 40}px)`,
          }}
        >
          <div style={{ fontSize: 80, fontWeight: 700, color: WARNA.krem, textShadow: '0 6px 0 rgba(0,0,0,0.3)' }}>Di sini sering main</div>
          <div
            style={{
              fontSize: 210,
              fontWeight: 800,
              lineHeight: 0.95,
              color: WARNA.kuning,
              textShadow: '0 10px 0 rgba(0,0,0,0.4)',
            }}
          >
            REMI
          </div>
          <div style={{ fontSize: 56, fontWeight: 700, color: WARNA.krem, marginTop: 30, opacity: lerp(f, [44, 54], [0, 1]) }}>
            Aturannya aturan tongkrongan,
          </div>
          <div style={{ fontSize: 56, fontWeight: 700, color: WARNA.emasMuda, opacity: lerp(f, [62, 72], [0, 1]) }}>beda dari remi biasa.</div>
        </div>
      </Laken>
    </Pudar>
  );
};

// ---------------------------------------------------------------------------------------------
// 0. Kedai Madya: logo, bio dari IG/Threads, alamat (semuanya dari apps/client/src/konten/kedai.ts).
// ---------------------------------------------------------------------------------------------
const Kedai: React.FC = () => {
  const f = useCurrentFrame();
  const pegas = usePegas(0, { damping: 14, stiffness: 110 });
  const logo = pegas();
  const muncul = (mulai: number) => ({ opacity: lerp(f, [mulai, mulai + 10], [0, 1]), transform: `translateY(${lerp(f, [mulai, mulai + 12], [30, 0])}px)` });
  return (
    <Pudar lama={ADEGAN.kedai.lama} awal={false}>
      <Arang>
        <AbsoluteFill style={{ alignItems: 'center', fontFamily: FONT, textAlign: 'center' }}>
          <Logo varian="lengkap" lebar={780} warna={WARNA.kuning} style={{ marginTop: 400, opacity: logo, transform: `scale(${0.75 + 0.25 * logo})` }} />
          <div style={{ marginTop: 90, fontSize: 64, fontWeight: 700, color: WARNA.krem, ...muncul(28) }}>Tempat ngopi dan madhang santai.</div>
          <div style={{ marginTop: 12, fontSize: 64, fontWeight: 700, color: WARNA.kuning, ...muncul(52) }}>Kipasnya ada dua.</div>
          <div
            style={{
              marginTop: 70,
              padding: '16px 34px 8px',
              borderRadius: 999,
              border: `3px solid ${WARNA.emasMuda}`,
              fontSize: 42,
              fontWeight: 600,
              color: WARNA.emasMuda,
              ...muncul(84),
            }}
          >
            Jl. Raya Tegalgondo, Junrejo, Kota Batu
          </div>
        </AbsoluteFill>
      </Arang>
    </Pudar>
  );
};

// ---------------------------------------------------------------------------------------------
// 2. Joker diumumkan sekali, lalu kartunya tertutup lagi.
// ---------------------------------------------------------------------------------------------
const Joker: React.FC = () => {
  const f = useCurrentFrame();
  const pegas = usePegas(0);
  const masuk = pegas();
  const buka = lerp(f, [12, 24], [0, 1], Easing.inOut(Easing.cubic)) - lerp(f, [46, 58], [0, 1], Easing.inOut(Easing.cubic));
  const kedua = f >= 46;
  return (
    <Pudar lama={ADEGAN.joker.lama}>
      <Laken>
        <Keterangan
          judul={kedua ? 'Habis itu, ingat sendiri.' : 'Joker cuma diumumkan sekali.'}
          geser={kedua ? lerp(f, [46, 54], [20, 0]) : (1 - masuk) * 30}
          opacity={kedua ? lerp(f, [46, 52], [0, 1]) : Math.min(masuk, lerp(f, [40, 46], [1, 0]))}
        />
        <Kartu kartu="waru-6" lebar={400} x={540} y={1060} skala={0.6 + 0.4 * masuk} buka={buka} angkat={0.3 * Math.sin(Math.PI * Math.min(1, buka))} />
      </Laken>
    </Pudar>
  );
};

// ---------------------------------------------------------------------------------------------
// 2b. Aturan singkat dengan kartu: kembar As, seri Londo (README, "Kartu jadi" dan "Joker").
// ---------------------------------------------------------------------------------------------
const MULAI_KARTU_ATURAN = 10;
const JEDA_KARTU_ATURAN = 5;

const Aturan: React.FC<{ lama: number; judul: string; sub: string; kartu: IdKartu[] }> = ({ lama, judul, sub, kartu }) => {
  const f = useCurrentFrame();
  const pegas = usePegas(MULAI_KARTU_ATURAN, { damping: 13, stiffness: 150 });
  const jarak = kartu.length > 3 ? 228 : 270;
  const lebar = kartu.length > 3 ? 212 : 250;
  return (
    <Pudar lama={lama}>
      <Laken>
        <Keterangan judul={judul} sub={sub} opacity={lerp(f, [2, 10], [0, 1])} subOpacity={lerp(f, [30, 40], [0, 1])} />
        {kartu.map((k, i) => {
          const p = pegas(i * JEDA_KARTU_ATURAN);
          const t = i - (kartu.length - 1) / 2;
          return <Kartu key={k} kartu={k} lebar={lebar} x={540 + t * jarak} y={interpolate(p, [0, 1], [2300, 1130])} rot={(1 - p) * (t * 20 + 10)} angkat={(1 - Math.min(1, p)) * 0.6} />;
        })}
      </Laken>
    </Pudar>
  );
};

const KARTU_KEMBAR: IdKartu[] = ['love-1', 'wajik-1', 'kriting-1', 'waru-1'];
const KARTU_LONDO: IdKartu[] = ['waru-11', 'waru-12', 'waru-13'];

const KembarAs: React.FC = () => <Aturan lama={ADEGAN.kembar.lama} judul="As cuma boleh kembar." sub="3 atau 4 As, bunganya beda semua." kartu={KARTU_KEMBAR} />;
const Londo: React.FC = () => <Aturan lama={ADEGAN.londo.lama} judul="Londo cuma J-Q-K." sub="Satu bunga, joker nggak bisa gantiin." kartu={KARTU_LONDO} />;

// ---------------------------------------------------------------------------------------------
// 2c. Judul cerita.
// ---------------------------------------------------------------------------------------------
const Cerita: React.FC = () => {
  const f = useCurrentFrame();
  const p = usePegas(0)();
  return (
    <Pudar lama={ADEGAN.cerita.lama}>
      <Laken>
        <Keterangan top={700} judul="Main pertamaku…" sub="lawan dua warga kedai." geser={(1 - p) * 30} opacity={p} subOpacity={lerp(f, [14, 24], [0, 1])} />
      </Laken>
    </Pudar>
  );
};

// ---------------------------------------------------------------------------------------------
// 3. Tangan: 8 Wajik dibuang.
// ---------------------------------------------------------------------------------------------
const TANGAN: IdKartu[] = ['wajik-2', 'wajik-3', 'love-4', 'love-11', 'love-12', 'wajik-8'];
const BUANGAN = { x: 540, y: 880 };

function posisiTangan(i: number, n: number) {
  const t = i - (n - 1) / 2;
  return { x: 540 + t * 132, y: 1400 + t * t * 7, rot: t * 4.5 };
}

const Buangan: React.FC<{ opacity?: number }> = ({ opacity = 1 }) => (
  <div
    style={{
      position: 'absolute',
      left: BUANGAN.x - 150,
      top: BUANGAN.y - 210,
      width: 300,
      height: 420,
      borderRadius: 24,
      border: '5px dashed rgba(251,246,234,0.28)',
      opacity,
    }}
  />
);

const Buang: React.FC = () => {
  const f = useCurrentFrame();
  const pegas = usePegas(0, { damping: 16, stiffness: 130 });
  const terbang = lerp(f, [30, 46], [0, 1], Easing.inOut(Easing.cubic));
  return (
    <Pudar lama={ADEGAN.buang.lama}>
      <Laken>
        <Keterangan judul="Kubuang 8 Wajik." sub="Aman, kan?" opacity={lerp(f, [4, 12], [0, 1])} subOpacity={lerp(f, [48, 56], [0, 1])} />
        <Buangan />
        {TANGAN.map((k, i) => {
          const p = pegas(i * 2);
          const pos = posisiTangan(i, TANGAN.length);
          const masukY = interpolate(p, [0, 1], [2200, pos.y]);
          if (k !== 'wajik-8') return <Kartu key={k} kartu={k} lebar={190} x={pos.x} y={masukY} rot={pos.rot} />;
          const naik = lerp(f, [18, 26], [0, 1]);
          const yAngkat = masukY - naik * 70;
          // Lengkung terbang ke buangan (seperti di meja).
          const x = interpolate(terbang, [0, 1], [pos.x, BUANGAN.x]);
          const y = interpolate(terbang, [0, 1], [yAngkat, BUANGAN.y]) - Math.sin(Math.PI * terbang) * 160;
          return (
            <Kartu
              key={k}
              kartu={k}
              lebar={interpolate(terbang, [0, 1], [190, 270])}
              x={x}
              y={y}
              rot={interpolate(terbang, [0, 1], [pos.rot, 6])}
              angkat={Math.max(naik * 0.35, Math.sin(Math.PI * terbang) * 0.8)}
            />
          );
        })}
      </Laken>
    </Pudar>
  );
};

// ---------------------------------------------------------------------------------------------
// 4. Mbak Teras mungut: 8 Wajik jadi 8-9-10 Wajik (6 Waru jadi 9).
// ---------------------------------------------------------------------------------------------
const BARIS_Y = 900;
const LEBAR_JADI = 250;
const JARAK_JADI = 272;

const LabelJoker: React.FC<{ teks: string; skala: number }> = ({ teks, skala }) => (
  <div
    style={{
      position: 'absolute',
      left: '50%',
      bottom: -34,
      transform: `translateX(-50%) scale(${skala})`,
      background: WARNA.kuning,
      color: WARNA.tinta,
      fontFamily: FONT,
      fontWeight: 800,
      fontSize: 50,
      lineHeight: 1,
      padding: '8px 22px 2px',
      borderRadius: 999,
      boxShadow: '0 6px 14px rgba(0,0,0,0.4)',
    }}
  >
    {teks}
  </div>
);

const BarisJadi: React.FC<{ f: number; y?: number; skala?: number; label?: number }> = ({ f, y = BARIS_Y, skala = 1, label = 1 }) => {
  const geser = lerp(f, [8, 22], [0, 1], Easing.inOut(Easing.cubic));
  const masuk = (mulai: number) => lerp(f, [mulai, mulai + 14], [0, 1], Easing.out(Easing.back(1.4)));
  const x = (i: number) => 540 + (i - 1) * JARAK_JADI * skala;
  const lebar = LEBAR_JADI * skala;
  return (
    <>
      <Kartu
        kartu="wajik-8"
        lebar={interpolate(geser, [0, 1], [270, lebar])}
        x={interpolate(geser, [0, 1], [BUANGAN.x, x(0)])}
        y={interpolate(geser, [0, 1], [BUANGAN.y, y])}
        rot={interpolate(geser, [0, 1], [6, 0])}
        angkat={Math.sin(Math.PI * geser) * 0.5}
      />
      <Kartu kartu="waru-6" lebar={lebar} x={x(1)} y={interpolate(masuk(12), [0, 1], [-300, y])} rot={(1 - masuk(12)) * -25}>
        <LabelJoker teks="→9" skala={label} />
      </Kartu>
      <Kartu kartu="wajik-10" lebar={lebar} x={x(2)} y={interpolate(masuk(16), [0, 1], [-300, y])} rot={(1 - masuk(16)) * 25} />
    </>
  );
};

const Mungut: React.FC = () => {
  const f = useCurrentFrame();
  return (
    <Pudar lama={ADEGAN.mungut.lama} awal={false}>
      <Laken>
        <Buangan opacity={lerp(f, [4, 14], [1, 0])} />
        <Keterangan judul="Mbak Teras mungut." sub="Jadi 8-9-10 Wajik." opacity={lerp(f, [2, 10], [0, 1])} subOpacity={lerp(f, [34, 42], [0, 1])} />
        <BarisJadi f={f} label={lerp(f, [30, 40], [0, 1], Easing.out(Easing.back(2)))} />
      </Laken>
    </Pudar>
  );
};

// ---------------------------------------------------------------------------------------------
// 5. Mentung: pentungan tertutup, kendang tegang, dibuka: joker. Kepentung, layar retak.
// ---------------------------------------------------------------------------------------------
const BUKA_PENTUNGAN = 41; // = mentungJoker di rangkaian bunyi (1,2 detik sesudah 'tegang' di frame 4)
const JOTOS = 52;

const Mentung: React.FC = () => {
  const f = useCurrentFrame();
  const pegas = usePegas(6, { damping: 11, stiffness: 170 });
  const jatuh = pegas();
  const buka = lerp(f, [BUKA_PENTUNGAN - 2, BUKA_PENTUNGAN + 6], [0, 1], Easing.inOut(Easing.cubic));
  // Getar makin rapat selama tegang, lalu sentakan besar saat kena.
  const tegang = lerp(f, [12, BUKA_PENTUNGAN], [0, 1], Easing.in(Easing.quad)) * (f < BUKA_PENTUNGAN ? 1 : 0);
  const gemetar = Math.sin(f * 2.7) * 7 * tegang;
  const sentak = f >= JOTOS ? Math.exp(-(f - JOTOS) / 5) : 0;
  const goyangX = Math.sin(f * 3.1) * 38 * sentak;
  const goyangY = Math.cos(f * 2.3) * 30 * sentak;
  const retak = f >= JOTOS ? lerp(f, [JOTOS, JOTOS + 4], [0, 1]) : 0;
  const kilat = f >= JOTOS ? Math.exp(-(f - JOTOS) / 6) : 0;
  const joker = spring({ frame: f - BUKA_PENTUNGAN - 2, fps: FPS, config: { damping: 9, stiffness: 200 } });
  const kena = spring({ frame: f - JOTOS - 3, fps: FPS, config: { damping: 9, stiffness: 180 } });
  return (
    <Pudar lama={ADEGAN.mentung.lama} awal={false}>
      <Laken>
        <AbsoluteFill style={{ transform: `translate(${goyangX}px, ${goyangY}px) scale(${1 + sentak * 0.04})` }}>
          <Keterangan judul="Lalu dia mentung…" opacity={lerp(f, [0, 6], [0, 1]) * lerp(f, [BUKA_PENTUNGAN - 4, BUKA_PENTUNGAN], [1, 0])} />
          <BarisJadi f={60} y={interpolate(lerp(f, [0, 12], [0, 1]), [0, 1], [BARIS_Y, 660])} skala={interpolate(lerp(f, [0, 12], [0, 1]), [0, 1], [1, 0.78])} />
          <Kartu
            kartu="wajik-6"
            lebar={340}
            x={540 + gemetar}
            y={interpolate(jatuh, [0, 1], [-400, 1240])}
            rot={interpolate(jatuh, [0, 1], [-30, -3]) + gemetar * 0.3}
            buka={buka}
            angkat={Math.sin(Math.PI * buka) * 0.6}
          />
          <Sorak teks="JOKER!" ukuran={150} x={540} y={420} skala={joker} opacity={f >= BUKA_PENTUNGAN + 2 ? 1 : 0} />
          <div
            style={{
              position: 'absolute',
              left: 540 + 120,
              top: 1240 - 330,
              transform: `scale(${joker}) rotate(8deg)`,
              background: WARNA.kuning,
              color: WARNA.tinta,
              fontFamily: FONT,
              fontWeight: 800,
              fontSize: 78,
              lineHeight: 1,
              padding: '14px 30px 4px',
              borderRadius: 999,
              boxShadow: '0 10px 24px rgba(0,0,0,0.5)',
              opacity: f >= BUKA_PENTUNGAN + 2 ? 1 : 0,
            }}
          >
            250
          </div>
        </AbsoluteFill>
        {/* Kilatan merah dan retakan kaca (efek kepentung #56, gambar retakan dari efek/retak.ts). */}
        <AbsoluteFill style={{ background: 'radial-gradient(circle at 50% 46%, rgba(255,60,40,0.0) 20%, rgba(200,20,10,0.75) 100%)', opacity: kilat }} />
        <AbsoluteFill style={{ background: '#fff', opacity: kilat * 0.35 }} />
        <Img src={staticFile('aset/retak.png')} style={{ position: 'absolute', inset: 0, width: W, height: H, opacity: retak, transform: `scale(${1 + 0.05 * (1 - retak)})` }} />
        <Sorak teks="KEPENTUNG!" ukuran={140} x={540} y={1630} rot={3} skala={kena} warna={WARNA.merah} opacity={f >= JOTOS + 3 ? 1 : 0} />
      </Laken>
    </Pudar>
  );
};

// ---------------------------------------------------------------------------------------------
// 6. Skor dan kutipan kedai.
// ---------------------------------------------------------------------------------------------
const Skor: React.FC = () => {
  const f = useCurrentFrame();
  const pegas = usePegas(4);
  const angka = Math.round(lerp(f, [6, 26], [0, 290]));
  const kutip = usePegas(34, { damping: 16, stiffness: 120 })();
  return (
    <Pudar lama={ADEGAN.skor.lama}>
      <Laken style={{ filter: 'brightness(0.6)' }} />
      <Img src={staticFile('aset/retak.png')} style={{ position: 'absolute', inset: 0, width: W, height: H, opacity: lerp(f, [0, 30], [0.5, 0.15]) }} />
      <AbsoluteFill style={{ fontFamily: FONT, textAlign: 'center', color: WARNA.krem, alignItems: 'center' }}>
        <div style={{ marginTop: 420, fontSize: 70, fontWeight: 700, opacity: pegas() }}>Main pertama, skorku</div>
        <div
          style={{
            fontSize: 260,
            fontWeight: 800,
            lineHeight: 1,
            marginTop: 10,
            color: WARNA.merah,
            transform: `scale(${0.7 + 0.3 * pegas()})`,
            textShadow: '0 12px 0 rgba(0,0,0,0.4)',
            fontVariantNumeric: 'tabular-nums',
          }}
        >
          {/* Minus tipografis (U+2212), seperti di aplikasi. */}
          {angka === 0 ? '0' : `−${angka}`}
        </div>
        <div
          style={{
            marginTop: 120,
            padding: '36px 48px 28px',
            maxWidth: 860,
            background: 'rgba(29,26,22,0.88)',
            border: `4px solid ${WARNA.kuning}`,
            borderRadius: 36,
            opacity: kutip,
            transform: `translateY(${(1 - kutip) * 50}px) rotate(-1.5deg)`,
          }}
        >
          <div style={{ fontSize: 78, fontWeight: 800, color: WARNA.krem, lineHeight: 1.1 }}>“Kartu itu bundar, kak.”</div>
          <div style={{ fontSize: 44, fontWeight: 600, color: WARNA.kuning, marginTop: 14 }}>Kedai Madya</div>
        </div>
      </AbsoluteFill>
    </Pudar>
  );
};

// ---------------------------------------------------------------------------------------------
// 7. Warga kedai (nama dari NAMA_LAWAN_BAWAAN, ejaan persis). Gaya mainnya tidak disebut (#47).
// ---------------------------------------------------------------------------------------------
const NAMA_WARGA = ['Kipas Dua', 'Cak Kopag', 'Mbak Teras', 'Mas Sampul', 'Si Rak', 'Pak Seng', 'Dik Toska', 'Ning Sore', 'Om Garpu', 'Bu Sendok'];
const MULAI_NAMA = 12;
const JEDA_NAMA = 4;

const Warga: React.FC = () => {
  const f = useCurrentFrame();
  const pegas = usePegas(MULAI_NAMA, { damping: 10, stiffness: 180 });
  return (
    <Pudar lama={ADEGAN.warga.lama}>
      <Laken>
        <Keterangan judul="Lawannya warga kedai." sub="Tiap warga punya kebiasaan sendiri." opacity={lerp(f, [0, 8], [0, 1])} subOpacity={lerp(f, [56, 66], [0, 1])} />
        <div
          style={{
            position: 'absolute',
            top: 620,
            left: 70,
            right: 70,
            display: 'flex',
            flexWrap: 'wrap',
            justifyContent: 'center',
            gap: 26,
            fontFamily: FONT,
          }}
        >
          {NAMA_WARGA.map((n, i) => {
            const p = pegas(i * JEDA_NAMA);
            return (
              <div
                key={n}
                style={{
                  padding: '18px 34px 8px',
                  borderRadius: 999,
                  background: i % 3 === 0 ? WARNA.kuning : 'rgba(251,246,234,0.94)',
                  color: WARNA.tinta,
                  fontSize: 60,
                  fontWeight: 800,
                  transform: `scale(${p}) rotate(${((i * 37) % 9) - 4}deg)`,
                  boxShadow: '0 10px 22px rgba(0,0,0,0.35)',
                }}
              >
                {n}
              </div>
            );
          })}
        </div>
      </Laken>
    </Pudar>
  );
};

// ---------------------------------------------------------------------------------------------
// 8. Penutup: game diintip saja (versi online belum dibuka untuk umum), ajakan main di kedai.
// ---------------------------------------------------------------------------------------------
const Penutup: React.FC = () => {
  const f = useCurrentFrame();
  const pegas = usePegas(0, { damping: 14, stiffness: 120 });
  const judul = pegas(6);
  const muncul = (mulai: number) => ({ opacity: lerp(f, [mulai, mulai + 12], [0, 1]), transform: `translateY(${lerp(f, [mulai, mulai + 14], [30, 0])}px)` });
  return (
    <Pudar lama={ADEGAN.tutup.lama}>
      <Arang>
        {[-1, 1].map((s) => (
          <Kartu key={s} kartu={null} lebar={260} x={540 + s * 520} y={1560} rot={s * 18} opacity={0.45} />
        ))}
        <AbsoluteFill style={{ alignItems: 'center', fontFamily: FONT, textAlign: 'center' }}>
          <div
            style={{
              marginTop: 330,
              fontSize: 128,
              fontWeight: 800,
              lineHeight: 1,
              color: WARNA.krem,
              opacity: judul,
              transform: `scale(${0.8 + 0.2 * judul})`,
              textShadow: '0 8px 0 rgba(0,0,0,0.4)',
            }}
          >
            Remi
            <br />
            Kampung Madya
          </div>
          <div style={{ marginTop: 40, fontSize: 60, fontWeight: 700, color: WARNA.kuning, ...muncul(26) }}>Versi online-nya lagi disiapkan.</div>
          <div style={{ marginTop: 90, fontSize: 52, fontWeight: 600, color: WARNA.krem, lineHeight: 1.25, ...muncul(64) }}>
            Sementara itu,
            <br />
            main langsung di
          </div>
          <Logo varian="lengkap" lebar={560} warna={WARNA.kuning} style={{ marginTop: 34, ...muncul(76) }} />
          <div style={{ marginTop: 44, fontSize: 44, fontWeight: 600, color: WARNA.emasMuda, ...muncul(96) }}>@kedaimadya · Junrejo, Kota Batu</div>
        </AbsoluteFill>
      </Arang>
    </Pudar>
  );
};

// ---------------------------------------------------------------------------------------------

export const Teaser: React.FC = () => {
  const { durationInFrames } = useVideoConfig();
  const m = ADEGAN.mentung.dari;
  // Musik latar aplikasi (efek/musik.ts, gaya beranda), diredam saat pentungan dibuka seperti di meja.
  const volumeMusik = (f: number) =>
    interpolate(f, [0, 20, durationInFrames - 45, durationInFrames - 2], [0, 0.55, 0.55, 0], jepit) *
    interpolate(f, [m + BUKA_PENTUNGAN - 4, m + BUKA_PENTUNGAN, m + JOTOS + 30, m + JOTOS + 60], [1, 0.15, 0.15, 1], jepit);
  const isi: Record<NamaAdegan, React.FC> = {
    kedai: Kedai,
    buka: Pembuka,
    joker: Joker,
    kembar: KembarAs,
    londo: Londo,
    cerita: Cerita,
    buang: Buang,
    mungut: Mungut,
    mentung: Mentung,
    skor: Skor,
    warga: Warga,
    tutup: Penutup,
  };
  const b = ADEGAN.buka.dari;
  return (
    <AbsoluteFill style={{ background: WARNA.arangPekat }}>
      {URUTAN.map(([k]) => {
        const Isi = isi[k];
        return (
          <Sequence key={k} from={ADEGAN[k].dari} durationInFrames={ADEGAN[k].lama} name={k}>
            <Isi />
          </Sequence>
        );
      })}
      <Audio src={staticFile('aset/musik.wav')} volume={volumeMusik} />
      <Bunyi nama="kocok" dari={b} />
      <Bunyi nama="kocok" dari={b + 12} volume={0.7} />
      <Bunyi nama="balik" dari={ADEGAN.joker.dari + 12} />
      <Bunyi nama="balik" dari={ADEGAN.joker.dari + 46} />
      {(['kembar', 'londo'] as const).flatMap((k) =>
        (k === 'kembar' ? KARTU_KEMBAR : KARTU_LONDO).map((_, i) => (
          <Bunyi key={`${k}${i}`} nama="letak" dari={ADEGAN[k].dari + MULAI_KARTU_ATURAN + 8 + i * JEDA_KARTU_ATURAN} volume={0.8} />
        )),
      )}
      {[0, 2, 4, 6, 8, 10].map((g, i) => (
        <Bunyi key={g} nama="bagi" dari={ADEGAN.buang.dari + g} volume={0.6 + i * 0.05} />
      ))}
      <Bunyi nama="buang" dari={ADEGAN.buang.dari + 44} />
      <Bunyi nama="mulung" dari={ADEGAN.mungut.dari + 8} />
      <Bunyi nama="letak" dari={ADEGAN.mungut.dari + 24} />
      <Bunyi nama="pentungJoker" dari={m + 4} />
      <Bunyi nama="jotos" dari={m + JOTOS - 1} />
      {NAMA_WARGA.map((n, i) => (
        <Bunyi key={n} nama="klik" dari={ADEGAN.warga.dari + MULAI_NAMA + i * JEDA_NAMA} volume={1} />
      ))}
      <Bunyi nama="giliran" dari={ADEGAN.tutup.dari + 26} volume={0.8} />
    </AbsoluteFill>
  );
};
