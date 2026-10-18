import type { CareFields, Frequency, RoutineType, ScheduleFields } from '../types';

// How often a routine happens, and what to do when it isn't done. Shared by onboarding,
// the add-routine form and the edit dialog.

const DAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

export const CARE_DEFAULTS: Record<RoutineType, CareFields> = {
  MEDICINE: { followUpMinutes: 60, alertAfterMinutes: 180 },
  BP: { followUpMinutes: 120, alertAfterMinutes: 300 },
  SUGAR: { followUpMinutes: 120, alertAfterMinutes: 300 },
  WALK: { followUpMinutes: 120, alertAfterMinutes: null },
  WATER: { followUpMinutes: null, alertAfterMinutes: null },
  WELLBEING: { followUpMinutes: 120, alertAfterMinutes: null },
};

export function FrequencyPicker({ value, onChange }: { value: ScheduleFields; onChange: (v: ScheduleFields) => void }) {
  const set = (patch: Partial<ScheduleFields>) => onChange({ ...value, ...patch });
  const choose = (frequency: Frequency) =>
    set({
      frequency,
      daysOfWeek: frequency === 'WEEKLY' && !value.daysOfWeek.length ? [7] : value.daysOfWeek,
      intervalDays: frequency === 'INTERVAL' ? value.intervalDays ?? 2 : value.intervalDays,
      dayOfMonth: frequency === 'MONTHLY' ? value.dayOfMonth ?? 1 : value.dayOfMonth,
    });
  return (
    <div>
      <div className="segmented" role="radiogroup" aria-label="How often" style={{ flexWrap: 'wrap' }}>
        {([['DAILY', 'Every day'], ['WEEKLY', 'Some days'], ['INTERVAL', 'Every few days'], ['MONTHLY', 'Monthly']] as const).map(([f, label]) => (
          <button key={f} type="button" role="radio" aria-checked={value.frequency === f} className={value.frequency === f ? 'on' : ''} onClick={() => choose(f)}>{label}</button>
        ))}
      </div>
      {value.frequency === 'WEEKLY' && (
        <div className="days" role="group" aria-label="Days of the week" style={{ marginTop: 10 }}>
          {DAY_LABELS.map((d, i) => {
            const day = i + 1;
            const on = value.daysOfWeek.includes(day);
            return (
              <button key={d} type="button" aria-pressed={on} aria-label={d} className={on ? 'on' : ''}
                onClick={() => set({ daysOfWeek: on ? value.daysOfWeek.filter((x) => x !== day) : [...value.daysOfWeek, day].sort() })}>
                {d[0]}
              </button>
            );
          })}
        </div>
      )}
      {value.frequency === 'INTERVAL' && (
        <div className="row" style={{ marginTop: 10, gap: 8 }}>
          <span className="small muted">Every</span>
          <input className="input" type="number" min={2} max={60} aria-label="Days apart" value={value.intervalDays ?? 2} onChange={(e) => set({ intervalDays: Number(e.target.value) || 2 })} style={{ width: 80, padding: '7px 10px' }} />
          <span className="small muted">days, starting today</span>
        </div>
      )}
      {value.frequency === 'MONTHLY' && (
        <div className="row" style={{ marginTop: 10, gap: 8 }}>
          <span className="small muted">On day</span>
          <select className="input" aria-label="Day of the month" value={value.dayOfMonth ?? 1} onChange={(e) => set({ dayOfMonth: Number(e.target.value) })} style={{ width: 90, padding: '7px 10px' }}>
            {Array.from({ length: 31 }, (_, i) => i + 1).map((d) => <option key={d} value={d}>{d}</option>)}
          </select>
          <span className="small muted">of each month</span>
        </div>
      )}
    </div>
  );
}

const FOLLOW = [[null, 'Off'], [30, '30 min'], [60, '1 hour'], [120, '2 hours'], [180, '3 hours']] as const;
const ALERT = [[null, 'Don’t alert me'], [120, 'after 2 hours'], [180, 'after 3 hours'], [300, 'after 5 hours'], [480, 'after 8 hours']] as const;

export function CarePicker({ value, onChange, parentName }: { value: CareFields; onChange: (v: CareFields) => void; parentName: string }) {
  const sel = (opts: readonly (readonly [number | null, string])[], v: number | null, set: (n: number | null) => void, label: string) => (
    <select className="input" aria-label={label} value={v ?? ''} onChange={(e) => set(e.target.value ? Number(e.target.value) : null)} style={{ width: 'auto', padding: '7px 10px' }}>
      {opts.map(([n, l]) => <option key={l} value={n ?? ''}>{l}</option>)}
    </select>
  );
  return (
    <div className="stack" style={{ gap: 10 }}>
      <div className="row wrap" style={{ gap: 8 }}>
        <span className="small">Remind {parentName} again if there’s no reply after</span>
        {sel(FOLLOW, value.followUpMinutes, (n) => onChange({ ...value, followUpMinutes: n }), 'Follow-up after')}
      </div>
      <div className="row wrap" style={{ gap: 8 }}>
        <span className="small">Let me know if it’s still not done</span>
        {sel(ALERT, value.alertAfterMinutes, (n) => onChange({ ...value, alertAfterMinutes: n }), 'Alert me after')}
      </div>
    </div>
  );
}

export function describeFrequency(v: ScheduleFields): string {
  switch (v.frequency) {
    case 'DAILY': return 'Every day';
    case 'WEEKLY': {
      const d = [...v.daysOfWeek].sort();
      if (d.length === 7) return 'Every day';
      if (d.join() === '1,2,3,4,5') return 'Weekdays';
      if (d.join() === '6,7') return 'Weekends';
      return d.length === 1 ? `Every ${DAY_LABELS[d[0] - 1]}` : d.map((x) => DAY_LABELS[x - 1]).join(', ');
    }
    case 'INTERVAL': return `Every ${v.intervalDays} days`;
    case 'MONTHLY': return `Monthly on day ${v.dayOfMonth}`;
  }
}
