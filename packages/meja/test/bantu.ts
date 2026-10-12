import { pilihAksiBot, Rng, type ViewPemain } from '@remi/engine';
import { Meja, type OpsiMeja, type Penjadwal } from '../src/meja.js';
import type { InfoMeja, PesanServer } from '../src/protokol.js';

/** Penjadwal palsu: waktu hanya maju saat diminta. */
export class JamPalsu implements Penjadwal {
  waktu = 1_000_000;
  private antrian: { id: number; t: number; fn: () => void }[] = [];
  private seq = 0;

  setel(ms: number, fn: () => void): unknown {
    const id = ++this.seq;
    this.antrian.push({ id, t: this.waktu + ms, fn });
    return id;
  }
  batal(h: unknown): void {
    this.antrian = this.antrian.filter((x) => x.id !== h);
  }
  sekarang(): number {
    return this.waktu;
  }
  get jumlahTimer(): number {
    return this.antrian.length;
  }
  /** Majukan waktu, menjalankan timer yang jatuh tempo. */
  maju(ms: number): void {
    const target = this.waktu + ms;
    for (;;) {
      this.antrian.sort((a, b) => a.t - b.t || a.id - b.id);
      const x = this.antrian[0];
      if (!x || x.t > target) break;
      this.antrian.shift();
      this.waktu = x.t;
      x.fn();
    }
    this.waktu = target;
  }
  /** Jalankan timer berikutnya saja. Mengembalikan false bila tidak ada. */
  langkah(): boolean {
    this.antrian.sort((a, b) => a.t - b.t || a.id - b.id);
    const x = this.antrian.shift();
    if (!x) return false;
    this.waktu = Math.max(this.waktu, x.t);
    x.fn();
    return true;
  }
}

export class KotakSurat {
  pesan = new Map<string, PesanServer[]>();
  kirim = (pemainId: string, p: PesanServer) => {
    if (!this.pesan.has(pemainId)) this.pesan.set(pemainId, []);
    this.pesan.get(pemainId)!.push(p);
  };
  semua(pemainId: string): PesanServer[] {
    return this.pesan.get(pemainId) ?? [];
  }
  terakhir<T extends PesanServer['t']>(pemainId: string, t: T): Extract<PesanServer, { t: T }> | undefined {
    const daftar = this.semua(pemainId).filter((p) => p.t === t);
    return daftar[daftar.length - 1] as Extract<PesanServer, { t: T }> | undefined;
  }
  info(pemainId: string): InfoMeja {
    return this.terakhir(pemainId, 'meja')!.info;
  }
  view(pemainId: string): ViewPemain {
    return this.terakhir(pemainId, 'view')!.view;
  }
  errors(pemainId: string): string[] {
    return this.semua(pemainId)
      .filter((p): p is Extract<PesanServer, { t: 'error' }> => p.t === 'error')
      .map((p) => p.pesan);
  }
  bersihkan(): void {
    this.pesan.clear();
  }
}

export function siapkan(extra: Partial<OpsiMeja> = {}) {
  const jam = new JamPalsu();
  const surat = new KotakSurat();
  let seed = 1;
  const opsi: OpsiMeja = { kode: 'ABCDE', kirim: surat.kirim, penjadwal: jam, jedaBotMs: 100, buatSeed: () => seed++, ...extra };
  return { jam, surat, opsi };
}

/** Manusia "pura-pura": memakai bot normal untuk memilih aksi dari view yang ia terima. */
export function aksiManusia(meja: Meja, surat: KotakSurat, pemainId: string, rng: Rng): boolean {
  if (surat.info(pemainId).menungguJoker.includes(surat.info(pemainId).kursiSaya!)) {
    meja.terima(pemainId, { t: 'siapJoker' });
    return true;
  }
  const v = surat.view(pemainId);
  const bisa =
    v.status === 'susunAkhir' ? !v.putaran!.selesaiSusun[v.saya!] : v.status === 'putaranBerjalan' && v.putaran!.giliran === v.saya;
  if (!bisa) return false;
  const aksi = pilihAksiBot(v, 'normal', rng);
  const { pemain: _, ...tanpaPemain } = aksi as typeof aksi & { pemain: number };
  meja.terima(pemainId, { t: 'aksi', aksi: tanpaPemain as never });
  return true;
}

/** Semua manusia di meja menekan OK di pengumuman joker. */
export function siapSemua(meja: Meja): void {
  for (const k of meja.data.kursi) if (k.jenis === 'manusia' && k.pemainId) meja.terima(k.pemainId, { t: 'siapJoker' });
}
