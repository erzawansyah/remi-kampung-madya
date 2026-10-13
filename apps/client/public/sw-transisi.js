// Jembatan transisi pembaruan PWA. Dimuat sw.js lewat workbox `importScripts` (vite.config.ts), tidak ikut precache.
//
// Masalahnya: versi 0.1.x memakai registerType 'autoUpdate'. Halamannya tidak pernah mengirim SKIP_WAITING;
// ia menunggu SW baru aktif sendiri lalu memuat ulang. Sejak 0.2, SW baru MENUNGGU sampai halaman
// (pembaruan.ts) memilih momen aman. Tanpa jembatan ini, pemain 0.1 tertahan di versi lama sampai semua tab
// ditutup, dan di HP itu hampir tidak pernah terjadi.
//
// Saat SW baru dipasang ('install'):
// - Belum ada SW aktif (kunjungan pertama): tidak perlu apa-apa, SW langsung aktif sendiri.
// - SW aktif masih versi sebelum jembatan (penanda di Cache Storage belum ada, artinya 0.1.x): langsung aktif.
// - Selain itu tiap jendela disapa {t:'REMI_SAPA'}. Halaman 0.2+ menjawab {t:'REMI_JAWAB', versi}
//   (pasangPenjawabSapa di src/pembaruan.ts). Ada yang tidak menjawab = halaman lama: langsung aktif
//   (skipWaiting). Semua menjawab = aturan momen aman 0.2 tetap berlaku (SW menunggu).
// Saat SW ini aktif ('activate'): penanda ditulis, dan jendela yang tadi tidak menjawab dimuat ulang
// (client.navigate, tanpa ditunggu: navigasinya sendiri menunggu SW ini selesai aktif). Halaman 0.1
// biasanya memuat ulang sendiri lewat kode autoUpdate-nya, tapi itu terlewat kalau pemasangan SW mulai
// sebelum halamannya sempat mendaftarkan pendengar.
//
// Logika keputusan diuji di apps/client/test/swTransisi.test.ts.
(function (sw) {
  'use strict';

  var SAPA = 'REMI_SAPA';
  var JAWAB = 'REMI_JAWAB';
  /** Lama menunggu jawaban tiap putaran sapa. */
  var BATAS_JAWAB_MS = 1500;
  /** Putaran sapa: halaman 0.2+ yang masih memuat skripnya mendapat kesempatan kedua. */
  var PUTARAN_SAPA = 2;
  var CACHE_PENANDA = 'remi-transisi';
  var URL_PENANDA = '__remi-transisi';

  /** Jendela yang tidak menjawab sapa di pemasangan terakhir (dimuat ulang saat SW ini aktif). */
  var tidakMenjawab = [];
  /** Jawaban lewat self 'message' (cadangan kalau MessageChannel tidak dipakai klien): id klien → fungsi. */
  var menunggu = {};

  /** Sapa satu jendela; true kalau ia menjawab sebelum batas waktu. */
  function sapa(klien, batasMs) {
    return new Promise(function (ok) {
      var selesai = false;
      var saluran = null;
      function akhiri(hasil) {
        if (selesai) return;
        selesai = true;
        delete menunggu[klien.id];
        if (saluran) {
          try {
            saluran.port1.close();
          } catch (e) {
            // abaikan
          }
        }
        ok(hasil);
      }
      menunggu[klien.id] = function () {
        akhiri(true);
      };
      setTimeout(function () {
        akhiri(false);
      }, batasMs);
      try {
        if (typeof MessageChannel === 'function') {
          saluran = new MessageChannel();
          saluran.port1.onmessage = function (e) {
            if (e.data && e.data.t === JAWAB) akhiri(true);
          };
          klien.postMessage({ t: SAPA }, [saluran.port2]);
        } else klien.postMessage({ t: SAPA });
      } catch (e) {
        akhiri(false);
      }
    });
  }

  function jendela() {
    return sw.clients.matchAll({ type: 'window', includeUncontrolled: true });
  }

  /** Sapa semua jendela (paling banyak PUTARAN_SAPA putaran); kembalikan id jendela yang tidak menjawab. */
  function cariYangTidakMenjawab(batasMs, putaran) {
    var menjawab = {};
    function satuPutaran(sisa) {
      return jendela().then(function (semua) {
        var belum = semua.filter(function (k) {
          return !menjawab[k.id];
        });
        if (!belum.length) return [];
        return Promise.all(
          belum.map(function (k) {
            return sapa(k, batasMs).then(function (ya) {
              if (ya) menjawab[k.id] = true;
              return ya ? null : k.id;
            });
          }),
        ).then(function (hasil) {
          var diam = hasil.filter(function (id) {
            return id !== null;
          });
          return diam.length && sisa > 1 ? satuPutaran(sisa - 1) : diam;
        });
      });
    }
    return satuPutaran(putaran);
  }

  function adaPenanda() {
    if (!sw.caches) return Promise.resolve(false);
    return sw.caches
      .open(CACHE_PENANDA)
      .then(function (c) {
        return c.match(URL_PENANDA);
      })
      .then(function (r) {
        return !!r;
      });
  }

  function tulisPenanda() {
    if (!sw.caches) return Promise.resolve();
    return sw.caches.open(CACHE_PENANDA).then(function (c) {
      return c.put(URL_PENANDA, new Response('1'));
    });
  }

  /**
   * Keputusan saat pemasangan: true = SW baru langsung aktif (skipWaiting).
   * Mengisi `tidakMenjawab` untuk dimuat ulang saat SW ini aktif.
   */
  function putuskan() {
    tidakMenjawab = [];
    if (!sw.registration || !sw.registration.active) return Promise.resolve(false);
    return adaPenanda()
      .catch(function () {
        return false;
      })
      .then(function (aktifSudahBaru) {
        return cariYangTidakMenjawab(BATAS_JAWAB_MS, PUTARAN_SAPA).then(function (diam) {
          tidakMenjawab = diam;
          return !aktifSudahBaru || diam.length > 0;
        });
      });
  }

  /**
   * Muat ulang jendela lama yang tadi tidak menjawab (sekarang sudah dikendalikan SW ini). Hanya memicu
   * navigasinya, tidak menunggu selesai: permintaan navigasi itu sendiri menunggu SW ini selesai aktif,
   * jadi kalau ditunggu di dalam waitUntil 'activate', keduanya saling menunggu sampai browser menyerah.
   * Mengembalikan jumlah jendela yang dimuat ulang.
   */
  function muatUlangYangLama() {
    var ids = tidakMenjawab;
    tidakMenjawab = [];
    if (!ids.length) return Promise.resolve(0);
    return jendela().then(function (semua) {
      var n = 0;
      semua.forEach(function (k) {
        if (ids.indexOf(k.id) < 0 || typeof k.navigate !== 'function') return;
        n++;
        k.navigate(k.url).catch(function () {
          // Jendelanya sudah dimuat ulang sendiri (kode autoUpdate 0.1) atau sudah ditutup.
        });
      });
      return n;
    });
  }

  sw.addEventListener('message', function (e) {
    var d = e.data;
    var id = e.source && e.source.id;
    if (d && d.t === JAWAB && id && menunggu[id]) menunggu[id]();
  });

  sw.addEventListener('install', function (e) {
    e.waitUntil(
      putuskan()
        .then(function (lompat) {
          if (lompat) return sw.skipWaiting();
        })
        .catch(function () {
          // Gagal menilai: biarkan SW menunggu seperti biasa (perilaku 0.2).
        }),
    );
  });

  sw.addEventListener('activate', function (e) {
    e.waitUntil(
      tulisPenanda().catch(function () {
        return undefined;
      }),
    );
    // Sengaja di luar waitUntil (lihat muatUlangYangLama).
    muatUlangYangLama().catch(function () {
      return 0;
    });
  });

  // Untuk test unit (tidak dipakai di SW sungguhan).
  sw.__remiTransisi = {
    putuskan: putuskan,
    muatUlangYangLama: muatUlangYangLama,
    cariYangTidakMenjawab: cariYangTidakMenjawab,
    BATAS_JAWAB_MS: BATAS_JAWAB_MS,
    PUTARAN_SAPA: PUTARAN_SAPA,
  };
})(self);
