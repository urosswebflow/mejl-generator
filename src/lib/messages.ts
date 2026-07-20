export type MessageFolder = "inbox" | "sent" | "saved" | "trash";
export type MessageDirection = "inbound" | "outbound";

export type MessageRow = {
  id: string;
  user_id: string;
  sender_email_id: string | null;
  resend_email_id: string | null;
  resend_received_id: string | null;
  direction: MessageDirection;
  folder: MessageFolder;
  source_folder: MessageFolder | null;
  from_address: string;
  to_address: string;
  subject: string;
  body_text: string | null;
  body_html: string | null;
  opened_at: string | null;
  clicked_at: string | null;
  open_count: number;
  click_count: number;
  in_reply_to: string | null;
  thread_id: string | null;
  trashed_at: string | null;
  created_at: string;
  updated_at: string;
};

export function normalizeEmailAddress(value: string) {
  const trimmed = value.trim();

  const bracketMatch = trimmed.match(/<([^>]+)>/);
  if (bracketMatch?.[1]) {
    return bracketMatch[1].trim().toLowerCase();
  }

  return trimmed.toLowerCase();
}

export function getSentFolderForDirection(direction: MessageDirection): MessageFolder {
  return direction === "outbound" ? "sent" : "inbox";
}
