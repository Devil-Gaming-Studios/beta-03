import React, { useState } from 'react';
import { usePWAInstall } from '../hooks/usePWAInstall';

interface DownloadAppModalProps {
  isOpen: boolean;
  onClose: () => void;
  isHindi: boolean;
}

export const DownloadAppModal: React.FC<DownloadAppModalProps> = ({
  isOpen,
  onClose,
  isHindi,
}) => {
  const { isInstalled, isIOS, install } = usePWAInstall();
  const [installStatus, setInstallStatus] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleInstallClick = async () => {
    const result = await install();
    if (result === 'accepted') {
      setInstallStatus(isHindi ? 'ऐप सफलतापूर्वक इंस्टॉल हो गया!' : 'App installed successfully!');
      setTimeout(() => {
        onClose();
      }, 1500);
    } else if (result === 'manual_ios') {
      setInstallStatus('ios_steps');
    } else if (result === 'manual_desktop') {
      setInstallStatus('desktop_steps');
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
      <div
        aria-modal="true"
        className="bg-[#faf9f6] w-full max-w-md rounded-3xl shadow-2xl border border-[#E6E4DD] overflow-hidden flex flex-col max-h-[90vh]"
        role="dialog"
      >
        {/* Header with App Branding */}
        <div className="bg-[#1A3826] text-white p-5 flex items-start justify-between relative">
          <div className="flex items-center gap-3">
            <img
              alt="KitchenSync Icon"
              className="w-12 h-12 rounded-2xl shadow-md border border-white/20 object-cover bg-white/10"
              src="/icon.svg"
            />
            <div>
              <div className="flex items-center gap-1.5">
                <h3 className="font-bold text-lg leading-tight">Mast Meals</h3>
                <span className="text-[10px] bg-[#d97706] text-white px-1.5 py-0.5 rounded-full font-semibold uppercase tracking-wider">
                  PWA
                </span>
              </div>
              <p className="text-xs text-[#b7e9c3] mt-0.5">KitchenSync Household OS</p>
            </div>
          </div>
          <button
            aria-label="Close"
            className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center transition-colors text-white cursor-pointer"
            type="button"
            onClick={onClose}
          >
            <span className="material-symbols-outlined text-[20px]">close</span>
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-5 overflow-y-auto space-y-4">
          {/* Status banner if already installed */}
          {isInstalled && (
            <div className="p-3 bg-[#e8f5e9] border border-[#a5d6a7] text-[#1b5e20] rounded-xl text-xs flex items-center gap-2">
              <span className="material-symbols-outlined text-[18px]">verified</span>
              <span className="font-medium">
                {isHindi
                  ? 'यह ऐप आपके डिवाइस पर पहले से इंस्टॉल है।'
                  : 'This app is already installed on your device.'}
              </span>
            </div>
          )}

          {/* Value Highlights */}
          <div className="grid grid-cols-3 gap-2 text-center">
            <div className="p-2.5 rounded-2xl bg-white border border-[#E6E4DD]">
              <span className="material-symbols-outlined text-[#1A3826] text-[22px]">offline_bolt</span>
              <p className="text-[11px] font-semibold text-[#1a1c1a] mt-1">
                {isHindi ? 'ऑफलाइन तैयार' : 'Offline Ready'}
              </p>
              <p className="text-[10px] text-[#727972]">No internet needed</p>
            </div>
            <div className="p-2.5 rounded-2xl bg-white border border-[#E6E4DD]">
              <span className="material-symbols-outlined text-[#1A3826] text-[22px]">speed</span>
              <p className="text-[11px] font-semibold text-[#1a1c1a] mt-1">
                {isHindi ? 'फास्ट लोड' : 'Instant Launch'}
              </p>
              <p className="text-[10px] text-[#727972]">&lt; 3MB size</p>
            </div>
            <div className="p-2.5 rounded-2xl bg-white border border-[#E6E4DD]">
              <span className="material-symbols-outlined text-[#1A3826] text-[22px]">home_app_logo</span>
              <p className="text-[11px] font-semibold text-[#1a1c1a] mt-1">
                {isHindi ? 'होम स्क्रीन' : 'Home Screen'}
              </p>
              <p className="text-[10px] text-[#727972]">1-tap icon</p>
            </div>
          </div>

          {/* Primary Action Button */}
          <div>
            <button
              className="w-full py-3.5 px-4 rounded-xl bg-[#1A3826] hover:bg-[#132a1d] active:scale-[0.98] transition-all text-white font-semibold text-sm flex items-center justify-center gap-2 shadow-md cursor-pointer"
              type="button"
              onClick={handleInstallClick}
            >
              <span className="material-symbols-outlined text-[20px]">download_for_offline</span>
              <span>
                {isHindi
                  ? 'ऐप इंस्टॉल करें / डाउनलोड करें'
                  : 'Install App / Add to Home Screen'}
              </span>
            </button>
            <p className="text-[11px] text-center text-[#727972] mt-1.5">
              {isHindi
                ? 'गूगल क्रोम, सफारी, एज या एंड्रॉयड ब्राउज़र द्वारा सीधे इंस्टॉल करें'
                : 'Installs directly via Chrome, Safari, Edge or Android browser without app store fees'}
            </p>
          </div>

          {/* iOS Safari Instructions */}
          {(isIOS || installStatus === 'ios_steps') && (
            <div className="p-3.5 rounded-2xl bg-[#f4f7f4] border border-[#cfe2d2] space-y-2">
              <div className="flex items-center gap-2 text-[#1A3826] font-semibold text-xs">
                <span className="material-symbols-outlined text-[18px]">phone_iphone</span>
                <span>{isHindi ? 'iPhone / iPad (सफारी) पर कैसे जोड़ें:' : 'How to install on iOS Safari:'}</span>
              </div>
              <ol className="text-xs text-[#424843] space-y-1.5 list-decimal list-inside pl-1">
                <li>
                  {isHindi
                    ? 'नीचे बार में शेयर आइकन '
                    : 'Tap the Safari Share button '}
                  <span className="inline-flex items-center justify-center w-5 h-5 bg-white border border-[#ccc] rounded text-[11px] align-middle font-bold mx-0.5">
                    ⎙
                  </span>
                </li>
                <li>
                  {isHindi
                    ? 'नीचे स्क्रॉल करें और "Add to Home Screen" चुनें'
                    : 'Scroll down and tap "Add to Home Screen"'}
                </li>
                <li>
                  {isHindi ? 'ऊपरी दाएं कोने में "Add" पर टैप करें' : 'Tap "Add" in top-right corner to finish'}
                </li>
              </ol>
            </div>
          )}

          {/* Desktop Instructions */}
          {installStatus === 'desktop_steps' && (
            <div className="p-3.5 rounded-2xl bg-[#f4f7f4] border border-[#cfe2d2] space-y-2">
              <div className="flex items-center gap-2 text-[#1A3826] font-semibold text-xs">
                <span className="material-symbols-outlined text-[18px]">desktop_windows</span>
                <span>{isHindi ? 'कंप्यूटर या लैपटॉप पर इंस्टॉल करें:' : 'Install on Chrome / Edge Desktop:'}</span>
              </div>
              <p className="text-xs text-[#424843]">
                {isHindi
                  ? 'ब्राउज़र एड्रेस बार के दाईं ओर "Install Mast Meals" आइकन पर क्लिक करें, या मेनू (⋮) → "Save and share" → "Install Mast Meals" चुनें।'
                  : 'Look for the Install icon (⤓) on the right side of the URL address bar, or click Menu (⋮) → "Save and share" → "Install Mast Meals".'}
              </p>
            </div>
          )}

          {/* Alternate: Offline ZIP Bundle */}
          <div className="pt-2 border-t border-[#E6E4DD] flex items-center justify-between text-xs">
            <div>
              <span className="font-medium text-[#1a1c1a]">
                {isHindi ? 'ऑफ़लाइन पैकेज (.zip)' : 'Standalone Bundle (.zip)'}
              </span>
              <p className="text-[11px] text-[#727972]">
                {isHindi ? 'स्थानीय उपयोग और बैकअप के लिए' : 'For offline deployment or local test'}
              </p>
            </div>
            <a
              className="px-3 py-1.5 rounded-lg bg-[#eeeeea] hover:bg-[#e4e4df] text-[#1a1c1a] font-medium text-xs flex items-center gap-1 transition-colors cursor-pointer"
              download="MastMeals-package.zip"
              href="/MastMeals-test.zip"
            >
              <span className="material-symbols-outlined text-[15px]">folder_zip</span>
              <span>{isHindi ? 'डाउनलोड करें' : 'Download ZIP'}</span>
            </a>
          </div>
        </div>
      </div>
    </div>
  );
};
