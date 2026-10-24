// Layar Kompetisi (keputusan pemilik #51, versi 2 24 Okt 2026): daftar kompetisi (menunggu peserta,
// sedang jalan, sudah selesai), detail dengan klasemen (rata-rata nilai 0–10), Ikut serta, daftar meja
// yang menunggu peserta (Duduk / Buka meja baru, tanpa kode meja), voting sudahi lebih awal, dan
// formulir pengajuan (jumlah pemain per meja dan batas putaran ditetapkan di sini). Semua data dari
// server (/api/kompetisi); aturan hitungnya di @remi/meja, layar ini hanya menampilkan.
// Tiket peserta (token) disimpan di HP ini (penyimpanan.ts) dan dikirim lewat header saat membaca
// detail, supaya server tahu "kamu" yang mana. Detail dimuat ulang tiap POLLING_DETAIL_MS selama
// layarnya terbuka dan tab terlihat.

import {
  BATAS_PUTARAN_KOMPETISI_BAWAAN,
  DAFTAR_MASA,
  DETIK_GILIRAN_KOMPETISI_BAWAAN,
  isMasa,
  JUMLAH_PEMAIN_KOMPETISI_BAWAAN,
  MAKS_PEMAIN_KOMPETISI,
  MIN_PEMAIN_KOMPETISI,
  PILIHAN_BATAS_PUTARAN_KOMPETISI,
  PILIHAN_DETIK_GILIRAN_KOMPETISI,
  teksNilai,
  type BarisKompetisi,
  type MasaKompetisi,
  type PengaturanKompetisi,
  type StatusKompetisi,
} from '@remi/meja';
import { TEKS_KALDU } from '../konten/kaldu';
import {
  ariaPiala,
  LABEL_MASA,
  LABEL_STATUS,
  TEKS_KOMPETISI as T,
  teksMenungguMeja,
  teksPiala,
} from '../konten/kompetisi';
import { simpan } from '../penyimpanan';
import { bacaIsianBatas, htmlIsianBatas, pasangIsianBatas } from './batasSkor';
import { esc, toast } from './dom';
import { angkaSkor } from './rincianSkor';

/** Detail kompetisi yang sedang terbuka dimuat ulang sekian ms sekali (hanya saat tab terlihat). */
export const POLLING_DETAIL_MS = 5000;
/** Sesudah Duduk / Buka meja baru ditekan, tombol meja dikunci sekian ms (menunggu jawaban server). */
const KUNCI_MEJA_MS = 4000;

export interface RingkasanKompetisi {
  kode: string;
  nama: string;
  masa: MasaKompetisi;
  status: StatusKompetisi;
  jumlahPeserta: number;
  diajukanPada: number;
  mulaiPada: number | null;
  berakhirPada: number | null;
  /** Disudahi lewat voting (server versi 2). */
  disudahi?: boolean;
  /** Meja kompetisi ini yang permainannya masih jalan (server versi 2). */
  mejaMain?: number;
  juara?: string[];
  /** Sejajar dengan `juara`: berapa kali juara kompetisi (semua kompetisi). */
  pialaJuara?: number[];
}

/** Baris klasemen dari server: baris aturan + berapa kali juara kompetisi orang itu. */
type BarisDetail = BarisKompetisi & { piala?: number };

/** Meja kompetisi ini yang masih di lobi menunggu peserta. Kodenya hanya dipakai untuk duduk. */
export interface MejaMenunggu {
  kode: string;
  /** Nama host meja itu. */
  nama: string;
  terisi: number;
  jumlahPemain: number;
  pemain: string[];
}

export interface DetailKompetisi extends RingkasanKompetisi {
  v: 1;
  pengaturan: PengaturanKompetisi;
  minPeserta: number;
  minMain: number;
  peserta: string[];
  jumlahPermainan: number;
  setujuTutup: number;
  peringkat: BarisDetail[];
  belumCukup: BarisDetail[];
  meja?: MejaMenunggu[];
  saya?: { id: number; nama: string; setujuTutup: boolean };
}

