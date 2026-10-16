// @vitest-environment happy-dom
// Baseline rincian skor (ui/rincianSkor.ts). HTML-nya di-parse lalu diperiksa strukturnya
// (urutan, tanda, penanda "kamu", escaping), bukan dibandingkan string persis, supaya
// perubahan tampilan tidak bikin test rapuh.

import { beforeAll, describe, expect, it } from 'vitest';
import { buatKartu, terapkanAksi, type Aksi, type HasilPutaran, type KartuJadi } from '@remi/engine';
import { id, semuaSelesaiSusun, skenario, spek } from '../../../packages/engine/test/bantu';
import {
  angkaSkor,
  htmlKartuJadiAsal,
  htmlKlasemen,
  htmlPeringkat,
  htmlRincianPutaran,
  htmlRingkasPutaranTerakhir,
  htmlRiwayat,
  MINUS,
  tanda as tandaAsli,
  teksCaraSelesai,
} from '../src/ui/rincianSkor';
import { mainkanBot } from './bantu';

/** Nama jahil: kalau tidak di-escape, jadi elemen <img> beneran. */
const NAMA_JAHIL = `<img src=x onerror="alert(1)">Bos & 'Kumis'`;

const parse = (html: string): HTMLElement => {
  const el = document.createElement('div');
  el.innerHTML = html;
  return el;
};

/** Tanda skor seperti di layar: +12, −7 (minus tipografis), 0. */
const tanda = (x: number) => (x > 0 ? `+${x}` : x < 0 ? `−${-x}` : '0');
/** Angka skor polos seperti di layar: 12, 0, −7 (minus tipografis U+2212, bukan tanda hubung). */
const angka = (x: number) => (x < 0 ? `−${-x}` : String(x));
/** Baca angka tampilan (minus tipografis) kembali jadi number. */
const baca = (teks: string | null) => Number((teks ?? '').replace('−', '-'));

let riwayat: HasilPutaran[];
let skor: number[];
const N = 4;

beforeAll(() => {
  // Seed ini menghasilkan 2 putaran mentung + 1 deck habis (4 pemain, 3 putaran).
  const langkah = mainkanBot(N, 15, 3);
  const akhir = langkah[langkah.length - 1].sesudah;
  riwayat = akhir.riwayat;
  skor = akhir.skor;
  expect(riwayat).toHaveLength(3);
  expect(riwayat.some((h) => h.cara === 'mentung')).toBe(true);
  expect(riwayat.some((h) => h.cara === 'deckHabis')).toBe(true);
});

const namaBiasa = (i: number) => `Pemain ${i}`;

