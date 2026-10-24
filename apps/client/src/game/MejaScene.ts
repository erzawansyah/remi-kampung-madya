// Scene meja. Tata letak dihitung oleh tataMeja.ts (murni) setiap model dipasang, lalu objek Phaser
// DISAMAKAN dengan hasilnya per kunci (rekonsiliasi), bukan dihancurkan semua:
// - beberapa pasang() dalam satu frame digabung jadi satu penggambaran (di update()),
//   tapi posisiKartu()/posisiPemain()/kotakLayar() sudah benar SEGERA setelah pasang();
// - kartu yang berpindah tempat (pilih, susun ulang, ukuran berubah) meluncur dengan pegas;
// - kartu yang sedang diseret tidak terganggu penggambaran ulang dari luar.
//
// Setiap kartu digerakkan lewat objek data (ObjKartu: x, y, sudut, tinggi, ...) yang disalin ke
// Image-nya di update(). Tween hanya menyentuh objek data, jadi tidak pernah memanggil method
// Image yang sudah dihancurkan (penyebab crash loop di Phaser 4).
//
// Semua ukuran dalam piksel perangkat (piksel CSS × devicePixelRatio). Info rahasia: joker di tangan
// tidak diberi tanda apa pun, angka joker tidak pernah digambar, buangan hanya (n − 1) teratas.

import Phaser from 'phaser';
import type { Kartu, ViewPemain } from '@remi/engine';
import type { InfoMeja } from '@remi/meja';
import {
  daftarkanTeksturKartu,
  KUNCI_BAYANGAN,
  KUNCI_FOKUS,
  KUNCI_SOROT,
  kunciKartu,
  panaskanTeksturKartu,
  RASIO_KARTU,
  ukuranBayangan,
  ukuranSorot,
} from './kartuGrafis';
import { acakId, geserBayangan, hitungTataMeja, IKON_KARTU, LAPIS, lebarIkonKartu, LETAK_LABEL_KARTU, PAD_LABEL_KARTU, TINGGI_TANGAN, ukuranLabelKartu, type AksiKetuk, type JenisSorot, type KartuTata, type Kotak, type TataMeja, type TeksTata, type Titik } from './tataMeja';
import { bacaPalet, type PaletMeja } from './warnaMeja';
import { DURASI, EASE, durasi, easePegas, efekHemat, kurangiGerak } from '../gerak';
import { preferensi, saatPreferensiBerubah } from '../preferensi';
import { bunyi, getar } from '../efek/suara';

export type { Titik } from './tataMeja';

export interface KombinasiTertunda {
  kartu: { kartu: Kartu; label?: string }[];
}

export interface ModelMeja {
  view: ViewPemain;
  info: InfoMeja;
  /** Tangan dalam urutan pilihan pemain, tanpa kartu yang sedang dipakai kombinasi mulung. */
  tangan: Kartu[];
  dipilih: ReadonlySet<string>;
  /** Mode memilih jumlah kartu yang dipungut. */
  pilihJumlahMulung: boolean;
  /** Sedang menyusun mulung. */
  mulung: null | {
    jumlah: number;
    /** Kartu pungutan yang belum dipakai kombinasi. */
    sisaPungutan: Kartu[];
    idPaling: string;
    kombinasi: KombinasiTertunda[];
  };
  /** Teks aksi terakhir tiap pemain (misalnya "buang 7♥"), tampil sebentar di panelnya. */
  aksiTerakhir: Record<number, string>;
  /** Kartu yang sedang dianimasikan: disembunyikan dari tangan/buangan supaya tidak terlihat dobel. */
  disembunyikan: ReadonlySet<string>;
  /** Giliranku dan tahap ambil: kartu di buangan bisa langsung diketuk untuk mungut. */
  bisaPungut: boolean;
  /** Kartu teratas buangan milikku dan lawan sedang menimbang: tampilkan ketegangan. */
  kartukuDiAtas: boolean;
  /** Nama pemain berikutnya (pengingat saat aku akan membuang); null bila tidak relevan. */
  berikutnya: string | null;
  /**
   * Sasaran fokus keyboard: id kartu di tangan/pungutan, 'deck', 'buangan', atau null. Digambar dengan cincin
   * fokus putih bergaris luar (beda dari cincin emas 'bisa'); 'buangan' di kartu teratas, atau bingkai
   * area buangan saat kosong (begitu juga deck yang habis).
   */
  fokus?: string | null;
}

/** Area meja yang bisa disorot (mis. oleh tutorial). */
export type AreaMeja = 'deck' | 'buangan' | 'tangan' | 'kartuJadiSaya' | 'panel';

/** Kotak di layar dalam piksel CSS (relatif viewport). */
export interface KotakLayar {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface AksiAdegan {
  ketukKartu(id: string): void;
  ketukDeck(): void;
  ketukBuangan(jumlah: number): void;
  geserKartu(id: string, indeksBaru: number): void;
  ketukKombinasi(indeks: number): void;
  /**
   * Kartu tangan diseret dan dilepas di atas tumpukan buangan.
   * - false: buang ditolak (kartu langsung kembali ke tangan dengan goyang + kilat merah);
   * - 'abaikan': lepas diabaikan tanpa dianggap salah (mis. aksi sebelumnya masih menunggu jawaban),
   *   kartu kembali ke tangan dengan tenang, tanpa goyang;
   * - true/void: aksi dikirim, kartu menunggu di titik lepas sampai peristiwa 'buang' diputar.
   */
  lepasKeBuangan(id: string): 'abaikan' | boolean | void;
  /**
   * Aksi terakhir masih dikirim (bar aksi terkunci menunggu jawaban). Selama itu kartu yang dilepas di
   * buangan tetap menunggu di titik lepas, tidak dikembalikan ke tangan seolah-olah ditolak.
   */
  sedangMengirim?(): boolean;
}

const FONT = 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';
const KUNCI_TITIK = 'kilau-titik';
/**
 * Batas tunggu kartu yang dilepas di buangan sebelum dikembalikan ke tangan (ms). Selama aksinya masih
 * dikirim (AksiAdegan.sedangMengirim, kunci bar aksi), kartu tetap menunggu (dicek tiap CEK_LEPAS_MS),
 * paling lama BATAS_LEPAS_MAKS (cadangan; kunci bar aksi sendiri lepas paling lambat 10 dtk).
 */
const BATAS_LEPAS = 2500;
const CEK_LEPAS_MS = 250;
const BATAS_LEPAS_MAKS = 12_000;

/** Efek sesaat pada kartu (ditween terpisah supaya tidak ikut terhenti saat kartu digerakkan). */
interface EfekKartu {
  /** Hover mouse 0..1 (kartu sedikit naik). */
  hover: number;
  /** Ditekan 0..1 (kartu sedikit mengecil). */
  tekan: number;
  /** Geser horizontal sesaat (goyang tolak), piksel. */
  goyang: number;
  /** Kilat merah 0..1. */
  merah: number;
}

interface ObjKartu {
  img: Phaser.GameObjects.Image;
  bay: Phaser.GameObjects.Image;
  sorot: Phaser.GameObjects.Image | null;
  label: Phaser.GameObjects.Text | null;
  /** Muka kartu yang sedang tampil (null = punggung). */
  kartu: Kartu | null;
  /** Lebar terbesar yang akan dicapai (memilih tingkat tekstur). */
  wTekstur: number;
  x: number;
  y: number;
  w: number;
  sudut: number;
  skala: number;
  tinggi: number;
  alpha: number;
  /** Faktor lebar saat dibalik (1 = normal, 0 = tepat menyamping). */
  lebarX: number;
  /** Penggelapan saat dibalik 0..1. */
  gelap: number;
  lapis: number;
  efek: EfekKartu;
  jenisSorot: JenisSorot | null;
  /** Data tata letak terakhir (hanya objek kelolaan). */
  data: KartuTata | null;
  /** 'seret' = sedang diseret, 'lepas' = menunggu di titik lepas buangan. Posisi tidak diatur tata letak. */
  dikunci: null | 'seret' | 'lepas';
  hidup: boolean;
}

interface Lepas {
  o: ObjKartu;
  titik: Titik;
  timer: ReturnType<typeof setTimeout>;
}

const jepit = (x: number, a: number, b: number) => Math.min(b, Math.max(a, x));
const lerp = (a: number, b: number, u: number) => a + (b - a) * u;

export class MejaScene extends Phaser.Scene {
  private model: ModelMeja | null = null;
  private aksi: AksiAdegan | null = null;
  /** Ruang yang dipakai HTML di atas/bawah (px CSS). Diatur kontrolMeja lewat aturRuang(). */
  ruangAtas = 52;
  ruangBawah = 138;
  private tata: TataMeja = hitungTataMeja(null, { W: 1, H: 1, d: 1, atasCss: 0, bawahCss: 0, skalaTeks: 1 });
  private kotor = false;
  /** Gambar berikutnya boleh meluncurkan kartu ke posisi baru (false: langsung, mis. setelah resize). */
  private transisi = false;
  private palet!: PaletMeja;
  private kelola = new Map<string, ObjKartu>();
  private bebas = new Set<ObjKartu>();
  private objDariImg = new WeakMap<Phaser.GameObjects.Image, ObjKartu>();
  /**
   * Objek animasi yang sudah mendarat: dihancurkan setelah meja tergambar ulang dengan model yang
   * dipasang SESUDAH objek itu diserahkan (kartu aslinya sudah tampil), jadi tidak ada kedip.
   */
  private tundaHancur: { o: ObjKartu; nomor: number }[] = [];
  /** Bertambah setiap pasang()/tataUlang(). */
  private nomorTata = 0;
  /** Teks kanvas per kunci; `ikon`: ikon punggung kartu di depan teks (TeksTata.ikon). */
  private teksObj = new Map<string, { t: Phaser.GameObjects.Text; ikon?: Phaser.GameObjects.Graphics; tanda: string; denyut: boolean }>();
  private gStatis!: Phaser.GameObjects.Graphics;
  private gDenyut!: Phaser.GameObjects.Graphics;
  private gKilau!: Phaser.GameObjects.Graphics;
  private seret: { o: ObjKartu; id: string; xLalu: number } | null = null;
  private diAtasBuangan = false;
  private tekan: string | null = null;
  private lepas = new Map<string, Lepas>();
  private hitungTerbang = 0;
  private lepasPreferensi: (() => void) | null = null;
  private batalPanaskan: (() => void) | null = null;

