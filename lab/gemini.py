#!/usr/bin/env python3
"""Read a medicine label with Gemini, as a second opinion to the local pass.

    ./gemini.py samples/canister.jpg
    ./gemini.py --json samples/canister.jpg

The key is read from GEMINI_API_KEY, or from lab/.env, and is never sent to the
app: the frontend never sees it, and Tauri will read it from the environment (or
the macOS keychain) when it shells out. Nothing about this script prints it.

This is the cloud lane. It sees the photograph, so the app's copy has to say so;
see METHOD in the README before making this the default.
"""

import argparse
import base64
import json
import mimetypes
import os
import sys
import urllib.error
import urllib.request

HERE = os.path.dirname(os.path.abspath(__file__))
MODEL = os.environ.get("GEMINI_MODEL", "gemini-3.1-flash-lite")
ENDPOINT = "https://generativelanguage.googleapis.com/v1beta/models"

KINDS = [
    "tablet",
    "capsule",
    "inhaler",
    "injection",
    "drops",
    "cream",
    "ointment",
    "gel",
    "liquid",
    "patch",
    "spray",
    "other",
]

PROMPT = f"""You are reading a photograph of a medicine: a box, a pharmacy label or an inhaler.

Transcribe only what is printed. Never infer, complete or correct a dose that is not on the
label — a guessed dose is worse than a blank. If a field is absent from the photograph, leave
it empty and list its name in "missing".

"name" is the medicine as printed, without the strength or the dosage form.
"strength" is the amount per unit, e.g. "750 mg", "90 mcg/actuation".
"quantity_value"/"quantity_unit" is how much is in the pack, e.g. 200 inhalations, 21 tablets.
"doses_per_day" only when the label states a fixed number of doses per day; otherwise 0.
"duration_days" only when the label states a course length; otherwise 0.
"as_needed" is true for "as needed", "PRN", "when required".
"directions_text" is the directions line verbatim, or empty.
"confidence" is your own certainty in the name and strength, 0 to 1.

"form" must be exactly one of: {", ".join(KINDS)}. Judge it from the packaging: a pressurised
canister with a mouthpiece is an inhaler, a tube is a cream or an ointment, blister foil is a
tablet. Use "other" rather than guessing when the photograph does not show it."""

SCHEMA = {
    "type": "OBJECT",
    "properties": {
        "name": {"type": "STRING"},
        "strength": {"type": "STRING"},
        "form": {"type": "STRING", "enum": KINDS},
        "quantity_value": {"type": "INTEGER"},
        "quantity_unit": {"type": "STRING"},
        "doses_per_day": {"type": "INTEGER"},
        "duration_days": {"type": "INTEGER"},
        "as_needed": {"type": "BOOLEAN"},
        "directions_text": {"type": "STRING"},
        "missing": {"type": "ARRAY", "items": {"type": "STRING"}},
        "confidence": {"type": "NUMBER"},
    },
    "required": ["name", "strength", "form", "confidence"],
}


SYSTEM = """You are Buddy, the assistant inside Dose, a small app where one person keeps track of
the medicines they take.

How to answer:
- Warm, plain, short. Two or three sentences unless asked for more. No lists of caveats.
- You are not a clinician and you never pretend to be one. You do not diagnose, you do not tell
  anyone to stop, start or change a dose, and you do not interpret test results.
- If the person describes something urgent — chest pain, trouble breathing, swelling of the face
  or throat, a rash spreading fast, confusion, a fever in a small child — say plainly that this
  needs a person now: call emergency services or their doctor, and do not bury it in advice.
- Missing a dose, how to store something, what a medicine is usually for, whether it can be taken
  with food: answer those directly.
- If you are unsure, say so in one sentence and point them at their pharmacist or prescriber.
- Never mention that you are a language model or which company made you."""


def api_key():
    key = os.environ.get("GEMINI_API_KEY")
    if key:
        return key
    env = os.path.join(HERE, ".env")
    if os.path.exists(env):
        for line in open(env):
            if line.strip().startswith("GEMINI_API_KEY="):
                return line.split("=", 1)[1].strip()
    sys.exit("no GEMINI_API_KEY in the environment or lab/.env")


