import { Chat } from '../../components/Chat';
import { Skeleton } from '../../components/ui';
import { useApi } from '../../hooks';
import type { ChatMessage } from '../../types';
import { useParent } from './ParentDashboard';

export function ChatTab() {
  const { id, today } = useParent();
  const { data } = useApi<ChatMessage[]>(`/parents/${id}/messages?limit=200`, 4000);
  return (
    <section className="card">
      <div className="card-head">
        <div>
          <h2>Conversation with {today.parent.name}</h2>
          <p className="sub" style={{ marginTop: 4 }}>Everything sent and received on WhatsApp. Each reply shows whether rules, buttons or AI understood it.</p>
        </div>
      </div>
      {data ? <Chat messages={data} parentPhone={today.parent.phone} timeZone={today.parent.timezone} height="min(640px, 70vh)" /> : <Skeleton h={480} />}
    </section>
  );
}
