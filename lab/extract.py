#!/usr/bin/env python3
"""Turn a label photograph into the fields the app needs.

    ./extract.py samples/canister.jpg
    ./extract.py --json samples/canister.jpg

Runs the local Vision shim (labelocr) first, then parses its lines. Nothing
leaves the machine. Every field carries the line it came from, so the confirm
screen can show people why it thinks what it thinks — and so a field that
cannot be read stays empty instead of being guessed.

Output:
    {"name", "form", "strength", "quantity", "unit", "perDay", "durationDays",
     "prn", "ndc", "evidence": {...}, "missing": [...], "confidence": {...},
     "lines": [...]}
"""

import argparse
import json
import os
import re
import statistics
import subprocess
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
OCR = os.path.join(HERE, "labelocr")

# Lines that are never the medicine name.
NOISE = re.compile(
    r"(ndc|rx only|net contents|shake|before use|keep out|store at|store below|"
    r"rinse|do not|warning|lot|exp|made in|distributed|manufactured|"
    r"^[0-9\s\-./]+$|^\W+$)",
    re.IGNORECASE,
)

FORMS = [
    ("inhalation aerosol", "inhaler"),
    ("aerosol", "inhaler"),
    ("inhaler", "inhaler"),
    ("actuation", "inhaler"),
    ("tablet", "tablet"),
    ("capsule", "capsule"),
    ("syrup", "syrup"),
    ("suspension", "suspension"),
    ("cream", "cream"),
    ("ointment", "ointment"),
    ("drops", "drops"),
    ("gel", "gel"),
]

STRENGTH = re.compile(
    r"(\d+(?:[.,]\d+)?)\s*(mcg|µg|ug|mg|g|ml|%)\b(?:\s*/\s*(?:dose|actuation|puff|spray))?",
    re.IGNORECASE,
)

QUANTITY = re.compile(
    r"(\d+)\s*(?:metered\s+)?(inhalations?|actuations?|puffs?|tablets?|tabs?|capsules?|caps?|doses?|ml)\b",
    re.IGNORECASE,
)

PER_DAY = [
    (re.compile(r"\b(?:four|4)\s+times\s+(?:a|per)\s+day", re.I), 4),
    (re.compile(r"\b(?:three|3)\s+times\s+(?:a|per)\s+day", re.I), 3),
    (re.compile(r"\b(?:twice|two|2)\s+(?:times\s+)?(?:a|per)\s+day|\b(?:twice|two)\s+daily\b", re.I), 2),
    (re.compile(r"\bonce\s+(?:a|per)\s+day|\bdaily\b|\bevery\s+day\b", re.I), 1),
    (re.compile(r"\b(?:bid|bd)\b", re.I), 2),
    (re.compile(r"\b(?:tid|tds)\b", re.I), 3),
    (re.compile(r"\b(?:qid|qds)\b", re.I), 4),
]

DURATION = re.compile(r"\bfor\s+(\d+)\s*(day|days|week|weeks)\b", re.I)
PRN = re.compile(r"\bas\s+needed\b|\bprn\b|\bwhen\s+required\b", re.I)


def ocr(path):
    if not os.path.exists(OCR):
        sys.exit("labelocr is missing — run: swiftc -O labelocr.swift -o labelocr")
    done = subprocess.run([OCR, path], capture_output=True, text=True)
    if done.returncode != 0:
        sys.exit(done.stderr.strip() or "labelocr failed")
    return json.loads(done.stdout)


def letters(text):
    return sum(ch.isalpha() for ch in text) / max(1, len(text.replace(" ", "")))


def nameish(line):
    text = line["text"].strip()
    return text and letters(text) >= 0.55


def runs(lines):
    """Maximal runs of word-like lines printed one above the other.

    Vision merges boxes, so geometry alone over-joins. A run breaks on a jump
    in type size, a column shift, or a line that is mostly digits — which is
    what separates a two-line drug name from the quantity underneath it."""
    out = []
    for line in lines:
        if out:
            last = out[-1]
            prev = last[-1]
            step = line["y"] - prev["y"]
            same_column = abs(line["x"] - prev["x"]) < 0.09
            steady = 0 < step < 2.2 * prev["h"]
            similar = 0.6 < line["h"] / prev["h"] < 1.7
            if nameish(line) and same_column and steady and similar:
                last.append(line)
                continue
        out.append([line])
    return [g for g in out if nameish(g[0])]


