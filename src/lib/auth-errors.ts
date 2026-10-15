// Supabase auth errors, in plain words. Raw provider text is never shown.
type AuthLike = { code?: string; status?: number; message?: string; name?: string } | null | undefined;
export type AuthContext = 'sign_in' | 'sign_up' | 'reset' | 'update' | 'resend';

export function authMessage(e: AuthLike, context: AuthContext): string {
  const code = e?.code ?? '';
  const msg = (e?.message ?? '').toLowerCase();
  if (e?.name === 'AuthRetryableFetchError' || msg.includes('failed to fetch') || msg.includes('network')) {
    return "We couldn't reach probono. Check your connection and try again.";
  }
  if (code === 'invalid_credentials' || msg === 'invalid login credentials') return "That email and password don't match.";
  if (code === 'email_not_confirmed') return 'Please confirm your email first. Use "Resend confirmation" below if the link is missing.';
  if (code.startsWith('over_') || e?.status === 429) return 'Too many attempts. Please wait a few minutes and try again.';
  if (code === 'weak_password') return 'Choose a stronger password: at least 8 characters and not a common one.';
  if (code === 'same_password') return 'Choose a password you have not used here before.';
  if (code === 'email_address_invalid' || code === 'email_address_not_authorized' || (code === 'validation_failed' && msg.includes('email'))) {
    return "That email address can't be used. Check it for typos, or try another address.";
  }
  if (code === 'signup_disabled') return 'New accounts are paused right now.';
  if (['session_expired', 'session_not_found', 'refresh_token_not_found', 'bad_jwt', 'reauthentication_needed'].includes(code)) {
    return 'Your session has expired. Please sign in again.';
  }
  if (['otp_expired', 'flow_state_expired', 'flow_state_not_found', 'bad_code_verifier'].includes(code)) {
    return 'That link has expired or was already used. Request a new one below.';
  }
  return {
    sign_in: "We couldn't sign you in. Please try again.",
    sign_up: "We couldn't create the account. Please try again.",
    reset: "We couldn't send the reset email. Please try again.",
    update: "We couldn't save the new password. Request a new reset link and try again.",
    resend: "We couldn't resend the email. Please try again.",
  }[context];
}

// Shown after sign-up and reset requests whether or not the address has an account, so the page
// can't be used to check who is registered.
export const NEUTRAL_SIGN_UP = "If this address can be used, we've sent a confirmation link. Open it on this device to finish.";
export const NEUTRAL_RESET = "If there's an account for that address, we've sent a link to set a new password.";
