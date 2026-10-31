/**
 * Cross-device sync client. Keeps this browser/app's local state (store.ts) and the server
 * account store (server/syncService.ts) in step:
 *   - every local change is debounced, diffed against the last-synced snapshot and pushed;
 *   - a long-poll (/api/sync/wait) tells this device the instant another device pushes, and it
 *     pulls straight away (plain HTTP, so it also works through Cloudflare quick tunnels); as a safety net it also polls every 15 s, on focus and when the network returns;
 *   - documents changed locally but not yet pushed are never overwritten by a pull.
 * Works offline: failed pushes are simply retried on the next cycle.
 */
import { store } from './store';
import { hashDoc, inScope } from './syncSchema';

const K = {
  token: 'mastmeals_sync_token_v1',
  account: 'mastmeals_sync_account_v1',
  version: 'mastmeals_sync_version_v1',
  snapshot: 'mastmeals_sync_snapshot_v1',
  client: 'mastmeals_sync_client_v1',
};

export type SyncStatus = 'off' | 'idle' | 'syncing' | 'offline' | 'error';
type Snapshot = Record<string, string>; // doc key -> hash of last synced value

function ls(): Storage | null {
  try { return typeof localStorage !== 'undefined' ? localStorage : null; } catch { return null; }
}
const get = (k: string) => { try { return ls()?.getItem(k) ?? null; } catch { return null; } };
const set = (k: string, v: string) => { try { ls()?.setItem(k, v); } catch { /* quota */ } };
const del = (k: string) => { try { ls()?.removeItem(k); } catch { /* ignore */ } };

/**
 * One person must map to ONE sync account on every phone, however they type their login:
 * emails are lower-cased; mobile numbers are reduced to the last 10 digits so "+91 98765 43210",
 * "09876543210" and "9876543210" all land on the same account.
 */
export const CLIENT_BUILD = 'r5';

export function canonicalSyncEmail(identifier: string): string | null {
  const v = String(identifier || '').trim().toLowerCase();
  if (!v) return null;
  const mobile = v.match(/^(\d+)@mobile\.mastmeals$/);
  if (v.includes('@') && !mobile) return v;
  const digits = (mobile ? mobile[1] : v.replace(/[^0-9]/g, ''));
  if (digits.length < 7) return null;
  return `${digits.length > 10 ? digits.slice(-10) : digits}@mobile.mastmeals`;
}

class SyncClient {
  private status: SyncStatus = get(K.token) ? 'idle' : 'off';
  private lastError = '';
  private lastSyncAt: string | null = null;
  private inflight: Promise<void> | null = null;
  private again = false;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private listeners = new Set<() => void>();
  private started = false;
  private streamAbort: AbortController | null = null;
  private held = false; // true between createAccount() and release(): the local profile does not exist yet
  private streamRetry = 1000;
  private streamAlive = false;

  // ---- state for the UI ----
  getInfo() {
    return { status: this.status, account: get(K.account), error: this.lastError, lastSyncAt: this.lastSyncAt };
  }
  subscribe(fn: () => void) { this.listeners.add(fn); return () => { this.listeners.delete(fn); }; }
  private emit() { this.listeners.forEach((f) => f()); }
  private setStatus(s: SyncStatus, err = '') { this.status = s; this.lastError = err; this.emit(); }
  isLinked() { return !!get(K.token); }

  private clientId(): string {
    let id = get(K.client);
    if (!id) { id = 'dev_' + Math.random().toString(36).slice(2, 10) + Date.now().toString(36); set(K.client, id); }
    return id;
  }

  /** Email used as the sync account id for whatever the user typed (email or mobile). */
  accountEmailFor(identifier: string): string | null {
    return canonicalSyncEmail(identifier);
  }

  // ---- account ----
  /** Sign in to the sync account, creating it if allowed and it does not exist yet. */
  async connect(emailRaw: string, password: string, allowCreate: boolean): Promise<{ ok: boolean; error?: string }> {
    const email = canonicalSyncEmail(emailRaw) || emailRaw.trim().toLowerCase();
    try {
      let r = await this.post('/api/sync/login', { email, password });
      // Accounts created before numbers were normalised may be stored under the raw email: try that too.
      const legacy = emailRaw.trim().toLowerCase();
      if (r.status === 404 && legacy !== email) {
        const r2 = await this.post('/api/sync/login', { email: legacy, password });
        if (r2.status !== 404) r = r2;
      }
      if (r.status === 404 && allowCreate) r = await this.post('/api/sync/register', { email, password });
      const body = await r.json().catch(() => ({}));
      if (!r.ok) return { ok: false, error: body.error || `sync login failed (${r.status})` };
      if (get(K.account) !== email) { del(K.snapshot); del(K.version); } // different account: start fresh
      set(K.token, body.token);
      set(K.account, email);
      this.start();
      this.stopStream();       // token may have changed (different account)
      this.ensureStream();
      await this.syncNow();
      return { ok: true };
    } catch (e: any) {
      return { ok: false, error: 'Cannot reach the server' + (e?.message ? ` (${e.message})` : '') };
    }
  }

