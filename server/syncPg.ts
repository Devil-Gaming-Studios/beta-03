/**
 * Postgres persistence for the sync store (server/syncService.ts keeps the working copy in memory and
 * writes every change through to these tables). Used only when DATABASE_URL is set.
 *
 * Tables are created automatically on first start:
 *   sync_meta(k, v)                     signing secret
 *   sync_accounts(id, email, ..., version)
 *   sync_docs(account_id, key, value jsonb, deleted, version, by_client, updated_at)
 */
export interface PgAccount { id: string; email: string; salt: string; hash: string; created_at: string }
export interface PgDoc { key: string; value: unknown; deleted: boolean; version: number; by: string; updated_at: string }
export interface PgState {
  secret: string;
  accounts: Record<string, PgAccount>;
  docs: Record<string, Record<string, PgDoc>>;
  versions: Record<string, number>;
}
export interface PgBatch {
  accounts: { account: PgAccount; version: number }[];
  docs: { accountId: string; docs: PgDoc[] }[];
}
/** What syncService needs from a persistence backend (also lets tests plug in a fake). */
export interface SyncStore {
  load(freshSecret: string): Promise<PgState>;
  setSecret(secret: string): Promise<void>;
  save(batch: PgBatch): Promise<void>;
  close?(): Promise<void>;
}

const SCHEMA = `
CREATE TABLE IF NOT EXISTS sync_meta (k text PRIMARY KEY, v text NOT NULL);
CREATE TABLE IF NOT EXISTS sync_accounts (
  id text PRIMARY KEY, email text UNIQUE NOT NULL, salt text NOT NULL, hash text NOT NULL,
  created_at timestamptz NOT NULL, version bigint NOT NULL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS sync_docs (
  account_id text NOT NULL REFERENCES sync_accounts(id) ON DELETE CASCADE,
  key text NOT NULL, value jsonb, deleted boolean NOT NULL DEFAULT false,
  version bigint NOT NULL, by_client text NOT NULL DEFAULT '', updated_at timestamptz NOT NULL,
  PRIMARY KEY (account_id, key)
);
CREATE INDEX IF NOT EXISTS sync_docs_version_idx ON sync_docs (account_id, version);
-- Supabase exposes every table in "public" through its REST API to anyone holding the publishable key.
-- Row Level Security with no policies blocks that completely; this server connects as the database owner,
-- which is not affected by RLS.
ALTER TABLE sync_meta ENABLE ROW LEVEL SECURITY;
ALTER TABLE sync_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE sync_docs ENABLE ROW LEVEL SECURITY;
`;

/** Build pool options from a postgres:// URL; hosted providers (Neon, Supabase, ...) need TLS. */
function poolConfig(url: string) {
  const u = new URL(url);
  const local = ['localhost', '127.0.0.1', '::1', '[::1]'].includes(u.hostname);
  const sslmode = u.searchParams.get('sslmode');
  const wantSsl = !local && sslmode !== 'disable' ? true : !!sslmode && sslmode !== 'disable';
  u.searchParams.delete('sslmode');
  u.searchParams.delete('channel_binding'); // not supported by the pg driver
  return {
    connectionString: u.toString(),
    ssl: wantSsl ? { rejectUnauthorized: false } : undefined,
    max: 5,
    connectionTimeoutMillis: 10000,
  };
}

export async function openPostgres(url: string): Promise<SyncStore> {
  let pg: any;
  try {
    pg = (await import('pg')).default;
  } catch {
    throw new Error('the "pg" package is not installed — run: npm install');
  }
  const pool = new pg.Pool(poolConfig(url));
  pool.on('error', (e: Error) => console.error('[sync] postgres pool error:', e.message));
  await pool.query('SELECT 1'); // fail fast with a clear error if the database cannot be reached
  await pool.query(SCHEMA);

  return {
    async load(freshSecret) {
      await pool.query('INSERT INTO sync_meta (k, v) VALUES ($1, $2) ON CONFLICT (k) DO NOTHING', ['secret', freshSecret]);
      const secret = (await pool.query('SELECT v FROM sync_meta WHERE k = $1', ['secret'])).rows[0].v as string;
      const state: PgState = { secret, accounts: {}, docs: {}, versions: {} };
      for (const r of (await pool.query('SELECT id, email, salt, hash, created_at, version FROM sync_accounts')).rows) {
        state.accounts[r.id] = { id: r.id, email: r.email, salt: r.salt, hash: r.hash, created_at: new Date(r.created_at).toISOString() };
        state.versions[r.id] = Number(r.version);
        state.docs[r.id] = {};
      }
      for (const r of (await pool.query('SELECT account_id, key, value, deleted, version, by_client, updated_at FROM sync_docs')).rows) {
        (state.docs[r.account_id] ||= {})[r.key] = {
          key: r.key, value: r.deleted ? null : r.value, deleted: r.deleted, version: Number(r.version),
          by: r.by_client, updated_at: new Date(r.updated_at).toISOString(),
        };
      }
      return state;
    },

    async setSecret(secret) {
      await pool.query(
        'INSERT INTO sync_meta (k, v) VALUES ($1, $2) ON CONFLICT (k) DO UPDATE SET v = EXCLUDED.v', ['secret', secret],
      );
    },

    async save(batch) {
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        for (const { account, version } of batch.accounts) {
          await client.query(
            `INSERT INTO sync_accounts (id, email, salt, hash, created_at, version) VALUES ($1,$2,$3,$4,$5,$6)
             ON CONFLICT (id) DO UPDATE SET version = EXCLUDED.version`,
            [account.id, account.email, account.salt, account.hash, account.created_at, version],
          );
        }
        for (const { accountId, docs } of batch.docs) {
          for (let i = 0; i < docs.length; i += 500) {
            const part = docs.slice(i, i + 500);
            await client.query(
              `INSERT INTO sync_docs (account_id, key, value, deleted, version, by_client, updated_at)
               SELECT $1, t.k, t.v::jsonb, t.d, t.ver, t.b, t.ts::timestamptz
               FROM unnest($2::text[], $3::text[], $4::boolean[], $5::bigint[], $6::text[], $7::text[]) AS t(k, v, d, ver, b, ts)
               ON CONFLICT (account_id, key) DO UPDATE SET value = EXCLUDED.value, deleted = EXCLUDED.deleted,
                 version = EXCLUDED.version, by_client = EXCLUDED.by_client, updated_at = EXCLUDED.updated_at`,
              [
                accountId,
                part.map((d) => d.key),
                part.map((d) => (d.deleted ? null : JSON.stringify(d.value))),
                part.map((d) => d.deleted),
                part.map((d) => d.version),
                part.map((d) => d.by || ''),
                part.map((d) => d.updated_at),
              ],
            );
          }
        }
        await client.query('COMMIT');
      } catch (e) {
        await client.query('ROLLBACK').catch(() => {});
        throw e;
      } finally {
        client.release();
      }
    },

    async close() { await pool.end(); },
  };
}
