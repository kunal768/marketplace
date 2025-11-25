-- 1) Enums
DO $$ BEGIN
CREATE TYPE LISTING_CATEGORY AS ENUM ('TEXTBOOK', 'GADGET', 'ESSENTIAL', 'NON-ESSENTIAL', 'OTHER');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE LISTING_STATUS AS ENUM ('AVAILABLE','PENDING','SOLD','ARCHIVED', 'REPORTED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 2) Table for listings. Requires the users table to link the userid to
CREATE TABLE IF NOT EXISTS listings (
  id SERIAL PRIMARY KEY,
  title VARCHAR(255) NOT NULL,
  description TEXT,
  price INTEGER NOT NULL,          -- smallest unit (e.g., cents)
  category LISTING_CATEGORY NOT NULL,

  -- user_id link to the users table
  user_id UUID NOT NULL,
  CONSTRAINT fk_user FOREIGN KEY (user_id)
      REFERENCES users(user_id)
      ON DELETE CASCADE,

  status LISTING_STATUS DEFAULT 'AVAILABLE',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3) Helpful indexes
CREATE INDEX IF NOT EXISTS idx_listings_category ON listings(category);
CREATE INDEX IF NOT EXISTS idx_listings_status ON listings(status);
CREATE INDEX IF NOT EXISTS idx_listings_price ON listings(price);
CREATE INDEX IF NOT EXISTS idx_listings_user ON listings(user_id);
CREATE INDEX IF NOT EXISTS idx_listings_created ON listings(created_at);