import { useEffect, useState } from 'react';
import axios from 'axios';
import { api } from '@/lib/api';
import { getErrorMessage } from '@/lib/errors';
import type { Meta, Paginated } from '@/lib/types';

type Params = Record<string, string | number | boolean | undefined | null>;

interface State<T> {
  data: T[];
  meta: Meta | null;
  loading: boolean;
  error: string | null;
}

function clean(params: Params) {
  const out: Record<string, string | number | boolean> = {};
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null && value !== '') out[key] = value;
  }
  return out;
}

/**
 * Mengambil daftar berpaginasi. Kirim `params = null` untuk menahan request.
 */
export function useApiList<T>(path: string, params: Params | null) {
  const key = JSON.stringify(params);
  const [tick, setTick] = useState(0);
  const [state, setState] = useState<State<T>>({
    data: [],
    meta: null,
    loading: true,
    error: null,
  });

  useEffect(() => {
    if (params === null) return;
    const controller = new AbortController();
    setState((s) => ({ ...s, loading: true, error: null }));

    api
      .get<Paginated<T>>(path, { params: clean(params), signal: controller.signal })
      .then(({ data }) => {
        setState({ data: data.data, meta: data.meta, loading: false, error: null });
      })
      .catch((err) => {
        if (axios.isCancel(err)) return;
        setState((s) => ({ ...s, loading: false, error: getErrorMessage(err) }));
      });

    return () => controller.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [path, key, tick]);

  return { ...state, refetch: () => setTick((t) => t + 1) };
}

