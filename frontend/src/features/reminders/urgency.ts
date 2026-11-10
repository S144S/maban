/** Six-hour steps within the home reminder's 24-hour window. */
export function reminderUrgency(occurrence: string, now = Date.now()) {
  const hours = (Date.parse(occurrence) - now) / 3_600_000;
  if (!Number.isFinite(hours) || hours > 18) return "neutral";
  if (hours > 12) return "gentle";
  if (hours > 6) return "near";
  return "urgent";
}
