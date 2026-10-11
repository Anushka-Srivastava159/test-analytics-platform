-- Grain: one test, in one browser, in one run — whatever happened across its retries.
--
-- Playwright has no per-attempt "flaky" status; it is derived here: the final attempt
-- passed but an earlier one did not. playwright_rollup_status is kept alongside so the
-- derivation can be checked against Playwright's own verdict (see tests/).

with attempts as (
    select * from {{ ref('stg_test_results') }}
),

grouped as (
    select
        outcome_key,
        run_key,
        test_id,
        project_name,
        count(*)                                        as attempt_count,
        max(retry)                                      as max_retry,
        max(status) filter (where is_final_attempt)     as final_status,
        sum(duration_ms)                                as total_duration_ms,
        max(duration_ms) filter (where is_final_attempt) as final_duration_ms,
        min(started_at)                                 as started_at,
        any_value(playwright_rollup_status)             as playwright_rollup_status,
        max(error_message) filter (where retry = 0)     as first_error_message
    from attempts
    group by all
)

select
    *,
    case
        when final_status = 'skipped'                   then 'skipped'
        when final_status = 'passed' and max_retry > 0  then 'flaky'
        when final_status = 'passed'                    then 'passed'
        else 'failed'
    end                                                 as outcome
from grouped
