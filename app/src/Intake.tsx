import { useEffect, useRef, useState } from "react";
import { displayName, validTime } from "./engine";
import type { ReadResult } from "./reader";
import { kindLabel } from "./kinds";

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
  kind,
  manual: startManual = false,
  onYes,
  onAgain,
  onCancel,
}: {
  name: string;
  strength: string;
  kind?: string;
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
          {kind ? <p className="eyebrow">{kindLabel(kind)}</p> : null}
          <h1>
            {displayName(name)}
            {strength ? ` ${strength}` : ""}
          </h1>
          <p className="lede">Check the medicine and strength against the label.</p>
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
  prn,
  onNext,
  onBack,
  onCancel,
}: {
  receivedAt: string;
  prn: boolean;
  onNext: (date: string) => void;
  onBack: () => void;
  onCancel: () => void;
}) {
  const [date, setDate] = useState(receivedAt);

  return (
    <Sheet onCancel={onCancel}>
      <h1>{prn ? "When did you get it?" : "When does the course start?"}</h1>
      <form className="form" onSubmit={(event) => {
        event.preventDefault();
        if (date) onNext(date);
      }}>
        <label className="label" htmlFor="received">{prn ? "Date received" : "Start date"}</label>
        <input
          id="received" className="input" type="date" value={date} min="1900-01-01" max="9999-12-31" required
          onChange={(event) => setDate(event.target.value)}
        />
        <button className="primary" type="submit" disabled={!date}>Continue</button>
      </form>
      <div className="page-actions">
        <button className="quiet" type="button" onClick={onBack}>Back</button>
      </div>
    </Sheet>
  );
}

interface DraftPhase {
  times: string[];
  days: string;
  dose: string;
}

export interface DraftSchedule {
  phases: DraftPhase[];
  route: string;
  prn: boolean;
}

const blankPhase: DraftPhase = { times: [], days: "", dose: "" };

function validPhase(phase: DraftPhase): boolean {
  const days = Number(phase.days);
  return Number.isInteger(days) && days >= 1 && days <= 366
    && phase.times.length > 0 && phase.times.every(validTime)
    && new Set(phase.times).size === phase.times.length;
}

export function TimesPage({
  schedule,
  read,
  onNext,
  onBack,
  onCancel,
}: {
  schedule: DraftSchedule;
  read: ReadResult | null;
  onNext: (schedule: DraftSchedule) => void;
  onBack: (schedule: DraftSchedule) => void;
  onCancel: () => void;
}) {
  const [draft, setDraft] = useState(schedule);
  const canSave = draft.prn || draft.phases.every(validPhase);

  const update = (index: number, change: Partial<DraftPhase>) => {
    setDraft((state) => ({
      ...state,
      phases: state.phases.map((phase, i) => i === index ? { ...phase, ...change } : phase),
    }));
  };

  return (
    <Sheet onCancel={onCancel}>
      <h1>Review the schedule</h1>
      <p className="lede">
        {read?.needsReview
          ? "These directions need manual review. Enter the schedule only if you can confirm it."
          : "Check the directions and choose the times to put on your calendar."}
      </p>
      {read?.directions ? (
        <figure className="label-quote">
          <figcaption>{read.source.startsWith("gemini") ? "Label text read with Gemini" : "Label text read on this device"}</figcaption>
          <blockquote>{read.directions}</blockquote>
        </figure>
      ) : read ? (
        <p className="lede">The scan didn’t find directions. Enter what your label says.</p>
      ) : null}
      <form className="form" onSubmit={(event) => {
        event.preventDefault();
        if (canSave) onNext(draft);
      }}>
        <label className="check-row">
          <input
            type="checkbox" checked={draft.prn}
            onChange={(event) => setDraft({ ...draft, prn: event.target.checked })}
          />
          As needed
        </label>
        <label className="label" htmlFor="dose-route">Route (optional)</label>
        <input
          className="input" id="dose-route" value={draft.route} maxLength={100}
          onChange={(event) => setDraft({ ...draft, route: event.target.value })}
        />
        {draft.prn ? (
          <>
            <label className="label" htmlFor="phase-dose-0">Dose per use (optional)</label>
            <input
              className="input" id="phase-dose-0" value={draft.phases[0].dose} maxLength={100}
              onChange={(event) => update(0, { dose: event.target.value })}
            />
            <p className="intake-note">This medicine appears under As needed without calendar entries.</p>
          </>
        ) : (
          <>
            {draft.phases.map((phase, index) => (
              <fieldset className="intake-phase" key={index}>
                <legend>{draft.phases.length > 1 ? `Phase ${index + 1}` : "Daily schedule"}</legend>
                <label className="label" htmlFor={`phase-dose-${index}`}>Dose per use (optional)</label>
                <input
                  className="input" id={`phase-dose-${index}`} value={phase.dose} maxLength={100}
                  onChange={(event) => update(index, { dose: event.target.value })}
                />
                <div className="intake-two">
                  <label>
                    <span className="label">Doses per day</span>
                    <select
                      className="input" required value={phase.times.length || ""}
                      onChange={(event) => update(index, {
                        times: Array.from({ length: Number(event.target.value) }, (_, i) => phase.times[i] ?? ""),
                      })}
                    >
                      <option value="">Choose</option>
                      {[1, 2, 3, 4].map((count) => <option key={count} value={count}>{count}</option>)}
                    </select>
                  </label>
                  <label>
                    <span className="label">Number of days</span>
                    <input
                      className="input" type="number" min="1" max="366" required value={phase.days}
                      onChange={(event) => update(index, { days: event.target.value })}
                    />
                  </label>
                </div>
                {phase.times.length > 0 ? (
                  <div className="intake-times">
                    {phase.times.map((time, slot) => (
                      <label key={slot}>
                        <span className="label">Dose {slot + 1} time</span>
                        <input
                          className="input" type="time" value={time} required
                          onChange={(event) => update(index, {
                            times: phase.times.map((value, i) => i === slot ? event.target.value : value),
                          })}
                        />
                      </label>
                    ))}
                  </div>
                ) : null}
                {phase.times.filter(Boolean).length > new Set(phase.times.filter(Boolean)).size
                  ? <p className="intake-note" role="status">Choose different times for each dose.</p> : null}
                {draft.phases.length > 1 ? (
                  <button
                    className="quiet" type="button"
                    onClick={() => setDraft({ ...draft, phases: draft.phases.filter((_, i) => i !== index) })}
                  >Remove phase {index + 1}</button>
                ) : null}
              </fieldset>
            ))}
            {draft.phases.length < 6 ? (
              <button
                className="quiet" type="button"
                onClick={() => setDraft({ ...draft, phases: [...draft.phases, blankPhase] })}
              >Add a phase</button>
            ) : null}
          </>
        )}
        <button className="primary" type="submit" disabled={!canSave}>Save to calendar</button>
      </form>
      <div className="page-actions">
        <button className="quiet" type="button" onClick={() => onBack(draft)}>Back</button>
      </div>
    </Sheet>
  );
}
