import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { ActionInput, ActionResult, AppConfig, AppState } from '@shared/types';
import { SUPABASE_ANON_KEY, SUPABASE_URL, supabase } from './supabase';

const BASE = `${SUPABASE_URL}/functions/v1/api`;

export class ApiError extends Error {
  constructor(message: string, public status: number) { super(message); }
}

export async function call<T>(path: string, init?: { method?: string; body?: unknown }): Promise<T> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token ?? SUPABASE_ANON_KEY;
  const res = await fetch(BASE + path, {
    method: init?.method ?? 'GET',
    headers: { Authorization: `Bearer ${token}`, apikey: SUPABASE_ANON_KEY, 'Content-Type': 'application/json' },
    body: init?.body === undefined ? undefined : JSON.stringify(init.body),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError((body as { error?: string }).error || 'Something went wrong.', res.status);
  return body as T;
}

export const useConfig = () =>
  useQuery({ queryKey: ['config'], queryFn: () => call<AppConfig>('/config'), staleTime: 5 * 60_000 });

export const useAppState = (postingId?: string) =>
  useQuery({
    queryKey: ['state', postingId ?? ''],
    queryFn: () => call<AppState>(`/state${postingId ? `?postingId=${encodeURIComponent(postingId)}` : ''}`),
    refetchInterval: 8000,
    placeholderData: (prev) => prev,
  });

export function useActionMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: ActionInput) => call<ActionResult>('/actions', { method: 'POST', body: data }),
    onSettled: () => qc.invalidateQueries({ queryKey: ['state'] }),
  });
}
