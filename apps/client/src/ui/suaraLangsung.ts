// Tampilan obrolan suara (0.9.0): tombol Mic + "Dengar suara" di bar atas meja online dan di lobi,
// lembar "Suara" (lewat bukaDialog: dua sakelar besar dan daftar teman dengan Bisukan/Bunyikan), dan ikon
// mic kecil di samping nama di kursi lobi. Penanda lagi ngomong hanya dari SuaraLangsung (tingkat suara),
// tidak pernah dari keadaan permainan. Lembar dibuka dari tombol kecil ▾ di samping mic, atau tekan lama
// tombol mic.

import { TEKS_SUARA } from '../konten/suara';
import { bunyi } from '../efek/suara';
import type { KeadaanMic, SuaraLangsung } from '../suaraLangsung';
import { bukaDialog, esc, toast } from './dom';

const garisCoret = '<path class="coret" d="M4 4 20 20" />';

/** Ikon mic (SVG inline, warna dari currentColor). `coret`: mic mati. */
export function svgMic(coret = false): string {
  return `<svg class="svg-suara" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><rect class="isi" x="9" y="2.5" width="6" height="11.5" rx="3" /><path d="M5.5 11a6.5 6.5 0 0 0 13 0M12 17.5V21M8.5 21h7" />${coret ? garisCoret : ''}</svg>`;
}

/** Ikon speaker. `coret`: semua suara teman dibisukan. */
export function svgSpeaker(coret = false): string {
  return `<svg class="svg-suara" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path class="isi" d="M3.5 9h4l5-4v14l-5-4h-4z" />${coret ? garisCoret : '<path d="M15.5 9a4 4 0 0 1 0 6M18 6.5a7.5 7.5 0 0 1 0 11" />'}</svg>`;
}

/** Ikon mic kecil untuk kursi (lobi, lembar Suara). Kosong kalau orangnya tidak ikut suara. */
export function htmlIkonMic(k: KeadaanMic | null): string {
  if (!k) return '';
  return `<span class="ikon-mic" data-keadaan="${k}" role="img" aria-label="${esc(TEKS_SUARA.label[k])}">${svgMic(k === 'mati' || k === 'lemah')}</span>`;
}

/** Kerangka grup tombol suara (diisi pasangTombolSuara). Tersembunyi sampai suara tersedia di meja ini. */
export function htmlTombolSuara(): string {
  return `<span class="grup-suara tersembunyi" role="group" aria-label="${esc(TEKS_SUARA.judul)}">
    <button type="button" class="tombol-ikon tombol-mic" data-suara="mic" aria-pressed="false"></button>
    <button type="button" class="tombol-ikon tombol-lembar-suara" data-suara="lembar" aria-haspopup="dialog" aria-label="${esc(TEKS_SUARA.bukaLembar)}"><span aria-hidden="true">▾</span></button>
    <button type="button" class="tombol-ikon tombol-dengar" data-suara="dengar" aria-pressed="true"></button>
  </span>`;
}

/** Tekan lama tombol mic membuka lembar Suara. */
const LAMA_TEKAN_MS = 550;

/**
 * Pasang perilaku grup tombol suara di `wadah` (berisi htmlTombolSuara). `alasanTolak`: gerbang sambungan
 * yang sama dengan tombol meja ('' = boleh). Mengembalikan pelepas; pendengarnya juga lepas sendiri kalau
 * elemennya sudah tidak di dokumen.
 */
