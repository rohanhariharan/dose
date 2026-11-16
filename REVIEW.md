# Dose — a review

_Sunday 15 November 2026. Written against the submission build._

A local-first app for one person's ongoing treatment. Scan a label, check the directions it read,
turn them into a schedule, and see the month laid out. The review below is what the thing is now,
what it measures at, and where it still fails.

---

## 1. What it is

One sentence, the version that survives contact with a judge:

> Dose reads a medicine label, shows you the directions it found, and turns them into a calendar you
> can tick off — and it shows you the line of text behind every field, so a wrong read is caught in
> five seconds instead of a week.

That is not a reminder app with AI bolted on. The reader is the feature; the calendar is what makes
the reader's output checkable.

## 2. Who it's for

**Aditi, 34.** Eczema on her hands. A steroid ointment twice a day for three weeks, then once a day
for a week, then stop. She is not confused about the medicine; she is confused about *which week she
is in* — and she stops early because the rash looks better on day nine.

**Her father, 71.** Four tablets at three different times, and no patience for a phone app at the
kitchen counter at 7am.

Both are the reason the product looks the way it does: large type, one column, and a calendar that
answers "what is due today" without a menu in the way.

## 3. The flow, as built

| Screen | What it does |
|---|---|
| **Welcome** | one line, one button, three dots that say how long the setup is |
| **Name** | first name only, used to say it back on Today |
| **What you're keeping up with** | regimen *shapes* — skin, daily pills, inhaler, injections, drops — not a diagnosis list |
| **Scan** | live camera, a 360×480 frame, and a shutter that crops to exactly that frame |
| **Review** | the label text verbatim, then name, strength, kind, route, dose, frequency, duration and any taper phases — every field editable |
| **Schedule** | clock times per phase; a taper is a list of phases, each with its own days, dose and times |
| **Calendar** | the month, with the day's doses broken out; taken and skipped are recorded per dose |
| **Today** | a streamed two-line summary of the day, what is due now, what the week left unrecorded, and which courses run out this week |
| **Medicines / History** | what is on file, and what actually happened |
| **Buddy** | chat grounded in the medicines on file; streams, and can offer an action card |
| **Settings** | name, optional non-identifying context for Buddy, paper or night, copy today's schedule, export everything, a plain statement of what is sent, and a full reset |

As-needed medicines are listed and tracked without calendar events. A read that the parser is unsure
about is marked for review rather than saved quietly.

## 4. The reading

Two lanes, and the person chooses the second one:

1. **On this machine.** Apple's Vision framework through a small Swift CLI (`lab/labelocr.swift`),
   about 60 ms, no key, works offline. This is the default.
2. **Gemini, only if asked.** A checkbox on the scan screen — off by default — allows an uncertain
   read to send the photo out. The review screen says which lane produced the text.

The reader answers with a **kind drawn from twelve options** — tablet, capsule, inhaler, injection,
drops, cream, ointment, gel, liquid, patch, spray, other — so the app never renders a class it has no
rule for. Anything it cannot place is `other`.

Fields it cannot read stay **empty**. That is the central rule: a guessed dose is worse than a blank.

## 5. What the measurement says

Eight hand-annotated public labels (DailyMed and pharmacy-education examples), same saved Vision
reads for both columns, `lab/benchmark.py`:

| Measure | Regex baseline | Dose local reader |
|---|---:|---:|
| All five fields correct | 5/8 | 4/8 |
| Frequency correct | 6/8 | 6/8 |
| Duration correct | 7/8 | 5/8 |
| Dose amount correct | 8/8 | 6/8 |
| Route correct | 8/8 | 5/8 |
| As-needed correct | 8/8 | 8/8 |
| Missed fields | 1 | 10 |
| False alarms | 1 | **0** |

The honest reading of our own table:

- **A plain regex beats our parser** on duration, dose and route. It should: pharmacy directions are
  a small, regular language, and a well-written pattern is very good at them.
