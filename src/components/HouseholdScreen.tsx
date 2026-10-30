import React, { useState } from 'react';

interface HouseholdScreenProps {
  isHindi: boolean;
}

export const HouseholdScreen: React.FC<HouseholdScreenProps> = ({ isHindi }) => {
  const [diet, setDiet] = useState<'veg' | 'nonveg'>('veg');
  const [isBeginner, setIsBeginner] = useState(true);
  const [inviteCode, setInviteCode] = useState('BLR-402');
  const [inviteFeedback, setInviteFeedback] = useState<string | null>(null);
  const [activeHouse, setActiveHouse] = useState('house-1');

  const handleValidateInvite = () => {
    if (inviteCode.trim()) {
      setInviteFeedback('Flat found: Room 304 Hostel (Divyansh & Rohan synced!)');
    }
  };

  return (
    <div className="flex flex-col w-full pb-8 max-w-xl mx-auto px-4 gap-y-4">
      {/* Title */}
      <div className="pt-2">
        <h1 className="text-[24px] font-bold text-[#1a1c1a] tracking-tight leading-tight">
          {isHindi ? 'घर और खानपान प्राथमिकताएं' : 'Household & Dietary Setup'}
        </h1>
        <p className="text-[13px] text-[#424843]">
          {isHindi
            ? 'खानपान और रूममेट्स के साथ रसोई इन्वेंटरी सिंक करें'
            : 'Customized dietary locks and flatmate kitchen shelf syncing'}
        </p>
      </div>

      {/* 1. Dietary Preference Selector */}
      <section className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <h2 className="text-[15px] font-bold text-[#1a1c1a]">
            {isHindi ? 'भोजन का प्रकार चुनें' : 'Dietary Preference'}
          </h2>
          <span className="text-[11px] text-[#424843]">FSSAI Compliant</span>
        </div>

        {/* Pure Vegetarian Card */}
        <div
          className={`p-4 rounded-2xl cursor-pointer transition-all duration-200 border shadow-xs ${
            diet === 'veg'
              ? 'bg-[#f0f5f2] border-[#1a3826] ring-1 ring-[#1a3826]'
              : 'bg-white border-[#E6E4DD] opacity-90'
          }`}
          onClick={() => setDiet('veg')}
        >
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-start gap-3">
              {/* FSSAI Veg Symbol */}
              <div className="w-6 h-6 rounded-md bg-white border border-[#137333] flex items-center justify-center shrink-0 mt-0.5 shadow-2xs">
                <div className="w-2.5 h-2.5 rounded-full bg-[#137333]"></div>
              </div>
              <div className="flex flex-col">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-[16px] text-[#1a1c1a] font-bold leading-tight">
                    Pure Vegetarian
                  </span>
                  <span className="bg-[#1A3826] text-white px-2 py-0.5 rounded-full text-[11px] font-semibold">
                    100% शाकाहारी
                  </span>
                </div>
                <span className="text-[12px] text-[#424843] mt-0.5 font-medium">
                  शाकाहारी • No meat, no eggs, no seafood
                </span>
              </div>
            </div>

            <div
              className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 ${
                diet === 'veg' ? 'bg-[#1A3826] text-white' : 'border border-gray-300 bg-white'
              }`}
            >
              {diet === 'veg' && (
                <span className="material-symbols-outlined text-[16px] font-bold">check</span>
              )}
            </div>
          </div>

          <div className="mt-3 pt-2.5 border-t border-[#E6E4DD] flex items-center justify-between">
            <div className="flex items-center gap-2 flex-wrap text-[#424843] text-[12px]">
              <span className="inline-flex items-center gap-1 font-medium text-[#1A3826]">
                <span className="material-symbols-outlined text-[15px] text-[#1A3826]" style={{ fontVariationSettings: "'FILL' 1" }}>
                  eco
                </span>
                Fresh Greens
              </span>
              <span className="text-[#c2c8c1] font-bold">•</span>
              <span className="inline-flex items-center gap-1 font-medium text-[#1A3826]">
                <span className="material-symbols-outlined text-[15px] text-[#1A3826]" style={{ fontVariationSettings: "'FILL' 1" }}>
                  nutrition
                </span>
                Paneer &amp; Dal
              </span>
              <span className="text-[#c2c8c1] font-bold">•</span>
              <span className="inline-flex items-center gap-1 font-medium text-[#1A3826]">
                <span className="material-symbols-outlined text-[15px] text-[#1A3826]" style={{ fontVariationSettings: "'FILL' 1" }}>
                  soup_kitchen
                </span>
                Pure Desi Ghee
              </span>
            </div>
          </div>
        </div>

        {/* Non-Vegetarian Card */}
        <div
          className={`p-4 rounded-2xl cursor-pointer transition-all duration-200 border shadow-xs ${
            diet === 'nonveg'
              ? 'bg-[#f0f5f2] border-[#1a3826] ring-1 ring-[#1a3826]'
              : 'bg-white border-[#E6E4DD] opacity-90'
          }`}
          onClick={() => setDiet('nonveg')}
        >
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-start gap-3">
              {/* FSSAI Non-Veg Symbol */}
              <div className="w-6 h-6 rounded-md bg-white border border-[#9e2a2b] flex items-center justify-center shrink-0 mt-0.5 shadow-2xs">
                <div className="w-2.5 h-2.5 rounded-full bg-[#9e2a2b]"></div>
              </div>
              <div className="flex flex-col">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-[16px] text-[#1a1c1a] font-bold leading-tight">
                    Non-Vegetarian
                  </span>
                  <span className="bg-[#f2f2ef] text-[#424843] border border-[#E6E4DD] px-2 py-0.5 rounded-full text-[11px] font-medium">
                    Flexi-diet
                  </span>
                </div>
                <span className="text-[12px] text-[#424843] mt-0.5 font-medium">
                  माँसाहारी • Eggs, Poultry, Fish &amp; Veggies
                </span>
              </div>
            </div>

            <div
              className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 ${
                diet === 'nonveg' ? 'bg-[#1A3826] text-white' : 'border border-gray-300 bg-white'
              }`}
            >
              {diet === 'nonveg' && (
                <span className="material-symbols-outlined text-[16px] font-bold">check</span>
              )}
            </div>
          </div>

          <div className="mt-3 pt-2.5 border-t border-[#E6E4DD] flex items-center justify-between">
            <div className="flex items-center gap-2 flex-wrap text-[#424843] text-[12px]">
              <span className="inline-flex items-center gap-1 font-medium">
                <span className="material-symbols-outlined text-[15px] text-[#D97706]" style={{ fontVariationSettings: "'FILL' 1" }}>
                  egg
                </span>
                Farm Eggs
              </span>
              <span className="text-[#c2c8c1] font-bold">•</span>
              <span className="inline-flex items-center gap-1 font-medium">
                <span className="material-symbols-outlined text-[15px] text-[#9E2A2B]" style={{ fontVariationSettings: "'FILL' 1" }}>
                  set_meal
                </span>
                Fish &amp; Meat
              </span>
              <span className="text-[#c2c8c1] font-bold">•</span>
              <span className="inline-flex items-center gap-1 font-medium">
                <span className="material-symbols-outlined text-[15px] text-[#1A3826]" style={{ fontVariationSettings: "'FILL' 1" }}>
                  restaurant
                </span>
                All Veg Dishes
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* 2. Beginner Friendly Toggle */}
      <section className="p-3.5 rounded-2xl bg-white border border-[#E6E4DD] transition-all duration-200 cursor-pointer shadow-xs">
        <label className="flex items-start gap-3 cursor-pointer">
          <input
            type="checkbox"
            checked={isBeginner}
            onChange={(e) => setIsBeginner(e.target.checked)}
            className="w-5 h-5 rounded-md text-[#1A3826] mt-0.5 focus:ring-[#1A3826]"
          />
          <div className="flex-1">
            <span className="text-[14px] text-[#1a1c1a] font-semibold block leading-tight">
              I'm a beginner in cooking (कुकिंग बिगिनर)
            </span>
            <span className="text-[12px] text-[#424843] font-medium block mt-0.5">
              मैं खाना बनाना सीख रहा हूँ (शुरुआती स्तर)
            </span>
            <p className="text-[12px] text-[#424843] mt-1.5 leading-relaxed">
              Unlocks simple 15-min recipes, visual timers, and step-by-step cues explaining techniques like{' '}
              <strong className="text-[#1a1c1a] font-semibold">Tadka (तड़का)</strong>, slow sautéing, and simmering.
            </p>
          </div>
        </label>
      </section>

      {/* 3. Roommate / Flatmate Invite Code */}
      <section className="bg-[#f4f4f0] rounded-2xl p-4 shadow-xs space-y-2 border border-[#E6E4DD]">
        <div className="flex items-center justify-between">
          <label className="text-[14px] font-bold text-[#1a1c1a] flex items-center gap-1.5" htmlFor="invite-input">
            <span className="material-symbols-outlined text-[18px] text-[#3b684a]">vpn_key</span>
            <span>Got an invite code? • इनवाइट कोड</span>
          </label>
          <span className="text-[11px] text-[#6E8879]">Hostel &amp; Flat</span>
        </div>
        <p className="text-[12px] text-[#424843]">
          Enter code shared by your flatmate or cook to instantly sync kitchen shelves.
        </p>
        <div className="flex items-center gap-2 pt-1">
          <input
            className="w-full h-11 bg-white text-[#1a1c1a] uppercase tracking-wider font-semibold px-3 rounded-xl border border-[#E6E4DD] focus:outline-none focus:border-[#3b684a] text-[14px]"
            id="invite-input"
            maxLength={8}
            placeholder="e.g. BLR-402"
            value={inviteCode}
            onChange={(e) => setInviteCode(e.target.value)}
          />
          <button
            className="h-11 px-4 bg-[#1a3826] text-white text-[13px] font-semibold rounded-xl shadow-xs hover:bg-[#132a1d] active:scale-95 transition-all shrink-0 flex items-center gap-1"
            type="button"
            onClick={handleValidateInvite}
          >
            <span>Join Flat</span>
            <span className="material-symbols-outlined text-[16px]">arrow_forward</span>
          </button>
        </div>
        {inviteFeedback && (
          <div className="text-[12px] text-[#137333] font-semibold flex items-center gap-1 pt-1">
            <span className="material-symbols-outlined text-[16px]">home</span>
            <span>{inviteFeedback}</span>
          </div>
        )}
      </section>

      {/* 4. Active Household Switcher Cards */}
      <section className="flex flex-col gap-2.5">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-[15px] text-[#1a1c1a] font-bold">Household Profiles</h2>
            <span className="text-[12px] text-[#424843]">घर की संरचना चुनें</span>
          </div>
          <span className="material-symbols-outlined text-[#424843] text-[18px]">groups</span>
        </div>

        <div
          className={`p-3.5 rounded-2xl border shadow-xs flex items-center justify-between cursor-pointer transition-all ${
            activeHouse === 'house-1'
              ? 'bg-[#f0f5f2] border-[#1a3826] ring-1 ring-[#1a3826]'
              : 'bg-white border-[#E6E4DD]'
          }`}
          onClick={() => setActiveHouse('house-1')}
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-[#EDF2EE] flex items-center justify-center text-[#1A3826]">
              <span className="material-symbols-outlined text-[20px]">apartment</span>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[14px] font-bold text-[#1a1c1a]">Room 304 Hostel</span>
                <span className="px-2 py-0.5 rounded-full bg-[#eeeeea] text-[#424843] text-[10px]">
                  Current Active
                </span>
              </div>
              <span className="text-[12px] text-[#424843]">2 Members: Divyansh &amp; Rohan</span>
            </div>
          </div>
          <span className="material-symbols-outlined text-[20px] text-[#1A3826]">check_circle</span>
        </div>

        <div
          className={`p-3.5 rounded-2xl border shadow-xs flex items-center justify-between cursor-pointer transition-all ${
            activeHouse === 'house-2'
              ? 'bg-[#f0f5f2] border-[#1a3826] ring-1 ring-[#1a3826]'
              : 'bg-white border-[#E6E4DD]'
          }`}
          onClick={() => setActiveHouse('house-2')}
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-[#eeeeea] flex items-center justify-center text-[#424843]">
              <span className="material-symbols-outlined text-[20px]">villa</span>
            </div>
            <div>
              <span className="text-[14px] font-bold text-[#1a1c1a]">Sharma Family Kitchen</span>
              <span className="text-[12px] text-[#424843] block">3 Members: Adults &amp; Elders</span>
            </div>
          </div>
          <span className="text-[12px] text-[#3b684a] font-semibold">Switch</span>
        </div>
      </section>

      {/* 5. Modern Culinary Snapshot Mosaic */}
      <section className="grid grid-cols-3 gap-2 pt-1">
        <div className="relative rounded-xl overflow-hidden h-20 shadow-xs border border-[#E6E4DD]">
          <img
            alt="Pantry Spices"
            className="w-full h-full object-cover"
            src="https://lh3.googleusercontent.com/aida-public/AB6AXuA5UYRJQ8wy10OtX_h6XmcGqBq9ZFEIGhJM1nHLwdTn2J8MCDIhf_EE4mR2CmFc0lZzSxyOy-_Y31KwwyJLRMZuLBQUaL_36WY1Ufv8dzCwS3xIYZFDpc38ZnGHrk-eZg0LZ_P7d9ESIcDUwIm_PCdFFVschbD-lMe-5Fzq_EHncQ81R3RBOn7Tw9S7zDOotyrBgkraU0XNaWtzgF2e5M_3or00nFDkh_bYHrwGC5E"
          />
          <div className="absolute bottom-1 left-1 bg-white/90 backdrop-blur-xs px-1.5 py-0.5 rounded text-[10px] font-semibold text-[#1a1c1a]">
            Spice Dabba
          </div>
        </div>

        <div className="relative rounded-xl overflow-hidden h-20 shadow-xs border border-[#E6E4DD]">
          <img
            alt="Dal Tadka"
            className="w-full h-full object-cover"
            src="https://lh3.googleusercontent.com/aida-public/AB6AXuDob10VRhDNkZZ5H3JV7OZ5frai9dKn3Hec9RLVZ0qAyHXAoL_QtKJlXS31WP50yMpUz_sdNKUlI5fCvfU7zpF-gU5EwMlL6TKJ1GFJN4Chl8RXwm7dn3wdaIEQAPUivPugf99OHURnKBq2UVvhvpxaIRfs2E1gKyRW04oTgCsXG0zb0c-7-fQufA2HOWqnN1JJkI-KQnOd7tRNVgnAyUupyan3HfwAkd8IdpygV5c"
          />
          <div className="absolute bottom-1 left-1 bg-white/90 backdrop-blur-xs px-1.5 py-0.5 rounded text-[10px] font-semibold text-[#1a1c1a]">
            Tadka Sync
          </div>
        </div>

        <div className="relative rounded-xl overflow-hidden h-20 shadow-xs border border-[#E6E4DD]">
          <img
            alt="Fresh Roti"
            className="w-full h-full object-cover"
            src="https://lh3.googleusercontent.com/aida-public/AB6AXuAStHgI9CL8ZC_rc6y0c7mo3zNwvAQNzNj3zjbQHSqPJeewBPoN03tinqL5bDYuAYDklJeEP9psQuUz5teg0EAoQFs8-sfcUYa_lh_MXRxAcTEFzEtCR_KCDVbFp9ZIt1fdbKrkBcSgM6U6_rTCTQgAIwMVzPgOWLgWJ_ajxpoLTCv42KqdcTSh5Aldi_9AhvCgWOStSQpEQS9bnGsAwsUc9eabqLDHNgpnD15oETs"
          />
          <div className="absolute bottom-1 left-1 bg-white/90 backdrop-blur-xs px-1.5 py-0.5 rounded text-[10px] font-semibold text-[#1a1c1a]">
            Fresh Rotis
          </div>
        </div>
      </section>

      {/* 6. Android App & APK Installation */}
      <section className="bg-gradient-to-br from-[#032212] to-[#1a3826] text-white rounded-2xl p-5 space-y-3 shadow-md border border-[#1a3826]">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center shrink-0 border border-white/20 text-[#b7e9c3]">
            <span className="material-symbols-outlined text-[24px]">android</span>
          </div>
          <div className="flex-1">
            <h3 className="text-[15px] font-bold tracking-tight">
              {isHindi ? 'एंड्रॉयड ऐप (PWA / APK)' : 'Install on Android (App & APK)'}
            </h3>
            <p className="text-[12px] text-white/80">
              {isHindi
                ? 'अपने फोन पर बिना ब्राउज़र बार के सीधे ऐप की तरह चलाएं'
                : 'Run as a full-screen mobile app with home screen icon'}
            </p>
          </div>
        </div>

        <div className="bg-white/10 backdrop-blur-xs rounded-xl p-3 text-[12px] space-y-2 border border-white/10">
          <div className="flex items-center gap-2 text-[#b7e9c3] font-semibold">
            <span className="material-symbols-outlined text-[16px]">check_circle</span>
            <span>Method 1: Direct Android Install (Recommended)</span>
          </div>
          <p className="text-white/80 text-[11px] leading-relaxed">
            Open this app in <strong>Chrome on your Android phone</strong>, tap the <strong>⋮ (three dots)</strong> menu in Chrome, and select <strong>"Install app"</strong> or <strong>"Add to Home screen"</strong>. It installs with its own launcher icon and runs in full-screen mode like a native APK.
          </p>

          <div className="h-[1px] bg-white/10 my-1"></div>

          <div className="flex items-center gap-2 text-[#b7e9c3] font-semibold">
            <span className="material-symbols-outlined text-[16px]">file_download</span>
            <span>Download Test APK directly:</span>
          </div>
          <p className="text-white/80 text-[11px] leading-relaxed">
            Download the pre-built test shell APK package directly to your Android device:
          </p>
          <div className="flex items-center gap-2 flex-wrap pt-1">
            <a
              href="/MastMeals-test.apk"
              download="MastMeals-test.apk"
              className="inline-flex items-center gap-1.5 px-3 py-2 bg-[#b7e9c3] text-[#032212] font-bold text-[12px] rounded-lg shadow-xs hover:bg-white transition-colors"
            >
              <span className="material-symbols-outlined text-[16px]">download</span>
              <span>Download MastMeals-test.apk</span>
            </a>
            <a
              href="https://www.pwabuilder.com"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 px-3 py-2 bg-white/10 text-white font-medium text-[11px] rounded-lg border border-white/20 hover:bg-white/20 transition-colors"
            >
              <span>PWABuilder Generator</span>
              <span className="material-symbols-outlined text-[14px]">open_in_new</span>
            </a>
          </div>
        </div>
      </section>

      {/* 7. Trust & Dietary Compliance Assurance */}
      <section className="bg-[#EDF2EE]/60 rounded-2xl p-4 space-y-3 border border-[#E6E4DD] shadow-xs">
        <div className="flex items-start gap-3">
          <div className="w-8 h-8 rounded-lg bg-white flex items-center justify-center shrink-0 shadow-xs text-[#137333]">
            <span className="material-symbols-outlined text-[18px]">verified</span>
          </div>
          <div>
            <p className="text-[13px] font-bold text-[#1a1c1a] leading-tight">
              100% Respect for Dietary Preferences
            </p>
            <p className="text-[11px] text-[#424843] leading-relaxed mt-0.5">
              Strict separation for Pure-Veg homes, Jain dietary locks &amp; flatmate allergy tagging.
            </p>
          </div>
        </div>

        <div className="h-[1px] bg-[#E6E4DD]"></div>

        <div className="flex items-start gap-3">
          <div className="w-8 h-8 rounded-lg bg-white flex items-center justify-center shrink-0 shadow-xs text-[#032212]">
            <span className="material-symbols-outlined text-[18px]">lock</span>
          </div>
          <div>
            <p className="text-[13px] font-bold text-[#1a1c1a] leading-tight">
              Encrypted &amp; Syncs Offline
            </p>
            <p className="text-[11px] text-[#424843] leading-relaxed mt-0.5">
              Works seamlessly even in weak basement supermarket network zones.
            </p>
          </div>
        </div>
      </section>
    </div>
  );
};
