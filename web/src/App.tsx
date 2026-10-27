import { createContext, useContext, useEffect, useState } from 'react';
import { Link, Navigate, NavLink, Route, Routes, useLocation, useSearchParams } from 'react-router-dom';
import { api, getToken, setToken } from './api';
import { NotificationBell } from './components/NotificationBell';
import { Avatar, Logo, Modal } from './components/ui';
import { browserTimeZone } from './format';
import { Icon } from './components/Icon';
import { useScrollReveal } from './motion';
import { ForgotPage, InvitePage, ResetPage } from './pages/AccountPages';
import { AuthPage } from './pages/AuthPage';
import { FamilyPage } from './pages/FamilyPage';
import { Landing } from './pages/Landing';
import { PlanPage } from './pages/PlanPage';
import { OnboardingPage } from './pages/OnboardingPage';
import { ParentDashboard } from './pages/parent/ParentDashboard';
import type { FamilyMember, User } from './types';

interface Session {
  user: User | null;
  devTools: boolean;
  demo: boolean;
  /** AI-dependent features (Ask, patterns), off until proven with real parents. */
  labs: boolean;
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
  const [demo, setDemo] = useState(false);
  const [labs, setLabs] = useState(false);
  const [family, setFamily] = useState<FamilyMember[] | null>(null);

  const refreshFamily = async () => {
    setFamily(await api<FamilyMember[]>('/parents'));
  };

