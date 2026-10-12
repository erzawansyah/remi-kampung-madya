// Rincian skor dalam bentuk akordion: per putaran (diurutkan dari tertinggi) dan peringkat.

import { namaKartu, namaRank, nilaiKartuDiMeja, teksPerhitungan, type Bunga, type HasilPutaran, type Kartu, type RincianSkor } from '@remi/engine';
import { esc } from './dom';

const SIMBOL: Record<Bunga, string> = { love: '♥', wajik: '♦', waru: '♠', kriting: '♣' };
const merah = (b: Bunga) => b === 'love' || b === 'wajik';
const tanda = (x: number) => (x > 0 ? `+${x}` : x < 0 ? `−${-x}` : '0');
const kelas = (x: number) => (x > 0 ? 'positif' : x < 0 ? 'negatif' : '');

function chip(k: Kartu, nilai: number, catatan?: string): string {
  return `<span class="chip${merah(k.bunga) ? ' merah' : ''}"><b>${esc(namaRank(k.rank))}${SIMBOL[k.bunga]}</b>${
    catatan ? `<i>${esc(catatan)}</i>` : ''
  }<small>${nilai}</small></span>`;
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
  // Pentungan
  if (r.nilaiPentungan !== 0 && h.pentungan) {
    const pentungan = `${namaKartu(h.pentungan)}${h.pentunganJoker ? ' (joker)' : ''}`;
    const teks =
      r.status === 'mentung' ? `Pentungan: ${pentungan}` : `Kena pentung ${esc(nama(h.pementung!))}: ${pentungan}`;
    baris.push(`<div class="komp"><span>${esc(teks)}</span><b class="${kelas(r.nilaiPentungan)}">${tanda(r.nilaiPentungan)}</b></div>`);
  }
  // Penalti joker
  if (r.penaltiJoker) {
    baris.push(`<div class="komp"><span>Buang joker (${r.jumlahJokerDibuang}× −25)</span><b class="negatif">${tanda(-r.penaltiJoker)}</b></div>`);
  }
  baris.push(`<div class="komp total-komp"><span>Skor putaran ini</span><b class="${kelas(r.total)}">${tanda(r.total)}</b></div>`);
  baris.push(
    `<div class="hitung">${esc(teksPerhitungan(r, { rankJoker: h.rankJoker, jokerMati: [] }))}</div>`,
  );
  return `<div class="komponen">${baris.join('')}</div>`;
}

/** Semua pemain di satu putaran, diurutkan dari skor tertinggi; tiap pemain akordion. */
export function htmlRincianPutaran(
  h: HasilPutaran,
  nama: (i: number) => string,
  saya: number | null,
  buka: ReadonlySet<number> = new Set(),
): string {
  const urut = [...h.rincian].sort((a, b) => b.total - a.total || a.pemain - b.pemain);
  return `<div class="rincian">${urut
    .map(
      (r, i) => `<details class="akordion" data-pemain="${r.pemain}" ${buka.has(r.pemain) ? 'open' : ''}>
        <summary>
          <span class="peringkat">${i + 1}</span>
          <span class="nama-skor"><b>${esc(nama(r.pemain))}</b>${r.pemain === saya ? ' <span class="redup">(kamu)</span>' : ''}</span>
          ${lencanaStatus(r)}
          <span class="total ${kelas(r.total)}">${tanda(r.total)}</span>
        </summary>
        ${htmlKomponen(r, h, nama)}
        <div class="redup akumulasi">Total akumulasi: <b>${h.skorAkumulasi[r.pemain]}</b></div>
      </details>`,
    )
    .join('')}</div>`;
}

const MEDALI = ['🥇', '🥈', '🥉'];

/** Tab peringkat: klasemen akumulasi + statistik. */
export function htmlPeringkat(nama: string[], skor: number[], riwayat: HasilPutaran[], saya: number | null): string {
  const statistik = nama.map((_, i) => ({
    mentung: riwayat.filter((h) => h.pementung === i).length,
    kepentung: riwayat.filter((h) => h.kepentung.includes(i)).length,
    menang: riwayat.filter((h) => Math.max(...h.rincian.map((r) => r.total)) === h.rincian[i].total).length,
    terbaik: riwayat.length ? Math.max(...riwayat.map((h) => h.rincian[i].total)) : 0,
  }));
  const urut = nama.map((n, i) => ({ n, i, skor: skor[i] })).sort((a, b) => b.skor - a.skor || a.i - b.i);
  const pemimpin = urut[0]?.skor ?? 0;
  return `<div class="rincian">${urut
    .map((x, j) => {
      const st = statistik[x.i];
      return `<div class="baris-peringkat${x.i === saya ? ' saya' : ''}">
        <span class="medali">${MEDALI[j] ?? j + 1}</span>
        <span class="nama-skor"><b>${esc(x.n)}</b>${x.i === saya ? ' <span class="redup">(kamu)</span>' : ''}
          <small class="redup">mentung ${st.mentung}× · kepentung ${st.kepentung}× · menang putaran ${st.menang}× · terbaik ${tanda(st.terbaik)}</small></span>
        <span class="kanan-peringkat"><b class="total ${kelas(x.skor)}">${x.skor}</b>${
          j > 0 ? `<small class="redup">${tanda(x.skor - pemimpin)}</small>` : '<small class="redup">memimpin</small>'
        }</span>
      </div>`;
    })
    .join('')}</div>`;
}

/** Tab riwayat: akordion per putaran (terbaru di atas), isinya rincian per pemain. */
export function htmlRiwayat(nama: (i: number) => string, riwayat: HasilPutaran[], saya: number | null): string {
  if (!riwayat.length) return '<p class="redup">Belum ada putaran yang selesai.</p>';
  return [...riwayat]
    .reverse()
    .map((h) => {
      const terbaik = [...h.rincian].sort((a, b) => b.total - a.total)[0];
      const cara = h.cara === 'mentung' ? `${nama(h.pementung!)} mentung` : 'deck habis';
      const milikku = saya !== null ? h.rincian[saya] : null;
      return `<details class="akordion putaran-akordion">
        <summary>
          <span class="peringkat">P${h.nomor}</span>
          <span class="nama-skor"><b>${esc(cara)}</b><small class="redup">tertinggi: ${esc(nama(terbaik.pemain))} ${tanda(terbaik.total)}</small></span>
          ${milikku ? `<span class="total ${kelas(milikku.total)}">${tanda(milikku.total)}</span>` : ''}
        </summary>
        ${htmlRincianPutaran(h, nama, saya)}
      </details>`;
    })
    .join('');
}