export interface AksiKompetisi {
  kembali(): void;
  /** Buka meja online baru untuk kompetisi ini (pembukanya peserta pemilik tiket). */
  buatMeja(kode: string, token: string): void;
  /** Duduk di meja kompetisi yang menunggu (kode meja dari server; tiket ikut dikirim aplikasi). */
  duduk(kodeMeja: string): void;
}

const MEDALI = ['🥇', '🥈', '🥉'];
const BATAS_PENGAJUAN_MS = 24 * 60 * 60 * 1000;

const tanggal = (ms: number) =>
  new Date(ms).toLocaleString('id-ID', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
const tiketUntuk = (kode: string) => simpan.tiketKompetisi().find((t) => t.kode === kode) ?? null;

/** Galat dari server yang pesannya boleh ditampilkan apa adanya. */
class GalatServer extends Error {}

async function minta<T>(url: string, init: RequestInit = {}): Promise<T> {
  let r: Response;
  try {
    r = await fetch(url, { cache: 'no-store', ...init });
  } catch {
    throw new Error('jaringan');
  }
  let isi: unknown = null;
  try {
    isi = await r.json();
  } catch {
    // Bukan JSON (server lama tanpa API kompetisi, atau proxy): ditangani di bawah.
  }
  if (!r.ok) {
    const pesan = isi && typeof isi === 'object' && typeof (isi as { error?: unknown }).error === 'string' ? (isi as { error: string }).error : '';
    // 404 tanpa pesan = server belum kenal kompetisi.
    if (pesan) throw new GalatServer(pesan);
    throw new Error(`HTTP ${r.status}`);
  }
  return isi as T;
}

const kirimJson = <T>(url: string, isi: unknown) =>
  minta<T>(url, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(isi) });

const ambilDetail = (kode: string) => {
  const tiket = tiketUntuk(kode);
  return minta<DetailKompetisi>(`/api/kompetisi/${encodeURIComponent(kode)}`, tiket ? { headers: { 'x-tiket-kompetisi': tiket.token } } : {});
};

/** Waktu sudah habis (atau disudahi) tapi masih ada meja kompetisi yang main: juara belum diumumkan. */
export const menungguMejaTerakhir = (k: Pick<RingkasanKompetisi, 'status' | 'mejaMain'>): boolean =>
  k.status === 'selesai' && (k.mejaMain ?? 0) > 0;

/** Satu baris keterangan waktu sesuai status. */
export function keteranganWaktu(k: RingkasanKompetisi): string {
  switch (k.status) {
    case 'pengajuan':
      return `Batal kalau belum cukup peserta sampai ${tanggal(k.diajukanPada + BATAS_PENGAJUAN_MS)}`;
    case 'berjalan':
      return k.berakhirPada ? `Sampai ${tanggal(k.berakhirPada)}` : '';
    case 'selesai':
      if (menungguMejaTerakhir(k)) return teksMenungguMeja(k.mejaMain!, !!k.disudahi);
      return k.berakhirPada ? `${k.disudahi ? 'Disudahi' : 'Selesai'} ${tanggal(k.berakhirPada)}` : '';
    default:
      return '';
  }
}

/** Ringkasan aturan meja kompetisi, satu baris. */
export function ringkasAturan(p: PengaturanKompetisi): string {
  return [
    p.jumlahPemain ? `${p.jumlahPemain} pemain per meja` : '',
    p.jumlahPemain === 4 && p.duaDeckUntukEmpat ? '2 deck' : '',
    p.batasPutaran ? `${p.batasPutaran} putaran` : '',
    p.modeKaldu ? TEKS_KALDU.label.toLowerCase() : '',
    !p.modeKaldu && p.batasSkorAtas !== null ? `batas atas ${p.batasSkorAtas}` : '',
    !p.modeKaldu && p.batasSkorBawah !== null ? `batas bawah ${angkaSkor(p.batasSkorBawah)}` : '',
    p.detikGiliran ? `${p.detikGiliran} detik per giliran` : 'giliran tanpa batas waktu',
  ]
    .filter(Boolean)
    .join(' · ');
}

