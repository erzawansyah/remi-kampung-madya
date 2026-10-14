// Informasi versi aplikasi (SemVer dari package.json root, disuntik saat build).

export const VERSI: string = __VERSI_APP__;
/**
 * Identitas build (scripts/idBuild.mjs), sama dengan `sha` di /healthz: commit git pendek, atau hash isi
 * sumber "h-1a2b3c4" kalau commit tidak diketahui (build Docker tanpa GIT_SHA), atau 'dev' di dev server.
 */
export const BUILD_SHA: string = __BUILD_SHA__;
/** Waktu build (ISO 8601). */
export const BUILD_WAKTU: string = __BUILD_WAKTU__;

/** Teks pendek untuk ditampilkan, mis. "v0.2.0 (a1b2c3d)". */
export function labelVersi(): string {
  return BUILD_SHA && BUILD_SHA !== 'dev' ? `v${VERSI} (${BUILD_SHA})` : `v${VERSI}`;
}
