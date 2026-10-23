import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api';
import { fmtAgo } from '../format';
import { useApi } from '../hooks';
import type { AppNotification } from '../types';
import { Icon, type IconName } from './Icon';

const ICON: Record<AppNotification['kind'], IconName> = { NOT_DONE: 'clock', RESOLVED: 'check', SILENCE: 'message', HELP: 'alert', REPORT: 'report', SYMPTOM: 'bandage', REFILL: 'pill', APPOINTMENT: 'calendar', TEAM: 'heart' };

/** The child's alerts: things not done, silence, HELP, and "it's sorted" updates. */
export function NotificationBell() {
  const { data, reload } = useApi<{ items: AppNotification[]; unread: number }>('/notifications?limit=30', 15000);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => !ref.current?.contains(e.target as Node) && setOpen(false);
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [open]);

  const markAll = async () => {
    await api('/notifications/read', { body: {} });
    reload();
  };
  const unread = data?.unread ?? 0;

  return (
    <div className="menu bell" ref={ref}>
      <button className="btn quiet sm" aria-label={`Alerts${unread ? `, ${unread} unread` : ''}`} aria-expanded={open} onClick={() => setOpen(!open)} style={{ fontSize: '1.1rem', padding: '8px 10px' }}>
        <Icon name="bell" size={20} />
        {unread > 0 && <span className="count">{unread > 9 ? '9+' : unread}</span>}
      </button>
      {open && (
        <div className="menu-pop notif-pop" role="dialog" aria-label="Alerts">
          <div className="spread" style={{ padding: '14px 14px 10px' }}>
            <b>Alerts</b>
            {unread > 0 && <button className="link-btn small" onClick={markAll}>Mark all read</button>}
          </div>
          <div className="notif-list">
            {!data?.items.length ? (
              <div className="empty small">No alerts yet. You’ll hear here if something isn’t done.</div>
            ) : (
              data.items.map((n) => (
                <Link
                  key={n.id}
                  to={`/app/p/${n.parentId}/${n.kind === 'REPORT' ? 'report' : n.kind === 'HELP' ? '' : 'report'}`}
                  className={`notif${n.readAt ? '' : ' unread'}`}
                  onClick={() => {
                    setOpen(false);
                    if (!n.readAt) api('/notifications/read', { body: { ids: [n.id] } }).then(reload);
                  }}
                >
                  <span className={`fi k-${n.kind.toLowerCase()}`} aria-hidden><Icon name={ICON[n.kind]} size={17} /></span>
                  <div>
                    <div style={{ fontWeight: n.readAt ? 500 : 700, fontSize: '0.9rem' }}>{n.title}</div>
                    <div className="tiny" style={{ marginTop: 2 }}>{n.body}</div>
                    <div className="tiny" style={{ marginTop: 4 }}>{fmtAgo(n.createdAt)}{n.whatsappAt ? ' · also sent to your WhatsApp' : ''}</div>
                  </div>
                </Link>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