/** Piala juara kompetisi di samping nama (kosong kalau belum pernah juara). */
export function htmlPiala(n: number | undefined): string {
  const teks = teksPiala(n);
  return teks ? ` <span class="piala" role="img" aria-label="${esc(ariaPiala(n!))}">${teks}</span>` : '';
}

const htmlNama = (nama: string, piala?: number) => `${esc(nama)}${htmlPiala(piala)}`;

function htmlBaris(b: BarisDetail, label: string, namaSaya: string | null): string {
  const rincian = [`${b.main}× main`, `${b.juara}× juara meja`, b.keluar ? `keluar ${b.keluar}×` : '']
    .filter(Boolean)
    .join(' · ');
  return `<div class="baris-peringkat${b.nama === namaSaya ? ' saya' : ''}">
      <span class="medali">${label}</span>
      <span class="nama-skor"><b>${htmlNama(b.nama, b.piala)}</b><small class="redup">${esc(rincian)}</small></span>
      <span class="kanan-peringkat"><b class="total">${teksNilai(b.rataNilai)}</b><small class="redup">rata-rata</small></span>
    </div>`;
}

export function htmlKlasemen(d: Pick<DetailKompetisi, 'peringkat' | 'belumCukup' | 'saya'>): string {
  const saya = d.saya?.nama ?? null;
  if (!d.peringkat.length && !d.belumCukup.some((b) => b.main > 0)) return `<p class="redup">${esc(T.klasemenKosong)}</p>`;
  // Medali mengikuti nomor peringkat (yang seri persis berbagi nomor, dari server).
  const label = (b: BarisDetail, i: number) => {
    const n = b.peringkat ?? i + 1;
    return MEDALI[n - 1] ?? String(n);
  };
  const utama = d.peringkat.length ? `<div class="rincian">${d.peringkat.map((b, i) => htmlBaris(b, label(b, i), saya)).join('')}</div>` : '';
  const kurang = d.belumCukup.length
    ? `<h3 class="sub-judul">${esc(T.judulBelumCukup)}</h3><div class="rincian">${d.belumCukup.map((b) => htmlBaris(b, '·', saya)).join('')}</div>`
    : '';
  return utama + kurang;
}

/** Nama juara (dengan piala) dipisah koma. */
const htmlJuara = (k: Pick<RingkasanKompetisi, 'juara' | 'pialaJuara'>) =>
  (k.juara ?? []).map((n, i) => htmlNama(n, k.pialaJuara?.[i])).join(', ');

/** Daftar meja yang menunggu peserta: "Meja Ani · 2/4 · Ani, Budi" + Duduk. Tanpa kode meja. */
export function htmlDaftarMeja(meja: readonly MejaMenunggu[], kunci: boolean): string {
  if (!meja.length) return `<p class="redup rapat">${esc(T.mejaKosong)}</p>`;
  const dis = kunci ? ' disabled' : '';
  return `<div class="daftar daftar-meja-kompetisi">${meja
    .map((m, i) => {
      const penuh = m.terisi >= m.jumlahPemain;
      const id = `meja-k-${i}`;
      return `<div class="daftar-item item-meja-kompetisi">
          <span class="nama-skor" id="${id}"><b>Meja ${esc(m.nama)} · ${m.terisi}/${m.jumlahPemain}</b>
            <small class="redup">${esc(m.pemain.join(', '))}${penuh ? ` · ${esc(T.mejaPenuh)}` : ''}</small></span>
          ${penuh ? '' : `<button type="button" class="utama kecil" data-duduk="${esc(m.kode)}" aria-describedby="${id}"${dis}>${esc(T.duduk)}</button>`}
        </div>`;
    })
    .join('')}</div>`;
}

