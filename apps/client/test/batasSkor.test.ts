// @vitest-environment happy-dom
// Batas skor bebas kelipatan 10 (keputusan pemilik #44) di client: dua isian angka di Atur meja
// offline (beranda) dan lobi online (hanya host yang bisa mengubah), pembulatan saat isian
// ditinggalkan, batas bawah diketik tanpa minus lalu disimpan negatif, simpanan lama ±500 tetap
// terbaca, dan data rusak jatuh ke bawaan (tanpa batas).

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.hoisted(() => {
  Object.assign(globalThis, { __VERSI_APP__: '0.0.0', __BUILD_SHA__: 'dev', __BUILD_WAKTU__: '2026-10-12T00:00:00.000Z' });
});

import { Meja, validasiPengaturan, type InfoMeja, type PesanKlien, type PesanServer } from '@remi/meja';
import { simpan } from '../src/penyimpanan';
import { _setelUlangCache } from '../src/preferensi';
import { htmlIsianBatas, KET_BATAS_SKOR, tampilIsianBatas, teksBatas } from '../src/ui/batasSkor';
import { renderBeranda, type AksiBeranda } from '../src/ui/beranda';
import { tutupDialogTeratas } from '../src/ui/dom';
import { renderLobi } from '../src/ui/lobi';
import { pasangMatchMediaPalsu } from './bantu';

const aksiPalsu = (): AksiBeranda => ({
  buatMeja: vi.fn(),
  gabung: vi.fn(),
  lihatPublik: vi.fn(),
  lihatRiwayat: vi.fn(),
  mainOffline: vi.fn(),
  lanjutOffline: vi.fn(),
  latihan: vi.fn(),
  bantuan: vi.fn(),
  pengaturan: vi.fn(),
  tentang: vi.fn(),
  pasangAplikasi: null,
  muatUlang: null,
});

