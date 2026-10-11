-- test_id is hashed from the file path, so one id with two paths means a path was
-- not normalised (ui\login.spec.ts vs ui/login.spec.ts) and the test has split.
select test_id, count(distinct file_path) as paths
from {{ ref('stg_test_results') }}
group by test_id
having count(distinct file_path) > 1
