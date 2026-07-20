/**
 * Pure renewal-date math. Rolling a renewal forward one year keeps the same
 * month/day; 29 Feb rolls to 28 Feb in non-leap years.
 */
export function rollRenewalForward(renewalDate: string): string {
  const [y, m, d] = renewalDate.split('-').map(Number);
  const ny = (y as number) + 1;
  const isLeap = (yy: number) => (yy % 4 === 0 && yy % 100 !== 0) || yy % 400 === 0;
  const nd = (m as number) === 2 && (d as number) === 29 && !isLeap(ny) ? 28 : (d as number);
  return `${ny}-${String(m).padStart(2, '0')}-${String(nd).padStart(2, '0')}`;
}
