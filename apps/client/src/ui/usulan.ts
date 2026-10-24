// Dialog Usul fitur (keputusan pemilik 24 Okt 2026): pemain menulis ide atau laporan yang aneh, lalu
// dikirim ke server (POST /api/usulan) yang meneruskannya ke Notion pemilik untuk ditinjau tiap hari.
//
// Hanya dibuka dari beranda (ubin menu) dan dari Tentang yang dibuka di beranda; tidak pernah dari
// meja, susun akhir, atau menu ☰ di meja. Lewat bukaDialog, jadi pembaruan otomatis menunggu
// (dialogTerbuka) dan tidak menimpa jendela lain. Aturan isian sama persis dengan server
// (periksaUsulan dari @remi/meja). Tulisan yang belum terkirim disimpan di memori selama aplikasi
// terbuka, jadi dialog yang tertutup tidak sengaja (ketuk latar, offline) bisa dilanjutkan.
// Pengiriman yang sedang jalan juga dicatat untuk seluruh aplikasi (bukan per dialog): dialog yang
// ditutup selagi mengirim lalu dibuka lagi menunggu pengiriman yang sama, tidak mengirim ulang.

import { DAFTAR_JENIS_USULAN, MAKS_ISI_USULAN, MAKS_JUDUL_USULAN, periksaUsulan, type IsianUsulan, type Usulan } from '@remi/meja';
import { TEKS_USULAN as T } from '../konten/usulan';
import { simpan } from '../penyimpanan';
import { bukaDialog, esc, toast } from './dom';

/** Tunggu jawaban server paling lama sekian ms; lewat dari itu dianggap belum terhubung. */
const BATAS_TUNGGU_MS = 15_000;

interface Draf {
  jenis: string;
  judul: string;
  isi: string;
}
const DRAF_KOSONG: Draf = { jenis: '', judul: '', isi: '' };
let draf: Draf = { ...DRAF_KOSONG };

export type HasilKirimUsulan = { ok: true } | { ok: false; pesan: string };

/** Pengiriman yang sedang menunggu jawaban server (paling banyak satu untuk seluruh aplikasi). */
let kirimanJalan: Promise<HasilKirimUsulan> | null = null;

/** Dialog Usul fitur yang sedang terbuka (paling banyak satu), yang dikabari hasil pengiriman. */
interface FormUsulan {
  aturMengirim(ya: boolean): void;
  tampilGalat(pesan: string): void;
  tutup(): void;
}
let formTerbuka: FormUsulan | null = null;

/** Khusus test: lupakan tulisan dan pengiriman yang belum selesai. */
export function _lupakanDrafUsulan(): void {
  draf = { ...DRAF_KOSONG };
  kirimanJalan = null;
  formTerbuka = null;
}

/**
 * Kirim usulan ke server. Pesan galat dari server (400/429/…) dikembalikan apa adanya; jaringan putus
 * atau server diam = pesan ramah bahwa tulisannya masih ada.
 */
export async function kirimUsulan(isi: unknown, ambil: typeof fetch = fetch): Promise<HasilKirimUsulan> {
  const batal = typeof AbortController === 'function' ? new AbortController() : null;
  const timer = setTimeout(() => batal?.abort(), BATAS_TUNGGU_MS);
  let r: Response;
  try {
    r = await ambil('/api/usulan', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(isi),
      cache: 'no-store',
      signal: batal?.signal,
    });
  } catch {
    return { ok: false, pesan: navigator.onLine === false ? T.offline : T.gagalJaringan };
  } finally {
    clearTimeout(timer);
  }
  let data: unknown = null;
  try {
    data = await r.json();
  } catch {
    // Bukan JSON (server lama tanpa /api/usulan, proxy): pesan umum di bawah.
  }
  const o = (data && typeof data === 'object' ? data : {}) as { ok?: unknown; error?: unknown };
  if (r.ok && o.ok === true) return { ok: true };
  return { ok: false, pesan: typeof o.error === 'string' && o.error ? o.error : T.gagalLain };
}

/**
 * Kirim usulan yang sudah diperiksa. Hasilnya dikabarkan ke dialog yang terbuka saat jawaban datang
 * (bisa dialog lain kalau yang tadi ditutup lalu dibuka lagi); tanpa dialog, lewat toast.
 */
function mulaiKirim(usulan: Usulan): void {
  if (kirimanJalan) return;
  const jalan = kirimUsulan(usulan).catch((): HasilKirimUsulan => ({ ok: false, pesan: T.gagalLain }));
  kirimanJalan = jalan;
  formTerbuka?.aturMengirim(true);
  void jalan.then((hasil) => {
    if (kirimanJalan !== jalan) return; // dilupakan (khusus test)
    kirimanJalan = null;
    const f = formTerbuka;
    f?.aturMengirim(false);
    if (!hasil.ok) {
      if (f) f.tampilGalat(hasil.pesan);
      else toast(hasil.pesan, true);
      return;
    }
    draf = { ...DRAF_KOSONG };
    f?.tutup();
    toast(T.terkirim);
  });
}

