import { useCallback, useEffect, useRef, useState } from 'react';
import { api } from './api';

/** Fetch a resource, optionally re-polling. Keeps the previous data while refetching (no flashes). */
export function useApi<T>(path: string | null, pollMs?: number) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const latest = useRef(path);
  latest.current = path;

  const reload = useCallback(async () => {
    if (!path) return;
    setLoading(true);
    try {
      const d = await api<T>(path);
      if (latest.current === path) {
        setData(d);
        setError(null);
      }
    } catch (e) {
      if (latest.current === path) setError((e as Error).message);
    } finally {
      if (latest.current === path) setLoading(false);
    }
  }, [path]);

  useEffect(() => {
    reload();
    if (!pollMs) return;
    const t = setInterval(reload, pollMs);
    return () => clearInterval(t);
  }, [reload, pollMs]);

  return { data, error, loading, reload };
}

export function useToast() {
  const [msg, setMsg] = useState<string | null>(null);
  useEffect(() => {
    if (!msg) return;
    const t = setTimeout(() => setMsg(null), 2600);
    return () => clearTimeout(t);
  }, [msg]);
  return { toast: msg, show: setMsg };
}


/** A WhatsApp message exactly as the server will send it (debounced while typing). */
export function usePreview(path: '/preview/reminder' | '/preview/consent', input: object) {
  const [preview, setPreview] = useState<{ text: string; buttons: string[] } | null>(null);
  const key = JSON.stringify(input);
  useEffect(() => {
    const t = setTimeout(() => {
      api<{ text: string; buttons: string[] }>(path, { body: JSON.parse(key) }).then(setPreview).catch(() => {});
    }, 250);
    return () => clearTimeout(t);
  }, [path, key]);
  return preview;
}

export const useReminderPreview = (input: { parentName: string; language: string; type: string; name: string; frequency: string; medicine?: { name: string; dose: string | null } | null; message?: string | null }) =>
  usePreview('/preview/reminder', input);
