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
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-3 sm:p-4 bg-black/65 backdrop-blur-sm animate-fade-in">
      <div
        aria-modal="true"
        className="bg-[#faf9f6] w-full max-w-xl rounded-3xl shadow-2xl border border-[#E6E4DD] overflow-hidden flex flex-col max-h-[92vh]"
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
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-lg leading-tight">Mast Meals</h3>
                <span className="text-[10px] bg-[#34D399] text-[#032212] px-2 py-0.5 rounded-full font-bold uppercase tracking-wider">
                  Web &amp; Native
                </span>
              </div>
              <p className="text-xs text-[#b7e9c3] mt-0.5">
                {isHindi ? 'किचनसिंक हाउसहोल्ड ओएस - वेब व नेटिव ऐप्स' : 'KitchenSync Household OS • Web & Native Apps'}
              </p>
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
        <div className="p-4 sm:p-6 overflow-y-auto space-y-4">
          {/* Status banner if already installed */}
          {isInstalled && (
            <div className="p-3 bg-[#e8f5e9] border border-[#a5d6a7] text-[#1b5e20] rounded-xl text-xs flex items-center gap-2">
              <span className="material-symbols-outlined text-[18px]">verified</span>
              <span className="font-medium">
                {isHindi
                  ? 'वेब ऐप आपके डिवाइस पर पहले से इंस्टॉल है।'
                  : 'Web App (PWA) is already installed on this device.'}
              </span>
            </div>
          )}

          {/* Side-by-side Dual Download Section */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            {/* Option 1: Web App (PWA) */}
            <div className="p-4 rounded-2xl bg-white border border-[#E6E4DD] shadow-xs flex flex-col justify-between hover:border-[#1A3826]/40 transition-all">
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="w-9 h-9 rounded-xl bg-[#EDF2EE] text-[#1A3826] flex items-center justify-center font-bold">
                    <span className="material-symbols-outlined text-[20px]">language</span>
                  </span>
                  <span className="px-2 py-0.5 rounded-full bg-[#E8F0EC] text-[#137333] text-[10px] font-bold">
                    Web App (PWA)
                  </span>
                </div>
                <h4 className="text-[15px] font-bold text-[#1a1c1a]">
                  {isHindi ? 'वेब ऐप इंस्टॉल करें' : 'Install Web App'}
                </h4>
                <p className="text-[11.5px] text-[#424843] leading-relaxed">
                  {isHindi
                    ? 'ब्राउज़र से 1-टैप में होम स्क्रीन पर जोड़ें। क्रोम, सफारी, एज में 100% ऑफलाइन काम करता है।'
                    : '1-tap install on Chrome, Safari, Edge, or mobile browsers. Offline ready, zero store fees.'}
                </p>
                <ul className="text-[11px] text-[#727972] space-y-1 pt-1">
                  <li className="flex items-center gap-1.5">
                    <span className="material-symbols-outlined text-[14px] text-[#137333]">check</span>
                    <span>Instant Launch (&lt; 3MB)</span>
                  </li>
                  <li className="flex items-center gap-1.5">
                    <span className="material-symbols-outlined text-[14px] text-[#137333]">check</span>
                    <span>Full Offline Mode</span>
                  </li>
                  <li className="flex items-center gap-1.5">
                    <span className="material-symbols-outlined text-[14px] text-[#137333]">check</span>
                    <span>Home Screen Icon</span>
                  </li>
                </ul>
              </div>

              <div className="pt-4">
                <button
                  className="w-full py-2.5 px-3 rounded-xl bg-[#1A3826] hover:bg-[#132a1d] active:scale-[0.98] transition-all text-white font-semibold text-xs flex items-center justify-center gap-1.5 shadow-sm cursor-pointer"
                  type="button"
                  onClick={handleInstallClick}
                >
                  <span className="material-symbols-outlined text-[18px]">download_for_offline</span>
                  <span>{isHindi ? 'वेब ऐप इंस्टॉल करें' : 'Install Web App'}</span>
                </button>
              </div>
            </div>

            {/* Option 2: Native Android App (.apk) */}
            <div className="p-4 rounded-2xl bg-white border border-[#34D399]/40 shadow-xs flex flex-col justify-between hover:border-[#10B981] transition-all relative overflow-hidden">
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="w-9 h-9 rounded-xl bg-[#DCFCE7] text-[#15803D] flex items-center justify-center font-bold">
                    <span className="material-symbols-outlined text-[20px]">android</span>
                  </span>
                  <span className="px-2 py-0.5 rounded-full bg-[#DCFCE7] text-[#15803D] text-[10px] font-bold">
                    Native Android APK
                  </span>
                </div>
                <h4 className="text-[15px] font-bold text-[#1a1c1a]">
                  {isHindi ? 'नेटिव ऐप डाउनलोड करें' : 'Download Native App'}
                </h4>
                <p className="text-[11.5px] text-[#424843] leading-relaxed">
                  {isHindi
                    ? 'एंड्रॉयड APK जिसमें WhatsApp और Telegram से शॉप चैट लिसनर, रूम डेटाबेस और बैकग्राउंड सिंक शामिल है।'
                    : 'Native Android app featuring Shop Chat Listener (WhatsApp & Telegram), offline Room queue & WebBridge.'}
                </p>
                <ul className="text-[11px] text-[#727972] space-y-1 pt-1">
                  <li className="flex items-center gap-1.5">
                    <span className="material-symbols-outlined text-[14px] text-[#15803D]">check</span>
                    <span>Shop Chat Listener Service</span>
                  </li>
                  <li className="flex items-center gap-1.5">
                    <span className="material-symbols-outlined text-[14px] text-[#15803D]">check</span>
                    <span>WhatsApp &amp; Telegram support</span>
                  </li>
                  <li className="flex items-center gap-1.5">
                    <span className="material-symbols-outlined text-[14px] text-[#15803D]">check</span>
                    <span>Offline Room SQLite Queue</span>
                  </li>
                </ul>
              </div>

              <div className="pt-4 flex flex-col gap-1.5">
                <a
                  className="w-full py-2.5 px-3 rounded-xl bg-[#047857] hover:bg-[#065f46] active:scale-[0.98] transition-all text-white font-semibold text-xs flex items-center justify-center gap-1.5 shadow-sm cursor-pointer no-underline text-center"
                  download="MastMeals-native.apk"
                  href="/mastmeals.apk"
                >
                  <span className="material-symbols-outlined text-[18px]">android</span>
                  <span>{isHindi ? 'नेटिव APK डाउनलोड करें' : 'Download Native APK'}</span>
                </a>
                <a
                  className="text-[10.5px] text-center text-[#727972] hover:text-[#1a1c1a] underline"
                  download="MastMeals-package.zip"
                  href="/MastMeals-test.zip"
                >
                  {isHindi ? 'ज़िप पैकेज डाउनलोड करें (.zip)' : 'Download Standalone Package (.zip)'}
                </a>
              </div>
            </div>
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
        </div>
      </div>
    </div>
  );
};
