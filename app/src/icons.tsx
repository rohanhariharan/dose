/** The dock icons. One stroke weight, 1.6, round caps — the same register as
 *  Typecode's Hugeicons set, drawn here so the app carries no icon dependency. */

const base = {
  width: 18,
  height: 18,
  viewBox: "0 0 20 20",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.6,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  "aria-hidden": true,
};

export function SunIcon() {
  return (
    <svg {...base}>
      <circle cx="10" cy="10" r="3.4" />
      <path d="M10 2.4v1.6M10 16v1.6M2.4 10h1.6M16 10h1.6M4.6 4.6l1.1 1.1M14.3 14.3l1.1 1.1M15.4 4.6l-1.1 1.1M5.7 14.3l-1.1 1.1" />
    </svg>
  );
}

export function PillIcon() {
  return (
    <svg {...base}>
      <rect x="2.6" y="7.4" width="14.8" height="5.2" rx="2.6" transform="rotate(-40 10 10)" />
      <path d="M7.4 6.4l6.2 7.2" />
    </svg>
  );
}

export function ClockIcon() {
  return (
    <svg {...base}>
      <circle cx="10" cy="10.4" r="6.6" />
      <path d="M10 6.6v4l2.6 1.6" />
    </svg>
  );
}

export function SlidersIcon() {
  return (
    <svg {...base}>
      <path d="M3 6.4h14M3 13.6h14" />
      <circle cx="7.4" cy="6.4" r="2" />
      <circle cx="12.6" cy="13.6" r="2" />
    </svg>
  );
}
