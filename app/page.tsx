
"use client";

import { useEffect, useRef, useState } from "react";
import type { ChangeEvent } from "react";
import { createClient } from "../src/lib/client";

type Screen =
  | "welcome"
  | "choose"
  | "guest"
  | "signup"
  | "signin"
  | "lobby";

type Tab = "lobby" | "chat" | "leaderboard";
type ImageType = "avatar" | "banner";

type Profile = {
  user_id: string;
  display_name: string;
  bio: string;
  avatar_url: string | null;
  banner_url: string | null;
  last_seen_at: string | null;
};

type FriendSearchResult = {
  user_id: string;
  username: string;
  display_name: string;
  bio: string;
  avatar_url: string | null;
};

type FriendRequest = {
  id: string;
  sender_id: string;
  recipient_id: string;
  status: "pending" | "accepted" | "declined";
  created_at: string;
};

type Friend = FriendSearchResult & { request_id: string };

type SuggestionVote = -1 | 1;

type Suggestion = {
  id: string;
  user_id: string;
  username: string;
  content: string;
  created_at: string;
  likes: number;
  dislikes: number;
  myVote: SuggestionVote | null;
};

type SuggestionPostRow = {
  id: string;
  user_id: string;
  username: string;
  content: string;
  created_at: string;
};

type SuggestionVoteRow = {
  suggestion_id: string;
  user_id: string;
  vote: SuggestionVote;
};

type Countdown = {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
};

