
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/src/lib/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import { sendPushToUser } from "@/src/lib/push-server";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: "You must be signed in." },
        { status: 401 }
      );
    }

    const body = await request.json();
    const messageId = body?.messageId;

    if (typeof messageId !== "string" || !messageId) {
      return NextResponse.json(
        { error: "Invalid message ID." },
        { status: 400 }
      );
    }

    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!url || !serviceKey) {
      throw new Error("Supabase server configuration is missing.");
    }

    const admin = createAdminClient(url, serviceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    // Verify the message belongs to the authenticated sender.
    const { data: message, error: messageError } = await admin
      .from("anime_direct_messages")
      .select("id, sender_id, recipient_id")
      .eq("id", messageId)
      .eq("sender_id", user.id)
      .maybeSingle();

    if (messageError) throw messageError;

    if (!message) {
      return NextResponse.json(
        { error: "Message not found or not authorized." },
        { status: 404 }
      );
    }

    // Never notify the sender.
    if (message.sender_id === message.recipient_id) {
      return NextResponse.json({ success: true, sent: 0 });
    }

try {
  const result = await sendPushToUser(
    message.recipient_id,
    "direct_messages",
    {
      title: "New Anime Zone message",
      body: "You have a new private message.",
      url: "/",
      tag: `dm-${message.id}`,
    }
  );

  return NextResponse.json({
    success: true,
    sent: result.sent,
  });
} catch (pushError) {
  console.error("Push delivery failed:", pushError);

  return NextResponse.json({
    success: false,
    sent: 0,
    error: "Message saved, but notification delivery failed.",
  });
}
  } catch (error) {
    console.error("DM push notification error:", error);

    return NextResponse.json(
      { error: "Could not send notification." },
      { status: 500 }
    );
  }
}
