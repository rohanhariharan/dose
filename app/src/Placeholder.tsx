/** A page that exists so the dock has somewhere to go. Same frame as home:
 *  left-aligned column, serif title, one line, and an honest empty box. */
export default function Placeholder({
  title,
  lede,
  empty,
}: {
  title: string;
  lede: string;
  empty: string;
}) {
  return (
    <main className="placeholder">
      <div className="ph-col">
        <h1>{title}</h1>
        <p className="lede left">{lede}</p>
        <div className="ph-box">{empty}</div>
      </div>
    </main>
  );
}
