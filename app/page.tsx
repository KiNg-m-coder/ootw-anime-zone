
"use client";

import { useEffect, useState } from "react";
import type { ChangeEvent } from "react";
import { createClient } from "../src/lib/client";

type Screen =
  | "welcome"
  | "choose"
  | "guest"
  | "signup"
  | "signin"
  | "lobby";

type Tab = "lobby" | "chat";
type ImageType = "avatar" | "banner";

type Profile = {
  user_id: string;
  display_name: string;
  bio: string;
  avatar_url: string | null;
  banner_url: string | null;
  last_seen_at: string | null;
};

type Countdown = {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
};

function getNextSaturday(): number {
  // South Africa uses UTC+2.
  const now = new Date();
  const southAfricanNow = new Date(now.getTime() + 2 * 60 * 60 * 1000);

  const year = southAfricanNow.getUTCFullYear();
  const month = southAfricanNow.getUTCMonth();
  const date = southAfricanNow.getUTCDate();
  const weekday = southAfricanNow.getUTCDay();

  // Saturday = 6. If today is Saturday, target next Saturday.
  const daysUntilSaturday = weekday === 6 ? 7 : (6 - weekday + 7) % 7;

  // Saturday midnight in South Africa, converted to UTC.
  return Date.UTC(
    year,
    month,
    date + daysUntilSaturday,
    -2,
    0,
    0
  );
}

function getCountdown(): Countdown {
  const difference = Math.max(0, getNextSaturday() - Date.now());

  const totalSeconds = Math.floor(difference / 1000);

  return {
    days: Math.floor(totalSeconds / 86400),
    hours: Math.floor((totalSeconds % 86400) / 3600),
    minutes: Math.floor((totalSeconds % 3600) / 60),
    seconds: totalSeconds % 60,
  };
}

