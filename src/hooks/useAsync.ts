import { useCallback, useEffect, useRef, useState } from 'react';
import { useApp } from '../stores/appStore';

export interface AsyncState<T> {
  data: T | undefined;
  loading: boolean;
  error: string | null;
  reload: () => void;
}

/** Runs a loader and reruns it whenever data changes anywhere in the app (or deps change). */
export function useAsync<T>(loader: () => Promise<T>, deps: unknown[] = []): AsyncState<T> {
  const version = useApp(s => s.dataVersion);
  const [data, setData] = useState<T>();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tick, setTick] = useState(0);
  const alive = useRef(true);

  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    loader()
      .then(d => {
        if (!cancelled && alive.current) {
          setData(d);
          setError(null);
        }
      })
      .catch(e => {
        if (!cancelled && alive.current) {
          setError(e instanceof Error ? e.message : String(e));
        }
      })
      .finally(() => {
        if (!cancelled && alive.current) {
          setLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [version, tick, ...deps]);

  const reload = useCallback(() => setTick(t => t + 1), []);
  return { data, loading, error, reload };
}
