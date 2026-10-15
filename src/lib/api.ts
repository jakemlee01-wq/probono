import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { ActionInput, ActionResult, AppConfig, AppState } from '@shared/types';
import { SUPABASE_ANON_KEY, SUPABASE_URL, supabase } from './supabase';
import { demo, useDemoPersona } from './demo-store';

const BASE = `${SUPABASE_URL}/functions/v1/api`;

export class ApiError extends Error {
  constructor(message: string, public status: number) { super(message); }
}

export async function call<T>(path: string, init?: { method?: string; body?: unknown; token?: string }): Promise<T> {
  const token = init?.token ?? (await supabase.auth.getSession()).data.session?.access_token ?? SUPABASE_ANON_KEY;
  let res: Response;
  try {
    res = await fetch(BASE + path, {
      method: init?.method ?? 'GET',
      headers: { Authorization: `Bearer ${token}`, apikey: SUPABASE_ANON_KEY, 'Content-Type': 'application/json' },
      body: init?.body === undefined ? undefined : JSON.stringify(init.body),
    });
  } catch {
    throw new ApiError("We couldn't reach probono. Check your connection. Nothing was saved.", 0);
  }
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError((body as { error?: string }).error || 'Something went wrong. Nothing was saved.', res.status);
  return body as T;
}

const NO_CONFIG: AppConfig = { supportUrl: null, policiesPublished: false };
export const useConfig = () =>
  useQuery({
    queryKey: ['config'],
    queryFn: () => call<AppConfig>('/config').catch(() => NO_CONFIG),
    staleTime: 5 * 60_000,
    placeholderData: NO_CONFIG,
  });

// The same screens run against the real API or the in-browser demo.
export function useAppState(postingId?: string) {
  const persona = useDemoPersona();
  return useQuery({
    queryKey: ['state', persona ?? 'live', postingId ?? ''],
    queryFn: () => (persona ? demo.state(postingId) : call<AppState>(`/state${postingId ? `?postingId=${encodeURIComponent(postingId)}` : ''}`)),
    refetchInterval: persona ? 30_000 : 8000,
    placeholderData: (prev) => prev,
    retry: (n, e) => !(e instanceof ApiError && e.status === 401) && n < 3,
  });
}

export function useActionMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: ActionInput) => (demo.persona() ? demo.act(data) : call<ActionResult>('/actions', { method: 'POST', body: data })),
    onSettled: () => qc.invalidateQueries({ queryKey: ['state'] }),
  });
}

export function useOnline() {
  const [online, setOnline] = useState(() => (typeof navigator === 'undefined' ? true : navigator.onLine));
  useEffect(() => {
    const on = () => setOnline(true), off = () => setOnline(false);
    window.addEventListener('online', on); window.addEventListener('offline', off);
    return () => { window.removeEventListener('online', on); window.removeEventListener('offline', off); };
  }, []);
  return online;
}
