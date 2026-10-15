import type { ActionInput, ActionResult } from '@shared/types';
import { useActionMutation } from './api';
import { useToast } from './toast';
import { errMsg } from './util';
import { focusField } from '@/components/bits';

// Runs one engine action. Success shows only after the server (or demo engine) confirms it.
// A refused action keeps the form as typed and moves focus to the field that needs fixing.
export function useAct() {
  const m = useActionMutation();
  const toast = useToast();
  const run = (data: ActionInput, o?: { done?: (r: ActionResult) => void; quiet?: boolean; fail?: (r: ActionResult) => void }) => {
    if (m.isPending) return; // ignore double taps while a request is in flight
    m.mutate(data, {
      onSuccess: (r) => {
        if (!r.ok) {
          toast(r.message || 'That did not go through', true);
          focusField(r.field);
          o?.fail?.(r);
        } else {
          if (!o?.quiet && r.message) toast(r.message);
          o?.done?.(r);
        }
      },
      onError: (e) => { toast(errMsg(e), true); o?.fail?.({ ok: false, message: errMsg(e) }); },
    });
  };
  return { run, pending: m.isPending };
}
