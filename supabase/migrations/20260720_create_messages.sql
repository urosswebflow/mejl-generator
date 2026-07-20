CREATE TABLE IF NOT EXISTS public.messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  sender_email_id uuid REFERENCES public.sender_emails(id) ON DELETE SET NULL,
  resend_email_id text,
  resend_received_id text,
  direction text NOT NULL CHECK (direction IN ('inbound', 'outbound')),
  folder text NOT NULL DEFAULT 'inbox' CHECK (folder IN ('inbox', 'sent', 'saved', 'trash')),
  source_folder text,
  from_address text NOT NULL,
  to_address text NOT NULL,
  subject text NOT NULL DEFAULT '',
  body_text text,
  body_html text,
  opened_at timestamptz,
  clicked_at timestamptz,
  open_count integer NOT NULL DEFAULT 0,
  click_count integer NOT NULL DEFAULT 0,
  in_reply_to uuid REFERENCES public.messages(id) ON DELETE SET NULL,
  trashed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS messages_resend_email_id_unique
  ON public.messages (resend_email_id)
  WHERE resend_email_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS messages_resend_received_id_unique
  ON public.messages (resend_received_id)
  WHERE resend_received_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS messages_user_sender_folder_idx
  ON public.messages (user_id, sender_email_id, folder, created_at DESC);

CREATE INDEX IF NOT EXISTS messages_trash_purge_idx
  ON public.messages (trashed_at)
  WHERE folder = 'trash';

ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users manage own messages" ON public.messages;

CREATE POLICY "Users manage own messages"
  ON public.messages
  FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
