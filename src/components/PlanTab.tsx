import React, { useState } from 'react';
import { Check, Flame, Info, Plus, SkipForward, UtensilsCrossed } from 'lucide-react';
import { MealPlan, PlannedMeal, Recipe, MealSlot } from '../types';
import { store } from '../services/store';

interface PlanTabProps {
  plan: MealPlan;
  recipes: Recipe[];
  onRefresh: () => void;
  onViewRecipe: (recipeId: string, servings: number) => void;
}

export const PlanTab: React.FC<PlanTabProps> = ({ plan, recipes, onRefresh, onViewRecipe }) => {
  const [selectedRecipeId, setSelectedRecipeId] = useState(recipes[0]?.id || '');
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [slot, setSlot] = useState<MealSlot>('lunch');
  const [servings, setServings] = useState(2);
  const [loading, setLoading] = useState(false);
  const [actionNotice, setActionNotice] = useState<string | null>(null);

  const handleAddMeal = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedRecipeId) return;
    try {
      store.addMeal(date, slot, selectedRecipeId, Number(servings));
      setActionNotice('Meal successfully added to plan!');
      setTimeout(() => setActionNotice(null), 3000);
      onRefresh();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleMarkDone = (mealId: string) => {
    setLoading(true);
    try {
      const res = store.markDone(mealId);
      const itemsDeducted = res.deducted.map((d: any) => `${d.qty}${d.unit} ${d.name}`).join(', ');
      setActionNotice(`Meal completed! Auto-deducted from kitchen stock: ${itemsDeducted}`);
      setTimeout(() => setActionNotice(null), 4500);
      onRefresh();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSkip = (mealId: string) => {
    setLoading(true);
    try {
      store.markSkip(mealId);
      setActionNotice('Meal marked as skipped.');
      setTimeout(() => setActionNotice(null), 2500);
      onRefresh();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <section id="tab-plan">
      {actionNotice && (
        <div
          style={{
            background: 'rgba(74, 222, 128, 0.15)',
            border: '1px solid rgba(74, 222, 128, 0.4)',
            color: 'var(--accent)',
            padding: '8px 12px',
            borderRadius: '10px',
            fontSize: '12.5px',
            marginBottom: '10px',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
          }}
        >
          <Check size={14} />
          {actionNotice}
        </div>
      )}

      <div className="card">
        <h2>
          <span>This week</span>
          <span style={{ fontSize: '11px', textTransform: 'none', color: 'var(--dim)', fontWeight: 400 }}>
            Week of {plan.week_start}
          </span>
        </h2>

        <div id="meals">
          {plan.meals.length === 0 ? (
            <div className="muted" style={{ padding: '8px 0' }}>
              No meals planned yet for this week. Use the form below or ask Omnirush to suggest meals!
            </div>
          ) : (
            plan.meals.map((m) => {
              const missingNames = (m.missing || []).map((x) => x.name).join(', ');
              return (
                <div key={m.id} className="meal">
                  <div style={{ flex: 1 }}>
                    <div
                      className="t"
                      style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}
                      onClick={() => onViewRecipe(m.household_recipe_id, m.servings)}
                      title="Click to view recipe ingredients and nutrition"
                    >
                      <span>{m.title || 'Meal'}</span>
                      <Info size={13} style={{ color: 'var(--dim)', opacity: 0.7 }} />
                    </div>
                    <div className="s">
                      {m.meal_date} · <span style={{ textTransform: 'capitalize' }}>{m.slot}</span> · {m.servings} servings
                    </div>
                    <div style={{ marginTop: '5px' }}>
                      <span className={`tag ${m.status === 'done' ? 'done' : ''}`}>{m.status}</span>
                      {missingNames && (
                        <span className="tag miss">short: {missingNames}</span>
                      )}
                      {m.nutrition && m.nutrition.kcal ? (
                        <span className="tag" style={{ borderStyle: 'dotted' }}>
                          🔥 {m.nutrition.kcal} kcal
                        </span>
                      ) : null}
                    </div>

                    {m.status === 'planned' && (
                      <div className="row" style={{ marginTop: '8px' }}>
                        <button
                          className="ghost"
                          onClick={() => handleMarkDone(m.id)}
                          disabled={loading}
                        >
                          <Check size={13} style={{ color: 'var(--accent)' }} />
                          Mark done
                        </button>
                        <button
                          className="ghost"
                          onClick={() => handleSkip(m.id)}
                          disabled={loading}
                        >
                          <SkipForward size={13} />
                          Skip
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      <div className="card">
        <h2>
          <span>Add a meal</span>
          <UtensilsCrossed size={14} style={{ color: 'var(--dim)' }} />
        </h2>
        <form onSubmit={handleAddMeal}>
          <div className="row">
            <select
              id="recipe"
              value={selectedRecipeId}
              onChange={(e) => setSelectedRecipeId(e.target.value)}
              style={{ flex: '1 1 180px' }}
            >
              {recipes.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.title} ({r.category})
                </option>
              ))}
            </select>

            <input
              id="date"
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              style={{ flex: '1 1 130px' }}
            />

            <select
              id="slot"
              value={slot}
              onChange={(e) => setSlot(e.target.value as MealSlot)}
              style={{ flex: '1 1 100px' }}
            >
              <option value="breakfast">breakfast</option>
              <option value="lunch">lunch</option>
              <option value="dinner">dinner</option>
            </select>

            <input
              id="servings"
              type="number"
              min="1"
              max="20"
              value={servings}
              onChange={(e) => setServings(Number(e.target.value))}
              style={{ width: '80px' }}
              title="Number of servings"
            />
          </div>

          <div className="row" style={{ marginTop: '10px' }}>
            <button className="act" type="submit" id="add-meal">
              <Plus size={14} />
              Add
            </button>
          </div>
        </form>
      </div>
    </section>
  );
};
