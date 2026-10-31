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

export class SwiggyOAuthService {
  private authServerMetadataUrl = 'https://mcp.swiggy.com/.well-known/oauth-authorization-server';
  private defaultAuthUrl = 'https://mcp.swiggy.com/auth/authorize';
  private defaultTokenUrl = 'https://mcp.swiggy.com/auth/token';
  private defaultLogoutUrl = 'https://mcp.swiggy.com/auth/logout';
  private defaultRegisterUrl = 'https://mcp.swiggy.com/auth/register';

  // In-memory state tracking with 10-minute TTL
  private pendingStates: Map<string, OAuthStateRecord> = new Map();
  private registeredClientId: string | null = null;

  constructor() {
    this.cleanExpiredStates();
    setInterval(() => this.cleanExpiredStates(), 60 * 1000);
  }

  private cleanExpiredStates() {
    const now = Date.now();
    for (const [state, rec] of this.pendingStates.entries()) {
      // 10 minutes TTL
      if (now - rec.createdAt > 10 * 60 * 1000) {
        this.pendingStates.delete(state);
      }
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
   * Obtains or registers a client_id via Dynamic Client Registration (RFC 7591)
   */
  public async getClientId(redirectUri: string): Promise<string> {
    const envClientId = (process.env.SWIGGY_MCP_CLIENT_ID || '').trim();
    if (envClientId) {
      return envClientId;
    }
    if (this.registeredClientId) {
      return this.registeredClientId;
    }

    try {
      const res = await fetch(this.defaultRegisterUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        body: JSON.stringify({
          client_name: 'KitchenSync',
          redirect_uris: [redirectUri],
          grant_types: ['authorization_code', 'refresh_token'],
          response_types: ['code'],
          token_endpoint_auth_method: 'none',
        }),
      });

      if (res.ok) {
        const data: any = await res.json();
        if (data.client_id) {
          this.registeredClientId = data.client_id;
          return data.client_id;
        }
      }
    } catch (e: any) {
      console.warn('Dynamic client registration failed, falling back to swiggy-mcp:', e?.message);
    }

    // Default public client ID supported by Swiggy's MCP server
    this.registeredClientId = 'swiggy-mcp';
    return 'swiggy-mcp';
  }

  public getRedirectUri(customUri?: string, hostHeader?: string, protocol = 'http'): string {
    if (customUri) {
      try {
        const u = new URL(customUri);
        if (u.pathname.endsWith('/api/swiggy/callback')) {
          return customUri;
        }
      } catch {
        // fallback to default
      }
    }
    const envUri = (process.env.SWIGGY_OAUTH_REDIRECT_URI || '').trim();
    if (envUri) return envUri;

    // Build default callback from current host
    const host = hostHeader || 'localhost:3000';
    return `${protocol}://${host}/api/swiggy/callback`;
  }

  /**
   * Generates the Swiggy OAuth 2.1 + PKCE Authorization URL
   */
  public async getAuthorizationUrl(
    userId: string,
    redirectUri: string
  ): Promise<{ authorizationUrl: string; state: string }> {
    if (!userId) {
      throw new Error('User ID is required to start Swiggy OAuth flow.');
    }

    const clientId = await this.getClientId(redirectUri);
    const pkce = this.generatePkce();
    const state = crypto.randomBytes(24).toString('base64url');

    this.pendingStates.set(state, {
      state,
      userId,
      codeVerifier: pkce.codeVerifier,
      redirectUri,
      createdAt: Date.now(),
    });

    const params = new URLSearchParams({
      response_type: 'code',
      client_id: clientId,
      redirect_uri: redirectUri,
      scope: 'mcp:tools mcp:resources',
      state,
      code_challenge: pkce.codeChallenge,
      code_challenge_method: 'S256',
    });

    return {
      authorizationUrl: `${this.defaultAuthUrl}?${params.toString()}`,
      state,
    };
  }

  /**
   * Exchanges authorization code for Swiggy access & refresh tokens
   */
  public async handleCallback(
    code: string,
    state: string
  ): Promise<{ success: boolean; userId: string; expiresIn: number }> {
    if (!code || !state) {
      throw new Error('Missing code or state parameter in OAuth callback');
    }

    const stateRecord = this.pendingStates.get(state);
    if (!stateRecord) {
      throw new Error('Invalid or expired OAuth state parameter. Please retry connecting.');
    }

    this.pendingStates.delete(state);

    const clientId = await this.getClientId(stateRecord.redirectUri);

    const tokenParams = new URLSearchParams({
      grant_type: 'authorization_code',
      client_id: clientId,
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

    // Encrypt and store tokens
    const tokens: StoredSwiggyTokens = {
      userId: stateRecord.userId,
      clientId,
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
    };
  }

  /**
   * Refreshes Swiggy access token using refresh_token rotation
   */
  public async refreshAccessToken(userId: string): Promise<StoredSwiggyTokens> {
    const existing = swiggyTokenStore.getTokens(userId);
    if (!existing || !existing.refreshToken) {
      throw new Error('No refresh token available. User must re-authenticate with Swiggy.');
    }

    const tokenParams = new URLSearchParams({
      grant_type: 'refresh_token',
      client_id: existing.clientId || 'swiggy-mcp',
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

    const updated: StoredSwiggyTokens = {
      ...existing,
      accessToken: tokenData.access_token,
      // Implement refresh-token rotation: update if a new refresh_token is returned
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
        console.warn('Swiggy logout endpoint call error:', err);
      }
    }
    swiggyTokenStore.deleteTokens(userId);
  }
}

export const swiggyOAuthService = new SwiggyOAuthService();
