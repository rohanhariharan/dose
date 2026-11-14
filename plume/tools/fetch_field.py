#!/usr/bin/env python3
"""
Build a global PM2.5 field snapshot for the Plume map.

Open-Meteo counts one API call per *location*, not per HTTP request, so a
single request holding 500 coordinates costs 500 calls. The free tier allows
~600 locations per minute, which means a 5-degree global grid (2,520 points)
has to be paced across several minutes. That is why this runs once and writes
a file, instead of the browser fetching the grid on every page load.

Usage:
    python3 tools/fetch_field.py                # 5 degree grid, paced
    python3 tools/fetch_field.py --step 10      # coarser, faster
    python3 tools/fetch_field.py --check        # validate existing file only

Output: data/field.json  {"generated_at", "step", "nx", "ny", "lat0", "lon0", "values"}
values is row-major, north-to-south rows of [pm2_5, u, v] (u/v = m/s wind vector).
"""

import argparse
import json
import math
import os
import sys
import time
import urllib.error
import urllib.parse
import urllib.request

API = "https://air-quality-api.open-meteo.com/v1/air-quality"
WEATHER_API = "https://api.open-meteo.com/v1/forecast"
LAT_MIN, LAT_MAX = -85, 85
CHUNK = 350          # locations per request (keeps the URL under nginx 8 KB)
GAP_SECONDS = 62     # keeps us under the 600 locations/minute cap
TIMEOUT = 40


def build_points(step):
    lats = []
    la = LAT_MIN
    while la <= LAT_MAX:
        lats.append(round(la, 2))
        la += step
    lons = []
    lo = -180.0
    while lo < 180:
        lons.append(round(lo, 2))
        lo += step
    return lats, lons


def fetch(points, attempt=1, host=None, fields="pm2_5"):
    # Commas must stay literal: percent-encoding them triples the URL length
    # and nginx rejects anything past ~8 KB with a 414.
    lat = ",".join(f"{p[0]:.2f}" for p in points)
    lon = ",".join(f"{p[1]:.2f}" for p in points)
    url = (
        f"{host or API}?latitude={lat}&longitude={lon}"
        f"&current={fields}&timezone=UTC"
    )
    req = urllib.request.Request(url, headers={"User-Agent": "plume-hackathon/0.1"})
    try:
        with urllib.request.urlopen(req, timeout=TIMEOUT) as r:
            return json.loads(r.read().decode())
    except urllib.error.HTTPError as e:
        body = e.read().decode(errors="replace")[:200]
        if e.code == 429 and attempt <= 4:
            wait = 30 * attempt
            print(f"  429 rate limited, sleeping {wait}s (attempt {attempt})", flush=True)
            time.sleep(wait)
            return fetch(points, attempt + 1, host, fields)
        raise RuntimeError(f"HTTP {e.code}: {body}") from None


