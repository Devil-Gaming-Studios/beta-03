import React, { useState, useEffect } from 'react';
import { Bot, Check, Send, Sparkles, Trash2, AlertTriangle, Mic, MicOff, CloudOff } from 'lucide-react';
import { OmnirushMode, OmnirushResponse } from '../types';
import { askOmnirush } from '../services/omnirush';
import { store } from '../services/store';
import {
  sttController,
  STTEngineType,
  STTResult,
  transcribeWithRouting,
} from '../services/sttService';

interface ChatTabProps {
  onRefresh: () => void;
}

export const ChatTab: React.FC<ChatTabProps> = ({ onRefresh }) => {
  const [text, setText] = useState('');
  const [mode, setMode] = useState<OmnirushMode>('chat');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reply, setReply] = useState<OmnirushResponse | null>(null);
  const [confirming, setConfirming] = useState(false);

  // STT Voice State
  const [selectedEngine, setSelectedEngine] = useState<STTEngineType>('auto');
  const [isRecording, setIsRecording] = useState(false);
  const [sttMeta, setSttMeta] = useState<STTResult | null>(null);

  useEffect(() => {
    return () => {
      sttController.stop();
    };
  }, []);

  const handleToggleVoice = async () => {
    if (isRecording) {
      sttController.stop({
        preference: selectedEngine,
        onFinal: (result) => {
          setIsRecording(false);
          setText(result.transcript);
          setSttMeta(result);
        },
      });
      return;
    }

    setError(null);
    setIsRecording(true);

    await sttController.start({
      preference: selectedEngine,
      onInterim: (interim) => {
        setText(interim);
      },
      onFinal: (result) => {
        setIsRecording(false);
        setText(result.transcript);
        setSttMeta(result);
      },
      onError: (err) => {
        setIsRecording(false);
        setError(err);
      },
    });
  };

  const handleSend = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const promptText = text.trim();
    if (!promptText) return;

    setError(null);
    setLoading(true);

    try {
      const response = await askOmnirush(promptText, mode);
      setReply(response);
      setSttMeta(null);
    } catch (err: any) {
      setError(err.message || 'Failed to communicate with Omnirush');
    } finally {
      setLoading(false);
    }
  };

  const handleConfirm = () => {
    if (!reply?.proposal_id) return;
    setConfirming(true);
    try {
      store.confirmProposal(reply.proposal_id);
      setReply(null);
      setText('');
      onRefresh();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setConfirming(false);
    }
  };

  const handleDiscard = () => {
    if (reply?.proposal_id) {
      store.discardProposal(reply.proposal_id);
    }
    setReply(null);
  };

  const setPromptChip = async (chipText: string, chipMode?: OmnirushMode, enginePref: STTEngineType = 'shruti') => {
    setText(chipText);
    if (chipMode) setMode(chipMode);
    const routed = await transcribeWithRouting(chipText, enginePref);
    setSttMeta(routed);
  };

  return (
    <section id="tab-chat">
      <div className="card">
        <h2>
          <span>Ask Omnirush</span>
          <Bot size={14} style={{ color: 'var(--accent)' }} />
        </h2>
        <div className="muted" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '4px' }}>
          <span>Offline Speech-to-Text: Shruti (Hindi/Hinglish) & Cactus Whisper (English)</span>
          <span className="pill ok" style={{ fontSize: '10px' }}>Local-First STT</span>
        </div>

        {/* STT Engine Selector */}
        <div style={{ display: 'flex', gap: '6px', alignItems: 'center', marginTop: '10px', flexWrap: 'wrap' }}>
          <span style={{ fontSize: '11px', color: 'var(--dim)', textTransform: 'uppercase', fontWeight: 600 }}>STT Engine:</span>
          <button
            type="button"
            className={`pill ${selectedEngine === 'auto' ? 'ok' : ''}`}
            onClick={() => setSelectedEngine('auto')}
            style={{ cursor: 'pointer' }}
          >
            Auto-Detect
          </button>
          <button
            type="button"
            className={`pill ${selectedEngine === 'shruti' ? 'ok' : ''}`}
            onClick={() => setSelectedEngine('shruti')}
            style={{ cursor: 'pointer' }}
            title="Shruti: Hindi & Hinglish Offline Model"
          >
            Shruti (Hindi/Hinglish - Offline)
          </button>
          <button
            type="button"
            className={`pill ${selectedEngine === 'cactus_whisper' ? 'ok' : ''}`}
            onClick={() => setSelectedEngine('cactus_whisper')}
            style={{ cursor: 'pointer' }}
            title="Cactus Whisper: English Offline Model"
          >
            Cactus Whisper (English - Offline)
          </button>
          <button
            type="button"
            className={`pill ${selectedEngine === 'sarvam_saaras' ? 'ok' : ''}`}
            onClick={() => setSelectedEngine('sarvam_saaras')}
            style={{ cursor: 'pointer' }}
            title="Sarvam Saaras v3: Cloud Fallback"
          >
            Sarvam Cloud
          </button>
        </div>

        <form onSubmit={handleSend} style={{ marginTop: '10px' }}>
          <div style={{ position: 'relative' }}>
            <textarea
              id="text"
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="do kilo aloo aur ek litre dahi add kar do / add 2 kg potatoes"
              disabled={loading}
              style={{
                borderColor: sttMeta?.lowConfidence ? 'var(--warn)' : undefined,
                background: isRecording ? '#1a221b' : undefined,
              }}
            />
          </div>

          {/* STT Status & Confidence Indicator */}
          {sttMeta && (
            <div style={{
              background: sttMeta.lowConfidence ? '#2a2312' : '#14281a',
              border: `1px solid ${sttMeta.lowConfidence ? 'var(--warn)' : 'var(--accent)'}`,
              borderRadius: '8px',
              padding: '6px 10px',
              margin: '8px 0',
              fontSize: '12px',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: '6px'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <CloudOff size={13} style={{ color: sttMeta.isOffline ? 'var(--accent)' : 'var(--dim)' }} />
                <span>Engine: <strong>{sttMeta.engine}</strong></span>
                {sttMeta.fallbackTriggered && (
                  <span className="pill" style={{ color: 'var(--accent)', borderColor: 'var(--accent)', fontSize: '10px' }}>Cloud Fallback</span>
                )}
              </div>
              <div>
                <span>Confidence: <strong>{Math.round(sttMeta.confidence * 100)}%</strong></span>
                {sttMeta.lowConfidence && (
                  <span style={{ color: 'var(--warn)', marginLeft: '6px', fontWeight: 600 }}>
                    (Low - please check before sending)
                  </span>
                )}
              </div>
            </div>
          )}

          {/* Quick example prompt chips */}
          <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', margin: '8px 0' }}>
            <button
              type="button"
              className="pill"
              style={{ fontSize: '11px', padding: '3px 8px' }}
              onClick={() => setPromptChip('do kilo aloo aur ek litre dahi add kar do', 'chat', 'shruti')}
              title="Test with Shruti"
            >
              [Shruti] + 2kg aloo & 1L dahi
            </button>
            <button
              type="button"
              className="pill"
              style={{ fontSize: '11px', padding: '3px 8px' }}
              onClick={() => setPromptChip('add 2 kg potatoes and check dinner recipe', 'chat', 'cactus_whisper')}
              title="Test with Cactus Whisper"
            >
              [Cactus] + 2kg potatoes
            </button>
            <button
              type="button"
              className="pill"
              style={{ fontSize: '11px', padding: '3px 8px', color: 'var(--accent)', borderColor: 'var(--accent)' }}
              onClick={() => setPromptChip('increase sugar in Kheer to 150g', 'chat', 'shruti')}
              title="Modify offline recipe"
            >
              🍯 [Recipe] Sugar in Kheer 150g
            </button>
            <button
              type="button"
              className="pill"
              style={{ fontSize: '11px', padding: '3px 8px', color: 'var(--warn)', borderColor: 'var(--warn)' }}
              onClick={() => setPromptChip('change dinner today to Paneer Bhurji', 'plan', 'cactus_whisper')}
              title="Change specific meal slot"
            >
              🍲 [Menu] Dinner → Paneer Bhurji
            </button>
            <button
              type="button"
              className="pill"
              style={{ fontSize: '11px', padding: '3px 8px' }}
              onClick={() => setPromptChip('plan full schedule for this week', 'plan', 'cactus_whisper')}
              title="Schedule entire week"
            >
              📅 [Schedule] Plan 7 Days
            </button>
            <button
              type="button"
              className="pill"
              style={{ fontSize: '11px', padding: '3px 8px' }}
              onClick={() => setPromptChip('atta khatam ho gaya 500g', 'chat', 'shruti')}
            >
              [Shruti] - 500g atta
            </button>
          </div>

          <div className="row" style={{ marginTop: '8px', alignItems: 'center' }}>
            <button
              type="button"
              className={isRecording ? 'act' : 'ghost'}
              onClick={handleToggleVoice}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                background: isRecording ? '#ba1a1a' : undefined,
                color: isRecording ? '#fff' : undefined,
              }}
              title="Record with Shruti or Cactus Whisper"
            >
              {isRecording ? <MicOff size={14} /> : <Mic size={14} />}
              <span>{isRecording ? 'Stop Mic' : 'Voice Input'}</span>
            </button>

            <select
              id="mode"
              value={mode}
              onChange={(e) => setMode(e.target.value as OmnirushMode)}
              style={{ width: '90px' }}
            >
              <option value="chat">chat</option>
              <option value="plan">plan</option>
              <option value="cart">cart</option>
            </select>

            <button className="act" id="send" type="submit" disabled={loading || !text.trim()}>
              {loading ? (
                <>
                  <span className="spinner"></span> thinking
                </>
              ) : (
                <>
                  <Send size={13} />
                  Send
                </>
              )}
            </button>
          </div>
        </form>

        {error && (
          <div id="chat-error" className="err" style={{ marginTop: '10px' }}>
            {error}
          </div>
        )}
      </div>

      {reply && (
        <div className="card" id="reply">
          <h2>
            <span>Proposal</span>
            <Sparkles size={14} style={{ color: 'var(--warn)' }} />
          </h2>

          <div id="reply-message" style={{ fontSize: '14px', lineHeight: '1.5' }}>
            {reply.message || '(no message)'}
          </div>

          {reply.warnings && reply.warnings.length > 0 && (
            <div id="reply-warnings" className="warn" style={{ marginTop: '8px', display: 'flex', gap: '6px' }}>
              <AlertTriangle size={13} style={{ flexShrink: 0, marginTop: '2px' }} />
              <div>{reply.warnings.join(' · ')}</div>
            </div>
          )}

          {reply.unmatched && reply.unmatched.length > 0 && (
            <div id="reply-unmatched" className="muted" style={{ marginTop: '6px' }}>
              Unmatched: {reply.unmatched.map((u) => `${u.raw_name} (${u.reason})`).join(', ')}
            </div>
          )}

          {reply.items && reply.items.length > 0 && (
            <table className="items" id="reply-items">
              <thead>
                <tr>
                  <th>Item</th>
                  <th>Change</th>
                  <th>Stock after</th>
                </tr>
              </thead>
              <tbody>
                {reply.items.map((it, idx) => (
                  <tr key={idx}>
                    <td style={{ fontWeight: 600 }}>{it.name}</td>
                    <td>
                      <span style={{ color: it.op === 'remove' ? 'var(--bad)' : 'var(--accent)' }}>
                        {it.op} {Math.round(it.qty_base)} {it.unit_base}
                      </span>
                    </td>
                    <td style={{ fontVariantNumeric: 'tabular-nums' }}>
                      {it.before !== undefined && it.after !== undefined
                        ? `${Math.round(it.before)} → ${Math.round(it.after)} ${it.unit_base}`
                        : `${it.qty_base} ${it.unit_base}`}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          {reply.recipe_modification && (
            <div style={{ marginTop: '10px', background: '#1c241d', border: '1px solid var(--accent)', borderRadius: '10px', padding: '10px' }}>
              <div style={{ fontSize: '11px', textTransform: 'uppercase', color: 'var(--accent)', fontWeight: 600 }}>
                Offline Recipe Modification
              </div>
              <div style={{ fontSize: '14px', fontWeight: 'bold', marginTop: '4px' }}>
                {reply.recipe_modification.recipe_title}
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '6px', fontSize: '13px' }}>
                <span>{reply.recipe_modification.ingredient_name}:</span>
                <span style={{ fontWeight: 'bold', color: 'var(--accent)' }}>
                  <span style={{ textDecoration: 'line-through', color: 'var(--dim)', marginRight: '6px' }}>
                    {reply.recipe_modification.old_qty}{reply.recipe_modification.unit}
                  </span>
                  → {reply.recipe_modification.new_qty}{reply.recipe_modification.unit}
                </span>
              </div>
            </div>
          )}

          {reply.plan_changes && reply.plan_changes.length > 0 && (
            <div style={{ marginTop: '10px', borderTop: '1px solid var(--line)', paddingTop: '8px' }}>
              <div style={{ fontSize: '11px', textTransform: 'uppercase', color: 'var(--dim)', fontWeight: 600, marginBottom: '4px' }}>
                Proposed Meal Plan Changes
              </div>
              {reply.plan_changes.map((pc, idx) => (
                <div key={idx} style={{ fontSize: '13px', padding: '3px 0' }}>
                  • <strong style={{ textTransform: 'capitalize' }}>{pc.slot}</strong> ({pc.meal_date}): {pc.recipe_title || 'Meal'} ({pc.servings} servings)
                </div>
              ))}
            </div>
          )}

          <div id="reply-meta" className="muted" style={{ marginTop: '10px' }}>
            {reply.intent || 'no proposal'} · {reply.timing?.model || 'local'} · {reply.elapsed_ms || 0}ms
          </div>

          <div className="row" style={{ marginTop: '12px' }} id="reply-actions">
            {reply.proposal_id ? (
              <>
                <button className="act" id="confirm" onClick={handleConfirm} disabled={confirming}>
                  <Check size={14} />
                  Confirm
                </button>
                <button className="ghost" id="discard" onClick={handleDiscard} disabled={confirming}>
                  <Trash2 size={13} />
                  Discard
                </button>
              </>
            ) : (
              <button className="ghost" onClick={handleDiscard}>
                Dismiss
              </button>
            )}
          </div>
        </div>
      )}
    </section>
  );
};
