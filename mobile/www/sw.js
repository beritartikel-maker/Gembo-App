// Gembo Notes — service worker: aplikasi tetap bisa dimuat saat offline.
// Naikkan angka VERSI setiap kali index.html / cloud.js diperbarui.
const VERSI = "gembo-v1";
const SHELL = VERSI + "-shell";
const SDK = VERSI + "-sdk";
const FILE_INTI = ["./", "./index.html", "./cloud.js"];

self.addEventListener("install", (e) => {
  e.waitUntil(
    caches.open(SHELL)
      .then((c) => Promise.all(FILE_INTI.map((u) => c.add(new Request(u, { cache: "reload" })).catch(() => {}))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys()
      .then((ks) => Promise.all(ks.filter((k) => k !== SHELL && k !== SDK).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);

  // Firebase SDK (URL berversi, tidak berubah) — cache dulu, unduh bila belum ada.
  if (url.hostname === "www.gstatic.com" && url.pathname.startsWith("/firebasejs/")) {
    e.respondWith(
      caches.open(SDK).then((c) =>
        c.match(req).then((hit) => hit || fetch(req).then((res) => {
          if (res && (res.ok || res.type === "opaque")) c.put(req, res.clone());
          return res;
        }))
      )
    );
    return;
  }

  // File aplikasi sendiri — ambil versi terbaru bila online, cadangan dari cache bila offline.
  if (url.origin === self.location.origin) {
    e.respondWith(
      fetch(req).then((res) => {
        if (res && res.ok) { const salin = res.clone(); caches.open(SHELL).then((c) => c.put(req, salin)); }
        return res;
      }).catch(() =>
        caches.match(req, { ignoreSearch: true }).then((hit) =>
          hit || (req.mode === "navigate" ? caches.match("./index.html") : Response.error())
        )
      )
    );
  }
  // Permintaan lain (Firestore, auth, dll.) dibiarkan lewat; Firestore punya cache offline sendiri.
});
