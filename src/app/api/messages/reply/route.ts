import { NextRequest, NextResponse } from "next/server";
import {
  getAuthedSupabaseClient,
  getUserFromRequest,
} from "@/lib/api-auth";
import { buildReplySubject } from "@/lib/email-html";
import {
  attachResendEmailId,
  insertOutboundMessage,
} from "@/lib/message-store";
import { sendEmail } from "@/lib/send-email";

function cleanValue(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function isValidEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export async function POST(request: NextRequest) {
  try {
    const { user, error: authError } = await getUserFromRequest(request);

    if (!user) {
      return NextResponse.json({ error: authError }, { status: 401 });
    }

    const supabase = getAuthedSupabaseClient(request);

    if (!supabase) {
      return NextResponse.json(
        { error: "Supabase nije konfigurisan." },
        { status: 500 }
      );
    }

    const body = await request.json();
    const messageId = cleanValue(body.messageId);
    const replyText = cleanValue(body.text);

    if (!messageId) {
      return NextResponse.json(
        { error: "Nedostaje ID poruke za reply." },
        { status: 400 }
      );
    }

    if (!replyText) {
      return NextResponse.json(
        { error: "Unesite tekst odgovora." },
        { status: 400 }
      );
    }

    const { data: original, error: readError } = await supabase
      .from("messages")
      .select("*")
      .eq("id", messageId)
      .eq("user_id", user.id)
      .maybeSingle();

    if (readError || !original) {
      return NextResponse.json(
        { error: "Originalna poruka nije pronađena." },
        { status: 404 }
      );
    }

    if (!original.sender_email_id) {
      return NextResponse.json(
        { error: "Poruka nema povezan sender email." },
        { status: 400 }
      );
    }

    const { data: senderRow, error: senderError } = await supabase
      .from("sender_emails")
      .select("id,email")
      .eq("id", original.sender_email_id)
      .eq("user_id", user.id)
      .maybeSingle();

    if (senderError || !senderRow) {
      return NextResponse.json(
        { error: "Sender email nije pronađen." },
        { status: 404 }
      );
    }

    const toAddress =
      original.direction === "inbound"
        ? original.from_address
        : original.to_address;

    const normalizedTo = toAddress.trim();

    if (!isValidEmail(normalizedTo)) {
      return NextResponse.json(
        { error: "Primalac reply-a nema ispravan email." },
        { status: 400 }
      );
    }

    const subject = buildReplySubject(original.subject || "");

    const message = await insertOutboundMessage(supabase, {
      userId: user.id,
      senderEmailId: senderRow.id,
      from: senderRow.email,
      to: normalizedTo,
      subject,
      text: replyText,
      inReplyTo: original.id,
    });

    const sendResult = await sendEmail({
      from: senderRow.email,
      to: normalizedTo,
      subject,
      text: replyText,
      tags: [{ name: "app_message_id", value: message.id }],
    });

    if (sendResult?.id) {
      await attachResendEmailId(supabase, message.id, sendResult.id);
    }

    return NextResponse.json({
      success: true,
      message,
      resendEmailId: sendResult?.id || null,
    });
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : "Došlo je do greške.";

    return NextResponse.json({ error: message }, { status: 500 });
  }
}
