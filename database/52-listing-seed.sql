-- Seed listings with varied categories (robust: no ORDER BY random())
-- Assumes enums LISTING_CATEGORY, LISTING_STATUS and tables users, listings exist.

-- TRUNCATE TABLE listings RESTART IDENTITY CASCADE; -- (optional)

WITH
  -- Build per-category data with VALUES; no "unnest" confusion.
  category_data AS (
    SELECT
      v.category::LISTING_CATEGORY AS category,
      v.titles::text[]             AS titles,
      v.descriptions::text[]       AS descriptions,
      v.min_price_cents::int       AS min_price_cents,
      v.max_price_cents::int       AS max_price_cents
    FROM (VALUES
      ('TEXTBOOK',
        ARRAY['CS 146 Textbook','Math 30 Notes','CMPE 180 Book','Operating Systems Book'],
        ARRAY['Great condition','Like new','Lightly used','Campus pickup available'],
        1500, 15000),
      ('GADGET',
        ARRAY['Bluetooth Speaker','Noise-Canceling Headphones','USB-C Hub','Portable SSD'],
        ARRAY['Great condition','Like new','Lightly used','Campus pickup available'],
        1000, 10000),
      ('ESSENTIAL',
        ARRAY['Shower Caddy','Desk Lamp','Notebook Set','Water Bottle'],
        ARRAY['Great condition','Like new','Lightly used','Campus pickup available'],
        1000, 10000),
      ('NON-ESSENTIAL',
        ARRAY['Poster Pack','String Lights','Collectible Figure','Keycaps Set'],
        ARRAY['Great condition','Like new','Lightly used','Campus pickup available'],
        1000, 10000),
      ('OTHER',
        ARRAY['Misc Bundle','Surplus Item','Grab Bag','Random Lot'],
        ARRAY['Great condition','Like new','Lightly used','Campus pickup available'],
        1000, 10000),
      ('TEST',
        ARRAY['Test Listing A','Test Listing B','Test Listing C','Test Listing D'],
        ARRAY['Great condition','Like new','Lightly used','Campus pickup available'],
        1000, 10000)
    ) AS v(category, titles, descriptions, min_price_cents, max_price_cents)
  ),

  -- N listings per user (change 3 to taste)
  user_listings AS (
    SELECT u.user_id, gs.n AS listing_num
    FROM users u
    CROSS JOIN generate_series(1, 3) AS gs(n)
  ),

  -- Pick a random category per row directly from the enum (no ORDER BY random())
  picked AS (
    SELECT
      ul.user_id,
      (
        enum_range(NULL::LISTING_CATEGORY)
      )[1 + floor(
          random() * array_length(enum_range(NULL::LISTING_CATEGORY), 1)
        )::int]::LISTING_CATEGORY AS category,
      ul.listing_num
    FROM user_listings ul
  ),

  enriched AS (
    SELECT
      p.user_id,
      p.category,
      cd.titles[1 + floor(random() * array_length(cd.titles, 1))::int]              AS title,
      cd.descriptions[1 + floor(random() * array_length(cd.descriptions, 1))::int]  AS description,
      (
        cd.min_price_cents
        + floor(random() * (cd.max_price_cents - cd.min_price_cents + 1))
      )::int                                                                         AS price_cents,
      (
        enum_range(NULL::LISTING_STATUS)
      )[1 + floor(
          random() * array_length(enum_range(NULL::LISTING_STATUS), 1)
        )::int]::LISTING_STATUS                                                      AS status,
      NOW() - (random() * INTERVAL '30 days')                                        AS created_at
    FROM picked p
    JOIN category_data cd ON cd.category = p.category
  )

INSERT INTO listings (title, description, price, category, user_id, status, created_at)
SELECT
  e.title,
  e.description,
  e.price_cents,
  e.category,
  e.user_id,
  e.status,
  e.created_at
FROM enriched e;  -- ✅ alias added
