"""Parse a Playwright JSON report into flat rows.

Phase 4, step 1: parsing only, no database. Run it to see what comes out:

    python pipeline/ingest.py
    python pipeline/ingest.py --json results/results.json --sample

The grain is the *attempt* — one row per entry in a test's results[] array. Anything
coarser loses the retry information that makes flakiness computable, which is the point
of the project.
"""



import argparse
import hashlib
import json
import re
from datetime import datetime
from pathlib import Path

# Playwright colours error messages for the terminal. Left in, the dashboard shows
# escape sequences instead of text.
ANSI = re.compile(r"\x1b\[[0-9;]*m")

REPO_ROOT = Path(__file__).resolve().parent.parent
DEFAULT_JSON = REPO_ROOT / "results" / "results.json"


def strip_ansi(text: str | None) -> str:
    return ANSI.sub("", text or "").strip()


def normalise_path(path: str) -> str:
    """Windows writes ui\\login.spec.ts, Linux writes ui/login.spec.ts.

    Same test, two strings — and therefore two different hashes, which silently splits
    every test in two once local and CI runs land in the same table.
    """
    return (path or "").replace("\\", "/")


def make_test_id(file_path: str, titles: list[str]) -> str:
    """Stable identity for a test across runs, machines and operating systems."""
    key = normalise_path(file_path) + "::" + " > ".join(titles)
    return hashlib.sha1(key.encode("utf-8")).hexdigest()[:16]


def parse_timestamp(value: str | None) -> datetime | None:
    if not value:
        return None
    return datetime.fromisoformat(value.replace("Z", "+00:00"))


def walk_specs(suite: dict, path: tuple[str, ...] = ()):
    """Yield (suite_titles, spec) for every spec in a nested suite tree.

    Playwright nests suites arbitrarily: file -> describe -> describe -> spec, and a
    suite can hold both child suites and specs at the same level.
    """
    here = path + (suite.get("title", ""),)
    for child in suite.get("suites", []):
        yield from walk_specs(child, here)
    for spec in suite.get("specs", []):
        yield here, spec


def parse(report: dict) -> tuple[dict, list[dict], list[dict]]:
    """report -> (run, results, steps). Pure: no I/O, no database."""
    config = report.get("config", {})
    metadata = config.get("metadata", {})
    stats = report.get("stats", {})

    started_at = parse_timestamp(stats.get("startTime"))
    run_id = metadata.get("runId", "local")
    run_attempt = int(metadata.get("runAttempt", 1) or 1)

    # runId is "local" for every run outside CI, so it cannot be the key on its own —
    # every local run would collide with the last. startTime disambiguates them.
    run_key = f"{run_id}-{run_attempt}-{started_at.isoformat() if started_at else 'unknown'}"

    run = {
        "run_key": run_key,
        "run_id": run_id,
        "run_attempt": run_attempt,
        "commit_sha": metadata.get("commit", ""),
        "branch": metadata.get("branch", ""),
        "is_ci": bool(metadata.get("ci", False)),
        "actual_workers": metadata.get("actualWorkers"),
        "started_at": started_at,
        "duration_ms": stats.get("duration"),
        "expected": stats.get("expected", 0),
        "unexpected": stats.get("unexpected", 0),
        "flaky": stats.get("flaky", 0),
        "skipped": stats.get("skipped", 0),
        "source": "playwright",
    }

    results: list[dict] = []
    steps: list[dict] = []

    for suite in report.get("suites", []):
        for suite_titles, spec in walk_specs(suite):
            file_path = normalise_path(spec.get("file", ""))

            # The outermost suite title is the file path; drop it so the suite path
            # describes only the describe() blocks.
            describes = [t for t in suite_titles if normalise_path(t) != file_path and t]
            titles = describes + [spec.get("title", "")]
            test_id = make_test_id(file_path, titles)

            for test in spec.get("tests", []):
                project = test.get("projectName", "")

                for attempt in test.get("results", []):
                    errors = attempt.get("errors") or []
                    first = errors[0] if errors else {}
                    location = first.get("location") or {}

                    results.append({
                        "run_key": run_key,
                        "test_id": test_id,
                        "file_path": file_path,
                        "suite_path": " > ".join(describes),
                        "test_title": spec.get("title", ""),
                        "project_name": project,
                        "retry": attempt.get("retry", 0),
                        "status": attempt.get("status"),          # per attempt
                        "rollup_status": test.get("status"),      # expected/unexpected/flaky
                        "duration_ms": attempt.get("duration"),
                        "started_at": parse_timestamp(attempt.get("startTime")),
                        "worker_index": attempt.get("workerIndex"),
                        "error_message": strip_ansi(first.get("message")),
                        "error_location": (
                            f"{normalise_path(location.get('file', ''))}:"
                            f"{location.get('line', '')}:{location.get('column', '')}"
                            if location else ""
                        ),
                    })

                    # Sparse by design: only tests wrapped in test.step() have these,
                    # and each step carries just a title and a duration.
                    for index, step in enumerate(attempt.get("steps") or []):
                        steps.append({
                            "run_key": run_key,
                            "test_id": test_id,
                            "project_name": project,
                            "retry": attempt.get("retry", 0),
                            "step_index": index,
                            "step_title": step.get("title", ""),
                            "duration_ms": step.get("duration"),
                        })

    return run, results, steps


