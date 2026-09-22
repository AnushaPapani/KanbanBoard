"use client";

import { useState, type FormEvent } from "react";
import { login, signup } from "@/lib/auth";

type LoginFormProps = {
  onSuccess: (username: string) => void;
};

type Mode = "sign-in" | "sign-up";

export const LoginForm = ({ onSuccess }: LoginFormProps) => {
  const [mode, setMode] = useState<Mode>("sign-in");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const switchMode = (nextMode: Mode) => {
    setMode(nextMode);
    setError(null);
  };

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const session =
        mode === "sign-in" ? await login(username, password) : await signup(username, password);
      onSuccess(session.username);
    } catch (err) {
      if (mode === "sign-in") {
        setError("Invalid username or password.");
      } else {
        setError(err instanceof Error ? err.message : "Could not create your account.");
      }
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
          {mode === "sign-in" ? "Sign in" : "Create an account"}
        </h1>

        <div className="mt-5 flex gap-1 rounded-full bg-[var(--surface)] p-1">
          <button
            type="button"
            onClick={() => switchMode("sign-in")}
            aria-pressed={mode === "sign-in"}
            aria-label="Switch to sign in"
            className={`flex-1 rounded-full px-3 py-1.5 text-xs font-semibold uppercase tracking-wide transition ${
              mode === "sign-in"
                ? "bg-white text-[var(--navy-dark)] shadow-sm"
                : "text-[var(--gray-text)]"
            }`}
          >
            Sign in
          </button>
          <button
            type="button"
            onClick={() => switchMode("sign-up")}
            aria-pressed={mode === "sign-up"}
            aria-label="Switch to sign up"
            className={`flex-1 rounded-full px-3 py-1.5 text-xs font-semibold uppercase tracking-wide transition ${
              mode === "sign-up"
                ? "bg-white text-[var(--navy-dark)] shadow-sm"
                : "text-[var(--gray-text)]"
            }`}
          >
            Sign up
          </button>
        </div>

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
            autoComplete={mode === "sign-in" ? "current-password" : "new-password"}
          />
        </label>
        {error && <p className="mt-4 text-sm text-red-600">{error}</p>}
        <button
          type="submit"
          disabled={submitting}
          className="mt-6 w-full rounded-full bg-[var(--secondary-purple)] px-4 py-3 text-sm font-semibold text-white transition disabled:opacity-60"
        >
          {submitting
            ? mode === "sign-in"
              ? "Signing in..."
              : "Creating account..."
            : mode === "sign-in"
              ? "Sign in"
              : "Create account"}
        </button>
      </form>
    </main>
  );
};
