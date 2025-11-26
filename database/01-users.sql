-- Enable pgcrypto for gen_random_uuid()
CREATE EXTENSION IF NOT EXISTS pgcrypto;

------------------------------------------------------------------
--               DROP TABLES & TYPES (to start fresh)           --
------------------------------------------------------------------
-- Drop tables in order of dependency
DROP TABLE IF EXISTS flagged_listings;
DROP TABLE IF EXISTS listing_media;
DROP TABLE IF EXISTS saved_listings;
DROP TABLE IF EXISTS user_login_auth;
DROP TABLE IF EXISTS user_auth;
DROP TABLE IF EXISTS listings;
DROP TABLE IF EXISTS users;

-- Drop custom types
DROP TYPE IF EXISTS FLAG_REASON;
DROP TYPE IF EXISTS FLAG_STATUS;
DROP TYPE IF EXISTS LISTING_STATUS;
DROP TYPE IF EXISTS LISTING_CATEGORY;


------------------------------------------------------------------
--               TABLE & TYPE DEFINITIONS                       --
------------------------------------------------------------------

-- Create the users table (from auth script)
CREATE TABLE IF NOT EXISTS users (
    user_id    UUID        NOT NULL DEFAULT gen_random_uuid(),
    user_name  TEXT        NOT NULL,
    email      TEXT        NOT NULL,
    role       TEXT        NOT NULL,
    contact    JSONB       NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (user_id, email),
    UNIQUE (user_id),
    UNIQUE (email)
);

-- Store password hashes
CREATE TABLE IF NOT EXISTS user_auth (
    user_id    UUID        PRIMARY KEY REFERENCES users(user_id) ON DELETE CASCADE,
    password   TEXT        NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Store latest access/refresh tokens per user
CREATE TABLE IF NOT EXISTS user_login_auth (
    user_id       UUID        PRIMARY KEY REFERENCES users(user_id) ON DELETE CASCADE,
    access_token  TEXT        NOT NULL,
    refresh_token TEXT        NOT NULL UNIQUE,
    expires_at    TIMESTAMPTZ NOT NULL,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at    TIMESTAMPTZ NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_user_login_auth_refresh ON user_login_auth(refresh_token);
CREATE INDEX IF NOT EXISTS idx_users_user_name_lower ON users(LOWER(user_name));
