import { useState, type FormEvent } from 'react';
import { Icon, type IconName } from '../components/Icon';
import { Link, useSearchParams } from 'react-router-dom';
import { api } from '../api';
import { useSession } from '../App';
import { Logo } from '../components/ui';
import { browserTimeZone } from '../format';
import type { User } from '../types';

export function AuthPage({ mode }: { mode: 'signup' | 'login' }) {
  const { signIn } = useSession();
  const [params] = useSearchParams();
  const [form, setForm] = useState({ name: '', email: params.get('email') ?? '', password: '' });
  const keep = params.toString() ? `?${params.toString()}` : '';
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      const body = mode === 'signup' ? { ...form, timezone: browserTimeZone() } : { email: form.email, password: form.password };
      const res = await api<{ token: string; user: User }>(`/auth/${mode}`, { body });
      signIn(res.token, res.user);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }
  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) => setForm({ ...form, [k]: e.target.value });

  return (
    <div className="auth">
      <div className="auth-art">
        <Logo />
        <div className="auth-art-body">
          <h2>Know how Maa’s day is going, <em>by lunchtime.</em></h2>
          <div className="auth-tiles" aria-hidden>
            {[['pill', 'pink', 'Medicine', 'Done ✓'], ['heart', 'violet', 'BP', '128/82'], ['smile', 'orange', 'Feeling', 'Good'], ['glass', 'blue', 'Water', '6 of 8']].map(([icon, tone, label, value], i) => (
              <div key={label} className="auth-tile" style={{ '--i': i } as React.CSSProperties}>
                <span className={`ichip c-${tone}`}><Icon name={icon as IconName} stroke={2.4} /></span>
                <b>{label}</b><span>{value}</span>
              </div>
            ))}
          </div>
        </div>
        <p className="auth-foot">Parents chat on WhatsApp. You see the picture.</p>
      </div>
      <div className="auth-form">
        <form onSubmit={submit} className="reveal">
          <h1 style={{ fontSize: '2rem', marginBottom: 8 }}>{mode === 'signup' ? 'Create your account' : 'Welcome back'}</h1>
          <p className="muted" style={{ marginBottom: 28 }}>
            {mode === 'signup' ? 'Takes a minute. Then add your first parent.' : 'Sign in to see how your family is doing.'}
          </p>
          {mode === 'signup' && (
            <div className="field">
              <label className="field-label" htmlFor="name">Your name</label>
              <input className="input" id="name" value={form.name} onChange={set('name')} required autoComplete="name" />
            </div>
          )}
          <div className="field">
            <label className="field-label" htmlFor="email">Email</label>
            <input className="input" id="email" type="email" value={form.email} onChange={set('email')} required autoComplete="email" />
          </div>
          <div className="field">
            <label className="field-label" htmlFor="password">Password</label>
            <input
              className="input"
              id="password"
              type="password"
              value={form.password}
              onChange={set('password')}
              required
              minLength={mode === 'signup' ? 8 : undefined}
              autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
            />
            {mode === 'signup' ? <p className="hint">At least 8 characters.</p> : <p className="hint"><Link to="/forgot" className="link-btn">Forgot password?</Link></p>}
          </div>
          {error && <p className="error" style={{ marginTop: 14 }}>{error}</p>}
          <button type="submit" className="btn lg" disabled={busy} style={{ width: '100%', marginTop: 22 }}>
            {busy ? 'One moment…' : mode === 'signup' ? 'Create account' : 'Sign in'}
          </button>
          <p className="muted small" style={{ marginTop: 18, textAlign: 'center' }}>
            {mode === 'signup' ? 'Already have an account? ' : 'New here? '}
            <Link to={`${mode === 'signup' ? '/login' : '/signup'}${keep}`} className="link-btn">{mode === 'signup' ? 'Sign in' : 'Create an account'}</Link>
          </p>
        </form>
      </div>
    </div>
  );
}
