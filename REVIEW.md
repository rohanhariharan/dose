# Dose — what our app is

_Written Sat 14 Nov 2026, 17:00 ET, before any code. Track: **AI + Health**. Name is a placeholder._

A local-first desktop app for one person's ongoing treatment. You tell it your name, tell it what
you're managing, and it keeps the day's doses in front of you — a pill at 8am, an ointment twice a
day for three weeks, an inhaler that isn't scheduled at all because it's "as needed".

The design is lifted from Typecode: same serif, same quiet geometry, same two-dot page flow as its
sign-in. The difference is what's in the middle of the screen — a schedule that has to be right,
for someone who is 71 and in a hurry.

---

## 1. Who it's for

Two people, both real, both reachable tonight:

**Aditi, 34.** Eczema on her hands. A steroid ointment twice a day for three weeks, then once a
day for a week, then stop. She is not confused about the medicine; she is confused about *which
week she is in*. She stops early because the rash looks better on day nine, and the tube says
nothing about a taper because the taper is on the pharmacy label, which is on a box, in a drawer.

**Her father, 71.** Four tablets, two of them at breakfast, one at lunch, one at night. He does not
use a phone app. He would use something that is already open on the kitchen iMac and says, in
large type, what is due now.

The user is one of these two. The tool is designed around how they'd actually reach for it — at the
kitchen counter, holding the box, five seconds of patience.

## 2. The flow

Four screens, three of them onboarding. Each one has to earn its place or it gets cut.

| # | Screen | What it asks | What it earns |
|---|---|---|---|
| 1 | Welcome | nothing | sets the tone; one button |
| 2 | Your name | first name | the home screen can say it back |
| 3 | What you're managing | pick from six regimen shapes | pre-loads the right schedule shape |
| 4 | Home | nothing | today's doses, done/total, add medicine |

