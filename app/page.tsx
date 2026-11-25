
"use client";

import { useEffect, useRef, useState } from "react";
import type { ChangeEvent, ReactNode } from "react";
import { LiveKitRoom, VideoTrack, useLocalParticipant, useTracks } from "@livekit/components-react";
import { Track } from "livekit-client";
import { createClient } from "../src/lib/client";

type Screen =
  | "welcome"
  | "choose"
  | "guest"
  | "signup"
  | "signin"
  | "lobby";

type Tab = "lobby" | "chat" | "global" | "leaderboard" | "watch";
type ImageType = "avatar" | "banner";
type AnimeTheme = "light" | "dark" | "neon-blue" | "neon-purple" | "snow-blue";
const ANIME_THEMES: { id: AnimeTheme; label: string; emoji: string }[] = [
  { id: "light", label: "Light", emoji: "☀️" },
  { id: "dark", label: "Dark", emoji: "🌙" },
  { id: "neon-blue", label: "Neon Blue", emoji: "💠" },
  { id: "neon-purple", label: "Neon Purple", emoji: "💜" },
  { id: "snow-blue", label: "Anime Zone Snow Blue", emoji: "❄️" },
];

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

type Friend = FriendSearchResult & {
  request_id: string;
  last_seen_at: string | null;
  is_online: boolean;
  last_message?: DirectMessage | null;
  unread_count?: number;
};

type DirectMessage = {
  id: string;
  sender_id: string;
  recipient_id: string;
  content: string;
  created_at: string;
};

type GlobalMessage = {
  id: string;
  user_id: string;
  username: string;
  content: string;
  created_at: string;
  display_name?: string;
  avatar_url?: string | null;
  bio?: string;
  last_seen_at?: string | null;
  banner_url?: string | null;
  reply_to?: string | null;
  reply_username?: string | null;
  reply_preview?: string | null;
};

type WatchMessage = {
  id: string;
  user_id: string;
  content: string;
  created_at: string;
  username: string;
  display_name: string;
  avatar_url: string | null;
};

type WatchVideoSettings = {
  id: boolean;
  video_url: string | null;
  updated_at: string;
};

type Announcement = {
  id: string;
  message: string;
  created_at: string;
  created_by: string;
};

type SuggestionVote = -1 | 1;

type Suggestion = {
  id: string;
  user_id: string;
  username: string;
  avatar_url?: string | null;
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

const ANIME_ZONE_STICKER_PREFIX = "AZSTICKER:";
type StickerTarget = "dm" | "global" | "watch";
type GiphySticker = {
  id: string;
  title?: string;
  images?: {
    fixed_width?: { url?: string };
    fixed_width_small?: { url?: string };
    original?: { url?: string };
  };
};

function getStickerUrl(content: string): string | null {
  if (!content.startsWith(ANIME_ZONE_STICKER_PREFIX)) return null;
  const url = content.slice(ANIME_ZONE_STICKER_PREFIX.length).trim();
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "https:" || !/^media\d*\.giphy\.com$/i.test(parsed.hostname)) return null;
    return url;
  } catch {
    return null;
  }
}

