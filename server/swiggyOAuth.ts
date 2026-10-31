import crypto from 'crypto';
import { swiggyTokenStore, StoredSwiggyTokens } from './swiggyTokenStore';

export interface PkcePair {
  codeVerifier: string;
  codeChallenge: string;
}

export interface OAuthStateRecord {
  state: string;
  userId: string;
  codeVerifier: string;
  redirectUri: string;
  clientId: string;
  createdAt: number;
}

export interface SwiggyTokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number; // in seconds (documented: ~432000s = 5 days)
  refresh_token?: string;
  scope?: string;
  error?: string;
  error_description?: string;
}

export interface ClientRegistrationRecord {
  client_id: string;
  client_name: string;
  redirect_uris: string[];
  grant_types: string[];
  response_types: string[];
  token_endpoint_auth_method: string;
  client_id_issued_at?: number;
}

export class SwiggyOAuthService {
  private authServerMetadataUrl = 'https://mcp.swiggy.com/.well-known/oauth-authorization-server';
  private defaultAuthUrl = 'https://mcp.swiggy.com/auth/authorize';
  private defaultTokenUrl = 'https://mcp.swiggy.com/auth/token';
  private defaultLogoutUrl = 'https://mcp.swiggy.com/auth/logout';
  private defaultRegisterUrl = 'https://mcp.swiggy.com/auth/register';

  // Dynamic Client Registration cache keyed by redirect URI
  private clientRegistrations: Map<string, ClientRegistrationRecord> = new Map();

  // In-memory state tracking with 10-minute TTL
  private pendingStates: Map<string, OAuthStateRecord> = new Map();

  // Metadata cache
  private metadataFetched = false;

  constructor() {
    this.cleanExpiredStates();
    setInterval(() => this.cleanExpiredStates(), 60 * 1000);
  }

  private cleanExpiredStates() {
    const now = Date.now();
    for (const [state, rec] of this.pendingStates.entries()) {
      if (now - rec.createdAt > 10 * 60 * 1000) {
        this.pendingStates.delete(state);
      }
    }
  }

  /**
   * Discovers OAuth endpoints from Swiggy's RFC 8414 metadata endpoint
   */
  public async discoverMetadata(): Promise<void> {
    if (this.metadataFetched) return;
    try {
      const res = await fetch(this.authServerMetadataUrl, {
        headers: { Accept: 'application/json' },
      });
      if (res.ok) {
        const data: any = await res.json();
        if (data.authorization_endpoint) this.defaultAuthUrl = data.authorization_endpoint;
        if (data.token_endpoint) this.defaultTokenUrl = data.token_endpoint;
        if (data.registration_endpoint) this.defaultRegisterUrl = data.registration_endpoint;
        this.metadataFetched = true;
      }
    } catch (e: any) {
      console.warn('[Swiggy OAuth] Could not fetch server metadata, using standard endpoints:', e?.message);
    }
  }

  /**
   * Generates PKCE code_verifier and S256 code_challenge
   */
  public generatePkce(): PkcePair {
    // 32 random bytes -> 43 characters base64url
    const verifier = crypto.randomBytes(32).toString('base64url');
    const challenge = crypto
      .createHash('sha256')
      .update(verifier)
      .digest('base64url');

    return {
      codeVerifier: verifier,
      codeChallenge: challenge,
    };
  }

