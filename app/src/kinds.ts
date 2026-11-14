/** The kinds of medicine the app knows about. One list, used in three places:
 *  the reader's vocabulary, the confirm screen, and the plan. Adding a kind
 *  here is the only edit needed for it to be recognised. */

export const KINDS = {
  tablet: { label: "Tablet", hint: "swallowed" },
  capsule: { label: "Capsule", hint: "swallowed" },
  inhaler: { label: "Inhaler", hint: "breathed in" },
  injection: { label: "Injection", hint: "into the skin or muscle" },
  drops: { label: "Drops", hint: "eyes or ears" },
  cream: { label: "Cream", hint: "on the skin" },
  ointment: { label: "Ointment", hint: "on the skin" },
  gel: { label: "Gel", hint: "on the skin" },
  liquid: { label: "Liquid", hint: "swallowed" },
  patch: { label: "Patch", hint: "on the skin" },
  spray: { label: "Spray", hint: "nose or throat" },
  other: { label: "Something else", hint: "" },
} as const;

export type Kind = keyof typeof KINDS;

export const KIND_KEYS = Object.keys(KINDS) as Kind[];

/** Unknown or missing kinds fall back to "other" rather than guessing. */
export function asKind(value: string | null | undefined): Kind {
  const key = (value ?? "").toLowerCase().trim();
  return (KIND_KEYS as string[]).includes(key) ? (key as Kind) : "other";
}

export function kindLabel(value: string | null | undefined): string {
  return KINDS[asKind(value)].label;
}
