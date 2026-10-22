package __PKG__;

import android.app.Notification;
import android.os.Bundle;
import android.service.notification.NotificationListenerService;
import android.service.notification.StatusBarNotification;

import org.json.JSONObject;

import java.util.Arrays;
import java.util.HashSet;
import java.util.Iterator;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.Set;

/** Membaca notifikasi WhatsApp dan Telegram, lalu menyimpannya ke antrean untuk Gembo Notes. */
public class GemboNotifService extends NotificationListenerService {
    private static final Set<String> PKG = new HashSet<>(Arrays.asList(
            "com.whatsapp", "com.whatsapp.w4b",
            "org.telegram.messenger", "org.telegram.messenger.web", "org.telegram.plus"));
    private final Map<String, Long> recent = new LinkedHashMap<>();

    @Override
    public void onNotificationPosted(StatusBarNotification sbn) {
        try {
            if (sbn == null || !PKG.contains(sbn.getPackageName())) return;
            Notification n = sbn.getNotification();
            if (n == null || (n.flags & Notification.FLAG_GROUP_SUMMARY) != 0) return;
            Bundle e = n.extras;
            if (e == null) return;
            CharSequence ti = e.getCharSequence(Notification.EXTRA_TITLE);
            CharSequence tx = e.getCharSequence(Notification.EXTRA_TEXT);
            if (ti == null || tx == null) return;
            String title = ti.toString().trim(), text = tx.toString().trim();
            if (title.isEmpty() || text.isEmpty()) return;
            // Abaikan notifikasi sistem WhatsApp/Telegram yang bukan isi chat.
            String low = text.toLowerCase();
            if (low.matches("^\\d+ (new )?(pesan|messages?).*") || low.startsWith("checking for new messages")
                    || low.startsWith("mencari pesan baru") || low.startsWith("whatsapp web")) return;

            long now = System.currentTimeMillis();
            String key = sbn.getPackageName() + "|" + title + "|" + text;
            synchronized (recent) {
                Iterator<Map.Entry<String, Long>> it = recent.entrySet().iterator();
                while (it.hasNext()) if (now - it.next().getValue() > 60000) it.remove();
                if (recent.containsKey(key)) return;
                recent.put(key, now);
            }

            JSONObject o = new JSONObject();
            o.put("title", title);
            o.put("text", text);
            o.put("app", sbn.getPackageName().startsWith("com.whatsapp") ? "WhatsApp" : "Telegram");
            o.put("t", sbn.getPostTime());
            GemboNotifPlugin.queue(getApplicationContext(), o);
        } catch (Exception ignored) { }
    }
}
