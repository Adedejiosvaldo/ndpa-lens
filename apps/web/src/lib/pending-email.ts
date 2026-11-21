/**
 * The address a sign-up link was sent to, kept in this tab only. Personal
 * data stays out of URLs, where it would end up in history and server logs.
 */
const KEY = "ndpa.pendingEmail";

export function rememberPendingEmail(email: string) {
  try {
    sessionStorage.setItem(KEY, email);
  } catch {
    /* storage blocked: the page falls back to "your inbox" */
  }
}

export function readPendingEmail(): string {
  try {
    return sessionStorage.getItem(KEY) ?? "";
  } catch {
    return "";
  }
}
