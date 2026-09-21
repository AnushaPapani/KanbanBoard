"use client";

import { useState, type FormEvent } from "react";
import { login } from "@/lib/auth";

type LoginFormProps = {
  onSuccess: (username: string) => void;
};

export const LoginForm = ({ onSuccess }: LoginFormProps) => {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const session = await login(username, password);
      onSuccess(session.username);
    } catch {
      setError("Invalid username or password.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main className="flex min-h-screen items-center justify-center bg-[var(--surface)] px-6">
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-sm rounded-[32px] border border-[var(--stroke)] bg-white/90 p-8 shadow-[var(--shadow)]"
      >
        <p className="text-xs font-semibold uppercase tracking-[0.35em] text-[var(--gray-text)]">
          Kanban Studio
        </p>
        <h1 className="mt-3 font-display text-3xl font-semibold text-[var(--navy-dark)]">
          Sign in
        </h1>
        <label className="mt-6 block text-sm font-semibold text-[var(--navy-dark)]">
          Username
          <input
            value={username}
            onChange={(event) => setUsername(event.target.value)}
            className="mt-2 w-full rounded-xl border border-[var(--stroke)] px-4 py-2 text-sm outline-none focus:border-[var(--primary-blue)]"
            autoComplete="username"
          />
        </label>
        <label className="mt-4 block text-sm font-semibold text-[var(--navy-dark)]">
          Password
          <input
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            className="mt-2 w-full rounded-xl border border-[var(--stroke)] px-4 py-2 text-sm outline-none focus:border-[var(--primary-blue)]"
            autoComplete="current-password"
          />
        </label>
        {error && <p className="mt-4 text-sm text-red-600">{error}</p>}
        <button
          type="submit"
          disabled={submitting}
          className="mt-6 w-full rounded-full bg-[var(--secondary-purple)] px-4 py-3 text-sm font-semibold text-white transition disabled:opacity-60"
        >
          {submitting ? "Signing in..." : "Sign in"}
        </button>
      </form>
    </main>
  );
};