export function renderKompetisi(akar: HTMLElement, aksi: AksiKompetisi, kodeAwal?: string): void {
  /** Penanda tampilan: jawaban server yang telat untuk tampilan lama diabaikan, polling lama berhenti. */
  let ke = 0;
  const namaSaya = () => simpan.nama().trim();

  const kerangka = (judul: string, isi: string, labelKembali: string = T.kembali) => {
    akar.innerHTML = `
    <div class="layar layar-kompetisi"><div class="kolom">
      <div class="judul"><h1>${judul}</h1></div>
      ${isi}
      <button type="button" id="kembali">${esc(labelKembali)}</button>
    </div></div>`;
  };

  const gagal = (wadah: HTMLElement, e: unknown, cobaLagi: () => void) => {
    wadah.innerHTML = `<p class="redup rapat">${esc(e instanceof GalatServer ? e.message : T.gagalMuat)}</p>
      <div class="deret"><button type="button" data-coba>${esc(T.cobaLagi)}</button></div>`;
    wadah.querySelector('[data-coba]')!.addEventListener('click', cobaLagi);
  };

  // ---------- daftar ----------
  const daftar = () => {
    const nomor = ++ke;
    kerangka(
      `🏅 ${esc(T.judul)}`,
      `<div class="kartu-panel">
         <p class="rapat">${esc(T.ajak)}</p>
         <button type="button" class="utama penuh" id="ajukan">${esc(T.tombolAjukan)}</button>
       </div>
       <div class="kartu-panel" id="isi-daftar" aria-live="polite"><p class="redup" aria-busy="true">Memuat dari server…</p></div>`,
      T.kembaliBeranda,
    );
    akar.querySelector('#kembali')!.addEventListener('click', () => aksi.kembali());
    akar.querySelector('#ajukan')!.addEventListener('click', ajukan);
    const wadah = akar.querySelector<HTMLElement>('#isi-daftar')!;
    minta<{ kompetisi: RingkasanKompetisi[] }>('/api/kompetisi').then(
      (d) => {
        if (nomor !== ke) return;
        const semua = Array.isArray(d?.kompetisi) ? d.kompetisi : [];
        if (!semua.length) return void (wadah.innerHTML = `<p class="redup rapat">${esc(T.kosong)}</p>`);
        const bagian = (status: StatusKompetisi, judul: string) => {
          const isi = semua.filter((k) => k.status === status);
          if (!isi.length) return '';
          return `<h2>${esc(judul)}</h2><div class="daftar daftar-kompetisi">${isi
            .map((k) => {
              const ikut = tiketUntuk(k.kode) ? `<span class="lencana">${esc(T.lencanaIkut)}</span>` : '';
              const juara = k.juara?.length ? ` · ${esc(T.juara)}: ${htmlJuara(k)}` : '';
              return `<button type="button" class="daftar-item item-kompetisi" data-kode="${esc(k.kode)}">
                  <span class="nama-skor"><b>${esc(k.nama)}</b>${ikut}
                  <small class="redup">${esc(LABEL_MASA[k.masa] ?? k.masa)} · ${k.jumlahPeserta} peserta${juara}</small>
                  <small class="redup">${esc(keteranganWaktu(k))}</small></span>
                  <span aria-hidden="true">›</span>
                </button>`;
            })
            .join('')}</div>`;
        };
        wadah.innerHTML = bagian('berjalan', T.bagianBerjalan) + bagian('pengajuan', T.bagianPengajuan) + bagian('selesai', T.bagianSelesai);
        wadah.querySelectorAll<HTMLElement>('[data-kode]').forEach((b) => b.addEventListener('click', () => detail(b.dataset.kode!)));
      },
      (e) => nomor === ke && gagal(wadah, e, daftar),
    );
  };

  // ---------- detail ----------
  const detail = (kode: string) => {
    const nomor = ++ke;
    kerangka(`🏅 ${esc(T.judul)}`, `<div id="isi-detail"><div class="kartu-panel"><p class="redup" aria-busy="true">Memuat dari server…</p></div></div>`);
    akar.querySelector('#kembali')!.addEventListener('click', daftar);
    const wadah = akar.querySelector<HTMLElement>('#isi-detail')!;
    /** Jawaban terakhir yang digambar (JSON), supaya polling yang tidak membawa perubahan tidak menggambar ulang. */
    let terakhir = '';
    /** Tombol Duduk / Buka meja baru dikunci sampai saat ini (menunggu jawaban server). */
    let kunciMejaSampai = 0;
    let timerPolling: ReturnType<typeof setTimeout> | null = null;
    let sedangMinta = false;
    const terbuka = () => nomor === ke && wadah.isConnected;

    const tampil = (d: DetailKompetisi) => {
      terakhir = JSON.stringify(d);
      const tiket = tiketUntuk(kode);
      // Tiket yang tidak dikenali server lagi (database diganti) tidak dianggap ikut.
      const ikut = !!tiket && !!d.saya;
      const bisaIkut = !ikut && (d.status === 'pengajuan' || d.status === 'berjalan');
      const jalan = d.status === 'berjalan';
      const menunggu = menungguMejaTerakhir(d);
      const butuhSudahi = Math.floor(d.jumlahPeserta / 2) + 1;
      const kunci = Date.now() < kunciMejaSampai;
      // Ada meja yang masih punya kursi kosong: Duduk jadi tombol utama, Buka meja baru pilihan kedua
      // (supaya peserta mengisi meja yang ada dulu, bukan masing-masing membuka meja sendiri).
      const adaKursi = (d.meja ?? []).some((m) => m.terisi < m.jumlahPemain);
      // Piala per nama dari baris klasemen (semua peserta ada di salah satu daftarnya).
      const piala = new Map([...d.peringkat, ...d.belumCukup].map((b) => [b.nama, b.piala]));
      // Masih menunggu meja terakhir: lencananya ikut sebabnya (disudahi lewat voting, atau masanya habis).
      const status = menunggu ? (d.disudahi ? T.lencanaMenungguDisudahi : T.lencanaMenunggu) : LABEL_STATUS[d.status];
      // Fokus dan akordion yang terbuka dipertahankan saat digambar ulang (polling).
      const aktif = document.activeElement;
      const fokus =
        aktif instanceof HTMLElement && wadah.contains(aktif)
          ? aktif.id
            ? `#${aktif.id}`
            : aktif.dataset.duduk
              ? `[data-duduk="${aktif.dataset.duduk}"]`
              : null
          : null;
      const caraTerbuka = !!wadah.querySelector<HTMLDetailsElement>('details.cara-hitung')?.open;
      wadah.innerHTML = `
        <div class="kartu-panel">
          <div class="kepala-panel"><h2>${esc(d.nama)}</h2><span class="lencana${jalan ? ' emas' : ''}">${esc(status)}</span></div>
          <p class="rapat">${esc(LABEL_MASA[d.masa] ?? d.masa)}</p>
          <p class="redup rapat">${esc(keteranganWaktu(d))}</p>
          ${d.juara?.length ? `<p class="rapat juara-kompetisi">${esc(T.juara)}: <b>${htmlJuara(d)}</b></p>` : ''}
          ${menunggu ? `<p class="bantuan rapat">${esc(T.ketJuaraNanti)}</p>` : ''}
          <p class="redup rapat">${esc(ringkasAturan(d.pengaturan))}</p>
          <p class="rapat peserta-kompetisi">${d.status === 'pengajuan' ? `<b>${d.jumlahPeserta}/${d.minPeserta}</b> peserta: ` : `${d.jumlahPeserta} peserta: `}${d.peserta
            .map((n) => htmlNama(n, piala.get(n)))
            .join(', ')}</p>
          ${bisaIkut ? `<button type="button" class="utama penuh" id="ikut">${esc(T.ikutSerta)}</button>` : ''}
          ${ikut ? `<p class="bantuan rapat">${esc(T.catatanHp)}</p>` : ''}
        </div>
        ${
          ikut && jalan
            ? `<div class="kartu-panel panel-meja-kompetisi">
                 <h2>${esc(T.judulMeja)}</h2>
                 ${htmlDaftarMeja(d.meja ?? [], kunci)}
                 <button type="button" class="${adaKursi ? '' : 'utama '}penuh" id="buka-meja"${kunci ? ' disabled' : ''}>${esc(T.bukaMeja)}</button>
                 <p class="bantuan rapat">${esc(T.ketMeja)}</p>
               </div>`
            : ''
        }
        ${
          d.status === 'berjalan' || d.status === 'selesai'
            ? `<div class="kartu-panel">
                 <div class="kepala-panel"><h2>${esc(T.judulKlasemen)}</h2><span class="redup">${d.jumlahPermainan} permainan</span></div>
                 ${htmlKlasemen(d)}
                 <details class="akordion cara-hitung"${caraTerbuka ? ' open' : ''}><summary>Cara hitung</summary><p class="bantuan">${esc(T.caraHitung)}</p></details>
               </div>`
            : ''
        }
        ${
          ikut && jalan
            ? `<div class="kartu-panel">
                 <p class="bantuan rapat">${esc(T.ketSudahi)} ${d.setujuTutup} dari ${d.jumlahPeserta} setuju (butuh ${butuhSudahi}).</p>
                 <button type="button" class="${d.saya?.setujuTutup ? '' : 'hantu '}penuh" id="sudahi" aria-pressed="${d.saya?.setujuTutup ? 'true' : 'false'}">${esc(d.saya?.setujuTutup ? T.batalSudahi : T.sudahi)}</button>
               </div>`
            : ''
        }`;
      if (fokus) wadah.querySelector<HTMLElement>(fokus)?.focus({ preventScroll: true });
      const sibuk = (b: HTMLButtonElement | null, fn: () => Promise<void>) =>
        b?.addEventListener('click', () => {
          if (b.disabled) return;
          b.disabled = true;
          fn().finally(() => {
            if (b.isConnected) b.disabled = false;
          });
        });
      sibuk(wadah.querySelector('#ikut'), async () => {
        const nama = namaSaya();
        if (!nama) return void toast('Isi namamu dulu di beranda, Bos.', true);
        try {
          const h = await kirimJson<{ token: string; detail: DetailKompetisi }>(`/api/kompetisi/${encodeURIComponent(kode)}/ikut`, { nama });
          simpan.tambahTiketKompetisi({ kode, token: h.token, nama: h.detail?.saya?.nama ?? nama });
          toast(T.toastIkut);
          if (terbuka()) tampil(h.detail);
        } catch (e) {
          toast(e instanceof GalatServer ? e.message : T.gagalMuat, true);
        }
      });
      // Duduk / Buka meja baru: jawaban datang lewat sambungan meja (layar berganti ke lobi), jadi
      // tombolnya dikunci sebentar supaya tidak terkirim dua kali.
      const kunciMeja = () => {
        kunciMejaSampai = Date.now() + KUNCI_MEJA_MS;
        wadah.querySelectorAll<HTMLButtonElement>('[data-duduk], #buka-meja').forEach((b) => (b.disabled = true));
        setTimeout(() => {
          if (!terbuka() || Date.now() < kunciMejaSampai) return;
          wadah.querySelectorAll<HTMLButtonElement>('[data-duduk], #buka-meja').forEach((b) => (b.disabled = false));
        }, KUNCI_MEJA_MS + 50);
      };
      wadah.querySelector<HTMLButtonElement>('#buka-meja')?.addEventListener('click', (e) => {
        if ((e.currentTarget as HTMLButtonElement).disabled || !tiket) return;
        kunciMeja();
        aksi.buatMeja(kode, tiket.token);
      });
      wadah.querySelectorAll<HTMLButtonElement>('[data-duduk]').forEach((b) =>
        b.addEventListener('click', () => {
          if (b.disabled) return;
          kunciMeja();
          aksi.duduk(b.dataset.duduk!);
        }),
      );
      sibuk(wadah.querySelector('#sudahi'), async () => {
        if (!tiket) return;
        try {
          const h = await kirimJson<{ detail: DetailKompetisi }>(`/api/kompetisi/${encodeURIComponent(kode)}/tutup`, {
            token: tiket.token,
            setuju: !d.saya?.setujuTutup,
          });
          if (terbuka()) tampil(h.detail);
        } catch (e) {
          toast(e instanceof GalatServer ? e.message : T.gagalMuat, true);
        }
      });
    };

    // ----- polling: hanya selama layar ini terbuka dan tab terlihat -----
    const berhenti = () => {
      if (timerPolling !== null) clearTimeout(timerPolling);
      timerPolling = null;
      document.removeEventListener('visibilitychange', saatTerlihat);
    };
    const jadwal = () => {
      if (timerPolling !== null) clearTimeout(timerPolling);
      timerPolling = terbuka() ? setTimeout(segarkan, POLLING_DETAIL_MS) : null;
    };
    function segarkan() {
      timerPolling = null;
      if (!terbuka()) return berhenti();
      // Tab tersembunyi: berhenti dulu, disambung lagi saat terlihat (saatTerlihat).
      if (document.visibilityState === 'hidden' || sedangMinta) return;
      sedangMinta = true;
      ambilDetail(kode)
        .then(
          (d) => {
            if (terbuka() && JSON.stringify(d) !== terakhir) tampil(d);
          },
          () => undefined,
        )
        .finally(() => {
          sedangMinta = false;
          if (terbuka()) jadwal();
          else berhenti();
        });
    }
    function saatTerlihat() {
      if (!terbuka()) return berhenti();
      if (document.visibilityState === 'visible' && timerPolling === null && !sedangMinta) segarkan();
    }
    document.addEventListener('visibilitychange', saatTerlihat);

    ambilDetail(kode).then(
      (d) => {
        if (!terbuka()) return berhenti();
        tampil(d);
        jadwal();
      },
      (e) => {
        berhenti();
        if (nomor !== ke) return;
        wadah.innerHTML = '<div class="kartu-panel"></div>';
        gagal(wadah.firstElementChild as HTMLElement, e, () => detail(kode));
      },
    );
  };

  // ---------- ajukan ----------
  const ajukan = () => {
    ++ke;
    const nilaiAwal = { batasSkorAtas: null, batasSkorBawah: null };
    const pilihan = (id: string, opsi: [string | number, string][], awal: string | number) =>
      `<select id="${id}">${opsi.map(([v, label]) => `<option value="${v}"${v === awal ? ' selected' : ''}>${esc(label)}</option>`).join('')}</select>`;
    const jumlah: [number, string][] = [];
    for (let n = MIN_PEMAIN_KOMPETISI; n <= MAKS_PEMAIN_KOMPETISI; n++) jumlah.push([n, `${n} orang`]);
    kerangka(
      `🏅 ${esc(T.judulAjukan)}`,
      `<form class="kartu-panel" id="form-ajukan" novalidate>
         <label class="medan" for="k-nama">${esc(T.labelNama)}
           <input type="text" id="k-nama" maxlength="32" placeholder="${esc(T.contohNama)}" autocomplete="off" enterkeyhint="done" required /></label>
         <label class="baris">${esc(T.labelMasa)} ${pilihan('k-masa', DAFTAR_MASA.map((m) => [m, LABEL_MASA[m]]), 'malam')}</label>
         <p class="bantuan rapat">${esc(T.ketAturan)}</p>
         <label class="baris">${esc(T.labelJumlah)} ${pilihan('k-jumlah', jumlah, JUMLAH_PEMAIN_KOMPETISI_BAWAAN)}</label>
         <label class="baris" id="k-baris-dua">${esc(T.labelDuaDeck)}<input type="checkbox" id="k-dua" /></label>
         <label class="baris">${esc(T.labelPutaran)} ${pilihan('k-putaran', PILIHAN_BATAS_PUTARAN_KOMPETISI.map((n) => [n, String(n)]), BATAS_PUTARAN_KOMPETISI_BAWAAN)}</label>
         <label class="baris">${esc(TEKS_KALDU.label)}<input type="checkbox" id="k-kaldu" aria-describedby="k-ket-kaldu" /></label>
         <p class="bantuan rapat" id="k-ket-kaldu">${esc(TEKS_KALDU.ket)}</p>
         ${htmlIsianBatas({ id: 'k-skor', nilai: nilaiAwal, bisaUbah: true })}
         <label class="baris">${esc(T.labelDetik)} ${pilihan('k-detik', PILIHAN_DETIK_GILIRAN_KOMPETISI.map((n) => [n, `${n} detik`]), DETIK_GILIRAN_KOMPETISI_BAWAAN)}</label>
         <p class="bantuan rapat">${esc(T.ketDetik)}</p>
         <div class="deret">
           <button type="submit" class="utama" id="kirim-ajukan">${esc(T.kirimAjukan)}</button>
         </div>
       </form>`,
      T.batal,
    );
    akar.querySelector('#kembali')!.addEventListener('click', daftar);
    const form = akar.querySelector<HTMLFormElement>('#form-ajukan')!;
    const q = <E extends HTMLElement>(id: string) => form.querySelector<E>(`#${id}`)!;
    // Nilai awal juga diset lewat .value (atribut selected saja bisa meleset di sebagian mesin DOM).
    q<HTMLSelectElement>('k-jumlah').value = String(JUMLAH_PEMAIN_KOMPETISI_BAWAAN);
    q<HTMLSelectElement>('k-putaran').value = String(BATAS_PUTARAN_KOMPETISI_BAWAAN);
    q<HTMLSelectElement>('k-detik').value = String(DETIK_GILIRAN_KOMPETISI_BAWAAN);
    const kaldu = q<HTMLInputElement>('k-kaldu');
    const selJumlah = q<HTMLSelectElement>('k-jumlah');
    const isianBatas = form.querySelector<HTMLElement>('.isian-batas-skor')!;
    const empat = () => Number(selJumlah.value) === 4;
    // Mode kaldu tidak memakai batas skor (#43): isiannya disembunyikan, sama seperti Atur meja.
    // "2 deck" hanya berarti di meja 4 orang: centangnya hanya tampil kalau pemain per meja 4.
    const aturTampil = () => {
      isianBatas.classList.toggle('tersembunyi', kaldu.checked);
      q('k-baris-dua').classList.toggle('tersembunyi', !empat());
    };
    kaldu.addEventListener('change', aturTampil);
    selJumlah.addEventListener('change', aturTampil);
    pasangIsianBatas(form, 'k-skor', nilaiAwal);
    aturTampil();
    q<HTMLInputElement>('k-nama').focus();
    let terkirim = false;
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      if (terkirim) return;
      const nama = q<HTMLInputElement>('k-nama').value.trim();
      if (!nama) {
        toast('Kasih nama kompetisinya dulu, Bos.', true);
        return q<HTMLInputElement>('k-nama').focus();
      }
      const namaPengaju = namaSaya();
      if (!namaPengaju) return void toast('Isi namamu dulu di beranda, Bos.', true);
      const masa = q<HTMLSelectElement>('k-masa').value;
      const batas = kaldu.checked ? { batasSkorAtas: null, batasSkorBawah: null } : bacaIsianBatas(form, 'k-skor');
      const pengaturan: Partial<PengaturanKompetisi> = {
        jumlahPemain: Number(selJumlah.value) || JUMLAH_PEMAIN_KOMPETISI_BAWAAN,
        batasPutaran: Number(q<HTMLSelectElement>('k-putaran').value) || BATAS_PUTARAN_KOMPETISI_BAWAAN,
        duaDeckUntukEmpat: empat() && q<HTMLInputElement>('k-dua').checked,
        modeKaldu: kaldu.checked,
        detikGiliran: Number(q<HTMLSelectElement>('k-detik').value) || DETIK_GILIRAN_KOMPETISI_BAWAAN,
        ...batas,
      };
      terkirim = true;
      const tombol = q<HTMLButtonElement>('kirim-ajukan');
      tombol.disabled = true;
      kirimJson<{ kode: string; token: string; detail: DetailKompetisi }>('/api/kompetisi', {
        nama,
        masa: isMasa(masa) ? masa : 'malam',
        pengaturan,
        namaPengaju,
      }).then(
        (h) => {
          simpan.tambahTiketKompetisi({ kode: h.kode, token: h.token, nama: h.detail?.saya?.nama ?? namaPengaju });
          toast(T.toastAjukan);
          detail(h.kode);
        },
        (err) => {
          terkirim = false;
          if (tombol.isConnected) tombol.disabled = false;
          toast(err instanceof GalatServer ? err.message : T.gagalMuat, true);
        },
      );
    });
  };

  if (kodeAwal && /^[A-Z0-9]{5}$/.test(kodeAwal)) detail(kodeAwal);
  else daftar();
}
