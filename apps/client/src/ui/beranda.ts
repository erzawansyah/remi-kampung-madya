// Layar beranda: "pintu masuk Kedai Madya".
// Hero dengan logo kedai dan kipas kartu, aksi utama (lanjutkan / main bareng warga kedai /
// latihan), pengaturan meja offline yang terlipat, main online dengan status koneksi, navigasi ke
// Bantuan/Pengaturan/Riwayat/Tentang, kartu info Kedai Madya, dan label versi. Juga layar daftar
// meja publik.
//
// "Warga kedai" = istilah untuk pemain komputer (kode tetap memakai 'bot').

import { rapikanLevel, type DataMeja, type PengaturanMeja, type RingkasanMeja } from '@remi/meja';
import { svgLogo } from '../aset/logoMadya';
import { gambarKartuKeKanvas, type KartuGambar } from '../game/kartuGrafisGambar';
import { htmlTautanKedai, KEDAI } from '../konten/kedai';
import { DAFTAR_LEVEL_WARGA, LEVEL_WARGA, labelLevelKecil } from '../konten/levelWarga';
import { aturPreferensi, preferensi, saatPreferensiBerubah } from '../preferensi';
import { simpan } from '../penyimpanan';
import { labelVersi } from '../versi';
import { esc, konfirmasi } from './dom';

/** Keadaan main online yang ditampilkan di beranda. */
export type StatusOnline = 'siap' | 'offline' | 'menyambung' | 'tersambung' | 'gagal';

export interface AksiBeranda {
  buatMeja(nama: string): void;
  gabung(nama: string, kode: string): void;
  lihatPublik(): void;
  lihatRiwayat(): void;
  mainOffline(nama: string, pengaturan: Partial<PengaturanMeja>, pengocokSaya: boolean): void;
  lanjutOffline(): void;
  /** Permainan latihan dengan panduan (tutorial). */
  latihan(nama: string): void;
  bantuan(): void;
  pengaturan(): void;
  tentang(): void;
  pasangAplikasi: (() => void) | null;
  /** Ada versi baru yang siap: muat ulang sekarang. Null kalau tidak ada. */
  muatUlang: (() => void) | null;
}

export interface OpsiBeranda {
  kodeAwal?: string;
  statusOnline?: StatusOnline;
}

export interface BerandaTerpasang {
  /**
   * Perbarui status main online tanpa menggambar ulang beranda (isian yang sedang diketik aman).
   * Status 'gagal' menampilkan pesan di dalam panel online (dekat tombol yang baru diketuk), plus
   * tombol "Coba lagi" bila `cobaLagi` diberikan.
   */
  aturStatusOnline(s: StatusOnline, cobaLagi?: (() => void) | null): void;
  /** Pesan gagal di panel online sedang terlihat di layar (tidak tergulir keluar). */
  pesanGagalTerlihat(): boolean;
  /** Munculkan/sembunyikan ubin "Pasang ke layar utama" tanpa menggambar ulang beranda. */
  aturPasang(pasang: (() => void) | null): void;
  /** Munculkan tombol "Ada versi baru · Muat ulang" di kaki beranda tanpa menggambar ulang. */
  aturMuatUlang(muatUlang: (() => void) | null): void;
  /** Pindahkan fokus keyboard ke ubin navigasi (mis. 'riwayat' sesudah kembali dari Riwayat). */
  fokusNav(nav: string): void;
  /** Beranda ditinggalkan: lepas pendengar global (preferensi untuk kipas kartu). Aman dipanggil berulang. */
  lepas(): void;
}

/** Kartu dekoratif di kipas hero: As dan Londo (gambar biasa, tidak terkait permainan mana pun). */
const KIPAS: KartuGambar[] = [
  { bunga: 'kriting', rank: 11 },
  { bunga: 'wajik', rank: 12 },
  { bunga: 'waru', rank: 1 },
  { bunga: 'love', rank: 13 },
  { bunga: 'love', rank: 1 },
];
/** Resolusi gambar kipas (px CSS); ukuran tampilnya diatur CSS (--lebar-kipas). */
const LEBAR_GAMBAR_KIPAS = 132;

