import { useEffect, useRef, useState } from "react";
import { streamDeltas } from "./stream";

const ENDPOINT = "http://127.0.0.1:8791/summary/stream";

/** Two lines at the top of Today, written as it arrives.
 *
 *  It is a button rather than an automatic call: the summary is the one place
 *  where reading the screen costs a round trip, and the person should decide
 *  when that happens. */
/** Today's summary is written once per app session: it opens on the start
 *  screen, then stays put while the person moves around, and is written again
 *  the next time they open the app. */
const cacheKey = () => `dose.summary.${new Date().toISOString().slice(0, 10)}`;

function cached(): string | null {
  try {
    return sessionStorage.getItem(cacheKey());
  } catch {
    return null;
  }
}

export default function DailySummary({ facts, readerUp }: { facts: string; readerUp: boolean | null }) {
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  const [started, setStarted] = useState(false);
  const ran = useRef(false);

  const run = async (force = false) => {
    if (busy) return;
    const hit = force ? null : cached();
    if (hit) {
      setText(hit);
      setStarted(true);
      return;
    }

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
      try {
        sessionStorage.setItem(cacheKey(), sofar);
      } catch {
        /* private mode: the summary just isn't kept */
      }
    } catch {
      setFailed(true);
    } finally {
      setBusy(false);
    }
  };

  // Written on arrival, from cache if the session already has it.
  useEffect(() => {
    if (readerUp !== true || ran.current) return;
    ran.current = true;
    void run();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [readerUp]);

  return (
    <section className="calendar-panel today-doses daily-summary" aria-labelledby="summary-title">
      <header className="today-doses-head">
        <h2 id="summary-title">Today, in a line</h2>
        {started && !busy && readerUp !== false ? (
          <button className="quiet" type="button" onClick={() => void run(true)}>
            Again
          </button>
        ) : null}
      </header>

      {readerUp === false ? (
        <p className="record-muted">The daily summary needs the local reader. Everything else on this screen works.</p>
      ) : failed ? (
        <p className="calendar-empty">
          Couldn’t reach the writer. Start it with <code>lab/serve.py</code> and try again.
        </p>
      ) : (
        <p className="summary-text" aria-live="polite">
          {text || (busy ? "…" : readerUp === null ? "…" : "")}
        </p>
      )}
    </section>
  );
}
