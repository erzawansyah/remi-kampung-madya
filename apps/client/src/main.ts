// Aplikasi: memilih layar (beranda, daftar publik, lobi, meja) berdasarkan pesan dari meja,
// dan mengelola koneksi online/offline.

import './gaya.css';
import { registerSW } from 'virtual:pwa-register';
import type { ViewPemain } from '@remi/engine';
import type { InfoMeja, PengaturanMeja, PesanKlien, PesanServer } from '@remi/meja';
import { KoneksiOffline, KoneksiOnline, urlServer, type Koneksi } from './koneksi';
import { simpan } from './penyimpanan';
import { buatGame, type PenampungGame } from './game/game';
import { KontrolMeja, type AppUntukMeja } from './kontrolMeja';
import { renderBeranda, renderDaftarPublik } from './ui/beranda';
import { renderLobi } from './ui/lobi';
import { renderRiwayat } from './ui/riwayat';
import { toast, tutupModal } from './ui/dom';
import { siapkanAudio } from './efek/suara';

registerSW({ immediate: true });
siapkanAudio();

interface PromptPasang extends Event {
  prompt(): Promise<void>;
}

type Layar = 'beranda' | 'publik' | 'riwayat' | 'lobi' | 'meja';

class Aplikasi implements AppUntukMeja {
  private koneksi: Koneksi | null = null;
  private layar: Layar = 'beranda';
  private info: InfoMeja | null = null;
  private view: ViewPemain | null = null;
  private kontrol: KontrolMeja | null = null;
  private game: PenampungGame | null = null;
  private promptPasang: PromptPasang | null = null;
  private sudahDicatat = false;
  private wakeLock: { release(): Promise<void> } | null = null;
  private readonly ui = document.getElementById('ui')!;
  private readonly elGame = document.getElementById('game')!;
  private kodeAwal = new URLSearchParams(location.search).get('meja')?.toUpperCase() ?? '';

  get jenis(): 'online' | 'offline' {
    return this.koneksi?.jenis ?? 'online';
  }

  mulai() {
    window.addEventListener('beforeinstallprompt', (e) => {
      e.preventDefault();
      this.promptPasang = e as PromptPasang;
      if (this.layar === 'beranda') this.tampilkanBeranda();
    });
    window.addEventListener('online', () => this.layar === 'beranda' && this.tampilkanBeranda());
    window.addEventListener('offline', () => this.layar === 'beranda' && this.tampilkanBeranda());
    this.tampilkanBeranda();
    // Ada sesi online yang belum selesai (misalnya aplikasi tertutup saat main): sambung lagi.
    if (simpan.sesi() && navigator.onLine) {
      toast('Menyambung lagi ke meja terakhir…');
      this.pakaiOnline();
    }
  }

  // ---------- koneksi ----------

  private pasangKoneksi(k: Koneksi) {
    this.koneksi?.tutup();
    this.koneksi = k;
    this.info = null;
    this.view = null;
    k.saatPesan((p) => {
      if (this.koneksi === k) this.terimaPesan(p);
    });
    k.saatStatus((s) => {
      if (this.koneksi !== k || k.jenis === 'offline') return;
      if (s === 'terputus' && this.layar !== 'beranda') toast('Koneksi putus, mencoba menyambung lagi…', true);
    });
  }

  private pakaiOnline(): Koneksi {
    if (this.koneksi?.jenis !== 'online') this.pasangKoneksi(new KoneksiOnline(urlServer(), () => simpan.nama() || 'Pemain'));
    return this.koneksi!;
  }

  kirim(p: PesanKlien) {
    this.koneksi?.kirim(p);
  }

  private terimaPesan(p: PesanServer) {
    switch (p.t) {
      case 'meja':
        this.info = p.info;
        if (p.info.status === 'lobi') this.tampilkanLobi();
        else this.tampilkanMeja();
        break;
      case 'view':
        this.view = p.view;
        this.catatJikaSelesai();
        if (this.layar === 'meja') this.kontrol?.perbarui(null, p.view);
        break;
      case 'error':
        if (p.pesan.includes('nggak ketemu') && simpan.sesi()) {
          simpan.setSesi(null);
          if (this.layar === 'beranda') return toast('Meja terakhir sudah tidak ada.');
        }
        toast(p.pesan, true);
        break;
      case 'daftar':
        this.layar = 'publik';
        this.sembunyikanGame();
        renderDaftarPublik(
          this.ui,
          p.meja,
          (kode) => this.gabung(simpan.nama() || 'Pemain', kode),
          () => this.kirim({ t: 'daftar' }),
          () => this.tampilkanBeranda(),
        );
        break;
      case 'emote':
        this.kontrol?.terimaEmote(p.kursi, p.isi);
        break;
      case 'keluar':
        toast(p.alasan);
        this.keluarMeja(!p.alasan.includes('tab atau perangkat lain'));
        break;
      default:
        break;
    }
  }

