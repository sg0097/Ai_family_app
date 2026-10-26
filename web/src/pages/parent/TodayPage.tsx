import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../../api';
import { RecentCheckIns } from '../../components/CheckIn';
import { Ask } from '../../components/Ask';
import { Num } from '../../components/Num';
import { Icon, RoutineIcon } from '../../components/Icon';
import { ReminderDialog, blankReminder, missingSuggestions } from '../../components/ReminderDialog';
import { describeFrequency } from '../../components/RoutineForm';
import { Skeleton, Toast } from '../../components/ui';
import { DayStrip } from '../../components/today/DayStrip';
import { DayTiles } from '../../components/today/DayTiles';
import { DayTimeline } from '../../components/today/DayTimeline';
import { Insights, Kpis } from '../../components/today/Insights';
import { RoutineSheet } from '../../components/today/RoutineSheet';
import { SayHi } from '../../components/today/SayHi';
import { itemsFromSchedule, itemsFromToday, type DayItem } from '../../components/today/model';
import { fmtClock, fmtDate, fmtTime } from '../../format';
import { useApi, useToast } from '../../hooks';
import { dayStatus } from '../../status';
import type { ChatMessage, Routine, RoutineInput, WeekSchedule } from '../../types';
import { useParent } from './ParentDashboard';

