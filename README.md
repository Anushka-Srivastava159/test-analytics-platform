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

Phase 1 — Playwright suite, in progress. Phases 2–7 (CI/CD, Docker, Python ETL, dbt, BI
layer, cloud) follow.

## Layout

```
tests/
  ui/         UI specs (saucedemo.com)
  api/        API specs
  pages/      Page objects
  fixtures/   Shared test fixtures
pipeline/     Python: parse Playwright JSON reports -> DuckDB
warehouse/    dbt project (models, schema tests) + DuckDB file
dashboards/   Power BI / Tableau assets + screenshots
```

Directories beyond `tests/` are created in their respective phases.

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

## Deliberate flakiness

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
