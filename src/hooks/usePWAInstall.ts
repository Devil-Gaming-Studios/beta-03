import { useEffect, useState } from 'react';

interface BeforeInstallPromptEvent extends Event {
  readonly platforms: string[];
  readonly userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
  prompt(): Promise<void>;
}

export type InstallResult = 'accepted' | 'dismissed' | 'manual_ios' | 'manual_android' | 'manual_desktop';

export interface PWAInstallState {
  canInstall: boolean;
  /** true when the browser gave us its one-tap install prompt */
  canPromptNatively: boolean;
  isInstalled: boolean;
  isIOS: boolean;
  isAndroid: boolean;
  isStandalone: boolean;
  install: () => Promise<InstallResult>;
}

/**
 * The browser fires `beforeinstallprompt` only ONCE, early in page load. If nothing is listening
 * at that moment (e.g. the hook lives in a component that mounts after login) the event is lost
 * and the Install button silently does nothing. So the listener lives at module level, starts as
 * soon as the app bundle loads, and every component reads the same captured event.
 */
let deferred: BeforeInstallPromptEvent | null = null;
let installed = false;
const subscribers = new Set<() => void>();
const emit = () => subscribers.forEach((fn) => fn());

function detectInstalled(): boolean {
  if (typeof window === 'undefined') return false;
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    (window.navigator as unknown as { standalone?: boolean }).standalone === true
  );
}

if (typeof window !== 'undefined') {
  installed = detectInstalled();
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferred = e as BeforeInstallPromptEvent;
    emit();
  });
  window.addEventListener('appinstalled', () => {
    deferred = null;
    installed = true;
    emit();
  });
  const mq = window.matchMedia('(display-mode: standalone)');
  const onMode = (e: MediaQueryListEvent) => { installed = e.matches; emit(); };
  if (mq.addEventListener) mq.addEventListener('change', onMode);
  else mq.addListener(onMode);
}

function platform() {
  if (typeof navigator === 'undefined') return { isIOS: false, isAndroid: false };
  const ua = navigator.userAgent.toLowerCase();
  const isIOS = /iphone|ipad|ipod/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  return { isIOS, isAndroid: /android/.test(ua) };
}

export async function installApp(): Promise<InstallResult> {
  if (deferred) {
    const evt = deferred;
    try {
      await evt.prompt();
      const choice = await evt.userChoice;
      deferred = null; // a prompt event can only be used once
      emit();
      if (choice.outcome === 'accepted') { installed = true; emit(); return 'accepted'; }
      return 'dismissed';
    } catch (err) {
      console.warn('Install prompt error:', err);
    }
  }
  const p = platform();
  if (p.isIOS) return 'manual_ios';
  if (p.isAndroid) return 'manual_android';
  return 'manual_desktop';
}

export function usePWAInstall(): PWAInstallState {
  const [, force] = useState(0);
  useEffect(() => {
    const fn = () => force((n) => n + 1);
    subscribers.add(fn);
    return () => { subscribers.delete(fn); };
  }, []);
  const p = platform();
  return {
    canInstall: !installed,
    canPromptNatively: !!deferred,
    isInstalled: installed,
    isIOS: p.isIOS,
    isAndroid: p.isAndroid,
    isStandalone: installed,
    install: installApp,
  };
}
