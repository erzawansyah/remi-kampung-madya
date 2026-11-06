// Pemain otomatis untuk rekaman: memilih aksi dengan strategi warga kedai Normal (gaya standar) dan
// Rng tetap per keputusan, jadi pilihannya hanya bergantung pada view. Dipakai pencari seed (Node)
// dan pemain di browser saat merekam, sehingga putarannya sama persis di keduanya.
import { pilihAksiBot, Rng, type ViewPemain } from '../../../packages/engine/src/index.ts';

export function aksiOtomatis(v: ViewPemain): Record<string, unknown> | null {
  const saya = v.saya;
  const p = v.putaran;
  if (saya === null || !p) return null;
  const giliranku = v.status === 'putaranBerjalan' && p.giliran === saya;
  const susunku = v.status === 'susunAkhir' && !p.selesaiSusun[saya];
  if (!giliranku && !susunku) return null;
  const { pemain: _, ...aksi } = pilihAksiBot(v, 'normal', new Rng(20261106)) as unknown as Record<string, unknown>;
  return aksi;
}
