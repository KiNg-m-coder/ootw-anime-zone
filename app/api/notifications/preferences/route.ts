
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/src/lib/server";

export const runtime = "nodejs";

const allowedFields = [
  "enabled",
  "direct_messages",
  "mentions",
  "global_replies",
  "announcements",
  "never_prompt",
] as const;

type PreferenceField = (typeof allowedFields)[number];

export async function GET() {
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

    const { data, error } = await supabase
      .from("anime_notification_preferences")
      .select("*")
      .eq("user_id", user.id)
      .maybeSingle();

    if (error) {
      console.error("Preference read failed:", error);
      return NextResponse.json(
        { error: "Could not load preferences." },
        { status: 500 }
      );
    }

    return NextResponse.json({
      preferences: data ?? {
        enabled: false,
        direct_messages: true,
        mentions: true,
        global_replies: true,
        announcements: true,
        never_prompt: false,
      },
    });
  } catch (error) {
    console.error("Preference GET error:", error);
    return NextResponse.json(
      { error: "Failed to load preferences." },
      { status: 500 }
    );
  }
}

export async function PATCH(request: NextRequest) {
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

    if (
      !body ||
      typeof body !== "object" ||
      Array.isArray(body) ||
      Object.keys(body).length === 0
    ) {
      return NextResponse.json(
        { error: "Invalid preferences." },
        { status: 400 }
      );
    }

    const updates: Partial<Record<PreferenceField, boolean>> = {};

    for (const key of allowedFields) {
      if (key in body) {
        if (typeof body[key] !== "boolean") {
          return NextResponse.json(
            { error: `Invalid value for ${key}.` },
            { status: 400 }
          );
        }

        updates[key] = body[key];
      }
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json(
        { error: "No valid preference fields supplied." },
        { status: 400 }
      );
    }

    const { data, error } = await supabase
      .from("anime_notification_preferences")
      .upsert(
        {
          user_id: user.id,
          ...updates,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "user_id" }
      )
      .select()
      .single();

    if (error) {
      console.error("Preference save failed:", error);
      return NextResponse.json(
        { error: "Could not save preferences." },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true, preferences: data });
  } catch (error) {
    console.error("Preference PATCH error:", error);
    return NextResponse.json(
      { error: "Failed to update preferences." },
      { status: 500 }
    );
  }
}
