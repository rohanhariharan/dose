import DailySummary from "./DailySummary";
import { EmptyShelf } from "./PixelBits";
import DoseList, { type RecordDose } from "./DoseList";
import {
  dayLabel,
  displayName,
  localDate,
  localDateKey,
  planFor,
  scheduleFor,
  type DoseLog,
  type Medicine,
} from "./engine";
import type { Profile } from "./Onboarding";

function greeting(hour: number) {
  if (hour < 5) return "Still up";
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}

export default function Home({
  profile,
  medicines,
  log,
  now,
  onAdd,
  onRecord,
  onOpenHistory,
}: {
  profile: Profile;
  medicines: Medicine[];
  log: DoseLog;
  now: Date;
  onAdd: () => void;
  onRecord: RecordDose;
  onOpenHistory: () => void;
}) {
  const start = localDate(localDateKey(now));
  const end = new Date(start.getFullYear(), start.getMonth(), start.getDate() + 1);
  const doses = medicines.flatMap((medicine) => scheduleFor(medicine, start, end))
    .sort((first, second) => first.dueAt.getTime() - second.dueAt.getTime());
  const due = doses.filter((dose) => dose.dueAt <= now && !log[dose.id]).length;
  const taken = doses.filter((dose) => log[dose.id]?.status === "taken").length;
  const asNeeded = medicines.filter((medicine) => medicine.prn);

  // Anything from the last week that came due and was never recorded. Today
  // only ever shows today, so without this the gap is invisible.
  const weekAgo = new Date(start.getFullYear(), start.getMonth(), start.getDate() - 6);
  const missed = medicines
    .flatMap((medicine) => scheduleFor(medicine, weekAgo, start))
    .filter((dose) => dose.dueAt < start && !log[dose.id]);

  // Courses that end within the week: the moment to think about a refill.
  const runningOut = medicines
    .filter((medicine) => !medicine.prn)
    .map((medicine) => ({ medicine, plan: planFor(medicine, now) }))
    .filter(({ plan }) => plan.remaining > 0 && plan.daysLeft <= 7)
    .sort((a, b) => a.plan.daysLeft - b.plan.daysLeft);
  // The facts the summary is allowed to see. Nothing identifying, nothing that
  // is not already on this screen.
  const facts = [
    `${doses.length} dose${doses.length === 1 ? "" : "s"} scheduled today, ${due} still due, ${taken} taken.`,
    missed.length
      ? `${missed.length} unrecorded in the past week, earliest ${dayLabel(missed[0].dueAt)}.`
      : "Nothing unrecorded in the past week.",
    runningOut.length
      ? runningOut
          .map(
            ({ medicine, plan }) =>
              `${displayName(medicine.name)} ends ${dayLabel(plan.end)} with ${plan.remaining} doses left.`,
          )
          .join(" ")
      : "",
    asNeeded.length ? `${asNeeded.length} as-needed medicine${asNeeded.length === 1 ? "" : "s"} on file.` : "",
  ]
    .filter(Boolean)
    .join(" ");

  const date = now.toLocaleDateString(undefined, { weekday: "long", day: "numeric", month: "long" });
  const name = profile.name.trim();
  const display = name ? name[0].toUpperCase() + name.slice(1) : "";

  return (
    <main className="home">
      <div className="home-col">
        <header className="home-head">
          <p className="eyebrow">{date}</p>
          <h1>{greeting(now.getHours())}{display ? `, ${display}` : ""}</h1>
        </header>

        {medicines.length === 0 ? (
          <section className="empty">
            <EmptyShelf />
            <p>Scan a label or enter a prescription to see what’s due here.</p>
            <button className="primary" type="button" onClick={onAdd}>Add a medicine</button>
          </section>
        ) : (
          <>
            <DailySummary facts={facts} />

            <section className="calendar-panel today-doses" aria-labelledby="today-doses">
              <header className="today-doses-head">
                <h2 id="today-doses">Today’s doses</h2>
                {doses.length ? (
                  <p className="today-tally" aria-live="polite">
                    {due > 0 ? <strong>{due} due</strong> : null}
                    <span>{taken} of {doses.length} taken</span>
                  </p>
                ) : null}
              </header>
              {doses.length ? (
                <DoseList doses={doses} log={log} now={now} onRecord={onRecord} />
              ) : <p className="calendar-empty">No doses scheduled today.</p>}
            </section>
            {missed.length ? (
              <section className="calendar-panel today-doses" aria-labelledby="unrecorded">
                <header className="today-doses-head">
                  <h2 id="unrecorded">Unrecorded</h2>
                  <button className="quiet" type="button" onClick={onOpenHistory}>
                    Open history
                  </button>
                </header>
                <p className="calendar-empty">
                  {missed.length} dose{missed.length === 1 ? "" : "s"} came due in the last week with
                  nothing recorded. The earliest was{" "}
                  {dayLabel(missed[0].dueAt)} at {missed[0].dueAt.toLocaleTimeString(undefined, {
                    hour: "2-digit",
                    minute: "2-digit",
                    hour12: false,
                  })}
                  .
                </p>
              </section>
            ) : null}

            {runningOut.length ? (
              <section className="calendar-panel today-doses" aria-labelledby="running-out">
                <h2 id="running-out">Running out</h2>
                <ul className="calendar-doses">
                  {runningOut.map(({ medicine, plan }) => (
                    <li className="as-needed-item" key={medicine.id}>
                      <strong>
                        {displayName(medicine.name)} {medicine.strength}
                      </strong>
                      <p>
                        {plan.remaining} dose{plan.remaining === 1 ? "" : "s"} left, ending{" "}
                        {dayLabel(plan.end)} — {plan.daysLeft === 0 ? "today" : `in ${plan.daysLeft} day${plan.daysLeft === 1 ? "" : "s"}`}.
                      </p>
                    </li>
                  ))}
                </ul>
              </section>
            ) : null}

            {asNeeded.length ? (
              <section className="calendar-panel today-doses" aria-labelledby="as-needed">
                <h2 id="as-needed">As needed</h2>
                <ul className="calendar-doses">
                  {asNeeded.map((medicine) => (
                    <li className="as-needed-item" key={medicine.id}>
                      <strong>{displayName(medicine.name)} {medicine.strength}</strong>
                      {medicine.directions ? <p>{medicine.directions}</p> : null}
                    </li>
                  ))}
                </ul>
              </section>
            ) : null}
          </>
        )}

        <footer className="home-foot">Prototype · not medical advice</footer>
      </div>
    </main>
  );
}