- **We never invented a value.** Zero false alarms against the baseline's one. For a medicine app the
  quiet failure — leave it blank, ask the person — is the right one, and it is why the review screen
  exists rather than a banner saying "saved".
- **The taper is where we lose.** The Medrol blister lays its schedule out as a diagram; we read the
  text and miss the shape.
- The pilot reported 3/8. Reader fixes took it to 4/8 on the same labels. The regex column did not
  move, because it was not the thing being fixed.

This is a small pilot on public English labels. It is not a clinical evaluation, and it does not
claim to be.

## 6. The design

- **Paper by default**, night available. This is used at 7am, not at a desk.
- **Libre Baskerville** for screen titles only; **Inter** for everything else. Bundled in the repo, so
  the app works with the network off.
- 420px column for anything you fill in; 560px for anything you read. 6px step dots, 24px card radius,
  12px inputs, 1px hairlines. Motion is short and directional: 28px slide between pages, 320ms, and
  nothing that a reduced-motion preference cannot switch off.
- The scan frame is a **hole**, not an overlay: its shadow dims everything outside it, so the camera
  is visible only where the label has to go. The shutter crops to that hole, un-doing the
  `object-fit: cover` transform first, so the reader sees exactly what the person framed.
- The dock is one floating pill with six places, and the add button sits clear of it — one control
  layer, two jobs.
- Three small dot-matrix motifs mark the moments someone is waiting: an empty shelf on the first
  Today, a beam while a label is being read, three cells while Buddy composes. They are the same
  grid and the same three colours as the welcome scene, and they are the only animation on screen.

## 7. Where it's weak

1. **The local reader loses to a regex** on three of five fields. Until that flips, the reader's value
   is the structure it produces and the blanks it refuses to fill, not raw accuracy.
2. **The camera was unavailable in the demo environment** (the browser profile had camera permission
   denied), so the recording shows the file path. The live path works — it was verified against a
   synthetic stream and the crop maths checked against the frame — but the video does not prove it.
3. **Nothing schedules.** Buddy can ask the browser for notification permission and fire a test
   notification; there is no scheduler behind it, and nothing fires when the app is closed.
4. **Storage is this browser, this origin.** No account and no sync — which is the point — but the
   same person on two machines has two apps. Export gives you the data back as a file; it does not
   put it anywhere else.
5. **As-needed medicines have no run-out maths.** A 200-actuation inhaler at 2 puffs twice a day is a
   50-day supply; today the app lists it and stops there.
6. **Tapers are manual.** The parser can propose phases, but the diagram case is unsolved and the
   person is doing the transcription.
7. **Buddy is a language model with the usual limits.** The guardrails are prompt-level: short
   answers, no diagnosis, urgent symptoms pushed to a human first. That is a good default, not a
   guarantee.
8. **Onboarding asks three questions before it does anything for you.** Each page earns its place in
   the flow, but the first is still a form.

## 8. What we'd do next

- **Measure the fused reader** — local first, Gemini when the local name is unsure — as a third column
  in the same table, because that is the pipeline the app actually ships.
- **A scheduler with catch-up.** Doses due while the app was closed should appear as missed on the
  next launch; a launchd agent can carry it beyond that.
- **Actuation maths** for inhalers, so "refill" means something other than a date.
- **A larger, unseen public test set**, and a second reader on the same labels to see whether the
  misses are ours or Vision's.

## 9. House rules we kept

- **In-app copy describes the product; the report describes the data path.** No screen claims that
  nothing leaves the machine, because one path can send a photo.
- **Every field shows its source line**, and an unread field is empty, never guessed.
- **Results are reported as measured**, including the ones where the baseline wins.
- *This project is a prototype and is not medical advice.*

---

Sources and the full write-up: [REPORT.md](REPORT.md) · reader and evaluation code: [`lab/`](lab/) ·
design notes for the build: this file.
