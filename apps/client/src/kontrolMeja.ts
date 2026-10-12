// Layar meja: bar atas, bar aksi, modal hasil/skor/log, dan penghubung ke scene Phaser.
// Semua aksi divalidasi dulu dengan fungsi mesin aturan yang sama dengan server,
// jadi tombol yang tidak sah menampilkan alasannya sebelum ada yang dikirim.

import {
  AturanError,
  deskripsiKartuJadi,
  namaKartu,
  namaRank,
  opsiPeranJoker,
  teksPerhitungan,
  validasiBuang,
  validasiKartuJadi,
  validasiMulung,
  validasiTurunkan,
  SEMUA_BUNGA,
  type HasilPutaran,
  type HasilValidasiKartuJadi,
  type Kartu,
  type KonteksJoker,
  type SpesifikasiKartuJadi,
  type Peristiwa,
  type ViewPemain,
  berikutnya,
} from '@remi/engine';
import type { InfoMeja, PesanKlien } from '@remi/meja';
import type { AksiAdegan, MejaScene, ModelMeja } from './game/MejaScene';
import { bukaModal, esc, modalTerbuka, toast, tutupModal } from './ui/dom';
import { htmlKartuJadiAsal, htmlPeringkat, htmlRincianPutaran, htmlRiwayat } from './ui/rincianSkor';
import { simpan } from './penyimpanan';
import { PemutarPeristiwa } from './efek/pemutar';
import { bersihkanSorak } from './efek/sorak';
import { bunyi, getar } from './efek/suara';
import { labelKartu } from './efek/pemutar';
import { DAFTAR_EMOTE, type Emote } from '@remi/meja';

export interface AppUntukMeja {
  readonly jenis: 'online' | 'offline';
  kirim(p: PesanKlien): void;
  keluarMeja(): void;
  mainLagiOffline(): void;
}

interface Mulung {
  jumlah: number;
  kombinasi: SpesifikasiKartuJadi[];
}

type Urutan = 'bunga' | 'angka' | 'manual';

function coba<T>(f: () => T): { ok: true; nilai: T } | { ok: false; pesan: string } {
  try {
    return { ok: true, nilai: f() };
  } catch (e) {
    if (e instanceof AturanError) return { ok: false, pesan: e.pesan };
    throw e;
  }
}

export class KontrolMeja implements AksiAdegan {
  private info: InfoMeja | null = null;
  private view: ViewPemain | null = null;
  private dipilih = new Set<string>();
  private urutanManual: string[] = simpan.urutanTangan();
  private urutan: Urutan = 'manual';
  private pilihJumlah = false;
  private mulung: Mulung | null = null;
  private petunjuk = '';
  private petunjukSalah = false;
  private kunciGiliran = '';
  private hasilTerlihat = 0;
  private timerWaktu: ReturnType<typeof setInterval> | null = null;
  private elAtas: HTMLElement;
  private elAksi: HTMLElement;
  /** View yang belum ditampilkan; diputar berurutan supaya animasi tiap kejadian sempat terlihat. */
  private antrian: ViewPemain[] = [];
  private sedangMemutar = false;
  private idPeristiwa = -1;
  private pemutar: PemutarPeristiwa;
  private aksiTerakhir: Record<number, string> = {};
  /** Kartu yang sedang dianimasikan; tidak digambar di tangan/buangan sampai view berikutnya tampil. */
  private disembunyikan = new Set<string>();
  /** View yang kejadiannya sedang diputar (belum tampil). */
  private viewTertunda: ViewPemain | null = null;
  /** Sedang memutar animasi kejadian: tombol aksi dikunci supaya tidak menekan keadaan lama. */
  private animasi = false;
  private timerAksi = new Map<number, ReturnType<typeof setTimeout>>();
  private giliranSayaSebelumnya = false;
  private hancur = false;
  private emoteTertunda: [number, Emote][] = [];
  private timerDetak: ReturnType<typeof setInterval> | null = null;
  /** Klasemen akhir sudah ditampilkan untuk permainan yang selesai ini. */
  private selesaiDitampilkan = false;

  constructor(
    private readonly app: AppUntukMeja,
    private readonly scene: MejaScene,
    private readonly akar: HTMLElement,
  ) {
    akar.innerHTML = `<div class="bar-atas"></div><div class="bar-aksi"></div>`;
    this.elAtas = akar.querySelector('.bar-atas')!;
    this.elAksi = akar.querySelector('.bar-aksi')!;
    this.timerWaktu = setInterval(() => this.perbaruiWaktu(), 500);
    this.pemutar = new PemutarPeristiwa({
      scene,
      nama: (i) => this.view?.pemain[i]?.nama ?? '',
      saya: () => this.saya,
      catatAksi: (pemain, teks) => this.catatAksi(pemain, teks),
      sembunyikan: (ids) => {
        ids.forEach((id) => this.disembunyikan.add(id));
        this.render();
      },
      tampakkan: (ids) => {
        ids.forEach((id) => this.disembunyikan.delete(id));
        this.render();
      },
      viewSekarang: () => this.view,
      viewBerikut: () => this.viewTertunda,
      terapkanViewBerikut: (sembunyi) => this.terapkanViewBerikut(sembunyi),
      panelMentung: (e) => this.panelMentung(e),
    });
  }

  hancurkan() {
    this.hancur = true;
    this.antrian = [];
    bersihkanSorak();
    this.timerAksi.forEach((t) => clearTimeout(t));
    if (this.timerWaktu) clearInterval(this.timerWaktu);
    if (this.timerDetak) clearInterval(this.timerDetak);
    this.scene.pasang(null, this);
    this.akar.innerHTML = '';
    tutupModal();
  }

  perbarui(info: InfoMeja | null, view: ViewPemain | null) {
    if (info) this.info = info;
    if (view) {
      this.antrian.push(view);
      void this.putarAntrian();
    } else if (!this.sedangMemutar) this.tampilkan();
  }

  /** Putar peristiwa baru dari tiap view secara berurutan, lalu tampilkan view-nya. */
  private async putarAntrian() {
    if (this.sedangMemutar) return;
    this.sedangMemutar = true;
    try {
      while (this.antrian.length && !this.hancur) {
        const v = this.antrian.shift()!;
        const baru = v.peristiwa.filter((e) => e.id > this.idPeristiwa);
        // View pertama (baru masuk / sambung ulang): jangan putar ulang kejadian lama.
        if (this.idPeristiwa >= 0 && this.view) {
          if (baru.length) {
            this.animasi = true;
            this.render();
          }
          this.viewTertunda = v;
          for (let i = 0; i < baru.length; i++) {
            if (this.hancur) return;
            await this.pemutar.putar(baru[i], this.antrian.length > 2, baru[i + 1]);
          }
          this.viewTertunda = null;
        }
        if (v.peristiwa.length) this.idPeristiwa = v.peristiwa[v.peristiwa.length - 1].id;
        else this.idPeristiwa = Math.max(this.idPeristiwa, 0);
        if (this.view !== v) this.pertahankanUrutan(v);
        this.view = v;
        this.disembunyikan.clear();
        this.animasi = false;
        this.tampilkan();
      }
    } finally {
      this.sedangMemutar = false;
      if (this.animasi) {
        this.animasi = false;
        this.render();
      }
      this.lepasEmoteTertunda();
    }
  }

