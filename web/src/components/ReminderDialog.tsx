import { useState, type FormEvent } from 'react';
import { api } from '../api';
import { ROUTINE_LABEL, fmtTime } from '../format';
import { reminderPreview } from '../reminderCopy';
import type { Routine, RoutineInput, RoutineType } from '../types';
import { RoutineIcon } from './Icon';
import { CARE_DEFAULTS, CarePicker, FrequencyPicker } from './RoutineForm';
import { Modal } from './ui';

const TYPES: RoutineType[] = ['MEDICINE', 'BP', 'SUGAR', 'WATER', 'WALK', 'WELLBEING'];

export const blankReminder = (type: RoutineType): RoutineInput => ({
  type,
  name: '',
  timeOfDay: type === 'SUGAR' ? '07:30' : type === 'BP' ? '09:00' : type === 'WATER' ? '19:00' : type === 'WALK' ? '18:00' : type === 'WELLBEING' ? '20:00' : '08:00',
  frequency: 'DAILY',
  daysOfWeek: [],
  intervalDays: null,
  dayOfMonth: null,
  target: type === 'WATER' ? 8 : null,
  ...CARE_DEFAULTS[type],
});

/** Common reminders, one tap to start from. */
export const SUGGESTIONS: (RoutineInput & { label: string })[] = [
  { ...blankReminder('MEDICINE'), name: 'morning wali dawa', timeOfDay: '08:00', label: 'Morning medicine' },
  { ...blankReminder('MEDICINE'), name: 'raat wali dawa', timeOfDay: '21:30', label: 'Night medicine' },
  { ...blankReminder('BP'), name: 'BP check', timeOfDay: '09:00', label: 'BP check' },
  { ...blankReminder('SUGAR'), name: 'fasting sugar test', timeOfDay: '07:30', frequency: 'WEEKLY', daysOfWeek: [7], label: 'Weekly sugar test' },
  { ...blankReminder('WATER'), name: 'paani', timeOfDay: '19:00', label: 'Water check' },
  { ...blankReminder('WALK'), name: 'evening walk', timeOfDay: '18:00', label: 'Evening walk' },
  { ...blankReminder('WELLBEING'), name: 'kaisa feel', timeOfDay: '20:00', label: 'How they feel' },
];

/** Suggestions not already set up (matched by name, so a second medicine can still be suggested). */
export function missingSuggestions(existing: { type: RoutineType; name: string }[]) {
  const names = new Set(existing.map((r) => r.name.trim().toLowerCase()));
  const types = new Set(existing.filter((r) => r.type !== 'MEDICINE').map((r) => r.type));
  return SUGGESTIONS.filter((s) => !names.has(s.name) && (s.type === 'MEDICINE' || !types.has(s.type)));
}

interface Props {
  parentId: string;
  parentName: string;
  /** Edit this reminder; otherwise add a new one starting from `start`. */
  routine?: Routine;
  start?: RoutineInput;
  onClose: () => void;
  onSaved: (message: string) => void;
}

export function ReminderDialog({ parentId, parentName, routine, start, onClose, onSaved }: Props) {
  const editing = Boolean(routine);
  const [f, setF] = useState<RoutineInput>(routine ?? start ?? blankReminder('MEDICINE'));
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const preview = reminderPreview(f.type, parentName, f.name, f.frequency);

  async function save(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErr('');
    const { type, name, timeOfDay, frequency, daysOfWeek, intervalDays, dayOfMonth, followUpMinutes, alertAfterMinutes, target } = f;
    try {
      if (routine) {
        await api(`/routines/${routine.id}`, { method: 'PATCH', body: { name, timeOfDay, frequency, daysOfWeek, intervalDays, dayOfMonth, followUpMinutes, alertAfterMinutes, target } });
        onSaved('Reminder updated');
      } else {
        await api(`/parents/${parentId}/routines`, { body: { type, name, timeOfDay, frequency, daysOfWeek, intervalDays, dayOfMonth, followUpMinutes, alertAfterMinutes, target } });
        onSaved(`Reminder added for ${fmtTime(timeOfDay)}`);
      }
    } catch (e2) {
      setErr((e2 as Error).message);
      setBusy(false);
    }
  }

  return (
    <Modal title={editing ? `Change “${routine!.name}”` : 'Add a reminder'} onClose={onClose}>
      <form onSubmit={save} className="stack" style={{ gap: 16 }}>
        {!editing && (
          <div className="type-row" role="radiogroup" aria-label="What is it for">
            {TYPES.map((t) => (
              <button type="button" key={t} role="radio" aria-checked={f.type === t} className={`type-chip${f.type === t ? ' on' : ''}`}
                onClick={() => setF({ ...blankReminder(t), name: f.type === t ? f.name : '' })}>
                <RoutineIcon type={t} size={28} />
                <span>{ROUTINE_LABEL[t]}</span>
              </button>
            ))}
          </div>
        )}
        <div className="grid-2">
          <div>
            <label className="field-label" htmlFor="rd-name">Name in the message</label>
            <input className="input" id="rd-name" placeholder={SUGGESTIONS.find((s) => s.type === f.type)?.name} value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} required autoFocus={!editing} />
          </div>
          <div>
            <label className="field-label" htmlFor="rd-time">Time ({parentName}’s time)</label>
            <input className="input" id="rd-time" type="time" value={f.timeOfDay} onChange={(e) => setF({ ...f, timeOfDay: e.target.value })} required />
          </div>
        </div>
        <div>
          <span className="field-label">How often</span>
          <FrequencyPicker value={f} onChange={(v) => setF({ ...f, ...v })} />
        </div>
        {f.type === 'WATER' && (
          <div>
            <label className="field-label" htmlFor="rd-goal">Daily goal (glasses)</label>
            <input className="input" id="rd-goal" type="number" min={1} max={30} value={f.target ?? 8} onChange={(e) => setF({ ...f, target: Number(e.target.value) })} style={{ width: 120 }} />
          </div>
        )}
        <div>
          <span className="field-label">If it’s not done</span>
          <CarePicker value={f} onChange={(v) => setF({ ...f, ...v })} parentName={parentName} />
        </div>
        <div className="preview-box" aria-label="What they will see on WhatsApp">
          <span className="tiny">{parentName} will get on WhatsApp</span>
          <div className="wa them" style={{ animation: 'none', marginTop: 6 }}>
            {preview.text}
            {preview.buttons && <div className="btns">{preview.buttons.map((b) => <span key={b}>{b}</span>)}</div>}
          </div>
        </div>
        {err && <p className="error">{err}</p>}
        <div className="row" style={{ justifyContent: 'flex-end' }}>
          <button type="button" className="btn quiet" onClick={onClose}>Cancel</button>
          <button className="btn" disabled={busy || !f.name.trim()}>{busy ? 'Saving…' : editing ? 'Save' : 'Add reminder'}</button>
        </div>
      </form>
    </Modal>
  );
}
