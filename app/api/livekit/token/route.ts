
import { NextRequest, NextResponse } from "next/server";
import { AccessToken } from "livekit-server-sdk";
import { createClient } from "@/src/lib/server";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();

    // Verify the signed-in user.
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

    // Check the user's actual admin permission in Supabase.
    const { data: isAdmin, error: adminError } = await supabase.rpc(
      "anime_is_admin"
    );

    if (adminError) {
      console.error("Admin check failed:", adminError);
      return NextResponse.json(
        { error: "Could not verify admin permissions." },
        { status: 500 }
      );
    }

    const body = await request.json().catch(() => ({}));
    const role = body.role;

    if (role !== "publisher" && role !== "viewer") {
      return NextResponse.json(
        { error: "Invalid streaming role." },
        { status: 400 }
      );
    }

    // Only admins can publish their screen.
    if (role === "publisher" && !isAdmin) {
      return NextResponse.json(
        { error: "Only Anime Zone admins can start a stream." },
        { status: 403 }
      );
    }

    const roomName = "anime-zone-live";

    const apiKey = process.env.LIVEKIT_API_KEY;
    const apiSecret = process.env.LIVEKIT_API_SECRET;

    if (!apiKey || !apiSecret || !process.env.LIVEKIT_URL) {
      return NextResponse.json(
        { error: "LiveKit server configuration is missing." },
        { status: 500 }
      );
    }

    const token = new AccessToken(apiKey, apiSecret, {
      identity: user.id,
      ttl: "1h",
    });

    token.addGrant({
      roomJoin: true,
      room: roomName,
      canPublish: role === "publisher",
      canSubscribe: true,
      canPublishData: true,
    });

    return NextResponse.json({
      token: await token.toJwt(),
      serverUrl: process.env.LIVEKIT_URL,
      roomName,
    });
  } catch (error) {
    console.error("LiveKit token error:", error);

    return NextResponse.json(
      { error: "Failed to create LiveKit access token." },
      { status: 500 }
    );
  }
}
