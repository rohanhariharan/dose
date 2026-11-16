import { useState } from "react";
import { streamDeltas } from "./stream";

const ENDPOINT = "http://127.0.0.1:8791/summary/stream";

/** Two lines at the top of Today, written as it arrives.
 *
 *  It is a button rather than an automatic call: the summary is the one place
 *  where reading the screen costs a round trip, and the person should decide
 *  when that happens. */
export default function DailySummary({ facts }: { facts: string }) {
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  const [started, setStarted] = useState(false);

  const run = async () => {
    setBusy(true);
    setFailed(false);
    setStarted(true);
    setText("");
    let sofar = "";
    try {
      await streamDeltas(ENDPOINT, { context: facts }, (delta) => {
        sofar += delta;
        setText(sofar);
      });
    } catch {
      setFailed(true);
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="calendar-panel today-doses daily-summary" aria-labelledby="summary-title">
      <header className="today-doses-head">
        <h2 id="summary-title">Today, in a line</h2>
        {started ? (
          <button className="quiet" type="button" onClick={() => void run()} disabled={busy}>
            {busy ? "Writing…" : "Again"}
          </button>
        ) : null}
      </header>

      {!started ? (
        <>
          <p className="record-muted">A short read of the day, written when you ask for it.</p>
          <button className="calendar-button" type="button" onClick={() => void run()}>
            Summarise my day
          </button>
        </>
      ) : failed ? (
        <p className="calendar-empty">
          Couldn’t reach the writer. Start it with <code>lab/serve.py</code> and try again.
        </p>
      ) : (
        <p className="summary-text" aria-live="polite">
          {text || (busy ? "…" : "")}
        </p>
      )}
    </section>
  );
}
