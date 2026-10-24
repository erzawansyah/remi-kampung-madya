// Klien Notion API yang sangat kecil: hanya membuat satu halaman (baris) di database "Permintaan
// Fitur" milik pemilik untuk setiap usulan dari game (keputusan pemilik 24 Okt 2026). fetch bisa
// disuntik (test). Token tidak pernah masuk ke pesan galat maupun log.

/** Endpoint pembuatan halaman dan versi API yang dipakai. */
export const URL_HALAMAN_NOTION = 'https://api.notion.com/v1/pages';
export const VERSI_NOTION = '2022-06-28';
/** Batas panjang satu potongan rich_text di Notion. */
export const MAKS_POTONGAN_NOTION = 2000;
/** Judul halaman dipotong sampai sekian karakter. */
export const MAKS_JUDUL_NOTION = 100;
/** Permintaan yang tidak dijawab sekian ms dianggap gagal (dicoba lagi nanti). */
const BATAS_WAKTU_MS = 15_000;

export interface OpsiNotion {
  /** Secret integrasi internal (NOTION_TOKEN). */
  token: string;
  /** Id database tujuan (NOTION_USULAN_DB), dengan atau tanpa tanda hubung. */
  database: string;
  /** Pengganti fetch global (test). */
  fetch?: typeof fetch;
  batasWaktuMs?: number;
}

/** Isi satu halaman usulan. */
export interface HalamanUsulan {
  /** id baris di SQLite server ("ID server" di Notion). */
  idServer: number;
  judul: string;
  isi: string;
  pengusul: string;
  /** null = pemain tidak memilih jenis (kolom Jenis dibiarkan kosong). */
  jenis: string | null;
}

/** Penolakan/kegagalan dari Notion. Pesannya aman ditulis ke log (tanpa token). */
export class GalatNotion extends Error {
  constructor(
    pesan: string,
    /** Kode HTTP; null = tidak sampai ke Notion (jaringan, batas waktu). */
    readonly status: number | null,
    /** Kode galat Notion (`unauthorized`, `object_not_found`, `validation_error`, ...), kalau ada. */
    readonly kode: string | null = null,
  ) {
    super(pesan);
    this.name = 'GalatNotion';
  }

  /**
   * Galat yang pasti menimpa semua usulan, bukan hanya yang ini (token salah, integrasi belum
   * dihubungkan ke database, dibatasi, Notion sedang gangguan, jaringan putus). Putaran kirim
   * berhenti di situ supaya tidak menembak Notion berkali-kali dengan hasil yang sama.
   */
  get menyeluruh(): boolean {
    return this.status === null || this.status === 401 || this.status === 403 || this.status === 404 || this.status === 429 || this.status >= 500;
  }
}

export interface KlienNotion {
  /** Buat satu halaman usulan; mengembalikan id halaman Notion. Gagal = GalatNotion. */
  buatHalaman(h: HalamanUsulan, sinyal?: AbortSignal): Promise<{ id: string }>;
}

/**
 * Id database Notion dari isian env: 32 hex, dengan atau tanpa tanda hubung, atau tautan database
 * yang disalin dari browser (id-nya diambil dari situ). Null = tidak ada id yang sah.
 */
export function normalkanIdNotion(x: string | undefined): string | null {
  if (!x) return null;
  const tanpaQuery = x.trim().split(/[?#]/)[0]!;
  const cocok = /([0-9a-f]{8}-?[0-9a-f]{4}-?[0-9a-f]{4}-?[0-9a-f]{4}-?[0-9a-f]{12})$/i.exec(tanpaQuery);
  return cocok ? cocok[1]!.replace(/-/g, '').toLowerCase() : null;
}

/** Pecah teks jadi potongan ≤ `maks` unit UTF-16 tanpa membelah pasangan surrogate (emoji). */
export function potongTeksNotion(teks: string, maks = MAKS_POTONGAN_NOTION): string[] {
  const hasil: string[] = [];
  let kini = '';
  for (const c of teks) {
    if (kini.length + c.length > maks) {
      hasil.push(kini);
      kini = '';
    }
    kini += c;
  }
  if (kini || !hasil.length) hasil.push(kini);
  return hasil;
}

const teksKaya = (teks: string) => potongTeksNotion(teks).map((content) => ({ type: 'text', text: { content } }));

/** Properti halaman untuk database "Permintaan Fitur" (nama kolom persis seperti di Notion). */
export function propertiUsulan(h: HalamanUsulan): Record<string, unknown> {
  const judul = Array.from(h.judul).slice(0, MAKS_JUDUL_NOTION).join('');
  return {
    Judul: { title: [{ type: 'text', text: { content: judul } }] },
    'Isi usulan': { rich_text: teksKaya(h.isi) },
    Pengusul: { rich_text: teksKaya(h.pengusul) },
    Sumber: { select: { name: 'Game' } },
    ...(h.jenis ? { Jenis: { select: { name: h.jenis } } } : {}),
    Status: { status: { name: 'Baru' } },
    'ID server': { number: h.idServer },
  };
}

/** Buang token (kalau sampai ikut) dan rapikan pesan supaya aman dan pendek di log. */
function samarkan(pesan: string, token: string): string {
  const bersih = token ? pesan.split(token).join('[token]') : pesan;
  return bersih.replace(/\s+/g, ' ').trim().slice(0, 200);
}

export function buatKlienNotion(opsi: OpsiNotion): KlienNotion {
  const ambil = opsi.fetch ?? fetch;
  const database = normalkanIdNotion(opsi.database) ?? opsi.database;
  const batasWaktu = opsi.batasWaktuMs ?? BATAS_WAKTU_MS;
  return {
    async buatHalaman(h, sinyal) {
      const waktuHabis = AbortSignal.timeout(batasWaktu);
      const gabungan = sinyal ? AbortSignal.any([sinyal, waktuHabis]) : waktuHabis;
      let r: Response;
      try {
        r = await ambil(URL_HALAMAN_NOTION, {
          method: 'POST',
          headers: {
            authorization: `Bearer ${opsi.token}`,
            'notion-version': VERSI_NOTION,
            'content-type': 'application/json',
          },
          body: JSON.stringify({ parent: { database_id: database }, properties: propertiUsulan(h) }),
          signal: gabungan,
        });
      } catch (e) {
        const habis = waktuHabis.aborted && !sinyal?.aborted;
        const sebab = habis ? `tidak dijawab dalam ${Math.round(batasWaktu / 1000)} detik` : e instanceof Error ? e.message : String(e);
        throw new GalatNotion(samarkan(`Notion tidak terjangkau: ${sebab}`, opsi.token), null);
      }
      let isi: unknown = null;
      try {
        isi = await r.json();
      } catch {
        // Bukan JSON (proxy, gangguan): cukup kode HTTP-nya.
      }
      const o = (isi && typeof isi === 'object' ? isi : {}) as { id?: unknown; code?: unknown; message?: unknown };
      if (!r.ok) {
        const kode = typeof o.code === 'string' ? o.code : null;
        const pesan = typeof o.message === 'string' ? o.message : '';
        throw new GalatNotion(samarkan(`HTTP ${r.status}${kode ? ` ${kode}` : ''}${pesan ? `: ${pesan}` : ''}`, opsi.token), r.status, kode);
      }
      if (typeof o.id !== 'string' || !o.id) throw new GalatNotion(`HTTP ${r.status}: jawaban Notion tanpa id halaman`, r.status);
      return { id: o.id };
    },
  };
}