const addDays = (iso: string, n: number) => {
  const d = new Date(`${iso}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};

export function TodayPage() {
  const { id, today, reload } = useParent();
  const p = today.parent;
  const routines = useApi<Routine[]>(`/parents/${id}/routines`);
  const { toast, show } = useToast();
  const [dialog, setDialog] = useState<{ routine?: Routine; start?: RoutineInput } | null>(null);
  const [sentCheckIns, setSentCheckIns] = useState(0);
  const [weekStart, setWeekStart] = useState<string | null>(null);
  const week = useApi<WeekSchedule>(`/parents/${id}/schedule${weekStart ? `?start=${weekStart}` : ''}`, 30_000);
  const [selected, setSelected] = useState(today.date);
  const [hovered, setHovered] = useState<string | null>(null);
  const [open, setOpen] = useState<DayItem | null>(null);
  const [justDone, setJustDone] = useState<Set<string>>(new Set());

  const status = dayStatus({ name: p.name, consentStatus: p.consentStatus, lastInboundAt: today.lastInboundAt, alerts: today.alerts.length, routines: today.routines, urgent: today.urgent });
  const later = today.routines.filter((r) => r.status === 'not_today');
  const goodToKnow = today.attention.filter((a) => a.kind !== 'emergency' && a.kind !== 'not_done').slice(0, 3);
  const hasReminders = today.routines.length > 0;
  const consented = p.consentStatus === 'GRANTED';
  const isToday = selected === today.date;

  // Today comes live from the 5-second poll; other days from the week schedule.
  const items = useMemo(() => {
    if (isToday) return itemsFromToday(today);
    const day = week.data?.days.find((d) => d.date === selected);
    return day ? itemsFromSchedule(day) : [];
  }, [isToday, today, week.data, selected]);
  const asked = items.filter((i) => i.status !== 'upcoming' && i.status !== 'planned');
  const done = items.filter((i) => i.status === 'done').length;

  // Live: when something turns "done" between polls, celebrate it and say so.
  const prev = useRef<Map<string, string> | null>(null);
  useEffect(() => {
    const now = new Map(today.routines.map((r) => [r.id, r.status]));
    if (prev.current) {
      const fresh = today.routines.filter((r) => r.status === 'done' && prev.current!.get(r.id) && prev.current!.get(r.id) !== 'done');
      if (fresh.length) {
        setJustDone(new Set(fresh.map((r) => r.id)));
        show(`${p.name} just confirmed ${fresh.map((r) => r.name).join(', ')}`);
        setTimeout(() => setJustDone(new Set()), 2600);
      }
    }
    prev.current = now;
  }, [today, p.name, show]);

  // Keep the open sheet in step with live data.
  const openItem = open ? items.find((i) => i.routineId === open.routineId) ?? open : null;

  const openEdit = (routineId: string) => {
    const r = routines.data?.find((x) => x.id === routineId);
    if (r) setDialog({ routine: r });
  };
  const remind = useCallback(async (item: DayItem) => {
    try {
      await api(`/routines/${item.routineId}/send-now`, { method: 'POST' });
      show(`Reminder sent to ${p.name}`);
      reload();
    } catch (e) {
      show((e as Error).message);
    }
  }, [p.name, reload, show]);

  const moveWeek = (dir: -1 | 1) => {
    const base = week.data?.weekStart ?? today.date;
    const next = addDays(base, dir * 7);
    setWeekStart(next);
    setSelected(dir === 1 && next <= today.date && addDays(next, 6) >= today.date ? today.date : next);
  };
  const thisWeek = !week.data || (week.data.weekStart <= today.date && week.data.weekEnd >= today.date);

  return (
    <div className="dash today">
      <StatusCard status={status} phone={p.phone} name={p.name} alertId={today.alerts[0]?.id} onAck={reload}
        sayHi={consented ? <SayHi parentId={id} parentName={p.name} onSent={() => setSentCheckIns((n) => n + 1)} /> : undefined} />

      {hasReminders && <Kpis parentId={id} today={today} />}

      {!hasReminders ? (
        <SetupReminders name={p.name} onPick={(start) => setDialog({ start })} />
      ) : (
        <section className="board-card">
          {week.data ? (
            <DayStrip week={week.data} selected={selected} onSelect={setSelected} onWeek={moveWeek} canNext={!thisWeek} />
          ) : <Skeleton h={86} />}

          <div className="tiles-head">
            <h2>
              {isToday ? 'Today' : fmtDate(selected, { weekday: 'long', day: 'numeric', month: 'short' })}
              <span className="soft">{items.length ? `${done} of ${isToday ? items.length : asked.length || items.length} done` : 'nothing planned'}{isToday && !consented ? ' · paused until they say yes' : ''}</span>
            </h2>
            <div className="row" style={{ gap: 6 }}>
              {!isToday && <button className="btn ghost sm" onClick={() => { setWeekStart(null); setSelected(today.date); }}>Back to today</button>}
              <Link to="reminders" className="btn ghost sm">All reminders</Link>
              <button className="btn sm" onClick={() => setDialog({ start: blankReminder('MEDICINE') })}><Icon name="plus" size={14} /> Add</button>
            </div>
          </div>

          {items.length > 0 && <DayTimeline items={items} isToday={isToday} timeZone={p.timezone} hovered={hovered} onHover={setHovered} onOpen={setOpen} />}
          <div key={selected} className="day-swap">
            <DayTiles items={items} timeZone={p.timezone} hovered={hovered} onHover={setHovered} onOpen={setOpen} justDone={justDone} canRemind={consented && isToday} onRemind={setOpen} />
          </div>
          {isToday && later.length > 0 && (
            <p className="tiny" style={{ marginTop: 12 }}>
              Not today: {later.map((r) => `${r.name}${r.nextDue ? ` (next ${fmtDate(r.nextDue, { weekday: 'short', day: 'numeric', month: 'short' })})` : ''}`).join(' · ')}
            </p>
          )}
        </section>
      )}

      {hasReminders && <Insights parentId={id} today={today} />}

      <div className="dash-cols two">
        <FromParent extra={<RecentCheckIns parentId={id} parentName={p.name} version={sentCheckIns} />} />
        <div className="dash-side">
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
      </div>

      {consented && <Ask parentId={id} name={p.name} />}

      {openItem && (
        <RoutineSheet
          parentId={id}
          parentName={p.name}
          item={openItem}
          date={selected}
          isToday={isToday}
          timeZone={p.timezone}
          schedule={week.data?.routines.find((r) => r.id === openItem.routineId)?.schedule}
          onClose={() => setOpen(null)}
          onRemind={consented && isToday && openItem.status !== 'done' && openItem.status !== 'upcoming' ? () => remind(openItem) : undefined}
          onEdit={routines.data?.some((r) => r.id === openItem.routineId) ? () => { setOpen(null); openEdit(openItem.routineId); } : undefined}
        />
      )}
      {dialog && (
        <ReminderDialog parentId={id} parentName={p.name} language={p.language ?? 'HINGLISH'} routine={dialog.routine} start={dialog.start} onClose={() => setDialog(null)}
          onSaved={(m) => { setDialog(null); show(m); reload(); routines.reload(); week.reload(); }} />
      )}
      <Toast message={toast} />
    </div>
  );
}

/** The plain-words answer to "how is she today?", with the two things you might do about it. */
function StatusCard({ status, phone, name, alertId, onAck, sayHi, progress }: { status: ReturnType<typeof dayStatus>; phone: string; name: string; alertId?: string; onAck: () => void; sayHi?: React.ReactNode; progress?: { done: number; total: number } }) {
  const urgent = status.tone === 'help' || status.tone === 'needs';
  return (
    <section className={`greet ${status.tone}`} aria-live="polite">
      {progress && progress.total > 0 && (
        <div className="greet-ring" style={{ '--p': progress.done / progress.total } as React.CSSProperties} aria-label={`${progress.done} of ${progress.total} done today`}>
          <span><b><Num value={progress.done} /></b><i>of {progress.total}</i></span>
        </div>
      )}
      <div style={{ minWidth: 0, flex: 1 }}>
        <h1>{status.title}</h1>
        <p className="greet-detail">{status.detail}</p>
        {status.needs.length > 0 && <ul className="greet-needs">{status.needs.map((n) => <li key={n}><i className="dot a" /> {n}</li>)}</ul>}
      </div>
      <div className="status-actions">
        {status.tone === 'help' && alertId && (
          <button className="btn ghost" onClick={() => api(`/alerts/${alertId}/ack`, { method: 'POST' }).then(onAck)}>I’ve called</button>
        )}
        {status.tone !== 'help' && sayHi}
        <a className={`btn${urgent || !sayHi ? '' : ' ghost'}`} href={`tel:+${phone}`}><Icon name="phone" size={15} /> Call {name}</a>
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
