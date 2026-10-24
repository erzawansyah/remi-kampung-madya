// Layar Kompetisi (keputusan pemilik #51): daftar kompetisi (menunggu peserta, sedang jalan, sudah
// selesai), detail dengan klasemen, Ikut serta, Buat meja kompetisi, voting sudahi lebih awal, dan
// formulir pengajuan. Semua data dari server (/api/kompetisi); aturan hitungnya di @remi/meja.
// Tiket peserta (token) disimpan di HP ini (penyimpanan.ts) dan dikirim lewat header saat membaca
// detail, supaya server tahu "kamu" yang mana.

import {
  BATAS_PUTARAN_KOMPETISI_BAWAAN,
  DAFTAR_MASA,
  isMasa,
  PILIHAN_BATAS_PUTARAN_KOMPETISI,
  teksNilai,
  type BarisKompetisi,
  type MasaKompetisi,
  type PengaturanKompetisi,
  type StatusKompetisi,
} from '@remi/meja';
import { TEKS_KALDU } from '../konten/kaldu';
import { LABEL_MASA, LABEL_STATUS, TEKS_KOMPETISI as T } from '../konten/kompetisi';
import { simpan } from '../penyimpanan';
import { bacaIsianBatas, htmlIsianBatas, pasangIsianBatas } from './batasSkor';
import { esc, toast } from './dom';
import { angkaSkor } from './rincianSkor';

interface RingkasanKompetisi {
  kode: string;
  nama: string;
  masa: MasaKompetisi;
  status: StatusKompetisi;
  jumlahPeserta: number;
  diajukanPada: number;
  mulaiPada: number | null;
  berakhirPada: number | null;
  juara?: string[];
}

interface DetailKompetisi extends RingkasanKompetisi {
  v: 1;
  pengaturan: PengaturanKompetisi;
  minPeserta: number;
  minMain: number;
  peserta: string[];
  jumlahPermainan: number;
  setujuTutup: number;
  peringkat: BarisKompetisi[];
  belumCukup: BarisKompetisi[];
  saya?: { id: number; nama: string; setujuTutup: boolean };
}

