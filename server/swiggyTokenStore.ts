import crypto from 'crypto';
import fs from 'fs';
import path from 'path';

export interface StoredSwiggyTokens {
  userId: string;
  accessToken: string;
  refreshToken?: string;
  tokenType: string;
  scope?: string;
  expiresAt: number; // Unix timestamp in ms
  issuedAt: number;  // Unix timestamp in ms
  clientId: string;
  userProfile?: {
    phoneNumber?: string;
    name?: string;
    email?: string;
  };
  firstToolCallResult?: {
    tool: string;
    calledAt: string;
    success: boolean;
    summary: string;
    addressCount?: number;
    error?: string;
  };
}

interface EncryptedPayload {
  keyId: string;
  iv: string;
  tag: string;
  data: string;
}

class SwiggyTokenStore {
  private dataDir = path.resolve(process.cwd(), '.data');
  private storeFile = path.resolve(this.dataDir, 'swiggy_tokens_encrypted.json');
  private fallbackKeyFile = path.resolve(this.dataDir, '.encryption_key');

  private keys: Record<string, Buffer> = {};
  private activeKeyId: string = 'primary';

  constructor() {
    this.initKeys();
  }

  private initKeys() {
    // 1. Read keys from environment
    this.activeKeyId = process.env.TOKEN_ENCRYPTION_ACTIVE_KEY_ID || 'primary';
    const envKeysJson = process.env.TOKEN_ENCRYPTION_KEYS;

    if (envKeysJson) {
      try {
        const parsed = JSON.parse(envKeysJson);
        for (const [id, rawKey] of Object.entries(parsed)) {
          if (typeof rawKey === 'string') {
            // Support hex or base64 or raw string key
            if (rawKey.length === 64) {
              this.keys[id] = Buffer.from(rawKey, 'hex');
            } else if (rawKey.length === 44) {
              this.keys[id] = Buffer.from(rawKey, 'base64');
            } else {
              this.keys[id] = crypto.createHash('sha256').update(rawKey).digest();
            }
          }
        }
      } catch (err) {
        console.warn('Failed to parse TOKEN_ENCRYPTION_KEYS JSON, using secure persistent key:', err);
      }
    }

    // 2. If no valid active key loaded from env, use persistent key in .data
    if (!this.keys[this.activeKeyId]) {
      if (!fs.existsSync(this.dataDir)) {
        fs.mkdirSync(this.dataDir, { recursive: true });
      }
      let secretHex = '';
      if (fs.existsSync(this.fallbackKeyFile)) {
        secretHex = fs.readFileSync(this.fallbackKeyFile, 'utf-8').trim();
      }
      if (!secretHex || secretHex.length !== 64) {
        secretHex = crypto.randomBytes(32).toString('hex');
        fs.writeFileSync(this.fallbackKeyFile, secretHex, 'utf-8');
      }
      this.keys[this.activeKeyId] = Buffer.from(secretHex, 'hex');
    }
  }

  private encrypt(text: string): string {
    const key = this.keys[this.activeKeyId];
    if (!key) {
      throw new Error(`Encryption key ${this.activeKeyId} not found`);
    }

    const iv = crypto.randomBytes(12); // 96-bit IV for AES-GCM
    const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
    let ciphertext = cipher.update(text, 'utf8', 'hex');
    ciphertext += cipher.final('hex');
    const tag = cipher.getAuthTag();

    const payload: EncryptedPayload = {
      keyId: this.activeKeyId,
      iv: iv.toString('hex'),
      tag: tag.toString('hex'),
      data: ciphertext,
    };

    return Buffer.from(JSON.stringify(payload)).toString('base64url');
  }

