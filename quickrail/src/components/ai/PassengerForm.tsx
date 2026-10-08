import React, { useState } from 'react';
import type { Card, AiAction } from '../../services/aiApi';

type FormCard = Extract<Card, { type: 'passengerForm' }>;
const BERTHS = ['No Preference', 'Lower (LB)', 'Middle (MB)', 'Upper (UB)', 'Side Lower (SL)', 'Side Upper (SU)'];
const GENDERS = ['Male', 'Female', 'Transgender'] as const;

interface Slot { savedId: string | ''; name: string; age: string; gender: (typeof GENDERS)[number] | ''; berth: string; save: boolean }

const input = 'w-full rounded-md border border-[#c4c6cf] bg-white px-2 py-1.5 text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-[#ff8928]';

/** Passenger details are sent as a button action straight to the API — never typed into the chat transcript. */
export function PassengerForm({ card, active, busy, onAction }: { card: FormCard; active: boolean; busy: boolean; onAction: (a: AiAction) => void }) {
  const [slots, setSlots] = useState<Slot[]>(() =>
    Array.from({ length: card.count }, (_, i) => {
      const pre = card.preselected[i] ? card.saved.find((s) => s.id === card.preselected[i]) : undefined;
      const cur = card.current[i];
      return {
        savedId: pre?.id || '', name: pre ? '' : cur?.name || '', age: pre ? '' : cur ? String(cur.age) : '',
        gender: pre ? '' : ((cur?.gender as Slot['gender']) || ''), berth: cur?.berthPreference || card.defaultBerth || 'No Preference', save: false,
      };
    }),
  );
  const [error, setError] = useState('');
  const set = (i: number, patch: Partial<Slot>) => setSlots((s) => s.map((x, j) => (j === i ? { ...x, ...patch } : x)));

  const submit = () => {
    const used = slots.map((s) => s.savedId).filter(Boolean);
    if (new Set(used).size !== used.length) return setError('The same saved passenger is selected twice.');
    const out: any[] = [];
    for (const [i, s] of slots.entries()) {
      if (s.savedId) { out.push({ savedId: s.savedId, berthPreference: s.berth }); continue; }
      const age = Number(s.age);
      if (!/^[A-Za-z][A-Za-z .'-]*$/.test(s.name.trim())) return setError(`Passenger ${i + 1}: enter a name using letters only.`);
      if (!Number.isInteger(age) || age < 0 || age > 120) return setError(`Passenger ${i + 1}: enter an age between 0 and 120.`);
      if (!s.gender) return setError(`Passenger ${i + 1}: choose a gender.`);
      out.push({ name: s.name.trim(), age, gender: s.gender, berthPreference: s.berth, save: s.save });
    }
    setError('');
    onAction({ type: 'SUBMIT_PASSENGERS', passengers: out });
  };

  const off = !active || busy;
  return (
    <form className={`rounded-xl border border-[#dce9ff] bg-white shadow-sm p-3 space-y-3 ${active ? '' : 'opacity-70'}`} onSubmit={(e) => { e.preventDefault(); submit(); }}>
      <div className="text-sm font-bold text-[#001026] flex items-center gap-2"><span className="material-symbols-outlined text-[18px] text-[#ff8928]">group</span>Passenger details</div>
      {slots.map((s, i) => (
        <fieldset key={i} className="rounded-lg border border-[#eff4ff] p-2.5 space-y-2" disabled={off}>
          <legend className="px-1 text-xs font-semibold text-[#44474e]">Passenger {i + 1}</legend>
          {card.saved.length > 0 && (
            <select aria-label={`Saved passenger for passenger ${i + 1}`} className={input} value={s.savedId} onChange={(e) => set(i, { savedId: e.target.value })}>
              <option value="">Enter new passenger…</option>
              {card.saved.map((p) => <option key={p.id} value={p.id}>{p.name}, {p.age}, {p.gender}{p.isSelf ? ' (me)' : ''}</option>)}
            </select>
          )}
          {!s.savedId && (
            <>
              <input aria-label={`Name of passenger ${i + 1}`} className={input} placeholder="Full name (as on ID)" maxLength={60} value={s.name} onChange={(e) => set(i, { name: e.target.value })} autoComplete="off" />
              <div className="grid grid-cols-2 gap-2">
                <input aria-label={`Age of passenger ${i + 1}`} className={input} placeholder="Age" inputMode="numeric" maxLength={3} value={s.age} onChange={(e) => set(i, { age: e.target.value.replace(/\D/g, '') })} />
                <select aria-label={`Gender of passenger ${i + 1}`} className={input} value={s.gender} onChange={(e) => set(i, { gender: e.target.value as Slot['gender'] })}>
                  <option value="">Gender</option>{GENDERS.map((g) => <option key={g}>{g}</option>)}
                </select>
              </div>
            </>
          )}
          <select aria-label={`Berth preference for passenger ${i + 1}`} className={input} value={s.berth} onChange={(e) => set(i, { berth: e.target.value })}>
            {BERTHS.map((b) => <option key={b}>{b}</option>)}
          </select>
          {!s.savedId && <label className="flex items-center gap-2 text-xs text-[#44474e]"><input type="checkbox" checked={s.save} onChange={(e) => set(i, { save: e.target.checked })} />Save to my passengers</label>}
        </fieldset>
      ))}
      {error && <div role="alert" className="text-xs text-red-700">{error}</div>}
      <button type="submit" disabled={off} className="w-full px-4 py-2 rounded-lg bg-[#001026] text-white text-sm font-semibold hover:bg-[#0b2545] disabled:opacity-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#ff8928]">Continue to fare summary</button>
    </form>
  );
}
