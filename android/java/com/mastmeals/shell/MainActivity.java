package com.mastmeals.shell;

import android.app.Activity;
import android.app.AlertDialog;
import android.content.SharedPreferences;
import android.graphics.Color;
import android.os.Bundle;
import android.text.InputType;
import android.view.Gravity;
import android.view.View;
import android.Manifest;
import android.content.pm.PackageManager;
import android.webkit.PermissionRequest;
import android.webkit.WebChromeClient;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.EditText;
import android.widget.FrameLayout;
import android.widget.TextView;

/**
 * Test harness: loads the Mast Meals local web UI from the backend URL the tester enters.
 * This exists to exercise the API on a device. The production app is the Flutter client
 * described in docs/02-voice-and-chat.md.
 */
public class MainActivity extends Activity {

    private static final String PREFS = "mastmeals";
    private static final String KEY_URL = "base_url";
    private static final String DEFAULT_URL = "http://10.0.2.2:8000";

    private WebView web;
    private SharedPreferences prefs;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        prefs = getSharedPreferences(PREFS, MODE_PRIVATE);

        // Check & request microphone permission for Shruti & Cactus Whisper STT
        if (checkSelfPermission(Manifest.permission.RECORD_AUDIO) != PackageManager.PERMISSION_GRANTED) {
            requestPermissions(new String[]{
                Manifest.permission.RECORD_AUDIO,
                Manifest.permission.MODIFY_AUDIO_SETTINGS
            }, 101);
        }

        FrameLayout root = new FrameLayout(this);
        web = new WebView(this);

        WebSettings settings = web.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setLoadWithOverviewMode(true);
        settings.setUseWideViewPort(true);
        settings.setMixedContentMode(WebSettings.MIXED_CONTENT_ALWAYS_ALLOW);
        settings.setMediaPlaybackRequiresUserGesture(false);

        web.setWebViewClient(new WebViewClient());
        web.setWebChromeClient(new WebChromeClient() {
            @Override
            public void onPermissionRequest(final PermissionRequest request) {
                // Grant audio capture permission to Web Speech / MediaRecorder
                request.grant(request.getResources());
            }
        });

        root.addView(web, new FrameLayout.LayoutParams(
                FrameLayout.LayoutParams.MATCH_PARENT, FrameLayout.LayoutParams.MATCH_PARENT));

        // Small floating settings control: long-press-free way to repoint the app at another backend.
        TextView gear = new TextView(this);
        gear.setText("\u2699");
        gear.setTextSize(20);
        gear.setTextColor(Color.WHITE);
        gear.setGravity(Gravity.CENTER);
        gear.setAlpha(0.55f);
        FrameLayout.LayoutParams gearParams = new FrameLayout.LayoutParams(dp(44), dp(44), Gravity.BOTTOM | Gravity.END);
        gearParams.setMargins(0, 0, dp(12), dp(12));
        gear.setOnClickListener(v -> askUrl());
        root.addView(gear, gearParams);

        setContentView(root);

        String url = prefs.getString(KEY_URL, "");
        if (url.isEmpty()) {
            askUrl();
        } else {
            web.loadUrl(url);
        }
    }

    private int dp(int value) {
        return Math.round(value * getResources().getDisplayMetrics().density);
    }

    private void askUrl() {
        final EditText input = new EditText(this);
        input.setInputType(InputType.TYPE_CLASS_TEXT | InputType.TYPE_TEXT_VARIATION_URI);
        input.setText(prefs.getString(KEY_URL, DEFAULT_URL));
        input.setSelection(input.getText().length());
        input.setHint("http://192.168.1.5:8000");

        new AlertDialog.Builder(this)
                .setTitle("Backend URL")
                .setMessage("Use your laptop's LAN IP with port 8000. 10.0.2.2 works on an emulator.")
                .setView(input)
                .setPositiveButton("Load", (d, w) -> {
                    String url = input.getText().toString().trim();
                    if (!url.startsWith("http://") && !url.startsWith("https://")) {
                        url = "http://" + url;
                    }
                    prefs.edit().putString(KEY_URL, url).apply();
                    web.loadUrl(url);
                })
                .setNegativeButton("Cancel", null)
                .show();
    }

    @Override
    public void onBackPressed() {
        if (web != null && web.canGoBack()) {
            web.goBack();
        } else {
            super.onBackPressed();
        }
    }
}