  /** Tampilkan view yang sedang diputar sekarang juga (dipakai pemutar untuk tahu posisi tujuan). */
  private terapkanViewBerikut(sembunyi: string[]) {
    const v = this.viewTertunda;
    if (v && this.view !== v) {
      this.pertahankanUrutan(v);
      this.view = v;
    }
    sembunyi.forEach((id) => this.disembunyikan.add(id));
    this.render();
  }

  /** Kartu yang baru masuk tangan (dari deck atau pungutan) ditaruh di ujung kanan; urutan lain tetap. */
  private pertahankanUrutan(baru: ViewPemain) {
    const pl = this.view?.putaran;
    const pb = baru.putaran;
    if (!pl || !pb || pl.nomor !== pb.nomor) return;
    const idLama = new Set(this.tanganServer().map((k) => k.id));
    const tambah = (pb.tangan[this.saya] ?? []).filter((k) => !idLama.has(k.id)).map((k) => k.id);
    if (!tambah.length) return;
    this.urutanManual = [...this.tanganUrut().map((k) => k.id), ...tambah];
    this.urutan = 'manual';
    simpan.setUrutanTangan(this.urutanManual);
  }

  /**
   * Panel mentung: tiap pemain langsung tahu dia kepentung atau tidak. Rincian (kartu siapa yang
   * dipungut dan dipasangkan jadi apa) dibuka kalau diklik. Selesai saat pemain menekan Lanjut.
   */
  private panelMentung(e: Extract<Peristiwa, { jenis: 'mentung' }>): Promise<void> {
    return new Promise((selesai) => {
      const v = this.viewTertunda ?? this.view;
      if (this.hancur || !v?.putaran) return selesai();
      const saya = this.saya;
      const nama = (i: number) => v.pemain[i]?.nama ?? '';
      const namaAtauKamu = (i: number) => (i === saya ? 'Kamu' : nama(i));
      // Kartu jadi yang dibentuk di giliran mentung: dari mulung terakhir + turunkan sesudahnya.
      const semua = new Map<number, Peristiwa>();
      for (const x of [...(this.view?.peristiwa ?? []), ...v.peristiwa]) semua.set(x.id, x);
      const urut = [...semua.values()].filter((x) => x.putaran === e.putaran && x.id < e.id).sort((a, b) => a.id - b.id);
      const mulung = [...urut].reverse().find((x) => x.jenis === 'mulung' && x.pemain === e.pemain);
      const idKj = new Set<string>();
      if (mulung && mulung.jenis === 'mulung') {
        mulung.idKartuJadi.forEach((id) => idKj.add(id));
        for (const x of urut) if (x.jenis === 'turunkan' && x.pemain === e.pemain && x.id > mulung.id) x.idKartuJadi.forEach((id) => idKj.add(id));
      }
      const kjGiliran = v.putaran.kartuJadi[e.pemain].filter((kj) => idKj.has(kj.id));
      const kartuDari = (pemilik: number) =>
        kjGiliran.flatMap((kj) => kj.kartu).filter((d) => d.dari === pemilik).map((d) => labelKartu(d.kartu));

      let status: string;
      if (e.pemain === saya) status = `<div class="kotak-status emas">Kamu MENTUNG! +${e.nilai}</div>`;
      else if (e.kepentung.includes(saya)) {
        status = `<div class="kotak-status merah">Kamu KEPENTUNG −${e.nilai}
          <small>Kartumu yang dipakai: ${esc(kartuDari(saya).join(', ') || '-')}</small></div>`;
      } else status = '<div class="kotak-status aman">Kamu aman, nggak kepentung.</div>';

      const sebutan = { 2: 'DOUBLE PENTUNG!', 3: 'TRIPLE PENTUNG!', 4: 'QUADRA PENTUNG!', 5: 'PENTUNG MASSAL!' }[Math.min(e.kepentung.length, 5)];
      const lencana = [
        sebutan ? `<span class="lencana merah">${sebutan}</span>` : '',
        e.dibalik ? '<span class="lencana">↺ BALIK ARAH</span>' : e.kepentung.length ? '<span class="lencana">LOMPAT · arah tetap</span>' : '',
      ].join('');
      const daftarKepentung = e.kepentung.length
        ? e.kepentung.map((k) => `<b>${esc(namaAtauKamu(k))}</b> (${esc(kartuDari(k).join(', '))})`).join(' · ')
        : 'nggak ada';

      bukaModal(
        `<div data-mentung></div>
         <h2 style="text-align:center">${e.pentunganJoker ? 'PENTUNG JOKER!' : 'MENTUNG!'}</h2>
         <p style="text-align:center;margin:0">${esc(namaAtauKamu(e.pemain))} nutup pakai <b>${esc(namaKartu(e.pentungan))}</b> · nilai <b>${e.nilai}</b></p>
         ${htmlKartu(e.pentungan)}
         ${status}
         ${lencana ? `<div class="lencana-deret">${lencana}</div>` : ''}
         <p class="redup" style="margin:0">Kepentung: ${daftarKepentung}</p>
         <details class="akordion">
           <summary><span class="nama-skor"><b>Lihat kartu yang dipungut &amp; dipasangkan</b></span></summary>
           <div class="komponen">
             ${htmlKartuJadiAsal(kjGiliran, nama, saya)}
             <div class="komp"><span>Pentungan: ${esc(namaKartu(e.pentungan))}${e.pentunganJoker ? ' (joker)' : ''}, dari ${e.pemain === saya ? 'tanganmu' : `tangan ${esc(nama(e.pemain))}`}. Pemilik kartu pentungan tidak kena karena kartu itu.</span></div>
           </div>
         </details>
         <button class="utama" data-lanjut>Lanjut</button>`,
        (dlg) =>
          dlg.querySelector('[data-lanjut]')!.addEventListener('click', () => {
            tutupModal();
            selesai();
          }),
        { bisaDitutup: false },
      );
      if (e.kepentung.includes(saya)) {
        bunyi('kepentung');
        getar([220, 90, 220]);
      }
    });
  }

  private catatAksi(pemain: number, teks: string) {
    // Aksi dalam satu giliran digabung, misalnya "mungut 9♦ · buang A♠".
    const lama = this.aksiTerakhir[pemain];
    const gabung = lama && this.timerAksi.has(pemain) && !teks.startsWith('ambil') && !teks.startsWith('mungut');
    this.aksiTerakhir = { ...this.aksiTerakhir, [pemain]: gabung ? `${lama} · ${teks}` : teks };
    const timerLama = this.timerAksi.get(pemain);
    if (timerLama) clearTimeout(timerLama);
    this.timerAksi.set(
      pemain,
      setTimeout(() => {
        const { [pemain]: _, ...sisa } = this.aksiTerakhir;
        this.aksiTerakhir = sisa;
        this.timerAksi.delete(pemain);
        if (!this.hancur) this.render();
      }, 3500),
    );
    this.render();
  }

