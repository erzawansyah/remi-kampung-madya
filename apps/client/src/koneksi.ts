// Dua jenis koneksi dengan antarmuka sama:
// - online: WebSocket ke server, sambung ulang otomatis pakai token.
// - offline: meja dijalankan langsung di browser melawan bot, disimpan di localStorage.

import { Meja, type PengaturanMeja, type PesanKlien, type PesanServer } from '@remi/meja';
import { simpan } from './penyimpanan';

export type StatusKoneksi = 'menyambung' | 'tersambung' | 'terputus';

export interface Koneksi {
  readonly jenis: 'online' | 'offline';
  kirim(p: PesanKlien): void;
  saatPesan(cb: (p: PesanServer) => void): void;
  saatStatus(cb: (s: StatusKoneksi) => void): void;
  tutup(): void;
}

export class KoneksiOnline implements Koneksi {
  readonly jenis = 'online';
  private ws: WebSocket | null = null;
  private antrian: PesanKlien[] = [];
  private pendengar: ((p: PesanServer) => void)[] = [];
  private pendengarStatus: ((s: StatusKoneksi) => void)[] = [];
  private jedaUlang = 500;
  private ditutup = false;
  private timerPing: ReturnType<typeof setInterval> | null = null;

  constructor(
    private readonly url: string,
    private readonly nama: () => string,
  ) {
    this.sambung();
  }

  private status(s: StatusKoneksi) {
    this.pendengarStatus.forEach((cb) => cb(s));
  }

  private sambung() {
    if (this.ditutup) return;
    this.status('menyambung');
    const ws = new WebSocket(this.url);
    this.ws = ws;
    ws.onopen = () => {
      this.jedaUlang = 500;
      this.status('tersambung');
      // Lanjutkan sesi lama bila ada (misalnya habis sinyal hilang atau aplikasi ditutup).
      const sesi = simpan.sesi();
      if (sesi) ws.send(JSON.stringify({ t: 'gabung', kode: sesi.kode, nama: this.nama(), token: sesi.token }));
      for (const p of this.antrian.splice(0)) ws.send(JSON.stringify(p));
      this.timerPing = setInterval(() => this.kirim({ t: 'ping' }), 25_000);
    };
    ws.onmessage = (e) => {
      let p: PesanServer;
      try {
        p = JSON.parse(String(e.data));
      } catch {
        return;
      }
      if (p.t === 'masuk') simpan.setSesi({ kode: p.kode, token: p.token });
      if (p.t === 'keluar') simpan.setSesi(null);
      this.pendengar.forEach((cb) => cb(p));
    };
    ws.onclose = (e) => {
      if (this.timerPing) clearInterval(this.timerPing);
      this.timerPing = null;
      this.ws = null;
      if (this.ditutup) return;
      if (e.code === 4000) {
        // Server menutup karena kursi ini dibuka di tab/perangkat lain: jangan rebutan sambung ulang.
        this.ditutup = true;
        const p: PesanServer = { t: 'keluar', alasan: 'Meja ini sedang dibuka di tab atau perangkat lain.' };
        this.pendengar.forEach((cb) => cb(p));
        return;
      }
      this.status('terputus');
      setTimeout(() => this.sambung(), this.jedaUlang);
      this.jedaUlang = Math.min(this.jedaUlang * 2, 8000);
    };
  }

  kirim(p: PesanKlien) {
    if (this.ws?.readyState === WebSocket.OPEN) this.ws.send(JSON.stringify(p));
    else if (p.t !== 'ping') this.antrian.push(p);
  }

  saatPesan(cb: (p: PesanServer) => void) {
    this.pendengar.push(cb);
  }

  saatStatus(cb: (s: StatusKoneksi) => void) {
    this.pendengarStatus.push(cb);
  }

  tutup() {
    this.ditutup = true;
    this.ws?.close();
  }
}

const ID_SAYA = 'saya';

export class KoneksiOffline implements Koneksi {
  readonly jenis = 'offline';
  private meja: Meja | null = null;
  private pendengar: ((p: PesanServer) => void)[] = [];
  private tertunda: PesanServer[] = [];
  private timerSimpan: ReturnType<typeof setTimeout> | null = null;

  private constructor() {}

  private opsi() {
    return {
      kode: 'OFFLINE',
      kirim: (_: string, p: PesanServer) => this.kirimKeUI(p),
      batasLog: 200,
      saatBerubah: () => this.jadwalSimpan(),
    };
  }

  /** Meja baru: saya + bot di kursi lainnya, langsung mulai. */
  static baru(nama: string, pengaturan: Partial<PengaturanMeja>, pengocok?: number): KoneksiOffline {
    const k = new KoneksiOffline();
    const meja = Meja.buat(k.opsi(), ID_SAYA, nama, { ...pengaturan, detikGiliran: 0, publik: false });
    k.meja = meja;
    for (let i = 1; i < (pengaturan.jumlahPemain ?? 4); i++) {
      meja.terima(ID_SAYA, { t: 'aturKursi', kursi: i, jenis: 'bot', level: pengaturan.levelBot });
    }
    meja.terima(ID_SAYA, { t: 'mulai', pengocok });
    return k;
  }

  static lanjutkan(): KoneksiOffline | null {
    const data = simpan.mejaOffline();
    if (!data || data.versi !== 1) return null;
    const k = new KoneksiOffline();
    try {
      k.meja = new Meja(k.opsi(), data);
      k.meja.terhubung(ID_SAYA);
    } catch (e) {
      // Simpanan rusak/tidak cocok: buang supaya tidak macet terus.
      console.error('simpanan offline tidak bisa dilanjutkan', e);
      k.meja?.hentikan();
      simpan.setMejaOffline(null);
      return null;
    }
    return k;
  }

  private kirimKeUI(p: PesanServer) {
    if (p.t === 'keluar') {
      simpan.setMejaOffline(null);
      this.meja?.hentikan();
    }
    if (!this.pendengar.length) {
      this.tertunda.push(p);
      return;
    }
    // Asinkron supaya UI tidak dipanggil di tengah pemrosesan meja.
    queueMicrotask(() => this.pendengar.forEach((cb) => cb(p)));
  }

  private jadwalSimpan() {
    if (this.timerSimpan) return;
    this.timerSimpan = setTimeout(() => {
      this.timerSimpan = null;
      if (this.meja) simpan.setMejaOffline(this.meja.data);
    }, 300);
  }

  kirim(p: PesanKlien) {
    if (!this.meja) return;
    if (p.t === 'ping') return this.kirimKeUI({ t: 'pong' });
    this.meja.terima(ID_SAYA, p);
  }

  saatPesan(cb: (p: PesanServer) => void) {
    this.pendengar.push(cb);
    const lama = this.tertunda.splice(0);
    queueMicrotask(() => lama.forEach((p) => cb(p)));
  }

  saatStatus(cb: (s: StatusKoneksi) => void) {
    cb('tersambung');
  }

  tutup() {
    if (this.timerSimpan) clearTimeout(this.timerSimpan);
    if (this.meja && this.meja.status !== 'selesai') simpan.setMejaOffline(this.meja.data);
    this.meja?.hentikan();
    this.meja = null;
  }
}

export function urlServer(): string {
  const proto = location.protocol === 'https:' ? 'wss' : 'ws';
  return `${proto}://${location.host}/ws`;
}
