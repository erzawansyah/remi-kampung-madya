// @vitest-environment happy-dom
// Obrolan suara (0.9.0) di tampilan: ikon mic di samping nama kursi lobi (hanya kursi orang yang ikut
// suara), grup tombol Mic ▾ Dengar suara, dan lembar Suara (Bisukan/Bunyikan per orang).

import { afterEach, describe, expect, it, vi } from 'vitest';

vi.hoisted(() => {
  Object.assign(globalThis, { __VERSI_APP__: '0.0.0', __BUILD_SHA__: 'dev', __BUILD_WAKTU__: '2026-11-25T00:00:00.000Z' });
});

import { PENGATURAN_BAWAAN, type InfoMeja } from '@remi/meja';
import { renderLobi } from '../src/ui/lobi';
import { tutupSemuaJendela } from '../src/ui/dom';
import { bukaLembarSuara, htmlTombolSuara, pasangTombolSuara } from '../src/ui/suaraLangsung';
import type { KeadaanMic, OrangSuara, SuaraLangsung } from '../src/suaraLangsung';
import { TEKS_SUARA } from '../src/konten/suara';
import { Obrolan } from '../src/ui/obrolan';

function infoLobi(): InfoMeja {
  return {
    kode: 'SUARA',
    status: 'lobi',
    pengaturan: { ...PENGATURAN_BAWAAN },
    kursi: [
      { jenis: 'manusia', nama: 'Ani', terhubung: true, level: 'normal' },
      { jenis: 'manusia', nama: 'Budi', terhubung: true, level: 'normal' },
      { jenis: 'bot', nama: 'Kipas Dua', terhubung: false, level: 'normal' },
      { jenis: 'manusia', nama: 'Cici', terhubung: true, level: 'normal' },
    ],
    host: 0,
    kursiSaya: 0,
    setujuAkhiri: [],
    batasWaktu: null,
    diambilAlihBot: false,
    menungguJoker: [],
    botMikir: null,
  };
}

/** SuaraLangsung tiruan: keadaan diatur test, `kabari()` memanggil pendengar seperti aslinya. */
function suaraTiruan(keadaan: (KeadaanMic | null)[], orang: OrangSuara[] = []) {
  const pendengar = new Set<() => void>();
  const s = {
    tersedia: true,
    tombolMic: 'mati' as 'mati' | 'minta' | 'nyala',
    dengarNyala: true,
    tingkat: 'normal' as 'normal' | 'hemat' | 'jeda',
    bicaraSendiri: false,
    menungguKetuk: false,
    keadaan,
    keadaanKursi: (i: number) => s.keadaan[i] ?? null,
    daftarOrang: () => orang,
    dengarkan: (fn: () => void) => {
      pendengar.add(fn);
      return () => pendengar.delete(fn);
    },
    ketukMic: vi.fn(async () => undefined),
    aturDengar: vi.fn((b: boolean) => {
      s.dengarNyala = b;
      s.kabari();
    }),
    aturBisu: vi.fn(),
    ketukPutar: vi.fn(),
    kabari: () => [...pendengar].forEach((f) => f()),
    get jumlahPendengar() {
      return pendengar.size;
    },
  };
  return s;
}

afterEach(() => {
  tutupSemuaJendela();
  document.body.innerHTML = '';
});

describe('lobi: ikon mic (0.9.0)', () => {
  it('hanya kursi orang yang ikut suara; warga kedai tanpa slot; ikut berubah saat keadaan suara berubah', () => {
    const akar = document.createElement('div');
    document.body.appendChild(akar);
    const s = suaraTiruan(['mati', 'bicara', null, null]);
    renderLobi(akar, infoLobi(), vi.fn(), vi.fn(), { obrolan: new Obrolan(), suara: s as unknown as SuaraLangsung });
    const slot = [...akar.querySelectorAll<HTMLElement>('[data-mic-kursi]')];
    // Kursi warga kedai (2) tidak punya slot sama sekali.
    expect(slot.map((x) => x.dataset.micKursi)).toEqual(['0', '1', '3']);
    const ikon = (i: number) => akar.querySelector(`[data-mic-kursi="${i}"] .ikon-mic`) as HTMLElement | null;
    expect(ikon(0)!.dataset.keadaan).toBe('mati');
    expect(ikon(0)!.getAttribute('aria-label')).toBe(TEKS_SUARA.label.mati);
    expect(ikon(0)!.querySelector('.coret')).not.toBeNull();
    expect(ikon(1)!.dataset.keadaan).toBe('bicara');
    expect(ikon(1)!.querySelector('.coret')).toBeNull();
    // Cici belum ikut suara: tanpa ikon.
    expect(ikon(3)).toBeNull();
    s.keadaan = ['nyala', 'nyala', null, 'lemah'];
    s.kabari();
    expect(ikon(1)!.dataset.keadaan).toBe('nyala');
    expect(ikon(3)!.dataset.keadaan).toBe('lemah');
    // Grup tombol suara ada di kepala panel kursi.
    expect(akar.querySelector('.kepala-kursi .grup-suara:not(.tersembunyi)')).not.toBeNull();
    // Digambar ulang: pendengar lama dilepas (tidak menumpuk).
    renderLobi(akar, infoLobi(), vi.fn(), vi.fn(), { obrolan: new Obrolan(), suara: s as unknown as SuaraLangsung });
    s.kabari();
    expect(s.jumlahPendengar).toBe(2);
  });

  it('tanpa suara (aplikasi offline, test lama): tidak ada slot maupun tombol', () => {
    const akar = document.createElement('div');
    document.body.appendChild(akar);
    renderLobi(akar, infoLobi(), vi.fn(), vi.fn());
    expect(akar.querySelector('[data-mic-kursi]')).toBeNull();
    expect(akar.querySelector('.grup-suara')).toBeNull();
  });
});

