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

from directions import direction_block, parse_directions

HERE = os.path.dirname(os.path.abspath(__file__))
OCR = os.path.join(HERE, "labelocr")

# Lines that are never the medicine name.
NOISE = re.compile(
    r"(ndc|rx only|net contents|shake|before use|keep out|store at|store below|"
    r"rinse|do not|warning|lot|exp|made in|distributed|manufactured|"
    r"^[0-9\s\-./]+$|^\W+$)",
    re.IGNORECASE,
)

# The closed set the app knows. A label that names none of these is "other".
FORMS = [
    ("metered dose", "inhaler"),
    ("inhalation aerosol", "inhaler"),
    ("inhaler", "inhaler"),
    ("aerosol", "inhaler"),
    ("actuation", "inhaler"),
    ("tablet", "tablet"),
    ("capsule", "capsule"),
    ("softgel", "capsule"),
    ("syrup", "liquid"),
    ("suspension", "liquid"),
    ("elixir", "liquid"),
    ("solution", "liquid"),
    ("liquid", "liquid"),
    ("ointment", "ointment"),
    ("cream", "cream"),
    ("gel", "gel"),
    ("eye drop", "drops"),
    ("ear drop", "drops"),
    ("drops", "drops"),
    ("injection", "injection"),
    ("injectable", "injection"),
    ("syringe", "injection"),
    ("vial", "injection"),
    ("patch", "patch"),
    ("spray", "spray"),
]

STRENGTH = re.compile(
    r"(\d+(?:[.,]\d+)?)\s*(mcg\b|µg\b|ug\b|mg\b|g\b|ml\b|%)(?:\s*/\s*(?:dose|actuation|puff|spray))?",
    re.IGNORECASE,
)

QUANTITY = re.compile(
    r"(\d+)\s*(?:metered\s+)?(inhalations?|actuations?|puffs?|tablets?|tabs?|capsules?|caps?|doses?|ml)\b",
    re.IGNORECASE,
)

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
            # A big drop in type size ends the name: the generic line under
            # a brand is set smaller and is not part of the name.
            similar = 0.78 < line["h"] / prev["h"] < 1.3
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
    directions = direction_block(line["text"] for line in lines)
    direction_lines = set(directions.lower().splitlines())

    # Name: the block, with any form phrase removed and the rest kept.
    word_lines = [
        line for line in lines
        if not NOISE.search(line["text"].strip())
        and line["text"].strip().lstrip("•▪■–- ").lower() not in direction_lines
    ]
    raw_name, name_conf = pick_name(word_lines)
    name = raw_name
    if raw_name:
        evidence["name"] = raw_name
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
    form = form or "other"

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

    instructions = parse_directions(directions)
    for field in ("perDay", "durationDays", "prn"):
        if instructions[field]:
            evidence[field] = instructions["directions"]
    for field in ("dose", "route"):
        if instructions[field]:
            evidence[field] = instructions[field]

    missing = [
        field
        for field, value in (
            ("name", name),
            ("strength", strength),
            ("quantity", quantity),
            ("dose", instructions["dose"]),
            ("route", instructions["route"]),
            ("perDay", instructions["perDay"]),
            ("durationDays", instructions["durationDays"]),
        )
        if not value
    ]

    # Vision's own confidence, averaged over the block the field came from.
    confidence["name"] = round(name_conf, 2)
    confidence["ocr"] = round(statistics.mean([l["conf"] for l in lines] or [0]), 2)

    return {
        "name": name,
        "form": form,
        "strength": strength,
        "quantity": quantity,
        "unit": unit,
        **instructions,
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
