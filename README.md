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

Phases 1–4 complete (Playwright suite, CI/CD, Docker, Python ETL). Every CI run ingests
its own report into the committed DuckDB warehouse, and the runs from before that was
wired up were backfilled from their artifacts — the warehouse holds a continuous nightly
history from 5 Aug 2026. Phase 5 (dbt) is complete: staging and mart models with data
tests, built on every CI run. Phase 6 (BI) is in progress: the Power BI report in
`dashboards/` has its first page, *Release readiness*. Cloud comes after.

## Layout

```
tests/
  ui/         UI specs (saucedemo.com)
  api/        API specs
  pages/      Page objects
  fixtures/   Shared test fixtures
pipeline/     Python: parse Playwright JSON reports -> DuckDB
warehouse/    The CI-owned DuckDB file, plus the dbt project
  models/     staging/ (views over the raw tables), marts/ (dims + facts)
  tests/      Singular data tests that reconcile the models with Playwright
dashboards/   Power BI project (PBIP: report JSON + model TMDL); Tableau to follow
```

Setup, refresh routine and page notes for the report: [dashboards/README.md](dashboards/README.md).

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
| `title` | each `spec` | `dim_test.test_title` |
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
pip install -r pipeline/requirements.txt

python pipeline/ingest.py --db warehouse/local.duckdb          # parse, summarise, load
python pipeline/ingest.py --no-load --sample                    # print full sample rows
python pipeline/ingest.py --no-load                             # parse and summarise only
```

Locally, load into a scratch file as above, never into `warehouse/test_analytics.duckdb` —
that one belongs to CI (see below). `*.duckdb` is gitignored apart from the CI warehouse,
so a scratch DB stays untracked with no extra config.

`pipeline/ingest.py` turns one Playwright report into three flat row sets — a single run,
one row per test *attempt*, and one row per `test.step()` — prints a summary of what it
found, and loads the rows into DuckDB at `warehouse/test_analytics.duckdb`. DuckDB is the
only dependency; everything else is standard library.

**The load is idempotent per run.** The three tables — `raw_runs`, `raw_test_results`,
`raw_test_steps` — are created on first use, and each load deletes any existing rows for
that `run_key` before reinserting, all inside one transaction. Re-ingesting the same report
replaces it rather than doubling it, so the script stays safe to run repeatedly. `--no-load`
gives back the parse-only behaviour when you just want to inspect a report.

**The raw tables stay raw.** Playwright's field names and values are carried across
as-is — no renaming, no derived columns, no filtering. Conforming and cleaning is dbt's job
(see [The models](#the-models)); ingest's only job is to make the rows *land*, and land identically each time.

**The warehouse is committed, and only CI writes to it.** After the suite runs, the
workflow fetches the newest `warehouse/test_analytics.duckdb` from `main`, ingests the
run's report into it and pushes it back, so every clone carries the full run history and
the dashboard can open it with no server. DuckDB is a binary file, so git cannot merge two
versions of it — a single writer is what keeps that safe. The job holds a `concurrency`
lock so two runs queue rather than overwrite each other, and the commit is marked
`[skip ci]` and excluded by `paths-ignore` so it cannot trigger another run. CI also pins
`PW_WORKERS: 2`, which keeps durations comparable from one run to the next; a laptop run
would not be.

**Runs from before the CI ingest were backfilled** from their `results-<run_id>` artifacts
(kept for 90 days). Two things in that early history are left in the raw tables and handled
in `stg_runs`: the runs before run identity was stamped into the report have
`run_id = 'local'` even though they ran in CI (`is_ci` is still true), and one local Docker
run (`local-1-2026-08-19T17:24:59.568000`) is in the table and is excluded from trends —
by key, since the image sets `CI=true` and it reports `is_ci` as true as well.

**The grain is the attempt, not the test.** One row per entry in a test's `results[]`.
Anything coarser folds a retry together with the attempt that failed before it, discarding
the one thing that makes flakiness computable.

The three hazards named in the data contract are all handled at this boundary, and the
summary *demonstrates* it rather than asserting it. It prints the number of rows still
containing ANSI escapes and the number of `test_id`s mapping to more than one file path —
both must be `0` — and it derives the flaky `(test, project)` groups from `retry` and prints
them beside the count Playwright itself reported. The same three checks now also run as
dbt data tests on every CI run (see [The models](#the-models)).

One caveat on the second of those lines: it can only catch a separator split once results
from more than one platform are in the table. A report from a single run has a single
separator style, so `test_ids mapping to >1 file path: 0` passes trivially. Ingesting a
Windows `npx playwright test` run and a `docker compose run` of the same suite into the
same file is what actually exercises `normalise_path`.

**`run_key`, not `runId`.** `config.metadata.runId` is the literal string `local` for every
run outside CI, so on its own it collides with the previous local run. The key is
`runId-runAttempt-startTime`: stable for a CI run, unique for a local one.

**An empty parse exits non-zero.** A report written by `--list`, or by a `--reporter=`
override that suppressed the JSON reporter, is a valid-looking file whose `results[]` arrays
are empty. Loading it quietly would look like a run in which nothing happened.

## The models

```bash
pip install -r warehouse/requirements.txt
cd warehouse
dbt build                                         # models + data tests
WAREHOUSE_DB=local.duckdb dbt build               # against a local scratch ingest
```

The dbt project lives in `warehouse/` with its own `profiles.yml`, so a clone needs no
`~/.dbt` setup. **dbt never writes to the CI warehouse.** `test_analytics.duckdb` is
attached read-only as the `raw` catalog and the models build into a separate `dev.duckdb`
(gitignored), the same single-writer rule the ingest follows.

| layer | model | grain |
|---|---|---|
| staging (views) | `stg_runs` | one run; the excluded run removed, `'local'` run ids nulled |
| | `stg_test_results` | one test attempt; adds `suite`, `is_final_attempt` and the keys |
| | `stg_test_steps` | one `test.step()` within an attempt |
| marts (tables) | `dim_run` | one run that counts towards trends |
| | `dim_test` | one test, named by its most recent attempt; flags `is_intentionally_flaky` |
| | `dim_browser` | one Playwright project, with its engine; `api` has no browser |
| | `fct_test_run` | one test attempt |
| | `fct_test_outcome` | one (run, test, browser), rolled up across retries |
| | `rpt_test_stability` | one (test, browser, day): outcome counts, flake and failure rates, p50/p95 duration |

**`rpt_test_stability` is what the dashboards read.** Flake rate and duration percentiles
are defined once, here, rather than twice in two BI tools' formula languages. A day can hold
more than one run (push + nightly). Rates exclude skipped outcomes from the denominator, and
the duration percentiles cover passing final attempts only — a timed-out attempt is cut off
at the timeout, so it would report the budget rather than how long the test took.

**Flaky is derived, then checked.** `fct_test_outcome.outcome` is computed from retries:
`flaky` when the final attempt passed and `max_retry > 0`. Playwright's own verdict is
carried alongside as `playwright_rollup_status`, so the derivation can be tested rather than
trusted.

**The data tests reconcile the models with Playwright.** Beyond the usual `unique`,
`not_null`, `accepted_values` and `relationships` checks, five singular tests in
`warehouse/tests/` encode the data contract:

| test | fails when |
|---|---|
| `assert_derived_flaky_matches_playwright` | a derived outcome disagrees with Playwright's rollup |
| `assert_outcomes_match_run_totals` | a run's derived passed/flaky/failed counts differ from the totals it reported |
| `assert_no_ansi_in_errors` | an error message still carries a terminal colour code |
| `assert_test_id_has_one_file_path` | a test split in two because a path separator wasn't normalised |
| `assert_stability_counts_match_outcomes` | the daily rollup in `rpt_test_stability` gained or lost an outcome |

**CI builds the models after every ingest.** The `dbt build` step runs *after* the warehouse
commit, on purpose: a model or data-test failure turns the run red, but the run's raw rows
have already landed, so the history keeps no gap. For the same reason the workflow's
`paths-ignore` covers only `warehouse/test_analytics.duckdb`, not the whole folder — a push
that changes the dbt project still triggers a run that tests it.

**Known history in the raw data is fixed in staging, not in the raw tables.** Besides the
excluded run, the step `assert inventory reached` was briefly titled `asset inventory
reached` (from 14 Sep 2026); `stg_test_steps` maps it back so the step keeps one duration
trend.

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
is what `fct_test_outcome` keys on, so retries must stay enabled for the data to mean
anything. Locally `retries` is 0, so the same tests show up as plain failures:

```bash
npx playwright test tests/ui/flaky.spec.ts --retries=2
```

Or run in Docker, where `CI=true` is set in the image and retries are on by default.
