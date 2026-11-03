#!/usr/bin/env python3
"""Validate Eleonor R5 corpus and optionally export human-approved chat SFT examples.

Python standard library only. This script DOES NOT train LFM3 or make network calls.
"""
from __future__ import annotations

import argparse
import json
import re
from collections import Counter
from pathlib import Path

BASE = Path(__file__).resolve().parent
ALLOWED_VISIBILITY = {"public", "sector", "admin", "internal_only"}


def read_jsonl(path: Path) -> list[dict]:
    rows = []
    with path.open("r", encoding="utf-8") as stream:
        for number, line in enumerate(stream, 1):
            if not line.strip():
                continue
            try:
                item = json.loads(line)
            except json.JSONDecodeError as exc:
                raise ValueError(f"{path}:{number}: invalid JSON: {exc}") from exc
            if not isinstance(item, dict):
                raise ValueError(f"{path}:{number}: expected an object")
            rows.append(item)
    return rows


def load_sources(manifest: dict) -> dict[str, list[dict]]:
    return {
        section: [record for name in filenames
                  for record in read_jsonl(BASE / name)]
        for section, filenames in manifest["files"].items()
        if section in ("R2", "R3", "R4")
    }


def validate(manifest: dict, sources: dict[str, list[dict]]) -> tuple[list[dict], list[dict]]:
    errors = []
    all_ids = set()
    for family in ("R2", "R3", "R4"):
        rows = sources[family]
        expected = manifest["counts"][family]
        if len(rows) != expected:
            errors.append(f"{family}: expected {expected}, got {len(rows)}")
        for row in rows:
            record_id = row.get("id")
            if not record_id or record_id in all_ids:
                errors.append(f"{family}: missing or duplicate id: {record_id}")
            all_ids.add(record_id)
            if row.get("visibility") not in ALLOWED_VISIBILITY:
                errors.append(f"{record_id}: invalid visibility {row.get('visibility')}")
            if row.get("sftEligible") is True or row.get("sftReady") is True:
                errors.append(f"{record_id}: raw source incorrectly marked SFT-ready")
            feature_id = row.get("featureId")
            if feature_id and not re.fullmatch(r"F-\\d{2}-\\d{3}", feature_id):
                errors.append(f"{record_id}: malformed featureId {feature_id}")
    relations = [r for r in sources["R4"] if r.get("recordType") == "knowledge_relation"]
    utterances = [r for r in sources["R4"] if isinstance(r.get("utterance"), str)]
    if len(relations) != 45 or len(utterances) != 1766:
        errors.append(f"R4 content types: {len(relations)} relations / {len(utterances)} utterances")
    train = read_jsonl(BASE / manifest["files"]["SFT"][0])
    evaluation = read_jsonl(BASE / manifest["files"]["SFT"][1])
    if (len(train), len(evaluation)) != (90, 22):
        errors.append(f"SFT counts: {len(train)}/{len(evaluation)} != 90/22")
    groups = [set(r["groupId"] for r in part) for part in (train, evaluation)]
    if groups[0] & groups[1]:
        errors.append("SFT group leakage across train/validation")
    candidates = train + evaluation
    if len({r["id"] for r in candidates}) != len(candidates):
        errors.append("Duplicate SFT ids")
    for case in candidates:
        msgs = case.get("messages", [])
        if len(msgs) < 3 or msgs[0].get("role") != "system" or msgs[-1].get("role") != "assistant":
            errors.append(f"Invalid SFT message structure: {case.get('id')}")
            continue
        if msgs[-2].get("role") != "user":
            errors.append(f"Missing last user request: {case.get('id')}")
        if any(not isinstance(m.get("content"), str) or not m["content"].strip()
               for m in msgs):
            errors.append(f"Empty SFT text: {case.get('id')}")
        if case.get("status") != "candidate_unreviewed":
            errors.append(f"Unexpected review state: {case.get('id')}")
    if errors:
        raise ValueError("Validation errors:\n" + "\n".join(errors[:25]))
    print(f"OK: R2={len(sources['R2'])} R3={len(sources['R3'])} R4={len(sources['R4'])}, "
          f"total={len(all_ids)}; SFT candidates={len(candidates)}, train={len(train)}, "
          f"validation_visible={len(evaluation)}.")
    return train, evaluation


def export_reviewed(train: list[dict], evaluation: list[dict],
                    approval_file: Path, output_dir: Path) -> None:
    """Export only explicit, individually approved candidate IDs; never auto-approve."""
    approvals = json.loads(approval_file.read_text(encoding="utf-8"))
    approved_ids = set(approvals.get("approvedIds", []))
    candidates = {r["id"] for r in train + evaluation}
    if not approved_ids:
        raise ValueError("No reviewed IDs approved. Refusing to export training data.")
    if not approved_ids <= candidates:
        raise ValueError("Approval references unknown SFT IDs")
    output_dir.mkdir(parents=True, exist_ok=True)
    for name, part in (("train", train), ("validation_visible", evaluation)):
        approved = [r for r in part if r["id"] in approved_ids]
        with (output_dir / f"{name}.jsonl").open("w", encoding="utf-8") as stream:
            for row in approved:
                stream.write(json.dumps({"messages": row["messages"]}, ensure_ascii=False) + "\n")
        print(f"EXPORTED {name}: {len(approved)} reviewed examples")
    print("NOTE: Validation subset is visible. It is not a blind holdout.")


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--export-reviewed", metavar="APPROVALS.json", type=Path,
                        help="JSON with approvedIds; required before SFT-only export")
    parser.add_argument("--out-dir", type=Path, default=Path("/tmp/eleonor-lfm3-sft"),
                        help="Export directory; default is outside this Git repo")
    args = parser.parse_args()
    manifest = json.loads((BASE / "manifest.json").read_text(encoding="utf-8"))
    sources = load_sources(manifest)
    train, evaluation = validate(manifest, sources)
    if args.export_reviewed:
        export_reviewed(train, evaluation, args.export_reviewed, args.out_dir)
    else:
        print("PREPARATION ONLY: no weights trained, no SFT set automatically approved.")


if __name__ == "__main__":
    main()
