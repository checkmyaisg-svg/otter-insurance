/**
 * Pure birthday-window math — zero imports, fully unit-tested.
 * 29 Feb birthdays are celebrated on 28 Feb in non-leap years.
 */
export function daysUntilBirthday(birthday: string, todayStr: string): number {
  const [, bm, bd] = birthday.split('-').map(Number);
  const [ty, tm, td] = todayStr.split('-').map(Number);
  const isLeap = (y: number) => (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0;
  const target = (y: number) => {
    const m = bm as number;
    let d = bd as number;
    if (m === 2 && d === 29 && !isLeap(y)) d = 28;
    return Date.UTC(y, m - 1, d);
  };
  const today = Date.UTC(ty as number, (tm as number) - 1, td as number);
  let next = target(ty as number);
  if (next < today) next = target((ty as number) + 1);
  return Math.round((next - today) / 86400000);
}

/** The next occurrence of a birthday on/after today, as YYYY-MM-DD. */
export function nextBirthdayDate(birthday: string, todayStr: string): string {
  const days = daysUntilBirthday(birthday, todayStr);
  const [ty, tm, td] = todayStr.split('-').map(Number);
  const d = new Date(Date.UTC(ty as number, (tm as number) - 1, (td as number) + days));
  return d.toISOString().slice(0, 10);
}
