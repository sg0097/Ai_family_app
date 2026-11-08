import { useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api';
import { useSession } from '../App';
import { Icon } from '../components/Icon';
import { fmtDate } from '../format';
import { useApi } from '../hooks';
import type { PlanInfo, User } from '../types';

type Plan = PlanInfo & { payments: 'demo' | 'unavailable' };
type Tier = 'BASIC' | 'PREMIUM';

const BASIC = [
  'Reminders on WhatsApp, in your words, signed by you',
  'She replies with one tap, or just “haan”',
  'One evening note: “4 of 5 done today”',
  'HELP reaches you at once',
  'Medicines, refill warnings, doctor visit reminders',
  'This week’s report and the last 2 weeks of history',
];
const PREMIUM = [
  'Reminders in your own voice, played before each one',
  'Say hi any time, in your voice',
  'Brothers and sisters share one view',
  'Doctor visit report to print or share',
  'Full history, week after week',
];

export function PlanPage() {
  const { setUser } = useSession();
  const { data, reload } = useApi<Plan>('/plan');
  const [busy, setBusy] = useState<string>('');
  const [error, setError] = useState('');

  async function change(to: 'upgrade' | 'cancel', plan?: Tier) {
    setBusy(plan ?? to);
    setError('');
    try {
      await api(`/plan/${to}`, { method: 'POST', body: plan ? { plan } : undefined });
      reload();
      setUser(await api<User>('/me'));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy('');
    }
  }

  if (!data) return null;
  const n = Math.max(data.parents, 1);
  const total = (per: number) => `₹${per * n} a month for ${n} parent${n === 1 ? '' : 's'}`;
  const action = (tier: Tier) => {
    if (data.plan === tier) return <span className="pill">Your plan</span>;
    if (data.payments !== 'demo') return <button className="btn" disabled>Coming soon</button>;
    const label = data.plan === 'PREMIUM' && tier === 'BASIC' ? 'Switch to Basic' : data.plan === 'FREE' ? `Choose ${tier === 'BASIC' ? 'Basic' : 'Premium'}` : 'Upgrade to Premium';
    return <button className={tier === 'PREMIUM' ? 'btn' : 'btn quiet'} disabled={!!busy} onClick={() => change('upgrade', tier)}>{busy === tier ? 'One moment…' : label}</button>;
  };

  return (
    <div className="plan-page">
      <Link to="/app" className="link-btn small"><Icon name="left" size={14} /> Family</Link>
      <h1 style={{ margin: '10px 0 4px' }}>Plans</h1>
      <p className="muted small">
        {data.plan !== 'FREE'
          ? `You’re on ${data.plan === 'PREMIUM' ? 'Premium' : 'Basic'}${data.renewsAt ? `, until ${fmtDate(data.renewsAt, { day: 'numeric', month: 'long' })}` : ''}: ₹${data.monthlyInr} a month.`
          : data.trial
            ? `Your free trial has ${data.trialDaysLeft} day${data.trialDaysLeft === 1 ? '' : 's'} left, with everything in Premium open. Pick a plan before it ends so reminders keep going.`
            : 'Your free trial has ended, so reminders are paused. Pick a plan to start them again.'}
      </p>

      <div className="plans">
        <section className={`plan-card${data.plan === 'BASIC' ? ' current' : ''}`}>
          <div className="plan-name">Basic</div>
          <div className="plan-price"><b>₹{data.basicInr}</b><span className="tiny"> / parent / month</span></div>
          <p className="tiny">{total(data.basicInr)}. Her day, every day.</p>
          <ul>{BASIC.map((f) => <li key={f}><Icon name="check" size={14} /> {f}</li>)}</ul>
          {action('BASIC')}
        </section>
        <section className={`plan-card family${data.plan === 'PREMIUM' ? ' current' : ''}`}>
          <div className="plan-name">Premium</div>
          <div className="plan-price"><b>₹{data.premiumInr}</b><span className="tiny"> / parent / month</span></div>
          <p className="tiny">{total(data.premiumInr)}. Your voice in her day.</p>
          <ul>
            <li><Icon name="check" size={14} /> Everything in Basic</li>
            {PREMIUM.map((f) => <li key={f}><Icon name="check" size={14} /> {f}</li>)}
          </ul>
          {action('PREMIUM')}
        </section>
      </div>
      {data.plan !== 'FREE' && data.payments === 'demo' && (
        <p style={{ marginTop: 12 }}><button className="link-btn small" disabled={!!busy} onClick={() => change('cancel')}>Stop my plan</button></p>
      )}
      {data.payments === 'demo' && <p className="tiny" style={{ marginTop: 12 }}>Demo: no payment is taken. Real payments (Razorpay, UPI) arrive with the live launch.</p>}
      {error && <p className="error" style={{ marginTop: 12 }}>{error}</p>}
    </div>
  );
}
