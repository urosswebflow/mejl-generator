-- Run in Supabase SQL Editor for the mejl-generator project.
CREATE TABLE IF NOT EXISTS public.sender_emails (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  email text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT sender_emails_user_email_unique UNIQUE (user_id, email)
);

CREATE INDEX IF NOT EXISTS sender_emails_user_id_idx
  ON public.sender_emails (user_id);

ALTER TABLE public.sender_emails ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users manage own sender emails" ON public.sender_emails;

CREATE POLICY "Users manage own sender emails"
  ON public.sender_emails
  FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
