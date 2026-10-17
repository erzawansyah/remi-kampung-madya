// @vitest-environment happy-dom
// Gaya main warga kedai (keputusan pemilik #47) tidak pernah ditampilkan ke pemain. Yang dijaga di
// sini teks yang bisa dibaca di aplikasi: CHANGELOG (bagian pemain DAN catatan teknis, karena
// keduanya tampil di Tentang), Bantuan, tutorial, label level, dan teks konten lain. Pesan meja
// (InfoMeja, view, protokol) dijaga packages/meja/test/gaya.test.ts.

import { describe, expect, it, vi } from 'vitest';

// Konstanta build biasanya disuntik Vite (define); di test diisi sebelum modul dimuat (pola tentang.test.ts).
vi.hoisted(() => {
  Object.assign(globalThis, { __VERSI_APP__: '0.0.0', __BUILD_SHA__: 'dev', __BUILD_WAKTU__: '2026-10-12T00:00:00.000Z' });
});

import { DAFTAR_GAYA_BOT } from '@remi/engine';
import { BAB_BANTUAN, FAQ, GLOSARIUM } from '../src/konten/bantuan';
import { TEKS_TUTORIAL } from '../src/konten/tutorial';
import { LEVEL_WARGA } from '../src/konten/levelWarga';
import * as PERINGKAT from '../src/konten/peringkat';
import * as PASANG from '../src/konten/pasang';
import { TEKS_KALDU } from '../src/konten/kaldu';
import { htmlChangelog } from '../src/ui/tentang';
import changelog from '../../../CHANGELOG.md?raw';

const semuaTeks = (x: unknown): string[] =>
  typeof x === 'string' ? [x] : x && typeof x === 'object' ? Object.values(x).flatMap(semuaTeks) : [];

// Nama gaya di kode ('berubah' dan 'standar' kata biasa, jadi diwakili nama tampilannya saja) dan
// nama gaya dalam bahasa dokumen pengembang. Nama modul/fungsi (gayaWarga.ts, gayaKursi) boleh
// disebut di catatan teknis: tidak membuka gaya siapa pun.
const POLA_GAYA: RegExp[] = [
  ...DAFTAR_GAYA_BOT.filter((g) => g !== 'standar' && g !== 'berubah').map((g) => new RegExp(`\\b${g}\\b`, 'i')),
  /\bsabar londo\b/i,
  /\bberubah-ubah\b/i,
];

const sumber: [string, string[]][] = [
  ['CHANGELOG (berkas utuh)', [changelog]],
  ['CHANGELOG di Tentang', [htmlChangelog()]],
  ['Bantuan', [...semuaTeks(BAB_BANTUAN), ...semuaTeks(FAQ), ...semuaTeks(GLOSARIUM)]],
  ['Tutorial', semuaTeks(TEKS_TUTORIAL)],
  ['Label level', semuaTeks(LEVEL_WARGA)],
  ['Peringkat', semuaTeks(PERINGKAT)],
  ['Pasang aplikasi', semuaTeks(PASANG)],
  ['Mode kaldu', semuaTeks(TEKS_KALDU)],
];

describe('gaya warga kedai tidak tampil di teks aplikasi (#47)', () => {
  for (const [nama, teks] of sumber) {
    it(`${nama} tidak menyebut gaya main`, () => {
      expect(teks.length).toBeGreaterThan(0);
      for (const t of teks) for (const pola of POLA_GAYA) expect(t, `${nama}: ${pola}`).not.toMatch(pola);
    });
  }
});
