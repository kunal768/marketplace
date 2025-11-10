BEGIN;

CREATE EXTENSION IF NOT EXISTS pgcrypto;

WITH
new_users AS (
  SELECT
    'user_' || gs                  AS user_name,
    'user' || gs || '@sjsu.edu'    AS email,
    CASE WHEN gs % 10 = 0 THEN '0' ELSE '1' END AS role,
    jsonb_build_object(
      'Email', 'user' || gs || '@sjsu.edu'
    ) AS contact
  FROM generate_series(1, 500) AS gs
),
added_users_id AS (
  INSERT INTO users (user_name, email, role, contact)
  SELECT * FROM new_users
  ON CONFLICT (email) DO NOTHING
  RETURNING user_id
),
params AS (
  SELECT crypt('Password123!', gen_salt('bf', 10)) AS pw_hash
)
INSERT INTO user_auth (user_id, password)
SELECT a.user_id, p.pw_hash
FROM added_users_id a, params p;


COMMIT;
