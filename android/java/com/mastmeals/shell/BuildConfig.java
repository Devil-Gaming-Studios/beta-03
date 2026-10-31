package com.mastmeals.shell;

/**
 * Build configuration parameters for the Mast Meals Android shell.
 * Default SERVER_URL is set to http://localhost:3000 to work seamlessly
 * with adb reverse tcp:3000 tcp:3000 (providing a secure localhost context for getUserMedia).
 */
public final class BuildConfig {
    public static final boolean DEBUG = true;
    public static final String APPLICATION_ID = "com.mastmeals.shell";
    public static final String BUILD_TYPE = "debug";
    public static final int VERSION_CODE = 1;
    public static final String VERSION_NAME = "0.1-test";

    /**
     * Express server URL loaded by WebView.
     * Default: http://localhost:3000 (run `adb reverse tcp:3000 tcp:3000`).
     */
    public static final String SERVER_URL = "http://localhost:3000";
}