**Screen 1 — Welcome** (Typecode's welcome modal, recycled)
Pixel scene on top at 2:1, then: serif title, one line, one full-width primary.

> **Welcome to Dose**
> Everything you take, in one quiet place. Nothing leaves this computer.
> `[ Get started ]`

**Screen 2 — Your name.** The two-dot page flow from Typecode's sign-in.

> **What should we call you?**
> It only ever appears on this screen. You can change it later.
> `First name` · `[ Continue ]` · *Skip*

**Screen 3 — What you're managing.** Chips, not a disease list (see §5.1).

> **What are you keeping up with?**
> Pick what's true. You can add more later.
> `Skin — cream or ointment` `Daily pills` `Inhaler` `Injections` `Eye drops` `Something else`
> `[ Continue ]`

**Screen 4 — Home.**

> Good evening, Aditi · **1 of 2 done**
> 20:00 · Betamethasone 0.1% · ointment · thin layer, hands — `[ Taken ]`
> 22:00 · Atorvastatin 20 mg · tablet — `[ Taken ]`
> `+ Add a medicine`
> _Prototype. Not medical advice._

Empty state: *"Nothing scheduled yet. Photograph the box and we'll read the label."*

Then, off the main path: **Add medicine** → photo or type → the fields we extracted, editable →
confirm → the schedule lands on Home.

## 3. What we take from Typecode, exactly

Screenshots of the two reference screens are in `design/` (`typecode-onboarding.jpg`,
`typecode-signin.jpg`). The numbers below are from `~/dot/desktop/src`.

**Tokens** — `theme.css` lines 205–245, copy wholesale:

| Token | Value | Use |
|---|---|---|
| `--bg` / `--bg-2` | `#1b1c1f` / `#222429` | canvas / raised surfaces |
| `--ink` / `--muted` / `--faint` | `#eef1f6` / `#9aa4b4` / `#616b7c` | text hierarchy |
| `--hair` / `--hair-2` | `rgba(255,255,255,.08)` / `.14` | dividers, focus ring |
| `--radius` | `20px` | cards; modals `24px`; inputs `10px` |
| `--font-accent` | Libre Baskerville 400 | every screen title |
| `--font-sans` | Inter | everything else |
| `--primary-bg` | `linear-gradient(180deg,#f4f7fc,#cfd6e2)` | primary button on dark |

Fonts are in `~/dot/desktop/public/fonts/` (Libre Baskerville 400/400i/700, Inter variable, Plex
Mono). Copy the folder; do not load from a CDN — the app should work with the network off.

**Page flow** — `styles.css` `.login` block (≈4811–4905). This is the whole mechanic, and it is
already the three-page onboarding we want:

- full-cover field, one column, `width: min(420px, calc(100% - 40px))`, no dividers;
- two 6px dots, gap 7px, 34px below them; the active one at full opacity, the other at `.18`;
- title 34px serif, `-0.028em`, centred; lede 13px `--muted`, `max-width: 34ch`;
- form `margin-top: 28px`, `gap: 8px`; label 11px `--faint`; input `padding: 12px 14px`, radius 10,
  `--bg-2`, focus ring `0 0 0 2px var(--hair-2)`;
- page transition `translateX(28px) → 0`, 340ms, `cubic-bezier(.32,.72,.28,1)`.

**Modal** — `.onboarding-modal` (≈3459–3518): 420px wide, radius 24, art at `aspect-ratio: 2/1`
with a hairline bottom border, copy `26px 30px 28px`, gap 11, h2 31px serif, body 13.5px/1.6 capped
at 40ch, entrance `translateY(10px) scale(.985)` at 320ms.

**Pixel art** — `PixelMatrix.tsx` renders any 96×48 `draw()` into a dotted grid; `WelcomeMatrix.tsx`
is one scene for it. Reuse the canvas, draw a new scene: a shelf, a tube, a glass of water, Pip out
of the picture. It costs an hour and it is the thing that makes the app look like it belongs to the
same family.

## 4. Where we must not copy it

Typecode is a developer console. It is dark, dense, and comfortable at 13px for someone at a desk.
This app is used at 7am by someone half awake, possibly with glasses on the nightstand.

- **Default to the light "paper" theme**, not dark. Use dark as the option, not the default.
- **Body at 15–16px, rows at 44px minimum.** The sign-in type scale is a reference, not a floor.
- **Never `--faint` for anything the user must read.** `#616b7c` on `#1b1c1f` is about 2.8:1. It is
  fine for a label under an input in a settings panel; it is not fine for "take with food".
- Keep the serif for screen titles only. A dose row set in Libre Baskerville is unreadable at 8am.

## 5. The honest review — where this app is weak

**5.1 "Which diseases do you have?" is the wrong question.** It is the most sensitive data you
will ever ask for, demanded before the app has done one useful thing, and it doesn't determine the
schedule anyway: eczema can mean two ointments and a tablet. It also invites self-diagnosis. Ask for
the *shape of the regimen* instead — skin, daily pills, inhaler, injections — which is answerable
in five seconds and maps 1:1 onto the scheduler. Conditions, if we keep them, are a tag that only
changes the wording on Home.

**5.2 Three screens before value is two too many.** Judges will click through this in twenty
seconds. Name earns its page only if Home says it back; the regimen page earns its page only if the
next screen is already shaped by it. If either becomes decoration, cut it.

**5.3 The hard part is delivery, not layout.** A Tauri app needs the notification plugin and a
granted permission to fire anything while closed. Build the in-app "due now" list first and give the
demo a *Fire now* control; do not plan a demo that waits three hours for a reminder to arrive.

**5.4 "Adherence AI" is unprovable in 48 hours.** You cannot learn one person's forgetting pattern
without weeks of logs, and the brief is explicit that weak results reported honestly beat good
results that don't add up. Any per-user timing model is a *next steps* slide, not a claim.

**5.5 Topicals are where every reminder app breaks, which is the opportunity.** Twice-daily on a
rash that visibly heals invites early stopping. Tapers ("once daily after day 14"). "Apply to
affected areas" is not a dose. "As needed" has no schedule at all. Nobody's app handles this well,
and Aditi's tube is the proof. Take that seriously and the project has a real thesis.

**5.6 The reminder shell is not the project.** Rule 2: a normal app built with AI coding tools
"doesn't count on its own". Onboarding plus notifications is the stage. The judged thing has to be
the model in §6.

## 6. The AI, or this doesn't qualify

**Recommended: label → schedule extraction.** Photograph the box; get back frequency, dose,
duration, route, and any taper, quoted against the label text. It works on day one, it needs no
user history, and it is measurable this weekend.

- **Test set:** 40–60 real medicines and tubes from our own kitchens and a family member's
  pillbox, photographed on a phone under kitchen light. Not synthetic.
- **Baseline:** regex for `once|twice|three times` + numbers, plus a catalogue lookup by name.
  This baseline will look strong on English labels — which is exactly why it's the right baseline.
- **Measure:** field-level accuracy (frequency, dose, duration, route), reported separately, and
  end-to-end "schedule correct" as the headline.
- **Where it will fail, before we even run it:** non-English or bilingual labels; "apply sparingly";
  tapers written as prose; the dose printed only on the inner leaflet; blurry photos. Every one of
  those is a slide in the write-up, and the brief asks for exactly that.

This also produces the demo: a real tube on a real table, a ten-second result, and the label text
underneath so nobody has to trust us.

*Rejected:* ailment → regimen lookup (a lookup wearing a model's coat, and wrong in ways that
matter); risk-timed reminders (honest but unmeasurable in this window).

## 7. Data, and where it lives

Everything local, in `appDataDir/dose.json`. No account — which is both the Typecode stance and the
right call for health data under the brief's rule 5.

```jsonc
profile    { name, createdAt }
regimen    { id, label, kind: "skin" | "pill" | "inhaler" | "other" }
medicine   { id, name, strength, form, regimenId?, schedule: { times[], days, taper? },
             source: "label" | "manual", labelText? }
doseEvent  { medicineId, dueAt, takenAt|null, skipped }
```

## 8. Build order (from now, 31 hours to the deadline)

| When | What |
|---|---|
| Sat 17:00–20:00 | Tauri shell, tokens + fonts, four screens with hard-coded data |
| Sat 20:00–23:00 | Add-medicine path; label parsing on the first 20 products collected |
| Sun 09:00–12:00 | Scheduler (incl. one taper), due list, local notification + *Fire now* |
| Sun 12:00–15:00 | Evaluation: baseline vs model per field, five failure cases written up |
| Sun 15:00–18:00 | Write-up, 2-minute video, Colab/GitHub link, submission |
| Sun 18:00–23:59 | Buffer. Submit a complete version by 18:00 regardless. |

## 9. Not doing

No accounts, no cloud sync, no sharing with a clinician, no refill prediction, no dosage advice,
no drug-interaction checking (that's a different, riskier product), no iOS build.

---

**Sources for the design:** `~/dot/desktop/src/theme.css` (tokens, fonts),
`styles.css` `.login` and `.onboarding-*`, `components/Onboarding.tsx`,
`components/WelcomeMatrix.tsx`, `components/PixelMatrix.tsx`,
`~/dot/design/typecode/brand-kit.md` (voice: concrete over cosmic).
