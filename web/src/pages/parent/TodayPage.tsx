import { useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../../api';
import { CheckInDialog, RecentCheckIns } from '../../components/CheckIn';
import { Ask } from '../../components/Ask';
import { Icon, RoutineIcon, type IconName } from '../../components/Icon';
import { ReminderDialog, blankReminder, missingSuggestions } from '../../components/ReminderDialog';
import { describeFrequency } from '../../components/RoutineForm';
import { Modal, Skeleton, Toast } from '../../components/ui';
import { fmtAgo, fmtClock, fmtDate, fmtTime } from '../../format';
import { useApi, useToast } from '../../hooks';
import { dayStatus } from '../../status';
import type { ChatMessage, Routine, RoutineInput, Today, WeekSchedule } from '../../types';
import { useParent } from './ParentDashboard';

type Row = Today['routines'][number];
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

export function TodayPage() {
  const { id, today, reload } = useParent();
  const p = today.parent;
  const routines = useApi<Routine[]>(`/parents/${id}/routines`);
  const { toast, show } = useToast();
  const [dialog, setDialog] = useState<{ routine?: Routine; start?: RoutineInput } | null>(null);
  const [checkIn, setCheckIn] = useState(false);
  const [sentCheckIns, setSentCheckIns] = useState(0);
  const status = dayStatus({ name: p.name, consentStatus: p.consentStatus, lastInboundAt: today.lastInboundAt, alerts: today.alerts.length, routines: today.routines, urgent: today.urgent });
  const list = today.routines.filter((r) => r.status !== 'not_today');
  const later = today.routines.filter((r) => r.status === 'not_today');
  const done = list.filter((r) => r.status === 'done').length;
  const goodToKnow = today.attention.filter((a) => a.kind !== 'emergency' && a.kind !== 'not_done').slice(0, 3);
  const hasReminders = today.routines.length > 0;
  const consented = p.consentStatus === 'GRANTED';

  const openEdit = (routineId: string) => {
    const r = routines.data?.find((x) => x.id === routineId);
    if (r) setDialog({ routine: r });
  };

  return (
    <div className="dash today">
      <StatusCard status={status} phone={p.phone} name={p.name} alertId={today.alerts[0]?.id} onAck={reload} onCheckIn={consented ? () => setCheckIn(true) : undefined} />

      {!hasReminders ? (
        <SetupReminders name={p.name} onPick={(start) => setDialog({ start })} />
      ) : (
        <section>
          <div className="tiles-head">
            <h2>Today <span className="soft">{list.length ? `${done} of ${list.length} done${consented ? '' : ' · paused until they say yes'}` : 'nothing planned'}</span></h2>
            <div className="row" style={{ gap: 6 }}>
              <Link to="reminders" className="btn ghost sm">All reminders</Link>
              <button className="btn sm" onClick={() => setDialog({ start: blankReminder('MEDICINE') })}><Icon name="plus" size={14} /> Add</button>
            </div>
          </div>
          <div className="rtiles">
            {list.map((r) => <ReminderTile key={r.id} r={r} name={p.name} canRemind={consented} onEdit={() => openEdit(r.id)} />)}
          </div>
          {later.length > 0 && (
            <p className="tiny" style={{ marginTop: 10 }}>
              Not today: {later.map((r) => `${r.name}${r.nextDue ? ` (next ${fmtDate(r.nextDue, { weekday: 'short', day: 'numeric', month: 'short' })})` : ''}`).join(' · ')}
            </p>
          )}
        </section>
      )}

      <div className="dash-cols">
        <div className="dash-side">
          <FromParent extra={<RecentCheckIns parentId={id} parentName={p.name} version={sentCheckIns} />} />
          {(goodToKnow.length > 0 || today.pinnedNotes.length > 0) && (
            <section className="card">
              <h2 style={{ marginBottom: 8 }}>Good to know</h2>
              {goodToKnow.length > 0 && <ul className="plain-list">{goodToKnow.map((a, i) => <li key={i}>{a.text}</li>)}</ul>}
              {today.pinnedNotes.length > 0 && (
                <ul className="notes" style={{ marginTop: goodToKnow.length ? 10 : 0 }}>
                  {today.pinnedNotes.map((n) => (
                    <li key={n.id} className="pinned"><p>{n.text}</p><span className="tiny">{n.author ?? 'Family'} · pinned note</span></li>
                  ))}
                </ul>
              )}
            </section>
          )}
        </div>
        <div className="dash-side">
          {hasReminders && <LatestReadings today={today} />}
          {today.appointments.length > 0 && (
            <section className="card">
              <div className="spread" style={{ marginBottom: 8 }}>
                <h2>Coming up</h2>
                <Link to="care" className="link-btn small">Care →</Link>
              </div>
              <ul className="appt-list">
                {today.appointments.map((a) => (
                  <li key={a.id} className="appt upcoming">
                    <span className="appt-date"><b>{fmtDate(a.at, { day: 'numeric' }, p.timezone)}</b><span className="tiny">{fmtDate(a.at, { month: 'short' }, p.timezone)}</span></span>
                    <div>
                      <div className="appt-title">{a.title}</div>
                      <div className="tiny">{fmtDate(a.at, { weekday: 'long' }, p.timezone)} · {fmtClock(a.at, p.timezone)}{a.place ? ` · ${a.place}` : ''}</div>
                    </div>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>
        <div className="dash-side">
          {hasReminders && <WeekSoFar />}
        </div>
      </div>

      {consented && <Ask parentId={id} name={p.name} />}

      {dialog && (
        <ReminderDialog parentId={id} parentName={p.name} language={p.language ?? 'HINGLISH'} routine={dialog.routine} start={dialog.start} onClose={() => setDialog(null)}
          onSaved={(m) => { setDialog(null); show(m); reload(); routines.reload(); }} />
      )}
      {checkIn && (
        <CheckInDialog parentId={id} parentName={p.name} onClose={() => setCheckIn(false)} onSent={() => { setCheckIn(false); setSentCheckIns((n) => n + 1); show(`Sent to ${p.name} on WhatsApp`); }} />
      )}
      <Toast message={toast} />
    </div>
  );
}

/** The plain-words answer to "how is she today?", with the two things you might do about it. */
function StatusCard({ status, phone, name, alertId, onAck, onCheckIn }: { status: ReturnType<typeof dayStatus>; phone: string; name: string; alertId?: string; onAck: () => void; onCheckIn?: () => void }) {
  const urgent = status.tone === 'help' || status.tone === 'needs';
  return (
    <section className={`greet ${status.tone}`} aria-live="polite">
      <div style={{ minWidth: 0 }}>
        <h1>{status.title}</h1>
        <p className="greet-detail">{status.detail}</p>
        {status.needs.length > 0 && <ul className="greet-needs">{status.needs.map((n) => <li key={n}><i className="dot a" /> {n}</li>)}</ul>}
      </div>
      <div className="status-actions">
        {status.tone === 'help' && alertId && (
          <button className="btn ghost" onClick={() => api(`/alerts/${alertId}/ack`, { method: 'POST' }).then(onAck)}>I’ve called</button>
        )}
        {onCheckIn && status.tone !== 'help' && <button className="btn ghost" onClick={onCheckIn}><Icon name="message" size={15} /> Say hi</button>}
        <a className={`btn${urgent || !onCheckIn ? '' : ' ghost'}`} href={`tel:+${phone}`}><Icon name="phone" size={15} /> Call {name}</a>
      </div>
    </section>
  );
}

/** First thing a new parent page shows: pick what to remind them about. */
function SetupReminders({ name, onPick }: { name: string; onPick: (start: RoutineInput) => void }) {
  return (
    <section className="card pad-lg">
      <h2 style={{ fontSize: '1.4rem' }}>Set up {name}’s reminders</h2>
      <p className="muted" style={{ margin: '6px 0 18px' }}>Pick what to remind {name} about on WhatsApp. You’ll choose the time before anything is sent.</p>
      <div className="suggest-grid">
        {missingSuggestions([]).map((s) => (
          <button key={s.label} className="suggest" onClick={() => onPick(s)}>
            <RoutineIcon type={s.type} size={34} />
            <span><b>{s.label}</b><span className="tiny" style={{ display: 'block' }}>{describeFrequency(s)} · {fmtTime(s.timeOfDay)}</span></span>
            <Icon name="plus" size={16} />
          </button>
        ))}
      </div>
    </section>
  );
}

const TILE: Record<Row['type'], { icon: IconName; tone: string }> = {
  MEDICINE: { icon: 'pill', tone: 'pink' },
  BP: { icon: 'heart', tone: 'violet' },
  SUGAR: { icon: 'drop', tone: 'amber' },
  WATER: { icon: 'glass', tone: 'blue' },
  WALK: { icon: 'walk', tone: 'green' },
  WELLBEING: { icon: 'smile', tone: 'black' },
};

function ReminderTile({ r, name, canRemind, onEdit }: { r: Row; name: string; canRemind: boolean; onEdit: () => void }) {
  const { reload, today } = useParent();
  const tz = today.parent.timezone;
  const [confirm, setConfirm] = useState(false);
  const [err, setErr] = useState('');
  const { toast, show } = useToast();
  const remindable = canRemind && (r.status === 'waiting' || r.status === 'not_done' || r.status === 'no_response');

  let state: { text: string; cls: string };
  switch (r.status) {
    case 'done':
      state = { text: r.latest && (r.type === 'BP' || r.type === 'SUGAR' || r.type === 'WATER') ? r.latest : `Done${r.respondedAt ? ` · ${fmtClock(r.respondedAt, tz)}` : ''}`, cls: 'good' };
      break;
    case 'waiting':
      state = { text: r.followUpAt ? 'No reply yet · reminded twice' : 'Waiting for reply', cls: 'coral' };
      break;
    case 'not_done':
      state = { text: 'Said “not yet”', cls: 'warn' };
      break;
    case 'no_response':
      state = { text: 'No reply', cls: '' };
      break;
    default:
      state = { text: 'Later today', cls: 'muted-pill' };
  }

  async function remind() {
    setErr('');
    try {
      await api(`/routines/${r.id}/send-now`, { method: 'POST' });
      setConfirm(false);
      show(`Reminder sent to ${name}`);
      reload();
    } catch (e) {
      setErr((e as Error).message);
    }
  }

  const look = TILE[r.type];
  return (
    <div className={`rtile ${r.status}`}>
      {r.status === 'done' && <span className="rtile-done" aria-hidden><Icon name="check" size={13} stroke={2.6} /></span>}
      <button className="rtile-main" onClick={onEdit} aria-label={`Change ${r.name}`}>
        <span className={`ichip c-${look.tone}`} aria-hidden><Icon name={look.icon} stroke={2.4} /></span>
        <b>{cap(r.name)}</b>
        <span className="tiny">
          {fmtTime(r.timeOfDay)}
          {r.schedule !== 'Every day' ? ` · ${r.schedule}` : ''}
          {r.note ? ` · ${r.note}` : ''}
        </span>
      </button>
      <div className="rtile-state">
        <span className={`pill ${state.cls}`}>{state.text}</span>
        {remindable && <button className="link-btn small" onClick={() => setConfirm(true)}>Remind now</button>}
      </div>
      {confirm && (
        <Modal title={`Remind ${name} now?`} onClose={() => setConfirm(false)}>
          <p className="muted" style={{ marginBottom: 18 }}>We’ll send the “{r.name}” reminder on WhatsApp right away.</p>
          {err && <p className="error" style={{ marginBottom: 12 }}>{err}</p>}
          <div className="row" style={{ justifyContent: 'flex-end' }}>
            <button className="btn quiet" onClick={() => setConfirm(false)}>Cancel</button>
            <button className="btn" onClick={remind}>Send reminder</button>
          </div>
        </Modal>
      )}
      <Toast message={toast} />
    </div>
  );
}

/** The latest of each reading, with when it came in. Shown as sent, never judged. */
function LatestReadings({ today }: { today: Today }) {
  const r = today.latestReadings;
  const rows: { type: 'BP' | 'SUGAR' | 'WATER' | 'WEIGHT'; label: string; value: string | null; at: string | null }[] = [
    { type: 'BP', label: 'BP', value: r.bp?.value ?? null, at: r.bp?.at ?? null },
    { type: 'SUGAR', label: 'Sugar', value: r.sugar?.value ?? null, at: r.sugar?.at ?? null },
    { type: 'WATER', label: 'Water today', value: r.waterToday ? `${r.waterToday.glasses}${r.waterToday.goal ? ` of ${r.waterToday.goal}` : ''} glasses` : null, at: r.waterToday?.at ?? null },
    { type: 'WEIGHT', label: 'Weight', value: r.weight?.value ?? null, at: r.weight?.at ?? null },
  ];
  return (
    <section className="card">
      <div className="spread" style={{ marginBottom: 10 }}>
        <h2>Latest readings</h2>
        <Link to="history" className="link-btn small">History →</Link>
      </div>
      <ul className="readings">
        {rows.map((x) => (
          <li key={x.type}>
            <RoutineIcon type={x.type} size={26} />
            <span className="small muted">{x.label}</span>
            {x.value ? (
              <span className="reading-val"><b>{x.value}</b><span className="tiny">{fmtAgo(x.at)}</span></span>
            ) : (
              <span className="tiny">Not sent yet</span>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}

/** Mon–Sun so far: how much was done each day. */
function WeekSoFar() {
  const { id } = useParent();
  const { data } = useApi<WeekSchedule>(`/parents/${id}/schedule`, 30000);
  if (!data) return <Skeleton h={200} />;
  const days = data.days.map((d) => {
    const asked = d.items.filter((i) => i.status !== 'planned' && i.status !== 'upcoming');
    return { date: d.date, done: asked.filter((i) => i.status === 'done').length, asked: asked.length, future: d.date > data.today, today: d.date === data.today };
  });
  return (
    <section className="card">
      <div className="spread" style={{ marginBottom: 14 }}>
        <h2>This week so far</h2>
        <Link to="report" className="link-btn small">Report →</Link>
      </div>
      <div className="week-bars">
        {days.map((d) => (
          <div key={d.date} className={`wb${d.today ? ' is-today' : ''}`} title={d.asked ? `${d.done} of ${d.asked} done` : d.future ? 'Coming up' : 'Nothing asked'}>
            <span className="wb-track">
              <span className="wb-fill" style={{ height: d.asked ? `${Math.max(8, (d.done / d.asked) * 100)}%` : 0 }} />
            </span>
            <span className="tiny num">{d.asked ? `${d.done}/${d.asked}` : '–'}</span>
            <span className="tiny" style={{ fontWeight: d.today ? 700 : 400 }}>{fmtDate(d.date, { weekday: 'short' }).slice(0, 2)}</span>
          </div>
        ))}
      </div>
    </section>
  );
}

/** The last few things the parent wrote, in their own words. */
function FromParent({ extra }: { extra?: React.ReactNode }) {
  const { id, today } = useParent();
  const { data } = useApi<ChatMessage[]>(`/parents/${id}/messages?limit=60`, 15000);
  const said = (data ?? []).filter((m) => m.direction === 'IN' && m.kind === 'text').slice(-3).reverse();
  return (
    <section className="card">
      <div className="spread" style={{ marginBottom: 8 }}>
        <h2>From {today.parent.name}</h2>
        <Link to="history?view=messages" className="link-btn small">All messages →</Link>
      </div>
      <ul className="quotes">
        {said.map((m) => (
          <li key={m.id}>
            <span className="quote">“{m.body}”</span>
            <span className="tiny">{fmtDate(m.createdAt, { weekday: 'short' }, today.parent.timezone)} {fmtClock(m.createdAt, today.parent.timezone)}</span>
          </li>
        ))}
      </ul>
      {!said.length && <p className="tiny empty-line">Nothing written yet. Their own words show up here.</p>}
      {extra}
    </section>
  );
}
