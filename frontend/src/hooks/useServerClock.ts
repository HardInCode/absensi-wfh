import { useCallback, useEffect, useRef, useState } from 'react';
import { api } from '@/lib/api';

export type ClockStatus = 'syncing' | 'synced' | 'offline';

const RESYNC_MS = 5 * 60 * 1000;

/**
 * Jam yang disinkronkan ke GET /api/time.
 * offset = waktu server (dikoreksi setengah RTT) - waktu perangkat.
 * Ini hanya tampilan; waktu absen resmi tetap dibuat server.
 */
export function useServerClock() {
  const offsetRef = useRef(0);
  const [now, setNow] = useState(() => new Date());
  const [status, setStatus] = useState<ClockStatus>('syncing');

  const sync = useCallback(async () => {
    const started = performance.now();
    try {
      const { data } = await api.get<{ now: string }>('/time');
      const rtt = performance.now() - started;
      offsetRef.current = new Date(data.now).getTime() + rtt / 2 - Date.now();
      setNow(new Date(Date.now() + offsetRef.current));
      setStatus('synced');
    } catch {
      setStatus((s) => (s === 'synced' ? 'synced' : 'offline'));
    }
  }, []);

  useEffect(() => {
    sync();
    const id = setInterval(sync, RESYNC_MS);
    return () => clearInterval(id);
  }, [sync]);

  useEffect(() => {
    const id = setInterval(() => {
      setNow(new Date(Date.now() + offsetRef.current));
    }, 1000);
    return () => clearInterval(id);
  }, []);

  return { now, status };
}

