import React, { useState } from 'react';
import { Bot, Check, Send, Sparkles, Trash2, AlertTriangle } from 'lucide-react';
import { OmnirushMode, OmnirushResponse } from '../types';
import { askOmnirush } from '../services/omnirush';
import { store } from '../services/store';

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

  const handleSend = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const promptText = text.trim();
    if (!promptText) return;

    setError(null);
    setLoading(true);

    try {
      const response = await askOmnirush(promptText, mode);
      setReply(response);
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

  const setPromptChip = (chipText: string, chipMode?: OmnirushMode) => {
    setText(chipText);
    if (chipMode) setMode(chipMode);
  };

  return (
    <section id="tab-chat">
      <div className="card">
        <h2>
          <span>Ask Omnirush</span>
          <Bot size={14} style={{ color: 'var(--accent)' }} />
        </h2>
        <div className="muted">
          llama 3.1 on the laptop; replies take 8 to 30 seconds. (Confirm-before-write safety enforced).
        </div>

        <form onSubmit={handleSend} style={{ marginTop: '10px' }}>
          <textarea
            id="text"
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="do kilo aloo aur ek litre dahi add kar do"
            disabled={loading}
          />

          {/* Quick example prompt chips */}
          <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', margin: '8px 0' }}>
            <button
              type="button"
              className="pill"
              style={{ fontSize: '11px', padding: '3px 8px' }}
              onClick={() => setPromptChip('do kilo aloo aur ek litre dahi add kar do', 'chat')}
            >
              + 2kg aloo & 1L dahi
            </button>
            <button
              type="button"
              className="pill"
              style={{ fontSize: '11px', padding: '3px 8px' }}
              onClick={() => setPromptChip('Suggest lunch and dinner for today from stock', 'plan')}
            >
              Suggest today's meals
            </button>
            <button
              type="button"
              className="pill"
              style={{ fontSize: '11px', padding: '3px 8px' }}
              onClick={() => setPromptChip('What missing items should we add to cart?', 'cart')}
            >
              Cart missing items
            </button>
            <button
              type="button"
              className="pill"
              style={{ fontSize: '11px', padding: '3px 8px' }}
              onClick={() => setPromptChip('atta khatam ho gaya 500g', 'chat')}
            >
              - 500g atta
            </button>
          </div>

          <div className="row" style={{ marginTop: '8px' }}>
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
