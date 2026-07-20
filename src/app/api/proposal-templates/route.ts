import { NextRequest, NextResponse } from "next/server";
import {
  getAuthedSupabaseClient,
  getUserFromRequest,
} from "@/lib/api-auth";
import { extractOwnerNameFromTemplate } from "@/lib/generate-proposal";
import { extractProposalFileText } from "@/lib/parse-proposal-file";

function cleanValue(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

export async function GET(request: NextRequest) {
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

  const { data, error } = await supabase
    .from("proposal_templates")
    .select(
      "id,name,content_text,original_filename,name_only_mode,template_owner_name,created_at"
    )
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ templates: data || [] });
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

    const formData = await request.formData();
    const file = formData.get("file");
    const name = cleanValue(formData.get("name"));

    if (!(file instanceof File)) {
      return NextResponse.json(
        { error: "Nije izabran fajl." },
        { status: 400 }
      );
    }

    if (!name) {
      return NextResponse.json(
        { error: "Unesite naziv šablona." },
        { status: 400 }
      );
    }

    const nameOnlyMode = formData.get("nameOnlyMode") === "true";

    const buffer = Buffer.from(await file.arrayBuffer());
    const contentText = await extractProposalFileText(
      buffer,
      file.type,
      file.name
    );
    const templateOwnerName = nameOnlyMode
      ? extractOwnerNameFromTemplate(contentText)
      : null;

    const { data, error } = await supabase
      .from("proposal_templates")
      .insert({
        user_id: user.id,
        name,
        content_text: contentText,
        original_filename: file.name,
        name_only_mode: nameOnlyMode,
        template_owner_name: templateOwnerName,
      })
      .select(
        "id,name,content_text,original_filename,name_only_mode,template_owner_name,created_at"
      )
      .single();

    if (error) {
      if (error.code === "23505") {
        return NextResponse.json(
          { error: "Šablon sa tim nazivom već postoji." },
          { status: 409 }
        );
      }

      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ template: data });
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : "Došlo je do greške.";

    return NextResponse.json({ error: message }, { status: 400 });
  }
}

export async function DELETE(request: NextRequest) {
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
  const id = cleanValue(body.id);

  if (!id) {
    return NextResponse.json({ error: "Nedostaje ID šablona." }, { status: 400 });
  }

  const { error } = await supabase
    .from("proposal_templates")
    .delete()
    .eq("id", id)
    .eq("user_id", user.id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
