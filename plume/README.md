# Plume — where is the air going?

A world map of PM2.5 with the wind field on top, built as the front end for the
hackathon project. The map is the easy part; the point is the two layers that
have to agree with each other: **where the pollution is** and **where it is
being pushed**.

```
plume/
├── index.html            the whole app (Leaflet + two canvases, no build step)
├── data/field.json       snapshot: 72 x 35 global grid + wind, 44 KB
└── tools/fetch_field.py  rebuilds that snapshot from the Open-Meteo APIs
```

## Run it

```bash
python3 -m http.server 8765
# open http://127.0.0.1:8765
```

Opening `index.html` directly with `file://` also works, but the browser blocks
the local `data/field.json` read, so it falls back to querying the API live at a
coarser 15° grid. Use the server if you want the good field.

## What is on screen

| Layer | Source | Resolution |
|---|---|---|
| PM2.5 fill | Open-Meteo **air quality** API (CAMS model output) | 5°, hourly |
| Wind arrows | Open-Meteo **forecast** API, 10 m wind | 15°, 15 min |
| Basemap | Esri World Dark Gray Canvas | tiles |

The fill is bilinearly interpolated and drawn at one third of screen
resolution, then scaled up and blurred, so a coarse grid reads as a continuous
plume instead of squares.

## Two things that cost time and will cost it again

**1. The air-quality API does not serve wind.** It accepts
`wind_speed_10m` and `wind_direction_10m` without complaint, then returns
`null` with units of `"undefined"`. Wind has to come from
`api.open-meteo.com/v1/forecast`. The weather API answers in **km/h**, so wind
components are divided by 3.6 before they mean m/s.

**2. Billing is per location, not per request.** A single HTTP request holding
500 coordinates costs 500 of the ~600 locations/minute the free tier allows.
That is why a 5° globe (2,520 points) cannot be fetched in one burst and why
this project ships a snapshot file instead of fetching per page load. The
script paces itself at 350 points per 62 seconds: about seven minutes.

Rejected basemaps: `basemaps.cartocdn.com/dark_all` is now key-gated and stamps
`API KEY REQUIRED` across every tile. Esri's canvas layers are still keyless.

## Refresh the data

```bash
python3 tools/fetch_field.py              # ~7 min, writes data/field.json
python3 tools/fetch_field.py --wind-only  # ~2 s, adds/replaces just the wind
python3 tools/fetch_field.py --check      # validate what is on disk
```

## `data/field.json` is the contract for the forecast model

```jsonc
{
  "generated_at": "2026-11-14T21:00",
  "step": 5, "nx": 72, "ny": 35, "lat0": -85, "lon0": -180,
  "values": [ [pm2_5, u, v], ... ],   // row-major, north to south, null where missing
  "wind": { "step": 15, "values": [ [u, v], ... ] }
}
```

When the CNN starts predicting, it should write **the same shape** with the
forecast hour as `generated_at`. Then the map needs no changes to show
tomorrow's plume: drop the file in and reload. Keeping the model output and the
observation in one format is what makes the before/after comparison in the demo
honest and trivial.

`u` and `v` are the flow vector in m/s (eastward, northward), already rotated
from the meteorological "direction the wind comes from".

## Caveats to keep in the write-up

- These are **CAMS model estimates**, not ground-station measurements. Nothing
  here is a compliance-grade reading, and a monitor in one city can disagree
  sharply with its grid cell.
- 5° cells are roughly 550 km across. This view shows continental-scale plume
  structure; it cannot say anything about a street or a neighbourhood.
- Gaps exist where the model has no value, mostly at the poles. Interpolation
  skips them rather than inventing a number.
