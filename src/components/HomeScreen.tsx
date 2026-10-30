import React, { useState } from 'react';
import { NavTab } from './KitchenSyncNavbar';

interface HomeScreenProps {
  isHindi: boolean;
  onNavigate: (tab: NavTab) => void;
  onOpenVoice: () => void;
}

export const HomeScreen: React.FC<HomeScreenProps> = ({ isHindi, onNavigate, onOpenVoice }) => {
  const [showExpiryAlert, setShowExpiryAlert] = useState(true);
  const [expiryAdded, setExpiryAdded] = useState(false);
  const [didiNote, setDidiNote] = useState('Kam namak aur bina pyaaz wali daal');
  const [isEditingNote, setIsEditingNote] = useState(false);
  const [quickAddNotice, setQuickAddNotice] = useState<string | null>(null);

  const handleQuickAddBlinkit = () => {
    setQuickAddNotice('Added Fresh Coriander (धनिया) to Blinkit Quick Cart!');
    setTimeout(() => setQuickAddNotice(null), 3500);
  };

  const handleAddPalak = () => {
    setExpiryAdded(true);
    setQuickAddNotice('Added Palak Dal to tonight’s dinner menu! Expiry optimized.');
    setTimeout(() => {
      setQuickAddNotice(null);
      setShowExpiryAlert(false);
    }, 3000);
  };

  return (
    <div className="flex flex-col w-full px-4 pb-8 max-w-xl mx-auto gap-y-4">
      {/* Quick notice toast */}
      {quickAddNotice && (
        <div className="sticky top-20 z-40 bg-[#1A3826] text-white text-[13px] font-medium px-4 py-2.5 rounded-xl shadow-lg flex items-center justify-between gap-2 border border-[#81a28a]/40 animate-fade-in">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-[18px] text-[#c8ebd1]">check_circle</span>
            <span>{quickAddNotice}</span>
          </div>
          <button className="text-white/70 hover:text-white" onClick={() => setQuickAddNotice(null)}>
            <span className="material-symbols-outlined text-[16px]">close</span>
          </button>
        </div>
      )}

      {/* Household & Offline Status Ribbon */}
      <section className="flex flex-col gap-2 pt-2">
        <div className="flex items-center justify-between gap-2 overflow-x-auto no-scrollbar py-0.5">
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[#eeeeea] text-[#1a1c1a] border border-[#E6E4DD] shrink-0">
            <span className="material-symbols-outlined text-[#3b684a] text-[18px]">location_on</span>
            <span className="text-[13px] font-semibold truncate max-w-[200px]">Room 304 Hostel</span>
            <span className="text-[#424843] text-[12px]">(Divyansh &amp; Rohan)</span>
          </div>
          <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-full bg-[#E8F0EC] text-[#1E4620] border border-[#D1E2D7] shrink-0">
            <span className="w-2 h-2 rounded-full bg-[#1A3826] animate-pulse"></span>
            <span className="text-[12px] font-semibold">Synced 2m ago</span>
          </div>
        </div>

        {/* Offline Readiness Notification Chip */}
        <div className="flex items-center justify-between px-3 py-2 rounded-xl bg-[#f4f4f0] border border-[#E6E4DD] text-[#1a1c1a]">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-[#3b684a] text-[20px]" style={{ fontVariationSettings: "'FILL' 1" }}>
              cloud_done
            </span>
            <div className="flex flex-col">
              <span className="text-[12px] font-semibold text-[#032212]">
                Offline ready • 14 recipes cached
              </span>
              <span className="text-[11px] text-[#424843]">
                {isHindi ? 'बिना इंटरनेट के भी चलेगा' : 'Functions completely offline'}
              </span>
            </div>
          </div>
          <span className="material-symbols-outlined text-[#727972] text-[18px]">verified_user</span>
        </div>

        {/* Voice Assistant Hero Card */}
        <div
          onClick={onOpenVoice}
          className="p-3.5 rounded-2xl bg-gradient-to-r from-[#1A3826] to-[#254d35] text-white flex items-center justify-between gap-3 shadow-md cursor-pointer hover:opacity-95 active:scale-[0.99] transition-all"
        >
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-full bg-white/15 flex items-center justify-center shrink-0 border border-white/20">
              <span className="material-symbols-outlined text-[24px] text-white">mic</span>
            </div>
            <div className="flex flex-col">
              <div className="flex items-center gap-1.5">
                <span className="text-[14px] font-bold">Omnirush Voice Assistant</span>
                <span className="text-[10px] bg-white/20 text-[#c8ebd1] font-semibold px-2 py-0.2 rounded-full">
                  Offline STT
                </span>
              </div>
              <span className="text-[11px] text-white/80">
                {isHindi
                  ? 'बोलें: "2 किलो आलू और 1L दही जोड़ दो" • Shruti & Cactus'
                  : 'Tap to speak: "add 2 kg potatoes" or Hinglish • Shruti & Cactus'}
              </span>
            </div>
          </div>
          <div
            className="w-8 h-8 rounded-full bg-white text-[#1A3826] flex items-center justify-center shrink-0 shadow-xs"
            title="Start Voice Assistant"
          >
            <span className="material-symbols-outlined text-[18px]">arrow_forward</span>
          </div>
        </div>
      </section>

      {/* Smart Pantry Alert Ribbon: Warm Cream Card */}
      {showExpiryAlert && (
        <section className="p-3.5 rounded-xl bg-[#FAF6F0] border border-[#E9E1D6] text-[#1a1c1a] flex items-start gap-3 shadow-xs">
          <div className="p-2 rounded-full bg-[#F2ECE1] text-[#B45309] shrink-0 mt-0.5">
            <span className="material-symbols-outlined text-[20px]">notifications_active</span>
          </div>
          <div className="flex flex-col flex-1 min-w-0">
            <div className="flex items-center justify-between">
              <span className="text-[14px] font-bold text-[#1a1c1a]">
                Expiry Alert • {isHindi ? 'तुरंत इस्तेमाल करें' : 'Expiring Soon'}
              </span>
              <span className="px-2 py-0.5 rounded-full bg-[#F2ECE1] text-[#B45309] text-[11px] font-semibold">
                2 Items
              </span>
            </div>
            <p className="text-[13px] text-[#424843] mt-1 leading-snug">
              <strong className="font-semibold text-[#1a1c1a]">Dahi / Curd</strong> (Tomorrow) &amp;{' '}
              <strong className="font-semibold text-[#1a1c1a]">Spinach / Palak</strong> (2 days). Plan Palak Dal tonight?
            </p>
            <div className="flex items-center gap-2 mt-2.5">
              <button
                className="px-3 py-1.5 rounded-full bg-[#1A3826] text-white text-[12px] font-semibold active:scale-95 transition-all flex items-center gap-1.5 shadow-xs hover:bg-[#132a1d]"
                type="button"
                onClick={handleAddPalak}
              >
                <span className="material-symbols-outlined text-[16px]">soup_kitchen</span>
                <span>{expiryAdded ? 'Added to Dinner' : 'Add Palak to Dinner'}</span>
              </button>
              <button
                className="px-3 py-1.5 rounded-full bg-white border border-[#E9E1D6] text-[#1a1c1a] text-[12px] font-medium active:scale-95 transition-transform hover:bg-[#F2ECE1]"
                type="button"
                onClick={() => setShowExpiryAlert(false)}
              >
                Dismiss
              </button>
            </div>
          </div>
        </section>
      )}

      {/* Today's Meal Calendar Section */}
      <section className="flex flex-col gap-3">
        <div className="flex items-baseline justify-between">
          <div className="flex flex-col">
            <h2 className="text-[18px] text-[#1a1c1a] flex items-center gap-2 font-bold">
              <span>{isHindi ? 'आज का खाना' : "Today's Meals"}</span>
              <span className="text-[#424843] font-normal text-[15px]">•</span>
              <span className="px-2.5 py-0.5 rounded-full bg-[#E8F0EC] text-[#1E4620] text-[12px] font-medium">
                Today
              </span>
            </h2>
            <span className="text-[11px] text-[#424843]">Scheduled meals and kitchen inventory readiness</span>
          </div>
          <button
            className="text-[12px] text-[#3b684a] font-semibold flex items-center gap-0.5"
            type="button"
            onClick={() => onNavigate('planner')}
          >
            <span>{isHindi ? 'प्लानर' : 'Calendar'}</span>
            <span className="material-symbols-outlined text-[16px]">chevron_right</span>
          </button>
        </div>

        {/* MEAL CARD 1: Breakfast */}
        <article className="p-3.5 rounded-xl bg-white border border-[#E6E4DD] flex flex-col gap-3 shadow-xs">
          <div className="flex gap-3">
            <div className="relative w-20 h-20 rounded-xl overflow-hidden shrink-0 bg-[#eeeeea]">
              <img
                alt="Poha"
                className="w-full h-full object-cover"
                src="https://lh3.googleusercontent.com/aida-public/AB6AXuDnYDJhFkcs3SWuZ9Bx4PG0p8hhMjthagEBPP-RJJ0osXsH_kQ8-j05rcMJO15Glllf3HAlZDW4i2B7npFXquHF-bIoIHeRQEPJvqmvPcIqkr41oUnTG_shbg9e8PFqW_W769cEc4Yfa3eBkVnaozFFQCLi3X0vv4tJQDor5p32y9_ElCglrxikG6s6B73KRFbMSuyNOJQRmIrGyexVsv6r7e2nqsBxpLvElKZdMtg"
              />
              <span className="absolute top-1.5 left-1.5 px-1.5 py-0.5 rounded bg-white/90 backdrop-blur-xs text-[10px] text-[#032212] font-bold">
                Done
              </span>
            </div>
            <div className="flex flex-col flex-1 min-w-0 justify-between">
              <div className="flex flex-col">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] uppercase tracking-wider text-[#727972] font-semibold">
                    {isHindi ? 'नाश्ता' : 'Breakfast'} • 8:30 AM
                  </span>
                  {/* FSSAI Veg mark */}
                  <span
                    className="w-4 h-4 rounded-xs border border-[#137333] p-[2px] flex items-center justify-center bg-white"
                    title="Pure Vegetarian"
                  >
                    <span className="w-2 h-2 rounded-full bg-[#137333]"></span>
                  </span>
                </div>
                <h3 className="text-[15px] text-[#1a1c1a] font-bold truncate">Poha with Roasted Peanuts</h3>
                <span className="text-[12px] text-[#424843]">कांदा पोहा मूंगफली के साथ</span>
              </div>
              <div className="flex items-center gap-2 mt-1 flex-wrap">
                <span className="flex items-center gap-1 text-[12px] text-[#424843]">
                  <span className="material-symbols-outlined text-[15px]">timer</span> 15 min
                </span>
                <span className="px-2 py-0.5 rounded-full bg-[#eeeeea] text-[#1a1c1a] text-[11px] font-medium">
                  Easy
                </span>
                <span className="px-2.5 py-0.5 rounded-full bg-[#E8F0EC] text-[#1E4620] text-[11px] font-semibold flex items-center gap-1 border border-[#D1E2D7]">
                  <span className="material-symbols-outlined text-[13px]">check_circle</span> Stock OK
                </span>
              </div>
            </div>
          </div>
          <div className="flex items-center justify-between pt-2 bg-[#f4f4f0] px-3 py-2 rounded-lg">
            <div className="flex items-center gap-1.5">
              <span className="material-symbols-outlined text-[#3b684a] text-[18px]">fitness_center</span>
              <span className="text-[12px] text-[#1a1c1a] font-semibold">Protein: 12g</span>
            </div>
            <span className="text-[12px] text-[#3b684a] font-semibold">Cooked by Rohan • 8:30 AM</span>
          </div>
        </article>

        {/* MEAL CARD 2: Lunch (with shortage alert) */}
        <article className="p-3.5 rounded-xl bg-white border border-[#E6E4DD] flex flex-col gap-3 shadow-xs">
          <div className="flex gap-3">
            <div className="relative w-20 h-20 rounded-xl overflow-hidden shrink-0 bg-[#eeeeea]">
              <img
                alt="Dal Chawal"
                className="w-full h-full object-cover"
                src="https://lh3.googleusercontent.com/aida-public/AB6AXuAMb5tQkBQn4GmN3kUcboZ-y_zhJjxAGEZPzCVJ8NQPyGKJ4xUf8CbujQiQ9aIbe9qgYb_LBjxh_6ESUdsjyCDMvfv4sqxn7WD3QbhMQj31E3blxOhhNzZTU_hZvhjEozSAMtarYaIGK74kXv7YAvktJCKw-WoYjOKMU9jBrdQVl78JSrug8Y4pNqa0AunpH6zXQoogjPF82v-EjXtJFT-rAySeOjUs1D0eEcvqaGw"
              />
              <span className="absolute top-1.5 left-1.5 px-1.5 py-0.5 rounded bg-white/90 backdrop-blur-xs text-[10px] text-[#1a1c1a] font-semibold">
                1:30 PM
              </span>
            </div>
            <div className="flex flex-col flex-1 min-w-0 justify-between">
              <div className="flex flex-col">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] uppercase tracking-wider text-[#727972] font-semibold">
                    {isHindi ? 'दोपहर का खाना' : 'Lunch'} • 1:30 PM
                  </span>
                  <span
                    className="w-4 h-4 rounded-xs border border-[#137333] p-[2px] flex items-center justify-center bg-white"
                    title="Pure Vegetarian"
                  >
                    <span className="w-2 h-2 rounded-full bg-[#137333]"></span>
                  </span>
                </div>
                <h3 className="text-[15px] text-[#1a1c1a] font-bold truncate">Toor Dal, Rice &amp; Bhindi</h3>
                <span className="text-[12px] text-[#424843]">दाल तड़का, चावल और भिंडी मसाला</span>
              </div>
              <div className="flex items-center gap-2 mt-1 flex-wrap">
                <span className="flex items-center gap-1 text-[12px] text-[#424843]">
                  <span className="material-symbols-outlined text-[15px]">timer</span> 30 min
                </span>
                <span className="px-2 py-0.5 rounded-full bg-[#eeeeea] text-[#1a1c1a] text-[11px] font-medium">
                  Divyansh Prep
                </span>
              </div>
            </div>
          </div>

          {/* Ingredient Shortage Micro-Banner */}
          <div className="p-2.5 rounded-lg bg-[#FAF6F0] border border-[#E9E1D6] text-[#1a1c1a] flex flex-col gap-1.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <span className="material-symbols-outlined text-[#B45309] text-[18px]">warning</span>
                <span className="text-[12px] font-semibold text-[#1a1c1a]">
                  Missing 1 item: Fresh Coriander (धनिया)
                </span>
              </div>
              <span className="text-[12px] font-bold text-[#424843]">0/1</span>
            </div>
            <div className="flex items-center justify-between flex-wrap gap-2">
              <span className="text-[12px] text-[#424843]">Tadka incomplete without garnish</span>
              <button
                className="px-3 py-1 rounded-full bg-[#1A3826] text-white text-[12px] font-semibold flex items-center gap-1 active:scale-95 transition-all hover:bg-[#132a1d]"
                type="button"
                onClick={handleQuickAddBlinkit}
              >
                <span className="material-symbols-outlined text-[14px]">bolt</span>
                <span>+ Quick Add to Blinkit</span>
              </button>
            </div>
          </div>

          <div className="flex items-center justify-between pt-1">
            <div className="flex items-center gap-1.5">
              <span className="material-symbols-outlined text-[#3b684a] text-[18px]">fitness_center</span>
              <span className="text-[12px] text-[#1a1c1a] font-semibold">Protein: 22g</span>
            </div>
            <button
              className="px-3 py-1.5 rounded-full bg-[#1A3826] text-white text-[12px] font-semibold active:scale-95 transition-transform flex items-center gap-1 hover:bg-[#132a1d]"
              type="button"
              onClick={() => onNavigate('planner')}
            >
              <span className="material-symbols-outlined text-[16px]">skillet</span>
              <span>Start Cooking Mode</span>
            </button>
          </div>
        </article>

        {/* MEAL CARD 3: Dinner */}
        <article className="p-3.5 rounded-xl bg-white border border-[#E6E4DD] flex flex-col gap-3 shadow-xs">
          <div className="flex gap-3">
            <div className="relative w-20 h-20 rounded-xl overflow-hidden shrink-0 bg-[#eeeeea]">
              <img
                alt="Paneer Bhurji"
                className="w-full h-full object-cover"
                src="https://lh3.googleusercontent.com/aida-public/AB6AXuDMd98cyEV-yWYvfqgo73Sovw0-2kuwXTJHhwES6mEUDRE_D9sv9x-Yk6OR773HDUUhy7xfHMPsQ7ZrMKTazJDIEyQP8wNNUPW5nMxqwWjDpXOTCN40djk5Z2Z0VR3otPp3JKOk3tzNTw1Za9TQPRh6-gIgxK9iiEU0SGl7pswMtYmOilxub99XN8EMfthFerpzQ2z90qZATqfg1my-fi-kLKtuiLaS6lwi-_wMLhM"
              />
              <span className="absolute top-1.5 left-1.5 px-1.5 py-0.5 rounded bg-white/90 backdrop-blur-xs text-[10px] text-[#1a1c1a] font-bold">
                8:30 PM
              </span>
            </div>
            <div className="flex flex-col flex-1 min-w-0 justify-between">
              <div className="flex flex-col">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] uppercase tracking-wider text-[#727972] font-semibold">
                    {isHindi ? 'रात का खाना' : 'Dinner'} • 8:30 PM
                  </span>
                  <span
                    className="w-4 h-4 rounded-xs border border-[#137333] p-[2px] flex items-center justify-center bg-white"
                    title="Pure Vegetarian"
                  >
                    <span className="w-2 h-2 rounded-full bg-[#137333]"></span>
                  </span>
                </div>
                <h3 className="text-[15px] text-[#1a1c1a] font-bold truncate">Paneer Bhurji &amp; Rotis</h3>
                <span className="text-[12px] text-[#424843]">पनीर भुर्जी और ताज़ी रोटियां</span>
              </div>
              <div className="flex items-center gap-2 mt-1 flex-wrap">
                <span className="flex items-center gap-1 text-[12px] text-[#424843]">
                  <span className="material-symbols-outlined text-[15px]">timer</span> 25 min
                </span>
                <span className="px-2.5 py-0.5 rounded-full bg-[#E8F0EC] text-[#1E4620] text-[11px] font-semibold flex items-center gap-1 border border-[#D1E2D7]">
                  <span className="material-symbols-outlined text-[13px]">check_circle</span> Stock OK
                </span>
              </div>
            </div>
          </div>
          <div className="flex items-center justify-between pt-2 bg-[#f4f4f0] px-3 py-2 rounded-lg">
            <div className="flex items-center gap-1.5">
              <span className="material-symbols-outlined text-[#3b684a] text-[18px]">fitness_center</span>
              <span className="text-[12px] text-[#1a1c1a] font-semibold">Protein: 28g</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[11px] text-[#424843]">Diners:</span>
              <div className="flex items-center -space-x-1.5">
                <span
                  className="w-6 h-6 rounded-full bg-[#1A3826] text-white flex items-center justify-center text-[10px] font-bold shadow-xs"
                  title="Divyansh"
                >
                  D
                </span>
                <span
                  className="w-6 h-6 rounded-full bg-[#3b684a] text-white flex items-center justify-center text-[10px] font-bold shadow-xs"
                  title="Rohan"
                >
                  R
                </span>
              </div>
            </div>
          </div>
        </article>
      </section>

      {/* Daily Protein Goal Tracker Widget */}
      <section className="p-4 rounded-xl bg-white border border-[#E6E4DD] flex flex-col gap-3 shadow-xs">
        <div className="flex items-center justify-between">
          <div className="flex flex-col">
            <span className="text-[15px] text-[#1a1c1a] font-bold">
              {isHindi ? 'दैनिक प्रोटीन लक्ष्य' : 'Daily Protein Goal'}
            </span>
            <span className="text-[12px] text-[#424843]">Daily hostel intake tracking</span>
          </div>
          <span className="px-2.5 py-1 rounded-full bg-[#E8F0EC] text-[#1E4620] text-[12px] font-semibold border border-[#D1E2D7]">
            73% Complete
          </span>
        </div>
        <div className="flex items-center gap-4 py-1">
          {/* Circular Progress Ring */}
          <div className="relative w-22 h-22 shrink-0 flex items-center justify-center">
            <svg className="w-22 h-22 -rotate-90" viewBox="0 0 96 96">
              <circle cx="48" cy="48" fill="none" r="38" stroke="#eeeeea" strokeWidth="8"></circle>
              <circle
                cx="48"
                cy="48"
                fill="none"
                r="38"
                stroke="#1a3826"
                strokeDasharray="238.7"
                strokeDashoffset="64"
                strokeLinecap="round"
                strokeWidth="8"
              ></circle>
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
              <span className="text-[16px] font-bold text-[#032212] leading-none">62g</span>
              <span className="text-[10px] text-[#424843] mt-0.5">/ 85g</span>
            </div>
          </div>

          {/* Breakdown items */}
          <div className="flex flex-col flex-1 gap-1.5">
            <div className="flex items-center justify-between text-[12px]">
              <span className="flex items-center gap-1.5 text-[#1a1c1a] font-medium">
                <span className="w-2 h-2 rounded-full bg-[#1A3826]"></span> Breakfast (पोहा)
              </span>
              <span className="font-semibold text-[#032212]">12g</span>
            </div>
            <div className="flex items-center justify-between text-[12px]">
              <span className="flex items-center gap-1.5 text-[#1a1c1a] font-medium">
                <span className="w-2 h-2 rounded-full bg-[#1A3826]"></span> Lunch (दाल + भिंडी)
              </span>
              <span className="font-semibold text-[#032212]">22g</span>
            </div>
            <div className="flex items-center justify-between text-[12px]">
              <span className="flex items-center gap-1.5 text-[#1a1c1a] font-medium">
                <span className="w-2 h-2 rounded-full bg-[#3b684a]"></span> Snack (चना चाट)
              </span>
              <span className="font-semibold text-[#3b684a]">10g</span>
            </div>
            <div className="flex items-center justify-between text-[12px]">
              <span className="flex items-center gap-1.5 text-[#424843] font-medium">
                <span className="w-2 h-2 rounded-full bg-[#727972]"></span> Dinner (पनीर भुर्जी)
              </span>
              <span className="font-semibold text-[#424843]">28g</span>
            </div>
          </div>
        </div>
      </section>

      {/* Quick Actions Bento Grid */}
      <section className="flex flex-col gap-2.5">
        <div className="flex items-center justify-between">
          <span className="text-[15px] font-bold text-[#1a1c1a]">
            {isHindi ? 'रसोई के तुरंत काम' : 'Kitchen Actions • तुरंत करें'}
          </span>
          <span className="text-[12px] text-[#424843]">Hostel Mode</span>
        </div>
        <div className="grid grid-cols-2 gap-3">
          {/* Action 1: Scan Bill */}
          <button
            className="p-3.5 rounded-xl bg-white border border-[#E6E4DD] text-left flex flex-col justify-between gap-3 hover:bg-[#f4f4f0] active:scale-95 transition-all min-h-[92px] shadow-xs"
            type="button"
            onClick={onOpenVoice}
          >
            <div className="w-9 h-9 rounded-full bg-[#eeeeea] text-[#424843] flex items-center justify-center">
              <span className="material-symbols-outlined text-[20px]">receipt_long</span>
            </div>
            <div className="flex flex-col">
              <span className="text-[13px] font-bold text-[#1a1c1a]">Scan Receipt</span>
              <span className="text-[11px] text-[#424843]">Blinkit / Zepto Bill</span>
            </div>
          </button>

          {/* Action 2: Scan Fridge */}
          <button
            className="p-3.5 rounded-xl bg-white border border-[#E6E4DD] text-left flex flex-col justify-between gap-3 hover:bg-[#f4f4f0] active:scale-95 transition-all min-h-[92px] shadow-xs"
            type="button"
            onClick={() => onNavigate('stock')}
          >
            <div className="w-9 h-9 rounded-full bg-[#E8F0EC] text-[#1E4620] flex items-center justify-center">
              <span className="material-symbols-outlined text-[20px]">kitchen</span>
            </div>
            <div className="flex flex-col">
              <span className="text-[13px] font-bold text-[#1a1c1a]">Scan Fridge</span>
              <span className="text-[11px] text-[#424843]">Pantry Camera AI</span>
            </div>
          </button>

          {/* Action 3: Smart Grocery */}
          <button
            className="p-3.5 rounded-xl bg-white border border-[#E6E4DD] text-left flex flex-col justify-between gap-3 hover:bg-[#f4f4f0] active:scale-95 transition-all min-h-[92px] shadow-xs"
            type="button"
            onClick={() => onNavigate('planner')}
          >
            <div className="flex items-center justify-between w-full">
              <div className="w-9 h-9 rounded-full bg-[#eeeeea] text-[#424843] flex items-center justify-center">
                <span className="material-symbols-outlined text-[20px]">shopping_cart</span>
              </div>
              <span className="px-2 py-0.5 rounded-full bg-[#FAF6F0] text-[#B45309] text-[11px] font-semibold border border-[#E9E1D6]">
                4 Items
              </span>
            </div>
            <div className="flex flex-col">
              <span className="text-[13px] font-bold text-[#1a1c1a]">Smart Grocery</span>
              <span className="text-[11px] text-[#424843]">सामान की लिस्ट</span>
            </div>
          </button>

          {/* Action 4: AI Leftovers */}
          <button
            className="p-3.5 rounded-xl bg-[#1A3826] text-left flex flex-col justify-between gap-3 border border-[#1A3826] hover:bg-[#132a1d] active:scale-95 transition-all min-h-[92px] shadow-xs text-white"
            type="button"
            onClick={onOpenVoice}
          >
            <div className="w-9 h-9 rounded-full bg-white/10 text-white flex items-center justify-center">
              <span className="material-symbols-outlined text-[20px]">auto_awesome</span>
            </div>
            <div className="flex flex-col">
              <span className="text-[13px] font-bold text-white">AI Leftovers</span>
              <span className="text-[11px] text-white/80">बचे खाने से नई डिश</span>
            </div>
          </button>
        </div>
      </section>

      {/* Domestic Assistant / Cook Notes Sheet */}
      <section className="p-3 rounded-xl bg-[#eeeeea] border border-[#E6E4DD] flex items-center justify-between gap-2 shadow-2xs">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-8 h-8 rounded-full bg-white border border-[#E6E4DD] flex items-center justify-center text-[#3b684a] shrink-0">
            <span className="material-symbols-outlined text-[20px]">record_voice_over</span>
          </div>
          <div className="flex flex-col min-w-0">
            <span className="text-[13px] font-bold text-[#1a1c1a]">Didi / Cook Instructions</span>
            {isEditingNote ? (
              <input
                className="text-[12px] bg-white border border-[#E6E4DD] rounded px-1.5 py-0.5 text-[#1a1c1a] focus:outline-none"
                value={didiNote}
                onChange={(e) => setDidiNote(e.target.value)}
                onBlur={() => setIsEditingNote(false)}
                autoFocus
              />
            ) : (
              <span className="text-[12px] text-[#424843] truncate italic">“{didiNote}”</span>
            )}
          </div>
        </div>
        <button
          className="px-2.5 py-1.5 rounded-full bg-white border border-[#E6E4DD] text-[#032212] text-[11px] font-semibold flex items-center gap-1 active:scale-95 transition-transform shrink-0 hover:bg-[#f4f4f0]"
          type="button"
          onClick={() => setIsEditingNote(!isEditingNote)}
        >
          <span className="material-symbols-outlined text-[15px]">
            {isEditingNote ? 'check' : 'edit_note'}
          </span>
          <span>{isEditingNote ? 'Save' : 'Edit'}</span>
        </button>
      </section>
    </div>
  );
};
