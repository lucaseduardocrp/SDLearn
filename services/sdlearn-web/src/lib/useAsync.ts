import { useCallback, useEffect, useState, type DependencyList } from 'react';

export interface AsyncState<T> {
  data: T | undefined;
  error: string | null;
  loading: boolean;
  reload: () => void;
  setData: (update: T | ((current: T | undefined) => T)) => void;
}

export function useAsync<T>(load: () => Promise<T>, deps: DependencyList): AsyncState<T> {
  const [data, setData] = useState<T>();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setError(null);
    load().then(
      (value) => { if (alive) { setData(value); setLoading(false); } },
      (reason: unknown) => { if (alive) { setError(reason instanceof Error ? reason.message : 'Algo deu errado.'); setLoading(false); } },
    );
    return () => { alive = false; };
  }, [...deps, attempt]);

  const reload = useCallback(() => setAttempt((value) => value + 1), []);
  return { data, error, loading, reload, setData: setData as AsyncState<T>['setData'] };
}
