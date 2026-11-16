import PixelCanvas, { type Grid } from "./PixelCanvas";

/** Three small motifs, used where a moment needs warmth rather than a spinner.
 *  Nothing here is decorative: each one marks a state the person is waiting in. */

/** An empty shelf, for the first Today screen. Same still-life vocabulary as
 *  the welcome scene, at a size that sits inside a card rather than filling one. */
function shelf({ set, rect, accent }: Grid, frame: number) {
  const W = 46;
  rect(2, 15, W - 4, 1);

  // the sun, and two rays that breathe
  for (let y = -3; y <= 3; y++) {
    for (let x = -3; x <= 3; x++) {
      if (x * x + y * y <= 9) set(40 + x, 4 + y);
    }
  }
  const ray = frame % 6 < 3 ? 2 : 1;
  rect(40, 0, 1, ray);

  // bottle
  rect(14, 4, 5, 2);
  rect(12, 6, 9, 9);
  rect(13, 8, 7, 1, false);
  rect(13, 10, 4, 1, false);

  // glass, and a slow breath of steam off it
  rect(27, 7, 6, 8);
  rect(28, 9, 4, 5, false);
  const rise = [0, 0, 1, 1, 2, 2, 1, 1][frame % 8];
  set(29, 5 - rise);
  set(30, 3 - rise);

  // one pill on the shelf
  accent(23, 13);
  accent(24, 13);
  accent(23, 14);
  accent(24, 14);
}

/** A scanning beam, for the moment a label is being read. */
function beam({ set, rect }: Grid, frame: number) {
  const sweep = Math.floor(frame / 2) % 14;

  // four lines of text, and the beam passing over them
  rect(2, 2, 10, 1);
  rect(2, 5, 8, 1);
  rect(2, 8, 11, 1);
  rect(2, 11, 6, 1);

  for (let y = 0; y < 14; y++) set(1 + sweep, y);
  set(1 + sweep, 0, false);
  set(1 + sweep, 13, false);
}

/** Three cells, for waiting on a reply. */
function blip({ set }: Grid, frame: number) {
  const active = Math.floor(frame / 2) % 3;
  for (let i = 0; i < 3; i++) set(i * 3, 2, i === active);
}

export function EmptyShelf() {
  return (
    <PixelCanvas
      cols={46}
      rows={17}
      draw={shelf}
      frames={8}
      cell={4}
      stillFrame={4}
      className="pixel-empty"
      label="An empty shelf with a bottle and a glass"
    />
  );
}

export function ReadingBeam() {
  return (
    <PixelCanvas
      cols={16}
      rows={14}
      draw={beam}
      frames={28}
      cell={3}
      className="pixel-beam"
      label="Reading the label"
    />
  );
}

export function ThinkingBlip() {
  return <PixelCanvas cols={7} rows={4} draw={blip} frames={6} cell={3} className="pixel-blip" />;
}
