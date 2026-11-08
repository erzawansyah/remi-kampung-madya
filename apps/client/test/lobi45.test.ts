// @vitest-environment happy-dom
// Waktu per giliran 45 detik (keputusan pemilik #61, 8 Nov 2026): pilihan di lobi meja online
// 30/45/60/90/120 detik atau tanpa batas, bawaan tetap 60, dan memilih 45 mengirim detikGiliran 45.

import { afterEach, describe, expect, it, vi } from 'vitest';

vi.hoisted(() => {
  Object.assign(globalThis, { __VERSI_APP__: '0.0.0', __BUILD_SHA__: 'dev', __BUILD_WAKTU__: '2026-11-08T00:00:00.000Z' });
});

import { PENGATURAN_BAWAAN, type InfoMeja, type PesanKlien } from '@remi/meja';
import { renderLobi } from '../src/ui/lobi';
import { tutupSemuaJendela } from '../src/ui/dom';

function infoLobi(detikGiliran = PENGATURAN_BAWAAN.detikGiliran): InfoMeja {
  return {
    kode: 'LOBI4',
    status: 'lobi',
    pengaturan: { ...PENGATURAN_BAWAAN, detikGiliran },
    kursi: [
      { jenis: 'manusia', nama: 'Ani', terhubung: true, level: 'normal' },
      { jenis: 'kosong', nama: '', terhubung: false, level: 'normal' },
      { jenis: 'kosong', nama: '', terhubung: false, level: 'normal' },
      { jenis: 'kosong', nama: '', terhubung: false, level: 'normal' },
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

afterEach(() => {
  tutupSemuaJendela();
  document.body.innerHTML = '';
});

describe('lobi: waktu per giliran (#61)', () => {
  it('ada pilihan 45 detik, bawaan tetap 60', () => {
    expect(PENGATURAN_BAWAAN.detikGiliran).toBe(60);
    const akar = document.createElement('div');
    document.body.appendChild(akar);
    renderLobi(akar, infoLobi(), vi.fn(), vi.fn());
    const pilihan = [...akar.querySelectorAll<HTMLOptionElement>('#detik option')];
    expect(pilihan.map((o) => Number(o.value))).toEqual([30, 45, 60, 90, 120, 0]);
    // Jebakan happy-dom: baca atribut selected, bukan select.value.
    expect(pilihan.find((o) => o.hasAttribute('selected'))?.value).toBe('60');
  });

  it('host memilih 45 detik: pengaturan detikGiliran 45 dikirim', () => {
    const akar = document.createElement('div');
    document.body.appendChild(akar);
    const kirim = vi.fn<(p: PesanKlien) => void>();
    renderLobi(akar, infoLobi(), kirim, vi.fn());
    const pilih = akar.querySelector<HTMLSelectElement>('#detik')!;
    pilih.value = '45';
    pilih.dispatchEvent(new Event('change'));
    expect(kirim).toHaveBeenCalledWith({ t: 'pengaturan', pengaturan: { detikGiliran: 45 } });
  });

  it('meja dengan 45 detik menampilkan 45 sebagai pilihan terpilih', () => {
    const akar = document.createElement('div');
    document.body.appendChild(akar);
    renderLobi(akar, infoLobi(45), vi.fn(), vi.fn());
    const terpilih = [...akar.querySelectorAll<HTMLOptionElement>('#detik option')].find((o) => o.hasAttribute('selected'));
    expect(terpilih?.value).toBe('45');
  });
});
