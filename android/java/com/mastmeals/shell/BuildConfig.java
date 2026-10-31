package com.mastmeals.shell;

/**
 * Build configuration parameters for the Mast Meals Android shell.
 * Default SERVER_URL is the HTTPS Cloudflare tunnel so the app auto-connects with no prompt.
 */
public final class BuildConfig {
    public static final boolean DEBUG = true;
    public static final String APPLICATION_ID = "com.mastmeals.shell";
    public static final String BUILD_TYPE = "debug";
    public static final int VERSION_CODE = 1;
    public static final String VERSION_NAME = "0.1-test";

    /**
     * Express server URL loaded by WebView.
     * Default: the Cloudflare tunnel (HTTPS, so mic/camera work). Change it here or in the in-app settings.
     */
    public static final String SERVER_URL = "https://sake-loved-southeast-bacteria.trycloudflare.com/";
}
