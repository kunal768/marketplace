BEGIN;

-- Ensure pgcrypto is available (UUIDs)
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Reproducible synthetic data
SELECT setseed(0.42);

-- Synthetic data of 50 users
WITH new_users AS (
  SELECT
    'user_' || gs                              AS user_name,
    'user' || gs || '@sjsu.edu'             AS email,
    (CASE WHEN gs % 10 = 0 THEN 1 ELSE 0 END)  AS role,               -- sprinkle some admins
    jsonb_build_object(
      'Email', 'user' || gs || '@sjsu.edu' ,
      'Phone', '+1-555-' || to_char(1000+gs, 'FM0000')
    )                                          AS contact
  FROM generate_series(1, 50) AS gs
),

-- Insert these 50 into the database
added_users_id AS (
  INSERT INTO users (user_name, email, role, contact)
  SELECT * FROM new_users
  ON CONFLICT (email) DO NOTHING  -- keep it re-runnable
  RETURNING user_id
)


-- For every inserted user, add the same password
INSERT INTO user_auth (user_id, password)
SELECT
  user_id,
  crypt('Password123!', gen_salt('bf', 10)) -- bcrypt with cost=10
FROM added_users_id;

COMMIT;
