-- One row per test. Descriptive fields come from the most recent attempt, so a
-- renamed describe() block shows its current name.

with attempts as (
    select * from {{ ref('stg_test_results') }}
),

latest as (
    select
        test_id,
        suite,
        file_path,
        describe_path,
        test_title
    from attempts
    qualify row_number() over (partition by test_id order by started_at desc) = 1
),

seen as (
    select
        test_id,
        min(started_at) as first_seen_at,
        max(started_at) as last_seen_at
    from attempts
    group by test_id
)

select
    latest.*,
    -- tests/ui/flaky.spec.ts is unstable on purpose; see the README.
    file_path = 'ui/flaky.spec.ts'                  as is_intentionally_flaky,
    seen.first_seen_at,
    seen.last_seen_at
from latest
inner join seen using (test_id)
