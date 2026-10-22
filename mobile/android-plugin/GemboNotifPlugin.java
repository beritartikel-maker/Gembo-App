package __PKG__;

import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.provider.Settings;

import androidx.core.app.NotificationManagerCompat;

import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import org.json.JSONArray;
import org.json.JSONObject;

/** Jembatan Capacitor: antrean pesan dari GemboNotifService -> JavaScript (gemboAddMsg). */
@CapacitorPlugin(name = "GemboNotif")
public class GemboNotifPlugin extends Plugin {
    private static final String PREF = "gembo_notif";
    private static final String KEY = "queue";
    private static final Object LOCK = new Object();
    private static GemboNotifPlugin inst;

    @Override
    public void load() {
        inst = this;
    }

    @Override
    protected void handleOnDestroy() {
        if (inst == this) inst = null;
    }

    /** Dipanggil service: simpan pesan ke antrean, lalu beri tahu JS bila aplikasi sedang terbuka. */
    static void queue(Context c, JSONObject o) {
        synchronized (LOCK) {
            SharedPreferences p = c.getSharedPreferences(PREF, Context.MODE_PRIVATE);
            JSONArray out = new JSONArray();
            try {
                JSONArray a = new JSONArray(p.getString(KEY, "[]"));
                int from = Math.max(0, a.length() - 299);
                for (int i = from; i < a.length(); i++) out.put(a.get(i));
            } catch (Exception ignored) { }
            out.put(o);
            p.edit().putString(KEY, out.toString()).apply();
        }
        GemboNotifPlugin pl = inst;
        if (pl != null) pl.notifyListeners("pesan", new JSObject());
    }

    @PluginMethod
    public void isEnabled(PluginCall call) {
        JSObject r = new JSObject();
        r.put("enabled", NotificationManagerCompat.getEnabledListenerPackages(getContext())
                .contains(getContext().getPackageName()));
        call.resolve(r);
    }

    @PluginMethod
    public void openSettings(PluginCall call) {
        Intent i = new Intent(Settings.ACTION_NOTIFICATION_LISTENER_SETTINGS);
        i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
        getContext().startActivity(i);
        call.resolve();
    }

    /** Ambil semua pesan di antrean lalu kosongkan antrean. */
    @PluginMethod
    public void drain(PluginCall call) {
        JSObject r = new JSObject();
        synchronized (LOCK) {
            SharedPreferences p = getContext().getSharedPreferences(PREF, Context.MODE_PRIVATE);
            String s = p.getString(KEY, "[]");
            p.edit().remove(KEY).apply();
            try {
                r.put("items", new JSArray(s));
            } catch (Exception e) {
                r.put("items", new JSArray());
            }
        }
        call.resolve(r);
    }
}
