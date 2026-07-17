-- Run this migration on your Supabase project (Dashboard → SQL Editor).
ALTER TABLE public.search_history
  ADD COLUMN IF NOT EXISTS website_filter text NOT NULL DEFAULT 'any',
  ADD COLUMN IF NOT EXISTS reviews_min integer,
  ADD COLUMN IF NOT EXISTS reviews_max integer,
  ADD COLUMN IF NOT EXISTS proposal_example_text text,
  ADD COLUMN IF NOT EXISTS proposal_example_filename text;

COMMENT ON COLUMN public.search_history.website_filter IS 'any | required | forbidden';
COMMENT ON COLUMN public.search_history.reviews_min IS 'Minimum Google review count filter';
COMMENT ON COLUMN public.search_history.reviews_max IS 'Maximum Google review count filter';
COMMENT ON COLUMN public.search_history.proposal_example_text IS 'Extracted text from uploaded proposal example';
COMMENT ON COLUMN public.search_history.proposal_example_filename IS 'Original filename of uploaded proposal example';
