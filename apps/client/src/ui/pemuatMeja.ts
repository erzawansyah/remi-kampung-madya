// Layar meja sebelum kanvas Phaser siap: pemuat ringan ("Nyiapin meja…") selama chunk Phaser diunduh
// dan di-boot, atau keadaan galat dengan jalan keluar kalau chunk-nya gagal dimuat (sinyal putus
// sebelum aplikasi tersimpan di HP, atau versi lama yang sudah tidak ada di server).

export const TEKS_PEMUAT_MEJA = 'Nyiapin meja…';
export const PESAN_MEJA_GAGAL = 'Meja gagal dimuat, Bos. Cek sinyal lalu coba lagi.';
export const PESAN_MEJA_MASIH_PUTUS = 'Sinyalnya masih putus, Bos. Coba lagi sebentar lagi.';

/**
 * Pasang pemuat di `akar` (isi lama diganti). Muncul pelan sesudah jeda singkat (CSS), jadi kalau Phaser
 * sudah siap dalam sekejap, pemuat tidak sempat berkedip. Dihapus pemanggil saat meja siap.
 */
export function renderPemuatMeja(akar: HTMLElement): HTMLElement {
  const el = document.createElement('div');
  el.className = 'pemuat-meja';
  el.setAttribute('role', 'status');
  el.setAttribute('aria-live', 'polite');
  el.innerHTML = `
    <div class="pemuat-kartu" aria-hidden="true"><span></span><span></span><span></span></div>
    <p>${TEKS_PEMUAT_MEJA}</p>`;
  akar.replaceChildren(el);
  return el;
}

export interface OpsiGalatMeja {
  pesan?: string;
  /** Muat ulang meja. Selama berjalan, tombol Coba lagi ditandai sibuk. */
  cobaLagi: () => void;
  keBeranda: () => void;
}

export interface GalatMejaTerpasang {
  el: HTMLElement;
  aturSibuk(sibuk: boolean): void;
  aturPesan(pesan: string): void;
}

/** Keadaan galat di layar meja: pesan + "Coba lagi" + "Kembali ke beranda". Fokus pindah ke Coba lagi. */
export function renderGalatMeja(akar: HTMLElement, opsi: OpsiGalatMeja): GalatMejaTerpasang {
  const el = document.createElement('div');
  el.className = 'galat-meja';
  el.innerHTML = `
    <div class="kartu-panel" role="alert" aria-labelledby="judul-galat-meja" aria-describedby="pesan-galat-meja">
      <h2 id="judul-galat-meja">Mejanya belum siap</h2>
      <p id="pesan-galat-meja"></p>
      <div class="deret">
        <button type="button" class="utama" data-a="coba-lagi">Coba lagi</button>
        <button type="button" data-a="beranda">Kembali ke beranda</button>
      </div>
    </div>`;
  const elPesan = el.querySelector<HTMLElement>('#pesan-galat-meja')!;
  const tombolCoba = el.querySelector<HTMLButtonElement>('[data-a="coba-lagi"]')!;
  elPesan.textContent = opsi.pesan ?? PESAN_MEJA_GAGAL;
  tombolCoba.addEventListener('click', () => {
    if (tombolCoba.getAttribute('aria-busy') === 'true') return;
    opsi.cobaLagi();
  });
  el.querySelector('[data-a="beranda"]')!.addEventListener('click', () => opsi.keBeranda());
  akar.replaceChildren(el);
  tombolCoba.focus({ preventScroll: true });
  return {
    el,
    aturSibuk(sibuk) {
      if (sibuk) tombolCoba.setAttribute('aria-busy', 'true');
      else tombolCoba.removeAttribute('aria-busy');
    },
    aturPesan(pesan) {
      elPesan.textContent = pesan;
    },
  };
}