  private decrypt(ciphertextBase64: string): string {
    const raw = Buffer.from(ciphertextBase64, 'base64url').toString('utf8');
    const payload: EncryptedPayload = JSON.parse(raw);

    const key = this.keys[payload.keyId];
    if (!key) {
      throw new Error(`Decryption key '${payload.keyId}' is unavailable.`);
    }

    const decipher = crypto.createDecipheriv('aes-256-gcm', key, Buffer.from(payload.iv, 'hex'));
    decipher.setAuthTag(Buffer.from(payload.tag, 'hex'));
    let decrypted = decipher.update(payload.data, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  }

  private readAllEncrypted(): Record<string, any> {
    try {
      if (fs.existsSync(this.storeFile)) {
        const raw = fs.readFileSync(this.storeFile, 'utf8');
        return JSON.parse(raw);
      }
    } catch (e) {
      console.error('Failed to read encrypted token file:', e);
    }
    return {};
  }

  private writeAllEncrypted(records: Record<string, any>): void {
    try {
      if (!fs.existsSync(this.dataDir)) {
        fs.mkdirSync(this.dataDir, { recursive: true });
      }
      fs.writeFileSync(this.storeFile, JSON.stringify(records, null, 2), 'utf8');
    } catch (e) {
      console.error('Failed to write encrypted token file:', e);
    }
  }

  public saveTokens(userId: string, tokens: StoredSwiggyTokens): void {
    if (!userId) throw new Error('userId is required for token storage');

    const encryptedRecord = {
      userId,
      clientId: tokens.clientId,
      tokenType: tokens.tokenType || 'Bearer',
      scope: tokens.scope || 'mcp:tools mcp:resources',
      expiresAt: tokens.expiresAt,
      issuedAt: tokens.issuedAt || Date.now(),
      userProfile: tokens.userProfile || {},
      firstToolCallResult: tokens.firstToolCallResult,
      // Encrypt sensitive access and refresh tokens at rest
      encryptedAccessToken: this.encrypt(tokens.accessToken),
      encryptedRefreshToken: tokens.refreshToken ? this.encrypt(tokens.refreshToken) : undefined,
    };

    const all = this.readAllEncrypted();
    all[userId] = encryptedRecord;
    this.writeAllEncrypted(all);
  }

  public saveFirstToolCallResult(
    userId: string,
    result: { tool: string; calledAt: string; success: boolean; summary: string; addressCount?: number; error?: string }
  ): void {
    const tokens = this.getTokens(userId);
    if (tokens) {
      tokens.firstToolCallResult = result;
      this.saveTokens(userId, tokens);
    }
  }

  public getTokens(userId: string): StoredSwiggyTokens | null {
    if (!userId) return null;
    const all = this.readAllEncrypted();
    const record = all[userId];
    if (!record || !record.encryptedAccessToken) {
      return null;
    }

    try {
      const accessToken = this.decrypt(record.encryptedAccessToken);
      const refreshToken = record.encryptedRefreshToken
        ? this.decrypt(record.encryptedRefreshToken)
        : undefined;

      return {
        userId: record.userId,
        clientId: record.clientId,
        tokenType: record.tokenType || 'Bearer',
        scope: record.scope,
        expiresAt: record.expiresAt,
        issuedAt: record.issuedAt,
        userProfile: record.userProfile,
        firstToolCallResult: record.firstToolCallResult,
        accessToken,
        refreshToken,
      };
    } catch (err: any) {
      console.error(`Failed to decrypt tokens for user ${userId}:`, err?.message);
      return null;
    }
  }

  public hasValidTokens(userId: string): boolean {
    const tokens = this.getTokens(userId);
    if (!tokens || !tokens.accessToken) return false;
    // Check if token has not expired (with 60-second leeway)
    return tokens.expiresAt > Date.now() + 60 * 1000;
  }

  public isNearExpiry(tokens: StoredSwiggyTokens): boolean {
    // 5 minutes buffer before expiration
    return Date.now() + 5 * 60 * 1000 >= tokens.expiresAt;
  }

  public deleteTokens(userId: string): boolean {
    if (!userId) return false;
    const all = this.readAllEncrypted();
    if (all[userId]) {
      delete all[userId];
      this.writeAllEncrypted(all);
      return true;
    }
    return false;
  }
}

export const swiggyTokenStore = new SwiggyTokenStore();
