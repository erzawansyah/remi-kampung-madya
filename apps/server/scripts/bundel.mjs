// Bundel server jadi satu file dist/main.js, termasuk ws dan sirv, supaya image Docker
// tidak perlu npm install sama sekali (tanpa lockfile = tidak reproducible).
// Versi (package.json root) dan identitas build disuntik lewat define. Identitasnya dari
// scripts/idBuild.mjs (GIT_SHA > commit git > hash isi sumber "h-…"), sama dengan client.

import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';
import { idBuild } from '../../../scripts/idBuild.mjs';

const akar = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const versi = JSON.parse(readFileSync(resolve(akar, '../../package.json'), 'utf8')).version;

const { id: sha, sumber } = idBuild();
console.log(`id build server: ${sha} (${sumber})`);

await build({
  entryPoints: [resolve(akar, 'src/main.ts')],
  outfile: resolve(akar, 'dist/main.js'),
  bundle: true,
  platform: 'node',
  format: 'esm',
  target: 'node22',
  // ws ditulis CommonJS dan memakai require() untuk modul bawaan Node; di bundel ESM itu butuh
  // require asli. bufferutil/utf-8-validate opsional (ws punya cadangan JS murni).
  banner: { js: "import { createRequire as __buatRequire } from 'node:module'; const require = __buatRequire(import.meta.url);" },
  external: ['bufferutil', 'utf-8-validate'],
  define: {
    __VERSI_SERVER__: JSON.stringify(versi),
    __SHA_SERVER__: JSON.stringify(sha),
  },
  logLevel: 'info',
});
