# Plugin GemboNotif (baca notifikasi WhatsApp & Telegram)

Isi folder ini:
- GemboNotifService.java : membaca notifikasi WhatsApp/Telegram (WA, WA Business, Telegram)
- GemboNotifPlugin.java  : jembatan ke JavaScript (isEnabled, openSettings, drain)
- patch_android.py       : memasang keduanya ke proyek Android + mendaftarkan di MainActivity dan AndroidManifest

## Pasang di GitHub
1. Taruh folder `android-plugin/` di root repo (sejajar dengan index.html).
2. Di workflow build APK, tambahkan langkah ini SETELAH `npx cap add android` / `npx cap sync android` dan SEBELUM gradle:

    - name: Pasang plugin notifikasi
      run: python3 android-plugin/patch_android.py android

3. Pakai index.html terbaru (sudah memuat jembatan JS-nya).

## Setelah APK terpasang di HP
1. Buka popup klien > tab Pesan > tombol "Atur akses notifikasi" > aktifkan Gembo Notes.
2. Android 13+ untuk APK di luar Play Store: Info Aplikasi Gembo Notes > menu titik tiga > "Izinkan setelan terbatas", baru aktifkan akses notifikasi.
3. Pesan masuk ke klien yang namanya (atau nomor HP di kolom Kontak) sama dengan nama kontak di WhatsApp/Telegram.

## Catatan
- Pesan hanya tersimpan di HP (localStorage), tidak ikut sinkron cloud.
- Chat grup tidak dicocokkan ke klien kecuali nama grup sama dengan nama klien.
