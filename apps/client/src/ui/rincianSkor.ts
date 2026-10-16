// Rincian skor dalam bentuk akordion: per putaran (diurutkan dari tertinggi), peringkat,
// klasemen akhir, dan log permainan per putaran. Murni presentasi: skor dari mesin aturan
// ditampilkan apa adanya, tidak ada yang dihitung ulang.

import {
  daftarNama,
  namaKartu,
  namaRank,
  nilaiKartuDiMeja,
  PENGALI_KALDU,
  teksPerhitungan,
  type Bunga,
  type EntriLog,
  type HasilPutaran,
  type Kartu,
  type KartuJadi,
  type RincianSkor,
} from '@remi/engine';
import { TEKS_KALDU } from '../konten/kaldu';
import { esc } from './dom';

const SIMBOL: Record<Bunga, string> = { love: '♥', wajik: '♦', waru: '♠', kriting: '♣' };
const merah = (b: Bunga) => b === 'love' || b === 'wajik';
const kelas = (x: number) => (x > 0 ? 'positif' : x < 0 ? 'negatif' : '');

/**
 * Konvensi tampilan angka negatif di seluruh UI: minus tipografis U+2212 ("−7"), bukan tanda
 * hubung ASCII. Pembaca layar membacanya "minus". Dipakai semua angka skor yang tampil.
 */
export const MINUS = '−';

/** Tanda skor seperti di layar: +12, −7 (minus tipografis), 0. */
export const tanda = (x: number) => (x > 0 ? `+${x}` : x < 0 ? `${MINUS}${-x}` : '0');

/** Angka skor polos (tanpa +): 12, 0, −7 (minus tipografis). */
export const angkaSkor = (x: number) => (x < 0 ? `${MINUS}${-x}` : String(x));

/**
 * Teks dari mesin aturan (mis. teksPerhitungan "… = -30") → minus tipografis untuk angka negatif.
 * Hanya tanda hubung yang langsung menempel di depan angka dan didahului awal teks, spasi, "=",
 * atau "(" yang diganti; tanda hubung di tengah kata (nama pemain) tidak tersentuh.
 */
