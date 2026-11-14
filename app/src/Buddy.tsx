import { useEffect, useRef, useState } from "react";

/** Buddy. A conversation about the medicines on file — not a clinician, and it
 *  says so once, quietly, rather than on every reply. */

type Turn = { role: "user" | "model"; text: string };

const ENDPOINT = "http://127.0.0.1:8791/chat";

const OPENERS = [
  "When is my next dose?",
  "What is this medicine for?",
  "I missed a dose — what now?",
];

export default function Buddy({ context }: { context: string }) {
  const [turns, setTurns] = useState<Turn[]>([]);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [offline, setOffline] = useState(false);
  const log = useRef<HTMLDivElement>(null);

  useEffect(() => {
    log.current?.scrollTo({ top: log.current.scrollHeight, behavior: "smooth" });
  }, [turns, busy]);

  const send = async (text: string) => {
    const message = text.trim();
    if (!message || busy) return;

    const next: Turn[] = [...turns, { role: "user", text: message }];
    setTurns(next);
    setDraft("");
    setBusy(true);
    setOffline(false);

    try {
      const response = await fetch(ENDPOINT, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ messages: next, context }),
      });
      if (!response.ok) throw new Error(String(response.status));
      const data = (await response.json()) as { reply?: string };
      if (!data.reply) throw new Error("empty");
      setTurns([...next, { role: "model", text: data.reply }]);
    } catch {
      setOffline(true);
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="buddy">
      <div className="buddy-col">
        <header className="buddy-head">
          <p className="eyebrow">Buddy</p>
          <h1>Ask about your medicine</h1>
          <p className="lede left">Not a doctor. For anything urgent, call one.</p>
        </header>

        <div className="chat" ref={log}>
          {turns.length === 0 ? (
            <div className="openers">
              {OPENERS.map((opener) => (
                <button key={opener} type="button" className="opener" onClick={() => void send(opener)}>
                  {opener}
                </button>
              ))}
            </div>
          ) : null}

          {turns.map((turn, index) => (
            <p key={index} className={`msg ${turn.role === "user" ? "me" : "them"}`}>
              {turn.text}
            </p>
          ))}

          {busy ? <p className="msg them thinking">Thinking…</p> : null}

          {offline ? (
            <p className="msg system">
              Buddy can’t reach the assistant. Start it with <code>lab/serve.py</code> and try again.
            </p>
          ) : null}
        </div>

        <form
          className="composer"
          onSubmit={(e) => {
            e.preventDefault();
            void send(draft);
          }}
        >
          <input
            className="input"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="Ask about a medicine…"
            aria-label="Message Buddy"
            maxLength={400}
          />
          <button className="send" type="submit" disabled={!draft.trim() || busy} aria-label="Send">
            <svg viewBox="0 0 20 20" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
              <path d="M4 10h11M10.5 5l5 5-5 5" />
            </svg>
          </button>
        </form>
      </div>
    </main>
  );
}
