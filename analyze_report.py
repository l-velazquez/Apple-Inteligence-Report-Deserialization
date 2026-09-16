#!/usr/bin/env python3
"""Print a privacy-conscious schema summary for an Apple Intelligence report."""

from __future__ import annotations

import argparse
import datetime as dt
import json
from pathlib import Path
from typing import Any


SAFE_VALUE_KEYS = {
    "model",
    "modelVersion",
    "useCase",
    "clientIdentifier",
    "executionEnvironment",
    "pipelineKind",
    "adapter",
    "applicationId",
    "assetId",
    "assetVersion",
}


def value_type(value: Any) -> str:
    if value is None:
        return "null"
    if isinstance(value, bool):
        return "boolean"
    if isinstance(value, (int, float)):
        return "number"
    if isinstance(value, str):
        return "string"
    if isinstance(value, list):
        return "array"
    return "object"


def field_name(path: str) -> str:
    return path.rsplit(".", 1)[-1].removesuffix("[]")


def new_stat(path: str) -> dict[str, Any]:
    return {
        "path": path,
        "types": set(),
        "occurrences": 0,
        "nullCount": 0,
        "stringLengths": [],
        "arrayLengths": [],
        "numberMin": None,
        "numberMax": None,
        "booleanValues": set(),
        "observedValues": set(),
    }


def record(stats: dict[str, dict[str, Any]], path: str, value: Any) -> None:
    if not path or path == "$":
        return
    item = stats.setdefault(path, new_stat(path))
    kind = value_type(value)
    item["types"].add(kind)
    item["occurrences"] += 1

    if kind == "null":
        item["nullCount"] += 1
    elif kind == "string":
        item["stringLengths"].append(len(value))
        if field_name(path) in SAFE_VALUE_KEYS and len(value) <= 96:
            item["observedValues"].add(value)
    elif kind == "array":
        item["arrayLengths"].append(len(value))
    elif kind == "number":
        item["numberMin"] = value if item["numberMin"] is None else min(item["numberMin"], value)
        item["numberMax"] = value if item["numberMax"] is None else max(item["numberMax"], value)
    elif kind == "boolean":
        item["booleanValues"].add(value)


def walk(stats: dict[str, dict[str, Any]], value: Any, path: str) -> None:
    record(stats, path, value)
    if isinstance(value, dict):
        for key, child in value.items():
            walk(stats, child, f"{path}.{key}")
    elif isinstance(value, list):
        for child in value:
            walk(stats, child, f"{path}[]")


def decode_pipeline_parameters(report: dict[str, Any], stats: dict[str, dict[str, Any]]) -> int:
    decoded = 0
    for request in report.get("privateCloudComputeRequests", []):
        raw = request.get("pipelineParameters")
        if not isinstance(raw, str):
            continue
        try:
            params = json.loads(raw)
        except json.JSONDecodeError:
            continue
        if isinstance(params, dict):
            decoded += 1
            walk(stats, params, "privateCloudComputeRequests[].pipelineParameters (decoded)")
    return decoded


def json_ready(stats: dict[str, dict[str, Any]]) -> list[dict[str, Any]]:
    rows = []
    for item in stats.values():
        row = dict(item)
        row["types"] = sorted(row["types"])
        row["booleanValues"] = sorted(row["booleanValues"], key=str)
        row["observedValues"] = sorted(row["observedValues"])
        rows.append(row)
    return rows


def shape(item: dict[str, Any]) -> str:
    types = set(item["types"])
    if "array" in types and item["arrayLengths"]:
        low, high = min(item["arrayLengths"]), max(item["arrayLengths"])
        return f"{low} item(s)" if low == high else f"{low}-{high} items"
    if "string" in types and item["stringLengths"]:
        low, high = min(item["stringLengths"]), max(item["stringLengths"])
        size = f"{low} chars" if low == high else f"{low}-{high} chars"
        values = item["observedValues"]
        return f"{size}; {', '.join(values[:4])}" if values and len(values) <= 4 else size
    if "number" in types:
        return "numeric"
    if "boolean" in types:
        return "true/false"
    if "object" in types:
        return "object"
    return "null"


