// Arena warga kedai: mengadu level bot di banyak permainan ber-seed untuk MENGUKUR kekuatannya.
//
//   npx tsx packages/engine/scripts/arena.ts                       # jago & suhu & mudah vs normal, semua meja
//   npx tsx packages/engine/scripts/arena.ts --uji=suhu --lawan=jago
//   npx tsx packages/engine/scripts/arena.ts --susunan=suhu,jago,normal,mudah --meja=4
//   npx tsx packages/engine/scripts/arena.ts --waktu                # ukur lama tiap keputusan bot
//   npx tsx packages/engine/scripts/arena.ts --kaldu --putaran=3    # mode kaldu: putaran ke-3 dst. kaldu
//
// Opsi: --uji=a,b (level yang diuji, satu kursi), --lawan=normal (level kursi lain), --susunan=...
// (isi meja sendiri; mengganti --uji/--lawan, jumlah pemain = panjangnya), --meja=2,3,4,4d,5,6
// (4d = 4 pemain 2 deck), --seed=200 (jumlah seed per meja), --seedAwal=1, --putaran=4,
// --pekerja=<jumlah CPU − 1>, --waktu, --kaldu (mode kaldu #42: putaran ke-N, N = --putaran, dan
// seterusnya putaran kaldu; permainan selesai saat putaran kaldu ditutup mentung, jadi panjangnya beda-beda).
//
// Cara menghitung: setiap seed dimainkan dengan susunan level diputar ke semua kursi (kursi dan
// pengocok tidak menguntungkan siapa pun), lalu selisih "skor rata-rata level A − skor rata-rata
// level B" per seed jadi satu sampel. Selang kepercayaan 95% = rata-rata ± 1,96 × sd / √n.
// Semua deterministik: seed yang sama selalu memberi angka yang sama.

import { availableParallelism } from 'node:os';
import { isMainThread, parentPort, Worker, workerData } from 'node:worker_threads';
import { performance } from 'node:perf_hooks';
import {
  buatPermainan,
  DAFTAR_LEVEL_BOT,
  pilihAksiBot,
  Rng,
  terapkanAksi,
  viewUntuk,
  type Aksi,
  type GameState,
  type LevelBot,
} from '../src/index.js';

interface Meja {
  label: string;
  n: number;
  duaDeck: boolean;
}

const SEMUA_MEJA: Record<string, Meja> = {
  '2': { label: '2 pemain', n: 2, duaDeck: false },
  '3': { label: '3 pemain', n: 3, duaDeck: false },
  '4': { label: '4 pemain', n: 4, duaDeck: false },
  '4d': { label: '4 pemain 2 deck', n: 4, duaDeck: true },
  '5': { label: '5 pemain', n: 5, duaDeck: false },
  '6': { label: '6 pemain', n: 6, duaDeck: false },
};

interface Tugas {
  meja: Meja;
  susunan: LevelBot[];
  seed: number;
  putaran: number;
  waktu: boolean;
  /** Mode kaldu (#42): batas putaran memicu putaran kaldu, bukan mengakhiri permainan. */
  kaldu: boolean;
}

/** Ember histogram waktu keputusan: 0,05 ms per ember sampai 200 ms. */
const LEBAR_EMBER = 0.05;
const JUMLAH_EMBER = 4000;

interface StatLevel {
  skor: number;
  mentung: number;
  pentungan: number;
  kepentung: number;
  jokerDibuang: number;
  kursi: number;
}

interface HasilTugas {
  /** Per level: jumlah skor, mentung, dll. untuk seed ini (semua rotasi digabung). */
  perLevel: Record<string, StatLevel>;
  putaran: number;
  deckHabis: number;
  waktu: Record<string, { ember: number[]; maks: number; jumlah: number }>;
}