  private tampilkan() {
    const v = this.view;
    if (!v || !this.info) return;
    const p = v.putaran;
    // Giliran/tahap berganti: buang pilihan dan mode mulung yang basi.
    const kunci = p ? `${p.nomor}:${p.giliran}:${p.tahap}:${v.status}` : v.status;
    if (kunci !== this.kunciGiliran) {
      this.kunciGiliran = kunci;
      this.dipilih.clear();
      this.pilihJumlah = false;
      this.mulung = null;
      this.setPetunjuk('');
    }
    const ids = new Set(this.tanganServer().map((k) => k.id));
    for (const id of [...this.dipilih]) if (!ids.has(id) && !this.idPungutan().has(id)) this.dipilih.delete(id);

    // Hasil putaran baru → tampilkan rinciannya.
    if (v.riwayat.length > this.hasilTerlihat && v.status !== 'putaranBerjalan') {
      this.hasilTerlihat = v.riwayat.length;
      if (v.status === 'selesai') this.modalSelesai();
      else this.modalHasil(v.riwayat[v.riwayat.length - 1]);
    } else if (v.status === 'selesai' && !this.selesaiDitampilkan) {
      // Misalnya semua sepakat mengakhiri dari modal hasil: ganti modal hasil dengan klasemen akhir.
      this.modalSelesai();
    } else if (v.status === 'putaranSelesai' && modalTerbuka() && document.querySelector('[data-hasil]')) {
      // Perbarui modal hasil (misalnya jumlah yang setuju mengakhiri).
      this.modalHasil(v.riwayat[v.riwayat.length - 1]);
    }
    if (v.status === 'putaranBerjalan' && document.querySelector('[data-hasil]')) tutupModal();
    this.hasilTerlihat = Math.max(this.hasilTerlihat, v.riwayat.length);
    if (v.status !== 'selesai') this.selesaiDitampilkan = false;

    // Pengumuman joker: sekali di awal putaran, harus ditekan OK.
    const tungguSaya = !!this.info && this.info.menungguJoker.includes(this.saya) && v.status === 'putaranBerjalan';
    if (tungguSaya && !document.querySelector('[data-joker]')) this.modalJoker();
    if (!tungguSaya && document.querySelector('[data-joker]')) tutupModal();

    // Tanda giliranmu: bunyi + getar pendek.
    const giliranSaya = this.giliranSaya() || this.susunSaya();
    if (giliranSaya && !this.giliranSayaSebelumnya) {
      bunyi('giliran');
      getar(40);
    }
    this.giliranSayaSebelumnya = giliranSaya;
    this.render();
  }

  // ---------- data turunan ----------

  private get saya(): number {
    return this.view?.saya ?? 0;
  }

  private ctx(): KonteksJoker {
    const p = this.view!.putaran!;
    return { rankJoker: p.rankJoker, jokerMati: p.jokerMati };
  }

  private tanganServer(): Kartu[] {
    return this.view?.putaran?.tangan[this.saya] ?? [];
  }

  /** Fase susun akhir dan saya belum menekan Selesai. */
  private susunSaya(): boolean {
    const v = this.view;
    return v?.status === 'susunAkhir' && !v.putaran!.selesaiSusun[this.saya] && !this.info?.diambilAlihBot;
  }

  private giliranSaya(): boolean {
    const v = this.view;
    return !!v?.putaran && v.status === 'putaranBerjalan' && v.putaran.giliran === this.saya && !this.info?.diambilAlihBot;
  }

  private pungutan() {
    const p = this.view!.putaran!;
    return this.mulung ? p.buangan.slice(p.buangan.length - this.mulung.jumlah) : [];
  }

  private idPungutan(): Set<string> {
    return new Set(this.view?.putaran ? this.pungutan().map((e) => e.kartu.id) : []);
  }

  private idTerpakaiMulung(): Set<string> {
    return new Set((this.mulung?.kombinasi ?? []).flat().map((x) => x.id));
  }

  /** Tangan terurut sesuai pilihan pemain. */
  private tanganUrut(): Kartu[] {
    const t = [...this.tanganServer()];
    if (this.urutan === 'bunga') {
      t.sort((a, b) => SEMUA_BUNGA.indexOf(a.bunga) - SEMUA_BUNGA.indexOf(b.bunga) || a.rank - b.rank);
    } else if (this.urutan === 'angka') {
      t.sort((a, b) => a.rank - b.rank || SEMUA_BUNGA.indexOf(a.bunga) - SEMUA_BUNGA.indexOf(b.bunga));
    } else {
      const posisi = new Map(this.urutanManual.map((id, i) => [id, i]));
      t.sort((a, b) => (posisi.get(a.id) ?? 1e6) - (posisi.get(b.id) ?? 1e6));
    }
    return t;
  }

  private semuaKartuMulung(): Kartu[] {
    return [...this.tanganServer(), ...this.pungutan().map((e) => e.kartu)];
  }

  // ---------- AksiAdegan (dari Phaser) ----------

  ketukKartu(id: string) {
    if (this.dipilih.has(id)) this.dipilih.delete(id);
    else this.dipilih.add(id);
    this.setPetunjuk('');
    this.render();
  }

  ketukDeck() {
    this.ambilDeck();
  }

  ketukBuangan(jumlah: number) {
    if (!this.pilihJumlah) {
      // Ketuk kartu di buangan saat giliran ambil = langsung mungut kartu itu dan semua di atasnya.
      const st = this.statusTombol().mulung;
      if (!st.aktif || this.mulung) return this.setPetunjuk(st.alasan, true);
    }
    this.pilihJumlah = false;
    this.mulung = { jumlah, kombinasi: [] };
    this.dipilih.clear();
    this.setPetunjuk('Pilih kartu dari tangan + pungutan, lalu tekan "Jadikan". Kartu bertanda emas wajib masuk kombinasi.');
    this.render();
  }

  /** Kartu diseret ke tumpukan buangan = buang kartu itu. */
  lepasKeBuangan(id: string) {
    const p = this.view?.putaran;
    if (!p || this.view?.status !== 'putaranBerjalan' || p.giliran !== this.saya || p.tahap !== 'main') {
      this.setPetunjuk(p?.tahap === 'ambil' && p.giliran === this.saya ? 'Ambil kartu dulu (dari deck atau mulung).' : 'Belum waktunya buang.', true);
      return this.render();
    }
    this.dipilih = new Set([id]);
    this.buang();
    this.render();
  }

  geserKartu(id: string, indeksBaru: number) {
    const t = this.tanganUrut().map((k) => k.id);
    const lama = t.indexOf(id);
    if (lama < 0) return;
    t.splice(lama, 1);
    t.splice(indeksBaru, 0, id);
    this.urutanManual = t;
    this.urutan = 'manual';
    simpan.setUrutanTangan(t);
    this.render();
  }

  ketukKombinasi(indeks: number) {
    if (!this.mulung) return;
    this.mulung.kombinasi.splice(indeks, 1);
    this.setPetunjuk('Kombinasi dibatalkan.');
    this.render();
  }

  // ---------- aksi ----------

  private kirimAksi(aksi: Extract<PesanKlien, { t: 'aksi' }>['aksi']) {
    this.app.kirim({ t: 'aksi', aksi });
    this.dipilih.clear();
  }

  private ambilDeck() {
    const s = this.statusTombol().ambil;
    if (!s.aktif) return this.setPetunjuk(s.alasan, true);
    this.kirimAksi({ jenis: 'ambilDeck' });
  }

