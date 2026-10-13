// Splash: hilang begitu app memasang layar pertama di #ui, lalu dibuang (tidak muncul lagi walau
// #ui sempat kosong sesaat saat pindah ke meja). Berkas terpisah (bukan skrip inline) supaya
// Content-Security-Policy cukup script-src 'self'. Dimuat sinkron tepat setelah #splash di index.html.
// Tanpa skrip ini pun splash tetap hilang: CSS `#ui:not(:empty) ~ #splash` dan animasi cadangan 8 detik.
(function () {
  var ui = document.getElementById('ui');
  var splash = document.getElementById('splash');
  if (!ui || !splash || !window.MutationObserver) return;
  var selesai = function () {
    pengamat.disconnect();
    splash.classList.add('selesai');
    setTimeout(function () {
      if (splash.parentNode) splash.parentNode.removeChild(splash);
    }, 400);
  };
  var pengamat = new MutationObserver(function () {
    if (ui.childElementCount > 0) selesai();
  });
  pengamat.observe(ui, { childList: true });
  if (ui.childElementCount > 0) selesai();
})();