  private catatJikaSelesai() {
    const v = this.view;
    if (!v) return;
    if (v.status !== 'selesai') {
      this.sudahDicatat = false;
      return;
    }
    if (this.sudahDicatat) return;
    this.sudahDicatat = true;
    simpan.tambahRiwayat({
      waktu: Date.now(),
      mode: this.jenis,
      putaran: v.riwayat.length,
      klasemen: v.pemain.map((pm, i) => ({ nama: pm.nama, skor: v.skor[i] })).sort((a, b) => b.skor - a.skor),
    });
    if (this.jenis === 'offline') simpan.setMejaOffline(null);
  }

  // ---------- layar ----------

  private sembunyikanGame() {
    this.kontrol?.hancurkan();
    this.kontrol = null;
    this.elGame.style.visibility = 'hidden';
    void this.wakeLock?.release().catch(() => undefined);
    this.wakeLock = null;
  }

  private tampilkanBeranda() {
    this.layar = 'beranda';
    this.sembunyikanGame();
    tutupModal();
    renderBeranda(
      this.ui,
      {
        buatMeja: (nama) => this.pakaiOnline().kirim({ t: 'buat', nama, pengaturan: { jumlahPemain: 4 } }),
        gabung: (nama, kode) => this.gabung(nama, kode),
        lihatPublik: () => this.pakaiOnline().kirim({ t: 'daftar' }),
        lihatRiwayat: () => {
          this.layar = 'riwayat';
          renderRiwayat(this.ui, () => this.tampilkanBeranda());
        },
        mainOffline: (nama, pengaturan, pengocokSaya) => this.mainOffline(nama, pengaturan, pengocokSaya),
        lanjutOffline: () => {
          const k = KoneksiOffline.lanjutkan();
          if (!k) {
            toast('Simpanan permainan offline tidak bisa dilanjutkan, jadi dihapus.', true);
            return this.tampilkanBeranda();
          }
          this.pasangKoneksi(k);
        },
        pasangAplikasi: this.promptPasang
          ? () => {
              void this.promptPasang?.prompt();
              this.promptPasang = null;
            }
          : null,
      },
      this.kodeAwal,
    );
  }

  private gabung(nama: string, kodeMentah: string) {
    const kode = kodeMentah.trim().toUpperCase();
    if (!/^[A-Z0-9]{5}$/.test(kode)) return toast('Kode meja 5 huruf/angka, Bos.', true);
    const sesi = simpan.sesi();
    this.pakaiOnline().kirim({ t: 'gabung', kode, nama, token: sesi?.kode === kode ? sesi.token : undefined });
  }

  private mainOffline(nama: string, pengaturan: Partial<PengaturanMeja>, pengocokSaya: boolean) {
    simpan.setMejaOffline(null);
    this.pasangKoneksi(KoneksiOffline.baru(nama, pengaturan, pengocokSaya ? 0 : undefined));
  }

  mainLagiOffline() {
    this.mainOffline(simpan.nama() || 'Pemain', simpan.pengaturanOffline(), false);
  }

  keluarMeja(hapusSesi = true) {
    if (this.koneksi?.jenis === 'online' && hapusSesi) simpan.setSesi(null);
    this.koneksi?.tutup();
    this.koneksi = null;
    this.info = null;
    this.view = null;
    this.kodeAwal = '';
    history.replaceState(null, '', location.pathname);
    this.tampilkanBeranda();
  }

  private tampilkanLobi() {
    this.layar = 'lobi';
    this.sembunyikanGame();
    tutupModal();
    renderLobi(this.ui, this.info!, (p) => this.kirim(p), () => {
      this.kirim({ t: 'keluar' });
      this.keluarMeja();
    });
  }

  private tampilkanMeja() {
    if (this.layar === 'meja' && this.kontrol) {
      this.kontrol.perbarui(this.info, null);
      return;
    }
    this.layar = 'meja';
    this.ui.innerHTML = '';
    this.elGame.style.visibility = 'visible';
    this.game ??= buatGame(this.elGame);
    const akar = this.ui;
    void this.game.scene.then((scene) => {
      if (this.layar !== 'meja' || this.kontrol) return;
      this.kontrol = new KontrolMeja(this, scene, akar);
      this.kontrol.perbarui(this.info, this.view);
    });
    window.dispatchEvent(new Event('resize'));
    const nav = navigator as Navigator & { wakeLock?: { request(t: 'screen'): Promise<{ release(): Promise<void> }> } };
    void nav.wakeLock
      ?.request('screen')
      .then((w) => (this.wakeLock = w))
      .catch(() => undefined);
  }
}

new Aplikasi().mulai();
