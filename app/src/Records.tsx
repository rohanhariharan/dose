import { useRef, useState, type FormEvent, type ReactNode } from "react";
import DoseList, { type RecordDose } from "./DoseList";
import { clockTime, dayLabel, displayName, localDate, localDateKey, planFor, scheduleFor, type DoseLog, type Medicine, type ScheduledDose } from "./engine";
import { AGE_BANDS, HABITS, type AboutYou } from "./context";
import { readDoseLog, readMedicines, readProfile } from "./storage";
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
  profile, about, onSaveName, onSaveAbout, onReset,
}: {
  profile: Profile;
  about: AboutYou;
  onSaveName: (name: string) => boolean;
  onSaveAbout: (about: AboutYou) => boolean;
  onReset: () => void;
}) {
  const [name, setName] = useState(profile.name);
  const [saved, setSaved] = useState(false);
  const [confirmReset, setConfirmReset] = useState(false);
  const [copied, setCopied] = useState(false);
  const [savedAbout, setSavedAbout] = useState(false);
  // Local draft: two chips clicked in the same tick would otherwise both spread
  // the same stale object and one would vanish.
  const [draftAbout, setDraftAbout] = useState<AboutYou>(about);
  // A ref as well as state, because a chip clicked twice inside one tick would
  // otherwise read the same stale object both times.
  const latestAbout = useRef<AboutYou>(about);

  const changeAbout = (next: AboutYou) => {
    latestAbout.current = next;
    setDraftAbout(next);
    setSavedAbout(onSaveAbout(next));
    window.setTimeout(() => setSavedAbout(false), 2000);
  };
  const [theme, setTheme] = useState<"paper" | "night">(() =>
    document.documentElement.dataset.theme === "night" ? "night" : "paper",
  );

  /** The day's doses, as a plain message a carer can act on. */
  const copyPlan = async () => {
    const medicines = readMedicines();
    const log = readDoseLog();
    const start = localDate(localDateKey(new Date()));
    const end = new Date(start.getFullYear(), start.getMonth(), start.getDate() + 1);
    const doses = medicines
      .flatMap((medicine) => scheduleFor(medicine, start, end))
      .sort((a, b) => a.dueAt.getTime() - b.dueAt.getTime());

    const lines = doses.length
      ? doses.map((dose) => {
          const entry = log[dose.id];
          const name = `${displayName(dose.medicine.name)} ${dose.medicine.strength}`.trim();
          const what = [dose.dose, dose.medicine.route].filter(Boolean).join(", ");
          const state = entry ? ` — ${entry.status}` : "";
          return `${clockTime(dose.dueAt)}  ${name}${what ? ` — ${what}` : ""}${state}`;
        })
      : ["Nothing scheduled today."];

    const text = [
      `Dose — ${new Date().toLocaleDateString(undefined, { weekday: "long", day: "numeric", month: "long" })}`,
      ...lines,
      "",
      "Prototype — not medical advice.",
    ].join("\n");

    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2200);
    } catch {
      window.prompt("Copy today's schedule", text);
    }
  };

  /** Everything on file, as one file the person owns. */
  const download = () => {
    const data = {
      exportedAt: new Date().toISOString(),
      profile: readProfile(),
      medicines: readMedicines(),
      doses: readDoseLog(),
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `dose-${new Date().toISOString().slice(0, 10)}.json`;
    link.click();
    URL.revokeObjectURL(url);
  };

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
        <h2>About you</h2>
        <p className="record-muted">
          Optional, and deliberately vague — no condition, no birthday, nothing that identifies you.
          It only helps Buddy answer in terms of your actual week.
        </p>

        <span className="label">Age band</span>
        <div className="seg" role="group" aria-label="Age band">
          {AGE_BANDS.map((band) => (
            <button
              key={band}
              type="button"
              className={`seg-item ${latestAbout.current.ageBand === band ? "on" : ""}`}
              aria-pressed={latestAbout.current.ageBand === band}
              onClick={() => changeAbout({ ...latestAbout.current, ageBand: latestAbout.current.ageBand === band ? "" : band })}
            >
              {band}
            </button>
          ))}
        </div>

        <span className="label">What your week looks like</span>
        <div className="chips">
          {HABITS.map((habit) => {
            const on = latestAbout.current.chips.includes(habit);
            return (
              <button
                key={habit}
                type="button"
                className={`chip ${on ? "on" : ""}`}
                aria-pressed={on}
                onClick={() =>
                  changeAbout({
                    ...latestAbout.current,
                    chips: on
                      ? latestAbout.current.chips.filter((c) => c !== habit)
                      : [...latestAbout.current.chips, habit],
                  })
                }
              >
                {habit}
              </button>
            );
          })}
        </div>

        <label className="label" htmlFor="about-note">Anything else (optional)</label>
        <input
          id="about-note"
          className="input"
          value={latestAbout.current.note}
          maxLength={120}
          placeholder="e.g. I work nights, so mornings are hard"
          onChange={(event) => changeAbout({ ...latestAbout.current, note: event.target.value })}
        />
        {savedAbout ? <p className="intake-note" role="status">Saved.</p> : null}
      </section>

      <section className="calendar-panel today-doses">
        <h2>Appearance</h2>
        <p className="record-muted">Paper for daylight, night for a dark kitchen.</p>
        <div className="seg" role="group" aria-label="Theme">
          {(["paper", "night"] as const).map((option) => (
            <button
              key={option}
              type="button"
              className={`seg-item ${theme === option ? "on" : ""}`}
              aria-pressed={theme === option}
              onClick={() => {
                setTheme(option);
                document.documentElement.dataset.theme = option;
                localStorage.setItem("dose.theme", option);
              }}
            >
              {option === "paper" ? "Paper" : "Night"}
            </button>
          ))}
        </div>
      </section>

      <section className="calendar-panel today-doses">
        <h2>Take it with you</h2>
        <p className="record-muted">Copy today's doses as a message for whoever helps out, or keep a copy of everything on file.</p>
        <div className="calendar-actions">
          <button className="calendar-button" type="button" onClick={() => void copyPlan()}>
            {copied ? "Copied" : "Copy today's schedule"}
          </button>
          <button className="quiet" type="button" onClick={download}>
            Download my data
          </button>
        </div>
      </section>

      <section className="calendar-panel today-doses">
        <h2>Data and privacy</h2>
        <p className="record-muted">Your profile, prescriptions, and dose history are saved in this browser.</p>
        <p className="record-muted">Label scans run on this Mac by default. The scan screen lets you choose whether an uncertain read can send the photo to Gemini. Buddy sends your message, a summary of your plans, and anything you fill in under About you to Gemini when you chat.</p>
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
