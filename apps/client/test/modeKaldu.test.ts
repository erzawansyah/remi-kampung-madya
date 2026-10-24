// @vitest-environment happy-dom
// Mode kaldu (keputusan pemilik #42, #43) di layar persiapan: kotak centang di Atur meja offline
// (beranda) dan lobi online (hanya host yang bisa mengubah), isian batas skor disembunyikan selama
// mode kaldu nyala (angkanya tetap disimpan; Meja yang mengirim batas skor kosong ke engine),
// ringkasan meja, simpanan yang rusak, dan latihan yang selalu tanpa mode kaldu.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.hoisted(() => {
  Object.assign(globalThis, { __VERSI_APP__: '0.0.0', __BUILD_SHA__: 'dev', __BUILD_WAKTU__: '2026-10-12T00:00:00.000Z' });
});

import { Meja, validasiPengaturan, type DataMeja, type InfoMeja, type PesanKlien, type PesanServer } from '@remi/meja';
import { KoneksiOffline } from '../src/koneksi';
import { BAB_BANTUAN } from '../src/konten/bantuan';
import { TEKS_KALDU } from '../src/konten/kaldu';
import { PENGATURAN_LATIHAN } from '../src/konten/tutorial';
import { simpan } from '../src/penyimpanan';
import { _setelUlangCache } from '../src/preferensi';
import { renderBeranda, type AksiBeranda } from '../src/ui/beranda';
import { tutupDialogTeratas } from '../src/ui/dom';
import { renderLobi } from '../src/ui/lobi';
import { pasangMatchMediaPalsu } from './bantu';

const aksiPalsu = (): AksiBeranda => ({
  buatMeja: vi.fn(),
  gabung: vi.fn(),
  lihatPublik: vi.fn(),
  lihatRiwayat: vi.fn(),
  lihatKompetisi: vi.fn(),
  mainOffline: vi.fn(),
  lanjutOffline: vi.fn(),
  latihan: vi.fn(),
  bantuan: vi.fn(),
  pengaturan: vi.fn(),
  tentang: vi.fn(),
  usulFitur: vi.fn(),
  pasangAplikasi: null,
  muatUlang: null,
});

const tunggu = async () => {
  for (let i = 0; i < 5; i++) await Promise.resolve();
};
const akar = () => document.getElementById('ui')!;
const q = <T extends HTMLElement>(sel: string) => akar().querySelector<T>(sel);
const isian = (id: string) => q<HTMLInputElement>(`#${id}`)!;
/** Ketik lalu tinggalkan isian (event 'change', seperti browser saat isian kehilangan fokus). */
const isi = (el: HTMLInputElement, nilai: string) => {
  el.value = nilai;
  el.dispatchEvent(new Event('input', { bubbles: true }));
  el.dispatchEvent(new Event('change', { bubbles: true }));
};
const centang = (el: HTMLInputElement, nyala: boolean) => {
  el.checked = nyala;
  el.dispatchEvent(new Event('change', { bubbles: true }));
};

beforeEach(() => {
  localStorage.clear();
  localStorage.setItem('remi.preferensi', JSON.stringify({ tutorialSelesai: true }));
  // Nama wajib diisi sebelum main (keputusan #49).
  localStorage.setItem('remi.nama', JSON.stringify('Pemain'));
  _setelUlangCache();
  pasangMatchMediaPalsu(false);
  document.body.innerHTML =
    '<div id="ui"></div><div id="game"></div><div id="modal"></div><div id="lapisan-dialog"></div><div id="toast"></div>';
});
afterEach(() => {
  while (tutupDialogTeratas());
  vi.unstubAllGlobals();
});