const TEKS_STATUS: Record<StatusOnline, string> = {
  siap: '',
  offline: 'Kamu lagi offline',
  menyambung: 'Menyambung…',
  tersambung: 'Tersambung',
  gagal: 'Server belum bisa dihubungi',
};

const LABEL_TEMPO: Record<string, string> = { santai: 'santai', normal: 'tempo normal', cepat: 'cepat' };

function pengaturanTersimpan(): PengaturanMeja {
  const p: PengaturanMeja = {
    jumlahPemain: 4,
    duaDeckUntukEmpat: false,
    levelBot: 'normal',
    tempoBot: 'santai',
    batasPutaran: null,
    batasSkorAtas: null,
    batasSkorBawah: null,
    publik: false,
    detikGiliran: 0,
    ...simpan.pengaturanOffline(),
  };
  // Level yang tidak dikenal (simpanan rusak/versi lain) jadi 'normal', supaya pilihan dan ringkasan cocok.
  return { ...p, levelBot: rapikanLevel(p.levelBot) };
}

/** Pendengar preferensi kipas dari beranda yang terakhir digambar (dilepas saat beranda diganti). */
let lepasKipasLama: (() => void) | null = null;

/**
 * Ringkasan simpanan offline yang masih bisa dilanjutkan, atau null. `latihan` = simpanan itu
 * latihan dengan panduan (dilanjutkan lengkap dengan gelembung tutorial), bukan permainan biasa.
 */
export function infoSimpanan(): { teks: string; latihan: boolean } | null {
  const d: DataMeja | null = simpan.mejaOffline();
  if (!d || d.versi !== 1 || d.game?.status === 'selesai') return null;
  const latihan = simpan.latihanTersimpan();
  try {
    const n = d.pengaturan?.jumlahPemain ?? d.kursi?.length;
    const putaran = d.game?.putaran?.nomor ?? (d.game ? d.game.riwayat.length + 1 : 1);
    const skor = d.game?.skor?.[0];
    const bagian = [latihan ? 'dengan panduan' : `${n} pemain`, `putaran ${putaran}`, typeof skor === 'number' ? `skormu ${skor}` : ''];
    return { teks: bagian.filter(Boolean).join(' · '), latihan };
  } catch {
    return { teks: 'Tersimpan otomatis', latihan };
  }
}

/**
 * Gerbang sebelum permainan baru (main baru / latihan) menimpa slot simpanan offline.
 * Tanpa simpanan: langsung boleh. Ada simpanan: konfirmasi bahaya yang menyebut apa yang hilang.
 * Simpanan dibaca saat dipanggil, jadi aman dipakai dari mana saja (beranda, Pengaturan).
 */
export async function konfirmasiTimpaSimpanan(alasan: string): Promise<boolean> {
  const simpanan = infoSimpanan();
  if (!simpanan) return true;
  return konfirmasi({
    judul: 'Hapus permainan yang tersimpan?',
    pesan: `${alasan} ${simpanan.latihan ? 'Latihan' : 'Permainan offline'} yang tersimpan (${simpanan.teks}) bakal dihapus dan nggak bisa dilanjutkan lagi.`,
    ya: 'Hapus & mulai',
    tidak: 'Nggak jadi',
    bahaya: true,
  });
}

function ringkasMeja(p: Pick<PengaturanMeja, 'jumlahPemain' | 'levelBot' | 'tempoBot' | 'batasPutaran'>): string {
  return [
    `${p.jumlahPemain} pemain`,
    `lawan ${labelLevelKecil(rapikanLevel(p.levelBot))}`,
    LABEL_TEMPO[p.tempoBot] ?? p.tempoBot,
    p.batasPutaran ? `${p.batasPutaran} putaran` : 'tanpa batas putaran',
  ].join(' · ');
}

