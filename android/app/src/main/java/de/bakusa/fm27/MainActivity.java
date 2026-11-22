package de.bakusa.fm27;

// FUSSBALL MANAGER 2027 © BAKUSA – Android shell (optimised for Xiaomi 15T Pro: 120 Hz, full screen
// edge-to-edge incl. camera cutout, MIUI font scaling ignored so layouts stay intact).
// The game is the same HTML file as on PC. Live updates work like the Windows launcher: on start and
// every 10 minutes the "live" release on GitHub is checked; new game files are downloaded, verified with
// SHA-256 and used immediately – no new APK needed. Playing starts only after the check (update is forced).

import android.app.Activity;
import android.content.Intent;
import android.graphics.Color;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.view.Display;
import android.view.Gravity;
import android.view.KeyEvent;
import android.view.View;
import android.view.Window;
import android.view.WindowInsets;
import android.view.WindowInsetsController;
import android.view.WindowManager;
import android.webkit.JavascriptInterface;
import android.webkit.ValueCallback;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.FrameLayout;
import android.widget.LinearLayout;
import android.widget.ProgressBar;
import android.widget.TextView;
import android.widget.Toast;

import androidx.webkit.WebViewAssetLoader;
import androidx.webkit.WebViewCompat;
import androidx.webkit.WebViewFeature;

import org.json.JSONObject;

import java.io.ByteArrayOutputStream;
import java.io.File;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.Collections;
import java.util.concurrent.atomic.AtomicBoolean;

public class MainActivity extends Activity {
    private static final String LIVE = "https://github.com/svenrueger2-ship-it/fm27/releases/download/live/";
    private static final String HOST = "https://appassets.androidplatform.net";
    private static final long CHECK_EVERY_MS = 10 * 60 * 1000;

    private WebView web;
    private FrameLayout root;
    private LinearLayout splash;
    private TextView splashText;
    private ProgressBar splashBar;
    private final Handler ui = new Handler(Looper.getMainLooper());
    private final AtomicBoolean checking = new AtomicBoolean(false);
    private boolean started = false;
    private long lastBack = 0, lastCheck = 0;
    private ValueCallback<Uri[]> fileCb;

    // ------------------------------------------------------------------ content folders
    private File liveDir() { return new File(getFilesDir(), "content/live"); }
    private String bundledVersion() {
        try (InputStream in = getAssets().open("version.json")) { return new JSONObject(readAll(in)).getString("version"); }
        catch (Exception e) { return "0.0.0"; }
    }
    private String liveVersion() {
        try (InputStream in = new java.io.FileInputStream(new File(liveDir(), "version.txt"))) { return readAll(in).trim(); }
        catch (Exception e) { return null; }
    }
    private String activeVersion() {
        String lv = liveVersion();
        if (lv != null && cmp(lv, bundledVersion()) > 0 && new File(liveDir(), "index.html").exists()) return lv;
        return bundledVersion();
    }
    private String gameUrl() {
        String lv = liveVersion();
        boolean live = lv != null && cmp(lv, bundledVersion()) > 0 && new File(liveDir(), "index.html").exists();
        return HOST + (live ? "/live/index.html" : "/assets/index.html");
    }

    @Override
    protected void onCreate(Bundle state) {
        super.onCreate(state);
        Window w = getWindow();
        w.addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
        w.addFlags(WindowManager.LayoutParams.FLAG_HARDWARE_ACCELERATED);
        if (Build.VERSION.SDK_INT >= 28) w.getAttributes().layoutInDisplayCutoutMode = WindowManager.LayoutParams.LAYOUT_IN_DISPLAY_CUTOUT_MODE_SHORT_EDGES;
        preferHighRefreshRate();

        root = new FrameLayout(this);
        root.setBackgroundColor(Color.parseColor("#07060F"));
        web = new WebView(this);
        root.addView(web, new FrameLayout.LayoutParams(-1, -1));
        buildSplash();
        setContentView(root);
        immersive();
        setupWebView();
        startupCheck();
    }

    // Xiaomi 15T Pro: run the WebView at the highest refresh rate the panel offers (120 Hz)
    private void preferHighRefreshRate() {
        try {
            Display d = Build.VERSION.SDK_INT >= 30 ? getDisplay() : getWindowManager().getDefaultDisplay();
            if (d == null) return;
            Display.Mode cur = d.getMode(), best = cur;
            for (Display.Mode m : d.getSupportedModes())
                if (m.getPhysicalWidth() == cur.getPhysicalWidth() && m.getPhysicalHeight() == cur.getPhysicalHeight() && m.getRefreshRate() > best.getRefreshRate()) best = m;
            WindowManager.LayoutParams lp = getWindow().getAttributes();
            lp.preferredDisplayModeId = best.getModeId();
            lp.preferredRefreshRate = best.getRefreshRate();
            getWindow().setAttributes(lp);
        } catch (Exception ignored) { }
    }

