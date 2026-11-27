// Alat bantu test sprint di server (dipakai sprint.test.ts dan sprintLanjut.test.ts).

import type { DatabaseSync } from 'node:sqlite';
import WebSocket from 'ws';
import { jumlahPutaranSelesai, pilihAksiBot, Rng, type ViewPemain } from '@remi/engine';
import type { InfoMeja, Penjadwal } from '@remi/meja';

export const tunggu = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Penjadwal palsu yang ikut jam sungguhan, tapi bisa dimajukan (umur simpanan meja). */
export class JamGeser implements Penjadwal {
  geser = 0;
  setel(ms: number, fn: () => void): unknown {
    return setTimeout(fn, ms);
  }
  batal(h: unknown): void {
    clearTimeout(h as ReturnType<typeof setTimeout>);
  }
  sekarang(): number {
    return Date.now() + this.geser;
  }
}

export type Pesan = { t: string; [k: string]: unknown };
export interface Klien {
  ws: WebSocket;
  pesan: Pesan[];
  kirim(x: unknown): void;
}
export async function klien(port: number, saatPesan?: (p: Pesan, k: Klien) => void): Promise<Klien> {
  const ws = new WebSocket(`ws://127.0.0.1:${port}/ws`);
  const k: Klien = { ws, pesan: [], kirim: (x) => ws.send(JSON.stringify(x)) };
  ws.on('message', (d) => {
    const p = JSON.parse(d.toString()) as Pesan;
    k.pesan.push(p);
    saatPesan?.(p, k);
  });
  ws.on('error', () => undefined);
  await new Promise((ok) => ws.on('open', ok));
  return k;
}
export async function tungguPesan(k: Klien, syarat: (p: Pesan) => boolean, ms = 5000): Promise<Pesan> {
  const mulai = Date.now();
  for (;;) {
    const p = [...k.pesan].reverse().find(syarat);
    if (p) return p;
    if (Date.now() - mulai > ms) throw new Error(`pesan tidak datang; terakhir: ${JSON.stringify(k.pesan.slice(-3)).slice(0, 400)}`);
    await tunggu(5);
  }
}
export async function sampai(syarat: () => boolean, ms = 5000): Promise<void> {
  const mulai = Date.now();
  while (!syarat()) {
    if (Date.now() - mulai > ms) throw new Error('syarat tidak terpenuhi');
    await tunggu(5);
  }
}
export const infoTerakhir = (k: Klien) => ([...k.pesan].reverse().find((p) => p.t === 'meja') as { info: InfoMeja } | undefined)?.info;
export const errors = (k: Klien) => k.pesan.filter((p) => p.t === 'error').map((p) => p.pesan);

/**
 * Pemain "pura-pura" yang memainkan sprint: tekan OK joker, jalan di gilirannya (strategi normal), dan
 * mulai putaran berikutnya sampai putaran ke-n selesai (`sampai` boleh dinaikkan di tengah jalan).
 */
export function pemainOtomatis(berhenti: number | { sampai: number }) {
  const batas = typeof berhenti === 'number' ? { sampai: berhenti } : berhenti;
  const rng = new Rng(11);
  const sudah = new Set<string>();
  let info: InfoMeja | null = null;
  return (p: Pesan, k: Klien) => {
    if (p.t === 'meja') info = p.info as InfoMeja;
    if (p.t !== 'view' || !info) return;
    const v = p.view as ViewPemain;
    const saya = v.saya!;
    const sekali = (kunci: string, pesan: unknown) => {
      if (sudah.has(kunci)) return;
      sudah.add(kunci);
      k.kirim(pesan);
    };
    if (info.menungguJoker.includes(saya)) return sekali(`joker:${v.putaran?.nomor}`, { t: 'siapJoker' });
    if (v.status === 'putaranSelesai') {
      if (v.riwayat.length >= batas.sampai) return;
      return sekali(`lanjut:${v.riwayat.length}`, { t: 'putaranBerikut' });
    }
    const giliran = v.status === 'susunAkhir' ? !v.putaran!.selesaiSusun[saya] : v.status === 'putaranBerjalan' && v.putaran!.giliran === saya;
    if (!giliran) return;
    const kunci = JSON.stringify([v.status, v.putaran!.nomor, v.putaran!.tahap, v.peristiwa.at(-1)?.id ?? 0]);
    const aksi = pilihAksiBot(v, 'normal', rng);
    const { pemain: _, ...tanpaPemain } = aksi as typeof aksi & { pemain: number };
    sekali(kunci, { t: 'aksi', aksi: tanpaPemain });
  };
}

export const barisSprint = (db: DatabaseSync) =>
  db.prepare('SELECT kode_meja, putaran, nama, kunci_nama, waktu, skor, menang, mentung, kepentung FROM sprint_putaran ORDER BY id').all() as Record<
    string,
    number | string
  >[];

/** Data sprint yang tersimpan (sprint_simpanan, 27 Nov 2026) untuk meja `kode`. */
export const dataSprintTersimpan = <T = Record<string, unknown>>(db: DatabaseSync, kode: unknown): T | undefined => {
  const b = db.prepare('SELECT data FROM sprint_simpanan WHERE kode = ?').get(String(kode)) as { data: string | null } | undefined;
  return b?.data ? (JSON.parse(b.data) as T) : undefined;
};
export const tulisDataSprint = (db: DatabaseSync, kode: unknown, data: unknown) =>
  db.prepare('UPDATE sprint_simpanan SET data = ? WHERE kode = ?').run(JSON.stringify(data), String(kode));

export const viewTerakhir = (k: Klien) => ([...k.pesan].reverse().find((p) => p.t === 'view') as unknown as { view: ViewPemain }).view;
export const putaranSelesai = (n: number) => (p: Pesan) =>
  p.t === 'view' && (p.view as ViewPemain).status === 'putaranSelesai' && jumlahPutaranSelesai(p.view as ViewPemain) === n;

