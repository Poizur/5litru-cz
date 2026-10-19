-- Klik bez refereru: přesměruje se normálně, ale nepočítá se mezi lidské kliky.
ALTER TABLE affiliate_clicks ADD COLUMN IF NOT EXISTS unverified BOOLEAN NOT NULL DEFAULT false;
