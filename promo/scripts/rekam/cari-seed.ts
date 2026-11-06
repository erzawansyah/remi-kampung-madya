// Cari seed permainan 4 orang (Dimas, Ayu, Rendi, Kamu) yang putaran pertamanya cocok untuk cerita:
// kursi `pementung` mentung dan kursi `korban` kepentung. Semua kursi dimainkan pemain otomatis
// (otomatis.ts) lewat server game asli, jadi hasilnya sama dengan saat direkam di browser.
//
// Pakai: npx tsx promo/scripts/rekam/cari-seed.ts [dari] [sampai] [pementung] [korban]
import WebSocket from 'ws';
import { aturSeed, nyalakanServer } from './meja-rekam.ts';
import { aksiOtomatis } from './otomatis.ts';
import type { ViewPemain, HasilPutaran } from '../../../packages/engine/src/index.ts';

export const NAMA = ['Dimas', 'Ayu', 'Rendi', 'Kamu'];
export const PENGATURAN = { jumlahPemain: 4, detikGiliran: 0, publik: false, batasPutaran: 1, duaDeckUntukEmpat: false };

const [dari, sampai, pementung, korban] = process.argv.slice(2).map(Number);
const PORT = 2599;
const server = await nyalakanServer(PORT, dari);

interface Hasil {
  seed: number;
  hasil: HasilPutaran | null;
  aksi: number;
  log: string[];
}

function mainkan(seed: number): Promise<Hasil> {
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
    const siapPutaran = new Set<string>();
    const sambung = (i: number) => {
      const s = new WebSocket(`ws://127.0.0.1:${PORT}/ws`);
      soket[i] = s;
      s.on('open', () => {
        if (i === 0) s.send(JSON.stringify({ t: 'buat', nama: NAMA[0], pengaturan: PENGATURAN }));
        else s.send(JSON.stringify({ t: 'gabung', kode, nama: NAMA[i] }));
      });
      s.on('message', (data) => {
        const m = JSON.parse(String(data));
        if (m.t === 'masuk' && i === 0) {
          kode = m.kode;
          sambung(1);
        } else if (m.t === 'masuk' && i < 3) sambung(i + 1);
        else if (m.t === 'masuk' && i === 3) setTimeout(() => soket[0].send(JSON.stringify({ t: 'mulai', pengocok: 0 })), 50);
        else if (m.t === 'error' && !String(m.pesan).includes('Belum giliran')) {
          /* abaikan penolakan sesekali; cukup dicatat */
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

const cocok: Hasil[] = [];
for (let seed = dari; seed <= sampai; seed++) {
  const h = await mainkan(seed);
  const r = h.hasil;
  if (!r) continue;
  const ok = r.cara === 'mentung' && r.pementung === pementung && r.kepentung.includes(korban);
  if (ok) {
    cocok.push(h);
    console.log(
      `seed ${seed}: ${h.aksi} aksi, joker ${r.rankJoker}, pentungan ${r.pentungan?.rank}${r.pentungan?.bunga}${r.pentunganJoker ? ' (JOKER)' : ''}, kepentung ${r.kepentung.join(',')}, skor ${r.skorAkumulasi.join('/')}`,
    );
  }
}
console.log(`selesai: ${cocok.length} cocok`);
await server.tutup();
process.exit(0);
