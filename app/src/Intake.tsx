import { useEffect, useRef, useState } from "react";
import { defaultTimes } from "./engine";

/** The three pages between a photograph and a plan. One question each, the
 *  same 420px column as onboarding, and a way back at every step. */

function Sheet({
  children,
  onCancel,
}: {
  children: React.ReactNode;
  onCancel: () => void;
}) {
  return (
    <main className="page">
      <div className="page-col">
        <div className="sheet-top">
          <button className="quiet" type="button" onClick={onCancel}>
            Cancel
          </button>
        </div>
        <div className="page-body fwd">{children}</div>
      </div>
    </main>
  );
}

export function FoundPage({
  name,
  strength,
  manual: startManual = false,
  onYes,
  onAgain,
  onCancel,
}: {
  name: string;
  strength: string;
  manual?: boolean;
  onYes: (name: string, strength: string) => void;
  onAgain: () => void;
  onCancel: () => void;
}) {
  const [manual, setManual] = useState(startManual);
  const [typedName, setTypedName] = useState(name);
  const [typedStrength, setTypedStrength] = useState(strength);
  const field = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (manual) field.current?.focus();
  }, [manual]);

  return (
    <Sheet onCancel={onCancel}>
      {manual ? (
        <>
          <h1>Enter it yourself</h1>
          <p className="lede">The name and the strength, as they appear on the box.</p>
          <form
            className="form"
            onSubmit={(e) => {
              e.preventDefault();
              if (typedName.trim()) onYes(typedName.trim(), typedStrength.trim());
            }}
          >
            <label className="label" htmlFor="med-name">
              Medicine
            </label>
            <input
              id="med-name"
              ref={field}
              className="input"
              value={typedName}
              onChange={(e) => setTypedName(e.target.value)}
              maxLength={48}
            />
            <label className="label" htmlFor="med-strength">
              Strength
            </label>
            <input
              id="med-strength"
              className="input"
              value={typedStrength}
              onChange={(e) => setTypedStrength(e.target.value)}
              placeholder="750 mg"
              maxLength={24}
            />
            <button className="primary" type="submit" disabled={!typedName.trim()}>
              Use these
            </button>
          </form>
        </>
      ) : (
        <>
          <h1>
            {name}
            {strength ? ` ${strength}` : ""}
          </h1>
          <p className="lede">
            This bottle scanned as {name}
            {strength ? `, ${strength}` : ""}. Did we get that right?
          </p>
          <div className="form">
            <button className="primary" type="button" onClick={() => onYes(name, strength)}>
              Yes, that's right
            </button>
          </div>
          <div className="page-actions">
            <button className="quiet" type="button" onClick={onAgain}>
              Try again
            </button>
            <span className="page-sep" aria-hidden="true">
              ·
            </span>
            <button className="quiet" type="button" onClick={() => setManual(true)}>
              Enter manually
            </button>
          </div>
        </>
      )}
    </Sheet>
  );
}

export function ReceivedPage({
  receivedAt,
  slot,
  onNext,
  onBack,
  onCancel,
}: {
  receivedAt: string;
  slot: "AM" | "PM";
  onNext: (receivedAt: string, slot: "AM" | "PM") => void;
  onBack: () => void;
  onCancel: () => void;
}) {
  const [date, setDate] = useState(receivedAt);
  const [when, setWhen] = useState<"AM" | "PM">(slot);

  return (
    <Sheet onCancel={onCancel}>
      <h1>When did you receive it?</h1>
      <p className="lede">We count the course from the day it was handed to you.</p>

      <form
        className="form"
        onSubmit={(e) => {
          e.preventDefault();
          if (date) onNext(date, when);
        }}
      >
        <label className="label" htmlFor="received">
          Date received
        </label>
        <input
          id="received"
          className="input"
          type="date"
          value={date}
          max={new Date().toISOString().slice(0, 10)}
          onChange={(e) => setDate(e.target.value)}
        />

        <span className="label">AM or PM pill?</span>
        <div className="seg" role="group" aria-label="AM or PM">
          {(["AM", "PM"] as const).map((option) => (
            <button
              key={option}
              type="button"
              className={`seg-item ${when === option ? "on" : ""}`}
              aria-pressed={when === option}
              onClick={() => setWhen(option)}
            >
              {option === "AM" ? "Morning" : "Evening"}
            </button>
          ))}
        </div>

        <button className="primary" type="submit" disabled={!date}>
          Continue
        </button>
      </form>

      <div className="page-actions">
        <button className="quiet" type="button" onClick={onBack}>
          Back
        </button>
      </div>
    </Sheet>
  );
}

export function TimesPage({
  slot,
  times,
  days,
  onNext,
  onBack,
  onCancel,
}: {
  slot: "AM" | "PM";
  times: string[];
  days: number;
  onNext: (times: string[], days: number) => void;
  onBack: () => void;
  onCancel: () => void;
}) {
  const [perDay, setPerDay] = useState(Math.min(3, Math.max(1, times.length)));
  const [clock, setClock] = useState<string[]>(times);
  const [length, setLength] = useState(days);

  const setCount = (n: number) => {
    setPerDay(n);
    setClock(defaultTimes(slot, n));
  };

  return (
    <Sheet onCancel={onCancel}>
      <h1>When do you take it?</h1>
      <p className="lede">Every day of the course, at these times.</p>

      <div className="seg" role="group" aria-label="Doses per day">
        {[1, 2, 3].map((n) => (
          <button
            key={n}
            type="button"
            className={`seg-item ${perDay === n ? "on" : ""}`}
            aria-pressed={perDay === n}
            onClick={() => setCount(n)}
          >
            {n}× a day
          </button>
        ))}
      </div>

      <div className="times-row">
        {clock.map((value, i) => (
          <input
            key={i}
            className="input"
            type="time"
            value={value}
            aria-label={`Dose ${i + 1}`}
            onChange={(e) => {
              const next = [...clock];
              next[i] = e.target.value;
              setClock(next);
            }}
          />
        ))}
      </div>

      <span className="label wide">How many days is the course?</span>
      <div className="days">
        {[3, 5, 7, 10, 14, 30].map((n) => (
          <button
            key={n}
            type="button"
            className={`day ${length === n ? "on" : ""}`}
            aria-pressed={length === n}
            onClick={() => setLength(n)}
          >
            {n}
          </button>
        ))}
      </div>

      <button className="primary" type="button" onClick={() => onNext(clock, length)}>
        Save this plan
      </button>

      <div className="page-actions">
        <button className="quiet" type="button" onClick={onBack}>
          Back
        </button>
      </div>
    </Sheet>
  );
}
