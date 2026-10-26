import { MemoryCard } from '../../components/MemoryCard';
import { VoiceLibrary } from '../../components/Voice';
import { useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../../api';
import { Icon, RoutineIcon } from '../../components/Icon';
import { describeFrequency } from '../../components/RoutineForm';
import { Modal, Skeleton, Switch, Toast } from '../../components/ui';
import { fmtAgo, fmtClock, fmtDate, fmtTime } from '../../format';
import { useApi, useToast } from '../../hooks';
import type { Appointment, CareNote, Medicine } from '../../types';
import { useParent } from './ParentDashboard';

/** Medicines as prescribed, doctor visits, and notes the family shares. */
export function CarePage() {
  const { toast, show } = useToast();
  const { id, today } = useParent();
  const p = today.parent;
  return (
    <div className="dash">
      <DoctorReportCard />
      <div className="dash-grid">
        <div className="dash-side">
          <Medicines notify={show} />
          <Appointments notify={show} />
          <Notes notify={show} />
        </div>
        <div className="dash-side">
          <VoiceLibrary parentId={id} parentName={p.name} notify={show} />
          <MemoryCard parentId={id} parentName={p.name} timeZone={p.timezone} />
        </div>
      </div>
      <Toast message={toast} />
    </div>
  );
}

function DoctorReportCard() {
  const { today } = useParent();
  return (
    <section className="card report-cta">
      <div>
        <h2>Going to the doctor?</h2>
        <p className="muted small" style={{ marginTop: 4 }}>
          One page with {today.parent.name}’s medicines, readings, what they said about how they felt, and your notes. Print it or save as PDF.
        </p>
      </div>
      <Link to="../doctor-report" relative="path" className="btn"><Icon name="report" size={16} /> Doctor visit report</Link>
    </section>
  );
}

// ── Medicines ────────────────────────────────────────────────────────────

function Medicines({ notify }: { notify: (m: string) => void }) {
  const { id, today, reload: reloadToday } = useParent();
  const { data, reload } = useApi<Medicine[]>(`/parents/${id}/medicines`);
  const [editing, setEditing] = useState<Medicine | 'new' | null>(null);
  const [refilling, setRefilling] = useState<Medicine | null>(null);
  const refresh = () => {
    reload();
    reloadToday();
  };

  return (
    <section className="card">
      <div className="spread wrap" style={{ marginBottom: 6 }}>
        <div>
          <h2>Medicines</h2>
          <p className="muted small" style={{ marginTop: 4 }}>Written exactly as on the prescription. We never change or suggest doses.</p>
        </div>
        <button className="btn ghost sm" onClick={() => setEditing('new')}><Icon name="plus" size={15} /> Add medicine</button>
      </div>
      {!data ? <Skeleton h={160} /> : data.length === 0 ? (
        <div className="empty small">No medicines added yet. Add them to show the name and dose in reminders and get a nudge before tablets run out.</div>
      ) : (
        <ul className="med-list">
          {data.map((m) => (
            <li key={m.id} className={`med${m.active ? '' : ' paused'}`}>
              <RoutineIcon type="MEDICINE" size={40} />
              <div className="med-body">
                <div className="row wrap" style={{ gap: 8 }}>
                  <span className="med-name">{m.name}</span>
                  {m.dose && <span className="pill">{m.dose}</span>}
                  {!m.active && <span className="pill">Stopped</span>}
                </div>
                {(m.instructions || m.prescribedBy) && (
                  <div className="small ink-2">{[m.instructions, m.prescribedBy && `by ${m.prescribedBy}`].filter(Boolean).join(' · ')}</div>
                )}
                <div className="tiny" style={{ marginTop: 4 }}>
                  {m.routines.filter((r) => r.active).length
                    ? `Reminders: ${m.routines.filter((r) => r.active).map((r) => `${fmtTime(r.timeOfDay)} ${describeFrequency(r) === 'Every day' ? '' : `(${describeFrequency(r)})`}`.trim()).join(', ')}`
                    : 'Not linked to a reminder yet. Link it when adding or changing a medicine reminder.'}
                </div>
                {m.pillsLeft != null && <Stock m={m} />}
              </div>
              <div className="med-actions">
                {m.pillsLeft != null && m.active && <button className="btn ghost sm" onClick={() => setRefilling(m)}>Refilled</button>}
                <button className="link-btn small quiet-link" onClick={() => setEditing(m)}>Change</button>
              </div>
            </li>
          ))}
        </ul>
      )}
      {editing && (
        <MedicineDialog parentId={id} parentName={today.parent.name} medicine={editing === 'new' ? null : editing} onClose={() => setEditing(null)}
          onSaved={(msg) => { setEditing(null); notify(msg); refresh(); }} />
      )}
      {refilling && <RefillDialog medicine={refilling} onClose={() => setRefilling(null)} onSaved={(msg) => { setRefilling(null); notify(msg); refresh(); }} />}
    </section>
  );
}

function Stock({ m }: { m: Medicine }) {
  const low = m.daysLeft != null && m.daysLeft <= m.refillAlertDays;
  const pct = m.daysLeft == null ? 100 : Math.min(100, (m.daysLeft / Math.max(30, m.refillAlertDays * 3)) * 100);
  return (
    <div className="stock">
      <span className="stock-bar"><span style={{ width: `${pct}%` }} className={low ? 'low' : ''} /></span>
      <span className={`tiny${low ? ' warn-text' : ''}`}>
        {m.pillsLeft} tablet{m.pillsLeft === 1 ? '' : 's'} left
        {m.daysLeft != null && ` · about ${m.daysLeft} day${m.daysLeft === 1 ? '' : 's'}`}
        {low && ' · time to refill'}
      </span>
    </div>
  );
}

function MedicineDialog({ parentId, parentName, medicine, onClose, onSaved }: { parentId: string; parentName: string; medicine: Medicine | null; onClose: () => void; onSaved: (m: string) => void }) {
  const [f, setF] = useState({
    name: medicine?.name ?? '',
    dose: medicine?.dose ?? '',
    instructions: medicine?.instructions ?? '',
    prescribedBy: medicine?.prescribedBy ?? '',
    track: medicine ? medicine.pillsLeft != null : false,
    pillsLeft: medicine?.pillsLeft ?? 30,
    pillsPerDose: medicine?.pillsPerDose ?? 1,
    refillAlertDays: medicine?.refillAlertDays ?? 5,
    active: medicine?.active ?? true,
  });
  const [err, setErr] = useState('');
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement>) => setF({ ...f, [k]: e.target.type === 'number' ? Number(e.target.value) : e.target.value });

  async function save(e: FormEvent) {
    e.preventDefault();
    setErr('');
    const body = {
      name: f.name, dose: f.dose, instructions: f.instructions, prescribedBy: f.prescribedBy,
      pillsLeft: f.track ? f.pillsLeft : null, pillsPerDose: f.pillsPerDose, refillAlertDays: f.refillAlertDays, active: f.active,
    };
    try {
      if (medicine) await api(`/medicines/${medicine.id}`, { method: 'PATCH', body });
      else await api(`/parents/${parentId}/medicines`, { body });
      onSaved(medicine ? 'Medicine updated' : `${f.name} added`);
    } catch (e2) {
      setErr((e2 as Error).message);
    }
  }

  return (
    <Modal title={medicine ? `Change ${medicine.name}` : 'Add a medicine'} onClose={onClose}>
      <form onSubmit={save} className="stack" style={{ gap: 14 }}>
        <div className="grid-2">
          <div><label className="field-label" htmlFor="md-name">Medicine name</label><input className="input" id="md-name" value={f.name} onChange={set('name')} placeholder="Telma 40" required autoFocus /></div>
          <div><label className="field-label" htmlFor="md-dose">Dose</label><input className="input" id="md-dose" value={f.dose} onChange={set('dose')} placeholder="1 tablet" /></div>
        </div>
        <div><label className="field-label" htmlFor="md-ins">Instructions, as written by the doctor</label><input className="input" id="md-ins" value={f.instructions} onChange={set('instructions')} placeholder="after breakfast" /></div>
        <div><label className="field-label" htmlFor="md-dr">Prescribed by <span className="muted">(optional)</span></label><input className="input" id="md-dr" value={f.prescribedBy} onChange={set('prescribedBy')} placeholder="Dr. Mehta" /></div>
        <label className="row" style={{ gap: 10, cursor: 'pointer' }}>
          <Switch on={f.track} label="Track tablets" onChange={(track) => setF({ ...f, track })} />
          <span className="small">Count tablets and remind us before they run out</span>
        </label>
        {f.track && (
          <div className="grid-2">
            <div><label className="field-label" htmlFor="md-left">Tablets left now</label><input className="input" id="md-left" type="number" min={0} value={f.pillsLeft} onChange={set('pillsLeft')} /></div>
            <div><label className="field-label" htmlFor="md-per">Tablets each time</label><input className="input" id="md-per" type="number" min={1} max={20} value={f.pillsPerDose} onChange={set('pillsPerDose')} /></div>
            <div><label className="field-label" htmlFor="md-days">Tell us when this many days are left</label><input className="input" id="md-days" type="number" min={1} max={60} value={f.refillAlertDays} onChange={set('refillAlertDays')} /></div>
          </div>
        )}
        <p className="hint">When {parentName} confirms a dose on WhatsApp, the count goes down by itself.</p>
        {medicine && (
          <label className="row" style={{ gap: 10, cursor: 'pointer' }}>
            <Switch on={!f.active} label="Stopped" onChange={(stopped) => setF({ ...f, active: !stopped })} />
            <span className="small">The doctor stopped this medicine</span>
          </label>
        )}
        {err && <p className="error">{err}</p>}
        <div className="row" style={{ justifyContent: 'flex-end' }}>
          <button type="button" className="btn quiet" onClick={onClose}>Cancel</button>
          <button className="btn" disabled={!f.name.trim()}>Save</button>
        </div>
      </form>
    </Modal>
  );
}

