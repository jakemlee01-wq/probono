import type { ActionInput, ActionResult } from '@shared/types';
import { useActionMutation } from './api';
import { useToast } from './toast';
import { errMsg } from './util';

export function useAct() {
  const m = useActionMutation();
  const toast = useToast();
  const run = (data: ActionInput, o?: { done?: (r: ActionResult) => void; quiet?: boolean }) =>
    m.mutate(data, {
      onSuccess: (r) => {
        if (!r.ok) toast(r.message || 'That did not go through', true);
        else {
          if (!o?.quiet && r.message) toast(r.message);
          o?.done?.(r);
        }
      },
      onError: (e) => toast(errMsg(e), true),
    });
  return { run, pending: m.isPending };
}
