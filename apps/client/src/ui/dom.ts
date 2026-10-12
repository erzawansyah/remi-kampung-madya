// Alat bantu DOM kecil: escape teks, toast, modal.

export function esc(s: unknown): string {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
}

export function $(sel: string, akar: ParentNode = document): HTMLElement {
  const el = akar.querySelector(sel);
  if (!el) throw new Error(`elemen ${sel} tidak ada`);
  return el as HTMLElement;
}

export function toast(pesan: string, salah = false, ms = 3200): void {
  const wadah = document.getElementById('toast');
  if (!wadah) return;
  const el = document.createElement('div');
  el.className = `toast${salah ? ' salah' : ''}`;
  el.textContent = pesan;
  wadah.appendChild(el);
  setTimeout(() => el.remove(), ms);
  while (wadah.children.length > 3) wadah.firstElementChild?.remove();
}

let tutupSaatIni: (() => void) | null = null;

/** Tampilkan modal. `pasang` dipanggil dengan elemen dialog untuk memasang event. */
export function bukaModal(html: string, pasang?: (dialog: HTMLElement) => void, opsi: { bisaDitutup?: boolean } = {}): void {
  const wadah = document.getElementById('modal')!;
  wadah.innerHTML = `<div class="latar"><div class="dialog" role="dialog" aria-modal="true">${html}</div></div>`;
  const latar = wadah.firstElementChild as HTMLElement;
  const dialog = latar.firstElementChild as HTMLElement;
  if (opsi.bisaDitutup !== false) {
    latar.addEventListener('click', (e) => {
      if (e.target === latar) tutupModal();
    });
  }
  dialog.querySelectorAll<HTMLElement>('[data-tutup]').forEach((b) => b.addEventListener('click', () => tutupModal()));
  tutupSaatIni = null;
  pasang?.(dialog);
}

export function tutupModal(): void {
  const wadah = document.getElementById('modal');
  if (wadah) wadah.innerHTML = '';
  tutupSaatIni?.();
  tutupSaatIni = null;
}

export function modalTerbuka(): boolean {
  return !!document.getElementById('modal')?.firstElementChild;
}
