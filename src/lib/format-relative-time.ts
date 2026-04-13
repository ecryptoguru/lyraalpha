const rtf = new Intl.RelativeTimeFormat("en", { numeric: "auto", style: "long" });

const UNITS: { unit: Intl.RelativeTimeFormatUnit; ms: number }[] = [
  { unit: "year", ms: 365 * 24 * 60 * 60 * 1000 },
  { unit: "month", ms: 30 * 24 * 60 * 60 * 1000 },
  { unit: "week", ms: 7 * 24 * 60 * 60 * 1000 },
  { unit: "day", ms: 24 * 60 * 60 * 1000 },
  { unit: "hour", ms: 60 * 60 * 1000 },
  { unit: "minute", ms: 60 * 1000 },
  { unit: "second", ms: 1000 },
];

/**
 * Format a date string as a relative time (e.g. "3 hours ago", "yesterday").
 * Uses Intl.RelativeTimeFormat for i18n-ready output.
 */
export function formatRelativeTime(dateStr: string): string {
  const diffMs = new Date(dateStr).getTime() - Date.now();
  if (!Number.isFinite(diffMs)) return "just now";

  for (const { unit, ms } of UNITS) {
    if (Math.abs(diffMs) >= ms) {
      const value = Math.round(diffMs / ms);
      return rtf.format(value, unit);
    }
  }

  return rtf.format(0, "second");
}
