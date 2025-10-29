WITH
  words AS (
    SELECT
        ARRAY['vintage','compact','sleek','premium','budget','refurbished','wireless'] AS adj,
        ARRAY['keyboard','router','lamp','bottle','backpack','headphones','calculator'] AS noun,
        ARRAY['Like new','Gently used','Well-loved','Good condition'] AS cond,
        enum_range(NULL::LISTING_CATEGORY)                                            AS cats,
        enum_range(NULL::LISTING_STATUS)                                              AS stats
  ),
  picked AS (
    SELECT
      u.user_id,
      initcap(
        (w.adj[1 + floor(random()*array_length(w.adj,1))::int]) || ' ' ||
        (w.noun[1 + floor(random()*array_length(w.noun,1))::int])
      ) AS title,
      (w.cond[1 + floor(random()*array_length(w.cond,1))::int]) AS description,
      (500 + floor(random()*25000))::int AS price_cents,
      -- pick a random enum by array index
      (w.cats)[ 1 + floor(random()*array_length(w.cats,1))::int ] AS category,
      (w.stats)[ 1 + floor(random()*array_length(w.stats,1))::int ] AS status
    FROM users u
    CROSS JOIN words w
    CROSS JOIN generate_series(1,3) AS gs
  )
INSERT INTO listings (title, description, price, category, user_id, status, created_at)
SELECT title, description, price_cents, category, user_id, status, now()
FROM picked;
