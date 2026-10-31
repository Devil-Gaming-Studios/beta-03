import React, { useState } from 'react';
import { DietPreference } from '../types';

interface OnboardingScreenProps {
  isHindi: boolean;
  onToggleLang: () => void;
  onComplete: (diet: DietPreference, isBeginner: boolean) => void;
}

export const OnboardingScreen: React.FC<OnboardingScreenProps> = ({
  isHindi,
  onToggleLang,
  onComplete,
}) => {
  // Diet is required: nothing is pre-selected, so the user must make a choice.
  const [diet, setDiet] = useState<DietPreference | null>(null);
  const [isBeginner, setIsBeginner] = useState(false);

  const handleContinue = () => {
    if (!diet) return;
    onComplete(diet, isBeginner);
  };

  return (
    <div className="bg-[#faf9f6] min-h-screen text-[#1a1c1a] flex flex-col selection:bg-[#EDF2EE] selection:text-[#032212]">
      <div className="w-full max-w-md mx-auto flex flex-col flex-1 px-5 pt-4 pb-8">
        {/* Top bar */}
        <div className="flex items-center justify-between pb-3">
          <span className="text-[11px] text-[#424843] tracking-widest uppercase font-bold">
            KitchenSync
          </span>
          <button
            type="button"
            onClick={onToggleLang}
            className="px-3 py-1 rounded-full border border-[#E6E4DD] bg-white text-[12px] font-semibold text-[#1A3826]"
          >
            {isHindi ? 'English' : 'हिन्दी'}
          </button>
        </div>

        {/* Heading */}
        <h1 className="text-[26px] leading-[32px] font-bold tracking-tight">
          {isHindi ? 'अपनी आहार शैली चुनें' : 'Select Your Diet Preference'}
        </h1>
        <p className="mt-2 text-[13px] text-[#424843] leading-relaxed">
          {isHindi
            ? 'यह ज़रूरी है। हम आपकी पसंद के बाहर कुछ भी नहीं सुझाएँगे।'
            : 'This is required. We will never suggest items outside your choice.'}
        </p>

        {/* Diet cards */}
        <div className="flex flex-col gap-3 mt-5" role="radiogroup" aria-label="Diet preference">
          <button
            type="button"
            role="radio"
            aria-checked={diet === 'veg'}
            onClick={() => setDiet('veg')}
            className={`text-left p-4 rounded-2xl border transition-all flex items-start gap-3 ${
              diet === 'veg'
                ? 'bg-[#EDF2EE] border-[#1A3826] ring-1 ring-[#1A3826]/20'
                : 'bg-white border-[#E6E4DD]'
            }`}
          >
            <span className="w-5 h-5 mt-0.5 rounded-sm border-2 border-[#137333] flex items-center justify-center shrink-0">
              <span className="w-2.5 h-2.5 rounded-full bg-[#137333]"></span>
            </span>
            <span className="flex flex-col">
              <span className="text-[16px] font-bold">
                {isHindi ? 'शुद्ध शाकाहारी' : 'Pure Vegetarian'}
              </span>
              <span className="text-[12px] text-[#424843] mt-0.5">
                {isHindi ? 'कोई अंडा, मछली या मांस नहीं' : 'No eggs, fish or meat'}
              </span>
            </span>
          </button>

          <button
            type="button"
            role="radio"
            aria-checked={diet === 'nonveg'}
            onClick={() => setDiet('nonveg')}
            className={`text-left p-4 rounded-2xl border transition-all flex items-start gap-3 ${
              diet === 'nonveg'
                ? 'bg-[#fdf2f2] border-[#9E2A2B] ring-1 ring-[#9E2A2B]/20'
                : 'bg-white border-[#E6E4DD]'
            }`}
          >
            <span className="w-5 h-5 mt-0.5 rounded-sm border-2 border-[#9E2A2B] flex items-center justify-center shrink-0">
              <span className="w-2.5 h-2.5 rounded-full bg-[#9E2A2B]"></span>
            </span>
            <span className="flex flex-col">
              <span className="text-[16px] font-bold">
                {isHindi ? 'मांसाहारी' : 'Non-Vegetarian'}
              </span>
              <span className="text-[12px] text-[#424843] mt-0.5">
                {isHindi ? 'अंडा, चिकन, मछली और सब्ज़ियाँ' : 'Eggs, poultry, fish & veggies'}
              </span>
            </span>
          </button>
        </div>

        {/* Beginner checkbox */}
        <label className="mt-6 flex items-start gap-3 p-4 rounded-2xl border border-[#E6E4DD] bg-white cursor-pointer">
          <input
            type="checkbox"
            checked={isBeginner}
            onChange={(e) => setIsBeginner(e.target.checked)}
            className="mt-1 w-4 h-4 accent-[#1A3826]"
          />
          <span className="flex flex-col">
            <span className="text-[14px] font-bold">
              {isHindi ? 'मैं खाना बनाना सीख रहा/रही हूँ' : "I'm a beginner cook"}
            </span>
            <span className="text-[12px] text-[#424843] mt-0.5">
              {isHindi
                ? 'हम आसान और कम मेहनत वाली रेसिपी दिखाएँगे। आप इसे बाद में सेटिंग्स में बदल सकते हैं।'
                : "We'll show easy, low-effort recipes. You can change this later in settings."}
            </span>
          </span>
        </label>

        {/* Continue */}
        <div className="mt-auto pt-8">
          <button
            type="button"
            onClick={handleContinue}
            disabled={!diet}
            className={`w-full py-3.5 rounded-2xl text-[15px] font-bold transition-all ${
              diet
                ? 'bg-[#1A3826] text-white active:scale-[0.99]'
                : 'bg-[#d4d6d0] text-[#7a7d78] cursor-not-allowed'
            }`}
          >
            {isHindi ? 'आगे बढ़ें' : 'Continue'}
          </button>
          {!diet && (
            <p className="mt-2 text-center text-[11px] text-[#7a7d78]">
              {isHindi ? 'आगे बढ़ने के लिए आहार चुनें' : 'Choose a diet to continue'}
            </p>
          )}
        </div>
      </div>
    </div>
  );
};

export default OnboardingScreen;