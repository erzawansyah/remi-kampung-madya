// Pelanggaran aturan. `pesan` ditampilkan apa adanya ke pemain, pakai bahasa tongkrongan.

export type KodeError =
  | 'BUKAN_GILIRAN'
  | 'TAHAP_SALAH'
  | 'STATUS_SALAH'
  | 'KARTU_TIDAK_ADA'
  | 'KARTU_DOBEL'
  | 'KARTU_JADI_TIDAK_SAH'
  | 'JOKER_TIDAK_SAH'
  | 'AS_TIGA_BELUM_PUNYA_JADI'
  | 'MULUNG_JUMLAH'
  | 'MULUNG_TANPA_KARTU_BAWAH'
  | 'MODAL_KURANG'
  | 'MODAL_TANPA_KARTU_BIASA'
  | 'SISAKAN_KARTU'
  | 'AS_BELUM_BOLEH_DIBUANG'
  | 'NUTUP_TANPA_MULUNG'
  | 'BUANG_SATU_KARTU'
  | 'PENTUNGAN_BUKAN_JOKER'
  | 'NUTUP_KEBANYAKAN'
  | 'PENTUNGAN_KEMBARAN'
  | 'DECK_KOSONG'
  | 'PENGOCOK_TIDAK_SAH'
  | 'KONFIGURASI_TIDAK_SAH';

export class AturanError extends Error {
  constructor(
    public readonly kode: KodeError,
    public readonly pesan: string,
  ) {
    super(pesan);
    this.name = 'AturanError';
  }
}

export function langgar(kode: KodeError, pesan: string): never {
  throw new AturanError(kode, pesan);
}
