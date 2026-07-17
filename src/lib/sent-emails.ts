export type SentEmails = {
  first: string | null;
  second: string | null;
  third: string | null;
};

export function getNextSentField(
  sentEmails?: SentEmails
): keyof SentEmails | null {
  const sent = sentEmails || {
    first: null,
    second: null,
    third: null,
  };

  if (!sent.first) return "first";
  if (!sent.second) return "second";
  if (!sent.third) return "third";

  return null;
}

export function markNextSentEmail(sentEmails?: SentEmails): SentEmails {
  const current = sentEmails || {
    first: null,
    second: null,
    third: null,
  };

  const nextField = getNextSentField(current);

  if (!nextField) {
    return current;
  }

  return {
    ...current,
    [nextField]: new Date().toISOString(),
  };
}
