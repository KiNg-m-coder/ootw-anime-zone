"use client";

import { useEffect, useState } from "react";
import { enablePushNotifications } from "@/src/lib/notifications";

const DISMISSED_KEY = "anime-zone-notification-dismissed";
const NEVER_PROMPT_KEY = "anime-zone-notification-never-prompt";

export default function NotificationPrompt() {
  const [visible, setVisible] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function checkPrompt() {
      if (
        localStorage.getItem(DISMISSED_KEY) ||
        localStorage.getItem(NEVER_PROMPT_KEY)
      ) {
        return;
      }

      try {
        const response = await fetch("/api/notifications/preferences");

        if (response.ok) {
          const result = await response.json();

          if (result.preferences?.never_prompt) {
            localStorage.setItem(NEVER_PROMPT_KEY, "true");
            return;
          }

          if (result.preferences?.enabled) return;
        }
      } catch {
        // If preferences cannot be fetched temporarily, still offer the prompt.
      }

      if (!cancelled) setVisible(true);
    }

    void checkPrompt();
    return () => {
      cancelled = true;
    };
  }, []);

  async function handleEnable() {
    setLoading(true);
    setError("");

    try {
      await enablePushNotifications();
      setVisible(false);
      localStorage.setItem(DISMISSED_KEY, "true");
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Could not enable notifications.",
      );
    } finally {
      setLoading(false);
    }
  }

  function handleNoThanks() {
    localStorage.setItem(DISMISSED_KEY, "true");
    setVisible(false);
  }

  async function handleNeverShowAgain() {
    localStorage.setItem(DISMISSED_KEY, "true");
    localStorage.setItem(NEVER_PROMPT_KEY, "true");

    try {
      await fetch("/api/notifications/preferences", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ never_prompt: true }),
      });
    } finally {
      setVisible(false);
    }
  }

  if (!visible) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
      <div className="w-full max-w-sm rounded-3xl border border-[#d9d4ff] bg-white p-6 text-[#41366f] shadow-2xl">
        <div className="text-center">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-[#e9e7ff] text-3xl">
            🔔
          </div>
          <h2 className="mt-4 text-xl font-black">
            Want to keep in touch with your friends?
          </h2>
          <p className="mt-2 text-sm leading-6 text-[#6e6889]">
            Get notified about messages, mentions and important Anime Zone
            updates, even when you&apos;re away.
          </p>
        </div>

        {error && (
          <p className="mt-4 rounded-xl bg-red-50 p-3 text-sm text-red-600">
            {error}
          </p>
        )}

        <button
          type="button"
          onClick={() => void handleEnable()}
          disabled={loading}
          className="mt-6 w-full rounded-xl bg-[#8b5cf6] px-5 py-3 font-bold text-white transition hover:bg-[#7c3aed] disabled:opacity-50"
        >
          {loading ? "Enabling..." : "Enable notifications"}
        </button>

        <button
          type="button"
          onClick={handleNoThanks}
          disabled={loading}
          className="mt-2 w-full rounded-xl bg-[#f0efff] px-5 py-3 font-bold text-[#6e6889] hover:bg-[#e9e7ff]"
        >
          No thanks
        </button>

        <button
          type="button"
          onClick={() => void handleNeverShowAgain()}
          disabled={loading}
          className="mt-3 w-full py-2 text-xs font-semibold text-[#85809d] hover:text-[#6e6889]"
        >
          Never show again
        </button>
      </div>
    </div>
  );
}
