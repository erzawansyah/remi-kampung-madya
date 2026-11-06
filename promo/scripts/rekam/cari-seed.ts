// Cari seed permainan yang putaran pertamanya cocok untuk cerita (konfig.ts): kursi `pementung`
// mentung dan kursi `korban` kepentung. Semua kursi manusia dimainkan pemain otomatis (otomatis.ts)
// lewat server game asli; kursi bot (R2, R3) diisi host lewat aturKursi sebelum mulai. Hasilnya sama
// dengan saat direkam di browser, karena Math.random dan seed permainan sama-sama ditetapkan.
//
// Pakai: npx tsx promo/scripts/rekam/cari-seed.ts <r1|r2|r3> [dari] [sampai]
// Keluaran: daftar seed cocok diurutkan (pendek, hanya korban yang kepentung, bonus joker).
import WebSocket from 'ws';
import { aturSeed, nyalakanServer } from './meja-rekam.ts';
import { aksiOtomatis } from './otomatis.ts';
import { KLIP, PENGATURAN } from './konfig.ts';
import type { ViewPemain, HasilPutaran } from '../../../packages/engine/src/index.ts';

const klipNama = (process.argv[2] ?? 'r1') as keyof typeof KLIP;
const [dari, sampai] = process.argv.slice(3).map(Number);
const K = KLIP[klipNama];
if (!K || !Number.isFinite(dari) || !Number.isFinite(sampai)) {
  console.error('pakai: cari-seed.ts <r1|r2|r3> <dari> <sampai>');
  process.exit(1);
}
const PORT = Number(process.env.PORT_CARI ?? 2599);
const server = await nyalakanServer(PORT, dari, 5);

interface Hasil {
  seed: number;
  hasil: HasilPutaran | null;
  aksi: number;
  log: string[];
}

export function mainkan(seed: number): Promise<Hasil> {
  aturSeed(seed);
  return new Promise((selesai) => {
    let aksi = 0;
    let beres = false;
    const soket: WebSocket[] = [];
    const tutup = (h: HasilPutaran | null, log: string[] = []) => {
      if (beres) return;
      beres = true;
      clearTimeout(batas);
      soket.forEach((s) => s.close());
      selesai({ seed, hasil: h, aksi, log });
    };
    const batas = setTimeout(() => tutup(null), 20000);
    let kode = '';
    const terakhir = K.nama.length - 1;
    const siapPutaran = new Set<string>();
    const sambung = (i: number) => {
      const s = new WebSocket(`ws://127.0.0.1:${PORT}/ws`);
      soket[i] = s;
      s.on('open', () => {
        if (i === 0) s.send(JSON.stringify({ t: 'buat', nama: K.nama[0], pengaturan: PENGATURAN }));
        else s.send(JSON.stringify({ t: 'gabung', kode, nama: K.nama[i] }));
      });
      s.on('message', (data) => {
        const m = JSON.parse(String(data));
        if (m.t === 'masuk' && i === 0) {
          kode = m.kode;
          sambung(1);
        } else if (m.t === 'masuk' && i < terakhir) sambung(i + 1);
        else if (m.t === 'masuk' && i === terakhir) {
          // Urutan ini harus sama persis dengan perekam browser: isi kursi bot, lalu mulai (pengocok 0).
          setTimeout(() => {
            if (K.bot) soket[0].send(JSON.stringify({ t: 'aturKursi', kursi: K.bot.kursi, jenis: 'bot', level: K.bot.level }));
            setTimeout(() => soket[0].send(JSON.stringify({ t: 'mulai', pengocok: 0 })), 50);
          }, 50);
        } else if (m.t === 'view') {
          const v = m.view as ViewPemain;
          if ((v.status === 'putaranSelesai' || v.status === 'selesai') && v.riwayat.length) {
            if (i === 0) tutup(v.riwayat[0], v.log.map((l) => (typeof l === 'string' ? l : (l as { teks: string }).teks)));
            return;
          }
          const kunci = `${i}:${v.riwayat.length}`;
          if (v.status === 'putaranBerjalan' && !siapPutaran.has(kunci)) {
            siapPutaran.add(kunci);
            s.send(JSON.stringify({ t: 'siapJoker' }));
          }
          const a = aksiOtomatis(v);
          if (a) {
            aksi++;
            setTimeout(() => s.send(JSON.stringify({ t: 'aksi', aksi: a })), 5);
          }
        }
      });
    };
    sambung(0);
  });
}

/** Nilai seed: makin kecil makin baik (brief §4.2: cocok, pendek, korban saja, bonus joker). */
function nilai(h: Hasil): number {
  const r = h.hasil!;
  return h.aksi + (r.kepentung.length - 1) * 20 - (r.pentunganJoker ? 8 : 0);
}

const cocok: Hasil[] = [];
let selesaiMain = 0;
let gagal = 0;
for (let seed = dari; seed <= sampai; seed++) {
  const h = await mainkan(seed);
  const r = h.hasil;
  if (!r) {
    gagal++;
    continue;
  }
  selesaiMain++;
  if (process.env.DEBUG_CARI) console.log(`seed ${seed}: ${r.cara} pementung ${r.pementung} kepentung ${r.kepentung.join(',')} (${h.aksi} aksi)`);
  const ok = r.cara === 'mentung' && r.pementung === K.pementung && r.kepentung.includes(K.korban);
  if (ok) {
    cocok.push(h);
    console.log(
      `seed ${seed}: ${h.aksi} aksi, joker ${r.rankJoker}, pentungan ${r.pentungan?.rank}${r.pentungan?.bunga}${r.pentunganJoker ? ' (JOKER)' : ''}, kepentung ${r.kepentung.join(',')}, skor ${r.skorAkumulasi.join('/')}`,
    );
  }
}
cocok.sort((a, b) => nilai(a) - nilai(b));
console.log(`selesai: ${cocok.length} cocok untuk ${klipNama} (${selesaiMain} selesai, ${gagal} gagal/timeout)`);
for (const h of cocok.slice(0, 8)) {
  const r = h.hasil!;
  console.log(`  #${h.seed} nilai ${nilai(h)}: ${h.aksi} aksi, kepentung ${r.kepentung.join(',')}${r.pentunganJoker ? ', JOKER' : ''}`);
}
await server.tutup();
process.exit(0);
