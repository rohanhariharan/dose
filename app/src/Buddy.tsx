import { useEffect, useRef, useState } from "react";

/** Buddy. A conversation about the medicines on file — not a clinician, and it
 *  says so once, quietly, rather than on every reply.
 *
 *  Replies arrive a piece at a time, and sometimes the reply ends with an
 *  action block: something the app can actually do, offered as a card with two
 *  buttons instead of a sentence asking the person to go and find a setting. */

type Action = { type: string; title: string; body?: string; yes?: string; no?: string };
type Turn = { role: "user" | "model"; text: string; action?: Action; decided?: "yes" | "no" };

const ENDPOINT = "http://127.0.0.1:8791";

const OPENERS = [
  "When is my next dose?",
  "What is this medicine for?",
  "Remind me in the evening",
];

/** The model is told to end with a fenced ```action block; this pulls it out. */
function splitAction(text: string): { text: string; action?: Action } {
  const match = text.match(/```action\s*\n?([\s\S]*?)```/);
  if (!match) return { text };
  try {
    const action = JSON.parse(match[1].trim()) as Action;
    if (!action?.title || !action?.type) return { text };
    return { text: text.replace(match[0], "").trim(), action };
  } catch {
    return { text };
  }
}

export default function Buddy({
  context,
  onOpen,
  onScan,
}: {
  context: string;
  onOpen: (view: "today" | "medicines") => void;
  onScan: () => void;
}) {
  const [turns, setTurns] = useState<Turn[]>([]);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [offline, setOffline] = useState(false);
  const log = useRef<HTMLDivElement>(null);
  const box = useRef<HTMLTextAreaElement>(null);

  // The composer grows with what's in it, up to about four lines, then scrolls.
  useEffect(() => {
    const area = box.current;
    if (!area) return;
    area.style.height = "auto";
    area.style.height = `${Math.min(area.scrollHeight, 132)}px`;
  }, [draft]);

  useEffect(() => {
    log.current?.scrollTo({ top: log.current.scrollHeight, behavior: "smooth" });
  }, [turns, busy]);

  const push = (turn: Turn) => setTurns((current) => [...current, turn]);

  const send = async (text: string) => {
    const message = text.trim();
    if (!message || busy) return;

    const history: Turn[] = [...turns, { role: "user", text: message }];
    setTurns([...history, { role: "model", text: "" }]);
    setDraft("");
    setBusy(true);
    setOffline(false);

    let sofar = "";
    try {
      const response = await fetch(`${ENDPOINT}/chat/stream`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          messages: history.map((t) => ({ role: t.role, text: t.text })),
          context,
        }),
      });
      if (!response.body) throw new Error("no stream");

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        const events = buffer.split("\n\n");
        buffer = events.pop() ?? "";

        for (const event of events) {
          const line = event.split("\n").find((l) => l.startsWith("data: "));
          if (!line) continue;
          const payload = JSON.parse(line.slice(6)) as { delta?: string; done?: boolean; error?: string };
          if (payload.error) throw new Error(payload.error);
          if (payload.delta) {
            sofar += payload.delta;
            setTurns((current) => {
              const next = [...current];
              const last = next[next.length - 1];
              if (last?.role === "model") last.text = sofar;
              return next;
            });
          }
        }
      }
    } catch {
      setTurns((current) => current.filter((t, i) => !(i === current.length - 1 && t.role === "model" && !t.text)));
      setOffline(true);
      setBusy(false);
      return;
    }

    const { text: said, action } = splitAction(sofar);
    setTurns((current) => {
      const next = [...current];
      const last = next[next.length - 1];
      if (last?.role === "model") {
        last.text = said || "…";
        last.action = action;
      }
      return next;
    });
    setBusy(false);
  };

  const decide = async (index: number, yes: boolean, action: Action) => {
    setTurns((current) =>
      current.map((turn, i) => (i === index ? { ...turn, decided: yes ? "yes" : "no" } : turn)),
    );

    const say = (text: string) => push({ role: "model", text });

    if (!yes) {
      say("Okay — no reminders. The schedule is still on Today whenever you want it.");
      return;
    }

    if (action.type === "notifications") {
      if (!("Notification" in window)) {
        say("This window can't show notifications, so I can't set a reminder here.");
        return;
      }
      const permission = await Notification.requestPermission();
      if (permission === "granted") {
        new Notification("Reminders are on", { body: "Dose will nudge you when a dose is due." });
        say("Reminders are on. I'll nudge you when a dose is due.");
      } else {
        say("Your browser blocked notifications. You can allow them in site settings, and I'll try again.");
      }
      return;
    }

    if (action.type === "rescan") {
      onScan();
      say("Opening the camera. Fill the box with the label.");
      return;
    }

    if (action.type === "open") {
      onOpen(action.body === "medicines" ? "medicines" : "today");
      say("Opened it for you.");
      return;
    }

    say("I can't do that one yet.");
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
            <div key={index} className={`turn ${turn.role === "user" ? "me" : "them"}`}>
              {turn.text ? <p className={`msg ${turn.role === "user" ? "me" : "them"}`}>{turn.text}</p> : null}

              {turn.action ? (
                <div className="action">
                  <p className="action-title">{turn.action.title}</p>
                  {turn.action.body ? <p className="action-body">{turn.action.body}</p> : null}
                  {turn.decided ? (
                    <p className="action-done">{turn.decided === "yes" ? "Done." : "Dismissed."}</p>
                  ) : (
                    <div className="action-buttons">
                      <button
                        className="action-yes"
                        type="button"
                        onClick={() => void decide(index, true, turn.action!)}
                      >
                        {turn.action.yes ?? "Yes"}
                      </button>
                      <button
                        className="action-no"
                        type="button"
                        onClick={() => void decide(index, false, turn.action!)}
                      >
                        {turn.action.no ?? "No"}
                      </button>
                    </div>
                  )}
                </div>
              ) : null}
            </div>
          ))}

          {busy && turns[turns.length - 1]?.text === "" ? (
            <p className="msg them thinking">Thinking…</p>
          ) : null}

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
          <textarea
            ref={box}
            className="say"
            rows={1}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                void send(draft);
              }
            }}
            placeholder="Ask about a medicine…"
            aria-label="Message Buddy"
            maxLength={600}
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
