import React from 'react';
import { ChefHat, ShieldCheck, Users } from 'lucide-react';
import { Household, User } from '../types';

interface HeaderProps {
  household: Household;
  user: User;
  role: string;
  onOpenSettings: () => void;
}

export const Header: React.FC<HeaderProps> = ({ household, role, onOpenSettings }) => {
  return (
    <div className="top">
      <h1>
        <span style={{ fontSize: '20px' }}>🍲</span>
        Mast Meals
      </h1>
      <button
        id="who"
        className="pill ok"
        onClick={onOpenSettings}
        title="Household Profile and Settings"
      >
        <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: 'var(--accent)' }}></span>
        <span>{household.name} · {role}</span>
        <Users size={12} style={{ opacity: 0.7 }} />
      </button>
    </div>
  );
};
