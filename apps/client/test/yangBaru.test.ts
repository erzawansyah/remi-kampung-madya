// @vitest-environment happy-dom
// Jendela "Yang baru di versi X" sesudah pembaruan: keputusan (yangBaru.ts), isi dari CHANGELOG
// (ui/yangBaru.ts, pemecah yang sama dengan Tentang), dan simpanan remi.versiDilihat.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.hoisted(() => {
  Object.assign(globalThis, { __VERSI_APP__: '0.0.0', __BUILD_SHA__: 'dev', __BUILD_WAKTU__: '2026-11-25T00:00:00.000Z' });
});

import { bandingVersi, putuskanYangBaru, rapikanVersi } from '../src/yangBaru';
import { bukaTentang } from '../src/ui/tentang';
import { bukaYangBaru, daftarYangBaru, htmlYangBaru, MAKS_VERSI_YANG_BARU } from '../src/ui/yangBaru';
import { simpan } from '../src/penyimpanan';
import { dialogTerbuka, tutupSemuaJendela } from '../src/ui/dom';
import changelog from '../../../CHANGELOG.md?raw';

const CONTOH = `# Catatan perubahan

Pembuka berkas.

## [Belum dirilis]

## [0.10.0] - 2026-12-20

Versi sepuluh, **meja** baru.

### Untuk pemain

- **Meja baru:** lebih lebar.
- Kartu lebih jelas. Rinciannya panjang.

### Teknis

- Hanya teknis.

## [0.9.1] - 2026-12-10

### Untuk pemain

- Perbaikan kecil di lobi.

## [0.9.0] - 2026-12-01

### Teknis

- Cuma teknis, tidak tampil.

## [0.8.0] - 2026-11-30

Yang baru sesudah pembaruan.

### Untuk pemain

- **Yang baru:** jendela sesudah pembaruan.

## [0.7.1] - 2026-11-25

### Untuk pemain

- Ikon lebih kecil.

## [0.7.0] - 2026-11-25

Obrolan.

### Untuk pemain

- **Obrolan:** di lobi.
`;

describe('putuskanYangBaru', () => {
  it('pemain baru (tawaran latihan) tanpa simpanan: disimpan diam-diam', () => {
    expect(putuskanYangBaru(null, '0.8.0', true)).toEqual({ jenis: 'diam' });
  });

  it('versi tersimpan lebih lama: tampil sejak versi itu', () => {
    expect(putuskanYangBaru('0.7.1', '0.8.0', false)).toEqual({ jenis: 'tampil', dari: '0.7.1' });
  });

  it('pemain lama dari sebelum fitur ini (tanpa simpanan): cukup versi sekarang', () => {
    expect(putuskanYangBaru(null, '0.8.0', false)).toEqual({ jenis: 'tampil', dari: null });
  });

  it('sudah melihat versi ini atau versi tersimpan lebih baru: tidak apa-apa', () => {
    expect(putuskanYangBaru('0.8.0', '0.8.0', false)).toEqual({ jenis: 'tidak' });
    expect(putuskanYangBaru('0.9.0', '0.8.0', false)).toEqual({ jenis: 'tidak' });
  });

  it('versi aplikasi yang bukan x.y.z: tidak apa-apa', () => {
    expect(putuskanYangBaru(null, 'dev', false)).toEqual({ jenis: 'tidak' });
  });

  it('pemain baru dengan versi lama tersimpan: tetap diam (tawaran latihan tidak ditimpa)', () => {
    expect(putuskanYangBaru('0.7.1', '0.8.0', true)).toEqual({ jenis: 'diam' });
  });
});

describe('rapikanVersi dan bandingVersi', () => {
  it('hanya x.y.z yang diterima', () => {
    expect(rapikanVersi('0.8.0')).toBe('0.8.0');
    for (const x of ['', 'v0.8.0', '0.8', '0.8.0-beta', '0.8.0 ', 8, null, {}, ['0.8.0']]) expect(rapikanVersi(x)).toBeNull();
  });

  it('dibandingkan per angka, bukan per huruf', () => {
    expect(bandingVersi('0.10.0', '0.9.9')).toBeGreaterThan(0);
    expect(bandingVersi('0.7.1', '0.8.0')).toBeLessThan(0);
    expect(bandingVersi('1.0.0', '1.0.0')).toBe(0);
  });
});

describe('daftarYangBaru', () => {
  it('versi sesudah yang tersimpan sampai versi sekarang, terbaru di depan; versi tanpa isi pemain dilewati', () => {
    const d = daftarYangBaru('0.7.1', '0.10.0', CONTOH);
    expect(d.map((v) => v.versi)).toEqual(['0.10.0', '0.9.1', '0.8.0']);
    expect(d[0]).toMatchObject({ ringkasan: 'Versi sepuluh, **meja** baru.', perubahan: ['Meja baru', 'Kartu lebih jelas'], sisa: 0 });
    expect(d[1]).toMatchObject({ ringkasan: '', perubahan: ['Perbaikan kecil di lobi'] });
  });

  it('upgrade satu versi: hanya versi itu', () => {
    expect(daftarYangBaru('0.7.1', '0.8.0', CONTOH).map((v) => v.versi)).toEqual(['0.8.0']);
  });

  it('versi sebelumnya tidak diketahui: cukup versi sekarang', () => {
    expect(daftarYangBaru(null, '0.9.1', CONTOH).map((v) => v.versi)).toEqual(['0.9.1']);
    // Versi sekarang tidak punya isi untuk pemain: kosong (tidak ada jendela).
    expect(daftarYangBaru(null, '0.9.0', CONTOH)).toEqual([]);
  });

  it('versi yang lebih baru dari aplikasi (CHANGELOG di depan) tidak ikut', () => {
    expect(daftarYangBaru('0.7.0', '0.8.0', CONTOH).map((v) => v.versi)).toEqual(['0.8.0', '0.7.1']);
  });

  it('CHANGELOG sungguhan: 0.7.0 → 0.7.1 memberi 0.7.1 saja', () => {
    const d = daftarYangBaru('0.7.0', '0.7.1', changelog);
    expect(d.map((v) => v.versi)).toEqual(['0.7.1']);
    // "Ikon **?** di samping…": tanda tanya yang berdiri sendiri bukan akhir kalimat.
    expect(d[0]!.perubahan).toEqual(['Ikon ? di samping pilihan lebih kecil dan tidak lagi menempel ke tulisannya']);
  });
});

