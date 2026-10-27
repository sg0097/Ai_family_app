import { VoicePicker } from './Voice';
import { useState, type FormEvent } from 'react';
import { api } from '../api';
import { ROUTINE_LABEL, fmtTime } from '../format';
import { useApi, useReminderPreview } from '../hooks';
import type { Language, Medicine, Routine, RoutineInput, RoutineType } from '../types';
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
  language: Language;
  /** Edit this reminder; otherwise add a new one starting from `start`. */
  routine?: Routine;
  start?: RoutineInput;
  onClose: () => void;
  onSaved: (message: string) => void;
}

export function ReminderDialog({ parentId, parentName, language, routine, start, onClose, onSaved }: Props) {
  const editing = Boolean(routine);
  const [voice, setVoice] = useState<string | null>(routine?.voiceClipId ?? null);
  const [f, setF] = useState<RoutineInput>(routine ?? start ?? blankReminder('MEDICINE'));
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const medicines = useApi<Medicine[]>(`/parents/${parentId}/medicines`);
  const activeMeds = medicines.data?.filter((m) => m.active) ?? [];
  const linked = activeMeds.find((m) => m.id === f.medicineId) ?? null;
  const preview = useReminderPreview({
    parentName,
    language,
    type: f.type,
    name: f.name,
    frequency: f.frequency,
    medicine: f.type === 'MEDICINE' && linked ? { name: linked.name, dose: linked.dose } : null,
    message: f.message?.trim() || null,
  });

  async function save(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErr('');
    const { type, name, timeOfDay, frequency, daysOfWeek, intervalDays, dayOfMonth, followUpMinutes, alertAfterMinutes, target } = f;
    const medicineId = type === 'MEDICINE' ? f.medicineId ?? null : null;
    const message = f.message?.trim() || null;
    try {
      if (routine) {
        await api(`/routines/${routine.id}`, { method: 'PATCH', body: { name, timeOfDay, frequency, daysOfWeek, intervalDays, dayOfMonth, followUpMinutes, alertAfterMinutes, target, medicineId, message } });
        onSaved('Reminder updated');
      } else {
        await api(`/parents/${parentId}/routines`, { body: { type, name, timeOfDay, frequency, daysOfWeek, intervalDays, dayOfMonth, followUpMinutes, alertAfterMinutes, target, medicineId, message } });
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
        {f.type === 'MEDICINE' && activeMeds.length > 0 && (
          <div>
            <label className="field-label" htmlFor="rd-med">Which medicine? <span className="muted">(optional; adds the name and dose to the message)</span></label>
            <select className="input" id="rd-med" value={f.medicineId ?? ''} onChange={(e) => setF({ ...f, medicineId: e.target.value || null })}>
              <option value="">Not linked</option>
              {activeMeds.map((m) => <option key={m.id} value={m.id}>{m.name}{m.dose ? ` · ${m.dose}` : ''}</option>)}
            </select>
          </div>
        )}
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
        {routine && (
          <div>
            <span className="field-label">Play your voice with it <span className="muted">(sent just before the message)</span></span>
            <VoicePicker parentId={parentId} routineId={routine.id} value={voice} onChange={setVoice} />
          </div>
        )}
        <div>
          <span className="field-label">If it’s not done</span>
          <CarePicker value={f} onChange={(v) => setF({ ...f, ...v })} parentName={parentName} />
        </div>
        <div>
          <label className="field-label" htmlFor="rd-msg">In your own words <span className="muted">(optional)</span></label>
          <textarea className="input" id="rd-msg" rows={2} maxLength={300} value={f.message ?? ''} onChange={(e) => setF({ ...f, message: e.target.value })}
            placeholder={`e.g. ${parentName}, dawai le lo. Main yaad kar raha hoon ❤️`} />
          <p className="hint">Write it the way you’d say it. It’s sent as you wrote it, signed with your name. Leave empty for our warm standard wording.</p>
        </div>
        <div className="preview-box" aria-label="What they will see on WhatsApp">
          <span className="tiny">{parentName} will get on WhatsApp</span>
          <div className="wa them" style={{ animation: 'none', marginTop: 6, minHeight: 38 }}>
            {preview?.text ?? '…'}
            {preview && preview.buttons.length > 0 && <div className="btns">{preview.buttons.map((b) => <span key={b}>{b}</span>)}</div>}
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
