-- Enable extensions
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Add tsvector column
ALTER TABLE "Listing" ADD COLUMN IF NOT EXISTS "searchVector" tsvector;

-- Populate search vector for existing rows
UPDATE "Listing" SET "searchVector" =
  setweight(to_tsvector('english', coalesce("title", '')), 'A') ||
  setweight(to_tsvector('english', coalesce("industryNormalized", '')), 'B') ||
  setweight(to_tsvector('english', coalesce("city", '') || ' ' || coalesce("state", '')), 'B') ||
  setweight(to_tsvector('english', coalesce("descriptionClean", '')), 'C');

-- GIN index for full-text search
CREATE INDEX IF NOT EXISTS listing_search_idx ON "Listing" USING GIN ("searchVector");

-- Trigram index for fuzzy matching on title
CREATE INDEX IF NOT EXISTS listing_title_trgm_idx ON "Listing" USING GIN ("title" gin_trgm_ops);

-- Auto-update trigger
CREATE OR REPLACE FUNCTION listing_search_vector_update() RETURNS trigger AS $$
BEGIN
  NEW."searchVector" :=
    setweight(to_tsvector('english', coalesce(NEW."title", '')), 'A') ||
    setweight(to_tsvector('english', coalesce(NEW."industryNormalized", '')), 'B') ||
    setweight(to_tsvector('english', coalesce(NEW."city", '') || ' ' || coalesce(NEW."state", '')), 'B') ||
    setweight(to_tsvector('english', coalesce(NEW."descriptionClean", '')), 'C');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS listing_search_vector_trigger ON "Listing";
CREATE TRIGGER listing_search_vector_trigger
  BEFORE INSERT OR UPDATE OF "title", "industryNormalized", "city", "state", "descriptionClean"
  ON "Listing"
  FOR EACH ROW
  EXECUTE FUNCTION listing_search_vector_update();
