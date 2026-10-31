package com.mastmeals.shell;

import android.app.Activity;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.graphics.Color;
import android.os.Bundle;
import android.provider.Settings;
import android.text.TextUtils;
import android.util.TypedValue;
import android.view.Gravity;
import android.view.View;
import android.widget.Button;
import android.widget.EditText;
import android.widget.LinearLayout;
import android.widget.ScrollView;
import android.widget.TextView;
import android.widget.Toast;

/**
 * Settings Activity for configuring the Shop Chat Listener:
 * - Shop contact name to listen for (WhatsApp / Telegram)
 * - Server URL & Auth token
 * - Button to open Android Settings > Notification access
 * - Offline sync trigger
 */
public class SettingsActivity extends Activity {

    private static final String PREFS = "mastmeals";
    private static final String KEY_CONTACT = "shop_contact_name";
    private static final String KEY_URL = "base_url";
    private static final String KEY_TOKEN = "auth_token";

    private SharedPreferences prefs;
    private EditText editContact;
    private EditText editUrl;
    private EditText editToken;
    private TextView textNotifStatus;
    private TextView textOfflineCount;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        prefs = getSharedPreferences(PREFS, MODE_PRIVATE);

        ScrollView scroll = new ScrollView(this);
        scroll.setBackgroundColor(Color.parseColor("#FAF9F6"));

        LinearLayout layout = new LinearLayout(this);
        layout.setOrientation(LinearLayout.VERTICAL);
        int pad = dp(20);
        layout.setPadding(pad, pad, pad, pad);

        // Header Title
        TextView title = new TextView(this);
        title.setText("Shop Listener Settings");
        title.setTextSize(TypedValue.COMPLEX_UNIT_SP, 20);
        title.setTextColor(Color.parseColor("#1A3826"));
        title.setTypeface(null, android.graphics.Typeface.BOLD);
        layout.addView(title);

        TextView subtitle = new TextView(this);
        subtitle.setText("Configure WhatsApp/Telegram shop notifications & Express backend.");
        subtitle.setTextSize(TypedValue.COMPLEX_UNIT_SP, 12);
        subtitle.setTextColor(Color.parseColor("#727972"));
        subtitle.setPadding(0, dp(4), 0, dp(16));
        layout.addView(subtitle);

        // Section 1: Shop Contact Name
        layout.addView(createLabel("Shop Contact Name (WhatsApp / Telegram)"));
        editContact = new EditText(this);
        editContact.setText(prefs.getString(KEY_CONTACT, "Gupta Kirana Store"));
        editContact.setHint("e.g. Gupta Kirana Store");
        styleInput(editContact);
        layout.addView(editContact);

        TextView contactNote = new TextView(this);
        contactNote.setText("Only notifications from this specific contact name will be processed. All other chats are strictly ignored.");
        contactNote.setTextSize(TypedValue.COMPLEX_UNIT_SP, 11);
        contactNote.setTextColor(Color.parseColor("#888888"));
        contactNote.setPadding(0, dp(2), 0, dp(16));
        layout.addView(contactNote);

        // Section 2: Notification Access Permission Button & Status
        layout.addView(createLabel("Notification Access Status"));
        textNotifStatus = new TextView(this);
        updateNotifStatusText();
        textNotifStatus.setTextSize(TypedValue.COMPLEX_UNIT_SP, 13);
        textNotifStatus.setPadding(0, dp(2), 0, dp(8));
        layout.addView(textNotifStatus);

        Button btnOpenNotif = new Button(this);
        btnOpenNotif.setText("Open Notification Access Settings");
        btnOpenNotif.setBackgroundColor(Color.parseColor("#1A3826"));
        btnOpenNotif.setTextColor(Color.WHITE);
        btnOpenNotif.setOnClickListener(v -> openNotificationAccessSettings());
        layout.addView(btnOpenNotif);

        View divider1 = createDivider();
        layout.addView(divider1);

        // Section 3: Server URL
        layout.addView(createLabel("Express Server URL"));
        editUrl = new EditText(this);
        editUrl.setText(prefs.getString(KEY_URL, BuildConfig.SERVER_URL));
        editUrl.setHint("http://localhost:3000");
        styleInput(editUrl);
        layout.addView(editUrl);

        TextView urlNote = new TextView(this);
        urlNote.setText("Use http://localhost:3000 with `adb reverse tcp:3000 tcp:3000`, or your laptop LAN IP.");
        urlNote.setTextSize(TypedValue.COMPLEX_UNIT_SP, 11);
        urlNote.setTextColor(Color.parseColor("#888888"));
        urlNote.setPadding(0, dp(2), 0, dp(16));
        layout.addView(urlNote);

        // Section 4: Auth Token
        layout.addView(createLabel("User Authorization Token"));
        editToken = new EditText(this);
        editToken.setText(prefs.getString(KEY_TOKEN, "test_token_household_alpha"));
        editToken.setHint("Bearer token for /api/shop-inbox");
        styleInput(editToken);
        layout.addView(editToken);

        View divider2 = createDivider();
        layout.addView(divider2);

