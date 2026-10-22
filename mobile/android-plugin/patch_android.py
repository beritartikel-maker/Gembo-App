#!/usr/bin/env python3
"""Pasang plugin GemboNotif ke proyek Android Capacitor.
Jalankan SETELAH `npx cap add android` / `npx cap sync android`, SEBELUM build gradle:
    python3 android-plugin/patch_android.py android
Aman dijalankan berulang kali."""
import re, sys, glob, os

here = os.path.dirname(os.path.abspath(__file__))
root = sys.argv[1] if len(sys.argv) > 1 else "android"
src = os.path.join(root, "app", "src", "main")
man = os.path.join(src, "AndroidManifest.xml")

cands = glob.glob(os.path.join(src, "java", "**", "MainActivity.*"), recursive=True)
cands = [c for c in cands if c.endswith((".java", ".kt"))]
if not cands or not os.path.exists(man):
    sys.exit("MainActivity atau AndroidManifest.xml tidak ditemukan di " + root)
main = cands[0]
code = open(main, encoding="utf-8").read()
pkg = re.search(r"^\s*package\s+([\w.]+)", code, re.M).group(1)
kt = main.endswith(".kt")
outdir = os.path.dirname(main)

for f in ("GemboNotifPlugin.java", "GemboNotifService.java"):
    t = open(os.path.join(here, f), encoding="utf-8").read().replace("__PKG__", pkg)
    open(os.path.join(outdir, f), "w", encoding="utf-8").write(t)

if "GemboNotifPlugin" not in code:
    reg = "registerPlugin(GemboNotifPlugin.class)" if not kt else "registerPlugin(GemboNotifPlugin::class.java)"
    if re.search(r"super\.onCreate\(", code):
        code = re.sub(r"(\n[ \t]*)super\.onCreate\(", r"\1" + reg + (";" if not kt else "") + r"\1super.onCreate(", code, 1)
    elif not kt:
        code = re.sub(r"(public class MainActivity extends BridgeActivity\s*\{)",
                      r"\1\n    @Override\n    public void onCreate(android.os.Bundle savedInstanceState) {\n        " + reg + ";\n        super.onCreate(savedInstanceState);\n    }\n", code, 1)
    else:
        code = re.sub(r"(class MainActivity\s*:\s*BridgeActivity\(\)\s*\{?)",
                      r"\1\n    override fun onCreate(savedInstanceState: android.os.Bundle?) {\n        " + reg + "\n        super.onCreate(savedInstanceState)\n    }\n", code, 1)
        if "{" not in code.split("BridgeActivity()")[1][:5]:
            code = code.rstrip() + " {\n}\n"
    open(main, "w", encoding="utf-8").write(code)

m = open(man, encoding="utf-8").read()
if "GemboNotifService" not in m:
    svc = ('    <service android:name="%s.GemboNotifService" android:label="Gembo Notes" android:exported="true"\n'
           '        android:permission="android.permission.BIND_NOTIFICATION_LISTENER_SERVICE">\n'
           '        <intent-filter><action android:name="android.service.notification.NotificationListenerService"/></intent-filter>\n'
           '    </service>\n') % pkg
    m = m.replace("</application>", svc + "</application>", 1)
    open(man, "w", encoding="utf-8").write(m)
print("OK: plugin GemboNotif terpasang di", pkg)