/** Buka dialog Usul fitur. Nama diambil dari nama yang tersimpan di beranda. */
export function bukaUsulan(): void {
  const ada = document.querySelector<HTMLElement>('.dialog.usulan');
  if (ada) return ada.focus();
  const nama = simpan.nama().trim();
  if (!nama) {
    bukaDialog(
      `<h2>${esc(T.judul)}</h2>
       <p>${esc(T.belumAdaNama)}</p>
       <div class="kaki-dialog"><button type="button" class="utama" data-tutup>${esc(T.oke)}</button></div>`,
      undefined,
      { kelas: 'usulan konfirmasi' },
    );
    return;
  }
  let form: FormUsulan | null = null;
  const pilihanJenis = [['', T.pilihJenis], ...DAFTAR_JENIS_USULAN.map((j) => [j, j])]
    .map(([v, label]) => `<option value="${esc(v)}">${esc(label)}</option>`)
    .join('');
  bukaDialog(
    `<div class="kepala-dialog">
       <h2><span aria-hidden="true">💡</span> ${esc(T.judul)}</h2>
       <button type="button" class="tombol-ikon hantu tutup-dialog" data-tutup aria-label="${esc(T.tutup)}">✕</button>
     </div>
     <p class="usulan-pembuka">${esc(T.pembuka)}</p>
     <form class="form-usulan" novalidate>
       <label class="medan" for="usulan-jenis">${esc(T.labelJenis)}
         <select id="usulan-jenis" autofocus>${pilihanJenis}</select></label>
       <label class="medan" for="usulan-judul">${esc(T.labelJudul)}
         <input type="text" id="usulan-judul" maxlength="${MAKS_JUDUL_USULAN}" placeholder="${esc(T.contohJudul)}" value="${esc(draf.judul)}" autocomplete="off" enterkeyhint="next" /></label>
       <label class="medan" for="usulan-isi">${esc(T.labelIsi)}
         <textarea id="usulan-isi" rows="6" maxlength="${MAKS_ISI_USULAN}" placeholder="${esc(T.contohIsi)}" aria-describedby="usulan-hitung">${esc(draf.isi)}</textarea>
         <small class="bantuan usulan-hitung angka" id="usulan-hitung"></small></label>
       <p class="redup rapat usulan-nama">${esc(T.dikirimSebagai)} <b>${esc(nama)}</b>.</p>
       <p class="usulan-galat" id="usulan-galat" role="alert" hidden></p>
       <div class="kaki-dialog">
         <button type="button" data-tutup>${esc(T.batal)}</button>
         <button type="submit" class="utama" id="usulan-kirim">${esc(T.kirim)}</button>
       </div>
     </form>`,
    (d, tutup) => {
      form = pasangForm(d, tutup, nama);
      formTerbuka = form;
    },
    {
      kelas: 'usulan',
      saatTutup: () => {
        if (formTerbuka === form) formTerbuka = null;
      },
    },
  );
}

function pasangForm(d: HTMLElement, tutup: () => void, nama: string): FormUsulan {
  const form = d.querySelector<HTMLFormElement>('.form-usulan')!;
  const isian: Record<Exclude<IsianUsulan, 'nama'>, HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement> = {
    jenis: d.querySelector<HTMLSelectElement>('#usulan-jenis')!,
    judul: d.querySelector<HTMLInputElement>('#usulan-judul')!,
    isi: d.querySelector<HTMLTextAreaElement>('#usulan-isi')!,
  };
  // Jenis dari draf dipasang lewat .value (bukan atribut selected), sama untuk semua browser.
  isian.jenis.value = draf.jenis;
  const hitung = d.querySelector<HTMLElement>('#usulan-hitung')!;
  const galat = d.querySelector<HTMLElement>('#usulan-galat')!;
  const tombol = d.querySelector<HTMLButtonElement>('#usulan-kirim')!;

  const perbaruiHitung = () => (hitung.textContent = `${isian.isi.value.length}${T.maksIsi}`);
  const bersihkanGalat = () => {
    galat.hidden = true;
    galat.textContent = '';
    for (const el of Object.values(isian)) el.removeAttribute('aria-invalid');
  };
  const tampilGalat = (pesan: string, di?: IsianUsulan) => {
    bersihkanGalat();
    galat.textContent = pesan;
    galat.hidden = false;
    const el = di && di !== 'nama' ? isian[di] : null;
    if (el) {
      el.setAttribute('aria-invalid', 'true');
      const dijelaskan = new Set((el.getAttribute('aria-describedby') ?? '').split(' ').filter(Boolean)).add('usulan-galat');
      el.setAttribute('aria-describedby', [...dijelaskan].join(' '));
      el.focus();
    }
  };
  const catatDraf = () => {
    draf = { jenis: isian.jenis.value, judul: isian.judul.value, isi: isian.isi.value };
  };
  form.addEventListener('input', () => {
    catatDraf();
    perbaruiHitung();
    if (!galat.hidden) bersihkanGalat();
  });
  form.addEventListener('change', catatDraf);
  perbaruiHitung();

  // Selama mengirim, judul dan isi hanya-baca: yang terkirim adalah tulisan saat Kirim ditekan, dan
  // sesudah berhasil dialognya ditutup, jadi ketikan baru di tengah jalan akan hilang. readOnly (bukan
  // disabled) supaya tetap bisa difokus dan dibaca pembaca layar.
  const aturMengirim = (ya: boolean) => {
    tombol.disabled = ya;
    tombol.textContent = ya ? T.mengirim : T.kirim;
    form.toggleAttribute('aria-busy', ya);
    (isian.judul as HTMLInputElement).readOnly = ya;
    (isian.isi as HTMLTextAreaElement).readOnly = ya;
  };
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    if (kirimanJalan) return;
    catatDraf();
    const cek = periksaUsulan({ nama, jenis: isian.jenis.value, judul: isian.judul.value, isi: isian.isi.value });
    if (!cek.ok) return tampilGalat(cek.pesan, cek.isian);
    if (navigator.onLine === false) return tampilGalat(T.offline);
    mulaiKirim(cek.usulan);
  });
  // Dibuka lagi selagi pengiriman tadi belum dijawab: tunggu yang itu, Kirim tetap terkunci.
  if (kirimanJalan) aturMengirim(true);
  return { aturMengirim, tampilGalat: (pesan) => tampilGalat(pesan), tutup };
}
