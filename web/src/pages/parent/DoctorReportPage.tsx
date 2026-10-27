import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Icon } from '../../components/Icon';
import { PlanNote, Skeleton } from '../../components/ui';
import { fmtClock, fmtDate } from '../../format';
import { useApi } from '../../hooks';
import type { DoctorReport, Stats } from '../../types';
import { useParent } from './ParentDashboard';

const RANGES = [
  ['30', 'Last 30 days'],
  ['90', 'Last 3 months'],
  ['180', 'Last 6 months'],
] as const;

function isoDaysAgo(days: number) {
  const d = new Date();
  d.setDate(d.getDate() - days + 1);
  return d.toISOString().slice(0, 10);
}

/** A one-document summary for a doctor's visit: what was recorded, never what it means. */
export function DoctorReportPage() {
  const { id, today } = useParent();
  const tz = today.parent.timezone;
  const [days, setDays] = useState('30');
  const { data, loading, error } = useApi<DoctorReport>(`/parents/${id}/doctor-report?from=${isoDaysAgo(Number(days))}`);
  const when = (iso: string) => `${fmtDate(iso, { day: 'numeric', month: 'short' }, tz)}, ${fmtClock(iso, tz)}`;
  const stat = (s: Stats | null) => (s ? `${s.min}–${s.max} (average ${s.avg})` : '—');

  return (
    <div className="simple">
      <div className="report-head no-print">
        <Link to="../care" relative="path" className="link-btn small"><Icon name="left" size={14} /> Care</Link>
        <div className="row wrap" style={{ gap: 8 }}>
          <div className="segmented" role="radiogroup" aria-label="Period">
            {RANGES.map(([v, label]) => (
              <button key={v} role="radio" aria-checked={days === v} className={days === v ? 'on' : ''} onClick={() => setDays(v)}>{label}</button>
            ))}
          </div>
          <button className="btn ghost sm" onClick={() => window.print()}><Icon name="print" size={16} /> Print / save PDF</button>
        </div>
      </div>

      {error && !data ? <PlanNote text={error} /> : !data ? <Skeleton h={500} /> : (
        <article className="card pad-lg doc" style={{ opacity: loading ? 0.7 : 1 }}>
          <header className="doc-head">
            <div>
              <div className="eyebrow" style={{ color: 'var(--muted)' }}>Doctor visit summary</div>
              <h1 style={{ margin: '6px 0 4px' }}>{data.parent.name}</h1>
              <p className="muted small">
                {fmtDate(data.range.from, { day: 'numeric', month: 'long', year: 'numeric' })} – {fmtDate(data.range.to, { day: 'numeric', month: 'long', year: 'numeric' })}
                {' · '}prepared by {data.preparedBy.join(', ')}
              </p>
            </div>
          </header>
          <p className="doc-note">
            Readings and messages below were sent by {data.parent.name} on WhatsApp and are listed exactly as received. This is a record for the doctor, not medical advice.
          </p>

          <h2 className="doc-h">Medicines</h2>
          {data.medicines.length === 0 ? <p className="muted">No medicines recorded.</p> : (
            <table className="table">
              <thead><tr><th>Medicine</th><th>As prescribed</th><th>Reminders</th><th>Confirmed</th></tr></thead>
              <tbody>
                {data.medicines.map((m) => {
                  const asked = m.taken.done + m.taken.notYet + m.taken.noReply;
                  return (
                    <tr key={m.name}>
                      <td><b>{m.name}</b>{m.dose && <div className="tiny">{m.dose}</div>}</td>
                      <td className="small">{[m.instructions, m.prescribedBy && `by ${m.prescribedBy}`].filter(Boolean).join(' · ') || '—'}</td>
                      <td className="small">{m.reminders.join('; ') || '—'}</td>
                      <td className="small num">{asked ? `${m.taken.done} of ${asked}` : '—'}{m.taken.noReply > 0 && <div className="tiny">{m.taken.noReply} no reply</div>}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}

          <h2 className="doc-h">Blood pressure <span className="tiny">mmHg</span></h2>
          {data.readings.bp.length === 0 ? <p className="muted">No readings sent in this period.</p> : (
            <>
              <p className="small ink-2">{data.readings.bp.length} readings · upper {stat(data.readings.bpStats?.systolic ?? null)} · lower {stat(data.readings.bpStats?.diastolic ?? null)}</p>
              <div className="reading-chips">{data.readings.bp.map((b) => <span key={b.at}>{when(b.at)}<b>{b.value}</b></span>)}</div>
            </>
          )}

          <h2 className="doc-h">Blood sugar <span className="tiny">mg/dL</span></h2>
          {data.readings.sugar.length === 0 ? <p className="muted">No readings sent in this period.</p> : (
            <>
              <p className="small ink-2">{data.readings.sugar.length} readings · {stat(data.readings.sugarStats)}</p>
              <div className="reading-chips">{data.readings.sugar.map((s) => <span key={s.at}>{when(s.at)}<b>{s.value}</b>{s.context ? ` ${s.context}` : ''}</span>)}</div>
            </>
          )}

          {data.readings.weight.length > 0 && (
            <>
              <h2 className="doc-h">Weight <span className="tiny">kg</span></h2>
              <div className="reading-chips">{data.readings.weight.map((w) => <span key={w.at}>{when(w.at)}<b>{w.value}</b></span>)}</div>
            </>
          )}

          <h2 className="doc-h">How they said they felt</h2>
          {data.symptoms.length === 0 ? <p className="muted">No symptoms mentioned in this period.</p> : (
            <ul className="symptom-log">
              {data.symptoms.map((s) => (
                <li key={s.at}>
                  <span className="tiny num">{when(s.at)}</span>
                  <span><b style={{ textTransform: 'capitalize' }}>{s.name}</b>{s.since ? ` · ${s.since}` : ''}{s.words && <span className="quote-inline"> “{s.words}”</span>}</span>
                </li>
              ))}
            </ul>
          )}
          {data.wellbeing.good + data.wellbeing.okay + data.wellbeing.low > 0 && (
            <p className="small ink-2" style={{ marginTop: 8 }}>Daily check-ins: {data.wellbeing.good} good, {data.wellbeing.okay} okay, {data.wellbeing.low} not good.</p>
          )}

          {data.appointments.length > 0 && (
            <>
              <h2 className="doc-h">Doctor visits</h2>
              <ul className="symptom-log">
                {data.appointments.map((a) => (
                  <li key={a.at}>
                    <span className="tiny num">{when(a.at)}</span>
                    <span><b>{a.title}</b>{a.place ? ` · ${a.place}` : ''} · {a.status === 'UPCOMING' ? 'coming up' : a.status.toLowerCase()}{a.notes && <div className="small ink-2">{a.notes}</div>}</span>
                  </li>
                ))}
              </ul>
            </>
          )}

          {data.notes.length > 0 && (
            <>
              <h2 className="doc-h">Family notes</h2>
              <ul className="symptom-log">
                {data.notes.map((n) => (
                  <li key={n.at}>
                    <span className="tiny num">{fmtDate(n.at, { day: 'numeric', month: 'short' }, tz)}</span>
                    <span>{n.text}{n.author && <span className="tiny"> · {n.author}</span>}</span>
                  </li>
                ))}
              </ul>
            </>
          )}
          <p className="report-foot" style={{ marginTop: 28 }}>Family Care · ghar ki khabar · generated {fmtDate(data.generatedAt, { day: 'numeric', month: 'short', year: 'numeric' }, tz)}</p>
        </article>
      )}
    </div>
  );
}
