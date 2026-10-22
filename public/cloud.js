// Gembo Notes — login Google + sinkron Firestore.
// Memakai variabel global aplikasi (D, S, TH, KEY, render, imgGet/imgPut/imgDel).
// Firebase SDK dimuat dinamis agar aplikasi tetap terbuka saat offline.
// Jika SDK belum bisa diunduh (offline & belum tersimpan di cache), aplikasi jalan
// dengan data lokal, lalu otomatis tersambung & sinkron begitu perangkat online.
const FB = "https://www.gstatic.com/firebasejs/10.14.1/";
async function loadSDK() {
  const [a, au, fs] = await Promise.all([
    import(FB + "firebase-app.js"),
    import(FB + "firebase-auth.js"),
    import(FB + "firebase-firestore.js")
  ]);
  return { ...a, ...au, ...fs };
}
async function waitSDK() {
  for (;;) {
    try { return await loadSDK(); }
    catch (e) {
      if (!navigator.onLine) await new Promise((r) => addEventListener("online", r, { once: true }));
      else await new Promise((r) => setTimeout(r, 5000));
    }
  }
}

// ---------- Indikator status offline / sinkron ----------
let pill = null, pillTimer = null;
function showPill(text, ms) {
  if (!pill) {
    pill = document.createElement("div");
    pill.setAttribute("role", "status");
    pill.style.cssText = "position:fixed;left:50%;transform:translateX(-50%);top:calc(env(safe-area-inset-top,0px) + 8px);z-index:1900;padding:6px 14px;border-radius:999px;background:rgba(23,48,47,.92);color:#fff;font:600 12px/1.3 system-ui,sans-serif;max-width:92vw;text-align:center;pointer-events:none;box-shadow:0 2px 10px rgba(0,0,0,.2)";
    document.body.appendChild(pill);
  }
  clearTimeout(pillTimer);
  pill.textContent = text; pill.style.display = "block";
  if (ms) pillTimer = setTimeout(() => { pill.style.display = "none"; }, ms);
}
function hidePill() { clearTimeout(pillTimer); if (pill) pill.style.display = "none"; }
const OFFLINE_MSG = "Offline — perubahan disimpan di perangkat dan disinkronkan saat online";
if (!navigator.onLine) showPill(OFFLINE_MSG);
addEventListener("offline", () => showPill(OFFLINE_MSG));

const $ = (id) => document.getElementById(id);
const isNative = () => !!(window.Capacitor && Capacitor.isNativePlatform && Capacitor.isNativePlatform());

// Android: samakan warna status bar dengan tema aplikasi.
function syncBars() {
  const SB = isNative() && window.Capacitor.Plugins.StatusBar;
  if (!SB) return;
  const cs = getComputedStyle(document.documentElement);
  const bg = (cs.getPropertyValue("--bg") || "#F2F5F4").trim();
  const m = /^#?([0-9a-f]{6})$/i.exec(bg);
  const lum = m ? (parseInt(m[1].slice(0, 2), 16) * 0.299 + parseInt(m[1].slice(2, 4), 16) * 0.587 + parseInt(m[1].slice(4, 6), 16) * 0.114) / 255 : 1;
  try { SB.setOverlaysWebView({ overlay: true }); SB.setBackgroundColor({ color: "#00000000" }); SB.setStyle({ style: lum < 0.5 ? "DARK" : "LIGHT" }); } catch (e) {}
}
if (isNative()) {
  const _at = window.applyTheme;
  if (typeof _at === "function") window.applyTheme = function () { const r = _at.apply(this, arguments); syncBars(); return r; };
  syncBars();
}
// Tunggu SDK (langsung selesai bila online / sudah ada di cache service worker).
const {
  initializeApp, getAuth, GoogleAuthProvider, signInWithPopup, signInWithRedirect,
  getRedirectResult, onAuthStateChanged, signOut, signInWithCredential,
  initializeFirestore, persistentLocalCache, persistentMultipleTabManager,
  collection, doc, setDoc, deleteDoc, onSnapshot, waitForPendingWrites
} = await waitSDK();

const firebaseConfig = {
  apiKey: "AIzaSyBYrs3oAVbL2yF5IIeZijpov3shN7IPoHM",
  authDomain: "gembo-notes.firebaseapp.com",
  projectId: "gembo-notes",
  storageBucket: "gembo-notes.firebasestorage.app",
  messagingSenderId: "899238767564",
  appId: "1:899238767564:web:c4f3f4026de87ccc518b69",
  measurementId: "G-6BZXG4Z904"
};

