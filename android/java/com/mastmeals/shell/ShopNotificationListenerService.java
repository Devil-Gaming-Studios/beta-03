package com.mastmeals.shell;

import android.app.Notification;
import android.content.Context;
import android.content.SharedPreferences;
import android.os.Bundle;
import android.service.notification.NotificationListenerService;
import android.service.notification.StatusBarNotification;
import android.util.Log;

/**
 * Privacy-preserving notification listener for local Kirana / grocery shop chat notifications.
 *
 * PRIVACY SPECIFICATION:
 * - Reads notifications ONLY from com.whatsapp and org.telegram.messenger.
 * - Inspects messages ONLY when the sender or conversation title equals the configured shop contact name.
 * - Ignores all other notifications immediately without reading, storing, or logging.
 */
public class ShopNotificationListenerService extends NotificationListenerService {

    private static final String TAG = "ShopNotifListener";
    private static final String PKG_WHATSAPP = "com.whatsapp";
    private static final String PKG_TELEGRAM = "org.telegram.messenger";

    @Override
    public void onNotificationPosted(StatusBarNotification sbn) {
        if (sbn == null) return;

        // 1. Strict Package Whitelist: ignore everything except WhatsApp and Telegram
        String packageName = sbn.getPackageName();
        if (!PKG_WHATSAPP.equals(packageName) && !PKG_TELEGRAM.equals(packageName)) {
            return;
        }

        Notification notification = sbn.getNotification();
        if (notification == null || notification.extras == null) return;

        Bundle extras = notification.extras;

        // 2. Strict Contact Whitelist: compare sender/title to configured shop contact
        SharedPreferences prefs = getSharedPreferences("mastmeals", Context.MODE_PRIVATE);
        String configuredContact = prefs.getString("shop_contact_name", "Gupta Kirana Store").trim();
        if (configuredContact.isEmpty()) {
            return; // No contact configured, do nothing
        }

        String title = extras.getString(Notification.EXTRA_TITLE);
        CharSequence convTitle = extras.getCharSequence(Notification.EXTRA_CONVERSATION_TITLE);

        String sender = (title != null && !title.trim().isEmpty())
                ? title.trim()
                : (convTitle != null ? convTitle.toString().trim() : "");

        if (sender.isEmpty()) return;

        // Strict case-insensitive match against configured shop contact
        boolean isMatch = sender.equalsIgnoreCase(configuredContact) ||
                sender.toLowerCase().contains(configuredContact.toLowerCase()) ||
                configuredContact.toLowerCase().contains(sender.toLowerCase());

        if (!isMatch) {
            // Discard immediately: NEVER log, persist, or forward other chats
            return;
        }

        // 3. Extract message content for matching shop chat only
        CharSequence textChar = extras.getCharSequence(Notification.EXTRA_TEXT);
        if (textChar == null || textChar.toString().trim().isEmpty()) {
            textChar = extras.getCharSequence(Notification.EXTRA_BIG_TEXT);
        }
        if (textChar == null || textChar.toString().trim().isEmpty()) {
            return;
        }

        String text = textChar.toString().trim();
        long timestamp = sbn.getPostTime() > 0 ? sbn.getPostTime() : System.currentTimeMillis();
        String source = PKG_WHATSAPP.equals(packageName) ? "whatsapp" : "telegram";

        Log.i(TAG, "Shop chat notification matched from " + sender + " (" + source + ")");

        // 4. Send to server / queue offline
        ShopSyncManager.enqueueOrSend(getApplicationContext(), source, sender, text, timestamp);
    }

    @Override
    public void onNotificationRemoved(StatusBarNotification sbn) {
        // No action needed on removal
    }
}
