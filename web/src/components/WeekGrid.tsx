import { useState } from 'react';
import { fmtDate, fmtTime } from '../format';
import type { ScheduleStatus, WeekSchedule } from '../types';
import { Icon, RoutineIcon, type IconName } from './Icon';
import { ReminderStory, type ReminderItem } from './ReminderStory';

const MARK: Record<ScheduleStatus, { icon: IconName | null; label: string }> = {
  done: { icon: 'check', label: 'Done' },
  not_done: { icon: 'dash', label: 'Said not yet' },
  no_response: { icon: 'question', label: 'No reply' },
  waiting: { icon: 'clock', label: 'Waiting' },
  upcoming: { icon: null, label: 'Later today' },
  planned: { icon: null, label: 'Coming up' },
};

/** Each reminder × Mon–Sun. Tap a day for what happened. */
export function WeekGrid({ data, parentName, timeZone }: { data: WeekSchedule; parentName: string; timeZone: string }) {
  const [open, setOpen] = useState<{ item: ReminderItem; date: string } | null>(null);
  const rows = data.routines
    .map((r) => ({ ...r, cells: data.days.map((d) => ({ date: d.date, item: d.items.find((i) => i.routineId === r.id) ?? null })) }))
    .filter((r) => r.cells.some((c) => c.item));

  if (!rows.length) return <div className="empty">No reminders this week.</div>;
  return (
    <>
      <div className="wgrid" role="table" aria-label={`${parentName}'s reminders this week`}>
        <div className="wrow whead" role="row">
          <span role="columnheader" />
          {data.days.map((d) => (
            <span key={d.date} role="columnheader" className={d.date === data.today ? 'is-today' : ''}>
              {fmtDate(d.date, { weekday: 'short' }).slice(0, 2)}
              <b>{fmtDate(d.date, { day: 'numeric' })}</b>
            </span>
          ))}
        </div>
        {rows.map((r) => (
          <div key={r.id} className="wrow" role="row">
            <span className="wname" role="rowheader">
              <RoutineIcon type={r.type} size={30} />
              <span>
                {r.name}
                <span className="tiny" style={{ display: 'block', fontWeight: 400 }}>{r.schedule === 'Every day' ? fmtTime(r.time) : `${r.schedule} · ${fmtTime(r.time)}`}</span>
              </span>
            </span>
            {r.cells.map((c) =>
              c.item ? (
                <button
                  key={c.date}
                  role="cell"
                  className={`wcell ${c.item.status}${c.date === data.today ? ' is-today' : ''}`}
                  aria-label={`${fmtDate(c.date, { weekday: 'long' })}: ${MARK[c.item.status].label}`}
                  title={MARK[c.item.status].label}
                  onClick={() => setOpen({ item: c.item!, date: c.date })}
                >
                  {MARK[c.item.status].icon && <Icon name={MARK[c.item.status].icon!} size={16} stroke={2.2} />}
                  {c.item.childAlertedAt && c.item.status !== 'done' && <i className="wbell" aria-hidden />}
                </button>
              ) : (
                <span key={c.date} role="cell" className={`wcell empty-cell${c.date === data.today ? ' is-today' : ''}`} />
              ),
            )}
          </div>
        ))}
      </div>
      <div className="wlegend">
        <span><i className="wcell done"><Icon name="check" size={12} stroke={2.4} /></i> Done</span>
        <span><i className="wcell not_done"><Icon name="dash" size={12} stroke={2.4} /></i> Said not yet</span>
        <span><i className="wcell no_response"><Icon name="question" size={12} stroke={2.4} /></i> No reply</span>
        <span><i className="wcell planned" /> Coming up</span>
        <span><i className="wcell no_response" style={{ position: 'relative' }}><i className="wbell" /></i> We let you know</span>
      </div>
      {open && <ReminderStory item={open.item} date={open.date} parentName={parentName} timeZone={timeZone} onClose={() => setOpen(null)} />}
    </>
  );
}
