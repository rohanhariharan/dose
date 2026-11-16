import { useState, type FormEvent, type ReactNode } from "react";
import DoseList, { type RecordDose } from "./DoseList";
import { clockTime, dayLabel, displayName, localDate, localDateKey, planFor, scheduleFor, type DoseLog, type Medicine, type ScheduledDose } from "./engine";
import { kindLabel } from "./kinds";
import type { Profile } from "./Onboarding";

function RecordPage({ title, children }: { title: string; children: ReactNode }) {
  return (
    <main className="home">
      <div className="home-col">
        <header className="home-head"><h1>{title}</h1></header>
        {children}
      </div>
    </main>
  );
}

export function MedicinesPage({ medicines, now, onAdd }: { medicines: Medicine[]; now: Date; onAdd: () => void }) {
  return (
    <RecordPage title="Medicines">
      {medicines.length === 0 ? (
        <section className="empty">
          <p>No medicines on file yet.</p>
          <button type="button" className="primary" onClick={onAdd}>Add a medicine</button>
        </section>
      ) : (
        <section className="plans">
          {medicines.map((medicine) => {
            const plan = planFor(medicine, now);
            const phases = [medicine, ...(medicine.taper ?? [])];
            const details = [
              medicine.form === "other" ? "" : kindLabel(medicine.form),
              medicine.route,
              medicine.prn ? "As needed" : "",
            ].filter(Boolean).join(" · ");
            return (
              <article className="plan" key={medicine.id}>
                <div className="plan-head">
                  <h2>{displayName(medicine.name)} {medicine.strength}</h2>
                  {details ? <p className="record-muted">{details}</p> : null}
                </div>
                {medicine.prn ? (
                  medicine.dose ? <p className="record-muted">Dose per use · {medicine.dose}</p> : null
                ) : (
                  <>
                    <dl className="plan-kv medicine-dates">
                      <div>
                        <dt>Starts</dt>
                        <dd>{dayLabel(localDate(medicine.receivedAt))}</dd>
                      </div>
                      <div>
                        <dt>Next dose</dt>
                        <dd>{plan.next ? `${dayLabel(plan.next)} · ${clockTime(plan.next)}` : "Course complete"}</dd>
                      </div>
                      <div>
                        <dt>Ends</dt>
                        <dd>{dayLabel(plan.end)}</dd>
                      </div>
                    </dl>
                    <ul className="medicine-phases">
                      {phases.map((phase, index) => (
                        <li key={index}>
                          <strong>{phases.length > 1 ? `Phase ${index + 1}` : "Schedule"}</strong>
                          <span>{[phase.dose, phase.times.join(", "), `${phase.days} ${phase.days === 1 ? "day" : "days"}`].filter(Boolean).join(" · ")}</span>
                        </li>
                      ))}
                    </ul>
                  </>
                )}
                {medicine.directions ? (
                  <details className="medicine-label">
                    <summary>Label directions</summary>
                    <p>{medicine.directions}</p>
                  </details>
                ) : null}
              </article>
            );
          })}
        </section>
      )}
    </RecordPage>
  );
}

export function HistoryPage({
  medicines, log, now, onRecord,
}: {
  medicines: Medicine[];
  log: DoseLog;
  now: Date;
  onRecord: RecordDose;
}) {
  const groups = new Map<string, ScheduledDose[]>();
  const recorded = medicines.flatMap((medicine) => scheduleFor(medicine)).filter((dose) => log[dose.id])
    .sort((first, second) => second.dueAt.getTime() - first.dueAt.getTime());
  for (const dose of recorded) {
    const date = localDateKey(dose.dueAt);
    const group = groups.get(date) ?? [];
    group.push(dose);
    groups.set(date, group);
  }

  return (
    <RecordPage title="History">
      {recorded.length === 0 ? (
        <section className="empty"><p>Mark a dose taken or skipped to see it here.</p></section>
      ) : (
        <div className="plans">
          {Array.from(groups, ([date, doses]) => (
            <section className="calendar-panel today-doses" key={date} aria-label={date}>
              <h2>{localDate(date).toLocaleDateString(undefined, {
                weekday: "long", month: "long", day: "numeric", year: "numeric",
              })}</h2>
              <DoseList doses={doses} log={log} now={now} onRecord={onRecord} />
            </section>
          ))}
        </div>
      )}
    </RecordPage>
  );
}

export function SettingsPage({
  profile, onSaveName, onReset,
}: {
  profile: Profile;
  onSaveName: (name: string) => boolean;
  onReset: () => void;
}) {
  const [name, setName] = useState(profile.name);
  const [saved, setSaved] = useState(false);
  const [confirmReset, setConfirmReset] = useState(false);

  const save = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const value = name.trim();
    setName(value);
    setSaved(onSaveName(value));
  };

  return (
    <RecordPage title="Settings">
      <section className="calendar-panel today-doses">
        <h2>Profile</h2>
        <form className="form settings-form" onSubmit={save}>
          <label className="label" htmlFor="settings-name">First name</label>
          <input
            className="input" id="settings-name" value={name} maxLength={40} autoComplete="given-name"
            onChange={(event) => { setName(event.target.value); setSaved(false); }}
          />
          <button className="primary" type="submit" disabled={name.trim() === profile.name}>Save name</button>
          {saved ? <p className="intake-note" role="status">Name saved.</p> : null}
        </form>
      </section>

      <section className="calendar-panel today-doses">
        <h2>Data and privacy</h2>
        <p className="record-muted">Your profile, prescriptions, and dose history are saved in this browser.</p>
        <p className="record-muted">Label scans run on this Mac by default. The scan screen lets you choose whether an uncertain read can send the photo to Gemini. Buddy sends your message and a summary of your plans to Gemini when you chat.</p>
        {confirmReset ? (
          <div className="reset-confirm">
            <p id="reset-message">Clear your profile, prescriptions, and dose history from this browser?</p>
            <div className="calendar-actions">
              <button className="calendar-button" type="button" onClick={onReset} aria-describedby="reset-message">Clear all data</button>
              <button className="quiet" type="button" onClick={() => setConfirmReset(false)}>Cancel</button>
            </div>
          </div>
        ) : (
          <button className="calendar-button" type="button" onClick={() => setConfirmReset(true)}>Start over</button>
        )}
      </section>
    </RecordPage>
  );
}
