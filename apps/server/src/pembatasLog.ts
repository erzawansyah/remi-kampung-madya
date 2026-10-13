// Pembatas log per jenis kejadian: kejadian yang bisa dipicu klien dari luar (galat sambungan, banjir
// pesan, galat memproses pesan) tidak boleh membanjiri log dan memutar habis rotasi log Docker.
// Tiap jenis paling banyak `maks` baris per `jendelaMs`; sisanya hanya dihitung, lalu jumlah yang
// disembunyikan disebut di baris berikutnya yang lolos. Total semua kejadian tetap tersedia untuk
// ringkasan 'status:' berkala.

export interface OpsiPembatasLog {
  /** Baris per jenis per jendela. Bawaan 10. */
  maks?: number;
  /** Panjang jendela dalam ms. Bawaan 60 detik. */
  jendelaMs?: number;
  sekarang?: () => number;
}

export interface PembatasLog {
  /** Catat satu kejadian. Ditulis ke log hanya kalau jatah jenis ini belum habis. */
  catat(jenis: string, ...isi: unknown[]): void;
  /** Total kejadian per jenis sejak server jalan (termasuk yang tidak ditulis). */
  total(jenis: string): number;
}

export function buatPembatasLog(log: (...x: unknown[]) => void, opsi: OpsiPembatasLog = {}): PembatasLog {
  const maks = opsi.maks ?? 10;
  const jendelaMs = opsi.jendelaMs ?? 60_000;
  const sekarang = opsi.sekarang ?? Date.now;
  const per = new Map<string, { mulai: number; tertulis: number; disembunyikan: number; total: number }>();
  return {
    catat(jenis, ...isi) {
      const t = sekarang();
      let s = per.get(jenis);
      if (!s) per.set(jenis, (s = { mulai: t, tertulis: 0, disembunyikan: 0, total: 0 }));
      s.total++;
      if (t - s.mulai >= jendelaMs) {
        s.mulai = t;
        s.tertulis = 0;
      }
      if (s.tertulis >= maks) {
        s.disembunyikan++;
        return;
      }
      s.tertulis++;
      if (s.disembunyikan > 0) {
        log(...isi, `(+${s.disembunyikan} kejadian serupa tidak dicatat, total ${s.total})`);
        s.disembunyikan = 0;
      } else {
        log(...isi);
      }
    },
    total: (jenis) => per.get(jenis)?.total ?? 0,
  };
}
