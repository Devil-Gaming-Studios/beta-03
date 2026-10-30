import React, { useState } from 'react';
import { askOmnirush } from '../services/omnirush';
import { store } from '../services/store';
import { OmnirushResponse } from '../types';

interface OmnirushVoiceModalProps {
  isOpen: boolean;
  onClose: () => void;
  isHindi: boolean;
}

export const OmnirushVoiceModal: React.FC<OmnirushVoiceModalProps> = ({
  isOpen,
  onClose,
  isHindi,
}) => {
  if (!isOpen) return null;

  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [reply, setReply] = useState<OmnirushResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [confirmStatus, setConfirmStatus] = useState<string | null>(null);

  const handleSend = async (queryText = input) => {
    const q = queryText.trim();
    if (!q) return;

    setError(null);
    setLoading(true);

    try {
      const res = await askOmnirush(q, 'chat');
      setReply(res);
      setInput('');
    } catch (err: any) {
      setError(err.message || 'Error communicating with Omnirush');
    } finally {
      setLoading(false);
    }
  };

  const handleConfirm = () => {
    if (!reply?.proposal_id) return;
    try {
      store.confirmProposal(reply.proposal_id);
      setConfirmStatus('Changes successfully applied to kitchen stock & plan!');
      setTimeout(() => {
        setConfirmStatus(null);
        setReply(null);
        onClose();
      }, 2000);
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleDiscard = () => {
    if (reply?.proposal_id) {
      store.discardProposal(reply.proposal_id);
    }
    setReply(null);
  };

  const chips = [
    'do kilo aloo aur ek litre dahi add kar do',
    'Aaj dinner me kya banayein?',
    'Dahi kal expire ho raha hai, recipe batao',
    'atta khatam ho gaya 500g',
  ];

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4 animate-fade-in" onClick={onClose}>
      <div
        className="w-full max-w-lg bg-white rounded-t-3xl sm:rounded-3xl p-5 shadow-2xl border border-[#E6E4DD] max-h-[90vh] overflow-y-auto flex flex-col gap-4"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[#E6E4DD] pb-3">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-full bg-[#1A3826] text-white flex items-center justify-center shadow-xs">
              <span className="material-symbols-outlined text-[22px]">mic</span>
            </div>
            <div>
              <h3 className="text-[16px] font-bold text-[#1a1c1a]">
                Omnirush AI Assistant
              </h3>
              <p className="text-[11px] text-[#424843]">
                {isHindi ? 'बोलें या टाइप करें • Hindi / Hinglish' : 'Voice or text in Hindi & English'}
              </p>
            </div>
          </div>
          <button className="w-8 h-8 rounded-full flex items-center justify-center text-[#424843] hover:bg-[#eeeeea]" onClick={onClose}>
            <span className="material-symbols-outlined text-[20px]">close</span>
          </button>
        </div>

        {/* Input area */}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSend();
          }}
          className="flex flex-col gap-2"
        >
          <div className="relative">
            <textarea
              className="w-full bg-[#f4f4f0] border border-[#E6E4DD] rounded-2xl p-3 text-[14px] text-[#1a1c1a] placeholder:text-[#727972] focus:outline-none focus:border-[#3b684a] min-h-[75px]"
              placeholder={isHindi ? 'जैसे: दो किलो आलू और एक लीटर दही जोड़ दो...' : 'e.g. do kilo aloo aur ek litre dahi add kar do...'}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              disabled={loading}
            />
          </div>

          {/* Quick chips */}
          <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-1">
            {chips.map((c, i) => (
              <button
                key={i}
                type="button"
                className="shrink-0 px-3 py-1 rounded-full bg-[#f4f4f0] border border-[#E6E4DD] text-[11px] text-[#1a1c1a] hover:bg-[#eeeeea] active:scale-95 transition-all"
                onClick={() => handleSend(c)}
              >
                {c}
              </button>
            ))}
          </div>

          <div className="flex justify-end gap-2 mt-1">
            <button
              className="px-5 py-2.5 rounded-full bg-[#1A3826] text-white text-[13px] font-semibold flex items-center gap-2 active:scale-95 transition-all shadow-xs hover:bg-[#132a1d] disabled:opacity-50"
              type="submit"
              disabled={loading || !input.trim()}
            >
              {loading ? (
                <>
                  <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
                  <span>Thinking...</span>
                </>
              ) : (
                <>
                  <span>Send</span>
                  <span className="material-symbols-outlined text-[16px]">send</span>
                </>
              )}
            </button>
          </div>
        </form>

        {error && (
          <div className="p-3 bg-[#ffdad6]/60 border border-[#ba1a1a]/30 rounded-xl text-[12px] text-[#93000a] flex items-center gap-2">
            <span className="material-symbols-outlined text-[18px]">error</span>
            <span>{error}</span>
          </div>
        )}

        {confirmStatus && (
          <div className="p-3 bg-[#E8F0EC] border border-[#137333]/30 rounded-xl text-[12px] text-[#137333] flex items-center gap-2 font-semibold">
            <span className="material-symbols-outlined text-[18px]">check_circle</span>
            <span>{confirmStatus}</span>
          </div>
        )}

        {/* AI Reply and Proposal Card */}
        {reply && (
          <div className="p-4 rounded-2xl bg-[#f0f5f2] border border-[#1a3826]/30 flex flex-col gap-3 shadow-xs">
            <div className="flex items-center gap-1.5 text-[#1A3826] font-bold text-[13px]">
              <span className="material-symbols-outlined text-[18px]">auto_awesome</span>
              <span>Omnirush Proposal</span>
            </div>

            <p className="text-[14px] text-[#1a1c1a] leading-relaxed font-medium">
              {reply.message}
            </p>

            {/* Projected Stock Table */}
            {reply.items && reply.items.length > 0 && (
              <div className="bg-white rounded-xl p-3 border border-[#E6E4DD]">
                <span className="text-[11px] font-bold text-[#727972] uppercase tracking-wider block mb-1.5">
                  Projected Stock Changes
                </span>
                <div className="flex flex-col gap-2">
                  {reply.items.map((it, idx) => (
                    <div key={idx} className="flex items-center justify-between text-[13px] border-b border-gray-100 pb-1.5 last:border-0 last:pb-0">
                      <span className="font-semibold text-[#1a1c1a]">{it.name}</span>
                      <span className="text-[#3b684a] font-medium">
                        {it.op} {it.qty_base} {it.unit_base}
                      </span>
                      <span className="text-[12px] text-[#424843]">
                        {it.before !== undefined && it.after !== undefined
                          ? `${Math.round(it.before)} → ${Math.round(it.after)} ${it.unit_base}`
                          : `${it.qty_base} ${it.unit_base}`}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Action buttons */}
            {reply.proposal_id && (
              <div className="flex items-center gap-2 mt-1">
                <button
                  className="flex-1 py-2 rounded-xl bg-[#1A3826] text-white text-[13px] font-semibold shadow-xs flex items-center justify-center gap-1 hover:bg-[#132a1d] active:scale-95 transition-all"
                  onClick={handleConfirm}
                >
                  <span className="material-symbols-outlined text-[16px]">check</span>
                  <span>Confirm Changes</span>
                </button>
                <button
                  className="px-4 py-2 rounded-xl bg-white border border-[#E6E4DD] text-[#424843] text-[13px] font-medium hover:bg-[#eeeeea] active:scale-95 transition-all"
                  onClick={handleDiscard}
                >
                  Discard
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
