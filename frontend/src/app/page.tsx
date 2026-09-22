"use client";

import { useEffect, useState } from "react";
import { LoginForm } from "@/components/LoginForm";
import { Workspace } from "@/components/Workspace";
import { getMe, logout } from "@/lib/auth";
import { SessionContext } from "@/lib/SessionContext";

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

  return (
    <SessionContext.Provider value={{ notifyUnauthorized: () => setStatus("unauthenticated") }}>
      <Workspace onLogout={handleLogout} />
    </SessionContext.Provider>
  );
}