  /** Tentukan peran joker; bila ambigu tanya pemain. */
  private tentukanPeran(kartu: Kartu[], lanjut: (spek: SpesifikasiKartuJadi) => void) {
    const ctx = this.ctx();
    const opsi = opsiPeranJoker(kartu, ctx);
    if (opsi.length === 0) {
      const h = coba(() => validasiKartuJadi(kartu.map((k) => ({ kartu: k })), ctx));
      return this.setPetunjuk(h.ok ? 'Kombinasi tidak sah.' : h.pesan, true);
    }
    const keSpek = (h: HasilValidasiKartuJadi): SpesifikasiKartuJadi =>
      h.kartu.map((d) => ({ id: d.kartu.id, sebagai: d.pengganti ? d.sebagai : undefined }));
    if (opsi.length === 1) return lanjut(keSpek(opsi[0]));
    bukaModal(
      `<h2>Joker-nya jadi apa?</h2>
       <p class="redup">Kombinasi ini bisa dibaca lebih dari satu cara. Pilih salah satu.</p>
       <div class="rincian">${opsi
         .map((o, i) => `<button data-opsi="${i}">${esc(deskripsiKartuJadi(o))}</button>`)
         .join('')}</div>
       <button data-tutup>Batal</button>`,
      (dlg) =>
        dlg.querySelectorAll<HTMLElement>('[data-opsi]').forEach((b) =>
          b.addEventListener('click', () => {
            tutupModal();
            lanjut(keSpek(opsi[Number(b.dataset.opsi)]));
          }),
        ),
    );
  }

  private jadikanMulung() {
    if (!this.mulung) return;
    const pool = this.semuaKartuMulung();
    const kartu = pool.filter((k) => this.dipilih.has(k.id));
    if (kartu.length < 3) return this.setPetunjuk('Pilih minimal 3 kartu untuk satu kombinasi.', true);
    this.tentukanPeran(kartu, (spek) => {
      this.mulung!.kombinasi.push(spek);
      this.dipilih.clear();
      const cek = this.cekMulung();
      this.setPetunjuk(cek.ok ? 'Siap. Tekan "Konfirmasi" untuk mulung.' : cek.pesan, !cek.ok);
      this.render();
    });
  }

  private cekMulung() {
    const v = this.view!;
    const p = v.putaran!;
    return coba(() =>
      validasiMulung({
        tangan: this.tanganServer(),
        buangan: p.buangan,
        punyaKartuJadi: p.kartuJadi[this.saya].length > 0,
        jumlahPemain: v.pemain.length,
        jumlah: this.mulung!.jumlah,
        spesifikasi: this.mulung!.kombinasi,
        ctx: this.ctx(),
      }),
    );
  }

  private konfirmasiMulung() {
    if (!this.mulung) return;
    if (!this.mulung.kombinasi.length) return this.setPetunjuk('Susun dulu kombinasinya, lalu tekan "Jadikan".', true);
    const cek = this.cekMulung();
    if (!cek.ok) return this.setPetunjuk(cek.pesan, true);
    const { jumlah, kombinasi } = this.mulung;
    this.mulung = null;
    this.kirimAksi({ jenis: 'mulung', jumlah, kartuJadi: kombinasi });
  }

  private turunkan() {
    const s = this.statusTombol().turunkan;
    if (!s.aktif) return this.setPetunjuk(s.alasan, true);
    const kartu = this.tanganUrut().filter((k) => this.dipilih.has(k.id));
    this.tentukanPeran(kartu, (spek) => {
      const p = this.view!.putaran!;
      const mode = this.view!.status === 'susunAkhir' ? 'akhir' : p.sumberAmbil!;
      const cek = coba(() => validasiTurunkan(this.tanganServer(), [spek], p.kartuJadi[this.saya].length > 0, mode, this.ctx()));
      if (!cek.ok) return this.setPetunjuk(cek.pesan, true);
      this.kirimAksi({ jenis: 'turunkan', kartuJadi: [spek] });
    });
  }

  private buang() {
    const s = this.statusTombol().buang;
    if (!s.aktif) return this.setPetunjuk(s.alasan, true);
    this.kirimAksi({ jenis: 'buang', kartuId: [...this.dipilih][0] });
  }

  /** Status tiap tombol beserta alasan bila nonaktif. */
  private statusTombol() {
    const v = this.view;
    const p = v?.putaran;
    const mati = (alasan: string) => ({ aktif: false, alasan });
    const hidup = { aktif: true, alasan: '' };
    if (this.animasi) {
      const tunggu = mati('Tunggu sebentar, kartu masih bergerak.');
      return { ambil: tunggu, mulung: tunggu, turunkan: tunggu, buang: tunggu, selesai: tunggu };
    }
    if (v?.status === 'susunAkhir' && p) {
      const alasan = this.susunSaya()
        ? ''
        : this.info?.diambilAlihBot
          ? 'Waktu habis, bot menyusun kartumu.'
          : 'Kamu sudah selesai menyusun.';
      const terpilih = this.tanganServer().filter((k) => this.dipilih.has(k.id));
      let turunkanAlasan = alasan || (terpilih.length < 3 ? 'Pilih minimal 3 kartu untuk diturunkan.' : '');
      if (!turunkanAlasan && opsiPeranJoker(terpilih, this.ctx()).length === 0) {
        const h = coba(() => validasiKartuJadi(terpilih.map((k) => ({ kartu: k })), this.ctx()));
        turunkanAlasan = h.ok ? '' : h.pesan;
      }
      const tutup = mati(p.mentung ? 'Sudah ada yang mentung, tinggal menyusun kartu.' : 'Deck sudah habis.');
      return { ambil: tutup, mulung: tutup, turunkan: turunkanAlasan ? mati(turunkanAlasan) : hidup, buang: tutup, selesai: alasan ? mati(alasan) : hidup };
    }
    if (this.info?.menungguJoker.length) {
      const tunggu = mati('Tunggu semua pemain melihat joker dulu.');
      return { ambil: tunggu, mulung: tunggu, turunkan: tunggu, buang: tunggu, selesai: tunggu };
    }
    const bukan = !v || !p || v.status !== 'putaranBerjalan'
      ? 'Putaran belum berjalan.'
      : this.info?.diambilAlihBot && p.giliran === this.saya
        ? 'Waktu habis, giliranmu dijalankan bot.'
        : p.giliran !== this.saya
          ? `Sabar, sekarang gilirannya ${v.pemain[p.giliran].nama}.`
          : '';
    if (bukan) return { ambil: mati(bukan), mulung: mati(bukan), turunkan: mati(bukan), buang: mati(bukan), selesai: mati(bukan) };
    const pp = p!;
    const ambilAlasan = pp.tahap !== 'ambil' ? 'Kamu sudah ambil kartu giliran ini.' : '';
    const mulungAlasan = ambilAlasan || (pp.buangan.length === 0 ? 'Buangan masih kosong, ambil dari deck dulu.' : '');
    const mainAlasan = pp.tahap !== 'main' ? 'Ambil kartu dulu (dari deck atau mulung).' : '';
    const tangan = this.tanganServer();
    const terpilih = tangan.filter((k) => this.dipilih.has(k.id));
    let turunkanAlasan = mainAlasan || (terpilih.length < 3 ? 'Pilih minimal 3 kartu untuk diturunkan.' : '');
    let buangAlasan = mainAlasan || (terpilih.length !== 1 ? 'Pilih tepat satu kartu untuk dibuang.' : '');
    if (!buangAlasan) {
      const h = coba(() =>
        validasiBuang({
          tangan,
          punyaKartuJadi: pp.kartuJadi[this.saya].length > 0,
          sumberAmbil: pp.sumberAmbil!,
          kartuId: terpilih[0].id,
          ctx: this.ctx(),
          asJokerBolehDibuangTanpaJadi: v!.konfigurasi.asJokerBolehDibuangTanpaJadi,
        }),
      );
      if (!h.ok) buangAlasan = h.pesan;
    }
    if (!turunkanAlasan && terpilih.length >= 3 && opsiPeranJoker(terpilih, this.ctx()).length === 0) {
      const h = coba(() => validasiKartuJadi(terpilih.map((k) => ({ kartu: k })), this.ctx()));
      turunkanAlasan = h.ok ? '' : h.pesan;
    }
    return {
      ambil: ambilAlasan ? mati(ambilAlasan) : hidup,
      mulung: mulungAlasan ? mati(mulungAlasan) : hidup,
      turunkan: turunkanAlasan ? mati(turunkanAlasan) : hidup,
      buang: buangAlasan ? mati(buangAlasan) : hidup,
      selesai: mati('Belum waktunya.'),
    };
  }

