-- Grain: one test attempt. The retry that failed before a pass is its own row —
-- folding them together would discard what makes flakiness computable.

select
    attempt_key,
    outcome_key,
    run_key,
    test_id,
    project_name,
    retry,
    status,
    is_final_attempt,
    duration_ms,
    started_at,
    worker_index,
    error_message,
    error_location
from {{ ref('stg_test_results') }}
