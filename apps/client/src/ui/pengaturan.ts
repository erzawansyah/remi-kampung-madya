// Jendela Pengaturan (suara, musik, getar, gerak, kecepatan animasi, tampilan, tempo warga kedai).
// Semua murni presentasi di HP ini: tidak ada yang menyentuh aturan main.
// Setiap perubahan langsung diterapkan dan disimpan lewat aturPreferensi().

import '../gaya/jendela.css';
import type { TempoBot } from '@remi/meja';
import type { Bunga, Rank } from '@remi/engine';
import { gambarKartuKeKanvas } from '../game/kartuGrafisGambar';
import { bunyi, getar, getarDidukung } from '../efek/suara';
import { aturPreferensi, gerakDikurangi, preferensi, PREFERENSI_BAWAAN, saatPreferensiBerubah, type Preferensi } from '../preferensi';
import { bukaDialog, esc, konfirmasi, toast } from './dom';

export interface OpsiPengaturan {
  /** Dibuka dari dalam meja (menu ☰). */
  diMeja?: boolean;
  /** Tempo bot meja saat ini; hanya diisi bila pemain boleh mengubahnya (host / offline). */
  tempoBot?: { nilai: TempoBot; ubah: (t: TempoBot) => void };
  /**
   * Opsional (beranda): mulai permainan latihan. Kalau ada, "Ulangi tutorial" menawarkan
   * langsung latihan; kalau tidak, tutorial cukup ditandai belum selesai.
   */
  mulaiLatihan?: () => void;
  /**
   * Opsional: gerbang sebelum latihan dimulai (mis. konfirmasi bahaya kalau ada permainan offline
   * tersimpan yang bakal tertimpa). False = batal, jendela Pengaturan tetap terbuka.
   */
  bolehLatihan?: () => Promise<boolean>;
}

type KunciPilihan = 'gerak' | 'kecepatan' | 'efek' | 'warnaKartu' | 'ukuranTeks';
type KunciSaklar = 'suara' | 'musik' | 'getar';
type KunciVolume = 'volumeEfek' | 'volumeMusik';

const PILIHAN: Record<KunciPilihan, { label: string; bantuan: string; opsi: [string, string][] }> = {
  gerak: {
    label: 'Gerak',
    bantuan: 'Kurangi = tanpa goyang layar dan lintasan melengkung, animasi lebih singkat.',
    opsi: [
      ['ikutSistem', 'Ikut sistem'],
      ['penuh', 'Penuh'],
      ['kurang', 'Kurangi'],
    ],
  },
  kecepatan: {
    label: 'Kecepatan animasi',
    bantuan: 'Seberapa cepat kartu terbang dan dibagikan.',
    opsi: [
      ['santai', 'Santai'],
      ['normal', 'Normal'],
      ['cepat', 'Cepat'],
    ],
  },
  efek: {
    label: 'Efek visual',
    bantuan: 'Hemat = tanpa partikel dan kilau, lebih ringan untuk HP lama.',
    opsi: [
      ['lengkap', 'Lengkap'],
      ['hemat', 'Hemat'],
    ],
  },
  warnaKartu: {
    label: 'Warna kartu',
    bantuan: 'Empat warna: tiap bunga beda warna, lebih gampang dibedakan.',
    opsi: [
      ['dua', 'Dua warna'],
      ['empat', 'Empat warna'],
    ],
  },
  ukuranTeks: {
    label: 'Ukuran teks',
    bantuan: 'Membesarkan semua tulisan di tombol, panel, dan jendela.',
    opsi: [
      ['normal', 'Normal'],
      ['besar', 'Besar'],
    ],
  },
};

const TEMPO: [TempoBot, string][] = [
  ['santai', 'Santai'],
  ['normal', 'Normal'],
  ['cepat', 'Cepat'],
];

/** Kartu pratinjau warna: satu per bunga. Kartu dekoratif biasa, tidak terkait meja mana pun. */
const PRATINJAU: { bunga: Bunga; rank: Rank }[] = [
  { bunga: 'love', rank: 1 },
  { bunga: 'wajik', rank: 10 },
  { bunga: 'kriting', rank: 13 },
  { bunga: 'waru', rank: 12 },
];

