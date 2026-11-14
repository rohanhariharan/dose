/** The three dots above the flow. One per onboarding page. */
export default function Dots({ total = 3, active }: { total?: number; active: number }) {
  return (
    <div className="dots" aria-label={`Step ${active + 1} of ${total}`}>
      {Array.from({ length: total }, (_, i) => (
        <i key={i} className={i === active ? "on" : undefined} />
      ))}
    </div>
  );
}
