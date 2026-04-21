import { Resend } from "resend";

let _resend: Resend | null = null;

/** Lazy-initialized Resend client — avoids throwing at import time when RESEND_API_KEY is unset (e.g. CI builds). */
export function getResend(): Resend {
  if (!_resend) {
    _resend = new Resend(process.env.RESEND_API_KEY);
  }
  return _resend;
}
