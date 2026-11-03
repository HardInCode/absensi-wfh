import { useCallback, useEffect, useState } from "react";
import axios from "axios";
import { getErrorMessage, type Paged } from "@/lib/hrdApi";

/**
 * `fetcher` harus fungsi stabil (level modul). `params` harus bisa di-JSON-kan.
 */
export function usePagedQuery<T, P>(
  fetcher: (params: P, signal: AbortSignal) => Promise<Paged<T>>,
  params: P,
  enabled = true,
) {
  const key = JSON.stringify(params);
  const [data, setData] = useState<Paged<T> | null>(null);
  const [isLoading, setIsLoading] = useState(enabled);
  const [error, setError] = useState<string | null>(null);
  const [reloadToken, setReloadToken] = useState(0);

  useEffect(() => {
    if (!enabled) return;
    const controller = new AbortController();
    setIsLoading(true);
    setError(null);
    fetcher(JSON.parse(key) as P, controller.signal)
      .then((result) => setData(result))
      .catch((err: unknown) => {
        if (axios.isCancel(err)) return;
        setError(getErrorMessage(err, "Gagal memuat data."));
      })
      .finally(() => {
        if (!controller.signal.aborted) setIsLoading(false);
      });
    return () => controller.abort();
  }, [fetcher, key, enabled, reloadToken]);

  const reload = useCallback(() => setReloadToken((n) => n + 1), []);

  return { data, isLoading, error, reload };
}

