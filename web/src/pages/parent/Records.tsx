import { useState, type FormEvent } from 'react';
import { api } from '../../api';
import { Modal, Skeleton, Toast } from '../../components/ui';
import { RoutineIcon } from '../../components/Icon';
import { SOURCE_LABEL, fmtClock, fmtDate } from '../../format';
import { useApi, useToast } from '../../hooks';
import type { HealthRecord } from '../../types';
import { useParent } from './ParentDashboard';

const FILTERS = [
  ['', 'All'],
  ['MEDICINE', 'Medicine'],
  ['BP', 'BP'],
  ['SUGAR', 'Sugar'],
  ['WATER', 'Water'],
  ['WEIGHT', 'Weight'],
  ['WALK', 'Walk'],
  ['WELLBEING', 'Feeling'],
  ['SYMPTOM', 'Symptoms'],
] as const;

function describe(r: HealthRecord): string {
  switch (r.type) {
    case 'BP': return `${r.valueNum}/${r.valueNum2} mmHg`;
    case 'SUGAR': return `${r.valueNum} mg/dL`;
    case 'WATER': return `${r.valueNum} glasses so far`;
    case 'WEIGHT': return `${r.valueNum} kg`;
    case 'MEDICINE':
    case 'WALK': {
      const what = r.occurrence?.routine.name ?? (r.type === 'WALK' ? 'walk' : 'medicine');
      return r.valueText === 'done' ? `Confirmed ${what}` : `Said “not yet” to ${what}`;
    }
    case 'WELLBEING': return `Feeling ${r.valueText}`;
    case 'SYMPTOM': return r.valueText ?? '';
  }
}