  constructor() {
    super('meja');
  }

  create() {
    this.palet = bacaPalet();
    daftarkanTeksturKartu(this.textures);
    // Muka kartu dibuat bertahap saat senggang (bukan 53 tekstur sekaligus di create → jank awal).
    this.batalPanaskan = panaskanTeksturKartu(this.textures);
    this.buatTeksturTitik();
    this.gStatis = this.add.graphics().setDepth(LAPIS.panel);
    this.gDenyut = this.add.graphics().setDepth(LAPIS.panel + 0.5);
    this.gKilau = this.add.graphics().setDepth(LAPIS.panel + 0.6);
    this.input.dragDistanceThreshold = 10 * this.dpr();
    this.input.on(Phaser.Input.Events.GAME_OUT, () => this.lepasHover());
    this.input.on(Phaser.Input.Events.POINTER_UP, () => (this.tekan = null));
    this.scale.on(Phaser.Scale.Events.RESIZE, () => {
      this.input.dragDistanceThreshold = 10 * this.dpr();
      this.tataUlang(false);
    });
    this.lepasPreferensi = saatPreferensiBerubah(() => {
      // Ganti warna kartu (dua/empat) atau ukuran teks: gambar ulang tekstur & tata letak.
      daftarkanTeksturKartu(this.textures, { ulang: true });
      this.tataUlang(false);
    });
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.bersihkan());
    this.events.once(Phaser.Scenes.Events.DESTROY, () => this.bersihkan());
    this.tataUlang(false);
  }

  private bersihkan() {
    this.lepasPreferensi?.();
    this.lepasPreferensi = null;
    this.batalPanaskan?.();
    this.batalPanaskan = null;
    for (const l of this.lepas.values()) clearTimeout(l.timer);
    this.lepas.clear();
  }

  private dpr() {
    return window.devicePixelRatio || 1;
  }

  /** Pasang model baru. Tata letak dihitung sekarang; objek digambar di frame berikut (digabung). */
  pasang(model: ModelMeja | null, aksi: AksiAdegan) {
    this.model = model;
    this.aksi = aksi;
    if (!model) {
      this.batalkanSemuaLepas();
      // Meja dilepas: sorotan area lepas buangan tidak boleh tertinggal menyala.
      this.diAtasBuangan = false;
    }
    if (this.sys.isActive()) this.tataUlang(true);
  }

  /** Atur ruang yang dipakai bar HTML atas/bawah (piksel CSS), lalu tata ulang meja. */
  aturRuang(atasCss: number, bawahCss: number): void {
    if (atasCss === this.ruangAtas && bawahCss === this.ruangBawah) return;
    this.ruangAtas = atasCss;
    this.ruangBawah = bawahCss;
    if (this.sys.isActive()) this.tataUlang(true);
  }

  private skalaTeks(W: number, H: number, d: number) {
    const minCss = Math.min(W, H) / d;
    return jepit(minCss / 430, 1, 1.3) * (preferensi().ukuranTeks === 'besar' ? 1.15 : 1);
  }

  private tataUlang(transisi: boolean) {
    const W = this.scale.width;
    const H = this.scale.height;
    const d = this.dpr();
    this.tata = hitungTataMeja(this.model, { W, H, d, atasCss: this.ruangAtas, bawahCss: this.ruangBawah, skalaTeks: this.skalaTeks(W, H, d) });
    // Transisi hanya kalau sudah pernah tergambar; resize/preferensi langsung pindah.
    this.transisi = this.transisi && transisi;
    this.nomorTata++;
    this.kotor = true;
  }

  // ---------------------------------------------------------------------------------------------
  // Posisi (piksel perangkat) — sudah benar segera setelah pasang()
  // ---------------------------------------------------------------------------------------------

  /** Posisi pemain di layar: panel lawan, atau tangan sendiri. */
  posisiPemain(pemain: number): Titik | undefined {
    return pemain === (this.model?.view.saya ?? -1) ? this.tata.titik.tangan : this.tata.titik.panel.get(pemain);
  }

  /** Posisi satu kartu (di tangan saya, buangan, pungutan, atau kartu jadi), kalau sedang terlihat. */
  posisiKartu(id: string): Titik | undefined {
    return this.tata.titik.kartu.get(id);
  }

  /** Titik tempat kartu tangan dilepas di atas buangan (lewat seret), kalau ada: asal animasi buang. */
  posisiLepas(id: string): Titik | undefined {
    return this.lepas.get(id)?.titik;
  }

  get posisiDeck() {
    return this.tata.titik.deck;
  }

  get posisiBuangan() {
    return this.tata.titik.buangan;
  }

  /** Kotak area meja dalam piksel CSS relatif viewport (untuk tutorial/sorotan). `indeks` = pemain untuk 'panel'. */
  kotakLayar(area: AreaMeja, indeks?: number): KotakLayar | null {
    const a = this.tata.area;
    const saya = this.model?.view.saya ?? -1;
    const k: Kotak | undefined =
      area === 'deck'
        ? a.deck
        : area === 'buangan'
          ? a.buangan
          : area === 'tangan'
            ? a.tangan
            : area === 'kartuJadiSaya'
              ? a.kartuJadiSaya
              : indeks === undefined
                ? undefined
                : indeks === saya
                  ? a.tangan
                  : a.panel.get(indeks);
    if (!k || !this.game?.canvas) return null;
    const r = this.game.canvas.getBoundingClientRect();
    const f = r.width / Math.max(1, this.scale.width);
    return { x: r.left + k.x * f, y: r.top + k.y * f, w: k.w * f, h: k.h * f };
  }

  // ---------------------------------------------------------------------------------------------
  // Objek kartu
  // ---------------------------------------------------------------------------------------------

  private buatObj(kartu: Kartu | null, x: number, y: number, w: number, wTekstur: number, lapis: number): ObjKartu {
    const img = this.add.image(x, y, kunciKartu(this, kartu, wTekstur)).setOrigin(0.5).setDepth(lapis);
    const bay = this.add.image(x, y, KUNCI_BAYANGAN).setOrigin(0.5).setDepth(lapis - 0.004);
    const o: ObjKartu = {
      img,
      bay,
      sorot: null,
      label: null,
      kartu,
      wTekstur,
      x,
      y,
      w,
      sudut: 0,
      skala: 1,
      tinggi: 0,
      alpha: 1,
      lebarX: 1,
      gelap: 0,
      lapis,
      efek: { hover: 0, tekan: 0, goyang: 0, merah: 0 },
      jenisSorot: null,
      data: null,
      dikunci: null,
      hidup: true,
    };
    this.objDariImg.set(img, o);
    this.sinkron(o, 0);
    return o;
  }

  /** Objek animasi (tidak dikelola tata letak). */
  private buatBebas(kartu: Kartu | null, t: Titik, wTekstur: number, lapis: number = LAPIS.animasi): ObjKartu {
    const o = this.buatObj(kartu, t.x, t.y, t.w, wTekstur, lapis + (this.hitungTerbang++ % 50) * 0.01);
    o.sudut = t.sudut ?? 0;
    this.bebas.add(o);
    this.sinkron(o, 0);
    return o;
  }

  private hancurkan(o: ObjKartu) {
    if (!o.hidup) return;
    o.hidup = false;
    this.tweens.killTweensOf(o);
    this.tweens.killTweensOf(o.efek);
    o.img.destroy();
    o.bay.destroy();
    o.sorot?.destroy();
    o.label?.destroy();
    this.bebas.delete(o);
  }

  /** Objek animasi yang sudah mendarat: hancurkan setelah meja tergambar (atau paling lama 200 ms). */
  private serahkan(o: ObjKartu) {
    if (!o.hidup) return;
    this.tundaHancur.push({ o, nomor: this.nomorTata });
    setTimeout(() => this.hancurkan(o), 250);
  }

  private gantiMuka(o: ObjKartu, kartu: Kartu | null, wTekstur = o.wTekstur) {
    o.kartu = kartu;
    o.wTekstur = wTekstur;
    const kunci = kunciKartu(this, kartu, wTekstur);
    if (o.img.texture.key !== kunci) o.img.setTexture(kunci);
  }

