import { NextRequest, NextResponse } from "next/server";
import {
  getAuthedSupabaseClient,
  getUserFromRequest,
} from "@/lib/api-auth";
import { isValidFolder } from "@/lib/message-store";
import type { MessageFolder } from "@/lib/messages";

function cleanValue(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
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

  const { id } = await params;
  const messageId = cleanValue(id);

  if (!messageId) {
    return NextResponse.json({ error: "Nedostaje ID poruke." }, { status: 400 });
  }

  const body = await request.json();
  const nextFolder = cleanValue(body.folder);

  if (!isValidFolder(nextFolder)) {
    return NextResponse.json({ error: "Nepoznat folder." }, { status: 400 });
  }

  const { data: existing, error: readError } = await supabase
    .from("messages")
    .select("*")
    .eq("id", messageId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (readError || !existing) {
    return NextResponse.json({ error: "Poruka nije pronađena." }, { status: 404 });
  }

  const currentFolder = existing.folder as MessageFolder;
  const updatePayload: Record<string, unknown> = {
    folder: nextFolder,
    updated_at: new Date().toISOString(),
  };

  if (nextFolder === "trash") {
    updatePayload.trashed_at = new Date().toISOString();

    if (currentFolder !== "trash") {
      updatePayload.source_folder = currentFolder;
    }
  }

  if (nextFolder === "saved" && currentFolder !== "saved") {
    updatePayload.source_folder = currentFolder;
  }

  if (currentFolder === "trash" && nextFolder !== "trash") {
    updatePayload.trashed_at = null;
  }

  if (nextFolder === "inbox" || nextFolder === "sent") {
    if (currentFolder === "saved" || currentFolder === "trash") {
      const restoredFolder = existing.source_folder as MessageFolder | null;

      if (restoredFolder && isValidFolder(restoredFolder)) {
        updatePayload.folder = restoredFolder;
      } else {
        updatePayload.folder =
          existing.direction === "outbound" ? "sent" : "inbox";
      }

      updatePayload.source_folder = null;
      updatePayload.trashed_at = null;
    }
  }

  const { data, error } = await supabase
    .from("messages")
    .update(updatePayload)
    .eq("id", messageId)
    .eq("user_id", user.id)
    .select("*")
    .single();

  if (error || !data) {
    return NextResponse.json(
      { error: error?.message || "Poruka nije ažurirana." },
      { status: 500 }
    );
  }

  return NextResponse.json({ message: data });
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
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

  const { id } = await params;
  const messageId = cleanValue(id);

  const { data, error } = await supabase
    .from("messages")
    .select("*")
    .eq("id", messageId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (error || !data) {
    return NextResponse.json({ error: "Poruka nije pronađena." }, { status: 404 });
  }

  return NextResponse.json({ message: data });
}
