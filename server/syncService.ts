/**
 * Cross-device sync store.
 *
 * Each account (email + password, scrypt-hashed) owns a set of small JSON "documents"
 * (one per stock item, plan week, order, ...). Clients push changed documents and pull
 * documents that changed since a version number. Deletes are tombstones. Persisted to a
 * JSON file under .data/ (swap for a real DB later without changing the API).
 */
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import type { SyncStore, PgBatch } from './syncPg';

interface Account { id: string; email: string; salt: string; hash: string; created_at: string }
interface Doc { key: string; value: unknown; deleted: boolean; version: number; by: string; updated_at: string }
interface Db {
  secret: string;
  accounts: Record<string, Account>;                 // by account id
  docs: Record<string, Record<string, Doc>>;         // account id -> key -> doc
  versions: Record<string, number>;                  // account id -> latest version
}

export interface PushChange { key: string; value: unknown | null }

const FILE = path.resolve(process.cwd(), process.env.SYNC_DB_FILE || '.data/sync-db.json');
const TOKEN_TTL_MS = 30 * 24 * 3600 * 1000;
const KEY_RE = /^[A-Za-z0-9_\-:.@/ ]{1,200}$/;
const MAX_CHANGES = 500;
// Minimum sync-account password length. The app itself accepts short passwords, so this must not be stricter
// or accounts get created on the phone but silently never on the server. Raise it (SYNC_MIN_PASSWORD=8) for real use.
const minPassword = () => Math.max(1, Number(process.env.SYNC_MIN_PASSWORD) || 3);
const MAX_DOC_BYTES = 6 * 1024 * 1024;

function load(): Db {
  try {
    const db = JSON.parse(fs.readFileSync(FILE, 'utf-8')) as Db;
    if (db && db.secret) return db;
  } catch { /* first run */ }
  return { secret: crypto.randomBytes(32).toString('hex'), accounts: {}, docs: {}, versions: {} };
}

let db = load();
let saveTimer: NodeJS.Timeout | null = null;

/** Bumped whenever the sync protocol changes; shown on the login screen so you can see which code a device is running. */
export const SYNC_BUILD = 'r5';

export function stats() {
  return { build: SYNC_BUILD, storage: store ? 'postgres' : 'file', accounts: Object.keys(db.accounts).length, min_password: minPassword() };
}

// ---- persistence ----
// File mode (default): the whole db is written to .data/sync-db.json.
// Postgres mode (DATABASE_URL set): changes are tracked and written through to Postgres in flush().
let store: SyncStore | null = null;
const dirtyAccounts = new Set<string>();
const dirtyDocs = new Map<string, Set<string>>();
let flushChain: Promise<void> = Promise.resolve();

function markAccount(id: string) { if (store) dirtyAccounts.add(id); }
function markDoc(id: string, key: string) {
  if (!store) return;
  let s = dirtyDocs.get(id);
  if (!s) { s = new Set(); dirtyDocs.set(id, s); }
  s.add(key);
}

function writeNow() {
  try {
    fs.mkdirSync(path.dirname(FILE), { recursive: true });
    const tmp = FILE + '.tmp';
    fs.writeFileSync(tmp, JSON.stringify(db));
    fs.renameSync(tmp, FILE);
  } catch (e) {
    console.error('[sync] could not persist db:', (e as Error).message);
  }
}

function save() {
  if (store || saveTimer) return;
  saveTimer = setTimeout(() => { saveTimer = null; writeNow(); }, 300);
}

/** Write to disk before returning (used for new accounts, so a crash right after sign-up cannot lose them). */
function saveNow() {
  if (store) return; // Postgres mode: durability comes from flush()
  if (saveTimer) { clearTimeout(saveTimer); saveTimer = null; }
  writeNow();
}

/**
 * Make everything accepted so far durable. Routes await this before answering, so a client only
 * treats a change as synced once it is stored. Rejects if Postgres is unreachable (client retries).
 */