describe('beranda: Atur meja', () => {
  const batasSkor = () => q('.isi-atur .isian-batas-skor')!;
  const tersembunyi = (el: Element) => el.classList.contains('tersembunyi');

  it('kotak centang "Mode kaldu" + satu baris keterangan; bawaan mati, batas skor terlihat', () => {
    renderBeranda(akar(), aksiPalsu());
    const kaldu = isian('o-kaldu');
    expect(kaldu.type).toBe('checkbox');
    expect(kaldu.checked).toBe(false);
    expect(kaldu.closest('label')!.textContent).toBe(TEKS_KALDU.label);
    expect(kaldu.getAttribute('aria-describedby')).toBe('ket-kaldu');
    expect(q('#ket-kaldu')!.textContent).toBe(TEKS_KALDU.ket);
    // Kotak centangnya di dalam Atur meja, sebelum isian batas skor.
    expect(kaldu.closest('.isi-atur')).not.toBeNull();
    expect(kaldu.compareDocumentPosition(batasSkor()) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(tersembunyi(batasSkor())).toBe(false);
    expect(q('#ringkas-meja')!.textContent).not.toContain('kaldu');
  });

  it('dicentang: batas skor disembunyikan (angkanya tetap disimpan), ringkasan menyebut kaldu; dilepas: muncul lagi', () => {
    renderBeranda(akar(), aksiPalsu());
    isi(isian('o-skor-atas'), '250');
    isi(isian('o-skor-bawah'), '120');
    expect(simpan.pengaturanOffline()).toMatchObject({ batasSkorAtas: 250, batasSkorBawah: -120, modeKaldu: false });

    centang(isian('o-kaldu'), true);
    expect(tersembunyi(batasSkor())).toBe(true);
    expect(simpan.pengaturanOffline()).toMatchObject({ modeKaldu: true, batasSkorAtas: 250, batasSkorBawah: -120 });
    expect(q('#ringkas-meja')!.textContent).toMatch(/ · kaldu$/);

    // Dilepas lagi: isiannya terlihat dengan angka yang masih ada di layar.
    centang(isian('o-kaldu'), false);
    expect(tersembunyi(batasSkor())).toBe(false);
    expect(simpan.pengaturanOffline()).toMatchObject({ modeKaldu: false, batasSkorAtas: 250, batasSkorBawah: -120 });
    expect(q('#ringkas-meja')!.textContent).not.toContain('kaldu');
  });

  it('batas skor tersimpan tidak hilang karena mode kaldu: dicentang, digambar ulang, dilepas → ±500 lagi', () => {
    localStorage.setItem('remi.pengaturanOffline', JSON.stringify({ jumlahPemain: 3, batasSkorAtas: 500, batasSkorBawah: -500 }));
    renderBeranda(akar(), aksiPalsu());
    centang(isian('o-kaldu'), true);
    expect(simpan.pengaturanOffline()).toMatchObject({ modeKaldu: true, batasSkorAtas: 500, batasSkorBawah: -500 });

    // Muat ulang / pulang ke beranda: isiannya tersembunyi tapi angkanya masih ada.
    renderBeranda(akar(), aksiPalsu());
    expect(isian('o-kaldu').checked).toBe(true);
    expect(tersembunyi(batasSkor())).toBe(true);
    centang(isian('o-kaldu'), false);
    expect(tersembunyi(batasSkor())).toBe(false);
    expect([isian('o-skor-atas').value, isian('o-skor-bawah').value]).toEqual(['500', '500']);
    expect(simpan.pengaturanOffline()).toMatchObject({ modeKaldu: false, batasSkorAtas: 500, batasSkorBawah: -500 });
  });

  it('main baru membawa mode kaldu ke meja offline; permainannya tanpa batas skor', async () => {
    const aksi = aksiPalsu();
    renderBeranda(akar(), aksi);
    isi(isian('o-skor-atas'), '300');
    centang(isian('o-kaldu'), true);
    q<HTMLButtonElement>('#mulai-bot')!.click();
    await tunggu();
    expect(aksi.mainOffline).toHaveBeenCalledWith('Pemain', expect.objectContaining({ modeKaldu: true, batasSkorAtas: 300 }), false);
    const pengaturan = vi.mocked(aksi.mainOffline).mock.calls[0]![1];
    expect(validasiPengaturan(pengaturan)).not.toBeNull();
    // Meja yang membuang batas skornya (#43), sama seperti lobi online.
    const k = KoneksiOffline.baru('Pemain', pengaturan, 0);
    window.dispatchEvent(new Event('pagehide'));
    const d = JSON.parse(localStorage.getItem('remi.mejaOffline')!) as DataMeja;
    k.tutup();
    expect(d.pengaturan.batasSkorAtas).toBe(300);
    expect(d.game!.konfigurasi).toMatchObject({ modeKaldu: true, batasSkorAtas: null, batasSkorBawah: null });
  });

  it('simpanan mode kaldu nyala: tercentang, batas skor tersembunyi sejak awal', () => {
    localStorage.setItem('remi.pengaturanOffline', JSON.stringify({ jumlahPemain: 3, batasPutaran: 5, modeKaldu: true, batasSkorAtas: null, batasSkorBawah: null }));
    renderBeranda(akar(), aksiPalsu());
    expect(isian('o-kaldu').checked).toBe(true);
    expect(tersembunyi(batasSkor())).toBe(true);
    expect(q('#ringkas-meja')!.textContent).toBe('3 pemain · lawan normal · santai · 5 putaran · kaldu');
  });

  it('simpanan lama tanpa modeKaldu: mati, batas skor lama tetap', () => {
    localStorage.setItem('remi.pengaturanOffline', JSON.stringify({ jumlahPemain: 3, batasSkorAtas: 500, batasSkorBawah: -500 }));
    renderBeranda(akar(), aksiPalsu());
    expect(isian('o-kaldu').checked).toBe(false);
    expect(tersembunyi(batasSkor())).toBe(false);
    expect([isian('o-skor-atas').value, isian('o-skor-bawah').value]).toEqual(['500', '500']);
  });
});

describe('simpanan pengaturan offline: modeKaldu', () => {
  it.each([
    [{ modeKaldu: true }, { modeKaldu: true }],
    [{ modeKaldu: false }, { modeKaldu: false }],
    [{ modeKaldu: 'ya', jumlahPemain: 5 }, { jumlahPemain: 5 }],
    [{ modeKaldu: 1 }, {}],
    [{ modeKaldu: null }, {}],
  ])('%j → %j', (tersimpan, hasil) => {
    localStorage.setItem('remi.pengaturanOffline', JSON.stringify(tersimpan));
    expect(simpan.pengaturanOffline()).toEqual(hasil);
    expect(validasiPengaturan(simpan.pengaturanOffline())).not.toBeNull();
  });
});

describe('meja offline dan latihan', () => {
  const dibuka: KoneksiOffline[] = [];
  afterEach(() => {
    dibuka.splice(0).forEach((k) => k.tutup());
  });
  /** Buat meja offline lalu baca konfigurasi permainannya dari simpanan HP. */
  const konfigurasi = (pengaturan: Parameters<typeof KoneksiOffline.baru>[1]) => {
    dibuka.push(KoneksiOffline.baru('Budi', pengaturan, 0));
    window.dispatchEvent(new Event('pagehide'));
    const d = JSON.parse(localStorage.getItem('remi.mejaOffline')!) as DataMeja;
    return d.game!.konfigurasi;
  };

  it('Atur meja dengan mode kaldu: permainannya mode kaldu, tanpa batas skor (walau isiannya terisi)', () => {
    const k = konfigurasi({ jumlahPemain: 3, tempoBot: 'cepat', modeKaldu: true, batasPutaran: 3, batasSkorAtas: 500, batasSkorBawah: -500 });
    expect(k).toMatchObject({ modeKaldu: true, batasPutaran: 3, batasSkorAtas: null, batasSkorBawah: null });
  });

  it('latihan selalu tanpa mode kaldu, walau Atur meja terakhir menyalakannya', () => {
    expect(PENGATURAN_LATIHAN.modeKaldu).toBe(false);
    localStorage.setItem('remi.pengaturanOffline', JSON.stringify({ modeKaldu: true }));
    const k = konfigurasi(PENGATURAN_LATIHAN);
    expect(k.modeKaldu).toBeUndefined();
    expect(k).toMatchObject({ batasPutaran: 1, batasSkorAtas: null, batasSkorBawah: null });
  });
});

describe('lobi online', () => {
  const penjadwalDiam = { setel: () => 0, batal: () => undefined, sekarang: () => 0 };

  /** Lobi sungguhan: host + satu tamu; pesan host diteruskan ke Meja, info baru menggambar ulang lobi. */
  function lobi(penonton: 'host' | 'tamu', pengaturan = {}) {
    const terkirim: PesanKlien[] = [];
    const info: Record<string, InfoMeja> = {};
    let gambar = (_: InfoMeja) => undefined as void;
    const meja = Meja.buat(
      {
        kode: 'ABCDE',
        penjadwal: penjadwalDiam,
        kirim: (id: string, p: PesanServer) => {
          if (p.t !== 'meja') return;
          info[id] = p.info;
          if (id === penonton) gambar(p.info);
        },
      },
      'host',
      'Budi',
      { jumlahPemain: 3, ...pengaturan },
    );
    meja.masuk('tamu', 'Siti');
    const kirim = (p: PesanKlien) => {
      terkirim.push(p);
      if (penonton === 'host') meja.terima('host', p);
    };
    gambar = (i) => renderLobi(akar(), i, kirim, vi.fn());
    gambar(info[penonton]!);
    return { meja, terkirim };
  }

  it('host: kotak centang mengirim modeKaldu; selama nyala isian batas skor tidak tampil', () => {
    const { meja, terkirim } = lobi('host', { batasSkorAtas: 500, batasSkorBawah: -500 });
    expect(isian('kaldu').checked).toBe(false);
    expect(q('#ket-kaldu')!.textContent).toBe(TEKS_KALDU.ket);
    expect(q('.isian-batas-skor')).not.toBeNull();

    centang(isian('kaldu'), true);
    expect(terkirim.at(-1)).toEqual({ t: 'pengaturan', pengaturan: { modeKaldu: true } });
    expect(validasiPengaturan({ modeKaldu: true })).not.toBeNull();
    expect(meja.data.pengaturan.modeKaldu).toBe(true);
    // Digambar ulang dari info meja: tercentang, batas skor hilang.
    expect(isian('kaldu').checked).toBe(true);
    expect(q('.isian-batas-skor')).toBeNull();

    centang(isian('kaldu'), false);
    expect(terkirim.at(-1)).toEqual({ t: 'pengaturan', pengaturan: { modeKaldu: false } });
    expect(q('.isian-batas-skor')).not.toBeNull();
    expect(isian('skor-atas').value).toBe('500');
  });

  it('host memulai meja mode kaldu: permainannya mode kaldu tanpa batas skor', () => {
    const { meja } = lobi('host', { modeKaldu: true, batasSkorAtas: 500, batasSkorBawah: -500 });
    meja.terima('host', { t: 'aturKursi', kursi: 2, jenis: 'bot' });
    meja.terima('host', { t: 'mulai' });
    expect(meja.data.game!.konfigurasi).toMatchObject({ modeKaldu: true, batasSkorAtas: null, batasSkorBawah: null });
  });

  it('bukan host: keadaannya sebagai teks, tanpa kotak centang', () => {
    lobi('tamu');
    expect(q('input#kaldu')).toBeNull();
    expect(q('#kaldu')!.textContent).toBe(TEKS_KALDU.mati);
    expect(q('#kaldu')!.closest('.baris-teks')!.textContent).toBe(`${TEKS_KALDU.label}${TEKS_KALDU.mati}`);
    expect(q('#ket-kaldu')).toBeNull();
    expect(q('.isian-batas-skor')).not.toBeNull();

    lobi('tamu', { modeKaldu: true });
    expect(q('#kaldu')!.textContent).toBe(TEKS_KALDU.nyala);
    expect(q('#ket-kaldu')!.textContent).toBe(TEKS_KALDU.ket);
    expect(q('.isian-batas-skor')).toBeNull();
  });
});

describe('Bantuan', () => {
  it('menyebut label kotak centang dan tombol voting yang sama dengan aplikasi', () => {
    const online = BAB_BANTUAN.find((b) => b.id === 'online')!;
    const teks = JSON.stringify(online.isi);
    expect(teks).toContain(`**${TEKS_KALDU.label}**`);
    expect(teks).toContain(`**${TEKS_KALDU.tombol}**`);
    expect(teks).toContain('isian batas skor disembunyikan');
    expect(teks).toContain(`Putaran 6 · ${TEKS_KALDU.putaran}`);
  });
});