function RefillDialog({ medicine, onClose, onSaved }: { medicine: Medicine; onClose: () => void; onSaved: (m: string) => void }) {
  const [pills, setPills] = useState(30);
  const [err, setErr] = useState('');
  async function save(e: FormEvent) {
    e.preventDefault();
    try {
      await api(`/medicines/${medicine.id}/refill`, { body: { pills } });
      onSaved(`${medicine.name}: ${pills} tablets added`);
    } catch (e2) {
      setErr((e2 as Error).message);
    }
  }
  return (
    <Modal title={`Refilled ${medicine.name}`} onClose={onClose}>
      <form onSubmit={save}>
        <label className="field-label" htmlFor="rf-n">How many tablets were bought?</label>
        <input className="input" id="rf-n" type="number" min={1} value={pills} onChange={(e) => setPills(Number(e.target.value))} autoFocus />
        <p className="hint">{medicine.pillsLeft ?? 0} left now → {(medicine.pillsLeft ?? 0) + pills} after this.</p>
        {err && <p className="error">{err}</p>}
        <div className="row" style={{ justifyContent: 'flex-end', marginTop: 16 }}>
          <button type="button" className="btn quiet" onClick={onClose}>Cancel</button>
          <button className="btn" disabled={pills < 1}>Add tablets</button>
        </div>
      </form>
    </Modal>
  );
}

