import { NextRequest, NextResponse } from "next/server";
import { getUserFromRequest } from "@/lib/api-auth";
import { extractProposalFileText } from "@/lib/parse-proposal-file";

export async function POST(request: NextRequest) {
  try {
    const { user, error: authError } = await getUserFromRequest(request);

    if (!user) {
      return NextResponse.json({ error: authError }, { status: 401 });
    }

    const formData = await request.formData();
    const file = formData.get("file");

    if (!(file instanceof File)) {
      return NextResponse.json(
        { error: "Nije izabran fajl." },
        { status: 400 }
      );
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const text = await extractProposalFileText(
      buffer,
      file.type,
      file.name
    );

    return NextResponse.json({
      text,
      filename: file.name,
    });
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : "Došlo je do greške.";

    return NextResponse.json({ error: message }, { status: 400 });
  }
}
