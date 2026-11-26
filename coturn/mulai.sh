#!/bin/sh
# Pembuka coturn untuk Remi Kampung Madya (service `coturn` di docker-compose.yml, profil "suara").
#
# Rahasia TURN tidak pernah ditaruh di argumen perintah (argumen proses terlihat oleh `ps` siapa pun di
# VPS): skrip ini menulis konfigurasi lengkap ke berkas sementara yang hanya bisa dibaca proses coturn
# (umask 077), lalu membuang TURN_SECRET dari environment sebelum menjalankan turnserver.
#
# Env (dari .env di samping docker-compose.yml, lihat docs/deploy.md "Suara dan TURN"):
#   TURN_SECRET       wajib, sama dengan TURN_SECRET server Remi.
#   TURN_REALM        opsional (bawaan remi-madya).
#   TURN_PUBLIC_IP    alamat publik VPS sendiri (boleh beberapa, dipisah koma). Diizinkan sebagai tujuan
#                     relay (allowed-peer-ip): kalau dua pemain sama-sama lewat relay, alamat relay
#                     lawannya adalah alamat VPS ini, dan tanpa izin itu sambungan mereka ditolak (403).
#                     Kosong = dicoba dideteksi otomatis (detect-external-ip bawaan image).
#   TURN_DENIED_IP    nama lama TURN_PUBLIC_IP (0.9.0), masih dibaca kalau TURN_PUBLIC_IP kosong. Dulu
#                     alamat ini ditolak, dan justru itu yang memutus suara antarpemain yang sama-sama
#                     lewat relay. Isinya sama, jadi .env lama tidak perlu diubah.
#   TURN_EXTERNAL_IP  hanya untuk VPS di balik NAT: alamat publiknya (ikut diizinkan juga).
set -eu

if [ -z "${TURN_SECRET:-}" ]; then
  echo "coturn: TURN_SECRET kosong. Isi di .env lalu jalankan ulang (docs/deploy.md, Suara dan TURN)." >&2
  exit 1
fi

# Hanya huruf alamat IP (angka, titik, titik dua, heksadesimal, tanda hubung untuk rentang).
alamat_sah() {
  case "$1" in
    '' | *[!0-9A-Fa-f.:-]*) return 1 ;;
    *) return 0 ;;
  esac
}

IZIN="${TURN_PUBLIC_IP:-${TURN_DENIED_IP:-}}"
if [ -z "$IZIN" ] && command -v detect-external-ip >/dev/null 2>&1; then
  IZIN="$(detect-external-ip 2>/dev/null || true)"
fi
IZIN="$IZIN,${TURN_EXTERNAL_IP:-}"

umask 077
KONF="$(mktemp "${TMPDIR:-/tmp}/turnserver.XXXXXX")"
{
  cat "${TURN_KONF_DASAR:-/etc/coturn/turnserver.conf}"
  echo
  echo "# --- dari env (mulai.sh) ---"
  echo "realm=${TURN_REALM:-remi-madya}"
  echo "static-auth-secret=${TURN_SECRET}"
  # Relay antarpemain di VPS ini: alamat relay lawan = alamat publik VPS sendiri. Relay TCP mati
  # (no-tcp-relay), jadi izin ini tidak membuka SSH/web VPS lewat relay, hanya UDP.
  for ip in $(echo "$IZIN" | tr ',' ' '); do
    if alamat_sah "$ip"; then echo "allowed-peer-ip=$ip"; else echo "coturn: alamat publik VPS '$ip' bukan alamat IP, dilewati." >&2; fi
  done
  if [ -n "${TURN_EXTERNAL_IP:-}" ]; then
    if alamat_sah "$TURN_EXTERNAL_IP"; then echo "external-ip=${TURN_EXTERNAL_IP}"; else echo "coturn: TURN_EXTERNAL_IP bukan alamat IP, dilewati." >&2; fi
  fi
} >"$KONF"

if [ "$IZIN" = "," ]; then
  echo "coturn: alamat publik VPS tidak diketahui; isi TURN_PUBLIC_IP supaya suara antarpemain yang sama-sama lewat relay pasti tersambung." >&2
fi

unset TURN_SECRET
exec "${TURN_PROGRAM:-turnserver}" -c "$KONF"
