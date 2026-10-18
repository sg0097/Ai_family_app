import { createContext, useContext, useEffect, useState } from 'react';
import { Link, Navigate, NavLink, Route, Routes, useLocation } from 'react-router-dom';
import { api, getToken, setToken } from './api';
import { NotificationBell } from './components/NotificationBell';
import { Avatar, Logo, Modal } from './components/ui';
import { browserTimeZone } from './format';
import { AuthPage } from './pages/AuthPage';
import { FamilyPage } from './pages/FamilyPage';
import { Landing } from './pages/Landing';
import { OnboardingPage } from './pages/OnboardingPage';
import { ParentDashboard } from './pages/parent/ParentDashboard';
import type { FamilyMember, User } from './types';

interface Session {
  user: User | null;
  devTools: boolean;
  family: FamilyMember[] | null;
  refreshFamily: () => Promise<void>;
  signIn: (token: string, user: User) => void;
  signOut: () => void;
  setUser: (u: User) => void;
}

const SessionContext = createContext<Session>(null!);
export const useSession = () => useContext(SessionContext);

export function App() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(Boolean(getToken()));
  const [devTools, setDevTools] = useState(false);
  const [family, setFamily] = useState<FamilyMember[] | null>(null);

  const refreshFamily = async () => {
    setFamily(await api<FamilyMember[]>('/parents'));
  };

  useEffect(() => {
    api<{ devTools: boolean }>('/health').then((h) => setDevTools(h.devTools)).catch(() => {});
    if (getToken()) api<User>('/me').then(setUser).catch(() => setToken(null)).finally(() => setLoading(false));
  }, []);
  useEffect(() => {
    if (user) refreshFamily().catch(() => {});
    else setFamily(null);
  }, [user]);

  // Keep the child's timezone current (they may travel) so alerts can say whose time they mean.
  useEffect(() => {
    if (user && user.timezone !== browserTimeZone()) {
      api<User>('/me', { method: 'PATCH', body: { timezone: browserTimeZone() } }).then(setUser).catch(() => {});
    }
  }, [user?.id, user?.timezone]);

  const session: Session = {
    user,
    devTools,
    family,
    refreshFamily,
    signIn: (token, u) => {
      setToken(token);
      setUser(u);
    },
    signOut: () => {
      setToken(null);
      setUser(null);
    },
    setUser,
  };

  if (loading) return null;
  const guard = (el: JSX.Element) => (user ? <AppShell>{el}</AppShell> : <Navigate to="/login" replace />);
  return (
    <SessionContext.Provider value={session}>
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/login" element={user ? <Navigate to="/app" replace /> : <AuthPage mode="login" />} />
        <Route path="/signup" element={user ? <Navigate to="/app" replace /> : <AuthPage mode="signup" />} />
        <Route path="/app" element={guard(<FamilyPage />)} />
        <Route path="/app/new" element={guard(<OnboardingPage />)} />
        <Route path="/app/p/:id/*" element={guard(<ParentDashboard />)} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </SessionContext.Provider>
  );
}

type Theme = 'system' | 'light' | 'dark';
function useTheme() {
  const [theme, setTheme] = useState<Theme>(() => {
    try {
      return (localStorage.getItem('afc_theme') as Theme) || 'system';
    } catch {
      return 'system';
    }
  });
  useEffect(() => {
    if (theme === 'system') document.documentElement.removeAttribute('data-theme');
    else document.documentElement.setAttribute('data-theme', theme);
    try {
      localStorage.setItem('afc_theme', theme);
    } catch {
      /* preference just won't persist */
    }
  }, [theme]);
  return [theme, setTheme] as const;
}

function AppShell({ children }: { children: React.ReactNode }) {
  const { user, family, signOut } = useSession();
  const [open, setOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [theme, setTheme] = useTheme();
  const loc = useLocation();
  useEffect(() => setOpen(false), [loc.pathname]);

  return (
    <div className="app">
      <div className="nav-wrap" style={{ paddingTop: 0 }}>
        <nav className="nav">
          <Logo to="/app" />
          <div className="family-switch">
            {family?.map((p) => (
              <NavLink key={p.id} to={`/app/p/${p.id}`} className={({ isActive }) => (isActive ? 'on' : '')}>
                <Avatar name={p.name} size={26} />
                {p.name}
                {p.alerts > 0 && <span className="pill critical" style={{ padding: '1px 7px' }}>!</span>}
              </NavLink>
            ))}
          </div>
          <div className="row" style={{ marginLeft: 'auto', gap: 6 }}>
            <Link to="/app/new" className="btn ghost sm">+ Add parent</Link>
            <NotificationBell />
            <div className="menu">
              <button className="btn quiet sm" aria-expanded={open} aria-haspopup="menu" onClick={() => setOpen(!open)}>
                <Avatar name={user?.name ?? '?'} size={28} />
              </button>
              {open && (
                <div className="menu-pop" role="menu">
                  <div style={{ padding: '8px 12px 10px' }}>
                    <div style={{ fontWeight: 600 }}>{user?.name}</div>
                    <div className="tiny">{user?.email}</div>
                  </div>
                  <Link to="/app" role="menuitem">Family</Link>
                  <div style={{ padding: '6px 12px' }}>
                    <div className="tiny" style={{ marginBottom: 6 }}>Theme</div>
                    <div className="segmented">
                      {(['system', 'light', 'dark'] as Theme[]).map((t) => (
                        <button key={t} className={theme === t ? 'on' : ''} onClick={() => setTheme(t)}>{t[0].toUpperCase() + t.slice(1)}</button>
                      ))}
                    </div>
                  </div>
                  <button role="menuitem" onClick={signOut}>Sign out</button>
                  <button role="menuitem" style={{ color: 'var(--critical)' }} onClick={() => { setOpen(false); setDeleting(true); }}>Delete my account…</button>
                </div>
              )}
            </div>
          </div>
        </nav>
      </div>
      <main className="app-main">{children}</main>
      {deleting && <DeleteAccount onClose={() => setDeleting(false)} />}
    </div>
  );
}

function DeleteAccount({ onClose }: { onClose: () => void }) {
  const { signOut, family } = useSession();
  const [password, setPassword] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  async function remove(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErr('');
    try {
      await api('/me', { method: 'DELETE', body: { password } });
      signOut();
    } catch (e2) {
      setErr((e2 as Error).message);
      setBusy(false);
    }
  }
  const names = family?.map((p) => p.name).join(', ');
  return (
    <Modal title="Delete your account?" onClose={onClose}>
      <form onSubmit={remove}>
        <p className="muted" style={{ marginBottom: 14 }}>
          This permanently deletes your account{names ? ` and everything recorded for ${names}` : ''}. Reminders stop. This can’t be undone.
        </p>
        <label className="field-label" htmlFor="del-pw">Your password</label>
        <input className="input" id="del-pw" type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" autoFocus />
        {err && <p className="error" style={{ marginTop: 10 }}>{err}</p>}
        <div className="row" style={{ justifyContent: 'flex-end', marginTop: 18 }}>
          <button type="button" className="btn quiet" onClick={onClose}>Cancel</button>
          <button className="btn danger" disabled={!password || busy}>{busy ? 'Deleting…' : 'Delete everything'}</button>
        </div>
      </form>
    </Modal>
  );
}
