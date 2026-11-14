import type { Profile } from "./Onboarding";

function greeting(hour: number) {
  if (hour < 5) return "Still up";
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}

/** Home. Nothing is scheduled yet, so the screen has one job: say what happens
 *  next and get out of the way. */
export default function Home({
  profile,
  onAdd,
  onReset,
}: {
  profile: Profile;
  onAdd: () => void;
  onReset: () => void;
}) {
  const now = new Date();
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
          <button className="primary" type="button" onClick={onAdd}>
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
    </main>
  );
}
