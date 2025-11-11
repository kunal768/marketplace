-- 1) Flag enums (adjust values as needed)
DO $$ BEGIN
  CREATE TYPE FLAG_REASON AS ENUM ('SPAM', 'SCAM', 'INAPPROPRIATE', 'MISLEADING', 'OTHER');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE FLAG_STATUS AS ENUM ('OPEN', 'UNDER_REVIEW', 'RESOLVED', 'DISMISSED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 2) Flags table, normalized and linked to listings + users
CREATE TABLE IF NOT EXISTS flagged_listings (
  id BIGSERIAL PRIMARY KEY,

  -- FK to the listing being flagged
  listing_id INTEGER NOT NULL,
  CONSTRAINT fk_flag_listing
    FOREIGN KEY (listing_id)
    REFERENCES listings(id)
    ON DELETE CASCADE,   -- delete flags if the listing is deleted

  -- Who reported it (optional if you allow anonymous)
  reporter_user_id UUID,
  CONSTRAINT fk_flag_reporter
    FOREIGN KEY (reporter_user_id)
    REFERENCES users(user_id)
    ON DELETE SET NULL,  -- keep the flag even if reporter account is removed

  reason FLAG_REASON NOT NULL,
  details TEXT,                    -- free-text note from reporter
  status FLAG_STATUS NOT NULL DEFAULT 'OPEN',

  -- Moderation fields
  reviewer_user_id UUID,           -- admin who handled the flag
  CONSTRAINT fk_flag_reviewer
    FOREIGN KEY (reviewer_user_id)
    REFERENCES users(user_id)
    ON DELETE SET NULL,

  resolution_notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  resolved_at TIMESTAMPTZ
);

-- 3) Useful indexes
CREATE INDEX IF NOT EXISTS idx_flagged_listings_listing ON flagged_listings(listing_id);
CREATE INDEX IF NOT EXISTS idx_flagged_listings_status  ON flagged_listings(status);
CREATE INDEX IF NOT EXISTS idx_flagged_listings_created ON flagged_listings(created_at);

