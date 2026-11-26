const DAY = 86_400_000;

export function startOfDay(d: Date = new Date()) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

export function dateKey(d: Date = new Date()) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function daysAgo(n: number, hour = 12) {
  const d = startOfDay(new Date(Date.now() - n * DAY));
  d.setHours(hour, 0, 0, 0);
  return d;
}

export function startOfWeek(d: Date = new Date()) {
  const date = startOfDay(d);
  const day = date.getDay();
  const diff = day === 0 ? 6 : day - 1;
  date.setDate(date.getDate() - diff);
  return date;
}

export function relativeTime(input: Date | number) {
  const d = typeof input === "number" ? new Date(input) : input;
  const diff = Date.now() - d.getTime();
  const mins = Math.round(diff / 60_000);
  if (mins < 1) return "now";
  if (mins < 60) return `${mins}m`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.round(hours / 24);
  if (days === 1) return "Yesterday";
  if (days < 7) return `${days}d`;
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export function shortDate(input: Date | number) {
  const d = typeof input === "number" ? new Date(input) : input;
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export function weekdayName(d: Date) {
  return d.toLocaleDateString("en-US", { weekday: "long" });
}

export function addDays(d: Date, n: number) {
  return new Date(d.getTime() + n * DAY);
}
