ALTER TABLE public.proposal_templates
  ADD COLUMN IF NOT EXISTS name_only boolean NOT NULL DEFAULT false;
