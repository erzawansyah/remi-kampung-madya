// Arena warga kedai: mengadu level bot di banyak permainan ber-seed untuk MENGUKUR kekuatannya dan
// seberapa gampang buangannya dibaca.
//
//   npx tsx packages/engine/scripts/arena.ts                       # jago & suhu & mudah vs normal, semua meja
//   npx tsx packages/engine/scripts/arena.ts --uji=suhu --lawan=jago
//   npx tsx packages/engine/scripts/arena.ts --susunan=suhu,jago,normal,mudah --meja=4
//   npx tsx packages/engine/scripts/arena.ts --waktu                # ukur lama tiap keputusan bot
//   npx tsx packages/engine/scripts/arena.ts --kaldu --putaran=3    # mode kaldu: putaran ke-3 dst. kaldu
//   npx tsx packages/engine/scripts/arena.ts --uji=normal,suhu --gaya=semua --lawan=normal:acak
//   npx tsx packages/engine/scripts/arena.ts --seed=20 --meja=4     # uji cepat (±1 menit di 4 CPU)
//
// Jalan di Node 22 dan 24 (dicoba juga di 20 dan 25). Pekerja (worker thread) tidak ikut mendapat
// loader tsx dari proses utama di semua versi Node (di Node 22.22 impor '.js' → '.ts' gagal dengan
// ERR_MODULE_NOT_FOUND), jadi tiap pekerja dibuka lewat kode pembuka kecil yang mendaftarkan tsx
// (`tsx/esm/api`) dulu, baru mengimpor berkas ini. Lihat buatPekerja().
//
// Peserta ditulis "level" atau "level:gaya" (contoh "jago", "suhu:standar", "normal:acak"). Gaya
// standar = perilaku yang sudah ada, dan labelnya level saja, jadi keluaran lama tidak berubah.
// "acak" memberi tiap kursi gaya non-standar dari seed dan urutan kursinya di susunan (kursi ikut
// berputar bersama pesertanya): DAFTAR_GAYA[1 + ((seed·7 + kursi·3) mod (panjang − 1))]. Selama
// belum ada gaya selain standar, "acak" dimainkan sebagai standar (dicetak catatannya).
//
// Opsi: --uji=a,b (peserta yang diuji, satu kursi), --lawan=normal (peserta kursi lain),
// --gaya=a,b|semua (dikalikan dengan --uji; --uji harus level polos), --susunan=... (isi meja
// sendiri; mengganti --uji/--lawan, jumlah pemain = panjangnya), --meja=2,3,4,4d,5,6
// (4d = 4 pemain 2 deck), --seed=200 (jumlah seed per meja), --seedAwal=1, --putaran=4,
// --pekerja=<jumlah CPU − 1>, --waktu, --baca (tambah samaStandar di baris "baca:"), --kaldu (mode
// kaldu #42: putaran ke-N, N = --putaran, dan seterusnya putaran kaldu; permainan selesai saat
// putaran kaldu ditutup mentung, jadi panjangnya beda-beda).
//
// Cara menghitung: setiap seed dimainkan dengan susunan level diputar ke semua kursi (kursi dan
// pengocok tidak menguntungkan siapa pun), lalu selisih "skor rata-rata level A − skor rata-rata
// level B" per seed jadi satu sampel. Selang kepercayaan 95% = rata-rata ± 1,96 × sd / √n.
// Semua deterministik: seed yang sama selalu memberi angka yang sama.
//
// Baris "baca:" di bawah tiap peserta: metrik keterbacaan (L|iso, As|boleh, londoDini,
// giliranLondo1, nyambung, disuap, entropiAwal; definisinya di keterbacaan.ts), angka dalam kurung
// = jumlah kejadian penyebutnya. Di akhir dicetak lagi gabungan semua meja per peserta.

import { availableParallelism } from 'node:os';
import { isMainThread, parentPort, Worker, workerData } from 'node:worker_threads';
import { performance } from 'node:perf_hooks';
import {
  buatPermainan,
  pilihAksiBot,
  Rng,
  terapkanAksi,
  viewUntuk,
  type Aksi,
  type GameState,
  type LevelBot,
  type ViewPemain,
} from '../src/index.js';
import { barisBaca, PencatatBaca, ringkas, statBacaKosong, type StatBaca } from './keterbacaan.js';
import {
  GAYA_ACAK,
  GAYA_STANDAR,
  gayaUntukKursi,
  silangGaya,
  uraiDaftarGaya,
  uraiPeserta,
  type Peserta,
} from './peserta.js';

/** Gaya yang dikenal arena, 'standar' wajib di indeks 0. C2: isi dengan DAFTAR_GAYA_BOT dari engine. */
const DAFTAR_GAYA: readonly string[] = [GAYA_STANDAR];