def pick_name(lines):
    """The tallest run of words in the upper part of the label: a label names
    the drug in the largest type it has."""
    best = None
    for group in runs(lines):
        text = " ".join(l["text"] for l in group).strip()
        top = min(l["y"] for l in group)
        if top > 0.85:
            continue
        height = max(l["h"] for l in group)
        if best is None or height > best[0]:
            best = (height, text, min(l["conf"] for l in group))
    return (best[1], best[2]) if best else ("", 0)


def parse(page):
    lines = page["lines"]
    text = " ".join(l["text"] for l in lines)
    flat = re.sub(r"\s+", " ", text)

    evidence = {}
    confidence = {}

    # Name: the block, with any form phrase removed and the rest kept.
    word_lines = [l for l in lines if not NOISE.search(l["text"].strip())]
    raw_name, name_conf = pick_name(word_lines)
    name = raw_name
    form = None
    for word, kind in FORMS:
        if word in raw_name.lower():
            form = kind
            cut = raw_name.lower().index(word)
            name = raw_name[:cut].strip(" ,.-—")
            evidence["form"] = raw_name[cut:].strip()
            break
    if not form:
        for word, kind in FORMS:
            if word in flat.lower():
                form = kind
                evidence["form"] = word
                break

    name = re.sub(r"\s+\d+\s*(mcg|mg|g|ml|%)$", "", name, flags=re.I).strip()

    # Strength — but never the net weight of the canister.
    strength = None
    for match in STRENGTH.finditer(flat):
        tail = flat[match.end() : match.end() + 14].lower()
        if tail.startswith(" net") or "net contents" in tail:
            continue
        strength = f"{match.group(1)} {match.group(2).lower()}"
        evidence["strength"] = flat[max(0, match.start() - 20) : match.end() + 8].strip()
        break

    # Quantity, which is what a refill is actually counted in.
    quantity = unit = None
    qty = re.search(r"\bqty[:.]?\s*(\d+)", flat, re.I)
    if qty:
        quantity = int(qty.group(1))
        unit = None
        evidence["quantity"] = qty.group(0)
    for match in ([] if quantity else QUANTITY.finditer(flat)):
        quantity = int(match.group(1))
        unit = match.group(2).lower().rstrip("s")
        evidence["quantity"] = match.group(0)
        break

    ndc = None
    ndc_match = re.search(r"NDC\s*([0-9]{3,5}-[0-9]{3,4}-[0-9]{1,2})", flat, re.I)
    if ndc_match:
        ndc = ndc_match.group(1)
        evidence["ndc"] = ndc_match.group(0)

    per_day = None
    for pattern, count in PER_DAY:
        if pattern.search(flat):
            per_day = count
            evidence["perDay"] = pattern.search(flat).group(0)
            break

    duration = None
    duration_match = DURATION.search(flat)
    if duration_match:
        n = int(duration_match.group(1))
        duration = n * 7 if duration_match.group(2).lower().startswith("week") else n
        evidence["durationDays"] = duration_match.group(0)

    prn = bool(PRN.search(flat))
    if prn:
        evidence["prn"] = "as needed"

    missing = [
        field
        for field, value in (
            ("name", name),
            ("strength", strength),
            ("quantity", quantity),
            ("perDay", per_day),
            ("durationDays", duration),
        )
        if not value
    ]

    # Vision's own confidence, averaged over the block the field came from.
    by_text = {l["text"].strip(): l["conf"] for l in lines}
    confidence["name"] = round(name_conf, 2)
    confidence["ocr"] = round(statistics.mean([l["conf"] for l in lines] or [0]), 2)

    return {
        "name": name,
        "form": form,
        "strength": strength,
        "quantity": quantity,
        "unit": unit,
        "perDay": per_day,
        "durationDays": duration,
        "prn": prn,
        "ndc": ndc,
        "evidence": evidence,
        "missing": missing,
        "confidence": confidence,
        "lines": [l["text"] for l in lines],
    }


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("image")
    ap.add_argument("--json", action="store_true", help="print the whole object")
    args = ap.parse_args()

    result = parse(ocr(args.image))

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
    print(f"missing   {', '.join(result['missing']) or 'nothing'}")
    print("evidence")
    for key, value in result["evidence"].items():
        print(f"  {key:16} {value}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
