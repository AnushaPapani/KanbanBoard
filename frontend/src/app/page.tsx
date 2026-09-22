"use client";

import { useEffect, useState } from "react";
import { KanbanBoard } from "@/components/KanbanBoard";
import { LoginForm } from "@/components/LoginForm";
import { getMe, logout } from "@/lib/auth";

type AuthStatus = "loading" | "authenticated" | "unauthenticated";

export default function Home() {
  const [status, setStatus] = useState<AuthStatus>("loading");

  useEffect(() => {
    getMe()
      .then((session) => setStatus(session ? "authenticated" : "unauthenticated"))
      .catch(() => setStatus("unauthenticated"));
  }, []);

  const handleLogout = async () => {
    await logout();
    setStatus("unauthenticated");
  };

  if (status === "loading") {
    return null;
  }

  if (status === "unauthenticated") {
    return <LoginForm onSuccess={() => setStatus("authenticated")} />;
  }

  return <KanbanBoard onLogout={handleLogout} />;
}
