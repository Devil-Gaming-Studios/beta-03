import React, { useState } from 'react';
import { store } from '../services/store';
import { DietPreference, CookEquipment } from '../types';

interface HouseholdScreenProps {
  isHindi: boolean;
}

export const HouseholdScreen: React.FC<HouseholdScreenProps> = ({ isHindi }) => {
  const me = store.getMe();
  const [diet, setDiet] = useState<DietPreference>(me.user.diet_pref || 'veg');
  const [isBeginner, setIsBeginner] = useState<boolean>(me.user.is_beginner_cook);
  const [inviteCode, setInviteCode] = useState(me.household.invite_code || 'BLR-402');
  const [inviteFeedback, setInviteFeedback] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [equipmentList, setEquipmentList] = useState<CookEquipment[]>(
    me.household.equipment || ['stove', 'kadhai_pan', 'tawa', 'kettle'] as any
  );

  const handleDietChange = (newDiet: DietPreference) => {
    setDiet(newDiet);
    store.setUserPreferences(newDiet, isBeginner);
    setToastMessage(
      newDiet === 'veg'
        ? 'Strict Pure Veg Lock Activated: Non-veg recipes hidden from all screens.'
        : 'Diet preference set to Non-Vegetarian / Flexi-diet.'
    );
    setTimeout(() => setToastMessage(null), 3500);
  };

  const handleBeginnerToggle = () => {
    const next = !isBeginner;
    setIsBeginner(next);
    store.setUserPreferences(diet, next);
    setToastMessage(
      next
        ? 'Beginner Cook Mode Activated: Planner & AI suggestions will prioritize quick, easy meals.'
        : 'Beginner mode turned off: Showing all difficulty recipes.'
    );
    setTimeout(() => setToastMessage(null), 3500);
  };

  const handleToggleEquipment = (eq: CookEquipment) => {
    const updated = equipmentList.includes(eq)
      ? equipmentList.filter((e) => e !== eq)
      : [...equipmentList, eq];
    setEquipmentList(updated);
    store.updateHousehold({ equipment: updated });
  };

  const handleValidateInvite = () => {
    if (inviteCode.trim()) {
      setInviteFeedback('Flat found: Room 304 Hostel (Divyansh & Rohan synced!)');
      setTimeout(() => setInviteFeedback(null), 4000);
    }
  };

  const members = me.members;
  const availableEquipment: { id: CookEquipment; label: string; icon: string }[] = [
    { id: 'stove', label: 'Gas Stove / Induction', icon: 'skillet' },
    { id: 'pressure_cooker', label: 'Pressure Cooker', icon: 'soup_kitchen' },
    { id: 'mixer', label: 'Mixer / Grinder', icon: 'blender' },
    { id: 'kettle', label: 'Electric Kettle', icon: 'electric_bolt' },
    { id: 'microwave', label: 'Microwave', icon: 'microwave' },
    { id: 'tawa', label: 'Roti / Dosa Tawa', icon: 'cookie' },
  ];

  return (
    <div className="flex flex-col w-full pb-8 max-w-xl mx-auto px-4 gap-y-4">
      {/* Toast */}
      {toastMessage && (
        <div className="sticky top-20 z-40 bg-[#1A3826] text-white text-[13px] font-medium px-4 py-2.5 rounded-xl shadow-lg flex items-center justify-between gap-2 border border-[#81a28a]/40 animate-fade-in">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-[18px] text-[#c8ebd1]">check_circle</span>
            <span>{toastMessage}</span>
          </div>
          <button onClick={() => setToastMessage(null)}>
            <span className="material-symbols-outlined text-[16px]">close</span>
          </button>
        </div>
      )}

      {/* Title */}
      <div className="pt-2">
        <h1 className="text-[24px] font-bold text-[#1a1c1a] tracking-tight leading-tight">
          {isHindi ? 'घर और खानपान प्राथमिकताएं' : 'Household & Dietary Setup'}
        </h1>
        <p className="text-[13px] text-[#424843]">
          {isHindi
            ? 'खानपान, प्रोटीन लक्ष्य और रूममेट्स के साथ सिंक करें'
            : 'FSSAI dietary lock, beginner mode, and flatmate protein tracking'}
        </p>
      </div>

      {/* 1. Dietary Preference Selector (Spec 2.14) */}
      <section className="flex flex-col gap-2.5">
        <div className="flex items-center justify-between">
          <h2 className="text-[15px] font-bold text-[#1a1c1a]">
            {isHindi ? 'भोजन का प्रकार (FSSAI Lock)' : 'Strict Dietary Preference'}
          </h2>
          <span className="text-[11px] font-bold text-[#137333] bg-[#EDF2EE] px-2 py-0.5 rounded-full border border-[#c8ebd1]">
            Code-Enforced Lock
          </span>
        </div>

        {/* Pure Vegetarian Card */}
        <div
          className={`p-4 rounded-2xl cursor-pointer transition-all border shadow-xs ${
            diet === 'veg'
              ? 'bg-[#f0f5f2] border-[#1a3826] ring-1 ring-[#1a3826]'
              : 'bg-white border-[#E6E4DD] opacity-80'
          }`}
          onClick={() => handleDietChange('veg')}
        >
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-start gap-3">
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
                  Strict Veg Filter • No meat, no poultry, no fish, no eggs
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
        </div>

        {/* Non-Vegetarian Card */}
        <div
          className={`p-4 rounded-2xl cursor-pointer transition-all border shadow-xs ${
            diet === 'nonveg'
              ? 'bg-[#f0f5f2] border-[#1a3826] ring-1 ring-[#1a3826]'
              : 'bg-white border-[#E6E4DD] opacity-80'
          }`}
          onClick={() => handleDietChange('nonveg')}
        >
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-start gap-3">
              <div className="w-6 h-6 rounded-md bg-white border border-[#9e2a2b] flex items-center justify-center shrink-0 mt-0.5 shadow-2xs">
                <div className="w-2.5 h-2.5 rounded-full bg-[#9e2a2b]"></div>
              </div>
              <div className="flex flex-col">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-[16px] text-[#1a1c1a] font-bold leading-tight">
                    Non-Vegetarian / Flexi-diet
                  </span>
                  <span className="bg-[#f2f2ef] text-[#424843] border border-[#E6E4DD] px-2 py-0.5 rounded-full text-[11px] font-medium">
                    मांसाहारी
                  </span>
                </div>
                <span className="text-[12px] text-[#424843] mt-0.5 font-medium">
                  Allows Eggs, Chicken, Mutton, Fish, Seafood alongside Vegetarian
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
        </div>
      </section>

      {/* 2. Beginner Cook Toggle (Spec 2.16) */}
      <section className="bg-white border border-[#E6E4DD] rounded-2xl p-4 shadow-xs flex items-center justify-between gap-3">
        <div className="flex items-start gap-3">
          <div className="w-9 h-9 rounded-full bg-[#EDF2EE] text-[#1A3826] flex items-center justify-center shrink-0 mt-0.5">
            <span className="material-symbols-outlined text-[20px]">child_care</span>
          </div>
          <div>
            <span className="text-[14px] font-bold text-[#1a1c1a] block">
              "I'm a beginner in cooking"
            </span>
            <p className="text-[12px] text-[#424843] mt-0.5 leading-snug">
              Low-effort meal suggestions, short cook times, basic equipment, and desi measurements (katori, spoon).
            </p>
          </div>
        </div>

        <button
          className={`w-12 h-6 rounded-full transition-colors relative shrink-0 ${
            isBeginner ? 'bg-[#1A3826]' : 'bg-[#dadad7]'
          }`}
          onClick={handleBeginnerToggle}
        >
          <span
            className={`w-5 h-5 rounded-full bg-white absolute top-0.5 transition-transform ${
              isBeginner ? 'right-0.5' : 'left-0.5'
            }`}
          ></span>
        </button>
      </section>

      {/* 3. Diners & Protein Tracking (Spec 2.15) */}
      <section className="flex flex-col gap-2.5">
        <div className="flex items-center justify-between">
          <h2 className="text-[15px] font-bold text-[#1a1c1a]">
            {isHindi ? 'सदस्य और प्रोटीन ट्रैकर' : 'Household Diners & Protein Tracker'}
          </h2>
          <span className="text-[11px] text-[#727972]">Auto-logged on cook</span>
        </div>

        <div className="flex flex-col gap-2">
          {members.map((member) => {
            const stats = store.getMemberProteinStats(member.id);
            return (
              <div
                key={member.id}
                className="bg-white rounded-2xl p-3.5 border border-[#E6E4DD] shadow-xs flex flex-col gap-2"
              >
                <div className="flex items-start justify-between">
                  <div>
                    <div className="flex items-center gap-1.5">
                      <span className="font-bold text-[14px] text-[#1a1c1a]">{member.name}</span>
                      <span className="px-1.5 py-0.2 rounded text-[10px] bg-[#f4f4f0] text-[#424843] capitalize">
                        {member.age_group} • {member.diet_pref}
                      </span>
                    </div>
                    <span className="text-[11.5px] text-[#727972]">
                      Body Weight: {member.weight_kg || 65} kg • Target: {stats.target}g protein/day
                    </span>
                  </div>

                  <span className="text-[13px] font-bold text-[#1A3826]">
                    {stats.todayTotal}g / {stats.target}g
                  </span>
                </div>

                {/* Progress Bar */}
                <div className="w-full bg-[#f4f4f0] h-2 rounded-full overflow-hidden">
                  <div
                    className="bg-[#1A3826] h-full rounded-full transition-all duration-500"
                    style={{ width: `${stats.percentage}%` }}
                  ></div>
                </div>
                <span className="text-[10.5px] text-[#727972] text-right">
                  {stats.percentage}% of daily goal met today
                </span>
              </div>
            );
          })}
        </div>
      </section>

      {/* 4. Kitchen Equipment Available (Spec 2.1) */}
      <section className="flex flex-col gap-2.5">
        <h2 className="text-[15px] font-bold text-[#1a1c1a]">
          {isHindi ? 'रसोई के उपकरण' : 'Available Kitchen Equipment'}
        </h2>
        <div className="grid grid-cols-2 gap-2">
          {availableEquipment.map((eq) => {
            const isSelected = equipmentList.includes(eq.id);
            return (
              <button
                key={eq.id}
                className={`p-3 rounded-xl border text-left transition-all flex items-center gap-2.5 ${
                  isSelected
                    ? 'bg-[#E8F0EC] border-[#1A3826] text-[#032212]'
                    : 'bg-white border-[#E6E4DD] text-[#424843] hover:bg-[#f4f4f0]'
                }`}
                onClick={() => handleToggleEquipment(eq.id)}
              >
                <span
                  className="material-symbols-outlined text-[20px]"
                  style={{ color: isSelected ? '#1A3826' : '#727972' }}
                >
                  {eq.icon}
                </span>
                <span className="text-[12.5px] font-semibold">{eq.label}</span>
              </button>
            );
          })}
        </div>
      </section>

      {/* 5. Invite Flatmate & Household Sync (Spec 2.13) */}
      <section className="bg-white border border-[#E6E4DD] rounded-2xl p-4 shadow-xs flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <div>
            <span className="text-[14px] font-bold text-[#1a1c1a] block">Hostel / Flat Invite Code</span>
            <span className="text-[11px] text-[#424843]">Share code to sync shelves with flatmates</span>
          </div>
          <span className="px-3 py-1 rounded-xl bg-[#FAF6F0] text-[#B45309] font-mono font-bold text-[13px] border border-[#E9E1D6]">
            {inviteCode}
          </span>
        </div>

        <div className="flex gap-2">
          <input
            type="text"
            value={inviteCode}
            onChange={(e) => setInviteCode(e.target.value)}
            placeholder="Enter invite code..."
            className="flex-1 px-3 py-2 rounded-xl border border-[#E6E4DD] text-[13px] font-mono"
          />
          <button
            className="px-4 py-2 rounded-xl bg-[#1A3826] text-white text-[12px] font-semibold active:scale-95 transition-all"
            onClick={handleValidateInvite}
          >
            Join / Sync
          </button>
        </div>

        {inviteFeedback && (
          <span className="text-[12px] font-semibold text-[#137333] animate-fade-in">
            {inviteFeedback}
          </span>
        )}
      </section>
    </div>
  );
};