  private aturSorot(o: ObjKartu, jenis: JenisSorot | null) {
    o.jenisSorot = jenis;
    if (!jenis) {
      o.sorot?.setVisible(false);
      return;
    }
    // Fokus keyboard: cincin putih tebal bergaris luar, tanpa denyut. Terpilih: cincin biru.
    // Wajib/bisa: cincin emas (berdenyut untuk 'bisa').
    const kunci = jenis === 'fokus' ? KUNCI_FOKUS : KUNCI_SOROT;
    if (!o.sorot) o.sorot = this.add.image(o.x, o.y, kunci).setOrigin(0.5);
    else if (o.sorot.texture.key !== kunci) o.sorot.setTexture(kunci);
    // Cincin tepat di atas kartunya sendiri (di bawah tetangga yang menumpuk), supaya tidak pernah menimpa
    // indeks kartu lain. Kartu tangan yang difokus dinaikkan sedikit oleh tataMeja, jadi cincinnya tetap
    // jelas terlihat di atas kipas.
    o.sorot.setVisible(true).setDepth(o.img.depth + 0.004);
    if (jenis === 'pilih') o.sorot.setTint(this.palet.info).setTintMode(Phaser.TintModes.FILL);
    else o.sorot.clearTint();
  }

  private aturLabel(o: ObjKartu, label: KartuTata['label']) {
    if (!label) {
      o.label?.setVisible(false);
      return;
    }
    const d = this.tata.d;
    const ukuran = ukuranLabelKartu(o.w, d);
    if (!o.label) o.label = this.add.text(0, 0, '', { fontFamily: FONT, fontStyle: 'bold' });
    const latar = label.gaya === 'emas' ? '#f2c14e' : '#2f7fd1';
    const warna = label.gaya === 'emas' ? this.palet.teks.gelap : '#ffffff';
    if (o.label.text !== label.isi || o.label.style.fontSize !== `${Math.round(ukuran)}px`) {
      o.label.setStyle({ fontSize: `${Math.round(ukuran)}px`, color: warna, backgroundColor: latar });
      o.label.setPadding(Math.round(PAD_LABEL_KARTU * d), 0, Math.round(PAD_LABEL_KARTU * d), 0).setText(label.isi);
    }
    o.label.setVisible(true).setDepth(o.img.depth + 0.005).setOrigin(LETAK_LABEL_KARTU[label.posisi].ox, 0.5);
    o.label.setData('posisi', label.posisi);
  }

  /** Salin keadaan data ke Image, bayangan, cincin, dan label. Dipanggil tiap frame. */
  private sinkron(o: ObjKartu, waktu: number) {
    const e = o.efek;
    const s = o.skala * (1 - 0.035 * e.tekan) * (1 + 0.03 * e.hover);
    const w = o.w * s;
    const h = w * RASIO_KARTU;
    const x = o.x + e.goyang;
    // Kartu tangan yang sudah terangkat (terpilih) tidak naik lagi saat di-hover: ruang di atas tangan
    // hanya dicadangkan untuk cincin sorotnya (tataMeja.ruangSorotTangan), supaya label di atasnya terbaca.
    const naikHover = 0.07 * jepit((TINGGI_TANGAN.dipilih - o.tinggi) / (TINGGI_TANGAN.dipilih - TINGGI_TANGAN.biasa), 0, 1);
    const y = o.y - e.hover * h * naikHover;
    const lx = Math.max(0.001, o.lebarX);
    o.img.setPosition(x, y).setAngle(o.sudut).setDisplaySize(w * lx, h * (1 + 0.05 * (1 - lx))).setAlpha(o.alpha);
    if (e.merah > 0.001 || o.gelap > 0.001) {
      const g = 255 - o.gelap * 95;
      o.img.setTint(Phaser.Display.Color.GetColor(g, g - e.merah * 95, g - e.merah * 95));
    } else if (o.img.isTinted) o.img.clearTint();
    // Bayangan: makin tinggi kartu, makin jauh, makin lebar, makin pudar.
    const t = jepit(o.tinggi + 0.3 * e.hover, 0, 1.2);
    const ub = ukuranBayangan(w);
    const gb = geserBayangan(w, h, t);
    o.bay
      .setPosition(x + gb.dx, y + gb.dy)
      .setAngle(o.sudut)
      .setDisplaySize(ub.w * lx * gb.skala, ub.h * gb.skala)
      .setAlpha(o.alpha * o.alpha * (0.4 - 0.15 * t) * (0.4 + 0.6 * lx));
    if (o.sorot && o.jenisSorot) {
      const us = ukuranSorot(w);
      const denyut = o.jenisSorot === 'bisa' && !efekHemat() ? 0.6 + 0.4 * Math.sin((waktu / 1000) * Math.PI * 1.6) : 1;
      o.sorot.setPosition(x, y).setAngle(o.sudut).setDisplaySize(us.w * lx, us.h).setAlpha(o.alpha * denyut);
    }
    if (o.label?.visible) {
      const l = LETAK_LABEL_KARTU[o.label.getData('posisi') as keyof typeof LETAK_LABEL_KARTU];
      o.label.setPosition(x + w * l.dx, y + h * l.dy).setAlpha(o.alpha);
    }
  }

  // ---------------------------------------------------------------------------------------------
  // Penggambaran (rekonsiliasi)
  // ---------------------------------------------------------------------------------------------

  override update(waktu: number, delta: number) {
    if (this.kotor) this.gambar();
    this.perbaruiSeret(delta);
    this.gambarDinamis(waktu);
    for (const o of this.kelola.values()) this.sinkron(o, waktu);
    for (const o of this.bebas) this.sinkron(o, waktu);
  }

  private gambar() {
    this.kotor = false;
    const t = this.tata;
    const d = t.d;
    const pakaiTransisi = this.transisi && !document.hidden;
    const lama = durasi(DURASI.cepat * 1.7);
    const ease = kurangiGerak() ? EASE.keluar : easePegas(1, 1.5);

    // ---- hiasan statis ----
    const g = this.gStatis.clear();
    const gd = this.gDenyut.clear();
    for (const h of t.hias) {
      const k = h.kotak;
      if (h.jenis === 'panel') {
        g.fillStyle(0x000000, h.aktif ? 0.34 : 0.22).fillRoundedRect(k.x, k.y, k.w, k.h, 10 * d);
        if (h.aktif) g.lineStyle(2 * d, this.palet.emas, 1).strokeRoundedRect(k.x, k.y, k.w, k.h, 10 * d);
        else g.lineStyle(1 * d, 0xffffff, 0.07).strokeRoundedRect(k.x, k.y, k.w, k.h, 10 * d);
      } else if (h.jenis === 'bingkai') {
        g.lineStyle(h.tebal * d, h.warna === 'hijau' ? this.palet.positif : this.palet.emas, 1).strokeRoundedRect(k.x, k.y, k.w, k.h, 6 * d);
      } else if (h.jenis === 'slot') {
        g.fillStyle(0x000000, 0.14).fillRoundedRect(k.x, k.y, k.w, k.h, 7 * d);
        g.lineStyle(1.5 * d, 0xffffff, 0.16).strokeRoundedRect(k.x, k.y, k.w, k.h, 7 * d);
      } else if (h.jenis === 'fokus') {
        // Bingkai fokus keyboard (area kosong): sama gayanya dengan cincin fokus kartu.
        const p = 5 * d;
        g.lineStyle(5 * d, 0x080e0a, 0.95).strokeRoundedRect(k.x - p, k.y - p, k.w + 2 * p, k.h + 2 * p, 10 * d);
        g.lineStyle(3 * d, 0xffffff, 1).strokeRoundedRect(k.x - p, k.y - p, k.w + 2 * p, k.h + 2 * p, 10 * d);
      } else {
        gd.lineStyle(3 * d, this.palet.sorakMerah, 1).strokeRoundedRect(k.x, k.y, k.w, k.h, 10 * d);
      }
    }

    // ---- kartu ----
    const ada = new Set<string>();
    for (const k of t.kartu) {
      ada.add(k.kunci);
      let o = this.kelola.get(k.kunci);
      if (!o) {
        o = this.buatObj(k.kartu, k.x, k.y, k.w, k.w * 1.1, k.lapis);
        o.sudut = k.sudut;
        o.tinggi = k.tinggi;
        o.alpha = k.alpha;
        this.pasangInput(o);
        this.kelola.set(k.kunci, o);
      } else {
        const wT = k.w * 1.1;
        if (o.kartu?.id !== k.kartu?.id || Math.abs(wT - o.wTekstur) > o.wTekstur * 0.25) this.gantiMuka(o, k.kartu, wT);
        if (!o.dikunci) {
          const pindah = Math.abs(o.x - k.x) + Math.abs(o.y - k.y) + Math.abs(o.w - k.w) + Math.abs(o.sudut - k.sudut) > 0.5 * d || o.skala !== 1;
          if (pindah && pakaiTransisi) {
            this.tweens.killTweensOf(o);
            this.tweens.add({ targets: o, x: k.x, y: k.y, w: k.w, sudut: k.sudut, skala: 1, tinggi: k.tinggi, alpha: k.alpha, duration: lama, ease });
          } else if (pindah) {
            this.tweens.killTweensOf(o);
            Object.assign(o, { x: k.x, y: k.y, w: k.w, sudut: k.sudut, skala: 1, tinggi: k.tinggi, alpha: k.alpha });
          } else if (Math.abs(o.tinggi - k.tinggi) > 0.01 || Math.abs(o.alpha - k.alpha) > 0.01) {
            this.tweens.add({ targets: o, tinggi: k.tinggi, alpha: k.alpha, duration: durasi(DURASI.cepat) });
          }
        }
      }
      o.data = k;
      if (!o.dikunci) {
        o.lapis = k.lapis;
        o.img.setDepth(k.lapis);
        o.bay.setDepth(k.lapis - 0.004);
      }
      this.aturSorot(o, k.sorot ?? null);
      this.aturLabel(o, k.label);
      this.aturInteraksi(o, k);
    }
    for (const [kunci, o] of this.kelola) {
      if (ada.has(kunci)) continue;
      if (o.dikunci === 'seret') {
        // Kartu yang sedang diseret hilang dari tata letak (mis. bot mengambil alih giliran, putaran
        // berganti): seretnya batal, sorotan area lepas buangan ikut padam.
        this.seret = null;
        this.diAtasBuangan = false;
      }
      if (o.dikunci === 'lepas' && o.data?.id) this.hapusLepas(o.data.id);
      this.hancurkan(o);
      this.kelola.delete(kunci);
    }

    // ---- teks ----
    const adaTeks = new Set<string>();
    for (const tk of t.teks) {
      adaTeks.add(tk.kunci);
      this.aturTeks(tk);
    }
    for (const [kunci, x] of this.teksObj) {
      if (adaTeks.has(kunci)) continue;
      x.t.destroy();
      x.ikon?.destroy();
      this.teksObj.delete(kunci);
    }

    this.tundaHancur = this.tundaHancur.filter(({ o, nomor }) => {
      if (nomor < this.nomorTata || !o.hidup) this.hancurkan(o);
      return o.hidup;
    });
    this.transisi = true;
  }

