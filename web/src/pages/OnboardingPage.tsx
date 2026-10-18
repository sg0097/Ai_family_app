import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../api';
import { useSession } from '../App';
import { FrequencyPicker, describeFrequency } from '../components/RoutineForm';
import { reminderPreview } from '../reminderCopy';
import { Switch } from '../components/ui';
import { Icon, RoutineIcon } from '../components/Icon';
import { ROUTINE_LABEL, fmtTime } from '../format';
import type { RoutineType, ScheduleFields } from '../types';

const NAMES = [
  ['Mummy', 'Mother', '👩'],
  ['Papa', 'Father', '👨'],
  ['Maa', 'Mother', '👩'],
  ['Dadi', 'Grandmother', '👵'],
  ['Nani', 'Grandmother', '👵'],
  ['Dada', 'Grandfather', '👴'],
] as const;

interface Pick extends ScheduleFields {
  type: RoutineType;
  name: string;
  timeOfDay: string;
  target?: number;
  on: boolean;
  why: string;
}

const PICKS: Pick[] = [
  { type: 'MEDICINE', name: 'morning wali dawa', timeOfDay: '08:00', frequency: 'DAILY' as const, daysOfWeek: [], intervalDays: null, dayOfMonth: null, on: true, why: 'Tap “Le li” or just reply “haan”' },
  { type: 'BP', name: 'BP check', timeOfDay: '09:00', frequency: 'DAILY' as const, daysOfWeek: [], intervalDays: null, dayOfMonth: null, on: true, why: 'They reply with the reading, like 130/80' },
  { type: 'WATER', name: 'paani', timeOfDay: '19:00', target: 8, frequency: 'DAILY' as const, daysOfWeek: [], intervalDays: null, dayOfMonth: null, on: true, why: 'One evening check for glasses so far' },
  { type: 'WALK', name: 'evening walk', timeOfDay: '18:00', frequency: 'DAILY' as const, daysOfWeek: [], intervalDays: null, dayOfMonth: null, on: false, why: 'A gentle nudge to step out' },
  { type: 'WELLBEING', name: 'kaisa feel', timeOfDay: '20:00', frequency: 'DAILY' as const, daysOfWeek: [], intervalDays: null, dayOfMonth: null, on: false, why: 'Three taps: achha, theek, achha nahi' },
  { type: 'SUGAR', name: 'fasting sugar test', timeOfDay: '07:30', frequency: 'WEEKLY', daysOfWeek: [7], intervalDays: null, dayOfMonth: null, on: false, why: 'Weekly or daily, as their doctor advised' },
];