/** Adaptor: pilihAksiBot belum menerima gaya. C2 cukup mengganti baris return di bawah. */
function pilihAksi(view: ViewPemain, level: LevelBot, rng: Rng, gaya: string): Aksi {
  void gaya; // C2: return pilihAksiBot(view, level, rng, gaya as GayaBot);
  return pilihAksiBot(view, level, rng);
}

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
  susunan: Peserta[];
  seed: number;
  putaran: number;
  waktu: boolean;
  /** --baca: bandingkan aksi peserta bergaya dengan aksi standar di view yang sama. */
  baca: boolean;
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
  /** Per label peserta: jumlah skor, mentung, dll. untuk seed ini (semua rotasi digabung). */
  perLevel: Record<string, StatLevel>;
  /** Per label peserta: penghitung keterbacaan seed ini. */
  baca: Record<string, StatBaca>;
  putaran: number;
  deckHabis: number;
  waktu: Record<string, { ember: number[]; maks: number; jumlah: number }>;
}

function mainkanSatu(t: Tugas, rotasi: number, hasil: HasilTugas): void {
  const { meja } = t;
  // Kursi i diisi peserta ke-(i + rotasi) di susunan; gaya "acak" ditentukan dari urutan itu.
  const urutan = Array.from({ length: meja.n }, (_, i) => (i + rotasi) % meja.n);
  const peserta = urutan.map((j) => t.susunan[j]);
  const level = peserta.map((x) => x.level);
  const label = peserta.map((x) => x.label);
  const gaya = peserta.map((x, i) => gayaUntukKursi(x.gaya, t.seed, urutan[i], DAFTAR_GAYA));
  const pencatat = new PencatatBaca((kursi) => hasil.baca[label[kursi]]);
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
    // --baca: aksi standar di view yang sama, dengan salinan rng supaya permainan tidak bergeser.
    // Susun akhir tanpa gaya, jadi hanya putaran berjalan yang dibandingkan.
    const banding =
      t.baca && gaya[siapa] !== GAYA_STANDAR && g.status === 'putaranBerjalan'
        ? JSON.stringify(pilihAksi(view, level[siapa], new Rng(rng.state), GAYA_STANDAR))
        : null;
    const mulai = t.waktu ? performance.now() : 0;
    const aksi = pilihAksi(view, level[siapa], rng, gaya[siapa]);
    if (t.waktu) {
      const lama = performance.now() - mulai;
      const w = (hasil.waktu[label[siapa]] ??= { ember: Array(JUMLAH_EMBER).fill(0), maks: 0, jumlah: 0 });
      w.ember[Math.min(JUMLAH_EMBER - 1, Math.floor(lama / LEBAR_EMBER))]++;
      w.maks = Math.max(w.maks, lama);
      w.jumlah++;
    }
    if (banding !== null) {
      const s = hasil.baca[label[siapa]];
      s.samaB++;
      if (JSON.stringify(aksi) === banding) s.samaA++;
    }
    return aksi;
  };
  while (g.status !== 'selesai') {
    let aksi: Aksi;
    if (g.status === 'putaranBerjalan') aksi = pilih(g.putaran!.giliran);
    else if (g.status === 'susunAkhir') {
      const belum = g.putaran!.selesaiSusun.map((x, i) => (x ? -1 : i)).filter((i) => i >= 0);
      aksi = pilih(rng.pick(belum));
    } else aksi = { jenis: 'mulaiPutaran' };
    if (aksi.jenis === 'buang') pencatat.sebelumBuang(g, aksi);
    const h = terapkanAksi(g, aksi);
    if (!h.ok) {
      throw new Error(`aksi ${JSON.stringify(label)} ditolak (${meja.label}, seed ${t.seed}): ${JSON.stringify(aksi)} → ${h.error.pesan}`);
    }
    g = h.state;
    if (++langkah > 50000) throw new Error(`permainan tidak selesai (${meja.label}, seed ${t.seed})`);
  }
  pencatat.akhir(g);
  for (const r of g.riwayat) {
    hasil.putaran++;
    if (r.cara === 'deckHabis') hasil.deckHabis++;
    for (const x of r.rincian) {
      const s = hasil.perLevel[label[x.pemain]];
      if (x.status === 'mentung') {
        s.mentung++;
        s.pentungan += x.nilaiPentungan;
      }
      if (x.status === 'kepentung') s.kepentung++;
      s.jokerDibuang += x.jumlahJokerDibuang;
    }
  }
  g.skor.forEach((x, i) => {
    hasil.perLevel[label[i]].skor += x;
    hasil.perLevel[label[i]].kursi++;
  });
}

function jalankanTugas(t: Tugas): HasilTugas {
  const hasil: HasilTugas = { perLevel: {}, baca: {}, putaran: 0, deckHabis: 0, waktu: {} };
  for (const l of new Set(t.susunan.map((x) => x.label))) {
    hasil.perLevel[l] = { skor: 0, mentung: 0, pentungan: 0, kepentung: 0, jokerDibuang: 0, kursi: 0 };
    hasil.baca[l] = statBacaKosong();
  }
  for (let r = 0; r < t.meja.n; r++) mainkanSatu(t, r, hasil);
  return hasil;
}