  private aturTeks(tk: TeksTata) {
    const d = this.tata.d;
    const ukuran = Math.round(tk.ukuran * this.skalaTeks(this.scale.width, this.scale.height, d) * d);
    const wIkon = tk.ikon ? lebarIkonKartu(ukuran) : 0;
    const tanda = `${tk.isi}|${tk.cadangan ?? ''}|${ukuran}|${tk.warna}|${tk.tebal ? 1 : 0}|${Math.round(tk.maks ?? 0)}|${tk.minHuruf ?? 1}|${tk.ikon ?? ''}`;
    let x = this.teksObj.get(tk.kunci);
    if (!x) {
      const t = this.add.text(0, 0, '', { fontFamily: FONT }).setDepth(LAPIS.teks);
      x = { t, tanda: '', denyut: false };
      this.teksObj.set(tk.kunci, x);
    }
    if (x.tanda !== tanda) {
      x.tanda = tanda;
      x.t.setStyle({
        fontFamily: FONT,
        fontSize: `${ukuran}px`,
        color: this.palet.teks[tk.warna],
        fontStyle: tk.tebal ? 'bold' : 'normal',
        align: tk.ox === 0.5 ? 'center' : 'left',
      });
      pasTeks(x.t, tk.isi, tk.maks === undefined ? undefined : tk.maks - wIkon, tk.minHuruf, tk.cadangan);
      if (tk.ikon) {
        // Ikon punggung kartu: kartu kecil sewarna teks, dengan bingkai dalam sewarna laken (seperti pinggiran
        // putih di punggung kartu sungguhan). Digambar sekali per perubahan isi/ukuran/warna.
        const g = x.ikon ?? (x.ikon = this.add.graphics());
        const w = IKON_KARTU.lebar * ukuran;
        const h = IKON_KARTU.tinggi * ukuran;
        const warna = Phaser.Display.Color.HexStringToColor(this.palet.teks[tk.warna]).color;
        g.clear()
          .fillStyle(warna, 0.95)
          .fillRoundedRect(0, -h / 2, w, h, Math.max(1, w * 0.18))
          .lineStyle(Math.max(1, ukuran * 0.07), this.palet.panel, 0.9)
          .strokeRoundedRect(w * 0.2, -h / 2 + h * 0.15, w * 0.6, h * 0.7, Math.max(1, w * 0.1));
      } else if (x.ikon) {
        x.ikon.destroy();
        x.ikon = undefined;
      }
    }
    x.denyut = !!tk.denyut;
    // Ikon di kiri teks: teks bergeser selebar ikon (rata kiri), atau ikon menempel di kiri teks (rata kanan/tengah).
    const ox = tk.ox ?? 0;
    const oy = tk.oy ?? 0;
    const xTeks = Math.round(tk.x + wIkon * (1 - ox));
    x.t.setOrigin(ox, oy).setPosition(xTeks, Math.round(tk.y)).setDepth(tk.lapis ?? LAPIS.teks);
    if (x.ikon) {
      const tengahY = tk.y - oy * x.t.height + x.t.height * 0.52;
      x.ikon
        .setPosition(Math.round(xTeks - ox * x.t.width - wIkon), Math.round(tengahY))
        .setDepth(tk.lapis ?? LAPIS.teks)
        .setVisible(x.t.text !== '');
    }
    if (!tk.denyut) {
      x.t.setAlpha(1);
      x.ikon?.setAlpha(1);
    }
  }

  /** Sorotan yang hidup: giliran, denyut bahaya, area lepas buangan. Digambar ulang tiap frame (murah). */
  private gambarDinamis(waktu: number) {
    const d = this.tata.d;
    const tenang = efekHemat();
    const fase = waktu / 1000;
    const denyutCepat = tenang ? 0.85 : 0.35 + 0.65 * (0.5 + 0.5 * Math.sin(fase * Math.PI * 2 * 0.95));
    this.gDenyut.setAlpha(denyutCepat);
    for (const x of this.teksObj.values()) {
      if (!x.denyut) continue;
      x.t.setAlpha(tenang ? 1 : 0.45 + 0.55 * denyutCepat);
      x.ikon?.setAlpha(x.t.alpha);
    }

    const g = this.gKilau.clear();
    const sg = this.tata.sorotGiliran;
    if (sg) {
      const k = sg.kotak;
      if (sg.saya) {
        // Area tanganku menyala lembut saat giliranku.
        const a = tenang ? 0.5 : 0.35 + 0.25 * Math.sin(fase * Math.PI * 2 * 0.55);
        g.fillStyle(this.palet.emas, 0.05 * a * 2).fillRoundedRect(k.x, k.y, k.w, k.h, 14 * d);
        g.lineStyle(2 * d, this.palet.emas, a).strokeRoundedRect(k.x, k.y, k.w, k.h, 14 * d);
      } else if (!tenang) {
        // Cahaya kecil berkeliling di tepi panel pemain yang sedang jalan.
        const keliling = 2 * (k.w + k.h);
        for (let i = 0; i < 7; i++) {
          const p = titikKeliling(k, (((fase * 0.42 - i * 0.012) % 1) + 1) % 1, keliling);
          g.fillStyle(this.palet.emasMuda, 0.75 * (1 - i / 7)).fillCircle(p.x, p.y, (3.2 - i * 0.32) * d);
        }
      }
    }
    if (this.seret && this.diAtasBuangan && this.tata.area.buangan) {
      const k = this.tata.area.buangan;
      const a = tenang ? 0.9 : 0.6 + 0.4 * Math.sin(fase * Math.PI * 4);
      g.fillStyle(this.palet.emas, 0.12).fillRoundedRect(k.x - 8 * d, k.y - 8 * d, k.w + 16 * d, k.h + 16 * d, 12 * d);
      g.lineStyle(3 * d, this.palet.emasMuda, a).strokeRoundedRect(k.x - 8 * d, k.y - 8 * d, k.w + 16 * d, k.h + 16 * d, 12 * d);
    }
  }

  // ---------------------------------------------------------------------------------------------
  // Input
  // ---------------------------------------------------------------------------------------------

  private pasangInput(o: ObjKartu) {
    const img = o.img;
    const kunci = () => o.data?.kunci ?? '';
    img.on(Phaser.Input.Events.GAMEOBJECT_POINTER_DOWN, (p: Phaser.Input.Pointer) => {
      if (!o.data?.ketuk && !o.data?.seret) return;
      this.tekan = kunci();
      this.tweenEfek(o, { tekan: 1 }, DURASI.mikro);
      if (p.wasTouch) getar('ketuk');
    });
    img.on(Phaser.Input.Events.GAMEOBJECT_POINTER_UP, () => {
      this.tweenEfek(o, { tekan: 0 }, DURASI.mikro);
      if (this.seret || this.tekan !== kunci()) return;
      this.tekan = null;
      if (o.data?.ketuk) this.jalankanKetuk(o.data.ketuk);
    });
    img.on(Phaser.Input.Events.GAMEOBJECT_POINTER_OVER, (p: Phaser.Input.Pointer) => {
      if (!p.wasTouch && o.data?.seret && !this.seret && !o.dikunci) this.tweenEfek(o, { hover: 1 }, DURASI.mikro);
    });
    img.on(Phaser.Input.Events.GAMEOBJECT_POINTER_OUT, () => {
      if (this.tekan === kunci()) this.tekan = null;
      this.tweenEfek(o, { hover: 0, tekan: 0 }, DURASI.mikro);
    });
    img.on(Phaser.Input.Events.GAMEOBJECT_DRAG_START, () => this.mulaiSeret(o));
    img.on(Phaser.Input.Events.GAMEOBJECT_DRAG, (_p: Phaser.Input.Pointer, dx: number, dy: number) => {
      if (this.seret?.o !== o) return;
      o.x = dx;
      o.y = dy;
      const a = this.tata.area.lepasBuangan;
      this.diAtasBuangan = !!a && dalam(a, o.x, o.y);
    });
    img.on(Phaser.Input.Events.GAMEOBJECT_DRAG_END, () => this.akhiriSeret(o));
  }

