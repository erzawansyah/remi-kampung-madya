// Validasi bentuk pesan dari client. Data dari jaringan tidak dipercaya: bentuk yang salah
// ditolak di sini supaya tidak pernah sampai ke mesin aturan.

import type { LevelBot, SpesifikasiKartuJadi } from '@remi/engine';
import { DAFTAR_EMOTE, type AksiKlien, type Emote, type PengaturanMeja, type PesanKlien } from './protokol.js';

type Obj = Record<string, unknown>;

const isObj = (x: unknown): x is Obj => typeof x === 'object' && x !== null && !Array.isArray(x);
const isInt = (x: unknown): x is number => typeof x === 'number' && Number.isInteger(x);
const isStr = (x: unknown, maks = 200): x is string => typeof x === 'string' && x.length <= maks;
const isLevel = (x: unknown): x is LevelBot => x === 'mudah' || x === 'normal';

function spesifikasi(x: unknown): SpesifikasiKartuJadi[] | null {
  if (!Array.isArray(x) || x.length < 1 || x.length > 8) return null;
  const hasil: SpesifikasiKartuJadi[] = [];
  for (const kj of x) {
    if (!Array.isArray(kj) || kj.length < 1 || kj.length > 13) return null;
    const spek: SpesifikasiKartuJadi = [];
    for (const p of kj) {
      if (!isObj(p) || !isStr(p.id, 40)) return null;
      if (p.sebagai === undefined) {
        spek.push({ id: p.id });
        continue;
      }
      const s = p.sebagai;
      if (!isObj(s) || !isInt(s.rank) || s.rank < 1 || s.rank > 13) return null;
      if (!['waru', 'love', 'kriting', 'wajik'].includes(s.bunga as string)) return null;
      spek.push({ id: p.id, sebagai: { rank: s.rank as never, bunga: s.bunga as never } });
    }
    hasil.push(spek);
  }
  return hasil;
}

export function validasiAksi(x: unknown): AksiKlien | null {
  if (!isObj(x)) return null;
  switch (x.jenis) {
    case 'ambilDeck':
      return { jenis: 'ambilDeck' };
    case 'selesaiSusun':
      return { jenis: 'selesaiSusun' };
    case 'buang':
      return isStr(x.kartuId, 40) ? { jenis: 'buang', kartuId: x.kartuId } : null;
    case 'turunkan': {
      const kj = spesifikasi(x.kartuJadi);
      return kj ? { jenis: 'turunkan', kartuJadi: kj } : null;
    }
    case 'mulung': {
      const kj = spesifikasi(x.kartuJadi);
      return kj && isInt(x.jumlah) ? { jenis: 'mulung', jumlah: x.jumlah, kartuJadi: kj } : null;
    }
    default:
      return null;
  }
}

export function validasiPengaturan(x: unknown): Partial<PengaturanMeja> | null {
  if (!isObj(x)) return null;
  const hasil: Partial<PengaturanMeja> = {};
  const batas = (v: unknown) => v === null || (isInt(v) && Math.abs(v) <= 100000);
  if (x.jumlahPemain !== undefined) {
    if (!isInt(x.jumlahPemain) || x.jumlahPemain < 2 || x.jumlahPemain > 6) return null;
    hasil.jumlahPemain = x.jumlahPemain;
  }
  if (x.duaDeckUntukEmpat !== undefined) {
    if (typeof x.duaDeckUntukEmpat !== 'boolean') return null;
    hasil.duaDeckUntukEmpat = x.duaDeckUntukEmpat;
  }
  for (const k of ['batasPutaran', 'batasSkorAtas', 'batasSkorBawah'] as const) {
    if (x[k] === undefined) continue;
    if (!batas(x[k])) return null;
    hasil[k] = x[k] as number | null;
  }
  if (hasil.batasPutaran !== undefined && hasil.batasPutaran !== null && hasil.batasPutaran < 1) return null;
  if (x.publik !== undefined) {
    if (typeof x.publik !== 'boolean') return null;
    hasil.publik = x.publik;
  }
  if (x.detikGiliran !== undefined) {
    if (!isInt(x.detikGiliran) || x.detikGiliran < 0 || x.detikGiliran > 600) return null;
    hasil.detikGiliran = x.detikGiliran;
  }
  if (x.levelBot !== undefined) {
    if (!isLevel(x.levelBot)) return null;
    hasil.levelBot = x.levelBot;
  }
  if (x.tempoBot !== undefined) {
    if (x.tempoBot !== 'santai' && x.tempoBot !== 'normal' && x.tempoBot !== 'cepat') return null;
    hasil.tempoBot = x.tempoBot;
  }
  return hasil;
}

/** Ubah data mentah (hasil JSON.parse) menjadi PesanKlien yang sah, atau null. */
export function validasiPesan(x: unknown): PesanKlien | null {
  if (!isObj(x) || typeof x.t !== 'string') return null;
  const pengocok = (v: unknown) => v === undefined || isInt(v);
  switch (x.t) {
    case 'buat': {
      if (!isStr(x.nama, 100)) return null;
      const pengaturan = x.pengaturan === undefined ? {} : validasiPengaturan(x.pengaturan);
      return pengaturan ? { t: 'buat', nama: x.nama, pengaturan } : null;
    }
    case 'gabung':
      if (!isStr(x.kode, 20) || !isStr(x.nama, 100)) return null;
      if (x.token !== undefined && !isStr(x.token, 100)) return null;
      return { t: 'gabung', kode: x.kode, nama: x.nama, token: x.token as string | undefined };
    case 'daftar':
    case 'keluar':
    case 'mainLagi':
    case 'siapJoker':
    case 'ping':
      return { t: x.t };
    case 'aturKursi':
      if (!isInt(x.kursi) || (x.jenis !== 'bot' && x.jenis !== 'kosong')) return null;
      if (x.level !== undefined && !isLevel(x.level)) return null;
      return { t: 'aturKursi', kursi: x.kursi, jenis: x.jenis, level: x.level as LevelBot | undefined };
    case 'pengaturan': {
      const p = validasiPengaturan(x.pengaturan);
      return p ? { t: 'pengaturan', pengaturan: p } : null;
    }
    case 'mulai':
    case 'putaranBerikut':
      return pengocok(x.pengocok) ? { t: x.t, pengocok: x.pengocok as number | undefined } : null;
    case 'aksi': {
      const aksi = validasiAksi(x.aksi);
      return aksi ? { t: 'aksi', aksi } : null;
    }
    case 'akhiri':
      return typeof x.setuju === 'boolean' ? { t: 'akhiri', setuju: x.setuju } : null;
    case 'emote':
      return (DAFTAR_EMOTE as readonly string[]).includes(x.isi as string) ? { t: 'emote', isi: x.isi as Emote } : null;
    default:
      return null;
  }
}

/** Nama tampilan: dirapikan, maksimal 16 karakter. */
export function rapikanNama(nama: string): string {
  const bersih = nama.replace(/[\u0000-\u001f<>]/g, '').replace(/\s+/g, ' ').trim().slice(0, 16);
  return bersih || 'Pemain';
}