export function flush(): Promise<void> {
  if (!store) { saveNow(); return Promise.resolve(); }
  const run = async () => {
    if (!dirtyAccounts.size && !dirtyDocs.size) return;
    const accIds = new Set([...dirtyAccounts, ...dirtyDocs.keys()]);
    const docKeys = new Map(dirtyDocs);
    dirtyAccounts.clear(); dirtyDocs.clear();
    const batch: PgBatch = { accounts: [], docs: [] };
    for (const id of accIds) {
      if (db.accounts[id]) batch.accounts.push({ account: db.accounts[id], version: db.versions[id] || 0 });
    }
    for (const [id, keys] of docKeys) {
      const docs = [...keys].map((k) => db.docs[id]?.[k]).filter(Boolean) as any[];
      if (docs.length) batch.docs.push({ accountId: id, docs });
    }
    try {
      await store!.save(batch);
    } catch (e) {
      for (const id of accIds) dirtyAccounts.add(id);   // keep for the next attempt
      for (const [id, keys] of docKeys) for (const k of keys) markDoc(id, k);
      throw e;
    }
  };
  const next = flushChain.then(run, run);
  flushChain = next.catch(() => {});
  return next;
}

/**
 * Call once before accepting requests. With DATABASE_URL set, loads state from Postgres (creating the
 * tables if needed) and persists there from then on; accounts that so far only existed in the JSON file
 * are copied over the first time. Throws if Postgres is configured but unusable.
 */
export async function init(override?: SyncStore): Promise<'postgres' | 'file'> {
  const url = (process.env.DATABASE_URL || '').trim();
  if (!override && !url) return 'file';
  const backend = override ?? (await (await import('./syncPg')).openPostgres(url));
  const loaded = await backend.load(db.secret);
  if (!Object.keys(loaded.accounts).length && Object.keys(db.accounts).length) {
    // First run on Postgres: keep what the JSON file had (and its signing secret, so tokens stay valid).
    await backend.setSecret(db.secret);
    store = backend;
    for (const id of Object.keys(db.accounts)) {
      markAccount(id);
      for (const k of Object.keys(db.docs[id] || {})) markDoc(id, k);
    }
    await flush();
    console.log(`[sync] copied ${Object.keys(db.accounts).length} account(s) from the JSON file into Postgres`);
  } else {
    db = loaded;
    store = backend;
  }
  return 'postgres';
}

const secret = () => process.env.SYNC_SECRET || db.secret;

// ---- live change notifications (Server-Sent Events) ----
// Every connected device of an account is registered here; a push by one device wakes all the others.
export type ChangeEvent = { version: number; by: string; applied: number };
const subscribers = new Map<string, Set<(e: ChangeEvent) => void>>();

export function subscribe(accountId: string, fn: (e: ChangeEvent) => void): () => void {
  let set = subscribers.get(accountId);
  if (!set) { set = new Set(); subscribers.set(accountId, set); }
  set.add(fn);
  return () => {
    const cur = subscribers.get(accountId);
    if (!cur) return;
    cur.delete(fn);
    if (!cur.size) subscribers.delete(accountId);
  };
}

function notify(accountId: string, e: ChangeEvent) {
  for (const fn of subscribers.get(accountId) || []) {
    try { fn(e); } catch { /* a dead connection must never break a push */ }
  }
}

export function currentVersion(accountId: string): number {
  return db.versions[accountId] || 0;
}

function normEmail(email: unknown): string {
  return String(email || '').trim().toLowerCase();
}

function hashPassword(password: string, salt: string): string {
  return crypto.scryptSync(password, salt, 32).toString('hex');
}

function sign(payload: string): string {
  return crypto.createHmac('sha256', secret()).update(payload).digest('base64url');
}

export function issueToken(accountId: string): string {
  const payload = Buffer.from(JSON.stringify({ a: accountId, exp: Date.now() + TOKEN_TTL_MS })).toString('base64url');
  return `${payload}.${sign(payload)}`;
}

export function verifyToken(token: string | undefined): string | null {
  if (!token) return null;
  const [payload, sig] = token.split('.');
  if (!payload || !sig) return null;
  const expected = sign(payload);
  const a = Buffer.from(sig), b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  try {
    const { a: accountId, exp } = JSON.parse(Buffer.from(payload, 'base64url').toString());
    if (typeof accountId !== 'string' || typeof exp !== 'number' || exp < Date.now()) return null;
    return db.accounts[accountId] ? accountId : null;
  } catch {
    return null;
  }
}