describe('htmlRincianPutaran', () => {
  it('satu akordion per pemain, urut skor tertinggi, peringkat 1..n', () => {
    for (const h of riwayat) {
      const el = parse(htmlRincianPutaran(h, namaBiasa, 0));
      const akordion = [...el.querySelectorAll<HTMLDetailsElement>('details.akordion')];
      expect(akordion).toHaveLength(N);
      const urut = akordion.map((d) => Number(d.dataset.pemain));
      const harapan = [...h.rincian].sort((a, b) => b.total - a.total || a.pemain - b.pemain).map((r) => r.pemain);
      expect(urut).toEqual(harapan);
      expect(akordion.map((d) => d.querySelector('.peringkat')!.textContent)).toEqual(['1', '2', '3', '4']);
    }
  });

  it('total per pemain memakai tanda +/−/0 dan kelas positif/negatif', () => {
    const h = riwayat[0];
    const el = parse(htmlRincianPutaran(h, namaBiasa, null));
    for (const r of h.rincian) {
      const total = el.querySelector(`details[data-pemain="${r.pemain}"] summary .total`)!;
      expect(total.textContent).toBe(tanda(r.total));
      expect(total.classList.contains('positif')).toBe(r.total > 0);
      expect(total.classList.contains('negatif')).toBe(r.total < 0);
    }
  });

  it('penanda "(kamu)" hanya di akordion milik saya; penonton tidak punya', () => {
    const h = riwayat[0];
    const el = parse(htmlRincianPutaran(h, namaBiasa, 2));
    const milik = [...el.querySelectorAll('details.akordion')].filter((d) => d.querySelector('summary')!.textContent!.includes('(kamu)'));
    expect(milik.map((d) => (d as HTMLElement).dataset.pemain)).toEqual(['2']);
    expect(parse(htmlRincianPutaran(h, namaBiasa, null)).textContent).not.toContain('(kamu)');
  });

  it('hanya akordion di set `buka` yang terbuka', () => {
    const h = riwayat[0];
    const el = parse(htmlRincianPutaran(h, namaBiasa, 0, new Set([1, 3])));
    const terbuka = [...el.querySelectorAll<HTMLDetailsElement>('details.akordion')].filter((d) => d.hasAttribute('open'));
    expect(terbuka.map((d) => d.dataset.pemain).sort()).toEqual(['1', '3']);
  });

  it('memuat komponen skor dan total akumulasi tiap pemain', () => {
    const h = riwayat[0];
    const el = parse(htmlRincianPutaran(h, namaBiasa, 0));
    for (const r of h.rincian) {
      const d = el.querySelector(`details[data-pemain="${r.pemain}"]`)!;
      expect(d.querySelector('.komponen')).not.toBeNull();
      expect(d.querySelector('.total-komp b')!.textContent).toBe(tanda(r.total));
      expect(d.querySelector('.akumulasi b')!.textContent).toBe(angka(h.skorAkumulasi[r.pemain]));
    }
  });

  it('putaran mentung: lencana MENTUNG untuk pementung dan baris pentungan', () => {
    const h = riwayat.find((x) => x.cara === 'mentung')!;
    const el = parse(htmlRincianPutaran(h, namaBiasa, null));
    const pementung = el.querySelector(`details[data-pemain="${h.pementung}"]`)!;
    expect(pementung.querySelector('.lencana')!.textContent).toBe('MENTUNG');
    expect(pementung.querySelector('.komponen')!.textContent).toContain('Pentungan:');
    for (const k of h.kepentung) {
      const d = el.querySelector(`details[data-pemain="${k}"]`)!;
      expect(d.querySelector('.lencana')!.textContent).toBe('kepentung');
      expect(d.querySelector('.komponen')!.textContent).toContain(`Kena pentung ${namaBiasa(h.pementung!)}`);
    }
  });

  it('#41 pentung beberapa joker: semua kartu pentungan disebut, nilai total untuk yang mentung dan kepentung', () => {
    // Joker 7: Pemain 0 mulung 4 Love punya Pemain 1, lalu nutup pakai 7 Waru + 7 Kriting.
    let g = skenario({
      rankJoker: 7,
      tangan: [['5 love', '6 love', '7 waru', '7 kriting'], ['3 waru', '4 waru', '5 waru'], ['3 love', '8 love', '8 waru'], ['J love', 'Q love', '10 waru']],
      buangan: [['4 love', 1]],
      giliran: 0,
    });
    const aksi: Aksi[] = [
      { jenis: 'mulung', pemain: 0, jumlah: 1, kartuJadi: [spek('4 love', '5 love', '6 love')] },
      { jenis: 'buang', pemain: 0, kartuId: id('7 waru'), kartuIdLain: [id('7 kriting')] },
    ];
    for (const a of aksi) {
      const h = terapkanAksi(g, a);
      if (!h.ok) throw new Error(h.error.pesan);
      g = h.state;
    }
    const h = semuaSelesaiSusun(g).riwayat[0];
    expect(h.nilaiPentungan).toBe(500);
    const el = parse(htmlRincianPutaran(h, namaBiasa, null));
    const komponen = (i: number) => el.querySelector(`details[data-pemain="${i}"] .komponen`)!;
    expect(komponen(0).textContent).toContain('Pentungan: 7 Waru dan 7 Kriting (joker semua)');
    expect(komponen(0).textContent).toContain(tanda(500));
    expect(komponen(1).textContent).toContain('Kena pentung Pemain 0: 7 Waru dan 7 Kriting (joker semua)');
    expect(komponen(1).textContent).toContain(tanda(-500));
    expect(teksCaraSelesai(h, namaBiasa)).toBe('Pemain 0 mentung pakai 7 Waru dan 7 Kriting (500).');
    // Satu kartu: teks lama tidak berubah.
    const satu = riwayat.find((x) => x.cara === 'mentung')!;
    expect(teksCaraSelesai(satu, namaBiasa)).not.toContain(' dan ');
    expect(parse(htmlRincianPutaran(satu, namaBiasa, null)).textContent).not.toContain('joker semua');
  });

  it('penalti buang joker tampil sebagai baris tersendiri', () => {
    const h = structuredClone(riwayat[0]);
    const r = h.rincian[1];
    r.jumlahJokerDibuang = 2;
    r.penaltiJoker = 50;
    const el = parse(htmlRincianPutaran(h, namaBiasa, null));
    const teks = el.querySelector('details[data-pemain="1"] .komponen')!.textContent!;
    expect(teks).toContain('Buang joker (2× −25)');
    expect(teks).toContain('−50');
  });

  it('nama di-escape: tidak ada elemen sisipan, teksnya tampil apa adanya', () => {
    for (const h of riwayat) {
      const el = parse(htmlRincianPutaran(h, () => NAMA_JAHIL, 0));
      expect(el.querySelector('img')).toBeNull();
      expect(el.querySelector('summary .nama-skor b')!.textContent).toBe(NAMA_JAHIL);
    }
  });
});

