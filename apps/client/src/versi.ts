// Informasi versi aplikasi (SemVer dari package.json root, disuntik saat build).

export const VERSI: string = __VERSI_APP__;
/** Commit git pendek, atau 'dev' kalau tidak tersedia (mis. build Docker tanpa ARG GIT_SHA). */
export const BUILD_SHA: string = __BUILD_SHA__;
/** Waktu build (ISO 8601). */
export const BUILD_WAKTU: string = __BUILD_WAKTU__;

/** Teks pendek untuk ditampilkan, mis. "v0.2.0 (a1b2c3d)". */
export function labelVersi(): string {
  return BUILD_SHA && BUILD_SHA !== 'dev' ? `v${VERSI} (${BUILD_SHA})` : `v${VERSI}`;
}