  private aturInteraksi(o: ObjKartu, k: KartuTata) {
    const img = o.img;
    if (k.ketuk || k.seret) {
      if (!img.input) img.setInteractive({ useHandCursor: true });
      else img.input.enabled = true;
      this.input.setDraggable(img, !!k.seret);
    } else if (img.input?.enabled) {
      img.disableInteractive();
      o.efek.hover = 0;
      o.efek.tekan = 0;
    }
  }

  private tweenEfek(o: ObjKartu, nilai: Partial<EfekKartu>, ms: number) {
    if (!o.hidup) return;
    this.tweens.add({ targets: o.efek, ...nilai, duration: durasi(ms), ease: EASE.keluar });
  }

  private lepasHover() {
    this.tekan = null;
    for (const o of this.kelola.values()) if (o.efek.hover || o.efek.tekan) this.tweenEfek(o, { hover: 0, tekan: 0 }, DURASI.mikro);
  }

  private jalankanKetuk(k: AksiKetuk) {
    const a = this.aksi;
    if (!a) return;
    if (k.jenis === 'kartu') {
      bunyi(this.model?.dipilih.has(k.id) ? 'letak' : 'angkat');
      a.ketukKartu(k.id);
    } else if (k.jenis === 'deck') a.ketukDeck();
    else if (k.jenis === 'buangan') {
      bunyi('klik');
      a.ketukBuangan(k.jumlah);
    } else {
      bunyi('geser');
      a.ketukKombinasi(k.indeks);
    }
  }

  private mulaiSeret(o: ObjKartu) {
    const id = o.data?.id;
    // Satu seret dalam satu waktu: jari kedua (dua jempol di HP) diabaikan selama masih ada seret aktif.
    if (this.seret || !o.data?.seret || !id || o.dikunci) return;
    this.seret = { o, id, xLalu: o.x };
    this.tekan = null;
    o.dikunci = 'seret';
    this.tweens.killTweensOf(o);
    this.tweens.killTweensOf(o.efek);
    Object.assign(o.efek, { hover: 0, tekan: 0 });
    o.img.setDepth(LAPIS.seret);
    o.bay.setDepth(LAPIS.seret - 0.004);
    o.sorot?.setDepth(LAPIS.seret + 0.004);
    this.tweens.add({ targets: o, skala: 1.06, tinggi: 1, duration: durasi(DURASI.mikro), ease: EASE.keluar });
    bunyi('angkat');
  }

  /** Kemiringan kartu yang diseret mengikuti kecepatan horizontal (maks ±8°). */
  private perbaruiSeret(delta: number) {
    const s = this.seret;
    if (!s || delta <= 0) return;
    const vCss = ((s.o.x - s.xLalu) / this.tata.d / delta) * 1000;
    s.xLalu = s.o.x;
    const sasaran = kurangiGerak() ? 0 : jepit(vCss * 0.012, -8, 8);
    s.o.sudut += (sasaran - s.o.sudut) * Math.min(1, delta / 70);
  }

  private akhiriSeret(o: ObjKartu) {
    const s = this.seret;
    if (!s || s.o !== o) {
      // Seret yang bukan seret aktif (mis. jari kedua, atau seret yang sudah dibatalkan penggambaran ulang):
      // pastikan kartunya tidak tertinggal terkunci, lalu kembalikan ke slotnya.
      if (o.dikunci === 'seret') {
        o.dikunci = null;
        this.tweens.killTweensOf(o);
        this.transisi = true;
        this.kotor = true;
      }
      return;
    }
    this.seret = null;
    const id = s.id;
    const diBuangan = this.diAtasBuangan;
    this.diAtasBuangan = false;
    if (diBuangan) {
      // Kartu menunggu di titik lepas sampai peristiwa 'buang' diputar (pemutar memakai posisiLepas()).
      // Didaftarkan SEBELUM aksi dikirim: mode offline bisa langsung memutar peristiwanya.
      o.dikunci = 'lepas';
      const sudut = (acakId(id, 3) - 0.5) * 8;
      this.tweens.add({ targets: o, skala: 1, tinggi: 0.35, sudut, duration: durasi(DURASI.mendarat), ease: EASE.keluar });
      const mulai = Date.now();
      const tunggu = () => {
        const l = this.lepas.get(id);
        if (!l) return;
        // Aksinya masih dikirim (sinyal lambat): kartu jangan balik ke tangan seolah-olah ditolak.
        if (this.aksi?.sedangMengirim?.() && Date.now() - mulai < BATAS_LEPAS_MAKS) {
          l.timer = setTimeout(tunggu, CEK_LEPAS_MS);
          return;
        }
        this.kembalikan(id, false);
      };
      const timer = setTimeout(tunggu, BATAS_LEPAS);
      this.lepas.set(id, { o, titik: { x: o.x, y: o.y, w: o.w, sudut }, timer });
      bunyi('letak');
      const hasil = this.aksi?.lepasKeBuangan(id);
      // 'abaikan' = bukan kesalahan pemain (mis. masih menunggu jawaban): kembali tanpa goyang.
      if (hasil === 'abaikan') this.kembalikan(id, false);
      else if (hasil === false) this.kembalikan(id, true);
      return;
    }
    // Susun ulang: slot terdekat dari titik lepas.
    o.dikunci = null;
    let terdekat = -1;
    let jarak = Infinity;
    this.tata.slotTangan.forEach((sl, j) => {
      const jj = Math.hypot(sl.x - o.x, (sl.y - o.y) * 0.6);
      if (jj < jarak) {
        jarak = jj;
        terdekat = j;
      }
    });
    bunyi('geser');
    this.transisi = true;
    this.kotor = true;
    if (terdekat >= 0) this.aksi?.geserKartu(id, terdekat);
  }

  private hapusLepas(id: string) {
    const l = this.lepas.get(id);
    if (!l) return;
    clearTimeout(l.timer);
    this.lepas.delete(id);
  }

  /** Kartu yang dilepas di buangan kembali ke tangan (buang ditolak atau tidak ada kabar). */
  private kembalikan(id: string, tolak: boolean) {
    const l = this.lepas.get(id);
    if (!l) return;
    this.hapusLepas(id);
    if (!l.o.hidup) return;
    l.o.dikunci = null;
    this.transisi = true;
    this.kotor = true;
    if (tolak) this.goyang(l.o);
  }

  private batalkanSemuaLepas() {
    for (const id of [...this.lepas.keys()]) this.hapusLepas(id);
  }

  /**
   * Umpan balik aksi tidak sah: goyang kecil (±6 px, 3×) + kilat merah lembut pada sasaran
   * (id kartu tangan/pungutan, 'deck', 'buangan', 'tangan'). Hanya visual: bunyi/getar 'tolak'
   * dibunyikan pemanggil. Kartu yang sedang menunggu di titik lepas buangan dikembalikan ke tangan.
   */
  tolak(sasaran: string): void {
    if (this.lepas.has(sasaran)) return this.kembalikan(sasaran, true);
    const sasaranObj: ObjKartu[] = [];
    for (const o of this.kelola.values()) {
      const peran = o.data?.peran;
      if (
        (sasaran === 'deck' && peran === 'deck') ||
        (sasaran === 'buangan' && peran === 'buangan') ||
        (sasaran === 'tangan' && peran === 'tangan') ||
        (o.data?.id === sasaran && (peran === 'tangan' || peran === 'pungutan'))
      )
        sasaranObj.push(o);
    }
    sasaranObj.forEach((o) => this.goyang(o));
  }

  private goyang(o: ObjKartu) {
    if (!o.hidup) return;
    const d = this.tata.d;
    const e = o.efek;
    this.tweens.killTweensOf(e);
    this.tweens.add({ targets: e, merah: 1, duration: 90, yoyo: true, hold: 120, ease: EASE.keluar });
    if (kurangiGerak()) return;
    this.tweens.addCounter({
      from: 0,
      to: 1,
      duration: 240,
      onUpdate: (tw) => {
        const u = tw.getValue() ?? 0;
        e.goyang = Math.sin(u * Math.PI * 6) * 6 * d * (1 - u);
      },
      onComplete: () => (e.goyang = 0),
    });
  }

  // ---------------------------------------------------------------------------------------------
  // Primitif animasi (semua Promise selalu resolve, dengan timeout cadangan)
  // ---------------------------------------------------------------------------------------------

  private bisaAnimasi() {
    return this.sys.isActive() && !document.hidden;
  }

  /** Tween sebagai Promise. Selalu resolve: selesai, atau setelah batas waktu cadangan. */
  private tw(cfg: Phaser.Types.Tweens.TweenBuilderConfig | (Phaser.Types.Tweens.NumberTweenBuilderConfig & { angka: true })): Promise<void> {
    return new Promise((ok) => {
      let selesai = false;
      const beres = () => {
        if (selesai) return;
        selesai = true;
        ok();
      };
      const dur = Number(cfg.duration ?? 0);
      const ulang = Math.max(0, Number(cfg.repeat ?? 0));
      const batas = Number(cfg.delay ?? 0) + (dur * (cfg.yoyo ? 2 : 1) + Number(cfg.hold ?? 0)) * (ulang + 1) + 400;
      setTimeout(beres, batas);
      if (!this.bisaAnimasi()) return beres();
      const { angka: _angka, ...dasar } = cfg as typeof cfg & { angka?: true };
      const asli = cfg.onComplete;
      const lengkap = {
        ...dasar,
        onComplete: (...a: unknown[]) => {
          (asli as ((...x: unknown[]) => void) | undefined)?.(...a);
          beres();
        },
      };
      if ('angka' in cfg) this.tweens.addCounter(lengkap as Phaser.Types.Tweens.NumberTweenBuilderConfig);
      else this.tweens.add(lengkap as Phaser.Types.Tweens.TweenBuilderConfig);
    });
  }

