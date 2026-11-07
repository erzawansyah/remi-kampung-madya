// Baca promo/public/rekam/rekam-a.json dan cetak momen kunci tiap klip dalam detik video: kartu Kamu dibuang,
// dipungut pementung, pentungan diletakkan tertutup, retak, panel mentung. Hasilnya disalin ke src/a/rekam.ts.
//
// Pakai: node promo/scripts/rekam/momen-a.mjs [a1|a2]
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const promo = join(dirname(fileURLToPath(import.meta.url)), '../..');
const semua = JSON.parse(readFileSync(join(promo, 'public/rekam/rekam-a.json'), 'utf8'));
const pilih = process.argv[2];
const kartu = (k) => `${k.rank}${k.bunga}${k.deck ? '#' + k.deck : ''}`;

for (const [nama, d] of Object.entries(semua)) {
  if (pilih && pilih !== nama) continue;
  const momen = d.momen;
  const diterima = momen.filter((m) => m.jenis === 'log');
  const tampil = momen.filter((m) => m.jenis === 'tampil');
  const peristiwa = momen.filter((m) => m.jenis === 'peristiwa').map((m) => ({ detik: m.detik, ...JSON.parse(m.isi) }));
  /** Waktu tampil untuk peristiwa yang diterima di detik `t`: entri log yang diterima bersamaan → entri tampil seindeks. */
  const waktuTampil = (t) => {
    let idx = -1;
    for (let i = 0; i < diterima.length; i++) if (Math.abs(diterima[i].detik - t) < 0.06) idx = i;
    if (idx < 0) for (let i = 0; i < diterima.length; i++) if (diterima[i].detik <= t + 0.06) idx = i;
    return idx >= 0 && tampil[idx] ? tampil[idx].detik : null;
  };
  const kamu = d.kamu;
  const mentung = peristiwa.filter((p) => p.jenis === 'mentung').at(-1);
  const mulungAkhir = mentung ? peristiwa.filter((p) => p.jenis === 'mulung' && p.pemain === mentung.pemain && p.detik <= mentung.detik).at(-1) : null;
  const buangAkhir = mentung ? peristiwa.filter((p) => p.jenis === 'buang' && p.pemain === mentung.pemain && p.detik <= mentung.detik + 0.5).at(-1) : null;
  const korban = mentung?.kepentung ?? [];
  // Kartu yang dipungut: cari buangan Kamu (atau korban) yang ikut dipungut.
  const dipungut = mulungAkhir?.kartu ?? [];
  const kartuKamu = dipungut.find((k) => k.pemilik === kamu) ?? dipungut.find((k) => korban.includes(k.pemilik));
  let buangKamu = null;
  if (kartuKamu) {
    buangKamu = peristiwa.filter((p) => p.jenis === 'buang' && p.pemain === kartuKamu.pemilik && p.kartu && kartu(p.kartu) === kartu(kartuKamu) && p.detik <= (mulungAkhir?.detik ?? 1e9)).at(-1) ?? null;
  }
  const retak = momen.find((m) => m.jenis === 'retak');
  const panel = momen.find((m) => m.jenis === 'panelMentung');
  const hasil = momen.find((m) => m.jenis === 'hasilTampil');
  const luar = Object.fromEntries((d.momenLuar ?? []).filter((m) => m.detikVideo !== undefined).map((m) => [m.nama ?? m.jenis, m.detikVideo]));
  console.log(`== ${nama}: seed ${d.seed}, kode ${d.kode}, ${d.lamaDetik} dtk, cocok ${d.cocok}`);
  console.log(`   hasil: ${d.hasil.cara} pementung ${d.hasil.pementung} kepentung ${d.hasil.kepentung.join(',')} pentungan ${d.hasil.pentungan ? kartu(d.hasil.pentungan) : '-'} joker ${d.hasil.pentunganJoker} (rank joker ${d.hasil.rankJoker})`);
  console.log(`   lobi: ${JSON.stringify(luar)}`);
  if (buangKamu) console.log(`   buang kartu ${kartu(kartuKamu)} oleh kursi ${buangKamu.pemain}: diterima ${buangKamu.detik}, tampil ${waktuTampil(buangKamu.detik)}`);
  else console.log(`   (buangan korban tidak ketemu; dipungut: ${dipungut.map((k) => kartu(k) + '@' + k.pemilik).join(' ')})`);
  if (mulungAkhir) console.log(`   mulung pementung (${dipungut.length} kartu): diterima ${mulungAkhir.detik}, tampil ${waktuTampil(mulungAkhir.detik)}`);
  if (buangAkhir) console.log(`   pentungan diletakkan: diterima ${buangAkhir.detik}, tampil ${waktuTampil(buangAkhir.detik)}`);
  if (mentung) console.log(`   peristiwa mentung diterima ${mentung.detik}, tampil ${waktuTampil(mentung.detik)}`);
  console.log(`   retak ${retak?.detik ?? '-'}, panelMentung ${panel?.detik ?? '-'}, hasilTampil ${hasil?.detik ?? '-'}`);
  console.log('   log tampil:');
  for (const t of tampil) if (/mungut|nutup|MENTUNG|mentung|buang|pentung/i.test(t.log)) console.log(`     ${t.detik}  ${t.log}`);
}