export function OnboardingPage() {
  const { user, refreshFamily } = useSession();
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [who, setWho] = useState({ name: '', relationship: 'Mother' });
  const [phone, setPhone] = useState('');
  const [picks, setPicks] = useState(PICKS);
  const [focus, setFocus] = useState<RoutineType>('MEDICINE');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [createdId, setCreatedId] = useState<string | null>(null);

  const parentName = who.name.trim() || 'Mummy';
  const update = (i: number, patch: Partial<Pick>) => setPicks(picks.map((p, j) => (j === i ? { ...p, ...patch } : p)));
  const digits = phone.replace(/\D/g, '');
  const canNext = [who.name.trim().length > 0, digits.length >= 10, picks.some((p) => p.on) && picks.every((p) => !p.on || p.frequency !== 'WEEKLY' || p.daysOfWeek.length)][step] ?? true;

  async function create() {
    setBusy(true);
    setError('');
    try {
      const { id } = await api<{ id: string }>('/parents', {
        body: {
          ...who,
          phone,
          routines: picks.filter((p) => p.on).map(({ type, name, timeOfDay, target, frequency, daysOfWeek, intervalDays, dayOfMonth }) => ({ type, name, timeOfDay, target, frequency, daysOfWeek, intervalDays, dayOfMonth })),
        },
      });
      setCreatedId(id);
      setStep(3);
      refreshFamily();
    } catch (e) {
      setError((e as Error).message);
      setStep(1);
    } finally {
      setBusy(false);
    }
  }

  const focused = picks.find((p) => p.type === focus) ?? picks[0];
  const chat =
    step === 0 || step === 1 || step === 3
      ? {
          text: `Namaste ${parentName} 🙏 ${user?.name} ne aapko AI Family Care se joda hai. Main aapko dawa, paani aur BP ki yaad dilaungi, aur aapke jawab ${user?.name} ko dikhenge. Kya shuru karein?`,
          buttons: ['Haan, shuru karein', 'Nahi'],
        }
      : reminderPreview(focused.type, parentName, focused.name, focused.frequency);

  return (
    <div className="onboard">
      <div className="card pad-lg reveal">
        <div className="stepper" aria-label={`Step ${Math.min(step + 1, 3)} of 3`}>
          {[0, 1, 2].map((i) => (
            <span key={i} className={i <= step ? 'on' : ''} />
          ))}
        </div>

        {step === 0 && (
          <>
            <div className="eyebrow">Step 1 of 3</div>
            <h1 style={{ margin: '8px 0 6px' }}>Who are we caring for?</h1>
            <p className="muted" style={{ marginBottom: 22 }}>Use the name you call them. Every message will start with it.</p>
            <div className="choice-grid">
              {NAMES.map(([n, rel, e]) => (
                <button key={n} type="button" className={`choice${who.name === n ? ' on' : ''}`} onClick={() => setWho({ name: n, relationship: rel })}>
                  <span className="e">{e}</span>
                  {n}
                </button>
              ))}
            </div>
            <div className="grid-2" style={{ marginTop: 18 }}>
              <div>
                <label className="field-label" htmlFor="custom">Or type a name</label>
                <input className="input" id="custom" placeholder="e.g. Amma" value={who.name} onChange={(e) => setWho({ ...who, name: e.target.value })} />
              </div>
              <div>
                <label className="field-label" htmlFor="rel">Relationship</label>
                <select className="input" id="rel" value={who.relationship} onChange={(e) => setWho({ ...who, relationship: e.target.value })}>
                  {['Mother', 'Father', 'Grandmother', 'Grandfather', 'Other'].map((r) => (
                    <option key={r}>{r}</option>
                  ))}
                </select>
              </div>
            </div>
          </>
        )}

        {step === 1 && (
          <>
            <div className="eyebrow">Step 2 of 3</div>
            <h1 style={{ margin: '8px 0 6px' }}>{parentName}’s WhatsApp number</h1>
            <p className="muted" style={{ marginBottom: 22 }}>We’ll send one invite. Nothing else is sent until {parentName} says yes.</p>
            <label className="field-label" htmlFor="phone">WhatsApp number</label>
            <div className="row">
              <span className="pill" style={{ padding: '13px 14px', borderRadius: 12 }}>🇮🇳 +91</span>
              <input className="input" id="phone" type="tel" inputMode="tel" autoFocus placeholder="98123 45678" value={phone} onChange={(e) => setPhone(e.target.value)} style={{ fontSize: '1.15rem', letterSpacing: '0.04em' }} />
            </div>
            <p className="hint">For a number outside India, include the country code.</p>
            {error && <p className="error" style={{ marginTop: 12 }}>{error}</p>}
          </>
        )}

        {step === 2 && (
          <>
            <div className="eyebrow">Step 3 of 3</div>
            <h1 style={{ margin: '8px 0 6px' }}>What should we help with?</h1>
            <p className="muted" style={{ marginBottom: 22 }}>Start small; you can change everything later. Times are in India time.</p>
            {picks.map((p, i) => (
              <div key={p.type} className={`routine-pick${p.on ? ' on' : ''}`} onMouseEnter={() => setFocus(p.type)} onFocus={() => setFocus(p.type)}>
                <RoutineIcon type={p.type} size={40} />
                <div>
                  <div style={{ fontWeight: 600 }}>{ROUTINE_LABEL[p.type]}</div>
                  <div className="tiny">{p.why}</div>
                  {p.on && (
                    <div className="row wrap" style={{ marginTop: 10, gap: 8 }}>
                      <input className="input" aria-label={`Name for ${ROUTINE_LABEL[p.type]}`} value={p.name} onChange={(e) => update(i, { name: e.target.value })} style={{ maxWidth: 220, padding: '8px 12px' }} />
                      <input className="input" type="time" aria-label={`Time for ${ROUTINE_LABEL[p.type]}`} value={p.timeOfDay} onChange={(e) => update(i, { timeOfDay: e.target.value })} style={{ width: 140, padding: '8px 12px' }} />
                    </div>
                  )}
                  {p.on && (
                    <div style={{ marginTop: 10 }}>
                      <FrequencyPicker value={p} onChange={(v) => update(i, v)} />
                    </div>
                  )}
                </div>
                <Switch on={p.on} label={`Track ${ROUTINE_LABEL[p.type]}`} onChange={(on) => { update(i, { on }); setFocus(p.type); }} />
              </div>
            ))}
          </>
        )}

        {step === 3 && (
          <div style={{ textAlign: 'center', padding: '20px 0' }}>
            <div className="success-burst" style={{ display: 'grid', placeItems: 'center', color: 'var(--ok)' }}><span className="status-icon" style={{ width: 72, height: 72, borderRadius: 22 }}><Icon name="send" size={32} /></span></div>
            <h1 style={{ margin: '14px 0 8px' }}>Invite sent to {parentName}</h1>
            <p className="muted" style={{ maxWidth: 420, margin: '0 auto 26px' }}>
              As soon as {parentName} replies “Haan”, reminders begin: {picks.filter((p) => p.on).map((p) => `${ROUTINE_LABEL[p.type].toLowerCase()} ${describeFrequency(p).toLowerCase()} at ${fmtTime(p.timeOfDay)}`).join(', ')}.
            </p>
            <div className="row" style={{ justifyContent: 'center' }}>
              <button className="btn lg" onClick={() => navigate(`/app/p/${createdId}`)}>Open {parentName}’s dashboard</button>
            </div>
          </div>
        )}

        {step < 3 && (
          <div className="spread" style={{ marginTop: 28 }}>
            {step === 0 ? <Link to="/app" className="btn quiet">Cancel</Link> : <button className="btn quiet" onClick={() => setStep(step - 1)}>← Back</button>}
            {step < 2 ? (
              <button className="btn" disabled={!canNext} onClick={() => setStep(step + 1)}>Continue →</button>
            ) : (
              <button className="btn coral" disabled={!canNext || busy} onClick={create}>{busy ? 'Sending…' : `Send invite to ${parentName}`}</button>
            )}
          </div>
        )}
      </div>

      <div style={{ position: 'sticky', top: 100 }}>
        <p className="tiny" style={{ textAlign: 'center', marginBottom: 12 }}>
          {step === 2 ? `Preview: ${ROUTINE_LABEL[focused.type].toLowerCase()} reminder at ${fmtTime(focused.timeOfDay)}` : `What ${parentName} will see`}
        </p>
        <div className="phone-mock" style={{ animation: 'none' }}>
          <div className="phone-screen" style={{ height: 470 }}>
            <div className="phone-top">
              <span className="av">❤️</span>
              <b>Family Care</b>
            </div>
            <div className="phone-body" style={{ justifyContent: 'flex-end' }}>
              <div key={chat.text} className="wa them">
                {chat.text}
                {chat.buttons && (
                  <div className="btns" style={{ flexDirection: chat.buttons.length > 2 ? 'column' : 'row' }}>
                    {chat.buttons.map((b) => (
                      <span key={b}>{b}</span>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
