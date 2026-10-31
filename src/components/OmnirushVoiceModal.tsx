import React, { useState, useEffect, useRef } from 'react';
import { askOmnirush } from '../services/omnirush';
import { store } from '../services/store';
import { OmnirushResponse } from '../types';
import {
  sttController,
  STTEngineType,
  STTResult,
  transcribeWithRouting,
  transcribeAudioFile,
} from '../services/sttService';

interface ChatMessage {
  id: string;
  sender: 'user' | 'assistant';
  text: string;
  time: string;
  reply?: OmnirushResponse;
  confirmed?: boolean;
}

interface OmnirushVoiceModalProps {
  isOpen: boolean;
  onClose: () => void;
  isHindi: boolean;
  autoStart?: boolean;
  onDataChanged?: () => void;
}

export const OmnirushVoiceModal: React.FC<OmnirushVoiceModalProps> = ({
  isOpen,
  onClose,
  isHindi: initialHindi,
  autoStart = false,
  onDataChanged,
}) => {
  const [input, setInput] = useState('');
  const [selectedEngine, setSelectedEngine] = useState<STTEngineType>('auto');
  const [isRecording, setIsRecording] = useState(false);
  const [recordingStatus, setRecordingStatus] = useState<'idle' | 'listening' | 'processing'>('idle');
  const [interimText, setInterimText] = useState('');
  const [volume, setVolume] = useState<number>(0);
  const [sttMeta, setSttMeta] = useState<STTResult | null>(null);
  const [micNotice, setMicNotice] = useState<string | null>(null);

  const [loading, setLoading] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'msg_welcome',
      sender: 'assistant',
      text: 'Namaste! Main Omnirush hoon. Main aapki kitchen inventory update kar sakta hoon, saare missing items restock kar sakta hoon ("I bought everything required"), aur poore hafte ka schedule plan kar sakta hoon.',
      time: 'Just now',
    },
  ]);
  const [error, setError] = useState<string | null>(null);
  const [confirmStatus, setConfirmStatus] = useState<string | null>(null);

  const chatBottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    chatBottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isRecording, loading]);

  useEffect(() => {
    if (!isOpen) {
      sttController.stop();
      setIsRecording(false);
      setRecordingStatus('idle');
      setInterimText('');
      setVolume(0);
      return;
    }
    if (autoStart) {
      handleStartRecording();
    }
    return () => {
      sttController.stop();
    };
  }, [isOpen, autoStart]);

  const handleStartRecording = async () => {
    setError(null);
    setMicNotice(null);
    setIsRecording(true);
    setInterimText('');
    setVolume(0);

    try {
      await sttController.start({
        preference: selectedEngine,
        onStatusChange: (s) => {
          setRecordingStatus(s);
          if (s === 'idle') setIsRecording(false);
        },
        onInterim: (text) => {
          setInterimText(text);
          setInput(text);
        },
        onVolumeChange: (vol) => setVolume(vol),
        onFinal: (result) => {
          setIsRecording(false);
          setRecordingStatus('idle');
          setInput(result.transcript);
          setSttMeta(result);
          setInterimText('');
          setVolume(0);
        },
        onError: (err) => {
          setIsRecording(false);
          setRecordingStatus('idle');
          setInterimText('');
          setVolume(0);
          setMicNotice(err);
        },
      });
    } catch (e: any) {
      setError(e.message || 'Error initializing audio capture');
      setIsRecording(false);
      setRecordingStatus('idle');
    }
  };

  const handleStopRecording = async () => {
    setRecordingStatus('processing');
    await sttController.stop({
      preference: selectedEngine,
      onStatusChange: (s) => {
        setRecordingStatus(s);
        if (s === 'idle') setIsRecording(false);
      },
      onFinal: (result) => {
        setIsRecording(false);
        setRecordingStatus('idle');
        setInput(result.transcript);
        setSttMeta(result);
        setInterimText('');
        setVolume(0);
      },
      onError: (err) => {
        setIsRecording(false);
        setRecordingStatus('idle');
        setInterimText('');
        setVolume(0);
        setMicNotice(err);
      },
    });
  };

  const handleToggleRecord = async () => {
    if (isRecording) {
      await handleStopRecording();
    } else {
      await handleStartRecording();
    }
  };

  const handleAudioFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = '';
    setError(null);
    setMicNotice(null);
    setRecordingStatus('processing');
    try {
      const result = await transcribeAudioFile(file, selectedEngine);
      setInput(result.transcript);
      setSttMeta(result);
    } catch (err: any) {
      setMicNotice(err.message || 'Could not transcribe audio file.');
    } finally {
      setRecordingStatus('idle');
    }
  };

  const handleTestPhrase = async (phrase: string, enginePref: STTEngineType) => {
    setError(null);
    setInput(phrase);
    setRecordingStatus('processing');
    const result = await transcribeWithRouting(phrase, enginePref);
    setSttMeta(result);
    setRecordingStatus('idle');
  };

  const handleSend = async (queryText = input) => {
    const q = queryText.trim();
    if (!q) return;

    setError(null);
    setLoading(true);

    const userMsg: ChatMessage = {
      id: 'msg_' + Date.now(),
      sender: 'user',
      text: q,
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };
    setMessages((prev) => [...prev, userMsg]);
    setInput('');

    try {
      const res = await askOmnirush(q, 'chat');
      const assistantMsg: ChatMessage = {
        id: 'msg_bot_' + Date.now(),
        sender: 'assistant',
        text: res.message,
        reply: res,
        confirmed: Boolean(res.auto_applied),
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };
      setMessages((prev) => [...prev, assistantMsg]);
      setSttMeta(null);

      if (res.auto_applied) {
        setConfirmStatus(
          `✅ Kitchen Stock Updated & Missing Items Cleared (${res.items?.length || 0} items restocked)!`
        );
        if (onDataChanged) onDataChanged();
        setTimeout(() => setConfirmStatus(null), 4000);
      }
    } catch (err: any) {
      setError(err.message || 'Error communicating with Omnirush');
    } finally {
      setLoading(false);
    }
  };

  const handleConfirmMessageProposal = (msgId: string, reply: OmnirushResponse) => {
    if (!reply.proposal_id) return;
    try {
      const res = store.confirmProposal(reply.proposal_id);
      let successText = 'Changes successfully confirmed and saved to your offline database!';

      if (res.recipe_modification) {
        successText = `✅ Offline Recipe Saved: ${res.recipe_modification.ingredient_name} in "${res.recipe_modification.recipe_title}" updated from ${res.recipe_modification.old_qty}${res.recipe_modification.unit} to ${res.recipe_modification.new_qty}${res.recipe_modification.unit}!`;
      } else if (reply.intent === 'edit_schedule') {
        successText = `✅ Full Weekly Schedule Saved: ${reply.plan_changes?.length || 7} meal slots updated in your planner!`;
      } else if (reply.intent === 'edit_plan') {
        const first = reply.plan_changes?.[0];
        successText = `✅ Meal Plan Updated: ${first?.slot?.toUpperCase()} on ${first?.meal_date} changed to "${first?.recipe_title}"!`;
      } else if (reply.intent === 'update_stock') {
        successText = `✅ Inventory Ledger Updated: ${reply.items?.length || 1} stock items adjusted!`;
      }

      setConfirmStatus(successText);
      setMessages((prev) =>
        prev.map((m) =>
          m.id === msgId ? { ...m, confirmed: true } : m
        )
      );
      if (onDataChanged) onDataChanged();

      setTimeout(() => {
        setConfirmStatus(null);
      }, 4000);
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleDiscardMessageProposal = (msgId: string, reply: OmnirushResponse) => {
    if (reply.proposal_id) {
      store.discardProposal(reply.proposal_id);
    }
    setMessages((prev) =>
      prev.map((m) =>
        m.id === msgId ? { ...m, reply: undefined } : m
      )
    );
  };

  const actionPrompts = [
    { label: '🛒 Bought everything required', prompt: 'I bought everything that is required', engine: 'cactus_whisper' as STTEngineType },
    { label: '🍯 Increase sugar in Kheer to 150g', prompt: 'increase sugar in Kheer to 150g', engine: 'shruti' as STTEngineType },
    { label: '🍲 Change dinner today to Paneer Bhurji', prompt: 'change dinner today to Paneer Bhurji', engine: 'cactus_whisper' as STTEngineType },
    { label: '📅 Plan full schedule for this week', prompt: 'plan full schedule for this week', engine: 'cactus_whisper' as STTEngineType },
    { label: '🥔 + 2 kg aloo & 1L dahi', prompt: 'do kilo aloo aur ek litre dahi add kar do', engine: 'shruti' as STTEngineType },
    { label: '🌾 Atta khatam ho gaya 500g', prompt: 'atta khatam ho gaya 500g', engine: 'shruti' as STTEngineType },
  ];

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 bg-black/65 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4 animate-fade-in"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg bg-white rounded-t-3xl sm:rounded-3xl p-4 sm:p-5 shadow-2xl border border-[#E6E4DD] max-h-[92vh] flex flex-col gap-3 text-[#1a1c1a]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[#E6E4DD] pb-3 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-full bg-[#1A3826] text-white flex items-center justify-center shadow-xs">
              <span className="material-symbols-outlined text-[22px]">smart_toy</span>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-[16px] font-bold text-[#1a1c1a]">
                  Omnirush Assistant &amp; Voice
                </h3>
                <span className="text-[10px] font-bold bg-[#E8F0EC] text-[#137333] px-2 py-0.5 rounded-full border border-[#137333]/20">
                  Full Control
                </span>
              </div>
              <p className="text-[11px] text-[#424843]">
                Inventory • Menu &amp; Full Schedule • Offline Saved Recipes
              </p>
            </div>
          </div>
          <button
            className="w-8 h-8 rounded-full flex items-center justify-center text-[#424843] hover:bg-[#eeeeea] transition-all cursor-pointer"
            onClick={onClose}
          >
            <span className="material-symbols-outlined text-[20px]">close</span>
          </button>
        </div>

        {/* STT Model Engine Switcher Strip */}
        <div className="flex items-center justify-between bg-[#f4f4f0] p-1.5 rounded-xl border border-[#E6E4DD] shrink-0 text-[11px]">
          <span className="font-semibold text-[#727972] uppercase tracking-wider pl-1">
            Voice STT:
          </span>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => setSelectedEngine('shruti')}
              className={`px-2 py-1 rounded-lg font-semibold transition-all cursor-pointer ${
                selectedEngine === 'shruti' || selectedEngine === 'auto'
                  ? 'bg-[#1A3826] text-white shadow-xs'
                  : 'text-[#424843] hover:text-[#1a1c1a]'
              }`}
              title="Udgam Labs Shruti: 29.5MB offline Hindi/Hinglish model"
            >
              Shruti (Hindi/Hinglish)
            </button>
            <button
              type="button"
              onClick={() => setSelectedEngine('cactus_whisper')}
              className={`px-2 py-1 rounded-lg font-semibold transition-all cursor-pointer ${
                selectedEngine === 'cactus_whisper'
                  ? 'bg-[#1A3826] text-white shadow-xs'
                  : 'text-[#424843] hover:text-[#1a1c1a]'
              }`}
              title="Cactus Compute Whistle: 16.9MB quantized English offline model"
            >
              Cactus (English)
            </button>
          </div>
        </div>

        {/* Global Toast Notice */}
        {confirmStatus && (
          <div className="p-3 bg-[#E8F0EC] border border-[#137333]/40 rounded-xl text-[12px] text-[#137333] flex items-center gap-2 font-semibold shadow-xs animate-fade-in shrink-0">
            <span className="material-symbols-outlined text-[18px]">check_circle</span>
            <span>{confirmStatus}</span>
          </div>
        )}

        {/* Chat Conversation Scroll Area */}
        <div className="flex-1 overflow-y-auto space-y-3 pr-1 max-h-[46vh] min-h-[160px]">
          {messages.map((m) => (
            <div
              key={m.id}
              className={`flex flex-col ${m.sender === 'user' ? 'items-end' : 'items-start'}`}
            >
              <div
                className={`max-w-[88%] rounded-2xl px-3.5 py-2.5 text-[13.5px] leading-relaxed shadow-xs ${
                  m.sender === 'user'
                    ? 'bg-[#1A3826] text-white rounded-br-xs'
                    : 'bg-[#f4f4f0] text-[#1a1c1a] border border-[#E6E4DD] rounded-bl-xs'
                }`}
              >
                <p className="whitespace-pre-line">{m.text}</p>

                {/* Proposal Action Card embedded inside assistant message */}
                {m.reply && !m.confirmed && m.reply.proposal_id && (
                  <div className="mt-3 p-3 bg-white rounded-xl border border-[#D1E2D7] flex flex-col gap-2.5 text-left text-[#1a1c1a] shadow-xs">
                    <div className="flex flex-wrap items-center justify-between border-b border-gray-100 pb-1.5 gap-1">
                      <div className="flex items-center gap-1.5 font-bold text-[12px] text-[#1A3826]">
                        <span className="material-symbols-outlined text-[16px]">
                          {m.reply.intent === 'modify_recipe'
                            ? 'edit_note'
                            : m.reply.intent === 'edit_schedule'
                            ? 'calendar_month'
                            : m.reply.intent === 'edit_plan'
                            ? 'restaurant_menu'
                            : 'inventory_2'}
                        </span>
                        <span className="uppercase tracking-wider">
                          {m.reply.classification_badge ||
                            (m.reply.intent === 'modify_recipe'
                              ? 'Recipe Modification'
                              : m.reply.intent === 'edit_schedule'
                              ? '7-Day Schedule'
                              : m.reply.intent === 'edit_plan'
                              ? 'Menu Slot Change'
                              : 'Inventory Stock Update')}
                        </span>
                      </div>
                      <span className="text-[10px] font-bold bg-[#E8F0EC] text-[#137333] px-2 py-0.5 rounded-full border border-[#137333]/20">
                        Pending Confirm
                      </span>
                    </div>

                    {/* Target Section Identifier */}
                    {m.reply.target_section && (
                      <div className="flex items-center gap-1.5 px-2.5 py-1 bg-[#f4f7f5] rounded-lg border border-[#d6e3da] text-[11px] text-[#1A3826]">
                        <span className="material-symbols-outlined text-[14px]">my_location</span>
                        <span className="font-semibold text-[#727972]">Section:</span>
                        <span className="font-bold">{m.reply.target_section}</span>
                      </div>
                    )}

                    {/* 1. Recipe Modification Card (e.g. increase sugar in Kheer to 150g) */}
                    {m.reply.recipe_modification && (
                      <div className="flex flex-col gap-1.5 bg-[#f8f9f7] p-2.5 rounded-xl border border-[#E6E4DD]">
                        <div className="flex items-center justify-between">
                          <span className="text-[11px] font-bold text-[#727972] uppercase tracking-wider">
                            Offline Saved Recipe:
                          </span>
                          <span className="text-[10px] bg-[#E8F0EC] text-[#137333] font-bold px-1.5 py-0.5 rounded">
                            Customization
                          </span>
                        </div>
                        <span className="text-[13px] font-bold text-[#1a1c1a]">
                          {m.reply.recipe_modification.recipe_title}
                        </span>
                        <div className="flex items-center justify-between pt-1">
                          <span className="text-[12.5px] font-medium text-[#424843]">
                            {m.reply.recipe_modification.ingredient_name}:
                          </span>
                          <div className="flex items-center gap-2 font-bold text-[12.5px]">
                            <span className="text-[#727972] line-through">
                              {m.reply.recipe_modification.old_qty}{m.reply.recipe_modification.unit}
                            </span>
                            <span className="text-[#137333]">→</span>
                            <span className="bg-[#E8F0EC] text-[#137333] px-2 py-0.5 rounded-md border border-[#137333]/30">
                              {m.reply.recipe_modification.new_qty}{m.reply.recipe_modification.unit}
                            </span>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* 2. Menu / Schedule Changes Card */}
                    {m.reply.plan_changes && m.reply.plan_changes.length > 0 && (
                      <div className="flex flex-col gap-1.5 bg-[#f8f9f7] p-2.5 rounded-xl border border-[#E6E4DD] max-h-36 overflow-y-auto">
                        <span className="text-[11px] font-bold text-[#727972] uppercase tracking-wider">
                          {m.reply.intent === 'edit_schedule' ? 'Weekly Schedule Slots:' : 'Proposed Meal Slot:'}
                        </span>
                        <div className="flex flex-col gap-1">
                          {m.reply.plan_changes.map((pc, idx) => (
                            <div key={idx} className="flex items-center justify-between text-[12px] border-b border-gray-100 pb-1 last:border-0 last:pb-0">
                              <span className="font-semibold text-[#1a1c1a] capitalize">
                                {pc.slot} ({pc.meal_date}):
                              </span>
                              <span className="text-[#3b684a] font-medium truncate max-w-[170px]">
                                {pc.recipe_title}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* 3. Stock Changes Card with Current Inventory Matching & Before/After */}
                    {m.reply.items && m.reply.items.length > 0 && (
                      <div className="flex flex-col gap-1.5 bg-[#f8f9f7] p-2.5 rounded-xl border border-[#E6E4DD] max-h-48 overflow-y-auto">
                        <div className="flex items-center justify-between mb-0.5">
                          <span className="text-[11px] font-bold text-[#727972] uppercase tracking-wider">
                            Inventory Items &amp; Stock Levels:
                          </span>
                          <span className="text-[10px] text-[#727972]">
                            {m.reply.items.filter((i) => i.is_existing).length} matched • {m.reply.items.filter((i) => !i.is_existing).length} new
                          </span>
                        </div>
                        {m.reply.items.map((it, idx) => (
                          <div
                            key={idx}
                            className="flex flex-col gap-1 bg-white p-2 rounded-lg border border-[#E6E4DD] text-[12px]"
                          >
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-1.5">
                                <span className="font-bold text-[#1a1c1a]">{it.name}</span>
                                <span
                                  className={`text-[9.5px] font-bold px-1.5 py-0.5 rounded-full ${
                                    it.is_existing
                                      ? 'bg-[#E8F0EC] text-[#137333] border border-[#137333]/20'
                                      : 'bg-[#FEF7E0] text-[#B06000] border border-[#B06000]/20'
                                  }`}
                                >
                                  {it.is_existing ? 'Matched in Stock' : 'New Item'}
                                </span>
                              </div>
                              <span className="text-[10px] font-semibold text-[#727972] bg-[#f4f4f0] px-1.5 py-0.5 rounded">
                                {it.location === 'fridge' ? '❄️ Fridge' : '📦 Pantry'}
                              </span>
                            </div>
                            <div className="flex items-center justify-between text-[11.5px] pt-0.5">
                              <span className="text-[#727972]">
                                Current:{' '}
                                <strong className="text-[#1a1c1a]">
                                  {it.before !== undefined && it.is_existing ? `${it.before} ${it.unit_base}` : '0 (Not in stock)'}
                                </strong>
                              </span>
                              <span
                                className={`font-bold px-1.5 py-0.2 rounded ${
                                  it.op === 'remove'
                                    ? 'text-[#ba1a1a] bg-[#fee2e2]'
                                    : 'text-[#137333] bg-[#E8F0EC]'
                                }`}
                              >
                                {it.op === 'remove' ? '-' : '+'}
                                {it.qty_base} {it.unit_base}
                              </span>
                              <span className="text-[#727972]">
                                Result:{' '}
                                <strong className="text-[#1A3826] font-bold">
                                  {it.after !== undefined ? `${it.after} ${it.unit_base}` : `${it.qty_base} ${it.unit_base}`}
                                </strong>
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Confirm & Discard Action Buttons */}
                    <div className="flex items-center gap-2 pt-1">
                      <button
                        className="flex-1 py-1.5 rounded-xl bg-[#1A3826] text-white text-[12px] font-bold flex items-center justify-center gap-1.5 shadow-xs hover:bg-[#132a1d] active:scale-95 transition-all cursor-pointer"
                        type="button"
                        onClick={() => handleConfirmMessageProposal(m.id, m.reply!)}
                      >
                        <span className="material-symbols-outlined text-[16px]">check</span>
                        <span>Confirm &amp; Apply</span>
                      </button>
                      <button
                        className="px-3 py-1.5 rounded-xl bg-white border border-[#E6E4DD] text-[#727972] text-[12px] font-semibold hover:bg-[#f4f4f0] cursor-pointer"
                        type="button"
                        onClick={() => handleDiscardMessageProposal(m.id, m.reply!)}
                      >
                        Discard
                      </button>
                    </div>
                  </div>
                )}

                {/* Confirmed Indicator & Auto-Applied Items Summary */}
                {m.confirmed && (
                  <div className="mt-2 flex flex-col gap-1.5">
                    {m.reply?.auto_applied && m.reply.items && m.reply.items.length > 0 && (
                      <div className="p-2.5 bg-white rounded-xl border border-[#D1E2D7] flex flex-col gap-1 text-[11.5px]">
                        <span className="text-[10.5px] font-bold text-[#1A3826] uppercase tracking-wider">
                          Restocked Items ({m.reply.items.length}):
                        </span>
                        {m.reply.items.map((it, idx) => (
                          <div key={idx} className="flex items-center justify-between text-[#1a1c1a]">
                            <span className="font-semibold">{it.name}</span>
                            <span className="text-[#137333] font-bold">
                              +{it.qty_base} {it.unit_base} → {it.after} {it.unit_base}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                    <div className="text-[11px] font-bold text-[#137333] flex items-center gap-1 bg-[#E8F0EC] px-2.5 py-1 rounded-lg">
                      <span className="material-symbols-outlined text-[15px]">check_circle</span>
                      <span>
                        {m.reply?.auto_applied
                          ? 'Auto-Applied to Kitchen Stock & Cleared Missing Items!'
                          : 'Applied to offline database!'}
                      </span>
                    </div>
                  </div>
                )}
              </div>
              <span className="text-[10px] text-[#727972] mt-0.5 px-1">{m.time}</span>
            </div>
          ))}

          {loading && (
            <div className="flex items-center gap-2 text-[#727972] text-[12px] p-2 bg-[#f4f4f0] rounded-xl w-fit">
              <span className="w-3.5 h-3.5 border-2 border-[#1A3826]/30 border-t-[#1A3826] rounded-full animate-spin"></span>
              <span>Omnirush is processing your request...</span>
            </div>
          )}

          <div ref={chatBottomRef} />
        </div>

        {/* Quick Action Suggestion Chips */}
        <div className="flex flex-col gap-1 shrink-0 pt-1 border-t border-[#E6E4DD]">
          <div className="flex items-center justify-between text-[10.5px] text-[#727972]">
            <span className="font-semibold uppercase tracking-wider">Quick Commands</span>
            <span className="text-[10px] text-[#3b684a]">Tap to try</span>
          </div>
          <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-0.5">
            {actionPrompts.map((c, i) => (
              <button
                key={i}
                type="button"
                className="shrink-0 px-2.5 py-1 rounded-full bg-[#f4f4f0] border border-[#E6E4DD] text-[11px] text-[#1a1c1a] hover:bg-[#eeeeea] active:scale-95 transition-all cursor-pointer font-medium"
                onClick={() => handleSend(c.prompt)}
              >
                {c.label}
              </button>
            ))}
          </div>
        </div>

        {/* Live Mic Recording Banner with Real-Time Waveform */}
        {isRecording && recordingStatus === 'listening' && (
          <div className="flex items-center justify-between p-2.5 bg-[#fef2f2] border border-[#fca5a5] rounded-xl shrink-0">
            <div className="flex items-center gap-2 min-w-0">
              <span className="w-3 h-3 rounded-full bg-[#ba1a1a] animate-ping shrink-0"></span>
              <div className="flex flex-col min-w-0">
                <span className="text-[12px] font-bold text-[#ba1a1a]">
                  Listening ({selectedEngine === 'cactus_whisper' ? 'English Speech' : 'Hinglish / Hindi Speech'})...
                </span>
                <span className="text-[11px] text-[#727972] truncate">
                  {interimText ? `"${interimText}"` : 'Speak your kitchen command now'}
                </span>
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <div className="flex items-center gap-1 h-5">
                {[30, 60, 100, 80, 40].map((f, i) => (
                  <div
                    key={i}
                    className="w-1 bg-[#ba1a1a] rounded-full transition-all duration-75"
                    style={{
                      height: `${Math.max(4, Math.min(20, 4 + (volume / 100) * 16 * (f / 100)))}px`,
                    }}
                  />
                ))}
              </div>
              <button
                type="button"
                className="px-2.5 py-1 rounded-lg bg-[#ba1a1a] text-white text-[11px] font-bold cursor-pointer"
                onClick={handleStopRecording}
              >
                Stop &amp; Transcribe
              </button>
            </div>
          </div>
        )}

        {/* Transcribing Processing Indicator */}
        {recordingStatus === 'processing' && (
          <div className="flex items-center gap-2.5 p-2.5 bg-[#E8F0EC] border border-[#137333]/30 rounded-xl text-[12px] text-[#1A3826] font-semibold shrink-0">
            <span className="w-3.5 h-3.5 border-2 border-[#1A3826]/30 border-t-[#1A3826] rounded-full animate-spin shrink-0"></span>
            <span>Transcribing voice audio...</span>
          </div>
        )}

        {/* STT Result Metadata Pill */}
        {sttMeta && !isRecording && recordingStatus === 'idle' && (
          <div className="flex items-center justify-between px-3 py-1.5 bg-[#f4f7f5] border border-[#d6e3da] rounded-xl text-[11px] text-[#1A3826] shrink-0">
            <span className="font-semibold">
              🎙️ {sttMeta.engine} ({Math.round(sttMeta.confidence * 100)}% confidence)
            </span>
            <button
              type="button"
              className="text-[#727972] hover:text-[#1a1c1a] text-[10px] font-semibold cursor-pointer"
              onClick={() => setSttMeta(null)}
            >
              Dismiss
            </button>
          </div>
        )}

        {/* Microphone Permission / Iframe Policy Notice */}
        {micNotice && (
          <div className="p-3 bg-[#FEF7E0] border border-[#B06000]/30 rounded-xl text-[11.5px] text-[#B06000] flex flex-col gap-2 shrink-0">
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-[16px] shrink-0">mic_off</span>
                <span>{micNotice}</span>
              </div>
              <button
                type="button"
                onClick={() => setMicNotice(null)}
                className="text-[#B06000] hover:opacity-75 shrink-0 cursor-pointer"
              >
                <span className="material-symbols-outlined text-[16px]">close</span>
              </button>
            </div>
            <div className="flex items-center gap-2 flex-wrap pt-0.5">
              <a
                href={typeof window !== 'undefined' ? window.location.href : '#'}
                target="_blank"
                rel="noopener noreferrer"
                className="px-2.5 py-1 rounded-lg bg-[#1A3826] text-white text-[11px] font-bold flex items-center gap-1 hover:bg-[#132a1d] no-underline"
              >
                <span className="material-symbols-outlined text-[14px]">open_in_new</span>
                <span>Open App in New Tab (Enables Mic Popup)</span>
              </a>
              <label className="px-2.5 py-1 rounded-lg bg-white border border-[#B06000]/40 text-[#1a1c1a] text-[11px] font-bold flex items-center gap-1 cursor-pointer hover:bg-[#f4f4f0]">
                <span className="material-symbols-outlined text-[14px]">upload_file</span>
                <span>Upload / Record Audio File</span>
                <input
                  type="file"
                  accept="audio/*,video/webm"
                  capture="user"
                  className="hidden"
                  onChange={handleAudioFileUpload}
                />
              </label>
            </div>
          </div>
        )}

        {/* Input & Mic Bar */}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSend();
          }}
          className="flex items-center gap-2 shrink-0 pt-1"
        >
          {/* Live Mic Button */}
          <button
            type="button"
            onClick={handleToggleRecord}
            className={`w-11 h-11 rounded-full flex items-center justify-center transition-all shadow-xs shrink-0 cursor-pointer ${
              isRecording
                ? 'bg-[#ba1a1a] text-white ring-2 ring-[#ba1a1a]/40 animate-pulse'
                : 'bg-[#1A3826] text-white hover:bg-[#132a1d]'
            }`}
            title={isRecording ? 'Stop Recording' : 'Speak with Live Microphone'}
          >
            <span className="material-symbols-outlined text-[22px]">
              {isRecording ? 'stop' : 'mic'}
            </span>
          </button>

          {/* Upload / Record Audio File Button (works inside restricted iframes) */}
          <label
            className="w-10 h-10 rounded-full bg-[#f4f4f0] border border-[#E6E4DD] text-[#1A3826] hover:bg-[#e8e8e5] flex items-center justify-center shrink-0 cursor-pointer transition-all"
            title="Upload or capture a voice audio file for Gemini STT transcription"
          >
            <span className="material-symbols-outlined text-[19px]">audio_file</span>
            <input
              type="file"
              accept="audio/*,video/webm"
              capture="user"
              className="hidden"
              onChange={handleAudioFileUpload}
              disabled={loading || recordingStatus === 'processing'}
            />
          </label>

          {/* Text Input */}
          <div className="relative flex-1">
            <input
              type="text"
              className="w-full bg-[#f4f4f0] border border-[#E6E4DD] rounded-full px-4 py-2.5 text-[13.5px] text-[#1a1c1a] placeholder:text-[#727972] focus:outline-none focus:border-[#1A3826]"
              placeholder="Type or speak: 'increase sugar in Kheer to 150g' or stock update..."
              value={input}
              onChange={(e) => setInput(e.target.value)}
              disabled={loading}
            />
          </div>

          {/* Send Button */}
          <button
            className="w-11 h-11 rounded-full bg-[#1A3826] text-white flex items-center justify-center shadow-xs shrink-0 hover:bg-[#132a1d] disabled:opacity-40 cursor-pointer"
            type="submit"
            disabled={loading || !input.trim()}
            title="Send Message"
          >
            <span className="material-symbols-outlined text-[20px]">send</span>
          </button>
        </form>

        {error && (
          <div className="p-2.5 bg-[#ffdad6]/60 border border-[#ba1a1a]/30 rounded-xl text-[12px] text-[#93000a] flex items-center gap-2 shrink-0">
            <span className="material-symbols-outlined text-[16px]">error</span>
            <span>{error}</span>
          </div>
        )}
      </div>
    </div>
  );
};
