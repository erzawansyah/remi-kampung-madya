// Tipe minimal paket `qrcode` (hanya `create` yang dipakai, lihat MejaKedai.tsx).
declare module 'qrcode' {
  export interface ModulQr {
    size: number;
    get(baris: number, kolom: number): number | boolean;
  }
  export function create(teks: string, opsi?: { errorCorrectionLevel?: 'L' | 'M' | 'Q' | 'H' }): { modules: ModulQr; version: number };
}