function mainkanSatu(t: Tugas, rotasi: number, hasil: HasilTugas): void {
  const { meja } = t;
  const level = Array.from({ length: meja.n }, (_, i) => t.susunan[(i + rotasi) % meja.n]);
  let g: GameState = buatPermainan({
    pemain: level.map((l, i) => `${l} ${i + 1}`),
    seed: t.seed,
    konfigurasi: {
      duaDeckUntukEmpat: meja.duaDeck,
      batasPutaran: t.putaran,
      batasSkorAtas: null,
      batasSkorBawah: null,
      ...(t.kaldu ? { modeKaldu: true } : {}),
    },
  });
  const rng = new Rng(t.seed * 7919 + 1 + rotasi * 104729);
  let langkah = 0;
  const pilih = (siapa: number): Aksi => {
    const view = viewUntuk(g, siapa);
    if (!t.waktu) return pilihAksiBot(view, level[siapa], rng);
    const mulai = performance.now();
    const aksi = pilihAksiBot(view, level[siapa], rng);
    const lama = performance.now() - mulai;
    const w = (hasil.waktu[level[siapa]] ??= { ember: Array(JUMLAH_EMBER).fill(0), maks: 0, jumlah: 0 });
    w.ember[Math.min(JUMLAH_EMBER - 1, Math.floor(lama / LEBAR_EMBER))]++;
    w.maks = Math.max(w.maks, lama);
    w.jumlah++;
    return aksi;
  };
  while (g.status !== 'selesai') {
    let aksi: Aksi;
    if (g.status === 'putaranBerjalan') aksi = pilih(g.putaran!.giliran);
    else if (g.status === 'susunAkhir') {
      const belum = g.putaran!.selesaiSusun.map((x, i) => (x ? -1 : i)).filter((i) => i >= 0);
      aksi = pilih(rng.pick(belum));
    } else aksi = { jenis: 'mulaiPutaran' };
    const h = terapkanAksi(g, aksi);
    if (!h.ok) {
      throw new Error(`aksi ${JSON.stringify(level)} ditolak (${meja.label}, seed ${t.seed}): ${JSON.stringify(aksi)} → ${h.error.pesan}`);
    }
    g = h.state;
    if (++langkah > 50000) throw new Error(`permainan tidak selesai (${meja.label}, seed ${t.seed})`);
  }
  for (const r of g.riwayat) {
    hasil.putaran++;
    if (r.cara === 'deckHabis') hasil.deckHabis++;
    for (const x of r.rincian) {
      const s = hasil.perLevel[level[x.pemain]];
      if (x.status === 'mentung') {
        s.mentung++;
        s.pentungan += x.nilaiPentungan;
      }
      if (x.status === 'kepentung') s.kepentung++;
      s.jokerDibuang += x.jumlahJokerDibuang;
    }
  }
  g.skor.forEach((x, i) => {
    hasil.perLevel[level[i]].skor += x;
    hasil.perLevel[level[i]].kursi++;
  });
}

function jalankanTugas(t: Tugas): HasilTugas {
  const hasil: HasilTugas = { perLevel: {}, putaran: 0, deckHabis: 0, waktu: {} };
  for (const l of new Set(t.susunan)) {
    hasil.perLevel[l] = { skor: 0, mentung: 0, pentungan: 0, kepentung: 0, jokerDibuang: 0, kursi: 0 };
  }
  for (let r = 0; r < t.meja.n; r++) mainkanSatu(t, r, hasil);
  return hasil;
}

function opsi(nama: string, bawaan: string): string {
  const a = process.argv.find((x) => x.startsWith(`--${nama}=`));
  return a ? a.slice(nama.length + 3) : bawaan;
}

function cekLevel(x: string): LevelBot {
  if (!(DAFTAR_LEVEL_BOT as readonly string[]).includes(x)) throw new Error(`level tidak dikenal: ${x}`);
  return x as LevelBot;
}

interface Ringkas {
  rata: number;
  ci: number;
  n: number;
}

function ringkas(xs: number[]): Ringkas {
  const n = xs.length;
  const rata = xs.reduce((s, x) => s + x, 0) / n;
  const varian = n > 1 ? xs.reduce((s, x) => s + (x - rata) ** 2, 0) / (n - 1) : 0;
  return { rata, ci: (1.96 * Math.sqrt(varian)) / Math.sqrt(n), n };
}

