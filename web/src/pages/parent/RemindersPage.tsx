import { useState } from 'react';
import { api } from '../../api';
import { Icon, RoutineIcon } from '../../components/Icon';
import { ReminderDialog, blankReminder, missingSuggestions } from '../../components/ReminderDialog';
import { describeFrequency } from '../../components/RoutineForm';
import { Skeleton, Switch, Toast } from '../../components/ui';
import { ROUTINE_LABEL, fmtTime } from '../../format';
import { useApi, useToast } from '../../hooks';
import type { Routine, RoutineInput } from '../../types';
import { useParent } from './ParentDashboard';

export function careSummary(r: Routine, name: string): string {
  const hrs = (m: number) => (m >= 60 ? `${m / 60} hr${m > 60 ? 's' : ''}` : `${m} min`);
  const parts: string[] = [];
  if (r.followUpMinutes) parts.push(`reminds ${name} again after ${hrs(r.followUpMinutes)}`);
  if (r.alertAfterMinutes) parts.push(`tells you after ${hrs(r.alertAfterMinutes)}`);
  return parts.length ? parts.join(' · ') : 'No follow-up';
}

export function RemindersPage() {
  const { id, today, reload: reloadToday } = useParent();
  const name = today.parent.name;
  const { data, reload } = useApi<Routine[]>(`/parents/${id}/routines`);
  const { toast, show } = useToast();
  const [dialog, setDialog] = useState<{ routine?: Routine; start?: RoutineInput } | null>(null);

  const refresh = () => {
    reload();
    reloadToday();
  };
  const toggle = async (r: Routine, active: boolean) => {
    try {
      await api(`/routines/${r.id}`, { method: 'PATCH', body: { active } });
      show(active ? `${r.name} is on again` : `${r.name} paused`);
      refresh();
    } catch (e) {
      show((e as Error).message);
    }
  };

  if (!data) return <div className="simple"><Skeleton h={420} /></div>;
  const sorted = [...data].sort((a, b) => Number(b.active) - Number(a.active) || a.timeOfDay.localeCompare(b.timeOfDay));
  const daily = sorted.filter((r) => r.frequency === 'DAILY');
  const other = sorted.filter((r) => r.frequency !== 'DAILY');
  const suggestions = missingSuggestions(data);

  const list = (rows: Routine[]) => (
    <ul className="rem-list">
      {rows.map((r) => (
        <li key={r.id} className={`rem${r.active ? '' : ' paused'}`}>
          <button className="rem-main" onClick={() => setDialog({ routine: r })} aria-label={`Change ${r.name}`}>
            <span className="rem-time num">{fmtTime(r.timeOfDay)}</span>
            <RoutineIcon type={r.type} size={38} />
            <span className="rem-body">
              <span className="rem-name">{r.name.charAt(0).toUpperCase() + r.name.slice(1)}</span>
              <span className="tiny">
                {ROUTINE_LABEL[r.type]} · {describeFrequency(r)}{r.target ? ` · goal ${r.target} glasses` : ''}
              </span>
              <span className="tiny rem-care"><Icon name="bell" size={12} /> {careSummary(r, name)}</span>
            </span>
            <span className="rem-edit tiny">{r.active ? 'Change' : 'Paused'} <Icon name="right" size={14} /></span>
          </button>
          <Switch on={r.active} label={`${r.active ? 'Pause' : 'Turn on'} ${r.name}`} onChange={(v) => toggle(r, v)} />
        </li>
      ))}
    </ul>
  );

  return (
    <div className="simple">
      <section className="card">
        <div className="spread wrap" style={{ marginBottom: 6 }}>
          <div>
            <h2>Reminders for {name}</h2>
            <p className="muted small" style={{ marginTop: 4 }}>
              {data.filter((r) => r.active).length} on · sent on WhatsApp at {name}’s time. Tap one to change it.
            </p>
          </div>
          <button className="btn" onClick={() => setDialog({ start: blankReminder('MEDICINE') })}><Icon name="plus" size={16} /> Add reminder</button>
        </div>

        {data.length === 0 ? (
          <div className="empty">No reminders yet. Start with one of the suggestions below.</div>
        ) : (
          <>
            {daily.length > 0 && <><h3 className="rem-group">Every day</h3>{list(daily)}</>}
            {other.length > 0 && <><h3 className="rem-group">On some days</h3>{list(other)}</>}
          </>
        )}
      </section>

      {suggestions.length > 0 && (
        <section className="card">
          <h2 style={{ marginBottom: 4 }}>Suggestions</h2>
          <p className="muted small" style={{ marginBottom: 14 }}>Tap one to set it up. You can change the name and time first.</p>
          <div className="suggest-grid">
            {suggestions.map((s) => (
              <button key={s.label} className="suggest" onClick={() => setDialog({ start: s })}>
                <RoutineIcon type={s.type} size={34} />
                <span>
                  <b>{s.label}</b>
                  <span className="tiny" style={{ display: 'block' }}>{describeFrequency(s)} · {fmtTime(s.timeOfDay)}</span>
                </span>
                <Icon name="plus" size={16} />
              </button>
            ))}
          </div>
        </section>
      )}

      {dialog && (
        <ReminderDialog parentId={id} parentName={name} routine={dialog.routine} start={dialog.start} onClose={() => setDialog(null)}
          onSaved={(m) => { setDialog(null); show(m); refresh(); }} />
      )}
      <Toast message={toast} />
    </div>
  );
}
