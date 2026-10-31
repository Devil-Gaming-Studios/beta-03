package com.mastmeals.shell;

import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.os.Handler;
import android.os.Looper;
import android.util.Log;

import org.json.JSONObject;

import java.io.BufferedReader;
import java.io.InputStream;
import java.io.InputStreamReader;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.util.List;
import java.util.concurrent.ScheduledExecutorService;
import java.util.concurrent.ScheduledFuture;
import java.util.concurrent.TimeUnit;

/**
 * Manages posting shop messages to /api/shop-inbox and syncing offline queued messages.
 */
public class ShopSyncManager {

    private static final String TAG = "ShopSyncManager";
    public static final String ACTION_SHOP_MESSAGE_RECEIVED = "com.mastmeals.shell.SHOP_MESSAGE_RECEIVED";
    public static final String EXTRA_MESSAGE_JSON = "extra_message_json";

    private static final ExecutorService executor = Executors.newSingleThreadExecutor();
    private static final ScheduledExecutorService retryScheduler = Executors.newSingleThreadScheduledExecutor();
    private static ScheduledFuture<?> periodicTask = null;
    private static final Handler mainHandler = new Handler(Looper.getMainLooper());

    public static void enqueueOrSend(Context context, String source, String sender, String text, long timestamp) {
        executor.execute(() -> {
            boolean success = false;
            String serverResponse = null;

            try {
                SharedPreferences prefs = context.getSharedPreferences("mastmeals", Context.MODE_PRIVATE);
                String baseUrl = prefs.getString("base_url", BuildConfig.SERVER_URL);
                String authToken = prefs.getString("auth_token", "test_token_household_alpha");

                String endpoint = baseUrl.replaceAll("/+$", "") + "/api/shop-inbox";
                URL url = new URL(endpoint);

                HttpURLConnection conn = (HttpURLConnection) url.openConnection();
                conn.setRequestMethod("POST");
                conn.setRequestProperty("Content-Type", "application/json; charset=utf-8");
                conn.setRequestProperty("Authorization", "Bearer " + authToken);
                conn.setConnectTimeout(6000);
                conn.setReadTimeout(15000);
                conn.setDoOutput(true);

                JSONObject payload = new JSONObject();
                payload.put("source", source);
                payload.put("sender", sender);
                payload.put("text", text);
                payload.put("timestamp", timestamp);

                byte[] postBytes = payload.toString().getBytes(StandardCharsets.UTF_8);
                try (OutputStream os = conn.getOutputStream()) {
                    os.write(postBytes);
                    os.flush();
                }

                int statusCode = conn.getResponseCode();
                if (statusCode >= 200 && statusCode < 300) {
                    success = true;
                    try (InputStream is = conn.getInputStream();
                         BufferedReader reader = new BufferedReader(new InputStreamReader(is, StandardCharsets.UTF_8))) {
                        StringBuilder sb = new StringBuilder();
                        String line;
                        while ((line = reader.readLine()) != null) {
                            sb.append(line);
                        }
                        serverResponse = sb.toString();
                    }
                    Log.i(TAG, "Successfully posted shop message to server: " + statusCode);
                } else {
                    Log.w(TAG, "Server returned error: " + statusCode);
                }
            } catch (Exception e) {
                Log.w(TAG, "Server unreachable or network error, queuing offline: " + e.getMessage());
            }

            if (!success) {
                // Queue offline in local SQLite database
                ShopDatabaseHelper db = ShopDatabaseHelper.getInstance(context);
                long rowId = db.insertMessage(source, sender, text, timestamp);
                Log.i(TAG, "Message queued in offline database (id=" + rowId + "). Pending count: " + db.getUnsyncedCount());
                scheduleRetryLoop(context.getApplicationContext());
            }

            // Broadcast to MainActivity so WebView can show live toast
            try {
                JSONObject broadcastJson = new JSONObject();
                broadcastJson.put("source", source);
                broadcastJson.put("sender", sender);
                broadcastJson.put("text", text);
                broadcastJson.put("timestamp", timestamp);
                broadcastJson.put("synced", success);

                Intent intent = new Intent(ACTION_SHOP_MESSAGE_RECEIVED);
                intent.putExtra(EXTRA_MESSAGE_JSON, broadcastJson.toString());
                intent.setPackage(context.getPackageName());
                context.sendBroadcast(intent);
            } catch (Exception ignored) {}
        });
    }

    public static synchronized void scheduleRetryLoop(Context appContext) {
        if (periodicTask != null && !periodicTask.isDone()) {
            return;
        }
        periodicTask = retryScheduler.scheduleWithFixedDelay(() -> {
            ShopDatabaseHelper db = ShopDatabaseHelper.getInstance(appContext);
            if (db.getUnsyncedCount() == 0) {
                if (periodicTask != null) {
                    periodicTask.cancel(false);
                    periodicTask = null;
                }
                return;
            }
            syncPendingMessages(appContext, null);
        }, 15, 30, TimeUnit.SECONDS);
    }

    public static void syncPendingMessages(Context context, Runnable onComplete) {
        executor.execute(() -> {
            ShopDatabaseHelper db = ShopDatabaseHelper.getInstance(context);
            List<ShopDatabaseHelper.QueuedMessage> pending = db.getUnsyncedMessages();
            if (pending.isEmpty()) {
                if (onComplete != null) mainHandler.post(onComplete);
                return;
            }

            SharedPreferences prefs = context.getSharedPreferences("mastmeals", Context.MODE_PRIVATE);
            String baseUrl = prefs.getString("base_url", BuildConfig.SERVER_URL);
            String authToken = prefs.getString("auth_token", "test_token_household_alpha");
            String endpoint = baseUrl.replaceAll("/+$", "") + "/api/shop-inbox";

            for (ShopDatabaseHelper.QueuedMessage msg : pending) {
                try {
                    URL url = new URL(endpoint);
                    HttpURLConnection conn = (HttpURLConnection) url.openConnection();
                    conn.setRequestMethod("POST");
                    conn.setRequestProperty("Content-Type", "application/json; charset=utf-8");
                    conn.setRequestProperty("Authorization", "Bearer " + authToken);
                    conn.setConnectTimeout(5000);
                    conn.setReadTimeout(10000);
                    conn.setDoOutput(true);

                    JSONObject payload = new JSONObject();
                    payload.put("source", msg.source);
                    payload.put("sender", msg.sender);
                    payload.put("text", msg.text);
                    payload.put("timestamp", msg.timestamp);

                    try (OutputStream os = conn.getOutputStream()) {
                        os.write(payload.toString().getBytes(StandardCharsets.UTF_8));
                        os.flush();
                    }

                    if (conn.getResponseCode() >= 200 && conn.getResponseCode() < 300) {
                        db.markSynced(msg.id);
                        Log.i(TAG, "Synced offline message id: " + msg.id);
                    }
                } catch (Exception e) {
                    Log.w(TAG, "Sync failed for message " + msg.id + ": " + e.getMessage());
                    break; // Stop trying if still offline
                }
            }

            if (db.getUnsyncedCount() > 0) {
                scheduleRetryLoop(context.getApplicationContext());
            }

            if (onComplete != null) mainHandler.post(onComplete);
        });
    }
}