  useEffect(() => {
    api<{ devTools: boolean; demo?: boolean; labs?: boolean }>('/health').then((h) => { setDevTools(h.devTools); setDemo(Boolean(h.demo)); setLabs(Boolean(h.labs)); }).catch(() => {});
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
    demo,
    labs,
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

  useScrollReveal();
  if (loading) return null;
  const guard = (el: JSX.Element) => (user ? <AppShell>{el}</AppShell> : <Navigate to="/login" replace />);
  return (
    <SessionContext.Provider value={session}>
      {demo && <DemoBanner />}
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/login" element={user ? <AfterAuth /> : <AuthPage mode="login" />} />
        <Route path="/signup" element={user ? <AfterAuth /> : <AuthPage mode="signup" />} />
        <Route path="/forgot" element={<ForgotPage />} />
        <Route path="/reset/:token" element={<ResetPage />} />
        <Route path="/invite/:token" element={<InvitePage />} />
        <Route path="/app" element={guard(<FamilyPage />)} />
        <Route path="/app/new" element={guard(<OnboardingPage />)} />
        <Route path="/app/plan" element={guard(<PlanPage />)} />
        <Route path="/app/p/:id/*" element={guard(<ParentDashboard />)} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </SessionContext.Provider>
  );
}

/** The sections of a parent's pages, each with its own colour, as listed in the sidebar and tab bar. */
export const SECTIONS = [
  { path: '', label: 'Today', icon: 'home', tone: 'green' },
  { path: 'reminders', label: 'Reminders', icon: 'bell', tone: 'amber' },
  { path: 'care', label: 'Care', icon: 'pill', tone: 'pink' },
  { path: 'report', label: 'Weekly report', icon: 'chart', tone: 'violet' },
  { path: 'history', label: 'History', icon: 'calendar', tone: 'blue' },
  { path: 'settings', label: 'Settings', icon: 'gear', tone: 'slate' },
] as const;

function AppShell({ children }: { children: React.ReactNode }) {
  const { user, family, signOut } = useSession();
  const [open, setOpen] = useState(false);
  const [drawer, setDrawer] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const loc = useLocation();
  useEffect(() => { setOpen(false); setDrawer(false); }, [loc.pathname]);
  const activeParent = loc.pathname.match(/^\/app\/p\/([^/]+)/)?.[1];
  const plan = user?.plan;

  return (
    <div className={`app shell${drawer ? ' drawer-open' : ''}`}>
      <aside className="side" aria-label="Main">
        <div className="side-top">
          <Logo to="/app" />
          <button className="side-close" onClick={() => setDrawer(false)} aria-label="Close menu"><Icon name="x" size={16} /></button>
        </div>

        <NavLink to="/app" end className={({ isActive }) => `side-link${isActive ? ' active' : ''}`}>
          <span className="side-ic t-violet"><Icon name="home" size={16} /></span>Family home
        </NavLink>

        <div className="side-label">Parents</div>
        {family?.map((p) => {
          const on = activeParent === p.id;
          const pct = p.today.total ? p.today.done / p.today.total : 0;
          return (
            <div key={p.id} className={`side-parent${on ? ' on' : ''}`}>
              <NavLink to={`/app/p/${p.id}`} className="side-parent-link">
                <span className="side-av" style={{ '--p': pct } as React.CSSProperties}><Avatar name={p.name} size={30} /></span>
                <span className="side-parent-name">
                  <b>{p.name}</b>
                  <small>{p.consentStatus !== 'GRANTED' ? 'Waiting for yes' : p.today.total ? `${p.today.done} of ${p.today.total} done today` : 'Nothing today'}</small>
                </span>
                {p.alerts > 0 ? <span className="side-alert" title="Needs you">!</span> : p.attention > 0 ? <span className="side-dot" title="Something to check" /> : null}
              </NavLink>
              {on && (
                <nav className="side-sub" aria-label={`${p.name}’s pages`}>
                  {SECTIONS.map((s) => (
                    <NavLink key={s.path} to={s.path ? `/app/p/${p.id}/${s.path}` : `/app/p/${p.id}`} end={s.path === ''} className={({ isActive }) => `side-link sub${isActive ? ' active' : ''}`}>
                      <span className={`side-ic t-${s.tone}`}><Icon name={s.icon} size={15} /></span>{s.label}
                    </NavLink>
                  ))}
                </nav>
              )}
            </div>
          );
        })}
        <Link to="/app/new" className="side-add"><Icon name="plus" size={15} /> Add a parent</Link>

        <div className="side-bottom">
          {plan && (
            <Link to="/app/plan" className={`side-plan${plan.plan === 'FAMILY' ? ' paid' : ''}`}>
              <b>{plan.plan === 'FAMILY' ? 'Family plan' : plan.trialDaysLeft ? `Family trial · ${plan.trialDaysLeft} days left` : 'Free plan'}</b>
              <span>{plan.plan === 'FAMILY' ? 'Voice notes, 4 parents, siblings' : 'Your voice in reminders, siblings, 4 parents'}</span>
              <em>{plan.plan === 'FAMILY' ? 'Manage' : 'See plans'} →</em>
            </Link>
          )}
          <div className="menu side-user">
            <button className="side-user-btn" aria-expanded={open} aria-haspopup="menu" onClick={() => setOpen(!open)}>
              <Avatar name={user?.name ?? '?'} size={32} />
              <span><b>{user?.name}</b><small>{user?.email}</small></span>
              <Icon name="right" size={14} />
            </button>
            {open && (
              <div className="menu-pop up" role="menu">
                <Link to="/app/plan" role="menuitem">Plan</Link>
                <button role="menuitem" onClick={signOut}>Sign out</button>
                <button role="menuitem" style={{ color: 'var(--critical)' }} onClick={() => { setOpen(false); setDeleting(true); }}>Delete my account…</button>
              </div>
            )}
          </div>
        </div>
      </aside>
      <div className="side-scrim" onClick={() => setDrawer(false)} aria-hidden />

      <div className="main-col">
        <header className="topbar">
          <button className="topbar-menu" onClick={() => setDrawer(true)} aria-label="Open menu"><Icon name="menu" size={20} /></button>
          <span className="topbar-logo"><Logo to="/app" tagline={false} /></span>
          <div className="topbar-title">
            <Link to="/app">Family</Link>
            {activeParent && family?.find((p) => p.id === activeParent) && <><Icon name="right" size={13} /><b>{family.find((p) => p.id === activeParent)!.name}</b></>}
            {loc.pathname === '/app/plan' && <><Icon name="right" size={13} /><b>Plans</b></>}
            {loc.pathname === '/app/new' && <><Icon name="right" size={13} /><b>Add a parent</b></>}
          </div>
          <div className="row" style={{ marginLeft: 'auto', gap: 8 }}>
            <Link to="/app/new" className="btn ghost sm topbar-add"><Icon name="plus" size={14} /> Add parent</Link>
            <NotificationBell />
          </div>
        </header>
        <main className="app-main">{children}</main>
      </div>
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

/** A hosted demo must never be mistaken for the real service. */
function DemoBanner() {
  return (
    <div className="demo-banner" role="note">
      <b>Demo</b> WhatsApp messages here are simulated and never sent to real phones. Please don’t enter real health details.
    </div>
  );
}

/** After signing in, go back where the person was headed (e.g. an invite link), never off-site. */
function AfterAuth() {
  const [params] = useSearchParams();
  const next = params.get('next');
  return <Navigate to={next && next.startsWith('/') && !next.startsWith('//') ? next : '/app'} replace />;
}
