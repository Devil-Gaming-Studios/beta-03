import React from 'react';
import { isNativeAndroidApp } from '../utils/nativeApp';

interface KitchenSyncHeaderProps {
  isHindi: boolean;
  onToggleLang: () => void;
  onOpenProfile: () => void;
  onOpenVoice: () => void;
  onOpenDownload: () => void;
  onOpenScan?: (mode?: 'receipt' | 'fridge') => void;
}

export const KitchenSyncHeader: React.FC<KitchenSyncHeaderProps> = ({
  isHindi,
  onToggleLang,
  onOpenProfile,
  onOpenVoice,
  onOpenDownload,
  onOpenScan,
}) => {
  const isNative = isNativeAndroidApp();

  return (
    <header className="fixed top-0 inset-x-0 z-50 bg-[#faf9f6]/95 backdrop-blur-xl border-b border-[#E6E4DD] pt-safe">
      <div className="h-16 px-3 sm:px-4 max-w-xl mx-auto flex items-center justify-between gap-1.5 sm:gap-2">
        {/* Left: Brand and Bilingual Switch */}
        <div className="flex items-center gap-1.5 sm:gap-2 min-w-0 shrink">
          <img
            alt="KitchenSync Logo"
            className="h-7 sm:h-8 w-auto object-contain shrink-0"
            src="https://lh3.googleusercontent.com/aida-public/AB6AXuDJTSmI7D5flyHg8j7_KcMP3FhgR0Q6dtlH0V_4_0nMT3ky-qpyB_8czpFrBER4bRsAsttvOONILRI_iwuxgbL3j1wJuoGX0NsgLqg2qQfJ1DTVZzHB40KeJn8Jms-GB2QRWpv_GLeDnZJnf1k_jb_JD0BfPBlHDO81tdtDwUD-0oI1Gyy2ybT_vB1x6Ni_kH10RP_y6rhgfVby0HVcnNROWJgNDYLX1gNpFDzwA-8"
          />
          <div className="flex items-center gap-1 min-w-0">
            <span className="text-[15px] sm:text-[17px] font-bold text-[#1a1c1a] tracking-tight leading-none truncate">
              KitchenSync
            </span>
            <button
              aria-label="Toggle bilingual English or Hindi"
              className="min-h-[28px] sm:min-h-[32px] px-1.5 sm:px-2 py-0.5 rounded-full bg-[#eeeeea] text-[#1a1c1a] text-[11px] sm:text-[12px] font-medium flex items-center justify-center hover:bg-[#e8e8e5] transition-colors cursor-pointer shrink-0"
              type="button"
              onClick={onToggleLang}
            >
              <span className={!isHindi ? 'text-[#032212] font-bold' : 'text-[#424843]'}>
                EN
              </span>
              <span className="text-[#727972] text-[10px] mx-0.5">/</span>
              <span className={isHindi ? 'text-[#032212] font-bold' : 'text-[#424843]'}>
                हिं
              </span>
            </button>
          </div>
        </div>

        {/* Right: Smart Scan, Omnirush Voice Mic, Sync Status and User Profile */}
        <div className="flex items-center gap-1 sm:gap-2 shrink-0">
          {/* Smart Scan Header Action Button: Always accessible across all screens */}
          {onOpenScan && (
            <button
              aria-label="Scan a Bill or Your Fridge"
              className="flex items-center gap-1 px-2.5 py-1.5 rounded-full bg-[#1A3826] text-white hover:bg-[#132a1d] active:scale-95 transition-all text-xs font-semibold cursor-pointer shadow-xs shrink-0"
              type="button"
              onClick={() => onOpenScan('receipt')}
              title={isHindi ? 'AI रसीद व फ्रिज स्कैनर' : 'Scan a Bill or Your Fridge'}
            >
              <span className="material-symbols-outlined text-[17px] text-[#c8ebd1]">document_scanner</span>
              <span>{isHindi ? 'स्कैन' : 'Smart Scan'}</span>
            </button>
          )}

          {/* Download App Action Button (Only shown in Web Browser, hidden in native Android app) */}
          {!isNative && (
            <button
              aria-label="Install the App"
              className="hidden xs:flex items-center gap-1 px-2 py-1.5 rounded-full bg-[#1A3826]/10 text-[#1A3826] hover:bg-[#1A3826]/15 active:scale-95 transition-all text-xs font-semibold cursor-pointer border border-[#1A3826]/20 shrink-0"
              type="button"
              onClick={onOpenDownload}
              title="Add Mast Meals to your home screen"
            >
              <span className="material-symbols-outlined text-[16px]">download</span>
              <span>{isHindi ? 'ऐप' : 'App'}</span>
            </button>
          )}

          {/* Header Mic Action Button */}
          <button
            aria-label="Omnirush Voice Assistant"
            className="w-8.5 h-8.5 sm:w-9 sm:h-9 rounded-full bg-[#1A3826] text-white flex items-center justify-center hover:bg-[#132a1d] active:scale-95 transition-all shadow-xs cursor-pointer shrink-0"
            type="button"
            onClick={onOpenVoice}
            title="Omnirush Voice Assistant"
          >
            <span className="material-symbols-outlined text-[18px]">mic</span>
          </button>

          <button
            aria-label="Profile and Settings"
            className="min-w-[36px] min-h-[36px] sm:min-w-[40px] sm:min-h-[40px] flex items-center justify-center p-0.5 rounded-full hover:opacity-90 transition-opacity cursor-pointer shrink-0"
            type="button"
            onClick={onOpenProfile}
          >
            <img
              alt="Profile"
              className="w-7.5 h-7.5 sm:w-8 sm:h-8 rounded-full object-cover ring-2 ring-[#E6E4DD]"
              src="https://lh3.googleusercontent.com/aida-public/AB6AXuAvWXKJqQoUyHSDnCIHVnIPJaGAsId8KUD21MHq0Z223bcJLiGwxrVQTjwuHcqLu9DUpm-Qf4B3k7T9xj2NVcBW9BQEpTfeQCj8ous3n0dwktB3ynX6zav0uFmxBzhpnqF6A4CtPhJtIzhSpZJ8lnnqWaTsZtaruPM6OJmmmhRhRSETa1IdHJVUfG_U6HyTUcs5qtYM09dKWQfbrO8nie6fqwgrJLqMuRgJe9r3ZPU"
            />
          </button>
        </div>
      </div>
    </header>
  );
};
