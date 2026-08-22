# Test Analytics Platform

[![tests](https://github.com/Anushka-Srivastava159/test-analytics-platform/actions/workflows/tests.yml/badge.svg)](https://github.com/Anushka-Srivastava159/test-analytics-platform/actions/workflows/tests.yml)

Playwright tests run in CI, emit structured results to a warehouse, get modelled with dbt,
and surface as a test-health dashboard in Power BI and Tableau.

**Stack:** Playwright + TypeScript · GitHub Actions · Docker · Python ETL · dbt-duckdb · DuckDB · Power BI / Tableau

## Why

Test suites produce a large amount of data that most teams throw away — test name, status,
duration, browser, retry count, error message, timestamp, emitted on every run and deleted
once the build goes green.

"The build is green" is a point-in-time answer to what are really trend questions:
**what's flaky, what's slowing us down, are we ready to release?**

This project treats test results as a data product.

## Architecture

```
Playwright  →  results.json  →  DuckDB  →  dbt  →  Power BI / Tableau
                    ↑
            GitHub Actions (push + nightly)
```

## Status

Phases 1–3 complete (Playwright suite, CI/CD, Docker). Phase 4 (Python ETL) in progress —
the report parser is written, the DuckDB load is next. Then dbt, the BI layer and cloud.

## Layout

```
tests/
  ui/         UI specs (saucedemo.com)
  api/        API specs
  pages/      Page objects
  fixtures/   Shared test fixtures
pipeline/     Python: parse Playwright JSON reports -> DuckDB
warehouse/    DuckDB file, and later the dbt project (models, schema tests)
dashboards/   Power BI / Tableau assets + screenshots
```

`dashboards/` is created in its phase.

## Running the tests

```bash
npm ci
npx playwright install --with-deps
npx playwright test
```

Results land in `results/results.json` — this is the pipeline's source data.
An HTML report is also written to `playwright-report/`.

UI specs run against saucedemo.com under `chromium`, `firefox` and `webkit`. API specs run
under a separate `api` project with its own `baseURL` and no browser, so they execute once
per run rather than once per browser — which also gives the dashboard a clean `suite`
dimension to slice on.

## Running in Docker

```bash
docker compose run --rm --build tests                       # whole suite
docker compose run --rm --build tests npx playwright test --project=api
```

`--build` matters: `compose run` reuses an existing image and only builds when none exists,
so without it you silently test the previous code. Artifacts are bind-mounted out to
`results/`, `playwright-report/` and `test-results/` — a container's filesystem is deleted
with the container, so anything not mounted is lost when the run ends.

The image sets `CI=true`, which turns retries on. A container run therefore reports the
seeded unstable tests as **flaky** rather than **failed**, matching what GitHub Actions
produces; a bare local `npx playwright test` does not.

**Why containerise a browser suite in particular.** Playwright's browsers are not the
browsers you have installed — they're pinned builds it downloads, and they differ per
platform. WebKit on Windows is a genuinely different binary from the WebKit that Linux CI
runs, so a local pass tells you less than it appears to. The image also carries the ~100
Linux system libraries browsers need, which is the part that's tedious to reproduce by hand.

That matters more here than in most projects, because the output is *analytics*. A
duration trend or a flake rate is only meaningful if the rows are comparable: a red result
should mean the application broke, not that someone's laptop had a different Chromium.
`config.metadata` makes each row **attributable** (which run, which commit); the image makes
rows **comparable** (same binaries, same libraries, same retry policy). Both are needed
before a trend line means anything.

**Why the image tag is pinned.** `FROM mcr.microsoft.com/playwright:v1.62.1-noble` matches
`@playwright/test` in `package.json`. Browser builds are versioned in lockstep with the
runner, so if the two drift the image ships browsers the runner doesn't recognise and every
test fails with `Executable doesn't exist at /ms-playwright/chromium-<n>/`. Bump both
together, or neither.

One knob the container does *not* fix: CPU count. Containers see all host cores by default,
so `workers` (and therefore `config.metadata.actualWorkers`) still varies with the machine,
which affects durations through contention. Left as-is deliberately — `actualWorkers` is in
the data, so it can be measured before deciding whether it needs pinning.

## Data contract

`results/results.json` is the pipeline's only input, so the fields below are load-bearing.
Changing the reporter config or the project names changes the warehouse.

| field | JSON location | consumed by |
|---|---|---|
| `runId`, `commit`, `branch`, `ci` | `config.metadata` | run identity — the report has none of its own |
| `title` | each `spec` | `dim_test.test_name` |
| suite path | each `suite.title`, nested | `dim_test.suite`, and the `ui`/`api` split |
| `projectName` | each `test` | `dim_browser` |
| `status`, `duration`, `retry`, `startTime` | each entry in `test.results[]` | `fct_test_run` — one entry per attempt |
| `error.message` | failed results only | failure clustering, recent-error drill-through |

Three things that will bite the ingest if not handled there:

**Suite titles use the host OS path separator** — `ui\login.spec.ts` on Windows,
`ui/login.spec.ts` on Linux CI. `test_id` is hashed from the suite path plus the title, so
the same test hashes differently depending on where it ran, silently splitting every test
into two in `dim_test`. Normalise separators before hashing.

**There is no `flaky` status.** Playwright emits `passed`, `failed`, `timedOut`, `skipped`
and `interrupted` per *attempt*. Flaky is derived: a `(run, test, browser)` group whose
final attempt passed but which has `retry > 0`. The `retry` field is what makes this
computable, which is why retries must stay enabled in CI.

**`error.message` carries ANSI colour codes.** Strip them at ingest or the dashboard shows
escape sequences.

Regenerate the file with a bare `npx playwright test`. Note that `--reporter=<x>` *replaces*
the configured reporters (no JSON written), and `--list` overwrites the file with a listing
whose `results[]` arrays are empty.

## The pipeline

```bash
python pipeline/ingest.py
python pipeline/ingest.py --json results/results.json --sample
```

`pipeline/ingest.py` turns one Playwright report into three flat row sets — a single run,
one row per test *attempt*, and one row per `test.step()` — then prints a summary of what it
found. Standard library only, so there is nothing to install. This is step 1 of the phase:
parsing only, nothing is written to DuckDB yet, so the script is safe to run repeatedly.

**The grain is the attempt, not the test.** One row per entry in a test's `results[]`.
Anything coarser folds a retry together with the attempt that failed before it, discarding
the one thing that makes flakiness computable.

The three hazards named in the data contract are all handled at this boundary, and the
summary *demonstrates* it rather than asserting it. It prints the number of rows still
containing ANSI escapes and the number of `test_id`s mapping to more than one file path —
both must be `0` — and it derives the flaky `(test, project)` groups from `retry` and prints
them beside the count Playwright itself reported. Those three lines are the regression test
for the contract until real schema tests exist.

**`run_key`, not `runId`.** `config.metadata.runId` is the literal string `local` for every
run outside CI, so on its own it collides with the previous local run. The key is
`runId-runAttempt-startTime`: stable for a CI run, unique for a local one.

**An empty parse exits non-zero.** A report written by `--list`, or by a `--reporter=`
override that suppressed the JSON reporter, is a valid-looking file whose `results[]` arrays
are empty. Loading it quietly would look like a run in which nothing happened.

## Deliberate flakiness

> Write-up: [I made my test suite flaky on purpose](https://dev.to/anushka_srivastava_6ba849/i-made-my-test-suite-flaky-on-purpose-5c6)

`tests/ui/flaky.spec.ts` is **intentionally unstable, and should not be "fixed."** A
stability dashboard with nothing to plot proves nothing, so the suite generates its own
flaky data — three tests, each failing for a different reason, so the failure modes stay
distinguishable downstream:

| test | cause |
|---|---|
| `checkout flow under intermittent load` | random ~20% chance, after a full real checkout |
| `inventory renders within a tight budget` | 150ms visibility budget — a genuine render race |
| `performance_glitch_user reaches inventory quickly` | 6s whole-test budget against an account saucedemo throttles to ~5.1s |

Each test carries an inline comment marking it as intentional. Every other spec in the
suite is expected to be deterministic; a failure outside this file is a real one.

With `retries: 2` these report as **flaky** rather than **failed** — Playwright's own
distinction between "failed then passed on retry" and "failed every attempt." That status
is what the dbt stability model keys on, so retries must stay enabled for the data to mean
anything. Locally `retries` is 0, so the same tests show up as plain failures:

```bash
npx playwright test tests/ui/flaky.spec.ts --retries=2
```

Or run in Docker, where `CI=true` is set in the image and retries are on by default.
