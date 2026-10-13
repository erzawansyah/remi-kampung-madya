// @vitest-environment happy-dom
// Tambahan rincian skor (ui/rincianSkor.ts): peringkat seri, klasemen akhir, escaping baris
// "Kena pentung", kelas bunga untuk kartu empat warna, dan log per putaran.
// Murni presentasi: skor dari mesin aturan ditampilkan apa adanya.

import { beforeAll, describe, expect, it } from 'vitest';
import { terapkanAksi, type EntriLog, type GameState, type HasilPutaran } from '@remi/engine';
import { semuaSelesaiSusun, skenario, spek } from '../../../packages/engine/test/bantu';
import { htmlKlasemen, htmlLog, htmlPeringkat, htmlRincianPutaran, jenisLog, peringkatSeri } from '../src/ui/rincianSkor';
import { mainkanBot } from './bantu';

const NAMA_JAHIL = `Bos & <Kumis>`;
const parse = (html: string): HTMLElement => {
  const el = document.createElement('div');
  el.innerHTML = html;
  return el;
};

let riwayat: HasilPutaran[];
beforeAll(() => {
  const langkah = mainkanBot(4, 15, 3);
  riwayat = langkah[langkah.length - 1].sesudah.riwayat;
});

/** Salinan hasil putaran dengan total tertentu per pemain (hanya untuk menguji tampilan). */
function denganTotal(h: HasilPutaran, total: number[]): HasilPutaran {
  const salin = structuredClone(h);
  salin.rincian.forEach((r, i) => (r.total = total[i]));
  return salin;
}

describe('peringkatSeri', () => {
  it('skor sama = peringkat sama, berikutnya melompat', () => {
    expect(peringkatSeri([10, 10, 5])).toEqual([1, 1, 3]);
    expect(peringkatSeri([5, 10, 10, -3])).toEqual([3, 1, 1, 4]);
    expect(peringkatSeri([0, 0, 0, 0])).toEqual([1, 1, 1, 1]);
    expect(peringkatSeri([])).toEqual([]);
  });
});

describe('htmlRincianPutaran (seri)', () => {
  it('total sama mendapat nomor peringkat sama; juara bisa lebih dari satu', () => {
    const h = denganTotal(riwayat[0], [30, 30, -10, 5]);
    const el = parse(htmlRincianPutaran(h, (i) => `P${i}`, 0));
    const nomor = [...el.querySelectorAll('summary .peringkat')].map((x) => x.textContent);
    expect(nomor).toEqual(['1', '1', '3', '4']);
    expect(el.querySelectorAll('details.juara')).toHaveLength(2);
  });

  it('semua seri: tidak ada yang disorot juara', () => {
    const h = denganTotal(riwayat[0], [0, 0, 0, 0]);
    const el = parse(htmlRincianPutaran(h, (i) => `P${i}`, null));
    expect(el.querySelectorAll('details.juara')).toHaveLength(0);
  });

  it('total membawa data-nilai untuk animasi hitung naik (nilai akhir tetap tertulis)', () => {
    const h = riwayat[0];
    const el = parse(htmlRincianPutaran(h, (i) => `P${i}`, null));
    for (const r of h.rincian) {
      const t = el.querySelector<HTMLElement>(`details[data-pemain="${r.pemain}"] summary .total`)!;
      expect(Number(t.dataset.nilai)).toBe(r.total);
    }
  });

  it('"Kena pentung <nama>" di-escape sekali saja (tidak tampil &amp;)', () => {
    const h = riwayat.find((x) => x.cara === 'mentung' && x.kepentung.length)!;
    const el = parse(htmlRincianPutaran(h, () => NAMA_JAHIL, null));
    const korban = el.querySelector(`details[data-pemain="${h.kepentung[0]}"] .komponen`)!;
    expect(korban.textContent).toContain(`Kena pentung ${NAMA_JAHIL}`);
    expect(korban.textContent).not.toContain('&amp;');
    expect(el.querySelector('Kumis')).toBeNull();
  });

  it('chip kartu diberi kelas bunga-<bunga> untuk mode empat warna', () => {
    const el = parse(htmlRincianPutaran(riwayat[0], (i) => `P${i}`, null));
    const chip = [...el.querySelectorAll('.chip')];
    expect(chip.length).toBeGreaterThan(0);
    for (const c of chip) expect(c.className).toMatch(/\bbunga-(love|wajik|kriting|waru)\b/);
  });
});

