package com.winocle.meeqat;

import android.Manifest;
import android.annotation.SuppressLint;
import android.app.Activity;
import android.app.AlertDialog;
import android.app.KeyguardManager;
import android.content.ActivityNotFoundException;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.content.pm.PackageManager;
import android.graphics.Color;
import android.graphics.Typeface;
import android.hardware.biometrics.BiometricManager;
import android.hardware.biometrics.BiometricPrompt;
import android.net.Uri;
import android.net.http.SslError;
import android.os.Build;
import android.os.Bundle;
import android.os.CancellationSignal;
import android.os.Handler;
import android.os.Looper;
import android.view.Gravity;
import android.view.View;
import android.view.WindowManager;
import android.webkit.GeolocationPermissions;
import android.webkit.JavascriptInterface;
import android.webkit.PermissionRequest;
import android.webkit.SslErrorHandler;
import android.webkit.ValueCallback;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceError;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.EditText;
import android.widget.FrameLayout;
import android.widget.TextView;
import android.widget.Toast;

import org.json.JSONObject;

import java.io.File;
import java.io.FileOutputStream;
import java.nio.charset.StandardCharsets;

/**
 * Meeqat Admin / Meeqat Super — phone apps.
 * They load the live control panel (/admin) or dashboard (/super), so website updates appear instantly.
 * Native extras: camera (scan the TV QR), location, file picker, saving/sharing files,
 * opening WhatsApp / phone links, in-app updates, and (Super) a fingerprint / face lock.
 */
public class PhoneActivity extends Activity {

    private static final String PREFS = "meeqat";
    private static final int REQ_FILE = 11, REQ_PERM_CAMERA = 12, REQ_PERM_GEO = 13, REQ_UNLOCK = 14;
    private static final long RELOCK_MS = 60_000;

    private WebView web;
    private FrameLayout root;
    private View cover;
    private final Handler handler = new Handler(Looper.getMainLooper());

    private ValueCallback<Uri[]> fileCallback;
    private PermissionRequest pendingCamera;
    private String pendingGeoOrigin;
    private GeolocationPermissions.Callback pendingGeo;
    private boolean unlocked = false, firstLoad = true;
    private long stoppedAt = 0;
    private volatile String superToken = null;

    private SharedPreferences prefs() { return getSharedPreferences(PREFS, Context.MODE_PRIVATE); }

    private String server() {
        String s = prefs().getString("server", BuildConfig.SERVER_URL);
        if (s == null || s.trim().isEmpty()) s = BuildConfig.SERVER_URL;
        s = s.trim();
        while (s.endsWith("/")) s = s.substring(0, s.length() - 1);
        if (!s.startsWith("http://") && !s.startsWith("https://")) s = "https://" + s;
        return s;
    }