  private setPetunjuk(teks: string, salah = false) {
    this.petunjuk = teks;
    this.petunjukSalah = salah;
    const el = this.elAksi.querySelector('.petunjuk');
    if (el) {
      el.textContent = teks || this.petunjukBawaan();
      el.classList.toggle('salah', salah && !!teks);
    }
  }

  private petunjukBawaan(): string {
    const v = this.view;
    const p = v?.putaran;
    if (!v || !p) return '';
    if (v.status === 'putaranSelesai') return 'Putaran selesai.';
    if (this.info?.menungguJoker.length) return 'Menunggu semua pemain melihat joker…';
    if (v.status === 'susunAkhir') {
      if (this.info?.diambilAlihBot && !p.selesaiSusun[this.saya]) return 'Waktu habis, bot menyusun kartumu.';
      if (p.selesaiSusun[this.saya]) return 'Menunggu pemain lain selesai menyusun…';
      const sebab = p.mentung ? `${p.mentung.pemain === this.saya ? 'Kamu' : v.pemain[p.mentung.pemain].nama} mentung!` : 'Deck habis!';
      return `${sebab} Turunkan kartu jadi dari tanganmu kalau ada (tanpa mulung), lalu tekan Selesai.`;
    }
    if (v.status === 'selesai') return 'Permainan selesai.';
    if (this.info?.diambilAlihBot && p.giliran === this.saya) return 'Waktu habis, bot menjalankan giliranmu.';
    if (p.giliran !== this.saya) return `Giliran ${v.pemain[p.giliran].nama}…`;
    if (this.pilihJumlah) return 'Ketuk kartu di buangan: kamu ambil kartu itu dan semua di atasnya.';
    if (this.mulung) {
      return this.mulung.kombinasi.length
        ? 'Tambah kombinasi lain, atau tekan "Konfirmasi". Ketuk kombinasi untuk membatalkannya.'
        : 'Pilih kartu dari tangan + pungutan, lalu tekan "Jadikan". Kartu bertanda emas wajib masuk kombinasi.';
    }
    if (p.tahap === 'ambil') return 'Giliranmu: ambil dari deck atau mulung.';
    const n = this.tanganServer().length;
    if (n === 1 && p.sumberAmbil === 'buangan') return 'Tinggal satu kartu: buang untuk mentung!';
    return 'Turunkan kartu jadi (opsional), lalu buang satu kartu.';
  }

  // ---------- tampilan ----------

  private render() {
    const v = this.view;
    const info = this.info;
    if (!v || !info) return;
    this.renderAtas();
    this.renderAksi();
    const idMulung = this.idTerpakaiMulung();
    const semua = this.semuaKartuMulung();
    const model: ModelMeja = {
      view: v,
      info,
      aksiTerakhir: this.aksiTerakhir,
      disembunyikan: this.disembunyikan,
      tangan: this.tanganUrut().filter((k) => !idMulung.has(k.id)),
      dipilih: this.dipilih,
      pilihJumlahMulung: this.pilihJumlah,
      bisaPungut: !this.pilihJumlah && !this.mulung && this.statusTombol().mulung.aktif,
      kartukuDiAtas: this.kartukuDiAtas(),
      berikutnya:
        this.giliranSaya() && v.putaran!.tahap === 'main'
          ? v.pemain[berikutnya(this.saya, v.putaran!.arah, v.pemain.length)].nama
          : null,
      mulung: this.mulung
        ? {
            jumlah: this.mulung.jumlah,
            idPaling: this.pungutan()[0].kartu.id,
            sisaPungutan: this.pungutan()
              .map((e) => e.kartu)
              .filter((k) => !idMulung.has(k.id)),
            kombinasi: this.mulung.kombinasi.map((spek) => ({
              kartu: spek.map((x) => ({
                kartu: semua.find((k) => k.id === x.id)!,
                label: x.sebagai ? `→${namaRank(x.sebagai.rank)}` : undefined,
              })),
            })),
          }
        : null,
    };
    this.scene.pasang(model, this);
    this.aturDetak(model.kartukuDiAtas);
  }

  private renderAtas() {
    const v = this.view!;
    const info = this.info!;
    const p = v.putaran;
    const bagian = [
      this.app.jenis === 'offline' ? 'Offline' : `Meja ${info.kode}`,
      p ? `Putaran ${p.nomor}${v.konfigurasi.batasPutaran ? `/${v.konfigurasi.batasPutaran}` : ''}` : '',
    ].filter(Boolean);
    this.elAtas.innerHTML = `
      <button class="kecil" data-a="menu" aria-label="Menu">☰</button>
      <div class="info">${esc(bagian.join(' · '))}</div>
      <button class="kecil" data-a="skor">Skor</button>
      <button class="kecil" data-a="log">Log</button>
      <button class="kecil emote-btn" data-a="emote" aria-label="Kirim emote">😀</button>
      <div class="waktu tersembunyi"><div></div></div>`;
    this.elAtas.querySelector('[data-a=menu]')!.addEventListener('click', () => this.modalMenu());
    this.elAtas.querySelector('[data-a=skor]')!.addEventListener('click', () => this.modalSkor());
    this.elAtas.querySelector('[data-a=log]')!.addEventListener('click', () => this.modalLog());
    this.elAtas.querySelector('[data-a=emote]')!.addEventListener('click', () => this.bukaPaletEmote());
    this.perbaruiWaktu();
  }

  private perbaruiWaktu() {
    const el = this.elAtas.querySelector<HTMLElement>('.waktu');
    const info = this.info;
    if (!el || !info) return;
    const batas = info.batasWaktu;
    const detik = info.pengaturan.detikGiliran;
    const st = this.view?.status;
    if (!batas || !detik || (st !== 'putaranBerjalan' && st !== 'susunAkhir')) {
      el.classList.add('tersembunyi');
      return;
    }
    const sisa = Math.max(0, batas - Date.now());
    el.classList.remove('tersembunyi');
    el.classList.toggle('mendesak', sisa < 10_000);
    (el.firstElementChild as HTMLElement).style.width = `${(100 * sisa) / (detik * 1000)}%`;
  }

