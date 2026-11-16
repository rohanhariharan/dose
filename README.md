# Dose

A local-first app for one person's ongoing treatment. Scan the label, confirm the directions, and see what's due on the calendar.

Built for the **AI + Health** track of the Veritas AI International High School Hackathon 2026.

> This project is a prototype and is not medical advice.

[Hackathon write-up and evaluation](REPORT.md) · [Demo video](design/dose-demo.mp4)

![Welcome](design/dose-1-welcome.jpg)

## Who it's for

Two people, both real. **Aditi, 34**, with eczema on her hands: a steroid ointment twice a day for
three weeks, then once a day for a week, then stop. She isn't confused about the medicine, she's
confused about *which week she is in* — and she stops early because the rash looks better on day
nine. **Her father, 71**: four tablets at three different times, and no patience for a phone app on
a kitchen counter at 7am.

The tool is designed around how they'd actually reach for it — at the counter, holding the box, five
seconds of patience.

## What's built

| Feature | State |
|---|---|
| Onboarding and Today | Saves the user's name and regimen preferences. Today shows due and upcoming doses and lets the user record taken or skipped doses |
| Label scan | Reads a camera capture or a JPG/PNG using the local reader. Manual entry is available |
| Schedule review | Shows the OCR directions and any recognized dose, route, frequency, and duration. The user chooses the clock times |
| Prescription calendar | Shows the day's schedule, supports multiple course phases, and saves taken/skipped records |
| As-needed medicines | Listed separately with no scheduled doses |
| Medicines and History | Shows schedules, taper phases, label text, and dose records |
| Settings | Change the profile name, review data use, or clear saved data |
| Buddy | Answers schedule questions and opens app screens when configured with Gemini |
| Background reminders and desktop packaging | Planned |

The profile, plans, and dose records are stored in `localStorage` for this browser and origin. Open **Settings → Start over** to clear all three.

## Run it

Use macOS with Xcode Command Line Tools, Python 3, and Node.js. The app was tested with Node.js 24.

In one terminal, compile Apple Vision's reader and start the loopback bridge.

```bash
cd lab
swiftc -O labelocr.swift -o labelocr
python3 serve.py
```

In a second terminal, start the app.

```bash
cd app
npm ci
npm run dev
```

Open [localhost:5181](http://localhost:5181). Add a medicine with the camera, choose a JPG or PNG, or enter the details manually. Use the same browser and URL to reopen saved plans.

## Design

The visual language is lifted from Typecode — the same serif, the same quiet geometry, the same page
flow. `REVIEW.md` has the numbers (420px column, 24px card radius, 6px dots at a 7px gap, 31px Libre
Baskerville at −0.015em) and an honest account of where this app is weak.

Two deliberate departures from that reference: **paper is the default theme** (this is used at 7am,
not at a desk — `data-theme="night"` switches it), and **body type is 14.5px** rather than 13.5px.

## The label reader

Apple Vision transcribes the image on the Mac. The parser in `lab/directions.py` proposes straightforward daily schedules and explicit taper phases. The user sees the directions and confirms the plan before any doses appear. Unknown fields stay blank.

When Gemini is configured and the user opts in for a scan, an uncertain local read may send the photo to Gemini. Set `GEMINI_API_KEY` on the bridge or in the ignored `lab/.env` file to enable that option. Buddy sends the conversation and medicine-plan context to Gemini when you ask it a question.

Reproduce the local evaluation from the saved OCR snapshots at the repo root.

```bash
python3 lab/benchmark.py
```

In the [original pilot](REPORT.md), the local reader matched all five annotated fields in **3/8** public examples. The plain regex baseline scored **5/8**. The demo and report describe the [pilot build](https://github.com/rohanhariharan/dose/tree/5196b49). After the reader fixes, it matched **4/8** on the same examples used for regression checks, with 10 missed fields and zero false alarms.

## Also in this repo

`plume/` is an earlier, retired climate prototype: a world map of PM2.5 with the wind field over it.
It has its own README. Kept for the record; not part of this submission.

## Credits

- **Libre Baskerville** and **Inter**, both SIL Open Font License, bundled in `app/public/fonts`.
- The dot-matrix renderer is adapted from Typecode's `PixelMatrix`.
- [Apple Vision](https://developer.apple.com/documentation/vision/recognizing-text-in-images) powers local OCR. [Gemini](https://ai.google.dev/gemini-api/docs) supports the optional cloud read and Buddy.
- The evaluation sources and coding-tool credits are in the [write-up](REPORT.md).
