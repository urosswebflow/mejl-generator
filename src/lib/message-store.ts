import type { SupabaseClient } from "@supabase/supabase-js";
import { plainTextToHtml } from "@/lib/email-html";
import type { MessageFolder, MessageRow } from "@/lib/messages";
import { normalizeEmailAddress } from "@/lib/messages";

async function resolveThreadIdFromReply(
  supabase: SupabaseClient,
  inReplyTo?: string | null
) {
  if (!inReplyTo) {
    return null;
  }

  const { data, error } = await supabase
    .from("messages")
    .select("thread_id,id")
    .eq("id", inReplyTo)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  if (!data) {
    return null;
  }

  return data.thread_id || data.id;
}

async function findThreadIdForCounterparty(
  supabase: SupabaseClient,
  params: {
    userId: string;
    senderEmailId: string;
    emailAddress: string;
  }
) {
  const normalized = normalizeEmailAddress(params.emailAddress);

  const { data, error } = await supabase
    .from("messages")
    .select("thread_id,id,from_address,to_address")
    .eq("user_id", params.userId)
    .eq("sender_email_id", params.senderEmailId)
    .order("created_at", { ascending: false })
    .limit(100);

  if (error) {
    throw new Error(error.message);
  }

  for (const row of data || []) {
    if (
      normalizeEmailAddress(row.from_address) === normalized ||
      normalizeEmailAddress(row.to_address) === normalized
    ) {
      return row.thread_id || row.id;
    }
  }

  return null;
}

async function ensureMessageThreadId(
  supabase: SupabaseClient,
  message: MessageRow,
  preferredThreadId?: string | null
) {
  const threadId = preferredThreadId || message.thread_id || message.id;

  if (message.thread_id === threadId) {
    return threadId;
  }

  const { error } = await supabase
    .from("messages")
    .update({
      thread_id: threadId,
      updated_at: new Date().toISOString(),
    })
    .eq("id", message.id);

  if (error) {
    throw new Error(error.message);
  }

  return threadId;
}

export async function findSenderEmailByAddress(
  supabase: SupabaseClient,
  emailAddress: string
) {
  const normalized = normalizeEmailAddress(emailAddress);

  const { data, error } = await supabase
    .from("sender_emails")
    .select("id,user_id,email")
    .ilike("email", normalized)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  return data;
}

export async function insertOutboundMessage(
  supabase: SupabaseClient,
  params: {
    userId: string;
    senderEmailId: string;
    from: string;
    to: string;
    subject: string;
    text: string;
    inReplyTo?: string | null;
  }
) {
  const now = new Date().toISOString();
  const html = plainTextToHtml(params.text);
  const threadId = await resolveThreadIdFromReply(supabase, params.inReplyTo);

  const { data, error } = await supabase
    .from("messages")
    .insert({
      user_id: params.userId,
      sender_email_id: params.senderEmailId,
      direction: "outbound",
      folder: "sent",
      from_address: params.from,
      to_address: params.to,
      subject: params.subject,
      body_text: params.text,
      body_html: html,
      in_reply_to: params.inReplyTo || null,
      thread_id: threadId,
      updated_at: now,
    })
    .select("*")
    .single();

  if (error || !data) {
    throw new Error(error?.message || "Poruka nije sačuvana.");
  }

  const message = data as MessageRow;
  await ensureMessageThreadId(supabase, message, threadId);

  return {
    ...message,
    thread_id: threadId || message.id,
  } as MessageRow;
}

export async function attachResendEmailId(
  supabase: SupabaseClient,
  messageId: string,
  resendEmailId: string
) {
  const { error } = await supabase
    .from("messages")
    .update({
      resend_email_id: resendEmailId,
      updated_at: new Date().toISOString(),
    })
    .eq("id", messageId);

  if (error) {
    throw new Error(error.message);
  }
}

export async function findMessageById(
  supabase: SupabaseClient,
  messageId: string,
  userId: string
) {
  const { data, error } = await supabase
    .from("messages")
    .select("*")
    .eq("id", messageId)
    .eq("user_id", userId)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  return (data as MessageRow | null) || null;
}

