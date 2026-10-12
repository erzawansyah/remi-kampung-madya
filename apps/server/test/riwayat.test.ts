import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { RingkasanAkhir } from '@remi/meja';
import { bukaRiwayat, type PenyimpanRiwayat } from '../src/riwayat.js';
import { jalankanServer, type ServerRemi } from '../src/server.js';

const ringkasan = (kode: string, waktu: number, pemain: [string, number, boolean?][]): RingkasanAkhir => {
  const urut = pemain
    .map(([nama, skor, bot], kursi) => ({ kursi, nama, bot: !!bot, skor, peringkat: 0, mentung: skor > 0 ? 1 : 0, kepentung: skor < 0 ? 1 : 0 }))
    .sort((a, b) => b.skor - a.skor);
  urut.forEach((p, i) => (p.peringkat = i + 1));
  return { kode, selesaiPada: waktu, alasan: 'sepakat', jumlahPutaran: 3, pemain: urut };
};

describe('riwayat SQLite', () => {
  it('menyimpan klasemen akhir dan membacanya kembali (terbaru dulu)', () => {
    const r = bukaRiwayat(':memory:');
    r.simpan(ringkasan('AAAAA', Date.UTC(2026, 9, 1), [['Budi', 120], ['Siti', -40], ['Bot 1', -80, true]]));
    r.simpan(ringkasan('BBBBB', Date.UTC(2026, 9, 2), [['Budi', -10], ['Siti', 90]]));
    const daftar = r.daftar(10);
    expect(daftar.map((p) => p.kodeMeja)).toEqual(['BBBBB', 'AAAAA']);
    expect(daftar[1]).toMatchObject({ jumlahPutaran: 3, alasan: 'sepakat', selesaiPada: '2026-10-01T00:00:00.000Z' });
    expect(daftar[1].klasemen.map((k) => [k.peringkat, k.nama, k.skor, k.bot])).toEqual([
      [1, 'Budi', 120, false],
      [2, 'Siti', -40, false],
      [3, 'Bot 1', -80, true],
    ]);
    expect(r.daftar(1)).toHaveLength(1);
    r.tutup();
  });

  it('peringkat sepanjang masa: hanya manusia, digabung per nama', () => {
    const r = bukaRiwayat(':memory:');
    r.simpan(ringkasan('AAAAA', 1, [['Budi', 120], ['Siti', -40], ['Bot 1', 300, true]]));
    r.simpan(ringkasan('BBBBB', 2, [['Budi', -10], ['Siti', 90]]));
    r.simpan(ringkasan('CCCCC', 3, [['Budi', 50], ['Siti', 10]]));
    const p = r.peringkat();
    expect(p.map((x) => x.nama)).toEqual(['Budi', 'Siti']);
    expect(p[0]).toMatchObject({ main: 3, juara: 1, totalSkor: 160, rataRata: 53, skorTerbaik: 120 });
    expect(p[1]).toMatchObject({ main: 3, juara: 1, totalSkor: 60 });
    r.tutup();
  });
});

describe('endpoint riwayat', () => {
  let server: ServerRemi;
  let riwayat: PenyimpanRiwayat;
  beforeAll(async () => {
    riwayat = bukaRiwayat(':memory:');
    riwayat.simpan(ringkasan('AAAAA', 1, [['Budi', 120], ['Siti', -40]]));
    server = await jalankanServer({ port: 0, host: '127.0.0.1', riwayat, log: () => undefined });
  });
  afterAll(async () => {
    await server.tutup();
    riwayat.tutup();
  });

  it('GET /api/riwayat dan /api/peringkat', async () => {
    const r1 = await fetch(`http://127.0.0.1:${server.port}/api/riwayat?batas=5`);
    expect(r1.status).toBe(200);
    const daftar = (await r1.json()) as { kodeMeja: string }[];
    expect(daftar[0].kodeMeja).toBe('AAAAA');
    const r2 = await fetch(`http://127.0.0.1:${server.port}/api/peringkat`);
    expect(((await r2.json()) as unknown[])[0]).toMatchObject({ nama: 'Budi', juara: 1 });
    const r3 = await fetch(`http://127.0.0.1:${server.port}/api/riwayat`, { method: 'POST' });
    expect(r3.status).toBe(405);
  });
});
