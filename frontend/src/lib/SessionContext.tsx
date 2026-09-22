"use client";

import { createContext, useContext } from "react";
import { ApiError } from "@/lib/api";

type SessionContextValue = {
  notifyUnauthorized: () => void;
};

// Default is a no-op rather than throwing: in the real app this is always
// provided by Home, but components that use it are also rendered directly
// in isolation in unit tests, which don't care about session-expiry wiring.
export const SessionContext = createContext<SessionContextValue>({
  notifyUnauthorized: () => {},
});

export const useSession = () => useContext(SessionContext);

/** True for a 401 from an authenticated API call — i.e. the session died server-side. */
export const isSessionExpired = (error: unknown): boolean =>
  error instanceof ApiError && error.status === 401;
