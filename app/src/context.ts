/** What the person volunteers about their routines.

 *  Deliberately not identifying and deliberately small: a band, a few habits,
 *  a line of their own words. It is context for the assistant, not a profile —
 *  no age, no condition, no name beyond the one they already gave.
 */

export interface AboutYou {
  ageBand: string;
  chips: string[];
  note: string;
}

export const AGE_BANDS = ["Under 18", "18–39", "40–64", "65+"] as const;

export const HABITS = [
  "I work shifts",
  "Mornings are easier",
  "Evenings are easier",
  "I have trouble swallowing pills",
  "Someone helps with my doses",
  "I often forget the midday dose",
] as const;

const KEY = "dose.context";

export const emptyAbout: AboutYou = { ageBand: "", chips: [], note: "" };

export function readAbout(): AboutYou {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return emptyAbout;
    const value = JSON.parse(raw) as Partial<AboutYou>;
    return {
      ageBand: typeof value.ageBand === "string" ? value.ageBand : "",
      chips: Array.isArray(value.chips) ? value.chips.filter((c): c is string => typeof c === "string") : [],
      note: typeof value.note === "string" ? value.note.slice(0, 120) : "",
    };
  } catch {
    return emptyAbout;
  }
}

export function writeAbout(about: AboutYou): boolean {
  try {
    localStorage.setItem(KEY, JSON.stringify(about));
    return true;
  } catch {
    return false;
  }
}

/** The one line Buddy gets. Empty when nothing has been volunteered. */
export function aboutLine(about: AboutYou): string {
  const parts = [
    about.ageBand ? `age band ${about.ageBand}` : "",
    about.chips.length ? about.chips.join("; ").toLowerCase() : "",
    about.note.trim(),
  ].filter(Boolean);
  return parts.length ? `About them: ${parts.join(" · ")}.` : "";
}
