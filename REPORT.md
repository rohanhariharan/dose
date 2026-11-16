# Dose

**AI + Health · Veritas AI International High School Hackathon 2026**

**Team:** Rohan Hariharan and Arnav Agrawal, Northview High School

> This project is a prototype and is not medical advice.

## The problem

A patient following a multi-week ointment taper may remember which medicine to use and still lose track of which week they are in. Dose is designed for the moment they pick up the box at home and want to check what their existing directions say is due today.

## What we built

Dose reads a medicine-label image, shows the directions it found, and asks the user to confirm the medicine and review the schedule. The user chooses the clock times and saves the plan to a month calendar. The calendar shows upcoming and due doses across course phases and records taken or skipped doses. As-needed medicines appear separately without calendar events. The profile, schedules, and dose records persist in browser storage.

## What we added

Our own idea. We connected a label reader to a reviewable schedule and a calendar that can show when one phase ends and the next starts.

## How it works

Apple Vision reads label text on a Mac. Dose looks for dosing directions, separates explicit phases, and leaves schedule fields blank when it cannot find an unambiguous instruction. The photo can be sent to Gemini for an uncertain local read when the user opts in. We evaluated only the local path, with Gemini disabled.

We hand-annotated eight public English-language images or crops from DailyMed and pharmacy-education examples. We compared the first matching regex for each field across the full OCR text with Dose's directions parser. Both used the same saved Vision reads. No model was trained, and the demo image was separate from the test cases. [Test cases and sources](lab/benchmark-labels.json) · [Scoring script](lab/benchmark.py)

## Results

| Measure | Regex baseline | Dose local |
| --- | ---: | ---: |
| Daily frequency correct | 6/8 | 6/8 |
| Duration correct | 7/8 | 5/8 |
| Dose amount correct | 8/8 | 5/8 |
| Route correct | 8/8 | 5/8 |
| As-needed status correct | 8/8 | 7/8 |
| All five fields correct on one label | 5/8 | 3/8 |
| Missed fields | 2 | 12 |
| False alarms | 1 | 0 |

A miss is a labeled field the reader did not recover correctly. A false alarm is a value the reader returned without matching a labeled field. A wrong nonblank value can count as both. Dose missed the course length on the Medrol blister because the taper was laid out as a diagram. The baseline turned the hydrocortisone label's maximum frequency into a fixed frequency. The pilot measured extraction fields and did not score complete taper schedules or clinical outcomes.

## What we'd do next

Read blister diagrams and multi-column directions, then compare the regex, local, and Gemini-assisted readers on a larger set of unseen public labels.

## Sources

[DailyMed](https://dailymed.nlm.nih.gov/dailymed/) · [APhA public label examples](https://apha.confex.com/apha/2018/mediafile/Handout/Paper405526/APHA%202018%20Handout.pdf#page=7) · [Iowa HHS HomeMeds example](https://hhs.iowa.gov/media/8517/download?inline=#page=9) · [SafeNetRx example](https://safenetrx.org/files/galleries/Labeling_Template_and_Instructions.pdf#page=1) · [Apple Vision](https://developer.apple.com/documentation/vision/recognizing-text-in-images) · [Gemini API](https://ai.google.dev/gemini-api/docs) · [OpenAI Codex](https://openai.com/codex/) was used for implementation, testing, and submission materials. The demo uses macOS text-to-speech for narration. [Design attributions](README.md#credits)
