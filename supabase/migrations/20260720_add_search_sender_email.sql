ALTER TABLE public.search_history
  ADD COLUMN IF NOT EXISTS sender_email_id uuid
  REFERENCES public.sender_emails(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS search_history_sender_email_id_idx
  ON public.search_history (sender_email_id);