    private void immersive() {
        if (Build.VERSION.SDK_INT >= 30) {
            getWindow().setDecorFitsSystemWindows(false);
            WindowInsetsController c = getWindow().getInsetsController();
            if (c != null) { c.hide(WindowInsets.Type.systemBars()); c.setSystemBarsBehavior(WindowInsetsController.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE); }
        } else {
            getWindow().getDecorView().setSystemUiVisibility(View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY | View.SYSTEM_UI_FLAG_FULLSCREEN | View.SYSTEM_UI_FLAG_HIDE_NAVIGATION
                | View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN | View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION | View.SYSTEM_UI_FLAG_LAYOUT_STABLE);
        }
    }
    @Override public void onWindowFocusChanged(boolean f) { super.onWindowFocusChanged(f); if (f) immersive(); }

    private void buildSplash() {
        splash = new LinearLayout(this);
        splash.setOrientation(LinearLayout.VERTICAL);
        splash.setGravity(Gravity.CENTER);
        splash.setBackgroundColor(Color.parseColor("#07060F"));
        TextView logo = new TextView(this);
        logo.setText("FM 2027");
        logo.setTextColor(Color.WHITE); logo.setTextSize(44); logo.setTypeface(android.graphics.Typeface.create("sans-serif-condensed", android.graphics.Typeface.BOLD_ITALIC));
        TextView by = new TextView(this);
        by.setText("© BAKUSA"); by.setTextColor(Color.parseColor("#A59FC4")); by.setTextSize(13); by.setLetterSpacing(0.4f);
        splashBar = new ProgressBar(this, null, android.R.attr.progressBarStyleHorizontal);
        splashBar.setIndeterminate(true);
        splashText = new TextView(this);
        splashText.setTextColor(Color.parseColor("#C9C3E6")); splashText.setTextSize(14); splashText.setText("Suche nach Updates …");
        splash.addView(logo); splash.addView(by);
        LinearLayout.LayoutParams bp = new LinearLayout.LayoutParams(dp(220), dp(8)); bp.topMargin = dp(28); splash.addView(splashBar, bp);
        LinearLayout.LayoutParams tp = new LinearLayout.LayoutParams(-2, -2); tp.topMargin = dp(12); splash.addView(splashText, tp);
        root.addView(splash, new FrameLayout.LayoutParams(-1, -1));
    }
    private int dp(int v) { return Math.round(v * getResources().getDisplayMetrics().density); }

    private void setupWebView() {
        WebSettings s = web.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true);
        s.setDatabaseEnabled(true);
        s.setMediaPlaybackRequiresUserGesture(false);
        s.setTextZoom(100);                    // MIUI font size must not break the layout
        s.setUseWideViewPort(true);
        s.setLoadWithOverviewMode(false);
        s.setSupportZoom(false); s.setBuiltInZoomControls(false); s.setDisplayZoomControls(false);
        s.setAllowFileAccess(false); s.setAllowContentAccess(false);
        s.setOffscreenPreRaster(true);
        s.setUserAgentString(s.getUserAgentString() + " FM27-Android/" + activeVersion());
        web.setRendererPriorityPolicy(WebView.RENDERER_PRIORITY_IMPORTANT, false);
        web.setOverScrollMode(View.OVER_SCROLL_NEVER);
        web.setBackgroundColor(Color.parseColor("#07060F"));
        web.setLayerType(View.LAYER_TYPE_HARDWARE, null);

