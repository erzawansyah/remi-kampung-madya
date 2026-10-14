// Identitas build: satu id pendek yang SAMA untuk client (apps/client/vite.config.ts → __BUILD_SHA__) dan
// server (apps/server/scripts/bundel.mjs → __SHA_SERVER__). Aplikasi di HP membandingkannya dengan `sha` di
// /healthz untuk tahu server sudah memakai build lain (apps/client/src/pembaruan.ts, serverBeda).
//
// Urutan sumber:
// 1. env GIT_SHA: commit hex 7–40 karakter, dipakai 7 karakter pertama (huruf kecil). Kosong = dilewati.
//    Nilai yang bukan commit (mis. "refs/heads/main" salah ambil dari payload webhook) diabaikan dengan
//    peringatan, lalu turun ke langkah berikutnya.
// 2. `git rev-parse --short=7 HEAD`, hanya kalau akar proyek ini memang puncak repo git (bukan folder di
//    dalam repo lain). Sengaja tanpa akhiran "-dirty": build sendiri menulis ulang file terlacak
//    (favicon.svg dari buat-ikon.mjs), dan status kotor bisa berubah di antara build client dan server
//    sehingga id keduanya beda.
// 3. Hash isi sumber: "h-" + 7 hex dari sha256 semua file proyek. Pengecualiannya sama dengan
//    .dockerignore (ubah keduanya bersamaan), dan CRLF dianggap LF di file teks, jadi checkout yang sama
//    di Windows dan Linux memberi id yang sama. Inilah yang terpakai di Docker tanpa GIT_SHA (.git tidak
//    ikut ke context). Build ulang dari isi yang sama memberi id yang sama.
//
// Env ID_BUILD_TANPA_GIT=1 melewati langkah 2 (untuk uji). Dev server (vite dev, tsx watch) tetap 'dev'
// dan tidak memanggil modul ini.
//
// Dari baris perintah: `node scripts/idBuild.mjs` mencetak id-nya saja.

import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readdirSync, readFileSync, realpathSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const AKAR_PROYEK = resolve(dirname(fileURLToPath(import.meta.url)), '..');

const POLA_COMMIT = /^[0-9a-f]{7,40}$/i;

/** Folder yang dilewati di mana pun letaknya (selaras .dockerignore). */
const FOLDER_DILEWATI = new Set(['.git', 'node_modules', 'dist', 'dev-dist', 'coverage', '.github', '.claude', '.vscode']);
/** Folder yang dilewati menurut path relatif akar: hasil E2E dan database lokal saat dev. */
const PATH_DILEWATI = new Set(['apps/client/e2e/hasil', 'apps/server/data']);

function fileDilewati(nama) {
  return (
    // Di git worktree atau submodule, .git berupa file ("gitdir: ...") yang isinya beda per checkout.
    nama === '.git' ||
    nama.endsWith('.log') ||
    nama === '.env' ||
    nama.startsWith('.env.') ||
    /\.db(?:-|$)/.test(nama) ||
    nama.endsWith('.tsbuildinfo') ||
    // Config Vite yang sedang dimuat ditulis di sebelah vite.config.ts kalau node_modules tidak ada.
    /\.timestamp-[\w-]+\.mjs$/.test(nama)
  );
}

/** Path relatif (pemisah '/') semua file yang ikut di-hash. Symlink tidak diikuti. */
function* daftarFile(akar, rel = '') {
  for (const isi of readdirSync(rel ? join(akar, rel) : akar, { withFileTypes: true })) {
    const r = rel ? `${rel}/${isi.name}` : isi.name;
    if (isi.isDirectory()) {
      if (!FOLDER_DILEWATI.has(isi.name) && !PATH_DILEWATI.has(r)) yield* daftarFile(akar, r);
    } else if (isi.isFile() && !fileDilewati(isi.name)) {
      yield r;
    }
  }
}

/** CRLF → LF untuk file teks. File biner (ada byte NUL di 8000 byte pertama, seperti git) apa adanya. */
function isiNormal(data) {
  if (data.subarray(0, 8000).includes(0)) return data;
  return Buffer.from(data.toString('latin1').replaceAll('\r\n', '\n'), 'latin1');
}

/** Hash isi sumber proyek, mis. "h-1a2b3c4". */
export function hashIsi(akar = AKAR_PROYEK) {
  const total = createHash('sha256');
  for (const rel of [...daftarFile(akar)].sort()) {
    total.update(`${rel}\0`);
    total.update(createHash('sha256').update(isiNormal(readFileSync(join(akar, rel)))).digest());
  }
  return `h-${total.digest('hex').slice(0, 7)}`;
}

function commitGit(akar) {
  try {
    const [awalan, sha] = execFileSync('git', ['rev-parse', '--show-prefix', '--short=7', 'HEAD'], {
      cwd: akar,
      stdio: ['ignore', 'pipe', 'ignore'],
      timeout: 10_000,
    })
      .toString()
      .split(/\r?\n/);
    // Awalan tidak kosong: akar ini cuma subfolder repo lain (mis. diekstrak ke folder ber-git), commit-nya bukan milik kita.
    return awalan === '' && POLA_COMMIT.test(sha ?? '') ? sha.toLowerCase() : null;
  } catch {
    // git tidak terpasang, bukan repo git, atau repo tanpa commit.
    return null;
  }
}

/**
 * @param {{ akar?: string, env?: Record<string, string | undefined>, peringatan?: (pesan: string) => void }} [opsi]
 * @returns {{ id: string, sumber: 'GIT_SHA' | 'git' | 'isi' }}
 */
export function idBuild({ akar = AKAR_PROYEK, env = process.env, peringatan = (p) => console.warn(p) } = {}) {
  const dariEnv = env.GIT_SHA?.trim();
  if (dariEnv) {
    if (POLA_COMMIT.test(dariEnv)) return { id: dariEnv.slice(0, 7).toLowerCase(), sumber: 'GIT_SHA' };
    peringatan(`[idBuild] GIT_SHA "${dariEnv}" bukan commit (hex 7–40 karakter), diabaikan.`);
  }
  if (env.ID_BUILD_TANPA_GIT !== '1') {
    const sha = commitGit(akar);
    if (sha) return { id: sha, sumber: 'git' };
  }
  return { id: hashIsi(akar), sumber: 'isi' };
}

function dijalankanLangsung() {
  try {
    return !!process.argv[1] && realpathSync(process.argv[1]) === fileURLToPath(import.meta.url);
  } catch {
    return false;
  }
}

if (dijalankanLangsung()) console.log(idBuild({ peringatan: (p) => console.error(p) }).id);
