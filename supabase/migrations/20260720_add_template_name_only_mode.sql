ALTER TABLE public.proposal_templates
  ADD COLUMN IF NOT EXISTS name_only_mode boolean NOT NULL DEFAULT false;

ALTER TABLE public.proposal_templates
  ADD COLUMN IF NOT EXISTS template_owner_name text;
