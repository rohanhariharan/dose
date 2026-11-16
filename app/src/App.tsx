import { useEffect, useState } from "react";
import Buddy from "./Buddy";
import Calendar from "./Calendar";
import Dock, { type View } from "./Dock";
import Dots from "./Dots";
import Home from "./Home";
import { PlusIcon } from "./icons";
import { FoundPage, ReceivedPage, TimesPage, type DraftSchedule } from "./Intake";
import { clockTime, dayLabel, localDateKey, planFor, type DoseStatus, type Medicine } from "./engine";
import { asKind } from "./kinds";
import { readLabel, type ReadResult } from "./reader";
import { NamePage, RegimensPage, type Profile } from "./Onboarding";
import { HistoryPage, MedicinesPage, SettingsPage } from "./Records";
import ScanPage from "./ScanPage";
import { clearLocal, keys, readDoseLog, readMedicines, readProfile, writeLocal } from "./storage";
import Welcome from "./Welcome";

type Stage = "found" | "received" | "times" | null;

interface Draft {
  name: string;
  strength: string;
  receivedAt: string;
  read: ReadResult | null;
  scanFailed: boolean;
  schedule: DraftSchedule;
}

function newDraft(read: ReadResult | null, scanFailed = false): Draft {
  const tooManyPhases = (read?.phases?.length ?? 0) > 6;
  const phases: { perDay?: number | null; days?: number | null; dose?: string | null }[] =
    tooManyPhases ? [{}] : read?.phases?.length
    ? read.phases
    : [{ perDay: read?.perDay, days: read?.durationDays, dose: read?.dose }];
  return {
    name: read?.name ?? "",
    strength: read?.strength ?? "",
    receivedAt: localDateKey(new Date()),
    read: read && tooManyPhases ? { ...read, needsReview: true } : read,
    scanFailed,
    schedule: {
      phases: phases.map(({ perDay, days, dose }) => ({
        times: Array.from({ length: perDay && perDay >= 1 && perDay <= 4 ? perDay : 0 }, () => ""),
        days: days && days > 0 && days <= 366 ? String(days) : "",
        dose: dose ?? "",
      })),
      route: read?.route ?? "",
      prn: read?.prn === true,
    },
  };
}

/** Four screens: welcome, name, what you're keeping up with, home.
 *  The first three share the dots; home is the app. */
