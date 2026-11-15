import { localDate, localDateKey, validTime, type DoseLog, type Medicine } from "./engine";
import type { Profile } from "./Onboarding";

export const keys = {
  profile: "dose.profile",
  medicines: "dose.medicines",
  doses: "dose.doses",
};

function read(key: string): unknown {
  try {
    return JSON.parse(localStorage.getItem(key) ?? "null");
  } catch {
    return null;
  }
}

function record(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

export function readProfile(): Profile | null {
  const value = read(keys.profile);
  if (!record(value) || typeof value.name !== "string" || !Array.isArray(value.regimens)) return null;
  return { name: value.name, regimens: value.regimens.filter((item) => typeof item === "string") };
}

function validPhase(value: unknown): boolean {
  return record(value) && typeof value.days === "number" && Number.isInteger(value.days)
    && value.days >= 1 && value.days <= 366
    && Array.isArray(value.times) && value.times.length >= 1 && value.times.length <= 4
    && value.times.every((time) => typeof time === "string" && validTime(time))
    && new Set(value.times).size === value.times.length
    && (value.dose === undefined || typeof value.dose === "string");
}

export function readMedicines(): Medicine[] {
  const value = read(keys.medicines);
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is Medicine => {
    if (!record(item) || typeof item.id !== "string" || typeof item.name !== "string"
        || typeof item.strength !== "string" || typeof item.receivedAt !== "string"
        || !/^\d{4}-\d{2}-\d{2}$/.test(item.receivedAt)
        || localDateKey(localDate(item.receivedAt)) !== item.receivedAt) return false;
    if (item.prn === true) return true;
    return validPhase(item) && (item.taper === undefined
      || (Array.isArray(item.taper) && item.taper.length <= 5 && item.taper.every(validPhase)));
  });
}

export function readDoseLog(): DoseLog {
  const value = read(keys.doses);
  if (!record(value)) return {};
  const log: DoseLog = Object.create(null);
  for (const [id, item] of Object.entries(value)) {
    if (record(item) && (item.status === "taken" || item.status === "skipped")
        && typeof item.recordedAt === "string") {
      log[id] = { status: item.status, recordedAt: item.recordedAt };
    }
  }
  return log;
}

export function writeLocal(key: string, value: unknown): boolean {
  try {
    localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}

export function clearLocal(): boolean {
  try {
    for (const key of Object.values(keys)) localStorage.removeItem(key);
    return true;
  } catch {
    return false;
  }
}