        // Section 5: Offline Sync
        layout.addView(createLabel("Offline Queue"));
        textOfflineCount = new TextView(this);
        updateOfflineCount();
        textOfflineCount.setTextSize(TypedValue.COMPLEX_UNIT_SP, 13);
        textOfflineCount.setPadding(0, dp(2), 0, dp(8));
        layout.addView(textOfflineCount);

        Button btnSync = new Button(this);
        btnSync.setText("Sync Queued Messages Now");
        btnSync.setBackgroundColor(Color.parseColor("#EDF2EE"));
        btnSync.setTextColor(Color.parseColor("#1A3826"));
        btnSync.setOnClickListener(v -> {
            Toast.makeText(this, "Syncing offline messages...", Toast.LENGTH_SHORT).show();
            ShopSyncManager.syncPendingMessages(this, () -> {
                updateOfflineCount();
                Toast.makeText(this, "Sync complete!", Toast.LENGTH_SHORT).show();
            });
        });
        layout.addView(btnSync);

        // Save & Return Button
        Button btnSave = new Button(this);
        btnSave.setText("Save Settings");
        btnSave.setBackgroundColor(Color.parseColor("#047857"));
        btnSave.setTextColor(Color.WHITE);
        LinearLayout.LayoutParams saveParams = new LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.WRAP_CONTENT);
        saveParams.setMargins(0, dp(24), 0, dp(20));
        btnSave.setLayoutParams(saveParams);
        btnSave.setOnClickListener(v -> saveSettings());
        layout.addView(btnSave);

        scroll.addView(layout);
        setContentView(scroll);
    }

    @Override
    protected void onResume() {
        super.onResume();
        updateNotifStatusText();
        updateOfflineCount();
    }

    private void updateNotifStatusText() {
        boolean granted = isNotificationListenerEnabled(this);
        if (granted) {
            textNotifStatus.setText("Status: GRANTED (Active)");
            textNotifStatus.setTextColor(Color.parseColor("#15803D"));
        } else {
            textNotifStatus.setText("Status: NOT GRANTED (Tap button below to enable)");
            textNotifStatus.setTextColor(Color.parseColor("#B91C1C"));
        }
    }

    private void updateOfflineCount() {
        int count = ShopDatabaseHelper.getInstance(this).getUnsyncedCount();
        textOfflineCount.setText("Queued offline messages: " + count);
        textOfflineCount.setTextColor(Color.parseColor("#1A3826"));
    }

    private void openNotificationAccessSettings() {
        try {
            Intent intent = new Intent(Settings.ACTION_NOTIFICATION_LISTENER_SETTINGS);
            startActivity(intent);
        } catch (Exception e) {
            Toast.makeText(this, "Could not open Notification Settings: " + e.getMessage(), Toast.LENGTH_LONG).show();
        }
    }

    public static boolean isNotificationListenerEnabled(Context context) {
        String pkgName = context.getPackageName();
        final String flat = Settings.Secure.getString(context.getContentResolver(), "enabled_notification_listeners");
        if (!TextUtils.isEmpty(flat)) {
            final String[] names = flat.split(":");
            for (String name : names) {
                final ComponentName cn = ComponentName.unflattenFromString(name);
                if (cn != null) {
                    if (TextUtils.equals(pkgName, cn.getPackageName())) {
                        return true;
                    }
                }
            }
        }
        return false;
    }

    private void saveSettings() {
        String contact = editContact.getText().toString().trim();
        String url = editUrl.getText().toString().trim();
        String token = editToken.getText().toString().trim();

        if (url.isEmpty()) url = BuildConfig.SERVER_URL;
        if (!url.startsWith("http://") && !url.startsWith("https://")) {
            url = "http://" + url;
        }

        prefs.edit()
                .putString(KEY_CONTACT, contact)
                .putString(KEY_URL, url)
                .putString(KEY_TOKEN, token)
                .apply();

        Toast.makeText(this, "Settings saved!", Toast.LENGTH_SHORT).show();
        finish();
    }

    private TextView createLabel(String text) {
        TextView tv = new TextView(this);
        tv.setText(text);
        tv.setTextSize(TypedValue.COMPLEX_UNIT_SP, 13);
        tv.setTextColor(Color.parseColor("#1A3826"));
        tv.setTypeface(null, android.graphics.Typeface.BOLD);
        tv.setPadding(0, dp(6), 0, dp(4));
        return tv;
    }

    private void styleInput(EditText et) {
        et.setBackgroundColor(Color.WHITE);
        et.setPadding(dp(12), dp(10), dp(12), dp(10));
        et.setTextColor(Color.parseColor("#1a1c1a"));
        et.setTextSize(TypedValue.COMPLEX_UNIT_SP, 14);
    }

    private View createDivider() {
        View v = new View(this);
        v.setBackgroundColor(Color.parseColor("#E6E4DD"));
        LinearLayout.LayoutParams lp = new LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT, dp(1));
        lp.setMargins(0, dp(16), 0, dp(16));
        v.setLayoutParams(lp);
        return v;
    }

    private int dp(int value) {
        return Math.round(value * getResources().getDisplayMetrics().density);
    }
}