  /**
   * Create the account on the server FIRST (registration), so it exists on every device from the start.
   * Never silently falls back: the caller learns whether it was created, already exists, or the server is unreachable.
   */
  async createAccount(emailRaw: string, password: string): Promise<{ ok: boolean; exists?: boolean; network?: boolean; error?: string }> {
    const email = canonicalSyncEmail(emailRaw) || emailRaw.trim().toLowerCase();
    try {
      const r = await this.post('/api/sync/register', { email, password });
      const body = await r.json().catch(() => ({}));
      if (r.status === 409) return { ok: false, exists: true, error: body.error };
      if (!r.ok) return { ok: false, error: body.error || `registration failed (${r.status})` };
      this.held = true; // do not sync until the new profile exists locally (else the placeholder demo user would upload)
      if (get(K.account) !== email) { del(K.snapshot); del(K.version); }
      set(K.token, body.token);
      set(K.account, email);
      this.start();
      return { ok: true };
    } catch (e: any) {
      return { ok: false, network: true, error: e?.message };
    }
  }

  /** Call once the new local profile has been created: starts live sync for the fresh account. */
  release() {
    this.held = false;
    this.stopStream();
    this.ensureStream();
    void this.syncNow();
  }

  /** What the server says about itself (null = unreachable). */
  async health(): Promise<{ build: string; storage: string; accounts: number } | null> {
    try {
      const r = await fetch('/api/sync/health', { cache: 'no-store' });
      if (!r.ok) return null;
      const j = await r.json();
      return j && typeof j.build === 'string' ? j : null;
    } catch { return null; }
  }

  /** Forget the account on this device (local data stays). Call on logout. */
  unlink() {
    this.stopStream();
    [K.token, K.account, K.version, K.snapshot].forEach(del);
    this.setStatus('off');
  }

  // ---- scheduling ----
  start() {
    if (this.started || typeof window === 'undefined') return;
    this.started = true;
    store.setPersistListener(() => this.schedule(400));
    setInterval(() => { this.syncNow(); this.ensureStream(); }, 15000);
    const wake = () => { this.ensureStream(); this.syncNow(); };
    window.addEventListener('online', wake);
    window.addEventListener('focus', wake);
    document.addEventListener('visibilitychange', () => { if (!document.hidden) wake(); });
    if (this.isLinked()) { this.ensureStream(); this.syncNow(); }
  }

  // ---- live channel ----
  /** Start the live long-poll if this device is linked and it is not already running. */
  private ensureStream() {
    if (typeof window === 'undefined' || !get(K.token) || this.streamAbort) return;
    void this.runStream();
  }

  private stopStream() {
    this.streamAbort?.abort();
    this.streamAbort = null;
    this.streamAlive = false;
  }

  /** Long-poll loop: the server holds each request open until another device changes something, then we pull at once. */
  private async runStream() {
    const token = get(K.token);
    if (!token) return;
    const ctl = new AbortController();
    this.streamAbort = ctl;
    let calm = true;
    try {
      while (!ctl.signal.aborted && get(K.token) === token) {
        const since = Number(get(K.version) || 0);
        const r = await fetch(`/api/sync/wait?since=${since}`, { headers: { Authorization: `Bearer ${token}` }, signal: ctl.signal });
        if (r.status === 401) { this.setStatus('error', 'Sync session expired — log in again to resume sync'); return; }
        if (!r.ok) throw new Error(`wait failed (${r.status})`);
        this.streamAlive = true;
        this.streamRetry = 1000;
        const body = await r.json().catch(() => ({}));
        if (body.changed) {
          await this.syncNow(); // pull + apply
          // If the pull did not move our cursor (e.g. a push still in flight), do not spin.
          if (Number(get(K.version) || 0) <= since) await new Promise((res) => setTimeout(res, 2000));
        }
        calm = true;
      }
    } catch (e: any) {
      calm = false;
      if (e?.name === 'AbortError') return;
    } finally {
      this.streamAlive = false;
      if (this.streamAbort === ctl) {
        this.streamAbort = null;
        if (get(K.token) && !calm) {
          const wait = this.streamRetry;
          this.streamRetry = Math.min(this.streamRetry * 2, 30000);
          setTimeout(() => this.ensureStream(), wait);
        } else if (get(K.token)) {
          setTimeout(() => this.ensureStream(), 1000);
        }
      }
    }
  }

  private schedule(ms: number) {
    if (!this.isLinked()) return;
    if (this.timer) clearTimeout(this.timer);
    this.timer = setTimeout(() => { this.timer = null; this.syncNow(); }, ms);
  }

  // ---- the sync cycle ----
  /** Run one sync cycle. If one is already running, wait for it (callers can rely on the data being applied). */
  syncNow(): Promise<void> {
    if (!get(K.token) || this.held) return Promise.resolve();
    if (this.inflight) { this.again = true; return this.inflight; }
    this.inflight = this.cycle().finally(() => {
      this.inflight = null;
      if (this.again) { this.again = false; this.schedule(500); }
    });
    return this.inflight;
  }

