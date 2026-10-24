import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { DAFTAR_EMOTE, DAFTAR_LEDEKAN, PESAN_USULAN } from '@remi/meja';
import { BAB_BANTUAN, FAQ, GLOSARIUM } from '../src/konten/bantuan';
import { TEKS_TUTORIAL } from '../src/konten/tutorial';
import { KEDAI, TAUTAN_KEDAI } from '../src/konten/kedai';
import * as PERINGKAT from '../src/konten/peringkat';
import * as PASANG from '../src/konten/pasang';
import { TEKS_KALDU } from '../src/konten/kaldu';
import { TEKS_NAMA } from '../src/konten/nama';
import * as KOMPETISI from '../src/konten/kompetisi';
import { TEKS_USULAN } from '../src/konten/usulan';
import { TEKS_LANJUT, TEKS_LEDEK } from '../src/konten/ledek';

// Penjaga gaya teks (antislop) untuk konten yang dibaca pemain: Bantuan, tutorial, info kedai,
// dan emote/celetukan. Yang dijaga hanya pola formulaik yang jelas (negasi kontras, klise promosi,
// tanda pisah panjang). Kalimat penjelas aturan seperti "dipakai di kartu jadi, bukan sebagai
// pentungan" tetap boleh, karena di situ "bukan" membedakan dua hal yang memang beda aturannya.

const semuaTeks = (x: unknown): string[] =>
  typeof x === 'string' ? [x] : x && typeof x === 'object' ? Object.values(x).flatMap(semuaTeks) : [];

const POLA: [string, RegExp][] = [
  ['negasi kontras "bukan sekadar/hanya/cuma"', /\bbukan (sekadar|hanya|cuma)\b/i],
  ['negasi kontras "lebih dari sekadar"', /lebih dari sekadar/i],
  ['negasi kontras "tidak hanya … tetapi juga"', /\b(tidak|nggak) (hanya|cuma)\b[^.]*\b(tapi|tetapi|melainkan)\b/i],
  ['"alih-alih"', /\balih-alih\b/i],
  ['"melainkan"', /\bmelainkan\b/i],
  ['"kami X, bukan Y"', /\bkami\b[^.]*,\s*bukan\b/i],
  ['"bukan remi biasa"', /bukan [^.]* biasa\b/i],
  ['klise promosi', /wajib (dicoba|mampir)|surga|hidden gem|nikmati|sensasi|pengalaman (tak|yang) terlupakan|dijamin|seru abis|tiada duanya/i],
  ['tanda pisah panjang', /—/],
];

const sumber: [string, string[]][] = [
  ['Bantuan', [...semuaTeks(BAB_BANTUAN), ...semuaTeks(FAQ), ...semuaTeks(GLOSARIUM)]],
  ['Tutorial', semuaTeks(TEKS_TUTORIAL)],
  ['Info kedai', [...semuaTeks(KEDAI), ...TAUTAN_KEDAI.flatMap((t) => [t.label, t.aria])]],
  ['Emote', [...DAFTAR_EMOTE]],
  // Nama pemain (keputusan #49).
  ['Nama', semuaTeks(TEKS_NAMA)],
  // Leaderboard (keputusan #45): fungsi (labelBulan) dilewati, contoh bulan ikut diperiksa.
  ['Peringkat', [...semuaTeks(PERINGKAT), PERINGKAT.labelBulan('2026-10')]],
  // Tawaran pasang aplikasi (keputusan #46): tombol melayang, toast, dialog petunjuk.
  ['Pasang aplikasi', semuaTeks(PASANG)],
  // Mode kaldu (keputusan #42, #43): kotak centang di layar persiapan dan teks pendek di meja.
  ['Mode kaldu', semuaTeks(TEKS_KALDU)],
  // Kompetisi (keputusan #51): layar Kompetisi dan lobi meja kompetisi.
  ['Kompetisi', semuaTeks(KOMPETISI)],
  // Usul fitur (24 Okt 2026): dialog dan pesan penolakan (yang terakhir juga dikirim server).
  ['Usul fitur', [...semuaTeks(TEKS_USULAN), ...semuaTeks(PESAN_USULAN)]],
  // Hasil putaran online (24 Okt 2026): jeda lanjut, tombol Siap, dan ledekan.
  ['Jeda lanjut dan ledekan', [...DAFTAR_LEDEKAN, ...semuaTeks(TEKS_LANJUT), ...semuaTeks(TEKS_LEDEK)]],
];

describe('antislop: teks pemain', () => {
  for (const [nama, teks] of sumber) {
    it(`${nama} bebas pola negasi kontras, klise promosi, dan tanda pisah panjang`, () => {
      expect(teks.length).toBeGreaterThan(0);
      for (const t of teks) for (const [jenis, pola] of POLA) expect(t, `${jenis}: "${t}"`).not.toMatch(pola);
    });
  }

  it('deskripsi manifest PWA (layar pasang aplikasi) memakai istilah UI "warga kedai", tanpa "bot"', () => {
    const config = readFileSync(new URL('../vite.config.ts', import.meta.url), 'utf8');
    const deskripsi = /\bdescription:\s*'([^']+)'/.exec(config)?.[1];
    expect(deskripsi).toBe('Remi aturan Kedai Madya: main online bareng teman, atau offline bareng warga kedai.');
    for (const [jenis, pola] of POLA) expect(deskripsi, jenis).not.toMatch(pola);
  });

  it('tanda seru tidak bertumpuk ("!!") di Bantuan dan tutorial', () => {
    const teks = [...semuaTeks(BAB_BANTUAN), ...semuaTeks(FAQ), ...semuaTeks(TEKS_TUTORIAL)];
    for (const t of teks) expect(t).not.toMatch(/!{2,}/);
  });
});
