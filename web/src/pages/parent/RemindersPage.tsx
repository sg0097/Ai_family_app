import { useState } from 'react';
import { api } from '../../api';
import { Icon, RoutineIcon } from '../../components/Icon';
import { DayTimeline } from '../../components/today/DayTimeline';
import { LOOK, type DayItem } from '../../components/today/model';
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
  const [hovered, setHovered] = useState<string | null>(null);

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
  const suggestions = missingSuggestions(data);

  const PARTS = [
    { key: 'morning', label: 'Morning', hint: 'before noon', icon: 'sun' as const, tone: 'amber', test: (h: number) => h < 12 },
    { key: 'afternoon', label: 'Afternoon', hint: '12 – 5 PM', icon: 'sun' as const, tone: 'blue', test: (h: number) => h >= 12 && h < 17 },
    { key: 'evening', label: 'Evening & night', hint: 'after 5 PM', icon: 'moon' as const, tone: 'violet', test: (h: number) => h >= 17 },
  ];
  const hour = (r: Routine) => Number(r.timeOfDay.slice(0, 2));
  const counts = (Object.keys(LOOK) as Routine['type'][]).map((t) => ({ t, n: data.filter((r) => r.active && r.type === t).length })).filter((c) => c.n);
  const planned: DayItem[] = sorted.filter((r) => r.active).map((r) => ({
    routineId: r.id, name: r.name, type: r.type, time: r.timeOfDay, status: 'planned', sentAt: null, followUpAt: null, respondedAt: null, childAlertedAt: null, note: null, latest: null,
  }));

  const row = (r: Routine, n: number) => {
    const look = LOOK[r.type];
    return (
      <li key={r.id} className={`rem2 t-${look.tone}${r.active ? '' : ' paused'}${hovered === r.id ? ' hot' : ''}`} style={{ '--n': n } as React.CSSProperties}
        onMouseEnter={() => setHovered(r.id)} onMouseLeave={() => setHovered(null)}>
        <button className="rem2-main" onClick={() => setDialog({ routine: r })} aria-label={`Change ${r.name}`}>
          <span className={`ichip c-${look.tone}`} aria-hidden><Icon name={look.icon} stroke={2.4} /></span>
          <span className="rem2-time">{fmtTime(r.timeOfDay)}</span>
          <span className="rem2-body">
            <b>{r.name.charAt(0).toUpperCase() + r.name.slice(1)}</b>
            <span className="rem2-chips">
              <span>{describeFrequency(r)}</span>
              {r.target ? <span>Goal {r.target} glasses</span> : null}
              <span><Icon name="bell" size={11} /> {careSummary(r, name)}</span>
              {r.voiceClipId && <span className="voice"><Icon name="mic" size={11} /> Your voice</span>}
            </span>
          </span>
          <span className="rem2-edit">{r.active ? 'Change' : 'Paused'} <Icon name="right" size={14} /></span>
        </button>
        <Switch on={r.active} label={`${r.active ? 'Pause' : 'Turn on'} ${r.name}`} onChange={(v) => toggle(r, v)} />
      </li>
    );
  };

  return (
    <div className="dash">
      <section className="card rem-hero">
        <div className="spread wrap" style={{ gap: 12 }}>
          <div>
            <h2>Reminders for {name}</h2>
            <p className="muted small" style={{ marginTop: 4 }}>{data.filter((r) => r.active).length} on · sent on WhatsApp at {name}’s time. Tap one to change it.</p>
          </div>
          <button className="btn" onClick={() => setDialog({ start: blankReminder('MEDICINE') })}><Icon name="plus" size={16} /> Add reminder</button>
        </div>
        {counts.length > 0 && (
          <div className="rem-counts">
            {counts.map((c) => (
              <span key={c.t} className={`rem-count t-${LOOK[c.t].tone}`}>
                <span className={`ichip c-${LOOK[c.t].tone}`} aria-hidden><Icon name={LOOK[c.t].icon} stroke={2.4} /></span>
                <b>{c.n}</b> {ROUTINE_LABEL[c.t].toLowerCase()}
              </span>
            ))}
          </div>
        )}
        {planned.length > 0 && (
          <DayTimeline items={planned} isToday timeZone={today.parent.timezone} hovered={hovered} onHover={setHovered}
            onOpen={(i) => { const r = data.find((x) => x.id === i.routineId); if (r) setDialog({ routine: r }); }} />
        )}
      </section>

      {data.length === 0 ? (
        <div className="card empty">No reminders yet. Start with one of the suggestions below.</div>
      ) : (
        <div className="rem-parts">
          {PARTS.map((part) => {
            const rows = sorted.filter((r) => part.test(hour(r)));
            if (!rows.length) return null;
            return (
              <section key={part.key} className={`card rem-part t-${part.tone}`}>
                <div className="rem-part-head">
                  <span className="rem-part-ic"><Icon name={part.icon} size={18} /></span>
                  <h3>{part.label}</h3>
                  <span className="tiny">{part.hint} · {rows.length}</span>
                </div>
                <ul className="rem2-list">{rows.map(row)}</ul>
              </section>
            );
          })}
        </div>
      )}

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
        <ReminderDialog parentId={id} parentName={name} language={today.parent.language ?? 'HINGLISH'} routine={dialog.routine} start={dialog.start} onClose={() => setDialog(null)}
          onSaved={(m) => { setDialog(null); show(m); refresh(); }} />
      )}
      <Toast message={toast} />
    </div>
  );
}