function htmlSegmen(id: string, opsi: [string, string][], data: string): string {
  return `<div class="segmen penuh" role="radiogroup" aria-labelledby="${id}" ${data}>
    ${opsi.map(([nilai, teks]) => `<button type="button" role="radio" aria-checked="false" tabindex="-1" data-nilai="${esc(nilai)}">${esc(teks)}</button>`).join('')}
  </div>`;
}

function htmlBarisPilihan(k: KunciPilihan): string {
  const p = PILIHAN[k];
  return `<div class="atur-blok">
    <span class="atur-label" id="lbl-${k}">${esc(p.label)}</span>
    ${htmlSegmen(`lbl-${k}`, p.opsi, `data-pilihan="${k}"`)}
    <small class="bantuan" ${k === 'gerak' ? 'data-ket-gerak' : ''}>${esc(p.bantuan)}</small>
    ${k === 'warnaKartu' ? '<div class="pratinjau-warna" aria-hidden="true"></div>' : ''}
  </div>`;
}

function htmlSaklar(k: KunciSaklar, label: string, ket: string): string {
  return `<div class="atur-baris">
    <label for="p-${k}" id="lbl-${k}"><span>${esc(label)}</span><small class="bantuan">${esc(ket)}</small></label>
    <button type="button" id="p-${k}" class="saklar" role="switch" aria-checked="false" aria-labelledby="lbl-${k}" data-saklar="${k}"></button>
  </div>`;
}

function htmlVolume(k: KunciVolume, label: string): string {
  return `<div class="atur-volume" data-wadah-volume="${k}">
    <label for="p-${k}">${esc(label)}</label>
    <input type="range" id="p-${k}" min="0" max="100" step="5" data-volume="${k}" />
    <output for="p-${k}" class="angka" data-keluaran="${k}"></output>
  </div>`;
}

