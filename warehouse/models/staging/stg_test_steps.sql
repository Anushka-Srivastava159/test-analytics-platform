-- One row per test.step() inside an attempt.

with source as (
    select * from {{ source('raw', 'raw_test_steps') }}
),

runs as (
    select run_key from {{ ref('stg_runs') }}
)

select
    source.run_key || '|' || test_id || '|' || project_name || '|' || retry
                                            as attempt_key,
    source.run_key,
    test_id,
    project_name,
    retry,
    step_index,
    -- A typo ('asset') crept into the step title in the spec on 2026-09-14 and was
    -- later reverted. Map it back to 'assert' so the step keeps one continuous trend.
    case step_title
        when 'asset inventory reached' then 'assert inventory reached'
        else step_title
    end                                     as step_title,
    duration_ms
from source
inner join runs on runs.run_key = source.run_key
