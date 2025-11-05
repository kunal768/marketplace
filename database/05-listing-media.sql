-- Create listing_media table for storing media URLs associated with listings
CREATE TABLE IF NOT EXISTS listing_media (
  id SERIAL PRIMARY KEY,
  listing_id INTEGER NOT NULL,
  media_url TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  CONSTRAINT fk_listing FOREIGN KEY (listing_id)
    REFERENCES listings(id)
    ON DELETE CASCADE
);

-- Index on listing_id for efficient queries
CREATE INDEX IF NOT EXISTS idx_listing_media_listing_id ON listing_media(listing_id);

