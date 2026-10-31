/**
 * Utility to detect and interact with the Mast Meals native Android shell.
 */
export const isNativeAndroidApp = (): boolean => {
  if (typeof window === 'undefined') return false;
  return (
    Boolean((window as any).AndroidNative) ||
    Boolean((window as any).AndroidBridge) ||
    navigator.userAgent.includes('MastMealsNative')
  );
};

export const shareNative = async (text: string, title: string = 'Mast Meals'): Promise<boolean> => {
  if (typeof window !== 'undefined' && (window as any).AndroidNative?.shareText) {
    try {
      (window as any).AndroidNative.shareText(text, title);
      return true;
    } catch (e) {
      console.warn('Native share error, falling back to Web API', e);
    }
  }

  if (typeof navigator !== 'undefined' && navigator.share) {
    try {
      await navigator.share({ title, text });
      return true;
    } catch {
      // User dismissed or share failed
      return false;
    }
  }

  // Fallback to clipboard
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
};

export const vibrateNative = (durationMs: number = 200): void => {
  if (typeof window !== 'undefined' && (window as any).AndroidNative?.vibrate) {
    try {
      (window as any).AndroidNative.vibrate(durationMs);
      return;
    } catch (e) {
      console.warn('Native vibrate error', e);
    }
  }

  if (typeof navigator !== 'undefined' && navigator.vibrate) {
    navigator.vibrate(durationMs);
  }
};

export const openNativeSettings = (): void => {
  if (typeof window !== 'undefined' && (window as any).AndroidNative?.openNativeSettings) {
    try {
      (window as any).AndroidNative.openNativeSettings();
    } catch (e) {
      console.warn('Could not open native settings', e);
    }
  }
};

