import { NextRequest, NextResponse } from "next/server";
import {
  getAuthedSupabaseClient,
  getUserFromRequest,
} from "@/lib/api-auth";
import { generateProposalText } from "@/lib/generate-proposal";
import { sendProposalEmail } from "@/lib/send-proposal-email";

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

    const geminiKey = process.env.GEMINI_API_KEY;

    if (!geminiKey) {
      return NextResponse.json(
        { error: "GEMINI_API_KEY nije pronađen u .env.local." },
        { status: 500 }
      );
    }

    const body = await request.json();
    const senderEmailId = cleanValue(body.senderEmailId);
    const recipientEmail = cleanValue(body.recipientEmail).toLowerCase();
    const proposalTextInput = cleanValue(body.proposalText);

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
          proposalExampleText: body.proposalExampleText,
        },
        geminiKey
      );

      proposal = generated.proposal;
      subject = generated.subject;
    }

    if (!subject) {
      subject = `Predlog saradnje — ${cleanValue(body.companyName) || "Vaš biznis"}`;
    }

    await sendProposalEmail({
      from: senderRow.email,
      to: recipientEmail,
      subject,
      text: proposal,
    });

    return NextResponse.json({
      success: true,
      proposal,
      subject,
      from: senderRow.email,
      to: recipientEmail,
    });
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : "Došlo je do greške.";

    return NextResponse.json({ error: message }, { status: 500 });
  }
}
