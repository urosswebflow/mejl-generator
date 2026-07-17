-- Run in Supabase SQL Editor for the mejl-generator project.
ALTER TABLE public.search_history
  ADD COLUMN IF NOT EXISTS extract_email boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.search_history.extract_email IS 'Whether email was extracted from business websites during search';
