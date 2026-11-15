"""Extract only the dosing instructions that the label actually states."""

import re


VERB = r"(?:take|swallow|apply|inhale|instill|inject|insert|place|use)"
LEAD = re.compile(rf"^(?:directions\s*:?\s+)?{VERB}\b", re.I)
CONTINUATION = re.compile(
    r"^(?:by mouth|mouth\b|orally|topically|into|on the|to the|for\b|then\b|followed by\b|"
    r"per day\b|a day\b|in the morning\b|at bedtime\b|with (?:a glass of )?water\b|"
    r"once\b|twice\b|daily\b|every\b|as needed\b|when required\b|"
    r"(?:one|two|three|four|\d+)\s+times\b)", re.I,
)
NUMBERS = {word: i for i, word in enumerate(
    "zero one two three four five six seven eight nine ten eleven twelve".split()
)}
NUMBER = r"(?:\d+|" + "|".join(NUMBERS) + ")"
FREQUENCY = re.compile(
    rf"\b(?:(?P<count>once|twice|{NUMBER}\s+times)\s+(?:daily|(?:a|per|each)\s+day)|"
    r"(?P<daily>daily|every day|once a day)|(?P<abbrev>bid|tid|qid))\b", re.I,
)
DURATION = re.compile(rf"\bfor\s+({NUMBER})\s+(days?|weeks?)\b", re.I)
PRN = re.compile(r"\b(?:as needed|when required|prn)\b", re.I)
ROUTE = re.compile(
    r"\b(?:by mouth|orally|topically|subcutaneously|intramuscularly|"
    r"(?:in|into)\s+(?:the|each|both|left|right)\s+(?:eyes?|ears?|nostrils?))\b", re.I,
)
DOSE = re.compile(
    rf"\b{VERB}\s+((?:a thin layer|{NUMBER}(?:[./]\d+)?\s*"
    r"(?:tablets?|capsules?|drops?|puffs?|sprays?|units?|mcg|mg|mL|g)))\b(?!\s*(?:/|or\b|to\b))", re.I,
)
CHANGE = re.compile(r"\b(?:then|followed by)\b", re.I)
OPEN_CHANGE = re.compile(r"(?:then|followed by)\W*$", re.I)
COMPLEX = re.compile(
    r"\b(?:or|until(?!\s+all\s+taken\b)|except|after\s+\d+|before\s+\d+|weekly|alternat\w*|increase|decrease|reduce|"
    r"taper|up to|at least|maximum|not more than|if|every other|every\s+(?!24\s+hours?\b)\d+\s*(?:hours?|days?)|"
    r"as directed|as tolerated)\b|\d\s*[-–]\s*\d", re.I,
)


def number(value):
    return int(value) if value.isdecimal() else NUMBERS[value.lower()]


def direction_block(lines):
    blocks = []
    active = None
    for line in lines:
        line = line.strip().lstrip("•▪■–- ").strip()
        if LEAD.match(line) and not re.match(
            r"^(?:use (?:only|under|as directed|the spray|the enclosed)|take (?:with|without))\b",
            line, re.I,
        ):
            if active is None or not OPEN_CHANGE.search(active[-1]):
                active = []
                blocks.append(active)
            active.append(line)
        elif active is not None and CONTINUATION.match(line):
            active.append(line)
        else:
            active = None
    # Multiple separate directions can come from different labels in the photo.
    return "\n".join(blocks[0]) if len(blocks) == 1 else ""


def frequency_value(match):
    if not match["count"]:
        return {"bid": 2, "tid": 3, "qid": 4}.get((match["abbrev"] or "").lower(), 1)
    word = match["count"].lower().split()[0]
    if word in ("once", "twice"):
        return 1 if word == "once" else 2
    return number(word)


def phase(text):
    frequencies = {frequency_value(match) for match in FREQUENCY.finditer(text)}
    durations = {
        number(match[1]) * (7 if match[2].lower().startswith("week") else 1)
        for match in DURATION.finditer(text)
    }
    dose = DOSE.search(text)
    return {
        "perDay": next(iter(frequencies)) if len(frequencies) == 1 else None,
        "days": next(iter(durations)) if len(durations) == 1 else None,
        "dose": dose[1] if dose else "",
        "evidence": text.strip(" ,.;"),
    }, len(frequencies) > 1 or len(durations) > 1


def parse_directions(directions):
    text = re.sub(r"\s+", " ", directions).strip()
    parts = [part.strip(" ,.;") for part in CHANGE.split(text)]
    if len(parts) > 1 and parts[-1].lower() in {"stop", "discontinue"}:
        parts.pop()
    as_needed = bool(PRN.search(text))
    routes = {match[0].lower() for match in ROUTE.finditer(text)}
    candidates = [phase(part) for part in parts]
    phases = [item for item, _ in candidates]
    complex_schedule = bool(COMPLEX.search(text)) or any(not part for part in parts)
    complex_schedule = complex_schedule or len(routes) > 1 or any(ambiguous for _, ambiguous in candidates)
    if len(phases) > 1 and (
        as_needed or any(not item["perDay"] or not item["days"] for item in phases)
    ):
        complex_schedule = True
    # A pure as-needed label can have an interval or maximum. Preserve its
    # directions, but never turn those limits into scheduled doses.
    prn_match = PRN.search(text)
    prn = bool(prn_match and len(parts) == 1 and not re.search(r"\band\b", text[:prn_match.start()], re.I))
    first = phases[0]
    return {
        "directions": directions,
        "route": next(iter(routes)) if len(routes) == 1 else "",
        "dose": first["dose"],
        "perDay": first["perDay"] if not complex_schedule and not as_needed else None,
        "durationDays": first["days"] if not complex_schedule and not as_needed else None,
        "phases": phases if len(phases) > 1 and not complex_schedule else [],
        "prn": prn,
        "needsReview": bool(text) and not prn and (complex_schedule or as_needed),
    }