        liveDir().mkdirs();
        final WebViewAssetLoader loader = new WebViewAssetLoader.Builder()
            .addPathHandler("/assets/", new WebViewAssetLoader.AssetsPathHandler(this))
            .addPathHandler("/live/", new WebViewAssetLoader.InternalStoragePathHandler(this, liveDir()))
            .build();
        web.setWebViewClient(new WebViewClient() {
            @Override public WebResourceResponse shouldInterceptRequest(WebView v, WebResourceRequest r) { return loader.shouldInterceptRequest(r.getUrl()); }
            @Override public boolean shouldOverrideUrlLoading(WebView v, WebResourceRequest r) {
                Uri u = r.getUrl();
                if (u.toString().startsWith(HOST)) return false;
                try { startActivity(new Intent(Intent.ACTION_VIEW, u)); } catch (Exception ignored) { }
                return true;
            }
            @Override public void onPageFinished(WebView v, String url) { super.onPageFinished(v, url); hideSplash(); }
        });
        web.setWebChromeClient(new WebChromeClient() {
            // "Spielstand importieren" uses a file input
            @Override public boolean onShowFileChooser(WebView v, ValueCallback<Uri[]> cb, FileChooserParams p) {
                if (fileCb != null) fileCb.onReceiveValue(null);
                fileCb = cb;
                try { startActivityForResult(p.createIntent(), 77); } catch (Exception e) { fileCb = null; return false; }
                return true;
            }
        });
        web.addJavascriptInterface(new Bridge(), "FM27Android");
        // window.bakusa for the game: live-update hook, reload into the same save, quit
        String shim = "window.bakusa=Object.assign(window.bakusa||{},{platform:'android',"
            + "onLive:function(cb){window.__fm27Live=cb;},"
            + "reloadGame:function(s){FM27Android.reloadGame(s||'');},"
            + "close:function(){FM27Android.quit();},quit:function(){FM27Android.quit();}});";
        if (WebViewFeature.isFeatureSupported(WebViewFeature.DOCUMENT_START_SCRIPT))
            WebViewCompat.addDocumentStartJavaScript(web, shim, Collections.singleton(HOST));
        shimFallback = shim;
    }
    private String shimFallback;

    @Override protected void onActivityResult(int req, int res, Intent data) {
        if (req == 77 && fileCb != null) { fileCb.onReceiveValue(WebChromeClient.FileChooserParams.parseResult(res, data)); fileCb = null; return; }
        super.onActivityResult(req, res, data);
    }

    private void hideSplash() {
        if (splash.getVisibility() != View.VISIBLE) return;
        if (!WebViewFeature.isFeatureSupported(WebViewFeature.DOCUMENT_START_SCRIPT)) web.evaluateJavascript(shimFallback, null);
        splash.animate().alpha(0f).setDuration(350).withEndAction(() -> splash.setVisibility(View.GONE)).start();
    }

    private void loadGame(String slot) {
        String url = gameUrl() + (slot != null && !slot.isEmpty() ? "#continue=" + Uri.encode(slot) : "");
        web.loadUrl(url);
    }

    // ------------------------------------------------------------------ forced live update at start
    private void startupCheck() {
        final AtomicBoolean done = new AtomicBoolean(false);
        final Runnable go = () -> { if (done.compareAndSet(false, true)) { started = true; splashText.setText("Wird geladen …"); loadGame(null); } };
        ui.postDelayed(() -> { if (!done.get()) splashText.setText("Update-Server antwortet nicht – starte trotzdem …"); go.run(); }, 9000);
        checkForUpdate(new UpdateListener() {
            @Override public void progress(String version, int pct) { ui.post(() -> { splashBar.setIndeterminate(false); splashBar.setProgress(pct); splashText.setText("Update " + version + " wird installiert · " + pct + " %"); }); }
            @Override public void finished(String installed, String title) { ui.post(() -> { if (installed != null) splashText.setText("✓ Auf Version " + installed + " aktualisiert"); ui.postDelayed(go, installed != null ? 600 : 0); }); }
        });
    }

    interface UpdateListener { void progress(String version, int pct); void finished(String installedVersion, String title); }

    private void checkForUpdate(final UpdateListener l) {
        if (!checking.compareAndSet(false, true)) return;
        lastCheck = System.currentTimeMillis();
        new Thread(() -> {
            String installed = null, title = null;
            try {
                JSONObject man = new JSONObject(new String(fetch(LIVE + "manifest.json", null), StandardCharsets.UTF_8));
                String ver = man.getString("version");
                title = man.optString("title", "");
                if (cmp(ver, activeVersion()) > 0) {
                    JSONObject f = man.getJSONObject("files").getJSONObject("index.html");
                    final int size = f.optInt("size", 1);
                    byte[] buf = fetch(LIVE + "index.html", (n) -> l.progress(ver, Math.min(99, (int) (n * 100L / Math.max(1, size)))));
                    if (!sha256(buf).equalsIgnoreCase(f.getString("sha256"))) throw new Exception("checksum");
                    File tmp = new File(getFilesDir(), "content/live.part"); deleteRec(tmp); tmp.mkdirs();
                    try (FileOutputStream o = new FileOutputStream(new File(tmp, "index.html"))) { o.write(buf); }
                    try (FileOutputStream o = new FileOutputStream(new File(tmp, "version.txt"))) { o.write(ver.getBytes(StandardCharsets.UTF_8)); }
                    File old = new File(getFilesDir(), "content/live.old"); deleteRec(old);
                    if (liveDir().exists()) liveDir().renameTo(old);
                    tmp.renameTo(liveDir()); deleteRec(old);
                    installed = ver;
                }
            } catch (Exception ignored) { }
            checking.set(false);
            l.finished(installed, title);
        }).start();
    }

    // background checks while playing: the game saves and reloads itself at the same spot
    @Override protected void onResume() {
        super.onResume();
        immersive();
        if (started && System.currentTimeMillis() - lastCheck > CHECK_EVERY_MS) backgroundCheck();
    }
    private final Runnable periodic = new Runnable() { @Override public void run() { if (started) backgroundCheck(); ui.postDelayed(this, CHECK_EVERY_MS); } };
    { ui.postDelayed(periodic, CHECK_EVERY_MS); }
    private void backgroundCheck() {
        checkForUpdate(new UpdateListener() {
            @Override public void progress(String v, int p) { }
            @Override public void finished(String installed, String title) {
                if (installed == null) return;
                ui.post(() -> web.evaluateJavascript("window.__fm27Live ? window.__fm27Live({state:'installed',version:" + JSONObject.quote(installed) + ",title:" + JSONObject.quote(title == null ? "" : title) + "}) : location.reload();", null));
            }
        });
    }

    // ------------------------------------------------------------------ back button
    @Override public boolean onKeyDown(int code, KeyEvent e) {
        if (code == KeyEvent.KEYCODE_BACK) {
            // close an open dialog first (the game closes modals on Escape)
            web.evaluateJavascript("(function(){var m=document.querySelector('.modal-wrap,.palette,.story,.ceremony');if(m){document.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape'}));var x=m.querySelector('.close,.st-x,[data-close]');if(x)x.click();else if(m.parentNode&&m.classList.contains('palette'))m.remove();return 'closed';}if(window.ufm&&window.ufm.world&&window.ufm.screen!=='home'){window.ufm.go('home');return 'home';}return 'none';})()", (r) -> {
                if (r != null && r.contains("none")) {
                    long now = System.currentTimeMillis();
                    if (now - lastBack < 2000) finish();
                    else { lastBack = now; Toast.makeText(this, "Nochmal zurück zum Beenden", Toast.LENGTH_SHORT).show(); }
                }
            });
            return true;
        }
        return super.onKeyDown(code, e);
    }

    private class Bridge {
        @JavascriptInterface public void reloadGame(String slot) { ui.post(() -> loadGame(slot)); }
        @JavascriptInterface public void quit() { ui.post(MainActivity.this::finish); }
    }

    // ------------------------------------------------------------------ helpers
    interface Progress { void bytes(long n); }
    private static byte[] fetch(String url, Progress p) throws Exception {
        String u = url + "?t=" + System.currentTimeMillis();
        for (int hop = 0; hop < 6; hop++) {
            HttpURLConnection c = (HttpURLConnection) new URL(u).openConnection();
            c.setConnectTimeout(6000); c.setReadTimeout(20000); c.setInstanceFollowRedirects(false); c.setUseCaches(false);
            int code = c.getResponseCode();
            if (code >= 300 && code < 400) { u = c.getHeaderField("Location"); c.disconnect(); continue; } // GitHub → CDN redirect
            if (code != 200) throw new Exception("HTTP " + code);
            try (InputStream in = c.getInputStream(); ByteArrayOutputStream out = new ByteArrayOutputStream()) {
                byte[] b = new byte[65536]; int n; long tot = 0;
                while ((n = in.read(b)) > 0) { out.write(b, 0, n); tot += n; if (p != null) p.bytes(tot); }
                return out.toByteArray();
            }
        }
        throw new Exception("too many redirects");
    }
    private static String sha256(byte[] b) throws Exception {
        byte[] h = MessageDigest.getInstance("SHA-256").digest(b);
        StringBuilder sb = new StringBuilder(); for (byte x : h) sb.append(String.format("%02x", x)); return sb.toString();
    }
    private static String readAll(InputStream in) throws Exception {
        ByteArrayOutputStream o = new ByteArrayOutputStream(); byte[] b = new byte[8192]; int n; while ((n = in.read(b)) > 0) o.write(b, 0, n);
        return new String(o.toByteArray(), StandardCharsets.UTF_8);
    }
    private static int cmp(String a, String b) {
        String[] x = a.split("\\."), y = b.split("\\.");
        for (int i = 0; i < 3; i++) {
            int p = i < x.length ? Integer.parseInt(x[i].replaceAll("\\D", "")) : 0, q = i < y.length ? Integer.parseInt(y[i].replaceAll("\\D", "")) : 0;
            if (p != q) return p > q ? 1 : -1;
        }
        return 0;
    }
    private static void deleteRec(File f) { if (f == null || !f.exists()) return; File[] k = f.listFiles(); if (k != null) for (File c : k) deleteRec(c); f.delete(); }
}
