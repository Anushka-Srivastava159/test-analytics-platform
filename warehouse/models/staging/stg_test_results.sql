-- One row per test attempt, restricted to the runs that survive stg_runs.

with source as (
    select * from {{ source('raw', 'raw_test_results') }}
),

runs as (
    select run_key from {{ ref('stg_runs') }}
)

select
    source.run_key || '|' || test_id || '|' || project_name || '|' || retry
                                            as attempt_key,
    source.run_key || '|' || test_id || '|' || project_name
                                            as outcome_key,
    source.run_key,
    test_id,
    project_name,
    retry,
    -- The suite is the top-level folder under tests/: ui or api.
    split_part(file_path, '/', 1)           as suite,
    file_path,
    nullif(suite_path, '')                  as describe_path,
    test_title,
    status,
    rollup_status                           as playwright_rollup_status,
    retry = max(retry) over (
        partition by source.run_key, test_id, project_name
    )                                       as is_final_attempt,
    duration_ms,
    started_at,
    worker_index,
    nullif(error_message, '')               as error_message,
    nullif(error_location, '')              as error_location
from source
inner join runs on runs.run_key = source.run_key
