/** The engine. Pure functions over a medicine: no React, no storage, no clock
 *  of its own — `now` is always passed in, so the demo and the tests agree. */

export interface Medicine {
  id: string;
  name: string;
  strength: string;
  form: string;
  /** The day the prescription was handed over, as YYYY-MM-DD. */
  receivedAt: string;
  /** Whether the course runs in the morning or the evening. */
  slot: "AM" | "PM";
  /** Local times, HH:MM, ascending. */
  times: string[];
  /** Course length in days. */
  days: number;
  createdAt: string;
}

export interface Plan {
  doses: Date[];
  next: Date | null;
  end: Date;
  total: number;
  done: number;
  remaining: number;
  daysLeft: number;
}

const DAY = 86_400_000;

/** Sensible times for a course that runs once, twice or three times a day. */
export function defaultTimes(slot: "AM" | "PM", perDay: number): string[] {
  const first = slot === "AM" ? "08:00" : "20:00";
  if (perDay <= 1) return [first];
  if (perDay === 2) return ["08:00", "20:00"];
  return ["08:00", "14:00", "20:00"];
}

export function dosesFor(medicine: Medicine): Date[] {
  const [y, m, d] = medicine.receivedAt.split("-").map(Number);
  const out: Date[] = [];
  for (let day = 0; day < medicine.days; day++) {
    for (const time of medicine.times) {
      const [h, min] = time.split(":").map(Number);
      out.push(new Date(y, m - 1, d + day, h, min, 0, 0));
    }
  }
  return out;
}

/** Whole calendar days between two moments — a course ending tomorrow morning
 *  has one day left, not two. */
function dayGap(from: Date, to: Date): number {
  const a = new Date(from.getFullYear(), from.getMonth(), from.getDate()).getTime();
  const b = new Date(to.getFullYear(), to.getMonth(), to.getDate()).getTime();
  return Math.round((b - a) / DAY);
}

export function planFor(medicine: Medicine, now: Date): Plan {
  const doses = dosesFor(medicine);
  const total = doses.length;
  const end = doses[total - 1] ?? new Date(medicine.receivedAt);
  const done = doses.filter((due) => due.getTime() <= now.getTime()).length;
  const next = doses.find((due) => due.getTime() > now.getTime()) ?? null;
  const daysLeft = Math.max(0, dayGap(now, end));

  return { doses, next, end, total, done, remaining: total - done, daysLeft };
}

/** "in 3 h 20 m", "now", "2 min ago". */
export function untilWords(target: Date, now: Date): string {
  const ms = target.getTime() - now.getTime();
  const abs = Math.abs(ms);
  const mins = Math.round(abs / 60_000);
  const days = Math.floor(mins / 1440);
  const hours = Math.floor((mins % 1440) / 60);
  const rest = mins % 60;

  let span: string;
  if (days > 0) span = `${days} day${days === 1 ? "" : "s"}`;
  else if (hours > 0) span = `${hours} h ${rest} m`;
  else span = `${rest} min`;

  if (abs < 60_000) return "now";
  return ms >= 0 ? `in ${span}` : `${span} ago`;
}

export function clockTime(d: Date): string {
  return d.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit", hour12: false });
}

export function dayLabel(d: Date): string {
  return d.toLocaleDateString(undefined, { weekday: "short", day: "numeric", month: "short" });
}

/** Days left on a course, in words a person would use. */
export function daysLeftWords(days: number): string {
  const n = Math.max(0, days);
  if (n === 0) return "today";
  if (n === 1) return "tomorrow";
  return `in ${n} days`;
}
