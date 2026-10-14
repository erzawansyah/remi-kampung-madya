// Identitas build (scripts/idBuild.mjs): disuntik ke client (vite.config.ts) dan server (bundel.mjs), lalu
// dicocokkan aplikasi lewat /healthz. Untuk isi yang sama, id-nya harus sama di mana pun dihitung.
// Hash isi diuji di folder sementara; jalur git diuji read-only di repo ini (dilewati kalau tanpa .git,
// mis. di dalam build Docker).

import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it } from 'vitest';
import { hashIsi, idBuild } from '../../../scripts/idBuild.mjs';

const AKAR_REPO = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');
const SKRIP = join(AKAR_REPO, 'scripts/idBuild.mjs');
const TANPA_GIT = { ID_BUILD_TANPA_GIT: '1' };
const diam = () => {};

type IsiFile = Record<string, string | Buffer>;

const folder: string[] = [];
afterEach(() => {
  for (const f of folder.splice(0)) rmSync(f, { recursive: true, force: true });
});

function tulis(akar: string, file: IsiFile) {
  for (const [rel, isi] of Object.entries(file)) {
    mkdirSync(dirname(join(akar, rel)), { recursive: true });
    writeFileSync(join(akar, rel), isi);
  }
}

function proyek(file: IsiFile): string {
  const akar = mkdtempSync(join(tmpdir(), 'remi-idbuild-'));
  folder.push(akar);
  tulis(akar, file);
  return akar;
}

const DASAR: IsiFile = {
  'package.json': '{\n  "version": "0.2.0"\n}\n',
  'apps/server/src/main.ts': "console.log('halo');\n",
  'apps/client/public/favicon.svg': '<svg>\n</svg>\n',
  // Biner (ada NUL): tidak dinormalisasi.
  'apps/client/public/ikon.png': Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0]),
};

const keCrlf = (file: IsiFile): IsiFile =>
  Object.fromEntries(Object.entries(file).map(([k, v]) => [k, typeof v === 'string' ? v.replaceAll('\n', '\r\n') : v]));

describe('idBuild: urutan sumber', () => {
  it('GIT_SHA (commit hex) menang: 7 karakter pertama, huruf kecil, spasi dibuang', () => {
    const akar = proyek(DASAR);
    expect(idBuild({ akar, env: { GIT_SHA: 'ABCDEF0123456789abcdef0123456789abcdef01' } })).toEqual({ id: 'abcdef0', sumber: 'GIT_SHA' });
    expect(idBuild({ akar, env: { GIT_SHA: ' 9463cc5\n', ...TANPA_GIT } }).id).toBe('9463cc5');
  });

  it('GIT_SHA kosong dilewati; yang bukan commit diabaikan dengan peringatan', () => {
    const akar = proyek(DASAR);
    const hash = hashIsi(akar);
    expect(idBuild({ akar, env: { ...TANPA_GIT, GIT_SHA: '' } })).toEqual({ id: hash, sumber: 'isi' });
    expect(idBuild({ akar, env: { ...TANPA_GIT, GIT_SHA: '   ' } }).id).toBe(hash);
    const pesan: string[] = [];
    expect(idBuild({ akar, env: { ...TANPA_GIT, GIT_SHA: 'refs/heads/main' }, peringatan: (p) => pesan.push(p) }).id).toBe(hash);
    expect(pesan).toEqual(['[idBuild] GIT_SHA "refs/heads/main" bukan commit (hex 7–40 karakter), diabaikan.']);
    expect(idBuild({ akar, env: { ...TANPA_GIT, GIT_SHA: 'abc12' }, peringatan: diam }).id).toBe(hash);
  });

  it('tanpa GIT_SHA dan tanpa git: hash isi "h-" + 7 hex', () => {
    expect(idBuild({ akar: proyek(DASAR), env: TANPA_GIT })).toEqual({ id: expect.stringMatching(/^h-[0-9a-f]{7}$/), sumber: 'isi' });
  });

  it('folder yang bukan repo git (seperti context Docker tanpa .git): hash isi, tanpa galat', () => {
    const akar = proyek(DASAR);
    expect(idBuild({ akar, env: {} })).toEqual({ id: hashIsi(akar), sumber: 'isi' });
  });

  it('baris perintah mencetak id saja (untuk skrip deploy)', () => {
    const jalan = (env: Record<string, string>) =>
      execFileSync(process.execPath, [SKRIP], { env: { ...process.env, ...env }, stdio: ['ignore', 'pipe', 'ignore'] })
        .toString()
        .trim();
    expect(jalan({ GIT_SHA: 'ABCDEF0123456789' })).toBe('abcdef0');
    expect(jalan({ GIT_SHA: '', ...TANPA_GIT })).toMatch(/^h-[0-9a-f]{7}$/);
  });
});

