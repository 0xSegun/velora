"""Generate a JSON storage audit for the Velora project."""

from __future__ import annotations

import hashlib
import json
from collections import defaultdict
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / "optimization" / "audit_before.json"

ARTIFACT_DIRS = {
    "__pycache__",
    ".pytest_cache",
    ".mypy_cache",
    ".ruff_cache",
    "node_modules",
    ".next",
    "dist",
    "build",
    "venv",
    ".venv",
    "terminals",
    "mcps",
    "htmlcov",
    ".git",
}

ARTIFACT_GLOBS = ("*.pyc", "*.pyo", "*.log", "*.tsbuildinfo", "~$*")


def dir_size(path: Path) -> int:
    total = 0
    if not path.exists():
        return 0
    for item in path.rglob("*"):
        if item.is_file():
            try:
                total += item.stat().st_size
            except OSError:
                pass
    return total


def file_hash(path: Path) -> str:
    h = hashlib.sha256()
    with path.open("rb") as f:
        for chunk in iter(lambda: f.read(1024 * 1024), b""):
            h.update(chunk)
    return h.hexdigest()


def main() -> None:
    OUTPUT.parent.mkdir(parents=True, exist_ok=True)

    all_files: list[tuple[int, str, str]] = []
    artifact_files: list[str] = []
    hash_map: dict[str, list[str]] = defaultdict(list)

    for path in ROOT.rglob("*"):
        if not path.is_file():
            continue
        rel = path.relative_to(ROOT).as_posix()
        parts = set(path.parts)
        if parts & ARTIFACT_DIRS:
            artifact_files.append(rel)
            continue
        try:
            size = path.stat().st_size
        except OSError:
            continue
        all_files.append((size, rel, path.suffix.lower()))
        if size > 10_000:
            try:
                hash_map[file_hash(path)].append(rel)
            except OSError:
                pass

    all_files.sort(reverse=True)
    top_folders = []
    for child in ROOT.iterdir():
        if child.is_dir():
            top_folders.append({"path": child.name, "bytes": dir_size(child)})
    top_folders.sort(key=lambda x: x["bytes"], reverse=True)

    duplicates = [
        {"hash": h, "files": files}
        for h, files in hash_map.items()
        if len(files) > 1
    ]
    duplicates.sort(key=lambda d: len(d["files"]), reverse=True)

    report = {
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "root": str(ROOT),
        "total_bytes": sum(s for s, _, _ in all_files) + sum(
            dir_size(ROOT / a) for a in ARTIFACT_DIRS if (ROOT / a).exists()
        ),
        "source_file_count": len(all_files),
        "artifact_file_count": len(artifact_files),
        "largest_folders": top_folders[:20],
        "largest_files": [
            {"path": rel, "bytes": size, "ext": ext}
            for size, rel, ext in all_files[:40]
        ],
        "duplicate_groups": duplicates[:30],
        "artifact_samples": artifact_files[:50],
    }
    OUTPUT.write_text(json.dumps(report, indent=2), encoding="utf-8")
    print(f"Audit written: {OUTPUT}")
    print(f"Total size: {report['total_bytes'] / (1024**3):.2f} GB")


if __name__ == "__main__":
    main()