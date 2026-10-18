import { createContext, useContext, useLayoutEffect, useRef, useState } from 'react';
import { Navigate, NavLink, Route, Routes, useLocation, useParams } from 'react-router-dom';
import { api } from '../../api';
import { useSession } from '../../App';
import { PhoneDrawer } from '../../components/PhoneDrawer';
import { Avatar, Skeleton } from '../../components/ui';
import { fmtAgo, timeDifference } from '../../format';
import { useApi } from '../../hooks';
import type { Today } from '../../types';
import { HistoryPage } from './HistoryPage';
import { SettingsPage } from './SettingsPage';
import { TodayPage } from './TodayPage';
import { RemindersPage } from './RemindersPage';
import { ReportPage } from './ReportPage';

interface Ctx {
  id: string;
  today: Today;
  reload: () => void;
}
const ParentCtx = createContext<Ctx>(null!);
export const useParent = () => useContext(ParentCtx);

const TABS = [
  ['', 'Today'],
  ['reminders', 'Reminders'],
  ['report', 'Weekly report'],
  ['history', 'History'],
  ['settings', 'Settings'],
] as const;

export function ParentDashboard() {
  const { id } = useParams<{ id: string }>();
  const { devTools, refreshFamily } = useSession();
  const location = useLocation();
  const { data: today, error, reload } = useApi<Today>(`/parents/${id}/today`, 5000);

  if (error && !today) return <div className="card empty"><div className="big">🤔</div>{error}</div>;
  if (!today || today.parent.id !== id) return <div className="simple"><Skeleton h={80} /><Skeleton h={200} /><Skeleton h={320} /></div>;

  const p = today.parent;
  const reloadAll = () => {
    reload();
    refreshFamily();
  };

  return (
    <ParentCtx.Provider value={{ id: id!, today, reload: reloadAll }}>
      <div className="parent-area">
      <header className="p-head">
        <Avatar name={p.name} size={52} />
        <div>
          <h1>{p.name}</h1>
          <p className="muted small">
            {p.relationship}
            {today.lastInboundAt && ` · last message ${fmtAgo(today.lastInboundAt)}`}
          </p>
          {timeDifference(p.timezone) && (
            <p className="tiny" style={{ marginTop: 2 }}>All times are {p.name}’s time ({timeDifference(p.timezone)})</p>
          )}
        </div>
        {p.consentStatus === 'PENDING' && (
          <button className="btn ghost sm" style={{ marginLeft: 'auto' }} onClick={() => api(`/parents/${p.id}/resend-consent`, { method: 'POST' })}>Send invite again</button>
        )}
      </header>

      <Tabs id={id!} label={`${p.name}'s pages`} />

      <div key={location.pathname} className="page-in">
      <Routes>
        <Route index element={<TodayPage />} />
        <Route path="reminders" element={<RemindersPage />} />
        <Route path="routines" element={<Navigate to="../reminders" replace />} />
        <Route path="report" element={<ReportPage />} />
        <Route path="week" element={<Navigate to="../report" replace />} />
        <Route path="history" element={<HistoryPage />} />
        <Route path="settings" element={<SettingsPage />} />
        {/* Old links (alerts, bookmarks) */}
        <Route path="schedule" element={<Navigate to="../report" replace />} />
        <Route path="*" element={<Navigate to="." replace />} />
      </Routes>
      </div>
      </div>

      {devTools && <PhoneDrawer parentId={p.id} parentName={p.name} parentPhone={p.phone} timeZone={p.timezone} onChange={reloadAll} />}
    </ParentCtx.Provider>
  );
}

/** Tab bar whose highlight slides to the active tab. */
function Tabs({ id, label }: { id: string; label: string }) {
  const nav = useRef<HTMLElement>(null);
  const { pathname } = useLocation();
  const [box, setBox] = useState<{ x: number; w: number } | null>(null);
  useLayoutEffect(() => {
    const measure = () => {
      const el = nav.current?.querySelector<HTMLElement>('a.active');
      if (el) setBox({ x: el.offsetLeft, w: el.offsetWidth });
    };
    measure();
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  }, [pathname]);
  return (
    <nav className="tabs" aria-label={label} ref={nav}>
      {box && <span className="tab-indicator" style={{ width: box.w, transform: `translateX(${box.x - 4}px)`, left: 4 }} aria-hidden />}
      {TABS.map(([path, text]) => (
        <NavLink key={path} to={path ? `/app/p/${id}/${path}` : `/app/p/${id}`} end={path === ''} className={({ isActive }) => (isActive ? 'active' : '')}>
          {text}
        </NavLink>
      ))}
    </nav>
  );
}