describe('tombol suara (0.9.0)', () => {
  function pasang(s: ReturnType<typeof suaraTiruan>, alasan = '') {
    const akar = document.createElement('div');
    akar.innerHTML = htmlTombolSuara();
    document.body.appendChild(akar);
    pasangTombolSuara(akar, s as unknown as SuaraLangsung, () => alasan);
    return akar;
  }

  it('mic mati bawaan; ketuk = nyalakan; Dengar suara nyala bawaan, ketuk = bisukan semua', () => {
    const s = suaraTiruan([]);
    const akar = pasang(s);
    const mic = akar.querySelector<HTMLButtonElement>('[data-suara="mic"]')!;
    const dengar = akar.querySelector<HTMLButtonElement>('[data-suara="dengar"]')!;
    expect(mic.getAttribute('aria-pressed')).toBe('false');
    expect(mic.getAttribute('aria-label')).toBe(TEKS_SUARA.micMati);
    expect(dengar.getAttribute('aria-pressed')).toBe('true');
    mic.click();
    expect(s.ketukMic).toHaveBeenCalledTimes(1);
    dengar.click();
    expect(s.aturDengar).toHaveBeenCalledWith(false);
    expect(dengar.getAttribute('aria-pressed')).toBe('false');
    expect(dengar.getAttribute('aria-label')).toBe(TEKS_SUARA.dengarMati);
    s.tombolMic = 'nyala';
    s.bicaraSendiri = true;
    s.kabari();
    expect(mic.dataset.keadaan).toBe('bicara');
    s.tingkat = 'jeda';
    s.kabari();
    expect(mic.dataset.keadaan).toBe('lemah');
    expect(mic.querySelector('.tanda-lemah')).not.toBeNull();
  });

  it('sambungan belum siap: mic tidak dinyalakan, pesan gerbang yang sama ditampilkan', () => {
    const wadahToast = document.createElement('div');
    wadahToast.id = 'toast';
    document.body.appendChild(wadahToast);
    const s = suaraTiruan([]);
    const akar = pasang(s, 'Lagi nyambung lagi, Bos.');
    akar.querySelector<HTMLButtonElement>('[data-suara="mic"]')!.click();
    expect(s.ketukMic).not.toHaveBeenCalled();
    expect(wadahToast.textContent).toContain('Lagi nyambung lagi, Bos.');
  });

  it('suara tidak tersedia: grup tersembunyi', () => {
    const s = suaraTiruan([]);
    s.tersedia = false;
    const akar = pasang(s);
    expect(akar.querySelector('.grup-suara')!.classList.contains('tersembunyi')).toBe(true);
  });

  it('▾ membuka lembar Suara: sakelar dan daftar teman dengan Bisukan/Bunyikan', () => {
    const orang: OrangSuara[] = [
      { id: 2, kursi: 1, nama: 'Budi', keadaan: 'bicara', bisu: false, sambungan: 'tersambung' },
      { id: 3, kursi: 3, nama: 'Cici', keadaan: 'mati', bisu: true, sambungan: null },
    ];
    const s = suaraTiruan([], orang);
    const akar = pasang(s);
    akar.querySelector<HTMLButtonElement>('[data-suara="lembar"]')!.click();
    const dlg = document.querySelector('.dialog.lembar-suara')!;
    expect(dlg.querySelector('h2')!.textContent).toBe(TEKS_SUARA.judul);
    const sakelar = [...dlg.querySelectorAll<HTMLElement>('[role="switch"]')];
    expect(sakelar.map((x) => x.getAttribute('aria-checked'))).toEqual(['false', 'true']);
    const baris = [...dlg.querySelectorAll('.daftar-suara li')];
    expect(baris.map((b) => b.querySelector('b')!.textContent)).toEqual(['Budi', 'Cici']);
    expect(baris[0]!.textContent).toContain(TEKS_SUARA.keadaan.bicara);
    expect(baris[1]!.textContent).toContain(TEKS_SUARA.dibisukan);
    const tombol = [...dlg.querySelectorAll<HTMLButtonElement>('[data-bisu]')];
    expect(tombol.map((b) => b.textContent)).toEqual([TEKS_SUARA.bisukan, TEKS_SUARA.bunyikan]);
    tombol[0]!.click();
    expect(s.aturBisu).toHaveBeenCalledWith('Budi', true);
    tombol[1]!.click();
    expect(s.aturBisu).toHaveBeenLastCalledWith('Cici', false);
  });

  it('lembar Suara tanpa teman: kalimat kosong', () => {
    const s = suaraTiruan([]);
    bukaLembarSuara(s as unknown as SuaraLangsung);
    expect(document.querySelector('.lembar-suara')!.textContent).toContain(TEKS_SUARA.kosong);
  });
});
