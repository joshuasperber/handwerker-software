export const BUSINESS_TIME_ZONE = "Europe/Berlin";

const DATE_KEY = /^(\d{4})-(\d{2})-(\d{2})$/;

function parseDateKey(value: string) {
  const match = DATE_KEY.exec(value);
  if (!match) throw new Error("Ungültiges Datum");
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const check = new Date(Date.UTC(year, month - 1, day));
  if (
    check.getUTCFullYear() !== year ||
    check.getUTCMonth() !== month - 1 ||
    check.getUTCDate() !== day
  ) {
    throw new Error("Ungültiges Datum");
  }
  return { year, month, day };
}

function offsetAt(instant: Date, timeZone: string): number {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(instant);
  const values = Object.fromEntries(
    parts.filter((part) => part.type !== "literal").map((part) => [part.type, part.value])
  );
  const representedAsUtc = Date.UTC(
    Number(values.year),
    Number(values.month) - 1,
    Number(values.day),
    Number(values.hour),
    Number(values.minute),
    Number(values.second)
  );
  return representedAsUtc - Math.floor(instant.getTime() / 1000) * 1000;
}

function localMidnightUtc(dateKey: string, timeZone: string): Date {
  const { year, month, day } = parseDateKey(dateKey);
  const localAsUtc = Date.UTC(year, month - 1, day);
  const firstOffset = offsetAt(new Date(localAsUtc), timeZone);
  let instant = new Date(localAsUtc - firstOffset);
  const actualOffset = offsetAt(instant, timeZone);
  if (actualOffset !== firstOffset) instant = new Date(localAsUtc - actualOffset);
  return instant;
}

export function addCalendarDays(dateKey: string, days: number): string {
  const { year, month, day } = parseDateKey(dateKey);
  const value = new Date(Date.UTC(year, month - 1, day + days));
  return `${value.getUTCFullYear()}-${String(value.getUTCMonth() + 1).padStart(2, "0")}-${String(value.getUTCDate()).padStart(2, "0")}`;
}

export function startOfIsoWeekDate(dateKey: string): string {
  const { year, month, day } = parseDateKey(dateKey);
  const value = new Date(Date.UTC(year, month - 1, day));
  const weekday = value.getUTCDay() || 7;
  return addCalendarDays(dateKey, 1 - weekday);
}

export function businessDayRange(
  dateKey: string,
  timeZone = BUSINESS_TIME_ZONE
): { start: Date; end: Date } {
  const start = localMidnightUtc(dateKey, timeZone);
  const nextStart = localMidnightUtc(addCalendarDays(dateKey, 1), timeZone);
  return { start, end: new Date(nextStart.getTime() - 1) };
}

export function businessDateKey(
  value: Date,
  timeZone = BUSINESS_TIME_ZONE
): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(value);
  const values = Object.fromEntries(
    parts.filter((part) => part.type !== "literal").map((part) => [part.type, part.value])
  );
  return `${values.year}-${values.month}-${values.day}`;
}