// ── Appointments ─────────────────────────────────────────────────────────

/** "2026-10-25T11:00" in the parent's timezone, for a datetime-local input. */
function toLocalInput(iso: string, timeZone: string): string {
  const p = Object.fromEntries(new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(new Date(iso)).map((x) => [x.type, x.value]));
  return `${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}`;
}

function Appointments({ notify }: { notify: (m: string) => void }) {
  const { id, today, reload: reloadToday } = useParent();
  const tz = today.parent.timezone;
  const { data, reload } = useApi<Appointment[]>(`/parents/${id}/appointments`);
  const [editing, setEditing] = useState<Appointment | 'new' | null>(null);
  const now = Date.now();
  const upcoming = (data ?? []).filter((a) => a.status === 'UPCOMING' && new Date(a.at).getTime() > now - 3 * 3600_000);
  const past = (data ?? []).filter((a) => !upcoming.includes(a)).reverse().slice(0, 6);
  const refresh = () => {
    reload();
    reloadToday();
  };
  const setStatus = async (a: Appointment, status: Appointment['status']) => {
    await api(`/appointments/${a.id}`, { method: 'PATCH', body: { status } });
    notify(status === 'DONE' ? 'Marked as done' : 'Appointment cancelled');
    refresh();
  };

  const row = (a: Appointment) => {
    const due = a.status === 'UPCOMING' && new Date(a.at).getTime() < now;
    return (
      <li key={a.id} className={`appt ${a.status.toLowerCase()}`}>
        <span className="appt-date">
          <b>{fmtDate(a.at, { day: 'numeric' }, tz)}</b>
          <span className="tiny">{fmtDate(a.at, { month: 'short' }, tz)}</span>
        </span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="appt-title">{a.title}</div>
          <div className="tiny">
            {fmtDate(a.at, { weekday: 'long' }, tz)} · {fmtClock(a.at, tz)}{a.place ? ` · ${a.place}` : ''}
            {a.status === 'UPCOMING' && (a.remindParent ? ` · ${today.parent.name} gets a reminder` : ' · no reminder to ' + today.parent.name)}
          </div>
          {a.notes && <div className="small ink-2" style={{ marginTop: 4 }}>{a.notes}</div>}
        </div>
        <div className="med-actions">
          {a.status === 'UPCOMING' ? (
            <>
              {due && <button className="btn ghost sm" onClick={() => setStatus(a, 'DONE')}>Went</button>}
              <button className="link-btn small quiet-link" onClick={() => setEditing(a)}>Change</button>
            </>
          ) : (
            <span className="pill">{a.status === 'DONE' ? 'Done' : 'Cancelled'}</span>
          )}
        </div>
      </li>
    );
  };

  return (
    <section className="card">
      <div className="spread wrap" style={{ marginBottom: 6 }}>
        <div>
          <h2>Doctor visits</h2>
          <p className="muted small" style={{ marginTop: 4 }}>{today.parent.name} is reminded on WhatsApp the evening before and on the day.</p>
        </div>
        <button className="btn ghost sm" onClick={() => setEditing('new')}><Icon name="plus" size={15} /> Add visit</button>
      </div>
      {!data ? <Skeleton h={120} /> : (
        <>
          {upcoming.length === 0 ? <div className="empty small">No visits coming up.</div> : <ul className="appt-list">{upcoming.map(row)}</ul>}
          {past.length > 0 && (
            <details className="past">
              <summary className="small">Earlier visits</summary>
              <ul className="appt-list">{past.map(row)}</ul>
            </details>
          )}
        </>
      )}
      {editing && (
        <AppointmentDialog parentId={id} parentName={today.parent.name} tz={tz} appointment={editing === 'new' ? null : editing} onClose={() => setEditing(null)}
          onCancelVisit={editing !== 'new' ? () => { setStatus(editing, 'CANCELLED'); setEditing(null); } : undefined}
          onSaved={(m) => { setEditing(null); notify(m); refresh(); }} />
      )}
    </section>
  );
}

