import { NextRequest, NextResponse } from "next/server";
import { getUserFromRequest } from "@/lib/api-auth";
import { generateProposalText } from "@/lib/generate-proposal";

export async function POST(request: NextRequest) {
  try {
    const { user, error: authError } = await getUserFromRequest(request);

    if (!user) {
      return NextResponse.json({ error: authError }, { status: 401 });
    }

    const body = await request.json();
    const nameOnly = body.nameOnly === true;
    const apiKey = process.env.GEMINI_API_KEY;

    if (!nameOnly && !apiKey) {
      return NextResponse.json(
        { error: "GEMINI_API_KEY nije pronađen u .env.local." },
        { status: 500 }
      );
    }

    const { proposal, subject } = await generateProposalText(
      {
        companyName: body.companyName,
        profession: body.profession,
        city: body.city,
        address: body.address,
        owner: body.owner,
        email: body.email,
        proposalExampleText: body.proposalExampleText,
        nameOnly,
      },
      apiKey || ""
    );

    return NextResponse.json({ proposal, subject });
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : "Došlo je do greške.";

    return NextResponse.json({ error: message }, { status: 500 });
  }
}
