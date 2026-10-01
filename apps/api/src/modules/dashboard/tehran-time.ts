const TEHRAN_OFFSET_MS = 210 * 60_000; // UTC+03:30, no DST since 2022
const DAY_MS = 86_400_000;

/** Start of the current day in Tehran, as a UTC instant. */
export function startOfTehranDay(now = new Date()): Date {
  return new Date(
    Math.floor((now.getTime() + TEHRAN_OFFSET_MS) / DAY_MS) * DAY_MS - TEHRAN_OFFSET_MS,
  );
}

/** Start of the current Jalali (Persian calendar) month in Tehran. */
export function startOfJalaliMonth(now = new Date()): Date {
  const dayOfMonth = Number(
    new Intl.DateTimeFormat('en-US-u-ca-persian', { timeZone: 'Asia/Tehran', day: 'numeric' })
      .format(now)
      .replace(/\D/g, ''),
  );
  return new Date(startOfTehranDay(now).getTime() - (dayOfMonth - 1) * DAY_MS);
}

export function tehranDateKey(date: Date): string {
  return new Date(date.getTime() + TEHRAN_OFFSET_MS).toISOString().slice(0, 10);
}
