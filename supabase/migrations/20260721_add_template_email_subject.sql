ALTER TABLE public.proposal_templates
  ADD COLUMN IF NOT EXISTS email_subject text;
