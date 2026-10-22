// Gembo Notes untuk Windows: membuka versi online sehingga selalu otomatis terbaru.
const { app, BrowserWindow, shell, session, Menu, ipcMain } = require("electron");
const path = require("path");
const http = require("http");
const crypto = require("crypto");

const APP_URL = "https://gembo-notes.web.app";
const AUTH_HOSTS = new Set(["accounts.google.com", "gembo-notes.firebaseapp.com", "gembo-notes.web.app"]);
// Google menolak login dari browser tertanam yang menyebut "Electron"; pakai UA Chrome biasa.
const UA = `Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${process.versions.chrome} Safari/537.36`;
app.userAgentFallback = UA;

if (!app.requestSingleInstanceLock()) { app.quit(); }

let win;
function create() {
  win = new BrowserWindow({
    width: 1200, height: 820, minWidth: 360, minHeight: 560,
    backgroundColor: "#F2F5F4",
    icon: path.join(__dirname, "build", "icon.png"),
    autoHideMenuBar: true,
    show: false,
    webPreferences: { contextIsolation: true, sandbox: true, nodeIntegration: false, spellcheck: false, preload: path.join(__dirname, "preload.js") }
  });
  Menu.setApplicationMenu(null);
  win.once("ready-to-show", () => win.show());
  win.loadURL(APP_URL, { userAgent: UA });

  win.webContents.on("did-fail-load", (_e, code, _d, _u, isMain) => {
    if (isMain && code !== -3) win.loadFile(path.join(__dirname, "offline.html"));
  });

  // Popup login Google/Firebase boleh terbuka di jendela kecil; tautan lain ke browser bawaan.
  win.webContents.setWindowOpenHandler(({ url }) => {
    let u; try { u = new URL(url); } catch (e) { return { action: "deny" }; }
    if (u.protocol === "https:" && AUTH_HOSTS.has(u.hostname)) {
      return { action: "allow", overrideBrowserWindowOptions: { width: 520, height: 720, autoHideMenuBar: true, parent: win, webPreferences: { sandbox: true, contextIsolation: true } } };
    }
    if (/^(https?|whatsapp):$/.test(u.protocol)) shell.openExternal(url);
    return { action: "deny" };
  });
  win.webContents.on("will-navigate", (e, url) => {
    let u; try { u = new URL(url); } catch (er) { e.preventDefault(); return; }
    if (u.protocol === "file:") return;
    if (!AUTH_HOSTS.has(u.hostname)) { e.preventDefault(); if (/^(https?|whatsapp):$/.test(u.protocol)) shell.openExternal(url); }
  });
}

// Login Google lewat browser sistem: Google menolak login di dalam jendela aplikasi.
// Alur: buka halaman login di browser -> hasil dikirim ke server lokal 127.0.0.1 -> diteruskan ke aplikasi.
ipcMain.handle("gembo:browser-login", (event) => {
  if (!event.senderFrame || new URL(event.senderFrame.url).origin !== APP_URL) return null;
  return new Promise((resolve) => {
    const state = crypto.randomBytes(24).toString("base64url");
    let done = false;
    const finish = (val) => { if (done) return; done = true; clearTimeout(timer); try { server.close(); } catch (e) {} resolve(val); };
    const page = (t) => `<!doctype html><meta charset="utf-8"><title>Gembo Notes</title><body style="font-family:system-ui;text-align:center;padding:60px;color:#17302F"><h2>${t}</h2><p>Anda bisa menutup tab ini dan kembali ke aplikasi Gembo Notes.</p>`;
    const server = http.createServer((req, res) => {
      const u = new URL(req.url, "http://127.0.0.1");
      if (u.pathname !== "/cb" || u.searchParams.get("state") !== state) { res.writeHead(404); res.end(); return; }
      res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
      res.end(page("Berhasil masuk"));
      finish({ idToken: u.searchParams.get("idToken") || "", accessToken: u.searchParams.get("accessToken") || "" });
      if (win) { if (win.isMinimized()) win.restore(); win.focus(); }
    });
    const timer = setTimeout(() => finish(null), 5 * 60 * 1000);
    server.on("error", () => finish(null));
    server.listen(0, "127.0.0.1", () => {
      const port = server.address().port;
      shell.openExternal(`${APP_URL}/desktop-login.html?port=${port}&state=${state}`);
    });
  });
});

app.whenReady().then(() => {
  session.defaultSession.webRequest.onBeforeSendHeaders({ urls: ["https://*.google.com/*", "https://*.gstatic.com/*", "https://*.firebaseapp.com/*", "https://*.googleapis.com/*"] }, (d, cb) => {
    d.requestHeaders["User-Agent"] = UA; cb({ requestHeaders: d.requestHeaders });
  });
  session.defaultSession.setPermissionRequestHandler((_wc, perm, cb) => cb(["notifications", "clipboard-sanitized-write", "fullscreen"].includes(perm)));
  create();
  app.on("activate", () => { if (!BrowserWindow.getAllWindows().length) create(); });
});
app.on("second-instance", () => { if (win) { if (win.isMinimized()) win.restore(); win.focus(); } });
app.on("window-all-closed", () => { if (process.platform !== "darwin") app.quit(); });