const tunggu = async () => {
  for (let i = 0; i < 5; i++) await Promise.resolve();
};
const akar = () => document.getElementById('ui')!;
const isian = (id: string) => akar().querySelector<HTMLInputElement>(`#${id}`)!;
/** Ketik lalu tinggalkan isian (event 'change', seperti browser saat isian kehilangan fokus). */
const isi = (el: HTMLInputElement, nilai: string) => {
  el.value = nilai;
  el.dispatchEvent(new Event('input', { bubbles: true }));
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

describe('htmlIsianBatas', () => {
  it('dua isian angka dalam satu bungkus: keyboard angka, kelipatan 10, label minus untuk batas bawah', () => {
    akar().innerHTML = htmlIsianBatas({ id: 'x', nilai: { batasSkorAtas: 250, batasSkorBawah: -120 }, bisaUbah: true });
    const bungkus = akar().querySelector('.isian-batas-skor')!;
    expect(bungkus.querySelectorAll('input')).toHaveLength(2);
    for (const id of ['x-atas', 'x-bawah']) {
      const el = isian(id);
      expect(bungkus.contains(el)).toBe(true);
      expect(el.type).toBe('number');
      expect(el.getAttribute('inputmode')).toBe('numeric');
      expect([el.getAttribute('min'), el.getAttribute('max'), el.getAttribute('step')]).toEqual(['10', '100000', '10']);
      expect(el.placeholder).toBe('Tanpa batas');
      expect(el.getAttribute('aria-describedby')).toBe('x-ket');
    }
    // Batas bawah tampil positif di isian; tandanya di label dan di depan isian.
    expect([isian('x-atas').value, isian('x-bawah').value]).toEqual(['250', '120']);
    expect(isian('x-atas').closest('label')!.textContent).toBe('Batas skor atas');
    expect(isian('x-bawah').closest('label')!.textContent).toBe('Batas skor bawah (minus)−');
    expect(akar().querySelector('#x-ket')!.textContent).toBe(KET_BATAS_SKOR);
  });

  it('hanya dibaca: teks bertanda minus tipografis, tanpa isian', () => {
    akar().innerHTML = htmlIsianBatas({ id: 'x', nilai: { batasSkorAtas: 250, batasSkorBawah: -120 }, bisaUbah: false });
    expect(akar().querySelector('input')).toBeNull();
    expect([...akar().querySelectorAll('.baris-teks')].map((b) => b.textContent)).toEqual(['Batas skor atas250', 'Batas skor bawah−120']);
    akar().innerHTML = htmlIsianBatas({ id: 'x', nilai: { batasSkorAtas: null, batasSkorBawah: null }, bisaUbah: false });
    expect([...akar().querySelectorAll('.baris-teks b')].map((b) => b.textContent)).toEqual(['Tanpa batas', 'Tanpa batas']);
  });

  it('tampilIsianBatas / teksBatas', () => {
    expect([tampilIsianBatas(null), tampilIsianBatas(500), tampilIsianBatas(-500), tampilIsianBatas(0)]).toEqual(['', '500', '500', '']);
    expect([teksBatas(null), teksBatas(500), teksBatas(-500)]).toEqual(['Tanpa batas', '500', '−500']);
  });
});

describe('beranda: Atur meja', () => {
  it('kotak centang ±500 sudah diganti dua isian; bawaan kosong (tanpa batas)', () => {
    renderBeranda(akar(), aksiPalsu());
    expect(akar().querySelector('#o-skor')).toBeNull();
    expect(akar().textContent).not.toContain('±500');
    const bungkus = akar().querySelector('.isi-atur .isian-batas-skor')!;
    expect(bungkus).not.toBeNull();
    expect([isian('o-skor-atas').value, isian('o-skor-bawah').value]).toEqual(['', '']);
  });

  it('angka dibulatkan ke kelipatan 10 saat ditinggalkan, lalu disimpan (batas bawah negatif)', () => {
    renderBeranda(akar(), aksiPalsu());
    isi(isian('o-skor-atas'), '255');
    expect(isian('o-skor-atas').value).toBe('260');
    isi(isian('o-skor-bawah'), '125');
    expect(isian('o-skor-bawah').value).toBe('130');
    expect(simpan.pengaturanOffline()).toMatchObject({ batasSkorAtas: 260, batasSkorBawah: -130 });

    isi(isian('o-skor-atas'), '3');
    expect(isian('o-skor-atas').value).toBe('10');
    isi(isian('o-skor-atas'), '250000');
    expect(isian('o-skor-atas').value).toBe('100000');
    // Dikosongkan (atau 0) = tanpa batas.
    isi(isian('o-skor-atas'), '');
    isi(isian('o-skor-bawah'), '0');
    expect(isian('o-skor-bawah').value).toBe('');
    expect(simpan.pengaturanOffline()).toMatchObject({ batasSkorAtas: null, batasSkorBawah: null });
  });

  it('titik ribuan ("1.000", cara orang sini menulis seribu) dibaca seribu, bukan 1 → 10', () => {
    renderBeranda(akar(), aksiPalsu());
    isi(isian('o-skor-atas'), '1.000');
    expect(isian('o-skor-atas').value).toBe('1000');
    isi(isian('o-skor-bawah'), '1.500');
    expect(isian('o-skor-bawah').value).toBe('1500');
    expect(simpan.pengaturanOffline()).toMatchObject({ batasSkorAtas: 1000, batasSkorBawah: -1500 });
  });

  it('Enter merapikan dan menyimpan tanpa harus pindah isian', () => {
    renderBeranda(akar(), aksiPalsu());
    const el = isian('o-skor-atas');
    el.focus();
    el.value = '247';
    el.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    expect(el.value).toBe('250');
    expect(simpan.pengaturanOffline().batasSkorAtas).toBe(250);
  });

  it('main baru membawa batasnya ke meja offline, juga kalau isian belum ditinggalkan', async () => {
    const aksi = aksiPalsu();
    renderBeranda(akar(), aksi);
    isi(isian('o-skor-atas'), '250');
    isian('o-skor-bawah').value = '118'; // masih diketik, belum ada 'change'
    akar().querySelector<HTMLButtonElement>('#mulai-bot')!.click();
    await tunggu();
    expect(aksi.mainOffline).toHaveBeenCalledWith('Pemain', expect.objectContaining({ batasSkorAtas: 250, batasSkorBawah: -120 }), false);
    expect(simpan.pengaturanOffline()).toMatchObject({ batasSkorAtas: 250, batasSkorBawah: -120 });
  });

  it('simpanan lama (kotak centang ±500) tetap terbaca sebagai 500 / 500', () => {
    localStorage.setItem('remi.pengaturanOffline', JSON.stringify({ jumlahPemain: 3, batasSkorAtas: 500, batasSkorBawah: -500 }));
    renderBeranda(akar(), aksiPalsu());
    expect([isian('o-skor-atas').value, isian('o-skor-bawah').value]).toEqual(['500', '500']);
  });

  it('simpanan rusak: batas skor jatuh ke bawaan, pengaturan lain tetap', () => {
    localStorage.setItem('remi.pengaturanOffline', JSON.stringify({ jumlahPemain: 3, batasSkorAtas: 'banyak', batasSkorBawah: { x: 1 } }));
    renderBeranda(akar(), aksiPalsu());
    expect([isian('o-skor-atas').value, isian('o-skor-bawah').value]).toEqual(['', '']);
    expect(akar().querySelector('#ringkas-meja')!.textContent).toContain('3 pemain');
  });
});

describe('simpanan pengaturan offline: batas skor', () => {
  it.each([
    [{ batasSkorAtas: 500, batasSkorBawah: -500 }, { batasSkorAtas: 500, batasSkorBawah: -500 }],
    [{ batasSkorAtas: null, batasSkorBawah: null }, { batasSkorAtas: null, batasSkorBawah: null }],
    [{ batasSkorAtas: 255, batasSkorBawah: -123 }, { batasSkorAtas: 260, batasSkorBawah: -120 }],
    [{ batasSkorAtas: -300, batasSkorBawah: 300 }, { batasSkorAtas: 300, batasSkorBawah: -300 }],
    [{ batasSkorAtas: 0, batasSkorBawah: 9e9 }, { batasSkorAtas: null, batasSkorBawah: -100000 }],
    [{ batasSkorAtas: '500', batasSkorBawah: true }, {}],
    [{ jumlahPemain: 5 }, { jumlahPemain: 5 }],
  ])('%j → %j', (tersimpan, hasil) => {
    localStorage.setItem('remi.pengaturanOffline', JSON.stringify(tersimpan));
    expect(simpan.pengaturanOffline()).toEqual(hasil);
    // Yang terbaca selalu sah menurut validasi meja.
    expect(validasiPengaturan(simpan.pengaturanOffline())).not.toBeNull();
    expect(localStorage.getItem('remi.pengaturanOffline')).not.toBeNull();
  });
});

describe('lobi online', () => {
  const penjadwalDiam = { setel: () => 0, batal: () => undefined, sekarang: () => 0 };

  /**
   * Lobi sungguhan: host + satu tamu. Pesan dari lobi host diteruskan ke Meja, dan setiap info baru
   * untuk `penonton` menggambar ulang lobinya (seperti main.ts saat pesan 'meja' datang).
   */
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
    return { meja, terkirim, info };
  }
  const pesanBatas = (terkirim: PesanKlien[]) => terkirim.filter((p) => p.t === 'pengaturan');

  it('host: dua isian berisi nilai meja (batas bawah positif), pesan baru dikirim saat ditinggalkan', () => {
    const { terkirim, info, meja } = lobi('host', { batasSkorAtas: 500, batasSkorBawah: -500 });
    expect([isian('skor-atas').value, isian('skor-bawah').value]).toEqual(['500', '500']);
    const el = isian('skor-atas');
    el.value = '25';
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.value = '255';
    el.dispatchEvent(new Event('input', { bubbles: true }));
    expect(pesanBatas(terkirim)).toEqual([]); // tiap ketikan tidak dikirim
    el.dispatchEvent(new Event('change', { bubbles: true }));
    expect(pesanBatas(terkirim)).toEqual([{ t: 'pengaturan', pengaturan: { batasSkorAtas: 260 } }]);
    expect(info.host!.pengaturan.batasSkorAtas).toBe(260);
    // Digambar ulang dengan nilai dari meja.
    expect(isian('skor-atas').value).toBe('260');

    isi(isian('skor-bawah'), '120');
    expect(pesanBatas(terkirim).at(-1)).toEqual({ t: 'pengaturan', pengaturan: { batasSkorBawah: -120 } });
    expect(meja.data.pengaturan).toMatchObject({ batasSkorAtas: 260, batasSkorBawah: -120 });
    // Semua pesan yang dikirim lolos validasi server.
    for (const p of pesanBatas(terkirim)) expect(validasiPengaturan((p as { pengaturan: unknown }).pengaturan)).not.toBeNull();

    // Dikosongkan = tanpa batas.
    isi(isian('skor-bawah'), '');
    expect(pesanBatas(terkirim).at(-1)).toEqual({ t: 'pengaturan', pengaturan: { batasSkorBawah: null } });
  });

  it('host: nilai yang sama tidak dikirim lagi (change lalu blur, atau angka yang dibulatkan jadi sama)', () => {
    const { terkirim } = lobi('host', { batasSkorAtas: 500 });
    const el = isian('skor-atas');
    el.focus();
    el.value = '502';
    el.dispatchEvent(new Event('blur'));
    expect(el.value).toBe('500');
    expect(pesanBatas(terkirim)).toEqual([]);
  });

  it('host: angka yang sedang diketik tidak hilang saat lobi digambar ulang, lalu terkirim saat ditinggalkan', () => {
    const { terkirim, meja } = lobi('host');
    const el = isian('skor-atas');
    el.focus();
    el.value = '75';
    meja.masuk('tamu2', 'Joko'); // info baru → lobi digambar ulang
    const baru = isian('skor-atas');
    expect(baru).not.toBe(el);
    expect(baru.value).toBe('75');
    expect(document.activeElement).toBe(baru);
    // Chrome bisa memicu blur pada isian lama yang dibuang: itu bukan "ditinggalkan", jadi tidak dikirim.
    el.dispatchEvent(new Event('blur'));
    expect(pesanBatas(terkirim)).toEqual([]);
    baru.dispatchEvent(new Event('blur'));
    expect(pesanBatas(terkirim)).toEqual([{ t: 'pengaturan', pengaturan: { batasSkorAtas: 80 } }]);
    expect(meja.data.pengaturan.batasSkorAtas).toBe(80);
  });

  it('bukan host: batas skor tampil sebagai teks, tanpa isian', () => {
    lobi('tamu', { batasSkorAtas: 250, batasSkorBawah: -120 });
    expect(akar().querySelector('#skor-atas')!.tagName).toBe('B');
    expect(akar().querySelector('.isian-batas-skor input')).toBeNull();
    expect(akar().querySelector('#skor-atas')!.textContent).toBe('250');
    expect(akar().querySelector('#skor-bawah')!.textContent).toBe('−120');
    lobi('tamu');
    expect(akar().querySelector('#skor-atas')!.textContent).toBe('Tanpa batas');
  });
});
