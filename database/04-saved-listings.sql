-- Saved Listings Table
-- Allows users to save listings for later viewing

CREATE TABLE IF NOT EXISTS saved_listings (
  id BIGSERIAL PRIMARY KEY,
  
  -- FK to the user who saved the listing
  user_id UUID NOT NULL,
  CONSTRAINT fk_saved_user
    FOREIGN KEY (user_id)
    REFERENCES users(user_id)
    ON DELETE CASCADE,  -- remove saved listings if user is deleted

  -- FK to the listing being saved
  listing_id INTEGER NOT NULL,
  CONSTRAINT fk_saved_listing
    FOREIGN KEY (listing_id)
    REFERENCES listings(id)
    ON DELETE CASCADE,  -- remove saved listing if the listing is deleted

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Prevent duplicate saves (user can't save the same listing twice)
  UNIQUE (user_id, listing_id)
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_saved_listings_user ON saved_listings(user_id);
CREATE INDEX IF NOT EXISTS idx_saved_listings_listing ON saved_listings(listing_id);
CREATE INDEX IF NOT EXISTS idx_saved_listings_created ON saved_listings(created_at);

