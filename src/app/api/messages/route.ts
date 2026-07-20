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

  let query = supabase
    .from("messages")
    .select("*")
    .eq("user_id", user.id)
    .eq("sender_email_id", senderEmailId)
    .eq("folder", folder)
    .order("created_at", { ascending: false })
    .limit(200);

  if (folder === "inbox") {
    query = query.eq("direction", "inbound");
  }

  if (folder === "sent") {
    query = query.eq("direction", "outbound");
  }

  const { data, error } = await query;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ messages: data || [] });
}
