import { Resend } from "resend";
import { plainTextToHtml } from "@/lib/email-html";
import {
  getResendClientForEmail,
  getResendAccounts,
} from "@/lib/resend-accounts";

export async function sendEmail(params: {
  from: string;
  to: string;
  subject: string;
  text: string;
  replyTo?: string;
  tags?: { name: string; value: string }[];
}) {
  const resolved = getResendClientForEmail(params.from);
  const accounts = getResendAccounts();

  if (!resolved) {
    if (accounts.length === 0) {
      throw new Error(
        "Resend nije konfigurisan. Dodaj RESEND_API_KEY ili RESEND_ACCOUNTS."
      );
    }

    throw new Error(
      `Nije pronađen Resend nalog za domen ${params.from.split("@")[1] || "nepoznat"}.`
    );
  }

  const html = plainTextToHtml(params.text);
  const { client } = resolved;

  const { data, error } = await client.emails.send({
    from: params.from,
    to: params.to,
    subject: params.subject,
    text: params.text,
    html,
    replyTo: params.replyTo,
    tags: params.tags,
  });

  if (error) {
    throw new Error(error.message || "Resend nije uspeo da pošalje mejl.");
  }

  return data;
}

export async function fetchReceivedEmail(params: {
  senderEmail: string;
  receivedEmailId: string;
}) {
  const resolved = getResendClientForEmail(params.senderEmail);

  if (!resolved) {
    throw new Error("Nije pronađen Resend nalog za primljeni mejl.");
  }

  const { data, error } = await resolved.client.emails.receiving.get(
    params.receivedEmailId
  );

  if (error || !data) {
    throw new Error(error?.message || "Resend nije vratio primljeni mejl.");
  }

  return data;
}

export function verifyResendWebhook(params: {
  payload: string;
  webhookId: string;
  webhookTimestamp: string;
  webhookSignature: string;
}) {
  const accounts = getResendAccounts();
  const secrets = accounts
    .map((account) => account.webhookSecret)
    .filter((secret): secret is string => Boolean(secret));

  if (secrets.length === 0) {
    throw new Error("Nijedan RESEND webhook secret nije konfigurisan.");
  }

  let lastError: unknown = null;

  for (const webhookSecret of secrets) {
    try {
      const resend = new Resend(accounts[0]?.apiKey);
      return resend.webhooks.verify({
        payload: params.payload,
        webhookSecret,
        headers: {
          id: params.webhookId,
          timestamp: params.webhookTimestamp,
          signature: params.webhookSignature,
        },
      });
    } catch (error) {
      lastError = error;
    }
  }

  throw lastError instanceof Error
    ? lastError
    : new Error("Webhook verifikacija nije uspela.");
}
