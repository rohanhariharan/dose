import { useEffect, useState } from "react";
import Dock, { type View } from "./Dock";
import Dots from "./Dots";
import Home from "./Home";
import { PlusIcon } from "./icons";
import { NamePage, RegimensPage, type Profile } from "./Onboarding";
import Placeholder from "./Placeholder";
import ScanPage from "./ScanPage";
import Welcome from "./Welcome";

const KEY = "dose.profile";

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

  const addMedicine = () => setScanning(true);

  useEffect(() => {
    const saved = readProfile();
    if (saved) {
      setProfile(saved);
      setStep(3);
    }
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
    return (
      <div className="app">
        {view === "today" ? (
          <Home
            key="today"
            profile={profile}
            onAdd={addMedicine}
            onReset={() => {
              try {
                localStorage.removeItem(KEY);
              } catch {
                /* ignore */
              }
              setProfile(null);
              setDraftName("");
              setDraftRegimens([]);
              setView("today");
              go(0, "back");
            }}
          />
        ) : (
          <Placeholder key={view} title={page.title} lede={page.lede} empty={page.empty} />
        )}

        <Dock view={view} onChange={setView} />

        <button className="fab" type="button" aria-label="Add a medicine" onClick={addMedicine}>
          <PlusIcon />
        </button>

        {scanning ? <ScanPage onClose={() => setScanning(false)} /> : null}
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