window.__gembo = 1;
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = initializeFirestore(app, {
  localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() })
});

const gate = $("gate"), gtLoad = $("gtLoad"), gtMain = $("gtMain"), gtBtn = $("gtBtn"), gtErr = $("gtErr");
gate.classList.add("on");

// Kunci localStorage yang ikut disinkronkan (kunci API AI sengaja TIDAK disinkronkan).
const KV = {
  "catat-order-set": "set",
  "catat-order-theme": "theme",
  "catat-order-target": "target"
};
const KV_REV = Object.fromEntries(Object.entries(KV).map(([k, v]) => [v, k]));

const rawSet = Storage.prototype.setItem;
let muted = false;          // true saat kita sendiri menulis hasil dari cloud
let uid = null;
let unsubs = [];
const sentOrders = new Map(); // id -> json terakhir yang sama dengan cloud
const sentKv = new Map();     // nama -> string
const cloudImgs = new Set();  // kunci gambar yang sudah ada di cloud
let timers = {};

const col = (name) => collection(db, "users", uid, name);
const ref = (name, id) => doc(db, "users", uid, name, id);
const debounce = (key, fn, ms) => { clearTimeout(timers[key]); timers[key] = setTimeout(fn, ms); };

// ---------- Penerusan perubahan lokal ke cloud ----------
Storage.prototype.setItem = function (k, v) {
  rawSet.call(this, k, v);
  if (muted || !uid || this !== localStorage) return;
  if (k === KEY) debounce("orders", pushOrders, 400);
  else if (KV[k]) debounce("kv:" + k, () => pushKv(k), 400);
};

async function pushOrders() {
  if (!uid) return;
  const cur = new Map(D.map((o) => [String(o.id), JSON.stringify(o)]));
  const jobs = [];
  for (const [id, j] of cur) {
    if (sentOrders.get(id) !== j) {
      sentOrders.set(id, j);
      jobs.push(setDoc(ref("orders", id), { data: j, u: Date.now() }));
    }
  }
  for (const id of [...sentOrders.keys()]) {
    if (!cur.has(id)) { sentOrders.delete(id); jobs.push(deleteDoc(ref("orders", id))); }
  }
  try { await Promise.all(jobs); } catch (e) { console.warn("sinkron order gagal", e); }
}

async function pushKv(k) {
  if (!uid) return;
  const name = KV[k];
  const v = localStorage.getItem(k) || "";
  if (sentKv.get(name) === v) return;
  sentKv.set(name, v);
  try { await setDoc(ref("kv", name), { v, u: Date.now() }); } catch (e) { console.warn("sinkron pengaturan gagal", e); }
}

// Gambar: dibungkus agar ikut terkirim/terhapus di cloud.
const origImgPut = window.imgPut, origImgDel = window.imgDel;
const toDataURL = (blob) => new Promise((res, rej) => { const f = new FileReader(); f.onload = () => res(f.result); f.onerror = rej; f.readAsDataURL(blob); });

async function fitBlob(blob) {
  // Dokumen Firestore maksimal 1 MiB; kecilkan bila perlu.
  if (blob.size <= 650000) return blob;
  try {
    const bm = await createImageBitmap(blob);
    for (const [max, q] of [[1280, .7], [1024, .65], [800, .6]]) {
      const sc = Math.min(1, max / Math.max(bm.width, bm.height));
      const c = document.createElement("canvas");
      c.width = Math.round(bm.width * sc); c.height = Math.round(bm.height * sc);
      c.getContext("2d").drawImage(bm, 0, 0, c.width, c.height);
      const b = await new Promise((r) => c.toBlob(r, "image/jpeg", q));
      if (b && b.size <= 650000) return b;
    }
  } catch (e) { /* abaikan */ }
  return null;
}

async function pushImg(k, blob) {
  if (!uid) return;
  try {
    const b = await fitBlob(blob);
    if (!b) return;
    cloudImgs.add(k);
    await setDoc(ref("imgs", encodeURIComponent(k)), { k, b: await toDataURL(b), u: Date.now() });
  } catch (e) { console.warn("sinkron gambar gagal", e); }
}

window.imgPut = async function (k, b) {
  const r = await origImgPut(k, b);
  pushImg(k, b);
  return r;
};
window.imgDel = async function (k) {
  const r = await origImgDel(k);
  if (uid) { cloudImgs.delete(k); deleteDoc(ref("imgs", encodeURIComponent(k))).catch(() => {}); }
  return r;
};

