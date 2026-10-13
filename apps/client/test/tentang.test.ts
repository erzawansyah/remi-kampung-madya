// @vitest-environment happy-dom
// Renderer markdown mini di jendela Tentang (CHANGELOG.md): struktur benar dan selalu aman.

import { describe, expect, it, vi } from 'vitest';

// Konstanta build biasanya disuntik Vite (define); di test diisi sebelum modul dimuat.
vi.hoisted(() => {
  Object.assign(globalThis, { __VERSI_APP__: '0.0.0', __BUILD_SHA__: 'dev', __BUILD_WAKTU__: '2026-10-12T00:00:00.000Z' });
});

import { bagiChangelog, htmlChangelog, mdSebaris, renderMarkdown, tautanAman } from '../src/ui/tentang';
import changelog from '../../../CHANGELOG.md?raw';

const jadiDom = (html: string) => {
  const el = document.createElement('div');
  el.innerHTML = html;
  return el;
};

describe('mdSebaris', () => {
  it('tebal, kode inline, dan tautan http(s)', () => {
    const el = jadiDom(mdSebaris('**Penting**: lihat `npm test` di [README](https://contoh.id/a?b=1&c=2).'));
    expect(el.querySelector('strong')!.textContent).toBe('Penting');
    expect(el.querySelector('code')!.textContent).toBe('npm test');
    const a = el.querySelector('a')!;
    expect(a.getAttribute('href')).toBe('https://contoh.id/a?b=1&c=2');
    expect(a.getAttribute('rel')).toContain('noopener');
    expect(a.getAttribute('target')).toBe('_blank');
  });

  it('isi kode inline tidak diproses jadi tebal/tautan', () => {
    const el = jadiDom(mdSebaris('pakai `**bukan tebal** [x](https://a.b)`'));
    expect(el.querySelector('strong')).toBeNull();
    expect(el.querySelector('a')).toBeNull();
    expect(el.querySelector('code')!.textContent).toBe('**bukan tebal** [x](https://a.b)');
  });

  it('tautan relatif boleh (tanpa target baru), protokol berbahaya jadi teks biasa', () => {
    expect(jadiDom(mdSebaris('[lisensi](/font/OFL.txt)')).querySelector('a')!.getAttribute('target')).toBeNull();
    for (const jahat of ['javascript:alert(1)', 'JaVaScRiPt:alert(1)', 'data:text/html,x', '//evil.example/x', 'vbscript:x']) {
      const el = jadiDom(mdSebaris(`[klik](${jahat})`));
      expect(el.querySelector('a')).toBeNull();
      // Tanda kurung di URL memotong pola tautan; yang penting tidak ada <a> dan teksnya tetap terbaca.
      expect(el.textContent!.startsWith('klik')).toBe(true);
    }
  });

  it("tautan '/\\host' dan variasinya (dibaca browser sebagai host lain) ditolak", () => {
    for (const jahat of ['/\\evil.example', '/\\/evil.example', '\\\\evil.example', '/%5Cevil', 'https:\\\\evil.example', 'https://a.b\\@evil']) {
      const el = jadiDom(mdSebaris(`[x](${jahat})`));
      const a = el.querySelector('a');
      if (a) {
        // Kalau lolos sebagai tautan, hasil resolve-nya wajib tetap di situs sendiri.
        expect(new URL(a.getAttribute('href')!, 'https://remi.example/').origin, jahat).toBe('https://remi.example');
        expect(a.getAttribute('href')).not.toContain('\\');
      }
    }
    expect(tautanAman('/\\evil.example')).toBeNull();
    expect(tautanAman('/font/OFL.txt')).toBe('dalam');
    expect(tautanAman('#bagian')).toBe('dalam');
    expect(tautanAman('./a.txt')).toBe('dalam');
    expect(tautanAman('https://contoh.id/x')).toBe('luar');
  });

  it('tebal tidak menyusup ke atribut href; teks tautan boleh tebal', () => {
    const el = jadiDom(mdSebaris('[x](/a**b) lalu **c**'));
    const a = el.querySelector('a')!;
    expect(a.getAttribute('href')).toBe('/a**b');
    expect(a.querySelector('strong')).toBeNull();
    expect(el.querySelector('strong')!.textContent).toBe('c');
    expect(el.innerHTML).toBe('<a href="/a**b">x</a> lalu <strong>c</strong>');
    const tebal = jadiDom(mdSebaris('[**penting**](https://a.b)'));
    expect(tebal.querySelector('a strong')!.textContent).toBe('penting');
  });

  it('HTML mentah tampil sebagai teks, termasuk di dalam tebal dan teks tautan', () => {
    const el = jadiDom(mdSebaris('<img src=x onerror=alert(1)> **<script>x</script>** [<b>a</b>](https://a.b) `<i>`'));
    expect(el.querySelector('img, script, b, i')).toBeNull();
    expect(el.textContent).toContain('<img src=x onerror=alert(1)>');
    expect(el.textContent).toContain('<script>x</script>');
  });

  it('atribut href tidak bisa dibobol tanda kutip', () => {
    const el = jadiDom(mdSebaris('[x](https://a.b/"onmouseover="alert(1))'));
    const a = el.querySelector('a');
    expect(a?.getAttribute('onmouseover') ?? null).toBeNull();
  });
});

