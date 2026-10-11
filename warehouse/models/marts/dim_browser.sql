-- One row per Playwright project. The api project runs with no browser at all.

select distinct
    project_name,
    project_name <> 'api'                   as is_browser,
    case project_name
        when 'chromium' then 'Blink'
        when 'firefox'  then 'Gecko'
        when 'webkit'   then 'WebKit'
    end                                     as engine
from {{ ref('stg_test_results') }}