def build_wind(step):
    """Wind is smooth, so a coarse grid is plenty. The air-quality endpoint
    accepts wind_speed_10m but always answers null, so this hits the forecast API."""
    lats, lons = build_points(step)
    nx, ny = len(lons), len(lats)
    points = [(la, lo) for la in lats for lo in lons]
    rows = fetch(points, host=WEATHER_API, fields="wind_speed_10m,wind_direction_10m")

    idx_of = {(round(la, 1), round(lo, 1)): y * nx + x
              for y, la in enumerate(lats) for x, lo in enumerate(lons)}
    cells = [None] * (nx * ny)
    for r in rows:
        cur = r.get("current") or {}
        i = idx_of.get((round(r["latitude"], 1), round(r["longitude"], 1)))
        if i is None:
            continue
        spd, deg = cur.get("wind_speed_10m"), cur.get("wind_direction_10m")
        if spd is None or deg is None:
            continue
        ms = spd / 3.6   # km/h -> m/s
        rad = math.radians(deg)
        cells[i] = [round(-ms * math.sin(rad), 3), round(-ms * math.cos(rad), 3)]
    good = sum(1 for c in cells if c)
    print(f"wind {good}/{len(cells)} cells", flush=True)
    return {"step": step, "values": cells}


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--step", type=float, default=5.0)
    ap.add_argument("--out", default=os.path.join("data", "field.json"))
    ap.add_argument("--check", action="store_true")
    ap.add_argument("--wind-only", action="store_true", help="add wind to an existing field.json")
    ap.add_argument("--wind-step", type=float, default=15.0)
    args = ap.parse_args()

    if args.check:
        with open(args.out) as f:
            j = json.load(f)
        vals = j["values"]
        bad = sum(1 for v in vals if not v or v[0] is None)
        good = len(vals) - bad
        print(f"{args.out}: {good}/{len(vals)} cells with PM2.5 ({100*good/len(vals):.1f}%)")
        print(f"generated_at={j['generated_at']} step={j['step']} {j['nx']}x{j['ny']}")
        return 0 if good > len(vals) * 0.5 else 1

    if args.wind_only:
        with open(args.out) as f:
            payload = json.load(f)
        payload["wind"] = build_wind(args.wind_step)
        with open(args.out, "w") as f:
            json.dump(payload, f, separators=(",", ":"))
        print(f"wrote {args.out} with wind ({os.path.getsize(args.out)/1024:.0f} KB)", flush=True)
        return 0

    lats, lons = build_points(args.step)
    nx, ny = len(lons), len(lats)
    total = nx * ny
    print(f"grid {nx} x {ny} = {total} points at {args.step} deg", flush=True)

    points = [(la, lo) for la in lats for lo in lons]
    cells = [None] * total
    stamp = None

    idx_of = {}
    for y, la in enumerate(lats):
        for x, lo in enumerate(lons):
            idx_of[(round(la, 1), round(lo, 1))] = y * nx + x

    chunks = [points[i : i + CHUNK] for i in range(0, total, CHUNK)]
    for n, chunk in enumerate(chunks, 1):
        print(f"  chunk {n}/{len(chunks)} ({len(chunk)} points)", flush=True)
        rows = fetch(chunk)
        if isinstance(rows, dict):
            raise RuntimeError(f"unexpected payload: {str(rows)[:200]}")

        for r in rows:
            cur = r.get("current") or {}
            key = (round(r["latitude"], 1), round(r["longitude"], 1))
            i = idx_of.get(key)
            if i is None:
                i = idx_of.get((round(r["latitude"]), round(r["longitude"])))
            if i is None:
                continue

            pm = cur.get("pm2_5")
            spd = cur.get("wind_speed_10m")
            deg = cur.get("wind_direction_10m")
            u = v = None
            if spd is not None and deg is not None:
                rad = math.radians(deg)
                # meteorological "from" direction -> flow vector, y = north
                u = round(-spd * math.sin(rad), 3)
                v = round(-spd * math.cos(rad), 3)
            cells[i] = [pm, u, v]
            if stamp is None and cur.get("time"):
                stamp = cur["time"]

        if n < len(chunks):
            time.sleep(GAP_SECONDS)

    good = sum(1 for c in cells if c and c[0] is not None)
    print(f"filled {good}/{total} cells ({100*good/total:.1f}%)", flush=True)

    print("fetching wind (forecast API, coarse grid) ...", flush=True)
    time.sleep(2)
    wind = build_wind(args.wind_step)

    payload = {
        "generated_at": stamp,
        "source": "Open-Meteo air quality (CAMS model output), 10m wind",
        "step": args.step,
        "nx": nx,
        "ny": ny,
        "lat0": LAT_MIN,
        "lon0": -180,
        "values": cells,
        "wind": wind,
    }

    os.makedirs(os.path.dirname(args.out) or ".", exist_ok=True)
    with open(args.out, "w") as f:
        json.dump(payload, f, separators=(",", ":"))
    print(f"wrote {args.out} ({os.path.getsize(args.out)/1024:.0f} KB)", flush=True)
    return 0


if __name__ == "__main__":
    sys.exit(main())