export default function App() {
  const [profile, setProfile] = useState<Profile | null>(readProfile);
  const [step, setStep] = useState(profile ? 3 : 0);
  const [dir, setDir] = useState<"fwd" | "back">("fwd");
  const [draftName, setDraftName] = useState("");
  const [draftRegimens, setDraftRegimens] = useState<string[]>([]);
  const [view, setView] = useState<View>("today");
  const [scanning, setScanning] = useState(false);
  const [stage, setStage] = useState<Stage>(null);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [medicines, setMedicines] = useState(readMedicines);
  const [doseLog, setDoseLog] = useState(readDoseLog);
  const [storageNotice, setStorageNotice] = useState("");
  const [now, setNow] = useState(() => new Date());

  const persist = (key: string, value: unknown) => {
    const saved = writeLocal(key, value);
    if (!saved) setStorageNotice("Dose couldn’t save to this browser. Changes may be lost on reload.");
    return saved;
  };

  useEffect(() => {
    const refresh = () => setNow(new Date());
    const timer = window.setInterval(refresh, 15_000);
    window.addEventListener("focus", refresh);
    document.addEventListener("visibilitychange", refresh);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener("focus", refresh);
      document.removeEventListener("visibilitychange", refresh);
    };
  }, []);

  useEffect(() => {
    const sync = (event: StorageEvent) => {
      if (event.storageArea !== localStorage) return;
      if (event.key === keys.medicines || event.key === null) setMedicines(readMedicines());
      if (event.key === keys.doses || event.key === null) setDoseLog(readDoseLog());
      if (event.key === keys.profile || event.key === null) {
        const saved = readProfile();
        setProfile(saved);
        setStep(saved ? 3 : 0);
        setStage(null);
        setScanning(false);
        setDraft(null);
        setView("today");
      }
    };
    window.addEventListener("storage", sync);
    return () => window.removeEventListener("storage", sync);
  }, []);

  // What Buddy is allowed to know: the same plan the card shows, in a line.
  const buddyContext = view === "buddy" ? medicines
    .map((m) => {
      const plan = planFor(m, now);
      return [
        `${m.name} ${m.strength}`,
        m.form ?? "",
        m.prn ? "as needed" : plan.next ? `next scheduled dose ${dayLabel(plan.next)} ${clockTime(plan.next)}` : "no upcoming doses",
        m.prn ? "" : `schedule ends ${dayLabel(plan.end)}`,
      ]
        .filter(Boolean)
        .join(", ");
    })
    .join("\n") : "";

  const addMedicine = () => setScanning(true);

  const resetFlow = () => {
    setScanning(false);
    setStage(null);
    setDraft(null);
  };

  const saveMedicine = (d: Draft, schedule: DraftSchedule) => {
    const [first, ...taper] = schedule.phases.map((phase) => ({
      times: [...phase.times].sort(),
      days: Number(phase.days),
      dose: phase.dose.trim() || undefined,
    }));
    const medicine: Medicine = {
      id: crypto.randomUUID(),
      name: d.name,
      strength: d.strength,
      form: asKind(d.read?.form ?? undefined),
      receivedAt: d.receivedAt,
      times: schedule.prn ? [] : first.times,
      days: schedule.prn ? 0 : first.days,
      taper: !schedule.prn && taper.length ? taper : undefined,
      dose: first.dose,
      route: schedule.route.trim() || undefined,
      directions: d.read?.directions || undefined,
      quantity: d.read?.quantity ?? undefined,
      unit: d.read?.unit ?? undefined,
      prn: schedule.prn,
      createdAt: new Date().toISOString(),
    };
    const saved = readMedicines();
    const merged = new Map([...medicines, ...saved].map((item) => [item.id, item]));
    const next = [...merged.values(), medicine];
    setMedicines(next);
    persist(keys.medicines, next);
    resetFlow();
    setView("calendar");
  };

  const recordDose = (id: string, status: DoseStatus | null) => {
    const next = { ...(storageNotice ? doseLog : readDoseLog()) };
    if (status) next[id] = { status, recordedAt: new Date().toISOString() };
    else delete next[id];
    setDoseLog(next);
    persist(keys.doses, next);
  };

  const go = (next: number, direction: "fwd" | "back" = "fwd") => {
    setDir(direction);
    setStep(next);
  };

  const finish = (name: string, regimens: string[]) => {
    const next = { name, regimens };
    persist(keys.profile, next);
    setProfile(next);
    go(3);
  };

  const clearProfile = () => {
    if (!clearLocal()) {
      setStorageNotice("Dose couldn’t clear the saved data in this browser.");
      return;
    }
    resetFlow();
    setStorageNotice("");
    setProfile(null);
    setDraftName("");
    setDraftRegimens([]);
    setMedicines([]);
    setDoseLog({});
    setView("today");
    go(0, "back");
  };

  if (step === 3 && profile) {
    // The capture flow takes the whole window: dock and button step aside.
    if (scanning) {
      const showRead = (read: ReadResult | null, attempted = false) => {
        setScanning(false);
        setDraft(newDraft(read, attempted && !read?.name));
        setStage("found");
      };
      return (
        <ScanPage
          onClose={resetFlow}
          onManual={() => showRead(null)}
          onCapture={async (dataUrl, allowCloud, signal) => {
            const read = await readLabel(dataUrl, allowCloud, signal);
            if (!signal.aborted) showRead(read, true);
          }}
        />
      );
    }

    if (stage === "found" && draft) {
      return (
        <FoundPage
          name={draft.name}
          strength={draft.strength}
          kind={draft.read?.form ?? undefined}
          manual={!draft.name}
          scanFailed={draft.scanFailed}
          onCancel={resetFlow}
          onAgain={() => {
            setStage(null);
            setScanning(true);
          }}
          onYes={(name, strength) => {
            const source = name === draft.name && strength === draft.strength ? draft : newDraft(null);
            setDraft({ ...source, receivedAt: draft.receivedAt, name, strength });
            setStage("received");
          }}
        />
      );
    }

    if (stage === "received" && draft) {
      return (
        <ReceivedPage
          receivedAt={draft.receivedAt}
          prn={draft.schedule.prn}
          onCancel={resetFlow}
          onBack={() => setStage("found")}
          onNext={(receivedAt) => {
            setDraft({ ...draft, receivedAt });
            setStage("times");
          }}
        />
      );
    }

    if (stage === "times" && draft) {
      return (
        <TimesPage
          schedule={draft.schedule}
          read={draft.read}
          onCancel={resetFlow}
          onBack={(schedule) => {
            setDraft({ ...draft, schedule });
            setStage("received");
          }}
          onNext={(schedule) => saveMedicine(draft, schedule)}
        />
      );
    }

    return (
      <div className="app">
        {storageNotice ? <p className="storage-notice" role="status">{storageNotice}</p> : null}
        {view === "buddy" ? (
          <Buddy
            key="buddy"
            context={buddyContext}
            onOpen={(next) => setView(next)}
            onScan={() => setScanning(true)}
          />
        ) : view === "calendar" ? (
          <Calendar medicines={medicines} log={doseLog} now={now} onRecord={recordDose} onAdd={addMedicine} />
        ) : view === "today" ? (
          <Home
            profile={profile}
            medicines={medicines}
            log={doseLog}
            now={now}
            onAdd={addMedicine}
            onRecord={recordDose}
          />
        ) : view === "medicines" ? (
          <MedicinesPage medicines={medicines} now={now} onAdd={addMedicine} />
        ) : view === "history" ? (
          <HistoryPage medicines={medicines} log={doseLog} now={now} onRecord={recordDose} />
        ) : (
          <SettingsPage
            profile={profile}
            onSaveName={(name) => {
              const updated = { ...profile, name };
              setProfile(updated);
              return persist(keys.profile, updated);
            }}
            onReset={clearProfile}
          />
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
