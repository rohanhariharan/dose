import { CalendarIcon, ChatIcon, ClockIcon, PillIcon, SlidersIcon, SunIcon } from "./icons";

export type View = "today" | "calendar" | "medicines" | "history" | "buddy" | "settings";

const ITEMS: { id: View; label: string; Icon: () => React.ReactElement }[] = [
  { id: "today", label: "Today", Icon: SunIcon },
  { id: "calendar", label: "Calendar", Icon: CalendarIcon },
  { id: "medicines", label: "Medicines", Icon: PillIcon },
  { id: "history", label: "History", Icon: ClockIcon },
  { id: "buddy", label: "Buddy", Icon: ChatIcon },
  { id: "settings", label: "Settings", Icon: SlidersIcon },
];

/** The current page is highlighted in the dock. */
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