  private jeda(ms: number): Promise<void> {
    return new Promise((ok) => setTimeout(ok, Math.max(0, ms)));
  }

  /**
   * Luncurkan objek kartu dari `dari` ke `ke` lewat busur: skala sedikit naik di tengah, kemiringan
   * alami (deterministik per id), lalu berakhir di sudut tujuan. Gerak dikurangi: lurus tanpa putaran.
   */
  private luncur(o: ObjKartu, dari: Titik, ke: Titik, opsi: { lama: number; jeda?: number; benih?: string; lengkung?: number }): Promise<void> {
    const d = this.tata.d;
    const kurang = kurangiGerak();
    const dx = ke.x - dari.x;
    const dy = ke.y - dari.y;
    const jarak = Math.hypot(dx, dy) || 1;
    let nx = -dy / jarak;
    let ny = dx / jarak;
    if (ny > 0) {
      nx = -nx;
      ny = -ny;
    }
    const lengkung = kurang ? 0 : Math.min(jarak * (opsi.lengkung ?? 0.16), 80 * d);
    const kx = (dari.x + ke.x) / 2 + nx * lengkung;
    const ky = (dari.y + ke.y) / 2 + ny * lengkung;
    const r = acakId(opsi.benih ?? `${this.hitungTerbang}`, 11);
    const putar = kurang ? 0 : (r - 0.5) * 18;
    const sudutAwal = dari.sudut ?? o.sudut;
    const sudutAkhir = ke.sudut ?? 0;
    const naik = kurang ? 0 : 0.08;
    return this.tw({
      angka: true,
      from: 0,
      to: 1,
      delay: opsi.jeda ?? 0,
      duration: opsi.lama,
      ease: kurang ? EASE.halus : EASE.keluar,
      onStart: () => {
        if (o.hidup) o.alpha = 1;
      },
      onUpdate: (tw: Phaser.Tweens.Tween) => {
        if (!o.hidup) return;
        const u = tw.getValue() ?? 0;
        const a = 1 - u;
        o.x = a * a * dari.x + 2 * a * u * kx + u * u * ke.x;
        o.y = a * a * dari.y + 2 * a * u * ky + u * u * ke.y;
        const busur = Math.sin(Math.PI * u);
        o.w = lerp(dari.w, ke.w, u) * (1 + naik * busur);
        o.sudut = lerp(sudutAwal, sudutAkhir, u) + putar * busur;
        o.tinggi = 0.15 + 0.85 * busur;
      },
    }).then(() => {
      if (!o.hidup) return;
      Object.assign(o, { x: ke.x, y: ke.y, w: ke.w, sudut: sudutAkhir, alpha: 1 });
    });
  }

  /** Kartu mendarat: kedut kecil (settle) dan bayangan turun. */
  private mendarat(o: ObjKartu): Promise<void> {
    if (!o.hidup) return Promise.resolve();
    o.tinggi = 0.25;
    if (kurangiGerak()) {
      o.tinggi = 0;
      return Promise.resolve();
    }
    o.skala = 1.05;
    return this.tw({ targets: o, skala: 1, tinggi: 0, duration: durasi(DURASI.mendarat * 1.4), ease: easePegas(1.1, 1.4) });
  }

  /** Balik kartu: menipis (agak gelap), ganti muka di tengah, lalu melebar lagi dengan pegas. */
  private async balik(o: ObjKartu, kartu: Kartu | null, wTekstur: number, suara = true): Promise<void> {
    if (!o.hidup) return;
    if (suara) bunyi('balik');
    if (kurangiGerak() || !this.bisaAnimasi()) {
      this.gantiMuka(o, kartu, wTekstur);
      return;
    }
    await this.tw({ targets: o, lebarX: 0, gelap: 1, duration: durasi(DURASI.balik), ease: 'Sine.easeIn' });
    if (!o.hidup) return;
    this.gantiMuka(o, kartu, wTekstur);
    await this.tw({ targets: o, lebarX: 1, gelap: 0, duration: durasi(DURASI.balik * 1.2), ease: easePegas(1.2, 1.4) });
    if (o.hidup) Object.assign(o, { lebarX: 1, gelap: 0 });
  }

  /**
   * Kartu terbang dari satu titik ke titik lain. `kartu` null = punggung kartu (kartu lawan selalu tertutup).
   * `besar`: kartu membesar sebentar setelah mendarat supaya semua sempat melihatnya (kartu dibuang).
   * `hilang`: kartu memudar setelah tiba (mis. masuk ke panel lawan).
   * Durasi dasar (ms) otomatis disesuaikan preferensi kecepatan/gerak.
   */
  terbang(
    kartu: Kartu | null,
    dari: Titik | undefined,
    ke: Titik | undefined,
    opsi: { durasi?: number; jeda?: number; besar?: boolean; hilang?: boolean } = {},
  ): Promise<void> {
    if (!dari || !ke || !this.bisaAnimasi()) return Promise.resolve();
    const lama = durasi(opsi.durasi ?? DURASI.terbang);
    const jeda = durasi(opsi.jeda ?? 0);
    const besar = !!opsi.besar && !kurangiGerak();
    const o = this.buatBebas(kartu, dari, Math.max(dari.w, ke.w) * (besar ? 1.5 : 1.12));
    o.alpha = jeda ? 0 : 1;
    o.tinggi = 0.3;
    const benih = kartu?.id ?? `t${this.hitungTerbang}`;
    return (async () => {
      await this.luncur(o, dari, ke, { lama, jeda, benih });
      if (!o.hidup) return;
      bunyi('letak');
      if (besar) {
        await this.tw({ targets: o, skala: 1.5, tinggi: 0.9, duration: durasi(170), ease: EASE.pegas });
        await this.jeda(durasi(380));
        if (o.hidup) await this.tw({ targets: o, skala: 1, tinggi: 0, duration: durasi(190), ease: EASE.keluar });
      } else await this.mendarat(o);
      if (opsi.hilang && o.hidup) await this.tw({ targets: o, alpha: 0, duration: durasi(DURASI.mikro) });
      if (opsi.hilang) this.hancurkan(o);
      else this.serahkan(o);
    })();
  }

  /** Titik tengah layar untuk kartu yang dipamerkan, beserta lebar kartu besarnya. */
  private panggung(jumlah: number): Titik {
    const W = this.scale.width;
    const H = this.scale.height;
    const d = this.tata.d;
    const w = Math.min(170 * d, W / (jumlah + 1.4), H * 0.24);
    return { x: W / 2, y: H * 0.44, w };
  }

  /**
   * Naikkan kartu ke panggung (tengah layar, besar) supaya semua sempat melihatnya.
   * `tertutup`: kartu datang tertutup lalu dibalik (misalnya kartu yang baru diambil dari deck).
   * Selesai setelah kartu tiba (dan dibalik), lalu ditahan `tahan` ms. Hasilnya WAJIB diberikan ke turunPanggung.
   */
  async naikPanggung(daftar: { kartu: Kartu; dari?: Titik; tertutup?: boolean }[], tahan: number = DURASI.panggung): Promise<Phaser.GameObjects.Image[]> {
    if (!daftar.length || !this.bisaAnimasi()) return [];
    const pg = this.panggung(daftar.length);
    const os = daftar.map(({ kartu, dari, tertutup }) => {
      const asal = dari ?? this.tata.titik.buangan ?? { ...pg, w: pg.w / 2 };
      const o = this.buatBebas(tertutup ? null : kartu, asal, pg.w * 1.05, LAPIS.animasi + 20);
      o.tinggi = 0.4;
      return o;
    });
    await Promise.all(
      os.map(async (o, i) => {
        const ke = { x: pg.x + (i - (os.length - 1) / 2) * pg.w * 1.12, y: pg.y, w: pg.w, sudut: 0 };
        await this.luncur(o, { x: o.x, y: o.y, w: o.w, sudut: o.sudut }, ke, { lama: durasi(380), jeda: durasi(i * 90), benih: daftar[i].kartu.id, lengkung: 0.1 });
        if (!o.hidup) return;
        o.tinggi = 0.7;
        if (daftar[i].tertutup) await this.balik(o, daftar[i].kartu, pg.w * 1.05);
      }),
    );
    await this.jeda(durasi(tahan));
    return os.filter((o) => o.hidup).map((o) => o.img);
  }

  /** Turunkan kartu dari panggung ke tujuan masing-masing (undefined = menghilang di tempat). */
  async turunPanggung(imgs: Phaser.GameObjects.Image[], tujuan: (Titik | undefined)[]): Promise<void> {
    const os = imgs.map((img) => this.objDariImg.get(img)).filter((o): o is ObjKartu => !!o && o.hidup);
    await Promise.all(
      os.map(async (o, i) => {
        const ke = tujuan[i];
        if (!ke || !this.bisaAnimasi()) {
          await this.tw({ targets: o, alpha: 0, duration: durasi(260), delay: durasi(i * 90) });
          return this.hancurkan(o);
        }
        await this.luncur(o, { x: o.x, y: o.y, w: o.w, sudut: o.sudut }, ke, { lama: durasi(440), jeda: durasi(i * 90), benih: `${o.kartu?.id}-turun`, lengkung: 0.08 });
        await this.mendarat(o);
        this.serahkan(o);
      }),
    );
  }

