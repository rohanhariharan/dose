#!/usr/bin/env python3
"""Read a label: local first, cloud only when the local read is unsure.

    ./read.py samples/canister.jpg
    ./read.py --json samples/housing.jpg
    ./read.py --force-cloud samples/housing.jpg

Two lanes and one rule. Apple Vision runs on the machine and costs nothing, so
it goes first. If it comes back without a name, or with a name it does not trust,
the photograph is escalated to Gemini — which is better on glare, angles and
handwriting, and which is the only part of this app that sends anything out.

The selected result comes from a single reader so a photo with two packages
cannot accidentally combine one medicine's name with another's directions.
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

def read(path, force_cloud=False, allow_cloud=True):
    local = extract.parse(extract.ocr(path))
    local_conf = local.get("confidence", {}).get("name", 0)

    escalate = force_cloud or (allow_cloud and (
        not local["name"] or local_conf < NAME_TRUST or not local["directions"]
    ))
    if not escalate:
        return {**local, "source": "local", "escalated": False, "cloudConfidence": None}

    try:
        cloud = gemini.read(path)
    except (Exception, SystemExit):
        if force_cloud:
            raise
        cloud = None
    if not cloud or not cloud.get("name"):
        return {**local, "source": "local", "escalated": True, "cloudConfidence": None}
    return {
        **cloud,
        "confidence": local["confidence"],
        "escalated": True,
        "cloudConfidence": cloud["confidence"],
    }


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("image")
    ap.add_argument("--json", action="store_true")
    mode = ap.add_mutually_exclusive_group()
    mode.add_argument("--force-cloud", action="store_true")
    mode.add_argument("--local-only", action="store_true")
    args = ap.parse_args()

    result = read(args.image, force_cloud=args.force_cloud, allow_cloud=not args.local_only)

    if args.json:
        print(json.dumps(result, indent=2, ensure_ascii=False))
        return 0

    lane = "cloud" if result["source"].startswith("gemini") else "local (on this machine)"
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
