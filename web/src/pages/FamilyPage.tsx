import { useState, type FormEvent } from 'react';
import { Num } from '../components/Num';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../api';
import { useSession } from '../App';
import { Icon } from '../components/Icon';
import { Avatar, Skeleton, Switch } from '../components/ui';
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
  const totals = (family ?? []).reduce((acc, p) => ({ done: acc.done + p.today.done, total: acc.total + p.today.total }), { done: 0, total: 0 });
  return (
    <div className="dash home">
      <section className="welcome">
        <div className="welcome-text">
          <span className="welcome-date">{new Date().toLocaleDateString([], { weekday: 'long', day: 'numeric', month: 'long' })}</span>
          <h1>{greeting()}, {user?.name.split(' ')[0]} 👋</h1>
          <p>
            {!family?.length
              ? 'Add a parent to get started. It takes about two minutes.'
              : needsYou.length
                ? `${needsYou.map((p) => p.name).join(' and ')} could use a call.`
                : 'Everyone’s day looks good so far.'}
          </p>
          {devTools && (
            <button className="btn sm welcome-seed" onClick={seed} disabled={seeding}>
              {seeding ? 'Creating…' : 'Add demo parent (45 days of history)'}
            </button>
          )}
        </div>
        {family && family.length > 0 && (
          <div className="welcome-stats">
            <div><b><Num value={family.length} /></b><span>{family.length === 1 ? 'parent' : 'parents'}</span></div>
            <div><b><Num value={totals.done} /><small>/{totals.total}</small></b><span>done today</span></div>
            <div className={needsYou.length ? 'warn' : ''}><b><Num value={needsYou.length} /></b><span>need you</span></div>
          </div>
        )}
      </section>

      {!family ? (
        <div className="family-grid">
          <Skeleton h={260} />
          <Skeleton h={260} />
        </div>
      ) : (
        <div className="family-grid">
          {family.map((p, i) => (
            <ParentCard key={p.id} p={p} delay={i * 0.06} />
          ))}
          <Link to="/app/new" className="parent-card add-card">
            <span className="add-ic"><Icon name="plus" size={26} /></span>
            <h3>Add a parent</h3>
            <p className="muted small">Mummy, Papa, Dadi, Nani…<br />Takes about two minutes</p>
          </Link>
        </div>
      )}

      <AlertNumber />
    </div>
  );
}

const LOOK_TONE: Record<string, { icon: 'pill' | 'heart' | 'drop' | 'glass' | 'walk' | 'smile'; tone: string }> = {
  MEDICINE: { icon: 'pill', tone: 'pink' },
  BP: { icon: 'heart', tone: 'violet' },
  SUGAR: { icon: 'drop', tone: 'amber' },
  WATER: { icon: 'glass', tone: 'blue' },
  WALK: { icon: 'walk', tone: 'green' },
  WELLBEING: { icon: 'smile', tone: 'orange' },
};

function ParentCard({ p, delay }: { p: FamilyMember; delay: number }) {
  const { done, total } = p.today;
  const status = dayStatus({ name: p.name, consentStatus: p.consentStatus, lastInboundAt: p.lastInboundAt, alerts: p.alerts, routines: p.today.routines, urgent: p.urgent });
  const consented = p.consentStatus === 'GRANTED';
  const list = p.today.routines.filter((r) => r.status !== 'not_today');
  return (
    <Link to={`/app/p/${p.id}`} className={`parent-card pc tone-${status.tone}`} style={{ animationDelay: `${delay}s` }}>
      <div className="pc-band" aria-hidden />
      <div className="pc-head">
        <span className="pc-av" style={{ '--p': total ? done / total : 0 } as React.CSSProperties}><Avatar name={p.name} size={52} /></span>
        <div style={{ minWidth: 0, flex: 1 }}>
          <h2>{p.name}</h2>
          <div className="tiny">{p.relationship}{p.lastInboundAt ? ` · last message ${fmtAgo(p.lastInboundAt)}` : ''}</div>
        </div>
        {consented && total > 0 && <div className="pc-count"><b><Num value={done} /></b>/{total}<span>done</span></div>}
      </div>
      <div className={`pc-status ${status.tone}`}>
        <span className="pc-status-ic" aria-hidden><Icon name={status.icon} size={16} /></span>
        <div>
          <b>{status.title}</b>
          <div className="tiny">{status.needs[0] ?? status.detail}</div>
        </div>
      </div>
      {consented && list.length > 0 && (
        <div className="pc-chips" aria-label="Today’s reminders">
          {list.map((r, i) => (
            <span key={i} className={`pc-chip ${r.status}`} title={`${ROUTINE_LABEL[r.type]}: ${r.status.replace('_', ' ')}`}>
              <span className={`ichip c-${LOOK_TONE[r.type].tone}`}><Icon name={LOOK_TONE[r.type].icon} stroke={2.4} /></span>
              {r.status === 'done' && <i className="pc-tick"><Icon name="check" size={9} stroke={3.4} /></i>}
            </span>
          ))}
        </div>
      )}
      <div className="pc-foot">Open {p.name}’s dashboard <Icon name="arrow" size={15} /></div>
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
    <form className="card alert-card" onSubmit={save}>
      <div className="spread wrap">
        <div style={{ maxWidth: 520 }} className="row">
          <span className="alert-ic" aria-hidden><Icon name="bell" size={20} /></span>
          <div>
          <h2>Where should alerts go?</h2>
          <p className="muted small" style={{ marginTop: 6 }}>
            We tell you when something isn’t done, and right away if a parent sends HELP. A family alert, not an emergency service.
          </p>
          </div>
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
