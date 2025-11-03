-- Enable pgcrypto for gen_random_uuid()
CREATE EXTENSION IF NOT EXISTS pgcrypto;

------------------------------------------------------------------
--               DROP TABLES & TYPES (to start fresh)           --
------------------------------------------------------------------
-- Drop tables in order of dependency
DROP TABLE IF EXISTS user_login_auth;
DROP TABLE IF EXISTS user_auth;
DROP TABLE IF EXISTS listings;
DROP TABLE IF EXISTS users;

-- Drop custom types
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

-- Create custom ENUM types for listings (from listings script)
CREATE TYPE LISTING_STATUS AS ENUM ('AVAILABLE', 'SOLD', 'REPORTED');
CREATE TYPE LISTING_CATEGORY AS ENUM ('textbooks', 'gadgets', 'essentials', 'other');

-- Create the listings table (from listings script, modified)
CREATE TABLE listings (
    id SERIAL PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    price INTEGER NOT NULL, -- Price in the smallest currency unit (e.g., cents)
    category LISTING_CATEGORY NOT NULL,
    
    -- MODIFIED: Changed user_id to UUID to reference the new users table
    user_id UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    
    status LISTING_STATUS DEFAULT 'AVAILABLE',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);


------------------------------------------------------------------
--                         INDEXES                              --
------------------------------------------------------------------

-- Indexes from auth script
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_user_login_auth_refresh ON user_login_auth(refresh_token);

-- Index from listings script
CREATE INDEX IF NOT EXISTS idx_listings_category ON listings(category);


------------------------------------------------------------------
--                    COMBINED SEED DATA                        --
------------------------------------------------------------------

-- Insert a sample user (using the new auth table structure)
-- We use a Common Table Expression (CTE) to capture the new UUID
WITH seeded_user AS (
    INSERT INTO users (user_name, email, role, contact, created_at, updated_at)
    VALUES (
        'Sample Seller',            -- user_name
        'seller@sjsu.edu',          -- email
        0,                          -- role (e.g., 0 for user)
        '{}'::jsonb,                -- contact (empty JSON)
        NOW(),                      -- created_at
        NOW()                       -- updated_at
    )
    -- If email exists from a previous run, update it and return its ID
    ON CONFLICT (email) DO UPDATE 
    SET user_name = EXCLUDED.user_name
    RETURNING user_id
)
-- Insert sample listings referencing the user_id from the CTE
-- Note: We removed the manual IDs (e.g., 1, 2, 3) as 'id' is now SERIAL
INSERT INTO listings (title, description, price, category, user_id, status)
VALUES
('CMPE202 Advanced Algorithms Textbook', 'Barely used textbook for the CMPE202 class. No highlighting.', 4500, 'textbooks', (SELECT user_id FROM seeded_user), 'AVAILABLE'),
('Small Microwave for Dorm Room', 'Works perfectly, great for heating up snacks. Moving out and need to sell.', 2500, 'gadgets', (SELECT user_id FROM seeded_user), 'AVAILABLE'),
('Official SJSU Hoodie - Large', 'Official university hoodie, worn a few times. Very comfortable.', 1500, 'essentials', (SELECT user_id FROM seeded_user), 'AVAILABLE'),
('Logitech MX Master 3 Mouse', 'Best mouse for productivity. In great condition with original box.', 6000, 'gadgets', (SELECT user_id FROM seeded_user), 'AVAILABLE'),
('CHEM1A General Chemistry Textbook', 'Required textbook for the introductory chemistry course. Latest edition.', 3500, 'textbooks', (SELECT user_id FROM seeded_user), 'SOLD');


-- Reset sequence for listings after seeding to avoid conflicts
SELECT setval('listings_id_seq', (SELECT MAX(id) from "listings"), true);