export function bukaPengaturan(opsi: OpsiPengaturan = {}): void {
  const ada = document.querySelector<HTMLElement>('.dialog.pengaturan');
  if (ada) return ada.focus();
  const bisaGetar = getarDidukung();
  let lepas = () => {};

  bukaDialog(
    `<div class="kepala-dialog">
       <h2>Pengaturan</h2>
       <button type="button" class="tombol-ikon hantu tutup-dialog" data-tutup aria-label="Tutup">✕</button>
     </div>
     <p class="redup rapat">Berlaku di HP ini saja dan langsung tersimpan. Aturan main nggak berubah.</p>

     <p class="kelompok-judul" id="kel-suara">Suara</p>
     <div class="panel-terang" role="group" aria-labelledby="kel-suara">
       ${htmlSaklar('suara', 'Efek suara', 'Bunyi kartu, sorakan, dan tanda giliran.')}
       ${htmlVolume('volumeEfek', 'Volume efek')}
       ${htmlSaklar('musik', 'Musik latar', 'Musik santai ala warung, pelan.')}
       ${htmlVolume('volumeMusik', 'Volume musik')}
       ${bisaGetar ? htmlSaklar('getar', 'Getar', 'HP bergetar saat giliranmu dan kejadian penting.') : ''}
     </div>
     ${bisaGetar ? '' : '<p class="bantuan rapat">Getar nggak didukung di HP atau browser ini.</p>'}

     <p class="kelompok-judul" id="kel-gerak">Gerak &amp; animasi</p>
     <div class="panel-terang" role="group" aria-labelledby="kel-gerak">
       ${htmlBarisPilihan('gerak')}
       ${htmlBarisPilihan('kecepatan')}
       ${htmlBarisPilihan('efek')}
     </div>

     <p class="kelompok-judul" id="kel-tampilan">Tampilan</p>
     <div class="panel-terang" role="group" aria-labelledby="kel-tampilan">
       ${htmlBarisPilihan('warnaKartu')}
       ${htmlBarisPilihan('ukuranTeks')}
     </div>

     ${
       opsi.tempoBot
         ? `<p class="kelompok-judul" id="kel-meja">Meja ini</p>
            <div class="panel-terang" role="group" aria-labelledby="kel-meja">
              <div class="atur-blok">
                <span class="atur-label" id="lbl-tempo">Tempo warga kedai</span>
                ${htmlSegmen('lbl-tempo', TEMPO, 'data-tempo')}
                <small class="bantuan">Seberapa lama warga kedai "mikir" sebelum jalan.</small>
              </div>
            </div>`
         : ''
     }

     <p class="kelompok-judul" id="kel-lain">Lainnya</p>
     <div class="panel-terang" role="group" aria-labelledby="kel-lain">
       <div class="atur-baris">
         <span><span>Tutorial</span><small class="bantuan">Latihan satu putaran sambil dipandu.</small></span>
         <button type="button" class="kecil" data-ulang-tutorial>Ulangi tutorial</button>
       </div>
       <div class="atur-baris">
         <span><span>Pengaturan bawaan</span><small class="bantuan">Kembalikan semua pilihan di atas.</small></span>
         <button type="button" class="kecil" data-bawaan>Kembalikan</button>
       </div>
     </div>

     <div class="kaki-dialog"><button type="button" class="utama" data-tutup>Selesai</button></div>`,
    (d, tutup) => {
      const segarkan = (p: Preferensi = preferensi()) => {
        d.querySelectorAll<HTMLElement>('[data-saklar]').forEach((b) => {
          b.setAttribute('aria-checked', String(p[b.dataset.saklar as KunciSaklar]));
        });
        d.querySelectorAll<HTMLInputElement>('[data-volume]').forEach((r) => {
          const k = r.dataset.volume as KunciVolume;
          const persen = Math.round(p[k] * 100);
          // Jangan ganggu penggeser yang sedang digeser.
          if (document.activeElement !== r) r.value = String(persen);
          r.style.setProperty('--isi', `${persen}%`);
          r.setAttribute('aria-valuetext', `${persen} persen`);
          d.querySelector(`[data-keluaran="${k}"]`)!.textContent = `${persen}%`;
          const nyala = k === 'volumeEfek' ? p.suara : p.musik;
          d.querySelector(`[data-wadah-volume="${k}"]`)!.classList.toggle('mati', !nyala);
        });
        d.querySelectorAll<HTMLElement>('[data-pilihan]').forEach((g) => pilihSegmen(g, String(p[g.dataset.pilihan as KunciPilihan])));
        const ketGerak = d.querySelector<HTMLElement>('[data-ket-gerak]');
        if (ketGerak && p.gerak === 'ikutSistem') {
          ketGerak.textContent = `${PILIHAN.gerak.bantuan} Setelan HP-mu sekarang: ${gerakDikurangi(p) ? 'gerak dikurangi' : 'gerak penuh'}.`;
        } else if (ketGerak) ketGerak.textContent = PILIHAN.gerak.bantuan;
        gambarPratinjau();
      };

      // Pratinjau warna kartu: gambar ulang hanya kalau modenya berubah.
      const pratinjau = d.querySelector<HTMLElement>('.pratinjau-warna');
      let modePratinjau = '';
      const gambarPratinjau = () => {
        if (!pratinjau || modePratinjau === preferensi().warnaKartu) return;
        modePratinjau = preferensi().warnaKartu;
        pratinjau.replaceChildren(
          ...PRATINJAU.map((k) => {
            const c = gambarKartuKeKanvas(k, 52);
            c.setAttribute('aria-hidden', 'true');
            return c;
          }),
        );
      };

      // Saklar
      d.querySelectorAll<HTMLElement>('[data-saklar]').forEach((b) =>
        b.addEventListener('click', () => {
          const k = b.dataset.saklar as KunciSaklar;
          const nyala = !preferensi()[k];
          aturPreferensi({ [k]: nyala });
          if (nyala && k === 'suara') bunyi('notifikasi');
          if (nyala && k === 'getar') getar('notifikasi');
        }),
      );

      // Penggeser volume: berubah langsung saat digeser, contoh bunyi saat dilepas.
      d.querySelectorAll<HTMLInputElement>('[data-volume]').forEach((r) => {
        const k = r.dataset.volume as KunciVolume;
        r.addEventListener('input', () => aturPreferensi({ [k]: Number(r.value) / 100 }));
        r.addEventListener('change', () => {
          if (k === 'volumeEfek') {
            if (!preferensi().suara) aturPreferensi({ suara: true });
            bunyi('kartu');
          } else if (!preferensi().musik && Number(r.value) > 0) aturPreferensi({ musik: true });
        });
      });

      // Pilihan segmen (radiogroup): klik, atau panah kiri/kanan.
      d.querySelectorAll<HTMLElement>('[data-pilihan]').forEach((g) =>
        pasangSegmen(g, (nilai) => aturPreferensi({ [g.dataset.pilihan as KunciPilihan]: nilai } as Partial<Preferensi>)),
      );
      const tempo = d.querySelector<HTMLElement>('[data-tempo]');
      if (tempo && opsi.tempoBot) {
        const t = opsi.tempoBot;
        pilihSegmen(tempo, t.nilai);
        pasangSegmen(tempo, (nilai) => {
          pilihSegmen(tempo, nilai);
          t.ubah(nilai as TempoBot);
        });
      }

      d.querySelector('[data-ulang-tutorial]')!.addEventListener('click', async () => {
        aturPreferensi({ tutorialSelesai: false });
        if (!opsi.mulaiLatihan) {
          // Dari dalam meja: latihan tidak bisa dimulai di sini. Beranda menampilkan tombol
          // "🎓 Latihan dengan panduan", atau (pemain tanpa riwayat/simpanan) kartu tawaran "Latihan dulu";
          // dua-duanya diawali "Latihan", jadi arahkan ke situ tanpa menjanjikan tawaran otomatis.
          toast('Sip. Latihan dengan panduan dimulai dari beranda: balik ke beranda, lalu tekan tombol Latihan.', false, 6000);
          return;
        }
        const mulai = await konfirmasi({
          judul: 'Latihan sekarang?',
          pesan: 'Satu putaran bareng warga kedai level mudah, sambil dipandu langkah demi langkah.',
          ya: 'Ayo latihan',
          tidak: 'Nanti saja',
        });
        if (!mulai) return;
        // Latihan memakai slot simpanan offline: jangan sampai permainan lama hilang diam-diam.
        if (opsi.bolehLatihan && !(await opsi.bolehLatihan())) return;
        tutup();
        opsi.mulaiLatihan();
      });

      d.querySelector('[data-bawaan]')!.addEventListener('click', async () => {
        const ya = await konfirmasi({
          judul: 'Kembalikan pengaturan bawaan?',
          pesan: 'Suara, musik, getar, gerak, dan tampilan kembali seperti semula.',
          ya: 'Kembalikan',
          bahaya: true,
        });
        if (!ya) return;
        // Status tutorial bukan pengaturan, jadi tidak ikut dikembalikan.
        const { tutorialSelesai: _abaikan, ...bawaan } = PREFERENSI_BAWAAN;
        aturPreferensi(bawaan);
        toast('Pengaturan kembali ke bawaan.');
      });

      lepas = saatPreferensiBerubah((p) => segarkan(p));
      segarkan();
    },
    { kelas: 'pengaturan', saatTutup: () => lepas() },
  );
}

