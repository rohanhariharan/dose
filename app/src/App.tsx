import { useEffect, useState } from "react";
import Dock, { type View } from "./Dock";
import Dots from "./Dots";
import Home from "./Home";
import { PlusIcon } from "./icons";
import { FoundPage, ReceivedPage, TimesPage } from "./Intake";
import { defaultTimes, type Medicine } from "./engine";
import { NamePage, RegimensPage, type Profile } from "./Onboarding";
import Placeholder from "./Placeholder";
import ScanPage from "./ScanPage";
import Welcome from "./Welcome";

const KEY = "dose.profile";
const MEDS = "dose.medicines";

type Stage = "found" | "received" | "times" | null;

interface Draft {
  name: string;
  strength: string;
  receivedAt: string;
  slot: "AM" | "PM";
  times: string[];
  days: number;
}

function today(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function readMeds(): Medicine[] {
  try {
    const raw = localStorage.getItem(MEDS);
    const list = raw ? (JSON.parse(raw) as Medicine[]) : [];
    return Array.isArray(list) ? list : [];
  } catch {
    return [];
  }
}

const PAGES: Record<Exclude<View, "today">, { title: string; lede: string; empty: string }> = {
  medicines: {
    title: "Medicines",
    lede: "What you take, how strong, and when it's due.",
    empty: "Nothing added yet.",
  },
  history: {
    title: "History",
    lede: "Every dose taken, skipped or missed, by day.",
    empty: "No doses recorded yet.",
  },
  settings: {
    title: "Settings",
    lede: "Your name, reminder times, and what leaves this machine — nothing does.",
    empty: "Settings land here.",
  },
};

function readProfile(): Profile | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const p = JSON.parse(raw) as Profile;
    if (typeof p?.name !== "string" || !Array.isArray(p?.regimens)) return null;
    return p;
  } catch {
    return null;
  }
}

/** Four screens: welcome, name, what you're keeping up with, home.
 *  The first three share the dots; home is the app. */
export default function App() {
  const [step, setStep] = useState(0);
  const [dir, setDir] = useState<"fwd" | "back">("fwd");
  const [draftName, setDraftName] = useState("");
  const [draftRegimens, setDraftRegimens] = useState<string[]>([]);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [view, setView] = useState<View>("today");
  const [scanning, setScanning] = useState(false);
  const [stage, setStage] = useState<Stage>(null);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [medicines, setMedicines] = useState<Medicine[]>([]);

  const addMedicine = () => setScanning(true);

  const resetFlow = () => {
    setScanning(false);
    setStage(null);
    setDraft(null);
  };

  const saveMedicine = (d: Draft) => {
    const medicine: Medicine = {
      id: crypto.randomUUID(),
      name: d.name,
      strength: d.strength,
      form: "tablet",
      receivedAt: d.receivedAt,
      slot: d.slot,
      times: [...d.times].sort(),
      days: d.days,
      createdAt: new Date().toISOString(),
    };
    const next = [...medicines, medicine];
    setMedicines(next);
    try {
      localStorage.setItem(MEDS, JSON.stringify(next));
    } catch {
      /* storage unavailable — the session still works */
    }
    resetFlow();
    setView("today");
  };

  useEffect(() => {
    const saved = readProfile();
    if (saved) {
      setProfile(saved);
      setStep(3);
    }
    setMedicines(readMeds());
  }, []);

  const go = (next: number, direction: "fwd" | "back" = "fwd") => {
    setDir(direction);
    setStep(next);
  };

  const finish = (name: string, regimens: string[]) => {
    const next = { name, regimens };
    try {
      localStorage.setItem(KEY, JSON.stringify(next));
    } catch {
      /* storage unavailable — the session still works */
    }
    setProfile(next);
    go(3);
  };

  if (step === 3 && profile) {
    const page = PAGES[view as Exclude<View, "today">];
    const empty =
      view === "medicines"
        ? medicines.length
          ? medicines.map((m) => `${m.name} ${m.strength}`).join(" · ")
          : "Nothing added yet."
        : (page?.empty ?? "");

    // The capture flow takes the whole window: dock and button step aside.
    if (scanning) {
      return (
        <ScanPage
          onClose={() => setScanning(false)}
          onFound={(name, strength) => {
            setScanning(false);
            setDraft({
              name,
              strength,
              receivedAt: today(),
              slot: "AM",
              times: defaultTimes("AM", 1),
              days: 7,
            });
            setStage("found");
          }}
        />
      );
    }

    if (stage === "found" && draft) {
      return (
        <FoundPage
          name={draft.name}
          strength={draft.strength}
          onCancel={resetFlow}
          onAgain={() => {
            setStage(null);
            setScanning(true);
          }}
          onYes={(name, strength) => {
            setDraft({ ...draft, name, strength });
            setStage("received");
          }}
        />
      );
    }

    if (stage === "received" && draft) {
      return (
        <ReceivedPage
          receivedAt={draft.receivedAt}
          slot={draft.slot}
          onCancel={resetFlow}
          onBack={() => setStage("found")}
          onNext={(receivedAt, slot) => {
            setDraft({ ...draft, receivedAt, slot, times: defaultTimes(slot, draft.times.length) });
            setStage("times");
          }}
        />
      );
    }

    if (stage === "times" && draft) {
      return (
        <TimesPage
          slot={draft.slot}
          times={draft.times}
          days={draft.days}
          onCancel={resetFlow}
          onBack={() => setStage("received")}
          onNext={(times, days) => saveMedicine({ ...draft, times, days })}
        />
      );
    }

    return (
      <div className="app">
        {view === "today" ? (
          <Home
            key="today"
            profile={profile}
            medicines={medicines}
            onAdd={addMedicine}
            onReset={() => {
              try {
                localStorage.removeItem(KEY);
                localStorage.removeItem(MEDS);
              } catch {
                /* ignore */
              }
              setProfile(null);
              setDraftName("");
              setDraftRegimens([]);
              setMedicines([]);
              setView("today");
              go(0, "back");
            }}
          />
        ) : (
          <Placeholder key={view} title={page.title} lede={page.lede} empty={empty} />
        )}

        <Dock view={view} onChange={setView} />

        <button className="fab" type="button" aria-label="Add a medicine" onClick={addMedicine}>
          <PlusIcon />
        </button>
      </div>
    );
  }

  return (
    <main className={step === 0 ? "shell" : "shell page"}>
      {step === 0 ? (
        <Welcome onStart={() => go(1)} />
      ) : (
        <div className="page-col">
          <Dots active={step} />
          {step === 1 ? (
            <NamePage
              initial={draftName}
              dir={dir}
              onBack={() => go(0, "back")}
              onNext={(name) => {
                setDraftName(name);
                go(2);
              }}
            />
          ) : null}
          {step === 2 ? (
            <RegimensPage
              initial={draftRegimens}
              dir={dir}
              onBack={() => go(1, "back")}
              onNext={(picked) => {
                setDraftRegimens(picked);
                finish(draftName, picked);
              }}
            />
          ) : null}
        </div>
      )}
    </main>
  );
}
