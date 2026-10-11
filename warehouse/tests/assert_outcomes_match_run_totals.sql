-- Each run's derived outcome counts must equal the totals Playwright reported for it.
with derived as (
    select
        run_key,
        count(*) filter (where outcome = 'flaky')   as flaky,
        count(*) filter (where outcome = 'failed')  as failed,
        count(*) filter (where outcome = 'passed')  as passed
    from {{ ref('fct_test_outcome') }}
    group by run_key
)

select dim_run.run_key
from {{ ref('dim_run') }} as dim_run
left join derived using (run_key)
where coalesce(derived.flaky, 0)  <> dim_run.reported_flaky
   or coalesce(derived.failed, 0) <> dim_run.reported_unexpected
   or coalesce(derived.passed, 0) <> dim_run.reported_expected
