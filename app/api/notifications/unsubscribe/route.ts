
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/src/lib/server";

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
    const endpoint = body?.endpoint;

    if (
      typeof endpoint !== "string" ||
      !endpoint.startsWith("https://")
    ) {
      return NextResponse.json(
        { error: "Invalid subscription endpoint." },
        { status: 400 }
      );
    }

    const { error } = await supabase
      .from("anime_push_subscriptions")
      .delete()
      .eq("endpoint", endpoint)
      .eq("user_id", user.id);

    if (error) {
      console.error("Push unsubscribe failed:", error);

      return NextResponse.json(
        { error: "Could not remove push subscription." },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Unsubscribe route error:", error);

    return NextResponse.json(
      { error: "Failed to unregister this device." },
      { status: 500 }
    );
  }
}
