import React, { useEffect, useState } from 'react';
import { syncClient } from '../services/syncClient';
import { store } from '../services/store';

/** Small cloud-sync indicator. Tap = sync now; when sync is off, tap opens a form to link this device. */
export const SyncStatusBadge: React.FC<{ isHindi?: boolean }> = ({ isHindi }) => {
  const [, force] = useState(0);
  const [open, setOpen] = useState(false);
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  useEffect(() => syncClient.subscribe(() => force((n) => n + 1)), []);
  const { status, account, error, lastSyncAt } = syncClient.getInfo();

  const label: Record<string, string> = isHindi
    ? { off: 'सिंक बंद — टैप करें', idle: 'सिंक हो गया', syncing: 'सिंक हो रहा है…', offline: 'ऑफ़लाइन — बाद में सिंक होगा', error: 'सिंक त्रुटि' }
    : { off: 'Sync off — tap to link', idle: 'Synced', syncing: 'Syncing…', offline: 'Offline — will sync later', error: 'Sync error' };
  const dot: Record<string, string> = {
    off: 'bg-[#9aa09a]', idle: 'bg-[#137333]', syncing: 'bg-[#d97706] animate-pulse', offline: 'bg-[#d97706]', error: 'bg-[#b91c1c]',
  };

  const email = store.getMe().user?.email || '';

  const link = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!password || busy) return;
    setBusy(true);
    setMsg('');
    const r = await syncClient.connect(email, password, true);
    setBusy(false);
    if (r.ok) { setOpen(false); setPassword(''); return; }
    setMsg(
      /wrong password/i.test(r.error || '')
        ? (isHindi ? 'इस ईमेल का सिंक खाता पहले से है, पर पासवर्ड अलग है। जिस पासवर्ड से वह बनाया था वही डालें।' : 'A sync account already exists for this email with a different password. Enter the password you used when you first created it.')
        : r.error || (isHindi ? 'लिंक नहीं हो सका' : 'Could not link')
    );
  };

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => (status === 'off' ? setOpen((o) => !o) : syncClient.syncNow())}
        title={error || (lastSyncAt ? `Last synced ${new Date(lastSyncAt).toLocaleTimeString()}` : 'Tap to sync now')}
        className="flex items-center gap-2 px-3 py-1.5 rounded-full border border-[#E6E4DD] bg-white text-[11.5px] font-semibold text-[#1A3826] cursor-pointer"
      >
        <span className={`w-2 h-2 rounded-full ${dot[status]}`} />
        <span>{label[status]}</span>
        {account && status !== 'off' && <span className="text-[#727972] font-normal truncate max-w-[140px]">{account}</span>}
      </button>

      {open && status === 'off' && (
        <form onSubmit={link} className="absolute z-50 mt-2 w-72 p-3 rounded-2xl border border-[#E6E4DD] bg-white shadow-lg flex flex-col gap-2">
          <div className="text-[12px] text-[#1A3826] font-semibold break-all">{email}</div>
          <input
            type="password"
            autoFocus
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder={isHindi ? 'अपना पासवर्ड डालें' : 'Enter your password'}
            className="w-full px-3 py-2 rounded-xl border border-[#E6E4DD] text-[13px] outline-none"
          />
          {msg && <div className="text-[11.5px] text-[#b91c1c]">{msg}</div>}
          <button
            type="submit"
            disabled={busy || !password}
            className="py-2 rounded-xl bg-[#1A3826] text-white text-[12.5px] font-bold disabled:opacity-60 cursor-pointer"
          >
            {busy ? (isHindi ? 'लिंक हो रहा है…' : 'Linking…') : (isHindi ? 'इस डिवाइस को सिंक से जोड़ें' : 'Link this device to sync')}
          </button>
        </form>
      )}
    </div>
  );
};
