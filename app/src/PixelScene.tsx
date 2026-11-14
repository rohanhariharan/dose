import { useEffect, useRef } from "react";

/** A one-bit dot-matrix panel, ported from Typecode's PixelMatrix.
 *
 *  Each cell is drawn at 3px (a 2px dot with a 1px gap) and scaled with
 *  `image-rendering: pixelated`, so every logical pixel stays visible. Twelve
 *  frames at 125ms — a matrix display cadence, not a modern tween.
 */

export interface Grid {
  set(x: number, y: number, on?: boolean): void;
  rect(x: number, y: number, w: number, h: number, on?: boolean): void;
  /** The one coloured cell class: used only where a cell must stand out. */
  accent(x: number, y: number): void;
  /** A hole in a filled shape, so the surface behind the panel shows through. */
  hole(x: number, y: number): void;
}

const CELL = 3;
const W = 96;
const H = 48;
const TABLE = 39;

/** One bottle at first light, a glass of water going cold, and the morning's
 *  pill. The pill is the only coloured thing in the frame. */
function drawScene({ set, rect, accent }: Grid, frame: number) {
  // The sun, upper left, with four rays that breathe.
  for (let y = -5; y <= 5; y++) {
    for (let x = -5; x <= 5; x++) {
      if (x * x + y * y <= 25) set(15 + x, 9 + y);
    }
  }
  const ray = frame % 6 < 3 ? 3 : 2;
  rect(15, 2, 1, ray);
  rect(15, 16 - ray + 1, 1, ray);
  rect(8 - ray + 1, 9, ray, 1);
  rect(22, 9, ray, 1);

  // The table.
  rect(4, TABLE, 89, 1);

  // The bottle: a coloured cap on a narrow neck, a round-shouldered body, and
  // a paper label with three lines of print.
  for (let y = 7; y < 11; y++) for (let x = 40; x < 53; x++) accent(x, y);
  set(40, 7, false);
  set(52, 7, false);
  rect(42, 11, 9, 5);
  rect(36, 16, 21, 23);
  for (const [x, y] of [[36, 16], [56, 16], [36, 38], [56, 38]] as const) set(x, y, false);
  rect(39, 21, 15, 11, false);
  rect(41, 23, 11, 1);
  rect(41, 25, 8, 1);
  rect(41, 27, 5, 1);

  // The glass, half drunk, still steaming.
  rect(67, 27, 11, 12);
  rect(69, 29, 7, 8, false);
  rect(69, 32, 7, 1);

  const rise = [0, 0, 1, 1, 2, 2, 1, 1][frame % 8];
  const wob = frame % 4 === 1 ? 1 : frame % 4 === 3 ? -1 : 0;
  set(72 + wob, 24 - rise);
  set(73 - wob, 21 - rise);
  if (frame % 2 === 0) set(71, 18 - rise);
}

export default function PixelScene({ className }: { className?: string }) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    canvas.width = W * CELL;
    canvas.height = H * CELL;
    ctx.imageSmoothingEnabled = false;

    const cells = new Uint8Array(W * H);
    const put = (x: number, y: number, value: number) => {
      if (x < 0 || y < 0 || x >= W || y >= H) return;
      cells[y * W + x] = value;
    };
    const set = (x: number, y: number, on = true) => put(x, y, on ? 1 : 0);
    const rect = (x: number, y: number, w: number, h: number, on = true) => {
      for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) set(x + i, y + j, on);
    };
    const accent = (x: number, y: number) => put(x, y, 2);
    const hole = (x: number, y: number) => put(x, y, 3);

    const paint = (frame: number) => {
      cells.fill(0);
      drawScene({ set, rect, accent, hole }, frame);

      const styles = getComputedStyle(canvas);
      const ink = styles.getPropertyValue("--ink").trim() || "#161513";
      const faint = styles.getPropertyValue("--faint").trim() || "#9d9a90";
      const ember = styles.getPropertyValue("--ember").trim() || "#4a6fae";

      ctx.clearRect(0, 0, canvas.width, canvas.height);
      for (let y = 0; y < H; y++) {
        for (let x = 0; x < W; x++) {
          const cell = cells[y * W + x];
          if (cell === 3) continue;
          if (cell === 0) {
            ctx.globalAlpha = 0.22;
            ctx.fillStyle = faint;
          } else if (cell === 2) {
            ctx.globalAlpha = 1;
            ctx.fillStyle = ember;
          } else {
            ctx.globalAlpha = 1;
            ctx.fillStyle = ink;
          }
          ctx.fillRect(x * CELL, y * CELL, CELL - 1, CELL - 1);
        }
      }
      ctx.globalAlpha = 1;
    };

    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      paint(4);
      return;
    }

    let raf = 0;
    let last = -1;
    const loop = (now: number) => {
      const f = Math.floor(now / 125) % 12;
      if (f !== last) {
        last = f;
        paint(f);
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, []);

  return <canvas ref={ref} className={className} aria-hidden="true" />;
}
