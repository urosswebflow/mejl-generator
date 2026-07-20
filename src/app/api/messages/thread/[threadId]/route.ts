import { NextRequest, NextResponse } from "next/server";
import {
  getAuthedSupabaseClient,
  getUserFromRequest,
} from "@/lib/api-auth";
import type { MessageRow } from "@/lib/messages";

function cleanValue(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ threadId: string }> }
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

  const { threadId: rawThreadId } = await params;
  const threadId = cleanValue(rawThreadId);

  if (!threadId) {
    return NextResponse.json({ error: "Nedostaje ID thread-a." }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("messages")
    .select("*")
    .eq("user_id", user.id)
    .eq("thread_id", threadId)
    .order("created_at", { ascending: true });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const messages = (data || []) as MessageRow[];

  if (messages.length === 0) {
    return NextResponse.json(
      { error: "Thread nije pronađen." },
      { status: 404 }
    );
  }

  return NextResponse.json({ messages });
}
