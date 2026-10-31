import React, { useEffect, useState } from 'react';
import { syncClient } from '../services/syncClient';

/** Small cloud-sync indicator with a manual "Sync now" tap. */
export const SyncStatusBadge: React.FC<{ isHindi?: boolean }> = ({ isHindi }) => {
  const [, force] = useState(0);
  useEffect(() => syncClient.subscribe(() => force((n) => n + 1)), []);
  const { status, account, error, lastSyncAt } = syncClient.getInfo();

  const label: Record<string, string> = isHindi
    ? { off: 'सिंक बंद', idle: 'सिंक हो गया', syncing: 'सिंक हो रहा है…', offline: 'ऑफ़लाइन — बाद में सिंक होगा', error: 'सिंक त्रुटि' }
    : { off: 'Sync off (log in to enable)', idle: 'Synced', syncing: 'Syncing…', offline: 'Offline — will sync later', error: 'Sync error' };
  const dot: Record<string, string> = {
    off: 'bg-[#9aa09a]', idle: 'bg-[#137333]', syncing: 'bg-[#d97706] animate-pulse', offline: 'bg-[#d97706]', error: 'bg-[#b91c1c]',
  };

  return (
    <button
      type="button"
      onClick={() => syncClient.syncNow()}
      title={error || (lastSyncAt ? `Last synced ${new Date(lastSyncAt).toLocaleTimeString()}` : 'Tap to sync now')}
      className="flex items-center gap-2 px-3 py-1.5 rounded-full border border-[#E6E4DD] bg-white text-[11.5px] font-semibold text-[#1A3826] cursor-pointer"
    >
      <span className={`w-2 h-2 rounded-full ${dot[status]}`} />
      <span>{label[status]}</span>
      {account && status !== 'off' && <span className="text-[#727972] font-normal truncate max-w-[140px]">{account}</span>}
    </button>
  );
};