function AppointmentDialog({ parentId, parentName, tz, appointment, onClose, onSaved, onCancelVisit }: {
  parentId: string; parentName: string; tz: string; appointment: Appointment | null; onClose: () => void; onSaved: (m: string) => void; onCancelVisit?: () => void;
}) {
  const [f, setF] = useState({
    title: appointment?.title ?? '',
    place: appointment?.place ?? '',
    localAt: appointment ? toLocalInput(appointment.at, tz) : '',
    notes: appointment?.notes ?? '',
    remindParent: appointment?.remindParent ?? true,
  });
  const [err, setErr] = useState('');
  async function save(e: FormEvent) {
    e.preventDefault();
    setErr('');
    try {
      if (appointment) await api(`/appointments/${appointment.id}`, { method: 'PATCH', body: f });
      else await api(`/parents/${parentId}/appointments`, { body: f });
      onSaved(appointment ? 'Visit updated' : 'Visit added');
    } catch (e2) {
      setErr((e2 as Error).message);
    }
  }
  return (
    <Modal title={appointment ? 'Change visit' : 'Add a doctor visit'} onClose={onClose}>
      <form onSubmit={save} className="stack" style={{ gap: 14 }}>
        <div><label className="field-label" htmlFor="ap-t">Who or what</label><input className="input" id="ap-t" value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} placeholder="Dr. Mehta (heart)" required autoFocus /></div>
        <div className="grid-2">
          <div><label className="field-label" htmlFor="ap-when">When ({parentName}’s time)</label><input className="input" id="ap-when" type="datetime-local" value={f.localAt} onChange={(e) => setF({ ...f, localAt: e.target.value })} required /></div>
          <div><label className="field-label" htmlFor="ap-p">Where <span className="muted">(optional)</span></label><input className="input" id="ap-p" value={f.place} onChange={(e) => setF({ ...f, place: e.target.value })} placeholder="Fortis, Noida" /></div>
        </div>
        <div><label className="field-label" htmlFor="ap-n">Notes <span className="muted">(optional)</span></label><input className="input" id="ap-n" value={f.notes} onChange={(e) => setF({ ...f, notes: e.target.value })} placeholder="Take the last reports and the BP diary" /></div>
        <label className="row" style={{ gap: 10, cursor: 'pointer' }}>
          <Switch on={f.remindParent} label={`Remind ${parentName}`} onChange={(remindParent) => setF({ ...f, remindParent })} />
          <span className="small">Remind {parentName} on WhatsApp the evening before and on the day</span>
        </label>
        {err && <p className="error">{err}</p>}
        <div className="spread">
          {onCancelVisit ? <button type="button" className="btn danger sm" onClick={onCancelVisit}>Cancel this visit</button> : <span />}
          <div className="row">
            <button type="button" className="btn quiet" onClick={onClose}>Close</button>
            <button className="btn" disabled={!f.title.trim() || !f.localAt}>Save</button>
          </div>
        </div>
      </form>
    </Modal>
  );
}

