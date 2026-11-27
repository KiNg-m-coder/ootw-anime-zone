
"use client";

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding)
    .replace(/-/g, "+")
    .replace(/_/g, "/");

  const rawData = window.atob(base64);

  return Uint8Array.from(rawData, (char) => char.charCodeAt(0));
}

export async function getNotificationStatus() {
  if (
    typeof window === "undefined" ||
    !("Notification" in window) ||
    !("serviceWorker" in navigator) ||
    !("PushManager" in window)
  ) {
    return {
      supported: false,
      permission: "unsupported",
      subscribed: false,
    };
  }

  const registration = await navigator.serviceWorker.getRegistration("/");

  const subscription = registration
    ? await registration.pushManager.getSubscription()
    : null;

  return {
    supported: true,
    permission: Notification.permission,
    subscribed: Boolean(subscription),
  };
}

export async function enablePushNotifications() {
  if (
    !("Notification" in window) ||
    !("serviceWorker" in navigator) ||
    !("PushManager" in window)
  ) {
    throw new Error(
      "This browser does not support push notifications."
    );
  }

  if (!window.isSecureContext) {
    throw new Error(
      "Notifications require HTTPS or localhost."
    );
  }

  const permission = await Notification.requestPermission();

  if (permission !== "granted") {
    throw new Error(
      permission === "denied"
        ? "Notifications are blocked in your browser settings."
        : "Notification permission was not granted."
    );
  }

  const publicKey =
    process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;

  if (!publicKey) {
    throw new Error("VAPID public key is missing.");
  }

  const registration = await navigator.serviceWorker.register(
    "/sw.js",
    {
      scope: "/",
    }
  );

  await navigator.serviceWorker.ready;

  let subscription =
    await registration.pushManager.getSubscription();

  if (!subscription) {
    subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey:
        urlBase64ToUint8Array(publicKey) as BufferSource,
    });
  }

  const saveResponse = await fetch(
    "/api/notifications/subscribe",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        subscription: subscription.toJSON(),
      }),
    }
  );

  if (!saveResponse.ok) {
    const result = await saveResponse.json().catch(() => null);

    throw new Error(
      result?.error || "Could not save your device subscription."
    );
  }

  const preferenceResponse = await fetch(
    "/api/notifications/preferences",
    {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        enabled: true,
        never_prompt: false,
      }),
    }
  );

  if (!preferenceResponse.ok) {
    throw new Error(
      "Your device was registered, but preferences could not be saved."
    );
  }

  return {
    success: true,
    subscription,
  };
}

export async function disablePushNotifications() {
  if (!("serviceWorker" in navigator)) {
    return { success: true };
  }

  const registration =
    await navigator.serviceWorker.getRegistration("/");

  const subscription =
    registration
      ? await registration.pushManager.getSubscription()
      : null;

  if (subscription) {
    const response = await fetch(
      "/api/notifications/unsubscribe",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          endpoint: subscription.endpoint,
        }),
      }
    );

    if (!response.ok) {
      throw new Error("Could not remove device subscription.");
    }

    await subscription.unsubscribe();
  }

  const preferenceResponse = await fetch(
    "/api/notifications/preferences",
    {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        enabled: false,
      }),
    }
  );

  if (!preferenceResponse.ok) {
    throw new Error("Could not update notification settings.");
  }

  return { success: true };
}

export async function updateNotificationPreferences(
  preferences: {
    direct_messages?: boolean;
    mentions?: boolean;
    global_replies?: boolean;
    announcements?: boolean;
    never_prompt?: boolean;
  }
) {
  const response = await fetch(
    "/api/notifications/preferences",
    {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(preferences),
    }
  );

  if (!response.ok) {
    const result = await response.json().catch(() => null);

    throw new Error(
      result?.error || "Could not update preferences."
    );
  }

  return response.json();
}
