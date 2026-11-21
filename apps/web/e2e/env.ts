/** Shared between global setup and tests (written to process.env by setup). */
export const WEB_URL = "http://localhost:3100";
/**
 * Must match the API URL baked into the web build (NEXT_PUBLIC_API_URL, default :4000).
 * Locally, if a dev API holds :4000: build with NEXT_PUBLIC_API_URL=http://localhost:4100
 * and run with E2E_API_URL=http://localhost:4100.
 */
export const API_URL = process.env.E2E_API_URL ?? "http://localhost:4000";
export const mailpitUrl = () => {
  const u = process.env.E2E_MAILPIT_URL;
  if (!u) throw new Error("E2E_MAILPIT_URL not set: global setup didn't run");
  return u;
};
