# Test Analytics Platform

Playwright tests run in CI, emit structured results to a warehouse, get modelled with dbt,
and surface as a test-health dashboard in Power BI and Tableau.

**Stack:** Playwright + TypeScript · GitHub Actions · Docker · Python ETL · dbt-duckdb · DuckDB · Power BI / Tableau

## Status

Phase 0 — repo scaffold.

## Layout (planned)

```
tests/        Playwright specs
etl/          Python: parse Playwright JSON reports -> DuckDB
warehouse/    DuckDB file + dbt project
dashboards/   Power BI / Tableau assets
```
