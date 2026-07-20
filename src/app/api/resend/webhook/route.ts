import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServiceClient } from "@/lib/api-auth";
import {
  findMessageByAppTag,
  findMessageByResendEmailId,
  findSenderEmailByAddress,
  insertInboundMessage,
  markMessageClicked,
  markMessageOpened,
} from "@/lib/message-store";
import { normalizeEmailAddress } from "@/lib/messages";
import { fetchReceivedEmail, verifyResendWebhook } from "@/lib/send-email";

type WebhookTagMap =
  | Record<string, string>
  | { name: string; value: string }[]
  | undefined;

function getAppMessageId(tags: WebhookTagMap) {
  if (!tags) {
    return null;
  }

  if (Array.isArray(tags)) {
    const match = tags.find((tag) => tag.name === "app_message_id");
    return match?.value || null;
  }

  return tags.app_message_id || null;
}

function normalizeRecipients(values: string[] | undefined) {
  if (!values?.length) {
    return [];
  }

  return values.map((value) => normalizeEmailAddress(value)).filter(Boolean);
}

async function handleOpenedOrClicked(
  supabase: NonNullable<ReturnType<typeof getSupabaseServiceClient>>,
  params: {
    resendEmailId: string;
    tags?: WebhookTagMap;
    eventTime: string;
    type: "email.opened" | "email.clicked";
  }
) {
  const appMessageId = getAppMessageId(params.tags);
  const message =
    (appMessageId
      ? await findMessageByAppTag(supabase, appMessageId)
      : null) ||
    (await findMessageByResendEmailId(supabase, params.resendEmailId));

  if (!message) {
    return;
  }

  if (params.type === "email.opened") {
    await markMessageOpened(supabase, message.id, params.eventTime);
    return;
  }

  await markMessageClicked(supabase, message.id, params.eventTime);
}

async function handleReceived(
  supabase: NonNullable<ReturnType<typeof getSupabaseServiceClient>>,
  data: {
    email_id: string;
    from: string;
    to?: string[];
    received_for?: string[];
    subject?: string;
  }
) {
  const recipients = [
    ...normalizeRecipients(data.to),
    ...normalizeRecipients(data.received_for),
  ];

  const uniqueRecipients = [...new Set(recipients)];

  let senderRow: Awaited<ReturnType<typeof findSenderEmailByAddress>> = null;

  for (const recipient of uniqueRecipients) {
    const match = await findSenderEmailByAddress(supabase, recipient);

    if (match) {
      senderRow = match;
      break;
    }
  }

  if (!senderRow) {
    return;
  }

  const receivedEmail = await fetchReceivedEmail({
    senderEmail: senderRow.email,
    receivedEmailId: data.email_id,
  });

  await insertInboundMessage(supabase, {
    userId: senderRow.user_id,
    senderEmailId: senderRow.id,
    resendReceivedId: data.email_id,
    from: receivedEmail.from || data.from,
    to: senderRow.email,
    subject: receivedEmail.subject || data.subject || "(bez subject-a)",
    bodyText: receivedEmail.text,
    bodyHtml: receivedEmail.html,
    counterpartyEmail: receivedEmail.from || data.from,
  });
}

export async function POST(request: NextRequest) {
  const supabase = getSupabaseServiceClient();

  if (!supabase) {
    return NextResponse.json(
      { error: "Supabase service role nije konfigurisan." },
      { status: 500 }
    );
  }

  const payload = await request.text();
  const webhookId =
    request.headers.get("svix-id") || request.headers.get("webhook-id") || "";
  const webhookTimestamp =
    request.headers.get("svix-timestamp") ||
    request.headers.get("webhook-timestamp") ||
    "";
  const webhookSignature =
    request.headers.get("svix-signature") ||
    request.headers.get("webhook-signature") ||
    "";

  if (!webhookId || !webhookTimestamp || !webhookSignature) {
    return NextResponse.json(
      { error: "Nedostaju webhook headers." },
      { status: 400 }
    );
  }

  let event: {
    type: string;
    created_at: string;
    data: {
      email_id?: string;
      tags?: WebhookTagMap;
      from?: string;
      to?: string[];
      received_for?: string[];
      subject?: string;
    };
  };

  try {
    event = verifyResendWebhook({
      payload,
      webhookId,
      webhookTimestamp,
      webhookSignature,
    }) as typeof event;
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Webhook verifikacija nije uspela.";

    return NextResponse.json({ error: message }, { status: 401 });
  }

  try {
    if (
      (event.type === "email.opened" || event.type === "email.clicked") &&
      event.data.email_id
    ) {
      await handleOpenedOrClicked(supabase, {
        resendEmailId: event.data.email_id,
        tags: event.data.tags,
        eventTime: event.created_at,
        type: event.type,
      });
    }

    if (event.type === "email.received" && event.data.email_id) {
      await handleReceived(supabase, {
        email_id: event.data.email_id,
        from: event.data.from || "",
        to: event.data.to,
        received_for: event.data.received_for,
        subject: event.data.subject,
      });
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error("Resend webhook error:", error);

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Greška pri obradi webhook-a.",
      },
      { status: 500 }
    );
  }
}
