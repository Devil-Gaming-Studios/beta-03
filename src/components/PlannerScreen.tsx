import React, { useState } from 'react';
import { store } from '../services/store';

interface PlannerScreenProps {
  isHindi: boolean;
  onOpenVoice: () => void;
  onViewRecipe: (id: string, servings: number) => void;
}

export const PlannerScreen: React.FC<PlannerScreenProps> = ({
  isHindi,
  onOpenVoice,
  onViewRecipe,
}) => {
  const [selectedDay, setSelectedDay] = useState<number>(24);
  const [actionMessage, setActionMessage] = useState<string | null>(null);

  const days = [
    { dayNumber: 21, dayLabel: 'सोम / M', dayName: 'Mon', status: 'done' },
    { dayNumber: 22, dayLabel: 'मंगल / T', dayName: 'Tue', status: 'done' },
    { dayNumber: 23, dayLabel: 'बुध / W', dayName: 'Wed', status: 'done' },
    { dayNumber: 24, dayLabel: 'आज • Thu', dayName: 'Today', status: 'active' },
    { dayNumber: 25, dayLabel: 'शुक्र / F', dayName: 'Fri', status: 'planned' },
    { dayNumber: 26, dayLabel: 'शनि / S', dayName: 'Sat', status: 'planned' },
    { dayNumber: 27, dayLabel: 'रवि / S', dayName: 'Sun', status: 'planned' },
  ];

  const handleMarkDone = (mealName: string, ingredientDeductions: string) => {
    setActionMessage(`Cooked ${mealName}! Deducted from stock: ${ingredientDeductions}`);
    setTimeout(() => setActionMessage(null), 4000);
  };

  return (
    <div className="flex flex-col w-full pb-8 max-w-xl mx-auto">
      {/* Action Notification */}
      {actionMessage && (
        <div className="sticky top-20 z-40 mx-4 bg-[#1A3826] text-white text-[13px] font-medium px-4 py-2.5 rounded-xl shadow-lg flex items-center justify-between gap-2 border border-[#81a28a]/40 animate-fade-in mb-3">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-[18px] text-[#c8ebd1]">check_circle</span>
            <span>{actionMessage}</span>
          </div>
          <button className="text-white/70 hover:text-white" onClick={() => setActionMessage(null)}>
            <span className="material-symbols-outlined text-[16px]">close</span>
          </button>
        </div>
      )}

      {/* AI Suggest Header & Household Bar */}
      <section className="px-4 pt-2 pb-1 flex flex-col gap-3">
        <div className="flex items-center justify-between gap-2">
          <div className="flex flex-col">
            <h1 className="text-[24px] font-bold text-[#1a1c1a] tracking-tight leading-tight">
              {isHindi ? 'साप्ताहिक भोजन योजना' : 'Weekly Meal Planner'}
            </h1>
            <span className="text-[12px] text-[#424843]">
              {isHindi ? 'AI संचालित योजना और इन्वेंटरी' : 'AI-assisted schedule & inventory'}
            </span>
          </div>
          <button
            aria-label="AI मील प्लान बनाएं"
            className="min-h-[44px] px-3.5 py-1.5 rounded-full bg-[#1a3826] text-white shadow-sm flex items-center gap-2 active:scale-95 transition-transform hover:bg-[#132a1d]"
            type="button"
            onClick={onOpenVoice}
          >
            <span className="material-symbols-outlined text-[18px] text-[#c8ebd1]">auto_awesome</span>
            <div className="flex flex-col text-left">
              <span className="text-[13px] leading-tight font-medium text-white">Suggest Week</span>
              <span className="text-[10px] text-[#adcfb5] leading-none">AI मील प्लान</span>
            </div>
          </button>
        </div>

        {/* Household Switcher Strip */}
        <div className="bg-white border border-[#E6E4DD] rounded-2xl p-3 flex items-center justify-between shadow-xs">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-9 h-9 rounded-full bg-[#EDF2EE] flex items-center justify-center text-[#1a3826] shadow-xs shrink-0">
              <span className="material-symbols-outlined text-[20px]">apartment</span>
            </div>
            <div className="flex flex-col min-w-0">
              <div className="flex items-center gap-1.5">
                <span className="text-[14px] text-[#1a1c1a] truncate font-semibold">Hostel Flat 402</span>
                <span className="px-1.5 py-0.5 rounded bg-[#eeeeea] text-[#424843] text-[10px]">2 Diners</span>
              </div>
              <span className="text-[12px] text-[#424843] truncate">Divyansh (Veg) &amp; Rohan (Flexi-diet)</span>
            </div>
          </div>
          <button
            aria-label="Switch household profile"
            className="min-w-[40px] min-h-[40px] flex items-center justify-center text-[#424843] hover:text-[#1a1c1a]"
            type="button"
          >
            <span className="material-symbols-outlined text-[20px]">swap_horiz</span>
          </button>
        </div>
      </section>

      {/* Horizontal 7-Day Calendar Strip */}
      <section className="py-2.5 pl-4 overflow-x-auto no-scrollbar">
        <div className="flex items-center gap-2 pr-4" role="tablist">
          {days.map((d) => {
            const isActive = selectedDay === d.dayNumber;
            return (
              <button
                key={d.dayNumber}
                aria-selected={isActive}
                className={`flex flex-col items-center justify-center min-w-[54px] py-2 px-1.5 rounded-2xl transition-all ${
                  isActive
                    ? 'min-w-[62px] py-2.5 px-2 bg-[#1a3826] text-white shadow-sm ring-1 ring-[#1a3826]'
                    : 'bg-white border border-[#E6E4DD] text-[#424843] active:scale-95'
                }`}
                type="button"
                onClick={() => setSelectedDay(d.dayNumber)}
              >
                <span
                  className={`text-[11px] ${
                    isActive ? 'text-[#c8ebd1] font-medium' : 'opacity-80'
                  }`}
                >
                  {d.dayLabel}
                </span>
                <span
                  className={`text-[17px] font-bold mt-0.5 leading-none ${
                    isActive ? 'text-white' : 'text-[#1a1c1a]'
                  }`}
                >
                  {d.dayNumber}
                </span>
                <div className="flex items-center gap-1 mt-1.5">
                  <span
                    className={`w-1.5 h-1.5 rounded-full ${
                      isActive ? 'bg-[#bceec8]' : 'bg-[#6E8879]/50'
                    }`}
                  ></span>
                </div>
              </button>
            );
          })}
        </div>
      </section>

      {/* Day Macro Progress Banner */}
      <section className="px-4 py-1">
        <div className="bg-white border border-[#E6E4DD] rounded-2xl p-3.5 flex items-center justify-between gap-3 shadow-xs">
          <div className="flex items-center gap-3">
            <div className="relative w-11 h-11 flex items-center justify-center">
              <svg className="w-11 h-11 -rotate-90" viewBox="0 0 36 36">
                <path
                  className="text-[#eeeeea]"
                  d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="3.5"
                ></path>
                <path
                  className="text-[#3b684a]"
                  d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                  fill="none"
                  stroke="currentColor"
                  strokeDasharray="78, 100"
                  strokeLinecap="round"
                  strokeWidth="3.5"
                ></path>
              </svg>
              <span className="absolute text-[11px] font-bold text-[#1a1c1a]">78%</span>
            </div>
            <div className="flex flex-col">
              <span className="text-[14px] text-[#1a1c1a] font-semibold">
                Thursday Target: 68g Protein
              </span>
              <span className="text-[12px] text-[#424843]">
                52g planned today • High legume &amp; egg balance
              </span>
            </div>
          </div>
          <span className="px-2.5 py-1 rounded-full bg-[#EDF2EE] text-[#3b684a] text-[11px] font-semibold border border-[#E6E4DD]">
            संतुलित आहार
          </span>
        </div>
      </section>

      {/* 3-Slot Meal Schedule Cards */}
      <section className="px-4 py-2 flex flex-col gap-3.5">
        {/* 1. BREAKFAST CARD */}
        <article className="bg-white border border-[#E6E4DD] rounded-2xl p-3.5 shadow-xs flex flex-col gap-3">
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-0.5 rounded-md bg-[#F5F4EF] text-[#424843] text-[11px] uppercase tracking-wider font-semibold border border-[#E6E4DD]">
                नाश्ता • 08:30 AM
              </span>
              <div
                className="w-4 h-4 rounded-xs bg-white flex items-center justify-center p-[2px]"
                style={{ boxShadow: 'inset 0 0 0 1.5px #137333' }}
                title="Vegetarian"
              >
                <div className="w-2 h-2 rounded-full bg-[#137333]"></div>
              </div>
            </div>
            <div className="flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-[#EDF2EE] text-[#3b684a] text-[11px] font-semibold border border-[#E6E4DD]">
              <span className="material-symbols-outlined text-[14px]">check_circle</span>
              <span>Stock OK</span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="w-16 h-16 rounded-xl overflow-hidden shrink-0 bg-[#eeeeea] border border-[#E6E4DD]">
              <img
                alt="Moong Chilla"
                className="w-full h-full object-cover"
                src="https://lh3.googleusercontent.com/aida-public/AB6AXuBAVh7nvBcsMSIKDRaXFFqFdsl3NuXM42quvVpSto5lO9fjtXfGOiCmBzvXzDfURgoF8_vCvSiV6HSia-NzcbbVNzt6oIl7W9wf1lAZzLhus6QcFw-DY2Z6bAg3IritzvmHkJL9zuSDBAjalmNRceodN2EFkCsSQlzReXiaKl8cVHtnkMWyeDnV2cNLxc5cuqRvlXurm9Woe4DvVnSSI8N7zJ67GHxAdmk6HEwP-t0"
              />
            </div>
            <div className="flex flex-col min-w-0 flex-1">
              <h3 className="text-[15px] font-bold text-[#1a1c1a] truncate leading-tight">
                Sprouted Moong Chilla
              </h3>
              <p className="text-[12px] text-[#424843] mt-0.5">मूंग दाल चीला पनीर स्टफ्ड</p>
              <div className="flex items-center gap-2 mt-1">
                <span className="text-[12px] text-[#3b684a] font-semibold">18g Protein</span>
                <span className="text-[#c2c8c1]">•</span>
                <span className="text-[12px] text-[#424843]">15 min</span>
              </div>
            </div>
            <button
              className="px-3 py-1.5 rounded-full bg-[#1a3826] text-white text-[12px] font-semibold active:scale-95 transition-all hover:bg-[#132a1d]"
              type="button"
              onClick={() => handleMarkDone('Moong Chilla', '150g Moong, 50g Paneer, 10ml Oil')}
            >
              Mark Done
            </button>
          </div>
        </article>

        {/* 2. LUNCH CARD */}
        <article className="bg-white border border-[#E6E4DD] rounded-2xl p-3.5 shadow-xs flex flex-col gap-3">
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-0.5 rounded-md bg-[#F5F4EF] text-[#424843] text-[11px] uppercase tracking-wider font-semibold border border-[#E6E4DD]">
                दोपहर • 01:30 PM
              </span>
              <div
                className="w-4 h-4 rounded-xs bg-white flex items-center justify-center p-[2px]"
                style={{ boxShadow: 'inset 0 0 0 1.5px #137333' }}
                title="Vegetarian"
              >
                <div className="w-2 h-2 rounded-full bg-[#137333]"></div>
              </div>
            </div>
            <div className="flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-[#FAF6F0] text-[#B45309] text-[11px] font-semibold border border-[#E9E1D6]">
              <span className="material-symbols-outlined text-[14px]">warning</span>
              <span>1 Shortage</span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="w-16 h-16 rounded-xl overflow-hidden shrink-0 bg-[#eeeeea] border border-[#E6E4DD]">
              <img
                alt="Aloo Gobi Matar"
                className="w-full h-full object-cover"
                src="https://lh3.googleusercontent.com/aida-public/AB6AXuB7gugk2L3zYbU4_eZI-DBd4Uq3-3SuTDRtqALl_rXiU0wNaIBRVlxyYsPxix64wM0RnvKXWE5JjUEPiJAVCXTy7GJVELH0liyzejrfbuXfYtiAA2nHwyss1ukD7hzHNaevLAsgD8Um15v0sYFM1xCt_4Hnl5bHyWxJLBwZEirMkVKx-X7MHbO7IKePHlKzPWuFc8MScjNqMS7JPU_VDIRblBmQPZ-W_2IRvO29zOM"
              />
            </div>
            <div className="flex flex-col min-w-0 flex-1">
              <h3 className="text-[15px] font-bold text-[#1a1c1a] truncate leading-tight">
                Toor Dal &amp; Aloo Gobi Matar
              </h3>
              <p className="text-[12px] text-[#424843] mt-0.5">अरहर दाल, चावल, आलू गोभी</p>
              <div className="flex items-center gap-2 mt-1">
                <span className="text-[12px] text-[#3b684a] font-semibold">24g Protein</span>
                <span className="text-[#c2c8c1]">•</span>
                <span className="text-[12px] text-[#424843]">30 min</span>
              </div>
            </div>
            <button
              className="px-3 py-1.5 rounded-full bg-[#f4f4f0] border border-[#E6E4DD] text-[#032212] text-[12px] font-semibold active:scale-95 transition-all hover:bg-[#eeeeea]"
              type="button"
              onClick={() => onViewRecipe('rec_dal_chawal', 2)}
            >
              Recipe
            </button>
          </div>
        </article>

        {/* 3. DINNER CARD */}
        <article className="bg-white border border-[#E6E4DD] rounded-2xl p-3.5 shadow-xs flex flex-col gap-3">
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-0.5 rounded-md bg-[#F5F4EF] text-[#424843] text-[11px] uppercase tracking-wider font-semibold border border-[#E6E4DD]">
                रात का खाना • 08:30 PM
              </span>
              <div
                className="w-4 h-4 rounded-xs bg-white flex items-center justify-center p-[2px]"
                style={{ boxShadow: 'inset 0 0 0 1.5px #D97706' }}
                title="Eggitarian / Flexi"
              >
                <div className="w-2 h-2 rounded-full bg-[#D97706]"></div>
              </div>
            </div>
            <div className="flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-[#EDF2EE] text-[#3b684a] text-[11px] font-semibold border border-[#E6E4DD]">
              <span className="material-symbols-outlined text-[14px]">check_circle</span>
              <span>Stock OK</span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="w-16 h-16 rounded-xl overflow-hidden shrink-0 bg-[#eeeeea] border border-[#E6E4DD]">
              <img
                alt="Egg Curry"
                className="w-full h-full object-cover"
                src="https://lh3.googleusercontent.com/aida-public/AB6AXuAFcRMX3PoOloNYvB-Qk4FdADAyUPPvur9EiYD7b0CgPTaFMlZZdqk1g7VmW7URd-JIFy6-JS8cOYBSwZ1wmd6daZjlkwG3UnHIiTs7ma11kmRFLCaVRb2qCrnmNBZjjOaroRYA4QKxFb78rBqJ-N2jRHK8ziCAwEiO7DfnojYwKFFAWtSQ0WuJUk6WlWSfp5QvMPZWvb1S98Wqk9gXpfsAoFsVWjEsCX-9p7VNg5o"
              />
            </div>
            <div className="flex flex-col min-w-0 flex-1">
              <h3 className="text-[15px] font-bold text-[#1a1c1a] truncate leading-tight">
                Egg Curry / Paneer Bhurji &amp; Roti
              </h3>
              <p className="text-[12px] text-[#424843] mt-0.5">अंडा करी / पनीर भुर्जी और पराठे</p>
              <div className="flex items-center gap-2 mt-1">
                <span className="text-[12px] text-[#3b684a] font-semibold">26g Protein</span>
                <span className="text-[#c2c8c1]">•</span>
                <span className="text-[12px] text-[#424843]">25 min</span>
              </div>
            </div>
            <button
              className="px-3 py-1.5 rounded-full bg-[#1a3826] text-white text-[12px] font-semibold active:scale-95 transition-all hover:bg-[#132a1d]"
              type="button"
              onClick={() => handleMarkDone('Paneer Bhurji & Roti', '200g Paneer, 100g Pyaz, 80g Tamatar')}
            >
              Mark Done
            </button>
          </div>
        </article>
      </section>
    </div>
  );
};
