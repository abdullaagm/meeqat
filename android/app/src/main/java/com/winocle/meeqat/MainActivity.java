package com.winocle.meeqat;

import android.annotation.SuppressLint;
import android.app.Activity;
import android.app.AlertDialog;
import android.content.ActivityNotFoundException;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.graphics.Color;
import android.net.ConnectivityManager;
import android.net.NetworkInfo;
import android.net.Uri;
import android.net.http.SslError;
import android.os.Build;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.provider.Settings;
import android.view.KeyEvent;
import android.view.View;
import android.view.WindowManager;
import android.webkit.RenderProcessGoneDetail;
import android.webkit.SslErrorHandler;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceError;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.EditText;
import android.widget.FrameLayout;
import android.widget.Toast;

/**
 * Meeqat TV — a full-screen, always-on prayer-time display.
 * Loads the Meeqat website (TV screen); the website handles pairing, settings and offline caching.
 */
public class MainActivity extends Activity {

    private static final String PREFS = "meeqat";
    private static final long RETRY_MS = 15_000;
    private static final long HEALTH_MS = 5 * 60_000;

    private WebView web;
    private FrameLayout root;
    private final Handler handler = new Handler(Looper.getMainLooper());
    private boolean showingError = false;
    private long lastBack = 0;

    private SharedPreferences prefs() { return getSharedPreferences(PREFS, Context.MODE_PRIVATE); }

    private String server() {
        String s = prefs().getString("server", BuildConfig.SERVER_URL);
        if (s == null || s.trim().isEmpty()) s = BuildConfig.SERVER_URL;
        s = s.trim();
        while (s.endsWith("/")) s = s.substring(0, s.length() - 1);
        if (!s.startsWith("http://") && !s.startsWith("https://")) s = "https://" + s;
        return s;
    }

