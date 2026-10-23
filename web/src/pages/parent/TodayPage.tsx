import { useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../../api';
import { Ask } from '../../components/Ask';
import { Icon, RoutineIcon } from '../../components/Icon';
import { ReminderDialog, blankReminder, missingSuggestions } from '../../components/ReminderDialog';
import { describeFrequency } from '../../components/RoutineForm';
import { Modal, Ring, Skeleton, Toast } from '../../components/ui';
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
    <div className="simple">
      <StatusCard status={status} phone={p.phone} name={p.name} alertId={today.alerts[0]?.id} onAck={reload} />

      {!hasReminders ? (
        <SetupReminders name={p.name} onPick={(start) => setDialog({ start })} />
      ) : (
        <section className="card">
          <div className="spread" style={{ marginBottom: 6 }}>
            <div className="row" style={{ gap: 14 }}>
              {list.length > 0 && <Ring value={done} total={list.length} size={56} stroke={6}><b style={{ fontSize: '0.9rem' }}>{done}/{list.length}</b></Ring>}
              <div>
                <h2>Today’s reminders</h2>
                <p className="muted small" style={{ marginTop: 3 }}>{list.length ? `${done} of ${list.length} done${consented ? '' : ' · paused until they say yes'}` : 'Nothing planned today'}</p>
              </div>
            </div>
            <button className="btn ghost sm" onClick={() => setDialog({ start: blankReminder('MEDICINE') })}><Icon name="plus" size={15} /> Add</button>
          </div>
          <ul className="checklist">
            {list.map((r) => <CheckRow key={r.id} r={r} name={p.name} canRemind={consented} onEdit={() => openEdit(r.id)} />)}
          </ul>
          <div className="spread wrap" style={{ marginTop: 12, gap: 8 }}>
            <span className="tiny">
              {later.length > 0 && `Not today: ${later.map((r) => `${r.name}${r.nextDue ? ` (next ${fmtDate(r.nextDue, { weekday: 'short', day: 'numeric', month: 'short' })})` : ''}`).join(' · ')}`}
            </span>
            <Link to="reminders" className="link-btn small">All reminders →</Link>
          </div>
        </section>
      )}

      {today.appointments.length > 0 && (
        <section className="card">
          <div className="spread" style={{ marginBottom: 12 }}>
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

      {hasReminders && (
        <div className="two-col">
          <LatestReadings today={today} />
          <WeekSoFar />
        </div>
      )}

      <FromParent />

      {(goodToKnow.length > 0 || today.pinnedNotes.length > 0) && (
        <section className="card">
          <h2 style={{ marginBottom: 12 }}>Good to know</h2>
          {goodToKnow.length > 0 && <ul className="plain-list">{goodToKnow.map((a, i) => <li key={i}>{a.text}</li>)}</ul>}
          {today.pinnedNotes.length > 0 && (
            <ul className="notes" style={{ marginTop: goodToKnow.length ? 14 : 0 }}>
              {today.pinnedNotes.map((n) => (
                <li key={n.id} className="pinned"><p>{n.text}</p><span className="tiny">{n.author ?? 'Family'} · pinned note</span></li>
              ))}
            </ul>
          )}
        </section>
      )}

      {consented && <Ask parentId={id} name={p.name} />}

      <Link to="report" className="next-link">See {p.name}’s weekly report →</Link>

      {dialog && (
        <ReminderDialog parentId={id} parentName={p.name} language={p.language ?? 'HINGLISH'} routine={dialog.routine} start={dialog.start} onClose={() => setDialog(null)}
          onSaved={(m) => { setDialog(null); show(m); reload(); routines.reload(); }} />
      )}
      <Toast message={toast} />
    </div>
  );
}

function StatusCard({ status, phone, name, alertId, onAck }: { status: ReturnType<typeof dayStatus>; phone: string; name: string; alertId?: string; onAck: () => void }) {
  const urgent = status.tone === 'help' || status.tone === 'needs';
  return (
    <section className={`status-card ${status.tone}`} aria-live="polite">
      <div className="status-icon" aria-hidden><Icon name={status.icon} size={26} /></div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <h1>{status.title}</h1>
        <p className="status-detail">{status.detail}</p>
        {status.needs.length > 0 && <ul className="need-list">{status.needs.map((n) => <li key={n}>{n}</li>)}</ul>}
        {urgent && (
          <div className="row wrap" style={{ marginTop: 16, gap: 8 }}>
            <a className="btn lg" href={`tel:+${phone}`}><Icon name="phone" size={18} /> Call {name}</a>
            {status.tone === 'help' && alertId && (
              <button className="btn ghost lg" onClick={() => api(`/alerts/${alertId}/ack`, { method: 'POST' }).then(onAck)}>I’ve called</button>
            )}
          </div>
        )}
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

function CheckRow({ r, name, canRemind, onEdit }: { r: Row; name: string; canRemind: boolean; onEdit: () => void }) {
  const { reload, today } = useParent();
  const tz = today.parent.timezone;
  const [confirm, setConfirm] = useState(false);
  const [err, setErr] = useState('');
  const { toast, show } = useToast();
  const remindable = canRemind && (r.status === 'waiting' || r.status === 'not_done' || r.status === 'no_response');

  let state: { text: string; cls: string };
  switch (r.status) {
    case 'done':
      state = { text: `Done${r.respondedAt ? ` · ${fmtClock(r.respondedAt, tz)}` : ''}`, cls: 'good' };
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

  return (
    <li className={`check ${r.status}`}>
      <span className="check-mark" aria-hidden>
        {r.status === 'done' ? <Icon name="check" size={20} stroke={2.2} /> : <RoutineIcon type={r.type} size={40} />}
      </span>
      <button className="check-body as-button" onClick={onEdit} aria-label={`Change ${r.name}`}>
        <div className="check-title">{cap(r.name)}</div>
        <div className="tiny">
          {fmtTime(r.timeOfDay)}
          {r.schedule !== 'Every day' ? ` · ${r.schedule}` : ''}
          {r.status === 'done' && r.latest && (r.type === 'BP' || r.type === 'SUGAR' || r.type === 'WATER') ? ` · ${r.latest}` : ''}
          {r.note ? ` · ${r.note}` : ''}
        </div>
      </button>
      <div className="check-state">
        <span className={`pill ${state.cls}`}>{state.text}</span>
        {remindable && <button className="link-btn small quiet-link" onClick={() => setConfirm(true)}>Remind now</button>}
      </div>
      {confirm && (
        <Modal title={`Remind ${name} now?`} onClose={() => setConfirm(false)}>
          <p className="muted" style={{ marginBottom: 18 }}>We’ll send the “{r.name}” reminder on WhatsApp right away.</p>
          {err && <p className="error" style={{ marginBottom: 12 }}>{err}</p>}
          <div className="row" style={{ justifyContent: 'flex-end' }}>
            <button className="btn quiet" onClick={() => setConfirm(false)}>Cancel</button>
            <button className="btn coral" onClick={remind}>Send reminder</button>
          </div>
        </Modal>
      )}
      <Toast message={toast} />
    </li>
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
            <RoutineIcon type={x.type} size={32} />
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
function FromParent() {
  const { id, today } = useParent();
  const { data } = useApi<ChatMessage[]>(`/parents/${id}/messages?limit=60`, 15000);
  const said = (data ?? []).filter((m) => m.direction === 'IN' && m.kind === 'text').slice(-3).reverse();
  if (!said.length) return null;
  return (
    <section className="card">
      <div className="spread" style={{ marginBottom: 12 }}>
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
    </section>
  );
}
