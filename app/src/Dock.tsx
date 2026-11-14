import { ClockIcon, PillIcon, SlidersIcon, SunIcon } from "./icons";

export type View = "today" | "medicines" | "history" | "settings";

const ITEMS: { id: View; label: string; Icon: () => React.ReactElement }[] = [
  { id: "today", label: "Today", Icon: SunIcon },
  { id: "medicines", label: "Medicines", Icon: PillIcon },
  { id: "history", label: "History", Icon: ClockIcon },
  { id: "settings", label: "Settings", Icon: SlidersIcon },
];

/** A floating, rounded dock. Four places, one lit. */
export default function Dock({
  view,
  onChange,
}: {
  view: View;
  onChange: (view: View) => void;
}) {
  return (
    <nav className="dock" aria-label="Pages">
      {ITEMS.map(({ id, label, Icon }) => (
        <button
          key={id}
          type="button"
          className={`dock-item ${view === id ? "on" : ""}`}
          aria-current={view === id ? "page" : undefined}
          onClick={() => onChange(id)}
        >
          <Icon />
          <span>{label}</span>
        </button>
      ))}
    </nav>
  );
}
