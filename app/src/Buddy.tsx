import { useEffect, useRef, useState } from "react";
import { ThinkingBlip } from "./PixelBits";

type Action = { type: "open" | "rescan"; title: string; body?: string; yes?: string; no?: string };
type Turn = { role: "user" | "model"; text: string; action?: Action; decided?: "yes" | "no" };

const ENDPOINT = "http://127.0.0.1:8791";

const OPENERS = [
  "When is my next dose?",
  "When does my course end?",
  "Open my medicines",
];

/** The model is told to end with a fenced ```action block; this pulls it out. */
function splitAction(text: string): { text: string; action?: Action } {
  const match = text.match(/```action\s*\n?([\s\S]*?)```/);
  if (!match) return { text };
  try {
    const action = JSON.parse(match[1].trim()) as Partial<Action>;
    const reply = text.replace(match[0], "").trim();
    if (!action || (action.type !== "open" && action.type !== "rescan")
        || typeof action.title !== "string" || !action.title.trim()) return { text: reply };
    return { text: reply, action: {
      type: action.type,
      title: action.title,
      body: typeof action.body === "string" ? action.body : undefined,
      yes: typeof action.yes === "string" ? action.yes : undefined,
      no: typeof action.no === "string" ? action.no : undefined,
    } };
  } catch {
    return { text: text.replace(match[0], "").trim() };
  }
}

export default function Buddy({
  context,
  onOpen,
  onScan,
}: {
  context: string;
  onOpen: (view: "today" | "medicines" | "calendar") => void;
  onScan: () => void;
}) {
  const [turns, setTurns] = useState<Turn[]>([]);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [offline, setOffline] = useState(false);
  const log = useRef<HTMLDivElement>(null);
  const box = useRef<HTMLTextAreaElement>(null);
  const inflight = useRef<AbortController | null>(null);

  useEffect(() => () => inflight.current?.abort(), []);

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
    if (!message || inflight.current) return;
    const request = new AbortController();
    inflight.current = request;

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
        signal: request.signal,
      });
      if (!response.ok || !response.body) throw new Error("no stream");

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let completed = false;

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
          if (payload.done) completed = true;
          if (payload.delta) {
            sofar += payload.delta;
            const visible = sofar.split("```action", 1)[0].trimEnd();
            setTurns((current) => {
              const last = current.at(-1);
              return last?.role === "model"
                ? [...current.slice(0, -1), { ...last, text: visible }]
                : current;
            });
          }
        }
      }
      if (!completed || !sofar.trim()) throw new Error("incomplete stream");
    } catch {
      if (!request.signal.aborted) {
        setTurns(history.slice(0, -1));
        setDraft(message);
        setOffline(true);
      }
      return;
    } finally {
      inflight.current = null;
      if (!request.signal.aborted) setBusy(false);
    }

    const { text: said, action } = splitAction(sofar);
    setTurns((current) => {
      const last = current.at(-1);
      return last?.role === "model"
        ? [...current.slice(0, -1), { ...last, text: said, action }]
        : current;
    });
  };

  const decide = (index: number, yes: boolean, action: Action) => {
    setTurns((current) =>
      current.map((turn, i) => (i === index ? { ...turn, decided: yes ? "yes" : "no" } : turn)),
    );

    const say = (text: string) => push({ role: "model", text });

    if (!yes) return;

    if (action.type === "rescan") {
      onScan();
      say("Opening the camera. Fill the box with the label.");
      return;
    }

    if (action.type === "open") {
      onOpen(action.body === "medicines" || action.body === "calendar" ? action.body : "today");
      say("Opened it for you.");
    }
  };

  return (
    <main className="buddy">
      <div className="buddy-col">
        <header className="buddy-head">
          <p className="eyebrow">Buddy</p>
          <h1>Ask about your schedule</h1>
          <p className="lede left">Your message and a summary of your plans are sent to Gemini when you chat.</p>
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
                  {turn.action.type === "rescan" && turn.action.body ? <p className="action-body">{turn.action.body}</p> : null}
                  {turn.decided ? (
                    <p className="action-done">{turn.decided === "yes" ? "Done." : "Dismissed."}</p>
                  ) : (
                    <div className="action-buttons">
                      <button
                        className="action-yes"
                        type="button"
                        onClick={() => decide(index, true, turn.action!)}
                      >
                        {turn.action.yes ?? "Yes"}
                      </button>
                      <button
                        className="action-no"
                        type="button"
                        onClick={() => decide(index, false, turn.action!)}
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
            <p className="msg them thinking">
              <ThinkingBlip />
              <span>Thinking</span>
            </p>
          ) : null}

          {offline ? (
            <p className="msg system">
              Buddy is unavailable. Start <code>lab/serve.py</code> with a Gemini API key, then try again.
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
