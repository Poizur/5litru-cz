-- Retroaktivní oprava bot kliků: is_test=false → true pro known bot UAs.
-- Spustit v Supabase SQL Editor (jednou).
UPDATE affiliate_clicks
SET is_test = true
WHERE is_test = false
  AND (
    lower(user_agent) LIKE '%bot%'           OR
    lower(user_agent) LIKE '%crawler%'       OR
    lower(user_agent) LIKE '%spider%'        OR
    lower(user_agent) LIKE '%jscrawler%'     OR
    lower(user_agent) LIKE '%meta-webindexer%' OR
    lower(user_agent) LIKE '%semrush%'       OR
    lower(user_agent) LIKE '%ahref%'
  );
-- Ověření: SELECT count(*) FROM affiliate_clicks WHERE is_test=false AND lower(user_agent) LIKE '%bot%';
