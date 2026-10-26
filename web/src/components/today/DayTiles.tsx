import { fmtClock, fmtTime } from '../../format';
import { Icon } from '../Icon';
import { LOOK, STATUS_WORD, cap, isReading, type DayItem } from './model';

const PILL: Record<string, string> = { done: 'good', waiting: 'coral', not_done: 'warn', no_response: '', upcoming: 'muted-pill', planned: 'muted-pill' };

/** One tile per reminder. Hover syncs with the timeline; click opens the reminder's story. */
export function DayTiles({ items, timeZone, hovered, onHover, onOpen, justDone, canRemind, onRemind }: {
  items: DayItem[];
  timeZone: string;
  hovered: string | null;
  onHover: (id: string | null) => void;
  onOpen: (item: DayItem) => void;
  justDone: Set<string>;
  canRemind: boolean;
  onRemind?: (item: DayItem) => void;
}) {
  return (
    <div className="rtiles">
      {items.map((i, n) => {
        const text = i.status === 'done'
          ? i.latest && isReading(i.type) ? i.latest : `Done${i.respondedAt ? ` · ${fmtClock(i.respondedAt, timeZone)}` : ''}`
          : i.status === 'waiting' && i.followUpAt ? 'No reply · reminded twice' : STATUS_WORD[i.status];
        const remindable = canRemind && onRemind && (i.status === 'waiting' || i.status === 'not_done' || i.status === 'no_response');
        return (
          <div
            key={i.routineId}
            className={`rtile ${i.status}${hovered === i.routineId ? ' hot' : ''}${justDone.has(i.routineId) ? ' celebrate' : ''}`}
            style={{ '--n': n } as React.CSSProperties}
            onMouseEnter={() => onHover(i.routineId)}
            onMouseLeave={() => onHover(null)}
          >
            {i.status === 'done' && <span className="rtile-done" aria-hidden><Icon name="check" size={13} stroke={2.6} /></span>}
            <button className="rtile-main" onClick={() => onOpen(i)} aria-label={`${cap(i.name)}: ${text}. Open details`}>
              <span className={`ichip c-${LOOK[i.type].tone}`} aria-hidden><Icon name={LOOK[i.type].icon} stroke={2.4} /></span>
              <b>{cap(i.name)}</b>
              <span className="tiny">{fmtTime(i.time)}{i.note ? ` · ${i.note}` : ''}</span>
            </button>
            <div className="rtile-state">
              <span className={`pill ${PILL[i.status]}`}>{text}</span>
              {remindable && <button className="link-btn small" onClick={() => onRemind!(i)}>Remind</button>}
            </div>
          </div>
        );
      })}
    </div>
  );
}