describe('htmlPeringkat', () => {
  const nama = Array.from({ length: N }, (_, i) => `Pemain ${i}`);

  it('urut skor akumulasi tertinggi; pemimpin diberi label, sisanya selisih', () => {
    const el = parse(htmlPeringkat(nama, skor, riwayat, null));
    const baris = [...el.querySelectorAll('.baris-peringkat')];
    expect(baris).toHaveLength(N);
    const skorTampil = baris.map((b) => baca(b.querySelector('.total')!.textContent));
    expect(skorTampil).toEqual([...skor].sort((a, b) => b - a));
    expect(baris[0].querySelector('.kanan-peringkat small')!.textContent).toBe('memimpin');
    for (let j = 1; j < N; j++) {
      expect(baris[j].querySelector('.kanan-peringkat small')!.textContent).toBe(tanda(skorTampil[j] - skorTampil[0]));
    }
  });

  it('medali untuk tiga besar, angka untuk sisanya', () => {
    const el = parse(htmlPeringkat(nama, skor, riwayat, null));
    const medali = [...el.querySelectorAll('.medali')].map((m) => m.textContent);
    expect(medali).toEqual(['🥇', '🥈', '🥉', '4']);
  });

  it('statistik mentung/kepentung konsisten dengan riwayat', () => {
    const el = parse(htmlPeringkat(nama, skor, riwayat, null));
    for (let i = 0; i < N; i++) {
      const baris = [...el.querySelectorAll('.baris-peringkat')].find((b) => b.querySelector('b')!.textContent === nama[i])!;
      const st = baris.querySelector('small.redup')!.textContent!;
      expect(st).toContain(`mentung ${riwayat.filter((h) => h.pementung === i).length}×`);
      expect(st).toContain(`kepentung ${riwayat.filter((h) => h.kepentung.includes(i)).length}×`);
    }
  });

  it('baris saya ditandai, nama di-escape', () => {
    const el = parse(htmlPeringkat(nama.map((n, i) => (i === 1 ? NAMA_JAHIL : n)), skor, riwayat, 1));
    expect(el.querySelector('img')).toBeNull();
    const saya = el.querySelectorAll('.baris-peringkat.saya');
    expect(saya).toHaveLength(1);
    expect(saya[0].querySelector('b')!.textContent).toBe(NAMA_JAHIL);
    expect(saya[0].textContent).toContain('(kamu)');
  });

  it('tanpa riwayat: tetap tampil tanpa error', () => {
    const el = parse(htmlPeringkat(nama, [0, 0, 0, 0], [], null));
    expect(el.querySelectorAll('.baris-peringkat')).toHaveLength(N);
  });
});

