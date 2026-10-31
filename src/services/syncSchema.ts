/**
 * Maps the nested app state to flat sync "documents" and back. Pure functions, no browser APIs.
 *
 * Document keys:  <collection>/<householdId>/<id>   (per-item docs, so two devices editing
 * different stock items or orders never overwrite each other).
 */
export type SyncScope = { userId: string; householdIds: string[] };

type Shape = 'obj1' | 'obj2' | 'arr1' | 'arr2' | 'scalar2';

const SHAPES: Record<string, Shape> = {
  users: 'obj1',                // users/<userId>
  households: 'obj1',           // households/<hhId>
  pendingActions: 'obj1',
  stock: 'obj2',                // stock/<hh>/<stockId>
  plans: 'obj2',                // plans/<hh>/<weekStart>
  shoppingLists: 'obj2',        // shoppingLists/<hh>/<weekStart> (whole list)
  members: 'arr2',              // members/<hh>/<memberId>
  recipes: 'arr2',
  menuItems: 'arr2',
  orders: 'arr2',
  batches: 'arr2',
  stockReservations: 'arr2',
  stockLedger: 'arr2',
  wastage: 'arr2',
  suppliers: 'arr2',
  purchaseLists: 'arr2',
  intakeLogs: 'arr1',           // intakeLogs/<id>
  communityPosts: 'arr1',
  cloudRole: 'scalar2',         // cloudRole/<hh>
  pureVegOnly: 'scalar2',
};

// Device-local only, never synced: currentUserId, currentHouseholdId, auditLog, syncLog, syncSeq.

export function collections(): string[] {
  return Object.keys(SHAPES);
}

function clean(name: string, value: any) {
  if (name === 'users' && value && typeof value === 'object') {
    const { password, ...rest } = value; // never send passwords to the sync server
    return rest;
  }
  return value;
}

export function flattenState(state: any): Record<string, any> {
  const out: Record<string, any> = {};
  for (const [name, shape] of Object.entries(SHAPES)) {
    const data = state?.[name];
    if (!data) continue;
    if (shape === 'obj1') {
      for (const [id, v] of Object.entries<any>(data)) {
        out[`${name}/${id}`] = clean(name, v);
      }
    } else if (shape === 'obj2') {
      for (const [hh, m] of Object.entries<any>(data)) {
        for (const [id, v] of Object.entries<any>(m || {})) out[`${name}/${hh}/${id}`] = v;
      }
    } else if (shape === 'arr2') {
      for (const [hh, arr] of Object.entries<any>(data)) {
        for (const v of arr || []) if (v && v.id) out[`${name}/${hh}/${v.id}`] = v;
      }
    } else if (shape === 'arr1') {
      for (const v of data as any[]) {
        if (!v || !v.id) continue;
        out[`${name}/${v.id}`] = v;
      }
    } else if (shape === 'scalar2') {
      for (const [hh, v] of Object.entries<any>(data)) {
        out[`${name}/${hh}`] = v;
      }
    }
  }
  return out;
}

/** Apply one document (value null = delete) to the nested state. Returns false if the key is unknown. */
export function applyDoc(state: any, key: string, value: any): boolean {
  const parts = key.split('/');
  const name = parts[0];
  const shape = SHAPES[name];
  if (!shape || parts.some((p) => p === '__proto__' || p === 'constructor' || p === 'prototype')) return false;
  const del = value === null || value === undefined;
  state[name] ||= shape === 'arr1' ? [] : {};

  if (shape === 'obj1') {
    const id = parts.slice(1).join('/');
    if (del) delete state[name][id];
    else {
      const prev = state[name][id];
      state[name][id] = name === 'users' && prev?.password ? { ...value, password: prev.password } : value;
    }
  } else if (shape === 'obj2') {
    const hh = parts[1], id = parts.slice(2).join('/');
    state[name][hh] ||= {};
    if (del) delete state[name][hh][id]; else state[name][hh][id] = value;
  } else if (shape === 'arr2') {
    const hh = parts[1], id = parts.slice(2).join('/');
    const arr: any[] = (state[name][hh] ||= []);
    const i = arr.findIndex((e) => e && e.id === id);
    if (del) { if (i >= 0) arr.splice(i, 1); }
    else if (i >= 0) arr[i] = value; else arr.push(value);
  } else if (shape === 'arr1') {
    const id = parts.slice(1).join('/');
    const arr: any[] = state[name];
    const i = arr.findIndex((e) => e && e.id === id);
    if (del) { if (i >= 0) arr.splice(i, 1); }
    else if (i >= 0) arr[i] = value; else arr.push(value);
  } else {
    const hh = parts[1];
    if (del) delete state[name][hh]; else state[name][hh] = value;
  }
  return true;
}

/** Cheap stable string hash (FNV-1a) so the client can detect changes without storing whole docs. */
export function hashDoc(value: unknown): string {
  const s = JSON.stringify(value);
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193); }
  return (h >>> 0).toString(36) + ':' + s.length;
}

/**
 * Used only when a device first links to an account: which local documents belong to the
 * signed-in user, so a shared phone never uploads a previous user's households.
 */
export function inScope(key: string, value: any, scope: SyncScope): boolean {
  const [name, a] = key.split('/');
  if (name === 'users') return a === scope.userId;
  if (name === 'dietMemory') return a === scope.userId;
  if (name === 'households') return scope.householdIds.includes(a);
  if (name === 'communityPosts') {
    return !!value && (value.author_id === scope.userId || scope.householdIds.includes(value.household_id));
  }
  const shape = SHAPES[name];
  if (shape === 'obj2' || shape === 'arr2' || shape === 'scalar2') return scope.householdIds.includes(a);
  return true;
}
