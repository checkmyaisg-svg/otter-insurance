/** Small display formatters shared across client UI. Pure, no deps. */

/** '2026-07-13T...' or '1988-03-15' -> '13 Jul 2026'. Empty -> em dash. */
export function formatDate(value: string | null | undefined): string {
  if (!value) return '—';
  const d = new Date(value.length === 10 ? `${value}T00:00:00` : value);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

/** Title-case a platform enum for display. */
export function formatPlatform(p: string): string {
  return p.charAt(0).toUpperCase() + p.slice(1);
}