describe('htmlRiwayat', () => {
  it('kosong: pesan belum ada putaran', () => {
    expect(parse(htmlRiwayat(namaBiasa, [], 0)).textContent).toContain('Belum ada putaran');
  });

  it('putaran terbaru di atas, masing-masing berisi rincian semua pemain', () => {
    const el = parse(htmlRiwayat(namaBiasa, riwayat, 0));
    const putaran = [...el.querySelectorAll(':scope > details.putaran-akordion')];
    expect(putaran.map((d) => d.querySelector('summary .peringkat')!.textContent)).toEqual(
      [...riwayat].reverse().map((h) => `P${h.nomor}`),
    );
    for (const d of putaran) expect(d.querySelectorAll('details.akordion:not(.putaran-akordion)')).toHaveLength(N);
  });

  it('cara putaran selesai: "<nama> mentung" atau "deck habis"', () => {
    const el = parse(htmlRiwayat(namaBiasa, riwayat, null));
    const judul = [...el.querySelectorAll(':scope > details > summary .nama-skor > b')].map((b) => b.textContent);
    const harapan = [...riwayat].reverse().map((h) => (h.cara === 'mentung' ? `${namaBiasa(h.pementung!)} mentung` : 'deck habis'));
    expect(judul).toEqual(harapan);
  });

  it('penonton (saya null) tidak punya total pribadi di ringkasan putaran', () => {
    const el = parse(htmlRiwayat(namaBiasa, riwayat, null));
    expect(el.querySelectorAll(':scope > details > summary > .total')).toHaveLength(0);
    const punyaSaya = parse(htmlRiwayat(namaBiasa, riwayat, 0));
    expect(punyaSaya.querySelectorAll(':scope > details > summary > .total')).toHaveLength(riwayat.length);
  });

  it('nama pementung dan pemain di-escape di semua tempat', () => {
    const el = parse(htmlRiwayat(() => NAMA_JAHIL, riwayat, 0));
    expect(el.querySelector('img')).toBeNull();
    expect(el.querySelector('script')).toBeNull();
  });
});

describe('htmlKartuJadiAsal', () => {
  const kartuJadi = (): KartuJadi[] => [
    {
      id: 'kj-1',
      pemilik: 0,
      jenis: 'seri',
      kartu: [
        { kartu: buatKartu('love', 5), sebagai: { rank: 5, bunga: 'love' }, pengganti: false, dari: 2 },
        { kartu: buatKartu('love', 6), sebagai: { rank: 6, bunga: 'love' }, pengganti: false },
        { kartu: buatKartu('waru', 9), sebagai: { rank: 7, bunga: 'love' }, pengganti: true, dari: 0 },
      ],
    },
  ];

  it('kosong: pesan tidak ada kartu jadi baru', () => {
    const el = parse(htmlKartuJadiAsal([], namaBiasa, 0));
    expect(el.querySelector('.chips.redup')).not.toBeNull();
  });

  it('asal tiap kartu: dari lawan, modal, dari kamu; plus peran joker', () => {
    const el = parse(htmlKartuJadiAsal(kartuJadi(), namaBiasa, 0));
    const chip = [...el.querySelectorAll('.kelompok .chip')];
    expect(chip).toHaveLength(3);
    expect(chip.map((c) => c.querySelector('i')!.textContent)).toEqual(['dari Pemain 2', 'modal', 'dari kamu · →7']);
    expect(chip[0].classList.contains('merah')).toBe(true);
    expect(chip[2].classList.contains('merah')).toBe(false);
  });

  it('nama lawan di-escape', () => {
    const el = parse(htmlKartuJadiAsal(kartuJadi(), () => NAMA_JAHIL, 1));
    expect(el.querySelector('img')).toBeNull();
    expect(el.querySelector('.chip i')!.textContent).toBe(`dari ${NAMA_JAHIL}`);
  });
});

