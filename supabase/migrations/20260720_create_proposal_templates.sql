CREATE TABLE IF NOT EXISTS public.proposal_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  content_text text NOT NULL,
  original_filename text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS proposal_templates_user_name_unique
  ON public.proposal_templates (user_id, name);

CREATE INDEX IF NOT EXISTS proposal_templates_user_created_idx
  ON public.proposal_templates (user_id, created_at DESC);

ALTER TABLE public.proposal_templates ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users manage own proposal templates" ON public.proposal_templates;

CREATE POLICY "Users manage own proposal templates"
  ON public.proposal_templates
  FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

ALTER TABLE public.search_history
  ADD COLUMN IF NOT EXISTS active_template_id uuid
  REFERENCES public.proposal_templates(id) ON DELETE SET NULL;