def timestamp_label(timestamp: Any) -> str:
    try:
        seconds = float(timestamp)
        if seconds > 1_000_000_000_000:
            seconds /= 1000
        return dt.datetime.fromtimestamp(seconds, tz=dt.timezone.utc).isoformat(timespec="seconds")
    except (TypeError, ValueError, OverflowError, OSError):
        return "unknown"


def analyze(path: Path) -> dict[str, Any]:
    report = json.loads(path.read_text(encoding="utf-8"))
    if not isinstance(report, dict):
        raise ValueError("report must be a JSON object")
    if not isinstance(report.get("modelRequests"), list) and not isinstance(report.get("privateCloudComputeRequests"), list):
        raise ValueError("expected modelRequests or privateCloudComputeRequests arrays")

    stats: dict[str, dict[str, Any]] = {}
    walk(stats, report, "$")
    decoded_count = decode_pipeline_parameters(report, stats)

    model_requests = report.get("modelRequests", [])
    pcc_requests = report.get("privateCloudComputeRequests", [])
    model_ids = {item.get("identifier") for item in model_requests if isinstance(item, dict)}
    pcc_ids = {item.get("requestId") for item in pcc_requests if isinstance(item, dict)}
    timestamps = [
        item.get("timestamp")
        for item in [*model_requests, *pcc_requests]
        if isinstance(item, dict) and isinstance(item.get("timestamp"), (int, float))
    ]
    nodes = [
        node
        for request in pcc_requests
        if isinstance(request, dict)
        for node in request.get("nodes", [])
        if isinstance(node, dict)
    ]
    attestations = sum(len(node.get("attestationBundle", "")) for node in nodes if isinstance(node.get("attestationBundle"), str))

    return {
        "file": path.name,
        "topLevel": {key: {"type": value_type(value), "count": len(value) if isinstance(value, list) else None} for key, value in report.items()},
        "counts": {
            "modelRequests": len(model_requests),
            "privateCloudComputeRequests": len(pcc_requests),
            "nodes": len(nodes),
            "assets": sum(len(item.get("assets", [])) for item in pcc_requests if isinstance(item, dict)),
            "linkedRequestIds": len(model_ids & pcc_ids),
            "decodedPipelineParameters": decoded_count,
        },
        "time": {
            "start": min(timestamps) if timestamps else None,
            "end": max(timestamps) if timestamps else None,
            "startUtc": timestamp_label(min(timestamps)) if timestamps else None,
            "endUtc": timestamp_label(max(timestamps)) if timestamps else None,
        },
        "attestationCharacters": attestations,
        "schema": json_ready(stats),
    }


def print_human(summary: dict[str, Any]) -> None:
    print(f"Report: {summary['file']}")
    print("Top-level collections:")
    for key, info in summary["topLevel"].items():
        count = f" ({info['count']} records)" if info["count"] is not None else ""
        print(f"  - {key}: {info['type']}{count}")
    print("Counts:")
    for key, value in summary["counts"].items():
        print(f"  - {key}: {value}")
    print(f"Time: {summary['time']['startUtc']} → {summary['time']['endUtc']}")
    print(f"Attestation characters: {summary['attestationCharacters']}")
    print("\nSchema paths:")
    rows = summary["schema"]
    by_path = {row["path"]: row for row in rows}
    for row in rows:
        parent_path = row["path"].rsplit(".", 1)[0] if "." in row["path"] else ""
        expected = by_path.get(parent_path, {}).get("occurrences")
        presence = f"{row['occurrences']}/{expected}" if expected and row["occurrences"] < expected else str(row["occurrences"])
        types = " | ".join(row["types"])
        print(f"  {row['path']:<78} {types:<16} {presence:>8}  {shape(row)}")


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("path", nargs="?", default="Apple_Intelligence_Report.json", type=Path)
    parser.add_argument("--json", action="store_true", dest="as_json", help="emit machine-readable schema JSON")
    args = parser.parse_args()
    summary = analyze(args.path)
    if args.as_json:
        print(json.dumps(summary, indent=2, ensure_ascii=False))
    else:
        print_human(summary)


if __name__ == "__main__":
    main()
