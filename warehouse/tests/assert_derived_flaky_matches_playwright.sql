-- The flaky outcome is derived from retry counts, not taken from Playwright. This
-- checks the derivation agrees with Playwright's own rollup for every group.
select outcome_key, outcome, playwright_rollup_status
from {{ ref('fct_test_outcome') }}
where (outcome = 'flaky') <> (playwright_rollup_status = 'flaky')
   or (outcome = 'failed') <> (playwright_rollup_status = 'unexpected')