function opsi(nama: string, bawaan: string): string {
  const a = process.argv.find((x) => x.startsWith(`--${nama}=`));
  return a ? a.slice(nama.length + 3) : bawaan;
}

const peserta = (x: string) => uraiPeserta(x, DAFTAR_GAYA);

/**
 * Pekerja yang memuat berkas ini. Kode pembukanya mendaftarkan tsx di thread pekerja dulu, karena
 * loader tsx dari proses utama tidak selalu ikut ke worker thread. execArgv dikosongkan supaya di
 * Node yang sudah meneruskan loader ke pekerja, tsx tidak terdaftar dua kali.
 */
function buatPekerja(data: Tugas[]): Worker {
  const apiTsx = import.meta.resolve('tsx/esm/api');
  const pembuka =
    `import(${JSON.stringify(apiTsx)})` +
    `.then((m) => { m.register(); return import(${JSON.stringify(import.meta.url)}); });`;
  return new Worker(pembuka, { eval: true, workerData: data, execArgv: [] });
}

const f1 = (x: number) => (x >= 0 ? '+' : '') + x.toFixed(1);

async function utama(): Promise<void> {
  const putaran = Number(opsi('putaran', '4'));
  const jumlahSeed = Number(opsi('seed', '200'));
  const seedAwal = Number(opsi('seedAwal', '1'));
  const waktu = process.argv.includes('--waktu');
  const kaldu = process.argv.includes('--kaldu');
  const baca = process.argv.includes('--baca');
  if (DAFTAR_GAYA[0] !== GAYA_STANDAR) throw new Error('DAFTAR_GAYA harus diawali standar');
  const pekerja = Number(opsi('pekerja', String(Math.max(1, availableParallelism() - 1))));
  const daftarMeja = opsi('meja', '2,3,4,4d,5,6').split(',').map((k) => {
    const m = SEMUA_MEJA[k];
    if (!m) throw new Error(`meja tidak dikenal: ${k}`);
    return m;
  });
  const susunanSendiri = opsi('susunan', '');
  const teksGaya = opsi('gaya', '');
  if (teksGaya && susunanSendiri) throw new Error('--gaya hanya untuk --uji, tulis gayanya langsung di --susunan');
  const lawan = peserta(opsi('lawan', 'normal'));
  const diuji = silangGaya(
    opsi('uji', 'mudah,jago,suhu').split(',').map(peserta),
    teksGaya ? uraiDaftarGaya(teksGaya, DAFTAR_GAYA) : null,
  );

  // Daftar percobaan: (meja, susunan peserta). Susunan diputar ke semua kursi.
  const percobaan: { meja: Meja; susunan: Peserta[] }[] = [];
  if (susunanSendiri) {
    // Jumlah pemain = panjang susunan: hanya meja --meja yang ukurannya cocok (mis. 4 dan 4d untuk
    // susunan 4 level). Tidak ada yang cocok (termasuk --meja bawaan): satu meja seukuran susunan.
    const s = susunanSendiri.split(',').map(peserta);
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
      semuaTugas.push({ i, t: { meja: c.meja, susunan: c.susunan, seed: s, putaran, waktu, kaldu, baca } });
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
          const w = buatPekerja(isi.map((x) => x.t));
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
  console.log('Selisih = skor per putaran level uji − rata-rata level pembanding di meja yang sama (CI 95%).');
  if (DAFTAR_GAYA.length < 2 && percobaan.some((c) => c.susunan.some((x) => x.gaya === GAYA_ACAK))) {
    console.log('Catatan: belum ada gaya selain standar, jadi peserta "acak" dimainkan dengan gaya standar.');
  }
  console.log('');
  const bacaGabung: Record<string, StatBaca[]> = {};
  const waktuGabung: Record<string, { ember: number[]; maks: number; jumlah: number }> = {};
  percobaan.forEach((c, i) => {
    const hs = hasilPer[i];
    const levelUnik = [...new Set(c.susunan.map((x) => x.label))];
    const totalPutaran = hs.reduce((s, h) => s + h.putaran, 0);
    const deckHabis = hs.reduce((s, h) => s + h.deckHabis, 0);
    console.log(
      `${c.meja.label} [${c.susunan.map((x) => x.label).join(', ')}]: ${totalPutaran} putaran, deck habis ${((100 * deckHabis) / totalPutaran).toFixed(0)}%`,
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
      const sampelBaca = hs.map((h) => h.baca[l]);
      console.log(`    ${barisBaca(sampelBaca, baca)}`);
      (bacaGabung[l] ??= []).push(...sampelBaca);
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
  console.log('\nKeterbacaan gabungan semua meja (satu sampel = satu seed di satu percobaan):');
  for (const [l, sampel] of Object.entries(bacaGabung)) {
    console.log(`  ${l.padEnd(7)} ${barisBaca(sampel, baca)}`);
  }
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