describe('renderMarkdown', () => {
  it('heading digeser sesuai tingkatAwal dan dibatasi h6', () => {
    const el = jadiDom(renderMarkdown('# Satu\n## Dua\n#### Empat\n###### Enam', { tingkatAwal: 3 }));
    expect([...el.children].map((c) => c.tagName)).toEqual(['H3', 'H4', 'H6', 'H6']);
    expect(el.querySelector('h3')!.textContent).toBe('Satu');
  });

  it('paragraf menggabungkan baris; baris kosong memisahkan', () => {
    const el = jadiDom(renderMarkdown('baris satu\nbaris dua\n\nparagraf baru'));
    const p = el.querySelectorAll('p');
    expect(p).toHaveLength(2);
    expect(p[0]!.textContent).toBe('baris satu baris dua');
  });

  it('daftar bertitik dan bernomor, dengan baris lanjutan menjorok', () => {
    const el = jadiDom(renderMarkdown('- satu\n  lanjutan\n- dua\n\n1. pertama\n2. kedua'));
    const ul = el.querySelector('ul')!;
    expect([...ul.querySelectorAll('li')].map((l) => l.textContent)).toEqual(['satu lanjutan', 'dua']);
    expect(el.querySelectorAll('ol li')).toHaveLength(2);
  });

  it('blok kode, kutipan, dan garis', () => {
    const el = jadiDom(renderMarkdown('```\n<b>kode</b>\n**x**\n```\n> kutip\n\n---'));
    expect(el.querySelector('pre code')!.textContent).toBe('<b>kode</b>\n**x**');
    expect(el.querySelector('pre b')).toBeNull();
    expect(el.querySelector('blockquote')!.textContent).toBe('kutip');
    expect(el.querySelector('hr')).not.toBeNull();
  });

  it('CRLF dan BOM tidak merusak', () => {
    const el = jadiDom(renderMarkdown('﻿# Judul\r\n\r\n- a\r\n- b\r\n'));
    expect(el.querySelector('h3')!.textContent).toBe('Judul');
    expect(el.querySelectorAll('li')).toHaveLength(2);
  });

  it('CHANGELOG.md asli: semua versi tampil, tanpa sisa penanda markdown', () => {
    const el = jadiDom(renderMarkdown(changelog));
    const versi = [...el.querySelectorAll('h4')].map((h) => h.textContent);
    expect(versi).toContain('[Belum dirilis]');
    expect(versi.some((v) => v?.startsWith('[0.1.0]'))).toBe(true);
    expect(el.querySelectorAll('li').length).toBeGreaterThan(10);
    expect(el.querySelector('script, img, iframe')).toBeNull();
    for (const li of el.querySelectorAll('li')) expect(li.textContent).not.toMatch(/\*\*|^- /);
    expect([...el.querySelectorAll('a')].every((a) => /^https:\/\//.test(a.getAttribute('href')!))).toBe(true);
  });
});

describe('htmlChangelog (Tentang untuk pemain)', () => {
  const CONTOH = [
    '# Catatan perubahan',
    '',
    'Pembuka berkas yang tidak ditampilkan.',
    '',
    '## [Belum dirilis]',
    '',
    'Belum ada perubahan sejak versi 0.2.0.',
    '',
    '## [0.2.0] - 2026-10-13',
    '',
    'Rilis besar. **Aturan main tidak berubah**.',
    '',
    '### Untuk pemain',
    '',
    '#### Ditambahkan',
    '',
    '- Kartu baru.',
    '',
    '### Teknis',
    '',
    '#### Diubah',
    '',
    '- `apps/client/e2e/smoke.mjs` dan `GET /healthz`.',
    '',
    '### Diketahui dan belum',
    '',
    '- Belum diuji di HP fisik.',
    '',
    '## [0.1.0] - 2026-10-12',
    '',
    '### Untuk pemain',
    '',
    '- Versi pertama.',
  ].join('\n');

  it('bagiChangelog: per versi, Untuk pemain terpisah dari subbagian teknis', () => {
    const v = bagiChangelog(CONTOH);
    expect(v.map((x) => x.judul)).toEqual(['[Belum dirilis]', '[0.2.0] - 2026-10-13', '[0.1.0] - 2026-10-12']);
    expect(v[1]!.pemain).toContain('Kartu baru');
    expect(v[1]!.pemain).not.toContain('healthz');
    expect(v[1]!.teknis).toContain('### Teknis');
    expect(v[1]!.teknis).toContain('### Diketahui dan belum');
    expect(v[1]!.pembuka).toContain('Rilis besar');
  });

  it('versi kosong disembunyikan, bagian teknis dilipat tertutup, judul versi h3', () => {
    const el = jadiDom(htmlChangelog(CONTOH));
    const judul = [...el.querySelectorAll('.changelog-versi > h3')].map((h) => h.textContent);
    expect(judul).toEqual(['[0.2.0] - 2026-10-13', '[0.1.0] - 2026-10-12']);
    expect(el.textContent).not.toContain('Belum dirilis');
    expect(el.textContent).not.toContain('Pembuka berkas');
    const teknis = el.querySelector<HTMLDetailsElement>('details.changelog-teknis')!;
    expect(teknis.open).toBe(false);
    expect(teknis.textContent).toContain('GET /healthz');
    // Di luar lipatan teknis, tidak ada jargon pengembang.
    const versi = el.querySelector('.changelog-versi')!.cloneNode(true) as HTMLElement;
    versi.querySelector('details')!.remove();
    expect(versi.textContent).not.toMatch(/healthz|smoke\.mjs|Teknis/);
    expect(versi.querySelector('h4')!.textContent).toBe('Ditambahkan');
    expect(versi.querySelector('strong')!.textContent).toBe('Aturan main tidak berubah');
    // Versi tanpa bagian teknis: tanpa lipatan.
    expect(el.querySelectorAll('.changelog-versi')[1]!.querySelector('details')).toBeNull();
  });

  it('CHANGELOG.md asli: tiap versi tampil dengan bagian pemain, teknis selalu terlipat', () => {
    const el = jadiDom(htmlChangelog(changelog));
    const versi = [...el.querySelectorAll('.changelog-versi')];
    expect(versi.length).toBeGreaterThanOrEqual(2);
    expect(versi.some((v) => v.querySelector('h3')!.textContent!.startsWith('[0.2.0]'))).toBe(true);
    for (const v of versi) {
      const salin = v.cloneNode(true) as HTMLElement;
      salin.querySelectorAll('details').forEach((d) => d.remove());
      expect(salin.textContent).not.toMatch(/npm run|healthz|Cache-Control|packages\//);
      expect(salin.querySelectorAll('li').length).toBeGreaterThan(0);
    }
    expect([...el.querySelectorAll('details')].every((d) => !(d as HTMLDetailsElement).open)).toBe(true);
    expect(el.querySelector('script, img, iframe')).toBeNull();
  });
});
