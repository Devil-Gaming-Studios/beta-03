import React from 'react';

interface KitchenSyncHeaderProps {
  isHindi: boolean;
  onToggleLang: () => void;
  onOpenProfile: () => void;
  onOpenVoice: () => void;
}

export const KitchenSyncHeader: React.FC<KitchenSyncHeaderProps> = ({
  isHindi,
  onToggleLang,
  onOpenProfile,
  onOpenVoice,
}) => {
  return (
    <header className="fixed top-0 inset-x-0 z-50 bg-[#faf9f6]/90 backdrop-blur-xl border-b border-[#E6E4DD] pt-safe">
      <div className="h-16 px-4 max-w-xl mx-auto flex items-center justify-between gap-2">
        {/* Left: Brand and Bilingual Switch */}
        <div className="flex items-center gap-2">
          <img
            alt="KitchenSync Logo"
            className="h-8 w-auto object-contain"
            src="https://lh3.googleusercontent.com/aida-public/AB6AXuDJTSmI7D5flyHg8j7_KcMP3FhgR0Q6dtlH0V_4_0nMT3ky-qpyB_8czpFrBER4bRsAsttvOONILRI_iwuxgbL3j1wJuoGX0NsgLqg2qQfJ1DTVZzHB40KeJn8Jms-GB2QRWpv_GLeDnZJnf1k_jb_JD0BfPBlHDO81tdtDwUD-0oI1Gyy2ybT_vB1x6Ni_kH10RP_y6rhgfVby0HVcnNROWJgNDYLX1gNpFDzwA-8"
          />
          <div className="flex items-center gap-1.5">
            <span className="text-[17px] font-bold text-[#1a1c1a] tracking-tight leading-none">
              KitchenSync
            </span>
            <button
              aria-label="Toggle bilingual English or Hindi"
              className="min-h-[32px] px-2 py-0.5 rounded-full bg-[#eeeeea] text-[#1a1c1a] text-[12px] font-medium flex items-center justify-center hover:bg-[#e8e8e5] transition-colors cursor-pointer"
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

        {/* Right: Omnirush Voice Mic, Sync Status and User Profile */}
        <div className="flex items-center gap-2">
          {/* Header Mic Action Button */}
          <button
            aria-label="Omnirush Voice Assistant (Shruti & Cactus Whisper)"
            className="w-9 h-9 rounded-full bg-[#1A3826] text-white flex items-center justify-center hover:bg-[#132a1d] active:scale-95 transition-all shadow-xs cursor-pointer"
            type="button"
            onClick={onOpenVoice}
            title="Omnirush Voice Assistant (Shruti & Cactus Whisper STT)"
          >
            <span className="material-symbols-outlined text-[19px]">mic</span>
          </button>

          <div className="hidden xs:flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[#eeeeea] text-[#032212] text-[12px] font-medium">
            <span className="w-2 h-2 rounded-full bg-[#1A3826] animate-pulse"></span>
            <span>Synced</span>
          </div>

          <button
            aria-label="Profile and Settings"
            className="min-w-[40px] min-h-[40px] flex items-center justify-center p-0.5 rounded-full hover:opacity-90 transition-opacity cursor-pointer"
            type="button"
            onClick={onOpenProfile}
          >
            <img
              alt="Profile"
              className="w-8 h-8 rounded-full object-cover ring-2 ring-[#E6E4DD]"
              src="https://lh3.googleusercontent.com/aida-public/AB6AXuAvWXKJqQoUyHSDnCIHVnIPJaGAsId8KUD21MHq0Z223bcJLiGwxrVQTjwuHcqLu9DUpm-Qf4B3k7T9xj2NVcBW9BQEpTfeQCj8ous3n0dwktB3ynX6zav0uFmxBzhpnqF6A4CtPhJtIzhSpZJ8lnnqWaTsZtaruPM6OJmmmhRhRSETa1IdHJVUfG_U6HyTUcs5qtYM09dKWQfbrO8nie6fqwgrJLqMuRgJe9r3ZPU"
            />
          </button>
        </div>
      </div>
    </header>
  );
};
