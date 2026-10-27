import { useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api';
import { useSession } from '../App';
import { Icon } from '../components/Icon';
import { fmtDate } from '../format';
import { useApi } from '../hooks';
import type { PlanInfo, User } from '../types';

type Plan = PlanInfo & { freeParents: number; familyParents: number; payments: 'demo' | 'unavailable' };

const FREE = [
  'Reminders on WhatsApp, signed with your name',
  'Write them in your own words',
  'She replies with one tap, or just “haan”',
  'Today’s status and this week’s report',
  'An alert if something isn’t done; HELP right away',
  'The last 2 weeks of history',
];
const FAMILY = [
  'Reminders in your own voice',
  'Say hi any time; she answers with one tap',
  'Doctor visit report to print or share',
  'Full history',
  'Up to 4 parents, with brothers and sisters',
  'The 1 PM WhatsApp summary',
];

export function PlanPage() {
  const { setUser } = useSession();
  const { data, reload } = useApi<Plan>('/plan');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function change(to: 'upgrade' | 'cancel') {
    setBusy(true);
    setError('');
    try {
      await api(`/plan/${to}`, { method: 'POST' });
      reload();
      setUser(await api<User>('/me'));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  if (!data) return null;
  const paid = data.plan === 'FAMILY';
  return (
    <div className="plan-page">
      <Link to="/app" className="link-btn small"><Icon name="left" size={14} /> Family</Link>
      <h1 style={{ margin: '10px 0 4px' }}>Plans</h1>
      <p className="muted small">
        {paid
          ? `You’re on the Family plan${data.renewsAt ? `, until ${fmtDate(data.renewsAt, { day: 'numeric', month: 'long' })}` : ''}.`
          : data.trialDaysLeft
            ? `Family plan features are open for ${data.trialDaysLeft} more day${data.trialDaysLeft === 1 ? '' : 's'} of your free trial.`
            : 'You’re on the free plan. Reminders, replies and alerts stay free.'}
      </p>

      <div className="plans">
        <section className={`plan-card${!paid ? ' current' : ''}`}>
          <div className="plan-name">Free</div>
          <div className="plan-price"><b>₹0</b></div>
          <p className="tiny">One parent, the daily essentials.</p>
          <ul>{FREE.map((f) => <li key={f}><Icon name="check" size={14} /> {f}</li>)}</ul>
          {!paid && <span className="pill">{data.trialDaysLeft ? 'After your trial' : 'Your plan'}</span>}
        </section>
        <section className={`plan-card family${paid ? ' current' : ''}`}>
          <div className="plan-name">Family</div>
          <div className="plan-price"><b>₹{data.priceInr}</b><span className="tiny"> / month</span></div>
          <p className="tiny">Everything in Free, and your voice in her day.</p>
          <ul>{FAMILY.map((f) => <li key={f}><Icon name="check" size={14} /> {f}</li>)}</ul>
          {paid ? (
            <button className="btn quiet sm" disabled={busy} onClick={() => change('cancel')}>Switch back to Free</button>
          ) : data.payments === 'demo' ? (
            <button className="btn" disabled={busy} onClick={() => change('upgrade')}>{busy ? 'Upgrading…' : `Get Family · ₹${data.priceInr}/month`}</button>
          ) : (
            <button className="btn" disabled>Coming soon</button>
          )}
        </section>
      </div>
      {data.payments === 'demo' && <p className="tiny" style={{ marginTop: 12 }}>Demo: no payment is taken. Real payments (Razorpay, UPI) arrive with the live launch.</p>}
      {error && <p className="error" style={{ marginTop: 12 }}>{error}</p>}
    </div>
  );
}
