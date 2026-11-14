#!/usr/bin/env python3
"""Read a label: local first, cloud only when the local read is unsure.

    ./read.py samples/canister.jpg
    ./read.py --json samples/housing.jpg
    ./read.py --force-cloud samples/housing.jpg

Two lanes and one rule. Apple Vision runs on the machine and costs nothing, so
it goes first. If it comes back without a name, or with a name it does not trust,
the photograph is escalated to Gemini — which is better on glare, angles and
handwriting, and which is the only part of this app that sends anything out.

Fields are merged: the local read wins where it is confident, the cloud fills
what is missing. The photo only leaves the machine on the escalated path, and
the caller is told which path it took so the UI can say so.
"""

import argparse
import json
import sys
import os

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)

import extract  # noqa: E402
import gemini  # noqa: E402

# Below this, the local name is a guess and the photo is worth sending.
NAME_TRUST = 0.7

FIELDS = ("name", "form", "strength", "quantity", "unit", "perDay", "durationDays", "prn")


def read(path, force_cloud=False):
    local = extract.parse(extract.ocr(path))
    local_conf = local.get("confidence", {}).get("name", 0)

    escalate = force_cloud or not local["name"] or local_conf < NAME_TRUST
    if not escalate:
        return {**local, "source": "local", "escalated": False, "cloudConfidence": None}

    cloud = gemini.read(path)

    merged = dict(local)
    for field in FIELDS:
        value = cloud.get(field)
        if value in (None, "", 0, False):
            continue
        if field in ("name", "quantity", "perDay", "durationDays") or not local.get(field):
            merged[field] = value

    # The cloud read is a different opinion on the name; prefer it when the
    # local one was the reason we escalated.
    if cloud.get("name"):
        merged["name"] = cloud["name"]
    if cloud.get("strength") and not local.get("strength"):
        merged["strength"] = cloud["strength"]

    merged["evidence"] = {**local.get("evidence", {}), **cloud.get("evidence", {})}
    merged["missing"] = [
        f for f in ("name", "strength", "quantity", "perDay", "durationDays") if not merged.get(f)
    ]
    merged["source"] = f"local+cloud:{gemini.MODEL}"
    merged["escalated"] = True
    merged["cloudConfidence"] = cloud.get("confidence")
    return merged


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("image")
    ap.add_argument("--json", action="store_true")
    ap.add_argument("--force-cloud", action="store_true")
    args = ap.parse_args()

    result = read(args.image, force_cloud=args.force_cloud)

    if args.json:
        print(json.dumps(result, indent=2, ensure_ascii=False))
        return 0

    lane = "cloud" if result["escalated"] else "local (on this machine)"
    print(f"read by   {lane}")
    if result["escalated"]:
        print(f"          local name was {result['confidence'].get('name', 0):.2f}, "
              f"cloud said {result['cloudConfidence']}")
    print(f"name      {result['name'] or '—'}")
    print(f"form      {result['form'] or '—'}")
    print(f"strength  {result['strength'] or '—'}")
    print(f"quantity  {result['quantity'] or '—'} {result['unit'] or ''}")
    print(f"per day   {result['perDay'] or '—'}")
    print(f"duration  {result['durationDays'] or '—'} days")
    print(f"prn       {'yes' if result['prn'] else 'no'}")
    print(f"missing   {', '.join(result['missing']) or 'nothing'}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