export const minusTipografis = (teks: string) => teks.replace(/(^|[\s=(])-(?=\d)/g, `$1${MINUS}`);

/**
 * Peringkat dengan seri: nilai sama = peringkat sama, peringkat berikutnya melompati yang seri
 * (10, 10, 5 → 1, 1, 3). Indeks hasil sama dengan indeks masukan.
 */
export function peringkatSeri(nilai: readonly number[]): number[] {
  return nilai.map((x) => 1 + nilai.filter((y) => y > x).length);
}

/** Semua nilai sama (mis. awal permainan, semua 0): tidak ada yang memimpin. */
const semuaSama = (nilai: readonly number[]) => nilai.every((x) => x === nilai[0]);

function chip(k: Kartu, nilai: number, catatan?: string): string {
  return `<span class="chip bunga-${k.bunga}${merah(k.bunga) ? ' merah' : ''}"><b>${esc(namaRank(k.rank))}${SIMBOL[k.bunga]}</b>${
    catatan ? `<i>${esc(catatan)}</i>` : ''
  }<small>${nilai}</small></span>`;
}

/**
 * Kartu jadi dengan asal tiap kartunya: "dari Budi" (pungutan), "modal" (dari tangan sendiri),
 * plus peran joker "→4".
 */
export function htmlKartuJadiAsal(daftar: KartuJadi[], nama: (i: number) => string, saya: number | null): string {
  if (!daftar.length) return '<div class="chips redup">Nggak ada kartu jadi baru di giliran ini.</div>';
  return `<div class="chips">${daftar
    .map(
      (kj) =>
        `<span class="kelompok">${kj.kartu
          .map((d) => {
            const asal = d.dari === undefined ? 'modal' : d.dari === saya ? 'dari kamu' : `dari ${nama(d.dari)}`;
            const peran = d.pengganti ? ` · →${namaRank(d.sebagai.rank)}` : '';
            return chip(d.kartu, nilaiKartuDiMeja(d), `${asal}${peran}`);
          })
          .join('')}</span>`,
    )
    .join('')}</div>`;
}

const LABEL_STATUS = { mentung: 'MENTUNG', kepentung: 'kepentung', aman: 'aman' } as const;

function lencanaStatus(r: RincianSkor): string {
  const k = r.status === 'mentung' ? 'emas' : r.status === 'kepentung' ? 'merah' : '';
  return `<span class="lencana ${k}">${LABEL_STATUS[r.status]}</span>`;
}

/** Komponen skor satu pemain di satu putaran. */
function htmlKomponen(r: RincianSkor, h: HasilPutaran, nama: (i: number) => string): string {
  const baris: string[] = [];
  // Kartu jadi
  const jadi = r.kartuJadi
    .map(
      (kj) =>
        `<span class="kelompok">${kj.kartu
          .map((d) => chip(d.kartu, nilaiKartuDiMeja(d), d.pengganti ? `→${namaRank(d.sebagai.rank)}` : undefined))
          .join('')}</span>`,
    )
    .join('');
  baris.push(
    `<div class="komp"><span>Kartu jadi${r.kartuJadi.length ? ` (${r.kartuJadi.length})` : ''}</span><b class="${kelas(r.nilaiKartuJadi)}">${tanda(r.nilaiKartuJadi)}</b></div>`,
    jadi ? `<div class="chips">${jadi}</div>` : '<div class="chips redup">belum ada kartu jadi</div>',
  );
  // Kartu di tangan
  const perKartu = r.nilaiKartuTangan ?? r.tangan.map(() => 0);
  baris.push(
    `<div class="komp"><span>Kartu di tangan${r.tangan.length ? ` (${r.tangan.length})` : ''}</span><b class="${kelas(-r.nilaiTangan)}">${tanda(-r.nilaiTangan)}</b></div>`,
    r.tangan.length
      ? `<div class="chips">${r.tangan.map((k, i) => chip(k, perKartu[i], perKartu[i] === 25 ? 'joker' : undefined)).join('')}</div>`
      : '<div class="chips redup">tangan kosong</div>',
  );
  // Pentungan (teks polos dulu, di-escape sekali saat dipasang). Putaran kaldu (#42): "(150 × 2)".
  if (r.nilaiPentungan !== 0 && h.pentungan) {
    const pengali = r.pengaliPentungan ?? 1;
    const kali = pengali !== 1 ? `${Math.abs(r.nilaiPentungan) / pengali} × ${pengali}` : '';
    const pentungan = teksPentungan(h, kali);
    const teks = r.status === 'mentung' ? `Pentungan: ${pentungan}` : `Kena pentung ${nama(h.pementung!)}: ${pentungan}`;
    baris.push(`<div class="komp"><span>${esc(teks)}</span><b class="${kelas(r.nilaiPentungan)}">${tanda(r.nilaiPentungan)}</b></div>`);
  }
  // Penalti joker
  if (r.penaltiJoker) {
    baris.push(`<div class="komp"><span>Buang joker (${r.jumlahJokerDibuang}× −25)</span><b class="negatif">${tanda(-r.penaltiJoker)}</b></div>`);
  }
  baris.push(`<div class="komp total-komp"><span>Skor putaran ini</span><b class="${kelas(r.total)}">${tanda(r.total)}</b></div>`);
  baris.push(`<div class="hitung">${esc(minusTipografis(teksPerhitungan(r, { rankJoker: h.rankJoker, jokerMati: [] })))}</div>`);
  return `<div class="komponen">${baris.join('')}</div>`;
}

/**
 * Semua pemain di satu putaran, diurutkan dari skor tertinggi; tiap pemain akordion.
 * Skor sama = peringkat sama. Peringkat 1 (kalau tidak semua seri) diberi kelas `juara`.
 * `.total` membawa data-nilai supaya angka bisa dihitung naik saat ditampilkan.
 */
export function htmlRincianPutaran(
  h: HasilPutaran,
  nama: (i: number) => string,
  saya: number | null,
  buka: ReadonlySet<number> = new Set(),
): string {
  const urut = [...h.rincian].sort((a, b) => b.total - a.total || a.pemain - b.pemain);
  const total = urut.map((r) => r.total);
  const peringkat = peringkatSeri(total);
  const adaJuara = !semuaSama(total);
  // tabindex="0" eksplisit di <summary>: kurungan fokus jendela (ui/dom.ts, SELEKTOR_FOKUS) hanya
  // mengenal button/input/[tabindex]; tanpa ini Tab di modal melompati baris rincian.
  return `<div class="rincian">${urut
    .map((r, i) => {
      const juara = adaJuara && peringkat[i] === 1;
      return `<details class="akordion${juara ? ' juara' : ''}${r.pemain === saya ? ' saya' : ''}" data-pemain="${r.pemain}" ${buka.has(r.pemain) ? 'open' : ''}>
        <summary tabindex="0">
          <span class="peringkat">${peringkat[i]}</span>
          <span class="nama-skor"><b>${esc(nama(r.pemain))}</b>${r.pemain === saya ? ' <span class="redup">(kamu)</span>' : ''}</span>
          ${lencanaStatus(r)}
          <span class="total ${kelas(r.total)}" data-nilai="${r.total}">${tanda(r.total)}</span>
        </summary>
        ${htmlKomponen(r, h, nama)}
        <div class="redup akumulasi">Total akumulasi: <b>${angkaSkor(h.skorAkumulasi[r.pemain])}</b></div>
      </details>`;
    })
    .join('')}</div>`;
}

const MEDALI = ['🥇', '🥈', '🥉'];

/** Tab peringkat: klasemen akumulasi + statistik. Skor sama = peringkat (dan medali) sama. */
export function htmlPeringkat(nama: string[], skor: number[], riwayat: HasilPutaran[], saya: number | null): string {
  const statistik = nama.map((_, i) => ({
    mentung: riwayat.filter((h) => h.pementung === i).length,
    kepentung: riwayat.filter((h) => h.kepentung.includes(i)).length,
    menang: riwayat.filter((h) => Math.max(...h.rincian.map((r) => r.total)) === h.rincian[i].total).length,
    terbaik: riwayat.length ? Math.max(...riwayat.map((h) => h.rincian[i].total)) : 0,
  }));
  const urut = nama.map((n, i) => ({ n, i, skor: skor[i] })).sort((a, b) => b.skor - a.skor || a.i - b.i);
  const peringkat = peringkatSeri(urut.map((x) => x.skor));
  // Belum ada yang dimainkan: belum ada pemimpin, jadi tanpa medali.
  const belumMain = riwayat.length === 0 && semuaSama(skor);
  const pemimpin = urut[0]?.skor ?? 0;
  const jumlahPemimpin = peringkat.filter((x) => x === 1).length;
  return `<div class="rincian">${urut
    .map((x, j) => {
      const st = statistik[x.i];
      const medali = belumMain ? '–' : (MEDALI[peringkat[j] - 1] ?? String(peringkat[j]));
      const kanan = belumMain
        ? '<small class="redup">belum main</small>'
        : peringkat[j] === 1
          ? `<small class="redup">${jumlahPemimpin > 1 ? 'seri memimpin' : 'memimpin'}</small>`
          : `<small class="redup selisih">${tanda(x.skor - pemimpin)}</small>`;
      return `<div class="baris-peringkat${x.i === saya ? ' saya' : ''}">
        <span class="medali" aria-label="peringkat ${peringkat[j]}">${medali}</span>
        <span class="nama-skor"><b>${esc(x.n)}</b>${x.i === saya ? ' <span class="redup">(kamu)</span>' : ''}
          <small class="redup">mentung ${st.mentung}× · kepentung ${st.kepentung}× · menang putaran ${st.menang}× · terbaik ${tanda(st.terbaik)}</small></span>
        <span class="kanan-peringkat"><b class="total ${kelas(x.skor)}">${angkaSkor(x.skor)}</b>${kanan}</span>
      </div>`;
    })
    .join('')}</div>`;
}

/**
 * Tabel klasemen akhir. Skor sama = peringkat dan medali sama; peringkat 1 diberi kelas `juara`.
 * Kolom skor membawa data-nilai untuk animasi hitung naik. Dengan `terakhir`, ada kolom skor
 * putaran terakhir tiap pemain (supaya kelihatan kenapa total berubah).
 */
export function htmlKlasemen(nama: string[], skor: number[], saya: number | null, terakhir?: HasilPutaran): string {
  const urut = nama.map((n, i) => ({ n, i, skor: skor[i] })).sort((a, b) => b.skor - a.skor || a.i - b.i);
  const peringkat = peringkatSeri(urut.map((x) => x.skor));
  const adaJuara = !semuaSama(skor);
  const delta = (i: number) => terakhir?.rincian.find((r) => r.pemain === i)?.total;
  const kolomDelta = terakhir
    ? `<th scope="col" class="delta"><abbr title="Skor putaran ${terakhir.nomor} (terakhir)">P${terakhir.nomor}</abbr></th>`
    : '';
  return `<table class="skor klasemen">
    <thead><tr><th scope="col">#</th><th scope="col" class="kiri">Pemain</th>${kolomDelta}<th scope="col">Skor</th></tr></thead>
    <tbody>${urut
      .map((x, j) => {
        const kelasBaris = [adaJuara && peringkat[j] === 1 ? 'juara' : '', x.i === saya ? 'saya' : ''].filter(Boolean).join(' ');
        const d = delta(x.i);
        const selDelta = terakhir ? `<td class="delta${d === undefined ? '' : ` ${kelas(d)}`}">${d === undefined ? '–' : tanda(d)}</td>` : '';
        return `<tr${kelasBaris ? ` class="${kelasBaris}"` : ''} data-pemain="${x.i}">
          <td><span class="medali" aria-label="peringkat ${peringkat[j]}">${MEDALI[peringkat[j] - 1] ?? peringkat[j]}</span></td>
          <td class="kiri">${esc(x.n)}${x.i === saya ? ' <span class="redup">(kamu)</span>' : ''}</td>
          ${selDelta}<td><b class="angka" data-nilai="${x.skor}" data-polos>${angkaSkor(x.skor)}</b></td>
        </tr>`;
      })
      .join('')}</tbody>
  </table>`;
}

/**
 * Kalimat cara putaran selesai, teks polos (di-escape pemanggil). Hanya info publik: siapa yang
 * mentung dan pentungannya memang dibuka di meja untuk semua pemain. Putaran kaldu (#42): nilainya
 * ditulis "(150 × 2 = 300)".
 */
export function teksCaraSelesai(h: HasilPutaran, nama: (i: number) => string): string {
  if (h.cara === 'deckHabis') return 'Deck habis. Semua dihitung skor dasar.';
  const nilai = h.kaldu ? `${h.nilaiPentungan / PENGALI_KALDU} × ${PENGALI_KALDU} = ${h.nilaiPentungan}` : angkaSkor(h.nilaiPentungan);
  return `${nama(h.pementung!)} mentung pakai ${daftarNama(kartuPentungan(h).map(namaKartu))} (${nilai}).`;
}

/** Semua kartu pentungan putaran ini: biasanya satu, beberapa kalau nutup pakai beberapa joker (#41). */
function kartuPentungan(h: HasilPutaran): Kartu[] {
  return h.pentungan ? [h.pentungan, ...(h.pentunganLain ?? [])] : [];
}

/**
 * "7 Waru (joker)", atau "7 Waru dan 7 Love (joker semua)" kalau pentungannya beberapa joker. `kali`
 * (putaran kaldu, "250 × 2") masuk kurung yang sama: "7 Waru (joker, 250 × 2)". Teks polos.
 */
function teksPentungan(h: HasilPutaran, kali = ''): string {
  const kartu = kartuPentungan(h);
  const joker = h.pentunganJoker ? (kartu.length > 1 ? 'joker semua' : 'joker') : '';
  const catatan = [joker, kali].filter(Boolean).join(', ');
  return `${daftarNama(kartu.map(namaKartu))}${catatan ? ` (${catatan})` : ''}`;
}

/**
 * Ringkasan putaran terakhir di klasemen akhir: cara selesai, skormu di putaran itu, dan akordion
 * rincian semua pemain (htmlRincianPutaran yang sama dengan modal hasil). Terlipat bawaan.
 */
export function htmlRingkasPutaranTerakhir(h: HasilPutaran, nama: (i: number) => string, saya: number | null): string {
  const milikku = saya !== null ? h.rincian.find((r) => r.pemain === saya) : undefined;
  // Skormu di putaran ini ikut di baris judul, jadi kelihatan tanpa membuka akordion.
  const skormu = milikku ? `<span class="total ${kelas(milikku.total)}">${tanda(milikku.total)}</span>` : '';
  return `<details class="akordion putaran-akordion putaran-terakhir">
      <summary tabindex="0"><span class="peringkat">P${h.nomor}</span><span class="nama-skor"><b>Putaran terakhir: kenapa skornya berubah</b><small class="redup">${esc(teksCaraSelesai(h, nama))}</small></span>${skormu}</summary>
      ${htmlRincianPutaran(h, nama, saya, new Set(saya !== null ? [saya] : []))}
    </details>`;
}

/** Tab riwayat: akordion per putaran (terbaru di atas), isinya rincian per pemain. */
export function htmlRiwayat(nama: (i: number) => string, riwayat: HasilPutaran[], saya: number | null): string {
  if (!riwayat.length) return '<p class="redup">Belum ada putaran yang selesai.</p>';
  return [...riwayat]
    .reverse()
    .map((h) => {
      const terbaik = [...h.rincian].sort((a, b) => b.total - a.total)[0];
      // Putaran kaldu (#42) ditandai singkat: "Budi mentung · kaldu".
      const cara = `${h.cara === 'mentung' ? `${nama(h.pementung!)} mentung` : 'deck habis'}${h.kaldu ? ` · ${TEKS_KALDU.riwayat}` : ''}`;
      const milikku = saya !== null ? h.rincian[saya] : null;
      return `<details class="akordion putaran-akordion">
        <summary tabindex="0">
          <span class="peringkat">P${h.nomor}</span>
          <span class="nama-skor"><b>${esc(cara)}</b><small class="redup">tertinggi: ${esc(nama(terbaik.pemain))} ${tanda(terbaik.total)}</small></span>
          ${milikku ? `<span class="total ${kelas(milikku.total)}">${tanda(milikku.total)}</span>` : ''}
        </summary>
        ${htmlRincianPutaran(h, nama, saya)}
      </details>`;
    })
    .join('');
}

// ---------- Log ----------

export type JenisLog = 'mulai' | 'ambil' | 'mulung' | 'turun' | 'buang' | 'mentung' | 'kepentung' | 'susun' | 'selesai' | 'lain';

/** Ikon tiap jenis log (hiasan saja, aria-hidden). */
const IKON_LOG: Record<JenisLog, string> = {
  mulai: '🔀',
  ambil: '⬇',
  mulung: '🤲',
  turun: '🃏',
  buang: '⬆',
  mentung: '💥',
  kepentung: '🎯',
  susun: '🧩',
  selesai: '🏁',
  lain: '•',
};

/**
 * Tebak jenis entri log dari teksnya (log mesin aturan hanya berisi teks). Hanya untuk memilih
 * ikon; teks log tetap ditampilkan apa adanya, tanpa tambahan info.
 */
export function jenisLog(pesan: string): JenisLog {
  // Pola mengikuti teks catat() di packages/engine/src/mesin.ts. Sebisa mungkin dipatok ke awal/akhir
  // kalimat, karena nama pemain bebas (pemain bernama "Kepentung" atau "Selesai" tidak boleh membuat
  // semua entrinya salah ikon). Urutan tetap penting: pembuka susun akhir ("… boleh menurunkan kartu
  // jadi…") dan ambil kartu terakhir deck ("… kesempatan terakhir menurunkan kartu jadi.") sama-sama
  // memuat " menurunkan ", jadi harus tertangkap sebelum cek 'turun'.
  if (/^Putaran \d+ dimulai\. .+ ngocok\.( Putaran kaldu: pentungan dikali dua\.)?$/.test(pesan)) return 'mulai';
  if (/ ambil kartu dari deck\.( Deck habis\. Setelah giliran ini .+)?$/.test(pesan)) return 'ambil';
  if (/ buang kartu\.$/.test(pesan)) return 'buang';
  if (/ mulung \d+ kartu dari buangan, menjadikan .+\.$/.test(pesan)) return 'mulung';
  if (/ mentung pakai .+!$/.test(pesan)) return 'mentung';
  if (/^(Sebelum dihitung|Deck habis)\. Semua pemain boleh menurunkan kartu jadi dari tangan/.test(pesan)) return 'susun';
  // Mentung tanpa korban: putaran selesai biasa, bukan entri kepentung.
  if (/^Nggak ada yang kepentung\./.test(pesan)) return 'selesai';
  if (/ kepentung\. (Arah putaran berikutnya dibalik|Lompat, arah tetap)\.$/.test(pesan)) return 'kepentung';
  if (/^Deck habis\. Putaran \d+ selesai/.test(pesan)) return 'selesai';
  if (/Permainan selesai\.$/.test(pesan)) return 'selesai';
  if (/ menurunkan .+\.$/.test(pesan)) return 'turun';
  return 'lain';
}

/**
 * Log dikelompokkan per putaran: putaran terbaru di atas dan terbuka, putaran lama dilipat.
 * Di dalam tiap putaran, kejadian terbaru di atas.
 */
export function htmlLog(log: readonly EntriLog[]): string {
  if (!log.length) return '<p class="redup">Belum ada kejadian.</p>';
  const perPutaran = new Map<number, EntriLog[]>();
  for (const l of log) {
    const daftar = perPutaran.get(l.putaran) ?? [];
    daftar.push(l);
    perPutaran.set(l.putaran, daftar);
  }
  const nomor = [...perPutaran.keys()].sort((a, b) => b - a);
  return `<div class="log-meja">${nomor
    .map(
      (n, i) => `<details class="akordion log-putaran"${i === 0 ? ' open' : ''}>
        <summary tabindex="0"><span class="nama-skor"><b>Putaran ${n}</b></span><span class="lencana garis">${perPutaran.get(n)!.length}</span></summary>
        <ol class="log-daftar">${[...perPutaran.get(n)!]
          .reverse()
          .map((l) => {
            const j = jenisLog(l.pesan);
            return `<li class="log-${j}"><span class="log-ikon" aria-hidden="true">${IKON_LOG[j]}</span><span>${esc(l.pesan)}</span></li>`;
          })
          .join('')}</ol>
      </details>`,
    )
    .join('')}</div>`;
}