  /**
   * Pentungan: kartu dibuang tertutup ke tengah meja, jeda tegang, lalu dibuka dan nilainya muncul.
   * Bisa beberapa kartu sekaligus (keputusan #41, nutup pakai beberapa joker): semuanya berjajar di
   * panggung, bergetar dan dibalik bersamaan, lalu satu label nilai total, dan berangkat ke buangan
   * bergiliran. `saatDibuka` dipanggil tepat sekali ketika kartunya terbuka (untuk bunyi/goyang).
   */
  pentung(daftar: { kartu: Kartu; dari?: Titik }[], nilai: number, merah: boolean, saatDibuka?: () => void): Promise<void> {
    let dibuka = false;
    const buka = () => {
      if (dibuka) return;
      dibuka = true;
      saatDibuka?.();
    };
    if (!daftar.length || !this.bisaAnimasi()) {
      buka();
      return Promise.resolve();
    }
    const d = this.tata.d;
    const n = daftar.length;
    const pg = this.panggung(n);
    // Satu kartu: ukuran lama. Beberapa kartu: sedikit lebih kecil supaya berjajar muat di layar.
    const w = pg.w * (n > 1 ? 1.1 : 1.25);
    const jarak = w * 1.1;
    const xKe = (i: number) => pg.x + (i - (n - 1) / 2) * jarak;
    const os = daftar.map(({ dari }) => {
      const asal = dari ?? { x: pg.x, y: this.scale.height, w: w / 2 };
      const o = this.buatBebas(null, { ...asal, sudut: -25 }, w * 1.05, LAPIS.animasi + 30);
      o.tinggi = 1;
      return o;
    });
    const label = this.add
      .text(pg.x, pg.y + (w * RASIO_KARTU) / 2 + 14 * d, `+${nilai}`, {
        fontFamily: FONT,
        fontSize: `${Math.round(54 * d)}px`,
        fontStyle: 'bold italic',
        color: merah ? '#ff5a4f' : '#ffd54a',
        stroke: '#000000',
        strokeThickness: 6 * d,
      })
      .setOrigin(0.5, 0)
      .setScale(0)
      .setAlpha(0)
      .setDepth(LAPIS.animasi + 40);
    const hidup = () => os.filter((o) => o.hidup);
    const jalan = (async () => {
      // 1. Dibuang tertutup ke tengah meja (beberapa kartu: bergiliran sedikit).
      await Promise.all(
        os.map((o, i) =>
          this.luncur(o, { x: o.x, y: o.y, w: o.w, sudut: -25 }, { x: xKe(i), y: pg.y, w, sudut: -4 }, {
            lama: durasi(480),
            jeda: durasi(i * 110),
            benih: daftar[i].kartu.id,
            lengkung: 0.12,
          }),
        ),
      );
      if (!hidup().length) return;
      bunyi('letak');
      // 2. Hening sebentar (hit-stop), lalu kartu bergetar tegang bersamaan.
      await this.jeda(70);
      if (!kurangiGerak()) await this.tw({ targets: hidup(), sudut: 4, duration: durasi(90), yoyo: true, repeat: 4 });
      // 3. Dibalik bersamaan: nilainya baru ketahuan.
      for (const o of os) o.sudut = 0;
      await Promise.all(os.map((o, i) => this.balik(o, daftar[i].kartu, w * 1.05, false)));
      buka();
      os.forEach((o, i) => this.percik({ x: xKe(i), y: pg.y, w }, merah ? 'merah' : 'emas', Math.round(28 / Math.min(n, 2))));
      // 4. Nilai pentungan (totalnya) muncul.
      if (label.active) await this.tw({ targets: label, scale: 1, alpha: 1, duration: durasi(300), delay: 50, ease: EASE.pegas });
      // 5. Tahan sebentar, lalu ke buangan (bergiliran).
      await this.jeda(durasi(1100));
      if (label.active) this.tweens.add({ targets: label, alpha: 0, duration: durasi(250) });
      const ke = this.tata.titik.buangan ?? pg;
      await Promise.all(
        os.map(async (o, i) => {
          if (o.hidup) await this.luncur(o, { x: o.x, y: o.y, w: o.w, sudut: 0 }, ke, { lama: durasi(380), jeda: durasi(i * 140), benih: `${daftar[i].kartu.id}-p`, lengkung: 0.08 });
          await this.mendarat(o);
        }),
      );
    })();
    // Cadangan total: apa pun yang terjadi, pentungan selesai dan dibersihkan (tiap kartu tambahan
    // memperpanjang alur di atas sedikit, jadi cadangannya ikut).
    const cadangan = new Promise<void>((ok) => setTimeout(ok, 6500 + 400 * (n - 1)));
    return Promise.race([jalan, cadangan]).then(() => {
      buka();
      this.tweens.killTweensOf(label);
      if (label.active) label.destroy();
      os.forEach((o) => this.serahkan(o));
    });
  }

  // ---------------------------------------------------------------------------------------------
  // Awal putaran: kocok & bagi
  // ---------------------------------------------------------------------------------------------

  /** Kocok singkat di posisi deck: tumpukan dibelah, lalu disatukan selang-seling (riffle). */
  private async kocok(D: Titik): Promise<void> {
    bunyi('kocok');
    if (kurangiGerak()) return;
    const d = this.tata.d;
    // Dibelah ke kiri-kanan; geser ke dalam layar kalau deck terlalu dekat tepi.
    const cx = jepit(D.x, 1.1 * D.w + 4 * d, this.scale.width - 1.1 * D.w - 4 * d);
    const os = Array.from({ length: 8 }, (_, i) => {
      const o = this.buatBebas(null, { x: D.x, y: D.y - i * 0.7 * d, w: D.w }, D.w * 1.1, LAPIS.animasi + 5 + i * 0.01);
      o.tinggi = 0.2;
      return o;
    });
    await Promise.all(
      os.map((o, i) =>
        this.tw({
          targets: o,
          x: cx + (i % 2 ? 0.58 : -0.58) * D.w,
          y: D.y - 6 * d,
          sudut: i % 2 ? 8 : -8,
          tinggi: 0.6,
          duration: durasi(170),
          ease: EASE.keluar,
        }),
      ),
    );
    await Promise.all(
      os.map((o, i) =>
        this.tw({ targets: o, x: D.x, y: D.y - i * 0.7 * d, sudut: 0, tinggi: 0.2, duration: durasi(120), delay: durasi(i * 28), ease: EASE.halus }),
      ),
    );
    await Promise.all(os.map((o) => this.tw({ targets: o, skala: 1.04, duration: durasi(70), yoyo: true, ease: EASE.keluar })));
    os.forEach((o) => this.serahkan(o));
  }