describe('htmlPeringkat (seri)', () => {
  const nama = ['A', 'B', 'C', 'D'];

  it('belum ada putaran dan semua 0: tanpa medali dan tanpa "memimpin"', () => {
    const el = parse(htmlPeringkat(nama, [0, 0, 0, 0], [], 0));
    expect([...el.querySelectorAll('.medali')].map((m) => m.textContent)).toEqual(['–', '–', '–', '–']);
    expect(el.textContent).not.toContain('memimpin');
    expect(el.textContent).toContain('belum main');
  });

  it('seri di puncak: medali emas untuk keduanya, peringkat berikutnya melompat', () => {
    const el = parse(htmlPeringkat(nama, [40, 40, 10, -5], riwayat, null));
    expect([...el.querySelectorAll('.medali')].map((m) => m.textContent)).toEqual(['🥇', '🥇', '🥉', '4']);
    const kanan = [...el.querySelectorAll('.kanan-peringkat small')].map((s) => s.textContent);
    expect(kanan.slice(0, 2)).toEqual(['seri memimpin', 'seri memimpin']);
    expect(kanan[2]).toBe('−30');
    expect(el.querySelectorAll('.kanan-peringkat .selisih')).toHaveLength(2);
  });
});

describe('htmlKlasemen', () => {
  it('urut skor, medali sesuai peringkat seri, baris juara dan baris saya ditandai, nama di-escape', () => {
    const el = parse(htmlKlasemen(['A', NAMA_JAHIL, 'C'], [15, 15, -20], 1));
    const baris = [...el.querySelectorAll('tbody tr')];
    expect(baris.map((b) => b.querySelector('.medali')!.textContent)).toEqual(['🥇', '🥇', '🥉']);
    expect(baris.filter((b) => b.classList.contains('juara'))).toHaveLength(2);
    expect(el.querySelectorAll('tr.saya')).toHaveLength(1);
    expect(el.querySelector('tr.saya')!.textContent).toContain(NAMA_JAHIL);
    expect([...el.querySelectorAll<HTMLElement>('[data-nilai]')].map((x) => Number(x.dataset.nilai))).toEqual([15, 15, -20]);
  });

  it('semua seri: tidak ada baris juara', () => {
    const el = parse(htmlKlasemen(['A', 'B'], [0, 0], 0));
    expect(el.querySelectorAll('tr.juara')).toHaveLength(0);
  });
});

