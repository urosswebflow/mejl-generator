import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServiceClient } from "@/lib/api-auth";
import { purgeExpiredTrash } from "@/lib/message-store";

function isAuthorized(request: NextRequest) {
  const cronSecret = process.env.CRON_SECRET?.trim();

  if (!cronSecret) {
    return false;
  }

  const authHeader = request.headers.get("authorization");

  if (authHeader === `Bearer ${cronSecret}`) {
    return true;
  }

  return request.headers.get("x-cron-secret") === cronSecret;
}

export async function GET(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = getSupabaseServiceClient();

  if (!supabase) {
    return NextResponse.json(
      { error: "Supabase service role nije konfigurisan." },
      { status: 500 }
    );
  }

  try {
    const deletedCount = await purgeExpiredTrash(supabase, 30);

    return NextResponse.json({
      success: true,
      deletedCount,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Cron purge nije uspeo.";

    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  return GET(request);
}
