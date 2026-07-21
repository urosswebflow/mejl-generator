import { NextRequest, NextResponse } from "next/server";
import {
  getAuthedSupabaseClient,
  getUserFromRequest,
} from "@/lib/api-auth";
import { buildReplySubject } from "@/lib/email-html";
import {
  attachResendEmailId,
  findLatestOutboundMessageToRecipient,
  findMessageById,
  insertOutboundMessage,
} from "@/lib/message-store";
import { generateProposalText } from "@/lib/generate-proposal";
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

    const body = await request.json();
    const geminiKey = process.env.GEMINI_API_KEY;
    const nameOnly = body.nameOnly === true;
    const proposalExampleText = cleanValue(body.proposalExampleText);
    const senderEmailId = cleanValue(body.senderEmailId);
    const recipientEmail = cleanValue(body.recipientEmail).toLowerCase();
    const proposalTextInput = cleanValue(body.proposalText);
    const replyToLatest = body.replyToLatest === true;

    if (!proposalTextInput && !nameOnly && !geminiKey) {
      return NextResponse.json(
        { error: "GEMINI_API_KEY nije pronađen u .env.local." },
        { status: 500 }
      );
    }

    if (!proposalTextInput && nameOnly && !proposalExampleText) {
      return NextResponse.json(
        { error: "Nedostaje tekst šablona za slanje." },
        { status: 400 }
      );
    }

    if (!senderEmailId) {
      return NextResponse.json(
        { error: "Izaberite email sa kog šaljete." },
        { status: 400 }
      );
    }

    if (!recipientEmail || !isValidEmail(recipientEmail)) {
      return NextResponse.json(
        { error: "Lead nema ispravan email primaoca." },
        { status: 400 }
      );
    }

    const supabase = getAuthedSupabaseClient(request);

    if (!supabase) {
      return NextResponse.json(
        { error: "Supabase nije konfigurisan." },
        { status: 500 }
      );
    }

    const { data: senderRow, error: senderError } = await supabase
      .from("sender_emails")
      .select("id,email")
      .eq("id", senderEmailId)
      .eq("user_id", user.id)
      .maybeSingle();

    if (senderError || !senderRow) {
      return NextResponse.json(
        { error: "Izabrani sender email nije pronađen." },
        { status: 404 }
      );
    }

    let proposal = proposalTextInput;
    let subject = cleanValue(body.subject);

    if (!proposal) {
      const generated = await generateProposalText(
        {
          companyName: body.companyName,
          profession: body.profession,
          city: body.city,
          address: body.address,
          owner: body.owner,
          email: recipientEmail,
          reviews:
            typeof body.reviews === "number"
              ? body.reviews
              : Number.parseInt(String(body.reviews ?? ""), 10) || 0,
          rating:
            typeof body.rating === "number"
              ? body.rating
              : body.rating != null
                ? Number.parseFloat(String(body.rating))
                : null,
          proposalExampleText: body.proposalExampleText,
          templateSubject: body.templateSubject,
          nameOnly,
        },
        geminiKey || ""
      );

      proposal = generated.proposal;
      subject = generated.subject;
    }

    if (!subject) {
      subject = `Predlog saradnje — ${cleanValue(body.companyName) || "Vaš biznis"}`;
    }

    let inReplyTo: string | null = null;
    let replySource = null;

    if (replyToLatest) {
      replySource = await findLatestOutboundMessageToRecipient(supabase, {
        userId: user.id,
        senderEmailId: senderRow.id,
        recipientEmail,
      });
    }

    const inReplyToMessageId = cleanValue(body.inReplyToMessageId);

    if (inReplyToMessageId) {
      replySource = await findMessageById(
        supabase,
        inReplyToMessageId,
        user.id
      );
    }

    if (replySource) {
      inReplyTo = replySource.id;
      subject = buildReplySubject(replySource.subject || subject);
    }

    const message = await insertOutboundMessage(supabase, {
      userId: user.id,
      senderEmailId: senderRow.id,
      from: senderRow.email,
      to: recipientEmail,
      subject,
      text: proposal,
      inReplyTo,
    });

    const sendResult = await sendEmail({
      from: senderRow.email,
      to: recipientEmail,
      subject,
      text: proposal,
      tags: [{ name: "app_message_id", value: message.id }],
    });

    if (sendResult?.id) {
      await attachResendEmailId(supabase, message.id, sendResult.id);
    }

    return NextResponse.json({
      success: true,
      proposal,
      subject,
      from: senderRow.email,
      to: recipientEmail,
      messageId: message.id,
      resendEmailId: sendResult?.id || null,
      isReply: Boolean(inReplyTo),
    });
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : "Došlo je do greške.";

    return NextResponse.json({ error: message }, { status: 500 });
  }
}