  private renderAksi() {
    const v = this.view!;
    const p = v.putaran;
    const st = this.statusTombol();
    const tangan = this.tanganServer();
    const terpilih = tangan.filter((k) => this.dipilih.has(k.id));
    const tombol = (a: string, label: string, s: { aktif: boolean; alasan: string }, kelas: string) =>
      `<button data-a="${a}" class="${kelas}${s.aktif ? '' : ' mati'}" aria-disabled="${!s.aktif}" title="${esc(s.alasan)}">${label}</button>`;
    const hidup = { aktif: true, alasan: '' };
    const mati = (alasan: string) => ({ aktif: false, alasan });
    const urut = `<button data-a="urut" class="ikon" title="Urutkan kartu" aria-label="Urutkan kartu">⇅<small>${
      this.urutan === 'angka' ? 'angka' : this.urutan === 'bunga' ? 'bunga' : 'urut'
    }</small></button>`;
    const giliranku = v.status === 'putaranBerjalan' && p?.giliran === this.saya && !this.info?.menungguJoker.length;

    // Penunjuk langkah: ① Ambil → ② Turunkan (opsional) → ③ Buang.
    let langkah: string;
    if (v.status === 'susunAkhir') {
      langkah = '<span class="aktif">Susun akhir: turunkan kartu jadi, lalu Selesai</span>';
    } else if (giliranku) {
      const di = p!.tahap === 'ambil' ? 1 : 2;
      const kelas = (n: number) => (n < di ? 'selesai' : n === di || (di === 2 && n === 3) ? 'aktif' : '');
      langkah = `<span class="${kelas(1)}">① Ambil</span><i>→</i><span class="${kelas(2)}">② Turunkan <small>(boleh)</small></span><i>→</i><span class="${kelas(3)}">③ Buang</span>`;
    } else if (v.status === 'putaranBerjalan' && p) {
      langkah = `<span>Giliran ${esc(v.pemain[p.giliran].nama)}</span>`;
    } else langkah = '';

    let isi: string;
    if (v.status === 'susunAkhir') {
      isi = `${urut}${tombol('turunkan', `Turunkan${terpilih.length >= 3 ? ` ${terpilih.length} kartu` : ''}`, st.turunkan, 'kedua')}${tombol('selesai', 'Selesai', st.selesai, 'utama')}`;
    } else if (v.status !== 'putaranBerjalan') {
      isi = tombol('hasil', v.status === 'selesai' ? 'Klasemen akhir' : 'Hasil putaran', hidup, 'utama penuh');
    } else if (this.pilihJumlah) {
      isi = `${tombol('batal', 'Batal', hidup, 'kedua')}${tombol('-', 'Ketuk kartu di buangan', mati('Ketuk kartu di buangan.'), 'utama')}`;
    } else if (this.mulung) {
      const cek = this.mulung.kombinasi.length ? this.cekMulung() : { ok: false };
      const pilihMulung = this.semuaKartuMulung().filter((k) => this.dipilih.has(k.id)).length;
      isi = `${tombol('batal', '✕', hidup, 'ikon')}${tombol('jadikan', `Jadikan${pilihMulung ? ` (${pilihMulung})` : ''}`, pilihMulung >= 3 ? hidup : mati('Pilih minimal 3 kartu.'), 'kedua')}${tombol(
        'konfirmasi',
        'Konfirmasi mulung',
        cek.ok ? hidup : mati('Susun dulu kombinasinya.'),
        'utama',
      )}`;
    } else if (giliranku && p!.tahap === 'ambil') {
      isi = `${urut}${tombol('mulung', 'Mulung', st.mulung, 'kedua')}${tombol('ambil', 'Ambil deck', st.ambil, 'utama')}`;
    } else if (giliranku) {
      const mentung = tangan.length === 1 && p!.sumberAmbil === 'buangan';
      const labelBuang =
        terpilih.length === 1
          ? mentung
            ? `Mentung pakai ${labelKartu(terpilih[0])}!`
            : `Buang ${labelKartu(terpilih[0])}`
          : mentung
            ? 'Pilih kartu buat mentung'
            : 'Pilih 1 kartu buat dibuang';
      isi = `${urut}${tombol('turunkan', `Turunkan${terpilih.length >= 3 ? ` ${terpilih.length} kartu` : ''}`, st.turunkan, 'kedua')}${tombol('buang', labelBuang, st.buang, 'utama')}`;
    } else {
      const alasan = st.ambil.alasan || 'Bukan giliranmu.';
      isi = `${urut}${tombol('-', p ? `Menunggu ${esc(v.pemain[p.giliran].nama)}…` : 'Menunggu…', mati(alasan), 'utama')}`;
    }
    this.elAksi.innerHTML = `<div class="langkah">${langkah}</div><div class="petunjuk"></div><div class="tombol-aksi">${isi}</div>`;
    this.setPetunjuk(this.petunjuk, this.petunjukSalah);
    const klik: Record<string, () => void> = {
      ambil: () => this.ambilDeck(),
      mulung: () => {
        if (!st.mulung.aktif) return this.setPetunjuk(st.mulung.alasan, true);
        this.pilihJumlah = true;
        this.dipilih.clear();
        this.setPetunjuk('');
        this.render();
      },
      batal: () => {
        this.pilihJumlah = false;
        this.mulung = null;
        this.dipilih.clear();
        this.setPetunjuk('');
        this.render();
      },
      jadikan: () => this.jadikanMulung(),
      konfirmasi: () => this.konfirmasiMulung(),
      turunkan: () => this.turunkan(),
      buang: () => this.buang(),
      selesai: () => {
        if (!st.selesai.aktif) return this.setPetunjuk(st.selesai.alasan, true);
        this.kirimAksi({ jenis: 'selesaiSusun' });
      },
      urut: () => {
        this.urutan = this.urutan === 'bunga' ? 'angka' : 'bunga';
        this.render();
      },
      hasil: () => (v.status === 'selesai' ? this.modalSelesai() : this.modalHasil(v.riwayat[v.riwayat.length - 1])),
    };
    this.elAksi.querySelectorAll<HTMLElement>('[data-a]').forEach((b) =>
      b.addEventListener('click', () => {
        if (b.getAttribute('aria-disabled') === 'true') return this.setPetunjuk(b.title, true);
        klik[b.dataset.a!]?.();
      }),
    );
  }

  // ---------- emote ----------

  private bukaPaletEmote() {
    const ada = this.akar.querySelector('.palet-emote');
    if (ada) return ada.remove();
    const el = document.createElement('div');
    el.className = 'palet-emote';
    el.innerHTML = DAFTAR_EMOTE.map((e) => `<button data-emote="${esc(e)}" class="${[...e].length <= 2 ? 'emoji' : ''}">${esc(e)}</button>`).join('');
    el.querySelectorAll<HTMLElement>('[data-emote]').forEach((b) =>
      b.addEventListener('click', () => {
        this.app.kirim({ t: 'emote', isi: b.dataset.emote as Emote });
        el.remove();
      }),
    );
    this.akar.appendChild(el);
  }

  /** Emote masuk. Kalau animasi sedang berjalan, ditunda sebentar supaya tidak mendahului kejadiannya. */
  terimaEmote(kursi: number, isi: Emote) {
    if (this.animasi) {
      this.emoteTertunda.push([kursi, isi]);
      setTimeout(() => this.lepasEmoteTertunda(), 4000);
      return;
    }
    this.gelembung(kursi, isi);
  }

  private lepasEmoteTertunda() {
    for (const [kursi, isi] of this.emoteTertunda.splice(0)) this.gelembung(kursi, isi);
  }

  private gelembung(kursi: number, isi: Emote) {
    if (this.hancur) return;
    const pos = this.scene.posisiPemain(kursi);
    const dpr = window.devicePixelRatio || 1;
    const el = document.createElement('div');
    const emoji = [...isi].length <= 2;
    el.className = `gelembung${emoji ? ' emoji' : ''}${kursi === this.saya ? ' milikku' : ''}`;
    el.textContent = isi;
    const x = pos ? pos.x / dpr : window.innerWidth / 2;
    const y = pos ? pos.y / dpr : window.innerHeight / 2;
    el.style.left = `${Math.min(window.innerWidth - 60, Math.max(60, x))}px`;
    el.style.top = `${Math.max(40, y - (kursi === this.saya ? 70 : 10))}px`;
    this.akar.appendChild(el);
    bunyi('pop');
    setTimeout(() => el.remove(), 2600);
  }

