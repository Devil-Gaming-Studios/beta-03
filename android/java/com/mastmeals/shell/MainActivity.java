package com.mastmeals.shell;

import android.Manifest;
import android.app.Activity;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.IntentFilter;
import android.content.SharedPreferences;
import android.content.pm.PackageManager;
import android.graphics.Color;
import android.os.Build;
import android.os.Bundle;
import android.provider.Settings;
import android.view.Gravity;
import android.view.View;
import android.webkit.JavascriptInterface;
import android.webkit.PermissionRequest;
import android.webkit.WebChromeClient;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.FrameLayout;
import android.widget.TextView;
import android.widget.Toast;

import org.json.JSONObject;

/**
 * Native Android WebView Shell for Mast Meals / KitchenSync.
 *
 * Capabilities:
 * - Loads React/Vite SPA from BuildConfig.SERVER_URL (default: http://localhost:3000).
 * - Automatic mic & camera WebChromeClient permission grants and Android runtime permissions.
 * - Bidirectional JavaScript Bridge (`window.AndroidNative` and `window.AndroidBridge.onShopMessage`).
 * - Listens for incoming WhatsApp & Telegram shop chat broadcasts and notifies the web app in real time.
 */
public class MainActivity extends Activity {

    private static final String PREFS = "mastmeals";
    private static final String KEY_URL = "server_url_v2";
    private static final String KEY_CONTACT = "shop_contact_name";
    private static final String KEY_TOKEN = "auth_token";
    private static final int PERM_REQUEST_CODE = 101;

    private WebView web;
    private SharedPreferences prefs;

    private final BroadcastReceiver shopMessageReceiver = new BroadcastReceiver() {
        @Override
        public void onReceive(Context context, Intent intent) {
            if (ShopSyncManager.ACTION_SHOP_MESSAGE_RECEIVED.equals(intent.getAction())) {
                String messageJson = intent.getStringExtra(ShopSyncManager.EXTRA_MESSAGE_JSON);
                if (messageJson != null && web != null) {
                    dispatchShopMessageToWeb(messageJson);
                }
            }
        }
    };

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        prefs = getSharedPreferences(PREFS, MODE_PRIVATE);

        // Check & request runtime permissions for microphone and camera
        checkAndRequestMediaPermissions();

        FrameLayout root = new FrameLayout(this);
        web = new WebView(this);

        WebSettings settings = web.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setDatabaseEnabled(true);
        // Critical: Disable overview mode so the WebView does not zoom out to desktop proportions
        settings.setLoadWithOverviewMode(false);
        settings.setUseWideViewPort(true);
        settings.setSupportZoom(false);
        settings.setBuiltInZoomControls(false);
        settings.setDisplayZoomControls(false);
        settings.setMediaPlaybackRequiresUserGesture(false);
        settings.setDefaultTextEncodingName("utf-8");

        // Maintain 1:1 responsive viewport scaling with system display metrics
        web.setInitialScale(0);

        // Identify native Android shell in User-Agent for seamless web-native responsive integration
        String currentUa = settings.getUserAgentString();
        if (currentUa != null && !currentUa.contains("MastMealsNative")) {
            settings.setUserAgentString(currentUa + " MastMealsNative/0.1");
        }

        // Register Native JavaScript Bridge
        web.addJavascriptInterface(new AndroidBridgeInterface(), "AndroidNative");

        web.setWebViewClient(new WebViewClient());
        web.setWebChromeClient(new WebChromeClient() {
            @Override
            public void onPermissionRequest(final PermissionRequest request) {
                // Grant microphone and camera permission requests from web getUserMedia
                runOnUiThread(() -> {
                    String[] resources = request.getResources();
                    request.grant(resources);
                });
            }
        });

        root.addView(web, new FrameLayout.LayoutParams(
                FrameLayout.LayoutParams.MATCH_PARENT, FrameLayout.LayoutParams.MATCH_PARENT));

        // Floating Settings Icon (Gear) positioned safely above the bottom navigation bar (84dp from bottom)
        TextView gear = new TextView(this);
        gear.setText("\u2699");
        gear.setTextSize(20);
        gear.setTextColor(Color.WHITE);
        gear.setGravity(Gravity.CENTER);
        gear.setAlpha(0.85f);
        android.graphics.drawable.GradientDrawable gearBg = new android.graphics.drawable.GradientDrawable();
        gearBg.setShape(android.graphics.drawable.GradientDrawable.OVAL);
        gearBg.setColor(Color.parseColor("#CC1A3826"));
        gearBg.setStroke(dp(1), Color.parseColor("#44C8EBD1"));
        gear.setBackground(gearBg);

