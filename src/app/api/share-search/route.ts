import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getUserFromRequest } from "@/lib/api-auth";

export async function POST(request: NextRequest) {
  try {
    const { user, error: authError } = await getUserFromRequest(request);

    if (!user) {
      return NextResponse.json({ error: authError }, { status: 401 });
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseAnonKey) {
      return NextResponse.json(
        { error: "Supabase nije konfigurisan." },
        { status: 500 }
      );
    }

    const body = await request.json();
    const searchId =
      typeof body.searchId === "string" ? body.searchId.trim() : "";
    const receiverEmail =
      typeof body.receiverEmail === "string"
        ? body.receiverEmail.trim().toLowerCase()
        : "";

    if (!searchId || !receiverEmail) {
      return NextResponse.json(
        { error: "Nedostaju podaci za deljenje." },
        { status: 400 }
      );
    }

    if (receiverEmail === user.email?.toLowerCase()) {
      return NextResponse.json(
        { error: "Ne možete podeliti pretragu sami sa sobom." },
        { status: 400 }
      );
    }

    const authHeader = request.headers.get("authorization");
    const token = authHeader?.startsWith("Bearer ")
      ? authHeader.slice(7).trim()
      : "";

    const authedClient = createClient(supabaseUrl, supabaseAnonKey,
      {
        global: {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        },
      }
    );

    const { data: search, error: searchError } = await authedClient
      .from("search_history")
      .select("id")
      .eq("id", searchId)
      .eq("user_id", user.id)
      .maybeSingle();

    if (searchError || !search) {
      return NextResponse.json(
        { error: "Pretraga nije pronađena ili nemate dozvolu." },
        { status: 403 }
      );
    }

    const { data: receiverProfile, error: receiverError } = await authedClient
      .from("profiles")
      .select("id,email")
      .eq("email", receiverEmail)
      .maybeSingle();

    if (receiverError || !receiverProfile) {
      return NextResponse.json(
        { error: "Korisnik sa tim emailom ne postoji." },
        { status: 404 }
      );
    }

    const { data: existingShare } = await authedClient
      .from("shared_searches")
      .select("id")
      .eq("search_id", searchId)
      .eq("receiver_id", receiverProfile.id)
      .maybeSingle();

    if (existingShare) {
      return NextResponse.json(
        { error: "Ova pretraga je već podeljena sa tim korisnikom." },
        { status: 409 }
      );
    }

    const { error: insertError } = await authedClient
      .from("shared_searches")
      .insert({
        search_id: searchId,
        sender_id: user.id,
        receiver_id: receiverProfile.id,
        receiver_email: receiverEmail,
      });

    if (insertError) {
      return NextResponse.json({ error: insertError.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : "Došlo je do greške.";

    return NextResponse.json({ error: message }, { status: 500 });
  }
}