export function renderBeranda(akar: HTMLElement, aksi: AksiBeranda, opsi: OpsiBeranda = {}): BerandaTerpasang {
  // Beranda lama (kalau ada) pasti sudah diganti: jangan biarkan pendengarnya menumpuk.
  lepasKipasLama?.();
  lepasKipasLama = null;
  const p = pengaturanTersimpan();
  const simpanan = infoSimpanan();
  const riwayat = simpan.riwayat();
  const pemainBaru = !preferensi().tutorialSelesai && !riwayat.length && !simpanan;
  const pilihan = <T extends string | number>(nilai: T, opsiPilih: [T, string][]) =>
    opsiPilih.map(([v, label]) => `<option value="${v}" ${v === nilai ? 'selected' : ''}>${esc(label)}</option>`).join('');

  // Urutan DOM = urutan baca/fokus di HP: hero → (tawaran) → main → online → menu → kaki.
  // Dua kolom di layar lebar disusun lewat grid-area (layar.css), bukan dengan mengubah urutan.
  akar.innerHTML = `
  <div class="layar beranda">
    <div class="beranda-isi">
      <header class="beranda-hero">
        <div class="kipas" aria-hidden="true"></div>
        ${svgLogo('lengkap', { kelas: 'hero-logo', label: 'Kedai Madya' })}
        <p class="hero-sapa">Monggo mampir, warga</p>
        <h1 class="hero-judul">Remi Kampung Madya</h1>
        <p class="hero-tagline">Remi aturan tongkrongan Kedai Madya, versi online.</p>
      </header>

      <div class="beranda-aksi">
        ${
          pemainBaru
            ? `<aside class="kartu-panel tawaran-latihan" aria-labelledby="judul-tawaran">
                 <h2 id="judul-tawaran">Warga baru, ya?</h2>
                 <p>Aturan main di Kedai Madya beda dari remi yang umum. Latihan satu putaran dulu, dipandu pelan-pelan.</p>
                 <div class="deret">
                   <button type="button" class="utama" data-latihan>Latihan dulu</button>
                   <button type="button" class="hantu" id="tawaran-nanti">Nanti saja</button>
                 </div>
               </aside>`
            : ''
        }

        <section class="kartu-panel panel-main" aria-labelledby="judul-main">
          <h2 id="judul-main">Main sekarang</h2>
          <label class="medan" for="nama">Nama kamu
            <input type="text" id="nama" maxlength="16" placeholder="misal: Budi" value="${esc(simpan.nama())}" autocomplete="nickname" enterkeyhint="done" />
          </label>
          ${
            simpanan
              ? `<button type="button" class="utama besar penuh tombol-dua-baris" id="lanjut">
                   <span>${simpanan.latihan ? 'Lanjutkan latihan' : 'Lanjutkan permainan'}</span><small>${esc(simpanan.teks)}</small>
                 </button>`
              : ''
          }
          <button type="button" class="${simpanan ? '' : 'utama besar '}penuh tombol-dua-baris" id="mulai-bot">
            <span>${simpanan ? 'Main baru bareng warga kedai' : 'Main bareng warga kedai'}</span><small id="ringkas-meja">${esc(ringkasMeja(p))}</small>
          </button>
          <details class="akordion atur-meja">
            <summary>Atur meja</summary>
            <div class="isi-atur">
              <label class="baris">Jumlah pemain
                <select id="o-jumlah">${pilihan(p.jumlahPemain, [2, 3, 4, 5, 6].map((n) => [n, String(n)]))}</select></label>
              <label class="baris" id="o-dua-baris">Pakai 2 deck (12 kartu)<input type="checkbox" id="o-dua" ${p.duaDeckUntukEmpat ? 'checked' : ''} /></label>
              <label class="baris">Level warga kedai
                <select id="o-level" aria-describedby="ket-level">${pilihan(
                  p.levelBot,
                  DAFTAR_LEVEL_WARGA.map((l) => [l.level, l.pilihan]),
                )}</select></label>
              <p class="bantuan rapat" id="ket-level">${esc(LEVEL_WARGA[p.levelBot].ket)}</p>
              <label class="baris">Tempo warga kedai
                <select id="o-tempo">${pilihan(p.tempoBot, [
                  ['santai', 'Santai'],
                  ['normal', 'Normal'],
                  ['cepat', 'Cepat'],
                ])}</select></label>
              <label class="baris">Batas putaran
                <select id="o-putaran">${pilihan(p.batasPutaran ?? 0, [3, 5, 10, 15, 20, 0].map((n) => [n, n ? String(n) : 'Tanpa batas']))}</select></label>
              <label class="baris">Batas skor ±500<input type="checkbox" id="o-skor" ${p.batasSkorAtas === null ? '' : 'checked'} /></label>
              <label class="baris">Pengocok pertama
                <select id="o-kocok"><option value="acak">Acak</option><option value="saya">Saya</option></select></label>
            </div>
          </details>
          <button type="button" class="hantu penuh${pemainBaru ? ' tersembunyi' : ''}" id="latihan" data-latihan>🎓 Latihan dengan panduan</button>
        </section>

        <section class="kartu-panel panel-online" aria-labelledby="judul-online">
          <div class="kepala-panel">
            <h2 id="judul-online">Main online</h2>
            <span class="lencana status-online" id="status-online"></span>
          </div>
          <div class="info-gagal tersembunyi" id="info-gagal">
            <span>Server-nya belum bisa dihubungi, Bos.</span>
            <button type="button" class="kecil" id="coba-lagi">Coba lagi</button>
          </div>
          <p class="redup rapat">Main bareng teman pakai kode meja atau link undangan.</p>
          <button type="button" class="penuh" id="buat">Buat meja baru</button>
          <div class="gabung-deret">
            <input type="text" id="kode" class="input-kode" maxlength="5" placeholder="KODE" aria-label="Kode meja (5 karakter)" value="${esc(opsi.kodeAwal ?? '')}" autocomplete="off" autocapitalize="characters" spellcheck="false" enterkeyhint="go" />
            <button type="button" id="gabung">Gabung</button>
          </div>
          <button type="button" class="hantu penuh" id="publik">Cari meja publik</button>
        </section>
      </div>

      <div class="beranda-sisi">
        <nav class="beranda-nav" aria-label="Menu lain">
          <button type="button" class="nav-ubin" data-nav="bantuan"><span class="nav-ikon" aria-hidden="true">📖</span><span>Bantuan &amp; aturan</span></button>
          <button type="button" class="nav-ubin" data-nav="pengaturan"><span class="nav-ikon" aria-hidden="true">⚙️</span><span>Pengaturan</span></button>
          <button type="button" class="nav-ubin" data-nav="riwayat"><span class="nav-ikon" aria-hidden="true">🏆</span><span>Riwayat &amp; statistik</span></button>
          <button type="button" class="nav-ubin" data-nav="tentang"><span class="nav-ikon" aria-hidden="true">ℹ️</span><span>Tentang</span></button>
        </nav>

        <section class="kartu-kedai" aria-labelledby="judul-kedai">
          <div class="kedai-kepala">
            ${svgLogo('maskot', { kelas: 'kedai-logo' })}
            <div>
              <h2 id="judul-kedai">Main bareng di Kedai Madya</h2>
              <p class="kedai-bio">${esc(KEDAI.bio)}</p>
            </div>
          </div>
          <p>Aturan remi di sini datang dari meja Kedai Madya. Kalau lagi di Batu atau Malang, mampir dan main langsung di sana.</p>
          <p class="kedai-alamat"><span aria-hidden="true">📍</span> ${esc(KEDAI.alamatSingkat)}</p>
          ${htmlTautanKedai()}
          <p class="kedai-catatan">${esc(KEDAI.catatanBuku)} ${esc(KEDAI.catatanJam)}</p>
          <p class="kedai-catatan kedai-offline tersembunyi" id="kedai-offline">${esc(KEDAI.catatanOffline)}</p>
        </section>

        <footer class="beranda-kaki">
          <span class="angka">${esc(labelVersi())}</span>
          <span class="kaki-kanan"></span>
        </footer>
      </div>
    </div>
  </div>`;

  const el = <T extends HTMLElement>(id: string) => akar.querySelector<T>(`#${id}`);
  const nama = () => {
    const n = el<HTMLInputElement>('nama')!.value.trim();
    simpan.setNama(n);
    return n || 'Pemain';
  };
  el('nama')!.addEventListener('change', () => nama());

  // ---------- kipas kartu ----------
  const kipas = akar.querySelector<HTMLElement>('.kipas')!;
  const gambarKipas = () =>
    kipas.replaceChildren(
      ...KIPAS.map((k, i) => {
        const c = gambarKartuKeKanvas(k, LEBAR_GAMBAR_KIPAS);
        c.removeAttribute('style');
        c.removeAttribute('role');
        c.removeAttribute('aria-label');
        c.style.setProperty('--i', String(i - (KIPAS.length - 1) / 2));
        return c;
      }),
    );
  gambarKipas();
  let warnaKipas = preferensi().warnaKartu;
  let lepasPref: (() => void) | null = null;
  const lepas = () => {
    lepasPref?.();
    lepasPref = null;
    if (lepasKipasLama === lepas) lepasKipasLama = null;
  };
  lepasPref = saatPreferensiBerubah((pref) => {
    // Cadangan: beranda sudah diganti layar lain tanpa lepas() dipanggil.
    if (!kipas.isConnected) return lepas();
    if (pref.warnaKartu !== warnaKipas) {
      warnaKipas = pref.warnaKartu;
      gambarKipas();
    }
  });
  lepasKipasLama = lepas;

  // ---------- main offline ----------
  const jumlah = el<HTMLSelectElement>('o-jumlah')!;
  const bacaPengaturan = (): Partial<PengaturanMeja> => {
    const n = Number(jumlah.value);
    const skor = el<HTMLInputElement>('o-skor')!.checked;
    return {
      jumlahPemain: n,
      duaDeckUntukEmpat: n === 4 && el<HTMLInputElement>('o-dua')!.checked,
      levelBot: rapikanLevel(el<HTMLSelectElement>('o-level')!.value),
      tempoBot: el<HTMLSelectElement>('o-tempo')!.value as PengaturanMeja['tempoBot'],
      batasPutaran: Number(el<HTMLSelectElement>('o-putaran')!.value) || null,
      batasSkorAtas: skor ? 500 : null,
      batasSkorBawah: skor ? -500 : null,
    };
  };
  const perbaruiAtur = () => {
    el('o-dua-baris')!.classList.toggle('tersembunyi', jumlah.value !== '4');
    const baru = bacaPengaturan();
    simpan.setPengaturanOffline(baru);
    el('ringkas-meja')!.textContent = ringkasMeja({ ...p, ...baru });
    el('ket-level')!.textContent = LEVEL_WARGA[rapikanLevel(baru.levelBot)].ket;
  };
  akar.querySelector('.isi-atur')!.addEventListener('change', perbaruiAtur);
  el('o-dua-baris')!.classList.toggle('tersembunyi', jumlah.value !== '4');

  /** Permainan baru menimpa simpanan offline: minta konfirmasi dulu kalau ada. */
  const bolehTimpa = konfirmasiTimpaSimpanan;

  el('lanjut')?.addEventListener('click', () => {
    nama();
    aksi.lanjutOffline();
  });
  el('mulai-bot')!.addEventListener('click', async () => {
    if (!(await bolehTimpa('Main baru pakai slot simpanan yang sama.'))) return;
    const pengaturan = bacaPengaturan();
    simpan.setPengaturanOffline(pengaturan);
    aksi.mainOffline(nama(), pengaturan, el<HTMLSelectElement>('o-kocok')!.value === 'saya');
  });
  akar.querySelectorAll('[data-latihan]').forEach((b) =>
    b.addEventListener('click', async () => {
      if (!(await bolehTimpa('Latihan pakai slot simpanan yang sama.'))) return;
      aksi.latihan(nama());
    }),
  );
  el('tawaran-nanti')?.addEventListener('click', () => {
    // Tidak memaksa: tawaran disembunyikan, tombol latihan tetap ada di panel main.
    aturPreferensi({ tutorialSelesai: true });
    akar.querySelector('.tawaran-latihan')?.remove();
    el('latihan')!.classList.remove('tersembunyi');
    el('nama')!.focus();
  });

  // ---------- main online ----------
  const tombolOnline = ['buat', 'gabung', 'publik'].map((id) => el<HTMLButtonElement>(id)!);
  const kodeEl = el<HTMLInputElement>('kode')!;
  const sibuk = (b: HTMLElement) => {
    tombolOnline.forEach((x) => x.removeAttribute('aria-busy'));
    b.setAttribute('aria-busy', 'true');
  };
  const gabung = () => {
    sibuk(el('gabung')!);
    aksi.gabung(nama(), kodeEl.value);
  };
  el('buat')!.addEventListener('click', () => {
    sibuk(el('buat')!);
    aksi.buatMeja(nama());
  });
  el('gabung')!.addEventListener('click', gabung);
  kodeEl.addEventListener('input', () => {
    // Kode meja: huruf besar dan angka saja.
    const rapi = kodeEl.value.toUpperCase().replace(/[^A-Z0-9]/g, '');
    if (rapi !== kodeEl.value) kodeEl.value = rapi;
  });
  kodeEl.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') gabung();
  });
  el('publik')!.addEventListener('click', () => {
    sibuk(el('publik')!);
    nama();
    aksi.lihatPublik();
  });

  const statusEl = el('status-online')!;
  const infoGagalEl = el('info-gagal')!;
  const cobaLagiEl = el<HTMLButtonElement>('coba-lagi')!;
  let cobaLagi: (() => void) | null = null;
  cobaLagiEl.addEventListener('click', () => {
    const f = cobaLagi;
    if (!f) return;
    // Fokus pindah ke tombol "Buat meja baru" dulu supaya tidak hilang saat pesan disembunyikan.
    tombolOnline[0]!.focus({ preventScroll: true });
    f();
  });
  const kedaiOfflineEl = el('kedai-offline')!;
  const aturStatusOnline = (s: StatusOnline, ulang: (() => void) | null = null) => {
    const offline = s === 'offline';
    kedaiOfflineEl.classList.toggle('tersembunyi', !offline);
    statusEl.textContent = TEKS_STATUS[s];
    statusEl.className = `lencana status-online ${s === 'gagal' ? 'merah' : s === 'tersambung' ? 'hijau' : s === 'offline' ? 'garis' : ''}`;
    statusEl.classList.toggle('tersembunyi', s === 'siap');
    cobaLagi = s === 'gagal' ? ulang : null;
    infoGagalEl.classList.toggle('tersembunyi', s !== 'gagal');
    cobaLagiEl.classList.toggle('tersembunyi', !cobaLagi);
    tombolOnline.forEach((b) => {
      b.disabled = offline;
      if (s !== 'menyambung') b.removeAttribute('aria-busy');
    });
  };
  aturStatusOnline(opsi.statusOnline ?? (navigator.onLine ? 'siap' : 'offline'));

  // ---------- navigasi ----------
  let pasangAplikasi = aksi.pasangAplikasi;
  let muatUlang = aksi.muatUlang;
  // Satu pendengar untuk semua [data-nav], termasuk tombol yang disisipkan belakangan.
  akar.querySelector('.beranda-sisi')!.addEventListener('click', (e) => {
    const b = (e.target as Element | null)?.closest<HTMLElement>('[data-nav]');
    if (!b) return;
    switch (b.dataset.nav) {
      case 'bantuan':
        return aksi.bantuan();
      case 'pengaturan':
        return aksi.pengaturan();
      case 'riwayat':
        return aksi.lihatRiwayat();
      case 'tentang':
        return aksi.tentang();
      case 'pasang':
        return pasangAplikasi?.();
      case 'muat-ulang':
        return muatUlang?.();
    }
  });

  const nav = akar.querySelector<HTMLElement>('.beranda-nav')!;
  const aturPasang = (f: (() => void) | null) => {
    pasangAplikasi = f;
    const ada = nav.querySelector<HTMLElement>('[data-nav=pasang]');
    if (!f) {
      // Jangan buang fokus ke <body>: pindahkan dulu ke ubin lain.
      if (ada && ada === document.activeElement) nav.querySelector<HTMLElement>('[data-nav=bantuan]')?.focus();
      ada?.remove();
      return;
    }
    if (ada) return;
    nav.insertAdjacentHTML(
      'beforeend',
      '<button type="button" class="nav-ubin nav-lebar" data-nav="pasang"><span class="nav-ikon" aria-hidden="true">📲</span><span>Pasang ke layar utama</span></button>',
    );
  };
  const kakiKanan = akar.querySelector<HTMLElement>('.kaki-kanan')!;
  const aturMuatUlang = (f: (() => void) | null) => {
    muatUlang = f;
    const ada = kakiKanan.querySelector('[data-nav=muat-ulang]');
    if (!!f === !!ada && kakiKanan.firstChild) return;
    kakiKanan.innerHTML = f
      ? '<button type="button" class="kecil utama" data-nav="muat-ulang">Ada versi baru · Muat ulang</button>'
      : '<span>Dibuat di Kedai Madya · Batu mepet Mlg</span>';
  };
  aturPasang(aksi.pasangAplikasi);
  aturMuatUlang(aksi.muatUlang);

  const fokusNav = (n: string) => nav.querySelector<HTMLElement>(`[data-nav="${n.replace(/[^a-z-]/gi, '')}"]`)?.focus();

  const pesanGagalTerlihat = () => {
    if (infoGagalEl.classList.contains('tersembunyi') || !infoGagalEl.isConnected) return false;
    const r = infoGagalEl.getBoundingClientRect();
    return r.height > 0 && r.top >= 0 && r.bottom <= window.innerHeight;
  };

  return { aturStatusOnline, pesanGagalTerlihat, aturPasang, aturMuatUlang, fokusNav, lepas };
}

