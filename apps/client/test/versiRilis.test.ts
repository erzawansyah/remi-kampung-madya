// Versi teratur (keputusan pemilik #50): satu nomor versi di package.json root, semua workspace dan
// package-lock.json sama, dan CHANGELOG punya bagian untuk versi itu (di bawah [Belum dirilis]).
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const baca = (p: string) => readFileSync(new URL(`../../../${p}`, import.meta.url), 'utf8');
const versiDari = (p: string) => (JSON.parse(baca(p)) as { version: string }).version;

describe('versi rilis', () => {
  const versi = versiDari('package.json');

  it('SemVer, dan semua workspace sama dengan root', () => {
    expect(versi).toMatch(/^\d+\.\d+\.\d+$/);
    for (const p of ['packages/engine', 'packages/meja', 'apps/server', 'apps/client']) {
      expect(versiDari(`${p}/package.json`), p).toBe(versi);
    }
    const kunci = JSON.parse(baca('package-lock.json')) as { version: string; packages: Record<string, { version?: string }> };
    expect(kunci.version).toBe(versi);
    for (const p of ['', 'packages/engine', 'packages/meja', 'apps/server', 'apps/client']) expect(kunci.packages[p]?.version, p || 'root').toBe(versi);
  });

  it('CHANGELOG: [Belum dirilis] di atas, lalu bagian versi sekarang bertanggal', () => {
    const judul = [...baca('CHANGELOG.md').matchAll(/^## \[(.+?)\](?: - (\d{4}-\d{2}-\d{2}))?$/gm)].map((m) => [m[1], m[2]]);
    expect(judul[0]).toEqual(['Belum dirilis', undefined]);
    expect(judul[1]![0]).toBe(versi);
    expect(judul[1]![1]).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});
