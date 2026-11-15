#!/usr/bin/env python3
"""Compare a plain regex baseline with Dose on the same saved Vision reads."""

import json
import re
from pathlib import Path

from extract import parse


FIELDS = ("perDay", "durationDays", "dose", "route", "prn")
WORDS = {"one": 1, "two": 2, "three": 3, "four": 4, "once": 1, "twice": 2}

BASE_FREQ = re.compile(
    r"\b(once|twice|\d+\s+times|one\s+time|two\s+times|three\s+times|four\s+times)"
    r"\s+(?:daily|(?:a|per)\s+day)\b|\b(?:daily|every day)\b"
)
BASE_DAYS = re.compile(r"\bfor\s+(\d+)\s+(days?|weeks?)\b")
BASE_DOSE = re.compile(r"\b(\d+|one|two|three|four)\s+(tablets?|capsules?|drops?|puffs?|sprays?)\b")
BASE_ROUTE = re.compile(r"\b(by mouth|orally|swallow|topically|for external use only)\b")


def baseline(page):
    text = " ".join(line["text"] for line in page["lines"]).lower()
    freq = BASE_FREQ.search(text)
    days = BASE_DAYS.search(text)
    dose = BASE_DOSE.search(text)
    route = BASE_ROUTE.search(text)
    return {
        "perDay": count(freq[1].split()[0]) if freq and freq[1] else 1 if freq else None,
        "durationDays": int(days[1]) * (7 if days[2].startswith("week") else 1) if days else None,
        "dose": dose[0] if dose else None,
        "route": route[0] if route else None,
        "prn": bool(re.search(r"\b(?:prn|as needed|when required)\b", text)),
    }


def count(word):
    return int(word) if word.isdecimal() else WORDS[word]


def normalize(field, value):
    if not value:
        return None
    if field == "dose":
        return " ".join(str(WORDS.get(word, word)) for word in value.lower().split()).rstrip("s")
    if field == "route":
        return {
            "by mouth": "oral", "orally": "oral", "swallow": "oral",
            "topically": "topical", "for external use only": "topical",
        }.get(value.lower(), value.lower())
    return value


def score(cases, read):
    fields = {field: {"correct": 0, "misses": 0, "false_alarms": 0} for field in FIELDS}
    exact = 0
    examples = {}
    for case in cases:
        result = read(case["vision"])
        actual = {field: normalize(field, result.get(field)) for field in FIELDS}
        expected = {field: normalize(field, case["expected"].get(field)) for field in FIELDS}
        exact += actual == expected
        examples[case["id"]] = {field: actual[field] for field in FIELDS if actual[field] != expected[field]}
        for field, value in actual.items():
            target = expected[field]
            fields[field]["correct"] += value == target
            fields[field]["misses"] += target is not None and value != target
            fields[field]["false_alarms"] += value is not None and value != target
    return {
        "exact": exact,
        "fields": fields,
        "misses": sum(row["misses"] for row in fields.values()),
        "false_alarms": sum(row["false_alarms"] for row in fields.values()),
        "mismatches": {name: errors for name, errors in examples.items() if errors},
    }


def main():
    path = Path(__file__).with_name("benchmark-labels.json")
    cases = json.loads(path.read_text(encoding="utf-8"))
    print(json.dumps({
        "cases": len(cases),
        "regex": score(cases, baseline),
        "dose": score(cases, parse),
    }, indent=2))


if __name__ == "__main__":
    main()
