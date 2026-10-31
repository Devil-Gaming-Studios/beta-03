package com.mastmeals.shell;

import android.app.Notification;
import android.content.ComponentName;
import android.content.Context;
import android.content.SharedPreferences;
import android.os.Build;
import android.os.Bundle;
import android.os.Parcelable;
import android.service.notification.NotificationListenerService;
import android.service.notification.StatusBarNotification;
import android.util.Log;

import java.util.Collections;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.regex.Pattern;

/**
 * Privacy-preserving notification listener for local Kirana / grocery shop chat notifications.
 *
 * PRIVACY SPECIFICATION:
 * - Reads notifications ONLY from com.whatsapp, com.whatsapp.w4b (WhatsApp Business), and org.telegram.messenger.
 * - Inspects messages ONLY when the conversation title or sender matches the configured shop contact name.
 * - Ignores all other personal notifications immediately without reading, storing, or logging.
 * - Supports MessagingStyle extras (EXTRA_MESSAGES) to extract individual messages from grouped notifications.
 * - Filters out group summaries and "N new messages" placeholder previews.
 * - Dedupes messages by sender, timestamp, and text.
 */
public class ShopNotificationListenerService extends NotificationListenerService {

    private static final String TAG = "ShopNotifListener";
    public static final String PKG_WHATSAPP = "com.whatsapp";
    public static final String PKG_WHATSAPP_BUSINESS = "com.whatsapp.w4b";
    public static final String PKG_TELEGRAM = "org.telegram.messenger";

    private static final Pattern SUMMARY_PLACEHOLDER_PATTERN = Pattern.compile(
            "^(\\d+\\s+new messages?|\\d+\\s+messages?|checking for new messages|whatsapp).*$",
            Pattern.CASE_INSENSITIVE
    );

    // In-memory LRU cache to deduplicate notifications (sender + timestamp + text)
    private static final int DEDUPE_CAPACITY = 200;
    private static final Map<String, Long> recentMessageHashes = Collections.synchronizedMap(
            new LinkedHashMap<String, Long>(DEDUPE_CAPACITY, 0.75f, true) {
                @Override
                protected boolean removeEldestEntry(Map.Entry<String, Long> eldest) {
                    return size() > DEDUPE_CAPACITY;
                }
            }
    );