export async function findLatestOutboundMessageToRecipient(
  supabase: SupabaseClient,
  params: {
    userId: string;
    senderEmailId: string;
    recipientEmail: string;
  }
) {
  const { data, error } = await supabase
    .from("messages")
    .select("*")
    .eq("user_id", params.userId)
    .eq("sender_email_id", params.senderEmailId)
    .eq("direction", "outbound")
    .eq("to_address", params.recipientEmail.trim().toLowerCase())
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  return (data as MessageRow | null) || null;
}

export async function findMessageByResendEmailId(
  supabase: SupabaseClient,
  resendEmailId: string
) {
  const { data, error } = await supabase
    .from("messages")
    .select("*")
    .eq("resend_email_id", resendEmailId)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  return (data as MessageRow | null) || null;
}

export async function findMessageByAppTag(
  supabase: SupabaseClient,
  appMessageId: string
) {
  const { data, error } = await supabase
    .from("messages")
    .select("*")
    .eq("id", appMessageId)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  return (data as MessageRow | null) || null;
}

export async function markMessageOpened(
  supabase: SupabaseClient,
  messageId: string,
  eventTime: string
) {
  const { data: existing, error: readError } = await supabase
    .from("messages")
    .select("open_count,opened_at")
    .eq("id", messageId)
    .maybeSingle();

  if (readError || !existing) {
    return;
  }

  const { error } = await supabase
    .from("messages")
    .update({
      opened_at: existing.opened_at || eventTime,
      open_count: (existing.open_count || 0) + 1,
      updated_at: new Date().toISOString(),
    })
    .eq("id", messageId);

  if (error) {
    throw new Error(error.message);
  }
}

export async function markMessageClicked(
  supabase: SupabaseClient,
  messageId: string,
  eventTime: string
) {
  const { data: existing, error: readError } = await supabase
    .from("messages")
    .select("click_count,clicked_at")
    .eq("id", messageId)
    .maybeSingle();

  if (readError || !existing) {
    return;
  }

  const { error } = await supabase
    .from("messages")
    .update({
      clicked_at: existing.clicked_at || eventTime,
      click_count: (existing.click_count || 0) + 1,
      updated_at: new Date().toISOString(),
    })
    .eq("id", messageId);

  if (error) {
    throw new Error(error.message);
  }
}

export async function insertInboundMessage(
  supabase: SupabaseClient,
  params: {
    userId: string;
    senderEmailId: string;
    resendReceivedId: string;
    from: string;
    to: string;
    subject: string;
    bodyText: string | null;
    bodyHtml: string | null;
    inReplyTo?: string | null;
    counterpartyEmail?: string | null;
  }
) {
  let threadId = await resolveThreadIdFromReply(supabase, params.inReplyTo);

  if (!threadId && params.counterpartyEmail) {
    threadId = await findThreadIdForCounterparty(supabase, {
      userId: params.userId,
      senderEmailId: params.senderEmailId,
      emailAddress: params.counterpartyEmail,
    });
  }

  const { data, error } = await supabase
    .from("messages")
    .insert({
      user_id: params.userId,
      sender_email_id: params.senderEmailId,
      resend_received_id: params.resendReceivedId,
      direction: "inbound",
      folder: "inbox",
      from_address: params.from,
      to_address: params.to,
      subject: params.subject,
      body_text: params.bodyText,
      body_html: params.bodyHtml,
      in_reply_to: params.inReplyTo || null,
      thread_id: threadId,
      updated_at: new Date().toISOString(),
    })
    .select("*")
    .single();

  if (error) {
    if (error.code === "23505") {
      const { data: existing } = await supabase
        .from("messages")
        .select("*")
        .eq("resend_received_id", params.resendReceivedId)
        .maybeSingle();

      return (existing as MessageRow | null) || null;
    }

    throw new Error(error.message);
  }

  const message = data as MessageRow;
  await ensureMessageThreadId(supabase, message, threadId);

  return {
    ...message,
    thread_id: threadId || message.id,
  } as MessageRow;
}

export function isValidFolder(value: string): value is MessageFolder {
  return ["inbox", "sent", "saved", "trash"].includes(value);
}

export async function purgeExpiredTrash(
  supabase: SupabaseClient,
  retentionDays = 30
) {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - retentionDays);
  const cutoffIso = cutoff.toISOString();

  const { data, error } = await supabase
    .from("messages")
    .delete()
    .eq("folder", "trash")
    .lt("trashed_at", cutoffIso)
    .select("id");

  if (error) {
    throw new Error(error.message);
  }

  return data?.length || 0;
}
