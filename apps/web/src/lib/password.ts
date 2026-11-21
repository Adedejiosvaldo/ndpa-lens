/** Rough strength for the meter only; the API enforces 12+ chars and the breached-password check. */
export function passwordStrength(pw: string): { score: 0 | 1 | 2 | 3 | 4; label: string } {
  if (!pw) return { score: 0, label: "" };
  let s = 0;
  if (pw.length >= 12) s++;
  if (pw.length >= 16) s++;
  if (/[a-z]/.test(pw) && /[A-Z]/.test(pw)) s++;
  if (/\d/.test(pw) && /[^A-Za-z0-9]/.test(pw)) s++;
  if (pw.length < 12) s = 0;
  const score = Math.min(4, s) as 0 | 1 | 2 | 3 | 4;
  return { score, label: ["Too short", "Weak", "Fair", "Good", "Strong"][score]! };
}