  // ---------- modal ----------

  private modalHasil(h: HasilPutaran | undefined) {
    const v = this.view!;
    const info = this.info!;
    if (!h) return;
    // Pertahankan akordion yang sedang terbuka saat modal digambar ulang (misalnya ada yang voting).
    const terbuka = new Set(
      [...document.querySelectorAll<HTMLElement>('[data-hasil-rincian] details[open]')].map((el) => Number(el.dataset.pemain)),
    );
    if (!document.querySelector('[data-hasil-rincian]')) terbuka.add(this.saya);
    const baris = `<div data-hasil-rincian>${htmlRincianPutaran(h, (i) => v.pemain[i].nama, this.saya, terbuka)}</div>`;
    const cara =
      h.cara === 'deckHabis'
        ? 'Deck habis. Semua dihitung skor dasar.'
        : `${esc(v.pemain[h.pementung!].nama)} mentung pakai ${esc(h.pentungan ? namaKartu(h.pentungan) : '')} (${h.nilaiPentungan}).`;
    const min = Math.min(...v.skor);
    const kandidat = v.skor.map((s, i) => (s === min ? i : -1)).filter((i) => i >= 0);
    const arah = `Arah berikutnya: ${h.arahBerikutnya === 1 ? 'searah' : 'berbalik'}${h.cara === 'mentung' ? (h.dibalik ? ' (dibalik)' : ' (lompat, tetap)') : ''}.`;
    const host = info.kursiSaya === info.host;
    const setuju = info.setujuAkhiri.length;
    const manusia = info.kursi.filter((k) => k.jenis === 'manusia' && k.terhubung).length;
    const sayaSetuju = info.setujuAkhiri.includes(this.saya);
    const tombolLanjut = host
      ? kandidat.length > 1
        ? `<p class="redup">Skor terendah sama. Pilih pengocok berikutnya:</p>
           <div class="deret">${kandidat.map((i) => `<button data-kocok="${i}">${esc(v.pemain[i].nama)}</button>`).join('')}<button class="utama" data-kocok="acak">Acak</button></div>`
        : `<button class="utama" data-kocok="acak">Putaran berikutnya (${esc(v.pemain[kandidat[0]].nama)} ngocok)</button>`
      : `<p class="redup">Menunggu host memulai putaran berikutnya…</p>`;
    bukaModal(
      `<div data-hasil></div>
       <h2>Hasil putaran ${h.nomor}</h2>
       <p>${cara}</p>
       <p class="redup" style="margin:0">Diurutkan dari skor tertinggi. Ketuk nama untuk melihat rinciannya.</p>
       ${baris}
       <p class="redup">${arah} Pengocok berikutnya: skor terendah (${kandidat.map((i) => esc(v.pemain[i].nama)).join(', ')}).</p>
       ${tombolLanjut}
       <div class="deret">
         <button data-tutup>Lihat meja</button>
         <button data-akhiri class="${sayaSetuju ? 'bahaya' : ''}">${sayaSetuju ? 'Batal akhiri' : 'Akhiri permainan'}${manusia > 1 ? ` (${setuju}/${manusia})` : ''}</button>
       </div>`,
      (dlg) => {
        dlg.querySelectorAll<HTMLElement>('[data-kocok]').forEach((b) =>
          b.addEventListener('click', () => {
            const k = b.dataset.kocok!;
            this.app.kirim({ t: 'putaranBerikut', pengocok: k === 'acak' ? undefined : Number(k) });
          }),
        );
        dlg.querySelector('[data-akhiri]')?.addEventListener('click', () => this.app.kirim({ t: 'akhiri', setuju: !sayaSetuju }));
      },
    );
  }

  private modalJoker() {
    const p = this.view!.putaran!;
    const k = p.kartuDibuka;
    bunyi('sorak');
    bukaModal(
      `<div data-joker></div>
       <h2 style="text-align:center">Putaran ${p.nomor} · Joker</h2>
       <p class="redup" style="text-align:center;margin:0">${esc(this.view!.pemain[p.pengocok].nama)} ngocok dan membuka kartu:</p>
       ${htmlKartu(k)}
       <p style="text-align:center;margin:0">Semua kartu <b>${esc(namaRank(k.rank))}</b> jadi joker putaran ini.</p>
       <p class="redup" style="text-align:center;margin:0">Ingat baik-baik, kartu ini tidak ditampilkan lagi.</p>
       <button class="utama" data-ok>OK, sudah ingat</button>`,
      (dlg) =>
        dlg.querySelector('[data-ok]')!.addEventListener('click', () => {
          tutupModal();
          this.app.kirim({ t: 'siapJoker' });
        }),
      { bisaDitutup: false },
    );
  }

  /** Kartu teratas buangan milikku dan pemain lain sedang menimbang mau ambil apa. */
  private kartukuDiAtas(): boolean {
    const v = this.view;
    const p = v?.putaran;
    if (!v || !p || v.status !== 'putaranBerjalan' || this.info?.menungguJoker.length) return false;
    const atas = p.buangan[p.buangan.length - 1];
    return !!atas && atas.pemilik === this.saya && p.giliran !== this.saya && p.tahap === 'ambil';
  }

  /** Detak jantung selama kartumu di atas tumpukan dan lawan sedang menimbang. */
  private aturDetak(nyala: boolean) {
    if (nyala && !this.timerDetak) this.timerDetak = setInterval(() => bunyi('detak'), 950);
    if (!nyala && this.timerDetak) {
      clearInterval(this.timerDetak);
      this.timerDetak = null;
    }
  }

  private modalSelesai() {
    this.selesaiDitampilkan = true;
    const v = this.view!;
    const info = this.info!;
    const urut = v.pemain.map((pm, i) => ({ nama: pm.nama, skor: v.skor[i], i })).sort((a, b) => b.skor - a.skor);
    const alasan = { sepakat: 'Semua sepakat berhenti.', batasPutaran: 'Batas putaran tercapai.', batasSkor: 'Ada yang mencapai batas skor.' };
    const host = info.kursiSaya === info.host;
    bukaModal(
      `<div data-selesai></div>
       <h2>Klasemen akhir</h2>
       <p class="redup">${esc(v.alasanSelesai ? alasan[v.alasanSelesai] : '')} ${v.riwayat.length} putaran.</p>
       <table class="skor"><tr><th>#</th><th>Pemain</th><th>Skor</th></tr>
       ${urut.map((x, j) => `<tr><td>${j + 1}</td><td style="text-align:left">${esc(x.nama)}${x.i === this.saya ? ' (kamu)' : ''}</td><td><b>${x.skor}</b></td></tr>`).join('')}
       </table>
       <div class="deret">
         ${this.app.jenis === 'offline' ? '<button class="utama" data-a="lagi">Main lagi</button>' : host ? '<button class="utama" data-a="lagi">Main lagi (ke lobi)</button>' : ''}
         <button data-a="skor">Rincian skor</button>
         <button data-a="keluar">Ke beranda</button>
       </div>`,
      (dlg) => {
        dlg.querySelector('[data-a=lagi]')?.addEventListener('click', () => {
          tutupModal();
          if (this.app.jenis === 'offline') this.app.mainLagiOffline();
          else this.app.kirim({ t: 'mainLagi' });
        });
        dlg.querySelector('[data-a=skor]')!.addEventListener('click', () => this.modalSkor());
        dlg.querySelector('[data-a=keluar]')!.addEventListener('click', () => {
          tutupModal();
          this.app.keluarMeja();
        });
      },
      { bisaDitutup: false },
    );
  }

