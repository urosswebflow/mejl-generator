import { NextRequest, NextResponse } from "next/server";
import {
  getAuthedSupabaseClient,
  getUserFromRequest,
} from "@/lib/api-auth";
import { templateHasPlaceholder } from "@/lib/generate-proposal";
import { extractProposalFileText } from "@/lib/parse-proposal-file";

const TEMPLATE_SELECT =
  "id,name,content_text,original_filename,name_only,email_subject,created_at,user_id";

function cleanValue(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function validateNameOnlyContent(contentText: string, nameOnly: boolean) {
  if (nameOnly && !templateHasPlaceholder(contentText)) {
    return "Šablon sa opcijom „Bez AI“ mora da sadrži bar jedan placeholder: {ime}, {naziv_firme}, {broj_recenzija}, {prosecna_ocena} ili {delatnost}.";
  }

  return null;
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
    .select(TEMPLATE_SELECT)
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const templates = data || [];
  const creatorIds = [
    ...new Set(templates.map((item) => item.user_id).filter(Boolean)),
  ] as string[];

  let creatorEmails = new Map<string, string>();

  if (creatorIds.length > 0) {
    const { data: profiles } = await supabase
      .from("profiles")
      .select("id,email")
      .in("id", creatorIds);

    creatorEmails = new Map(
      (profiles || []).map((profile) => [profile.id as string, profile.email as string])
    );
  }

  const enrichedTemplates = templates.map((template) => ({
    ...template,
    creator_email: creatorEmails.get(template.user_id) || null,
  }));

  return NextResponse.json({ templates: enrichedTemplates });
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
    const nameOnly = formData.get("nameOnly") === "true";
    const emailSubject = cleanValue(formData.get("emailSubject")) || null;

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

    const buffer = Buffer.from(await file.arrayBuffer());
    const contentText = await extractProposalFileText(
      buffer,
      file.type,
      file.name
    );

    const nameOnlyError = validateNameOnlyContent(contentText, nameOnly);

    if (nameOnlyError) {
      return NextResponse.json({ error: nameOnlyError }, { status: 400 });
    }

    const { data, error } = await supabase
      .from("proposal_templates")
      .insert({
        user_id: user.id,
        name,
        content_text: contentText,
        original_filename: file.name,
        name_only: nameOnly,
        email_subject: emailSubject,
      })
      .select(TEMPLATE_SELECT)
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

    return NextResponse.json({
      template: {
        ...data,
        creator_email: user.email || null,
      },
    });
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : "Došlo je do greške.";

    return NextResponse.json({ error: message }, { status: 400 });
  }
}

export async function PATCH(request: NextRequest) {
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
    const id = cleanValue(formData.get("id"));
    const name = cleanValue(formData.get("name"));
    const nameOnly = formData.get("nameOnly") === "true";
    const emailSubject = cleanValue(formData.get("emailSubject")) || null;
    const file = formData.get("file");

    if (!id) {
      return NextResponse.json(
        { error: "Nedostaje ID šablona." },
        { status: 400 }
      );
    }

    if (!name) {
      return NextResponse.json(
        { error: "Unesite naziv šablona." },
        { status: 400 }
      );
    }

    const { data: existing, error: existingError } = await supabase
      .from("proposal_templates")
      .select("id,content_text,original_filename,user_id")
      .eq("id", id)
      .maybeSingle();

    if (existingError) {
      return NextResponse.json({ error: existingError.message }, { status: 500 });
    }

    if (!existing) {
      return NextResponse.json(
        { error: "Šablon nije pronađen." },
        { status: 404 }
      );
    }

    if (existing.user_id !== user.id) {
      return NextResponse.json(
        { error: "Možete menjati samo sopstvene šablone." },
        { status: 403 }
      );
    }

    let contentText = existing.content_text;
    let originalFilename = existing.original_filename;

    if (file instanceof File && file.size > 0) {
      const buffer = Buffer.from(await file.arrayBuffer());
      contentText = await extractProposalFileText(
        buffer,
        file.type,
        file.name
      );
      originalFilename = file.name;
    }

    const nameOnlyError = validateNameOnlyContent(contentText, nameOnly);

    if (nameOnlyError) {
      return NextResponse.json({ error: nameOnlyError }, { status: 400 });
    }

    const { data, error } = await supabase
      .from("proposal_templates")
      .update({
        name,
        content_text: contentText,
        original_filename: originalFilename,
        name_only: nameOnly,
        email_subject: emailSubject,
      })
      .eq("id", id)
      .eq("user_id", user.id)
      .select(TEMPLATE_SELECT)
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

    return NextResponse.json({
      template: {
        ...data,
        creator_email: user.email || null,
      },
    });
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
