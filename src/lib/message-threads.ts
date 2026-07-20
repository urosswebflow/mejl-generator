import { stripReplyPrefix } from "@/lib/email-html";
import type { MessageFolder, MessageRow } from "@/lib/messages";
import { normalizeEmailAddress } from "@/lib/messages";

export type MessageThreadSummary = {
  id: string;
  subject: string;
  messageCount: number;
  counterparty: string;
  latestMessageAt: string;
  preview: string;
  hasOpened: boolean;
  hasClicked: boolean;
  latestMessageId: string;
};

function getCounterparty(message: MessageRow) {
  return message.direction === "inbound"
    ? message.from_address
    : message.to_address;
}

function threadMatchesFolder(
  messages: MessageRow[],
  folder: Extract<MessageFolder, "inbox" | "sent">
) {
  if (folder === "inbox") {
    return messages.some(
      (message) => message.direction === "inbound" && message.folder === "inbox"
    );
  }

  return messages.some(
    (message) => message.direction === "outbound" && message.folder === "sent"
  );
}

export function buildThreadSummaries(
  messages: MessageRow[],
  folder: Extract<MessageFolder, "inbox" | "sent">
): MessageThreadSummary[] {
  const grouped = new Map<string, MessageRow[]>();

  for (const message of messages) {
    const threadId = message.thread_id || message.id;
    const bucket = grouped.get(threadId) || [];
    bucket.push(message);
    grouped.set(threadId, bucket);
  }

  const summaries: MessageThreadSummary[] = [];

  for (const [threadId, threadMessages] of grouped) {
    if (!threadMatchesFolder(threadMessages, folder)) {
      continue;
    }

    const sorted = [...threadMessages].sort(
      (left, right) =>
        new Date(left.created_at).getTime() - new Date(right.created_at).getTime()
    );
    const latest = sorted[sorted.length - 1];
    const subjectSource =
      sorted.find((message) => message.subject.trim())?.subject ||
      latest.subject ||
      "(bez subject-a)";

    summaries.push({
      id: threadId,
      subject: stripReplyPrefix(subjectSource),
      messageCount: sorted.length,
      counterparty: getCounterparty(latest),
      latestMessageAt: latest.created_at,
      preview: latest.body_text || "",
      hasOpened: sorted.some((message) => Boolean(message.opened_at)),
      hasClicked: sorted.some((message) => Boolean(message.clicked_at)),
      latestMessageId: latest.id,
    });
  }

  return summaries.sort(
    (left, right) =>
      new Date(right.latestMessageAt).getTime() -
      new Date(left.latestMessageAt).getTime()
  );
}

export function addressesMatchCounterparty(
  message: MessageRow,
  counterpartyEmail: string
) {
  const normalized = normalizeEmailAddress(counterpartyEmail);

  return (
    normalizeEmailAddress(message.from_address) === normalized ||
    normalizeEmailAddress(message.to_address) === normalized
  );
}
