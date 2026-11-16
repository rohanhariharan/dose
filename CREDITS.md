# Credits

Everything this project uses, with links: datasets, pretrained models, libraries, assets,
and the AI tools we worked with.

**Dose** — AI + Health track, Veritas AI International High School Hackathon 2026.
Rohan Hariharan and Arnav Agrawal, Northview High School.

---

## Datasets and label images

Used for evaluation only. We do **not** redistribute the photographs: `lab/benchmark-labels.json`
holds the text Apple Vision produced from each image plus our hand annotations, and the links let
anyone re-fetch the originals and re-run `lab/benchmark.py`.

| Source | Used for | Link |
|---|---|---|
| DailyMed (U.S. National Library of Medicine) | 4 of 8 evaluation labels — omeprazole carton, omeprazole foil, hydrocortisone cream, Medrol blister | https://dailymed.nlm.nih.gov/dailymed/ |
| APhA 2018 handout, public sample labels | 2 labels — metoprolol, metformin | https://apha.confex.com/apha/2018/mediafile/Handout/Paper405526/APHA%202018%20Handout.pdf#page=7 |
| Iowa HHS, HomeMeds label example | 1 label — albuterol inhaler | https://hhs.iowa.gov/media/8517/download?inline=#page=9 |
| SafeNetRx, labeling template and instructions | 1 label — buspirone | https://safenetrx.org/files/galleries/Labeling_Template_and_Instructions.pdf#page=1 |

No dataset was used to train or fine-tune anything. There is no training set; the eight labels are a
held-out evaluation set only.

## Pretrained models and hosted services

| Model | Role | Link |
|---|---|---|
| Apple Vision, `VNRecognizeTextRequest` | On-device OCR — the primary reader lane, no network | https://developer.apple.com/documentation/vision/recognizing-text-in-images |
| Google Gemini, `gemini-3.1-flash-lite` | Opt-in second lane when the local read is uncertain (confidence < 0.7); also Buddy's replies and the daily summary | https://ai.google.dev/gemini-api/docs |

Gemini is only called when the person ticks the box on the scan screen, or asks Buddy something, or
opens Today with the reader running. The API key lives in the git-ignored `lab/.env`; it is not in this
repository and never reaches the browser.

## Libraries

Python: the reader is standard library only — no `pip install` anywhere in `lab/`.

| Library | Version | License | Link |
|---|---|---|---|
| React / React DOM | 19.2 | MIT | https://react.dev |
| Vite | 8.3 | MIT | https://vite.dev |
| TypeScript | 6.0 | Apache-2.0 | https://www.typescriptlang.org |
| @vitejs/plugin-react | 6.1 | MIT | https://github.com/vitejs/vite-plugin-react |

Build and hosting: GitHub Actions and GitHub Pages, on the repository's own workflows
(`.github/workflows/ci.yml`, `pages.yml`).

## Assets

| Asset | License / origin | Where |
|---|---|---|
| Libre Baskerville | SIL Open Font License 1.1, © 2012 The Libre Baskerville Project Authors | `app/src/assets/fonts/`, license in `OFL-libre-baskerville.txt` |
| Inter | SIL Open Font License 1.1, © 2020 The Inter Project Authors | `app/src/assets/fonts/`, license in `OFL-inter.txt` |
| Icons | Drawn for this project in `app/src/icons.tsx`; no icon library | `app/src/icons.tsx` |
| Dot-matrix renderer | Written for this project, adapted from an earlier desktop app of ours. No third-party application code is included in this repository | `app/src/PixelCanvas.tsx`, `PixelScene.tsx` |
| Screenshots in `design/` | Taken from our own build; they show no real person's data | `design/` |
| Narration | macOS `say` text-to-speech | `design/dose-demo.mp4` |
| Video encoding | FFmpeg / libx264 | `design/dose-demo.mp4` |

## AI tools

| Tool | Used for | Link |
|---|---|---|
| OpenAI Codex | Implementation, testing, and the written submission materials | https://openai.com/codex/ |
| opencode | Agent harness used to review, test and ship the app — build checks, browser testing, CI and deployment (DeepSeek-V4.1-Flash model) | https://opencode.ai |
| Google Gemini API | Runtime only: the opt-in cloud read, Buddy, and the daily summary. Not used to write the code | https://ai.google.dev/gemini-api/docs |
| Apple Vision | Runtime only: local OCR | https://developer.apple.com/documentation/vision/recognizing-text-in-images |

Every AI-assisted change was read, tested in a browser, and committed by a team member; the label
reader's numbers in `REPORT.md` come from `lab/benchmark.py`, not from a model's summary of itself.

## Tutorials and references

No tutorial was followed line by line. The references that shaped the work:

- Apple, *Recognizing text in images* — the Vision request used by `lab/labelocr.swift`.
  https://developer.apple.com/documentation/vision/recognizing-text-in-images
- Apple, *AVCaptureSession* / camera capture on the web via `getUserMedia` —
  https://developer.mozilla.org/en-US/docs/Web/API/MediaDevices/getUserMedia
- Google, *Gemini API — text generation and streaming* — https://ai.google.dev/gemini-api/docs
- U.S. National Library of Medicine, DailyMed — prescription label conventions and image sets.
  https://dailymed.nlm.nih.gov/dailymed/
- MDN, *Server-sent events* — the streaming shape used by Buddy and the daily summary.
  https://developer.mozilla.org/en-US/docs/Web/API/Server-sent_events

## What this project does not use

- No third-party medical dataset, and no training or fine-tuning of any model.
- No analytics, tracking, advertising or crash-reporting SDK.
- No user accounts; nothing is sent anywhere unless the reader is running locally or the person opts
  into a cloud read.

If you believe something here is missing or misattributed, please open an issue on the repository.
