ALTER TABLE public.messages
  ADD COLUMN IF NOT EXISTS thread_id uuid REFERENCES public.messages(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS messages_thread_created_idx
  ON public.messages (thread_id, created_at ASC);

UPDATE public.messages
SET thread_id = id
WHERE thread_id IS NULL;

UPDATE public.messages AS child
SET thread_id = COALESCE(parent.thread_id, parent.id)
FROM public.messages AS parent
WHERE child.in_reply_to = parent.id
  AND child.thread_id = child.id
  AND parent.id IS NOT NULL;
