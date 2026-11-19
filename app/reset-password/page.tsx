"use client";

import { useState } from "react";
import { createClient } from "../../src/lib/client";

export default function ResetPasswordPage() {
  const [supabase] = useState(() => createClient());
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [loading, setLoading] = useState(false);

  async function updatePassword() {
    setError("");
    setNotice("");
    if (password.length < 4) {
      setError("Password must be at least 4 characters.");
      return;
    }
    if (password !== confirmPassword) {
      setError("The passwords do not match.");
      return;
    }
    setLoading(true);
    try {
      const { error: updateError } = await supabase.auth.updateUser({ password });
      if (updateError) throw updateError;
      setNotice("Your password has been updated. You can now return to Anime Zone and sign in.");
      setPassword("");
      setConfirmPassword("");
    } catch (err) {
      console.error("Password update error:", err);
      setError(err instanceof Error ? err.message : "Could not update your password. Open the newest reset link from your email.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#f4f2ff] px-5 py-10 text-[#292448]">
      <section className="w-full max-w-md rounded-[2rem] border border-[#d9d4ff] bg-white p-8 shadow-xl">
        <img src="/az-logo.png" alt="Anime Zone" className="h-16 w-16 rounded-2xl object-cover" />
        <p className="mt-6 text-xs font-black uppercase tracking-[0.2em] text-[#7561c8]">Anime Zone account</p>
        <h1 className="mt-2 text-3xl font-black">Reset password</h1>
        <p className="mt-3 text-sm leading-6 text-[#6e6889]">Choose a new password for your Anime Zone account.</p>
        <label className="mt-6 block text-sm font-bold">New password</label>
        <input type="password" autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="At least 4 characters" className="mt-2 w-full rounded-2xl border-2 border-[#d9d4ff] bg-[#f0efff] px-4 py-4 text-sm outline-none focus:border-[#c084fc]" />
        <label className="mt-5 block text-sm font-bold">Confirm new password</label>
        <input type="password" autoComplete="new-password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} placeholder="Enter it again" className="mt-2 w-full rounded-2xl border-2 border-[#d9d4ff] bg-[#f0efff] px-4 py-4 text-sm outline-none focus:border-[#c084fc]" />
        {error && <p role="alert" className="mt-4 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-600">{error}</p>}
        {notice && <p role="status" className="mt-4 rounded-xl bg-green-50 px-4 py-3 text-sm text-green-700">{notice}</p>}
        <button type="button" disabled={loading} onClick={() => void updatePassword()} className="mt-6 w-full rounded-2xl bg-[#8b5cf6] px-6 py-4 font-bold text-white disabled:opacity-60">{loading ? "Updating..." : "Update password"}</button>
        <a href="/" className="mt-5 block text-center text-sm font-bold text-[#7561c8]">← Back to Anime Zone</a>
      </section>
    </main>
  );
}
