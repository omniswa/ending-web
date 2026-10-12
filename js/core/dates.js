/**
 * Calendar-day helpers. Days are identified by local "YYYY-MM-DD" keys so that
 * streaks follow the reader's own midnight, not UTC.
 */
const pad = (n) => String(n).padStart(2, "0");

export const dateKey = (date = new Date()) =>
  `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
export const todayKey = () => dateKey();

export function parseKey(key) {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(y, m - 1, d);
}

export function addDays(key, amount) {
  const date = parseKey(key);
  date.setDate(date.getDate() + amount);
  return dateKey(date);
}

export const isDateKey = (value) =>
  typeof value === "string" &&
  /^\d{4}-\d{2}-\d{2}$/.test(value) &&
  dateKey(parseKey(value)) === value;

/** The seven day keys of the Monday-first week containing `key`. */
export function weekKeys(key) {
  const offset = (parseKey(key).getDay() + 6) % 7;
  const start = addDays(key, -offset);
  return Array.from({ length: 7 }, (_, i) => addDays(start, i));
}

export const weekdayLabel = (key, style = "short") =>
  new Intl.DateTimeFormat(undefined, { weekday: style }).format(parseKey(key));

export const formatDay = (key) =>
  new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(parseKey(key));

export const daysBetween = (from, to) =>
  Math.round((parseKey(to) - parseKey(from)) / 86_400_000);
