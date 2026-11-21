/** Shared between global setup and tests (written to process.env by setup). */
export const WEB_URL = "http://localhost:3100";
export const API_URL = "http://localhost:4000"; // baked into the web build (NEXT_PUBLIC_API_URL default)
export const mailpitUrl = () => {
  const u = process.env.E2E_MAILPIT_URL;
  if (!u) throw new Error("E2E_MAILPIT_URL not set: global setup didn't run");
  return u;
};