describe('klasemen akhir + ringkasan putaran terakhir', () => {
  const nama = Array.from({ length: N }, (_, i) => `Pemain ${i}`);

  it('tanpa putaran terakhir: tabel lama (3 kolom)', () => {
    const el = parse(htmlKlasemen(nama, skor, 0));
    expect(el.querySelectorAll('thead th')).toHaveLength(3);
    expect(el.querySelector('.delta')).toBeNull();
  });

  it('kolom skor putaran terakhir per pemain (+/−), cocok dengan rincian mesin', () => {
    const h = riwayat[riwayat.length - 1];
    const el = parse(htmlKlasemen(nama, skor, 0, h));
    expect(el.querySelector('thead th.delta')!.textContent).toBe(`P${h.nomor}`);
    for (const r of h.rincian) {
      const sel = el.querySelector(`tr[data-pemain="${r.pemain}"] td.delta`)!;
      expect(sel.textContent).toBe(tanda(r.total));
      expect(sel.classList.contains('positif')).toBe(r.total > 0);
      expect(sel.classList.contains('negatif')).toBe(r.total < 0);
    }
    // Total akumulasi tetap kolom terakhir dengan data-nilai (animasi hitung naik).
    for (let i = 0; i < N; i++) expect(el.querySelector(`tr[data-pemain="${i}"] td:last-child [data-nilai]`)!.textContent).toBe(angka(skor[i]));
  });

  it('teksCaraSelesai: deck habis / "<nama> mentung pakai <kartu> (<nilai>)."', () => {
    for (const h of riwayat) {
      const t = teksCaraSelesai(h, namaBiasa);
      if (h.cara === 'deckHabis') expect(t).toBe('Deck habis. Semua dihitung skor dasar.');
      else {
        expect(t.startsWith(`Pemain ${h.pementung} mentung pakai `)).toBe(true);
        expect(t.endsWith(` (${h.nilaiPentungan}).`)).toBe(true);
      }
    }
  });

  it('ringkasan: akordion terlipat, cara selesai, skormu di judul, rincian semua pemain (milikku terbuka)', () => {
    for (const h of riwayat) {
      const el = parse(htmlRingkasPutaranTerakhir(h, namaBiasa, 1));
      const luar = el.querySelector<HTMLDetailsElement>('details.putaran-terakhir')!;
      expect(luar.open).toBe(false);
      const ringkas = luar.querySelector(':scope > summary')!;
      expect(ringkas.getAttribute('tabindex')).toBe('0');
      expect(ringkas.textContent).toContain(teksCaraSelesai(h, namaBiasa));
      expect(ringkas.querySelector('.total')!.textContent).toBe(tanda(h.rincian.find((r) => r.pemain === 1)!.total));
      const dalam = [...luar.querySelectorAll<HTMLDetailsElement>('.rincian > details.akordion')];
      expect(dalam).toHaveLength(N);
      expect(dalam.filter((d) => d.open).map((d) => d.dataset.pemain)).toEqual(['1']);
    }
  });

  it('penonton (saya null): tanpa skor pribadi di judul; nama di-escape', () => {
    const h = riwayat.find((x) => x.cara === 'mentung')!;
    const el = parse(htmlRingkasPutaranTerakhir(h, () => NAMA_JAHIL, null));
    expect(el.querySelector('details.putaran-terakhir > summary > .total')).toBeNull();
    expect(el.querySelector('img')).toBeNull();
    expect(el.textContent).toContain(NAMA_JAHIL);
  });
});

describe('konvensi minus tipografis (U+2212)', () => {
  it('angka negatif di rincian, peringkat, dan klasemen tidak memakai tanda hubung ASCII', () => {
    const h = riwayat[0];
    const nama = Array.from({ length: N }, (_, i) => `Pemain ${i}`);
    const negatif = [-130, -5, 0, 40];
    const html = [
      htmlRincianPutaran(h, (i) => nama[i], 0),
      htmlPeringkat(nama, negatif, riwayat, 0),
      htmlKlasemen(nama, negatif, 0, h),
    ].join('');
    const el = parse(html);
    // Teks yang terlihat (bukan atribut): tidak ada "-angka" ASCII.
    expect(el.textContent!.match(/.{0,30}-\d.{0,10}/g)).toBeNull();
    expect(el.textContent).toContain('−130');
    expect(angkaSkor(-7)).toBe('−7');
    expect(angkaSkor(0)).toBe('0');
    expect(angkaSkor(12)).toBe('12');
    expect(tandaAsli(-7)).toBe(`${MINUS}7`);
    expect(MINUS).toBe('−');
  });
});
