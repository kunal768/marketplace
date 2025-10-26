BEGIN;

-- Optional reset:
-- TRUNCATE TABLE listings RESTART IDENTITY;

SELECT setseed(0.42);  -- optional reproducibility for this session

WITH params AS (SELECT 2000 AS n)
, words AS (
  SELECT ARRAY['vintage','compact','sleek','premium','budget'] AS adj,
         ARRAY['keyboard','router','lamp','bottle','backpack'] AS noun,
         ARRAY['Like new','Gently used','Well-loved','Good condition'] AS cond,
         ARRAY['textbooks', 'gadgets', 'essentials', 'other']::listing_category[] AS cats,
         ARRAY['AVAILABLE','PENDING','SOLD','ARCHIVED']::listing_status[] AS stats
)
INSERT INTO listings (title, description, price, category, user_id, status, created_at)
SELECT
  -- Title
  initcap( (w.adj)[ 1 + floor(random()*array_length(w.adj,1))::int ] )
  || ' ' ||
  initcap( (w.noun)[ 1 + floor(random()*array_length(w.noun,1))::int ] )
  || ' #' || gs.i,

  -- Description
  (w.cond)[ 1 + floor(random()*array_length(w.cond,1))::int ]
  || '. Ref: ' || substring(md5(gs.i::text),1,10),

  -- Price
  (floor(random()*20000) + 500)::int,

  -- Category
  (w.cats)[ 1 + floor(random()*array_length(w.cats,1))::int ],

  -- User ID
  (floor(random()*200) + 1)::int,

  -- Status
  (w.stats)[ 1 + floor(random()*array_length(w.stats,1))::int ],

  -- created_at
  now() - (random() * interval '180 days')
FROM params
CROSS JOIN words w
CROSS JOIN LATERAL generate_series(1, n) AS gs(i);

COMMIT;
