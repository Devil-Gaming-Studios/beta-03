/**
 * Cross-device sync client. Keeps this browser/app's local state (store.ts) and the server
 * account store (server/syncService.ts) in step:
 *   - every local change is debounced, diffed against the last-synced snapshot and pushed;
 *   - every 15 s, on focus and when the network returns, remote changes are pulled and applied;
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
    const v = identifier.trim().toLowerCase();
    if (v.includes('@')) return v;
    const digits = v.replace(/[^0-9]/g, '');
    return digits.length >= 7 ? `${digits}@mobile.mastmeals` : null;
  }

  // ---- account ----
  /** Sign in to the sync account, creating it if allowed and it does not exist yet. */
  async connect(email: string, password: string, allowCreate: boolean): Promise<{ ok: boolean; error?: string }> {
    try {
      let r = await this.post('/api/sync/login', { email, password });
      if (r.status === 404 && allowCreate) r = await this.post('/api/sync/register', { email, password });
      const body = await r.json().catch(() => ({}));
      if (!r.ok) return { ok: false, error: body.error || `sync login failed (${r.status})` };
      if (get(K.account) !== email) { del(K.snapshot); del(K.version); } // different account: start fresh
      set(K.token, body.token);
      set(K.account, email);
      this.start();
      this.openStream();
      await this.syncNow();
      return { ok: true };
    } catch (e: any) {
      return { ok: false, error: 'Cannot reach the server' + (e?.message ? ` (${e.message})` : '') };
    }
  }

  /** Forget the account on this device (local data stays). Call on logout. */
  unlink() {
    this.streamAbort?.abort();
    this.streamAbort = null;
    [K.token, K.account, K.version, K.snapshot].forEach(del);
    this.setStatus('off');
  }

  // ---- scheduling ----
  start() {
    if (this.started || typeof window === 'undefined') return;
    this.started = true;
    store.setPersistListener(() => this.schedule(1500));
    setInterval(() => this.syncNow(), Number((globalThis as any).__SYNC_POLL_MS) || 8000); // safety net; the live stream below normally delivers changes instantly
    window.addEventListener('online', () => this.syncNow());
    window.addEventListener('focus', () => this.syncNow());
    document.addEventListener('visibilitychange', () => { if (!document.hidden) this.syncNow(); });
    if (this.isLinked()) { this.syncNow(); this.openStream(); }
  }

  /** Live channel: the server tells us the moment another device pushes, and we pull right away. */
  private openStream() {
    if (this.streamAbort || !get(K.token) || typeof fetch === 'undefined') return;
    const ctrl = new AbortController();
    this.streamAbort = ctrl;
    (async () => {
      while (!ctrl.signal.aborted) {
        try {
          const token = get(K.token);
          if (!token) break;
          const r = await fetch('/api/sync/stream', { headers: { Authorization: `Bearer ${token}` }, signal: ctrl.signal });
          if (r.status === 401) break;
          if (!r.ok || !r.body) throw new Error('stream failed');
          const reader = r.body.getReader();
          const dec = new TextDecoder();
          for (;;) {
            const { value, done } = await reader.read();
            if (done) break;
            if (dec.decode(value, { stream: true }).includes('event: changed')) this.syncNow();
          }
        } catch {
          // network drop: retry below
        }
        if (!ctrl.signal.aborted) await new Promise((res) => setTimeout(res, 3000));
      }
      if (this.streamAbort === ctrl) this.streamAbort = null;
    })();
  }

  private schedule(ms: number) {
    if (!this.isLinked()) return;
    if (this.timer) clearTimeout(this.timer);
    this.timer = setTimeout(() => { this.timer = null; this.syncNow(); }, ms);
  }

  // ---- the sync cycle ----
  /** Run one sync cycle. If one is already running, wait for it (callers can rely on the data being applied). */
  syncNow(): Promise<void> {
    if (!get(K.token)) return Promise.resolve();
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
    // 1b. This device may have created its own local user before linking; use the account's user instead.
    const email = (get(K.account) || '').toLowerCase();
    const docs = store.getSyncDocs();
    const accountUserId = Object.keys(snap)
      .filter((k) => k.startsWith('users/'))
      .map((k) => k.slice('users/'.length))
      .find((id) => String(docs[`users/${id}`]?.email || '').toLowerCase() === email);
    if (accountUserId && store.getSyncScope().userId !== accountUserId) store.adoptSyncedUser(accountUserId);
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
