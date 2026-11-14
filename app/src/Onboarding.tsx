import { useEffect, useRef, useState } from "react";

export interface Profile {
  name: string;
  regimens: string[];
}

export const REGIMENS = [
  "Skin — cream or ointment",
  "Daily pills",
  "Inhaler",
  "Injections",
  "Eye drops",
  "Something else",
];

/** Page two: the name. Only ever used to say it back on the home screen. */
export function NamePage({
  initial,
  onNext,
  onBack,
  dir,
}: {
  initial: string;
  onNext: (name: string) => void;
  onBack: () => void;
  dir: "fwd" | "back";
}) {
  const [name, setName] = useState(initial);
  const field = useRef<HTMLInputElement>(null);

  useEffect(() => {
    field.current?.focus();
  }, []);

  const clean = name.trim().slice(0, 40);

  return (
    <div className={`page-body ${dir}`}>
      <h1>What should we call you?</h1>
      <p className="lede">It only ever appears on the home screen. You can change it later.</p>

      <form
        className="form"
        onSubmit={(e) => {
          e.preventDefault();
          onNext(clean);
        }}
      >
        <label className="label" htmlFor="name">
          First name
        </label>
        <input
          id="name"
          ref={field}
          className="input"
          value={name}
          onChange={(e) => setName(e.target.value)}
          autoComplete="given-name"
          maxLength={40}
        />
        <button className="primary" type="submit" disabled={!clean}>
          Continue
        </button>
      </form>

      <div className="page-actions">
        <button className="quiet" type="button" onClick={onBack}>
          Back
        </button>
        <span className="page-sep" aria-hidden="true">
          ·
        </span>
        <button className="quiet" type="button" onClick={() => onNext("")}>
          Skip
        </button>
      </div>
    </div>
  );
}

/** Page three: what the person is keeping up with. The shapes, not the
 *  diagnoses — each one maps onto a different schedule. */
export function RegimensPage({
  initial,
  onNext,
  onBack,
  dir,
}: {
  initial: string[];
  onNext: (picked: string[]) => void;
  onBack: () => void;
  dir: "fwd" | "back";
}) {
  const [picked, setPicked] = useState<string[]>(initial);

  const toggle = (label: string) =>
    setPicked((current) =>
      current.includes(label) ? current.filter((x) => x !== label) : [...current, label],
    );

  return (
    <div className={`page-body ${dir}`}>
      <h1>What are you keeping up with?</h1>
      <p className="lede">Pick what's true. You can add more later.</p>

      <div className="chips" role="group" aria-label="What you are keeping up with">
        {REGIMENS.map((label) => {
          const on = picked.includes(label);
          return (
            <button
              key={label}
              type="button"
              className={`chip ${on ? "on" : ""}`}
              aria-pressed={on}
              onClick={() => toggle(label)}
            >
              {label}
            </button>
          );
        })}
      </div>

      <button className="primary" type="button" onClick={() => onNext(picked)}>
        Continue
      </button>

      <div className="page-actions">
        <button className="quiet" type="button" onClick={onBack}>
          Back
        </button>
        <span className="page-sep" aria-hidden="true">
          ·
        </span>
        <button className="quiet" type="button" onClick={() => onNext([])}>
          Skip
        </button>
      </div>
    </div>
  );
}
