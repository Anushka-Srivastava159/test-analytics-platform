# Dashboards

`test-health.pbip` is a Power BI project (PBIP): the report and model are saved as text
files — JSON for the report, TMDL for the model — so every change is a readable diff
instead of a binary blob. Open the `.pbip` file in Power BI Desktop.

The report reads the dbt marts in `warehouse/dev.duckdb`, not the CI warehouse directly.
Build them first:

```bash
cd warehouse && ../.venv/Scripts/dbt build
```

## One-time setup (Windows)

1. **DuckDB ODBC driver.** Download `duckdb_odbc-windows-amd64.zip` from the DuckDB
   releases, matching the DuckDB version dbt writes with
   (`.venv/Scripts/python -c "import duckdb; print(duckdb.__version__)"`) — an older driver
   may refuse a newer file format. Unzip it somewhere stable — not a OneDrive folder — and
   run `odbc_install.exe` as administrator.
2. **A DSN named `test_analytics`.** In *ODBC Data Sources (64-bit) → User DSN → Add →
   DuckDB Driver*, set `Database` to the full path of `warehouse/dev.duckdb`.
3. **Make the DSN read-only.** The driver's dialog has no field for it, so set it in the
   registry:

   ```
   reg add "HKCU\Software\ODBC\ODBC.INI\test_analytics" /v access_mode /t REG_SZ /d READ_ONLY /f
   ```

   Without it each connection opens the file read-write and takes an exclusive lock. Power
   BI loads tables in parallel from separate processes, so the first one wins and the rest
   fail with *"The process cannot access the file because it is being used by another
   process."* Read-only connections can share the file.

## Refreshing

DuckDB allows one writer at a time, so dbt and Power BI cannot both hold the file:

1. Close Power BI.
2. `git pull` (new CI runs), then `dbt build` in `warehouse/`.
3. Open the `.pbip` and click **Refresh**.

## Pages

| page | question | reads |
|---|---|---|
| Release readiness | Is the latest run good enough to ship? | `fct_test_outcome`, `dim_run` |

**Release readiness** filters each visual to the newest run (`dim_run[Is latest]`), except
the per-run chart, which shows the last 14 days. *Real failures* counts failed outcomes
outside `tests/ui/flaky.spec.ts`; it is green at 0, red otherwise. Flaky alone does not
block a release.

## Model notes

- **Rates are measures, never averaged columns.** `Flake rate` and `Failure rate` divide
  summed counts, so a day with three runs weighs three times a day with one.
- **Booleans arrive as text.** The DuckDB ODBC driver hands `BOOLEAN` columns to Power BI
  as strings; their types are set to True/False in the model. A new boolean column needs
  the same, or comparisons with `TRUE()`/`FALSE()` fail with `QueryUserError`.
- **One date table.** `Date` drives both `dim_run[run_date]` and
  `rpt_test_stability[run_date]`; Auto date/time is off, so no hidden per-column date
  tables are generated.
- Times are UTC — GitHub's runners' clock.
