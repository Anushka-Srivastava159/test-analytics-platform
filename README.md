# Test Analytics Platform

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
