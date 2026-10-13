// Golden master meja: permainan offline penuh (1 manusia "pura-pura" + bot) dengan JamPalsu,
// jedaBotMs tetap, seed tetap, dan sumber acak celetukan tetap. Urutan pesan keluar (KotakSurat)
// dikunci lewat sidik jari sha256 di __golden__/. Proteksi regresi untuk alur meja: giliran bot,
// pengumuman joker, susun akhir, putaran berikut, celetukan bot, dan klasemen akhir.
//
// Hash berubah karena perubahan yang disengaja (sudah disetujui)? Tinjau ringkasannya, lalu
// `npx vitest run packages/meja/test/golden-meja.test.ts -u`. Selain itu anggap regresi.
// Lihat docs/baseline-gameplay.md.

import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { Rng, type LevelBot } from '@remi/engine';
import { Meja, type OpsiMeja, type PesanServer, type RingkasanAkhir } from '../src/index.js';
import { aksiManusia, JamPalsu, KotakSurat } from './bantu.js';

/** JSON dengan kunci objek terurut, supaya urutan field di kode tidak memengaruhi hash. */
function jsonTerurut(x: unknown): string {
  return JSON.stringify(x, (_k, v: unknown) => {
    if (v && typeof v === 'object' && !Array.isArray(v)) {
      const o = v as Record<string, unknown>;
      return Object.fromEntries(Object.keys(o).sort().map((k) => [k, o[k]]));
    }
    return v;
  });
}

const sha = (s: string) => createHash('sha256').update(s).digest('hex');

interface SkenarioMeja {
  label: string;
  jumlahPemain: number;
  duaDeckUntukEmpat: boolean;
  /** Level bot untuk kursi 1.. (kursi 0 = host manusia). */
  levelBot: LevelBot[];
  seedAwal: number;
  seedAcak: number;
  seedManusia: number;
  batasPutaran: number;
}

const SKENARIO: SkenarioMeja[] = [
  { label: '3-pemain', jumlahPemain: 3, duaDeckUntukEmpat: false, levelBot: ['normal', 'mudah'], seedAwal: 11, seedAcak: 777, seedManusia: 9, batasPutaran: 2 },
  { label: '4-pemain-2-deck', jumlahPemain: 4, duaDeckUntukEmpat: true, levelBot: ['normal', 'normal', 'mudah'], seedAwal: 21, seedAcak: 778, seedManusia: 10, batasPutaran: 2 },
];

function mainkanMeja(sk: SkenarioMeja) {
  const jam = new JamPalsu();
  const surat = new KotakSurat();
  const acak = new Rng(sk.seedAcak);
  let seed = sk.seedAwal;
  const ringkasan: RingkasanAkhir[] = [];
  const opsi: OpsiMeja = {
    kode: 'GOLD1',
    kirim: surat.kirim,
    penjadwal: jam,
    jedaBotMs: 100,
    buatSeed: () => seed++,
    acak: () => acak.next(),
    saatSelesai: (r) => ringkasan.push(r),
  };
  const meja = Meja.buat(opsi, 'host', 'Budi', {
    jumlahPemain: sk.jumlahPemain,
    duaDeckUntukEmpat: sk.duaDeckUntukEmpat,
    detikGiliran: 0,
    batasPutaran: sk.batasPutaran,
  });
  sk.levelBot.forEach((level, i) => meja.terima('host', { t: 'aturKursi', kursi: i + 1, jenis: 'bot', level }));
  meja.terima('host', { t: 'mulai' });

  const rng = new Rng(sk.seedManusia);
  for (let i = 0; ; i++) {
    if (i > 50_000) throw new Error('permainan meja tidak selesai');
    const st = meja.data.game?.status;
    if (st === 'selesai') break;
    if (st === 'putaranSelesai') {
      meja.terima('host', { t: 'putaranBerikut' });
      continue;
    }
    if (aksiManusia(meja, surat, 'host', rng)) continue;
    if (!jam.langkah()) throw new Error('macet: tidak ada timer dan bukan giliran manusia');
  }
  // Habiskan timer sisa (celetukan bot yang dijadwalkan sesudah aksi terakhir).
  for (let i = 0; jam.langkah(); i++) if (i > 100) throw new Error('timer tidak habis');
  meja.hentikan();
  return { meja, surat, ringkasan, waktuAkhir: jam.sekarang() };
}

describe('golden master meja: permainan offline penuh dengan JamPalsu', () => {
  for (const sk of SKENARIO) {
    it(`${sk.label}: urutan pesan keluar cocok dengan baseline`, async () => {
      const { meja, surat, ringkasan, waktuAkhir } = mainkanMeja(sk);
      const pesan = surat.semua('host');

      expect(surat.errors('host')).toEqual([]);
      expect(ringkasan).toHaveLength(1);
      // Info rahasia: selama putaran berjalan, tangan lawan tidak pernah terkirim ke host.
      for (const p of pesan) {
        if (p.t !== 'view' || !p.view.putaran) continue;
        if (p.view.status !== 'putaranBerjalan' && p.view.status !== 'susunAkhir') continue;
        p.view.putaran.tangan.forEach((t, i) => (i === 0 ? expect(t).not.toBeNull() : expect(t).toBeNull()));
      }

      const jumlahPerJenis: Record<string, number> = {};
      for (const p of pesan) jumlahPerJenis[p.t] = (jumlahPerJenis[p.t] ?? 0) + 1;
      const hanya = (t: PesanServer['t']) => pesan.filter((p) => p.t === t);
      const data = meja.data;
      const game = data.game!;
      const isi = {
        skenario: sk,
        jumlahPesan: pesan.length,
        jumlahPerJenis: Object.fromEntries(Object.entries(jumlahPerJenis).sort(([a], [b]) => a.localeCompare(b))),
        emote: hanya('emote').map((p) => (p.t === 'emote' ? `${p.kursi}:${p.isi}` : '')),
        waktuAkhir,
        putaran: game.riwayat.map((r) => ({ nomor: r.nomor, cara: r.cara, pementung: r.pementung, kepentung: r.kepentung, total: r.rincian.map((x) => x.total) })),
        skorAkhir: game.skor,
        ringkasanAkhir: ringkasan[0],
        hash: {
          semuaPesan: sha(pesan.map(jsonTerurut).join('\n')),
          pesanView: sha(hanya('view').map(jsonTerurut).join('\n')),
          pesanMeja: sha(hanya('meja').map(jsonTerurut).join('\n')),
          dataMejaAkhir: sha(jsonTerurut(data)),
        },
      };
      await expect(`${JSON.stringify(isi, null, 2)}\n`).toMatchFileSnapshot(`./__golden__/meja-${sk.label}.json`);
    }, 60_000);
  }

  it('determinisme: skenario yang sama dua kali menghasilkan pesan identik', () => {
    const a = mainkanMeja(SKENARIO[0]).surat.semua('host').map(jsonTerurut);
    const b = mainkanMeja(SKENARIO[0]).surat.semua('host').map(jsonTerurut);
    expect(b).toEqual(a);
  });
});
