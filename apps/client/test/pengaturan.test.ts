// @vitest-environment happy-dom
// Jendela Pengaturan: kontrol langsung mengubah preferensi, aksesibel, dan tidak menimpa modal utama.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { _setelUlangCache, preferensi } from '../src/preferensi';
import { bukaPengaturan } from '../src/ui/pengaturan';
import { tutupDialogTeratas } from '../src/ui/dom';
import { pasangMatchMediaPalsu } from './bantu';

const dialog = () => document.querySelector<HTMLElement>('.dialog.pengaturan')!;
const klik = (sel: string) => dialog().querySelector<HTMLElement>(sel)!.click();

beforeEach(() => {
  localStorage.clear();
  _setelUlangCache();
  pasangMatchMediaPalsu(false);
  document.body.innerHTML = '<div id="ui"></div><div id="game"></div><div id="modal"></div><div id="lapisan-dialog"></div><div id="toast"></div>';
});
afterEach(() => {
  while (tutupDialogTeratas());
  vi.unstubAllGlobals();
});

describe('bukaPengaturan', () => {
  it('saklar & segmen mengubah preferensi, tersimpan, dan atribut <html> ikut', () => {
    bukaPengaturan();
    klik('[data-saklar=musik]');
    expect(preferensi().musik).toBe(true);
    expect(dialog().querySelector('[data-saklar=musik]')!.getAttribute('aria-checked')).toBe('true');
    klik('[data-pilihan=warnaKartu] [data-nilai=empat]');
    klik('[data-pilihan=ukuranTeks] [data-nilai=besar]');
    klik('[data-pilihan=gerak] [data-nilai=kurang]');
    expect(document.documentElement.dataset.warnaKartu).toBe('empat');
    expect(document.documentElement.dataset.teks).toBe('besar');
    expect(document.documentElement.dataset.gerak).toBe('kurang');
    expect(JSON.parse(localStorage.getItem('remi.preferensi')!)).toMatchObject({ musik: true, warnaKartu: 'empat', ukuranTeks: 'besar', gerak: 'kurang' });
    const aktif = dialog().querySelector('[data-pilihan=gerak] [aria-checked=true]') as HTMLElement;
    expect(aktif.dataset.nilai).toBe('kurang');
    expect(aktif.tabIndex).toBe(0);
  });

  it('penggeser volume langsung mengubah preferensi', () => {
    bukaPengaturan();
    const r = dialog().querySelector<HTMLInputElement>('[data-volume=volumeMusik]')!;
    r.value = '60';
    r.dispatchEvent(new Event('input'));
    expect(preferensi().volumeMusik).toBeCloseTo(0.6);
    expect(dialog().querySelector('[data-keluaran=volumeMusik]')!.textContent).toBe('60%');
  });

  it('panah kanan di radiogroup memilih opsi berikutnya', () => {
    bukaPengaturan();
    const normal = dialog().querySelector<HTMLElement>('[data-pilihan=kecepatan] [data-nilai=normal]')!;
    normal.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
    expect(preferensi().kecepatan).toBe('cepat');
  });

  it('getar disembunyikan kalau tidak didukung', () => {
    vi.stubGlobal('navigator', { ...navigator, vibrate: undefined });
    bukaPengaturan();
    expect(dialog().querySelector('[data-saklar=getar]')).toBeNull();
  });

  it('tempo bot hanya muncul kalau diberikan, dan memanggil ubah()', () => {
    bukaPengaturan();
    expect(dialog().querySelector('[data-tempo]')).toBeNull();
    tutupDialogTeratas();
    const ubah = vi.fn();
    bukaPengaturan({ diMeja: true, tempoBot: { nilai: 'santai', ubah } });
    expect(dialog().querySelector('[data-tempo] [data-nilai=santai]')!.getAttribute('aria-checked')).toBe('true');
    klik('[data-tempo] [data-nilai=cepat]');
    expect(ubah).toHaveBeenCalledWith('cepat');
  });

  it('tidak menimpa modal utama (popup joker tetap ada) dan tidak dobel', () => {
    document.getElementById('modal')!.innerHTML = '<div class="latar"><div class="dialog" data-joker></div></div>';
    bukaPengaturan();
    bukaPengaturan();
    expect(document.querySelectorAll('.dialog.pengaturan')).toHaveLength(1);
    expect(document.querySelector('#modal [data-joker]')).not.toBeNull();
  });

  it('Ulangi tutorial menandai tutorial belum selesai', async () => {
    localStorage.setItem('remi.preferensi', JSON.stringify({ tutorialSelesai: true }));
    _setelUlangCache();
    bukaPengaturan({ diMeja: true });
    klik('[data-ulang-tutorial]');
    expect(preferensi().tutorialSelesai).toBe(false);
    // Toast jujur: dari meja latihan tidak dimulai otomatis; arahkan ke tombol yang selalu ada di beranda.
    const teks = document.getElementById('toast')!.textContent!;
    expect(teks).toContain('Latihan dengan panduan');
    expect(teks).not.toMatch(/ditawarkan lagi/);
    expect(document.querySelector('.dialog.konfirmasi')).toBeNull();
  });

  // Regresi: "Ulangi tutorial" dari beranda pernah menghapus simpanan offline tanpa konfirmasi.
  const ulangTutorial = async (bolehLatihan: () => Promise<boolean>) => {
    const mulaiLatihan = vi.fn();
    bukaPengaturan({ mulaiLatihan, bolehLatihan });
    klik('[data-ulang-tutorial]');
    await Promise.resolve();
    // Konfirmasi "Latihan sekarang?" → Ayo latihan.
    document.querySelector<HTMLElement>('.dialog.konfirmasi [data-ya]')!.click();
    for (let i = 0; i < 5; i++) await Promise.resolve();
    return mulaiLatihan;
  };

  it('Ulangi tutorial: gerbang bolehLatihan menolak → latihan batal, Pengaturan tetap terbuka', async () => {
    const boleh = vi.fn(async () => false);
    const mulaiLatihan = await ulangTutorial(boleh);
    expect(boleh).toHaveBeenCalledOnce();
    expect(mulaiLatihan).not.toHaveBeenCalled();
    expect(document.querySelector('.dialog.pengaturan')).not.toBeNull();
  });

  it('Ulangi tutorial: gerbang bolehLatihan setuju → Pengaturan ditutup lalu latihan dimulai', async () => {
    const mulaiLatihan = await ulangTutorial(async () => true);
    expect(mulaiLatihan).toHaveBeenCalledOnce();
    expect(document.querySelector('.dialog.pengaturan')).toBeNull();
  });
});
