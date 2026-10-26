import { useState, type FormEvent } from 'react';
import { Num } from '../components/Num';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../api';
import { useSession } from '../App';
import { Icon } from '../components/Icon';
import { Avatar, Ring, Skeleton, Switch } from '../components/ui';
import { ROUTINE_LABEL, fmtAgo, greeting } from '../format';
import { dayStatus } from '../status';
import type { FamilyMember, User } from '../types';

export function FamilyPage() {
  const { user, family, devTools, refreshFamily } = useSession();
  const navigate = useNavigate();
  const [seeding, setSeeding] = useState(false);

  async function seed() {
    setSeeding(true);
    try {
      const { id } = await api<{ id: string }>('/dev/seed-demo', { method: 'POST' });
      await refreshFamily();
      navigate(`/app/p/${id}`);
    } finally {
      setSeeding(false);
    }
  }

  const needsYou = family?.filter((p) => {
    const tone = dayStatus({ name: p.name, consentStatus: p.consentStatus, lastInboundAt: p.lastInboundAt, alerts: p.alerts, routines: p.today.routines, urgent: p.urgent }).tone;
    return tone === 'help' || tone === 'needs';
  }) ?? [];
  return (
    <div className="stack">
      <div className="page-head reveal">
        <div>
          <div className="eyebrow">{new Date().toLocaleDateString([], { weekday: 'long', day: 'numeric', month: 'long' })}</div>
          <h1 style={{ marginTop: 8 }}>
            {greeting()}, <em>{user?.name.split(' ')[0]}</em>
          </h1>
          <p className="muted" style={{ marginTop: 8 }}>
            {!family?.length
              ? 'Add a parent to get started.'
              : needsYou.length
                ? `${needsYou.map((p) => p.name).join(' and ')} could use a call.`
                : 'Everyone’s day looks good so far.'}
          </p>
        </div>
        {devTools && (
          <button className="btn ghost sm" onClick={seed} disabled={seeding}>
            {seeding ? 'Creating…' : 'Add demo parent (45 days of history)'}
          </button>
        )}
      </div>

      {!family ? (
        <div className="family-grid">
          <Skeleton h={240} />
          <Skeleton h={240} />
        </div>
      ) : (
        <div className="family-grid">
          {family.map((p, i) => (
            <ParentCard key={p.id} p={p} delay={i * 0.06} />
          ))}
          <Link to="/app/new" className="parent-card add-card">
            <div>
              <div style={{ marginBottom: 8, display: 'grid', placeItems: 'center' }}><Icon name="plus" size={28} /></div>
              <h3>Add a parent</h3>
              <p className="muted small" style={{ marginTop: 4 }}>Takes about two minutes</p>
            </div>
          </Link>
        </div>
      )}

      <AlertNumber />
    </div>
  );
}

function ParentCard({ p, delay }: { p: FamilyMember; delay: number }) {
  const { done, total } = p.today;
  const status = dayStatus({ name: p.name, consentStatus: p.consentStatus, lastInboundAt: p.lastInboundAt, alerts: p.alerts, routines: p.today.routines, urgent: p.urgent });
  const consented = p.consentStatus === 'GRANTED';
  return (
    <Link to={`/app/p/${p.id}`} className={`parent-card reveal tone-${status.tone}`} style={{ animationDelay: `${delay}s` }}>
      <div className="spread" style={{ alignItems: 'flex-start' }}>
        <div className="row">
          <Avatar name={p.name} size={48} />
          <div>
            <h2 style={{ fontSize: '1.4rem' }}>{p.name}</h2>
            <div className="tiny">{p.lastInboundAt ? `Last message ${fmtAgo(p.lastInboundAt)}` : p.relationship}</div>
          </div>
        </div>
        {consented && total > 0 && (
          <Ring value={done} total={total} size={60} stroke={7}>
            <b style={{ fontSize: '0.95rem' }}><Num value={done} />/{total}</b>
          </Ring>
        )}
      </div>
      <div className="card-status">
        <span className="ci" aria-hidden><Icon name={status.icon} size={22} /></span>
        <div>
          <b>{status.title}</b>
          <div className="tiny">{status.needs[0] ?? status.detail}</div>
        </div>
      </div>
      {consented && (
        <div className="routine-dots" aria-hidden>
          {p.today.routines.filter((r) => r.status !== 'not_today').map((r, i) => (
            <span key={i} className={`routine-dot ${r.status}`} title={`${ROUTINE_LABEL[r.type]}: ${r.status.replace('_', ' ')}`}><Icon name={r.status === 'done' ? 'check' : ({ MEDICINE: 'pill', BP: 'heart', SUGAR: 'drop', WATER: 'glass', WALK: 'walk', WELLBEING: 'smile' } as const)[r.type]} size={16} /></span>
          ))}
        </div>
      )}
    </Link>
  );
}

function AlertNumber() {
  const { user, setUser } = useSession();
  const [phone, setPhone] = useState(user?.phone ?? '');
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');

  async function save(e: FormEvent) {
    e.preventDefault();
    setError('');
    try {
      setUser(await api<User>('/me', { method: 'PATCH', body: { phone: phone || null } }));
      setSaved(true);
    } catch (err) {
      setError((err as Error).message);
    }
  }

  return (
    <form className="card" onSubmit={save} style={{ marginTop: 28 }}>
      <div className="spread wrap">
        <div style={{ maxWidth: 520 }}>
          <h2>Where should alerts go?</h2>
          <p className="muted small" style={{ marginTop: 6 }}>
            We tell you when something isn’t done, and right away if a parent sends HELP. A family alert, not an emergency service.
          </p>
        </div>
        <div className="row" style={{ flex: '1 1 280px', maxWidth: 380 }}>
          <input className="input" type="tel" aria-label="Your WhatsApp number" placeholder="98123 45678" value={phone} onChange={(e) => { setPhone(e.target.value); setSaved(false); }} />
          <button type="submit" className="btn">{saved ? 'Saved ✓' : 'Save'}</button>
        </div>
      </div>
      {!user?.phone && !saved && <p className="hint">Not set yet. Alerts will only show here, under the bell.</p>}
      {user?.phone && (
        <label className="row" style={{ marginTop: 14, gap: 10, cursor: 'pointer' }}>
          <Switch on={user.whatsappAlerts} label="Send not-done alerts to WhatsApp" onChange={async (v) => setUser(await api<User>('/me', { method: 'PATCH', body: { whatsappAlerts: v } }))} />
          <span className="small">Also send “not done yet” alerts to WhatsApp <span className="muted">(HELP alerts always go)</span></span>
        </label>
      )}
      {user?.phone && (
        <label className="row" style={{ marginTop: 10, gap: 10, cursor: 'pointer' }}>
          <Switch on={user.middaySummary} label="1 PM summary on WhatsApp" onChange={async (v) => {
            setError('');
            try { setUser(await api<User>('/me', { method: 'PATCH', body: { middaySummary: v } })); } catch (err) { setError((err as Error).message); }
          }} />
          <span className="small">A 1 PM note on how the day is going so far <span className="muted">(Family plan)</span></span>
        </label>
      )}
      {error && <p className="error" style={{ marginTop: 8 }}>{error}</p>}
    </form>
  );
}