def encode(path):
    """Shrink before upload: a 1440px photo costs tokens and seconds, and 900px
    reads a label just as well. Falls back to the original if Pillow is absent."""
    try:
        import io

        from PIL import Image

        image = Image.open(path)
        image.thumbnail((1024, 1024))
        buffer = io.BytesIO()
        image.convert("RGB").save(buffer, "JPEG", quality=88)
        return base64.b64encode(buffer.getvalue()).decode(), "image/jpeg"
    except Exception:
        with open(path, "rb") as fh:
            return base64.b64encode(fh.read()).decode(), mimetypes.guess_type(path)[0] or "image/jpeg"


def read(path, model=MODEL):
    data, mime = encode(path)

    body = {
        "contents": [
            {
                "parts": [
                    {"text": PROMPT},
                    {"inline_data": {"mime_type": mime, "data": data}},
                ]
            }
        ],
        "generationConfig": {
            "responseMimeType": "application/json",
            "responseSchema": SCHEMA,
            "temperature": 0,
        },
    }

    # The key goes in a header, not the query string: URLs end up in proxy and
    # server logs, headers do not.
    req = urllib.request.Request(
        f"{ENDPOINT}/{model}:generateContent",
        data=json.dumps(body).encode(),
        headers={"Content-Type": "application/json", "x-goog-api-key": api_key()},
    )
    try:
        with urllib.request.urlopen(req, timeout=60) as response:
            payload = json.loads(response.read())
    except urllib.error.HTTPError as error:
        detail = error.read().decode(errors="replace")[:300]
        sys.exit(f"gemini HTTP {error.code}: {detail}")

    try:
        text = payload["candidates"][0]["content"]["parts"][0]["text"]
    except (KeyError, IndexError):
        sys.exit(f"unexpected response: {json.dumps(payload)[:300]}")

    raw = json.loads(text)
    return {
        "name": (raw.get("name") or "").strip(),
        "form": (raw.get("form") or "").strip().lower(),
        "strength": (raw.get("strength") or "").strip(),
        "quantity": raw.get("quantity_value") or None,
        "unit": (raw.get("quantity_unit") or "").strip() or None,
        "perDay": raw.get("doses_per_day") or None,
        "durationDays": raw.get("duration_days") or None,
        "prn": bool(raw.get("as_needed")),
        "directions": (raw.get("directions_text") or "").strip(),
        "confidence": round(float(raw.get("confidence") or 0), 2),
        "missing": raw.get("missing") or [],
        "source": f"gemini:{MODEL}",
    }


def chat(messages, context=""):
    """A reply from Buddy. `messages` is [{"role": "user"|"model", "text": ...}]."""
    system = SYSTEM
    if context:
        system += "\n\nWhat they have on file right now (use it if it helps, do not recite it):\n" + context

    body = {
        "systemInstruction": {"parts": [{"text": system}]},
        "contents": [
            {"role": m["role"], "parts": [{"text": m["text"]}]}
            for m in messages
            if m.get("text")
        ],
        "generationConfig": {"temperature": 0.4, "maxOutputTokens": 400},
    }
    req = urllib.request.Request(
        f"{ENDPOINT}/{MODEL}:generateContent",
        data=json.dumps(body).encode(),
        headers={"Content-Type": "application/json", "x-goog-api-key": api_key()},
    )
    try:
        with urllib.request.urlopen(req, timeout=60) as response:
            payload = json.loads(response.read())
    except urllib.error.HTTPError as error:
        detail = error.read().decode(errors="replace")[:200]
        raise RuntimeError(f"gemini HTTP {error.code}: {detail}") from None

    try:
        return payload["candidates"][0]["content"]["parts"][0]["text"].strip()
    except (KeyError, IndexError):
        raise RuntimeError("gemini returned no text") from None


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("image")
    ap.add_argument("--json", action="store_true")
    ap.add_argument("--model", default=MODEL)
    args = ap.parse_args()

    result = read(args.image, args.model)
    if args.json:
        print(json.dumps(result, indent=2, ensure_ascii=False))
        return 0

    print(f"name      {result['name'] or '—'}")
    print(f"form      {result['form'] or '—'}")
    print(f"strength  {result['strength'] or '—'}")
    print(f"quantity  {result['quantity'] or '—'} {result['unit'] or ''}")
    print(f"per day   {result['perDay'] or '—'}")
    print(f"duration  {result['durationDays'] or '—'} days")
    print(f"prn       {'yes' if result['prn'] else 'no'}")
    print(f"conf      {result['confidence']}")
    print(f"missing   {', '.join(result['missing']) or 'nothing'}")
    if result["directions"]:
        print(f"directions  {result['directions']}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
