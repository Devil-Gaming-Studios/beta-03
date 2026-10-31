/**
 * Utility to detect if running inside the Mast Meals native Android shell.
 */
export const isNativeAndroidApp = (): boolean => {
  if (typeof window === 'undefined') return false;
  return (
    Boolean((window as any).AndroidNative) ||
    Boolean((window as any).AndroidBridge) ||
    navigator.userAgent.includes('MastMealsNative')
  );
};