    public static void requestRebindService(Context context) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.N && context != null) {
            try {
                ComponentName componentName = new ComponentName(context, ShopNotificationListenerService.class);
                requestRebind(componentName);
                Log.i(TAG, "Requested rebind for ShopNotificationListenerService");
            } catch (Exception e) {
                Log.w(TAG, "Failed to request rebind: " + e.getMessage());
            }
        }
    }

    @Override
    public void onListenerConnected() {
        super.onListenerConnected();
        Log.i(TAG, "ShopNotificationListenerService connected and active");
    }

    @Override
    public void onListenerDisconnected() {
        super.onListenerDisconnected();
        Log.w(TAG, "ShopNotificationListenerService disconnected, attempting rebind");
        requestRebindService(this);
    }

    @Override
    public void onNotificationPosted(StatusBarNotification sbn) {
        if (sbn == null) return;

        // 1. Strict Package Whitelist: ignore everything except WhatsApp, WhatsApp Business, and Telegram
        String packageName = sbn.getPackageName();
        boolean isWhatsApp = PKG_WHATSAPP.equals(packageName) || PKG_WHATSAPP_BUSINESS.equals(packageName);
        boolean isTelegram = PKG_TELEGRAM.equals(packageName);
        if (!isWhatsApp && !isTelegram) {
            return;
        }

        Notification notification = sbn.getNotification();
        if (notification == null || notification.extras == null) return;

        // Skip Android Notification group summaries
        if ((notification.flags & Notification.FLAG_GROUP_SUMMARY) != 0) {
            return;
        }

        Bundle extras = notification.extras;

        // Check if monitoring is paused by user
        SharedPreferences prefs = getSharedPreferences("mastmeals", Context.MODE_PRIVATE);
        boolean isPaused = prefs.getBoolean("shop_listener_paused", false);
        if (isPaused) {
            return;
        }

        // 2. Strict Contact Whitelist: compare sender or conversation title to configured shop contact
        String configuredContact = prefs.getString("shop_contact_name", "Gupta Kirana Store").trim();
        if (configuredContact.isEmpty()) {
            return; // No contact configured, do nothing
        }

        String title = extras.getString(Notification.EXTRA_TITLE);
        CharSequence convTitle = extras.getCharSequence(Notification.EXTRA_CONVERSATION_TITLE);

        String conversationName = (convTitle != null && !convTitle.toString().trim().isEmpty())
                ? convTitle.toString().trim()
                : (title != null ? title.trim() : "");

        if (conversationName.isEmpty()) return;

        // Strict case-insensitive match against configured shop/contractor contact names (supports comma-separated list)
        boolean isMatch = false;
        String[] allowedTargets = configuredContact.split("[,;]");
        for (String target : allowedTargets) {
            String cleanTarget = target.trim();
            if (!cleanTarget.isEmpty()) {
                if (conversationName.equalsIgnoreCase(cleanTarget) ||
                        conversationName.toLowerCase().contains(cleanTarget.toLowerCase()) ||
                        cleanTarget.toLowerCase().contains(conversationName.toLowerCase())) {
                    isMatch = true;
                    break;
                }
            }
        }

        if (!isMatch) {
            // Discard immediately: NEVER log, persist, or forward other chats
            return;
        }

        String source = isWhatsApp ? "whatsapp" : "telegram";
        long notifPostTime = sbn.getPostTime() > 0 ? sbn.getPostTime() : System.currentTimeMillis();

        // 3. Extract messages using MessagingStyle (EXTRA_MESSAGES) if present, handling grouped messages
        Parcelable[] messagesParcelable = extras.getParcelableArray(Notification.EXTRA_MESSAGES);
        if (messagesParcelable != null && messagesParcelable.length > 0) {
            for (Parcelable p : messagesParcelable) {
                if (p instanceof Bundle) {
                    Bundle msgBundle = (Bundle) p;
                    CharSequence textChar = msgBundle.getCharSequence("text");
                    if (textChar == null) continue;
                    String text = textChar.toString().trim();
                    if (text.isEmpty() || isPlaceholderText(text)) continue;

                    long timestamp = msgBundle.getLong("time", notifPostTime);
                    CharSequence senderChar = msgBundle.getCharSequence("sender");
                    String msgSender = (senderChar != null && !senderChar.toString().trim().isEmpty())
                            ? senderChar.toString().trim()
                            : conversationName;

                    processShopMessage(source, msgSender, text, timestamp);
                }
            }
            return;
        }

        // Fallback for non-MessagingStyle single notifications
        CharSequence textChar = extras.getCharSequence(Notification.EXTRA_TEXT);
        if (textChar == null || textChar.toString().trim().isEmpty()) {
            textChar = extras.getCharSequence(Notification.EXTRA_BIG_TEXT);
        }
        if (textChar == null || textChar.toString().trim().isEmpty()) {
            return;
        }

        String text = textChar.toString().trim();
        if (isPlaceholderText(text)) {
            return;
        }

        processShopMessage(source, conversationName, text, notifPostTime);
    }

    private void processShopMessage(String source, String sender, String text, long timestamp) {
        // Deduplicate by sender, timestamp (rounded to second), and text content
        String dedupeKey = source + "|" + sender.toLowerCase() + "|" + (timestamp / 1000) + "|" + text.trim();
        if (recentMessageHashes.containsKey(dedupeKey)) {
            Log.d(TAG, "Skipping duplicate notification message: " + dedupeKey);
            return;
        }
        recentMessageHashes.put(dedupeKey, System.currentTimeMillis());

        Log.i(TAG, "Shop chat notification matched from " + sender + " (" + source + "): " + text);

        // Enqueue offline or send to server immediately
        ShopSyncManager.enqueueOrSend(getApplicationContext(), source, sender, text, timestamp);
    }

    private boolean isPlaceholderText(String text) {
        if (text == null || text.trim().isEmpty()) return true;
        return SUMMARY_PLACEHOLDER_PATTERN.matcher(text.trim()).matches();
    }

    @Override
    public void onNotificationRemoved(StatusBarNotification sbn) {
        // No action needed on removal
    }
}
