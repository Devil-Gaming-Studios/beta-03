/**
 * Simulated phone/browser used by scripts/test_sync.sh. Each device has its own fake
 * localStorage (a JSON file) and runs the REAL store + syncClient against a live server.
 * Usage: tsx scripts/sync_device.ts <deviceDir> <command> [args...]
 */
import fs from 'fs';
import path from 'path';

const dir = process.argv[2];
const cmd = process.argv[3];
const args = process.argv.slice(4);
const BASE = process.env.BASE || 'http://127.0.0.1:3111';
fs.mkdirSync(dir, { recursive: true });
const file = path.join(dir, 'localStorage.json');
let mem: Record<string, string> = fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf-8')) : {};
const flush = () => fs.writeFileSync(file, JSON.stringify(mem));
(globalThis as any).localStorage = {
  getItem: (k: string) => (k in mem ? mem[k] : null),
  setItem: (k: string, v: string) => { mem[k] = String(v); flush(); },
  removeItem: (k: string) => { delete mem[k]; flush(); },
};
const listeners: Record<string, Function[]> = {};
(globalThis as any).window = {
  addEventListener: (n: string, f: Function) => (listeners[n] ||= []).push(f),
  dispatchEvent: (e: any) => (listeners[e.type] || []).forEach((f) => f(e)),
};
(globalThis as any).document = { addEventListener() {}, hidden: false };
const realFetch = globalThis.fetch;
(globalThis as any).fetch = (u: any, o: any) => realFetch(String(u).startsWith('/') ? BASE + u : u, o);

const { store } = await import('../src/services/store');
const { syncClient } = await import('../src/services/syncClient');

const names = () => store.getStock('all').map((s) => s.name).sort();
const base = {
  name: 'Asha', emailOrPhone: 'asha@example.com', password: 'secret123', householdName: 'Asha Kitchen',
  householdType: 'bachelor_flat' as const, diet_pref: 'veg' as const, is_beginner_cook: true, diet_goals: ['protein_rich' as const],
  preferred_regions: ['North Indian'], has_fridge: true, equipment: ['stove' as const], age_group: 'adult' as const,
  weight_kg: 60, cautions: [], weekly_variety_schedule: { Mon: 'regular', Tue: 'regular', Wed: 'regular', Thu: 'regular', Fri: 'regular', Sat: 'regular', Sun: 'regular' } as any,
};

if (cmd === 'register') {
  const r = store.registerWithFullProfile(base as any);
  const c = await syncClient.connect(r.user.email, base.password, true);
  console.log(JSON.stringify({ registered: r.success, sync: c, stock: names().length }));
} else if (cmd === 'login') {
  let res = store.login('asha@example.com', 'secret123');
  let linked: any = null;
  if (!res.success) {
    linked = await syncClient.connect('asha@example.com', 'secret123', false);
    if (linked.ok) res = store.login('asha@example.com', 'secret123');
  }
  console.log(JSON.stringify({ err: (res as any).error, loggedIn: res.success, linked, hh: store.getMe().household.name, stock: names().length }));
} else if (cmd === 'add') {
  store.adjustStock('ing_' + args[0], 'add', Number(args[1] || 500), 'shared', 'test', { name: args[0], unit: 'g' } as any);
  console.log('added', args[0]);
} else if (cmd === 'remove') {
  const it = store.getStock('all').find((s) => s.name === args[0]);
  console.log('removed', it ? store.removeStockItem(it.id) : false);
} else if (cmd === 'sync') {
  await syncClient.syncNow();
  console.log(JSON.stringify(syncClient.getInfo()));
} else if (cmd === 'show') {
  console.log(JSON.stringify({ stock: names().filter((n) => /^(ZZ|Mustard)/.test(n)), total: names().length }));
}
await new Promise((r) => setTimeout(r, 2200)); // let the debounced push fire
await syncClient.syncNow();
process.exit(0);