// Simple in-memory brute-force limiter: 10 failed logins / 15 min per email.
const failures = new Map<string, { n: number; first: number }>();
function tooMany(email: string): boolean {
  const f = failures.get(email);
  if (!f) return false;
  if (Date.now() - f.first > 15 * 60 * 1000) { failures.delete(email); return false; }
  return f.n >= 10;
}
function recordFailure(email: string) {
  const f = failures.get(email);
  if (!f || Date.now() - f.first > 15 * 60 * 1000) failures.set(email, { n: 1, first: Date.now() });
  else f.n++;
}

export type AuthResult =
  | { ok: true; token: string; account: string; created: boolean }
  | { ok: false; status: number; error: string };

export function register(emailRaw: unknown, password: unknown): AuthResult {
  const email = normEmail(emailRaw);
  if (!email || email.length > 200) return { ok: false, status: 400, error: 'email required' };
  if (typeof password !== 'string' || password.length < minPassword() || password.length > 200) {
    return { ok: false, status: 400, error: `password must be ${minPassword()}-200 characters` };
  }
  if (Object.values(db.accounts).some((a) => a.email === email)) {
    return { ok: false, status: 409, error: 'account already exists' };
  }
  const id = 'acc_' + crypto.randomBytes(8).toString('hex');
  const salt = crypto.randomBytes(16).toString('hex');
  db.accounts[id] = { id, email, salt, hash: hashPassword(password, salt), created_at: new Date().toISOString() };
  db.docs[id] = {};
  db.versions[id] = 0;
  markAccount(id);
  saveNow();
  return { ok: true, token: issueToken(id), account: email, created: true };
}

export function login(emailRaw: unknown, password: unknown): AuthResult {
  const email = normEmail(emailRaw);
  if (tooMany(email)) return { ok: false, status: 429, error: 'too many attempts, try later' };
  const acc = Object.values(db.accounts).find((a) => a.email === email);
  if (!acc) return { ok: false, status: 404, error: 'no sync account for this email' };
  const given = Buffer.from(hashPassword(String(password ?? ''), acc.salt));
  const want = Buffer.from(acc.hash);
  if (given.length !== want.length || !crypto.timingSafeEqual(given, want)) {
    recordFailure(email);
    return { ok: false, status: 401, error: 'wrong password' };
  }
  failures.delete(email);
  return { ok: true, token: issueToken(acc.id), account: email, created: false };
}

export function push(accountId: string, clientId: string, changes: unknown):
  { ok: true; version: number; applied: number } | { ok: false; status: number; error: string } {
  if (!Array.isArray(changes) || changes.length > MAX_CHANGES) {
    return { ok: false, status: 400, error: `changes must be an array of at most ${MAX_CHANGES}` };
  }
  const docs = (db.docs[accountId] ||= {});
  let version = db.versions[accountId] || 0;
  let applied = 0;
  for (const raw of changes) {
    const c = raw as PushChange;
    if (!c || typeof c.key !== 'string' || !KEY_RE.test(c.key) || c.key.includes('__proto__')) continue;
    const deleted = c.value === null || c.value === undefined;
    if (!deleted && JSON.stringify(c.value).length > MAX_DOC_BYTES) continue;
    version += 1;
    markDoc(accountId, c.key);
    docs[c.key] = {
      key: c.key, value: deleted ? null : c.value, deleted, version,
      by: String(clientId || '').slice(0, 64), updated_at: new Date().toISOString(),
    };
    applied++;
  }
  db.versions[accountId] = version;
  if (applied) {
    markAccount(accountId);
    save();
    notify(accountId, { version, by: String(clientId || '').slice(0, 64), applied });
  }
  return { ok: true, version, applied };
}

export function pull(accountId: string, since: number, limit = 300) {
  const docs = Object.values(db.docs[accountId] || {})
    .filter((d) => d.version > since)
    .sort((a, b) => a.version - b.version);
  const page = docs.slice(0, limit);
  const latest = page.length ? page[page.length - 1].version : since;
  return {
    version: latest,
    server_version: db.versions[accountId] || 0,
    more: docs.length > page.length,
    docs: page.map((d) => ({ key: d.key, value: d.deleted ? null : d.value, deleted: d.deleted, version: d.version, by: d.by })),
  };
}

/** test helper */
export function _resetForTests() {
  db = { secret: crypto.randomBytes(32).toString('hex'), accounts: {}, docs: {}, versions: {} };
}
