import React, { useState } from 'react';
import { Plus, Shield, Trash2, X, Activity, Users, Settings2 } from 'lucide-react';
import { Household, HouseholdMember, AgeGroup, DietCaution, AppLanguage } from '../types';
import { store } from '../services/store';

interface HouseholdModalProps {
  isOpen: boolean;
  onClose: () => void;
  household: Household;
  members: HouseholdMember[];
  onRefresh: () => void;
}

export const HouseholdModal: React.FC<HouseholdModalProps> = ({
  isOpen,
  onClose,
  household,
  members,
  onRefresh,
}) => {
  if (!isOpen) return null;

  const [hhName, setHhName] = useState(household.name);
  const [hasFridge, setHasFridge] = useState(household.has_fridge);
  const [language, setLanguage] = useState<AppLanguage>(household.language);

  // New member form
  const [newLabel, setNewLabel] = useState('');
  const [newAgeGroup, setNewAgeGroup] = useState<AgeGroup>('adult');
  const [newCautions, setNewCautions] = useState<DietCaution[]>([]);

  const handleSaveHousehold = (e: React.FormEvent) => {
    e.preventDefault();
    store.updateHousehold({
      name: hhName,
      has_fridge: hasFridge,
      language,
    });
    onRefresh();
  };

  const handleAddMember = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newAgeGroup) return;
    store.addMember(newAgeGroup as any, newLabel.trim() || undefined, newCautions);
    setNewLabel('');
    setNewCautions([]);
    onRefresh();
  };

  const handleDeleteMember = (memberId: string) => {
    store.deleteMember(memberId);
    onRefresh();
  };

  const toggleCaution = (c: DietCaution) => {
    setNewCautions((prev) =>
      prev.includes(c) ? prev.filter((item) => item !== c) : [...prev, c]
    );
  };

  const handleSwitchHousehold = (id: string, userId: string) => {
    store.switchHousehold(id, userId);
    onRefresh();
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Settings2 size={18} style={{ color: 'var(--accent)' }} />
            <h3>Household & Members</h3>
          </div>
          <button className="close-btn" onClick={onClose}>
            <X size={18} />
          </button>
        </div>

        {/* Household Profile */}
        <div style={{ marginBottom: '18px' }}>
          <h4 style={{ margin: '0 0 10px', fontSize: '13px', color: 'var(--dim)', textTransform: 'uppercase' }}>
            Profile (Section 2.1)
          </h4>
          <form onSubmit={handleSaveHousehold}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <div>
                <label style={{ fontSize: '12px', color: 'var(--dim)', display: 'block', marginBottom: '4px' }}>
                  Household Name
                </label>
                <input
                  type="text"
                  value={hhName}
                  onChange={(e) => setHhName(e.target.value)}
                  style={{ width: '100%' }}
                />
              </div>

              <div style={{ display: 'flex', gap: '14px', alignItems: 'center', marginTop: '4px' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={hasFridge}
                    onChange={(e) => setHasFridge(e.target.checked)}
                  />
                  Has Refrigerator (Fridge)
                </label>

                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginLeft: 'auto' }}>
                  <label style={{ fontSize: '12px', color: 'var(--dim)' }}>Language:</label>
                  <select
                    value={language}
                    onChange={(e) => setLanguage(e.target.value as AppLanguage)}
                    style={{ padding: '4px 8px', fontSize: '12px' }}
                  >
                    <option value="en">English</option>
                    <option value="hi">Hindi (हिंदी)</option>
                    <option value="hinglish">Hinglish</option>
                  </select>
                </div>
              </div>

              <button className="ghost" type="submit" style={{ marginTop: '6px', alignSelf: 'flex-start' }}>
                Save Profile
              </button>
            </div>
          </form>
        </div>

        {/* Household Members */}
        <div style={{ marginBottom: '18px', borderTop: '1px solid var(--line)', paddingTop: '14px' }}>
          <h4 style={{ margin: '0 0 10px', fontSize: '13px', color: 'var(--dim)', textTransform: 'uppercase', display: 'flex', justifyContent: 'space-between' }}>
            <span>Members & Diet Cautions</span>
            <Users size={14} />
          </h4>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '12px' }}>
            {members.map((m) => (
              <div
                key={m.id}
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  background: '#11141a',
                  border: '1px solid var(--line)',
                  borderRadius: '10px',
                  padding: '8px 10px',
                }}
              >
                <div>
                  <div style={{ fontWeight: 600, fontSize: '13.5px' }}>
                    {m.label || 'Member'} <span className="tag" style={{ fontSize: '10px' }}>{m.age_group}</span>
                  </div>
                  {m.cautions.length > 0 ? (
                    <div style={{ marginTop: '3px', display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                      {m.cautions.map((c) => (
                        <span key={c} className="tag warn" style={{ fontSize: '10px' }}>
                          ⚠️ {c.replace('_', ' ')}
                        </span>
                      ))}
                    </div>
                  ) : (
                    <div style={{ fontSize: '11px', color: 'var(--dim)' }}>No diet cautions</div>
                  )}
                </div>

                <button
                  className="ghost"
                  style={{ padding: '4px 8px', color: 'var(--bad)' }}
                  onClick={() => handleDeleteMember(m.id)}
                  title="Remove member"
                >
                  <Trash2 size={13} />
                </button>
              </div>
            ))}
          </div>

          {/* Add member form */}
          <form onSubmit={handleAddMember} style={{ background: '#121620', border: '1px dashed var(--line)', padding: '10px', borderRadius: '10px' }}>
            <div style={{ fontSize: '12px', fontWeight: 600, marginBottom: '6px', color: 'var(--text)' }}>
              Add Household Member
            </div>
            <div className="row" style={{ gap: '6px' }}>
              <input
                type="text"
                placeholder="Name / Label (e.g. Dadi)"
                value={newLabel}
                onChange={(e) => setNewLabel(e.target.value)}
                style={{ flex: '1 1 140px', fontSize: '12.5px' }}
              />

              <select
                value={newAgeGroup}
                onChange={(e) => setNewAgeGroup(e.target.value as AgeGroup)}
                style={{ width: '100px', fontSize: '12.5px' }}
              >
                <option value="kid">Kid</option>
                <option value="adult">Adult</option>
                <option value="elderly">Elderly</option>
              </select>
            </div>

            <div style={{ marginTop: '8px' }}>
              <div style={{ fontSize: '11px', color: 'var(--dim)', marginBottom: '4px' }}>
                Diet Cautions (Section 2.1):
              </div>
              <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                {(['diabetes', 'upset_stomach', 'heart'] as DietCaution[]).map((c) => (
                  <button
                    key={c}
                    type="button"
                    className={`pill ${newCautions.includes(c) ? 'bad' : ''}`}
                    style={{ fontSize: '11px' }}
                    onClick={() => toggleCaution(c)}
                  >
                    {newCautions.includes(c) ? '✓ ' : '+ '}
                    {c.replace('_', ' ')}
                  </button>
                ))}
              </div>
            </div>

            <div style={{ marginTop: '10px' }}>
              <button className="act" type="submit" style={{ padding: '6px 12px', fontSize: '12px' }}>
                <Plus size={13} />
                Add Member
              </button>
            </div>
          </form>
        </div>

        {/* Demo Household Switcher */}
        <div style={{ borderTop: '1px solid var(--line)', paddingTop: '14px' }}>
          <h4 style={{ margin: '0 0 6px', fontSize: '12.5px', color: 'var(--dim)', textTransform: 'uppercase' }}>
            Test Cross-Household Isolation
          </h4>
          <div style={{ fontSize: '11.5px', color: 'var(--dim)', marginBottom: '8px' }}>
            Switch households to verify separate stock, custom recipes, and independent meal plans:
          </div>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              className={`pill ${household.id === 'hh_alpha' ? 'ok' : ''}`}
              onClick={() => handleSwitchHousehold('hh_alpha', 'usr_alpha')}
            >
              My Kitchen (Alpha)
            </button>
            <button
              className={`pill ${household.id === 'hh_beta' ? 'ok' : ''}`}
              onClick={() => handleSwitchHousehold('hh_beta', 'usr_beta')}
            >
              Sharma's Kitchen (Beta)
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