export function Records() {
  const { id, today } = useParent();
  const tz = today.parent.timezone;
  const [type, setType] = useState('');
  const { data, reload, loading } = useApi<HealthRecord[]>(`/parents/${id}/events?limit=300${type ? `&type=${type}` : ''}`);
  const [adding, setAdding] = useState(false);
  const [removing, setRemoving] = useState<HealthRecord | null>(null);
  const { toast, show } = useToast();

  async function remove() {
    if (!removing) return;
    await api(`/events/${removing.id}`, { method: 'DELETE' });
    setRemoving(null);
    show('Record removed');
    reload();
  }

  return (
    <div className="stack">
      <div className="spread wrap">
        <div className="row wrap" style={{ gap: 6 }} role="group" aria-label="Filter records">
          {FILTERS.map(([t, label]) => (
            <button key={t} className={`chip${type === t ? ' on' : ''}`} onClick={() => setType(t)}>{label}</button>
          ))}
        </div>
        <button className="btn" onClick={() => setAdding(true)}>+ Add a reading</button>
      </div>

      <section className="card" style={{ padding: 0, overflow: 'hidden' }}>
        {!data ? (
          <div style={{ padding: 20 }}><Skeleton h={300} /></div>
        ) : data.length === 0 ? (
          <div className="empty"><div className="big">📭</div>No records yet. They appear as {today.parent.name} replies on WhatsApp.</div>
        ) : (
          <div style={{ overflowX: 'auto', opacity: loading ? 0.6 : 1 }}>
            <table className="table">
              <thead>
                <tr><th>When</th><th>What</th><th>Details</th><th>From</th><th><span className="sr-only">Actions</span></th></tr>
              </thead>
              <tbody>
                {data.map((r) => (
                  <tr key={r.id}>
                    <td className="num" style={{ whiteSpace: 'nowrap' }}>
                      {fmtDate(r.occurredAt, { weekday: 'short', day: 'numeric', month: 'short' }, tz)}
                      <div className="tiny">{fmtClock(r.occurredAt, tz)}</div>
                    </td>
                    <td style={{ whiteSpace: 'nowrap' }}><span className="row" style={{ gap: 10 }}><RoutineIcon type={r.type} size={30} /><b style={{ textTransform: r.type === 'SYMPTOM' ? 'capitalize' : undefined }}>{describe(r)}</b></span></td>
                    <td className="small muted">
                      {r.context}
                      {r.message && <div className="tiny" style={{ fontStyle: 'italic' }}>“{r.message.body}”</div>}
                    </td>
                    <td><span className={`pill${r.source === 'DASHBOARD' ? ' blue' : r.source === 'LLM' ? ' coral' : ''}`}>{SOURCE_LABEL[r.source]}</span></td>
                    <td><button className="btn quiet sm" aria-label="Remove record" title="Remove (e.g. if it was misunderstood)" onClick={() => setRemoving(r)}>✕</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {adding && <AddReading onClose={() => setAdding(false)} onSaved={() => { setAdding(false); show('Reading added ✓'); reload(); }} />}
      {removing && (
        <Modal title="Remove this record?" onClose={() => setRemoving(null)}>
          <p className="muted" style={{ marginBottom: 18 }}>“{describe(removing)}” will be removed from {today.parent.name}’s history and trends. Use this when something was misunderstood.</p>
          <div className="row" style={{ justifyContent: 'flex-end' }}>
            <button className="btn quiet" onClick={() => setRemoving(null)}>Cancel</button>
            <button className="btn danger" onClick={remove}>Remove</button>
          </div>
        </Modal>
      )}
      <Toast message={toast} />
    </div>
  );
}

function AddReading({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const { id } = useParent();
  const [type, setType] = useState<'BP' | 'SUGAR' | 'WEIGHT' | 'SYMPTOM'>('BP');
  const [f, setF] = useState({ a: '', b: '', name: '', note: '', when: new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 16) });
  const [err, setErr] = useState('');

  async function save(e: FormEvent) {
    e.preventDefault();
    setErr('');
    const base = { type, occurredAt: new Date(f.when).toISOString(), note: f.note || undefined };
    const body =
      type === 'BP' ? { ...base, systolic: Number(f.a), diastolic: Number(f.b) }
      : type === 'SYMPTOM' ? { ...base, name: f.name }
      : { ...base, value: Number(f.a) };
    try {
      await api(`/parents/${id}/events`, { body });
      onSaved();
    } catch (e2) {
      setErr((e2 as Error).message);
    }
  }

  return (
    <Modal title="Add a reading" onClose={onClose}>
      <form onSubmit={save}>
        <div className="segmented" style={{ marginBottom: 18 }}>
          {(['BP', 'SUGAR', 'WEIGHT', 'SYMPTOM'] as const).map((t) => (
            <button type="button" key={t} className={type === t ? 'on' : ''} onClick={() => setType(t)}>{{ BP: 'BP', SUGAR: 'Sugar', WEIGHT: 'Weight', SYMPTOM: 'Symptom' }[t]}</button>
          ))}
        </div>
        {type === 'BP' && (
          <div className="grid-2">
            <div><label className="field-label" htmlFor="sys">Upper (systolic)</label><input className="input" id="sys" type="number" inputMode="numeric" required value={f.a} onChange={(e) => setF({ ...f, a: e.target.value })} placeholder="130" /></div>
            <div><label className="field-label" htmlFor="dia">Lower (diastolic)</label><input className="input" id="dia" type="number" inputMode="numeric" required value={f.b} onChange={(e) => setF({ ...f, b: e.target.value })} placeholder="80" /></div>
          </div>
        )}
        {(type === 'SUGAR' || type === 'WEIGHT') && (
          <div className="field"><label className="field-label" htmlFor="val">{type === 'SUGAR' ? 'Sugar (mg/dL)' : 'Weight (kg)'}</label><input className="input" id="val" type="number" step="0.1" required value={f.a} onChange={(e) => setF({ ...f, a: e.target.value })} /></div>
        )}
        {type === 'SYMPTOM' && (
          <div className="field"><label className="field-label" htmlFor="sym">What they mentioned</label><input className="input" id="sym" required value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} placeholder="knee pain" /></div>
        )}
        <div className="grid-2" style={{ marginTop: 14 }}>
          <div><label className="field-label" htmlFor="when">When</label><input className="input" id="when" type="datetime-local" required value={f.when} onChange={(e) => setF({ ...f, when: e.target.value })} /></div>
          <div><label className="field-label" htmlFor="note">Note (optional)</label><input className="input" id="note" value={f.note} onChange={(e) => setF({ ...f, note: e.target.value })} placeholder="at the clinic" /></div>
        </div>
        {err && <p className="error" style={{ marginTop: 12 }}>{err}</p>}
        <div className="row" style={{ justifyContent: 'flex-end', marginTop: 22 }}>
          <button type="button" className="btn quiet" onClick={onClose}>Cancel</button>
          <button className="btn">Save reading</button>
        </div>
      </form>
    </Modal>
  );
}
