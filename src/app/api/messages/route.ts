import { NextRequest, NextResponse } from "next/server";
import {
  getAuthedSupabaseClient,
  getUserFromRequest,
} from "@/lib/api-auth";
import { isValidFolder } from "@/lib/message-store";
import { buildThreadSummaries } from "@/lib/message-threads";
import type { MessageFolder, MessageRow } from "@/lib/messages";

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

  const senderEmailId = cleanValue(
    request.nextUrl.searchParams.get("senderEmailId")
  );
  const folderParam = cleanValue(request.nextUrl.searchParams.get("folder"));
  const folder: MessageFolder = isValidFolder(folderParam)
    ? folderParam
    : "inbox";

  if (!senderEmailId) {
    return NextResponse.json(
      { error: "Izaberite mejl za prikaz poruka." },
      { status: 400 }
    );
  }

  const { data: senderRow, error: senderError } = await supabase
    .from("sender_emails")
    .select("id")
    .eq("id", senderEmailId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (senderError || !senderRow) {
    return NextResponse.json(
      { error: "Izabrani mejl nije pronađen." },
      { status: 404 }
    );
  }

  if (folder === "inbox" || folder === "sent") {
    const { data, error } = await supabase
      .from("messages")
      .select("*")
      .eq("user_id", user.id)
      .eq("sender_email_id", senderEmailId)
      .neq("folder", "trash")
      .order("created_at", { ascending: false })
      .limit(500);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const threads = buildThreadSummaries(
      (data || []) as MessageRow[],
      folder
    );

    return NextResponse.json({ threads });
  }

  let query = supabase
    .from("messages")
    .select("*")
    .eq("user_id", user.id)
    .eq("sender_email_id", senderEmailId)
    .eq("folder", folder)
    .order("created_at", { ascending: false })
    .limit(200);

  const { data, error } = await query;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ messages: data || [] });
}