function StickerPicker({ onSelect, onClose }: { onSelect: (url: string) => void; onClose: () => void }) {
  const [query, setQuery] = useState("");
  const [stickers, setStickers] = useState<GiphySticker[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const apiKey = process.env.NEXT_PUBLIC_GIPHY_API_KEY;

  async function loadStickers(searchTerm = "") {
    if (!apiKey) {
      setError("GIPHY API key not found. Check NEXT_PUBLIC_GIPHY_API_KEY in .env.local and restart the app.");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const endpoint = searchTerm.trim()
        ? `https://api.giphy.com/v1/stickers/search?api_key=${encodeURIComponent(apiKey)}&q=${encodeURIComponent(searchTerm.trim())}&limit=30&rating=pg&lang=en`
        : `https://api.giphy.com/v1/stickers/trending?api_key=${encodeURIComponent(apiKey)}&limit=30&rating=pg`;
      const response = await fetch(endpoint);
      if (!response.ok) throw new Error(response.status === 401 ? "GIPHY rejected the API key. Check that it was copied correctly." : `GIPHY returned an error (${response.status}).`);
      const payload = await response.json();
      setStickers(Array.isArray(payload.data) ? payload.data : []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't load stickers from GIPHY.");
      setStickers([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void loadStickers(); }, []);

  return (
    <div className="fixed bottom-[88px] left-3 z-[120] flex max-h-[min(430px,65dvh)] w-[min(370px,calc(100vw-24px))] flex-col overflow-hidden rounded-2xl border border-[#454b66] bg-[#171a27] text-white shadow-2xl sm:bottom-24 sm:left-6">
      <div className="flex items-center gap-2 border-b border-[#34384d] p-3">
        <div className="min-w-0 flex-1"><p className="text-sm font-black">Anime Zone Stickers</p><p className="text-[10px] text-[#aeb7d5]">Powered by GIPHY</p></div>
        <button type="button" onClick={onClose} aria-label="Close stickers" className="rounded-lg px-2 py-1 text-lg text-[#aeb7d5] hover:bg-[#30364c]">×</button>
      </div>
      <form onSubmit={(event) => { event.preventDefault(); void loadStickers(query); }} className="flex gap-2 border-b border-[#34384d] p-3">
        <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search anime stickers…" className="min-w-0 flex-1 rounded-xl border border-[#414760] bg-[#22263a] px-3 py-2 text-sm text-white outline-none placeholder:text-[#8c94b0] focus:border-[#9d8cf0]" />
        <button type="submit" disabled={loading} className="rounded-xl bg-[#8055d6] px-3 py-2 text-xs font-black text-white disabled:opacity-50">Search</button>
      </form>
      <div className="flex items-center justify-between px-3 pt-2">
        <span className="text-[10px] font-bold uppercase tracking-wider text-[#aeb7d5]">{query.trim() ? `Results for “${query.trim()}”` : "Trending stickers"}</span>
        <button type="button" onClick={() => { setQuery(""); void loadStickers(""); }} className="text-[10px] font-bold text-[#b9a8ff]">Trending</button>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto p-2">
        {loading ? <p className="py-10 text-center text-xs text-[#aeb7d5]">Loading stickers…</p> : error ? <p role="alert" className="px-3 py-8 text-center text-xs leading-5 text-rose-300">{error}</p> : stickers.length === 0 ? <p className="py-10 text-center text-xs text-[#aeb7d5]">No stickers found. Try another search.</p> : <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">{stickers.map((sticker) => {
          const sendUrl = sticker.images?.fixed_width?.url || sticker.images?.original?.url;
          const previewUrl = sticker.images?.fixed_width_small?.url || sendUrl;
          if (!sendUrl || !previewUrl) return null;
          return <button key={sticker.id} type="button" title={sticker.title || "Send sticker"} onClick={() => onSelect(sendUrl)} className="flex aspect-square items-center justify-center overflow-hidden rounded-xl bg-[#252a3d] p-1 transition hover:bg-[#343953] focus:outline-none focus:ring-2 focus:ring-violet-400"><img src={previewUrl} alt={sticker.title || "GIPHY sticker"} loading="lazy" className="max-h-full max-w-full object-contain" /></button>;
        })}</div>}
      </div>
      <div className="border-t border-[#34384d] px-3 py-2 text-center text-[9px] text-[#8c94b0]">Powered by GIPHY</div>
    </div>
  );
}

function LiveKitScreenShareStage({ isAdmin, fallback }: { isAdmin: boolean; fallback: ReactNode }) {
  const screenShares = useTracks([Track.Source.ScreenShare]);
  const { localParticipant, isScreenShareEnabled } = useLocalParticipant();
  const [shareError, setShareError] = useState("");
  const [shareBusy, setShareBusy] = useState(false);

  async function toggleScreenShare() {
    if (!isAdmin || shareBusy) return;
    setShareBusy(true);
    setShareError("");
    try {
      await localParticipant.setScreenShareEnabled(!isScreenShareEnabled);
    } catch (error) {
      console.error("LiveKit screen share error:", error);
      setShareError(error instanceof Error ? error.message : "Could not start screen sharing. Check your browser permissions.");
    } finally {
      setShareBusy(false);
    }
  }

  return (
    <div className="flex h-full min-h-0 flex-col bg-black">
      <div className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-b border-[#303449] bg-[#171a27] px-3 py-2.5 sm:px-4">
        <div className="flex items-center gap-2">
          <span className={`h-2 w-2 rounded-full ${screenShares.length > 0 ? "animate-pulse bg-rose-500" : "bg-slate-500"}`} />
          <span className="text-xs font-black text-white">{screenShares.length > 0 ? "LIVE SCREEN SHARE" : "LIVE BROADCAST"}</span>
        </div>
        {isAdmin && <button type="button" onClick={() => void toggleScreenShare()} disabled={shareBusy} className={`rounded-xl px-4 py-2 text-xs font-black text-white disabled:opacity-50 ${isScreenShareEnabled ? "bg-rose-600 hover:bg-rose-500" : "bg-emerald-600 hover:bg-emerald-500"}`}>
          {shareBusy ? "Please wait…" : isScreenShareEnabled ? "■ Stop sharing" : "▣ Start screen share"}
        </button>}
      </div>
      {shareError && <p role="alert" className="shrink-0 bg-rose-500/10 px-4 py-2 text-xs text-rose-200">{shareError}</p>}
      <div className="relative min-h-0 flex-1 bg-black">
        {screenShares.length > 0 ? (
          <div className="absolute inset-0 flex items-center justify-center bg-black">
            <VideoTrack trackRef={screenShares[0]} className="h-full w-full object-contain" />
          </div>
        ) : (
          <div className="h-full min-h-48">{fallback}</div>
        )}
      </div>
      <p className="shrink-0 border-t border-[#303449] bg-[#171a27] px-3 py-2 text-[10px] leading-4 text-[#929ab8]">
        {screenShares.length > 0 ? "The admin's screen is being shared with everyone in this Watch room." : isAdmin ? "Start screen share to broadcast your screen to everyone watching." : "Waiting for an Anime Zone admin to start screen sharing. The shared video player is shown until then."}
      </p>
    </div>
  );
}

function LiveKitBroadcastPanel({ isAdmin, fallback }: { isAdmin: boolean; fallback: ReactNode }) {
  const [token, setToken] = useState("");
  const [serverUrl, setServerUrl] = useState("");
  const [connectionError, setConnectionError] = useState("");
  const [loading, setLoading] = useState(true);
  const [retry, setRetry] = useState(0);

  useEffect(() => {
    let cancelled = false;
    async function connectToLiveKit() {
      setLoading(true);
      setConnectionError("");
      setToken("");
      try {
        const response = await fetch("/api/livekit/token", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ role: isAdmin ? "publisher" : "viewer" }),
        });
        const result = await response.json();
        if (!response.ok) throw new Error(result.error || "Could not connect to the live room.");
        if (!result.token || !result.serverUrl) throw new Error("LiveKit returned an incomplete connection response.");
        if (!cancelled) {
          setToken(result.token);
          setServerUrl(result.serverUrl);
        }
      } catch (error) {
        console.error("LiveKit connection setup error:", error);
        if (!cancelled) setConnectionError(error instanceof Error ? error.message : "Could not connect to LiveKit.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void connectToLiveKit();
    return () => { cancelled = true; };
  }, [isAdmin, retry]);

  if (loading) return <div className="flex h-full min-h-48 items-center justify-center bg-black px-6 text-center text-sm text-[#a5abc2]">Connecting to Anime Zone live room…</div>;
  if (!token || !serverUrl) return <div className="flex h-full min-h-48 flex-col items-center justify-center gap-3 bg-black px-6 text-center"><p className="text-sm text-rose-200">{connectionError || "Live room connection is unavailable."}</p><div className="w-full max-w-xl">{fallback}</div><button type="button" onClick={() => setRetry((value) => value + 1)} className="rounded-xl bg-[#8055d6] px-4 py-2 text-xs font-black text-white">Retry live connection</button></div>;

  return (
    <LiveKitRoom serverUrl={serverUrl} token={token} connect={true} audio={false} video={false} className="flex h-full min-h-0 flex-col" onError={(error) => { console.error("LiveKit room error:", error); setConnectionError(error.message); }}>
      <LiveKitScreenShareStage isAdmin={isAdmin} fallback={fallback} />
    </LiveKitRoom>
  );
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
  const [outgoingRequests, setOutgoingRequests] = useState<FriendRequest[]>([]);
  const [friends, setFriends] = useState<Friend[]>([]);
  const [friendsLoading, setFriendsLoading] = useState(false);
  const [chatSection, setChatSection] = useState<"friends" | "requests">("friends");
  const [selectedChatFriendId, setSelectedChatFriendId] = useState("");
  const [chatMessages, setChatMessages] = useState<DirectMessage[]>([]);
  const [chatDraft, setChatDraft] = useState("");
  const [chatLoading, setChatLoading] = useState(false);
  const [chatSending, setChatSending] = useState(false);
  const [chatError, setChatError] = useState("");
  const [unreadMessageCount, setUnreadMessageCount] = useState(0);
  const [globalMessages, setGlobalMessages] = useState<GlobalMessage[]>([]);
  const [globalDraft, setGlobalDraft] = useState("");
  const [globalLoading, setGlobalLoading] = useState(false);
  const [globalSending, setGlobalSending] = useState(false);
  const [globalError, setGlobalError] = useState("");
  const [globalReplyTo, setGlobalReplyTo] = useState<GlobalMessage | null>(null);
  const [mentionSuggestions, setMentionSuggestions] = useState<FriendSearchResult[]>([]);
  const [mentionSearchLoading, setMentionSearchLoading] = useState(false);
  const [globalMentionNotice, setGlobalMentionNotice] = useState("");
  const [unreadMentionCount, setUnreadMentionCount] = useState(0);
  const globalTouchStart = useRef<{ x: number; y: number } | null>(null);
  const globalScrollRef = useRef<HTMLDivElement>(null);
  const chatScrollRef = useRef<HTMLDivElement>(null);
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [announcementDraft, setAnnouncementDraft] = useState("");
  const [announcementError, setAnnouncementError] = useState("");
  const [announcementSending, setAnnouncementSending] = useState(false);
  const [selectedGlobalMember, setSelectedGlobalMember] = useState<GlobalMessage | null>(null);

  // Shared Watch room
  const [watchVideoUrl, setWatchVideoUrl] = useState("");
  const [watchVideoDraft, setWatchVideoDraft] = useState("");
  const [watchVideoLoading, setWatchVideoLoading] = useState(false);
  const [watchVideoSaving, setWatchVideoSaving] = useState(false);
  const [watchVideoError, setWatchVideoError] = useState("");
  const [watchMessages, setWatchMessages] = useState<WatchMessage[]>([]);
  const [watchMessagesLoading, setWatchMessagesLoading] = useState(false);
  const [watchDraft, setWatchDraft] = useState("");
  const [watchSending, setWatchSending] = useState(false);
  const [watchChatError, setWatchChatError] = useState("");
  const watchScrollRef = useRef<HTMLDivElement>(null);
  const [stickerPickerTarget, setStickerPickerTarget] = useState<StickerTarget | null>(null);
  const [stickerSending, setStickerSending] = useState(false);

  // Community suggestion feed
  const [suggestionText, setSuggestionText] = useState("");
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [suggestionsLoading, setSuggestionsLoading] = useState(false);
  const [postingSuggestion, setPostingSuggestion] = useState(false);
  const [suggestionError, setSuggestionError] = useState("");
  const [isAdmin, setIsAdmin] = useState(false);
  const [theme, setTheme] = useState<AnimeTheme>("dark");
  const [globalTheme, setGlobalTheme] = useState<AnimeTheme>("dark");
  const [themeMenuOpen, setThemeMenuOpen] = useState(false);
  const [themeSaving, setThemeSaving] = useState(false);
  const [themeMessage, setThemeMessage] = useState("");
  const [avatarZoomUrl, setAvatarZoomUrl] = useState<string | null>(null);
  const [deletingSuggestionId, setDeletingSuggestionId] = useState<string | null>(null);

  // Monthly community anime theme voting and live site activity.
  const monthlyAnimeOptions = ["One Piece", "Naruto", "Jujutsu Kaisen", "Demon Slayer", "Solo Leveling", "Attack on Titan", "My Hero Academia", "Black Clover"];
  const [monthlyVotes, setMonthlyVotes] = useState<{ anime_name: string; votes: number; my_vote: boolean }[]>([]);
  const [monthlyVoteLoading, setMonthlyVoteLoading] = useState(false);
  const [monthlyVoteError, setMonthlyVoteError] = useState("");
  const [siteVisits, setSiteVisits] = useState(0);
  const [onlineNow, setOnlineNow] = useState(0);


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

  function isAnimeZoneAdmin(value: string) {
    const normalized = value.trim().replace(/^@/, "").toLowerCase();
    return normalized === "ootw_team" || normalized === "animeking" || normalized === "animeking2026" || normalized === "animezone2026" || normalized === "rohit" || normalized === "madara";
  }

  function AdminName({ value }: { value: string }) {
    if (!isAnimeZoneAdmin(value)) return <span className="inline-flex items-center gap-1.5">{value}<span className="rounded-full bg-emerald-500/15 px-1.5 py-0.5 text-[9px] font-black tracking-wide text-emerald-400">JUNIOR</span></span>;
    return <span className="inline-flex items-center gap-1"><span className="bg-gradient-to-r from-red-500 via-amber-400 via-green-500 via-cyan-500 via-blue-500 to-fuchsia-500 bg-clip-text font-black text-transparent">{value}</span><span aria-label="Anime Zone admin" title="Anime Zone admin" className="text-red-500">👑</span></span>;
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
      setSelectedGlobalMember((current) => current?.user_id === targetUserId ? null : current);
      setOutgoingRequests((current) => current.some((row) => row.recipient_id === targetUserId && row.status === "pending") ? current : [...current, { id: `local-${targetUserId}`, sender_id: profile?.user_id || "", recipient_id: targetUserId, status: "pending", created_at: new Date().toISOString() }]);
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
      setOutgoingRequests(rows.filter((row) => row.status === "pending" && row.sender_id === currentUserId));
      const accepted = rows.filter((row) => row.status === "accepted");
      const friendIds = accepted.map((row) => row.sender_id === currentUserId ? row.recipient_id : row.sender_id);
      if (friendIds.length === 0) {
        setFriends([]);
        return;
      }

      const [{ data: names, error: namesError }, { data: profiles, error: profilesError }] = await Promise.all([
        supabase.from("anime_usernames").select("user_id, username").in("user_id", friendIds),
        supabase.from("anime_profiles").select("user_id, display_name, bio, avatar_url, last_seen_at").in("user_id", friendIds),
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
          last_seen_at: personProfile?.last_seen_at || null,
          is_online: Boolean(personProfile?.last_seen_at && Date.now() - new Date(personProfile.last_seen_at).getTime() < 90000),
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

  const selectedChatFriend = friends.find((friend) => friend.user_id === selectedChatFriendId) ?? null;

  async function loadUnreadMessages(currentUserId?: string) {
    try {
      let id = currentUserId;
      if (!id) {
        const { data: auth } = await supabase.auth.getUser();
        id = auth.user?.id;
      }
      if (!id) return;

      const { data: readRows, error: readError } = await supabase
        .from("anime_dm_read_states")
        .select("friend_id, last_read_at")
        .eq("user_id", id);
      if (readError) throw readError;

      const { data: incoming, error: messageError } = await supabase
        .from("anime_direct_messages")
        .select("id, sender_id, recipient_id, content, created_at")
        .eq("recipient_id", id)
        .order("created_at", { ascending: false })
        .limit(500);
      if (messageError) throw messageError;

      const readAt = new Map<string, number>((readRows ?? []).map((row: { friend_id: string; last_read_at: string }) => [row.friend_id, new Date(row.last_read_at).getTime()]));
      const unread = (incoming ?? []).filter((message) => {
        const lastRead = readAt.get(message.sender_id);
        return lastRead === undefined || new Date(message.created_at).getTime() > lastRead;
      });
      setUnreadMessageCount(unread.length);
    } catch (err) {
      console.error("Unread chat count error:", err);
    }
  }

  async function loadChatMessages(friendId: string, markRead = true) {
    if (!friendId) return;
    setChatLoading(true);
    setChatError("");
    try {
      const { data: auth, error: authError } = await supabase.auth.getUser();
      if (authError) throw authError;
      if (!auth.user) throw new Error("Please sign in again.");

      const { data, error: messagesError } = await supabase
        .from("anime_direct_messages")
        .select("id, sender_id, recipient_id, content, created_at")
        .or(`and(sender_id.eq.${auth.user.id},recipient_id.eq.${friendId}),and(sender_id.eq.${friendId},recipient_id.eq.${auth.user.id})`)
        .order("created_at", { ascending: true })
        .limit(300);
      if (messagesError) throw messagesError;
      setChatMessages((data ?? []) as DirectMessage[]);

      if (markRead) {
        const { error: readError } = await supabase
          .from("anime_dm_read_states")
          .upsert({
            user_id: auth.user.id,
            friend_id: friendId,
            last_read_at: new Date().toISOString(),
          }, { onConflict: "user_id,friend_id" });
        if (readError) throw readError;
        await loadUnreadMessages(auth.user.id);
      }
    } catch (err) {
      console.error("Chat load error:", err);
      setChatError(err instanceof Error ? err.message : "Could not load this conversation.");
    } finally {
      setChatLoading(false);
    }
  }

  async function sendChatMessage(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const content = chatDraft.trim();
    if (!content || !selectedChatFriend || chatSending) return;

    setChatSending(true);
    setChatError("");
    try {
      const { data: auth, error: authError } = await supabase.auth.getUser();
      if (authError) throw authError;
      if (!auth.user) throw new Error("Please sign in again.");

      const { error: insertError } = await supabase
        .from("anime_direct_messages")
        .insert({
          sender_id: auth.user.id,
          recipient_id: selectedChatFriend.user_id,
          content,
        });
      if (insertError) throw insertError;

      setChatDraft("");
      await loadChatMessages(selectedChatFriend.user_id, false);
      await loadUnreadMessages(auth.user.id);
    } catch (err) {
      console.error("Send chat message error:", err);
      setChatError(err instanceof Error ? err.message : "Could not send your message.");
    } finally {
      setChatSending(false);
    }
  }

  function openDirectMessage(friendId: string) {
    setSelectedChatFriendId(friendId);
    void loadChatMessages(friendId, true);
  }

  useEffect(() => {
    if (screen === "lobby" && tab === "chat") {
      void loadFriendData();
      void loadUnreadMessages();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [screen, tab]);

  useEffect(() => {
    if (!selectedChatFriendId) {
      setChatMessages([]);
      return;
    }
    void loadChatMessages(selectedChatFriendId, true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedChatFriendId]);

  useEffect(() => {
    if (screen !== "lobby" || tab !== "chat") return;
    const channel = supabase
      .channel("anime-zone-dm-live")
      .on("postgres_changes", { event: "*", schema: "public", table: "anime_direct_messages" }, () => {
        if (selectedChatFriendId) void loadChatMessages(selectedChatFriendId, true);
        void loadUnreadMessages();
        void loadFriendData();
      })
      .subscribe();
    const timer = window.setInterval(() => {
      void loadFriendData();
      void loadUnreadMessages();
      if (selectedChatFriendId) void loadChatMessages(selectedChatFriendId, true);
    }, 20000);
    return () => {
      window.clearInterval(timer);
      void supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [screen, tab, selectedChatFriendId]);

  useEffect(() => {
    const element = chatScrollRef.current;
    if (element) element.scrollTo({ top: element.scrollHeight, behavior: "smooth" });
  }, [chatMessages]);

  async function loadGlobalMessages() {
    setGlobalLoading(true);
    setGlobalError("");
    try {
      const { data, error: queryError } = await supabase
        .from("anime_global_messages")
        .select("id, user_id, username, content, created_at, reply_to")
        .order("created_at", { ascending: true })
        .limit(150);
      if (queryError) throw queryError;
      const rows = (data ?? []) as GlobalMessage[];
      const ids = [...new Set(rows.map((row) => row.user_id))];
      const [{ data: profiles }, { data: names }] = ids.length ? await Promise.all([
        supabase.from("anime_profiles").select("user_id, display_name, avatar_url, banner_url, bio, last_seen_at").in("user_id", ids),
        supabase.from("anime_usernames").select("user_id, username").in("user_id", ids),
      ]) : [{ data: [] }, { data: [] }];
      const enriched = rows.map((row) => {
        const person = (profiles ?? []).find((item) => item.user_id === row.user_id);
        const name = (names ?? []).find((item) => item.user_id === row.user_id);
        const replied = row.reply_to ? rows.find((candidate) => candidate.id === row.reply_to) : null;
        const repliedName = replied ? names?.find((item) => item.user_id === replied.user_id)?.username : null;
        return { ...row, display_name: person?.display_name || name?.username || row.username,
          avatar_url: person?.avatar_url || null, banner_url: person?.banner_url || null, bio: person?.bio || "",
          last_seen_at: person?.last_seen_at || null, reply_username: repliedName || replied?.username || null,
          reply_preview: replied?.content || null };
      });
      setGlobalMessages(enriched);
    } catch (err) {
      console.error("Global chat load error:", err);
      setGlobalError(err instanceof Error ? err.message : "Could not load Global Chat.");
    } finally {
      setGlobalLoading(false);
    }
  }

  // Suggest usernames while the member types an @mention in Global Chat.
  useEffect(() => {
    const match = globalDraft.match(/(?:^|\s)@([a-zA-Z0-9_]{1,20})$/);
    if (!match) {
      setMentionSuggestions([]);
      setMentionSearchLoading(false);
      return;
    }
    let active = true;
    setMentionSearchLoading(true);
    const timer = window.setTimeout(async () => {
      try {
        const { data, error: searchError } = await supabase.rpc("anime_search_users", { search_term: match[1] });
        if (searchError) throw searchError;
        if (active) setMentionSuggestions(((data || []) as FriendSearchResult[]).slice(0, 6));
      } catch (err) {
        console.error("Mention search error:", err);
        if (active) setMentionSuggestions([]);
      } finally {
        if (active) setMentionSearchLoading(false);
      }
    }, 180);
    return () => { active = false; window.clearTimeout(timer); };
  }, [globalDraft, supabase]);

  function chooseGlobalMention(person: FriendSearchResult) {
    setGlobalDraft((current) => current.replace(/(?:^|\s)@[a-zA-Z0-9_]{1,20}$/, (match) => `${match.startsWith(" ") ? " " : ""}@${person.username} `));
    setMentionSuggestions([]);
  }

  async function loadMentionNotifications() {
    try {
      const { data: auth } = await supabase.auth.getUser();
      if (!auth.user) return;
      const { data, error: notificationError } = await supabase
        .from("anime_global_notifications")
        .select("id, message_id, sender_username, created_at")
        .eq("recipient_id", auth.user.id)
        .is("read_at", null)
        .order("created_at", { ascending: false })
        .limit(10);
      if (notificationError) throw notificationError;
      setUnreadMentionCount(data?.length || 0);
      if (data?.length) {
        const newest = data[0];
        setGlobalMentionNotice(`You were mentioned by @${newest.sender_username} in Global Chat.`);
      }
    } catch (err) {
      console.error("Mention notification load error:", err);
    }
  }

  async function markMentionNotificationsRead() {
    try {
      const { data: auth } = await supabase.auth.getUser();
      if (!auth.user) return;
      const { error: updateError } = await supabase
        .from("anime_global_notifications")
        .update({ read_at: new Date().toISOString() })
        .eq("recipient_id", auth.user.id)
        .is("read_at", null);
      if (updateError) throw updateError;
      setUnreadMentionCount(0);
      setGlobalMentionNotice("");
    } catch (err) {
      console.error("Mark mention notifications read error:", err);
    }
  }

  function beginGlobalReply(message: GlobalMessage) {
    setGlobalReplyTo(message);
    setGlobalMentionNotice("");
  }

  async function sendGlobalMessage(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const content = globalDraft.trim();
    if (!content || globalSending) return;
    setGlobalSending(true);
    setGlobalError("");
    try {
      const { data: auth, error: authError } = await supabase.auth.getUser();
      if (authError) throw authError;
      if (!auth.user) throw new Error("Please sign in again.");
      const { error: insertError } = await supabase
        .from("anime_global_messages")
        .insert({ user_id: auth.user.id, content, reply_to: globalReplyTo?.id || null });
      if (insertError) throw insertError;
      setGlobalDraft("");
      setGlobalReplyTo(null);
      setMentionSuggestions([]);
      await loadGlobalMessages();
    } catch (err) {
      console.error("Global chat send error:", err);
      setGlobalError(err instanceof Error ? err.message : "Could not send message.");
    } finally {
      setGlobalSending(false);
    }
  }

  // Keep mention alerts active even when the member is viewing another tab.
  useEffect(() => {
    if (screen !== "lobby") return;
    let channel: ReturnType<typeof supabase.channel> | null = null;
    let cancelled = false;
    async function watchMentionAlerts() {
      const { data: auth } = await supabase.auth.getUser();
      if (!auth.user || cancelled) return;
      await loadMentionNotifications();
      channel = supabase
        .channel(`anime-zone-mentions-${auth.user.id}`)
        .on("postgres_changes", { event: "INSERT", schema: "public", table: "anime_global_notifications", filter: `recipient_id=eq.${auth.user.id}` }, (payload) => {
          const incoming = payload.new as { sender_username?: string };
          setUnreadMentionCount((count) => count + 1);
          setGlobalMentionNotice(`You were mentioned by @${incoming.sender_username || "a member"} in Global Chat.`);
        })
        .subscribe();
    }
    void watchMentionAlerts();
    return () => { cancelled = true; if (channel) void supabase.removeChannel(channel); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [screen]);

  useEffect(() => {
    if (screen !== "lobby" || tab !== "global") return;
    void loadGlobalMessages();
    void loadMentionNotifications();
    const channel = supabase
      .channel("anime-zone-global-chat-live")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "anime_global_messages" }, () => {
        void loadGlobalMessages();
      })
      .subscribe();
    const timer = window.setInterval(() => { void loadGlobalMessages(); void loadMentionNotifications(); }, 30000);
    return () => {
      window.clearInterval(timer);
      void supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [screen, tab]);

  useEffect(() => {
    const element = globalScrollRef.current;
    if (element) element.scrollTo({ top: element.scrollHeight, behavior: "smooth" });
  }, [globalMessages]);

  function getWatchEmbed(urlValue: string): { type: "youtube" | "vimeo" | "instagram" | "tiktok" | "video" | "invalid"; src: string } {
    const raw = urlValue.trim();
    if (!raw) return { type: "invalid", src: "" };
    let parsed: URL;
    try {
      parsed = new URL(raw);
    } catch {
      return { type: "invalid", src: "" };
    }
    if (parsed.protocol !== "https:" && parsed.protocol !== "http:") return { type: "invalid", src: "" };
    const host = parsed.hostname.toLowerCase().replace(/^www\./, "");
    if (host === "youtu.be" || host === "youtube.com" || host.endsWith(".youtube.com")) {
      const id = host === "youtu.be"
        ? parsed.pathname.split("/").filter(Boolean)[0]
        : parsed.searchParams.get("v") || parsed.pathname.match(/\/(?:embed|shorts|live)\/([^/?]+)/)?.[1];
      if (!id) return { type: "invalid", src: "" };
      return { type: "youtube", src: `https://www.youtube-nocookie.com/embed/${encodeURIComponent(id)}?rel=0&loop=1&playlist=${encodeURIComponent(id)}` };
    }
    if (host === "vimeo.com" || host.endsWith(".vimeo.com")) {
      const id = parsed.pathname.match(/\/(\d+)/)?.[1];
      return id ? { type: "vimeo", src: `https://player.vimeo.com/video/${id}?loop=1` } : { type: "invalid", src: "" };
    }
    if (host === "instagram.com" || host.endsWith(".instagram.com")) {
      const match = parsed.pathname.match(/\/(?:p|reel|tv)\/([^/]+)/);
      return match ? { type: "instagram", src: `https://www.instagram.com/${parsed.pathname.split("/").filter(Boolean)[0]}/${encodeURIComponent(match[1])}/embed` } : { type: "invalid", src: "" };
    }
    if (host === "tiktok.com" || host.endsWith(".tiktok.com")) {
      const id = parsed.pathname.match(/\/video\/(\d+)/)?.[1];
      return id ? { type: "tiktok", src: `https://www.tiktok.com/player/v1/${id}` } : { type: "invalid", src: "" };
    }
    if (/\.(mp4|webm|ogg)(?:$)/i.test(parsed.pathname)) return { type: "video", src: raw };
    return { type: "invalid", src: "" };
  }

  async function loadWatchVideo() {
    setWatchVideoLoading(true);
    setWatchVideoError("");
    try {
      const { data, error: queryError } = await supabase
        .from("anime_watch_settings")
        .select("id, video_url, updated_at")
        .eq("id", true)
        .maybeSingle();
      if (queryError) throw queryError;
      const url = (data as WatchVideoSettings | null)?.video_url || "";
      setWatchVideoUrl(url);
      setWatchVideoDraft(url);
    } catch (err) {
      console.error("Watch video settings error:", err);
      setWatchVideoError(err instanceof Error ? err.message : "Could not load the Watch video.");
    } finally {
      setWatchVideoLoading(false);
    }
  }

  async function saveWatchVideo() {
    if (!isAdmin || watchVideoSaving) return;
    const cleanUrl = watchVideoDraft.trim();
    if (cleanUrl && getWatchEmbed(cleanUrl).type === "invalid") {
      setWatchVideoError("Enter a valid YouTube, Vimeo, Instagram, TikTok, or direct MP4/WebM/OGG video URL.");
      return;
    }
    setWatchVideoSaving(true);
    setWatchVideoError("");
    try {
      const { error: saveError } = await supabase
        .from("anime_watch_settings")
        .upsert({ id: true, video_url: cleanUrl || null, updated_at: new Date().toISOString() }, { onConflict: "id" });
      if (saveError) throw saveError;
      setWatchVideoUrl(cleanUrl);
    } catch (err) {
      console.error("Watch video save error:", err);
      setWatchVideoError(err instanceof Error ? err.message : "Could not update the shared video.");
    } finally {
      setWatchVideoSaving(false);
    }
  }

  async function loadWatchMessages() {
    setWatchMessagesLoading(true);
    setWatchChatError("");
    try {
      const { data, error: queryError } = await supabase
        .from("anime_watch_messages")
        .select("id, user_id, content, created_at")
        .order("created_at", { ascending: false })
        .limit(250);
      if (queryError) throw queryError;
      const rows = (data ?? []).slice().reverse();
      const userIds = [...new Set(rows.map((row) => row.user_id))];
      const [{ data: names, error: namesError }, { data: profiles, error: profilesError }] = userIds.length
        ? await Promise.all([
            supabase.from("anime_usernames").select("user_id, username").in("user_id", userIds),
            supabase.from("anime_profiles").select("user_id, display_name, avatar_url").in("user_id", userIds),
          ])
        : [{ data: [], error: null }, { data: [], error: null }];
      if (namesError) throw namesError;
      if (profilesError) throw profilesError;
      setWatchMessages(rows.map((row) => {
        const name = names?.find((item) => item.user_id === row.user_id);
        const person = profiles?.find((item) => item.user_id === row.user_id);
        return {
          ...row,
          username: name?.username || "Anime Zone member",
          display_name: person?.display_name || name?.username || "Anime Zone member",
          avatar_url: person?.avatar_url || null,
        };
      }) as WatchMessage[]);
    } catch (err) {
      console.error("Watch chat load error:", err);
      setWatchChatError(err instanceof Error ? err.message : "Could not load Watch chat messages.");
    } finally {
      setWatchMessagesLoading(false);
    }
  }

  async function sendWatchMessage(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const content = watchDraft.trim();
    if (!content || watchSending) return;
    setWatchSending(true);
    setWatchChatError("");
    try {
      const { data: auth, error: authError } = await supabase.auth.getUser();
      if (authError) throw authError;
      if (!auth.user) throw new Error("Please sign in to use Watch chat.");
      const { error: insertError } = await supabase
        .from("anime_watch_messages")
        .insert({ user_id: auth.user.id, content });
      if (insertError) throw insertError;
      setWatchDraft("");
      await loadWatchMessages();
    } catch (err) {
      console.error("Watch chat send error:", err);
      setWatchChatError(err instanceof Error ? err.message : "Could not send your Watch message.");
    } finally {
      setWatchSending(false);
    }
  }

  async function sendAnimeZoneSticker(url: string, target: StickerTarget) {
    if (stickerSending) return;
    setStickerSending(true);
    const content = `${ANIME_ZONE_STICKER_PREFIX}${url}`;
    try {
      const { data: auth, error: authError } = await supabase.auth.getUser();
      if (authError) throw authError;
      if (!auth.user) throw new Error("Please sign in again to send a sticker.");

      if (target === "dm") {
        if (!selectedChatFriend) throw new Error("Open a friend's chat before sending a sticker.");
        const { error: insertError } = await supabase.from("anime_direct_messages").insert({ sender_id: auth.user.id, recipient_id: selectedChatFriend.user_id, content });
        if (insertError) throw insertError;
        await loadChatMessages(selectedChatFriend.user_id, false);
        await loadUnreadMessages(auth.user.id);
      } else if (target === "global") {
        const { error: insertError } = await supabase.from("anime_global_messages").insert({ user_id: auth.user.id, content, reply_to: globalReplyTo?.id || null });
        if (insertError) throw insertError;
        setGlobalReplyTo(null);
        await loadGlobalMessages();
      } else {
        const { error: insertError } = await supabase.from("anime_watch_messages").insert({ user_id: auth.user.id, content });
        if (insertError) throw insertError;
        await loadWatchMessages();
      }
      setStickerPickerTarget(null);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Could not send sticker.";
      if (target === "dm") setChatError(message);
      else if (target === "global") setGlobalError(message);
      else setWatchChatError(message);
    } finally {
      setStickerSending(false);
    }
  }

  async function openMemberProfile(userId: string, fallbackUsername: string) {
    try {
      const [{ data: name }, { data: person }] = await Promise.all([
        supabase.from("anime_usernames").select("username").eq("user_id", userId).maybeSingle(),
        supabase.from("anime_profiles").select("display_name, bio, avatar_url, banner_url, last_seen_at").eq("user_id", userId).maybeSingle(),
      ]);
      const resolvedUsername = name?.username || fallbackUsername;
      setSelectedGlobalMember({
        id: `profile-${userId}`,
        user_id: userId,
        username: resolvedUsername,
        content: "",
        created_at: new Date().toISOString(),
        display_name: person?.display_name || resolvedUsername,
        avatar_url: person?.avatar_url || null,
        banner_url: person?.banner_url || null,
        bio: person?.bio || "",
        last_seen_at: person?.last_seen_at || null,
      });
    } catch (err) {
      console.error("Member profile loading error:", err);
      setFriendError(err instanceof Error ? err.message : "Could not load this member's profile.");
    }
  }

  useEffect(() => {
    if (screen !== "lobby" || tab !== "watch") return;
    void loadWatchVideo();
    void loadWatchMessages();
    const channel = supabase
      .channel("anime-zone-watch-live")
      .on("postgres_changes", { event: "*", schema: "public", table: "anime_watch_messages" }, () => {
        void loadWatchMessages();
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "anime_watch_settings" }, () => {
        void loadWatchVideo();
      })
      .subscribe();
    const timer = window.setInterval(() => {
      void loadWatchMessages();
    }, 30000);
    return () => {
      window.clearInterval(timer);
      void supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [screen, tab]);

  useEffect(() => {
    const element = watchScrollRef.current;
    if (element) element.scrollTo({ top: element.scrollHeight, behavior: "smooth" });
  }, [watchMessages]);

  async function loadAnnouncements() {
    try {
      const { data, error: queryError } = await supabase
        .from("anime_announcements")
        .select("id, message, created_at, created_by")
        .order("created_at", { ascending: false })
        .limit(5);
      if (queryError) throw queryError;
      setAnnouncements((data ?? []) as Announcement[]);
    } catch (err) {
      console.error("Announcement load error:", err);
      setAnnouncements([]);
    }
  }

  async function postAnnouncement() {
    const message = announcementDraft.trim();
    if (!message || !isAdmin || announcementSending) return;
    setAnnouncementSending(true);
    setAnnouncementError("");
    try {
      const { data: auth, error: authError } = await supabase.auth.getUser();
      if (authError) throw authError;
      if (!auth.user) throw new Error("Sign in again.");
      const { error: insertError } = await supabase.from("anime_announcements").insert({
        message, created_by: auth.user.id,
      });
      if (insertError) throw insertError;
      setAnnouncementDraft("");
      await loadAnnouncements();
    } catch (err) {
      setAnnouncementError(err instanceof Error ? err.message : "Could not publish announcement.");
    } finally {
      setAnnouncementSending(false);
    }
  }

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
      const memberIds = [...new Set(posts.map((post) => post.user_id))];
      const [{ data: voteRows, error: votesError }, { data: memberProfiles, error: memberProfilesError }] = await Promise.all([
        supabase
          .from("anime_suggestion_votes")
          .select("suggestion_id, user_id, vote")
          .in("suggestion_id", postIds),
        supabase
          .from("anime_profiles")
          .select("user_id, avatar_url")
          .in("user_id", memberIds),
      ]);

      if (votesError) throw votesError;
      if (memberProfilesError) throw memberProfilesError;

      const votes = (voteRows || []) as SuggestionVoteRow[];
      const { data: userData } = await supabase.auth.getUser();
      const currentUserId = userData.user?.id;

      setSuggestions(
        posts.map((post) => {
          const postVotes = votes.filter((vote) => vote.suggestion_id === post.id);
          return {
            ...post,
            avatar_url: memberProfiles?.find((person) => person.user_id === post.user_id)?.avatar_url || null,
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

  const validAnimeTheme = (value: unknown): value is AnimeTheme =>
    ANIME_THEMES.some((item) => item.id === value);

  async function loadAnimeTheme() {
    try {
      const { data: auth } = await supabase.auth.getUser();
      if (!auth.user) return;
      const [{ data: globalRow, error: globalError }, { data: personalRow, error: personalError }] = await Promise.all([
        supabase.from("anime_zone_settings").select("global_theme").eq("id", true).maybeSingle(),
        supabase.from("anime_member_preferences").select("theme_override").eq("user_id", auth.user.id).maybeSingle(),
      ]);
      if (globalError) throw globalError;
      if (personalError) throw personalError;
      const nextGlobal = validAnimeTheme(globalRow?.global_theme) ? globalRow.global_theme : "dark";
      const personal = personalRow?.theme_override;
      setGlobalTheme(nextGlobal);
      setTheme(validAnimeTheme(personal) ? personal : nextGlobal);
    } catch (err) {
      console.warn("Theme settings could not be loaded:", err);
      try {
        const saved = window.localStorage.getItem("az_theme_local");
        if (validAnimeTheme(saved)) setTheme(saved);
      } catch { /* local theme fallback is optional */ }
    }
  }

  async function savePersonalTheme(nextTheme: AnimeTheme) {
    setThemeSaving(true);
    setThemeMessage("");
    try {
      const { data: auth, error: authError } = await supabase.auth.getUser();
      if (authError) throw authError;
      if (!auth.user) throw new Error("Please sign in again.");
      const { error: saveError } = await supabase.from("anime_member_preferences").upsert({
        user_id: auth.user.id, theme_override: nextTheme, updated_at: new Date().toISOString(),
      }, { onConflict: "user_id" });
      if (saveError) throw saveError;
      setTheme(nextTheme);
      try { window.localStorage.setItem("az_theme_local", nextTheme); } catch { /* optional */ }
      setThemeMessage("Your theme is saved on your account.");
    } catch (err) {
      setThemeMessage(err instanceof Error ? err.message : "Could not save your theme.");
    } finally {
      setThemeSaving(false);
    }
  }

  async function followCommunityTheme() {
    setThemeSaving(true);
    setThemeMessage("");
    try {
      const { data: auth, error: authError } = await supabase.auth.getUser();
      if (authError) throw authError;
      if (!auth.user) throw new Error("Please sign in again.");
      const { error: saveError } = await supabase.from("anime_member_preferences").upsert({
        user_id: auth.user.id, theme_override: null, updated_at: new Date().toISOString(),
      }, { onConflict: "user_id" });
      if (saveError) throw saveError;
      setTheme(globalTheme);
      try { window.localStorage.removeItem("az_theme_local"); } catch { /* optional */ }
      setThemeMessage("You're now following the Anime Zone default theme.");
    } catch (err) {
      setThemeMessage(err instanceof Error ? err.message : "Could not reset your theme.");
    } finally {
      setThemeSaving(false);
    }
  }

  async function saveGlobalTheme(nextTheme: AnimeTheme) {
    if (!isAdmin || themeSaving) return;
    setThemeSaving(true);
    setThemeMessage("");
    try {
      const { data: auth, error: authError } = await supabase.auth.getUser();
      if (authError) throw authError;
      if (!auth.user) throw new Error("Please sign in again.");
      const { error: saveError } = await supabase.from("anime_zone_settings").update({
        global_theme: nextTheme, updated_by: auth.user.id, updated_at: new Date().toISOString(),
      }).eq("id", true);
      if (saveError) throw saveError;
      setGlobalTheme(nextTheme);
      // An admin without a personal override follows the new community theme.
      const { data: preference } = await supabase.from("anime_member_preferences").select("theme_override").eq("user_id", auth.user.id).maybeSingle();
      if (!validAnimeTheme(preference?.theme_override)) setTheme(nextTheme);
      setThemeMessage("The Anime Zone default theme has been updated for everyone.");
    } catch (err) {
      setThemeMessage(err instanceof Error ? err.message : "Could not update the community theme.");
    } finally {
      setThemeSaving(false);
    }
  }

  useEffect(() => {
    if (screen !== "lobby") return;
    void loadAnimeTheme();
    const channel = supabase.channel("anime-zone-theme-live")
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "anime_zone_settings" }, () => { void loadAnimeTheme(); })
      .subscribe();
    // Poll as a fallback for projects where Realtime is not enabled for this table.
    const timer = window.setInterval(() => { void loadAnimeTheme(); }, 30000);
    return () => { window.clearInterval(timer); void supabase.removeChannel(channel); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [screen]);

  async function refreshAdminStatus() {
    try {
      const { data, error: adminError } = await supabase.rpc("anime_is_admin");
      if (adminError) throw adminError;
      setIsAdmin(data === true);
    } catch (err) {
      console.error("Admin status check failed:", err);
      setIsAdmin(false);
    }
  }

  async function deleteSuggestion(suggestionId: string) {
    if (!isAdmin) {
      setSuggestionError("Only Anime Zone admins can delete community suggestions.");
      return;
    }

    const confirmed = window.confirm("Delete this community suggestion? This cannot be undone.");
    if (!confirmed) return;

    setDeletingSuggestionId(suggestionId);
    setSuggestionError("");

    try {
      const { error: deleteError } = await supabase
        .from("anime_suggestions")
        .delete()
        .eq("id", suggestionId);

      if (deleteError) throw deleteError;

      setSuggestions((current) => current.filter((item) => item.id !== suggestionId));
    } catch (err) {
      console.error("Suggestion deletion error:", err);
      setSuggestionError(
        err instanceof Error ? err.message : "Could not delete this suggestion."
      );
    } finally {
      setDeletingSuggestionId(null);
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
    if (screen === "lobby" && tab === "lobby") {
      void loadMonthlyVotes();
      void loadAnnouncements();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [screen, tab]);

  // Admin privileges are verified by Supabase for the current authenticated user.
  useEffect(() => {
    if (screen === "lobby") {
      void refreshAdminStatus();
    } else {
      setIsAdmin(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [screen, username]);

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
      <main className="flex min-h-screen items-center justify-center bg-[#11131d] text-[#f4f5fb]">
        <div className="text-center">
          <img src="/az-logo.png" alt="Anime Zone" className="mx-auto h-20 w-20 rounded-2xl object-cover" />
          <p className="mt-5 text-sm font-semibold text-[#686184]">Entering Anime Zone...</p>
        </div>
      </main>
    );
  }

  if (screen === "welcome") {
    return (
      <main className="relative min-h-screen overflow-hidden bg-[#11131d] text-[#f4f5fb] before:pointer-events-none before:fixed before:inset-0 before:bg-[radial-gradient(ellipse_at_15%_10%,rgba(124,58,237,0.22),transparent_38%),radial-gradient(ellipse_at_85%_30%,rgba(8,145,178,0.13),transparent_35%),radial-gradient(ellipse_at_50%_100%,rgba(190,24,93,0.12),transparent_42%)] before:content-['']">
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
    <main data-az-theme={theme} className="az-theme-root relative min-h-screen overflow-hidden bg-[#11131d] pb-24 text-[#f4f5fb] before:pointer-events-none before:fixed before:inset-0 before:bg-[radial-gradient(ellipse_at_10%_0%,rgba(75,55,130,0.22),transparent_35%),radial-gradient(ellipse_at_90%_35%,rgba(8,90,120,0.16),transparent_35%)] before:content-['']">
      {(tab === "chat" || tab === "global") && <div aria-hidden="true" className="pointer-events-none fixed inset-0 z-40 overflow-hidden">{Array.from({ length: 42 }, (_, index) => <span key={index} className="az-snowflake" style={{ left: `${(index * 37) % 100}%`, fontSize: `${8 + (index % 5) * 3}px`, animationDuration: `${7 + (index % 9) * 1.35}s`, animationDelay: `${-((index * 1.7) % 18)}s`, opacity: 0.35 + (index % 5) * 0.12 }}>❄</span>)}</div>}
      <style>{`
        .az-theme-root { transition: background-color .2s ease, color .2s ease; }
        @keyframes az-snow-fall { 0% { transform:translate3d(0,-8vh,0) rotate(0deg); opacity:0; } 10% { opacity:.85; } 90% { opacity:.75; } 100% { transform:translate3d(35px,108vh,0) rotate(360deg); opacity:0; } }
        .az-snowflake { position:fixed; top:-8vh; z-index:40; pointer-events:none; color:rgba(210,238,255,.9); text-shadow:0 0 8px rgba(125,211,252,.55); animation-name:az-snow-fall; animation-timing-function:linear; animation-iteration-count:infinite; user-select:none; }
        @media (prefers-reduced-motion: reduce) { .az-snowflake { animation:none; display:none; } }
        .az-theme-root[data-az-theme="light"] { background:#f4f6fb; color:#20243a; }
        .az-theme-root[data-az-theme="neon-blue"] { background:#061321; color:#e0f5ff; }
        .az-theme-root[data-az-theme="neon-purple"] { background:#160d25; color:#f4eaff; }
        .az-theme-root[data-az-theme="snow-blue"] { background:#eaf7ff; color:#15314a; }
        .az-theme-root[data-az-theme="light"] .bg-\[\#1c2030\], .az-theme-root[data-az-theme="light"] .bg-\[\#171a27\], .az-theme-root[data-az-theme="light"] .bg-\[\#202437\] { background-color:#fff !important; }
        .az-theme-root[data-az-theme="snow-blue"] .bg-\[\#1c2030\], .az-theme-root[data-az-theme="snow-blue"] .bg-\[\#171a27\], .az-theme-root[data-az-theme="snow-blue"] .bg-\[\#202437\] { background-color:#dff2ff !important; }
        .az-theme-root[data-az-theme="neon-blue"] .bg-\[\#1c2030\], .az-theme-root[data-az-theme="neon-blue"] .bg-\[\#171a27\] { background-color:#0b2238 !important; box-shadow:0 0 18px #0ea5e933; }
        .az-theme-root[data-az-theme="neon-purple"] .bg-\[\#1c2030\], .az-theme-root[data-az-theme="neon-purple"] .bg-\[\#171a27\] { background-color:#26143b !important; box-shadow:0 0 18px #a855f733; }
        .az-theme-root[data-az-theme="light"] button.text-white, .az-theme-root[data-az-theme="snow-blue"] button.text-white { color:#fff !important; }
        .az-theme-root[data-az-theme="light"] .text-\[\#a5abc2\], .az-theme-root[data-az-theme="snow-blue"] .text-\[\#a5abc2\], .az-theme-root[data-az-theme="light"] .text-\[\#929ab8\], .az-theme-root[data-az-theme="snow-blue"] .text-\[\#929ab8\] { color:#536b82 !important; }
        @media (max-width: 640px) { .az-theme-root { padding-bottom: calc(5.5rem + env(safe-area-inset-bottom)); } }
      `}</style>
      <div className={`relative z-10 mx-auto ${tab === "chat" || tab === "global" || tab === "watch" ? "w-full max-w-none px-0" : "max-w-7xl px-6 sm:px-8"}`}>
        {(tab === "lobby" || tab === "chat" || tab === "leaderboard") && <header className="flex items-center justify-between gap-4 py-5">
          <div className="flex min-w-0 items-center gap-3">
            <button type="button" onClick={() => {
              setDisplayName(profile?.display_name || username); setBio(profile?.bio || "");
              setProfileError(""); setProfileMenuOpen(true); setEditingProfile(false);
            }} aria-label="Open your profile" className="h-12 w-12 shrink-0 overflow-hidden rounded-full border-2 border-[#7771a8] bg-[#272a3a] shadow-lg">
              {profile?.avatar_url ? <img src={profile.avatar_url} alt="Your profile" className="h-full w-full object-cover" /> : <img src="/az-logo.png" alt="AZ" className="h-full w-full object-cover" />}
            </button>
            <button type="button" onClick={() => {
              setFriendSearchOpen(true); setFriendSearchTerm(""); setFriendSearchResults([]);
              setFriendError(""); setFriendNotice("");
            }} aria-label="Search friends" title="Search friends" className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-[#41445b] bg-[#202333] text-xl text-white hover:bg-[#30354b]">⌕</button>
            <div className="min-w-0">
              <p className="truncate text-sm font-black text-white">{profile?.display_name || username}</p>
              <p className="text-xs text-[#a5a8bd]">{formatLastSeen(profile?.last_seen_at ?? null)}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="relative">
              <button type="button" onClick={() => setThemeMenuOpen((open) => !open)} aria-label="Choose theme" title="Choose theme" className="rounded-xl border border-[#41445b] bg-[#202333] px-3 py-2 text-sm font-bold text-white hover:bg-[#30354b]">🎨</button>
              {themeMenuOpen && <div className="absolute right-0 top-12 z-[80] w-64 rounded-2xl border border-[#414760] bg-[#1b1f2e] p-3 text-white shadow-2xl">
                <p className="px-2 pb-2 text-xs font-black uppercase tracking-wider text-[#aeb7d5]">Your theme</p>
                {ANIME_THEMES.map((item) => <button key={item.id} type="button" onClick={() => void savePersonalTheme(item.id)} disabled={themeSaving} className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm hover:bg-[#30364c] ${theme === item.id ? "bg-[#30364c]" : ""}`}><span>{item.emoji}</span><span className="flex-1">{item.label}</span>{theme === item.id && <span>✓</span>}</button>)}
                <button type="button" onClick={() => void followCommunityTheme()} disabled={themeSaving} className="mt-2 w-full rounded-xl border border-[#414760] px-3 py-2 text-left text-xs font-bold text-[#cbd5e1] hover:bg-[#30364c]">↩ Use community default</button>
        {isAdmin && <><div className="my-2 border-t border-[#414760]"/><p className="px-2 pb-2 text-xs font-black uppercase tracking-wider text-amber-300">Admin · Everyone's default</p>{ANIME_THEMES.map((item) => <button key={`global-${item.id}`} type="button" onClick={() => void saveGlobalTheme(item.id)} disabled={themeSaving} className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm hover:bg-[#30364c] ${globalTheme === item.id ? "bg-[#30364c]" : ""}`}><span>{item.emoji}</span><span className="flex-1">{item.label}</span>{globalTheme === item.id && <span>✓</span>}</button>)}</>}
                {themeMessage && <p className="mt-2 rounded-lg bg-black/20 p-2 text-[11px] text-[#cbd5e1]">{themeMessage}</p>}
                <p className="mt-2 text-[10px] leading-4 text-[#929ab8]">Personal theme overrides the community default. Admin default applies to members without a personal choice.</p>
              </div>}
            </div>
            <button type="button" onClick={() => void logOut()} disabled={loading} className="rounded-xl border border-[#41445b] bg-[#202333] px-3 py-2 text-xs font-bold text-[#d8daea] hover:bg-[#30354b] disabled:opacity-50">{loading ? "…" : "Log out"}</button>
          </div>
        </header>}

        {tab === "lobby" ? (
          <div className="mx-auto grid max-w-7xl grid-cols-1 gap-6 pb-8 lg:grid-cols-[minmax(0,1fr)_320px]">
            <section className="min-w-0 space-y-6">
              <section className="rounded-3xl border border-[#34384d] bg-[#1c2030] p-5 shadow-xl">
                <div className="flex items-center justify-between gap-3">
                  <h2 className="font-black text-white">📢 Admin announcements</h2>
                  <span className="rounded-full bg-[#292e43] px-3 py-1 text-[10px] font-black text-[#aeb5d2]">OFFICIAL</span>
                </div>
                {announcements.length === 0 ? <p className="mt-4 rounded-2xl bg-[#24293a] p-4 text-sm text-[#b2b7ca]">No messages from admin yet.</p> :
                  <div className="mt-4 space-y-3">{announcements.map((item) => <article key={item.id} className="rounded-2xl bg-[#24293a] p-4"><p className="whitespace-pre-wrap break-words text-sm leading-6 text-white">{item.message}</p><time className="mt-2 block text-[10px] text-[#929ab8]">{new Date(item.created_at).toLocaleString()}</time></article>)}</div>}
                {isAdmin && <div className="mt-4 border-t border-[#363b50] pt-4"><p className="mb-2 text-xs font-bold text-[#c2c8e0]">ADMIN · POST AN ANNOUNCEMENT</p><textarea value={announcementDraft} onChange={(e) => setAnnouncementDraft(e.target.value)} maxLength={1000} rows={3} placeholder="Write an update for everyone…" className="w-full rounded-xl border border-[#414760] bg-[#151927] p-3 text-sm text-white outline-none placeholder:text-[#737b98] focus:border-[#8b7be0]" /><button type="button" onClick={() => void postAnnouncement()} disabled={!announcementDraft.trim() || announcementSending} className="mt-2 rounded-xl bg-[#7564d8] px-4 py-2.5 text-xs font-black text-white disabled:opacity-50">{announcementSending ? "Publishing…" : "Publish announcement"}</button>{announcementError && <p className="mt-2 text-xs text-rose-300">{announcementError}</p>}</div>}
              </section>
              <div className="rounded-3xl border border-[#34384d] bg-[#1c2030] p-5 shadow-sm sm:p-7">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-xs font-bold uppercase tracking-[.2em] text-[#8b5cf6]">Your anime community</p>
                    <h1 className="mt-2 text-3xl font-black tracking-tight text-white sm:text-4xl">Welcome back, {profile?.display_name || username || "Anime fan"}.</h1>
                    <p className="mt-2 text-sm text-[#a5abc2]">See what's happening across Anime Zone today.</p>
                  </div>
                  <button type="button" onClick={() => setTab("global")} className="rounded-full bg-[#8055d6] px-5 py-3 text-sm font-bold text-white shadow-sm transition hover:bg-[#7045c5]">Join Global Chat <span aria-hidden="true">→</span></button>
                </div>
                <div className="mt-6 flex flex-wrap items-center gap-4 border-t border-[#303449] pt-4 text-xs font-semibold text-[#929ab8]">
                  <span><span className="mr-1.5 inline-block h-2 w-2 rounded-full bg-emerald-500" />{onlineNow} members online</span>
                  <span>{siteVisits.toLocaleString()} community visits</span>
                  <span>Out of this world ✦</span>
                </div>
              </div>

              <section className="rounded-3xl border border-[#34384d] bg-[#1c2030] p-5 shadow-sm sm:p-6">
                <div className="flex flex-wrap items-end justify-between gap-3">
                  <div><p className="text-xs font-bold uppercase tracking-[.18em] text-[#8b5cf6]">Community decides</p><h2 className="mt-1 text-2xl font-black text-white">🗳️ Monthly Anime</h2><p className="mt-1 text-sm text-[#a5abc2]">Vote for the anime that should represent Anime Zone this month.</p></div>
                  <span className="rounded-full bg-[#f3efff] px-3 py-1.5 text-xs font-bold text-[#7954c7]">{getSouthAfricaMonthKey()}</span>
                </div>
                <div className="mt-5 grid gap-2 sm:grid-cols-2">
                  {monthlyVotes.map((item, index) => <button key={item.anime_name} type="button" disabled={monthlyVoteLoading} onClick={() => void castMonthlyAnimeVote(item.anime_name)} className={`rounded-2xl border p-4 text-left transition hover:border-[#bda6ed] disabled:cursor-not-allowed disabled:opacity-60 ${item.my_vote ? "border-[#9b7be1] bg-[#f5f0ff]" : "border-[#eeeaf4] bg-[#1c2030] hover:bg-[#fbf9ff]"}`}><div className="flex items-center justify-between gap-2"><span className="font-bold text-white">{index + 1}. {item.anime_name}</span><span className="rounded-full bg-[#f0eaff] px-2.5 py-1 text-xs font-bold text-[#7954c7]">{item.votes}</span></div><div className="mt-3 h-1.5 overflow-hidden rounded-full bg-[#f0edf5]"><div className="h-full rounded-full bg-[#8b5cf6]" style={{width: `${Math.max(0, ...monthlyVotes.map(v => v.votes)) ? item.votes / Math.max(1, ...monthlyVotes.map(v => v.votes)) * 100 : 0}%`}} /></div><p className="mt-2 text-xs font-semibold text-[#8055d6]">{item.my_vote ? "✓ Your vote" : "Vote for this anime"}</p></button>)}
                </div>
                {monthlyVotes.length === 0 && !monthlyVoteLoading && <p className="mt-4 text-sm text-[#a5abc2]">Monthly voting options are loading or not available yet.</p>}
                {monthlyVoteLoading && <p className="mt-3 text-xs text-[#a5abc2]">Updating votes…</p>}
                {monthlyVoteError && <p role="alert" className="mt-3 rounded-xl bg-red-50 p-3 text-sm text-red-600">{monthlyVoteError}</p>}
                <p className="mt-4 text-xs text-[#9993a5]">Voting resets each calendar month. You can change your vote before the month ends.</p>
              </section>

              <section className="rounded-3xl border border-[#34384d] bg-[#1c2030] p-5 shadow-sm sm:p-6">
                <div className="flex items-center justify-between gap-3"><div><p className="text-xs font-bold uppercase tracking-[.18em] text-[#8b5cf6]">Community ideas</p><h2 className="mt-1 text-xl font-black text-white">Help shape Anime Zone</h2></div><button type="button" onClick={() => void loadSuggestions()} disabled={suggestionsLoading} className="rounded-full px-3 py-2 text-xs font-bold text-[#8055d6] hover:bg-[#f5f0ff]">{suggestionsLoading ? "Loading…" : "Refresh"}</button></div>
                <div className="mt-4 rounded-2xl bg-[#faf8fd] p-3"><textarea value={suggestionText} onChange={(event) => {setSuggestionText(event.target.value);setSuggestionError("");}} maxLength={300} rows={2} placeholder="Suggest a feature or improvement…" className="w-full resize-y bg-transparent px-2 py-1 text-sm text-white outline-none placeholder:text-[#aaa4b2]"/><div className="flex items-center justify-between"><span className="text-xs text-[#9993a5]">{suggestionText.length}/300</span><button type="button" onClick={() => void postSuggestion()} disabled={postingSuggestion || !suggestionText.trim()} className="rounded-full bg-[#8055d6] px-4 py-2 text-xs font-bold text-white disabled:opacity-50">{postingSuggestion ? "Sending…" : "Share idea"}</button></div></div>
                {suggestionError && <p role="alert" className="mt-3 text-sm text-red-600">{suggestionError}</p>}
                <div className="mt-4 divide-y divide-[#f0edf5]">{suggestions.slice(0,5).map((item) => <article key={item.id} className="py-4 first:pt-1"><div className="flex items-center justify-between gap-3"><div className="flex min-w-0 items-center gap-2"><button type="button" onClick={() => void openMemberProfile(item.user_id, item.username)} aria-label={`View @${item.username}'s profile`} className="h-9 w-9 shrink-0 overflow-hidden rounded-full bg-[#eeeaff] ring-1 ring-[#ddd4f5]">{item.avatar_url ? <img src={item.avatar_url} alt="" className="h-full w-full object-cover" /> : <span className="flex h-full w-full items-center justify-center text-sm font-black text-[#7561c8]">{item.username.charAt(0).toUpperCase()}</span>}</button><button type="button" onClick={() => void openMemberProfile(item.user_id, item.username)} className="truncate text-sm font-bold text-white hover:text-[#8055d6]">@{item.username}</button></div><time className="shrink-0 text-xs text-[#9993a5]">{new Date(item.created_at).toLocaleDateString()}</time></div><p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-[#5f596c]">{item.content}</p><div className="mt-3 flex gap-3 text-xs"><button type="button" onClick={() => void voteOnSuggestion(item.id, 1)} className={`font-bold ${item.myVote === 1 ? "text-[#8055d6]" : "text-[#8e879b]"}`}>👍 {item.likes}</button><button type="button" onClick={() => void voteOnSuggestion(item.id, -1)} className={`font-bold ${item.myVote === -1 ? "text-rose-600" : "text-[#8e879b]"}`}>👎 {item.dislikes}</button>{isAdmin && <button type="button" onClick={() => void deleteSuggestion(item.id)} disabled={deletingSuggestionId === item.id} className="ml-auto font-bold text-rose-600">Delete</button>}</div></article>)}{suggestions.length === 0 && <p className="py-6 text-center text-sm text-[#9993a5]">No community ideas yet. Start one.</p>}</div>
              </section>
            </section>

            <aside className="space-y-5 lg:sticky lg:top-5 lg:self-start">
              <section className="rounded-3xl border border-[#34384d] bg-[#1c2030] p-5 shadow-sm"><h2 className="font-black text-white">Your space</h2><div className="mt-4 space-y-1"><button type="button" onClick={() => setTab("global")} className="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left text-sm font-semibold text-[#5f596c] hover:bg-[#f7f3ff]"><span className="text-lg">🌐</span> Global Chat <span className="ml-auto text-[#8055d6]">→</span></button><button type="button" onClick={() => setTab("chat")} className="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left text-sm font-semibold text-[#5f596c] hover:bg-[#f7f3ff]"><span className="text-lg">👥</span> Friends & messages <span className="ml-auto text-[#8055d6]">→</span></button><button type="button" onClick={() => setFriendSearchOpen(true)} className="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left text-sm font-semibold text-[#5f596c] hover:bg-[#f7f3ff]"><span className="text-lg">＋</span> Find people <span className="ml-auto text-[#8055d6]">→</span></button></div></section>
              <section className="rounded-3xl border border-[#34384d] bg-[#1c2030] p-5 shadow-sm"><h2 className="font-black text-white">Community status</h2><p className="mt-3 text-sm text-[#a5abc2]"><span className="mr-2 inline-block h-2 w-2 rounded-full bg-emerald-500" />{onlineNow} online now</p><p className="mt-2 text-sm text-[#a5abc2]">{friends.length} friends connected</p></section>
            </aside>
          </div>
        ) : tab === "chat" ? (
          <section className="fixed inset-x-0 bottom-[76px] top-0 z-40 flex min-h-0 flex-col overflow-hidden bg-[#10121b] md:static md:mx-auto md:mb-6 md:h-[calc(100dvh-90px)] md:max-w-none md:rounded-3xl md:border md:border-[#34384d] md:shadow-2xl">
            <div className="flex shrink-0 flex-wrap items-center justify-between gap-4 border-b border-[#303449] bg-[#171a27] p-4 md:rounded-t-3xl">
              <div className="flex items-center gap-3">
                <img src="/az-logo.png" alt="Anime Zone" className="h-11 w-11 rounded-xl object-cover shadow-md" />
                <div><h1 className="text-2xl font-black text-white">Anime Zone</h1><p className="text-xs text-[#a5abc2]">Friends & private messages</p></div>
              </div>
              <div className="flex items-center gap-2">
                <button type="button" onClick={() => setChatSection("requests")} aria-label="Friend requests" title="Friend requests" className="relative flex h-11 w-11 items-center justify-center rounded-xl border border-[#414760] bg-[#252a3d] text-xl text-white">♧{incomingRequests.length > 0 && <span className="absolute -right-2 -top-2 rounded-full bg-blue-600 px-1.5 py-0.5 text-[10px] font-black text-white">{incomingRequests.length}+</span>}</button>
                <button type="button" onClick={() => { setFriendSearchOpen(true); setFriendSearchTerm(""); setFriendSearchResults([]); setFriendError(""); }} aria-label="Search friends" title="Search friends" className="flex h-11 w-11 items-center justify-center rounded-xl border border-[#414760] bg-[#252a3d] text-xl text-white">⌕</button>
              </div>
            </div>

            <div className="grid min-h-0 flex-1 gap-3 overflow-hidden p-2 sm:p-3 lg:grid-cols-[minmax(280px,360px)_1fr]">
              <aside className={`${selectedChatFriendId ? "hidden lg:block" : "block"} overflow-hidden rounded-[1.8rem] border border-[#34384d] bg-[#171a27] shadow-lg`}>
                <div className="border-b border-[#ebe8ff] p-5">
                  <div className="flex items-center justify-between">
                    <h2 className="text-xl font-black">People</h2>
                    <button type="button" onClick={() => void loadFriendData()} disabled={friendsLoading} className="rounded-lg px-3 py-2 text-sm font-bold text-[#7561c8] hover:bg-[#f1f0ff]">{friendsLoading ? "…" : "↻"}</button>
                  </div>
                  <div className="mt-4 grid grid-cols-2 rounded-xl bg-[#f1f0ff] p-1">
                    <button type="button" onClick={() => setChatSection("friends")} className={`rounded-lg px-3 py-3 text-sm font-black transition ${chatSection === "friends" ? "bg-white text-[#6555a5] shadow-sm" : "text-[#85809d]"}`}>Friends <span className="ml-1 text-xs">{friends.length}</span></button>
                    <button type="button" onClick={() => setChatSection("requests")} className={`relative rounded-lg px-3 py-3 text-sm font-black transition ${chatSection === "requests" ? "bg-white text-[#6555a5] shadow-sm" : "text-[#85809d]"}`}>Requests {incomingRequests.length > 0 && <span className="ml-1 rounded-full bg-blue-600 px-2 py-0.5 text-[10px] text-white">{incomingRequests.length}+</span>}</button>
                  </div>
                </div>

                <div className="max-h-[580px] space-y-1 overflow-y-auto p-3">
                  {chatSection === "friends" ? (
                    friendsLoading && friends.length === 0 ? <p className="p-5 text-sm text-[#85809d]">Loading friends…</p> :
                    friends.length === 0 ? <div className="p-7 text-center"><p className="text-3xl">👥</p><p className="mt-3 font-bold">No friends yet</p><p className="mt-2 text-sm leading-6 text-[#85809d]">Add people from Anime Zone to start chatting.</p><button type="button" onClick={() => setFriendSearchOpen(true)} className="mt-4 rounded-xl bg-[#8b5cf6] px-4 py-2 text-sm font-bold text-white">Find friends</button></div> :
                    friends.map((friend) => {
                      const online = Boolean(friend.last_seen_at && Date.now() - new Date(friend.last_seen_at).getTime() < 90000);
                      return <button type="button" key={friend.user_id} onClick={() => openDirectMessage(friend.user_id)} className={`flex w-full items-center gap-3 rounded-2xl p-3 text-left transition hover:bg-[#f4f2ff] ${selectedChatFriendId === friend.user_id ? "bg-[#eeeaff]" : ""}`}>
                        <span className="relative h-12 w-12 shrink-0 overflow-hidden rounded-full bg-[#e9e7ff]">
                          {friend.avatar_url ? <img src={friend.avatar_url} alt="" className="h-full w-full object-cover" /> : <span className="flex h-full w-full items-center justify-center font-black text-[#7561c8]">{friend.display_name?.charAt(0) || "?"}</span>}
                          <span className={`absolute bottom-0 right-0 h-3.5 w-3.5 rounded-full border-2 border-white ${online ? "bg-emerald-500" : "bg-red-500"}`} />
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className={`block truncate font-black ${online ? "text-emerald-600" : "text-red-600"}`}>{friend.display_name || friend.username}</span>
                          <span className="mt-1 block truncate text-xs text-[#85809d]">{online ? "Online" : friend.last_seen_at ? `Last seen ${new Date(friend.last_seen_at).toLocaleString()}` : "Offline"}</span>
                        </span>
                        {friend.user_id === selectedChatFriendId && <span className="text-xs font-bold text-[#8b5cf6]">Open</span>}
                      </button>;
                    })
                  ) : (
                    incomingRequests.length === 0 ? <p className="p-7 text-center text-sm text-[#85809d]">No pending friend requests.</p> :
                    incomingRequests.map((request) => <div key={request.id} className="flex items-center gap-3 rounded-2xl p-3 hover:bg-[#f8f7ff]">
                      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[#e9e7ff] text-lg">👤</span>
                      <span className="min-w-0 flex-1"><span className="block font-bold">Anime Zone member</span><span className="text-xs text-[#85809d]">Wants to be your friend</span></span>
                      <button type="button" title="Accept request" onClick={() => void respondToFriendRequest(request.id, "accepted")} disabled={friendActionLoading === request.id} className="flex h-9 w-9 items-center justify-center rounded-full bg-emerald-100 font-black text-emerald-700 hover:bg-emerald-200">✓</button>
                      <button type="button" title="Decline request" onClick={() => void respondToFriendRequest(request.id, "declined")} disabled={friendActionLoading === request.id} className="flex h-9 w-9 items-center justify-center rounded-full bg-rose-100 font-black text-rose-700 hover:bg-rose-200">✕</button>
                    </div>)
                  )}
                </div>
              </aside>

              <section className={`${selectedChatFriendId ? "flex" : "hidden lg:flex"} min-h-[min(680px,calc(100dvh-190px))] min-w-0 flex-col overflow-hidden rounded-[1.8rem] border border-[#34384d] bg-[#171a27] shadow-lg`}>
                {selectedChatFriend ? <>
                  <header className="flex items-center gap-3 border-b border-[#303449] px-3 py-4 sm:px-7"><button type="button" onClick={() => setSelectedChatFriendId("")} className="rounded-lg bg-[#252a3d] px-3 py-2 text-sm font-bold text-white lg:hidden">← Back</button>
                    <span className="relative h-11 w-11 shrink-0 overflow-hidden rounded-full bg-[#e9e7ff]">
                      {selectedChatFriend.avatar_url ? <img src={selectedChatFriend.avatar_url} alt="" className="h-full w-full object-cover" /> : <span className="flex h-full w-full items-center justify-center font-black text-[#7561c8]">{selectedChatFriend.display_name?.charAt(0) || "?"}</span>}
                      <span className={`absolute bottom-0 right-0 h-3 w-3 rounded-full border-2 border-white ${selectedChatFriend.last_seen_at && Date.now() - new Date(selectedChatFriend.last_seen_at).getTime() < 90000 ? "bg-emerald-500" : "bg-red-500"}`} />
                    </span>
                    <div className="min-w-0"><h2 className="truncate font-black">{selectedChatFriend.display_name || selectedChatFriend.username}</h2><p className="text-xs text-[#85809d]">{selectedChatFriend.last_seen_at && Date.now() - new Date(selectedChatFriend.last_seen_at).getTime() < 90000 ? "Online" : "Last seen " + (selectedChatFriend.last_seen_at ? new Date(selectedChatFriend.last_seen_at).toLocaleString() : "unknown")}</p></div>
                    <span className="ml-auto rounded-full bg-[#f1f0ff] px-3 py-1 text-xs font-bold text-[#7561c8]">Anime Zone DM</span>
                  </header>
                  <div ref={chatScrollRef} className="flex-1 space-y-4 overflow-y-auto bg-[#10121b] p-4 text-white sm:p-8">
                    <div className="mx-auto mb-8 max-w-sm text-center"><img src="/az-logo.png" alt="Anime Zone" className="mx-auto h-14 w-14 rounded-2xl object-cover" /><p className="mt-3 font-black">Anime Zone</p><p className="mt-1 text-xs text-[#85809d]">This is the beginning of your conversation with {selectedChatFriend.display_name || selectedChatFriend.username}.</p></div>
                    {chatLoading && chatMessages.length === 0 ? <p className="text-center text-sm text-[#85809d]">Loading messages…</p> : chatMessages.map((message) => {
                      const mine = message.sender_id !== selectedChatFriend.user_id;
                      return <div key={message.id} className={`flex ${mine ? "justify-end" : "justify-start"}`}><div className={`max-w-[82%] rounded-3xl px-4 py-3 shadow-sm sm:max-w-[70%] ${mine ? "rounded-br-md bg-[#7954d8] text-white" : "rounded-bl-md bg-[#f0efff] text-[#30284e]"}`}><>{getStickerUrl(message.content) ? <img src={getStickerUrl(message.content) || ""} alt="Sticker" className="max-h-48 max-w-full rounded-xl object-contain" /> : <p className="whitespace-pre-wrap break-words text-sm leading-6">{message.content}</p>}</><p className={`mt-1 text-right text-[10px] ${mine ? "text-white/70" : "text-[#85809d]"}`}>{new Date(message.created_at).toLocaleTimeString([], {hour:"2-digit",minute:"2-digit"})}</p></div></div>;
                    })}
                  </div>
                  {chatError && <p role="alert" className="px-5 py-2 text-sm text-red-600">{chatError}</p>}
                  <form onSubmit={sendChatMessage} className="flex items-center gap-2 border-t border-[#303449] bg-[#171a27] p-3 sm:gap-3 sm:p-5">
                    <button type="button" title="Open sticker picker" onClick={() => setStickerPickerTarget((target) => target === "dm" ? null : "dm")} className="rounded-full border border-[#ddd7ff] bg-[#f8f7ff] px-3 py-3 text-xl">☻</button><input value={chatDraft} onChange={(event) => setChatDraft(event.target.value)} maxLength={2000} placeholder="Message…" className="min-w-0 flex-1 rounded-full border border-[#414760] bg-[#22263a] px-5 py-4 text-sm text-white outline-none placeholder:text-[#85809d] focus:border-[#9b83ef]" />
                    <button type="submit" disabled={!chatDraft.trim() || chatSending} className="rounded-full bg-[#8b5cf6] px-6 py-4 text-sm font-black text-white transition hover:bg-[#7c3aed] disabled:opacity-50">{chatSending ? "Sending…" : "Send"}</button>
                  </form>
                </> : <div className="flex flex-1 flex-col items-center justify-center px-6 py-12 text-center"><img src="/az-logo.png" alt="Anime Zone Chat" className="h-20 w-20 rounded-3xl object-cover shadow-md" /><h2 className="mt-5 text-2xl font-black">Your Anime Zone chats</h2><p className="mt-2 max-w-sm text-sm leading-7 text-[#85809d]">Choose a friend from the list to open your private conversation. Your messages will appear here.</p></div>}
              </section>
            </div>
            {friendError && <p role="alert" className="rounded-xl bg-red-500/10 px-4 py-3 text-sm text-red-600">{friendError}</p>}
          </section>
        ) : tab === "global" ? (
          <section className="fixed inset-x-0 bottom-[76px] top-0 z-40 flex min-h-0 flex-col bg-[#10121b] md:static md:mx-auto md:mb-6 md:h-[calc(100dvh-90px)] md:max-w-none md:rounded-3xl md:border md:border-[#34384d] md:shadow-2xl">
            <header className="flex shrink-0 items-center gap-3 border-b border-[#303449] bg-[#171a27] px-4 py-3 sm:px-6 sm:py-4 md:rounded-t-3xl">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#f1eaff] text-xl">🌐</div>
              <div className="min-w-0"><h1 className="font-black text-white">Global Chat</h1><p className="text-xs text-[#a2a8c0]">Anime Zone community · Saved messages</p></div>
              <button type="button" onClick={() => setThemeMenuOpen((open) => !open)} className="ml-auto rounded-full border border-[#414760] bg-[#252a3d] px-3 py-2 text-sm text-white" aria-label="Choose theme">🎨</button>
              <span className="rounded-full bg-emerald-500/15 px-3 py-1 text-[11px] font-bold text-emerald-300">● LIVE</span>{unreadMentionCount > 0 && <button type="button" onClick={() => void markMentionNotificationsRead()} className="rounded-full bg-rose-500 px-2.5 py-1 text-[11px] font-black text-white">🔔 {unreadMentionCount}</button>}
              <button type="button" onClick={() => void loadGlobalMessages()} aria-label="Refresh chat" className="rounded-full px-3 py-2 text-sm font-bold text-[#8055d6] hover:bg-[#f7f3ff]">↻</button>
            </header>
            <div ref={globalScrollRef} className="min-h-0 flex-1 space-y-5 overflow-y-auto overscroll-contain bg-[#10121b] px-3 py-5 sm:px-6 md:px-8">
              <div className="mx-auto mb-5 max-w-md text-center"><p className="text-xs font-bold uppercase tracking-[.16em] text-[#9a8ab5]">Welcome to the conversation</p><p className="mt-1 text-xs text-[#aaa3b3]">Be respectful. Keep it anime-friendly.</p></div>
              {globalMentionNotice && <button type="button" onClick={() => void markMentionNotificationsRead()} className="sticky top-0 z-10 mx-auto block rounded-full border border-violet-400/30 bg-violet-500/20 px-4 py-2 text-xs font-bold text-violet-100 shadow-lg">🔔 {globalMentionNotice} · Tap to dismiss</button>}
              {globalLoading && globalMessages.length === 0 ? <p className="py-12 text-center text-sm text-[#85809d]">Loading messages…</p> : globalMessages.length === 0 ? <div className="py-16 text-center"><p className="text-4xl">💬</p><p className="mt-3 font-bold text-white">It's quiet in here</p><p className="mt-1 text-sm text-[#9993a5]">Start the first conversation.</p></div> : globalMessages.map((message) => {
                const mine = message.user_id === profile?.user_id;
                return <div key={message.id} onTouchStart={(event) => { const touch = event.touches[0]; globalTouchStart.current = { x: touch.clientX, y: touch.clientY }; }} onTouchEnd={(event) => { const start = globalTouchStart.current; if (!start) return; const touch = event.changedTouches[0]; const dx = touch.clientX - start.x; const dy = touch.clientY - start.y; if (Math.abs(dx) > 65 && Math.abs(dy) < 45) beginGlobalReply(message); globalTouchStart.current = null; }} className={`group flex w-full items-end gap-2 ${mine ? "justify-end" : "justify-start"}`}>
                  <div className={`flex shrink-0 flex-col gap-1 ${mine ? "order-2" : ""}`}><button type="button" onClick={() => setSelectedGlobalMember(message)} aria-label={`View ${message.username}'s profile`} className="h-9 w-9 overflow-hidden rounded-full border border-[#414760] bg-[#252a3d]">{message.avatar_url ? <img src={message.avatar_url} alt="" className="h-full w-full object-cover" /> : <span className="flex h-full w-full items-center justify-center text-sm text-white">{(message.display_name || message.username).charAt(0).toUpperCase()}</span>}</button>{message.avatar_url && <button type="button" onClick={() => setAvatarZoomUrl(message.avatar_url || null)} aria-label="Zoom profile picture" className="text-[9px] font-bold text-[#aeb7d5]">Zoom</button>}</div>
                  <div className={`w-fit max-w-[88%] sm:max-w-[72%] ${mine ? "items-end" : "items-start"}`}>
                    <button type="button" onClick={() => setSelectedGlobalMember(message)} className={`mb-1 px-2 text-sm font-bold ${mine ? "block text-right text-[#b6a7ff]" : "text-[#aeb7d5]"}`}>{mine ? "You" : message.display_name || <AdminName value={message.username} />} <span className="text-xs font-medium text-[#737c9a]">@<AdminName value={message.username} /></span></button>
                    <div className={`rounded-2xl px-4 py-3 shadow-sm ${mine ? "rounded-br-md bg-[#6554b8] text-white" : "rounded-bl-md border border-[#34394f] bg-[#202437] text-white"}`}>
                      {message.reply_to && <div className="mb-2 rounded-lg border-l-2 border-violet-300/70 bg-black/15 px-3 py-2 text-xs text-white/75"><span className="font-bold">Replying to @{message.reply_username || "member"}</span><p className="mt-1 line-clamp-2">{message.reply_preview || "Original message unavailable"}</p></div>}
                      {getStickerUrl(message.content) ? <img src={getStickerUrl(message.content) || ""} alt="Sticker" className="max-h-52 max-w-full rounded-xl object-contain" /> : <p className="whitespace-pre-wrap break-words text-base leading-7">{message.content.split(/(@[a-zA-Z0-9_]+)/g).map((part, index) => part.startsWith("@") ? <span key={index} className="font-black text-[#d7c8ff]">{part}</span> : part)}</p>}
                    </div>
                    <div className={`mt-1 flex items-center gap-3 px-2 text-[10px] text-[#7e87a4] ${mine ? "justify-end" : ""}`}><span>{new Date(message.created_at).toLocaleTimeString([], {hour:"2-digit",minute:"2-digit"})}</span><button type="button" onClick={() => beginGlobalReply(message)} className="font-bold text-[#b6a7ff] opacity-100 sm:opacity-0 sm:group-hover:opacity-100">↩ Reply</button></div>
                  </div>
                </div>;
              })}
            </div>
            {globalError && <p role="alert" className="shrink-0 bg-red-50 px-4 py-2 text-xs text-red-600">{globalError}</p>}
            <div className="relative shrink-0 border-t border-[#303449] bg-[#171a27] px-3 pt-3 pb-[max(12px,env(safe-area-inset-bottom))] sm:px-5 md:rounded-b-3xl">
              {globalReplyTo && <div className="mb-2 flex items-center gap-3 rounded-xl border-l-2 border-violet-400 bg-[#22263a] px-3 py-2"><div className="min-w-0 flex-1"><p className="text-[11px] font-black text-violet-200">Replying to @{globalReplyTo.username}</p><p className="truncate text-xs text-[#aeb7d5]">{globalReplyTo.content}</p></div><button type="button" onClick={() => setGlobalReplyTo(null)} className="rounded-lg px-2 py-1 text-sm text-[#c9cde0]" aria-label="Cancel reply">✕</button></div>}
              {mentionSuggestions.length > 0 && <div className="mb-2 max-h-48 overflow-y-auto rounded-xl border border-[#414760] bg-[#22263a] p-2 shadow-xl">{mentionSuggestions.map((person) => <button type="button" key={person.user_id} onClick={() => chooseGlobalMention(person)} className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm text-white hover:bg-[#343953]"><span className="flex h-7 w-7 items-center justify-center rounded-full bg-[#51427f]">{person.username.charAt(0).toUpperCase()}</span><span className="font-bold">@{person.username}</span><span className="ml-auto text-xs text-[#9ba2bc]">{person.display_name}</span></button>)}</div>}
              {mentionSearchLoading && <p className="mb-1 px-2 text-[10px] text-[#9ba2bc]">Finding members…</p>}
              <form onSubmit={sendGlobalMessage} className="flex items-end gap-2"><button type="button" title="Open sticker picker" onClick={() => setStickerPickerTarget((target) => target === "global" ? null : "global")} className="h-12 shrink-0 rounded-2xl border border-[#414760] bg-[#22263a] px-3 text-xl text-white">☻</button><textarea value={globalDraft} onChange={(event) => setGlobalDraft(event.target.value)} maxLength={1000} rows={1} placeholder="Message everyone… use @ to mention" className="max-h-28 min-h-12 min-w-0 flex-1 resize-y rounded-2xl border border-[#414760] bg-[#22263a] px-4 py-3 text-base text-white outline-none placeholder:text-[#8c94b0] focus:border-[#9d8cf0]"/><button type="submit" disabled={!globalDraft.trim() || globalSending} className="flex h-12 shrink-0 items-center justify-center rounded-2xl bg-[#8055d6] px-5 text-sm font-bold text-white transition hover:bg-[#7045c5] disabled:opacity-50">{globalSending ? "…" : "Send"}</button></form>
            </div>
          </section>
        ) : tab === "watch" ? (
          <section className="fixed inset-x-0 bottom-[76px] top-0 z-40 flex min-h-0 flex-col bg-[#10121b] md:static md:mx-auto md:mb-6 md:h-[calc(100dvh-90px)] md:max-w-none md:rounded-3xl md:border md:border-[#34384d] md:shadow-2xl">
            <header className="flex shrink-0 items-center gap-3 border-b border-[#303449] bg-[#171a27] px-4 py-3 sm:px-6 sm:py-4 md:rounded-t-3xl">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#29243d] text-xl">🎬</div>
              <div className="min-w-0"><h1 className="font-black text-white">Watch</h1><p className="text-xs text-[#a2a8c0]">Watch together · Anime Zone</p></div>
              <button type="button" onClick={() => setThemeMenuOpen((open) => !open)} className="ml-auto rounded-full border border-[#414760] bg-[#252a3d] px-3 py-2 text-sm text-white" aria-label="Choose theme">🎨</button>
              <button type="button" onClick={() => { void loadWatchVideo(); void loadWatchMessages(); }} className="rounded-full px-3 py-2 text-sm font-bold text-[#b9a8ff] hover:bg-[#292e43]" aria-label="Refresh Watch">↻</button>
            </header>
            <div className="grid min-h-0 flex-1 grid-cols-1 gap-0 overflow-hidden lg:grid-cols-2">
              <section className="flex min-h-[42dvh] min-w-0 flex-col border-b border-[#303449] bg-black lg:min-h-0 lg:border-b-0 lg:border-r">
                <div className="flex shrink-0 items-center justify-between gap-3 border-b border-[#303449] bg-[#171a27] px-4 py-2.5">
                  <h2 className="text-sm font-black text-white">Now playing</h2>
                  <span className="rounded-full bg-emerald-500/15 px-3 py-1 text-[10px] font-black text-emerald-300">SHARED PLAYER</span>
                </div>
                <div className="relative min-h-0 flex-1 bg-black">
                  <LiveKitBroadcastPanel isAdmin={isAdmin} fallback={watchVideoLoading ? <div className="flex h-full min-h-48 items-center justify-center text-sm text-[#a5abc2]">Loading shared video…</div> : !watchVideoUrl ? <div className="flex h-full min-h-48 flex-col items-center justify-center px-6 text-center text-[#a5abc2]"><span className="text-5xl">🍿</span><p className="mt-4 font-bold text-white">Nothing is playing yet</p><p className="mt-1 text-sm">An admin can add a shared video or start a live screen share.</p></div> : (() => { const embed = getWatchEmbed(watchVideoUrl); if (embed.type === "video") return <video key={embed.src} src={embed.src} controls playsInline className="h-full w-full object-contain" />; if (embed.type === "invalid") return <div className="flex h-full items-center justify-center px-6 text-center text-sm text-rose-300">This video URL is not supported. Ask an admin to update it.</div>; return <iframe key={embed.src} src={embed.src} title="Anime Zone shared video" className="h-full w-full border-0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" allowFullScreen />; })()} />
                </div>
                {watchVideoError && <p role="alert" className="shrink-0 bg-rose-500/10 px-4 py-2 text-xs text-rose-200">{watchVideoError}</p>}
                {isAdmin && <div className="shrink-0 space-y-2 border-t border-[#303449] bg-[#171a27] p-3 sm:p-4"><label htmlFor="watch-video-url" className="block text-xs font-black uppercase tracking-wide text-[#c4c9dc]">Admin · Change shared video URL</label><div className="flex flex-col gap-2 sm:flex-row"><input id="watch-video-url" value={watchVideoDraft} onChange={(event) => setWatchVideoDraft(event.target.value)} placeholder="Paste YouTube, Vimeo, TikTok, Instagram or MP4 URL" className="min-w-0 flex-1 rounded-xl border border-[#414760] bg-[#22263a] px-4 py-3 text-sm text-white outline-none placeholder:text-[#8c94b0] focus:border-[#9d8cf0]"/><button type="button" onClick={() => void saveWatchVideo()} disabled={watchVideoSaving} className="rounded-xl bg-[#8055d6] px-5 py-3 text-sm font-black text-white disabled:opacity-50">{watchVideoSaving ? "Saving…" : "Update video"}</button></div><p className="text-[11px] leading-4 text-[#929ab8]">Changes sync to everyone through Supabase Realtime (with periodic refresh as backup).</p><p className="text-[11px] text-emerald-200">Use Start screen share above to broadcast your screen live. The shared URL remains available as a fallback.</p></div>}
              </section>
              <section className="flex min-h-0 min-w-0 flex-col bg-[#10121b]">
                <header className="flex shrink-0 items-center justify-between border-b border-[#303449] bg-[#171a27] px-4 py-3"><div><h2 className="font-black text-white">💬 Watch Chat</h2><p className="mt-0.5 text-xs text-[#929ab8]">Live messages for everyone</p></div><button type="button" onClick={() => void loadWatchMessages()} disabled={watchMessagesLoading} className="rounded-xl px-3 py-2 text-sm font-bold text-[#b9a8ff] hover:bg-[#292e43]">{watchMessagesLoading ? "…" : "↻"}</button></header>
                <div ref={watchScrollRef} className="min-h-0 flex-1 space-y-4 overflow-y-auto overscroll-contain px-4 py-5 sm:px-6">{watchMessagesLoading && watchMessages.length === 0 ? <p className="py-12 text-center text-sm text-[#929ab8]">Loading Watch chat…</p> : watchMessages.length === 0 ? <p className="py-12 text-center text-sm text-[#929ab8]">No messages yet. Start the conversation.</p> : watchMessages.map((message) => <div key={message.id} className="flex items-start gap-3"><div className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-full bg-[#30364c] text-sm font-black text-white">{message.avatar_url ? <img src={message.avatar_url} alt="" className="h-full w-full object-cover"/> : message.display_name.charAt(0).toUpperCase()}</div><div className="min-w-0 flex-1"><div className="flex flex-wrap items-baseline gap-x-2 gap-y-1"><span className="text-sm font-bold text-[#c7baff]"><AdminName value={message.username}/></span><time className="text-[10px] text-[#737c9a]">{new Date(message.created_at).toLocaleTimeString([], {hour:"2-digit", minute:"2-digit"})}</time></div>{getStickerUrl(message.content) ? <img src={getStickerUrl(message.content) || ""} alt="Sticker" className="mt-1 max-h-48 max-w-full rounded-xl object-contain"/> : <p className="mt-1 whitespace-pre-wrap break-words text-sm leading-6 text-white">{message.content}</p>}</div></div>)}</div>
                {watchChatError && <p role="alert" className="shrink-0 border-t border-[#303449] bg-rose-500/10 px-4 py-2 text-xs text-rose-200">{watchChatError}</p>}
                <form onSubmit={sendWatchMessage} className="flex shrink-0 items-end gap-2 border-t border-[#303449] bg-[#171a27] p-3 sm:p-4"><button type="button" title="Open sticker picker" onClick={() => setStickerPickerTarget((target) => target === "watch" ? null : "watch")} className="h-12 shrink-0 rounded-2xl border border-[#414760] bg-[#22263a] px-3 text-xl text-white">☻</button><textarea value={watchDraft} onChange={(event) => setWatchDraft(event.target.value)} maxLength={1000} rows={1} placeholder="Chat about what you're watching…" className="max-h-28 min-h-12 min-w-0 flex-1 resize-y rounded-2xl border border-[#414760] bg-[#22263a] px-4 py-3 text-sm text-white outline-none placeholder:text-[#8c94b0] focus:border-[#9d8cf0]"/><button type="submit" disabled={!watchDraft.trim() || watchSending} className="h-12 shrink-0 rounded-2xl bg-[#8055d6] px-5 text-sm font-bold text-white disabled:opacity-50">{watchSending ? "…" : "Send"}</button></form>
              </section>
            </div>
          </section>
        ) : null}
      </div>

      {stickerPickerTarget && <StickerPicker onClose={() => setStickerPickerTarget(null)} onSelect={(url) => void sendAnimeZoneSticker(url, stickerPickerTarget)} />}

      {themeMenuOpen && (tab === "global" || tab === "watch") && <div className="fixed right-3 top-16 z-[95] max-h-[78dvh] w-[min(19rem,calc(100vw-1.5rem))] overflow-y-auto rounded-2xl border border-[#414760] bg-[#1b1f2e] p-3 text-white shadow-2xl">
        <div className="flex items-center justify-between px-2 pb-2"><p className="text-xs font-black uppercase tracking-wider text-[#aeb7d5]">Choose your theme</p><button type="button" onClick={() => setThemeMenuOpen(false)} className="rounded-lg px-2 py-1 text-white/70">✕</button></div>
        {ANIME_THEMES.map((item) => <button key={item.id} type="button" onClick={() => void savePersonalTheme(item.id)} disabled={themeSaving} className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm hover:bg-[#30364c] ${theme === item.id ? "bg-[#30364c]" : ""}`}><span>{item.emoji}</span><span className="flex-1">{item.label}</span>{theme === item.id && <span>✓</span>}</button>)}
        <button type="button" onClick={() => void followCommunityTheme()} disabled={themeSaving} className="mt-2 w-full rounded-xl border border-[#414760] px-3 py-2 text-left text-xs font-bold text-[#cbd5e1] hover:bg-[#30364c]">↩ Use community default</button>
        {isAdmin && <><div className="my-2 border-t border-[#414760]"/><p className="px-2 pb-2 text-xs font-black uppercase tracking-wider text-amber-300">Admin · Everyone's default</p>{ANIME_THEMES.map((item) => <button key={`community-${item.id}`} type="button" onClick={() => void saveGlobalTheme(item.id)} disabled={themeSaving} className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm hover:bg-[#30364c] ${globalTheme === item.id ? "bg-[#30364c]" : ""}`}><span>{item.emoji}</span><span className="flex-1">{item.label}</span>{globalTheme === item.id && <span>✓</span>}</button>)}</>}
        {themeMessage && <p className="mt-2 rounded-lg bg-black/20 p-2 text-[11px] text-[#cbd5e1]">{themeMessage}</p>}
        <p className="mt-2 text-[10px] leading-4 text-[#929ab8]">Your personal selection overrides the community default.</p>
      </div>}

      {tab === "leaderboard" && (
        <section className="relative z-10 mx-auto max-w-5xl space-y-5 px-5 py-8 sm:px-8">
          <div className="space-y-3">
            {[
              { label: "EXP", detail: "Experience rankings", icon: "✦" },
              { label: "TIME", detail: "Time spent in Anime Zone", icon: "◷" },
              { label: "GIFTS", detail: "Community gifts and rewards", icon: "🎁" },
            ].map((item) => <div key={item.label} className="flex min-h-20 items-center gap-4 rounded-2xl border border-[#34394f] bg-[#1c2030] px-5 py-4 shadow-lg"><span className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#292e43] text-xl text-[#9ba8ff]">{item.icon}</span><div><p className="text-sm font-black tracking-[.2em] text-white">{item.label}</p><p className="mt-1 text-xs text-[#929ab8]">{item.detail}</p></div><span className="ml-auto text-xs font-bold text-[#737c9a]">SOON</span></div>)}
          </div>
          <div className="relative overflow-hidden rounded-3xl border border-[#285d88] bg-[#101b2b] px-5 py-16 text-center shadow-[0_0_35px_rgba(28,142,255,0.16)]">
            <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(31,125,210,0.2),transparent_65%)]" />
            <p className="relative text-xs font-black tracking-[.35em] text-[#7fcaff]">ANIME ZONE</p>
            <h1 className="relative mt-4 text-3xl font-black tracking-[.12em] text-[#d8f1ff] [text-shadow:0_0_12px_rgba(56,189,248,.9),0_0_30px_rgba(37,99,235,.65)] sm:text-5xl">UNDER CONSTRUCTION</h1>
            <p className="relative mx-auto mt-4 max-w-lg text-sm leading-6 text-[#9cb8d2]">The leaderboard is being built. EXP, time and gifts will appear here soon.</p>
          </div>
          <div className="flex flex-wrap justify-center gap-3 pt-2 text-sm font-bold">
            <a className="rounded-xl border border-[#34394f] bg-[#1c2030] px-4 py-3 text-[#d8dcf0] hover:bg-[#292e43]" href="https://www.youtube.com/@greenbutton" target="_blank" rel="noreferrer">▶ YouTube</a>
            <a className="rounded-xl border border-[#34394f] bg-[#1c2030] px-4 py-3 text-[#d8dcf0] hover:bg-[#292e43]" href="https://www.instagram.com/ootwtechh/" target="_blank" rel="noreferrer">◎ Instagram</a>
            <a className="rounded-xl border border-[#34394f] bg-[#1c2030] px-4 py-3 text-[#d8dcf0] hover:bg-[#292e43]" href="https://www.tiktok.com/@ootwtech" target="_blank" rel="noreferrer">♪ TikTok</a>
            <a className="rounded-xl border border-[#34394f] bg-[#1c2030] px-4 py-3 text-[#d8dcf0] hover:bg-[#292e43]" href="https://discord.gg/b5f67cE7v" target="_blank" rel="noreferrer">💬 Discord</a>
            <a className="rounded-xl border border-[#34394f] bg-[#1c2030] px-4 py-3 text-[#d8dcf0] hover:bg-[#292e43]" href="mailto:agentcube1101@gmail.com">✉️ Email</a>
          </div>
        </section>
      )}

      {selectedGlobalMember && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/75 px-4 py-6 backdrop-blur-sm" onClick={() => setSelectedGlobalMember(null)}>
          <section role="dialog" aria-modal="true" className="w-full max-w-sm overflow-hidden rounded-3xl border border-[#414760] bg-[#1b1f2e] text-white shadow-2xl" onClick={(event) => event.stopPropagation()}>
            <div className="relative h-28 bg-gradient-to-r from-[#33345d] to-[#17445a]" style={{ backgroundImage: selectedGlobalMember.banner_url ? `url(${selectedGlobalMember.banner_url})` : undefined, backgroundSize: "cover", backgroundPosition: "center" }}>
              <button type="button" onClick={() => setSelectedGlobalMember(null)} className="absolute right-3 top-3 rounded-full bg-black/40 px-3 py-1 text-white">✕</button>
            </div>
            <div className="px-6 pb-6">
              <button type="button" onClick={() => selectedGlobalMember.avatar_url && setAvatarZoomUrl(selectedGlobalMember.avatar_url)} className="relative z-10 -mt-9 flex h-20 w-20 items-center justify-center overflow-hidden rounded-full border-4 border-[#1b1f2e] bg-[#30364c] text-2xl font-black">{selectedGlobalMember.avatar_url ? <img src={selectedGlobalMember.avatar_url} alt="Zoom profile picture" className="h-full w-full object-cover" /> : (selectedGlobalMember.display_name || selectedGlobalMember.username).charAt(0).toUpperCase()}</button>
              <h2 className="mt-3 text-xl font-black">{selectedGlobalMember.display_name || selectedGlobalMember.username}</h2>
              <p className="text-sm text-[#aeb7d5]">@{selectedGlobalMember.username}</p>
              <p className="mt-4 whitespace-pre-wrap text-sm leading-6 text-[#e0e3f0]">{selectedGlobalMember.bio || "No bio added yet."}</p>
              <p className="mt-3 text-xs text-[#929bb8]">{formatLastSeen(selectedGlobalMember.last_seen_at || null)}</p>
              {selectedGlobalMember.user_id !== profile?.user_id && (() => { const alreadyFriend = friends.some((friend) => friend.user_id === selectedGlobalMember.user_id); const requestPending = outgoingRequests.some((request) => request.recipient_id === selectedGlobalMember.user_id && request.status === "pending"); const incomingPending = incomingRequests.some((request) => request.sender_id === selectedGlobalMember.user_id && request.status === "pending"); return alreadyFriend ? <div className="mt-5 w-full rounded-xl border border-emerald-500/40 bg-emerald-500/10 px-4 py-3 text-center text-sm font-black text-emerald-300">✓ Friends</div> : requestPending ? <div className="mt-5 w-full rounded-xl border border-sky-400/40 bg-sky-400/10 px-4 py-3 text-center text-sm font-black text-sky-200">✓ Request Sent</div> : incomingPending ? <button type="button" onClick={() => { const request = incomingRequests.find((item) => item.sender_id === selectedGlobalMember.user_id); if (request) void respondToFriendRequest(request.id, "accepted"); setSelectedGlobalMember(null); }} className="mt-5 w-full rounded-xl bg-emerald-600 px-4 py-3 text-sm font-black text-white">Accept Friend Request</button> : <button type="button" onClick={() => void sendFriendRequest(selectedGlobalMember.user_id)} disabled={friendActionLoading === selectedGlobalMember.user_id} className="mt-5 w-full rounded-xl bg-[#7564d8] px-4 py-3 text-sm font-black text-white disabled:opacity-50">{friendActionLoading === selectedGlobalMember.user_id ? "Sending…" : "＋ Add friend"}</button>; })()}
            </div>
          </section>
        </div>
      )}

      {friendSearchOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 px-4 py-6 backdrop-blur-sm" onClick={() => setFriendSearchOpen(false)}>
          <section role="dialog" aria-modal="true" aria-labelledby="friend-search-title" className="max-h-[88vh] w-full max-w-xl overflow-y-auto rounded-[2rem] border border-[#c9c2f5] bg-[#ffffff] p-6 shadow-2xl shadow-purple-950/70" onClick={(event) => event.stopPropagation()}>
            <div className="flex items-center justify-between gap-3"><div><h2 id="friend-search-title" className="text-2xl font-black">Find Friends</h2><p className="mt-1 text-sm text-[#6e6889]">Search by Anime Zone username.</p></div><button type="button" onClick={() => setFriendSearchOpen(false)} className="rounded-xl bg-[#e4e1ff] px-3 py-2 font-bold text-[#41366f]" aria-label="Close">✕</button></div>
            <div className="mt-6">
              <input value={friendSearchTerm} onChange={(event) => setFriendSearchTerm(event.target.value)} maxLength={20} placeholder="Search username..." autoComplete="off" className="w-full rounded-xl border border-[#c9c2f5] bg-[#f5f4ff] px-4 py-4 text-sm text-[#30284e] placeholder:text-[#85809d] outline-none focus:border-[#c084fc]" />
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



      {avatarZoomUrl && <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/90 p-5" onClick={() => setAvatarZoomUrl(null)}><button type="button" onClick={() => setAvatarZoomUrl(null)} className="absolute right-5 top-5 rounded-full bg-white/15 px-4 py-2 text-white" aria-label="Close enlarged picture">✕</button><img src={avatarZoomUrl} alt="Enlarged profile picture" className="max-h-[85dvh] max-w-[90vw] rounded-2xl object-contain shadow-2xl" onClick={(event) => event.stopPropagation()} /></div>}

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

                  <div className="relative z-10 -mt-10 px-4 pb-2">
                    <div className="relative flex h-20 w-20 items-center justify-center overflow-hidden rounded-2xl border-4 border-white bg-[#e9e7ff] text-4xl shadow-md">
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
                  {profile?.display_name || username}
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
                    <input
                      type="text"
                      value={`@${username}`}
                      readOnly
                      aria-label="Permanent username"
                      className="mt-2 w-full cursor-not-allowed rounded-xl border border-[#d9d4ff] bg-[#f0f7fb] px-4 py-3 text-sm font-semibold text-[#6e6889] outline-none"
                    />
                    <p className="mt-1 text-xs text-[#85809d]">
                      Your username is permanent and cannot be changed.
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

      <nav className="fixed bottom-0 left-0 right-0 z-30 border-t border-[#303449] bg-[#171a27]/95 px-2 pb-[max(8px,env(safe-area-inset-bottom))] pt-2 text-white backdrop-blur">
        <div className="mx-auto flex max-w-4xl items-center justify-around gap-1">
          <button
            onClick={() => setTab("lobby")}
            className={`flex flex-col items-center gap-1 rounded-xl px-2 py-2 text-[11px] font-bold transition ${
              tab === "lobby"
                ? "bg-[#30334d] text-white"
                : "text-[#9ba2bc]"
            }`}
          >
            <span className="text-xl">🏠</span>
            Lobby
          </button>
          <button
            onClick={() => setTab("chat")}
            className={`flex flex-col items-center gap-1 rounded-xl px-2 py-2 text-[11px] font-bold transition ${
              tab === "chat"
                ? "bg-[#30334d] text-white"
                : "text-[#9ba2bc]"
            }`}
          >
            <span className="relative text-xl">💬
              {incomingRequests.length > 0 && <span className="absolute -right-4 -top-3 min-w-5 rounded-full bg-blue-600 px-1.5 py-0.5 text-[10px] font-black leading-4 text-white">{incomingRequests.length}</span>}
              {unreadMessageCount > 0 && <span className="absolute -bottom-3 -right-4 min-w-5 rounded-full bg-red-600 px-1.5 py-0.5 text-[10px] font-black leading-4 text-white">{unreadMessageCount}</span>}
            </span>
            Chat
          </button>
          <button
            onClick={() => setTab("global")}
            className={`flex flex-col items-center gap-1 rounded-xl px-2 py-2 text-[11px] font-bold transition ${tab === "global" ? "bg-[#30334d] text-white" : "text-[#9ba2bc]"}`}
          >
            <span className="relative text-xl">🌐{unreadMentionCount > 0 && <span className="absolute -right-4 -top-3 min-w-5 rounded-full bg-rose-600 px-1.5 py-0.5 text-[10px] font-black leading-4 text-white">{unreadMentionCount}</span>}</span>
            Global
          </button>
          <button
            onClick={() => setTab("leaderboard")}
            className={`flex flex-col items-center gap-1 rounded-xl px-2 py-2 text-[11px] font-bold transition ${tab === "leaderboard" ? "bg-[#30334d] text-white" : "text-[#9ba2bc]"}`}
          >
            <span className="text-xl">🏆</span>
            Leaderboard
          </button>
          <button
            onClick={() => setTab("watch")}
            className={`flex flex-col items-center gap-1 rounded-xl px-2 py-2 text-[11px] font-bold transition ${tab === "watch" ? "bg-[#30334d] text-white" : "text-[#9ba2bc]"}`}
          >
            <span className="text-xl">🎬</span>
            Watch
          </button>
        </div>
      </nav>
    </main>
  );
}
