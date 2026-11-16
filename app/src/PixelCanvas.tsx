import { useEffect, useRef } from "react";

/** A small one-bit dot-matrix panel. Same cell geometry and colours as the
 *  welcome scene, parameterised so a 12- or 40-wide motif can use it without
 *  dragging the whole bottle still-life along. */

export interface Grid {
  set(x: number, y: number, on?: boolean): void;
  rect(x: number, y: number, w: number, h: number, on?: boolean): void;
  accent(x: number, y: number): void;
  hole(x: number, y: number): void;
}

export default function PixelCanvas({
  cols,
  rows,
  draw,
  frames = 12,
  cell = 3,
  stillFrame = 0,
  className,
  label,
}: {
  cols: number;
  rows: number;
  draw: (grid: Grid, frame: number) => void;
  frames?: number;
  cell?: number;
  stillFrame?: number;
  className?: string;
  label?: string;
}) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    canvas.width = cols * cell;
    canvas.height = rows * cell;
    ctx.imageSmoothingEnabled = false;

    const cells = new Uint8Array(cols * rows);
    const put = (x: number, y: number, value: number) => {
      if (x < 0 || y < 0 || x >= cols || y >= rows) return;
      cells[y * cols + x] = value;
    };
    const set = (x: number, y: number, on = true) => put(x, y, on ? 1 : 0);
    const rect = (x: number, y: number, w: number, h: number, on = true) => {
      for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) set(x + i, y + j, on);
    };
    const accent = (x: number, y: number) => put(x, y, 2);
    const hole = (x: number, y: number) => put(x, y, 3);

    const paint = (frame: number) => {
      cells.fill(0);
      draw({ set, rect, accent, hole }, frame);

      const styles = getComputedStyle(canvas);
      const ink = styles.getPropertyValue("--ink").trim() || "#161513";
      const faint = styles.getPropertyValue("--faint").trim() || "#9d9a90";
      const ember = styles.getPropertyValue("--ember").trim() || "#4a6fae";

      ctx.clearRect(0, 0, canvas.width, canvas.height);
      for (let y = 0; y < rows; y++) {
        for (let x = 0; x < cols; x++) {
          const value = cells[y * cols + x];
          if (value === 3) continue;
          if (value === 0) {
            ctx.globalAlpha = 0.22;
            ctx.fillStyle = faint;
          } else if (value === 2) {
            ctx.globalAlpha = 1;
            ctx.fillStyle = ember;
          } else {
            ctx.globalAlpha = 1;
            ctx.fillStyle = ink;
          }
          ctx.fillRect(x * cell, y * cell, cell - 1, cell - 1);
        }
      }
      ctx.globalAlpha = 1;
    };

    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      paint(stillFrame);
      return;
    }

    let raf = 0;
    let last = -1;
    const loop = (now: number) => {
      const frame = Math.floor(now / 140) % frames;
      if (frame !== last) {
        last = frame;
        paint(frame);
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [cols, rows, draw, frames, cell, stillFrame]);

  return (
    <canvas
      ref={ref}
      className={className}
      role={label ? "img" : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
    />
  );
}