        FrameLayout.LayoutParams gearParams = new FrameLayout.LayoutParams(dp(40), dp(40), Gravity.BOTTOM | Gravity.END);
        gearParams.setMargins(0, 0, dp(12), dp(84));
        gear.setOnClickListener(v -> openSettingsActivity());
        root.addView(gear, gearParams);

        setContentView(root);

        // Register broadcast receiver for live shop messages
        IntentFilter filter = new IntentFilter(ShopSyncManager.ACTION_SHOP_MESSAGE_RECEIVED);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            registerReceiver(shopMessageReceiver, filter, Context.RECEIVER_NOT_EXPORTED);
        } else {
            registerReceiver(shopMessageReceiver, filter);
        }

        // Load configured server URL, falling back to BuildConfig.SERVER_URL (http://localhost:3000)
        String url = prefs.getString(KEY_URL, BuildConfig.SERVER_URL);
        if (url == null || url.trim().isEmpty()) {
            url = BuildConfig.SERVER_URL;
        }
        web.loadUrl(url);
    }

    private void checkAndRequestMediaPermissions() {
        boolean micGranted = checkSelfPermission(Manifest.permission.RECORD_AUDIO) == PackageManager.PERMISSION_GRANTED;
        boolean camGranted = checkSelfPermission(Manifest.permission.CAMERA) == PackageManager.PERMISSION_GRANTED;

        if (!micGranted || !camGranted) {
            requestPermissions(new String[]{
                    Manifest.permission.RECORD_AUDIO,
                    Manifest.permission.MODIFY_AUDIO_SETTINGS,
                    Manifest.permission.CAMERA
            }, PERM_REQUEST_CODE);
        }
    }

    private void openSettingsActivity() {
        Intent intent = new Intent(this, SettingsActivity.class);
        startActivity(intent);
    }

    private void dispatchShopMessageToWeb(String messageJson) {
        web.post(() -> {
            String js = "if (window.AndroidBridge && typeof window.AndroidBridge.onShopMessage === 'function') { " +
                    "  try { window.AndroidBridge.onShopMessage(" + messageJson + "); } catch(e) { console.error('onShopMessage error', e); } " +
                    "}";
            web.evaluateJavascript(js, null);
        });
    }

    @Override
    protected void onDestroy() {
        super.onDestroy();
        try {
            unregisterReceiver(shopMessageReceiver);
        } catch (Exception ignored) {}
    }

    @Override
    public void onBackPressed() {
        if (web != null && web.canGoBack()) {
            web.goBack();
        } else {
            super.onBackPressed();
        }
    }

    private int dp(int value) {
        return Math.round(value * getResources().getDisplayMetrics().density);
    }

    /**
     * JavaScript Bridge exposed to the React/Vite web application as `window.AndroidNative`.
     */
    public class AndroidBridgeInterface {

        @JavascriptInterface
        public String getShopContactName() {
            return prefs.getString(KEY_CONTACT, "Gupta Kirana Store");
        }

        @JavascriptInterface
        public void setShopContactName(String name) {
            prefs.edit().putString(KEY_CONTACT, name != null ? name.trim() : "").apply();
        }

        @JavascriptInterface
        public boolean isNotificationListenerGranted() {
            return SettingsActivity.isNotificationListenerEnabled(MainActivity.this);
        }

        @JavascriptInterface
        public void openNotificationSettings() {
            try {
                Intent intent = new Intent(Settings.ACTION_NOTIFICATION_LISTENER_SETTINGS);
                startActivity(intent);
            } catch (Exception e) {
                runOnUiThread(() -> Toast.makeText(MainActivity.this, "Could not open Notification Settings", Toast.LENGTH_SHORT).show());
            }
        }

        @JavascriptInterface
        public String getServerUrl() {
            return prefs.getString(KEY_URL, BuildConfig.SERVER_URL);
        }

        @JavascriptInterface
        public void setServerUrl(String url) {
            if (url != null && !url.trim().isEmpty()) {
                prefs.edit().putString(KEY_URL, url.trim()).apply();
                runOnUiThread(() -> web.loadUrl(url.trim()));
            }
        }

        @JavascriptInterface
        public String getAuthToken() {
            return prefs.getString(KEY_TOKEN, "test_token_household_alpha");
        }

        @JavascriptInterface
        public void setAuthToken(String token) {
            prefs.edit().putString(KEY_TOKEN, token != null ? token.trim() : "").apply();
        }

        @JavascriptInterface
        public void syncPendingMessages() {
            ShopSyncManager.syncPendingMessages(MainActivity.this, () -> {
                runOnUiThread(() -> Toast.makeText(MainActivity.this, "Offline shop queue synced", Toast.LENGTH_SHORT).show());
            });
        }

        @JavascriptInterface
        public void openNativeSettings() {
            openSettingsActivity();
        }
    }
}