  /**
   * Animasi awal putaran: kocok, lalu kartu dibagikan TERTUTUP satu per satu bergiliran seperti di engine
   * (mesin.ts mulaiPutaran): mulai dari pengocok sendiri, urut nomor kursi naik ((pengocok + p) % n), tanpa
   * melihat arah putaran. Lalu kartu tanganku dibalik satu per satu dari kiri ke kanan sesuai slotnya di layar.
   * Kartu yang dibuka pengocok (angka joker) tidak dipamerkan di sini.
   * Pemanggil menyembunyikan kartu tanganku (idTanganku) selama animasi dan menampakkannya sesudahnya.
   * Aman dipanggil segera setelah scene dibuat atau model baru dipasang (posisi dari tata letak terbaru).
   * Total ≈ 2,4 dtk pada kecepatan normal; gerak dikurangi = versi singkat. Selalu selesai (cadangan 6 dtk).
   */
  async bagiKartu(r: { pengocok: number; jumlah: number[]; idTanganku: string[] }): Promise<void> {
    const D = this.tata.titik.deck;
    if (!D || !this.bisaAnimasi()) return;
    const saya = this.model?.view.saya ?? -1;
    const n = r.jumlah.length;
    const singkat = kurangiGerak();
    const tangan = new Map((this.model?.tangan ?? []).map((k) => [k.id, k]));
    // Kartu tanganku menurut slot di layar (kiri→kanan, baris atas dulu), bukan urutan dari server:
    // kartu ke-k yang kuterima mendarat di slot ke-k, lalu dibalik berurutan.
    const posisi = (id: string) => this.tata.titik.kartu.get(id);
    const slotku = r.idTanganku
      .filter((id) => posisi(id))
      .sort((a, b) => {
        const pa = posisi(a)!;
        const pb = posisi(b)!;
        return Math.abs(pa.y - pb.y) > pa.w * 0.3 ? pa.y - pb.y : pa.x - pb.x;
      });
    // Tekstur muka kartu tanganku disiapkan bertahap selama kocok, supaya balik kartu tidak tersendat.
    const batalPanas = panaskanTeksturKartu(this.textures, slotku.map((id) => tangan.get(id)).filter((k): k is Kartu => !!k));
    const jalan = (async () => {
      await this.kocok(D);
      // Urutan bagi = engine: satu kartu per pemain per putaran, mulai dari pengocok, kursi naik.
      const urutan: { pemain: number; ke: number }[] = [];
      const putaranBagi = singkat ? 1 : Math.max(...r.jumlah, 0);
      for (let k = 0; k < putaranBagi; k++) {
        for (let j = 0; j < n; j++) {
          const pemain = (r.pengocok + j) % n;
          if (k < (r.jumlah[pemain] ?? 0)) urutan.push({ pemain, ke: k });
        }
      }
      const lama = durasi(DURASI.bagi);
      const jedaAntar = durasi(Math.min(DURASI.jedaBagi, Math.max(18, (1300 - DURASI.bagi) / Math.max(1, urutan.length))));
      const milikku: { o: ObjKartu; id: string; slot: number }[] = [];
      await Promise.all(
        urutan.map(async ({ pemain, ke }, i) => {
          const id = pemain === saya ? slotku[ke] : undefined;
          // Posisi diambil SAAT kartu berangkat (tata letak bisa berubah, mis. ruang bar HTML baru terukur).
          await this.jeda(i * jedaAntar);
          const dari = this.tata.titik.deck ?? D;
          const tujuan = id ? posisi(id) : this.posisiPemain(pemain);
          if (!tujuan) return;
          const o = this.buatBebas(null, dari, Math.max(dari.w, tujuan.w) * 1.1);
          bunyi('bagi', { urutan: ke });
          await this.luncur(o, dari, tujuan, { lama, benih: `bagi-${i}`, lengkung: 0.1 });
          if (!o.hidup) return;
          if (id) {
            o.tinggi = TINGGI_TANGAN.biasa;
            milikku.push({ o, id, slot: ke });
          } else {
            await this.tw({ targets: o, alpha: 0, w: tujuan.w * 0.8, duration: durasi(DURASI.mikro) });
            this.hancurkan(o);
          }
        }),
      );
      // Kartu tanganku dibalik satu per satu dari kiri ke kanan (versi singkat: sekaligus).
      milikku.sort((a, b) => a.slot - b.slot);
      await Promise.all(
        milikku.map(async ({ o, id }, i) => {
          if (!singkat) await this.jeda(durasi(i * 55));
          const t = posisi(id);
          // Tata letak sempat berubah selama bagi: geser kartu ke slot terbarunya sebelum dibalik.
          if (t && o.hidup && Math.abs(t.x - o.x) + Math.abs(t.y - o.y) > 2 * this.tata.d) Object.assign(o, { x: t.x, y: t.y, w: t.w, sudut: t.sudut ?? 0 });
          await this.balik(o, tangan.get(id) ?? null, o.w * 1.1, !singkat || i === 0);
        }),
      );
      return milikku;
    })();
    const cadangan = new Promise<null>((ok) => setTimeout(() => ok(null), 6000));
    const hasil = await Promise.race([jalan, cadangan]);
    batalPanas();
    // Selesai normal: kartu diserahkan ke tata letak. Kena cadangan: kartu yang masih terbang tetap
    // dibersihkan saat jalannya selesai, supaya tidak ada punggung kartu yang tertinggal di meja.
    if (hasil) hasil.forEach(({ o }) => this.serahkan(o));
    else void jalan.then((m) => m.forEach(({ o }) => this.serahkan(o)));
  }

  // ---------------------------------------------------------------------------------------------
  // Efek lain
  // ---------------------------------------------------------------------------------------------

  private buatTeksturTitik() {
    if (this.textures.exists(KUNCI_TITIK)) return;
    const t = this.textures.createCanvas(KUNCI_TITIK, 32, 32);
    if (!t) return;
    const ctx = t.getContext();
    const g = ctx.createRadialGradient(16, 16, 0, 16, 16, 16);
    g.addColorStop(0, 'rgba(255,255,255,1)');
    g.addColorStop(0.35, 'rgba(255,255,255,0.85)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 32, 32);
    t.refresh();
  }

  /** Percikan cahaya halus (mentung, pemenang). Mati saat efek hemat/gerak dikurangi. */
  percik(t: Titik | undefined, warna: 'emas' | 'merah', jumlah = 24): void {
    if (!t || efekHemat() || !this.bisaAnimasi()) return;
    const d = this.tata.d;
    const tint = warna === 'emas' ? [this.palet.sorakEmas, this.palet.emasMuda, 0xffffff] : [this.palet.sorakMerah, this.palet.sorakEmas, 0xffffff];
    const e = this.add.particles(t.x, t.y, KUNCI_TITIK, {
      emitting: false,
      speed: { min: 70 * d, max: 260 * d },
      angle: { min: 0, max: 360 },
      lifespan: { min: 550, max: 1000 },
      scale: { start: 0.42 * d, end: 0 },
      alpha: { start: 1, end: 0 },
      gravityY: 240 * d,
      tint,
      blendMode: Phaser.BlendModes.ADD,
    });
    e.setDepth(LAPIS.animasi + 60);
    e.explode(jumlah);
    this.time.delayedCall(1300, () => e.destroy());
  }

  /** Rayakan pemenang akhir: beberapa percikan di panel/tangan pemenang. */
  rayakan(pemain: number): Promise<void> {
    const t = this.posisiPemain(pemain);
    if (!t || efekHemat() || !this.bisaAnimasi()) return Promise.resolve();
    return (async () => {
      for (let i = 0; i < 3; i++) {
        this.percik({ x: t.x + (i - 1) * t.w * 0.8, y: t.y - i * 6 * this.tata.d, w: t.w }, 'emas', 26);
        await this.jeda(220);
      }
    })();
  }

  /**
   * Perubahan skor (angka publik) melayang dari panel tiap pemain. Selesai setelah angka sempat terbaca;
   * pudarnya berlanjut sendiri.
   */
  skorMelayang(delta: number[]): Promise<void> {
    if (!this.bisaAnimasi()) return Promise.resolve();
    const d = this.tata.d;
    const ukuran = Math.round(22 * this.skalaTeks(this.scale.width, this.scale.height, d) * d);
    let ada = false;
    delta.forEach((nilai, i) => {
      const t = this.posisiPemain(i);
      if (!nilai || !t) return;
      ada = true;
      // Untuk diriku: di atas kartu tangan, bukan menutupi indeks kartu.
      const y = i === (this.model?.view.saya ?? -1) ? t.y - (t.w * RASIO_KARTU) / 2 - 14 * d : t.y;
      const teks = this.add
        .text(t.x, y, `${nilai > 0 ? '+' : '−'}${Math.abs(nilai)}`, {
          fontFamily: FONT,
          fontSize: `${ukuran}px`,
          fontStyle: 'bold',
          color: nilai > 0 ? this.palet.teksPositif : this.palet.teksNegatif,
          stroke: '#000000',
          strokeThickness: Math.round(4 * d),
        })
        .setOrigin(0.5)
        .setDepth(LAPIS.animasi + 70)
        .setScale(0.6)
        .setAlpha(0);
      const naik = kurangiGerak() ? 0 : 42 * d;
      this.tweens.add({ targets: teks, scale: 1, alpha: 1, duration: durasi(220), ease: EASE.pegas, delay: i * 60 });
      this.tweens.add({
        targets: teks,
        y: y - naik,
        alpha: 0,
        delay: durasi(1100) + i * 60,
        duration: durasi(700),
        ease: EASE.halus,
        onComplete: () => teks.destroy(),
      });
      // Cadangan: kalau loop tertahan, teks tetap dibersihkan.
      setTimeout(() => teks.active && teks.destroy(), 4000);
    });
    return ada ? this.jeda(durasi(1000)) : Promise.resolve();
  }
}

/**
 * Pasang teks, dipotong dengan '…' kalau lebih lebar dari `maks`. Kalau ada `cadangan` (teks pendek, mis. nama
 * saja untuk 'Giliran <nama>'), cadangan itu yang dicoba lebih dulu. Kalau potongannya menyisakan kurang
 * dari `minHuruf` huruf (mis. 'B…'), teksnya dikosongkan saja.
 */
function pasTeks(t: Phaser.GameObjects.Text, isiUtama: string, maks?: number, minHuruf = 1, cadangan?: string) {
  let isi = isiUtama;
  t.setText(isi);
  if (!maks || maks <= 0 || t.width <= maks || isi.includes('\n')) return;
  if (cadangan) {
    isi = cadangan;
    t.setText(isi);
    if (t.width <= maks) return;
  }
  let lo = 0;
  let hi = isi.length;
  while (lo < hi) {
    const tengah = Math.ceil((lo + hi) / 2);
    t.setText(`${isi.slice(0, tengah).trimEnd()}…`);
    if (t.width <= maks) lo = tengah;
    else hi = tengah - 1;
  }
  t.setText(lo >= Math.max(1, minHuruf) ? `${isi.slice(0, lo).trimEnd()}…` : '');
}

function dalam(k: Kotak, x: number, y: number) {
  return x >= k.x && x <= k.x + k.w && y >= k.y && y <= k.y + k.h;
}

/** Titik di tepi kotak pada posisi `u` (0..1) searah jarum jam dari pojok kiri atas. */
function titikKeliling(k: Kotak, u: number, keliling: number) {
  let s = u * keliling;
  if (s < k.w) return { x: k.x + s, y: k.y };
  s -= k.w;
  if (s < k.h) return { x: k.x + k.w, y: k.y + s };
  s -= k.h;
  if (s < k.w) return { x: k.x + k.w - s, y: k.y + k.h };
  s -= k.w;
  return { x: k.x, y: k.y + k.h - s };
}