  private async cycle(): Promise<void> {
    const token = get(K.token);
    if (!token) return;
    this.setStatus('syncing');
    try {
      const firstTime = get(K.snapshot) === null;
      if (firstTime) await this.initialSync(token);
      else { await this.pushLocal(token); await this.pullRemote(token); }
      this.lastSyncAt = new Date().toISOString();
      this.setStatus('idle');
    } catch (e: any) {
      if (e?.auth) this.setStatus('error', 'Sync session expired — log in again to resume sync');
      else this.setStatus('offline', e?.message || '');
    }
  }

  private async initialSync(token: string) {
    // 1. Server wins for documents it already has (fresh device picks up the account's data).
    const snap: Snapshot = {};
    await this.pullAll(token, 0, (docs) => {
      const changes = docs.map((d: any) => ({ key: d.key, value: d.deleted ? null : d.value }));
      store.applySyncDocs(changes);
      for (const d of docs) { if (d.deleted) delete snap[d.key]; else snap[d.key] = hashDoc(d.value); }
    });
    // 2. Documents that only exist here: upload the ones that belong to the signed-in user,
    //    remember (but do not upload) the rest so another user's leftovers never leak.
    const scope = store.getSyncScope();
    const local = store.getSyncDocs();
    const up: { key: string; value: any }[] = [];
    for (const [key, value] of Object.entries(local)) {
      if (snap[key] !== undefined) continue;
      if (inScope(key, value, scope)) up.push({ key, value });
      snap[key] = hashDoc(value);
    }
    await this.pushChanges(token, up);
    set(K.snapshot, JSON.stringify(snap));
    this.notifyApplied();
  }

  private async pushLocal(token: string) {
    const snap: Snapshot = JSON.parse(get(K.snapshot) || '{}');
    const local = store.getSyncDocs();
    const changes: { key: string; value: any }[] = [];
    const nextSnap: Snapshot = { ...snap };
    for (const [key, value] of Object.entries(local)) {
      const h = hashDoc(value);
      if (snap[key] !== h) { changes.push({ key, value }); nextSnap[key] = h; }
    }
    for (const key of Object.keys(snap)) {
      if (!(key in local)) { changes.push({ key, value: null }); delete nextSnap[key]; }
    }
    if (!changes.length) return;
    await this.pushChanges(token, changes);
    set(K.snapshot, JSON.stringify(nextSnap)); // only after the server accepted them
  }

  private async pushChanges(token: string, changes: { key: string; value: any }[]) {
    for (let i = 0; i < changes.length; i += 200) {
      const r = await this.post('/api/sync/push', { client_id: this.clientId(), changes: changes.slice(i, i + 200) }, token);
      if (r.status === 401) throw Object.assign(new Error('auth'), { auth: true });
      if (!r.ok) throw new Error(`push failed (${r.status})`);
    }
  }

  private async pullRemote(token: string) {
    const snap: Snapshot = JSON.parse(get(K.snapshot) || '{}');
    const since = Number(get(K.version) || 0);
    const me = this.clientId();
    let applied = 0;
    await this.pullAll(token, since, (docs) => {
      const local = store.getSyncDocs();
      const changes: { key: string; value: any }[] = [];
      for (const d of docs) {
        if (d.by === me) continue;                       // our own push echoing back
        const lh = d.key in local ? hashDoc(local[d.key]) : undefined;
        if (lh !== snap[d.key]) continue;                // edited locally since last sync: local wins, pushed next cycle
        changes.push({ key: d.key, value: d.deleted ? null : d.value });
        if (d.deleted) delete snap[d.key]; else snap[d.key] = hashDoc(d.value);
      }
      if (changes.length) { store.applySyncDocs(changes); applied += changes.length; }
    }, (v) => set(K.version, String(v)));
    set(K.snapshot, JSON.stringify(snap));
    if (applied) this.notifyApplied();
  }

  private async pullAll(token: string, since: number, onPage: (docs: any[]) => void, onVersion?: (v: number) => void) {
    let cursor = since;
    for (let guard = 0; guard < 1000; guard++) {
      const r = await fetch(`/api/sync/pull?since=${cursor}`, { headers: { Authorization: `Bearer ${token}` } });
      if (r.status === 401) throw Object.assign(new Error('auth'), { auth: true });
      if (!r.ok) throw new Error(`pull failed (${r.status})`);
      const page = await r.json();
      onPage(page.docs || []);
      cursor = page.version;
      (onVersion || ((v) => set(K.version, String(v))))(cursor);
      if (!page.more) break;
    }
  }

  private notifyApplied() {
    if (typeof window !== 'undefined') window.dispatchEvent(new Event('mastmeals:synced'));
  }

  private post(url: string, body: unknown, token?: string) {
    return fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: JSON.stringify(body),
    });
  }
}

export const syncClient = new SyncClient();