    private String startUrl() { return server() + "/tv?app=1"; }

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON
                | WindowManager.LayoutParams.FLAG_FULLSCREEN
                | WindowManager.LayoutParams.FLAG_SHOW_WHEN_LOCKED
                | WindowManager.LayoutParams.FLAG_TURN_SCREEN_ON
                | WindowManager.LayoutParams.FLAG_DISMISS_KEYGUARD);
        root = new FrameLayout(this);
        root.setBackgroundColor(Color.parseColor("#050A1C"));
        setContentView(root);
        createWebView();
        loadStart();
        handler.postDelayed(health, HEALTH_MS);
        handler.postDelayed(this::maybeAskAutoStart, 6000);
    }

    @SuppressLint("SetJavaScriptEnabled")
    private void createWebView() {
        if (web != null) { root.removeView(web); web.destroy(); }
        web = new WebView(this);
        web.setBackgroundColor(Color.parseColor("#050A1C"));
        web.setFocusable(true);
        web.setFocusableInTouchMode(true);
        WebSettings s = web.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true);
        s.setDatabaseEnabled(true);
        s.setMediaPlaybackRequiresUserGesture(false);   // adhan plays without pressing OK
        s.setCacheMode(WebSettings.LOAD_DEFAULT);
        s.setLoadWithOverviewMode(true);
        s.setUseWideViewPort(true);
        s.setSupportZoom(false);
        s.setUserAgentString(s.getUserAgentString() + " MeeqatTV/" + BuildConfig.VERSION_NAME);
        web.setWebChromeClient(new WebChromeClient());
        web.setWebViewClient(new WebViewClient() {
            @Override
            public void onReceivedError(WebView view, WebResourceRequest request, WebResourceError error) {
                if (Build.VERSION.SDK_INT >= 21 && request.isForMainFrame()) showError("No connection to the Meeqat server.");
            }
            @SuppressWarnings("deprecation")
            @Override
            public void onReceivedError(WebView view, int errorCode, String description, String failingUrl) {
                if (failingUrl != null && failingUrl.startsWith(server())) showError("No connection to the Meeqat server.");
            }
            @Override
            public void onReceivedSslError(WebView view, SslErrorHandler h, SslError error) {
                h.cancel();
                showError("The server's security certificate is not valid yet.\nCheck the HTTPS setting of " + server());
            }
            @Override
            public void onPageFinished(WebView view, String url) {
                if (url != null && url.startsWith("http")) showingError = false;
                hideSystemUi();
            }
            @Override
            public boolean onRenderProcessGone(WebView view, RenderProcessGoneDetail detail) {
                // The browser engine crashed (low memory TV sticks): rebuild and reload.
                createWebView();
                loadStart();
                return true;
            }
        });
        root.addView(web, new FrameLayout.LayoutParams(FrameLayout.LayoutParams.MATCH_PARENT, FrameLayout.LayoutParams.MATCH_PARENT));
        web.requestFocus();
    }

    private void loadStart() {
        showingError = false;
        web.loadUrl(startUrl());
    }

    private void showError(String msg) {
        if (showingError) return;
        showingError = true;
        String html = "<html><body style='margin:0;height:100vh;display:flex;align-items:center;justify-content:center;"
                + "background:#050a1c;color:#fff;font-family:sans-serif;text-align:center'><div>"
                + "<div style='font-size:7vmin;color:#f3c96b'>&#9790; Meeqat</div>"
                + "<p style='font-size:3.4vmin;white-space:pre-line'>" + msg.replace("<", "&lt;") + "</p>"
                + "<p style='font-size:2.6vmin;color:#9aa'>Retrying automatically&hellip; Press MENU or BACK for options.</p>"
                + "</div></body></html>";
        web.loadDataWithBaseURL(null, html, "text/html", "utf-8", null);
        handler.removeCallbacks(retry);
        handler.postDelayed(retry, RETRY_MS);
    }

    private final Runnable retry = () -> { if (showingError) loadStart(); };

    /** Every few minutes: if we are on the error page and the network is back, reload. */
    private final Runnable health = new Runnable() {
        @Override public void run() {
            if (showingError && online()) loadStart();
            handler.postDelayed(this, HEALTH_MS);
        }
    };

    @SuppressWarnings("deprecation")
    private boolean online() {
        try {
            ConnectivityManager cm = (ConnectivityManager) getSystemService(Context.CONNECTIVITY_SERVICE);
            NetworkInfo n = cm.getActiveNetworkInfo();
            return n != null && n.isConnected();
        } catch (Exception e) { return true; }
    }

    private void hideSystemUi() {
        View d = getWindow().getDecorView();
        d.setSystemUiVisibility(View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY
                | View.SYSTEM_UI_FLAG_FULLSCREEN
                | View.SYSTEM_UI_FLAG_HIDE_NAVIGATION
                | View.SYSTEM_UI_FLAG_LAYOUT_STABLE
                | View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION
                | View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN);
    }

    @Override public void onWindowFocusChanged(boolean hasFocus) { super.onWindowFocusChanged(hasFocus); if (hasFocus) hideSystemUi(); }
    @Override protected void onResume() { super.onResume(); hideSystemUi(); if (web != null) web.onResume(); }
    @Override protected void onDestroy() { handler.removeCallbacksAndMessages(null); if (web != null) web.destroy(); super.onDestroy(); }

    /* ------------------------------------------------------------------ remote control */
    @Override
    public boolean onKeyDown(int keyCode, KeyEvent event) {
        if (keyCode == KeyEvent.KEYCODE_MENU || keyCode == KeyEvent.KEYCODE_SETTINGS || keyCode == KeyEvent.KEYCODE_INFO
                || keyCode == KeyEvent.KEYCODE_PROG_RED) {
            showMenu();
            return true;
        }
        if (keyCode == KeyEvent.KEYCODE_BACK) {
            long now = System.currentTimeMillis();
            if (now - lastBack < 1500) { showMenu(); lastBack = 0; }
            else { lastBack = now; Toast.makeText(this, "Press BACK again for Meeqat options", Toast.LENGTH_SHORT).show(); }
            return true; // kiosk: BACK never leaves the prayer screen by accident
        }
        return super.onKeyDown(keyCode, event);
    }

    private void showMenu() {
        String[] items = {
                "Reload screen",
                "Link to a different masjid (show pairing code)",
                "Start automatically when TV turns on",
                "Change server address",
                "About",
                "Exit Meeqat TV"
        };
        new AlertDialog.Builder(this)
                .setTitle("Meeqat TV " + BuildConfig.VERSION_NAME)
                .setItems(items, (d, which) -> {
                    switch (which) {
                        case 0: loadStart(); break;
                        case 1: unlink(); break;
                        case 2: openAutoStartSettings(true); break;
                        case 3: askServer(); break;
                        case 4: about(); break;
                        case 5: finishAffinity(); break;
                    }
                })
                .show();
    }

    private void unlink() {
        new AlertDialog.Builder(this)
                .setTitle("Link to a different masjid?")
                .setMessage("This TV will show a new pairing code. Enter it in the phone control panel of the masjid you want.")
                .setPositiveButton("Show code", (d, w) -> web.evaluateJavascript(
                        "try{localStorage.removeItem('miqat:tv');localStorage.removeItem('miqat:screen')}catch(e){};location.href='" + server() + "/pair.html?app=1';", null))
                .setNegativeButton("Cancel", null)
                .show();
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
                    loadStart();
                })
                .setNeutralButton("Default", (d, w) -> { prefs().edit().remove("server").apply(); loadStart(); })
                .setNegativeButton("Cancel", null)
                .show();
    }

    private void about() {
        new AlertDialog.Builder(this)
                .setTitle("Meeqat TV")
                .setMessage("Version " + BuildConfig.VERSION_NAME + "\nServer: " + server()
                        + "\n\nRemote control:\n• MENU (or BACK twice): options\n• The screen updates by itself — change everything from the phone control panel.")
                .setPositiveButton("OK", null)
                .show();
    }

    /* ------------------------------------------------------------------ auto-start on boot */
    private boolean canAutoStart() {
        return Build.VERSION.SDK_INT < 23 || Settings.canDrawOverlays(this);
    }

    private void maybeAskAutoStart() {
        if (canAutoStart() || prefs().getBoolean("askedAutoStart", false) || isFinishing()) return;
        prefs().edit().putBoolean("askedAutoStart", true).apply();
        new AlertDialog.Builder(this)
                .setTitle("Start Meeqat when the TV turns on?")
                .setMessage("To open the prayer screen automatically after the TV starts, allow Meeqat TV to \"Display over other apps\" on the next screen.")
                .setPositiveButton("Allow", (d, w) -> openAutoStartSettings(false))
                .setNegativeButton("Not now", null)
                .show();
    }

    private void openAutoStartSettings(boolean fromMenu) {
        if (canAutoStart()) {
            Toast.makeText(this, "Auto-start is already on ✓", Toast.LENGTH_LONG).show();
            return;
        }
        try {
            startActivity(new Intent(Settings.ACTION_MANAGE_OVERLAY_PERMISSION, Uri.parse("package:" + getPackageName())));
        } catch (ActivityNotFoundException e) {
            try { startActivity(new Intent(Settings.ACTION_MANAGE_OVERLAY_PERMISSION)); }
            catch (ActivityNotFoundException e2) {
                new AlertDialog.Builder(this)
                        .setTitle("Auto-start")
                        .setMessage("This TV hides that setting. Open Settings › Apps › Special app access › Display over other apps › Meeqat TV and turn it on.\n\nIf your TV has no such setting, set the TV to open the last-used input/app when it powers on.")
                        .setPositiveButton("OK", null)
                        .show();
            }
        }
    }
}
