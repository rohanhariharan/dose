import { useMemo, useState } from "react";
import DoseList, { type RecordDose } from "./DoseList";
import {
  displayName,
  localDate,
  localDateKey,
  scheduleFor,
  type DoseLog,
  type Medicine,
  type ScheduledDose,
} from "./engine";

const monthLabel = new Intl.DateTimeFormat(undefined, { month: "long", year: "numeric" });
const dateLabel = new Intl.DateTimeFormat(undefined, { weekday: "long", month: "long", day: "numeric" });
const weekdays = Array.from({ length: 7 }, (_, day) =>
  new Intl.DateTimeFormat(undefined, { weekday: "short" }).format(new Date(2026, 0, 4 + day)),
);

export default function Calendar({
  medicines,
  log,
  now,
  onRecord,
  onAdd,
}: {
  medicines: Medicine[];
  log: DoseLog;
  now: Date;
  onRecord: RecordDose;
  onAdd: () => void;
}) {
  const [selected, setSelected] = useState(() => localDateKey(new Date()));
  const date = localDate(selected);
  const year = date.getFullYear();
  const month = date.getMonth();
  const monthStart = new Date(year, month, 1);
  const leadingDays = monthStart.getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const today = localDateKey(now);
  const onDemand = medicines.filter((medicine) => medicine.prn);

  const byDay = useMemo(() => {
    const entries = new Map<string, ScheduledDose[]>();
    const start = new Date(year, month, 1);
    const end = new Date(year, month + 1, 1);
    const doses = medicines.flatMap((medicine) => scheduleFor(medicine, start, end));
    doses.sort((a, b) => a.dueAt.getTime() - b.dueAt.getTime());
    for (const dose of doses) {
      const key = localDateKey(dose.dueAt);
      const group = entries.get(key) ?? [];
      group.push(dose);
      entries.set(key, group);
    }
    return entries;
  }, [medicines, month, year]);

  const shown = byDay.get(selected) ?? [];
  const moveMonth = (offset: number) => setSelected(localDateKey(new Date(year, month + offset, 1)));

  return (
    <main className="calendar">
      <header className="calendar-head">
        <div>
          <h1>Prescription calendar</h1>
          <p className="lede left">Select a day to see your scheduled doses.</p>
        </div>
        <button className="calendar-button" type="button" onClick={() => setSelected(localDateKey(new Date()))}>
          Today
        </button>
      </header>
      <div className="calendar-panels">
        <section className="calendar-panel" aria-label="Month">
          <div className="calendar-month">
            <h2 aria-live="polite">{monthLabel.format(monthStart)}</h2>
            <div className="calendar-nav">
              <button className="calendar-button" type="button" aria-label="Previous month" onClick={() => moveMonth(-1)}>‹</button>
              <button className="calendar-button" type="button" aria-label="Next month" onClick={() => moveMonth(1)}>›</button>
            </div>
          </div>
          <div className="calendar-grid">
            {weekdays.map((day) => <span key={day} className="calendar-weekday">{day}</span>)}
            {Array.from({ length: leadingDays }, (_, index) => <span key={`blank-${index}`} aria-hidden="true" />)}
            {Array.from({ length: daysInMonth }, (_, index) => {
              const day = new Date(year, month, index + 1);
              const key = localDateKey(day);
              const count = byDay.get(key)?.length ?? 0;
              return (
                <button
                  key={key}
                  type="button"
                  className={`calendar-day${selected === key ? " selected" : ""}`}
                  aria-label={`${dateLabel.format(day)}, ${count} scheduled ${count === 1 ? "dose" : "doses"}`}
                  aria-pressed={selected === key}
                  aria-current={today === key ? "date" : undefined}
                  onClick={() => setSelected(key)}
                >
                  <span>{day.getDate()}</span>
                  <small aria-hidden="true">{count > 0 ? count : ""}</small>
                </button>
              );
            })}
          </div>
        </section>

        <section className="calendar-panel calendar-detail" aria-label="Selected day">
          <h2 aria-live="polite">{dateLabel.format(date)}</h2>
          {shown.length ? (
            <DoseList doses={shown} log={log} now={now} onRecord={onRecord} />
          ) : <p className="calendar-empty">No doses scheduled for this day.</p>}
          {medicines.length === 0 ? (
            <button className="primary" type="button" onClick={onAdd}>Add a medicine</button>
          ) : null}
          {onDemand.length > 0 ? (
            <div className="calendar-on-demand">
              <h3>As needed</h3>
              <ul>
                {onDemand.map((medicine) => (
                  <li key={medicine.id}>{displayName(medicine.name)} {medicine.strength}</li>
                ))}
              </ul>
            </div>
          ) : null}
        </section>
      </div>
    </main>
  );
}
