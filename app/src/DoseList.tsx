import { clockTime, displayName, localDateKey, type DoseLog, type DoseStatus, type ScheduledDose } from "./engine";

export type RecordDose = (id: string, status: DoseStatus | null) => void;

export default function DoseList({
  doses,
  log,
  now,
  onRecord,
}: {
  doses: ScheduledDose[];
  log: DoseLog;
  now: Date;
  onRecord: RecordDose;
}) {
  const today = localDateKey(now);

  return (
    <ul className="calendar-doses">
      {doses.map(({ id, medicine, dueAt, dose, phase }) => {
        const entry = log[id];
        const isDue = dueAt <= now;
        const timing = !isDue ? "Upcoming" : localDateKey(dueAt) === today ? "Due" : "Unrecorded";
        const name = `${displayName(medicine.name)} ${medicine.strength}`.trim();
        const details = [dose, medicine.route, medicine.taper?.length ? `Phase ${phase}` : null];
        const taken = entry?.status === "taken";
        return (
          <li className="calendar-dose" key={id}>
            <time dateTime={dueAt.toISOString()}>{clockTime(dueAt)}</time>
            <div className="calendar-medicine">
              <strong>{name}</strong>
              <span>{details.filter(Boolean).join(" · ")}</span>
              <span className={`calendar-status${isDue && !entry && timing === "Due" ? " is-due" : ""}`} aria-live="polite">
                {entry ? (taken ? "Taken" : "Skipped") : timing}
              </span>
            </div>
            {entry ? (
              <button className="quiet" type="button" onClick={() => onRecord(id, null)}>Undo</button>
            ) : isDue ? (
              <div className="calendar-actions">
                <button className="calendar-button" type="button" onClick={() => onRecord(id, "taken")}>Taken</button>
                <button className="quiet" type="button" onClick={() => onRecord(id, "skipped")}>Skip</button>
              </div>
            ) : null}
          </li>
        );
      })}
    </ul>
  );
}
