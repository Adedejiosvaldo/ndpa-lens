/** British English with Nigerian conventions (PRD §3.1, §11): ₦, 20 Nov 2026, WAT. */
const TZ = "Africa/Lagos";

const dateFmt = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: TZ });
const timeFmt = new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit", hour12: false, timeZone: TZ });
const nairaFmt = new Intl.NumberFormat("en-NG", { style: "currency", currency: "NGN", maximumFractionDigits: 0 });

/** 20 Nov 2026 */
export function formatDate(value: string | Date): string {
  return dateFmt.format(new Date(value));
}

/** 20 Nov 2026, 14:05 WAT */
export function formatDateTime(value: string | Date): string {
  const d = new Date(value);
  return `${dateFmt.format(d)}, ${timeFmt.format(d)} WAT`;
}

/** ₦100,000 — amounts are stored in kobo. */
export function formatNaira(kobo: number): string {
  return nairaFmt.format(kobo / 100);
}
