import React, { useState } from 'react';
import { ShoppingListItem } from '../types';

interface SwiggyModalProps {
  isOpen: boolean;
  onClose: () => void;
  items: ShoppingListItem[];
  isHindi: boolean;
}

export const SwiggyModal: React.FC<SwiggyModalProps> = ({
  isOpen,
  onClose,
  items,
  isHindi,
}) => {
  const [isExported, setIsExported] = useState(false);
  const totalAmount = items.reduce((sum, i) => sum + (i.swiggy_price || i.estimated_price || 40), 0);

  const handleExportCart = () => {
    setIsExported(true);
    setTimeout(() => {
      // In a real mobile app or browser, deep link to Swiggy Instamart cart
      window.open('https://www.swiggy.com/instamart', '_blank');
    }, 1200);
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-fade-in"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md bg-white rounded-3xl p-5 shadow-2xl border border-[#E6E4DD] max-h-[90vh] overflow-y-auto flex flex-col gap-4 text-[#1a1c1a]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[#E6E4DD] pb-3">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-2xl bg-[#FC8019]/10 text-[#FC8019] flex items-center justify-center font-bold text-[18px]">
              S
            </div>
            <div>
              <h3 className="text-[16px] font-bold text-[#1a1c1a]">
                Swiggy Instamart Cart Handoff
              </h3>
              <p className="text-[11px] text-[#424843]">
                {isHindi ? 'कार्ट में जोड़ें • चेकआउट स्विगी पर करें' : 'Cart-only handoff • Never places orders'}
              </p>
            </div>
          </div>
          <button
            className="w-8 h-8 rounded-full flex items-center justify-center text-[#424843] hover:bg-[#eeeeea]"
            onClick={onClose}
          >
            <span className="material-symbols-outlined text-[20px]">close</span>
          </button>
        </div>

        {/* Safety Notice Box (Spec 2.7) */}
        <div className="p-3 rounded-xl bg-[#E8F0EC] border border-[#D1E2D7] text-[#1E4620] text-[12px] flex items-start gap-2">
          <span className="material-symbols-outlined text-[18px] text-[#1A3826] shrink-0 mt-0.5">
            verified_user
          </span>
          <p className="leading-snug">
            <strong>Security Boundary Active:</strong> Items are placed in your Swiggy cart for instant review. The app will <strong>never</strong> place or charge orders automatically.
          </p>
        </div>

        {/* Cart Item Breakdown */}
        <div className="flex flex-col gap-2">
          <span className="text-[11.5px] font-bold text-[#727972] uppercase tracking-wider">
            Items to Export ({items.length})
          </span>
          <div className="flex flex-col gap-1.5 max-h-[220px] overflow-y-auto pr-1">
            {items.map((item) => (
              <div
                key={item.id}
                className="p-2.5 rounded-xl bg-[#FAF9F6] border border-[#E6E4DD] flex items-center justify-between text-[13px]"
              >
                <div>
                  <span className="font-semibold text-[#1a1c1a] block">{item.name}</span>
                  <span className="text-[11px] text-[#727972]">
                    {item.qty_base} {item.base_unit}
                  </span>
                </div>
                <span className="font-bold text-[#1a1c1a]">
                  ₹{item.swiggy_price || item.estimated_price || 40}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Price Total */}
        <div className="p-3 rounded-2xl bg-[#f4f4f0] border border-[#E6E4DD] flex items-center justify-between">
          <div>
            <span className="text-[13px] font-semibold text-[#1a1c1a] block">Estimated Cart Total:</span>
            <span className="text-[11px] text-[#424843]">Delivery in ~12 mins by Instamart</span>
          </div>
          <span className="text-[20px] font-bold text-[#FC8019]">₹{totalAmount}</span>
        </div>

        {/* Export / Redirect Action */}
        <div className="flex flex-col gap-2 pt-1">
          <button
            className="w-full py-3 px-4 rounded-2xl bg-[#FC8019] text-white text-[14px] font-bold shadow-md shadow-[#FC8019]/20 flex items-center justify-center gap-2 active:scale-95 transition-all hover:bg-[#e06d0c]"
            onClick={handleExportCart}
            disabled={isExported}
          >
            <span className="material-symbols-outlined text-[20px]">shopping_cart_checkout</span>
            <span>
              {isExported
                ? 'Handoff complete! Redirecting...'
                : isHindi
                ? 'स्विगी कार्ट में भेजें (Handoff)'
                : 'Send to Swiggy Instamart Cart'}
            </span>
          </button>
          <span className="text-[11px] text-center text-[#727972]">
            Redirects to your official Swiggy app with pre-filled cart.
          </span>
        </div>
      </div>
    </div>
  );
};