export function renderDaftarPublik(
  akar: HTMLElement,
  daftar: RingkasanMeja[],
  gabung: (kode: string) => void,
  segarkan: () => void,
  kembali: () => void,
) {
  akar.innerHTML = `
  <div class="layar layar-publik"><div class="kolom">
    <div class="judul"><h1>Meja publik</h1><p>Meja yang masih menunggu pemain.</p></div>
    <div class="kartu-panel daftar-meja">
      ${
        daftar.length
          ? `<ul class="daftar">${daftar
              .map(
                (m) => `<li><button type="button" class="daftar-item kursi" data-kode="${esc(m.kode)}" aria-label="Gabung meja ${esc(m.namaHost)}, kode ${esc(m.kode)}, ${m.terisi} dari ${m.jumlahPemain} kursi terisi">
                  <span class="nama"><b>${esc(m.namaHost)}</b> · <span class="angka">${esc(m.kode)}</span></span>
                  <span class="lencana">${m.terisi}/${m.jumlahPemain}</span><span class="lencana emas">Gabung</span></button></li>`,
              )
              .join('')}</ul>`
          : '<p class="redup rapat">Belum ada meja publik. Buat meja sendiri lalu centang "Meja publik" di lobi.</p>'
      }
    </div>
    <div class="deret"><button type="button" id="segarkan">Segarkan</button><button type="button" id="kembali">← Kembali</button></div>
  </div></div>`;
  akar.querySelectorAll<HTMLElement>('[data-kode]').forEach((b) => b.addEventListener('click', () => gabung(b.dataset.kode!)));
  akar.querySelector('#kembali')!.addEventListener('click', kembali);
  akar.querySelector('#segarkan')!.addEventListener('click', segarkan);
}