describe('htmlLog', () => {
  let log: EntriLog[];
  beforeAll(() => {
    const langkah = mainkanBot(4, 15, 3);
    log = langkah[langkah.length - 1].sesudah.log;
  });

  it('dikelompokkan per putaran (terbaru di atas dan terbuka), isinya teks log apa adanya', () => {
    const el = parse(htmlLog(log));
    const kelompok = [...el.querySelectorAll('details.log-putaran')];
    const nomor = [...new Set(log.map((l) => l.putaran))].sort((a, b) => b - a);
    expect(kelompok.map((d) => d.querySelector('summary b')!.textContent)).toEqual(nomor.map((n) => `Putaran ${n}`));
    expect(kelompok[0].hasAttribute('open')).toBe(true);
    expect(kelompok.slice(1).every((d) => !d.hasAttribute('open'))).toBe(true);
    // Tidak ada info tambahan: gabungan teks entri = log mesin aturan persis (tanpa ikon).
    const teks = [...el.querySelectorAll('li')].map((li) => li.querySelector('span:not(.log-ikon)')!.textContent).sort();
    expect(teks).toEqual(log.map((l) => l.pesan).sort());
  });

  it('jenis ditebak dari teks hanya untuk ikon', () => {
    expect(jenisLog('Putaran 2 dimulai. Budi ngocok.')).toBe('mulai');
    expect(jenisLog('Budi ambil kartu dari deck.')).toBe('ambil');
    expect(jenisLog('Budi buang kartu.')).toBe('buang');
    expect(jenisLog('Budi mulung 2 kartu dari buangan, menjadikan 4-5-6 Love.')).toBe('mulung');
    expect(jenisLog('Budi menurunkan 4-5-6 Love.')).toBe('turun');
    expect(jenisLog('Budi mentung pakai 9 Waru!')).toBe('mentung');
    expect(jenisLog('Sari dan Joko kepentung. Lompat, arah tetap.')).toBe('kepentung');
    expect(jenisLog('Permainan selesai.')).toBe('selesai');
  });

  const jalan = (g: GameState, a: Parameters<typeof terapkanAksi>[1]): GameState => {
    const h = terapkanAksi(g, a);
    if (!h.ok) throw new Error(h.error.pesan);
    return h.state;
  };
  /** Deck tinggal satu kartu: aku ambil (deck habis) lalu buang; status jadi susun akhir. */
  const selesaikanDeck = (): GameState => {
    const g0 = skenario({
      rankJoker: 2,
      tangan: [['5 love', '9 waru', 'K kriting'], ['3 waru', '4 waru', '8 kriting'], ['3 love', '4 love', '8 waru'], ['J love', 'Q love', '10 waru']],
      deck: ['7 kriting'],
      giliran: 0,
    });
    const g = jalan(g0, { jenis: 'ambilDeck', pemain: 0 });
    const kartuBuang = g.putaran!.tangan[0].find((x) => x.rank === 9)!;
    return jalan(g, { jenis: 'buang', pemain: 0, kartuId: kartuBuang.id });
  };

  it('pesan engine asli: ambil kartu terakhir deck & pembuka susun akhir bukan "turun"', () => {
    // Deck tinggal satu kartu: aku ambil (deck habis), buang, lalu susun akhir, lalu putaran selesai.
    let g = selesaikanDeck();
    expect(g.status).toBe('susunAkhir');
    g = semuaSelesaiSusun(g);
    const pesan = g.log.map((l) => l.pesan);
    const ambil = pesan.find((p) => p.includes('ambil kartu dari deck'))!;
    const susun = pesan.find((p) => p.includes('boleh menurunkan kartu jadi dari tangan'))!;
    expect(ambil).toContain('Deck habis');
    expect(jenisLog(ambil)).toBe('ambil');
    expect(jenisLog(susun)).toBe('susun');
    expect(jenisLog(pesan.find((p) => p.includes(' buang kartu.'))!)).toBe('buang');
    expect(jenisLog(pesan.find((p) => /^Deck habis\. Putaran \d+ selesai/.test(p))!)).toBe('selesai');
    // Pembuka susun akhir karena mentung (teks engine sama, awalan berbeda).
    expect(jenisLog('Sebelum dihitung. Semua pemain boleh menurunkan kartu jadi dari tangan (tanpa mulung), lalu tekan Selesai.')).toBe('susun');
  });

  it('mentung tanpa korban: "Nggak ada yang kepentung" tergolong selesai, bukan kepentung (pesan engine asli)', () => {
    // Aku mulung kartu buanganku sendiri, lalu buang kartu terakhir: mentung, tapi tidak ada pemilik lain.
    const g0 = skenario({
      rankJoker: 13,
      tangan: [['6 love', '7 love', '9 waru'], ['3 waru', '4 waru', '8 kriting'], ['3 love', '4 love', '8 waru']],
      buangan: [['5 love', 0]],
      giliran: 0,
    });
    let g = jalan(g0, { jenis: 'mulung', pemain: 0, jumlah: 1, kartuJadi: [spek('5 love', '6 love', '7 love')] });
    g = jalan(g, { jenis: 'buang', pemain: 0, kartuId: g.putaran!.tangan[0][0].id });
    g = semuaSelesaiSusun(g);
    const pesan = g.log.map((l) => l.pesan);
    const nihil = pesan.find((p) => p.startsWith('Nggak ada yang kepentung'))!;
    expect(nihil).toBeDefined();
    expect(jenisLog(nihil)).toBe('selesai');
    expect(jenisLog(pesan.find((p) => p.includes(' mentung pakai '))!)).toBe('mentung');
    expect(jenisLog(pesan.find((p) => p.includes(' mulung '))!)).toBe('mulung');
    expect(pesan.map(jenisLog)).not.toContain('kepentung');
  });

  it('permainan diakhiri bersama: tergolong selesai (pesan engine asli)', () => {
    const g = jalan(semuaSelesaiSusun(selesaikanDeck()), { jenis: 'akhiriPermainan' });
    const akhir = g.log[g.log.length - 1].pesan;
    expect(akhir).toMatch(/sepakat berhenti/);
    expect(jenisLog(akhir)).toBe('selesai');
  });

  it('setiap template catat() di mesin aturan punya jenis yang masuk akal', () => {
    // Satu baris per catat() di packages/engine/src/mesin.ts (dicek ulang oleh test log bot di bawah).
    const kasus: [string, string][] = [
      ['Putaran 3 dimulai. Budi ngocok.', 'mulai'],
      ['Semua sepakat berhenti. Permainan selesai.', 'selesai'],
      ['Budi ambil kartu dari deck.', 'ambil'],
      ['Budi ambil kartu dari deck. Deck habis. Setelah giliran ini semua pemain dapat kesempatan terakhir menurunkan kartu jadi.', 'ambil'],
      ['Budi mulung 2 kartu dari buangan, menjadikan 4-5-6 Love dan J-Q-K Waru.', 'mulung'],
      ['Budi menurunkan 4-5-6 Love (2 Waru jadi 5).', 'turun'],
      ['Budi menurunkan kembar As Waru-Love-Kriting.', 'turun'],
      ['Budi mentung pakai 2 Waru!', 'mentung'],
      ['Budi buang kartu.', 'buang'],
      ['Deck habis. Semua pemain boleh menurunkan kartu jadi dari tangan (tanpa mulung), lalu tekan Selesai.', 'susun'],
      ['Sebelum dihitung. Semua pemain boleh menurunkan kartu jadi dari tangan (tanpa mulung), lalu tekan Selesai.', 'susun'],
      ['Deck habis. Putaran 2 selesai, semua dihitung skor dasar.', 'selesai'],
      ['Nggak ada yang kepentung. Arah tetap.', 'selesai'],
      ['Sari kepentung. Arah putaran berikutnya dibalik.', 'kepentung'],
      ['Sari, Joko dan Budi kepentung. Lompat, arah tetap.', 'kepentung'],
      ['Permainan selesai.', 'selesai'],
    ];
    for (const [pesan, jenis] of kasus) expect([pesan, jenisLog(pesan)]).toEqual([pesan, jenis]);
  });

  it('nama pemain yang mirip kata kunci log tidak mengacaukan ikon', () => {
    for (const nama of ['Kepentung', 'Selesai', 'Mas Mentung', 'Si menurunkan', 'Deck habis']) {
      expect(jenisLog(`${nama} ambil kartu dari deck.`)).toBe('ambil');
      expect(jenisLog(`${nama} buang kartu.`)).toBe('buang');
      expect(jenisLog(`${nama} menurunkan 4-5-6 Love.`)).toBe('turun');
      expect(jenisLog(`${nama} mulung 1 kartu dari buangan, menjadikan 4-5-6 Love.`)).toBe('mulung');
      expect(jenisLog(`${nama} mentung pakai 9 Waru!`)).toBe('mentung');
      expect(jenisLog(`Putaran 2 dimulai. ${nama} ngocok.`)).toBe('mulai');
    }
  });

  it('log bot-vs-bot (2-4 pemain): tidak ada pesan engine yang jatuh ke "lain"', () => {
    for (const n of [2, 3, 4]) {
      for (const seed of [1, 2]) {
        const l = mainkanBot(n, seed, 3);
        for (const e of l[l.length - 1].sesudah.log) expect([e.pesan, jenisLog(e.pesan)]).not.toEqual([e.pesan, 'lain']);
      }
    }
  });

  it('log kosong: pesan ramah; pesan berisi HTML di-escape', () => {
    expect(parse(htmlLog([])).textContent).toContain('Belum ada kejadian');
    const el = parse(htmlLog([{ putaran: 1, pesan: `<img src=x> buang kartu.` }]));
    expect(el.querySelector('img')).toBeNull();
  });
});
