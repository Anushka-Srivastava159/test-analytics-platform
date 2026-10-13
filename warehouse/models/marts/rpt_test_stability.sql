-- Grain: one test, in one browser, on one day. The table both dashboards read, so
-- flake rate and duration percentiles are defined once here, not twice in two BI tools.
--
-- A day can hold more than one run (push + nightly). Rates are over outcomes that ran:
-- skipped outcomes are counted but kept out of the denominator.

with outcomes as (
    select * from {{ ref('fct_test_outcome') }}
),

runs as (
    select run_key, run_date from {{ ref('dim_run') }}
),

daily as (
    select
        outcomes.test_id,
        outcomes.project_name,
        runs.run_date,
        count(*)                                            as outcome_count,
        count(*) filter (where outcome = 'passed')          as passed_count,
        count(*) filter (where outcome = 'flaky')           as flaky_count,
        count(*) filter (where outcome = 'failed')          as failed_count,
        count(*) filter (where outcome = 'skipped')         as skipped_count,
        sum(attempt_count - 1)                              as retry_count,
        -- Durations from attempts that passed only: a timed-out attempt is cut off at
        -- the timeout, so it would report the budget rather than how long the test took.
        quantile_cont(final_duration_ms, 0.5)
            filter (where outcome in ('passed', 'flaky'))   as p50_duration_ms,
        quantile_cont(final_duration_ms, 0.95)
            filter (where outcome in ('passed', 'flaky'))   as p95_duration_ms
    from outcomes
    inner join runs using (run_key)
    group by all
)

select
    daily.test_id || '|' || daily.project_name || '|' || daily.run_date
                                                            as stability_key,
    daily.test_id,
    daily.project_name,
    daily.run_date,
    dim_test.suite,
    dim_test.test_title,
    dim_test.is_intentionally_flaky,
    daily.outcome_count,
    daily.passed_count,
    daily.flaky_count,
    daily.failed_count,
    daily.skipped_count,
    daily.retry_count,
    daily.flaky_count  / nullif(daily.outcome_count - daily.skipped_count, 0)
                                                            as flake_rate,
    daily.failed_count / nullif(daily.outcome_count - daily.skipped_count, 0)
                                                            as failure_rate,
    daily.p50_duration_ms,
    daily.p95_duration_ms
from daily
inner join {{ ref('dim_test') }} as dim_test using (test_id)
