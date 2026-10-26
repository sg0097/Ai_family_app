import { fmtClock, fmtDate, fmtTime } from '../../format';
import { useApi } from '../../hooks';
import type { Trends } from '../../types';
import { Icon } from '../Icon';
import { Sheet } from './Sheet';
import { Spark } from './Spark';
import { LOOK, STATUS_WORD, cap, type DayItem } from './model';

const DOT_WORD: Record<string, string> = { done: 'Done', not_done: 'Said not yet', no_response: 'No reply', waiting: 'Waiting', upcoming: 'Later', none: 'Not that day' };

/** Everything about one reminder: how the day went, the last two weeks, and what you can do. */
export function RoutineSheet({ parentId, parentName, item, date, isToday, timeZone, schedule, onClose, onRemind, onEdit }: {
  parentId: string;
  parentName: string;
  item: DayItem;
  date: string;
  isToday: boolean;
  timeZone: string;
  schedule?: string;
  onClose: () => void;
  onRemind?: () => void;
  onEdit?: () => void;
}) {
  const { data: trends } = useApi<Trends>(`/parents/${parentId}/trends?days=14`);
  const history = trends?.adherence.find((a) => a.id === item.routineId)?.days ?? [];
  const asked = history.filter((d) => d.status === 'done' || d.status === 'not_done' || d.status === 'no_response');
  const doneDays = asked.filter((d) => d.status === 'done').length;
  const clock = (iso: string) => fmtClock(iso, timeZone);

  const story: { at: string; text: string; tone?: string }[] = [];
  if (item.sentAt) story.push({ at: clock(item.sentAt), text: `Reminder sent to ${parentName} on WhatsApp` });
  if (item.followUpAt) story.push({ at: clock(item.followUpAt), text: 'One gentle follow-up' });
  if (item.childAlertedAt) story.push({ at: clock(item.childAlertedAt), text: 'You were told it wasn’t done yet', tone: 'warn' });
  if (item.respondedAt) story.push({ at: clock(item.respondedAt), text: item.status === 'done' ? `${parentName} confirmed${item.note ? ` · “${item.note}”` : ''}` : `${parentName} said “not yet”`, tone: item.status === 'done' ? 'good' : 'warn' });
  if (!item.sentAt && (item.status === 'upcoming' || item.status === 'planned')) story.push({ at: fmtTime(item.time), text: 'Reminder will go at this time' });
  if (item.sentAt && !item.respondedAt) story.push({ at: '…', text: isToday ? `Waiting for ${parentName}` : 'No reply that day', tone: 'soft' });

  const series =
    item.type === 'BP' ? trends?.bp.map((b) => ({ v: b.systolic, tip: `${b.systolic}/${b.diastolic} · ${fmtDate(b.at, { day: 'numeric', month: 'short' }, timeZone)}` }))
    : item.type === 'SUGAR' ? trends?.sugar.map((s) => ({ v: s.value, tip: `${s.value} mg/dL${s.context ? ` ${s.context}` : ''} · ${fmtDate(s.at, { day: 'numeric', month: 'short' }, timeZone)}` }))
    : item.type === 'WATER' ? trends?.water.filter((w) => w.glasses != null).map((w) => ({ v: w.glasses!, tip: `${w.glasses} glasses · ${fmtDate(w.date, { day: 'numeric', month: 'short' })}` }))
    : null;

  return (
    <Sheet title={cap(item.name)} onClose={onClose} className={`t-${LOOK[item.type].tone}`}>
      <div className="sh-band" aria-hidden />
      <div className="sh-head">
        <span className={`ichip c-${LOOK[item.type].tone}`} aria-hidden><Icon name={LOOK[item.type].icon} stroke={2.4} /></span>
        <div>
          <h2>{cap(item.name)}</h2>
          <p className="tiny">{fmtTime(item.time)}{schedule && schedule !== 'Every day' ? ` · ${schedule}` : ' · every day'}</p>
        </div>
      </div>

      <div className={`sh-status ${item.status}`}>
        <span>{isToday ? 'Today' : fmtDate(date, { weekday: 'long', day: 'numeric', month: 'short' })}</span>
        <b>{item.status === 'done' && item.latest ? item.latest : STATUS_WORD[item.status]}</b>
      </div>

      <h3 className="sh-h">How it went</h3>
      <ol className="story">
        {story.map((s, i) => (
          <li key={i} className={s.tone ?? ''} style={{ '--n': i } as React.CSSProperties}>
            <span className="story-at">{s.at}</span>
            <span className="story-dot" aria-hidden />
            <span>{s.text}</span>
          </li>
        ))}
      </ol>

      {series && (
        <>
          <h3 className="sh-h">Readings, last 2 weeks</h3>
          <Spark points={series} label={`${item.name} readings`} />
        </>
      )}

      <h3 className="sh-h">Last 2 weeks {asked.length > 0 && <span className="soft">{doneDays} of {asked.length} done</span>}</h3>
      <div className="hist">
        {history.map((d) => (
          <span key={d.date} className={`hist-dot ${d.status}`} title={`${fmtDate(d.date, { weekday: 'short', day: 'numeric', month: 'short' })}: ${DOT_WORD[d.status]}${d.note ? ` · ${d.note}` : ''}`}>
            <i>{fmtDate(d.date, { weekday: 'narrow' })}</i>
          </span>
        ))}
        {!trends && <span className="tiny">Loading…</span>}
      </div>
      <div className="hist-key tiny"><span><i className="hist-dot done" /> done</span><span><i className="hist-dot not_done" /> not yet</span><span><i className="hist-dot no_response" /> no reply</span></div>

      <div className="sh-actions">
        {onRemind && <button className="btn" onClick={onRemind}><Icon name="send" size={14} /> Remind {parentName} now</button>}
        {onEdit && <button className="btn ghost" onClick={onEdit}>Change reminder</button>}
      </div>
    </Sheet>
  );
}