/** Tandai pilihan aktif di segmen (aria-checked + roving tabindex). */
function pilihSegmen(grup: HTMLElement, nilai: string): void {
  grup.querySelectorAll<HTMLElement>('[role=radio]').forEach((b) => {
    const aktif = b.dataset.nilai === nilai;
    b.setAttribute('aria-checked', String(aktif));
    b.tabIndex = aktif ? 0 : -1;
  });
}

/** Klik memilih; panah kiri/kanan (atas/bawah) pindah dan langsung memilih, seperti radio asli. */
function pasangSegmen(grup: HTMLElement, pilih: (nilai: string) => void): void {
  const tombol = [...grup.querySelectorAll<HTMLElement>('[role=radio]')];
  tombol.forEach((b, i) => {
    b.addEventListener('click', () => pilih(b.dataset.nilai!));
    b.addEventListener('keydown', (e) => {
      const maju = e.key === 'ArrowRight' || e.key === 'ArrowDown';
      const mundur = e.key === 'ArrowLeft' || e.key === 'ArrowUp';
      if (!maju && !mundur && e.key !== 'Home' && e.key !== 'End') return;
      e.preventDefault();
      const j =
        e.key === 'Home' ? 0 : e.key === 'End' ? tombol.length - 1 : (i + (maju ? 1 : -1) + tombol.length) % tombol.length;
      const sasaran = tombol[j]!;
      pilih(sasaran.dataset.nilai!);
      sasaran.focus();
    });
  });
}
