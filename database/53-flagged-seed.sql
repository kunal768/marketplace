-- Seed flagged_listings table with flags for all listings that have REPORTED status
-- Assumes enums FLAG_REASON, FLAG_STATUS and tables users, listings, flagged_listings exist.

WITH
  -- Get all reported listings
  reported_listings AS (
    SELECT id AS listing_id
    FROM listings
    WHERE status = 'REPORTED'
  ),
  
  -- Generate synthetic flag reasons and descriptions
  flag_data AS (
    SELECT
      v.reason::FLAG_REASON AS reason,
      v.descriptions::text[] AS descriptions,
      row_number() OVER (ORDER BY reason) AS reason_idx
    FROM (VALUES
      ('SPAM',
        ARRAY[
          'This listing appears to be spam or a duplicate posting.',
          'Multiple identical listings from the same user.',
          'Suspicious posting pattern detected.',
          'This item has been posted repeatedly.'
        ]),
      ('SCAM',
        ARRAY[
          'Price seems too good to be true, potential scam.',
          'Seller is asking for payment upfront without meeting.',
          'Suspicious contact information provided.',
          'Listing appears fraudulent based on user reports.'
        ]),
      ('INAPPROPRIATE',
        ARRAY[
          'Content violates community guidelines.',
          'Inappropriate language or imagery in listing.',
          'Item description contains offensive material.',
          'Listing promotes prohibited items or services.'
        ]),
      ('MISLEADING',
        ARRAY[
          'Listing title or description is misleading.',
          'Item condition does not match description.',
          'Price information is inaccurate or misleading.',
          'Photos do not accurately represent the item.'
        ]),
      ('OTHER',
        ARRAY[
          'This listing has been reported for various concerns.',
          'Multiple users have flagged this listing.',
          'Listing requires review by moderators.',
          'General concerns about this listing.'
        ])
    ) AS v(reason, descriptions)
  ),
  
  flag_count AS (
    SELECT COUNT(*)::int AS cnt FROM flag_data
  ),
  
  -- Assign random users and flag data to each reported listing
  flagged AS (
    SELECT
      rl.listing_id,
      (
        SELECT user_id
        FROM users
        ORDER BY random()
        LIMIT 1
      ) AS reporter_user_id,
      fd.reason,
      fd.descriptions[1 + floor(random() * array_length(fd.descriptions, 1))::int] AS details,
      (
        enum_range(NULL::FLAG_STATUS)
      )[1 + floor(
          random() * array_length(enum_range(NULL::FLAG_STATUS), 1)
        )::int]::FLAG_STATUS AS status,
      NOW() - (random() * INTERVAL '14 days') AS created_at
    FROM reported_listings rl
    CROSS JOIN flag_count fc
    CROSS JOIN LATERAL (
      SELECT reason, descriptions
      FROM flag_data
      WHERE reason_idx = 1 + ((rl.listing_id + floor(random() * 1000)::int) % fc.cnt)
      LIMIT 1
    ) AS fd
  )

INSERT INTO flagged_listings (listing_id, reporter_user_id, reason, details, status, created_at)
SELECT
  f.listing_id,
  f.reporter_user_id,
  f.reason,
  f.details,
  f.status,
  f.created_at
FROM flagged f
ON CONFLICT DO NOTHING;