export function pasangTombolSuara(wadah: HTMLElement, suara: SuaraLangsung, alasanTolak: () => string = () => ''): () => void {
  const grup = wadah.querySelector<HTMLElement>('.grup-suara');
  if (!grup) return () => undefined;
  const mic = grup.querySelector<HTMLButtonElement>('[data-suara="mic"]')!;
  const dengar = grup.querySelector<HTMLButtonElement>('[data-suara="dengar"]')!;
  let tekanLama = false;
  let timer: ReturnType<typeof setTimeout> | null = null;
  const batalTekan = () => {
    if (timer) clearTimeout(timer);
    timer = null;
  };

  const perbarui = () => {
    grup.classList.toggle('tersembunyi', !suara.tersedia);
    const t = suara.tombolMic;
    const lemah = suara.tingkat === 'jeda';
    mic.dataset.keadaan = lemah ? 'lemah' : t === 'nyala' && suara.bicaraSendiri ? 'bicara' : t;
    mic.setAttribute('aria-pressed', String(t === 'nyala'));
    mic.setAttribute('aria-label', t === 'minta' ? TEKS_SUARA.micMinta : t === 'nyala' ? TEKS_SUARA.micNyala : TEKS_SUARA.micMati);
    mic.innerHTML = `${svgMic(t !== 'nyala')}${lemah ? `<span class="tanda-lemah" aria-hidden="true">!</span>` : ''}`;
    if (lemah) mic.setAttribute('aria-label', `${mic.getAttribute('aria-label')}. ${TEKS_SUARA.label.lemah}`);
    const d = suara.dengarNyala;
    dengar.dataset.keadaan = d ? 'nyala' : 'mati';
    dengar.setAttribute('aria-pressed', String(d));
    dengar.setAttribute('aria-label', d ? TEKS_SUARA.dengarNyala : TEKS_SUARA.dengarMati);
    dengar.innerHTML = svgSpeaker(!d);
  };

  const klik = (e: MouseEvent) => {
    const b = (e.target as HTMLElement).closest<HTMLElement>('[data-suara]');
    if (!b) return;
    e.stopPropagation();
    if (b.dataset.suara === 'mic' && tekanLama) {
      tekanLama = false;
      return;
    }
    bunyi('klik');
    if (b.dataset.suara === 'lembar') return bukaLembarSuara(suara, alasanTolak);
    if (b.dataset.suara === 'dengar') return suara.aturDengar(!suara.dengarNyala);
    const alasan = alasanTolak();
    if (alasan) return toast(alasan, true);
    void suara.ketukMic();
  };
  const tekan = (e: PointerEvent) => {
    if (!(e.target as HTMLElement).closest('[data-suara="mic"]')) return;
    tekanLama = false;
    batalTekan();
    timer = setTimeout(() => {
      timer = null;
      tekanLama = true;
      bunyi('klik');
      bukaLembarSuara(suara, alasanTolak);
    }, LAMA_TEKAN_MS);
  };
  grup.addEventListener('click', klik);
  grup.addEventListener('pointerdown', tekan);
  grup.addEventListener('pointerup', batalTekan);
  grup.addEventListener('pointerleave', batalTekan);
  grup.addEventListener('pointercancel', batalTekan);
  grup.addEventListener('contextmenu', (e) => e.preventDefault());
  perbarui();
  let lepasDengar: () => void = () => undefined;
  const lepas = () => {
    batalTekan();
    lepasDengar();
    grup.removeEventListener('click', klik);
    grup.removeEventListener('pointerdown', tekan);
  };
  lepasDengar = suara.dengarkan(() => (grup.isConnected ? perbarui() : lepas()));
  return lepas;
}

/**
 * Ikon mic di samping nama kursi (`[data-mic-kursi="i"]` di dalam `akar`), diperbarui setiap keadaan suara
 * berubah. Mengembalikan pelepas; lepas sendiri kalau `akar` sudah tidak memuat ikon apa pun.
 */
export function pasangIkonKursi(akar: HTMLElement, suara: SuaraLangsung): () => void {
  const perbarui = () => {
    akar.querySelectorAll<HTMLElement>('[data-mic-kursi]').forEach((el) => {
      const k = suara.keadaanKursi(Number(el.dataset.micKursi));
      if (el.dataset.keadaan === (k ?? '')) return;
      el.dataset.keadaan = k ?? '';
      el.innerHTML = htmlIkonMic(k);
    });
  };
  perbarui();
  let lepas: () => void = () => undefined;
  lepas = suara.dengarkan(() => (akar.isConnected && akar.querySelector('[data-mic-kursi]') ? perbarui() : lepas()));
  return lepas;
}

