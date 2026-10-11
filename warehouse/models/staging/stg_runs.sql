-- One row per run, minus the runs listed in var('excluded_run_keys').

with source as (
    select * from {{ source('raw', 'raw_runs') }}
)

select
    run_key,
    -- Runs from before run identity was stamped into the report say 'local' although
    -- they ran in CI. Their real GitHub run id is not recoverable from the report.
    nullif(run_id, 'local')             as github_run_id,
    run_id <> 'local'                   as has_run_identity,
    run_attempt,
    nullif(commit_sha, '')              as commit_sha,
    nullif(branch, '')                  as branch,
    is_ci,
    actual_workers,
    started_at,
    cast(started_at as date)            as run_date,
    duration_ms,
    expected                            as reported_expected,
    unexpected                          as reported_unexpected,
    flaky                               as reported_flaky,
    skipped                             as reported_skipped,
    ingested_at,
    source                              as ingest_source
from source
where run_key not in (
    {%- for key in var('excluded_run_keys') %}
    '{{ key }}'{{ ',' if not loop.last }}
    {%- endfor %}
)
