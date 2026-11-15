import { useEffect, useState } from "react";
import {
  clockTime,
  dayLabel,
  displayName,
  planFor,
  scheduleFor,
  untilWords,
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

/** Home. With nothing scheduled it says what happens next and gets out of the
 *  way; with a course running it answers the three questions worth answering —
 *  next scheduled dose, recorded doses, and when this ends. */
export default function Home({
  profile,
  medicines,
  log,
  onAdd,
  onReset,
}: {
  profile: Profile;
  medicines: Medicine[];
  log: DoseLog;
  onAdd: () => void;
  onReset: () => void;
}) {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), 30_000);
    return () => window.clearInterval(id);
  }, []);

  const date = now.toLocaleDateString(undefined, {
    weekday: "long",
    day: "numeric",
    month: "long",
  });

  // A name typed in a hurry at 7am comes out lowercase; the greeting is not
  // the place to make someone feel like a database row.
  const name = profile.name.trim();
  const display = name ? name[0].toUpperCase() + name.slice(1) : "";

  return (
    <main className="home">
      <div className="home-col">
        <header className="home-head">
          <p className="eyebrow">{date}</p>
          <h1>
            {greeting(now.getHours())}
            {display ? `, ${display}` : ""}
          </h1>
          <p className="lede left">
            {medicines.length === 0
              ? "Nothing is scheduled yet."
              : `${medicines.length} ${medicines.length === 1 ? "medicine" : "medicines"} on file.`}
          </p>
        </header>

        {profile.regimens.length > 0 && medicines.length === 0 ? (
          <div className="tags">
            {profile.regimens.map((r) => (
              <span className="tag" key={r}>
                {r}
              </span>
            ))}
          </div>
        ) : null}

        {medicines.length === 0 ? (
          <section className="empty">
            <p>
              Add a medicine and Dose keeps the day in order — a pill at breakfast, an ointment
              morning and night, a taper when the label calls for one.
            </p>
            <button className="primary" type="button" onClick={onAdd}>
              Add a medicine
            </button>
          </section>
        ) : (
          <section className="plans">
            {medicines.map((m) => {
              const plan = planFor(m, now);
              const taken = scheduleFor(m).filter((dose) => log[dose.id]?.status === "taken").length;
              const pct = plan.total ? Math.round((taken / plan.total) * 100) : 0;
              return (
                <article className="plan" key={m.id}>
                  <div className="plan-head">
                    <h2>
                      {displayName(m.name)} {m.strength}
                    </h2>
                    {m.prn ? <p className="plan-sub">As needed</p> : (
                    <div className="plan-progress">
                      <div
                        className="bar"
                        role="progressbar"
                        aria-valuemin={0}
                        aria-valuemax={plan.total}
                        aria-valuenow={taken}
                        aria-label={`${taken} of ${plan.total} doses recorded as taken`}
                      >
                        <i style={{ width: `${pct}%` }} />
                      </div>
                      <div className="plan-meta">
                        <span>
                          {taken} of {plan.total} doses taken
                        </span>
                        <span>{pct}%</span>
                      </div>
                    </div>
                    )}
                  </div>

                  {m.prn ? (
                    m.directions ? <p className="plan-sub">{m.directions}</p> : null
                  ) : (
                  <dl className="plan-kv">
                    <div>
                      <dt>Next dose</dt>
                      <dd>
                        {plan.next ? clockTime(plan.next) : "—"}
                        <span className="then">
                          {plan.next
                            ? untilWords(plan.next, now)
                            : "no upcoming doses"}
                        </span>
                      </dd>
                    </div>
                    <div>
                      <dt>Upcoming</dt>
                      <dd>
                        {plan.remaining} {plan.remaining === 1 ? "dose" : "doses"}
                      </dd>
                    </div>
                    <div>
                      <dt>Ends</dt>
                      <dd>
                        {dayLabel(plan.end)}
                        <span className="then">{clockTime(plan.end)}</span>
                      </dd>
                    </div>
                  </dl>
                  )}
                </article>
              );
            })}
          </section>
        )}

        <footer className="home-foot">
          <span>Prototype · not medical advice</span>
          <button className="quiet" type="button" onClick={onReset}>
            Start over
          </button>
        </footer>
      </div>
    </main>
  );
}