// ---------- Penerapan data dari cloud ke aplikasi ----------
let renderWait = null;
function safeRender() {
  const a = document.activeElement;
  const typing = a && /^(INPUT|TEXTAREA|SELECT)$/.test(a.tagName) && a.type !== "checkbox" && a.type !== "button";
  if (typing) {
    if (!renderWait) renderWait = setInterval(() => {
      const b = document.activeElement;
      if (!(b && /^(INPUT|TEXTAREA|SELECT)$/.test(b.tagName))) { clearInterval(renderWait); renderWait = null; try { render(); } catch (e) {} }
    }, 2000);
    return;
  }
  try { render(); } catch (e) {}
}

function writeLocal(k, v) { muted = true; try { rawSet.call(localStorage, k, v); } finally { muted = false; } }

function applyOrders() {
  D.sort((a, b) => (Number(a.id) || 0) - (Number(b.id) || 0));
  writeLocal(KEY, JSON.stringify(D));
  safeRender();
}

let firstOrders = true;
function listenOrders() {
  return onSnapshot(col("orders"), (snap) => {
    let changed = false;
    snap.docChanges().forEach((ch) => {
      const id = ch.doc.id;
      if (ch.type === "removed") {
        sentOrders.delete(id);
        const n = D.length; D = D.filter((o) => String(o.id) !== id);
        if (D.length !== n) changed = true;
        return;
      }
      const j = ch.doc.data().data;
      if (sentOrders.get(id) === j) return;
      let o; try { o = JSON.parse(j); } catch (e) { return; }
      sentOrders.set(id, j);
      const i = D.findIndex((x) => String(x.id) === id);
      if (i >= 0) D[i] = o; else D.push(o);
      changed = true;
    });
    if (firstOrders) { firstOrders = false; pushOrders(); /* unggah order lokal yang belum ada di cloud */ }
    if (changed) applyOrders();
  }, (e) => showFatal(e));
}

let firstKv = true;
function listenKv() {
  return onSnapshot(col("kv"), (snap) => {
    let changed = false;
    snap.docChanges().forEach((ch) => {
      if (ch.type === "removed") return;
      const name = ch.doc.id, v = ch.doc.data().v || "", k = KV_REV[name];
      if (!k || sentKv.get(name) === v) return;
      sentKv.set(name, v);
      if (v === (localStorage.getItem(k) || "")) return;
      writeLocal(k, v);
      try {
        if (name === "set") S = { ...DEF, ...JSON.parse(v || "{}") };
        else if (name === "theme") { const j = JSON.parse(v || "null"); if (j) { TH = { ...TH, ...j }; applyTheme(); } }
      } catch (e) { /* abaikan */ }
      changed = true;
    });
    if (firstKv) {
      firstKv = false;
      for (const k of Object.keys(KV)) if (!sentKv.has(KV[k]) && localStorage.getItem(k) != null) pushKv(k);
    }
    if (changed) safeRender();
  });
}

let firstImgs = true;
function listenImgs() {
  return onSnapshot(col("imgs"), async (snap) => {
    let added = false;
    for (const ch of snap.docChanges()) {
      const d = ch.doc.data();
      const k = d && d.k;
      if (!k) continue;
      if (ch.type === "removed") { cloudImgs.delete(k); await origImgDel(k); added = true; continue; }
      cloudImgs.add(k);
      if (await imgGet(k)) continue;
      try { const blob = await (await fetch(d.b)).blob(); await origImgPut(k, blob); added = true; } catch (e) { /* abaikan */ }
    }
    if (firstImgs) {
      firstImgs = false;
      // unggah foto lokal yang belum ada di cloud
      for (const o of D) for (const pre of ["", "r", "f"]) for (let i = 0; i < 10; i++) {
        const k = o.id + ":" + pre + i;
        if (cloudImgs.has(k)) continue;
        const b = await imgGet(k);
        if (b) await pushImg(k, b);
      }
    }
    if (added) safeRender();
  });
}

// ---------- Login / keluar ----------
function showGate(msg) {
  gtLoad.hidden = true; gtMain.hidden = false; gate.classList.add("on");
  gtBtn.disabled = false; gtErr.textContent = msg || "";
}
function showFatal(e) {
  console.error(e);
  const m = e && e.code === "permission-denied"
    ? "Akses ditolak oleh Firestore. Periksa aturan keamanan (rules) di Firebase."
    : "Terjadi kesalahan sinkron: " + (e && e.message ? e.message : e);
  gtErr.textContent = m;
  if (!gate.classList.contains("on")) alert(m);
}

