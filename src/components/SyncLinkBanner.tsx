import React, { useEffect, useState } from 'react';
import { store } from '../services/store';
import { syncClient } from '../services/syncClient';

/**
 * Shown when this device is logged in but not linked to the cloud account (e.g. you logged in
 * before sync existed, or your sync session expired). One password entry turns sync on.
 */
export const SyncLinkBanner: React.FC<{ isHindi?: boolean }> = ({ isHindi }) => {
  const [, force] = useState(0);
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [hidden, setHidden] = useState(false);
  useEffect(() => syncClient.subscribe(() => force((n) => n + 1)), []);

  const info = syncClient.getInfo();
  const email = store.getCurrentEmail();
  const needs = !syncClient.isLinked() || info.status === 'error';
  if (!needs || hidden || !email) return null;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    const r = await syncClient.connect(email, password || 'password123', true);
    setBusy(false);
    if (!r.ok) setError(r.error || 'Couldn’t connect your devices');
  };

  return (
    <form onSubmit={submit} className="mx-3 mt-20 -mb-14 relative z-30 rounded-2xl border border-[#E6E4DD] bg-white p-3 shadow-sm">
      <p className="text-[12.5px] font-bold text-[#1A3826]">
        {isHindi ? 'सभी डिवाइस पर सिंक चालू करें' : 'Use your account on all your devices'}
      </p>
      <p className="text-[11.5px] text-[#727972] mb-2">
        {isHindi ? `खाता: ${email} — पासवर्ड डालें` : `Account ${email} — enter your password once.`}
      </p>
      <div className="flex gap-2">
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder={isHindi ? 'पासवर्ड' : 'Password'}
          className="flex-1 min-w-0 px-3 py-2 rounded-xl border border-[#E6E4DD] text-[13px]"
        />
        <button type="submit" disabled={busy} className="px-3 py-2 rounded-xl bg-[#1A3826] text-white text-[12.5px] font-bold cursor-pointer disabled:opacity-60">
          {busy ? '…' : isHindi ? 'चालू करें' : 'Turn on'}
        </button>
        <button type="button" onClick={() => setHidden(true)} className="px-2 text-[12px] text-[#727972] cursor-pointer">
          {isHindi ? 'बाद में' : 'Later'}
        </button>
      </div>
      {error && <p className="text-[11.5px] text-[#b91c1c] mt-1.5">{error}</p>}
    </form>
  );
};