  private modalSkor(tab: 'peringkat' | 'riwayat' = 'peringkat') {
    const v = this.view!;
    const nama = (i: number) => v.pemain[i].nama;
    bukaModal(
      `<h2>Papan skor</h2>
       <div class="tab" role="tablist">
         <button role="tab" data-tab="peringkat" class="${tab === 'peringkat' ? 'aktif' : ''}">Peringkat</button>
         <button role="tab" data-tab="riwayat" class="${tab === 'riwayat' ? 'aktif' : ''}">Riwayat putaran</button>
       </div>
       <div class="isi-tab">${
         tab === 'peringkat'
           ? htmlPeringkat(v.pemain.map((p) => p.nama), v.skor, v.riwayat, this.saya)
           : htmlRiwayat(nama, v.riwayat, this.saya)
       }</div>
       <button data-tutup>Tutup</button>`,
      (dlg) =>
        dlg.querySelectorAll<HTMLElement>('[data-tab]').forEach((b) =>
          b.addEventListener('click', () => this.modalSkor(b.dataset.tab as 'peringkat' | 'riwayat')),
        ),
    );
  }

  private modalLog() {
    const v = this.view!;
    bukaModal(
      `<h2>Log permainan</h2>
       <div class="log">${[...v.log].reverse().map((l) => `<div><span class="redup">P${l.putaran}</span> ${esc(l.pesan)}</div>`).join('')}</div>
       <button data-tutup>Tutup</button>`,
    );
  }

  private modalMenu() {
    const offline = this.app.jenis === 'offline';
    bukaModal(
      `<h2>Menu</h2>
       ${offline ? '<p class="redup">Permainan offline tersimpan otomatis. Kamu bisa lanjut kapan saja dari beranda.</p>' : `<p class="redup">Kode meja: <b>${esc(this.info?.kode)}</b>. Kalau kamu keluar saat main, kursimu diteruskan bot.</p>`}
       ${
         offline || this.info?.kursiSaya === this.info?.host
           ? `<p class="redup" style="margin:0">Tempo bot</p>
              <div class="deret">${(['santai', 'normal', 'cepat'] as const)
                .map(
                  (t) =>
                    `<button data-tempo="${t}" class="${(this.info?.pengaturan.tempoBot ?? 'santai') === t ? 'utama' : ''}">${t[0].toUpperCase() + t.slice(1)}</button>`,
                )
                .join('')}</div>`
           : ''
       }
       <div class="deret">
         <button data-a="suara">${simpan.pengaturanEfek().suara ? '🔊 Suara: nyala' : '🔇 Suara: mati'}</button>
         <button data-a="getar">${simpan.pengaturanEfek().getar ? '📳 Getar: nyala' : '📴 Getar: mati'}</button>
       </div>
       <button data-a="layar">Layar penuh</button>
       <button data-a="aturan">Aturan singkat</button>
       <button data-a="keluar" class="bahaya">${offline ? 'Simpan & ke beranda' : 'Keluar meja'}</button>
       <button data-tutup>Kembali</button>`,
      (dlg) => {
        dlg.querySelector('[data-a=layar]')!.addEventListener('click', () => {
          if (document.fullscreenElement) void document.exitFullscreen();
          else void document.documentElement.requestFullscreen?.().catch(() => toast('Layar penuh tidak didukung di sini.'));
          tutupModal();
        });
        dlg.querySelector('[data-a=aturan]')!.addEventListener('click', () => modalAturan());
        const ubahEfek = (kunci: 'suara' | 'getar') => {
          const e = simpan.pengaturanEfek();
          simpan.setPengaturanEfek({ ...e, [kunci]: !e[kunci] });
          this.modalMenu();
          if (kunci === 'suara' && !e.suara) bunyi('giliran');
          if (kunci === 'getar' && !e.getar) getar(60);
        };
        dlg.querySelector('[data-a=suara]')!.addEventListener('click', () => ubahEfek('suara'));
        dlg.querySelectorAll<HTMLElement>('[data-tempo]').forEach((b) =>
          b.addEventListener('click', () => {
            const tempoBot = b.dataset.tempo as 'santai' | 'normal' | 'cepat';
            this.app.kirim({ t: 'pengaturan', pengaturan: { tempoBot } });
            if (offline) simpan.setPengaturanOffline({ ...simpan.pengaturanOffline(), tempoBot });
            dlg.querySelectorAll<HTMLElement>('[data-tempo]').forEach((x) => x.classList.toggle('utama', x === b));
            toast(`Tempo bot: ${tempoBot}`);
          }),
        );
        dlg.querySelector('[data-a=getar]')!.addEventListener('click', () => ubahEfek('getar'));
        dlg.querySelector('[data-a=keluar]')!.addEventListener('click', () => {
          tutupModal();
          if (!offline) this.app.kirim({ t: 'keluar' });
          this.app.keluarMeja();
        });
      },
    );
  }
}

const SIMBOL_HTML = { love: '♥', wajik: '♦', waru: '♠', kriting: '♣' } as const;

/** Kartu besar dalam HTML (untuk modal). */
function htmlKartu(k: Kartu): string {
  const merah = k.bunga === 'love' || k.bunga === 'wajik';
  const r = esc(namaRank(k.rank) === 'As' ? 'A' : namaRank(k.rank));
  const b = SIMBOL_HTML[k.bunga];
  return `<div class="kartu-html${merah ? ' merah' : ''}"><span class="pojok">${r}<br>${b}</span><span class="tengah">${b}</span><span class="pojok bawah">${r}<br>${b}</span></div>`;
}

export function modalAturan() {
  bukaModal(
    `<h2>Aturan singkat</h2>
     <div class="redup" style="line-height:1.5">
     <p><b>Giliran:</b> ambil 1 kartu dari deck <i>atau</i> mulung, turunkan kartu jadi (opsional), lalu buang 1 kartu.</p>
     <p><b>Mulung:</b> ambil 1 sampai (jumlah pemain − 1) kartu teratas buangan. Kartu paling bawah yang dipungut wajib langsung dijadikan. Di kombinasi itu, modal dari tangan ≥ jumlah pungutan dan minimal satu kartu biasa.</p>
     <p><b>Kartu jadi:</b> seri angka 2–10 satu bunga (3–9 kartu), seri J-Q-K satu bunga, atau kembar As beda bunga (3 As butuh kartu jadi lain).</p>
     <p><b>Joker:</b> semua kartu seangka dengan kartu yang dibuka. Bisa menggantikan kartu angka (bukan Londo/As), maksimal sama dengan kartu biasa dan nggak boleh dempet. Buang joker = −25.</p>
     <p><b>Mentung:</b> buang kartu terakhir, hanya kalau giliran itu mulung. Pemilik kartu pungutan yang dipakai jadi kepentung.</p>
     <p><b>Nilai:</b> 2–10 = 5, J/Q/K = 10, As = 15, joker di tangan = 25. Pentungan ×10, joker = 250.</p>
     </div>
     <button data-tutup>Tutup</button>`,
  );
}
