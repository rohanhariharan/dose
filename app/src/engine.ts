/** The engine. Pure functions over a medicine: no React, no storage, no clock
 *  of its own — `now` is always passed in, so the demo and the tests agree. */

export interface SchedulePhase {
  times: string[];
  days: number;
  dose?: string;
}

export interface Medicine extends SchedulePhase {
  id: string;
  name: string;
  strength: string;
  form: string;
  /** The day the prescription was handed over, as YYYY-MM-DD. */
  receivedAt: string;
  slot?: "AM" | "PM";
  taper?: SchedulePhase[];
  route?: string;
  directions?: string;
  /** How much is in the pack, when the label says. */
  quantity?: number;
  unit?: string;
  /** As-needed medicines are kept on file without scheduled doses. */
  prn?: boolean;
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

export type DoseStatus = "taken" | "skipped";
export type DoseLog = Record<string, { status: DoseStatus; recordedAt: string }>;

export interface ScheduledDose {
  id: string;
  medicine: Medicine;
  dueAt: Date;
  dose?: string;
  phase: number;
}

const DAY = 86_400_000;

export function localDateKey(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export function localDate(key: string): Date {
  const [year, month, day] = key.split("-").map(Number);
  return new Date(year, month - 1, day);
}

export function validTime(time: string): boolean {
  return /^(?:[01]\d|2[0-3]):[0-5]\d$/.test(time);
}

export function scheduleFor(medicine: Medicine, from?: Date, until?: Date): ScheduledDose[] {
  if (medicine.prn) return [];
  const start = localDate(medicine.receivedAt);
  const firstDay = from ? dayGap(start, from) : 0;
  const lastDay = until ? dayGap(start, until) : Infinity;
  const phases = [medicine, ...(medicine.taper ?? [])];
  const doses: ScheduledDose[] = [];
  let offset = 0;
  for (const [index, phase] of phases.entries()) {
    const times = [...phase.times].sort();
    for (let day = Math.max(offset, firstDay); day < Math.min(offset + phase.days, lastDay); day++) {
      const date = new Date(start.getFullYear(), start.getMonth(), start.getDate() + day);
      for (const time of times) {
        const [hours, minutes] = time.split(":").map(Number);
        const dueAt = new Date(date.getFullYear(), date.getMonth(), date.getDate(), hours, minutes);
        doses.push({
          id: `${medicine.id}:${localDateKey(date)}:${time}`,
          medicine,
          dueAt,
          dose: phase.dose,
          phase: index + 1,
        });
      }
    }
    offset += phase.days;
  }
  return doses;
}

export function dosesFor(medicine: Medicine): Date[] {
  return scheduleFor(medicine).map((dose) => dose.dueAt);
}

/** Whole calendar days between two moments — a course ending tomorrow morning
 *  has one day left, not two. */
function dayGap(from: Date, to: Date): number {
  const a = Date.UTC(from.getFullYear(), from.getMonth(), from.getDate());
  const b = Date.UTC(to.getFullYear(), to.getMonth(), to.getDate());
  return (b - a) / DAY;
}

export function planFor(medicine: Medicine, now: Date): Plan {
  const doses = dosesFor(medicine);
  const total = doses.length;
  const end = doses[total - 1] ?? localDate(medicine.receivedAt);
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

/** Labels print drug names in capitals. Read them as "Augmentin" rather than
 *  "AUGMENTIN", but leave short tokens alone so HFA and HCL stay acronyms. */
export function displayName(raw: string): string {
  const name = raw.trim();
  if (!name || name !== name.toUpperCase()) return name;
  return name
    .split(/\s+/)
    .map((word) => (word.length <= 3 ? word : word[0] + word.slice(1).toLowerCase()))
    .join(" ");
}
