BEGIN;

SELECT setseed(0.42);

WITH params AS (
  SELECT 2000 AS n
),
words AS (
  SELECT
    ARRAY['vintage','compact','sleek','premium','budget']                         AS adj,
    ARRAY['keyboard','router','lamp','bottle','backpack', 'textbook', 'computer'] AS noun,
    ARRAY['Like new','Gently used','Well-loved','Good condition']                 AS cond,
    enum_range(NULL::LISTING_CATEGORY)                                            AS cats,
    enum_range(NULL::LISTING_STATUS)                                              AS stats
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

  -- Price (integer cents or whole units—adjust as needed)
  (floor(random()*20000) + 500)::int,

  -- Category (sample from enum array)
  (w.cats)[ 1 + floor(random()*array_length(w.cats,1))::int ],

  -- User ID
  (floor(random()*200) + 1)::int,

  -- Status (sample from enum array)
  (w.stats)[ 1 + floor(random()*array_length(w.stats,1))::int ],

  -- created_at
  now() - (random() * interval '180 days')
FROM params
CROSS JOIN words w
CROSS JOIN LATERAL generate_series(1, n) AS gs(i);

COMMIT;
