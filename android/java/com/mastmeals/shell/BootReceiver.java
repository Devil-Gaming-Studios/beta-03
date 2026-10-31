package com.mastmeals.shell;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.util.Log;

/**
 * Boot receiver to ensure the ShopNotificationListenerService is rebound
 * and any offline queued messages are synced when the phone restarts.
 */
public class BootReceiver extends BroadcastReceiver {

    private static final String TAG = "BootReceiver";

    @Override
    public void onReceive(Context context, Intent intent) {
        if (intent == null) return;
        String action = intent.getAction();
        Log.i(TAG, "Received broadcast action: " + action);

        if (Intent.ACTION_BOOT_COMPLETED.equals(action) ||
                Intent.ACTION_MY_PACKAGE_REPLACED.equals(action)) {
            // 1. Rebind notification listener service
            ShopNotificationListenerService.requestRebindService(context);

            // 2. Check and sync any offline queued messages
            ShopSyncManager.syncPendingMessages(context, null);
        }
    }
}
