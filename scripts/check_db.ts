/**
 * Checks the Postgres connection used for sync storage.  Usage:  npm run check:db
 * Reads DATABASE_URL from .env (or the environment), connects, creates the sync tables if missing and
 * prints how much is stored. Never prints the password.
 */
import fs from 'fs';
import path from 'path';
import { openPostgres } from '../server/syncPg';

try {
  const envPath = path.resolve(process.cwd(), '.env');
  if (fs.existsSync(envPath)) {
    for (const line of fs.readFileSync(envPath, 'utf-8').split(/\r?\n/)) {
      const t = line.trim();
      if (!t || t.startsWith('#')) continue;
      const i = t.indexOf('=');
      if (i === -1) continue;
      const k = t.slice(0, i).trim(), v = t.slice(i + 1).split('#')[0].trim();
      if (k && v && !process.env[k]) process.env[k] = v;
    }
  }
} catch { /* ignore */ }

const url = (process.env.DATABASE_URL || '').trim();
if (!url) {
  console.error('DATABASE_URL is empty. Put your Postgres connection string in .env (see .env.example).');
  process.exit(1);
}
let shown = url;
try { const u = new URL(url); shown = `${u.protocol}//${u.username}:***@${u.host}${u.pathname}`; } catch { /* keep */ }
console.log('Connecting to', shown);

try {
  const store = await openPostgres(url);
  const s = await store.load('unused-' + Date.now());
  const docs = Object.values(s.docs).reduce((n, d) => n + Object.keys(d).length, 0);
  console.log(`OK — connected. Sync tables ready: ${Object.keys(s.accounts).length} account(s), ${docs} document(s).`);
  await store.close?.();
  process.exit(0);
} catch (e: any) {
  console.error('FAILED:', e?.message || e);
  if (/ENOTFOUND|EAI_AGAIN|ENETUNREACH|ETIMEDOUT|EHOSTUNREACH/.test(String(e?.code || '') + String(e?.message || ''))) console.error('Hint: if the host looks like db.<project>.supabase.co, that address is IPv6-only and many home networks cannot reach it. Use the "Session pooler" string from Supabase > Connect (host ends in pooler.supabase.com, user is postgres.<project-ref>).');
  if (/ECONNREFUSED/.test(String(e?.code || e))) console.error('Hint: nothing is listening at that host/port.');
  if (/password authentication/i.test(String(e?.message))) console.error('Hint: wrong user or password in DATABASE_URL (encode special characters, e.g. # as %23, @ as %40).');
  process.exit(1);
}
