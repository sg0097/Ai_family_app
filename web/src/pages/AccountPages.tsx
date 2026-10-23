import { useEffect, useState, type FormEvent } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { api } from '../api';
import { useSession } from '../App';
import { Logo } from '../components/ui';
import type { User } from '../types';

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="shell narrow-page">
      <Logo />
      <div className="card pad-lg reveal" style={{ marginTop: 28 }}>{children}</div>
    </div>
  );
}

export function ForgotPage() {
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [err, setErr] = useState('');
  async function submit(e: FormEvent) {
    e.preventDefault();
    setErr('');
    try {
      await api('/auth/forgot', { body: { email } });
      setSent(true);
    } catch (e2) {
      setErr((e2 as Error).message);
    }
  }
  return (
    <Shell>
      {sent ? (
        <>
          <h1 style={{ fontSize: '1.8rem' }}>Check your email</h1>
          <p className="muted" style={{ marginTop: 10 }}>If {email} has an account, a link to choose a new password is on its way. It works once, for an hour.</p>
          <Link to="/login" className="btn ghost" style={{ marginTop: 20 }}>Back to sign in</Link>
        </>
      ) : (
        <form onSubmit={submit}>
          <h1 style={{ fontSize: '1.8rem' }}>Forgot your password?</h1>
          <p className="muted" style={{ margin: '8px 0 20px' }}>Enter your email and we’ll send a link to choose a new one.</p>
          <label className="field-label" htmlFor="fp-email">Email</label>
          <input className="input" id="fp-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoFocus autoComplete="email" />
          {err && <p className="error" style={{ marginTop: 10 }}>{err}</p>}
          <button className="btn lg" style={{ width: '100%', marginTop: 20 }}>Send link</button>
          <p className="muted small" style={{ marginTop: 16, textAlign: 'center' }}><Link to="/login" className="link-btn">Back to sign in</Link></p>
        </form>
      )}
    </Shell>
  );
}

export function ResetPage() {
  const { token } = useParams<{ token: string }>();
  const { signIn } = useSession();
  const navigate = useNavigate();
  const [password, setPassword] = useState('');
  const [err, setErr] = useState('');
  async function submit(e: FormEvent) {
    e.preventDefault();
    setErr('');
    try {
      const res = await api<{ token: string; user: User }>('/auth/reset', { body: { token, password } });
      signIn(res.token, res.user);
      navigate('/app', { replace: true });
    } catch (e2) {
      setErr((e2 as Error).message);
    }
  }
  return (
    <Shell>
      <form onSubmit={submit}>
        <h1 style={{ fontSize: '1.8rem' }}>Choose a new password</h1>
        <p className="muted" style={{ margin: '8px 0 20px' }}>You’ll be signed out everywhere else.</p>
        <label className="field-label" htmlFor="rp-pw">New password</label>
        <input className="input" id="rp-pw" type="password" minLength={8} value={password} onChange={(e) => setPassword(e.target.value)} required autoFocus autoComplete="new-password" />
        <p className="hint">At least 8 characters.</p>
        {err && <p className="error" style={{ marginTop: 10 }}>{err} {err.includes('expired') && <Link to="/forgot" className="link-btn">Get a new link</Link>}</p>}
        <button className="btn lg" style={{ width: '100%', marginTop: 20 }} disabled={password.length < 8}>Save password</button>
      </form>
    </Shell>
  );
}

interface InviteInfo {
  parentName: string;
  invitedBy: string;
  email: string;
  status: 'open' | 'accepted' | 'expired';
}

/** Where an invite link lands. Works signed out; after signing in you come back here. */
export function InvitePage() {
  const { token } = useParams<{ token: string }>();
  const { user, refreshFamily } = useSession();
  const navigate = useNavigate();
  const [info, setInfo] = useState<InviteInfo | null>(null);
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    api<InviteInfo>(`/invites/${token}`).then(setInfo).catch(() => setErr('This invite link isn’t valid.'));
  }, [token]);

  async function accept() {
    setBusy(true);
    setErr('');
    try {
      const { parentId } = await api<{ parentId: string }>(`/invites/${token}/accept`, { body: {} });
      await refreshFamily();
      navigate(`/app/p/${parentId}`, { replace: true });
    } catch (e2) {
      setErr((e2 as Error).message);
      setBusy(false);
    }
  }
  const next = encodeURIComponent(`/invite/${token}`);

  return (
    <Shell>
      {!info ? (
        err ? <p className="error">{err}</p> : <p className="muted">One moment…</p>
      ) : (
        <>
          <div className="eyebrow">Invitation</div>
          <h1 style={{ fontSize: '1.9rem', margin: '8px 0 10px' }}>
            Help care for <em>{info.parentName}</em>
          </h1>
          <p className="muted">
            {info.invitedBy} uses Family Care to stay close to {info.parentName}’s everyday health through WhatsApp. Join to see how {info.parentName}’s day is going and get the same alerts.
          </p>
          {info.status === 'expired' && <p className="error" style={{ marginTop: 16 }}>This invite has expired. Ask {info.invitedBy} to send a new one.</p>}
          {info.status !== 'expired' && (
            user ? (
              user.email === info.email ? (
                <button className="btn lg" style={{ marginTop: 22 }} onClick={accept} disabled={busy}>{busy ? 'Joining…' : `Join ${info.parentName}’s care team`}</button>
              ) : (
                <p className="error" style={{ marginTop: 18 }}>This invite is for {info.email}, but you’re signed in as {user.email}. Sign out and use {info.email}.</p>
              )
            ) : (
              <div className="row wrap" style={{ marginTop: 22, gap: 10 }}>
                <Link to={`/signup?next=${next}&email=${encodeURIComponent(info.email)}`} className="btn lg">Create an account</Link>
                <Link to={`/login?next=${next}`} className="btn ghost lg">I have an account</Link>
              </div>
            )
          )}
          {info.status !== 'expired' && !user && <p className="tiny" style={{ marginTop: 14 }}>Use {info.email}; the invite only works for that address.</p>}
          {err && <p className="error" style={{ marginTop: 14 }}>{err}</p>}
        </>
      )}
    </Shell>
  );
}
