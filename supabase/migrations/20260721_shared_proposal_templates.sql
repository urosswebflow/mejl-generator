DROP INDEX IF EXISTS proposal_templates_user_name_unique;

CREATE UNIQUE INDEX IF NOT EXISTS proposal_templates_name_unique
  ON public.proposal_templates (name);

DROP POLICY IF EXISTS "Users manage own proposal templates" ON public.proposal_templates;

CREATE POLICY "Authenticated users read all proposal templates"
  ON public.proposal_templates
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users create proposal templates"
  ON public.proposal_templates
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users delete own proposal templates"
  ON public.proposal_templates
  FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users update own proposal templates"
  ON public.proposal_templates
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
