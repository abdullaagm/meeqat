package com.winocle.meeqat;

import android.app.Activity;
import android.app.AlertDialog;
import android.app.ProgressDialog;
import android.content.Intent;
import android.net.Uri;
import android.os.Build;
import android.provider.Settings;
import android.widget.Toast;

import org.json.JSONObject;

import java.io.ByteArrayOutputStream;
import java.io.File;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;

/**
 * In-app updates. The website publishes /downloads/app.json with the newest version of each app.
 * If it is newer than this build, we offer a one-tap update: download the APK and open the installer.
 * (Website changes never need an update — the apps always load the live site.)
 */
public final class Updater {

    public interface TokenSource { String token(); }

    private static boolean busy = false;

    private Updater() { }

    /** Check in the background. quiet = no message when already up to date. */
    public static void check(final Activity a, final String server, final boolean quiet, final TokenSource auth) {
        if (busy) return;
        busy = true;
        new Thread(() -> {
            try {
                JSONObject j = new JSONObject(get(server + "/downloads/app.json?ts=" + System.currentTimeMillis(), null));
                JSONObject apps = j.optJSONObject("apps");
                JSONObject me = apps != null ? apps.optJSONObject(BuildConfig.KIND) : null;
                int latest = me != null ? me.optInt("versionCode", 0) : ("tv".equals(BuildConfig.KIND) ? j.optInt("versionCode", 0) : 0);
                String name = me != null ? me.optString("version", "") : j.optString("version", "");
                a.runOnUiThread(() -> {
                    busy = false;
                    if (a.isFinishing()) return;
                    if (latest > BuildConfig.VERSION_CODE) offer(a, server, name, auth);
                    else if (!quiet) Toast.makeText(a, "Meeqat is up to date (" + BuildConfig.VERSION_NAME + ")", Toast.LENGTH_LONG).show();
                });
            } catch (Exception e) {
                a.runOnUiThread(() -> {
                    busy = false;
                    if (!quiet) Toast.makeText(a, "Could not check for updates: " + e.getMessage(), Toast.LENGTH_LONG).show();
                });
            }
        }).start();
    }

    private static void offer(Activity a, String server, String version, TokenSource auth) {
        new AlertDialog.Builder(a)
                .setTitle("Update available")
                .setMessage("A new version of " + a.getString(R.string.app_name) + " is ready"
                        + (version.isEmpty() ? "" : " (" + version + ")") + ".\nYou have " + BuildConfig.VERSION_NAME + ".")
                .setPositiveButton("Update now", (d, w) -> download(a, server, auth))
                .setNegativeButton("Later", null)
                .show();
    }

    @SuppressWarnings("deprecation")
    private static void download(Activity a, String server, TokenSource auth) {
        String url;
        String header = null;
        if ("super".equals(BuildConfig.KIND)) {
            header = auth != null ? auth.token() : null;
            if (header == null || header.isEmpty()) {
                new AlertDialog.Builder(a).setTitle("Log in first")
                        .setMessage("Log in to the super-admin dashboard, then choose Check for updates again.")
                        .setPositiveButton("OK", null).show();
                return;
            }
            url = server + "/api/super/app";
        } else {
            url = server + "/downloads/meeqat-" + BuildConfig.KIND + ".apk";
        }
        final ProgressDialog pd = new ProgressDialog(a);
        pd.setMessage("Downloading update…");
        pd.setCancelable(false);
        pd.show();
        final String finalUrl = url, finalHeader = header;
        new Thread(() -> {
            try {
                File out = new File(AppFiles.dir(a), "meeqat-update.apk");
                HttpURLConnection c = (HttpURLConnection) new URL(finalUrl).openConnection();
                c.setConnectTimeout(20000);
                c.setReadTimeout(60000);
                if (finalHeader != null) c.setRequestProperty("X-Super", finalHeader);
                if (c.getResponseCode() != 200) throw new Exception("server answered " + c.getResponseCode());
                try (InputStream in = c.getInputStream(); OutputStream os = new FileOutputStream(out)) {
                    byte[] buf = new byte[16384];
                    int n;
                    while ((n = in.read(buf)) > 0) os.write(buf, 0, n);
                }
                a.runOnUiThread(() -> { pd.dismiss(); install(a, out); });
            } catch (Exception e) {
                a.runOnUiThread(() -> {
                    pd.dismiss();
                    Toast.makeText(a, "Update failed: " + e.getMessage(), Toast.LENGTH_LONG).show();
                });
            }
        }).start();
    }

    static void install(Activity a, File apk) {
        if (Build.VERSION.SDK_INT >= 26 && !a.getPackageManager().canRequestPackageInstalls()) {
            new AlertDialog.Builder(a)
                    .setTitle("Allow updates")
                    .setMessage("Android needs your permission once: turn on \"Allow from this source\" for "
                            + a.getString(R.string.app_name) + ", then come back and tap Update again.")
                    .setPositiveButton("Open setting", (d, w) -> {
                        try {
                            a.startActivity(new Intent(Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES, Uri.parse("package:" + a.getPackageName())));
                        } catch (Exception e) {
                            Toast.makeText(a, "Open Settings › Apps › Special access › Install unknown apps › " + a.getString(R.string.app_name), Toast.LENGTH_LONG).show();
                        }
                    })
                    .setNegativeButton("Cancel", null)
                    .show();
            return;
        }
        Intent i = new Intent(Intent.ACTION_VIEW);
        i.setDataAndType(AppFiles.uriFor(a, apk), "application/vnd.android.package-archive");
        i.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION | Intent.FLAG_ACTIVITY_NEW_TASK);
        try { a.startActivity(i); }
        catch (Exception e) { Toast.makeText(a, "Could not open the installer: " + e.getMessage(), Toast.LENGTH_LONG).show(); }
    }

    static String get(String url, String superToken) throws Exception {
        HttpURLConnection c = (HttpURLConnection) new URL(url).openConnection();
        c.setConnectTimeout(15000);
        c.setReadTimeout(15000);
        c.setUseCaches(false);
        if (superToken != null) c.setRequestProperty("X-Super", superToken);
        if (c.getResponseCode() != 200) throw new Exception("HTTP " + c.getResponseCode());
        try (InputStream in = c.getInputStream()) {
            ByteArrayOutputStream bo = new ByteArrayOutputStream();
            byte[] b = new byte[8192];
            int n;
            while ((n = in.read(b)) > 0) bo.write(b, 0, n);
            return bo.toString("UTF-8");
        }
    }
}
