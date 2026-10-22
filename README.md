# Gembo Notes — web, Android (APK), Windows (EXE)

Semua versi memuat **https://gembo-notes.web.app**, jadi cukup `firebase deploy` untuk memperbarui web, APK, dan EXE sekaligus.

```
public/    aplikasi web (index.html, cloud.js, PWA)
mobile/    pembungkus Android (Capacitor)
desktop/   pembungkus Windows (Electron)
android-signing/debug.keystore   kunci tanda tangan APK (tetap, supaya login Google stabil)
.github/workflows/               build otomatis APK dan EXE
scripts/make_icons.py            pembuat ikon merah
```

## 1. Web + Firebase (sekali)
Firebase Console → Authentication → Sign-in method → **Google: Enable**; Firestore Database → **Create**.
Lalu di komputer Anda: `npm i -g firebase-tools && firebase login && firebase deploy`.

## 2. Daftarkan aplikasi Android di Firebase (sekali)
Firebase Console → Project settings → Your apps → **Add app → Android**
- Package name: `com.gembo.notes`
- SHA-1: `E5:82:E8:B1:C6:CC:3E:65:31:54:A7:1B:F5:A5:80:7A:EA:E7:59:C5`
Unduh **google-services.json** dan simpan sebagai `mobile/google-services.json` (commit ke repo).
Kalau Google Sign-In sudah diaktifkan sebelum aplikasi didaftarkan, unduh ulang file ini setelah SHA-1 ditambahkan.

## 3. Upload ke GitHub dan build
Buat repo **private**, push semua isi folder ini. Tab **Actions** → jalankan:
- **Build Android APK** → unduh `Gembo-Notes.apk` dari Artifacts
- **Build Windows EXE** → unduh `Gembo-Notes-Setup.exe` (installer) atau `Gembo-Notes-Portable.exe`
Build juga jalan otomatis saat push ke `main`. Untuk rilis dengan link unduhan: buat tag `v1.0.0`.

## Catatan
- APK ditandatangani dengan kunci di `android-signing/` (untuk sideload pribadi). Gunakan repo private. Untuk Play Store, buat kunci rilis sendiri.
- Windows akan menampilkan peringatan SmartScreen karena EXE belum ditandatangani sertifikat berbayar: *More info → Run anyway*.
- Aplikasi butuh internet untuk dibuka (data tetap tersinkron dan aman di akun Anda).
- Ubah ikon: edit `scripts/make_icons.py`, jalankan `python3 scripts/make_icons.py`.