export default function Home() {
  const [supabase] = useState(() => createClient());

  const [screen, setScreen] = useState<Screen>("welcome");
  const [tab, setTab] = useState<Tab>("lobby");

  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [loading, setLoading] = useState(false);

  // Profile state
  const [profile, setProfile] = useState<Profile | null>(null);
  const [profileLoading, setProfileLoading] = useState(false);
  const [editingProfile, setEditingProfile] = useState(false);
  const [savingProfile, setSavingProfile] = useState(false);
  const [uploadingImage, setUploadingImage] = useState<ImageType | null>(null);

  const [displayName, setDisplayName] = useState("");
  const [bio, setBio] = useState("");
  const [profileError, setProfileError] = useState("");

  // Weekly Saturday countdown
  const [countdown, setCountdown] = useState<Countdown>({
    days: 0,
    hours: 0,
    minutes: 0,
    seconds: 0,
  });

  useEffect(() => {
    setCountdown(getCountdown());

    const interval = window.setInterval(() => {
      setCountdown(getCountdown());
    }, 1000);

    return () => window.clearInterval(interval);
  }, []);

  function validUsername(value: string) {
    const clean = value.trim();

    if (clean.length < 3 || clean.length > 20) {
      return "Username must be between 3 and 20 characters.";
    }

    if (!/^[a-zA-Z0-9_]+$/.test(clean)) {
      return "Use only letters, numbers and underscores.";
    }

    return "";
  }

  async function getOrCreateSession() {
    const {
      data: { session },
      error: sessionError,
    } = await supabase.auth.getSession();

    if (sessionError) throw sessionError;

    if (session) return session.user;

    const { data, error: signInError } =
      await supabase.auth.signInAnonymously();

    if (signInError) throw signInError;

    if (!data.user) {
      throw new Error("Could not create your guest session.");
    }

    return data.user;
  }

  async function getSavedUsername(userId: string) {
    const { data, error: queryError } = await supabase
      .from("anime_usernames")
      .select("username")
      .eq("user_id", userId)
      .maybeSingle();

    if (queryError) throw queryError;

    return data?.username ?? null;
  }

  async function saveUsername(userId: string, value: string) {
    const clean = value.trim();

    const { error: insertError } = await supabase
      .from("anime_usernames")
      .insert({
        user_id: userId,
        username: clean,
        username_normalized: clean.toLowerCase(),
      });

    if (insertError) {
      if (insertError.code === "23505") {
        throw new Error(
          insertError.message.includes("user_id")
            ? "This account already has a username. Try signing in or continuing as a guest."
            : "That username is already taken. Try another one."
        );
      }

      throw insertError;
    }
  }

  // Create or load the user's profile.
  async function loadProfile() {
    setProfileLoading(true);
    setProfileError("");

    try {
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError) throw userError;
      if (!user) throw new Error("Please sign in again.");

      const { data: existingProfile, error: fetchError } = await supabase
        .from("anime_profiles")
        .select("*")
        .eq("user_id", user.id)
        .maybeSingle();

      if (fetchError) throw fetchError;

      let currentProfile = existingProfile as Profile | null;

      if (!currentProfile) {
        const { data: newProfile, error: createError } = await supabase
          .from("anime_profiles")
          .insert({
            user_id: user.id,
            display_name: username,
            bio: "",
          })
          .select("*")
          .single();

        if (createError) throw createError;

        currentProfile = newProfile as Profile;
      }

      setProfile(currentProfile);
      setDisplayName(currentProfile.display_name || username);
      setBio(currentProfile.bio || "");

      await updateLastSeen(user.id);
    } catch (err) {
      console.error("Profile loading error:", err);
      setProfileError(
        err instanceof Error
          ? err.message
          : "Could not load your profile."
      );
    } finally {
      setProfileLoading(false);
    }
  }

  async function updateLastSeen(userId?: string) {
    try {
      let id = userId;

      if (!id) {
        const {
          data: { user },
        } = await supabase.auth.getUser();

        if (!user) return;
        id = user.id;
      }

      const timestamp = new Date().toISOString();

      const { error: updateError } = await supabase
        .from("anime_profiles")
        .update({ last_seen_at: timestamp })
        .eq("user_id", id);

      if (updateError) throw updateError;

      setProfile((previous) =>
        previous
          ? { ...previous, last_seen_at: timestamp }
          : previous
      );
    } catch (err) {
      console.error("Presence update error:", err);
    }
  }

  // Keep last-seen updated while the lobby is open.
  useEffect(() => {
    if (screen !== "lobby") return;

    void loadProfile();

    const interval = window.setInterval(() => {
      if (document.visibilityState === "visible") {
        void updateLastSeen();
      }
    }, 30000);

    function handleVisibilityChange() {
      if (document.visibilityState === "visible") {
        void updateLastSeen();
      }
    }

    document.addEventListener(
      "visibilitychange",
      handleVisibilityChange
    );

    return () => {
      window.clearInterval(interval);
      document.removeEventListener(
        "visibilitychange",
        handleVisibilityChange
      );
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [screen]);

  async function continueAsGuest() {
    const validation = validUsername(username);

    if (validation) {
      setError(validation);
      return;
    }

    setLoading(true);
    setError("");
    setNotice("");

    try {
      const user = await getOrCreateSession();
      const existingUsername = await getSavedUsername(user.id);

      if (existingUsername) {
        setUsername(existingUsername);
        setScreen("lobby");
        setTab("lobby");
        return;
      }

      await saveUsername(user.id, username);

      setUsername(username.trim());
      setScreen("lobby");
      setTab("lobby");
    } catch (err) {
      console.error("Guest account error:", err);
      setError(
        err instanceof Error ? err.message : "Could not continue as guest."
      );
    } finally {
      setLoading(false);
    }
  }

  async function createAccount() {
    const validation = validUsername(username);

    if (validation) {
      setError(validation);
      return;
    }

    if (!email.trim()) {
      setError("Please enter your email address.");
      return;
    }

    if (password.length < 8) {
      setError("Your password must be at least 8 characters.");
      return;
    }

    setLoading(true);
    setError("");
    setNotice("");

    try {
      const user = await getOrCreateSession();

      let existingUsername = await getSavedUsername(user.id);

      if (!existingUsername) {
        await saveUsername(user.id, username);
        existingUsername = username.trim();
      }

      const { error: updateError } = await supabase.auth.updateUser({
        email: email.trim(),
        password,
      });

      if (updateError) throw updateError;

      setUsername(existingUsername);
      setScreen("lobby");
      setTab("lobby");

      setNotice(
        "Your account has been created. Check your email if Supabase asks you to confirm your address."
      );
    } catch (err) {
      console.error("Account creation error:", err);
      setError(
        err instanceof Error ? err.message : "Could not create your account."
      );
    } finally {
      setLoading(false);
    }
  }

  async function signIn() {
    if (!email.trim() || !password) {
      setError("Enter your email and password.");
      return;
    }

    setLoading(true);
    setError("");
    setNotice("");

    try {
      const { data, error: signInError } =
        await supabase.auth.signInWithPassword({
          email: email.trim(),
          password,
        });

      if (signInError) throw signInError;

      if (!data.user) {
        throw new Error("Could not find your account.");
      }

      const savedUsername = await getSavedUsername(data.user.id);

      if (!savedUsername) {
        throw new Error(
          "Your account has no saved Anime Zone username. Please contact support."
        );
      }

      setUsername(savedUsername);
      setScreen("lobby");
      setTab("lobby");
    } catch (err) {
      console.error("Sign in error:", err);
      setError(
        err instanceof Error ? err.message : "Could not sign in."
      );
    } finally {
      setLoading(false);
    }
  }

  async function saveProfile() {
    if (!profile) return;

    const cleanName = displayName.trim();
    const cleanBio = bio.trim();

    if (!cleanName) {
      setProfileError("Your display name cannot be empty.");
      return;
    }

    if (cleanName.length > 30) {
      setProfileError("Your display name must be 30 characters or fewer.");
      return;
    }

    if (cleanBio.length > 160) {
      setProfileError("Your bio must be 160 characters or fewer.");
      return;
    }

    setSavingProfile(true);
    setProfileError("");

    try {
      const { data, error: updateError } = await supabase
        .from("anime_profiles")
        .update({
          display_name: cleanName,
          bio: cleanBio,
          updated_at: new Date().toISOString(),
        })
        .eq("user_id", profile.user_id)
        .select("*")
        .single();

      if (updateError) throw updateError;

      setProfile(data as Profile);
      setEditingProfile(false);
    } catch (err) {
      console.error("Profile save error:", err);
      setProfileError(
        err instanceof Error ? err.message : "Could not save your profile."
      );
    } finally {
      setSavingProfile(false);
    }
  }

  async function uploadProfileImage(
    event: ChangeEvent<HTMLInputElement>,
    type: ImageType
  ) {
    const file = event.target.files?.[0];
    event.target.value = "";

    if (!file || !profile) return;

    if (!file.type.startsWith("image/")) {
      setProfileError("Please choose an image file.");
      return;
    }

    if (file.size > 3 * 1024 * 1024) {
      setProfileError("Please choose an image smaller than 3 MB.");
      return;
    }

    setUploadingImage(type);
    setProfileError("");

    try {
      const extension = file.name.split(".").pop()?.toLowerCase() || "jpg";
      const filePath = `${profile.user_id}/${type}-${Date.now()}.${extension}`;

      const { error: uploadError } = await supabase.storage
        .from("anime-profiles")
        .upload(filePath, file, {
          upsert: false,
          contentType: file.type,
        });

      if (uploadError) throw uploadError;

      const { data: publicUrlData } = supabase.storage
        .from("anime-profiles")
        .getPublicUrl(filePath);

      const imageUrl = publicUrlData.publicUrl;

      const updateField =
        type === "avatar"
          ? { avatar_url: imageUrl }
          : { banner_url: imageUrl };

      const { data, error: updateError } = await supabase
        .from("anime_profiles")
        .update({
          ...updateField,
          updated_at: new Date().toISOString(),
        })
        .eq("user_id", profile.user_id)
        .select("*")
        .single();

      if (updateError) throw updateError;

      setProfile(data as Profile);
    } catch (err) {
      console.error("Image upload error:", err);
      setProfileError(
        err instanceof Error ? err.message : "Could not upload that image."
      );
    } finally {
      setUploadingImage(null);
    }
  }

  function getOnlineStatus(lastSeen: string | null) {
    if (!lastSeen) return false;

    const difference = Date.now() - new Date(lastSeen).getTime();

    return difference < 90000;
  }

  function formatLastSeen(lastSeen: string | null) {
    if (!lastSeen) return "Last seen unknown";

    const difference = Math.max(
      0,
      Date.now() - new Date(lastSeen).getTime()
    );

    if (difference < 90000) return "Online now";

    const minutes = Math.floor(difference / 60000);

    if (minutes < 60) {
      return `Last seen ${minutes} minute${minutes === 1 ? "" : "s"} ago`;
    }

    const hours = Math.floor(minutes / 60);

    if (hours < 24) {
      return `Last seen ${hours} hour${hours === 1 ? "" : "s"} ago`;
    }

    const days = Math.floor(hours / 24);
    return `Last seen ${days} day${days === 1 ? "" : "s"} ago`;
  }

  function goTo(next: Screen) {
    setError("");
    setNotice("");
    setScreen(next);
  }

  if (screen === "welcome") {
    return (
      <main className="min-h-screen bg-[#eaf7ff] text-[#17324d]">
        <div className="mx-auto flex min-h-screen max-w-6xl flex-col px-6">
          <header className="flex items-center justify-between py-7">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-[#65b9f5] text-xl text-white">
                ✦
              </div>
              <span className="text-lg font-black tracking-wide">
                OOTW <span className="text-[#55a9e8]">ANIME ZONE</span>
              </span>
            </div>
            <span className="rounded-full border border-[#c7e7fb] bg-white/70 px-4 py-2 text-xs font-semibold text-[#5795bf]">
              COMMUNITY • ANIME • FRIENDS
            </span>
          </header>

          <section className="flex flex-1 flex-col items-center justify-center py-16 text-center">
            <div className="mb-8 flex h-36 w-36 items-center justify-center rounded-[2.5rem] border-4 border-white bg-gradient-to-br from-[#bde8ff] to-[#69baf4] text-7xl shadow-xl shadow-blue-200/60">
              🦁
            </div>

            <p className="mb-4 rounded-full bg-white px-5 py-2 text-xs font-bold uppercase tracking-[0.25em] text-[#5b9bc7] shadow-sm">
              A new world awaits
            </p>

            <h1 className="text-5xl font-black leading-tight sm:text-7xl">
              Welcome to
              <span className="block text-[#55a9e8]">Anime Zone.</span>
            </h1>

            <p className="mt-6 max-w-xl text-base leading-8 text-[#68849a] sm:text-lg">
              Discover anime, meet fellow fans, share your favourite moments
              and become part of a community beyond this world.
            </p>

            <button
              onClick={() => goTo("choose")}
              className="mt-10 rounded-2xl bg-[#55a9e8] px-10 py-4 font-bold text-white shadow-lg shadow-blue-200 transition hover:-translate-y-1 hover:bg-[#3999df]"
            >
              Enter Anime Zone →
            </button>

            <p className="mt-12 text-xs font-medium tracking-wide text-[#91adc1]">
              BUILT BY OOTW · OUT OF THIS WORLD
            </p>
          </section>
        </div>
      </main>
    );
  }

  if (screen === "choose") {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#eaf7ff] px-5 py-12 text-[#17324d]">
        <div className="w-full max-w-md rounded-[2rem] border border-white bg-white/90 p-8 shadow-xl shadow-blue-100">
          <button onClick={() => goTo("welcome")} className="text-sm font-semibold text-[#6d9dbc]">
            ← Back
          </button>

          <div className="mt-7 text-5xl">🦁</div>
          <h1 className="mt-5 text-3xl font-black">Join Anime Zone</h1>
          <p className="mt-3 text-sm leading-6 text-[#7893a7]">
            Choose how you want to enter our community.
          </p>

          <button
            onClick={() => goTo("guest")}
            className="mt-8 w-full rounded-2xl bg-[#55a9e8] p-5 text-left text-white transition hover:bg-[#3999df]"
          >
            <span className="block text-lg font-black">Continue as Guest</span>
            <span className="mt-1 block text-sm text-white/80">
              Username only · No email or password
            </span>
          </button>

          <button
            onClick={() => goTo("signup")}
            className="mt-4 w-full rounded-2xl border-2 border-[#cdeafa] bg-[#f5fbff] p-5 text-left transition hover:bg-[#eaf7ff]"
          >
            <span className="block text-lg font-black">Create an Account</span>
            <span className="mt-1 block text-sm text-[#7893a7]">
              Username, email and password · Recoverable account
            </span>
          </button>

          <div className="my-6 flex items-center gap-3">
            <div className="h-px flex-1 bg-[#e1eff8]" />
            <span className="text-xs font-semibold text-[#9ab0c1]">ALREADY A MEMBER?</span>
            <div className="h-px flex-1 bg-[#e1eff8]" />
          </div>

          <button
            onClick={() => goTo("signin")}
            className="w-full rounded-2xl py-3 font-bold text-[#55a9e8] hover:bg-[#f3faff]"
          >
            Sign in to your account →
          </button>
        </div>
      </main>
    );
  }

  if (screen === "guest" || screen === "signup" || screen === "signin") {
    const isGuest = screen === "guest";
    const isSignup = screen === "signup";

    return (
      <main className="flex min-h-screen items-center justify-center bg-[#eaf7ff] px-5 py-12 text-[#17324d]">
        <div className="w-full max-w-md rounded-[2rem] border border-white bg-white/90 p-8 shadow-xl shadow-blue-100">
          <button onClick={() => goTo("choose")} className="text-sm font-semibold text-[#6d9dbc]">
            ← Back
          </button>

          <div className="mt-6 text-5xl">🦁</div>

          <p className="mt-5 text-xs font-bold uppercase tracking-[0.2em] text-[#65a9d5]">
            {isGuest ? "Guest access" : isSignup ? "Create your account" : "Welcome back"}
          </p>

          <h1 className="mt-2 text-3xl font-black">
            {isGuest ? "Choose a username" : isSignup ? "Sign up" : "Sign in"}
          </h1>

          <p className="mt-3 text-sm leading-6 text-[#7893a7]">
            {isGuest
              ? "Join quickly with a username. Your guest session stays on this browser."
              : isSignup
                ? "Create a recoverable account to keep access to your profile."
                : "Sign in with the email and password you registered with."}
          </p>

          {screen !== "signin" && (
            <>
              <label className="mt-7 block text-sm font-bold">Username</label>
              <div className="mt-2 flex items-center rounded-2xl border-2 border-[#d9edfa] bg-[#f6fbff] px-4 focus-within:border-[#65b9f5]">
                <span className="font-bold text-[#8bb9d8]">@</span>
                <input
                  value={username}
                  onChange={(event) => {
                    setUsername(event.target.value);
                    setError("");
                  }}
                  maxLength={20}
                  placeholder="YourAnimeName"
                  className="w-full bg-transparent px-3 py-4 text-sm font-semibold outline-none"
                />
              </div>
            </>
          )}

          {!isGuest && (
            <>
              <label className="mt-6 block text-sm font-bold">Email</label>
              <input
                type="email"
                autoComplete="email"
                value={email}
                onChange={(event) => {
                  setEmail(event.target.value);
                  setError("");
                }}
                placeholder="you@example.com"
                className="mt-2 w-full rounded-2xl border-2 border-[#d9edfa] bg-[#f6fbff] px-4 py-4 text-sm outline-none focus:border-[#65b9f5]"
              />

              <label className="mt-6 block text-sm font-bold">Password</label>
              <input
                type="password"
                autoComplete={isSignup ? "new-password" : "current-password"}
                value={password}
                onChange={(event) => {
                  setPassword(event.target.value);
                  setError("");
                }}
                placeholder={isSignup ? "At least 8 characters" : "Your password"}
                className="mt-2 w-full rounded-2xl border-2 border-[#d9edfa] bg-[#f6fbff] px-4 py-4 text-sm outline-none focus:border-[#65b9f5]"
              />
            </>
          )}

          {error && (
            <p className="mt-4 break-words rounded-xl bg-red-50 px-4 py-3 text-sm font-medium text-red-500">
              {error}
            </p>
          )}

          {notice && (
            <p className="mt-4 break-words rounded-xl bg-green-50 px-4 py-3 text-sm font-medium text-green-700">
              {notice}
            </p>
          )}

          <button
            disabled={loading}
            onClick={() => {
              if (isGuest) void continueAsGuest();
              else if (isSignup) void createAccount();
              else void signIn();
            }}
            className="mt-7 w-full rounded-2xl bg-[#55a9e8] px-6 py-4 font-bold text-white shadow-lg shadow-blue-100 transition hover:bg-[#3999df] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loading
              ? "Please wait..."
              : isGuest
                ? "Enter as Guest →"
                : isSignup
                  ? "Create Account →"
                  : "Sign In →"}
          </button>

          {screen === "signup" && (
            <p className="mt-5 text-center text-xs text-[#9ab0c1]">
              Already registered?{" "}
              <button onClick={() => goTo("signin")} className="font-bold text-[#55a9e8]">
                Sign in
              </button>
            </p>
          )}

          {screen === "signin" && (
            <p className="mt-5 text-center text-xs text-[#9ab0c1]">
              New here?{" "}
              <button onClick={() => goTo("signup")} className="font-bold text-[#55a9e8]">
                Create an account
              </button>
            </p>
          )}
        </div>
      </main>
    );
  }

  const isOnline = getOnlineStatus(profile?.last_seen_at ?? null);

  return (
    <main className="min-h-screen bg-[#edf8ff] pb-24 text-[#17324d]">
      <div className="mx-auto max-w-6xl px-5">
        <header className="flex items-center justify-between py-6">
          <div>
            <p className="font-black tracking-wide">
              OOTW <span className="text-[#55a9e8]">ANIME ZONE</span>
            </p>
            <p className="text-xs text-[#8aa8bd]">OUT OF THIS WORLD</p>
          </div>
          <span className="rounded-full border border-[#c7e7fb] bg-white px-4 py-2 text-xs font-bold text-[#5795bf]">
            🟢 COMMUNITY
          </span>
        </header>

        {tab === "lobby" ? (
          <div className="space-y-7">
            {/* PROFILE CARD */}
            <section className="overflow-hidden rounded-[2rem] border border-white bg-white shadow-lg shadow-blue-100/60">
              <div
                className="relative z-0 h-40 bg-gradient-to-r from-[#8ed3ff] via-[#b8e5ff] to-[#77c4f7] bg-cover bg-center sm:h-52"
                style={
                  profile?.banner_url
                    ? { backgroundImage: `url("${profile.banner_url}")` }
                    : undefined
                }
              >
                {!profile?.banner_url && (
                  <>
                    <span className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 text-6xl text-white/50">
                      ✦
                    </span>
                    <span className="absolute right-12 top-8 text-4xl text-white/60">✧</span>
                    <span className="absolute bottom-5 left-10 text-3xl text-white/60">✦</span>
                  </>
                )}

                <span className="absolute right-5 top-5 rounded-full bg-white/80 px-3 py-1 text-xs font-bold text-[#5795bf]">
                  MY PROFILE
                </span>
              </div>

              <div className="px-6 pb-7">
                <div className="-mt-12 flex flex-wrap items-end justify-between gap-4">
                  <div className="relative z-20 flex h-24 w-24 shrink-0 items-center justify-center overflow-hidden rounded-[1.7rem] border-4 border-white bg-[#dff3ff] text-5xl shadow-md">
                    {profile?.avatar_url ? (
                      <img
                        src={profile.avatar_url}
                        alt="Profile picture"
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      "🦁"
                    )}
                  </div>

                  <span
                    className={`mb-2 rounded-full px-4 py-2 text-xs font-bold ${
                      isOnline
                        ? "bg-green-50 text-green-700"
                        : "bg-[#f0f5f8] text-[#7893a7]"
                    }`}
                  >
                    {isOnline ? "● ONLINE" : "● OFFLINE"}
                  </span>
                </div>

                {profileLoading ? (
                  <p className="mt-5 text-sm text-[#7893a7]">
                    Loading your profile...
                  </p>
                ) : (
                  <>
                    <h1 className="mt-4 text-2xl font-black">
                      {profile?.display_name || username}
                    </h1>
                    <p className="mt-1 text-sm text-[#78a0ba]">
                      @{username}
                    </p>
                    <p className="mt-2 text-xs text-[#91aabd]">
                      {formatLastSeen(profile?.last_seen_at ?? null)}
                    </p>
                    <p className="mt-4 max-w-xl whitespace-pre-wrap text-sm leading-6 text-[#7893a7]">
                      {profile?.bio ||
                        "No bio yet. Tell the community a little about yourself!"}
                    </p>

                    <button
                      onClick={() => {
                        setDisplayName(profile?.display_name || username);
                        setBio(profile?.bio || "");
                        setProfileError("");
                        setEditingProfile(true);
                      }}
                      className="mt-5 rounded-xl bg-[#55a9e8] px-5 py-3 text-sm font-bold text-white transition hover:bg-[#3999df]"
                    >
                      ✎ Edit profile
                    </button>
                  </>
                )}

                {profileError && (
                  <p className="mt-4 break-words rounded-xl bg-red-50 px-4 py-3 text-sm text-red-600">
                    {profileError}
                  </p>
                )}
              </div>
            </section>

            {/* PROFILE EDITOR */}
            {editingProfile && (
              <section className="rounded-[1.7rem] border border-white bg-white p-6 shadow-md shadow-blue-100/50">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <h2 className="text-xl font-black">Edit your profile</h2>
                    <p className="mt-1 text-sm text-[#7893a7]">
                      Make your Anime Zone profile yours.
                    </p>
                  </div>
                  <button
                    onClick={() => {
                      setEditingProfile(false);
                      setProfileError("");
                    }}
                    className="rounded-xl bg-[#f0f8fd] px-3 py-2 text-sm font-bold text-[#6b9dbd]"
                  >
                    ✕
                  </button>
                </div>

                <div className="mt-6 grid gap-4 sm:grid-cols-2">
                  <label className="cursor-pointer rounded-2xl border-2 border-dashed border-[#b8ddf4] bg-[#f5fbff] p-5 text-center transition hover:bg-[#eaf7ff]">
                    <span className="block text-3xl">📷</span>
                    <span className="mt-2 block text-sm font-black">
                      {uploadingImage === "avatar"
                        ? "Uploading..."
                        : "Change profile picture"}
                    </span>
                    <span className="mt-1 block text-xs text-[#7893a7]">
                      JPG, PNG or WEBP · Max 3 MB
                    </span>
                    <input
                      type="file"
                      accept="image/png,image/jpeg,image/webp"
                      className="hidden"
                      disabled={uploadingImage !== null}
                      onChange={(event) =>
                        void uploadProfileImage(event, "avatar")
                      }
                    />
                  </label>

                  <label className="cursor-pointer rounded-2xl border-2 border-dashed border-[#b8ddf4] bg-[#f5fbff] p-5 text-center transition hover:bg-[#eaf7ff]">
                    <span className="block text-3xl">🖼️</span>
                    <span className="mt-2 block text-sm font-black">
                      {uploadingImage === "banner"
                        ? "Uploading..."
                        : "Change banner"}
                    </span>
                    <span className="mt-1 block text-xs text-[#7893a7]">
                      JPG, PNG or WEBP · Max 3 MB
                    </span>
                    <input
                      type="file"
                      accept="image/png,image/jpeg,image/webp"
                      className="hidden"
                      disabled={uploadingImage !== null}
                      onChange={(event) =>
                        void uploadProfileImage(event, "banner")
                      }
                    />
                  </label>
                </div>

                <label className="mt-6 block text-sm font-bold">
                  Display name
                </label>
                <input
                  value={displayName}
                  onChange={(event) => setDisplayName(event.target.value)}
                  maxLength={30}
                  placeholder="Your display name"
                  className="mt-2 w-full rounded-2xl border-2 border-[#d9edfa] bg-[#f6fbff] px-4 py-4 text-sm outline-none focus:border-[#65b9f5]"
                />
                <p className="mt-1 text-right text-xs text-[#91aabd]">
                  {displayName.length}/30
                </p>

                <label className="mt-5 block text-sm font-bold">
                  Username
                </label>
                <div className="mt-2 rounded-2xl border border-[#d9edfa] bg-[#f0f7fb] px-4 py-4 text-sm font-semibold text-[#7893a7]">
                  @{username} · Permanent username
                </div>
                <p className="mt-1 text-xs text-[#91aabd]">
                  Your username cannot be changed here.
                </p>

                <label className="mt-5 block text-sm font-bold">Bio</label>
                <textarea
                  value={bio}
                  onChange={(event) => setBio(event.target.value)}
                  maxLength={160}
                  rows={4}
                  placeholder="Tell everyone about yourself and your favourite anime..."
                  className="mt-2 w-full resize-none rounded-2xl border-2 border-[#d9edfa] bg-[#f6fbff] px-4 py-4 text-sm outline-none focus:border-[#65b9f5]"
                />
                <p className="mt-1 text-right text-xs text-[#91aabd]">
                  {bio.length}/160
                </p>

                {profileError && (
                  <p className="mt-4 break-words rounded-xl bg-red-50 px-4 py-3 text-sm text-red-600">
                    {profileError}
                  </p>
                )}

                <div className="mt-6 flex flex-wrap gap-3">
                  <button
                    onClick={() => void saveProfile()}
                    disabled={savingProfile || uploadingImage !== null}
                    className="rounded-xl bg-[#55a9e8] px-6 py-3 text-sm font-bold text-white transition hover:bg-[#3999df] disabled:opacity-50"
                  >
                    {savingProfile ? "Saving..." : "Save changes"}
                  </button>
                  <button
                    onClick={() => {
                      setEditingProfile(false);
                      setProfileError("");
                    }}
                    className="rounded-xl bg-[#f0f7fb] px-6 py-3 text-sm font-bold text-[#7893a7]"
                  >
                    Cancel
                  </button>
                </div>
              </section>
            )}

            {/* WEEKLY ANNOUNCEMENT */}
            <section className="rounded-[1.7rem] border border-white bg-white p-6 shadow-md shadow-blue-100/50">
              <div className="flex items-center justify-between gap-3">
                <h2 className="text-lg font-black">📢 Announcements</h2>
                <span className="rounded-full bg-[#e3f4ff] px-3 py-1 text-xs font-bold text-[#5795bf]">
                  OOTW STAFF
                </span>
              </div>

              <div className="mt-4 rounded-2xl bg-[#eff9ff] p-5">
                <div className="flex items-center gap-2">
                  <span className="text-xl">📣</span>
                  <p className="font-black">Official Announcement</p>
                </div>

                <p className="mt-3 text-sm leading-6 text-[#7893a7]">
                  Admins/staff will post announcements here, so stay tuned!
                  Check back regularly to keep up with everything happening
                  in OOTW Anime Zone.
                </p>
              </div>

              <div className="mt-5 rounded-2xl border border-[#d5edfc] bg-white p-5">
                <div className="text-center">
                  <p className="text-xs font-black uppercase tracking-[0.2em] text-[#75a9cb]">
                    Next weekly update
                  </p>
                  <h3 className="mt-2 text-xl font-black">
                    🦁 Saturday Update
                  </h3>
                  <p className="mt-1 text-xs text-[#91aabd]">
                    New updates every Saturday · South African time
                  </p>
                </div>

                <div className="mt-5 grid grid-cols-4 gap-2 sm:gap-4">
                  {[
                    { label: "Days", value: countdown.days },
                    { label: "Hours", value: countdown.hours },
                    { label: "Minutes", value: countdown.minutes },
                    { label: "Seconds", value: countdown.seconds },
                  ].map((item) => (
                    <div
                      key={item.label}
                      className="rounded-xl bg-[#eff9ff] px-2 py-4 text-center"
                    >
                      <p className="text-2xl font-black tabular-nums text-[#3999df] sm:text-3xl">
                        {String(item.value).padStart(2, "0")}
                      </p>
                      <p className="mt-1 text-[10px] font-bold uppercase tracking-wider text-[#86a8bf] sm:text-xs">
                        {item.label}
                      </p>
                    </div>
                  ))}
                </div>

                <p className="mt-4 text-center text-xs text-[#91aabd]">
                  The countdown automatically resets for the next Saturday.
                </p>
              </div>
            </section>

            <section>
              <div className="mb-4 flex items-center justify-between">
                <h2 className="text-xl font-black">🔥 Trending Anime</h2>
                <span className="text-xs font-semibold text-[#75a9cb]">DISCOVER</span>
              </div>
              <div className="grid gap-4 sm:grid-cols-3">
                {[
                  { name: "Black Clover", emoji: "🍀", description: "Magic, rivalry and determination." },
                  { name: "Solo Leveling", emoji: "⚔️", description: "A world of hunters and quests." },
                  { name: "One Piece", emoji: "☠️", description: "Adventure across the seas." },
                ].map((anime) => (
                  <article
                    key={anime.name}
                    className="rounded-[1.5rem] border border-white bg-white p-5 shadow-md shadow-blue-100/50"
                  >
                    <div className="flex h-24 items-center justify-center rounded-2xl bg-gradient-to-br from-[#d8f1ff] to-[#a9ddff] text-5xl">
                      {anime.emoji}
                    </div>
                    <h3 className="mt-4 font-black">{anime.name}</h3>
                    <p className="mt-1 text-sm text-[#7893a7]">
                      {anime.description}
                    </p>
                  </article>
                ))}
              </div>
            </section>

            <section className="rounded-[1.7rem] border border-dashed border-[#a9d7f3] bg-white/60 p-7 text-center">
              <div className="text-4xl">💬</div>
              <h2 className="mt-3 text-lg font-black">Community Feed</h2>
              <p className="mt-2 text-sm text-[#7893a7]">
                Anime discussions and community posts will appear here.
              </p>
              <span className="mt-4 inline-block rounded-full bg-[#e3f4ff] px-4 py-2 text-xs font-bold text-[#5795bf]">
                COMING SOON
              </span>
            </section>
          </div>
        ) : (
          <section className="flex min-h-[65vh] flex-col items-center justify-center rounded-[2rem] border border-white bg-white p-8 text-center shadow-lg shadow-blue-100/60">
            <div className="text-6xl">💬</div>
            <h1 className="mt-5 text-3xl font-black">Anime Chat</h1>
            <p className="mt-3 max-w-md text-sm leading-6 text-[#7893a7]">
              The shared community chat is coming next. Soon you'll be able to
              talk with other anime fans here.
            </p>
            <span className="mt-5 rounded-full bg-[#e3f4ff] px-4 py-2 text-xs font-bold text-[#5795bf]">
              CHAT · COMING SOON
            </span>
          </section>
        )}
      </div>

      <nav className="fixed bottom-0 left-0 right-0 z-20 border-t border-[#d8edfa] bg-white/95 px-5 py-3 backdrop-blur">
        <div className="mx-auto flex max-w-md items-center justify-around">
          <button
            onClick={() => setTab("lobby")}
            className={`flex flex-col items-center gap-1 rounded-2xl px-8 py-2 text-sm font-bold transition ${
              tab === "lobby"
                ? "bg-[#e4f5ff] text-[#3999df]"
                : "text-[#91a9ba]"
            }`}
          >
            <span className="text-xl">🏠</span>
            Lobby
          </button>
          <button
            onClick={() => setTab("chat")}
            className={`flex flex-col items-center gap-1 rounded-2xl px-8 py-2 text-sm font-bold transition ${
              tab === "chat"
                ? "bg-[#e4f5ff] text-[#3999df]"
                : "text-[#91a9ba]"
            }`}
          >
            <span className="text-xl">💬</span>
            Chat
          </button>
        </div>
      </nav>
    </main>
  );
}
