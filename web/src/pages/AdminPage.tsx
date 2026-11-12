import { useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api';
import { useApi } from '../hooks';

interface Overview {
  users: number; signupsThisWeek: number; parents: number; parentsOnWhatsApp: number; parentsRepliedThisWeek: number;
  tiers: { trial: number; basic: number; premium: number; expired: number };
  messagesLast24h: { sent: number; byStatus: Record<string, number> };
  queues: { outbound: Record<string, number>; inbound: Record<string, number> };
  revenue: { paidOrders: number; totalInr: number };
  recentFailures: { id: string; toPhone: string | null; kind: string; failureReason: string | null; createdAt: string; parent: { name: string } | null }[];
}
interface AdminUser { id: string; name: string; email: string; createdAt: string; suspended: boolean; plan: string; trial: boolean; trialDaysLeft: number; parents: number; renewsAt: string | null }

const Stat = ({ label, value }: { label: string; value: string | number }) => (
  <div style={{ border: '1px solid var(--line)', borderRadius: 12, padding: '12px 14px', minWidth: 130 }}>
    <div className="muted tiny">{label}</div>
    <b style={{ fontSize: '1.4rem' }}>{value}</b>
  </div>
);

export function AdminPage() {
  const o = useApi<Overview>('/admin/overview');
  const u = useApi<AdminUser[]>('/admin/users');
  const [busy, setBusy] = useState('');

  async function patch(id: string, body: object) {
    setBusy(id);
    try { await api(`/admin/users/${id}`, { method: 'PATCH', body }); u.reload(); o.reload(); } finally { setBusy(''); }
  }

  if (o.error) return <p className="muted" style={{ padding: 24 }}>Not found.</p>;
  if (!o.data) return null;
  const d = o.data;
  return (
    <div style={{ maxWidth: 1000 }}>
      <Link to="/app" className="link-btn small">← Family</Link>
      <h1 style={{ margin: '10px 0 14px' }}>Admin</h1>
      <div className="row" style={{ gap: 10, flexWrap: 'wrap' }}>
        <Stat label="Users" value={d.users} />
        <Stat label="New this week" value={d.signupsThisWeek} />
        <Stat label="On trial" value={d.tiers.trial} />
        <Stat label="Basic" value={d.tiers.basic} />
        <Stat label="Premium" value={d.tiers.premium} />
        <Stat label="Trial ended, unpaid" value={d.tiers.expired} />
        <Stat label="Paid so far" value={`₹${d.revenue.totalInr}`} />
      </div>
      <div className="row" style={{ gap: 10, flexWrap: 'wrap', marginTop: 10 }}>
        <Stat label="Parents" value={d.parents} />
        <Stat label="Said yes on WhatsApp" value={d.parentsOnWhatsApp} />
        <Stat label="Replied this week" value={d.parentsRepliedThisWeek} />
        <Stat label="Messages sent, 24h" value={d.messagesLast24h.sent} />
        {Object.entries(d.messagesLast24h.byStatus).map(([k, v]) => <Stat key={k} label={`…${k}`} value={v} />)}
        <Stat label="Outbound waiting / failed" value={`${d.queues.outbound.waiting ?? 0} / ${d.queues.outbound.failed ?? 0}`} />
      </div>

      <h3 style={{ marginTop: 22 }}>Recent send failures</h3>
      {d.recentFailures.length === 0 ? <p className="muted small">None in the last 7 days.</p> : (
        <ul className="small">{d.recentFailures.map((f) => <li key={f.id}>{new Date(f.createdAt).toLocaleString()} · {f.parent?.name ?? '—'} {f.toPhone} · {f.kind} · {f.failureReason ?? 'no reason given'}</li>)}</ul>
      )}

      <h3 style={{ marginTop: 22 }}>Users</h3>
      <div style={{ overflowX: 'auto' }}>
        <table className="small" style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead><tr style={{ textAlign: 'left' }}><th>Name</th><th>Email</th><th>Plan</th><th>Parents</th><th>Joined</th><th></th></tr></thead>
          <tbody>
            {(u.data ?? []).map((x) => (
              <tr key={x.id} style={{ borderTop: '1px solid var(--line)' }}>
                <td>{x.name}{x.suspended && ' (suspended)'}</td>
                <td>{x.email}</td>
                <td>{x.plan === 'FREE' ? (x.trial ? `trial, ${x.trialDaysLeft}d` : 'ended') : x.plan}</td>
                <td>{x.parents}</td>
                <td>{new Date(x.createdAt).toLocaleDateString()}</td>
                <td style={{ whiteSpace: 'nowrap' }}>
                  <button className="link-btn tiny" disabled={busy === x.id} onClick={() => patch(x.id, { grant: 'BASIC', days: 30 })}>+30d Basic</button>{' · '}
                  <button className="link-btn tiny" disabled={busy === x.id} onClick={() => patch(x.id, { grant: 'PREMIUM', days: 30 })}>+30d Premium</button>{' · '}
                  <button className="link-btn tiny" disabled={busy === x.id} onClick={() => patch(x.id, { suspended: !x.suspended })}>{x.suspended ? 'Unsuspend' : 'Suspend'}</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