def summarise(run: dict, results: list[dict], steps: list[dict]) -> None:
    from collections import Counter

    print(f"run_key       {run['run_key']}")
    print(f"run_id        {run['run_id']}   ci={run['is_ci']}   workers={run['actual_workers']}")
    print(f"started_at    {run['started_at']}")
    print(f"reported      expected={run['expected']} unexpected={run['unexpected']} "
          f"flaky={run['flaky']} skipped={run['skipped']}")
    print()

    print(f"attempts      {len(results)}")
    print(f"unique tests  {len({r['test_id'] for r in results})}")
    print(f"step rows     {len(steps)} "
          f"(from {len({(s['test_id'], s['project_name'], s['retry']) for s in steps})} attempts)")
    print()

    print("per-attempt status:", dict(Counter(r["status"] for r in results)))
    print("per-project:       ", dict(Counter(r["project_name"] for r in results)))
    print("retry index:       ", dict(Counter(r["retry"] for r in results)))
    print()

    # Derived here rather than trusting rollup_status — the whole point of the data
    # contract is that flakiness is computable from retry counts.
    groups: dict[tuple, list[dict]] = {}
    for row in results:
        groups.setdefault((row["test_id"], row["project_name"]), []).append(row)

    derived_flaky = [
        key for key, attempts in groups.items()
        if len(attempts) > 1
        and max(attempts, key=lambda a: a["retry"])["status"] == "passed"
    ]
    print(f"derived flaky (test, project) groups: {len(derived_flaky)}  "
          f"[report says {run['flaky']}]")

    with_errors = [r for r in results if r["error_message"]]
    print(f"rows with error text: {len(with_errors)}")
    if with_errors:
        leftover = sum(1 for r in with_errors if "\x1b" in r["error_message"])
        print(f"rows still containing ANSI escapes: {leftover}  (must be 0)")

    separators = {r["test_id"]: set() for r in results}
    for row in results:
        separators[row["test_id"]].add(row["file_path"])
    split = {k: v for k, v in separators.items() if len(v) > 1}
    print(f"test_ids mapping to >1 file path: {len(split)}  (must be 0)")


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--json", type=Path, default=DEFAULT_JSON,
                        help="Playwright JSON report (default: results/results.json)")
    parser.add_argument("--sample", action="store_true",
                        help="print a couple of parsed rows in full")
    args = parser.parse_args()

    if not args.json.exists():
        raise SystemExit(f"no report at {args.json} — run the suite first")

    report = json.loads(args.json.read_text(encoding="utf-8"))
    run, results, steps = parse(report)

    # An empty parse usually means the file came from `--list` (which writes empty
    # results[] arrays) or a --reporter= override that suppressed the JSON reporter.
    # Both produce a valid-looking file, so fail loudly rather than load nothing.
    if not results:
        raise SystemExit("no attempts parsed — check the report was written by a real run")

    summarise(run, results, steps)

    if args.sample:
        print("\n--- sample result row ---")
        print(json.dumps(results[0], indent=2, default=str))
        if steps:
            print("\n--- sample step rows ---")
            for step in steps[:3]:
                print(json.dumps(step, default=str))


if __name__ == "__main__":
    main()
