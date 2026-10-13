-- rpt_test_stability re-aggregates fct_test_outcome by day. Every outcome must land in
-- exactly one day's row, so the per-outcome totals must agree between the two.
with report as (
    select
        sum(passed_count)   as passed,
        sum(flaky_count)    as flaky,
        sum(failed_count)   as failed,
        sum(skipped_count)  as skipped
    from {{ ref('rpt_test_stability') }}
),

source as (
    select
        count(*) filter (where outcome = 'passed')  as passed,
        count(*) filter (where outcome = 'flaky')   as flaky,
        count(*) filter (where outcome = 'failed')  as failed,
        count(*) filter (where outcome = 'skipped') as skipped
    from {{ ref('fct_test_outcome') }}
)

select *
from report, source
where report.passed  <> source.passed
   or report.flaky   <> source.flaky
   or report.failed  <> source.failed
   or report.skipped <> source.skipped