    private boolean lockEnabled() { return BuildConfig.LOCK && prefs().getBoolean("lock", true); }

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        if (BuildConfig.LOCK) getWindow().addFlags(WindowManager.LayoutParams.FLAG_SECURE); // no screenshots / recent-apps preview
        root = new FrameLayout(this);
        root.setBackgroundColor(Color.parseColor("#070B1D"));
        setContentView(root);
        createWebView();
        buildCover();
        if (lockEnabled()) lock(); else unlocked = true;
        web.loadUrl(server() + BuildConfig.START_PATH);
    }

    /* ------------------------------------------------------------------ WebView */
    @SuppressLint({"SetJavaScriptEnabled", "AddJavascriptInterface"})
    private void createWebView() {
        web = new WebView(this);
        web.setBackgroundColor(Color.parseColor("#070B1D"));
        WebSettings s = web.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true);
        s.setDatabaseEnabled(true);
        s.setGeolocationEnabled(true);
        s.setMediaPlaybackRequiresUserGesture(false);
        s.setAllowFileAccess(false);
        s.setUserAgentString(s.getUserAgentString() + " MeeqatApp/" + BuildConfig.KIND + "/" + BuildConfig.VERSION_NAME);
        web.addJavascriptInterface(new Bridge(), "MeeqatApp");

        web.setWebViewClient(new WebViewClient() {
            @Override
            public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest req) { return route(req.getUrl()); }

            @SuppressWarnings("deprecation")
            @Override
            public boolean shouldOverrideUrlLoading(WebView view, String url) { return route(Uri.parse(url)); }

            @Override
            public void onReceivedError(WebView view, WebResourceRequest req, WebResourceError err) {
                if (Build.VERSION.SDK_INT >= 21 && req.isForMainFrame()) offline();
            }

            @Override
            public void onReceivedSslError(WebView view, SslErrorHandler h, SslError e) {
                h.cancel();
                offlineMsg("The server's security certificate is not valid yet (" + server() + ").");
            }

            @Override
            public void onPageFinished(WebView view, String url) {
                if (firstLoad && url != null && url.startsWith("http")) {
                    firstLoad = false;
                    handler.postDelayed(() -> Updater.check(PhoneActivity.this, server(), true, () -> superToken), 8000);
                }
            }
        });

        web.setWebChromeClient(new WebChromeClient() {
            @Override
            public boolean onShowFileChooser(WebView v, ValueCallback<Uri[]> cb, FileChooserParams p) {
                if (fileCallback != null) fileCallback.onReceiveValue(null);
                fileCallback = cb;
                try { startActivityForResult(p.createIntent(), REQ_FILE); }
                catch (ActivityNotFoundException e) { fileCallback = null; return false; }
                return true;
            }

            @Override
            public void onPermissionRequest(PermissionRequest req) {
                runOnUiThread(() -> {
                    boolean wantsCamera = false;
                    for (String r : req.getResources()) if (PermissionRequest.RESOURCE_VIDEO_CAPTURE.equals(r)) wantsCamera = true;
                    if (!wantsCamera) { req.deny(); return; }
                    if (has(Manifest.permission.CAMERA)) req.grant(new String[]{PermissionRequest.RESOURCE_VIDEO_CAPTURE});
                    else { pendingCamera = req; ask(Manifest.permission.CAMERA, REQ_PERM_CAMERA); }
                });
            }

            @Override
            public void onGeolocationPermissionsShowPrompt(String origin, GeolocationPermissions.Callback cb) {
                if (has(Manifest.permission.ACCESS_FINE_LOCATION) || has(Manifest.permission.ACCESS_COARSE_LOCATION)) cb.invoke(origin, true, false);
                else {
                    pendingGeo = cb; pendingGeoOrigin = origin;
                    if (Build.VERSION.SDK_INT >= 23)
                        requestPermissions(new String[]{Manifest.permission.ACCESS_FINE_LOCATION, Manifest.permission.ACCESS_COARSE_LOCATION}, REQ_PERM_GEO);
                    else cb.invoke(origin, true, false);
                }
            }
        });
        web.setDownloadListener((url, ua, cd, mime, len) -> {
            if (url.startsWith("http")) openExternal(Uri.parse(url));
        });
        root.addView(web, new FrameLayout.LayoutParams(FrameLayout.LayoutParams.MATCH_PARENT, FrameLayout.LayoutParams.MATCH_PARENT));
    }

    /** Our own site stays inside the app; WhatsApp, phone, email and other sites open outside. */
    private boolean route(Uri u) {
        String scheme = u.getScheme() == null ? "" : u.getScheme();
        Uri srv = Uri.parse(server());
        if ((scheme.equals("http") || scheme.equals("https")) && srv.getHost() != null && srv.getHost().equalsIgnoreCase(u.getHost())) return false;
        openExternal(u);
        return true;
    }

    private void openExternal(Uri u) {
        try { startActivity(new Intent(Intent.ACTION_VIEW, u).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)); }
        catch (Exception e) { Toast.makeText(this, "No app can open this link", Toast.LENGTH_SHORT).show(); }
    }

    private void offline() { offlineMsg("No internet connection."); }

    private void offlineMsg(String msg) {
        String html = "<html><body style='margin:0;height:100vh;display:flex;align-items:center;justify-content:center;background:#070b1d;"
                + "color:#fff;font-family:sans-serif;text-align:center;padding:24px'><div><div style='font-size:28px;color:#f3c96b'>&#9790; "
                + getString(R.string.app_name) + "</div><p style='font-size:16px'>" + msg.replace("<", "&lt;") + "</p>"
                + "<p><a style='color:#f3c96b;font-size:18px' href='" + server() + BuildConfig.START_PATH + "'>Try again</a></p></div></body></html>";
        web.loadDataWithBaseURL(server(), html, "text/html", "utf-8", null);
    }

    @Override
    public void onBackPressed() {
        if (web != null && web.canGoBack()) web.goBack();
        else super.onBackPressed();
    }

    /* ------------------------------------------------------------------ permissions & results */
    private boolean has(String p) { return Build.VERSION.SDK_INT < 23 || checkSelfPermission(p) == PackageManager.PERMISSION_GRANTED; }

    private void ask(String p, int code) { if (Build.VERSION.SDK_INT >= 23) requestPermissions(new String[]{p}, code); }

    @Override
    public void onRequestPermissionsResult(int code, String[] perms, int[] results) {
        boolean ok = results.length > 0 && results[0] == PackageManager.PERMISSION_GRANTED;
        if (code == REQ_PERM_CAMERA && pendingCamera != null) {
            if (ok) pendingCamera.grant(new String[]{PermissionRequest.RESOURCE_VIDEO_CAPTURE}); else pendingCamera.deny();
            pendingCamera = null;
        }
        if (code == REQ_PERM_GEO && pendingGeo != null) { pendingGeo.invoke(pendingGeoOrigin, ok, false); pendingGeo = null; }
    }

    @Override
    protected void onActivityResult(int code, int result, Intent data) {
        if (code == REQ_FILE) {
            if (fileCallback != null) fileCallback.onReceiveValue(WebChromeClient.FileChooserParams.parseResult(result, data));
            fileCallback = null;
        } else if (code == REQ_UNLOCK) {
            if (result == RESULT_OK) unlock(); else finish();
        }
        super.onActivityResult(code, result, data);
    }

    /* ------------------------------------------------------------------ fingerprint / face lock (Super) */
    private void buildCover() {
        TextView t = new TextView(this);
        t.setText("🔒\n\n" + getString(R.string.app_name) + "\n\nTap to unlock");
        t.setTextColor(Color.WHITE);
        t.setTextSize(20);
        t.setTypeface(Typeface.DEFAULT_BOLD);
        t.setGravity(Gravity.CENTER);
        t.setBackgroundColor(Color.parseColor("#2A0610"));
        t.setOnClickListener(v -> lock());
        t.setVisibility(View.GONE);
        cover = t;
        root.addView(cover, new FrameLayout.LayoutParams(FrameLayout.LayoutParams.MATCH_PARENT, FrameLayout.LayoutParams.MATCH_PARENT));
    }

    private void unlock() { unlocked = true; cover.setVisibility(View.GONE); }

    @SuppressWarnings("deprecation")
    private void lock() {
        unlocked = false;
        cover.setVisibility(View.VISIBLE);
        KeyguardManager km = (KeyguardManager) getSystemService(Context.KEYGUARD_SERVICE);
        boolean secure = km != null && (Build.VERSION.SDK_INT >= 23 ? km.isDeviceSecure() : km.isKeyguardSecure());
        if (!secure) {
            unlock();
            Toast.makeText(this, "Tip: set a screen lock on this phone to protect Meeqat Super", Toast.LENGTH_LONG).show();
            return;
        }
        if (Build.VERSION.SDK_INT >= 28) {
            BiometricPrompt.Builder b = new BiometricPrompt.Builder(this)
                    .setTitle("Unlock " + getString(R.string.app_name))
                    .setSubtitle("Fingerprint, face or phone PIN");
            if (Build.VERSION.SDK_INT >= 30) {
                b.setAllowedAuthenticators(BiometricManager.Authenticators.BIOMETRIC_WEAK | BiometricManager.Authenticators.DEVICE_CREDENTIAL);
            } else if (Build.VERSION.SDK_INT == 29) {
                b.setDeviceCredentialAllowed(true);
            } else {
                b.setNegativeButton("Use phone PIN", getMainExecutor(), (d, w) -> keyguard(km));
            }
            try {
                b.build().authenticate(new CancellationSignal(), getMainExecutor(), new BiometricPrompt.AuthenticationCallback() {
                    @Override public void onAuthenticationSucceeded(BiometricPrompt.AuthenticationResult r) { unlock(); }
                    @Override public void onAuthenticationError(int code, CharSequence msg) {
                        if (code == BiometricPrompt.BIOMETRIC_ERROR_HW_NOT_PRESENT || code == BiometricPrompt.BIOMETRIC_ERROR_HW_UNAVAILABLE
                                || code == BiometricPrompt.BIOMETRIC_ERROR_NO_BIOMETRICS) keyguard(km);
                        // user cancelled: stay on the locked cover; tap to try again
                    }
                });
            } catch (Exception e) { keyguard(km); }
        } else {
            keyguard(km);
        }
    }

    private void keyguard(KeyguardManager km) {
        Intent i = km.createConfirmDeviceCredentialIntent("Unlock " + getString(R.string.app_name), "Use your phone PIN, pattern or password");
        if (i != null) startActivityForResult(i, REQ_UNLOCK); else unlock();
    }

    @Override protected void onStop() { super.onStop(); stoppedAt = System.currentTimeMillis(); }

    @Override
    protected void onRestart() {
        super.onRestart();
        if (lockEnabled() && unlocked && System.currentTimeMillis() - stoppedAt > RELOCK_MS) lock();
    }

    @Override protected void onDestroy() { handler.removeCallbacksAndMessages(null); if (web != null) web.destroy(); super.onDestroy(); }

    /* ------------------------------------------------------------------ bridge for the website (window.MeeqatApp) */
    private class Bridge {
        @JavascriptInterface
        public String info() {
            try {
                JSONObject j = new JSONObject();
                j.put("kind", BuildConfig.KIND);
                j.put("version", BuildConfig.VERSION_NAME);
                j.put("versionCode", BuildConfig.VERSION_CODE);
                j.put("server", server());
                j.put("lockAvailable", BuildConfig.LOCK);
                j.put("lock", lockEnabled());
                return j.toString();
            } catch (Exception e) { return "{}"; }
        }

        @JavascriptInterface
        public void setLock(boolean on) { prefs().edit().putBoolean("lock", on).apply(); }

        @JavascriptInterface
        public void setSuperToken(String t) { superToken = t; }

        @JavascriptInterface
        public void checkUpdate() { runOnUiThread(() -> Updater.check(PhoneActivity.this, server(), false, () -> superToken)); }

        @JavascriptInterface
        public void changeServer() { runOnUiThread(PhoneActivity.this::askServer); }

        /** Save text (CSV, JSON backup) and open the Android share sheet. */
        @JavascriptInterface
        public void saveFile(String name, String mime, String text) {
            try {
                String safe = name.replaceAll("[^A-Za-z0-9._-]", "_");
                File f = new File(AppFiles.dir(PhoneActivity.this), safe);
                try (FileOutputStream o = new FileOutputStream(f)) { o.write(text.getBytes(StandardCharsets.UTF_8)); }
                Intent send = new Intent(Intent.ACTION_SEND);
                send.setType(mime == null || mime.isEmpty() ? "application/octet-stream" : mime);
                send.putExtra(Intent.EXTRA_STREAM, AppFiles.uriFor(PhoneActivity.this, f));
                send.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
                runOnUiThread(() -> startActivity(Intent.createChooser(send, "Save or share " + safe)));
            } catch (Exception e) {
                runOnUiThread(() -> Toast.makeText(PhoneActivity.this, "Could not save: " + e.getMessage(), Toast.LENGTH_LONG).show());
            }
        }
    }

    private void askServer() {
        final EditText in = new EditText(this);
        in.setText(server());
        in.setSingleLine(true);
        new AlertDialog.Builder(this)
                .setTitle("Meeqat server address")
                .setMessage("Only change this if your administrator gave you a different address.")
                .setView(in)
                .setPositiveButton("Save", (d, w) -> {
                    prefs().edit().putString("server", in.getText().toString().trim()).apply();
                    web.loadUrl(server() + BuildConfig.START_PATH);
                })
                .setNeutralButton("Default", (d, w) -> { prefs().edit().remove("server").apply(); web.loadUrl(server() + BuildConfig.START_PATH); })
                .setNegativeButton("Cancel", null)
                .show();
    }
}