  /**
   * Obtains a client_id via official Dynamic Client Registration (RFC 7591)
   * Localhost development requires no prior production approval.
   * Clients register dynamically with Swiggy without hardcoded or shared credentials.
   */
  public async registerClient(redirectUri: string): Promise<ClientRegistrationRecord> {
    await this.discoverMetadata();

    // Check cache first
    const cached = this.clientRegistrations.get(redirectUri);
    if (cached) {
      return cached;
    }

    console.log(`[Swiggy OAuth] Performing Dynamic Client Registration for redirect_uri: ${redirectUri}`);

    const regPayload = {
      client_name: 'KitchenSync',
      redirect_uris: [redirectUri],
      grant_types: ['authorization_code', 'refresh_token'],
      response_types: ['code'],
      token_endpoint_auth_method: 'none',
    };

    const res = await fetch(this.defaultRegisterUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: JSON.stringify(regPayload),
    });

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`Dynamic Client Registration failed (${res.status}): ${errText}`);
    }

    const regData: any = await res.json();
    if (!regData.client_id) {
      throw new Error(`Dynamic Client Registration returned no client_id: ${JSON.stringify(regData)}`);
    }

    const record: ClientRegistrationRecord = {
      client_id: regData.client_id,
      client_name: regData.client_name || 'KitchenSync',
      redirect_uris: regData.redirect_uris || [redirectUri],
      grant_types: regData.grant_types || ['authorization_code', 'refresh_token'],
      response_types: regData.response_types || ['code'],
      token_endpoint_auth_method: regData.token_endpoint_auth_method || 'none',
      client_id_issued_at: regData.client_id_issued_at,
    };

    this.clientRegistrations.set(redirectUri, record);
    console.log(`[Swiggy OAuth] Successfully registered client with client_id: ${record.client_id}`);
    return record;
  }

  /**
   * Configures the OAuth redirect URI for local development.
   * Swiggy's OAuth server strictly enforces redirect URI allowlisting:
   * - Localhost URIs (e.g. http://localhost:3000/api/swiggy/callback) are whitelisted for local dev.
   * - Public cloud hosts (e.g. *.run.app) are rejected as "Oops, Run isn't whitelisted yet".
   * This method ensures local development always uses a valid localhost callback.
   */
  public getRedirectUri(customUri?: string, hostHeader?: string, protocol = 'http'): string {
    // 1. If explicit env variable is provided and not empty
    const envUri = (process.env.SWIGGY_OAUTH_REDIRECT_URI || '').trim();

    if (customUri) {
      try {
        const u = new URL(customUri);
        // If custom URI is a localhost or 127.0.0.1 callback, respect it
        if (u.hostname === 'localhost' || u.hostname === '127.0.0.1') {
          return customUri;
        }
        // If custom URI is not localhost (e.g. *.run.app), do not send it to Swiggy
        // because Swiggy's OAuth check-redirect-uri will reject it with "Oops, Run isn't whitelisted yet"
        console.warn(
          `[Swiggy OAuth] Custom redirect_uri (${customUri}) is not localhost. ` +
          `Falling back to local development callback to prevent "Run isn't whitelisted" rejection.`
        );
      } catch {
        // invalid URL
      }
    }

    if (envUri) {
      return envUri;
    }

    // If hostHeader is localhost or 127.0.0.1, build callback from that
    if (hostHeader && (hostHeader.startsWith('localhost') || hostHeader.startsWith('127.0.0.1'))) {
      return `${protocol}://${hostHeader}/api/swiggy/callback`;
    }

    // Default canonical localhost redirect URI for Swiggy MCP development
    return 'http://localhost:3000/api/swiggy/callback';
  }

  /**
   * Generates the official Swiggy OAuth 2.1 + PKCE Authorization URL
   */
  public async getAuthorizationUrl(
    userId: string,
    redirectUri: string
  ): Promise<{ authorizationUrl: string; state: string; redirectUri: string; clientId: string }> {
    if (!userId) {
      throw new Error('User ID is required to start Swiggy OAuth flow.');
    }

    // Dynamic Client Registration (RFC 7591)
    const clientRecord = await this.registerClient(redirectUri);
    const pkce = this.generatePkce();
    const state = crypto.randomBytes(24).toString('base64url');

    this.pendingStates.set(state, {
      state,
      userId,
      codeVerifier: pkce.codeVerifier,
      redirectUri,
      clientId: clientRecord.client_id,
      createdAt: Date.now(),
    });

    const params = new URLSearchParams({
      response_type: 'code',
      client_id: clientRecord.client_id,
      redirect_uri: redirectUri,
      scope: 'mcp:tools mcp:resources',
      state,
      code_challenge: pkce.codeChallenge,
      code_challenge_method: 'S256',
    });

    return {
      authorizationUrl: `${this.defaultAuthUrl}?${params.toString()}`,
      state,
      redirectUri,
      clientId: clientRecord.client_id,
    };
  }

  /**
   * Exchanges authorization code for Swiggy access & refresh tokens
   */
  public async handleCallback(
    code: string,
    state: string
  ): Promise<{ success: boolean; userId: string; expiresIn: number; accessToken: string }> {
    if (!code || !state) {
      throw new Error('Missing code or state parameter in OAuth callback');
    }

    const stateRecord = this.pendingStates.get(state);
    if (!stateRecord) {
      throw new Error('Invalid or expired OAuth state parameter. Please retry connecting.');
    }

    this.pendingStates.delete(state);

    const tokenParams = new URLSearchParams({
      grant_type: 'authorization_code',
      client_id: stateRecord.clientId,
      code: code.trim(),
      redirect_uri: stateRecord.redirectUri,
      code_verifier: stateRecord.codeVerifier,
    });

    const response = await fetch(this.defaultTokenUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Accept': 'application/json',
      },
      body: tokenParams.toString(),
    });

    const tokenData: SwiggyTokenResponse = await response.json();

    if (!response.ok || tokenData.error || !tokenData.access_token) {
      const errMsg = tokenData.error_description || tokenData.error || `HTTP ${response.status} token exchange failure`;
      throw new Error(`Swiggy token exchange failed: ${errMsg}`);
    }

    // Default to 5 days (432000s) per Swiggy documentation if not returned
    const ttlSeconds = typeof tokenData.expires_in === 'number' && tokenData.expires_in > 0
      ? tokenData.expires_in
      : 5 * 24 * 60 * 60;

    const expiresAt = Date.now() + ttlSeconds * 1000;

    // Encrypt and store tokens on backend
    const tokens: StoredSwiggyTokens = {
      userId: stateRecord.userId,
      clientId: stateRecord.clientId,
      accessToken: tokenData.access_token,
      refreshToken: tokenData.refresh_token,
      tokenType: tokenData.token_type || 'Bearer',
      scope: tokenData.scope || 'mcp:tools mcp:resources',
      expiresAt,
      issuedAt: Date.now(),
      userProfile: {
        name: 'Swiggy Member',
      },
    };

    swiggyTokenStore.saveTokens(stateRecord.userId, tokens);

    return {
      success: true,
      userId: stateRecord.userId,
      expiresIn: ttlSeconds,
      accessToken: tokenData.access_token,
    };
  }

  /**
   * Refreshes Swiggy access token using refresh-token rotation
   */
  public async refreshAccessToken(userId: string): Promise<StoredSwiggyTokens> {
    const existing = swiggyTokenStore.getTokens(userId);
    if (!existing || !existing.refreshToken) {
      throw new Error('No refresh token available. User must re-authenticate with Swiggy.');
    }

    const tokenParams = new URLSearchParams({
      grant_type: 'refresh_token',
      client_id: existing.clientId,
      refresh_token: existing.refreshToken,
    });

    const response = await fetch(this.defaultTokenUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Accept': 'application/json',
      },
      body: tokenParams.toString(),
    });

    const tokenData: SwiggyTokenResponse = await response.json();

    if (!response.ok || tokenData.error || !tokenData.access_token) {
      swiggyTokenStore.deleteTokens(userId);
      throw new Error(`Token refresh failed: ${tokenData.error_description || tokenData.error || response.statusText}. Please reconnect.`);
    }

    const ttlSeconds = typeof tokenData.expires_in === 'number' && tokenData.expires_in > 0
      ? tokenData.expires_in
      : 5 * 24 * 60 * 60;

    // Refresh-token rotation: update refresh token if a new one is provided by Swiggy
    const updated: StoredSwiggyTokens = {
      ...existing,
      accessToken: tokenData.access_token,
      refreshToken: tokenData.refresh_token || existing.refreshToken,
      expiresAt: Date.now() + ttlSeconds * 1000,
      issuedAt: Date.now(),
    };

    swiggyTokenStore.saveTokens(userId, updated);
    return updated;
  }

  /**
   * Gets a valid access token for the user, auto-refreshing if near expiration
   */
  public async getValidAccessToken(userId: string): Promise<string> {
    const tokens = swiggyTokenStore.getTokens(userId);
    if (!tokens || !tokens.accessToken) {
      throw new Error('No Swiggy account connected for this user.');
    }

    if (swiggyTokenStore.isNearExpiry(tokens)) {
      if (tokens.refreshToken) {
        const refreshed = await this.refreshAccessToken(userId);
        return refreshed.accessToken;
      }
      throw new Error('Swiggy access token has expired. Please reconnect your account.');
    }

    return tokens.accessToken;
  }

  /**
   * Logs out user from Swiggy and cleans stored tokens
   */
  public async disconnect(userId: string): Promise<void> {
    const tokens = swiggyTokenStore.getTokens(userId);
    if (tokens?.accessToken) {
      try {
        await fetch(this.defaultLogoutUrl, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${tokens.accessToken}`,
          },
        });
      } catch (err) {
        console.warn('Swiggy logout endpoint notice:', err);
      }
    }
    swiggyTokenStore.deleteTokens(userId);
  }
}

export const swiggyOAuthService = new SwiggyOAuthService();
