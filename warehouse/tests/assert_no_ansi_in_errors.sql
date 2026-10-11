-- Ingest strips Playwright's terminal colour codes. Any left would show up on the
-- dashboard as escape sequences.
select attempt_key, error_message
from {{ ref('fct_test_run') }}
where error_message like '%' || chr(27) || '%'
