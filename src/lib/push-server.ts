
import "server-only";

import * as webpush from "web-push";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";

export type PushEvent =
  | "direct_messages"
  | "mentions"
  | "global_replies"
  | "announcements";

type PushPayload = {
  title: string;
  body: string;
  url?: string;
  tag?: string;
};

const preferenceFields: PushEvent[] = [
  "direct_messages",
  "mentions",
  "global_replies",
  "announcements",
];

function getAdminSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceKey) {
    throw new Error("Supabase server environment variables are missing.");
  }

  return createSupabaseClient(url, serviceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

export async function sendPushToUser(
  userId: string,
  event: PushEvent,
  payload: PushPayload
) {
  if (!userId) {
    throw new Error("A recipient user ID is required.");
  }

  if (!preferenceFields.includes(event)) {
    throw new Error("Invalid notification event.");
  }

  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  const subject = process.env.VAPID_SUBJECT;

  if (!publicKey || !privateKey || !subject) {
    throw new Error("VAPID environment variables are missing.");
  }

  webpush.setVapidDetails(subject, publicKey, privateKey);

  const supabase = getAdminSupabase();

  // Check whether this user has enabled this notification type.
  const { data: preferences, error: preferenceError } =
    await supabase
      .from("anime_notification_preferences")
      .select("enabled, direct_messages, mentions, global_replies, announcements")
      .eq("user_id", userId)
      .maybeSingle();

  if (preferenceError) {
    throw new Error("Could not read notification preferences.");
  }

  // No preference row means notifications are disabled.
  if (!preferences || !preferences.enabled || !preferences[event]) {
    return { sent: 0, skipped: true };
  }

  // Get every registered browser/device for this user.
  const { data: subscriptions, error: subscriptionError } =
    await supabase
      .from("anime_push_subscriptions")
      .select("endpoint, p256dh, auth")
      .eq("user_id", userId);

  if (subscriptionError) {
    throw new Error("Could not load push subscriptions.");
  }

  if (!subscriptions?.length) {
    return { sent: 0, skipped: true };
  }

  // Only allow local paths, not arbitrary external URLs.
  const safeUrl =
    payload.url?.startsWith("/") && !payload.url.startsWith("//")
      ? payload.url
      : "/";

  const notification = JSON.stringify({
    title: payload.title,
    body: payload.body,
    url: safeUrl,
    tag: payload.tag || event,
  });

  let sent = 0;

  const results = await Promise.allSettled(
    subscriptions.map(async (item) => {
      try {
        await webpush.sendNotification(
          {
            endpoint: item.endpoint,
            keys: {
              p256dh: item.p256dh,
              auth: item.auth,
            },
          },
          notification
        );

        sent++;
      } catch (error) {
        const statusCode = (
          error as { statusCode?: number }
        )?.statusCode;

        // Remove subscriptions that are no longer valid.
        if (statusCode === 404 || statusCode === 410) {
          await supabase
            .from("anime_push_subscriptions")
            .delete()
            .eq("endpoint", item.endpoint)
            .eq("user_id", userId);
        } else {
          console.error("Push delivery failed:", statusCode);
        }
      }
    })
  );

  return {
    sent,
    attempted: results.length,
    skipped: false,
  };
}
