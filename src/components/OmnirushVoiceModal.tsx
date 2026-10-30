import React, { useState, useEffect } from 'react';
import { askOmnirush } from '../services/omnirush';
import { store } from '../services/store';
import { OmnirushResponse } from '../types';
import {
  sttController,
  STTEngineType,
  STTResult,
  transcribeWithRouting,
} from '../services/sttService';

interface OmnirushVoiceModalProps {
  isOpen: boolean;
  onClose: () => void;
  isHindi: boolean;
}

export const OmnirushVoiceModal: React.FC<OmnirushVoiceModalProps> = ({
  isOpen,
  onClose,
  isHindi: initialHindi,
}) => {
  if (!isOpen) return null;

  const [input, setInput] = useState('');
  const [selectedEngine, setSelectedEngine] = useState<STTEngineType>('auto');
  const [isRecording, setIsRecording] = useState(false);
  const [recordingStatus, setRecordingStatus] = useState<'idle' | 'listening' | 'processing'>('idle');
  const [interimText, setInterimText] = useState('');
  const [sttMeta, setSttMeta] = useState<STTResult | null>(null);

  const [loading, setLoading] = useState(false);
  const [reply, setReply] = useState<OmnirushResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [confirmStatus, setConfirmStatus] = useState<string | null>(null);

  useEffect(() => {
    return () => {
      sttController.stop();
    };
  }, []);

  const handleToggleRecord = async () => {
    if (isRecording) {
      sttController.stop();
      setIsRecording(false);
      setRecordingStatus('idle');
      return;
    }

    setError(null);
    setIsRecording(true);
    setInterimText('');

    await sttController.start({
      preference: selectedEngine,
      onStatusChange: (s) => setRecordingStatus(s),
      onInterim: (text) => setInterimText(text),
      onFinal: (result) => {
        setIsRecording(false);
        setRecordingStatus('idle');
        setInput(result.transcript);
        setSttMeta(result);
        setInterimText('');
      },
      onError: (err) => {
        setIsRecording(false);
        setRecordingStatus('idle');
        setError(err);
      },
    });
  };

  const handleTestPhrase = async (phrase: string, enginePref: STTEngineType) => {
    setError(null);
    setInput(phrase);
    const result = await transcribeWithRouting(phrase, enginePref);
    setSttMeta(result);
  };

  const handleSend = async (queryText = input) => {
    const q = queryText.trim();
    if (!q) return;

    setError(null);
    setLoading(true);

    try {
      const res = await askOmnirush(q, 'chat');
      setReply(res);
      setInput('');
      setSttMeta(null);
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
      }, 1800);
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

  const hindiPhrases = [
    'do kilo aloo aur ek litre dahi add kar do',
    'atta khatam ho gaya 500g',
    'aaj dinner me kya banayein?',
    'dahi kal expire ho raha hai recipe batao',
  ];

  const englishPhrases = [
    'add 2 kg potatoes and 1 liter milk',
    'we finished 500g wheat flour',
    'suggest high protein dinner from stock',
    'add missing items to cart',
  ];

  return (
    <div
      className="fixed inset-0 z-50 bg-black/65 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4 animate-fade-in"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg bg-white rounded-t-3xl sm:rounded-3xl p-5 shadow-2xl border border-[#E6E4DD] max-h-[92vh] overflow-y-auto flex flex-col gap-4 text-[#1a1c1a]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[#E6E4DD] pb-3">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-full bg-[#1A3826] text-white flex items-center justify-center shadow-xs">
              <span className="material-symbols-outlined text-[22px]">mic</span>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-[16px] font-bold text-[#1a1c1a]">
                  Omnirush Voice Assistant
                </h3>
                <span className="text-[10px] font-bold bg-[#E8F0EC] text-[#137333] px-2 py-0.5 rounded-full border border-[#137333]/20">
                  Offline STT
                </span>
              </div>
              <p className="text-[11px] text-[#424843]">
                Shruti (Hindi/Hinglish) & Cactus Whisper (English) with Sarvam fallback
              </p>
            </div>
          </div>
          <button
            className="w-8 h-8 rounded-full flex items-center justify-center text-[#424843] hover:bg-[#eeeeea] transition-all"
            onClick={onClose}
          >
            <span className="material-symbols-outlined text-[20px]">close</span>
          </button>
        </div>

        {/* Model Selector Tabs */}
        <div className="flex flex-col gap-1.5">
          <label className="text-[11px] font-bold uppercase tracking-wider text-[#727972]">
            Speech-To-Text Model
          </label>
          <div className="grid grid-cols-4 gap-1.5 bg-[#f4f4f0] p-1 rounded-xl border border-[#E6E4DD]">
            <button
              type="button"
              onClick={() => setSelectedEngine('auto')}
              className={`py-1.5 text-[11px] font-semibold rounded-lg transition-all ${
                selectedEngine === 'auto'
                  ? 'bg-white text-[#1A3826] shadow-xs border border-[#1A3826]/20'
                  : 'text-[#5f6368] hover:text-[#1a1c1a]'
              }`}
            >
              Auto Route
            </button>
            <button
              type="button"
              onClick={() => setSelectedEngine('shruti')}
              className={`py-1.5 text-[11px] font-semibold rounded-lg transition-all ${
                selectedEngine === 'shruti'
                  ? 'bg-[#1A3826] text-white shadow-xs'
                  : 'text-[#5f6368] hover:text-[#1a1c1a]'
              }`}
              title="Shruti: Offline STT for Hindi & Hinglish"
            >
              Shruti (Offline)
            </button>
            <button
              type="button"
              onClick={() => setSelectedEngine('cactus_whisper')}
              className={`py-1.5 text-[11px] font-semibold rounded-lg transition-all ${
                selectedEngine === 'cactus_whisper'
                  ? 'bg-[#1A3826] text-white shadow-xs'
                  : 'text-[#5f6368] hover:text-[#1a1c1a]'
              }`}
              title="Cactus Whisper: Offline STT for English"
            >
              Cactus (Offline)
            </button>
            <button
              type="button"
              onClick={() => setSelectedEngine('sarvam_saaras')}
              className={`py-1.5 text-[11px] font-semibold rounded-lg transition-all ${
                selectedEngine === 'sarvam_saaras'
                  ? 'bg-[#3b684a] text-white shadow-xs'
                  : 'text-[#5f6368] hover:text-[#1a1c1a]'
              }`}
              title="Sarvam Saaras v3: Cloud code-mix STT fallback"
            >
              Sarvam Cloud
            </button>
          </div>
        </div>

        {/* Live Mic Recording Area */}
        <div className="flex flex-col items-center justify-center p-4 bg-[#f8f9f7] rounded-2xl border border-[#E6E4DD] gap-3">
          <div className="relative flex items-center justify-center">
            {isRecording && (
              <>
                <div className="absolute w-20 h-20 rounded-full bg-[#1A3826]/20 animate-ping"></div>
                <div className="absolute w-24 h-24 rounded-full bg-[#1A3826]/10 animate-pulse"></div>
              </>
            )}
            <button
              type="button"
              onClick={handleToggleRecord}
              className={`relative z-10 w-16 h-16 rounded-full flex items-center justify-center transition-all shadow-md active:scale-95 ${
                isRecording
                  ? 'bg-[#ba1a1a] text-white hover:bg-[#93000a]'
                  : 'bg-[#1A3826] text-white hover:bg-[#132a1d]'
              }`}
            >
              <span className="material-symbols-outlined text-[30px]">
                {isRecording ? 'stop' : 'mic'}
              </span>
            </button>
          </div>

          <div className="text-center">
            <p className="text-[13px] font-bold text-[#1a1c1a]">
              {isRecording
                ? recordingStatus === 'listening'
                  ? `Listening via ${
                      selectedEngine === 'cactus_whisper'
                        ? 'Cactus Whisper (Offline)'
                        : selectedEngine === 'shruti'
                        ? 'Shruti (Offline)'
                        : 'Auto-Routing Engine'
                    }...`
                  : 'Processing audio...'
                : 'Tap microphone to speak'}
            </p>
            <p className="text-[11px] text-[#727972]">
              {selectedEngine === 'shruti'
                ? 'Speak in Hindi or Hinglish (e.g. "do kilo aloo add karo")'
                : selectedEngine === 'cactus_whisper'
                ? 'Speak in English (e.g. "add 2 kg potatoes and 1 liter milk")'
                : 'Hindi, Hinglish or English auto-routed to Shruti / Cactus Whisper'}
            </p>
          </div>

          {interimText && (
            <div className="w-full p-2.5 bg-white border border-[#E6E4DD] rounded-xl text-[13px] text-[#424843] italic animate-pulse">
              "{interimText}..."
            </div>
          )}
        </div>

        {/* STT Engine & Confidence Badge Tag */}
        {sttMeta && (
          <div
            className={`p-3 rounded-2xl border flex flex-col gap-2 ${
              sttMeta.lowConfidence
                ? 'bg-[#fff8e1] border-[#fbc02d]'
                : 'bg-[#f0fdf4] border-[#86efac]'
            }`}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <span className="material-symbols-outlined text-[16px] text-[#137333]">
                  {sttMeta.isOffline ? 'cloud_off' : 'cloud_done'}
                </span>
                <span className="text-[12px] font-bold text-[#1a1c1a]">
                  {sttMeta.engine}
                </span>
                {sttMeta.fallbackTriggered && (
                  <span className="text-[10px] bg-[#3b684a] text-white px-1.5 py-0.5 rounded font-medium">
                    Sarvam Cloud Fallback
                  </span>
                )}
              </div>
              <div className="flex items-center gap-1.5">
                <span className="text-[11px] font-bold text-[#424843]">
                  {Math.round(sttMeta.confidence * 100)}% Confidence
                </span>
                <div className="w-14 h-2 bg-gray-200 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full ${
                      sttMeta.lowConfidence ? 'bg-[#f59e0b]' : 'bg-[#10b981]'
                    }`}
                    style={{ width: `${Math.round(sttMeta.confidence * 100)}%` }}
                  ></div>
                </div>
              </div>
            </div>

            {sttMeta.lowConfidence && (
              <div className="text-[11px] text-[#b45309] font-medium flex items-center gap-1">
                <span className="material-symbols-outlined text-[15px]">warning</span>
                <span>
                  Low confidence (&lt;75%). Please check and edit the text below before confirming.
                </span>
              </div>
            )}

            {sttMeta.matchedIngredients.length > 0 && (
              <div className="flex items-center gap-1 flex-wrap text-[11px] text-[#137333]">
                <span className="font-semibold">Vocabulary Boost:</span>
                {sttMeta.matchedIngredients.map((ing, i) => (
                  <span
                    key={i}
                    className="bg-white/90 border border-[#86efac] px-1.5 py-0.2 rounded-md"
                  >
                    {ing}
                  </span>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Input & Edit Area */}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSend();
          }}
          className="flex flex-col gap-2"
        >
          <div className="relative">
            <textarea
              className={`w-full bg-[#f4f4f0] border rounded-2xl p-3 text-[14px] text-[#1a1c1a] placeholder:text-[#727972] focus:outline-none focus:border-[#3b684a] min-h-[75px] ${
                sttMeta?.lowConfidence ? 'border-[#f59e0b] bg-white ring-1 ring-[#f59e0b]' : 'border-[#E6E4DD]'
              }`}
              placeholder="Speak using the mic or type in Hindi, Hinglish, or English..."
              value={input}
              onChange={(e) => setInput(e.target.value)}
              disabled={loading}
            />
          </div>

          {/* Quick Voice / Text Test Chips */}
          <div className="flex flex-col gap-1">
            <div className="flex items-center justify-between text-[11px] text-[#727972]">
              <span className="font-semibold uppercase tracking-wider">Quick Kitchen Phrases</span>
              <span className="text-[10px] text-[#3b684a]">Click to test offline engine</span>
            </div>
            <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-1">
              {(selectedEngine === 'cactus_whisper' ? englishPhrases : hindiPhrases).map((c, i) => (
                <button
                  key={i}
                  type="button"
                  className="shrink-0 px-3 py-1 rounded-full bg-[#f4f4f0] border border-[#E6E4DD] text-[11px] text-[#1a1c1a] hover:bg-[#eeeeea] active:scale-95 transition-all"
                  onClick={() => handleTestPhrase(c, selectedEngine)}
                >
                  {c}
                </button>
              ))}
            </div>
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
                  <span>Omnirush Parsing...</span>
                </>
              ) : (
                <>
                  <span>Send to Omnirush</span>
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

        {/* AI Reply & Omnirush Confirm-Before-Write Card */}
        {reply && (
          <div className="p-4 rounded-2xl bg-[#f0f5f2] border border-[#1a3826]/30 flex flex-col gap-3 shadow-xs">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5 text-[#1A3826] font-bold text-[13px]">
                <span className="material-symbols-outlined text-[18px]">auto_awesome</span>
                <span>Omnirush Proposal</span>
              </div>
              <span className="text-[11px] text-[#424843] bg-white px-2 py-0.5 rounded-md border border-[#E6E4DD]">
                {reply.intent || 'chat'}
              </span>
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
                    <div
                      key={idx}
                      className="flex items-center justify-between text-[13px] border-b border-gray-100 pb-1.5 last:border-0 last:pb-0"
                    >
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

            {/* Plan Changes */}
            {reply.plan_changes && reply.plan_changes.length > 0 && (
              <div className="bg-white rounded-xl p-3 border border-[#E6E4DD]">
                <span className="text-[11px] font-bold text-[#727972] uppercase tracking-wider block mb-1.5">
                  Proposed Meal Plan Slots
                </span>
                <div className="flex flex-col gap-1.5">
                  {reply.plan_changes.map((pc, idx) => (
                    <div key={idx} className="text-[13px] text-[#1a1c1a]">
                      • <strong className="capitalize">{pc.slot}</strong> ({pc.meal_date}):{' '}
                      {pc.recipe_title || 'Meal'} ({pc.servings} servings)
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Action buttons (Confirm-before-write) */}
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