gtBtn.addEventListener("click", async () => {
  gtBtn.disabled = true; gtErr.textContent = "";
  const p = new GoogleAuthProvider();
  p.setCustomParameters({ prompt: "select_account" });
  try {
    if (isNative()) {
      // Android (Capacitor): login Google native, lalu tukar ke sesi Firebase JS.
      const FA = window.Capacitor.Plugins.FirebaseAuthentication;
      const r = await FA.signInWithGoogle();
      const cr = r && r.credential;
      if (!cr || !(cr.idToken || cr.accessToken)) throw { code: "auth/no-credential", message: "Google tidak mengembalikan kredensial." };
      await signInWithCredential(auth, GoogleAuthProvider.credential(cr.idToken || null, cr.accessToken || null));
    } else if (window.gemboDesktop && window.gemboDesktop.browserLogin) {
      // Windows (Electron): login di browser sistem, hasilnya diterima lewat jalur lokal.
      gtErr.textContent = "Menunggu login di browser Anda… selesaikan di jendela browser yang terbuka.";
      const r = await window.gemboDesktop.browserLogin();
      if (!r || !(r.idToken || r.accessToken)) throw { code: "auth/no-credential", message: "Login dibatalkan atau kedaluwarsa. Coba lagi." };
      await signInWithCredential(auth, GoogleAuthProvider.credential(r.idToken || null, r.accessToken || null));
      gtErr.textContent = "";
    } else {
      await signInWithPopup(auth, p);
    }
  }
  catch (e) {
    if (e && (e.code === "auth/popup-blocked" || e.code === "auth/operation-not-supported-in-this-environment")) {
      try { await signInWithRedirect(auth, p); return; } catch (e2) { e = e2; }
    }
    if (e && (e.code === "auth/popup-closed-by-user" || /cancel/i.test(String(e.message || "")) || e.code === "auth/cancelled-popup-request")) { gtBtn.disabled = false; return; }
    const m = e && e.code === "auth/unauthorized-domain"
      ? "Domain ini belum diizinkan. Tambahkan di Firebase Console → Authentication → Settings → Authorized domains."
      : e && e.code === "auth/operation-not-allowed"
        ? "Login Google belum diaktifkan di Firebase Console → Authentication → Sign-in method."
        : "Gagal masuk: " + (e && e.message ? e.message : e);
    showGate(m);
  }
});

function addLogoutButton(user) {
  const m = $("mnm");
  if (!m || $("gtOut")) return;
  const b = document.createElement("button");
  b.id = "gtOut";
  b.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><path d="M16 17l5-5-5-5M21 12H9"/></svg>Keluar (' + ((user.email || "").replace(/</g, "")) + ")";
  b.onclick = async () => { mnClose(); if (!confirm("Keluar dari akun ini? Data tetap aman di cloud.")) return; await signOut(auth); try { if (isNative()) await window.Capacitor.Plugins.FirebaseAuthentication.signOut(); } catch (e) {} };
  m.appendChild(b);
}

onAuthStateChanged(auth, (user) => {
  unsubs.forEach((u) => u()); unsubs = [];
  if (!user) {
    uid = null;
    sentOrders.clear(); sentKv.clear(); cloudImgs.clear();
    firstOrders = firstKv = firstImgs = true;
    const o = $("gtOut"); if (o) o.remove();
    showGate();
    return;
  }
  // Akun berbeda di perangkat yang sama: bersihkan data lokal agar tidak tercampur.
  const prev = localStorage.getItem("gembo-last-uid");
  if (prev && prev !== user.uid) {
    ["catat-order-v1", "catat-order-set", "catat-order-theme", "catat-order-target", "catat-order-view"].forEach((k) => localStorage.removeItem(k));
    localStorage.setItem("gembo-last-uid", user.uid);
    const rq = indexedDB.deleteDatabase("catat-order-img");
    rq.onsuccess = rq.onerror = rq.onblocked = () => location.reload();
    return;
  }
  localStorage.setItem("gembo-last-uid", user.uid);
  uid = user.uid;
  addLogoutButton(user);
  gate.classList.remove("on");
  unsubs = [listenKv(), listenOrders(), listenImgs()];
});

addEventListener("online", () => {
  if (!uid) { hidePill(); return; }
  showPill("Online — menyinkronkan…");
  waitForPendingWrites(db).then(() => showPill("Semua data tersinkron ✓", 2500)).catch(() => hidePill());
});
if (navigator.onLine) hidePill();

getRedirectResult(auth).catch((e) => showGate("Gagal masuk: " + (e && e.message ? e.message : e)));