// ── Notes ────────────────────────────────────────────────────────────────

function Notes({ notify }: { notify: (m: string) => void }) {
  const { id, today, reload: reloadToday } = useParent();
  const { data, reload } = useApi<CareNote[]>(`/parents/${id}/notes`);
  const [text, setText] = useState('');
  const [err, setErr] = useState('');
  const refresh = () => {
    reload();
    reloadToday();
  };
  async function add(e: FormEvent) {
    e.preventDefault();
    setErr('');
    try {
      await api(`/parents/${id}/notes`, { body: { text } });
      setText('');
      notify('Note added');
      refresh();
    } catch (e2) {
      setErr((e2 as Error).message);
    }
  }
  const pin = async (n: CareNote) => {
    await api(`/notes/${n.id}`, { method: 'PATCH', body: { pinned: !n.pinned } });
    refresh();
  };
  const remove = async (n: CareNote) => {
    try {
      await api(`/notes/${n.id}`, { method: 'DELETE' });
      notify('Note deleted');
      refresh();
    } catch (e2) {
      notify((e2 as Error).message);
    }
  };

  return (
    <section className="card">
      <h2 style={{ marginBottom: 4 }}>Family notes</h2>
      <p className="muted small" style={{ marginBottom: 14 }}>Things everyone caring for {today.parent.name} should know. Pinned notes show on Today and in the doctor report.</p>
      <form className="note-form" onSubmit={add}>
        <input className="input" aria-label="New note" placeholder="e.g. Doctor said less salt" value={text} onChange={(e) => setText(e.target.value)} />
        <button className="btn" disabled={!text.trim()}>Add</button>
      </form>
      {err && <p className="error" style={{ marginTop: 8 }}>{err}</p>}
      {!data ? <Skeleton h={80} /> : (
        <ul className="notes">
          {data.map((n) => (
            <li key={n.id} className={n.pinned ? 'pinned' : ''}>
              <p>{n.text}</p>
              <div className="spread">
                <span className="tiny">{n.author?.name ?? 'Someone'} · {fmtAgo(n.createdAt)}</span>
                <span className="row" style={{ gap: 12 }}>
                  <button className="link-btn small quiet-link" onClick={() => pin(n)}>{n.pinned ? 'Unpin' : 'Pin'}</button>
                  <button className="link-btn small quiet-link" onClick={() => remove(n)}>Delete</button>
                </span>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
