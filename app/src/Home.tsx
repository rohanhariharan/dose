import { useEffect, useState } from "react";
import {
  clockTime,
  dayLabel,
  daysLeftWords,
  displayName,
  planFor,
  untilWords,
  type Medicine,
} from "./engine";
import { kindLabel } from "./kinds";
import type { Profile } from "./Onboarding";

function greeting(hour: number) {
  if (hour < 5) return "Still up";
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}

/** Home. With nothing scheduled it says what happens next and gets out of the
 *  way; with a course running it answers the three questions worth answering —
 *  next dose, next refill, when this ends. */
export default function Home({
  profile,
  medicines,
  onAdd,
  onReset,
}: {
  profile: Profile;
  medicines: Medicine[];
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
              : `${medicines.length} ${medicines.length === 1 ? "course" : "courses"} running.`}
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
              return (
                <article className="plan" key={m.id}>
                  <div className="plan-head">
                    <h2>
                      {displayName(m.name)} {m.strength}
                    </h2>
                    <span className="plan-sub">
                      {kindLabel(m.form)} · {m.times.join(" · ")} · {m.days} day
                      {m.days === 1 ? "" : "s"}
                    </span>
                  </div>

                  <dl className="plan-kv">
                    <div>
                      <dt>Next dose</dt>
                      <dd>
                        {plan.next ? clockTime(plan.next) : "—"}
                        <span className="then">
                          {plan.next
                            ? untilWords(plan.next, now)
                            : plan.remaining === 0
                              ? "course finished"
                              : "nothing left"}
                        </span>
                      </dd>
                    </div>
                    <div>
                      <dt>Refill</dt>
                      <dd>
                        {plan.remaining === 0 ? "none left" : daysLeftWords(plan.daysLeft)}
                        <span className="then">
                          {plan.remaining === 0 ? "all doses taken" : `${plan.remaining} of ${plan.total} left`}
                        </span>
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