const f1 = (x: number) => (x >= 0 ? '+' : '') + x.toFixed(1);

async function utama(): Promise<void> {
  const putaran = Number(opsi('putaran', '4'));
  const jumlahSeed = Number(opsi('seed', '200'));
  const seedAwal = Number(opsi('seedAwal', '1'));
  const waktu = process.argv.includes('--waktu');
  const kaldu = process.argv.includes('--kaldu');
  const pekerja = Number(opsi('pekerja', String(Math.max(1, availableParallelism() - 1))));
  const daftarMeja = opsi('meja', '2,3,4,4d,5,6').split(',').map((k) => {
    const m = SEMUA_MEJA[k];
    if (!m) throw new Error(`meja tidak dikenal: ${k}`);
    return m;
  });
  const susunanSendiri = opsi('susunan', '');
  const lawan = cekLevel(opsi('lawan', 'normal'));
  const diuji = opsi('uji', 'mudah,jago,suhu').split(',').map(cekLevel);

  // Daftar percobaan: (meja, susunan level). Susunan diputar ke semua kursi.
  const percobaan: { meja: Meja; susunan: LevelBot[] }[] = [];
  if (susunanSendiri) {
    // Jumlah pemain = panjang susunan: hanya meja --meja yang ukurannya cocok (mis. 4 dan 4d untuk
    // susunan 4 level). Tidak ada yang cocok (termasuk --meja bawaan): satu meja seukuran susunan.
    const s = susunanSendiri.split(',').map(cekLevel);
    const mejaS = SEMUA_MEJA[String(s.length)];
    if (!mejaS) throw new Error(`--susunan harus 2–6 level, dapat ${s.length}`);
    const cocok = daftarMeja.filter((m) => m.n === s.length);
    for (const meja of cocok.length ? cocok : [mejaS]) percobaan.push({ meja, susunan: s });
  } else {
    for (const meja of daftarMeja) {
      for (const x of diuji) percobaan.push({ meja, susunan: [x, ...Array(meja.n - 1).fill(lawan)] });
    }
  }
  const semuaTugas: { i: number; t: Tugas }[] = [];
  percobaan.forEach((c, i) => {
    for (let s = seedAwal; s < seedAwal + jumlahSeed; s++) {
      semuaTugas.push({ i, t: { meja: c.meja, susunan: c.susunan, seed: s, putaran, waktu, kaldu } });
    }
  });

  const mulai = performance.now();
  const hasilPer: HasilTugas[][] = percobaan.map(() => []);
  const k = Math.min(pekerja, semuaTugas.length);
  const bagian: { i: number; t: Tugas }[][] = Array.from({ length: k }, () => []);
  semuaTugas.forEach((x, j) => bagian[j % k].push(x));
  await Promise.all(
    bagian.map(
      (isi) =>
        new Promise<void>((selesai, gagal) => {
          const w = new Worker(new URL(import.meta.url), { workerData: isi.map((x) => x.t) });
          let j = 0;
          w.on('message', (m: HasilTugas | 'selesai') => {
            if (m === 'selesai') {
              void w.terminate();
              selesai();
            } else hasilPer[isi[j++].i].push(m);
          });
          w.on('error', gagal);
        }),
    ),
  );
  const detik = (performance.now() - mulai) / 1000;

  const jenisPermainan = kaldu ? `mode kaldu mulai putaran ${putaran}` : `${putaran} putaran per permainan`;
  console.log(`Arena: ${jumlahSeed} seed × rotasi kursi × ${jenisPermainan}, ${k} pekerja, ${detik.toFixed(1)} dtk.`);
  console.log('Selisih = skor per putaran level uji − rata-rata level pembanding di meja yang sama (CI 95%).\n');
  const waktuGabung: Record<string, { ember: number[]; maks: number; jumlah: number }> = {};
  percobaan.forEach((c, i) => {
    const hs = hasilPer[i];
    const levelUnik = [...new Set(c.susunan)];
    const totalPutaran = hs.reduce((s, h) => s + h.putaran, 0);
    const deckHabis = hs.reduce((s, h) => s + h.deckHabis, 0);
    console.log(
      `${c.meja.label} [${c.susunan.join(', ')}]: ${totalPutaran} putaran, deck habis ${((100 * deckHabis) / totalPutaran).toFixed(0)}%`,
    );
    // Rata-rata skor per kursi per putaran untuk tiap level. Satu rotasi kursi = satu permainan; di mode
    // kaldu panjang permainannya beda-beda, jadi dibagi rata-rata putaran per permainan tugas itu.
    const putaranPermainan = (h: HasilTugas) => h.putaran / c.meja.n;
    const perKursiPutaran = (h: HasilTugas, l: string) => h.perLevel[l].skor / h.perLevel[l].kursi / putaranPermainan(h);
    for (const l of levelUnik) {
      const r = ringkas(hs.map((h) => perKursiPutaran(h, l)));
      const st = hs.reduce(
        (a, h) => {
          const x = h.perLevel[l];
          const pk = a.pk + x.kursi * putaranPermainan(h);
          return { m: a.m + x.mentung, p: a.p + x.pentungan, k: a.k + x.kepentung, j: a.j + x.jokerDibuang, pk };
        },
        { m: 0, p: 0, k: 0, j: 0, pk: 0 },
      );
      const putaranKursi = st.pk;
      console.log(
        `  ${l.padEnd(7)} skor/putaran ${f1(r.rata).padStart(7)} ± ${r.ci.toFixed(1).padEnd(5)}` +
          ` mentung ${((100 * st.m) / putaranKursi).toFixed(1).padStart(5)}%` +
          ` (pentungan rata² ${st.m ? (st.p / st.m).toFixed(0) : '-'})` +
          ` kepentung ${((100 * st.k) / putaranKursi).toFixed(1).padStart(5)}%` +
          ` buang joker ${(st.j / putaranKursi).toFixed(3)}/putaran`,
      );
    }
    for (let a = 0; a < levelUnik.length; a++) {
      for (let b = a + 1; b < levelUnik.length; b++) {
        const r = ringkas(hs.map((h) => perKursiPutaran(h, levelUnik[a]) - perKursiPutaran(h, levelUnik[b])));
        const tanda = r.rata - r.ci > 0 ? '  (signifikan, lebih kuat)' : r.rata + r.ci < 0 ? '  (signifikan, lebih lemah)' : '';
        console.log(`  selisih ${levelUnik[a]} − ${levelUnik[b]}: ${f1(r.rata)} ± ${r.ci.toFixed(1)} per putaran${tanda}`);
      }
    }
    for (const h of hs) {
      for (const [l, w] of Object.entries(h.waktu)) {
        const g = (waktuGabung[l] ??= { ember: Array(JUMLAH_EMBER).fill(0), maks: 0, jumlah: 0 });
        w.ember.forEach((x, j) => (g.ember[j] += x));
        g.maks = Math.max(g.maks, w.maks);
        g.jumlah += w.jumlah;
      }
    }
  });
  if (waktu) {
    console.log('\nLama keputusan per aksi (ms, Node di mesin ini; perhitungan paralel bisa sedikit memperlambat):');
    for (const [l, w] of Object.entries(waktuGabung)) {
      const persentil = (q: number) => {
        let acc = 0;
        for (let j = 0; j < JUMLAH_EMBER; j++) {
          acc += w.ember[j];
          if (acc >= q * w.jumlah) return (j + 1) * LEBAR_EMBER;
        }
        return w.maks;
      };
      console.log(
        `  ${l.padEnd(7)} ${w.jumlah} keputusan: p50 ${persentil(0.5).toFixed(2)}, p90 ${persentil(0.9).toFixed(2)},` +
          ` p99 ${persentil(0.99).toFixed(2)}, p99.9 ${persentil(0.999).toFixed(2)}, maks ${w.maks.toFixed(2)}`,
      );
    }
  }
}

if (!isMainThread) {
  const tugas = workerData as Tugas[];
  for (const t of tugas) parentPort!.postMessage(jalankanTugas(t));
  parentPort!.postMessage('selesai');
} else {
  await utama();
}
