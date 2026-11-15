
import { NextResponse } from "next/server";

export async function GET() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

  if (!url || !key) {
    return NextResponse.json(
      {
        success: false,
        message: "Supabase environment variables are missing.",
      },
      { status: 500 }
    );
  }

  try {
    const response = await fetch(`${url}/auth/v1/health`, {
      method: "GET",
      headers: {
        apikey: key,
      },
      cache: "no-store",
    });

    if (!response.ok) {
      return NextResponse.json(
        {
          success: false,
          message: "Supabase responded with an error.",
          status: response.status,
        },
        { status: 502 }
      );
    }

    return NextResponse.json({
      success: true,
      message: "Supabase connection successful!",
    });
  } catch (error) {
    console.error("SUPABASE CONNECTION ERROR:", error);

    return NextResponse.json(
      {
        success: false,
        message: "Could not reach Supabase. Check the VS Code terminal.",
      },
      { status: 500 }
    );
  }
}