const adaRepo =
  existsSync(join(AKAR_REPO, '.git')) &&
  (() => {
    try {
      execFileSync('git', ['--version'], { stdio: 'ignore' });
      return true;
    } catch {
      return false;
    }
  })();

describe.skipIf(!adaRepo)('idBuild: git (read-only di repo ini)', () => {
  const git = (...arg: string[]) => execFileSync('git', arg, { cwd: AKAR_REPO, stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim();

  it('di akar repo: commit pendek, tanpa akhiran "-dirty"', () => {
    expect(idBuild({ env: {} })).toEqual({ id: git('rev-parse', '--short=7', 'HEAD'), sumber: 'git' });
  });

  it('GIT_SHA menang atas git; ID_BUILD_TANPA_GIT=1 melewati git', () => {
    expect(idBuild({ env: { GIT_SHA: '0123456789abcdef' } })).toEqual({ id: '0123456', sumber: 'GIT_SHA' });
    expect(idBuild({ env: TANPA_GIT }).sumber).toBe('isi');
  });

  it('akar yang cuma subfolder repo lain: commit repo itu tidak dipakai', () => {
    expect(idBuild({ akar: join(AKAR_REPO, 'scripts'), env: {} })).toEqual({ id: expect.stringMatching(/^h-[0-9a-f]{7}$/), sumber: 'isi' });
  });
});

describe('hashIsi', () => {
  it('deterministik, dan checkout CRLF (Windows) = LF (Linux)', () => {
    const lf = proyek(DASAR);
    expect(hashIsi(lf)).toBe(hashIsi(lf));
    expect(hashIsi(proyek(keCrlf(DASAR)))).toBe(hashIsi(lf));
  });

  it('file biner apa adanya: CRLF di dalamnya tetap dibedakan', () => {
    const a = proyek({ 'x.bin': Buffer.from([0, 0x0d, 0x0a]) });
    const b = proyek({ 'x.bin': Buffer.from([0, 0x0a]) });
    expect(hashIsi(a)).not.toBe(hashIsi(b));
  });

  it('berubah kalau isi berubah, ada file baru, atau nama file berganti', () => {
    const akar = proyek(DASAR);
    const awal = hashIsi(akar);
    tulis(akar, { 'apps/server/src/main.ts': "console.log('hai');\n" });
    const diubah = hashIsi(akar);
    expect(diubah).not.toBe(awal);
    tulis(akar, { 'docs/baru.md': 'baru\n' });
    expect(hashIsi(akar)).not.toBe(diubah);
    expect(hashIsi(proyek({ 'a.ts': 'x\n' }))).not.toBe(hashIsi(proyek({ 'b.ts': 'x\n' })));
  });

  it('hasil build, dependensi, dan file lokal tidak ikut (selaras .dockerignore)', () => {
    const akar = proyek(DASAR);
    const awal = hashIsi(akar);
    tulis(akar, {
      'node_modules/ws/index.js': 'x',
      'node_modules/.vite-temp/vite.config.ts.timestamp-1-a.mjs': 'x',
      'apps/client/node_modules/.vite/deps.json': '{}',
      'apps/client/dist/index.html': '<!doctype html>',
      'apps/client/dist/assets/app.js.br': 'br',
      'apps/client/dev-dist/sw.js': 'x',
      'apps/server/dist/main.js': 'x',
      '.git/HEAD': 'ref: refs/heads/main\n',
      '.github/workflows/ci.yml': 'x',
      '.claude/memory/catatan.md': 'x',
      '.vscode/settings.json': '{}',
      'coverage/index.html': 'x',
      'npm-debug.log': 'x',
      '.env': 'RAHASIA=1',
      '.env.lokal': 'RAHASIA=2',
      'apps/server/data/remi.db': 'x',
      'remi.db-wal': 'x',
      'apps/client/e2e/hasil/hp/beranda.png': 'x',
      'apps/client/vite.config.ts.timestamp-1760000000000-abc123.mjs': 'x',
      'apps/client/tsconfig.tsbuildinfo': 'x',
    });
    expect(hashIsi(akar)).toBe(awal);
  });

  it('.git berupa file (git worktree/submodule) juga tidak ikut: isi sama, id sama di checkout mana pun', () => {
    const akar = proyek(DASAR);
    const awal = hashIsi(akar);
    tulis(akar, { '.git': 'gitdir: /repo/.git/worktrees/x\n' });
    expect(hashIsi(akar)).toBe(awal);
    expect(hashIsi(proyek({ ...DASAR, '.git': 'gitdir: /repo/.git/worktrees/y\n' }))).toBe(awal);
  });
});