/** Lembar "Suara": sakelar Mic dan Dengar suara, lalu teman yang ikut suara dengan Bisukan/Bunyikan. */
export function bukaLembarSuara(suara: SuaraLangsung, alasanTolak: () => string = () => ''): void {
  let lepas: () => void = () => undefined;
  bukaDialog(
    `<div class="kepala-dialog"><h2>${esc(TEKS_SUARA.judul)}</h2><button type="button" class="tombol-ikon hantu tutup-dialog" data-tutup aria-label="Tutup"><span aria-hidden="true">✕</span></button></div>
     <div class="isi-lembar-suara"></div>`,
    (dlg) => {
      const isi = dlg.querySelector<HTMLElement>('.isi-lembar-suara')!;
      const gambar = () => {
        const fokus = (document.activeElement as HTMLElement | null)?.dataset?.fokusSuara ?? null;
        const t = suara.tombolMic;
        const orang = suara.daftarOrang();
        const sakelar = (kunci: string, label: string, ket: string, nyala: boolean, ikon: string, sibuk = false) =>
          `<button type="button" class="sakelar-suara" data-lembar="${kunci}" data-fokus-suara="${kunci}" role="switch" aria-checked="${nyala}" ${sibuk ? 'aria-busy="true"' : ''}>
             <span class="ikon-sakelar" aria-hidden="true">${ikon}</span>
             <span class="teks-sakelar"><b>${esc(label)}</b><small>${esc(ket)}</small></span>
             <span class="tanda-sakelar" aria-hidden="true"></span>
           </button>`;
        isi.innerHTML = `
          ${suara.tingkat === 'jeda' ? `<p class="catatan-lemah" role="status">${esc(TEKS_SUARA.lemah)}</p>` : ''}
          ${suara.menungguKetuk ? `<button type="button" class="kecil" data-lembar="putar">${esc(TEKS_SUARA.ketuk)}</button>` : ''}
          <div class="deret-sakelar">
            ${sakelar('mic', TEKS_SUARA.mic, TEKS_SUARA.ketMic, t === 'nyala', svgMic(t !== 'nyala'), t === 'minta')}
            ${sakelar('dengar', TEKS_SUARA.dengar, TEKS_SUARA.ketDengar, suara.dengarNyala, svgSpeaker(!suara.dengarNyala))}
          </div>
          <h3>${esc(TEKS_SUARA.orang)}</h3>
          ${
            orang.length
              ? `<ul class="daftar daftar-suara">${orang
                  .map((o) => {
                    const ket = o.bisu
                      ? TEKS_SUARA.dibisukan
                      : o.sambungan === 'gagal'
                        ? TEKS_SUARA.gagal
                        : o.sambungan === 'menyambung' && o.keadaan !== 'mati' && o.keadaan !== 'lemah'
                          ? TEKS_SUARA.menyambung
                          : TEKS_SUARA.keadaan[o.keadaan];
                    return `<li class="kursi" data-keadaan="${o.keadaan}">${htmlIkonMic(o.keadaan)}<span class="nama"><b>${esc(o.nama)}</b><small class="redup">${esc(ket)}</small></span>
                      <button type="button" class="kecil" data-bisu="${esc(o.nama)}" data-fokus-suara="bisu-${o.id}" aria-pressed="${o.bisu}">${esc(o.bisu ? TEKS_SUARA.bunyikan : TEKS_SUARA.bisukan)}</button></li>`;
                  })
                  .join('')}</ul>`
              : `<p class="redup rapat">${esc(TEKS_SUARA.kosong)}</p>`
          }`;
        if (fokus && /^[\w-]+$/.test(fokus)) isi.querySelector<HTMLElement>(`[data-fokus-suara="${fokus}"]`)?.focus({ preventScroll: true });
      };
      isi.addEventListener('click', (e) => {
        const b = (e.target as HTMLElement).closest<HTMLElement>('[data-lembar], [data-bisu]');
        if (!b) return;
        bunyi('klik');
        if (b.dataset.bisu !== undefined) return suara.aturBisu(b.dataset.bisu, b.getAttribute('aria-pressed') !== 'true');
        if (b.dataset.lembar === 'dengar') return suara.aturDengar(!suara.dengarNyala);
        if (b.dataset.lembar === 'putar') return suara.ketukPutar();
        const alasan = alasanTolak();
        if (alasan) return toast(alasan, true);
        void suara.ketukMic();
      });
      gambar();
      lepas = suara.dengarkan(() => (dlg.isConnected ? gambar() : lepas()));
    },
    { kelas: 'lembar-suara', saatTutup: () => lepas() },
  );
}
