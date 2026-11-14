import { useEffect, useState } from "react";
import type { Profile } from "./Onboarding";

function greeting(hour: number) {
  if (hour < 5) return "Still up";
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}

/** Home. Nothing is scheduled yet, so the screen has one job: say what happens
 *  next and get out of the way. */
export default function Home({ profile, onReset }: { profile: Profile; onReset: () => void }) {
  const [toast, setToast] = useState(false);

  useEffect(() => {
    if (!toast) return;
    const t = window.setTimeout(() => setToast(false), 2600);
    return () => window.clearTimeout(t);
  }, [toast]);

  const now = new Date();
  const date = now.toLocaleDateString(undefined, {
    weekday: "long",
    day: "numeric",
    month: "long",
  });

  return (
    <main className="home">
      <div className="home-col">
        <header className="home-head">
          <p className="eyebrow">{date}</p>
          <h1>
            {greeting(now.getHours())}
            {profile.name ? `, ${profile.name}` : ""}
          </h1>
          <p className="lede left">Nothing is scheduled yet.</p>
        </header>

        {profile.regimens.length > 0 ? (
          <div className="tags">
            {profile.regimens.map((r) => (
              <span className="tag" key={r}>
                {r}
              </span>
            ))}
          </div>
        ) : null}

        <section className="empty">
          <p>
            Add a medicine and Dose keeps the day in order — a pill at breakfast, an ointment
            morning and night, a taper when the label calls for one.
          </p>
          <button className="primary" type="button" onClick={() => setToast(true)}>
            Add a medicine
          </button>
        </section>

        <footer className="home-foot">
          <span>Prototype · not medical advice</span>
          <button className="quiet" type="button" onClick={onReset}>
            Start over
          </button>
        </footer>
      </div>

      {toast ? (
        <div className="toast" role="status">
          Next: point your camera at the box.
        </div>
      ) : null}
    </main>
  );
}
