-- PostgreSQL init script for orchestrator users/auth tables

-- Enable pgcrypto for gen_random_uuid()
CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS users (
    user_id    UUID        NOT NULL DEFAULT gen_random_uuid(),
    user_name  TEXT        NOT NULL,
    email      TEXT        NOT NULL,
    role       INTEGER     NOT NULL,
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

-- Helpful indexes
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_user_login_auth_refresh ON user_login_auth(refresh_token);