describe('htmlYangBaru', () => {
  const jadiDom = (html: string) => {
    const el = document.createElement('div');
    el.innerHTML = html;
    return el;
  };

  it('satu versi: judul jendela memuat versinya, tanpa subjudul versi, ada Oke dan Catatan lengkap', () => {
    const el = jadiDom(htmlYangBaru('0.8.0', daftarYangBaru('0.7.1', '0.8.0', CONTOH)));
    expect(el.querySelector('h2')!.textContent).toBe('Yang baru di versi 0.8.0');
    expect(el.querySelector('h3')).toBeNull();
    expect([...el.querySelectorAll('.changelog-ringkas li')].map((li) => li.textContent)).toEqual(['Yang baru']);
    expect(el.querySelector('[data-catatan]')!.textContent).toBe('Catatan lengkap');
    expect([...el.querySelectorAll('.kaki-dialog [data-tutup]')].map((b) => b.textContent)).toEqual(['Oke']);
    expect(el.querySelector('.yang-baru-lain')).toBeNull();
  });

  it(`lebih dari ${MAKS_VERSI_YANG_BARU} versi: hanya yang terbaru terbuka, sisanya satu baris "dan versi sebelumnya"`, () => {
    const d = daftarYangBaru('0.6.0', '0.10.0', CONTOH);
    expect(d.map((v) => v.versi)).toEqual(['0.10.0', '0.9.1', '0.8.0', '0.7.1', '0.7.0']);
    const el = jadiDom(htmlYangBaru('0.10.0', d));
    expect([...el.querySelectorAll('h3')].map((h) => h.textContent)).toEqual(['Versi 0.10.0', 'Versi 0.9.1', 'Versi 0.8.0']);
    expect(el.querySelector('.yang-baru-lain')!.textContent).toBe('…dan versi sebelumnya (0.7.1, 0.7.0) ada di Catatan lengkap.');
    // Ringkasan lewat renderer markdown aman.
    expect(el.querySelector('.yang-baru-versi .md strong')!.textContent).toBe('meja');
  });

  it('isi CHANGELOG yang aneh tetap di-escape', () => {
    const jahat = `## [0.8.0] - x\n\n<img src=x onerror=alert(1)>\n\n### Untuk pemain\n\n- <script>alert(1)</script> nakal\n`;
    const el = jadiDom(htmlYangBaru('0.8.0', daftarYangBaru(null, '0.8.0', jahat)));
    expect(el.querySelector('img, script')).toBeNull();
  });
});

describe('bukaYangBaru', () => {
  afterEach(() => tutupSemuaJendela());

  it('lewat bukaDialog; Catatan lengkap menutup jendela lalu memanggil pembuka Tentang', () => {
    const catatanLengkap = vi.fn();
    bukaYangBaru('0.8.0', daftarYangBaru('0.7.1', '0.8.0', CONTOH), { catatanLengkap });
    const dialog = document.querySelector<HTMLElement>('.dialog.yang-baru')!;
    // Dialog lapisan atas (bukaDialog), bukan modal utama: momen aman pembaruan ikut menunda.
    expect(dialogTerbuka()).toBe(true);
    dialog.querySelector<HTMLButtonElement>('[data-catatan]')!.click();
    expect(document.querySelector('.dialog.yang-baru')).toBeNull();
    expect(catatanLengkap).toHaveBeenCalledOnce();
  });

  it('Tentang dengan bukaCatatan: Catatan perubahan langsung terbuka (juga kalau Tentang sudah terbuka)', () => {
    bukaTentang();
    const catatan = () => document.querySelector<HTMLDetailsElement>('.dialog.tentang .tentang-changelog')!;
    expect(catatan().open).toBe(false);
    bukaTentang({ bukaCatatan: true });
    expect(document.querySelectorAll('.dialog.tentang')).toHaveLength(1);
    expect(catatan().open).toBe(true);
    tutupSemuaJendela();
    bukaTentang({ bukaCatatan: true });
    expect(catatan().open).toBe(true);
  });

  it('Oke menutup jendela', () => {
    bukaYangBaru('0.8.0', daftarYangBaru('0.7.1', '0.8.0', CONTOH), { catatanLengkap: vi.fn() });
    document.querySelector<HTMLButtonElement>('.dialog.yang-baru .kaki-dialog .utama')!.click();
    expect(document.querySelector('.dialog.yang-baru')).toBeNull();
  });
});

describe('simpanan remi.versiDilihat', () => {
  beforeEach(() => localStorage.clear());

  it('disimpan dan dibaca lagi', () => {
    simpan.setVersiDilihat('0.8.0');
    expect(simpan.versiDilihat()).toBe('0.8.0');
  });

  it('nilai rusak jatuh ke null dan kuncinya dihapus', () => {
    for (const mentah of ['{rusak', '"v0.8"', '42', '{"versi":"0.8.0"}', '""']) {
      localStorage.setItem('remi.versiDilihat', mentah);
      expect(simpan.versiDilihat()).toBeNull();
      expect(localStorage.getItem('remi.versiDilihat')).toBeNull();
    }
  });
});