export interface AksiKompetisi {
  kembali(): void;
  /** Buat meja online kompetisi ini (pembuatnya peserta pemilik tiket). */
  buatMeja(kode: string, token: string): void;
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

/** Satu baris keterangan waktu sesuai status. */
export function keteranganWaktu(k: RingkasanKompetisi): string {
  switch (k.status) {
    case 'pengajuan':
      return `Batal kalau belum cukup peserta sampai ${tanggal(k.diajukanPada + BATAS_PENGAJUAN_MS)}`;
    case 'berjalan':
      return k.berakhirPada ? `Sampai ${tanggal(k.berakhirPada)}` : '';
    case 'selesai':
      return k.berakhirPada ? `Selesai ${tanggal(k.berakhirPada)}` : '';
    default:
      return '';
  }
}

/** Ringkasan aturan meja kompetisi, satu baris. */
export function ringkasAturan(p: PengaturanKompetisi): string {
  return [
    p.batasPutaran ? `${p.batasPutaran} putaran` : 'tanpa batas putaran',
    p.modeKaldu ? TEKS_KALDU.label.toLowerCase() : '',
    !p.modeKaldu && p.batasSkorAtas !== null ? `batas atas ${p.batasSkorAtas}` : '',
    !p.modeKaldu && p.batasSkorBawah !== null ? `batas bawah ${angkaSkor(p.batasSkorBawah)}` : '',
    p.duaDeckUntukEmpat ? '4 pemain pakai 2 deck' : '',
    p.detikGiliran ? `${p.detikGiliran} detik per giliran` : 'giliran tanpa batas waktu',
  ]
    .filter(Boolean)
    .join(' · ');
}

function htmlBaris(b: BarisKompetisi, label: string, namaSaya: string | null): string {
  const rincian = [`${b.main}× main`, `${b.juara}× juara meja`, b.keluar ? `keluar ${b.keluar}×` : '']
    .filter(Boolean)
    .join(' · ');
  return `<div class="baris-peringkat${b.nama === namaSaya ? ' saya' : ''}">
      <span class="medali">${label}</span>
      <span class="nama-skor"><b>${esc(b.nama)}</b><small class="redup">${esc(rincian)}</small></span>
      <span class="kanan-peringkat"><b class="total">${teksNilai(b.rataNilai)}</b><small class="redup">nilai</small></span>
    </div>`;
}

export function htmlKlasemen(d: Pick<DetailKompetisi, 'peringkat' | 'belumCukup' | 'saya'>): string {
  const saya = d.saya?.nama ?? null;
  if (!d.peringkat.length && !d.belumCukup.some((b) => b.main > 0)) return `<p class="redup">${esc(T.klasemenKosong)}</p>`;
  const utama = d.peringkat.length
    ? `<div class="rincian">${d.peringkat.map((b, i) => htmlBaris(b, MEDALI[i] ?? String(i + 1), saya)).join('')}</div>`
    : '';
  const kurang = d.belumCukup.length
    ? `<h3 class="sub-judul">${esc(T.judulBelumCukup)}</h3><div class="rincian">${d.belumCukup.map((b) => htmlBaris(b, '·', saya)).join('')}</div>`
    : '';
  return utama + kurang;
}

export function renderKompetisi(akar: HTMLElement, aksi: AksiKompetisi, kodeAwal?: string): void {
  /** Penanda permintaan: jawaban server yang telat untuk tampilan lama diabaikan. */
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
              const juara = k.juara?.length ? ` · ${esc(T.juara)}: ${esc(k.juara.join(', '))}` : '';
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
    const tampil = (d: DetailKompetisi) => {
      const tiket = tiketUntuk(kode);
      // Tiket yang tidak dikenali server lagi (database diganti) tidak dianggap ikut.
      const ikut = !!tiket && !!d.saya;
      const bisaIkut = !ikut && (d.status === 'pengajuan' || d.status === 'berjalan');
      const jalan = d.status === 'berjalan';
      const butuhSudahi = Math.floor(d.jumlahPeserta / 2) + 1;
      wadah.innerHTML = `
        <div class="kartu-panel">
          <div class="kepala-panel"><h2>${esc(d.nama)}</h2><span class="lencana${jalan ? ' emas' : ''}">${esc(LABEL_STATUS[d.status])}</span></div>
          <p class="rapat">${esc(LABEL_MASA[d.masa] ?? d.masa)} · kode <b class="angka bisa-dipilih">${esc(d.kode)}</b></p>
          <p class="redup rapat">${esc(keteranganWaktu(d))}</p>
          ${d.juara?.length ? `<p class="rapat">🏆 ${esc(T.juara)}: <b>${esc(d.juara.join(', '))}</b></p>` : ''}
          <p class="redup rapat">${esc(ringkasAturan(d.pengaturan))}</p>
          <p class="rapat">${d.status === 'pengajuan' ? `<b>${d.jumlahPeserta}/${d.minPeserta}</b> peserta: ` : `${d.jumlahPeserta} peserta: `}${esc(d.peserta.join(', '))}</p>
          ${bisaIkut ? `<button type="button" class="utama penuh" id="ikut">${esc(T.ikutSerta)}</button>` : ''}
          ${ikut && jalan ? `<button type="button" class="utama penuh" id="buat-meja">${esc(T.buatMeja)}</button><p class="bantuan rapat">${esc(T.ketMeja)}</p>` : ''}
          ${ikut ? `<p class="bantuan rapat">${esc(T.catatanHp)}</p>` : ''}
        </div>
        ${
          d.status === 'berjalan' || d.status === 'selesai'
            ? `<div class="kartu-panel">
                 <div class="kepala-panel"><h2>${esc(T.judulKlasemen)}</h2><span class="redup">${d.jumlahPermainan} permainan</span></div>
                 ${htmlKlasemen(d)}
                 <details class="akordion"><summary>Cara hitung</summary><p class="bantuan">${esc(T.caraHitung)}</p></details>
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
          if (nomor === ke) tampil(h.detail);
        } catch (e) {
          toast(e instanceof GalatServer ? e.message : T.gagalMuat, true);
        }
      });
      sibuk(wadah.querySelector('#buat-meja'), async () => {
        if (tiket) aksi.buatMeja(kode, tiket.token);
      });
      sibuk(wadah.querySelector('#sudahi'), async () => {
        if (!tiket) return;
        try {
          const h = await kirimJson<{ detail: DetailKompetisi }>(`/api/kompetisi/${encodeURIComponent(kode)}/tutup`, {
            token: tiket.token,
            setuju: !d.saya?.setujuTutup,
          });
          if (nomor === ke) tampil(h.detail);
        } catch (e) {
          toast(e instanceof GalatServer ? e.message : T.gagalMuat, true);
        }
      });
    };
    ambilDetail(kode).then(
      (d) => nomor === ke && tampil(d),
      (e) => {
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
    kerangka(
      `🏅 ${esc(T.judulAjukan)}`,
      `<form class="kartu-panel" id="form-ajukan" novalidate>
         <label class="medan" for="k-nama">${esc(T.labelNama)}
           <input type="text" id="k-nama" maxlength="32" placeholder="${esc(T.contohNama)}" autocomplete="off" enterkeyhint="done" required /></label>
         <label class="baris">${esc(T.labelMasa)} ${pilihan('k-masa', DAFTAR_MASA.map((m) => [m, LABEL_MASA[m]]), 'malam')}</label>
         <p class="bantuan rapat">${esc(T.ketAturan)}</p>
         <label class="baris">Batas putaran ${pilihan('k-putaran', PILIHAN_BATAS_PUTARAN_KOMPETISI.map((n) => [n, String(n)]), BATAS_PUTARAN_KOMPETISI_BAWAAN)}</label>
         <label class="baris">Meja 4 pemain pakai 2 deck<input type="checkbox" id="k-dua" /></label>
         <label class="baris">${esc(TEKS_KALDU.label)}<input type="checkbox" id="k-kaldu" aria-describedby="k-ket-kaldu" /></label>
         <p class="bantuan rapat" id="k-ket-kaldu">${esc(TEKS_KALDU.ket)}</p>
         ${htmlIsianBatas({ id: 'k-skor', nilai: nilaiAwal, bisaUbah: true })}
         <label class="baris">Waktu per giliran ${pilihan('k-detik', [30, 60, 90, 120, 0].map((n) => [n, n ? `${n} detik` : 'Tanpa batas']), 60)}</label>
         <div class="deret">
           <button type="submit" class="utama" id="kirim-ajukan">${esc(T.kirimAjukan)}</button>
         </div>
       </form>`,
      T.batal,
    );
    akar.querySelector('#kembali')!.addEventListener('click', daftar);
    const form = akar.querySelector<HTMLFormElement>('#form-ajukan')!;
    const q = <E extends HTMLElement>(id: string) => form.querySelector<E>(`#${id}`)!;
    const kaldu = q<HTMLInputElement>('k-kaldu');
    const isianBatas = form.querySelector<HTMLElement>('.isian-batas-skor')!;
    // Mode kaldu tidak memakai batas skor (#43): isiannya disembunyikan, sama seperti Atur meja.
    const aturTampil = () => isianBatas.classList.toggle('tersembunyi', kaldu.checked);
    kaldu.addEventListener('change', aturTampil);
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
        batasPutaran: Number(q<HTMLSelectElement>('k-putaran').value) || BATAS_PUTARAN_KOMPETISI_BAWAAN,
        duaDeckUntukEmpat: q<HTMLInputElement>('k-dua').checked,
        modeKaldu: kaldu.checked,
        detikGiliran: Number(q<HTMLSelectElement>('k-detik').value),
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
