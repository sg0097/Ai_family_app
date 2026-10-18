import { useSearchParams } from 'react-router-dom';
import { ChatTab } from './ChatTab';
import { Records } from './Records';
import { TrendsTab } from './TrendsTab';

/** Detail for those who want it: charts, every record, and the WhatsApp messages. */
export function HistoryPage() {
  // ?view=messages lets other pages link straight to a view.
  const [params, setParams] = useSearchParams();
  const view = (['charts', 'records', 'messages'] as const).find((v) => v === params.get('view')) ?? 'charts';
  const setView = (v: string) => setParams(v === 'charts' ? {} : { view: v }, { replace: true });
  return (
    <div className="stack">
      <div className="segmented" role="tablist" aria-label="History view">
        {([['charts', 'Charts'], ['records', 'All records'], ['messages', 'Messages']] as const).map(([v, label]) => (
          <button key={v} role="tab" aria-selected={view === v} className={view === v ? 'on' : ''} onClick={() => setView(v)}>{label}</button>
        ))}
      </div>
      {view === 'charts' && <TrendsTab />}
      {view === 'records' && <Records />}
      {view === 'messages' && <ChatTab />}
    </div>
  );
}