function getSouthAfricaMonthKey(): string {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Africa/Johannesburg",
    year: "numeric",
    month: "2-digit",
  }).formatToParts(new Date());
  const year = parts.find((part) => part.type === "year")?.value ?? "";
  const month = parts.find((part) => part.type === "month")?.value ?? "";
  return `${year}-${month}`;
}

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
  const [isGuestAccount, setIsGuestAccount] = useState(false);
  const [restoringSession, setRestoringSession] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [sendingReset, setSendingReset] = useState(false);

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

  // Profile popup and instant image previews
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [bannerPreview, setBannerPreview] = useState<string | null>(null);

  // Friends and friend requests (works for guest and registered auth users).
  const [friendSearchOpen, setFriendSearchOpen] = useState(false);
  const [friendSearchTerm, setFriendSearchTerm] = useState("");
  const [friendSearchResults, setFriendSearchResults] = useState<FriendSearchResult[]>([]);
  const [friendSearchLoading, setFriendSearchLoading] = useState(false);
  const friendSearchSequence = useRef(0);
  const [friendActionLoading, setFriendActionLoading] = useState<string | null>(null);
  const [friendError, setFriendError] = useState("");
  const [friendNotice, setFriendNotice] = useState("");
  const [incomingRequests, setIncomingRequests] = useState<FriendRequest[]>([]);
  const [friends, setFriends] = useState<Friend[]>([]);
  const [friendsLoading, setFriendsLoading] = useState(false);

  // Community suggestion feed
  const [suggestionText, setSuggestionText] = useState("");
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [suggestionsLoading, setSuggestionsLoading] = useState(false);
  const [postingSuggestion, setPostingSuggestion] = useState(false);
  const [suggestionError, setSuggestionError] = useState("");

  // Monthly community anime theme voting and live site activity.
  const monthlyAnimeOptions = ["One Piece", "Naruto", "Jujutsu Kaisen", "Demon Slayer", "Solo Leveling", "Attack on Titan", "My Hero Academia", "Black Clover"];
  const [monthlyVotes, setMonthlyVotes] = useState<{ anime_name: string; votes: number; my_vote: boolean }[]>([]);
  const [monthlyVoteLoading, setMonthlyVoteLoading] = useState(false);
  const [monthlyVoteError, setMonthlyVoteError] = useState("");
  const [siteVisits, setSiteVisits] = useState(0);
  const [onlineNow, setOnlineNow] = useState(0);

  // Weekly Saturday countdown
  const [countdown, setCountdown] = useState<Countdown>({
    days: 0,
    hours: 0,
    minutes: 0,
    seconds: 0,
  });

  // Restore an existing guest or registered session when Anime Zone is reopened.
  // Supabase persists the auth session in this browser until the user logs out.
  useEffect(() => {
    let cancelled = false;

    async function restoreExistingSession() {
      try {
        const { data: { session }, error: sessionError } =
          await supabase.auth.getSession();
        if (sessionError) throw sessionError;
        if (!session) return;

        const savedUsername = await getSavedUsername(session.user.id);
        if (!savedUsername || cancelled) return;

        setUsername(savedUsername);
        setIsGuestAccount(Boolean((session.user as { is_anonymous?: boolean }).is_anonymous));
        setScreen("lobby");
        setTab("lobby");
      } catch (restoreError) {
        console.error("Session restore error:", restoreError);
      } finally {
        if (!cancelled) setRestoringSession(false);
      }
    }

    void restoreExistingSession();
    return () => { cancelled = true; };
    // Run once when the app opens.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    setCountdown(getCountdown());

    const interval = window.setInterval(() => {
      setCountdown(getCountdown());
    }, 1000);

    return () => window.clearInterval(interval);
  }, []);

  function isAnimeZoneAdmin(value: string) {
    const normalized = value.trim().replace(/^@/, "").toLowerCase();
    return normalized === "ootwtech" || normalized === "animeking2026";
  }

  function AdminName({ value }: { value: string }) {
    if (!isAnimeZoneAdmin(value)) return <>{value}</>;
    return <span className="inline-flex items-center gap-1"><span className="bg-gradient-to-r from-red-500 via-amber-400 via-green-500 via-cyan-500 via-blue-500 to-fuchsia-500 bg-clip-text font-black text-transparent">{value}</span><span aria-label="Anime Zone admin" title="Anime Zone admin" className="text-amber-400">★</span></span>;
  }

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

  // Search automatically as the user types, with a short debounce so we do not
  // send a database request for every keystroke.
  useEffect(() => {
    const term = friendSearchTerm.trim();
    const sequence = ++friendSearchSequence.current;

    if (!friendSearchOpen || term.length < 2) {
      setFriendSearchResults([]);
      setFriendSearchLoading(false);
      if (term.length < 2) setFriendError("");
      return;
    }

    setFriendSearchLoading(true);
    setFriendError("");
    const timeout = window.setTimeout(async () => {
      try {
        const { data, error: searchError } = await supabase.rpc("anime_search_users", { search_term: term });
        if (sequence !== friendSearchSequence.current) return;
        if (searchError) throw searchError;
        setFriendSearchResults((data || []) as FriendSearchResult[]);
      } catch (err) {
        if (sequence !== friendSearchSequence.current) return;
        console.error("Friend search error:", err);
        setFriendSearchResults([]);
        setFriendError(err instanceof Error ? err.message : "Could not search Anime Zone users.");
      } finally {
        if (sequence === friendSearchSequence.current) setFriendSearchLoading(false);
      }
    }, 300);

    return () => window.clearTimeout(timeout);
  }, [friendSearchTerm, friendSearchOpen]);

  async function sendFriendRequest(targetUserId: string) {
    setFriendActionLoading(targetUserId);
    setFriendError("");
    setFriendNotice("");
    try {
      const { error: requestError } = await supabase.rpc("anime_send_friend_request", { target_user_id: targetUserId });
      if (requestError) throw requestError;
      setFriendNotice("Friend request sent!");
      setFriendSearchResults((current) => current.filter((person) => person.user_id !== targetUserId));
      await loadFriendData();
    } catch (err) {
      console.error("Send friend request error:", err);
      setFriendError(err instanceof Error ? err.message : "Could not send friend request.");
    } finally {
      setFriendActionLoading(null);
    }
  }

  async function respondToFriendRequest(requestId: string, decision: "accepted" | "declined") {
    setFriendActionLoading(requestId);
    setFriendError("");
    try {
      const { error: responseError } = await supabase.rpc("anime_respond_friend_request", { request_id: requestId, decision });
      if (responseError) throw responseError;
      await loadFriendData();
    } catch (err) {
      console.error("Friend request response error:", err);
      setFriendError(err instanceof Error ? err.message : "Could not update friend request.");
    } finally {
      setFriendActionLoading(null);
    }
  }

  async function loadFriendData() {
    setFriendsLoading(true);
    try {
      const { data: authData, error: authError } = await supabase.auth.getUser();
      if (authError) throw authError;
      const currentUserId = authData.user?.id;
      if (!currentUserId) return;

      const { data: requestRows, error: requestsError } = await supabase
        .from("anime_friend_requests")
        .select("id, sender_id, recipient_id, status, created_at")
        .or(`sender_id.eq.${currentUserId},recipient_id.eq.${currentUserId}`)
        .order("created_at", { ascending: false });
      if (requestsError) throw requestsError;

      const rows = (requestRows || []) as FriendRequest[];
      setIncomingRequests(rows.filter((row) => row.status === "pending" && row.recipient_id === currentUserId));
      const accepted = rows.filter((row) => row.status === "accepted");
      const friendIds = accepted.map((row) => row.sender_id === currentUserId ? row.recipient_id : row.sender_id);
      if (friendIds.length === 0) {
        setFriends([]);
        return;
      }

      const [{ data: names, error: namesError }, { data: profiles, error: profilesError }] = await Promise.all([
        supabase.from("anime_usernames").select("user_id, username").in("user_id", friendIds),
        supabase.from("anime_profiles").select("user_id, display_name, bio, avatar_url").in("user_id", friendIds),
      ]);
      if (namesError) throw namesError;
      if (profilesError) throw profilesError;
      const nameRows = names || [];
      const profileRows = profiles || [];
      const nextFriends: Friend[] = friendIds.flatMap((id) => {
        const name = nameRows.find((item) => item.user_id === id);
        if (!name) return [];
        const personProfile = profileRows.find((item) => item.user_id === id);
        const relation = accepted.find((row) => row.sender_id === id || row.recipient_id === id);
        return [{
          user_id: id,
          username: name.username,
          display_name: personProfile?.display_name || name.username,
          bio: personProfile?.bio || "",
          avatar_url: personProfile?.avatar_url || null,
          request_id: relation?.id || "",
        }];
      });
      setFriends(nextFriends);
    } catch (err) {
      console.error("Friend data loading error:", err);
      setFriendError(err instanceof Error ? err.message : "Could not load friends.");
    } finally {
      setFriendsLoading(false);
    }
  }

  useEffect(() => {
    if (screen === "lobby" && tab === "chat") void loadFriendData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [screen, tab]);

  async function loadSuggestions() {
    setSuggestionsLoading(true);
    setSuggestionError("");

    try {
      const { data: postRows, error: postsError } = await supabase
        .from("anime_suggestions")
        .select("id, user_id, username, content, created_at")
        .order("created_at", { ascending: false })
        .limit(50);

      if (postsError) throw postsError;

      const posts = (postRows || []) as SuggestionPostRow[];
      if (posts.length === 0) {
        setSuggestions([]);
        return;
      }

      const postIds = posts.map((post) => post.id);
      const { data: voteRows, error: votesError } = await supabase
        .from("anime_suggestion_votes")
        .select("suggestion_id, user_id, vote")
        .in("suggestion_id", postIds);

      if (votesError) throw votesError;

      const votes = (voteRows || []) as SuggestionVoteRow[];
      const { data: userData } = await supabase.auth.getUser();
      const currentUserId = userData.user?.id;

      setSuggestions(
        posts.map((post) => {
          const postVotes = votes.filter((vote) => vote.suggestion_id === post.id);
          return {
            ...post,
            likes: postVotes.filter((vote) => vote.vote === 1).length,
            dislikes: postVotes.filter((vote) => vote.vote === -1).length,
            myVote:
              postVotes.find((vote) => vote.user_id === currentUserId)?.vote ??
              null,
          };
        })
      );
    } catch (err) {
      console.error("Community feed loading error:", err);
      setSuggestionError(
        err instanceof Error
          ? err.message
          : "Could not load community suggestions."
      );
    } finally {
      setSuggestionsLoading(false);
    }
  }

  async function postSuggestion() {
    const cleanContent = suggestionText.trim();

    if (!cleanContent) {
      setSuggestionError("Write your suggestion before posting.");
      return;
    }

    if (cleanContent.length > 300) {
      setSuggestionError("Suggestions must be 300 characters or fewer.");
      return;
    }

    setPostingSuggestion(true);
    setSuggestionError("");

    try {
      const { data: userData, error: userError } = await supabase.auth.getUser();
      if (userError) throw userError;
      if (!userData.user) throw new Error("Please sign in again before posting.");

      const { error: insertError } = await supabase
        .from("anime_suggestions")
        .insert({
          user_id: userData.user.id,
          username,
          content: cleanContent,
        });

      if (insertError) throw insertError;

      setSuggestionText("");
      await loadSuggestions();
    } catch (err) {
      console.error("Community suggestion post error:", err);
      setSuggestionError(
        err instanceof Error ? err.message : "Could not post your suggestion."
      );
    } finally {
      setPostingSuggestion(false);
    }
  }

  async function voteOnSuggestion(
    suggestionId: string,
    nextVote: SuggestionVote
  ) {
    setSuggestionError("");

    try {
      const { data: userData, error: userError } = await supabase.auth.getUser();
      if (userError) throw userError;
      if (!userData.user) throw new Error("Please sign in again to vote.");

      const existingSuggestion = suggestions.find((item) => item.id === suggestionId);
      if (!existingSuggestion) return;

      if (existingSuggestion.myVote === nextVote) {
        const { error: deleteError } = await supabase
          .from("anime_suggestion_votes")
          .delete()
          .eq("suggestion_id", suggestionId)
          .eq("user_id", userData.user.id);
        if (deleteError) throw deleteError;
      } else {
        const { error: voteError } = await supabase
          .from("anime_suggestion_votes")
          .upsert(
            {
              suggestion_id: suggestionId,
              user_id: userData.user.id,
              vote: nextVote,
            },
            { onConflict: "suggestion_id,user_id" }
          );
        if (voteError) throw voteError;
      }

      await loadSuggestions();
    } catch (err) {
      console.error("Community suggestion vote error:", err);
      setSuggestionError(
        err instanceof Error ? err.message : "Could not save your vote."
      );
    }
  }

  async function loadMonthlyVotes() {
    setMonthlyVoteLoading(true); setMonthlyVoteError("");
    try {
      const monthKey = getSouthAfricaMonthKey();
      const { data, error: voteError } = await supabase.from("anime_monthly_theme_votes").select("anime_name,user_id").eq("month_key", monthKey);
      if (voteError) throw voteError;
      const { data: auth } = await supabase.auth.getUser();
      setMonthlyVotes(monthlyAnimeOptions.map((name) => ({ anime_name: name, votes: (data || []).filter((v: {anime_name:string}) => v.anime_name === name).length, my_vote: (data || []).some((v: {anime_name:string;user_id:string}) => v.anime_name === name && v.user_id === auth.user?.id) })).sort((a,b) => b.votes-a.votes));
    } catch (err) { setMonthlyVoteError(err instanceof Error ? err.message : "Could not load monthly votes."); }
    finally { setMonthlyVoteLoading(false); }
  }

  async function castMonthlyAnimeVote(animeName: string) {
    setMonthlyVoteLoading(true); setMonthlyVoteError("");
    try {
      const { data: auth, error: authError } = await supabase.auth.getUser();
      if (authError) throw authError;
      if (!auth.user) throw new Error("Sign in again to vote.");
      if (!monthlyAnimeOptions.includes(animeName)) throw new Error("That anime is not in this month's voting list.");
      const monthKey = getSouthAfricaMonthKey();
      const { error: upsertError } = await supabase.from("anime_monthly_theme_votes").upsert({ month_key: monthKey, user_id: auth.user.id, anime_name: animeName }, { onConflict: "month_key,user_id" });
      if (upsertError) throw upsertError;
      await loadMonthlyVotes();
    } catch (err) {
      console.error("Monthly anime vote error:", err);
      setMonthlyVoteError(err instanceof Error ? err.message : "Could not save your vote. Check the Supabase voting SQL and permissions.");
      setMonthlyVoteLoading(false);
    }
  }

  async function refreshSiteActivity() {
    try {
      const { data, error: pingError } = await supabase.rpc("anime_zone_ping");
      if (pingError) throw pingError;
      const row = Array.isArray(data) ? data[0] : data;
      if (row) { setSiteVisits(Number(row.total_visits || 0)); setOnlineNow(Number(row.online_now || 0)); }
    } catch (err) { console.warn("Site activity is not configured yet:", err); }
  }

  useEffect(() => {
    if (screen !== "lobby") return;
    void refreshSiteActivity();
    const timer = window.setInterval(() => void refreshSiteActivity(), 30000);
    return () => window.clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [screen]);

  useEffect(() => {
    if (screen === "lobby" && tab === "lobby") void loadMonthlyVotes();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [screen, tab]);

  // Load the community feed whenever a member opens the lobby tab.
  useEffect(() => {
    if (screen === "lobby" && tab === "lobby") {
      void loadSuggestions();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [screen, tab]);

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
        setIsGuestAccount(true);
        try { window.localStorage.setItem("az_guest_username", existingUsername); } catch {}
        setScreen("lobby");
        setTab("lobby");
        return;
      }

      await saveUsername(user.id, username);

      try { window.localStorage.setItem("az_guest_username", username.trim()); } catch {}
      setUsername(username.trim());
      setIsGuestAccount(true);
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

    if (password.length < 4) {
      setError("Password must be at least 4 characters.");
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

      const { error: updateError } = await supabase.auth.updateUser(
        {
          email: email.trim(),
          password,
        },
        {
          emailRedirectTo: "https://ootw-anime-zone.vercel.app/",
        }
      );

      if (updateError) throw updateError;

      setUsername(existingUsername);
      setIsGuestAccount(false);
      setScreen("lobby");
      setTab("lobby");

      setNotice(
        "Your account details have been saved. Check your email and open the verification link to confirm your email address. Check your spam folder too."
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

  async function sendPasswordReset() {
    if (!email.trim()) {
      setError("Enter the email address for your Anime Zone account first.");
      return;
    }
    setSendingReset(true);
    setError("");
    setNotice("");
    try {
      const { error: resetError } = await supabase.auth.resetPasswordForEmail(
        email.trim(),
        { redirectTo: `${window.location.origin}/reset-password` }
      );
      if (resetError) throw resetError;
      setNotice("If an account exists for that email, Supabase will send a password reset link. Check your inbox and spam folder.");
    } catch (err) {
      console.error("Password reset error:", err);
      setError(err instanceof Error ? err.message : "Could not send the reset email.");
    } finally {
      setSendingReset(false);
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
      setIsGuestAccount(false);
      setScreen("lobby");
      setTab("lobby");
    } catch (err) {
      console.error("Sign in error:", err);
      const message = err instanceof Error ? err.message : "Could not sign in.";
      setError(message.toLowerCase().includes("invalid login credentials")
        ? "Email or password is incorrect. Use the email you registered with, or choose Forgot password? to reset it. Your Anime Zone username alone cannot sign you in."
        : message);
    } finally {
      setLoading(false);
    }
  }

  async function logOut() {
    setLoading(true);
    setError("");
    setNotice("");

    try {
      const { error: signOutError } = await supabase.auth.signOut({ scope: "local" });
      if (signOutError) throw signOutError;

      // A guest is temporary: remove its remembered device identity only after sign-out succeeds.
      // Registered account data remains in Supabase and can be restored by signing in again.
      try { window.localStorage.removeItem("az_guest_username"); } catch {}
      setIsGuestAccount(false);
      setUsername("");
      setProfile(null);
      setProfileMenuOpen(false);
      setEditingProfile(false);
      setAvatarPreview(null);
      setBannerPreview(null);
      setSuggestions([]);
      setSuggestionText("");
      setScreen("welcome");
      setTab("lobby");
      setPassword("");
      setEmail("");
    } catch (err) {
      console.error("Logout error:", err);
      setError(
        err instanceof Error ? err.message : "Could not log out. Please try again."
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
    const input = event.currentTarget;
    const file = input.files?.[0];

    if (!file || !profile) {
      input.value = "";
      return;
    }

    if (!["image/png", "image/jpeg", "image/webp"].includes(file.type)) {
      setProfileError("Please choose a PNG, JPG or WEBP image.");
      input.value = "";
      return;
    }

    if (file.size > 3 * 1024 * 1024) {
      setProfileError("Please choose an image smaller than 3 MB.");
      input.value = "";
      return;
    }

    // Create and display a local preview before the upload starts.
    const previewUrl = URL.createObjectURL(file);

    if (type === "avatar") {
      setAvatarPreview(previewUrl);
    } else {
      setBannerPreview(previewUrl);
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

      if (type === "avatar") {
        setAvatarPreview(null);
      } else {
        setBannerPreview(null);
      }
    } catch (err) {
      console.error("Image upload error:", err);

      if (type === "avatar") {
        setAvatarPreview(null);
      } else {
        setBannerPreview(null);
      }

      const uploadMessage =
        err instanceof TypeError ||
        (err instanceof Error && err.message.toLowerCase().includes("failed to fetch"))
          ? "Could not reach Supabase Storage. Check your internet connection and confirm that the anime-profiles Storage bucket exists in your Supabase project."
          : err instanceof Error
            ? err.message
            : "Could not upload that image.";

      setProfileError(uploadMessage);
    } finally {
      URL.revokeObjectURL(previewUrl);
      setUploadingImage(null);
      input.value = "";
    }
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
    if (next === "guest") {
      try {
        const rememberedGuest = window.localStorage.getItem("az_guest_username");
        if (rememberedGuest) setUsername(rememberedGuest);
      } catch {
        // Guest username convenience is optional if browser storage is unavailable.
      }
    }
    setScreen(next);
  }

  if (restoringSession) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#f4f2ff] text-[#292448]">
        <div className="text-center">
          <img src="/az-logo.png" alt="Anime Zone" className="mx-auto h-20 w-20 rounded-2xl object-cover" />
          <p className="mt-5 text-sm font-semibold text-[#686184]">Entering Anime Zone...</p>
        </div>
      </main>
    );
  }

  if (screen === "welcome") {
    return (
      <main className="relative min-h-screen overflow-hidden bg-[#f4f2ff] text-[#292448] before:pointer-events-none before:fixed before:inset-0 before:bg-[radial-gradient(ellipse_at_15%_10%,rgba(124,58,237,0.22),transparent_38%),radial-gradient(ellipse_at_85%_30%,rgba(8,145,178,0.13),transparent_35%),radial-gradient(ellipse_at_50%_100%,rgba(190,24,93,0.12),transparent_42%)] before:content-['']">
        <div className="relative z-10 mx-auto flex min-h-screen max-w-6xl flex-col px-6">
          <header className="flex items-center justify-between py-7">
            <div className="flex items-center gap-3">
              <img src="/az-logo.png" alt="AZ" className="h-11 w-11 rounded-xl object-cover ring-1 ring-purple-400/60 shadow-lg shadow-purple-900/40" />
              <span className="text-lg font-black tracking-wide">
                OOTW <span className="text-[#7561c8]">ANIME ZONE</span>
              </span>
            </div>
            <span className="rounded-full border border-[#d9d4ff] bg-[#ffffff]/80 px-4 py-2 text-xs font-semibold text-[#6555a5]">
              COMMUNITY • ANIME • FRIENDS
            </span>
          </header>

          <section className="flex flex-1 flex-col items-center justify-center py-16 text-center">
            <div className="mb-8 rounded-[2.5rem] bg-gradient-to-br from-fuchsia-500 via-violet-500 to-cyan-400 p-1 shadow-2xl shadow-purple-950/70">
              <img src="/az-logo.png" alt="Anime Zone AZ logo" className="h-36 w-36 rounded-[2.2rem] object-cover" />
            </div>

            <p className="mb-4 rounded-full bg-[#ffffff] px-5 py-2 text-xs font-bold uppercase tracking-[0.25em] text-[#6555a5] shadow-sm">
              A new world awaits
            </p>

            <h1 className="text-5xl font-black leading-tight sm:text-7xl">
              Welcome to
              <span className="block text-[#7561c8]">Anime Zone.</span>
            </h1>

            <p className="mt-6 max-w-xl text-base leading-8 text-[#686184] sm:text-lg">
              Discover anime, meet fellow fans, share your favourite moments
              and become part of a community beyond this world.
            </p>

            <button
              onClick={() => goTo("choose")}
              className="mt-10 rounded-2xl bg-[#8b5cf6] px-10 py-4 font-bold text-white shadow-lg shadow-purple-950/50 transition hover:-translate-y-1 hover:bg-[#7c3aed]"
            >
              Enter Anime Zone →
            </button>

            <p className="mt-12 text-xs font-medium tracking-wide text-[#85809d]">
              BUILT BY OOTW · OUT OF THIS WORLD
            </p>
          </section>
        </div>
      </main>
    );
  }

  if (screen === "choose") {
    return (
      <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[#f4f2ff] px-5 py-12 text-[#292448] before:pointer-events-none before:fixed before:inset-0 before:bg-[radial-gradient(ellipse_at_15%_10%,rgba(124,58,237,0.22),transparent_38%),radial-gradient(ellipse_at_85%_30%,rgba(8,145,178,0.13),transparent_35%)] before:content-['']">
        <div className="relative z-10 w-full max-w-md rounded-[2rem] border border-[#d9d4ff] bg-[#ffffff]/95 p-8 shadow-xl shadow-purple-950/50">
          <button onClick={() => goTo("welcome")} className="text-sm font-semibold text-[#7664c2]">
            ← Back
          </button>

          <img src="/az-logo.png" alt="Anime Zone AZ logo" className="mt-7 h-20 w-20 rounded-2xl object-cover ring-2 ring-purple-400/50 shadow-lg shadow-purple-900/40" />
          <h1 className="mt-5 text-3xl font-black">Join Anime Zone</h1>
          <p className="mt-3 text-sm leading-6 text-[#6e6889]">
            Choose how you want to enter our community.
          </p>

          <button
            onClick={() => goTo("guest")}
            className="mt-8 w-full rounded-2xl bg-[#8b5cf6] p-5 text-left text-white transition hover:bg-[#7c3aed]"
          >
            <span className="block text-lg font-black">Continue as Guest</span>
            <span className="mt-1 block text-sm text-white/80">
              Username only · No email or password
            </span>
          </button>

          <button
            onClick={() => goTo("signup")}
            className="mt-4 w-full rounded-2xl border-2 border-[#d9d4ff] bg-[#f0efff] p-5 text-left transition hover:bg-[#f4f2ff]"
          >
            <span className="block text-lg font-black">Create an Account</span>
            <span className="mt-1 block text-sm text-[#6e6889]">
              Username, email and password · Recoverable account
            </span>
          </button>

          <div className="my-6 flex items-center gap-3">
            <div className="h-px flex-1 bg-[#e1eff8]" />
            <span className="text-xs font-semibold text-[#77718f]">ALREADY A MEMBER?</span>
            <div className="h-px flex-1 bg-[#e1eff8]" />
          </div>

          <button
            onClick={() => goTo("signin")}
            className="w-full rounded-2xl py-3 font-bold text-[#7561c8] hover:bg-[#e9e7ff]"
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
      <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[#f4f2ff] px-5 py-12 text-[#292448] before:pointer-events-none before:fixed before:inset-0 before:bg-[radial-gradient(ellipse_at_15%_10%,rgba(124,58,237,0.22),transparent_38%),radial-gradient(ellipse_at_85%_30%,rgba(8,145,178,0.13),transparent_35%)] before:content-['']">
        <div className="relative z-10 w-full max-w-md rounded-[2rem] border border-[#d9d4ff] bg-[#ffffff]/95 p-8 shadow-xl shadow-purple-950/50">
          <button onClick={() => goTo("choose")} className="text-sm font-semibold text-[#7664c2]">
            ← Back
          </button>

          <img src="/az-logo.png" alt="Anime Zone AZ logo" className="mt-6 h-20 w-20 rounded-2xl object-cover ring-2 ring-purple-400/50 shadow-lg shadow-purple-900/40" />

          <p className="mt-5 text-xs font-bold uppercase tracking-[0.2em] text-[#7664c2]">
            {isGuest ? "Guest access" : isSignup ? "Create your account" : "Welcome back"}
          </p>

          <h1 className="mt-2 text-3xl font-black">
            {isGuest ? "Choose a username" : isSignup ? "Sign up" : "Sign in"}
          </h1>

          <p className="mt-3 text-sm leading-6 text-[#6e6889]">
            {isGuest
              ? "Your guest session stays on this device until you log out. Choose a username to get started."
              : isSignup
                ? "Create a recoverable account to keep access to your profile."
                : "Sign in with the email and password you registered with."}
          </p>

          {screen !== "signin" && (
            <>
              <label className="mt-7 block text-sm font-bold">Username</label>
              <div className="mt-2 flex items-center rounded-2xl border-2 border-[#d9d4ff] bg-[#f0efff] px-4 focus-within:border-[#c084fc]">
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
                className="mt-2 w-full rounded-2xl border-2 border-[#d9d4ff] bg-[#f0efff] px-4 py-4 text-sm outline-none focus:border-[#c084fc]"
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
                placeholder={isSignup ? "At least 4 characters" : "Your password"}
                className="mt-2 w-full rounded-2xl border-2 border-[#d9d4ff] bg-[#f0efff] px-4 py-4 text-sm outline-none focus:border-[#c084fc]"
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
            className="mt-7 w-full rounded-2xl bg-[#8b5cf6] px-6 py-4 font-bold text-white shadow-lg shadow-purple-950/50 transition hover:bg-[#7c3aed] disabled:cursor-not-allowed disabled:opacity-60"
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
            <p className="mt-5 text-center text-xs text-[#77718f]">
              Already registered?{" "}
              <button onClick={() => goTo("signin")} className="font-bold text-[#7561c8]">
                Sign in
              </button>
            </p>
          )}

          {screen === "signin" && (
            <button
              type="button"
              onClick={() => void sendPasswordReset()}
              disabled={sendingReset}
              className="mt-4 text-sm font-bold text-[#7561c8] underline underline-offset-4 disabled:opacity-50"
            >
              {sendingReset ? "Sending reset link..." : "Forgot password?"}
            </button>
          )}

          {screen === "signin" && (
            <p className="mt-5 text-center text-xs text-[#77718f]">
              New here?{" "}
              <button onClick={() => goTo("signup")} className="font-bold text-[#7561c8]">
                Create an account
              </button>
            </p>
          )}
        </div>
      </main>
    );
  }

  return (
    <main className="relative min-h-screen overflow-hidden bg-[#f4f2ff] pb-24 text-[#292448] before:pointer-events-none before:fixed before:inset-0 before:bg-[radial-gradient(ellipse_at_10%_0%,rgba(124,58,237,0.18),transparent_35%),radial-gradient(ellipse_at_90%_35%,rgba(8,145,178,0.12),transparent_35%)] before:content-['']">
      <div className="relative z-10 mx-auto max-w-7xl px-6 sm:px-8">
        <header className="flex items-center justify-between py-6">
          <div>
            <p className="font-black tracking-wide">
              OOTW <span className="text-[#7561c8]">ANIME ZONE</span>
            </p>
            <p className="text-xs text-[#85809d]">OUT OF THIS WORLD</p>
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => {
                setFriendSearchOpen(true);
                setFriendSearchTerm("");
                setFriendSearchResults([]);
                setFriendError("");
                setFriendNotice("");
              }}
              aria-label="Find friends"
              title="Add friends"
              className="relative flex h-11 w-11 items-center justify-center rounded-full border border-[#c9c2f5] bg-[#e9e7ff] text-xl text-[#41366f] transition hover:border-fuchsia-400 hover:bg-[#e4e1ff]"
            >
              ♡+
            </button>
            <button
              type="button"
              onClick={() => {
                setDisplayName(profile?.display_name || username);
                setBio(profile?.bio || "");
                setProfileError("");
                setProfileMenuOpen(true);
                setEditingProfile(false);
              }}
              aria-label="Open your profile"
              title="Your profile"
              className="flex h-12 w-12 items-center justify-center overflow-hidden rounded-full border-2 border-[#d9d4ff] bg-[#e9e7ff] text-2xl shadow-md ring-2 ring-fuchsia-400/60 transition hover:scale-105"
            >
              {profile?.avatar_url ? (
                <img
                  src={profile.avatar_url}
                  alt="Your profile"
                  className="h-full w-full object-cover"
                />
              ) : (
                <img src="/az-logo.png" alt="AZ" className="h-full w-full object-cover" />
              )}
            </button>

            <button
              type="button"
              onClick={() => void logOut()}
              disabled={loading}
              className="rounded-xl border border-[#c9c2f5] bg-[#e9e7ff] px-4 py-2.5 text-sm font-bold text-[#41366f] transition hover:border-fuchsia-400/60 hover:bg-[#e4e1ff] disabled:cursor-not-allowed disabled:opacity-50"
            >
              {loading ? "Please wait..." : "Log out"}
            </button>
          </div>
          <div className="flex items-center gap-2 text-[11px] font-bold sm:text-xs">
            <span className="rounded-full border border-[#d9d4ff] bg-white px-3 py-2 text-[#514b70]">◦ {siteVisits.toLocaleString()} visits</span>
            <span className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-2 text-emerald-700">● {onlineNow} online</span>
          </div>
        </header>

        {tab === "lobby" ? (
          <div className="space-y-10">
            {/* WEEKLY ANNOUNCEMENT */}
            <section className="rounded-[1.7rem] border border-[#d9d4ff] bg-gradient-to-br from-white via-[#f7f5ff] to-[#eef6ff] p-7 sm:p-8 shadow-lg shadow-purple-950/40">
              <div className="flex items-center justify-between gap-3">
                <h2 className="text-lg font-black">📢 Announcements</h2>
                <span className="rounded-full bg-[#e4e1ff] px-3 py-1 text-xs font-bold text-[#6555a5]">
                  OOTW STAFF
                </span>
              </div>

              <div className="mt-4 rounded-2xl bg-[#e9e7ff] p-5">
                <div className="flex items-center gap-2">
                  <span className="text-xl">📣</span>
                  <p className="font-black">Official Announcement</p>
                </div>

                <p className="mt-3 text-sm leading-6 text-[#6e6889]">
                  Admins/staff will post announcements here, so stay tuned!
                  Check back regularly to keep up with everything happening
                  in OOTW Anime Zone.
                </p>
              </div>

              <div className="mt-5 rounded-2xl border border-[#d9d4ff] bg-[#ffffff] p-5">
                <div className="text-center">
                  <p className="text-xs font-black uppercase tracking-[0.2em] text-[#7664c2]">
                    Next weekly update
                  </p>
                  <h3 className="mt-2 text-xl font-black">
                    ✦ Saturday Update
                  </h3>
                  <p className="mt-1 text-xs text-[#85809d]">
                    New updates every Saturday · az time
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
                      className="rounded-xl bg-[#e9e7ff] px-2 py-4 text-center"
                    >
                      <p className="text-2xl font-black tabular-nums text-[#7561c8] sm:text-3xl">
                        {String(item.value).padStart(2, "0")}
                      </p>
                      <p className="mt-1 text-[10px] font-bold uppercase tracking-wider text-[#77718f] sm:text-xs">
                        {item.label}
                      </p>
                    </div>
                  ))}
                </div>

                <p className="mt-4 text-center text-xs text-[#85809d]">
                  The countdown automatically resets for the next Saturday.
                </p>
              </div>
            </section>

            <section>
              <div className="mb-4 flex items-center justify-between">
                <h2 className="text-xl font-black">🔥 Trending Anime</h2>
                <span className="text-xs font-semibold text-[#7664c2]">DISCOVER</span>
              </div>
              <div className="grid gap-4 sm:grid-cols-3">
                {[
                  { name: "Black Clover", emoji: "🍀", description: "Magic, rivalry and determination." },
                  { name: "Solo Leveling", emoji: "⚔️", description: "A world of hunters and quests." },
                  { name: "One Piece", emoji: "☠️", description: "Adventure across the seas." },
                ].map((anime) => (
                  <article
                    key={anime.name}
                    className="rounded-[1.5rem] border border-[#d9d4ff] bg-gradient-to-br from-[#f4f1ff] to-[#edf5ff] p-5 shadow-lg shadow-purple-950/40"
                  >
                    <div className="flex h-24 items-center justify-center rounded-2xl bg-gradient-to-br from-[#e6e3ff] via-[#e9efff] to-[#dff3ff] text-5xl">
                      {anime.emoji}
                    </div>
                    <h3 className="mt-4 font-black">{anime.name}</h3>
                    <p className="mt-1 text-sm text-[#6e6889]">
                      {anime.description}
                    </p>
                  </article>
                ))}
              </div>
            </section>

            <section className="rounded-[1.7rem] border border-[#d9d4ff] bg-gradient-to-br from-white via-[#f7f5ff] to-[#eef6ff] p-5 shadow-lg shadow-violet-100 sm:p-6">
              <p className="text-xs font-black uppercase tracking-[0.22em] text-[#7561c8]">Community decides</p>
              <h2 className="mt-2 text-2xl font-black">🗳️ Monthly Anime Theme Vote</h2>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-[#686184]">Vote for the anime you want Anime Zone to celebrate next month. The anime with the most votes becomes our site-wide monthly theme. You can change your vote before the month ends.</p>
              <div className="mt-5 grid gap-3 sm:grid-cols-2">
                {monthlyVotes.map((item, index) => <button key={item.anime_name} type="button" disabled={monthlyVoteLoading} onClick={() => void castMonthlyAnimeVote(item.anime_name)} className={`rounded-2xl border p-4 text-left transition hover:-translate-y-0.5 disabled:opacity-60 ${item.my_vote ? "border-violet-400 bg-violet-100" : "border-[#d9d4ff] bg-white hover:bg-[#f1efff]"}`}><div className="flex items-center justify-between gap-2"><span className="font-black text-[#393158]">{index + 1}. {item.anime_name}</span><span className="rounded-full bg-[#e7e3ff] px-3 py-1 text-xs font-black text-[#6555a5]">{item.votes} votes</span></div><div className="mt-3 h-2 overflow-hidden rounded-full bg-[#e9e7f7]"><div className="h-full rounded-full bg-gradient-to-r from-[#8b7be8] to-[#80bce9]" style={{width: `${Math.max(0, ...monthlyVotes.map(v => v.votes)) ? item.votes / Math.max(1, ...monthlyVotes.map(v => v.votes)) * 100 : 0}%`}} /></div><p className="mt-2 text-xs font-bold text-[#7561c8]">{item.my_vote ? "✓ Your vote" : "Vote for this anime →"}</p></button>)}
              </div>
              {monthlyVoteLoading && <p className="mt-3 text-xs text-[#77718f]">Updating votes...</p>}
              {monthlyVoteError && <p role="alert" className="mt-3 rounded-xl bg-red-50 p-3 text-sm text-red-600">{monthlyVoteError}</p>}
              <p className="mt-4 text-xs text-[#85809d]">Voting resets automatically each calendar month. Results are shared across all members.</p>
            </section>

            <section className="rounded-[1.7rem] border border-[#d9d4ff] bg-gradient-to-br from-white via-[#f7f5ff] to-[#eef6ff] p-5 shadow-lg shadow-purple-950/40 sm:p-6">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-black uppercase tracking-[0.22em] text-[#7561c8]">
                    Shape the next update
                  </p>
                  <h2 className="mt-2 text-2xl font-black">💡 Community Feed</h2>
                  <p className="mt-2 max-w-xl text-sm leading-6 text-[#6e6889]">
                    Suggest features, improvements or ideas you would love to see in Anime Zone.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => void loadSuggestions()}
                  disabled={suggestionsLoading}
                  className="rounded-xl border border-[#c9c2f5] bg-[#e9e7ff] px-4 py-2 text-xs font-bold text-[#41366f] transition hover:bg-[#e4e1ff] disabled:opacity-50"
                >
                  {suggestionsLoading ? "Refreshing..." : "↻ Refresh"}
                </button>
              </div>

              <div className="mt-5 rounded-2xl border border-[#c9c2f5] bg-[#f1f0ff] p-4">
                <label htmlFor="suggestion-input" className="mb-2 block text-sm font-bold text-[#41366f]">
                  Share your suggestion
                </label>
                <textarea
                  id="suggestion-input"
                  value={suggestionText}
                  onChange={(event) => {
                    setSuggestionText(event.target.value);
                    setSuggestionError("");
                  }}
                  maxLength={300}
                  rows={3}
                  placeholder="What should we add to Anime Zone?"
                  className="w-full resize-y rounded-xl border border-[#d9d4ff] bg-[#f0efff] px-4 py-3 text-sm text-white outline-none placeholder:text-[#85809d] focus:border-[#c084fc]"
                />
                <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
                  <span className="text-xs text-[#77718f]">{suggestionText.length}/300 characters</span>
                  <button
                    type="button"
                    onClick={() => void postSuggestion()}
                    disabled={postingSuggestion || !suggestionText.trim()}
                    className="rounded-xl bg-gradient-to-r from-[#8b5cf6] to-[#d946ef] px-5 py-3 text-sm font-black text-white shadow-lg shadow-purple-950/40 transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {postingSuggestion ? "Posting..." : "Post suggestion →"}
                  </button>
                </div>
              </div>

              {suggestionError && (
                <p role="alert" className="mt-4 break-words rounded-xl border border-red-400/20 bg-red-500/10 px-4 py-3 text-sm text-red-200">
                  {suggestionError}
                </p>
              )}

              <div className="mt-6 flex items-center justify-between gap-3">
                <h3 className="font-black">Latest suggestions</h3>
                <span className="rounded-full bg-[#e4e1ff] px-3 py-1 text-xs font-bold text-[#6555a5]">
                  {suggestions.length} {suggestions.length === 1 ? "POST" : "POSTS"}
                </span>
              </div>

              {suggestionsLoading && suggestions.length === 0 ? (
                <p className="py-8 text-center text-sm text-[#6e6889]">Loading suggestions...</p>
              ) : suggestions.length === 0 ? (
                <div className="mt-4 rounded-2xl border border-dashed border-[#c9c2f5] bg-[#f5f4ff] px-5 py-8 text-center">
                  <div className="text-3xl">🌌</div>
                  <p className="mt-3 font-bold">No suggestions yet</p>
                  <p className="mt-1 text-sm text-[#77718f]">Be the first to share an idea with the community.</p>
                </div>
              ) : (
                <div className="mt-4 space-y-3">
                  {suggestions.map((suggestion) => (
                    <article key={suggestion.id} className="rounded-2xl border border-[#d9d4ff] bg-[#ffffff]/90 p-4">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <p className="text-sm font-black text-[#41366f]">@<AdminName value={suggestion.username} /></p>
                        <time dateTime={suggestion.created_at} className="text-xs text-[#85809d]">
                          {new Date(suggestion.created_at).toLocaleString()}
                        </time>
                      </div>
                      <p className="mt-3 whitespace-pre-wrap break-words text-sm leading-6 text-[#e5dced]">
                        {suggestion.content}
                      </p>
                      <div className="mt-4 flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => void voteOnSuggestion(suggestion.id, 1)}
                          aria-pressed={suggestion.myVote === 1}
                          className={`flex items-center gap-2 rounded-xl border px-4 py-2 text-sm font-bold transition ${suggestion.myVote === 1 ? "border-emerald-400/50 bg-emerald-400/15 text-emerald-200" : "border-[#d9d4ff] bg-[#e9e7ff] text-[#cbbbdc] hover:border-emerald-400/40"}`}
                        >
                          <span>👍</span><span>{suggestion.likes}</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => void voteOnSuggestion(suggestion.id, -1)}
                          aria-pressed={suggestion.myVote === -1}
                          className={`flex items-center gap-2 rounded-xl border px-4 py-2 text-sm font-bold transition ${suggestion.myVote === -1 ? "border-rose-400/50 bg-rose-400/15 text-rose-200" : "border-[#d9d4ff] bg-[#e9e7ff] text-[#cbbbdc] hover:border-rose-400/40"}`}
                        >
                          <span>👎</span><span>{suggestion.dislikes}</span>
                        </button>
                      </div>
                    </article>
                  ))}
                </div>
              )}
            </section>
          </div>
        ) : tab === "chat" ? (
          <section className="space-y-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h1 className="text-3xl font-black">Anime Chat</h1>
                <p className="mt-1 text-sm text-[#6e6889]">Your Anime Zone connections.</p>
              </div>
              <div className="flex items-center gap-2">
                <button type="button" aria-label="View friend requests" title="Friend requests" onClick={() => document.getElementById("anime-friend-requests")?.scrollIntoView({ behavior: "smooth", block: "start" })} className="relative flex h-10 w-10 items-center justify-center rounded-xl border border-[#c9c2f5] bg-[#e9e7ff] text-lg text-[#41366f]">
                  ♡
                  {incomingRequests.length > 0 && <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-fuchsia-500 px-1 text-[10px] font-black text-white">{incomingRequests.length}</span>}
                </button>
              <button type="button" onClick={() => void loadFriendData()} disabled={friendsLoading} className="rounded-xl border border-[#c9c2f5] bg-[#e9e7ff] px-4 py-2 text-sm font-bold text-[#41366f] disabled:opacity-50">
                {friendsLoading ? "Refreshing..." : "↻ Refresh"}
              </button>
              </div>
            </div>

            <div id="anime-friend-requests" className="scroll-mt-6 rounded-[1.7rem] border border-[#d9d4ff] bg-gradient-to-br from-white via-[#f7f5ff] to-[#eef6ff] p-5 shadow-lg shadow-purple-950/40 sm:p-6">
              <div className="flex items-center justify-between gap-3">
                <h2 className="text-xl font-black">Friend Requests</h2>
                <span className="rounded-full bg-[#e4e1ff] px-3 py-1 text-xs font-bold text-[#6555a5]">{incomingRequests.length} NEW</span>
              </div>
              {incomingRequests.length === 0 ? (
                <p className="mt-4 rounded-xl bg-[#f1f0ff] p-5 text-sm text-[#77718f]">No pending friend requests right now.</p>
              ) : (
                <div className="mt-4 space-y-3">
                  {incomingRequests.map((request) => {
                    const sender = friendSearchResults.find((person) => person.user_id === request.sender_id);
                    return <div key={request.id} className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[#d9d4ff] bg-[#f1f0ff] p-4">
                      <div className="flex items-center gap-3"><div className="flex h-11 w-11 items-center justify-center overflow-hidden rounded-full bg-[#e4e1ff]">{sender?.avatar_url ? <img src={sender.avatar_url} alt="" className="h-full w-full object-cover" /> : "👤"}</div><div><p className="font-bold">Friend request</p><p className="text-xs text-[#77718f]">From an Anime Zone member</p></div></div>
                      <div className="flex gap-2"><button type="button" onClick={() => void respondToFriendRequest(request.id, "accepted")} disabled={friendActionLoading === request.id} className="rounded-lg bg-[#8b5cf6] px-3 py-2 text-xs font-bold text-white">Accept</button><button type="button" onClick={() => void respondToFriendRequest(request.id, "declined")} disabled={friendActionLoading === request.id} className="rounded-lg border border-[#c9c2f5] px-3 py-2 text-xs font-bold text-[#6555a5]">Decline</button></div>
                    </div>;
                  })}
                </div>
              )}
            </div>

            <div className="rounded-[1.7rem] border border-[#d9d4ff] bg-gradient-to-br from-white via-[#f7f5ff] to-[#eef6ff] p-5 shadow-lg shadow-purple-950/40 sm:p-6">
              <div className="flex items-center justify-between gap-3"><h2 className="text-xl font-black">Friends</h2><span className="rounded-full bg-[#e4e1ff] px-3 py-1 text-xs font-bold text-[#6555a5]">{friends.length}</span></div>
              {friendsLoading && friends.length === 0 ? <p className="mt-4 text-sm text-[#6e6889]">Loading friends...</p> : friends.length === 0 ? <div className="mt-4 rounded-xl border border-dashed border-[#c9c2f5] p-7 text-center"><p className="font-bold">Your friends list is empty</p><p className="mt-1 text-sm text-[#77718f]">Use the ♡+ button at the top to find Anime Zone members.</p></div> : <div className="mt-4 grid gap-3 sm:grid-cols-2">{friends.map((friend) => <div key={friend.user_id} className="flex items-center gap-3 rounded-2xl border border-[#d9d4ff] bg-[#f1f0ff] p-4"><div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-full bg-[#e4e1ff]">{friend.avatar_url ? <img src={friend.avatar_url} alt="" className="h-full w-full object-cover" /> : <span>👤</span>}</div><div className="min-w-0"><p className="truncate font-bold"><AdminName value={friend.username} /></p><p className="truncate text-xs text-[#77718f]">@{friend.username}</p><p className="mt-1 text-xs text-[#8b7b9e]">Friends · messaging coming next</p></div></div>)}</div>}
            </div>
            {friendError && <p role="alert" className="break-words rounded-xl border border-red-400/20 bg-red-500/10 px-4 py-3 text-sm text-red-600">{friendError}</p>}
          </section>
        ) : null}
      </div>

      {tab === "leaderboard" && (
        <section className="relative z-10 mx-auto max-w-4xl space-y-6 px-6 py-8">
          <style jsx>{`@keyframes azSnow {0%{transform:translateY(-30px) translateX(0);opacity:0}15%{opacity:.85}100%{transform:translateY(190px) translateX(24px);opacity:0}} .snowfall{position:absolute;inset:0;color:#8bb9e8;font-size:22px;letter-spacing:10px;animation:azSnow 5s linear infinite;white-space:nowrap}`}</style>
          <div className="overflow-hidden rounded-[2rem] border border-[#d9d4ff] bg-gradient-to-br from-white via-[#f1f0ff] to-[#eaf5ff] p-8 text-center shadow-xl shadow-violet-100">
            <div className="relative mx-auto mb-5 h-40 overflow-hidden rounded-2xl bg-gradient-to-b from-[#dcecff] to-[#eee8ff]">
              <div className="snowfall" aria-hidden="true">❄　✦　❄　✧　❄　✦　❄</div>
              <div className="absolute inset-0 flex items-center justify-center text-6xl">🏆</div>
            </div>
            <p className="text-xs font-black uppercase tracking-[0.25em] text-[#7561c8]">Coming soon</p>
            <h1 className="mt-2 text-4xl font-black text-[#393158]">Leaderboard</h1>
            <p className="mx-auto mt-3 max-w-xl text-sm leading-6 text-[#686184]">We’re building a community leaderboard with member rankings, activity and achievements. Stay tuned!</p>
            <div className="mt-6 rounded-2xl border border-[#d9d4ff] bg-white/80 p-4 text-sm font-bold text-[#6555a5]">🚧 UNDER CONSTRUCTION 🚧</div>
            <div className="mt-7 flex flex-wrap justify-center gap-3 text-sm font-bold">
              <a className="rounded-xl bg-[#e9e7ff] px-4 py-3 text-[#51458e] hover:bg-[#dedaff]" href="https://www.youtube.com/@greenbutton" target="_blank" rel="noreferrer">▶ YouTube · @greenbutton</a>
              <a className="rounded-xl bg-[#e9e7ff] px-4 py-3 text-[#51458e] hover:bg-[#dedaff]" href="https://www.instagram.com/ootwtechh/" target="_blank" rel="noreferrer">◎ Instagram · @ootwtechh</a>
              <a className="rounded-xl bg-[#e9e7ff] px-4 py-3 text-[#51458e] hover:bg-[#dedaff]" href="https://www.tiktok.com/@ootwtech" target="_blank" rel="noreferrer">♪ TikTok · @ootwtech</a>
              <a className="rounded-xl bg-[#dfeeff] px-4 py-3 text-[#315c91] hover:bg-[#d1e6ff]" href="https://discord.gg/b5f67cE7v" target="_blank" rel="noreferrer">💬 Join our Discord</a>
              <a className="rounded-xl bg-[#e9e7ff] px-4 py-3 text-[#51458e] hover:bg-[#dedaff]" href="mailto:agentcube1101@gmail.com">✉️ Contact us · agentcube1101@gmail.com</a>
            </div>
            <p className="mt-4 text-xs text-[#85809d]">YouTube handle can be changed when the channel is renamed to Anime Zone.</p>
          </div>
        </section>
      )}

      {friendSearchOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 px-4 py-6 backdrop-blur-sm" onClick={() => setFriendSearchOpen(false)}>
          <section role="dialog" aria-modal="true" aria-labelledby="friend-search-title" className="max-h-[88vh] w-full max-w-xl overflow-y-auto rounded-[2rem] border border-[#c9c2f5] bg-[#ffffff] p-6 shadow-2xl shadow-purple-950/70" onClick={(event) => event.stopPropagation()}>
            <div className="flex items-center justify-between gap-3"><div><h2 id="friend-search-title" className="text-2xl font-black">Find Friends</h2><p className="mt-1 text-sm text-[#6e6889]">Search by Anime Zone username.</p></div><button type="button" onClick={() => setFriendSearchOpen(false)} className="rounded-xl bg-[#e4e1ff] px-3 py-2 font-bold text-[#41366f]" aria-label="Close">✕</button></div>
            <div className="mt-6">
              <input value={friendSearchTerm} onChange={(event) => setFriendSearchTerm(event.target.value)} maxLength={20} placeholder="Search username..." autoComplete="off" className="w-full rounded-xl border border-[#c9c2f5] bg-[#f5f4ff] px-4 py-4 text-sm outline-none focus:border-[#c084fc]" />
              <p className="mt-2 text-xs text-[#85809d]">{friendSearchTerm.trim().length < 2 ? "Type at least 2 characters to find people." : friendSearchLoading ? "Searching..." : `${friendSearchResults.length} ${friendSearchResults.length === 1 ? "user" : "users"} found`}</p>
            </div>
            {friendError && <p role="alert" className="mt-4 break-words rounded-xl bg-red-500/10 px-4 py-3 text-sm text-red-200">{friendError}</p>}
            {friendNotice && <p className="mt-4 rounded-xl bg-emerald-500/10 px-4 py-3 text-sm text-emerald-200">{friendNotice}</p>}
            <div className="mt-5 space-y-3">{friendSearchResults.map((person) => <div key={person.user_id} className="flex items-center gap-3 rounded-2xl border border-[#d9d4ff] bg-[#f5f4ff] p-4"><div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-full bg-[#e4e1ff]">{person.avatar_url ? <img src={person.avatar_url} alt="" className="h-full w-full object-cover" /> : <span>👤</span>}</div><div className="min-w-0 flex-1"><p className="truncate font-bold"><AdminName value={person.username} /></p><p className="truncate text-xs text-[#7561c8]">@{person.username}</p><p className="mt-1 line-clamp-2 text-xs text-[#77718f]">{person.bio || "Anime Zone member"}</p></div><button type="button" onClick={() => void sendFriendRequest(person.user_id)} disabled={friendActionLoading === person.user_id} className="shrink-0 rounded-xl bg-[#8b5cf6] px-3 py-2 text-xs font-bold text-white disabled:opacity-50">{friendActionLoading === person.user_id ? "Sending..." : "Add Friend"}</button></div>)}
            {friendSearchResults.length === 0 && !friendSearchLoading && friendSearchTerm.trim().length >= 2 && !friendError && <p className="rounded-xl border border-dashed border-[#c9c2f5] p-6 text-center text-sm text-[#77718f]">No users found. Check the spelling and try again.</p>}</div>
            <p className="mt-5 text-xs leading-5 text-[#85809d]">Guest and registered accounts can appear in search. Guest accounts may lose access if their temporary browser session is cleared.</p>
          </section>
        </div>
      )}

      <footer className="relative z-10 mx-auto mb-8 mt-8 max-w-5xl px-6 text-center">
        <p className="text-sm font-black text-[#51458e]">OOTW · ANIME ZONE</p>
        <div className="mt-3 flex flex-wrap justify-center gap-4 text-xs font-bold text-[#7561c8]">
          <a href="https://discord.gg/b5f67cE7v" target="_blank" rel="noreferrer">Discord</a>
          <a href="https://www.youtube.com/@greenbutton" target="_blank" rel="noreferrer">YouTube · @greenbutton</a>
          <a href="https://www.instagram.com/ootwtechh/" target="_blank" rel="noreferrer">Instagram · @ootwtechh</a>
          <a href="https://www.tiktok.com/@ootwtech" target="_blank" rel="noreferrer">TikTok · @ootwtech</a>
          <a href="mailto:agentcube1101@gmail.com">Email · agentcube1101@gmail.com</a>
        </div>
      </footer>

      {profileMenuOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-[#17324d]/50 px-4 py-6 backdrop-blur-sm"
          onClick={() => {
            if (!savingProfile && uploadingImage === null) {
              setProfileMenuOpen(false);
              setEditingProfile(false);
            }
          }}
        >
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="profile-dialog-title"
            className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-[2rem] bg-[#ffffff] p-6 shadow-2xl"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <div>
                <h2 id="profile-dialog-title" className="text-xl font-black">
                  Your Profile
                </h2>
                <p className="mt-1 text-sm text-[#6e6889]">
                  Manage your Anime Zone identity.
                </p>
              </div>

              <button
                type="button"
                onClick={() => {
                  setProfileMenuOpen(false);
                  setEditingProfile(false);
                  setProfileError("");
                }}
                disabled={savingProfile || uploadingImage !== null}
                className="rounded-xl bg-[#f0f8fd] px-4 py-2 font-bold text-[#6b9dbd] disabled:opacity-50"
                aria-label="Close profile"
              >
                ✕
              </button>
            </div>

            {profileLoading ? (
              <p className="mt-6 text-sm text-[#6e6889]">
                Loading your profile...
              </p>
            ) : (
              <>
                <div className="mt-6 overflow-hidden rounded-2xl">
                  <div
                    className="relative h-32 bg-gradient-to-r from-[#8ed3ff] to-[#77c4f7] bg-cover bg-center"
                    style={{
                      backgroundImage: `url("${bannerPreview || profile?.banner_url || ""}")`,
                    }}
                  >
                    {!bannerPreview && !profile?.banner_url && (
                      <span className="absolute inset-0 flex items-center justify-center text-5xl text-white/60">
                        ✦
                      </span>
                    )}
                  </div>

                  <div className="relative z-10 -mt-10 px-4">
                    <div className="flex h-20 w-20 items-center justify-center overflow-hidden rounded-2xl border-4 border-[#d9d4ff] bg-[#e9e7ff] text-4xl shadow-md">
                      {avatarPreview || profile?.avatar_url ? (
                        <img
                          src={avatarPreview || profile?.avatar_url || ""}
                          alt="Profile picture preview"
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <img src="/az-logo.png" alt="AZ" className="h-full w-full object-cover" />
                      )}
                    </div>
                  </div>
                </div>

                <h3 className="mt-4 text-xl font-black">
                  <AdminName value={username} />
                </h3>
                <p className="text-sm text-[#78a0ba]">@{username}</p>

                {editingProfile ? (
                  <>
                    <div className="mt-6 grid gap-3 sm:grid-cols-2">
                      <label className="cursor-pointer rounded-xl border-2 border-dashed border-[#c9c2f5] bg-[#f0efff] p-4 text-center hover:bg-[#f4f2ff]">
                        <span className="block text-2xl">📷</span>
                        <span className="mt-2 block text-sm font-bold">
                          {uploadingImage === "avatar"
                            ? "Uploading..."
                            : "Change picture"}
                        </span>
                        <span className="mt-1 block text-xs text-[#6e6889]">
                          PNG, JPG or WEBP · Max 3 MB
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

                      <label className="cursor-pointer rounded-xl border-2 border-dashed border-[#c9c2f5] bg-[#f0efff] p-4 text-center hover:bg-[#f4f2ff]">
                        <span className="block text-2xl">🖼️</span>
                        <span className="mt-2 block text-sm font-bold">
                          {uploadingImage === "banner"
                            ? "Uploading..."
                            : "Change banner"}
                        </span>
                        <span className="mt-1 block text-xs text-[#6e6889]">
                          PNG, JPG or WEBP · Max 3 MB
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

                    <label className="mt-5 block text-sm font-bold">
                      Display name
                    </label>
                    <input
                      value={displayName}
                      onChange={(event) => setDisplayName(event.target.value)}
                      maxLength={30}
                      placeholder="Your display name"
                      className="mt-2 w-full rounded-xl border-2 border-[#d9d4ff] bg-[#f0efff] px-4 py-3 text-sm outline-none focus:border-[#c084fc]"
                    />
                    <p className="mt-1 text-right text-xs text-[#85809d]">
                      {displayName.length}/30
                    </p>

                    <label className="mt-4 block text-sm font-bold">
                      Username · Locked
                    </label>
                    <div className="relative mt-2">
                      <input
                        type="text"
                        value={`@${username}`}
                        readOnly
                        aria-label="Permanent username"
                        className="w-full cursor-not-allowed rounded-xl border border-[#d9d4ff] bg-[#f0f7fb] px-4 py-3 pr-12 text-sm font-semibold text-[#6e6889] outline-none"
                      />
                      <span
                        aria-hidden="true"
                        title="Your username cannot be changed"
                        className="absolute right-4 top-1/2 -translate-y-1/2 text-[#6e6889]"
                      >
                        🔒
                      </span>
                    </div>
                    <p className="mt-1 text-xs text-[#85809d]">
                      This is the username you chose when signing up. It cannot be changed.
                    </p>

                    <label className="mt-4 block text-sm font-bold">Bio</label>
                    <textarea
                      value={bio}
                      onChange={(event) => setBio(event.target.value)}
                      maxLength={160}
                      rows={3}
                      placeholder="Tell everyone about yourself..."
                      className="mt-2 w-full resize-none rounded-xl border-2 border-[#d9d4ff] bg-[#f0efff] px-4 py-3 text-sm outline-none focus:border-[#c084fc]"
                    />
                    <p className="mt-1 text-right text-xs text-[#85809d]">
                      {bio.length}/160
                    </p>

                    {profileError && (
                      <p className="mt-4 break-words rounded-xl bg-red-50 px-4 py-3 text-sm text-red-600">
                        {profileError}
                      </p>
                    )}

                    <div className="mt-5 flex gap-3">
                      <button
                        type="button"
                        onClick={() => void saveProfile()}
                        disabled={savingProfile || uploadingImage !== null}
                        className="flex-1 rounded-xl bg-[#8b5cf6] px-4 py-3 text-sm font-bold text-white disabled:opacity-50"
                      >
                        {savingProfile ? "Saving..." : "Save changes"}
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          setEditingProfile(false);
                          setDisplayName(profile?.display_name || username);
                          setBio(profile?.bio || "");
                          setProfileError("");
                        }}
                        disabled={savingProfile || uploadingImage !== null}
                        className="rounded-xl bg-[#f0f7fb] px-4 py-3 text-sm font-bold text-[#6e6889] disabled:opacity-50"
                      >
                        Cancel
                      </button>
                    </div>
                  </>
                ) : (
                  <>
                    <p className="mt-4 whitespace-pre-wrap text-sm leading-6 text-[#6e6889]">
                      {profile?.bio ||
                        "No bio yet. Tell the community about yourself!"}
                    </p>

                    <p className="mt-3 text-xs text-[#85809d]">
                      {formatLastSeen(profile?.last_seen_at ?? null)}
                    </p>

                    {profileError && (
                      <p className="mt-4 break-words rounded-xl bg-red-50 px-4 py-3 text-sm text-red-600">
                        {profileError}
                      </p>
                    )}

                    {isGuestAccount && (
                      <div className="mt-6 rounded-2xl border border-fuchsia-400/30 bg-gradient-to-r from-[#26143c] to-[#13243a] p-5">
                        <p className="text-base font-black text-white">Save your Anime Zone account</p>
                        <p className="mt-2 text-sm leading-6 text-[#686184]">Create a login with your email and password. Your current username and profile will be kept.</p>
                        <button
                          type="button"
                          onClick={() => {
                            setProfileMenuOpen(false);
                            setEditingProfile(false);
                            setError("");
                            setNotice("");
                            setEmail("");
                            setPassword("");
                            setScreen("signup");
                          }}
                          className="mt-4 w-full rounded-xl bg-[#8b5cf6] px-5 py-3 font-bold text-white transition hover:bg-[#7c3aed]"
                        >
                          Sign Up & Save Account →
                        </button>
                      </div>
                    )}

                    <button
                      type="button"
                      onClick={() => {
                        setDisplayName(profile?.display_name || username);
                        setBio(profile?.bio || "");
                        setProfileError("");
                        setEditingProfile(true);
                      }}
                      className="mt-6 w-full rounded-xl bg-[#8b5cf6] px-5 py-3 font-bold text-white hover:bg-[#7c3aed]"
                    >
                      ✎ Edit profile
                    </button>
                  </>
                )}
              </>
            )}
          </section>
        </div>
      )}

      <nav className="fixed bottom-0 left-0 right-0 z-20 border-t border-[#d8edfa] bg-[#ffffff]/95 px-5 py-3 backdrop-blur">
        <div className="mx-auto flex max-w-lg items-center justify-around">
          <button
            onClick={() => setTab("lobby")}
            className={`flex flex-col items-center gap-1 rounded-2xl px-8 py-2 text-sm font-bold transition ${
              tab === "lobby"
                ? "bg-[#e4f5ff] text-[#7561c8]"
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
                ? "bg-[#e4f5ff] text-[#7561c8]"
                : "text-[#91a9ba]"
            }`}
          >
            <span className="text-xl">💬</span>
            Chat
          </button>
          <button
            onClick={() => setTab("leaderboard")}
            className={`flex flex-col items-center gap-1 rounded-2xl px-5 py-2 text-sm font-bold transition ${tab === "leaderboard" ? "bg-[#e9e7ff] text-[#7561c8]" : "text-[#85809d]"}`}
          >
            <span className="text-xl">🏆</span>
            Leaderboard
          </button>
        </div>
      </nav>
    </main>
  );
}
